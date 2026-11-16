import { createHash, randomBytes } from 'node:crypto';
import { lstat, open, readFile, readdir, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';

export const RECEIPT = '.dsh-session-delete.json';
const FORMAT = 4;
const LOG = /^session(?:\.v([1-9][0-9]*))?\.jsonl(\.zstd)?$/;
const TTL = 120_000;

export class DeleteError extends Error {
  constructor(code, message, details = {}) { super(message); this.code = code; this.details = details; }
}
function deny(code, message, details) { throw new DeleteError(code, message, details); }
export function validateId(id) {
  if (typeof id !== 'string' || id.length < 1 || id.length > 256 || /[\u0000-\u001f\u007f]/.test(id)) {
    deny('BAD_REQUEST', 'Invalid session ID. / 无效的会话 ID。');
  }
  return id;
}
// DSH's UTF-16 path encoding, deliberately not encodeURIComponent.
export function encodeId(raw) {
  if (raw === '.') return '~002E';
  if (raw === '..') return '~002E~002E';
  let result = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    result += /^[A-Za-z0-9._-]$/.test(c) ? c : `~${raw.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')}`;
  }
  return result;
}
function projectKey(cwd) {
  if (cwd === undefined) return '_no-cwd';
  if (typeof cwd !== 'string' || !path.isAbsolute(cwd)) deny('UNSUPPORTED', 'Unsupported working directory. / 不支持此工作目录。');
  let readable = '', separator = false;
  for (let i = 0; i < cwd.length; i++) {
    const c = cwd[i];
    if ('/\\:'.includes(c)) { if (!separator) readable += '-'; separator = true; }
    else { readable += /^[A-Za-z0-9._-]$/.test(c) ? c : `~${cwd.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')}`; separator = false; }
  }
  return `--${(readable.replace(/^-+/, '') || 'root').slice(0, 251)}--`;
}
function identity(st) { return [st.dev, st.ino, st.size, st.mtimeNs, st.ctimeNs].map(String).join(':'); }
async function regular(file) {
  const st = await lstat(file, { bigint: true });
  if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1n) deny('UNSAFE_PATH', 'Refusing a non-regular or hard-linked file. / 拒绝删除非普通文件或硬链接。');
  return st;
}
async function syncDir(dir) {
  // Windows does not support opening directories via fs.open for fsync.
  if (process.platform === 'win32') return;
  const fd = await open(dir, 'r');
  try { await fd.sync(); } finally { await fd.close(); }
}

