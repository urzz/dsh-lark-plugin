import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { ConnectionResult } from '../src/connection.js';
export type { ConnectionResult };

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    larkConnection: { test(): Promise<RemoteResult<ConnectionResult>> };
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
