import { randomUUID } from 'node:crypto';
const record = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const nonempty = (value) => typeof value === 'string' && value.length > 0;
const identityStatuses = new Set(['ready', 'not_configured', 'missing', 'needs_refresh', 'verify_failed', 'error']);
const error = (status, code, message) => ({ status, error: { code, message } });
const unexpected = () => error('unknown', 'unexpected_auth_output', 'Unrecognized authentication response; check status before continuing.');
// Only projected fields leave this boundary. Never forward CLI diagnostic text,
// arbitrary nested data, or runner errors (which can contain argv and tokens).
function secretsIn(value, secrets) {
    if (Array.isArray(value)) {
        for (const item of value)
            secretsIn(item, secrets);
    }
    else if (record(value)) {
        for (const [key, item] of Object.entries(value)) {
            if (/^(devicecode|accesstoken|refreshtoken|appsecret|clientsecret)$/.test(key.replace(/[^a-z]/gi, '').toLowerCase()) && nonempty(item))
                secrets.add(item);
            secretsIn(item, secrets);
        }
    }
}
function redact(value, secrets) {
    if (typeof value === 'string') {
        for (const secret of secrets)
            value = value.split(secret).join('[REDACTED]');
        return value;
    }
    if (Array.isArray(value))
        return value.map(item => redact(item, secrets));
    if (record(value))
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item, secrets)]));
    return value;
}
function projectIdentity(value) {
    if (!record(value) || !identityStatuses.has(value.status) || typeof value.available !== 'boolean')
        return;
    const result = { status: value.status, available: value.available };
    if (value.verified !== undefined) {
        if (typeof value.verified !== 'boolean')
            return;
        result.verified = value.verified;
    }
    for (const key of ['openId', 'userName', 'appName']) {
        if (value[key] !== undefined) {
            if (typeof value[key] !== 'string')
                return;
            result[key] = value[key];
        }
    }
    return result;
}
/** Raw runner only: auth argv intentionally bypasses the business prepareArgs. */
export function createAuth(runCli) {
    const flows = new Map();
    let disposed = false;
    let tail = Promise.resolve();
    const removeFlow = (id) => {
        const flow = flows.get(id);
        if (flow)
            clearTimeout(flow.timer);
        flows.delete(id);
    };
    const clearFlows = () => { for (const id of flows.keys())
        removeFlow(id); };
    async function perform(args, signal) {
        if (disposed)
            return error('failed', 'auth_disposed', 'Authentication manager is disposed.');
        for (const [id, flow] of flows)
            if (flow.expiresAt <= Date.now())
                removeFlow(id);
        if (signal?.aborted)
            return error('unknown', 'auth_cancelled', 'Authentication call was cancelled.');
        let argv;
        const secrets = new Set([...flows.values()].map(flow => flow.deviceCode));
        switch (args.action) {
            case 'status':
                argv = ['auth', 'status', '--json', ...(args.verify ? ['--verify'] : [])];
                break;
            case 'login_start':
                argv = ['auth', 'login', '--domain', 'docs', '--domain', 'drive', '--domain', 'sheets', '--domain', 'base', '--no-wait', '--json'];
                break;
            case 'login_complete': {
                // The tool instruction requires explicit user confirmation before this
                // action. Device codes are never accepted as tool input or returned.
                const flow = args.flow_id ? flows.get(args.flow_id) : undefined;
                if (!flow)
                    return error('failed', 'invalid_auth_flow', 'Authorization flow is missing, expired, or already used. Start a new login.');
                secrets.add(flow.deviceCode);
                removeFlow(args.flow_id);
                argv = ['auth', 'login', '--device-code', flow.deviceCode, '--json'];
                break;
            }
            case 'logout':
                clearFlows();
                argv = ['auth', 'logout', '--json'];
                break;
            default:
                return error('failed', 'invalid_auth_action', 'Unsupported authentication action.');
        }
        let result;
        try {
            result = await runCli(argv, undefined, signal);
        }
        catch {
            return error('unknown', 'auth_execution_unknown', 'Authentication call did not return a result; check status before retrying.');
        }
        if (disposed)
            return error('unknown', 'auth_disposed', 'Authentication manager was disposed during the call.');
        secretsIn(result, secrets);
        // A successful completion with missing scopes can have a nonzero exit code.
        // Preserve the failed status rather than claiming all permissions succeeded.
        const data = result.data;
        if (result.status === 'unknown')
            return error('unknown', 'auth_result_unknown', 'Authentication outcome is unknown; check status before retrying.');
        if (result.status === 'failed' && !(args.action === 'login_complete' && record(data) && data.event === 'authorization_complete')) {
            // CLI configuration errors are emitted on stderr, outside its success payload.
            let diagnostic;
            try {
                diagnostic = JSON.parse(result.stderr ?? 'null');
            }
            catch { /* Plain diagnostics stay private. */ }
            if (record(diagnostic) && record(diagnostic.error) && diagnostic.error.type === 'config' && diagnostic.error.subtype === 'not_configured') {
                return error('failed', 'not_configured', 'Lark CLI application is not configured. Run lark-cli auth --help and complete application setup on the host before starting user authorization.');
            }
            return error('failed', 'auth_cli_failed', 'Authentication command failed. Check application configuration, authorization, and connectivity.');
        }
        if (!record(data))
            return unexpected();
        let safe;
        switch (args.action) {
            case 'login_start': {
                if (!nonempty(data.device_code) || !nonempty(data.verification_url) || !Number.isSafeInteger(data.expires_in) || data.expires_in <= 0)
                    return unexpected();
                // Return the original URL verbatim, never a reconstructed OAuth link.
                let url;
                try {
                    url = new URL(data.verification_url);
                }
                catch {
                    return unexpected();
                }
                if (url.protocol !== 'https:' || url.username || url.password || [...secrets].some(secret => data.verification_url === secret || data.verification_url.includes(secret)))
                    return unexpected();
                const expiresAt = Date.now() + data.expires_in * 1000;
                if (!Number.isSafeInteger(expiresAt) || expiresAt > 8.64e15)
                    return unexpected();
                const id = randomUUID();
                // Chunk long timeouts to avoid Node's signed 32-bit timeout overflow.
                const expire = () => {
                    const remaining = expiresAt - Date.now();
                    if (remaining <= 0) {
                        removeFlow(id);
                        return;
                    }
                    const entry = flows.get(id);
                    if (entry) {
                        entry.timer = setTimeout(expire, Math.min(remaining, 2_147_483_647));
                        entry.timer.unref();
                    }
                };
                const timer = setTimeout(expire, Math.min(data.expires_in * 1000, 2_147_483_647));
                timer.unref();
                flows.set(id, { deviceCode: data.device_code, expiresAt, timer });
                safe = { flow_id: id, verification_url: data.verification_url, expires_in: data.expires_in, expires_at: new Date(expiresAt).toISOString() };
                break;
            }
            case 'login_complete':
                if (data.event !== 'authorization_complete' || !nonempty(data.user_open_id) || typeof data.user_name !== 'string' || !Array.isArray(data.missing) || !data.missing.every(item => typeof item === 'string'))
                    return unexpected();
                safe = { event: data.event, user_open_id: data.user_open_id, user_name: data.user_name, missing: data.missing };
                break;
            case 'status': {
                if (!['user', 'bot', 'none'].includes(data.identity) || !record(data.identities))
                    return unexpected();
                const bot = projectIdentity(data.identities.bot);
                const user = projectIdentity(data.identities.user);
                if (!bot || !user)
                    return unexpected();
                safe = { identity: data.identity, identities: { bot, user } };
                break;
            }
            case 'logout':
                if (data.ok !== true || typeof data.loggedOut !== 'boolean')
                    return unexpected();
                safe = { loggedOut: data.loggedOut };
                if (data.reason === 'not_configured' || data.reason === 'not_logged_in')
                    safe.reason = data.reason;
                break;
        }
        return { status: result.status, data: redact(safe, secrets) };
    }
    return {
        execute(args, signal) {
            const next = tail.then(() => perform(args, signal));
            tail = next.catch(() => undefined);
            return next;
        },
        dispose() { disposed = true; clearFlows(); },
    };
}
