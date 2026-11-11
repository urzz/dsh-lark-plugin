import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { ConnectionResult as HostConnectionResult } from '../src/connection.js';
export type ConnectionResult = HostConnectionResult | { status: 'remote_failed'; errorCode?: string };

// Display infrastructure codes only; remote messages and details may contain private data.
export function remoteFailure(code?: string): ConnectionResult {
  const safeCodes = ['gateway/internal', 'gateway/cancelled', 'gateway/definition-unavailable', 'gateway/service-unavailable', 'gateway/method-unavailable', 'gateway/invocation-unavailable', 'gateway/result-invalid', 'gateway/provider-mismatch', 'gateway/ambiguous-endpoint', 'remote-access/denied'];
  return { status: 'remote_failed', ...(code && safeCodes.includes(code) ? { errorCode: code } : {}) };
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    larkConnection: { test(): Promise<RemoteResult<HostConnectionResult>> };
  }
}

// No arguments or secrets cross this endpoint; the Host uses its saved configuration.
export const connectionRemote: TypertRemoteContribution = {
  package: 'dsh-lark-plugin',
  descriptors: [{
    id: 'larkConnection/test', service: 'larkConnection', namespace: 'larkConnection', method: 'test',
    invocation: { kind: 'direct' }, parameters: [], result: { mode: 'src-json' },
  }],
};
