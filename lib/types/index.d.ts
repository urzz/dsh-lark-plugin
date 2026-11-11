import z from '@deepseek-ai/schemastery';
import { type RunnerSubprocess } from './runner.js';
import type { Context } from '@deepseek-ai/cordis';
export declare const inject: readonly ["tools", "subprocess", "skills"];
export declare const Config: z<NoInfer<Schemastery.ObjectS<NoInfer<{
    appId: z<string, string, "defined">;
    appSecret: z<string, string, "defined">;
    brand: z<"feishu" | "lark", "feishu" | "lark", "defined">;
    executable: z<string, string, "defined">;
    cwd: z<string, string, "defined">;
    timeoutMs: z<number, number, "defined">;
    maxOutputBytes: z<number, number, "defined">;
}>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
    appId: z<string, string, "defined">;
    appSecret: z<string, string, "defined">;
    brand: z<"feishu" | "lark", "feishu" | "lark", "defined">;
    executable: z<string, string, "defined">;
    cwd: z<string, string, "defined">;
    timeoutMs: z<number, number, "defined">;
    maxOutputBytes: z<number, number, "defined">;
}>>>, "volatile-defined">;
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
    on(event: 'loader/volatile-update', listener: (paths: string[][]) => void): unknown;
    fiber: unknown;
    inject(names: ['typert'], callback: (child: Context) => void): unknown;
    inject(names: ['settings'], callback: (child: {
        settings: {
            configure(options: {
                auto: boolean;
            }, fiber: unknown): () => void;
        };
        effect(callback: () => (() => void)): unknown;
    }) => void): unknown;
}
export declare function apply(ctx: PluginContext, config: Config): void;
export {};
