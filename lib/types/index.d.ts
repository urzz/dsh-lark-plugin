import z from '@deepseek-ai/schemastery';
import { type RunnerSubprocess } from './runner.js';
export declare const inject: readonly ["tools", "subprocess", "skills"];
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    executable: z<string, string, "defined">;
    cwd: z<string, string, "defined">;
    timeoutMs: z<number, number, "defined">;
    maxOutputBytes: z<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    executable: z<string, string, "defined">;
    cwd: z<string, string, "defined">;
    timeoutMs: z<number, number, "defined">;
    maxOutputBytes: z<number, number, "defined">;
}>>, "plain">;
export type Config = ReturnType<typeof Config>;
interface SkillCandidate {
    name: string;
    description: string;
    source: string;
    provider: string;
    invocation: {
        modelInvocable: boolean;
        userInvocable: boolean;
    };
    resourceBase: {
        kind: 'directory';
        path: string;
    };
    rank: number;
    locator: string;
}
interface PluginContext {
    tools: {
        register(tool: unknown): unknown;
    };
    subprocess: RunnerSubprocess;
    skills: {
        registerProvider(create: (control: unknown) => {
            name: string;
            list(): Promise<SkillCandidate[]>;
            get(candidate: SkillCandidate): Promise<SkillCandidate & {
                content: string;
            }>;
        }): unknown;
    };
    effect(callback: () => (() => void)): unknown;
}
export declare function apply(ctx: PluginContext, config: Config): void;
export {};
