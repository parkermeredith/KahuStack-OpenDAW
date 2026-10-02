# KBW-16 — Batch Source Admission

Status: **IN PROGRESS**

Program: **KBW — Kahu Browser Workbench v2**

Starting `main`: `88d7b3ffae6f62d1ec9bc944c911b6ec1d62c91c`

## Goal

Make the reduced browser workbench practical for stem sets and session recovery by admitting multiple browser-local audio files in one action while preserving deterministic track creation, bounded decoding pressure, source-failure isolation, and existing Kahu runtime semantics.

## Contract

1. The persistent track add control accepts one or many browser-decodable audio files.
2. The zero-track drop surface accepts one or many files.
3. A batch is decoded and admitted sequentially in browser file-list order so large stem sets do not trigger an avoidable burst of simultaneous full-file decode allocations.
4. One failed source does not abort later sources in the same batch.
5. If transport is already running, newly admitted tracks join through one final shared reschedule rather than repeatedly restarting the transport for every file.
6. Session recovery uses unrecovered session tracks and verifies file name, channel count, and decoded duration within a small tolerance before restoring track identity/state. Decoded sample rate is not a recovery identity requirement because `decodeAudioData` may follow the active audio-context rate.
7. Batch completion reports loaded, recovered, failed, and still-missing source counts without claiming audible/browser qualification.
8. Kahu DSP, rack identity, Rust/WASM processing, transport epoch semantics, pan/gain behavior, and long-form scope remain unchanged.

## Slices

### KBW-16A — recovery identity

- extract a pure recoverable-source matcher;
- reject wrong-channel or materially different-duration files even when the filename matches;
- preserve deterministic first-unrecovered match behavior;
- add permanent focused tests.

### KBW-16B — sequential batch admission

- replace first-file-only chooser/drop behavior with ordered multi-file admission;
- isolate decode failures per source;
- perform one final playback reschedule for a running transport;
- preserve stable track IDs and ordinary single-file behavior.

### KBW-16C — source qualification and closure

Run the permanent child gates:

```bash
npm run typecheck:kahu
npm run test:kahu
npm run lint --workspace=@kahustack/opendaw-testbed
npm run build:kahu
```

Owner browser/audio qualification remains required for actual multi-stem playback, live batch addition during playback, drag/drop behavior, and session recovery with real local files.

## Non-goals

- no directory traversal, cloud import, persistent browser file handles, OPFS source caching, streaming decode, disk streaming, or long-form audio work;
- no track grouping, buses, mixer expansion, recording, or project-model adoption;
- no change to Kahu DSP or AudioWorklet/rack topology.
