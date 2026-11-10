import { type CliResult, type RunnerOptions, type RunnerSubprocess } from './runner.js';
export declare const CLI_PROFILE = "dsh-lark-plugin";
export interface ApplicationOptions extends RunnerOptions {
    appId: string;
    appSecret: string;
    brand: 'feishu' | 'lark';
}
/** Private host setup. Neither commands, credentials nor diagnostics reach tools. */
export declare function createSetup(subprocess: RunnerSubprocess, options: ApplicationOptions): {
    ensure(signal?: AbortSignal): Promise<CliResult | undefined>;
    dispose(): void;
};
