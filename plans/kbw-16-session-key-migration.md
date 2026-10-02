# KBW-16 — Session Storage-Key Migration

Status: **SOURCE COMPLETE / OWNER BROWSER-PERSISTENCE QUALIFICATION PENDING**

Program: **KBW — Kahu Browser Workbench v2**

Starting `main`: `21fbf0b157b49a4919767e020ea1d8ff2f75e1d2`

Qualified source checkpoint: `88d7b3ffae6f62d1ec9bc944c911b6ec1d62c91c`

## Goal

Reconcile the browser persistence key with the version-5 session payload introduced by KBW-15 without losing recoverability for sessions previously stored under the version-4 key.

## Contract

1. Newly saved sessions use `kahustack-dsp-testbed.session.v5`.
2. Recovery checks v5 first, then v4, then the existing v3 and v2 keys.
3. Reading a v4-key session continues through the existing payload decoder/migration logic; the storage-key version never substitutes for payload validation.
4. Recovery remains deterministic and does not delete or mutate older localStorage records automatically.
5. No transport, rack, DSP, timeline, waveform, or audible behavior changes are in scope.

## Implementation slices

### KBW-16A — storage-key authority — COMPLETE

- advanced `SESSION_STORAGE_KEY` to `.v5`;
- added explicit `LEGACY_SESSION_V4_STORAGE_KEY`;
- retained v3 and v2 legacy keys;
- added focused permanent tests that pin the key chain.

### KBW-16B — recovery chain — COMPLETE

- added a pre-workbench storage promotion boundary that reads v4 only when v5 is absent;
- migration still passes through `decodeSession` before writing normalized v5 state;
- the workbench boots only after the promotion boundary completes;
- v3 and v2 recovery remain available through the existing workbench chain.

### KBW-16C — source qualification — COMPLETE

GitHub Actions run `36980007395` passed the complete child source-validation sequence at `88d7b3ffae6f62d1ec9bc944c911b6ec1d62c91c`:

- dependency installation — PASS;
- OpenDAW package dependency build — PASS;
- `npm run typecheck:kahu` — PASS;
- `npm run test:kahu` — PASS;
- `npm run lint --workspace=@kahustack/opendaw-testbed` — PASS;
- `npm run build:kahu` — PASS.

No listening gate is introduced by this slice. Real browser localStorage migration/recovery remains part of owner browser qualification.

## Implemented commit sequence

1. `53a19b6cb265eee867255198c65613638931c349` — `fix(kahu-session): migrate browser storage key to v5`
2. `db6f9233846d7f0b582e1a4b7ca2fbf6bf06bd2f` — `fix(kahu-session): preserve v4 recovery fallback`
3. `475889787ca8e1ba82c0020ab3d6384fbcb0a255` — `fix(kahu-session): promote v4 state before workbench boot`
4. `88d7b3ffae6f62d1ec9bc944c911b6ec1d62c91c` — `test(kahu-session): pin storage-key migration contract`

## Non-goals

- no automatic deletion of legacy keys;
- no IndexedDB/OPFS migration;
- no persistence of browser-local source audio;
- no session payload version 6;
- no broader storage abstraction work.
