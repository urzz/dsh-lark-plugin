import type { CliResult } from './runner.js';
export interface AuthArgs {
    action: 'status' | 'login_start' | 'login_complete' | 'logout';
    flow_id?: string;
    verify?: boolean;
}
type RunCli = (args: string[], stdin?: string, signal?: AbortSignal) => Promise<CliResult>;
type ObjectValue = Record<string, unknown>;
export interface AuthResult {
    status: 'success' | 'failed' | 'unknown';
    data?: ObjectValue;
    error?: {
        code: string;
        message: string;
    };
}
/** Raw runner only: auth argv intentionally bypasses the business prepareArgs. */
export declare function createAuth(runCli: RunCli): {
    execute(args: AuthArgs, signal?: AbortSignal): Promise<AuthResult>;
    dispose(): void;
};
export {};
