import assert from 'node:assert/strict';
import test from 'node:test';
import { createRunner, prepareArgs } from '../lib/runner.js';

const options = { executable: 'lark-cli', cwd: '/workspace', timeoutMs: 1000, maxOutputBytes: 4096 };
function fake({ stdout = '{"ok":true,"data":{"id":"doc-id"}}', stderr = '', exitCode = 0, lossy = false, stderrLossy = false, pending = false, rejectDone = false } = {}) {
  const calls = [];
  const reads = [];
  const service = {
    async resolveExecutable(...args) { calls.push({ resolve: args }); return '/bin/lark-cli'; },
    spawn(spec) {
      calls.push({ spawn: spec });
      return {
        collected: {
          stdout: { readFrom(offset) { reads.push(['stdout', offset]); return { text: stdout, nextOffset: Buffer.byteLength(stdout), lossy, ...(lossy ? { spillPath: '/spill/stdout' } : {}) }; } },
          stderr: { readFrom(offset) { reads.push(['stderr', offset]); return { text: stderr, nextOffset: Buffer.byteLength(stderr), lossy: stderrLossy }; } },
        },
        done: rejectDone ? Promise.reject(new Error('provider diagnostic with sensitive argv')) : pending
          ? new Promise(resolve => spec.signal.addEventListener('abort', () => resolve({ exitCode: null, signal: 'SIGTERM' }), { once: true }))
          : Promise.resolve({ exitCode, signal: null }),
      };
    },
  };
  return { service, calls, reads, run: createRunner(service, options) };
}

test('defaults business calls to user identity without mutating argv', () => {
  for (const domain of ['docs', 'sheets', 'base', 'drive']) {
    const args = [domain, '+fetch'];
    assert.deepEqual(prepareArgs(args), [domain, '+fetch', '--as', 'user']);
    assert.deepEqual(args, [domain, '+fetch']);
  }
  assert.deepEqual(prepareArgs(['docs', '--as=user']), ['docs', '--as=user']);
  assert.deepEqual(prepareArgs(['docs', '--as', 'user']), ['docs', '--as', 'user']);
  for (const args of [['schema', 'docs.v1.get'], ['skills', 'read', 'lark-doc'], ['--help'], ['--version']]) assert.deepEqual(prepareArgs(args), args);
});

test('denies other domains, identity overrides, confirmation bypass and hidden envelopes', () => {
  for (const args of [
    [], ['auth', 'login'], ['api', 'POST', '/path'], ['im', '+send'], ['config', 'set'],
    ['docs', '--as', 'bot'], ['docs', '--as=bot'], ['docs', '--as=user', '--as=bot'],
    ['docs', '--profile', 'other'], ['schema', '--profile=other'], ['--help', '--profile', 'other'],
    ['drive', '--yes'], ['drive', '--yes=true'], ['drive', '--yes=false'],
    ['docs', '--jq', '.data'], ['docs', '--jq=.data'], ['docs', '-q', '.data'], ['docs', '-q.data'], ['docs', '-hq.data'],
    ['docs', '--format', 'text'], ['docs', '--output-format=yaml'], ['docs', '--output=text'], ['docs', '-otext'],
    ['docs', '--', '--as', 'bot'], ['docs', '--doc', 'bad\0value'],
  ]) assert.throws(() => prepareArgs(args), { name: 'Error' }, JSON.stringify(args));
  assert.deepEqual(prepareArgs(['docs', '--doc-format', 'markdown']), ['docs', '--doc-format', 'markdown', '--as', 'user']);
});

test('fixed executable, literal argv, stdin, collect limits and cwd go through DSH', async () => {
  const { run, calls, reads } = fake();
  const literal = '$(touch /tmp/not-executed); `echo secret`';
  const result = await run(['docs', '+create', '--title', literal], '<doc>body</doc>');
  assert.equal(result.status, 'success');
  assert.deepEqual(result.data, { ok: true, data: { id: 'doc-id' } });
  assert.equal(calls[0].resolve[0], 'lark-cli');
  assert.equal(calls[0].resolve[1], undefined);
  const spec = calls[1].spawn;
  assert.deepEqual(spec.argv, ['/bin/lark-cli', 'docs', '+create', '--title', literal, '--as', 'user']);
  assert.equal(spec.cwd, '/workspace');
  assert.deepEqual(spec.stdio, { stdin: { data: '<doc>body</doc>' }, stdout: { maxBytes: 4096 }, stderr: { maxBytes: 4096 } });
  assert.equal(spec.graceMs, 1000);
  assert.deepEqual(reads, [['stdout', 0], ['stderr', 0]]);
});

