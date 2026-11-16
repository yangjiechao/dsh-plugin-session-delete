/* Browser half: deletion and path authority stay in the authenticated Host. */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-session-delete',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'sessionDelete';
    const CHANNEL = '/session-delete';
    const dictionaries = {
      zh: {
        entry: '永久删除日志…', title: '永久删除会话日志？', cancel: '取消', close: '关闭',
        introduction: '此操作不可恢复。只删除此会话的本地全部版本聊天日志。',
        scopeTitle: '不会删除以下内容',
        limits: '共享附件、搜索与投影缓存、备份及其他会话中的副本均不会删除。这不是安全擦除。',
        prerequisite: '无需手动归档。仅支持未加载的会话；确认删除后自动归档并获取写锁。当前或已加载会话请先切换到其他会话并重启 DSH，且不要重新打开目标。运行中的任务不会被强制停止。若后续删除失败，目标可能保持已归档状态。',
        acknowledge: '我已了解删除范围，同意确认后自动归档，并确认其他 DSH 进程已关闭',
        preparing: '正在检查日志与删除条件…', deleting: '正在删除，请勿关闭 DSH…',
        delete: '永久删除日志', retry: '重新检查', files: '文件数', size: '日志大小',
        sessionId: '会话 ID', emptyTitle: '未命名会话', errorHeading: '尚未确认日志删除完成',
        unknown: '尚未确认操作结果，请先重新检查，不要直接重复删除；如问题持续，请查看宿主日志。',
        transport: '与 DSH 宿主的连接失败。删除结果可能尚未确认，请重新检查，不要直接重复操作。',
        protocol: '宿主返回了无法验证的删除预览。本次未提交删除请求，请检查插件与 DSH 版本。',
        protocolRemove: '删除请求已提交，但宿主返回的结果无法验证。日志可能已部分或全部删除；请重新检查，不要直接重复删除。',
        partial: '删除未完整完成，部分日志已删除且无法回滚。请重新检查剩余日志；重新检查不会自动继续删除。',
        partialFiles: '宿主报告已删除的日志文件：{count} 个。', partialBytes: '宿主报告已删除的日志大小：{size}。',
        retryGuidance: '“重新检查”只检查当前日志与删除条件，不会重新提交删除。若仍有可删除日志，必须再次勾选并点击“永久删除日志”后才能删除。',
        longWait: '宿主仍在处理，或删除结果尚未返回。不要再次删除，也不要退出 DSH。可以只关闭此窗口，稍后重新检查；关闭不会发送取消请求，也不代表删除成功或失败。',
        closeWaiting: '仅关闭窗口，稍后检查',
        closeWaitingHint: '只关闭此警告框，不取消已提交的宿主操作；最终结果仍需检查。',
        notArchived: '自动归档门禁未完成，请重新检查。',
        archiveFailed: '自动归档被拒绝或失败。请先让目标任务自然结束，再重新检查；插件不会强制停止任务。若删除未继续，目标也可能已归档。',
        liveSession: '此会话仍被 DSH 加载在内存中，宿主可能继续向日志写入内容。切换会话或归档不会释放它；为避免删除时发生并发写入或日志被重新生成，本次未执行删除。请先保存工作并等待任务结束，切换到其他会话后重启 DSH 服务（仅刷新网页无效），再直接从列表菜单删除，不要打开目标正文；无需手动归档。',
        hasChildren: '此会话存在子会话或分支引用，暂不能删除。请先处理这些引用。',
        unsupported: '当前存储后端、日志版本或布局不受支持；未执行删除。',
        changed: '日志或会话状态已变化。请重新检查，并再次确认删除范围。',
        expired: '删除检查已过期。请重新检查，然后再次勾选并点击“永久删除日志”。',
        forbidden: '当前连接没有删除权限；仅 DSH 设备所有者可以执行此操作。',
        notFound: '找不到目标会话日志。它可能已被删除，请手动刷新列表确认。',
        cancelled: '请求已取消。请重新检查后再操作。',
        successTitle: '本地会话日志已删除', success: '已删除 {count} 个日志文件，共 {size}。',
        remaining: '共享附件、搜索与投影缓存、备份及其他会话副本仍可能保留内容。',
        refresh: '刷新列表（重载页面）', refreshNotice: '不会自动刷新页面，以免丢失其他会话中的未发送输入。列表未更新时，可手动刷新；必要时重启 DSH。',
        refreshPrompt: '刷新将重新加载整个页面，其他未发送的输入可能丢失。确定现在刷新？',
        warnings: '删除后的处理提示', busyClose: '删除进行中，请等待明确结果后再关闭。',
        lockWarning: '日志已删除，但释放写入锁时出现问题。请重启 DSH 后再操作其他会话。',
        refreshWarning: '日志已删除，但会话列表尚未更新。请手动刷新；若仍显示旧记录，请重启 DSH。',
      },
      en: {
        entry: 'Permanently delete logs…', title: 'Permanently delete session logs?', cancel: 'Cancel', close: 'Close',
        introduction: 'This cannot be undone. Only all local versions of this session’s chat logs will be deleted.',
        scopeTitle: 'These items will not be deleted',
        limits: 'Shared attachments, search and projection caches, backups, copies in other sessions will remain. This is not a secure erase.',
        prerequisite: 'No manual archive is needed. Only unloaded sessions are supported. Confirmation automatically archives the target and acquires its write lock. For current or loaded sessions, switch away and restart DSH without reopening the target. Running work is never force-stopped. If a later deletion step fails, the target may remain archived.',
        acknowledge: 'I understand the scope, consent to automatic archival after confirmation, and confirm that all other DSH processes are closed',
        preparing: 'Checking logs and deletion requirements…', deleting: 'Deleting; do not close DSH…',
        delete: 'Permanently delete logs', retry: 'Check again', files: 'Files', size: 'Log size',
        sessionId: 'Session ID', emptyTitle: 'Untitled session', errorHeading: 'Log deletion is not confirmed',
        unknown: 'The outcome is not confirmed. Check the current state before attempting any further deletion, or consult the Host log if this continues.',
        transport: 'The DSH Host connection failed. The deletion outcome may be unconfirmed. Check again rather than immediately repeating the operation.',
        protocol: 'The Host returned a deletion preview that could not be verified. No deletion request was submitted by this attempt. Check the plugin and DSH versions.',
        protocolRemove: 'A deletion request was submitted, but its result could not be verified. Some or all logs may already be deleted. Check the current state rather than immediately repeating deletion.',
        partial: 'Deletion did not fully complete. Some logs were deleted and cannot be restored. Check the remaining logs; checking again does not automatically resume deletion.',
        partialFiles: 'Host-reported deleted log files: {count}.', partialBytes: 'Host-reported deleted log size: {size}.',
        retryGuidance: '“Check again” only inspects the current logs and deletion requirements; it does not resubmit deletion. Any remaining eligible logs require a fresh acknowledgment and explicit click on Permanently delete logs before deletion.',
        longWait: 'The Host is still processing, or its result has not arrived. Do not submit deletion again or quit DSH. You may close only this dialog and check later. Closing sends no cancellation request and does not establish success or failure.',
        closeWaiting: 'Close dialog; check later',
        closeWaitingHint: 'Closes only this warning dialog, without cancelling the submitted Host operation. Its final outcome still needs checking.',
        notArchived: 'Automatic archive admission did not complete. Check again.',
        archiveFailed: 'Automatic archive was refused or failed. Let target work finish before checking again; this plugin never force-stops it. The target may already be archived even if deletion did not continue.',
        liveSession: 'DSH still holds this session in memory and may continue writing its logs. Switching sessions or archiving does not release it. No deletion was performed, preventing concurrent writes or logs being recreated. Save your work and let tasks finish, switch to another session, then restart the DSH service (refreshing the page is not enough). Delete from the list menu without reopening the target; no manual archive is needed.',
        hasChildren: 'This session has child-session or fork references and cannot be deleted yet. Resolve those references first.',
        unsupported: 'This storage backend, log version, or layout is unsupported. No deletion was performed.',
        changed: 'The logs or session state changed. Check again and confirm the scope once more.',
        expired: 'The deletion check expired. Check again, then reselect the acknowledgment and click Permanently delete logs.',
        forbidden: 'This connection cannot delete logs. Only the DSH device owner can perform this operation.',
        notFound: 'The target session logs were not found. They may already be deleted; refresh the list manually to check.',
        cancelled: 'The request was cancelled. Check again before retrying.',
        successTitle: 'Local session logs deleted', success: 'Deleted {count} log files ({size}).',
        remaining: 'Shared attachments, search and projection caches, backups, other-session copies may still retain content.',
        refresh: 'Refresh list (reload page)', refreshNotice: 'The page will not refresh automatically, preserving unsent input in other sessions. Refresh manually if the list is stale; restart DSH if needed.',
        refreshPrompt: 'Refreshing reloads the entire page and may discard other unsent input. Refresh now?',
        warnings: 'Post-deletion notices', busyClose: 'Deletion is in progress. Wait for a definite result before closing.',
        lockWarning: 'The logs were deleted, but releasing the writer lock failed. Restart DSH before performing further session operations.',
        refreshWarning: 'The logs were deleted, but the session list is not yet updated. Refresh manually, or restart DSH if stale entries remain.',
      },
    };
    const css = `
.sd-delete-menu{box-sizing:border-box;display:flex;align-items:center;width:100%;min-height:32px;padding:6px 12px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-state-error-primary);font:inherit;font-size:13px;text-align:start;cursor:pointer}
.sd-delete-menu:hover,.sd-delete-menu:focus-visible{background:var(--dsw-alias-bg-layer-1)}
.sd-delete-menu:focus-visible,.sd-delete-dialog button:focus-visible,.sd-delete-dialog input:focus-visible{outline:2px solid var(--dsw-alias-state-warn-primary);outline-offset:3px}
.sd-delete-layer{box-sizing:border-box;position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:max(24px,var(--dsh-frame-overlay-top,24px)) 24px;pointer-events:auto;background:color-mix(in srgb, var(--dsw-alias-bg-base) 78%, transparent)}
.sd-delete-dialog{box-sizing:border-box;width:min(580px,100%);max-height:100%;overflow:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);box-shadow:0 20px 70px color-mix(in srgb, var(--dsw-alias-bg-base) 78%, transparent);padding:24px;font-size:14px;line-height:1.6}
.sd-delete-dialog:focus{outline:none}.sd-delete-dialog h2{margin:0 0 12px;font-size:18px;line-height:1.4;font-weight:600}.sd-delete-dialog p{margin:10px 0}.sd-delete-dialog h3{font-size:13px;margin:0 0 4px}.sd-delete-target{margin:12px 0;font-weight:500;overflow-wrap:anywhere}.sd-delete-id{font-size:12px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.sd-delete-limits,.sd-delete-error{padding:12px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;margin:14px 0}.sd-delete-error{border-color:var(--dsw-alias-state-error-primary)}.sd-delete-error h3{color:var(--dsw-alias-state-error-primary)}.sd-delete-muted{color:var(--dsw-alias-label-secondary);font-size:13px}.sd-delete-stats{display:flex;gap:24px;flex-wrap:wrap;padding:10px 0}.sd-delete-stats div{display:flex;gap:8px}.sd-delete-stats dt{color:var(--dsw-alias-label-secondary)}.sd-delete-stats dd{margin:0;font-weight:500}.sd-delete-check{display:flex;gap:10px;align-items:flex-start;margin:18px 0 14px;cursor:pointer}.sd-delete-check input{flex:none;margin-top:5px;accent-color:var(--dsw-alias-state-error-primary)}.sd-delete-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:22px}.sd-delete-actions button{font:inherit;font-size:13px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:7px 13px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer}.sd-delete-actions button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-1)}.sd-delete-actions button.sd-delete-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}.sd-delete-actions button:disabled{opacity:.45;cursor:not-allowed}.sd-delete-warnings{padding-inline-start:20px;overflow-wrap:anywhere}.sd-delete-busy{font-size:13px;color:var(--dsw-alias-label-secondary)}
@media(max-width:520px){.sd-delete-layer{padding:12px}.sd-delete-dialog{padding:18px}.sd-delete-actions button{flex:1}}
`;

    function createController(ctx) {
      let state = null;
      let generation = 0;
      let request = null;
      let openingTimer = null;
      let disposed = false;
      const listeners = new Set();
      const publish = next => {
        if (disposed) return;
        state = next;
        for (const listener of [...listeners]) listener();
      };
      const patch = changes => { if (state) publish({ ...state, ...changes }); };
      const rpc = async (endpoint, payload, signal) => {
        let result;
        try { result = await ctx.connection.rpc.call(CHANNEL, endpoint, payload, signal); }
        catch (cause) { throw Object.assign(new Error('Connection failed'), { code: 'TRANSPORT', cause }); }
        if (!result || typeof result.ok !== 'boolean') throw Object.assign(new Error('Invalid response'), { code: 'PROTOCOL' });
        if (!result.ok) throw Object.assign(new Error(result.error?.message || ''), {
          code: result.error?.code || 'UNKNOWN', details: result.error?.details,
        });
        return result.value;
      };
      const validCount = value => Number.isSafeInteger(value) && value >= 0;
      const report = (error, operation = 'prepare') => {
        const details = {};
        if (validCount(error?.details?.removed)) details.removed = error.details.removed;
        if (validCount(error?.details?.bytes)) details.bytes = error.details.bytes;
        patch({ phase: 'error', plan: null, acknowledged: false, error: {
          code: typeof error?.code === 'string' ? error.code : 'UNKNOWN',
          message: typeof error?.message === 'string' ? error.message : '',
          operation, details,
        } });
      };
      const controller = {
        getSnapshot: () => state,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        open(sessionId, displayTitle) {
          if (disposed || state || openingTimer !== null) return;
          // Next task lets the shared menu restore its trigger before capture.
          openingTimer = window.setTimeout(() => {
            openingTimer = null;
            if (disposed || state) return;
            publish({ sessionId, displayTitle, phase: 'preparing', plan: null, error: null,
              result: null, acknowledged: false, returnFocus: document.activeElement });
            void controller.prepare();
          }, 0);
        },
        async prepare() {
          if (!state || state.phase === 'deleting' || state.phase === 'success') return;
          request?.abort();
          request = new AbortController();
          const currentRequest = request;
          const currentGeneration = ++generation;
          const sessionId = state.sessionId;
          patch({ phase: 'preparing', plan: null, error: null, acknowledged: false });
          try {
            const plan = await rpc('prepare', { sessionId }, currentRequest.signal);
            if (disposed || currentRequest.signal.aborted || currentGeneration !== generation || !state) return;
            if (!plan || plan.sessionId !== sessionId || typeof plan.token !== 'string' || !plan.token ||
              !validCount(plan.bytes) || !validCount(plan.fileCount) || !Number.isFinite(plan.expiresAt)) {
              throw Object.assign(new Error('Invalid deletion plan'), { code: 'PROTOCOL' });
            }
            if (plan.expiresAt <= Date.now()) throw Object.assign(new Error('Expired plan'), { code: 'EXPIRED' });
            patch({ phase: 'ready', plan: { sessionId, title: typeof plan.title === 'string' ? plan.title : '',
              bytes: plan.bytes, fileCount: plan.fileCount, token: plan.token, expiresAt: plan.expiresAt } });
          } catch (error) {
            if (!disposed && !currentRequest.signal.aborted && currentGeneration === generation && state) report(error);
          }
        },
        acknowledge(value) { if (state?.phase === 'ready') patch({ acknowledged: value }); },
        expire() { if (state?.phase === 'ready') report({ code: 'EXPIRED', message: '' }); },
        async remove() {
          if (state?.phase !== 'ready' || !state.plan || !state.acknowledged) return;
          if (state.plan.expiresAt <= Date.now()) { controller.expire(); return; }
          const target = { sessionId: state.sessionId, token: state.plan.token };
          const currentGeneration = ++generation;
          request?.abort();
          request = new AbortController();
          const currentRequest = request;
          patch({ phase: 'deleting', error: null, longRunning: false }); // Synchronous duplicate-submit lock.
          try {
            const result = await rpc('remove', { ...target, confirmDeletion: true, acknowledgeLimits: true }, currentRequest.signal);
            if (disposed || currentGeneration !== generation || !state) return;
            if (!result || result.sessionId !== target.sessionId || result.deleted !== true ||
              !validCount(result.bytes) || !validCount(result.fileCount) || !Array.isArray(result.warnings) ||
              result.warnings.some(warning => typeof warning !== 'string')) {
              throw Object.assign(new Error('Unverified deletion outcome'), { code: 'PROTOCOL' });
            }
            if (result.warnings.length === 0) {
              // Only a fully validated, warning-free result may dismiss the UI.
              // Invalidate this generation before another target can be opened.
              ++generation;
              request = null;
              publish(null);
            } else {
              patch({ phase: 'success', plan: null, acknowledged: false, result });
            }
          } catch (error) {
            if (!disposed && currentGeneration === generation && state) report(error, 'remove');
          }
        },
        waitingLong() { if (state?.phase === 'deleting') patch({ longRunning: true }); },
        close(options) {
          if (!state) return;
          const deleting = state.phase === 'deleting';
          if (deleting && (!state.longRunning || options?.detachPending !== true)) return;
          ++generation;
          // Closing the long-wait UI is not cancellation. Detach the request
          // before a future prepare/dispose can abort it; late results are stale.
          if (!deleting) request?.abort();
          request = null;
          publish(null);
        },
        dispose() {
          if (openingTimer !== null) window.clearTimeout(openingTimer);
          ++generation;
          if (state?.phase !== 'deleting') request?.abort();
          request = null;
          publish(null);
          disposed = true;
          listeners.clear();
        },
      };
      return controller;
    }

    function useTranslation(locale) {
      React.useSyncExternalStore(listener => locale.subscribe(listener), () => locale.getSnapshot(), () => locale.getSnapshot());
      return locale.bind(NS);
    }
    function formatBytes(bytes) {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
    }
    function errorText(error, t) {
      const code = String(error?.code || '').split('/').pop().replace(/-/g, '_').toUpperCase();
      const keys = { NOT_ARCHIVED: 'notArchived', ARCHIVE_FAILED: 'archiveFailed', LIVE_SESSION: 'liveSession', HAS_CHILDREN: 'hasChildren',
        UNSUPPORTED: 'unsupported', CHANGED: 'changed', EXPIRED: 'expired', FORBIDDEN: 'forbidden',
        NOT_FOUND: 'notFound', CANCELLED: 'cancelled', TRANSPORT: 'transport', PARTIAL_DELETE: 'partial',
        PROTOCOL: error?.operation === 'remove' ? 'protocolRemove' : 'protocol' };
      return keys[code] ? t(keys[code]) : (error?.message || t('unknown'));
    }
    function warningText(warning, t) {
      if (warning === 'LOCK_RELEASE_FAILED') return t('lockWarning');
      if (warning === 'WORKSPACE_REFRESH_PENDING') return t('refreshWarning');
      return warning;
    }
    function MenuEntry({ sessionId, displayTitle, useMenuOpenState, controller, locale }) {
      const [, setOpen] = useMenuOpenState();
      const t = useTranslation(locale);
      return h('button', { type: 'button', role: 'menuitem', className: 'sd-delete-menu',
        onClick: () => { setOpen(false); controller.open(sessionId, displayTitle); } }, t('entry'));
    }

    function Dialog({ controller, locale }) {
      const state = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
      const t = useTranslation(locale);
      const dialog = React.useRef(null);
      const cancel = React.useRef(null);
      const titleId = React.useId();
      const descriptionId = React.useId();
      const targetId = state?.sessionId;
      React.useLayoutEffect(() => {
        if (!targetId || !dialog.current) return;
        const element = dialog.current;
        const previous = controller.getSnapshot()?.returnFocus;
        const focusables = () => [...element.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')]
          .filter(item => !item.hidden && !item.closest('[inert],[hidden]'));
        const initial = () => (cancel.current && !cancel.current.disabled ? cancel.current : null) || focusables()[0] || element;
        initial().focus({ preventScroll: true });
        const keydown = event => {
          // Alertdialogs are absent from the host's dialog selector. Window
          // capture blocks background app shortcuts, not native text editing.
          event.stopPropagation();
          if (event.isComposing || event.keyCode === 229) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            if (!event.repeat) controller.close();
          } else if (event.key === 'Tab') {
            const items = focusables();
            const first = items[0] || element;
            const last = items[items.length - 1] || element;
            const active = document.activeElement;
            if (!element.contains(active) || active === element ||
              (event.shiftKey ? active === first : active === last)) {
              event.preventDefault();
              (event.shiftKey ? last : first).focus();
            }
          }
        };
        const focusin = event => { if (!element.contains(event.target)) initial().focus({ preventScroll: true }); };
        window.addEventListener('keydown', keydown, true);
        document.addEventListener('focusin', focusin);
        return () => {
          window.removeEventListener('keydown', keydown, true);
          document.removeEventListener('focusin', focusin);
          if (previous instanceof HTMLElement && previous.isConnected && !previous.closest('[inert],[hidden]')) {
            previous.focus({ preventScroll: true });
          }
        };
      }, [targetId, controller]);
      React.useEffect(() => {
        if (state?.phase !== 'ready' || !state.plan) return undefined;
        const timer = window.setTimeout(() => controller.expire(), Math.min(2147483647, Math.max(0, state.plan.expiresAt - Date.now())));
        return () => window.clearTimeout(timer);
      }, [state?.phase, state?.plan, controller]);
      React.useEffect(() => {
        if (state?.phase !== 'deleting') return undefined;
        const timer = window.setTimeout(() => controller.waitingLong(), 30_000);
        return () => window.clearTimeout(timer);
      }, [state?.phase, controller]);
      React.useEffect(() => {
        if (state && dialog.current &&
          (!dialog.current.contains(document.activeElement) || document.activeElement?.disabled)) {
          const target = state.phase === 'deleting' ? dialog.current : cancel.current;
          target?.focus({ preventScroll: true });
        }
      }, [state?.phase]);
      if (!state) return null;
      const success = state.phase === 'success';
      const deleting = state.phase === 'deleting';
      const preparing = state.phase === 'preparing';
      const ready = state.phase === 'ready';
      const canDelete = ready && state.plan && state.acknowledged;
      const title = state.displayTitle || state.plan?.title || t('emptyTitle');
      const stats = value => h('dl', { className: 'sd-delete-stats' },
        h('div', null, h('dt', null, t('files')), h('dd', null, String(value.fileCount))),
        h('div', null, h('dt', null, t('size')), h('dd', null, formatBytes(value.bytes))));
      return h('div', { className: 'sd-delete-layer', role: 'presentation' },
        h('section', { ref: dialog, className: 'sd-delete-dialog', role: 'alertdialog', 'aria-modal': true,
          'aria-labelledby': titleId, 'aria-describedby': descriptionId,
          'aria-busy': preparing || (deleting && !state.longRunning), tabIndex: -1, 'data-shortcut-modal': 'other' },
          h('h2', { id: titleId }, t(success ? 'successTitle' : 'title')),
          h('div', { className: 'sd-delete-target' }, title),
          h('div', { className: 'sd-delete-id' }, `${t('sessionId')}: ${state.sessionId}`),
          success ? h(React.Fragment, null,
            h('p', { id: descriptionId, role: 'status' }, t('success', {
              count: state.result.fileCount, size: formatBytes(state.result.bytes),
            })),
            h('p', { className: 'sd-delete-muted' }, t('remaining')),
            state.result.warnings.length ? h('div', null,
              h('h3', null, t('warnings')),
              h('ul', { className: 'sd-delete-warnings' }, state.result.warnings.map((warning, index) => h('li', { key: index }, warningText(warning, t))))) : null,
            h('p', { className: 'sd-delete-muted' }, t('refreshNotice')),
            h('div', { className: 'sd-delete-actions' },
              h('button', { ref: cancel, type: 'button', onClick: () => controller.close() }, t('close')),
              h('button', { type: 'button', onClick: () => { if (window.confirm(t('refreshPrompt'))) window.location.reload(); } }, t('refresh'))))
          : h(React.Fragment, null,
            h('p', { id: descriptionId }, t('introduction')),
            h('div', { className: 'sd-delete-limits' }, h('h3', null, t('scopeTitle')), t('limits')),
            h('p', { className: 'sd-delete-muted' }, t('prerequisite')),
            state.plan ? stats(state.plan) : null,
            preparing ? h('p', { role: 'status', className: 'sd-delete-busy' }, t('preparing')) : null,
            state.error ? h('div', { role: 'alert', className: 'sd-delete-error' },
              h('h3', null, t('errorHeading')), h('p', null, errorText(state.error, t)),
              state.error.code === 'PARTIAL_DELETE' && state.error.details?.removed !== undefined
                ? h('p', null, t('partialFiles', { count: state.error.details.removed })) : null,
              state.error.code === 'PARTIAL_DELETE' && state.error.details?.bytes !== undefined
                ? h('p', null, t('partialBytes', { size: formatBytes(state.error.details.bytes) })) : null,
              state.error.operation === 'remove' ? h('p', { className: 'sd-delete-muted' }, t('retryGuidance')) : null,
              h('span', { className: 'sd-delete-muted' }, state.error.code)) : null,
            ready || deleting ? h(React.Fragment, null,
              h('label', { className: 'sd-delete-check' },
                h('input', { type: 'checkbox', checked: state.acknowledged, disabled: deleting,
                  onChange: event => controller.acknowledge(event.target.checked) }),
                h('span', null, t('acknowledge')))) : null,
            deleting ? h('p', { role: 'status', className: 'sd-delete-busy' }, t(state.longRunning ? 'longWait' : 'deleting')) : null,
            h('div', { className: 'sd-delete-actions' },
              h('button', { ref: cancel, type: 'button', disabled: deleting && !state.longRunning,
                title: deleting ? t(state.longRunning ? 'closeWaitingHint' : 'busyClose') : undefined,
                onClick: () => controller.close(deleting ? { detachPending: true } : undefined) },
                t(deleting && state.longRunning ? 'closeWaiting' : 'cancel')),
              state.phase === 'error' ? h('button', { type: 'button', onClick: () => { void controller.prepare(); } }, t('retry')) : null,
              ready || deleting ? h('button', { type: 'button', className: 'sd-delete-danger', disabled: !canDelete,
                onClick: () => { void controller.remove(); } }, t(deleting ? 'deleting' : 'delete')) : null))));
    }

    return {
      inject: ['slots', 'locale', 'connection'],
      apply(ctx) {
        const controller = createController(ctx);
        ctx.effect(() => () => controller.dispose(), 'session-delete: controller');
        ctx.effect(() => ctx.locale.register(NS, dictionaries), 'session-delete: dictionaries');
        ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register({
          name: 'sidebar.workspaces.session.menu.item', id: 'session-delete.entry', order: 700,
          inject: () => ({ controller, locale: ctx.locale }),
        }, MenuEntry));
        function Overlay() {
          return h(React.Fragment, null, h('style', null, css), h(Dialog, { controller, locale: ctx.locale }));
        }
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: 'session-delete.dialog', order: 1000,
        }, Overlay));
      },
    };
  },
});
