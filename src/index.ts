import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineTool, type InferValue } from '@deepseek-ai/dsh-tools';
import z from '@deepseek-ai/schemastery';
import { createRunner, type RunnerSubprocess } from './runner.js';
import { createAuth } from './auth.js';

// Adapter results contain JSON payloads and serializable process metadata.
const resultSchema = { type: 'object', additionalProperties: true, properties: { status: { type: 'string', required: true } } } as const;
type ToolResult = InferValue<typeof resultSchema>;

export const inject = ['tools', 'subprocess', 'skills'] as const;
export const Config = z.object({
  executable: z.string().default('lark-cli'),
  cwd: z.string().default(process.cwd()),
  timeoutMs: z.natural().min(1000).default(120000),
  maxOutputBytes: z.natural().min(1024).max(20000000).default(1000000),
});
export type Config = ReturnType<typeof Config>;

interface SkillCandidate {
  name: string; description: string; source: string; provider: string;
  invocation: { modelInvocable: boolean; userInvocable: boolean };
  resourceBase: { kind: 'directory'; path: string }; rank: number; locator: string;
}
interface PluginContext {
  tools: { register(tool: unknown): unknown };
  subprocess: RunnerSubprocess;
  skills: { registerProvider(create: (control: unknown) => {
    name: string; list(): Promise<SkillCandidate[]>;
    get(candidate: SkillCandidate): Promise<SkillCandidate & {content: string}>;
  }): unknown };
  effect(callback: () => (() => void)): unknown;
}

export function apply(ctx: PluginContext, config: Config): void {
  const run = createRunner(ctx.subprocess, config);
  const auth = createAuth(createRunner(ctx.subprocess, { ...config, allowAuth: true }));
  ctx.effect(() => () => auth.dispose());
  ctx.tools.register(defineTool({
    name: 'lark_cli',
    description: 'Read and write Feishu cloud documents, Sheets and Base using the official CLI. Also search and inspect Drive resources. Discover commands with --help and complex input with schema or --print-schema. Read the lark-workspace skill for workflows. Uses the user identity; high-risk --yes is unavailable. Partial or unknown writes must be checked before repeating.',
    parameters: {
      args: { type: 'array', required: true, items: { type: 'string' }, description: 'CLI arguments excluding the executable. Domains: docs, sheets, base, drive; discovery: schema, skills, --help, --version. Use JSON output; shell syntax is not interpreted.' },
      stdin: { type: 'string', description: 'Content or JSON for one CLI flag whose value is "-". File paths resolve in the configured CLI working directory.' },
    },
    output: { schema: resultSchema, render: (_args, value) => [{type:'text',text:JSON.stringify(value,null,2)}] },
    async execute(args, exec) { return { ...await run(args.args, args.stdin, exec.signal) } as ToolResult; },
    presentCall: args => ({card:'generic', title:`Lark ${args.args.slice(0,2).join(' ')}`,kind:'other',rawInput:args}),
  }));
  ctx.tools.register(defineTool({
    name: 'lark_auth',
    description: 'Manage the shared local Lark CLI user login. Start authorization, show the original returned URL and end the reply. Complete with flow_id only after the user confirms browser authorization. Logout clears the login shared by other sessions using this CLI account. Application setup is performed separately through the CLI.',
    parameters: {
      action: {type:'string',required:true,enum:['status','login_start','login_complete','logout']},
      flow_id: {type:'string',description:'Required for login_complete; returned by login_start and expires with the authorization request.'},
      verify: {type:'boolean',description:'For status, verify the token with the server; omitted means local status only.'},
    },
    output: {schema:resultSchema,render:(_args,value)=>[{type:'text',text:JSON.stringify(value,null,2)}]},
    async execute(args,exec) { return { ...await auth.execute(args,exec.signal) } as ToolResult; },
    presentCall: args => ({card:'generic',title:`Lark auth ${args.action}`,kind:args.action==='status'?'read':'other'}),
  }));
  const base = fileURLToPath(new URL('../skills/lark-workspace/', import.meta.url));
  const skill: SkillCandidate = {
    name:'lark-workspace', description:'Read and write Feishu cloud documents, embedded tables, Sheets and Base through lark_cli; find resources and manage authorization.',
    source:'bundled',provider:'dsh-lark-connect',invocation:{modelInvocable:true,userInvocable:true},
    resourceBase:{kind:'directory',path:base},rank:0,locator:'lark-workspace',
  };
  ctx.skills.registerProvider(() => ({
    name:'dsh-lark-connect',
    async list() { return [skill]; },
    async get() { return {...skill,content:await readFile(new URL('../skills/lark-workspace/SKILL.md',import.meta.url),'utf8')}; },
  }));
}
