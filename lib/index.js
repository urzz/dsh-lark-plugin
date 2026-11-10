import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineTool } from '@deepseek-ai/dsh-tools';
import z from '@deepseek-ai/schemastery';
import { createRunner, prepareArgs } from './runner.js';
import { CLI_PROFILE, createSetup } from './setup.js';
import { createAuth } from './auth.js';
// Adapter results contain JSON payloads and serializable process metadata.
const resultSchema = { type: 'object', additionalProperties: true, properties: { status: { type: 'string', required: true } } };
export const inject = ['tools', 'subprocess', 'skills'];
export const Config = z.object({
    appId: z.string().default('').description('Lark/Feishu application ID. Set together with App Secret to initialize the shared CLI configuration.'),
    appSecret: z.string().role('secret').default('').description('Application secret, sent privately to CLI initialization through stdin. Leave both credentials empty to use existing CLI configuration.'),
    brand: z.union(['feishu', 'lark']).default('feishu').description('Application platform: Feishu (China) or Lark (international).'),
    executable: z.string().default('').description('Optional external CLI executable override. Empty uses the bundled official CLI; its launcher downloads the platform binary on first use.'),
    cwd: z.string().default(process.cwd()).description('Working directory for CLI file input and output paths.'),
    timeoutMs: z.natural().min(1000).default(120000).description('Maximum time in milliseconds for each CLI process, including the initialization process.'),
    maxOutputBytes: z.natural().min(1024).max(20000000).default(1000000).description('Maximum bytes collected from each CLI output stream.'),
}).default({}).volatile();
export function apply(ctx, config) {
    function createRuntime() {
        const value = config.get();
        const options = { ...value, profile: value.appId.trim() || value.appSecret ? CLI_PROFILE : undefined };
        const controller = new AbortController();
        const run = createRunner(ctx.subprocess, options);
        const auth = createAuth(createRunner(ctx.subprocess, { ...options, allowAuth: true }));
        const setup = createSetup(ctx.subprocess, options);
        return {
            run, auth, setup,
            signal: (signal) => signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
            dispose() { controller.abort(); setup.dispose(); auth.dispose(); },
        };
    }
    let runtime = createRuntime();
    let disposed = false;
    ctx.on('loader/volatile-update', () => {
        if (disposed)
            return;
        runtime.dispose();
        runtime = createRuntime();
    });
    ctx.effect(() => () => { disposed = true; runtime.dispose(); });
    ctx.inject(['settings'], child => {
        child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
    });
    ctx.tools.register(defineTool({
        name: 'lark_cli',
        description: 'Read and write Feishu cloud documents, Sheets and Base using the official CLI. Also search and inspect Drive resources. Discover commands with --help and complex input with schema or --print-schema. Read the lark-workspace skill for workflows. Uses the user identity; high-risk --yes is unavailable. Partial or unknown writes must be checked before repeating.',
        parameters: {
            args: { type: 'array', required: true, items: { type: 'string' }, description: 'CLI arguments excluding the executable. Domains: docs, sheets, base, drive; discovery: schema, skills, --help, --version. Use JSON output; shell syntax is not interpreted.' },
            stdin: { type: 'string', description: 'Content or JSON for one CLI flag whose value is "-". File paths resolve in the configured CLI working directory.' },
        },
        output: { schema: resultSchema, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }] },
        async execute(args, exec) {
            try {
                prepareArgs(args.args);
            }
            catch (error) {
                return { status: 'failed', reason: error.message };
            }
            const current = runtime;
            const signal = current.signal(exec.signal);
            return { ...await current.setup.ensure(signal) ?? await current.run(args.args, args.stdin, signal) };
        },
        presentCall: args => ({ card: 'generic', title: `Lark ${args.args.slice(0, 2).join(' ')}`, kind: 'other', rawInput: args }),
    }));
    ctx.tools.register(defineTool({
        name: 'lark_auth',
        description: 'Manage the shared local Lark CLI user login. Start authorization, show the original returned URL and end the reply. Complete with flow_id only after the user confirms browser authorization. Logout clears the login shared by other sessions using this CLI account. Application credentials are configured privately in the plugin settings.',
        parameters: {
            action: { type: 'string', required: true, enum: ['status', 'login_start', 'login_complete', 'logout'] },
            flow_id: { type: 'string', description: 'Required for login_complete; returned by login_start and expires with the authorization request.' },
            verify: { type: 'boolean', description: 'For status, verify the token with the server; omitted means local status only.' },
        },
        output: { schema: resultSchema, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }] },
        async execute(args, exec) {
            const current = runtime;
            if (disposed)
                return { ...await current.auth.execute(args, exec.signal) };
            const signal = current.signal(exec.signal);
            return { ...await current.setup.ensure(signal) ?? await current.auth.execute(args, signal) };
        },
        presentCall: args => ({ card: 'generic', title: `Lark auth ${args.action}`, kind: args.action === 'status' ? 'read' : 'other' }),
    }));
    const base = fileURLToPath(new URL('../skills/lark-workspace/', import.meta.url));
    const skill = {
        name: 'lark-workspace', description: 'Read and write Feishu cloud documents, embedded tables, Sheets and Base through lark_cli; find resources and manage authorization.',
        source: 'bundled', provider: 'dsh-lark-plugin', invocation: { modelInvocable: true, userInvocable: true },
        resourceBase: { kind: 'directory', path: base }, rank: 0, locator: 'lark-workspace',
    };
    ctx.skills.registerProvider(() => ({
        name: 'dsh-lark-plugin',
        async list() { return [skill]; },
        async get() { return { ...skill, content: await readFile(new URL('../skills/lark-workspace/SKILL.md', import.meta.url), 'utf8') }; },
    }));
}
