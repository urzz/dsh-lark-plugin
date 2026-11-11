import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { AuthResult } from './auth.js';
export type ConnectionStatus = 'connected' | 'not_configured' | 'not_authorized' | 'verification_failed' | 'setup_failed' | 'check_failed';
export interface ConnectionResult {
    status: ConnectionStatus;
}
/** Interpret only the user identity: bot availability does not authorize our tools. */
export declare function connectionResult(result: AuthResult): ConnectionResult;
export declare class LarkConnection extends TypertRemoteService {
    private readonly check;
    constructor(ctx: Context, check: (signal?: AbortSignal) => Promise<ConnectionResult>);
    test(): Promise<ConnectionResult>;
}
