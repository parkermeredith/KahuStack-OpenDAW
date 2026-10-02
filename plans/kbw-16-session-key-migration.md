# KBW-16 — Session Storage-Key Migration

Status: **ACTIVE**

Program: **KBW — Kahu Browser Workbench v2**

Starting `main`: `21fbf0b157b49a4919767e020ea1d8ff2f75e1d2`

## Goal

Reconcile the browser persistence key with the version-5 session payload introduced by KBW-15 without losing recoverability for sessions previously stored under the version-4 key.

## Contract

1. Newly saved sessions use `kahustack-dsp-testbed.session.v5`.
2. Recovery checks v5 first, then v4, then the existing v3 and v2 keys.
3. Reading a v4-key session must continue to pass through the existing payload decoder/migration logic; the storage-key version never substitutes for payload validation.
4. Recovery must remain deterministic and must not delete or mutate older localStorage records automatically.
5. No transport, rack, DSP, timeline, waveform, or audible behavior changes are in scope.

## Implementation slices

### KBW-16A — storage-key authority

- advance `SESSION_STORAGE_KEY` to `.v5`;
- add explicit `LEGACY_SESSION_V4_STORAGE_KEY`;
- retain v3 and v2 legacy keys;
- add focused permanent tests that pin the key chain.

### KBW-16B — recovery chain

- import the v4 legacy key into the workbench;
- recover in strict order v5 -> v4 -> v3 -> v2;
- keep save behavior on v5 only.

### KBW-16C — source qualification

Run the focused child source gates:

```bash
npm run typecheck:kahu
npm run test:kahu
npm run lint --workspace=@kahustack/opendaw-testbed
npm run build:kahu
```

No owner listening gate is introduced by this slice. Browser-local persistence recovery remains part of the existing owner browser qualification program.

## Atomic commit sequence

1. `docs(kbw): start session-key migration slice`
2. `fix(kahu-session): migrate browser storage key to v5`
3. `fix(kahu-session): preserve v4 recovery fallback`
4. `docs(kbw): record session-key qualification status`

## Non-goals

- no automatic deletion of legacy keys;
- no IndexedDB/OPFS migration;
- no persistence of browser-local source audio;
- no session payload version 6;
- no broader storage abstraction work.
