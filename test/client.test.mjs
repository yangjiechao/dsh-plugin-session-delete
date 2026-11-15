import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Unit-test the non-rendering controller, not a mock DOM or visual preview.
const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
const instrumented = source.replace('    function useTranslation(locale) {',
  '    globalThis.testHooks = { createController, dictionaries, errorText };\n    function useTranslation(locale) {');
assert.notEqual(instrumented, source);
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function harness(handler) {
  const tasks = new Map(); let serial = 0, declaration;
  const context = vm.createContext({ AbortController, Date, console,
    document: { activeElement: null },
    window: { __ModuleLoader__: { load(value) { declaration = value; } },
      setTimeout(fn) { const id = ++serial; tasks.set(id, fn); return id; }, clearTimeout(id) { tasks.delete(id); } },
  });
  vm.runInContext(instrumented, context);
  declaration.factory(() => ({})); // No rendering; no React components are mounted.
  const calls = [];
  const controller = context.testHooks.createController({ connection: { rpc: { call(channel, endpoint, payload, signal) {
    calls.push({ channel, endpoint, payload, signal }); return handler(endpoint, payload, signal);
  } } } });
  return { controller, calls, hooks: context.testHooks, async open(id = 'A') {
    controller.open(id, `Title ${id}`);
    const pending = [...tasks.values()]; tasks.clear(); pending.forEach(fn => fn());
    await settle();
  } };
}
const plan = id => ({ ok: true, value: { sessionId: id, title: id, bytes: 20, fileCount: 1, token: 'a'.repeat(64), expiresAt: Date.now() + 120_000 } });
const success = id => ({ ok: true, value: { sessionId: id, deleted: true, bytes: 20, fileCount: 1, warnings: [] } });
function confirm(controller) { controller.acknowledge(true); controller.confirm('DELETE'); }

test('client requires checkbox and exact DELETE, and locks duplicate submission', async () => {
  const removal = Promise.withResolvers();
  const h = harness((op, payload) => op === 'prepare' ? plan(payload.sessionId) : removal.promise);
  await h.open();
  await h.controller.remove();
  h.controller.confirm('DELETE'); await h.controller.remove();
  h.controller.acknowledge(true); h.controller.confirm('delete'); await h.controller.remove();
  assert.equal(h.calls.length, 1);
  confirm(h.controller);
  const first = h.controller.remove(); await h.controller.remove();
  assert.equal(h.calls.filter(c => c.endpoint === 'remove').length, 1);
  h.controller.close(); assert.equal(h.controller.getSnapshot().phase, 'deleting');
  removal.resolve(success('A')); await first;
  assert.equal(h.controller.getSnapshot().phase, 'success');
  h.controller.dispose();
});

test('client expiration clears both confirmations and cannot submit', async () => {
  const h = harness((_op, payload) => plan(payload.sessionId));
  await h.open(); confirm(h.controller); h.controller.expire();
  assert.equal(h.controller.getSnapshot().error.code, 'EXPIRED');
  assert.equal(h.controller.getSnapshot().acknowledged, false);
  assert.equal(h.controller.getSnapshot().confirmation, '');
  await h.controller.remove(); assert.equal(h.calls.length, 1);
  h.controller.dispose();
});

test('closing a long wait does not cancel or replay deletion, and late result cannot overwrite new target', async () => {
  const removal = Promise.withResolvers();
  const h = harness((op, payload) => op === 'prepare' ? plan(payload.sessionId) : removal.promise);
  await h.open('A'); confirm(h.controller);
  const operation = h.controller.remove();
  const signal = h.calls.at(-1).signal;
  h.controller.close({ detachPending: true }); assert.equal(h.controller.getSnapshot().phase, 'deleting');
  h.controller.waitingLong(); h.controller.close(); assert.equal(h.controller.getSnapshot().phase, 'deleting');
  h.controller.close({ detachPending: true }); assert.equal(h.controller.getSnapshot(), null);
  assert.equal(signal.aborted, false);
  await h.open('B'); assert.equal(signal.aborted, false);
  removal.resolve(success('A')); await operation;
  assert.equal(h.controller.getSnapshot().sessionId, 'B');
  assert.equal(h.controller.getSnapshot().phase, 'ready');
  assert.equal(h.calls.filter(c => c.endpoint === 'remove').length, 1);
  h.controller.dispose();
});

test('partial deletion reports bounded counters but never arbitrary server detail fields', async () => {
  const h = harness((op, payload) => op === 'prepare' ? plan(payload.sessionId) : { ok: false, error: {
    code: 'PARTIAL_DELETE', message: 'partial', details: { removed: 2, bytes: 42, path: '/not-for-display', token: 'secret' } } });
  await h.open(); confirm(h.controller); await h.controller.remove();
  const state = h.controller.getSnapshot();
  assert.equal(state.phase, 'error'); assert.equal(state.error.operation, 'remove');
  assert.deepEqual(JSON.parse(JSON.stringify(state.error.details)), { removed: 2, bytes: 42 });
  assert.equal(state.confirmation, ''); assert.equal(state.acknowledged, false);
  h.controller.dispose();
});

test('prepare and submitted remove protocol failures have different outcome messages', async () => {
  const h = harness((op, payload) => op === 'prepare' ? plan(payload.sessionId) : { ok: true, value: null });
  await h.open(); confirm(h.controller); await h.controller.remove();
  const error = h.controller.getSnapshot().error;
  assert.equal(h.hooks.errorText(error, key => key), 'protocolRemove');
  assert.equal(h.hooks.errorText({ code: 'PROTOCOL', operation: 'prepare' }, key => key), 'protocol');
  assert.deepEqual(Object.keys(h.hooks.dictionaries.zh).sort(), Object.keys(h.hooks.dictionaries.en).sort());
  h.controller.dispose();
});
