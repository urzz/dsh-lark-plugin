const businessDomains = new Set(['docs', 'sheets', 'base', 'drive']);
const discoveryDomains = new Set(['schema', 'skills', '--help', '--version']);
/** Validate at the argv boundary; all remaining values go to the CLI literally. */
export function prepareArgs(args) {
    if (!Array.isArray(args) || args.some(arg => typeof arg !== 'string' || arg.includes('\0'))) {
        throw new Error('CLI arguments must be strings without NUL characters.');
    }
    const business = businessDomains.has(args[0] ?? '');
    if (!business && !discoveryDomains.has(args[0] ?? '')) {
        throw new Error('Only docs, sheets, base, drive, schema, skills, --help and --version are supported.');
    }
    let hasIdentity = false;
    for (let index = 1; index < args.length; index++) {
        const arg = args[index];
        const [flag, inline] = arg.split('=', 2);
        if (arg === '--' && business)
            throw new Error('The argument separator is not supported for business commands.');
        if (flag === '--yes')
            throw new Error('High-risk confirmation bypass is not supported.');
        if (flag === '--jq' || /^-[^-]*q/.test(arg))
            throw new Error('JSON filtering would hide the CLI result envelope.');
        if (flag === '--as') {
            const value = inline ?? args[++index];
            if (value !== 'user')
                throw new Error('Only the user identity is supported.');
            hasIdentity = true;
        }
        if (flag === '--format' || flag === '--output-format' || flag === '--output' || flag === '-o' || /^-o./.test(arg)) {
            const value = /^-o[^=]/.test(arg) ? arg.slice(2) : inline ?? args[++index];
            if (value !== 'json')
                throw new Error('Only the complete JSON output format is supported.');
        }
    }
    return business && !hasIdentity ? [...args, '--as', 'user'] : [...args];
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** Execute once, without a shell or automatic retries, using DSH-managed processes. */
export function createRunner(subprocess, options) {
    return async (args, stdin, signal) => {
        let argv;
        try {
            argv = options.allowAuth && args[0] === 'auth' ? [...args] : prepareArgs(args);
        }
        catch (error) {
            return { status: 'failed', exitCode: null, reason: error.message };
        }
        const controller = new AbortController();
        let timedOut = false;
        let cancelled = signal?.aborted ?? false;
        const onAbort = () => { cancelled = true; controller.abort(); };
        if (cancelled)
            controller.abort();
        signal?.addEventListener('abort', onAbort, { once: true });
        const timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs);
        let spawned = false;
        try {
            const executable = await subprocess.resolveExecutable(options.executable, undefined, controller.signal);
            if (controller.signal.aborted)
                return { status: 'unknown', exitCode: null, timedOut, cancelled, reason: 'Execution interrupted; verify remote state before repeating the operation.' };
            const handle = subprocess.spawn({
                argv: [executable, ...argv],
                cwd: options.cwd,
                stdio: {
                    stdin: stdin === undefined ? 'ignore' : { data: stdin },
                    stdout: { maxBytes: options.maxOutputBytes },
                    stderr: { maxBytes: options.maxOutputBytes },
                },
                graceMs: 1000,
                signal: controller.signal,
            });
            spawned = true;
            const outcome = await handle.done;
            const stdout = handle.collected.stdout?.readFrom(0);
            const stderr = handle.collected.stderr?.readFrom(0);
            if (!stdout || !stderr)
                throw new Error('Missing collected output.');
            const result = { status: 'success', exitCode: outcome.exitCode };
            if (stderr.text)
                result.stderr = stderr.text;
            if (stdout.lossy || stderr.lossy) {
                result.lossy = true;
                result.output = { stdout, stderr };
            }
            if (!stdout.lossy && stdout.text.trim()) {
                try {
                    result.data = JSON.parse(stdout.text);
                }
                catch {
                    result.stdout = stdout.text;
                }
            }
            else if (stdout.text)
                result.stdout = stdout.text;
            if (timedOut || cancelled || outcome.signal || outcome.exitCode === null || result.lossy) {
                result.status = 'unknown';
                result.timedOut = timedOut;
                result.cancelled = cancelled;
                result.reason = 'Execution or output incomplete; remote writes may have occurred. Verify remote state before repeating the operation.';
            }
            else {
                const envelope = isRecord(result.data) ? result.data : undefined;
                const operation = isRecord(envelope?.data) ? envelope.data.result : undefined;
                const partial = operation === 'partial_success';
                if (partial)
                    result.partialSuccess = true;
                if (outcome.exitCode !== 0 || envelope?.ok === false || operation === 'failed' || partial)
                    result.status = 'failed';
                // Business responses must retain their structured status envelope. Help and discovery are text.
                const textAllowed = !businessDomains.has(argv[0]) || argv.includes('--help') || argv.includes('-h') || argv.includes('--print-schema');
                if (!textAllowed && (!envelope || typeof envelope.ok !== 'boolean')) {
                    result.status = outcome.exitCode === 0 ? 'unknown' : 'failed';
                    result.reason = 'CLI response did not contain a complete JSON status envelope.';
                }
            }
            return result;
        }
        catch {
            return {
                status: spawned || timedOut || cancelled ? 'unknown' : 'failed',
                exitCode: null,
                timedOut,
                cancelled,
                reason: spawned || timedOut || cancelled
                    ? 'Execution interrupted; remote writes may have occurred. Verify remote state before repeating the operation.'
                    : 'Unable to resolve or start the configured CLI executable.',
            };
        }
        finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
        }
    };
}
