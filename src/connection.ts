import type { Context } from '@deepseek-ai/cordis';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { AuthResult } from './auth.js';

export type ConnectionStatus = 'connected' | 'not_configured' | 'not_authorized' | 'verification_failed' | 'setup_failed' | 'check_failed';
export interface ConnectionResult { status: ConnectionStatus }

/** Interpret only the user identity: bot availability does not authorize our tools. */
export function connectionResult(result: AuthResult): ConnectionResult {
  if (result.status !== 'success') return { status: result.error?.code === 'not_configured' ? 'not_configured' : 'check_failed' };
  const identities = result.data?.identities as { user: { status: string; available: boolean; verified?: boolean } };
  const user = identities.user;
  if (user.status === 'not_configured') return { status: 'not_configured' };
  if (user.status === 'missing') return { status: 'not_authorized' };
  return { status: user.status === 'ready' && user.available && user.verified === true ? 'connected' : 'verification_failed' };
}

export class LarkConnection extends TypertRemoteService {
  constructor(ctx: Context, private readonly check: (signal?: AbortSignal) => Promise<ConnectionResult>) {
    super(ctx, 'larkConnection');
  }

  @Remote
  async test(): Promise<ConnectionResult> {
    return this.check(this.ctx.invocation?.signal);
  }
}