test('nonzero JSON response and diagnostic stderr both survive', async () => {
  const data = { ok: false, error: { code: 'confirmation_required', message: 'Confirm first' }, warnings: ['warning'] };
  const { run } = fake({ stdout: JSON.stringify(data), stderr: '{"diagnostic":"details"}\n', exitCode: 10 });
  const result = await run(['drive', 'files', 'delete']);
  assert.equal(result.status, 'failed');
  assert.equal(result.exitCode, 10);
  assert.deepEqual(result.data, data);
  assert.equal(result.stderr, '{"diagnostic":"details"}\n');
});

test('stderr-only CLI error envelopes remain available on nonzero exits', async () => {
  const stderr = JSON.stringify({ ok: false, identity: 'user', error: { type: 'authorization', subtype: 'missing_scope', missing_scopes: ['docs:read'] } });
  const result = await fake({ stdout: '', stderr, exitCode: 1 }).run(['docs', '+fetch']);
  assert.equal(result.status, 'failed');
  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr, stderr);
  assert.equal(result.data, undefined);
});

test('partial success retains full envelope, resources, tips and warnings', async () => {
  const data = { ok: true, data: { result: 'partial_success', block_ids: ['block-1'], reference_map: { image: 'resource-1' } }, tips: ['read back'], warnings: ['one block failed'] };
  const { run } = fake({ stdout: JSON.stringify(data) });
  const result = await run(['docs', '+update']);
  assert.equal(result.status, 'failed');
  assert.equal(result.partialSuccess, true);
  assert.deepEqual(result.data, data);
});

test('CLI failure envelope fails even with exit zero', async () => {
  assert.equal((await fake({ stdout: '{"ok":false}' }).run(['docs', '+fetch'])).status, 'failed');
  assert.equal((await fake({ stdout: '{"ok":true,"data":{"result":"failed"}}' }).run(['docs', '+update'])).status, 'failed');
});

test('help, skills and schema can return text; unstructured business output is unknown', async () => {
  for (const args of [['--help'], ['skills', 'read', 'lark-doc'], ['schema', 'docs.get'], ['docs', '+fetch', '--help'], ['docs', '+fetch', '--print-schema']]) {
    const result = await fake({ stdout: 'human readable content\n' }).run(args);
    assert.equal(result.status, 'success');
    assert.equal(result.stdout, 'human readable content\n');
    assert.equal(result.data, undefined);
  }
  assert.equal((await fake({ stdout: 'truncated JSON {' }).run(['docs', '+fetch'])).status, 'unknown');
  assert.equal((await fake({ stdout: '' }).run(['docs', '+update'])).status, 'unknown');
});

test('lossy stdout never becomes trusted JSON even if the retained text parses', async () => {
  const result = await fake({ lossy: true }).run(['docs', '+create']);
  assert.equal(result.status, 'unknown');
  assert.equal(result.lossy, true);
  assert.equal(result.data, undefined);
  assert.equal(result.output.stdout.spillPath, '/spill/stdout');
  assert.equal(result.output.stdout.lossy, true);
});

test('lossy diagnostics are explicit and leave the complete stdout envelope available', async () => {
  const result = await fake({ stderr: 'incomplete diagnostic', stderrLossy: true }).run(['docs', '+update']);
  assert.equal(result.status, 'unknown');
  assert.equal(result.output.stderr.lossy, true);
  assert.equal(result.data.ok, true);
});

test('timeout aborts the DSH process and reports uncertain remote state without retry', async () => {
  const { service, calls } = fake({ pending: true });
  const result = await createRunner(service, { ...options, timeoutMs: 5 })(['docs', '+create']);
  assert.equal(result.status, 'unknown');
  assert.equal(result.timedOut, true);
  assert.equal(result.exitCode, null);
  assert.match(result.reason, /remote writes may have occurred/i);
  assert.equal(calls.filter(call => call.spawn).length, 1);
  assert.equal(calls[1].spawn.signal.aborted, true);
});

test('caller cancellation propagates; pre-aborted calls do not spawn', async () => {
  const controller = new AbortController();
  const { run, calls } = fake({ pending: true });
  const promise = run(['docs', '+create'], undefined, controller.signal);
  await Promise.resolve();
  controller.abort();
  const result = await promise;
  assert.equal(result.status, 'unknown');
  assert.equal(result.cancelled, true);
  assert.equal(calls.filter(call => call.spawn).length, 1);
  const before = fake();
  assert.equal((await before.run(['docs', '+create'], undefined, controller.signal)).status, 'unknown');
  assert.equal(before.calls.filter(call => call.spawn).length, 0);
});

test('invalid domains do not resolve or spawn; provider errors do not expose raw arguments', async () => {
  const invalid = fake();
  assert.equal((await invalid.run(['auth', 'login'])).status, 'failed');
  assert.equal(invalid.calls.length, 0);
  const result = await fake({ rejectDone: true }).run(['docs', '+update', '--title', 'private-content']);
  assert.equal(result.status, 'unknown');
  assert.doesNotMatch(JSON.stringify(result), /private-content|sensitive argv/);
});
