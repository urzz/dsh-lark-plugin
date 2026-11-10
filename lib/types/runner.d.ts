export interface RunnerOptions {
    executable: string;
    /** Plugin-owned profile; never accepted from model arguments. */
    profile?: string;
    /** Host-only fixed application initialization. */
    allowConfig?: boolean;
    cwd: string;
    timeoutMs: number;
    maxOutputBytes: number;
    /** Internal runner for fixed auth argv only; never exposed by lark_cli. */
    allowAuth?: boolean;
}
export interface CliResult {
    status: 'success' | 'failed' | 'unknown';
    exitCode: number | null;
    data?: any;
    stdout?: string;
    stderr?: string;
    reason?: string;
    partialSuccess?: boolean;
    timedOut?: boolean;
    cancelled?: boolean;
    lossy?: boolean;
    output?: {
        stdout: CollectedOutput;
        stderr: CollectedOutput;
    };
}
/** The subset of the inspected DSH subprocess contract used by this runner. */
export type CollectedOutput = {
    text: string;
    nextOffset: number;
    lossy: boolean;
    spillPath?: string;
};
export interface RunnerSubprocess {
    resolveExecutable(command: string, env?: Readonly<Record<string, string>>, signal?: AbortSignal): Promise<string>;
    spawn(spec: {
        argv: readonly string[];
        cwd: string;
        stdio: {
            stdin: 'ignore' | {
                readonly data: string;
            };
            stdout: {
                maxBytes: number;
            };
            stderr: {
                maxBytes: number;
            };
        };
        graceMs: number;
        signal?: AbortSignal;
    }): {
        collected: {
            readonly stdout?: {
                readFrom(fromByte: number): CollectedOutput;
            };
            readonly stderr?: {
                readFrom(fromByte: number): CollectedOutput;
            };
        };
        done: Promise<{
            exitCode: number | null;
            signal: string | null;
        }>;
    };
}
/** Validate at the argv boundary; all remaining values go to the CLI literally. */
export declare function prepareArgs(args: string[]): string[];
/** Execute once, without a shell or automatic retries, using DSH-managed processes. */
export declare function createRunner(subprocess: RunnerSubprocess, options: RunnerOptions): (args: string[], stdin?: string, signal?: AbortSignal) => Promise<CliResult>;
