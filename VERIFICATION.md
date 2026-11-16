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

## Compatibility audit (2026-11-16)

- Compared published npm `0.2.1-rc.3` sources with installed `0.2.2-rc.3`: old `dsh-session-persistence/lib/types/index.d.ts` has no snapshot `location`, whereas the new contract provides backend-resolved per-session artifact location. The plugin requires that metadata and deliberately refuses missing locations rather than guessing a path.
- Old `dsh-workspace/lib/types/index.d.ts` and its implementation have no `workspace/session-unarchiving`; the new implementation awaits this event before removing archive state. The plugin's listener uses this admission point to prevent lifecycle re-entry during deletion. Its absence is a real safety-contract gap, even if V4 and write-open already exist.
- Keep manifest `>=0.2.2-rc.3 <0.2.3-0`. This is the tested sufficient baseline, not a claim that the exact RC first introduced either API. No version exemption or profile change was made.
- Added a regression for old-style snapshots with no `location`: preparation returns `UNSUPPORTED`, opens no writer and leaves the directory unchanged. Existing guards already fail closed; no additional runtime fallback is needed.
- Re-ran actual installed `0.2.2-rc.3` JSONL integrations (none/zstd): both pass using disposable logs. Node in this audit: v25.5.0. Historical `0.2.1-rc.3` is not declared supported or tested for destructive operations.

## Not established by these tests

- A screenshot or visual approval of the installed dialog/icon in light/dark themes.
- Native keyboard, screen-reader and mobile-browser behavior in the running GUI.
- Windows/Linux native lock and directory-durability behavior.
- Comprehensive crash/power-loss recovery at every physical I/O boundary.
- Atomic lineage transactions across other running DSH processes, global SessionId tombstones, cache/attachment privacy erasure, or compatibility with other DSH versions.

Real-runtime integrations require `DSH_INSTALL_DIR` pointing to the verified installed CLI package. Without it they are explicitly skipped; this does not silently turn adapter tests into backend validation.
