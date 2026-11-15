# Verification record — 0.1.0

## Environment

- Development target: DeepSeek Harness `0.2.2-rc.3`, Session format V4.
- Host test platform: macOS, Node `26.5.0`.
- All deletion tests use unique synthetic temporary session stores; no real user history is deleted.
- Hindsight and GitHub authentication are not prerequisites for using this plugin.

## Executed checks

- `node --check` for Host, deletion core and Client JavaScript.
- 5 non-rendering Client controller regression tests: double confirmation, duplicate-submit lock, expiry, long-wait exit without abort/replay, stale-response isolation, partial-result counters and protocol-outcome wording. These do not simulate a visual UI.
- 37 synthetic filesystem/adapter tests: authorization, immutable preview, archive/live/child/version restrictions, path/links/unknown-file refusal, peer-bound single-use/expiring confirmation, state drift, concurrent calls, partial unlink failure, retry, cancellation, teardown drain and read-only Agent tool registration.
- 2 real installed-DSH backend integrations, raw JSONL and Zstandard: create and close synthetic V4 log, acquire the backend's actual write ownership, prove a second backend instance **and a separate Node process** are locked out during unlink, delete log, close handle, and verify read/write reopening fails rather than recreating history.
- Installed into the current Web profile through Plugin Manager with `application: applied`, no activation warnings. Live Client Inspect confirmed active `session-delete.entry` in the session-menu slot and active `session-delete.dialog` in `shell.overlay`. This proves registration, not the dialog's visual appearance or a completed real-user deletion.
- npm distribution file-list inspection, including exported locales and self-contained SVG icon; the icon parses as XML with the intended viewBox.
- Static UI/UX expert review. No production deletion is exercised through the UI.

## Not established by these tests

- A screenshot or visual approval of the installed dialog/icon in light/dark themes.
- Native keyboard, screen-reader and mobile-browser behavior in the running GUI.
- Windows/Linux native lock and directory-durability behavior.
- Comprehensive crash/power-loss recovery at every physical I/O boundary.
- Atomic lineage transactions across other running DSH processes, global SessionId tombstones, cache/attachment privacy erasure, or compatibility with other DSH versions.

Real-runtime integrations require `DSH_INSTALL_DIR` pointing to the verified installed CLI package. Without it they are explicitly skipped; this does not silently turn adapter tests into backend validation.
