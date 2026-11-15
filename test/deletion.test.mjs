import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { SessionDeletion, RECEIPT, encodeId, validateId } from '../deletion.js';
import { apply } from '../index.js';

const CURRENT = 'session.v4.jsonl.zstd';
const GENERATIONS = ['session.jsonl.zstd', 'session.v2.jsonl.zstd', 'session.v3.jsonl.zstd', CURRENT];
const deferred = () => Promise.withResolvers();
const rejection = code => error => { assert.equal(error.code, code); return true; };
const exists = async file => { try { await fs.lstat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };

async function fixture(t, { generations = GENERATIONS, unlink, open, close } = {}) {
  // macOS /var and /tmp are symlinks. Every test target starts from the actual
  // canonical temporary root, never a lexical /tmp path or real session home.
  const base = await fs.realpath(tmpdir());
  const temporary = await fs.mkdtemp(path.join(base, 'dsh-session-delete-test-'));
  assert.equal(temporary, await fs.realpath(temporary));
  assert.ok(path.isAbsolute(temporary));
  const id = 'session-test-A';
  const root = path.join(temporary, 'sessions');
  const dir = path.join(root, '--root--', id);
  await fs.mkdir(dir, { recursive: true });
  const bodies = new Map(generations.map((name, index) => [name, `temporary generation ${index}\n`]));
  for (const [name, body] of bodies) await fs.writeFile(path.join(dir, name), body);
  await fs.writeFile(path.join(dir, 'session.lock'), 'stable test lock inode');
  const beforeLock = await fs.lstat(path.join(dir, 'session.lock'), { bigint: true });
  const state = {
    archived: true, live: false, liveHeaders: [], children: [], opens: 0, closes: 0,
    unlinks: [], detaches: [], warnings: [], revision: 'revision-1',
    header: { id, version: 4, createdAt: 1_700_000_000_000, cwd: '/', isSeeded: false },
    formatStatus: 'current', kind: 'jsonl', location: path.join(dir, CURRENT),
  };
  const snapshot = () => ({ header: { ...state.header }, revision: state.revision,
    formatStatus: state.formatStatus, location: { kind: state.kind, path: state.location } });
  const persistence = {
    async stat(requested) { assert.equal(requested, id); return await exists(state.location) ? snapshot() : undefined; },
    async list() { return [...(await exists(state.location) ? [snapshot()] : []), ...state.children]; },
    async open(requested, access, options) {
      assert.equal(requested, id); assert.equal(access, 'write'); state.opens++;
      await open?.({ state, dir, options });
      return { header: { ...state.header }, async close() { state.closes++; await close?.({ state, dir }); } };
    },
  };
  const workspace = { sessionIds: [id], async detachSession(requested) {
    assert.equal(requested, id); state.detaches.push(requested); this.sessionIds = this.sessionIds.filter(value => value !== requested);
  } };
  const deps = {
    persistence, isArchived: requested => { assert.equal(requested, id); return state.archived; },
    isLive: requested => { assert.equal(requested, id); return state.live; },
    liveHeaders: () => state.liveHeaders, workspaces: () => [workspace], warn: message => state.warnings.push(message),
  };
  const core = new SessionDeletion(deps, { async unlink(target) {
    // Even injected failure paths are confined to this fixture's canonical dir.
    assert.equal(path.dirname(target), dir); assert.ok(path.isAbsolute(target));
    state.unlinks.push(path.basename(target));
    if (unlink) return unlink(target, { state, dir, fs });
    return fs.unlink(target);
  } });
  t.after(async () => {
    await core.close();
    // Verify the exact absolute target before recursive test-only cleanup.
    assert.equal(path.dirname(temporary), base);
    assert.ok(path.basename(temporary).startsWith('dsh-session-delete-test-'));
    assert.equal(await fs.realpath(temporary), temporary);
    await fs.rm(temporary, { recursive: true, force: true });
  });
  const request = async (peer = 'owner-A') => {
    const prepared = await core.prepare(id, peer);
    return { sessionId: id, token: prepared.token, confirmText: 'DELETE', acknowledgeLimits: true };
  };
  return { temporary, root, dir, id, bodies, beforeLock, state, core, deps, persistence, workspace, request };
}

async function directorySnapshot(dir) {
  return Promise.all((await fs.readdir(dir)).sort().map(async name => {
    const stat = await fs.lstat(path.join(dir, name), { bigint: true });
    return { name, ino: String(stat.ino), size: String(stat.size), mtime: String(stat.mtimeNs),
      bytes: stat.isFile() ? await fs.readFile(path.join(dir, name), 'hex') : undefined };
  }));
}

test('preview and preparation do not write, lock, detach, or return preview authorization', async t => {
  const f = await fixture(t);
  const before = await directorySnapshot(f.dir);
  const preview = await f.core.preview(f.id);
  assert.deepEqual(preview, { sessionId: f.id, bytes: [...f.bodies.values()].reduce((n, body) => n + Buffer.byteLength(body), 0),
    fileCount: 4, scope: 'local-session-logs-only' });
  assert.ok(!('token' in preview));
  const preparation = await f.core.prepare(f.id, 'owner-A');
  assert.match(preparation.token, /^[a-f0-9]{64}$/);
  assert.deepEqual(await directorySnapshot(f.dir), before);
  assert.equal(f.state.opens, 0); assert.equal(f.state.closes, 0); assert.deepEqual(f.state.detaches, []);
});

test('successful deletion removes generations oldest first/current last, preserves lock and receipt', async t => {
  const f = await fixture(t);
  const result = await f.core.remove(await f.request(), 'owner-A');
  assert.equal(result.deleted, true); assert.equal(result.fileCount, 4);
  assert.equal(result.bytes, [...f.bodies.values()].reduce((n, body) => n + Buffer.byteLength(body), 0));
  assert.deepEqual(f.state.unlinks, GENERATIONS);
  assert.deepEqual((await fs.readdir(f.dir)).sort(), [RECEIPT, 'session.lock'].sort());
  const afterLock = await fs.lstat(path.join(f.dir, 'session.lock'), { bigint: true });
  assert.equal(afterLock.ino, f.beforeLock.ino); assert.equal(afterLock.dev, f.beforeLock.dev);
  assert.equal(await fs.readFile(path.join(f.dir, 'session.lock'), 'utf8'), 'stable test lock inode');
  const receipt = JSON.parse(await fs.readFile(path.join(f.dir, RECEIPT), 'utf8'));
  assert.equal(receipt.sessionId, f.id); assert.equal(receipt.createdAt, f.state.header.createdAt);
  assert.deepEqual(receipt.files, GENERATIONS);
  assert.equal(f.state.opens, 1); assert.equal(f.state.closes, 1); assert.deepEqual(f.state.detaches, [f.id]);
  await assert.rejects(f.core.preview(f.id), rejection('DELETING'));
});

for (const [label, configure, code] of [
  ['unarchived session', f => { f.state.archived = false; }, 'NOT_ARCHIVED'],
  ['live Agent/Session', f => { f.state.live = true; }, 'LIVE_SESSION'],
  ['stored child/fork', f => { f.state.children.push({ header: { id: 'child', parentSession: f.id } }); }, 'HAS_CHILDREN'],
  ['live child/fork', f => { f.state.liveHeaders.push({ id: 'child', parentSession: f.id }); }, 'HAS_CHILDREN'],
  ['subagent origin', f => { f.state.header.origin = 'subagent'; }, 'UNSUPPORTED'],
  ['migration-required format', f => { f.state.formatStatus = 'migration-required'; }, 'UNSUPPORTED'],
  ['historical header', f => { f.state.header.version = 3; }, 'UNSUPPORTED'],
  ['foreign backend', f => { f.state.kind = 'sqlite'; }, 'UNSUPPORTED'],
  ['header id mismatch', f => { f.state.header.id = 'not-the-requested-session'; }, 'UNSUPPORTED'],
]) {
  test(`refuses ${label} before write-open`, async t => {
    const f = await fixture(t); configure(f);
    await assert.rejects(f.core.preview(f.id), rejection(code));
    assert.deepEqual(f.state.unlinks, []); assert.equal(f.state.opens, 0);
    assert.ok(await exists(path.join(f.dir, CURRENT)));
  });
}

test('refuses missing session without opening writer', async t => {
  const f = await fixture(t); f.state.location = path.join(f.dir, 'missing.v4.jsonl.zstd');
  await assert.rejects(f.core.preview(f.id), rejection('NOT_FOUND')); assert.equal(f.state.opens, 0);
});

for (const name of ['unknown.txt', 'session.v5.jsonl.zstd', 'session.v3.jsonl']) {
  test(`refuses unknown/future/mixed-encoding file ${name}`, async t => {
    const f = await fixture(t); await fs.writeFile(path.join(f.dir, name), 'do not touch');
    await assert.rejects(f.core.preview(f.id), rejection('UNSUPPORTED'));
    assert.deepEqual(f.state.unlinks, []); assert.equal(f.state.opens, 0);
  });
}

test('refuses symlink file without following target', async t => {
  const f = await fixture(t); const target = path.join(f.temporary, 'unrelated.txt');
  await fs.writeFile(target, 'retained'); await fs.symlink(target, path.join(f.dir, 'alias'));
  await assert.rejects(f.core.preview(f.id), rejection('UNSAFE_PATH'));
  assert.equal(await fs.readFile(target, 'utf8'), 'retained'); assert.deepEqual(f.state.unlinks, []);
});

test('refuses hard-linked log, preserving unrelated alias', async t => {
  const f = await fixture(t); const target = path.join(f.temporary, 'hard-link');
  await fs.link(path.join(f.dir, CURRENT), target);
  await assert.rejects(f.core.preview(f.id), rejection('UNSAFE_PATH'));
  assert.ok(await exists(target)); assert.deepEqual(f.state.unlinks, []);
});

test('refuses path with symlink ancestor', async t => {
  const f = await fixture(t); const alias = path.join(f.temporary, 'root-alias');
  await fs.symlink(f.root, alias); f.state.location = path.join(alias, '--root--', f.id, CURRENT);
  await assert.rejects(f.core.preview(f.id), rejection('UNSAFE_PATH')); assert.deepEqual(f.state.unlinks, []);
});

test('refuses mismatched directory layout', async t => {
  const f = await fixture(t); f.state.header.cwd = '/different-project';
  await assert.rejects(f.core.preview(f.id), rejection('UNSAFE_PATH')); assert.deepEqual(f.state.unlinks, []);
});

test('refuses relative location and unexpected selected filename', async t => {
  const f = await fixture(t);
  const realStat = f.persistence.stat;
  f.persistence.stat = async id => { const snapshot = await realStat(id); return { ...snapshot, location: { kind: 'jsonl', path: 'relative/session.v4.jsonl.zstd' } }; };
  await assert.rejects(f.core.preview(f.id), rejection('UNSUPPORTED'));
  f.persistence.stat = realStat;
  await fs.writeFile(path.join(f.dir, 'wrong-name'), 'retained'); f.state.location = path.join(f.dir, 'wrong-name');
  await assert.rejects(f.core.preview(f.id), rejection('UNSUPPORTED'));
});

test('refuses directory entry and mismatching deletion receipt', async t => {
  const f = await fixture(t); await fs.mkdir(path.join(f.dir, 'nested'));
  await assert.rejects(f.core.preview(f.id), rejection('UNSAFE_PATH'));
  await fs.rmdir(path.join(f.dir, 'nested'));
  await fs.writeFile(path.join(f.dir, RECEIPT), JSON.stringify({ version: 1, sessionId: 'someone-else', createdAt: f.state.header.createdAt }));
  await assert.rejects(f.core.preview(f.id), rejection('UNSAFE_PATH'));
});

test('refuses invalid identifiers; path-like identifiers are encoded, not interpolated', () => {
  for (const id of ['', null, undefined, 7, 'x\0y', 'x\ny', 'x'.repeat(257)]) assert.throws(() => validateId(id), rejection('BAD_REQUEST'));
  assert.equal(encodeId('..'), '~002E~002E'); assert.equal(encodeId('../a/b'), '..~002Fa~002Fb');
  assert.equal(encodeId('~'), '~007E'); assert.equal(encodeId('\ud800'), '~D800');
});

test('confirmation token is peer-bound and expires', async t => {
  const f = await fixture(t); const req = await f.request();
  await assert.rejects(f.core.remove(req, 'different-peer'), rejection('EXPIRED'));
  const now = Date.now(); t.mock.method(Date, 'now', () => now + 120_001);
  await assert.rejects(f.core.remove(req, 'owner-A'), rejection('EXPIRED'));
  assert.deepEqual(f.state.unlinks, []); assert.equal(f.state.opens, 0);
});

test('unknown token and missing explicit confirmation never open writer', async t => {
  const f = await fixture(t); const req = await f.request();
  await assert.rejects(f.core.remove({ ...req, token: 'a'.repeat(64) }, 'owner-A'), rejection('EXPIRED'));
  for (const fields of [{ confirmText: '' }, { confirmText: 'delete' }, { acknowledgeLimits: false }, { acknowledgeLimits: undefined }]) {
    await assert.rejects(f.core.remove({ ...req, ...fields }, 'owner-A'), rejection('CONFIRMATION_REQUIRED'));
  }
  assert.equal(f.state.opens, 0); assert.deepEqual(f.state.unlinks, []);
});

test('new preparation for same peer invalidates older token', async t => {
  const f = await fixture(t); const first = await f.request(); await f.request();
  await assert.rejects(f.core.remove(first, 'owner-A'), rejection('EXPIRED'));
});

test('changed log consumes token and refuses stale confirmation', async t => {
  const f = await fixture(t); const req = await f.request();
  await fs.appendFile(path.join(f.dir, CURRENT), 'changed\n');
  await assert.rejects(f.core.remove(req, 'owner-A'), rejection('CHANGED'));
  await assert.rejects(f.core.remove(req, 'owner-A'), rejection('EXPIRED'));
  assert.deepEqual(f.state.unlinks, []); assert.equal(f.state.opens, 0);
});

test('post-lock state change closes acquired handle without unlinking', async t => {
  const f = await fixture(t, { open({ state }) { state.live = true; } });
  await assert.rejects(f.core.remove(await f.request(), 'owner-A'), rejection('LIVE_SESSION'));
  assert.equal(f.state.closes, 1); assert.deepEqual(f.state.unlinks, []);
});

test('post-lock fingerprint change is rejected and handle closes', async t => {
  const f = await fixture(t, { async open({ dir }) { await fs.appendFile(path.join(dir, CURRENT), 'foreign append'); } });
  await assert.rejects(f.core.remove(await f.request(), 'owner-A'), rejection('CHANGED'));
  assert.equal(f.state.closes, 1); assert.deepEqual(f.state.unlinks, []);
});

test('writer lock acquisition failure changes no files and consumes token', async t => {
  const f = await fixture(t, { open() { throw Object.assign(new Error('writer held'), { code: 'SESSION_ALREADY_OWNED' }); } });
  const before = await directorySnapshot(f.dir); const req = await f.request();
  await assert.rejects(f.core.remove(req, 'owner-A'), rejection('SESSION_ALREADY_OWNED'));
  await assert.rejects(f.core.remove(req, 'owner-A'), rejection('EXPIRED'));
  assert.deepEqual(await directorySnapshot(f.dir), before); assert.equal(f.state.closes, 0);
});

test('concurrent deletion and lifecycle re-entry are refused while first operation holds lock', async t => {
  const entered = deferred(), release = deferred();
  const f = await fixture(t, { async unlink(target) { entered.resolve(); await release.promise; return fs.unlink(target); } });
  const firstReq = await f.request('owner-A'); const secondReq = await f.request('owner-B');
  const first = f.core.remove(firstReq, 'owner-A'); await entered.promise;
  try {
    await assert.rejects(f.core.remove(secondReq, 'owner-B'), rejection('DELETING'));
    assert.throws(() => f.core.guard(f.id), rejection('DELETING'));
    assert.equal(f.state.opens, 1); assert.equal(f.state.closes, 0);
  } finally { release.resolve(); }
  await first; assert.equal(f.state.closes, 1);
});

test('partial unlink failure retains authoritative current log and can retry with receipt', async t => {
  let failed = false;
  const f = await fixture(t, { async unlink(target) {
    if (!failed && path.basename(target) === 'session.v2.jsonl.zstd') { failed = true; throw Object.assign(new Error('injected unlink refusal'), { code: 'EACCES' }); }
    return fs.unlink(target);
  } });
  await assert.rejects(f.core.remove(await f.request(), 'owner-A'), error => {
    assert.equal(error.code, 'PARTIAL_DELETE'); assert.equal(error.details.removed, 1); assert.equal(error.details.cause, 'EACCES'); return true;
  });
  assert.ok(await exists(path.join(f.dir, CURRENT))); assert.ok(await exists(path.join(f.dir, 'session.lock')));
  assert.ok(await exists(path.join(f.dir, RECEIPT))); assert.equal(f.state.closes, 1);
  const result = await f.core.remove(await f.request(), 'owner-A'); assert.equal(result.deleted, true); assert.equal(result.fileCount, 3);
});

test('abort after first unlink finishes finite transaction instead of leaving half-deleted logs', async t => {
  const controller = new AbortController(); let count = 0;
  const f = await fixture(t, { async unlink(target) { await fs.unlink(target); if (++count === 1) controller.abort(new Error('browser closed')); } });
  const result = await f.core.remove(await f.request(), 'owner-A', controller.signal);
  assert.equal(result.deleted, true); assert.deepEqual(f.state.unlinks, GENERATIONS);
});

test('plugin close waits for pending unlink and acquired writer close', async t => {
  const entered = deferred(), allowUnlink = deferred(), closeEntered = deferred(), allowClose = deferred();
  const f = await fixture(t, {
    async unlink(target) { entered.resolve(); await allowUnlink.promise; return fs.unlink(target); },
    async close() { closeEntered.resolve(); await allowClose.promise; },
  });
  const operation = f.core.remove(await f.request(), 'owner-A'); await entered.promise;
  let closed = false; const closing = f.core.close().then(() => { closed = true; });
  await Promise.resolve(); assert.equal(closed, false);
  await assert.rejects(f.core.preview(f.id), rejection('CLOSED'));
  allowUnlink.resolve(); await closeEntered.promise; assert.equal(closed, false);
  allowClose.resolve(); await operation; await closing; assert.equal(closed, true);
});

test('close failure is surfaced as warning after verified log deletion', async t => {
  const f = await fixture(t, { close() { throw new Error('injected lease close failure'); } });
  const result = await f.core.remove(await f.request(), 'owner-A');
  assert.equal(result.deleted, true); assert.ok(result.warnings.includes('LOCK_RELEASE_FAILED'));
});

function registration(f) {
  const handlers = new Map(), events = new Map(), tools = [], effects = [], warnings = [];
  const ctx = {
    sessionPersistence: f.persistence, sessions: { get: () => f.state.live ? { header: f.state.header } : undefined, list: () => [] },
    agents: { get: () => undefined },
    workspaceRegistry: { get archivedSessionIds() { return f.state.archived ? [f.id] : []; }, list: () => [f.workspace] },
    logger: { warn: (...args) => warnings.push(args) },
    connection: { rpc: { handle(channel, fn) { handlers.set(channel, fn); } } },
    effect(fn) { effects.push(fn()); }, on(event, fn) { events.set(event, fn); },
    inject(names, fn) { assert.deepEqual(names, ['tools']); fn({ tools: { register(tool) { tools.push(tool); } } }); },
  };
  apply(ctx);
  return { handlers, events, tools, effects, warnings,
    rpc: handlers.get('/session-delete'),
    peer: { id: 'owner-A', principal: { kind: 'owner' }, signal: new AbortController().signal },
    signal: new AbortController().signal,
  };
}

test('agent registration exposes only read-only preview, never deletion or authorization token', async t => {
  const f = await fixture(t); const reg = registration(f); t.after(async () => { for (const stop of reg.effects) await stop(); });
  assert.deepEqual(reg.tools.map(tool => tool.name), ['session_delete_preview']);
  const before = await directorySnapshot(f.dir); const value = await reg.tools[0].execute({ sessionId: f.id });
  assert.equal(value.scope, 'local-session-logs-only'); assert.ok(!('token' in value));
  assert.deepEqual(await directorySnapshot(f.dir), before); assert.equal(f.state.opens, 0);
  assert.throws(() => reg.tools[0].execute({ sessionId: f.id, delete: true }), rejection('BAD_REQUEST'));
});

test('owner-only RPC rejects non-owner prepare and remove', async t => {
  const f = await fixture(t); const reg = registration(f); t.after(async () => { for (const stop of reg.effects) await stop(); });
  const foreign = { ...reg.peer, principal: { kind: 'guest' } };
  for (const endpoint of ['prepare', 'remove']) {
    const value = await reg.rpc(endpoint, { sessionId: f.id }, reg.signal, foreign);
    assert.equal(value.ok, false); assert.equal(value.error.code, 'FORBIDDEN');
  }
  assert.equal(f.state.opens, 0); assert.deepEqual(f.state.unlinks, []);
});

test('RPC validates shape, confirmation and unknown operation; owner can prepare but not delete without ack', async t => {
  const f = await fixture(t); const reg = registration(f); t.after(async () => { for (const stop of reg.effects) await stop(); });
  for (const [endpoint, payload] of [['prepare', { sessionId: f.id, root: '/' }], ['remove', { sessionId: f.id, token: '../' }], ['unknown', {}]]) {
    const result = await reg.rpc(endpoint, payload, reg.signal, reg.peer); assert.equal(result.ok, false); assert.equal(result.error.code, 'BAD_REQUEST');
  }
  const prepared = await reg.rpc('prepare', { sessionId: f.id }, reg.signal, reg.peer); assert.equal(prepared.ok, true);
  const removed = await reg.rpc('remove', { sessionId: f.id, token: prepared.value.token, confirmText: 'DELETE' }, reg.signal, reg.peer);
  assert.equal(removed.ok, false); assert.equal(removed.error.code, 'CONFIRMATION_REQUIRED'); assert.equal(f.state.opens, 0);
});
