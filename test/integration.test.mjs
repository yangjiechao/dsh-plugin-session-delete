import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdtemp, realpath, rm, readdir, unlink, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SessionDeletion } from '../deletion.js';

// Optional, real-runtime tests. No hard-coded checkout and no installed profile data.
// Run with DSH_INSTALL_DIR pointing at the verified installed CLI package.
const installation = process.env.DSH_INSTALL_DIR;
for (const compression of ['none', 'zstd']) {
  test(`actual DSH JSONL ${compression}: exclusive write lock, delete, close, no resurrection`, { skip: !installation }, async t => {
    const require = createRequire(path.join(installation, 'package.json'));
    const { Context } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')).href);
    const { default: SessionStore } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-session')).href);
    const Jsonl = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-session-persistence-jsonl')).href);
    const base = await realpath(tmpdir());
    const temporary = await mkdtemp(path.join(base, 'dsh-delete-integration-'));
    const root = path.join(temporary, 'sessions');
    const a = new Context(), b = new Context();
    const mount = async ctx => {
      await ctx.plugin(SessionStore).await();
      await ctx.plugin(Jsonl, { root, compression, listConcurrency: 3 }).await();
      return ctx.sessionPersistence;
    };
    t.after(async () => {
      await a.fiber.dispose(); await b.fiber.dispose();
      assert.equal(path.dirname(temporary), base);
      assert.ok(path.basename(temporary).startsWith('dsh-delete-integration-'));
      assert.equal(await realpath(temporary), temporary);
      await rm(temporary, { recursive: true, force: true });
    });
    const first = await mount(a), second = await mount(b);
    const id = 'integration-delete-ONLY';
    const header = { id, version: 4, createdAt: Date.now(), cwd: temporary, isSeeded: false };
    const writer = await first.create(header);
    await writer.flush(); await writer.close();
    const initial = await first.stat(id);
    assert.equal(initial.formatStatus, 'current');
    const dir = path.dirname(initial.location.path);
    const core = new SessionDeletion({ persistence: first, isArchived: () => true, isLive: () => false,
      liveHeaders: () => [], workspaces: () => [] }, { async unlink(file) {
      assert.equal(path.dirname(file), dir);
      // A different real backend instance must be locked out during unlink.
      await assert.rejects(second.open(id, 'write'), error => error.code === 'SESSION_ALREADY_OWNED' || error.name === 'SessionAlreadyOwnedError');
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import { createRequire } from 'node:module';
        import { pathToFileURL } from 'node:url';
        const require = createRequire(${JSON.stringify(path.join(installation, 'package.json'))});
        const { Context } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')).href);
        const { default: Store } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-session')).href);
        const Jsonl = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-session-persistence-jsonl')).href);
        const ctx = new Context();
        try {
          await ctx.plugin(Store).await();
          await ctx.plugin(Jsonl, ${JSON.stringify({ root, compression, listConcurrency: 3 })}).await();
          let rejected = false;
          try { const handle = await ctx.sessionPersistence.open(${JSON.stringify(id)}, 'write'); await handle.close(); }
          catch (error) { rejected = error.name === 'SessionAlreadyOwnedError'; }
          if (!rejected) throw new Error('Cross-process writer was not excluded');
        } finally { await ctx.fiber.dispose(); }
      `], { encoding: 'utf8', timeout: 10_000 });
      assert.equal(child.error, undefined);
      assert.equal(child.status, 0, child.stderr);
      await unlink(file);
    } });
    t.after(() => core.close());
    const before = await core.prepare(id, 'owner-test');
    const output = await core.remove({ sessionId: id, token: before.token, confirmText: 'DELETE', acknowledgeLimits: true }, 'owner-test');
    assert.equal(output.deleted, true);
    assert.equal(output.fileCount, 1);
    assert.deepEqual(output.warnings, []);
    assert.equal(await first.stat(id), undefined);
    assert.equal(await second.stat(id), undefined);
    await assert.rejects(second.open(id, 'write'));
    await assert.rejects(first.open(id, 'read'));
    assert.deepEqual((await readdir(dir)).sort(), process.platform === 'win32'
      ? ['.dsh-session-delete.json'] : ['.dsh-session-delete.json', 'session.lock']);
    if (process.platform !== 'win32') assert.equal((await lstat(path.join(dir, 'session.lock'))).isFile(), true);
  });
}
