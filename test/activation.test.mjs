import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import * as plugin from '../index.js';

const installation = process.env.DSH_INSTALL_DIR;
test('plugin registers real caller-scoped RPC through its declared webServer injection', { skip: !installation }, async t => {
  const require = createRequire(path.join(installation, 'package.json'));
  const load = name => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)).href);
  const { Context } = await load('cordis');
  const { HostConnectionService } = await load('dsh-client-connection');
  const ctx = new Context();
  t.after(async () => ctx.fiber.dispose());
  const routes = [];
  await ctx.plugin({ name: 'web-provider', apply(provider) {
    provider.provide('webServer', { register(route) { routes.push(route); return () => {}; } });
  } }).await();
  ctx.provide('sessionPersistence', {});
  ctx.provide('workspaceRegistry', { archivedSessionIds: [], list: () => [] });
  ctx.provide('sessions', { list: () => [], get: () => undefined });
  ctx.provide('agents', { get: () => undefined });
  await ctx.plugin({ name: 'connection-provider', apply(provider) {
    new HostConnectionService(provider, [], {});
  } }).await();
  await ctx.plugin(plugin).await();
  assert.equal(routes[0].path, '/session-delete');
});
