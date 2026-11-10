import { createRunner } from './runner.js';
export const CLI_PROFILE = 'dsh-lark-plugin';
/** Private host setup. Neither commands, credentials nor diagnostics reach tools. */
export function createSetup(subprocess, options) {
    const controller = new AbortController();
    const run = createRunner(subprocess, { ...options, profile: CLI_PROFILE, allowConfig: true });
    let pending;
    const interrupted = () => ({ status: 'unknown', exitCode: null, reason: 'Application setup was interrupted. Reload the plugin before retrying.', cancelled: true });
    async function initialize() {
        const appId = options.appId.trim();
        if (!appId && !options.appSecret)
            return;
        if (!appId || !options.appSecret || /[\r\n\0]/.test(options.appSecret)) {
            return { status: 'failed', exitCode: null, reason: 'Set both App ID and App Secret in the plugin configuration. App Secret must be a single line.' };
        }
        const result = await run(['config', 'init', '--name', CLI_PROFILE, '--app-id', appId, '--app-secret-stdin', '--brand', options.brand], options.appSecret + '\n', controller.signal);
        if (result.status !== 'success')
            return {
                status: result.status, exitCode: result.exitCode,
                reason: 'Lark application initialization failed. Check the plugin App ID, App Secret, platform, and host connectivity; reload the plugin before retrying.',
            };
    }
    return {
        async ensure(signal) {
            if (controller.signal.aborted || signal?.aborted)
                return interrupted();
            pending ??= initialize();
            if (!signal)
                return pending;
            let onAbort;
            const cancelled = new Promise(resolve => {
                onAbort = () => resolve(interrupted());
                signal.addEventListener('abort', onAbort, { once: true });
            });
            try {
                return await Promise.race([pending, cancelled]);
            }
            finally {
                signal.removeEventListener('abort', onAbort);
            }
        },
        dispose() { controller.abort(); },
    };
}
