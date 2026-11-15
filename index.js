import { DeleteError, SessionDeletion, validateId } from './deletion.js';

export const inject = ['connection', 'sessionPersistence', 'sessions', 'agents', 'workspaceRegistry'];
export const name = 'session-delete';
const CHANNEL = '/session-delete';
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !keys.includes(key))) throw new DeleteError('BAD_REQUEST', 'Invalid request. / 无效请求。');
  return value;
}
function failure(error) {
  return { ok: false, error: { code: error instanceof DeleteError ? error.code : 'DELETE_FAILED',
    message: error instanceof DeleteError ? error.message : 'Operation failed; no success was confirmed. Close other DSH processes and retry. / 操作失败，未确认成功；请关闭其他 DSH 进程后重试。',
    details: error instanceof DeleteError ? error.details : {} } };
}

/** Browser-only destructive confirmation; the model gets read-only preview, never the token. */
export function apply(ctx) {
  const core = new SessionDeletion({
    persistence: ctx.sessionPersistence,
    isArchived: id => ctx.workspaceRegistry.archivedSessionIds.includes(id),
    isLive: id => Boolean(ctx.agents.get(id) || ctx.sessions.get(id)),
    liveHeaders: () => ctx.sessions.list().map(s => s.header),
    workspaces: () => ctx.workspaceRegistry.list(),
    warn: message => ctx.logger.warn(message),
  });
  ctx.effect(() => () => core.close());
  ctx.on('session/created', session => {
    core.guard(session.id);
    if (session.header?.parentSession) core.guard(session.header.parentSession);
  });
  ctx.on('workspace/session-unarchiving', ({ sessionId }) => core.guard(sessionId));
  ctx.connection.rpc.handle(CHANNEL, async (endpoint, payload, signal, peer) => {
    try {
      if (peer.principal.kind !== 'owner') throw new DeleteError('FORBIDDEN', 'Only the owner may delete logs. / 仅所有者可以删除日志。');
      const combined = AbortSignal.any([signal, peer.signal]);
      combined.throwIfAborted();
      if (endpoint === 'prepare') {
        object(payload, ['sessionId']);
        return { ok: true, value: await core.prepare(validateId(payload.sessionId), peer.id, combined) };
      }
      if (endpoint === 'remove') {
        object(payload, ['sessionId', 'token', 'confirmText', 'acknowledgeLimits']);
        if (typeof payload.token !== 'string' || !/^[a-f0-9]{64}$/.test(payload.token)) throw new DeleteError('BAD_REQUEST', 'Invalid confirmation. / 无效的确认。');
        return { ok: true, value: await core.remove(payload, peer.id, combined) };
      }
      throw new DeleteError('BAD_REQUEST', 'Unknown operation. / 未知操作。');
    } catch (error) {
      // Log only a stable code, never the conversation, confirmation token or filesystem path.
      ctx.logger.warn('Session-log deletion: %s', error.code || error.name || 'error');
      return failure(error);
    }
  });
  ctx.inject(['tools'], child => {
    child.tools.register({
      name: 'session_delete_preview',
      description: 'Read-only: check whether an archived, unloaded session log can be permanently deleted and estimate its log bytes. Does not delete, archive, close sessions, authorize deletion, or return a confirmation token. Actual deletion requires the human warning dialog in the session menu. Shared attachments, caches, other copies and cloud memory are not erased.',
      parameters: { type: 'object', properties: { sessionId: { type: 'string', description: 'Exact session ID to inspect.' } }, required: ['sessionId'], additionalProperties: false },
      output: { schema: { type: 'object', properties: { sessionId: { type: 'string' }, bytes: { type: 'number' }, fileCount: { type: 'number' }, scope: { type: 'string' } } },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }] },
      execute: args => core.preview(validateId(object(args, ['sessionId']).sessionId)),
    });
  });
}