/** JSONL-only maintenance operation. No recursive removal and no private DSH fields. */
export class SessionDeletion {
  constructor(deps, io = {}) {
    this.deps = deps;
    this.io = { unlink, ...io };
    this.tokens = new Map();
    this.deleting = new Set();
    this.deleted = new Set();
    this.pending = new Set();
    this.closed = false;
  }
  guard(id) {
    if (this.closed) deny('CLOSED', 'Plugin is unloading. / 插件正在卸载。');
    if (this.deleting.has(id) || this.deleted.has(id)) deny('DELETING', 'This session is being deleted or was deleted. / 此会话正在删除或已删除。');
  }
  async conditions(id, signal) {
    signal?.throwIfAborted();
    if (this.deps.isLive(id)) deny('LIVE_SESSION', 'Session is loaded; this DSH version has no public safe unload API. Switch to another session, restart DSH, and delete from the menu without reopening this session. / 会话仍在内存中；当前 DSH 无公开安全卸载接口。请切换到其他会话并重启 DSH，再从菜单删除，不要重新打开目标会话；无需手动归档。');
    const snapshots = await this.deps.persistence.list({ signal });
    if (snapshots.some(s => s.header.parentSession === id) || this.deps.liveHeaders().some(h => h.parentSession === id)) {
      deny('HAS_CHILDREN', 'This session has child sessions or forks. Delete the children first; deletion is not recursive. / 此会话有子会话或分支，请先处理它们；不会级联删除。');
    }
    const snapshot = await this.deps.persistence.stat(id, { signal });
    if (!snapshot) deny('NOT_FOUND', 'Session log was not found. / 找不到会话日志。');
    if (snapshot.header.id !== id || snapshot.header.version !== FORMAT || snapshot.formatStatus !== 'current'
      || snapshot.location?.kind !== 'jsonl' || !path.isAbsolute(snapshot.location.path)) {
      deny('UNSUPPORTED', 'Only current V4 JSONL logs are supported; no migration is performed. / 仅支持当前 V4 JSONL 日志，不会为删除而自动迁移。');
    }
    if (snapshot.header.origin === 'subagent') deny('UNSUPPORTED', 'Subagent logs are not supported in this release. / 当前版本不支持删除子智能体日志。');
    signal?.throwIfAborted();
    return snapshot;
  }
  async inspect(id, signal) {
    validateId(id);
    const snapshot = await this.conditions(id, signal);
    const selected = path.resolve(snapshot.location.path);
    const dir = path.dirname(selected), project = path.dirname(dir), root = path.dirname(project);
    if (path.basename(dir) !== encodeId(id) || path.basename(project) !== projectKey(snapshot.header.cwd)
      || root === path.parse(root).root) deny('UNSAFE_PATH', 'Unexpected JSONL directory layout. / 日志目录布局不符合预期。');
    // Reject symlinks and junctions at or above the selected directory.
    for (const folder of [root, project, dir]) {
      const st = await lstat(folder, { bigint: true });
      if (!st.isDirectory() || st.isSymbolicLink() || await realpath(folder) !== folder) {
        deny('UNSAFE_PATH', 'Symbolic-link paths are not supported. / 为安全起见不支持符号链接路径。');
      }
    }
    const dirStat = await lstat(dir, { bigint: true });
    const names = await readdir(dir);
    if (names.length > 32) deny('UNSUPPORTED', 'Too many files in the session directory. / 会话目录文件过多。');
    const selectedMatch = LOG.exec(path.basename(selected));
    if (!selectedMatch || Number(selectedMatch[1] || 0) !== FORMAT) deny('UNSUPPORTED', 'Unexpected current log filename. / 当前日志文件名不符合预期。');
    const compressed = Boolean(selectedMatch[2]);
    const files = [];
    for (const name of names.sort()) {
      const full = path.join(dir, name);
      const st = await regular(full);
      if (name === 'session.lock') continue; // Never unlink the lock inode.
      if (name === RECEIPT) {
        if (st.size > 64_000n) deny('UNSAFE_PATH', 'Invalid deletion receipt. / 删除凭据异常。');
        const receipt = JSON.parse(await readFile(full, 'utf8'));
        if (receipt.version !== 1 || receipt.sessionId !== id || receipt.createdAt !== snapshot.header.createdAt) {
          deny('UNSAFE_PATH', 'Deletion receipt does not match this session. / 删除凭据与会话不匹配。');
        }
        continue;
      }
      const match = LOG.exec(name);
      if (!match || Number(match[1] || 0) > FORMAT || Boolean(match[2]) !== compressed) {
        deny('UNSUPPORTED', 'Unknown files or mixed encodings found; nothing was deleted. / 发现未知文件或混合编码，未执行删除。');
      }
      files.push({ name, version: Number(match[1] || 0), bytes: Number(st.size), identity: identity(st) });
    }
    if (!files.some(f => path.join(dir, f.name) === selected)) deny('CHANGED', 'Log changed. Reopen the confirmation. / 日志已变化，请重新打开确认框。');
    files.sort((a, b) => a.version - b.version);
    const dirIdentity = `${dirStat.dev}:${dirStat.ino}`;
    const fingerprint = createHash('sha256').update(JSON.stringify({ id, createdAt: snapshot.header.createdAt,
      revision: snapshot.revision, selected, dirIdentity, files })).digest('hex');
    return { snapshot, dir, dirIdentity, files, fingerprint, bytes: files.reduce((n, f) => n + f.bytes, 0) };
  }
  async preview(id, signal) {
    this.guard(validateId(id));
    const plan = await this.inspect(id, signal);
    return { sessionId: id, bytes: plan.bytes, fileCount: plan.files.length, scope: 'local-session-logs-only' };
  }
  async prepare(id, peerId, signal) {
    this.guard(validateId(id));
    const plan = await this.inspect(id, signal);
    for (const [key, entry] of this.tokens) if (entry.expiresAt <= Date.now() || entry.peerId === peerId) this.tokens.delete(key);
    if (this.tokens.size >= 100) deny('BUSY', 'Too many pending confirmations. / 待确认请求过多。');
    const token = randomBytes(32).toString('hex'), expiresAt = Date.now() + TTL;
    this.tokens.set(token, { id, peerId, expiresAt, fingerprint: plan.fingerprint });
    return { sessionId: id, title: id, bytes: plan.bytes, fileCount: plan.files.length, token, expiresAt };
  }
  remove(request, peerId, signal) {
    const operation = this.removeInner(request, peerId, signal);
    this.pending.add(operation);
    operation.then(() => this.pending.delete(operation), () => this.pending.delete(operation));
    return operation;
  }
  async removeInner(request, peerId, signal) {
    const id = validateId(request.sessionId);
    this.guard(id);
    const approval = this.tokens.get(request.token);
    if (!approval || approval.id !== id || approval.peerId !== peerId || approval.expiresAt <= Date.now()) {
      deny('EXPIRED', 'Confirmation expired. Reopen the warning dialog. / 确认已失效，请重新打开警告框。');
    }
    if (request.confirmDeletion !== true || request.acknowledgeLimits !== true) deny('CONFIRMATION_REQUIRED', 'Explicit confirmation is required. / 必须明确确认删除。');
    this.tokens.delete(request.token); // Single use, including failed attempts.
    this.deleting.add(id);
    let handle, removed = 0, bytes = 0, completed = false;
    const warnings = [];
    try {
      let plan = await this.inspect(id, signal);
      if (plan.fingerprint !== approval.fingerprint) deny('CHANGED', 'Log changed since preview. / 预览后日志发生变化，请重新确认。');
      // Lifecycle changes begin only after human confirmation and fingerprint validation.
      // Archive without stopActivity: public admission rejects running jobs/turns;
      // never force-cancel work or tear down somebody else's owned Agent handle.
      if (!this.deps.isArchived(id)) {
        if (typeof this.deps.archive !== 'function') deny('UNSUPPORTED', 'Automatic archive is unavailable. / 当前宿主不支持自动归档。');
        try { await this.deps.archive(id); }
        catch { deny('ARCHIVE_FAILED', 'Automatic archive was refused or failed. Running work is never force-stopped; inspect the session before retrying. / 自动归档被拒绝或失败。不会强制停止运行中的任务；请检查目标会话后再试。'); }
      }
      if (!this.deps.isArchived(id)) deny('CHANGED', 'Archive admission did not complete. / 自动归档未完成。');
      plan = await this.inspect(id, signal);
      if (plan.fingerprint !== approval.fingerprint) deny('CHANGED', 'Session changed during archive. / 自动归档期间会话发生变化，请重新确认。');
      // Current-format write-open acquires DSH's normal in-process claim and cross-process lock.
      handle = await this.deps.persistence.open(id, 'write', { signal });
      plan = await this.inspect(id, signal);
      if (plan.fingerprint !== approval.fingerprint || handle.header.id !== id || handle.header.createdAt !== plan.snapshot.header.createdAt) {
        deny('CHANGED', 'Session changed while acquiring its lock. / 获取锁期间会话发生变化。');
      }
      // The only persistent extra data is this small receipt, not a copy of the log.
      const receiptPath = path.join(plan.dir, RECEIPT);
      try {
        const receipt = await open(receiptPath, 'wx', 0o600);
        try { await receipt.writeFile(JSON.stringify({ version: 1, sessionId: id, createdAt: plan.snapshot.header.createdAt,
          requestedAt: Date.now(), files: plan.files.map(f => f.name) })); await receipt.sync(); }
        finally { await receipt.close(); }
        await syncDir(plan.dir);
      } catch (error) { if (error.code !== 'EEXIST') throw error; }
      signal?.throwIfAborted();
      // From the first unlink onward, finish the finite transaction even if the browser disconnects.
      // Oldest first: on partial failure the authoritative newest generation stays in place.
      for (const file of plan.files) {
        if (!this.deps.isArchived(id) || this.deps.isLive(id)) deny('CHANGED', 'Session became active. / 会话状态已改变。');
        const dst = await lstat(plan.dir, { bigint: true });
        if (`${dst.dev}:${dst.ino}` !== plan.dirIdentity || await realpath(plan.dir) !== plan.dir) deny('UNSAFE_PATH', 'Directory changed. / 会话目录已改变。');
        const target = path.join(plan.dir, file.name);
        if (identity(await regular(target)) !== file.identity) deny('CHANGED', 'Log file changed. / 日志文件已改变。');
        await this.io.unlink(target);
        removed++; bytes += file.bytes;
      }
      await syncDir(plan.dir);
      if (await this.deps.persistence.stat(id)) deny('VERIFY_FAILED', 'Log deletion could not be verified. / 无法确认日志已删除。');
      this.deleted.add(id);
      completed = true;
    } catch (error) {
      if (removed > 0) throw new DeleteError('PARTIAL_DELETE', 'Deletion was interrupted; some logs were removed. Reopen the dialog to inspect/retry. No rollback is possible. / 删除中断，部分日志已删除；请重新检查后重试，无法回滚。', { removed, bytes, cause: error.code || 'IO_ERROR' });
      throw error;
    } finally {
      if (handle) {
        try { await handle.close(); } catch {
          if (completed) warnings.push('LOCK_RELEASE_FAILED');
          else this.deps.warn?.('Deletion handle close failed; restart DSH before retrying.');
        }
      }
      this.deleting.delete(id);
    }
    // Do not edit another owner's storage files. Public workspace entity API only.
    for (const workspace of this.deps.workspaces()) {
      try { if (workspace.sessionIds.includes(id)) await workspace.detachSession(id); }
      catch { warnings.push('WORKSPACE_REFRESH_PENDING'); }
    }
    return { sessionId: id, deleted: true, bytes, fileCount: removed, warnings,
      scope: 'local-session-logs-only' };
  }
  async close() {
    this.closed = true;
    this.tokens.clear();
    await Promise.allSettled([...this.pending]);
  }
}
