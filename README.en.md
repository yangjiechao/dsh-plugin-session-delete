# DSH session log deletion

[中文](README.md) · MIT · No runtime dependencies or build step

Adds **Permanently delete logs…** to a DeepSeek Harness session menu. A warning dialog discloses the scope and requires a checkbox plus typed `DELETE`. Cancelling does not delete logs.

> **A local session-log maintenance tool, not a privacy eraser or official DSH deletion API.** Test with disposable sessions first. Deletion cannot be undone by this plugin.

## Compatibility and installation

Built for **DSH 0.2.2-rc.3, current Session V4**. The manifest deliberately gates `>=0.2.2-rc.3 <0.2.3-0`. Supports the local JSONL backend with raw or Zstandard logs. No automatic historical migration, mixed encodings, future formats, subagent sessions, parent sessions with known children, network filesystems, or distributed deployment support.

The lower bound is not merely a development label: published `0.2.1-rc.3` lacks `SessionPersistenceSnapshot.location` (used to locate and validate the actual log) and `workspace/session-unarchiving` (used to reject lifecycle re-entry during deletion). Keep the tested `0.2.2-rc.3` lower bound; this does not claim those APIs first appeared in that exact RC. A missing location is rejected, never replaced with a guessed filesystem path.

Install from GitHub with `plugin_manager action=install_bundle target=github:yangjiechao/dsh-plugin-session-delete`, or clone/download this repository and use **Settings → Plugins → Add plugin** to install its absolute directory. No install scripts or cloud account. Refresh your existing DSH page afterwards; honor any restart-required result.

## Use

1. Archive the target session. Switch away and do not reopen it.
2. Close other DSH processes sharing this store. If the target is still loaded, save other work and restart DSH, then use its archived row **without opening it**.
3. Choose **Permanently delete logs…** from the session's `…` menu.
4. Check the captured title, exact ID, file count, estimated bytes, and limitations. Tick the acknowledgment, type `DELETE`, and confirm.
5. Wait for the result. Confirmations expire after two minutes or a log change. A failed attempt consumes its token; inspect afresh. Refresh manually if needed; stale workspace header indexes can require a DSH restart.

The plugin never forcibly stops or unloads a live session. Deletion is not recursive. Parent sessions with known children must be handled leaf-first.

## What is deleted

All recognized canonical log generations in the selected session directory are unlinked, oldest first and the authoritative newest generation last. No trash or log backup is created. Public workspace entity APIs attempt to detach membership after deletion; post-cleanup failures are reported.

## What is NOT deleted

- The directory, stable `session.lock` inode and small deletion-intent receipt (ID, timestamps and filenames only, no chat content).
- The archive ID and some in-memory workspace header indexes.
- Projection caches, search SQLite/FTS/WAL data and old database pages. Subsequent searches normally reconcile missing sources logically; that is not disk erasure.
- Shared images, uploads, spill output, project files or Git worktrees.
- Copies in forks/other sessions, exports, filesystem snapshots and backups.
- Third-party memories such as Hindsight, provider-held requests, or previously exported telemetry.
- Scheduled tasks or delivery history. Manage these separately; the archive gate remains.

**This is not secure erasure, nor a guarantee that all copies of a conversation are gone.** A user needing comprehensive privacy removal must not rely on this plugin.

## Safety model

The Host derives paths from the trusted persistence snapshot, never client paths. It checks layout, current format, archive/live/child state, ordinary single-link files and non-symlink directories. It acquires the backend's normal write exclusion and kernel lock, then rechecks fingerprint and liveness. It never removes the lock inode or recursively deletes a directory.

A short-lived single-use token binds the authenticated owner peer, session and preview fingerprint. Destructive confirmation is user-only; the Agent receives only `session_delete_preview({sessionId})`, which cannot authorize or perform deletion.

A durable deletion-intent receipt precedes unlink. Partial removal is reported, not rolled back or called success. Retry requires fresh inspection; no automatic destructive cleanup runs at startup. Once unlink starts, the finite sequence continues despite browser cancellation. Unload drains active removals. The plugin also vetoes same-ID session creation during deletion and after success for its current lifetime.

This is **not a global cross-process/cross-version tombstone protocol**. Existing read leases cannot be revoked. Use a trusted local filesystem with other DSH processes shut down. An adversarial process running as the same OS user, future backend layout changes, and unreliable network locks are outside the safety model. Uninstalling removes the process-local admission fence.

## Development

```sh
npm test
npm run check
npm pack --dry-run
```

Tests use synthetic logs in unique temporary directories, never your real history. `deletion.js` contains the operation, `index.js` the authenticated RPC bridge/read-only tool, and `client.js` the UI. Release verification must state which platforms and live UI flows were actually exercised; do not assume a code test proves cross-platform or visual correctness.

See [SECURITY.md](SECURITY.md). Never include real logs, cookies, tokens or secrets in an issue.
