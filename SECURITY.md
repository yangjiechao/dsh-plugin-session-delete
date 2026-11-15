# Security and deletion semantics

## Supported release

Version 0.1.x is a narrowly scoped JSONL log-maintenance plugin for DSH 0.2.2-rc.3 / current V4 sessions. Later DSH releases require renewed compatibility review. Do not bypass the engine gate for destructive testing on valuable data.

## Scope and trust

Host plugins execute outside a session's workspace sandbox. Inspect the code before installation. This plugin contains no external network requests, subprocess execution, install scripts, telemetry or extra model calls. Communication uses DSH's authenticated Connection RPC channel and an additional `owner` principal check.

The confirmation dialog is a human safety interlock, not a security boundary against a malicious installed Host plugin or an already-compromised authenticated owner page. The Host verifies token, peer binding, exact ID, typed confirmation, scope acknowledgment, current storage identity, exclusive writer ownership, and live/archive state.

Local same-user adversarial filesystem mutation cannot be eliminated with Node path-based unlink. Symlinks/junctions, hardlinks, unexpected layouts/files and preflight drift are rejected, but there remains a check/use window against an attacker who can rename directories under the same user. Do not use this as a privileged service or on hostile/shared/network storage. Close other processes sharing the store.

## Availability and partial failures

Multiple log files cannot be unlinked atomically with the current DSH persistence seam. Old generations are removed before the current authoritative generation. A small immutable intent receipt is fsynced before deletion (directory fsync unavailable through this implementation on Windows). The plugin never automatically resumes removal after restart.

If removal fails midway, the operation reports `PARTIAL_DELETE` and the confirmed count/bytes. Remaining files can be inspected through a fresh confirmation when the current log still exists. If all files were unlinked but directory sync or verification failed, the row may no longer be previewable: stop and inspect the store rather than assuming a rollback. A crash after unlink but before directory fsync can still have filesystem-specific recovery behavior. Backups/snapshots may recover deleted data.

The lock file and directory deliberately remain, maintaining POSIX inode-based locking. The intent receipt contains session ID, lifecycle timestamp, request timestamp and canonical filenames; no title, message body or secret is copied into it. The archive ID is retained. There is no global identity-tombstone protocol across other DSH processes or versions. Explicit SessionId reuse outside the plugin and existing read leases are not retroactively controlled.

## Privacy non-goals

Deleting logs is not privacy erasure. Projection caches, SQLite database/WAL/FTS pages, shared attachments/uploads/spill, forks, exports, filesystem backups, third-party memories, model-provider data and telemetry are not purged. Scheduled tasks remain independently managed. Public workspace membership is detached best-effort; stale in-memory header indexes can require restart. The UI and README disclose these limitations before deletion.

No model-facing destructive tool is registered. `session_delete_preview` is read-only and does not provide confirmation tokens. Confirmation/authorization stays in the user UI.

## Reporting

Report reproducible non-sensitive issues in the repository. For sensitive findings, use GitHub private vulnerability reporting if the repository owner has enabled it; otherwise first open a minimal issue asking for a private contact without exploit details or personal data. Never attach real conversation logs, access tokens, cookies or deletion tokens.
