# KBW-17 — Batch Source Admission

Status: **SOURCE COMPLETE / OWNER BROWSER-AUDIO QUALIFICATION PENDING**

Program: **KBW — Kahu Browser Workbench v2**

Starting `main`: `88d7b3ffae6f62d1ec9bc944c911b6ec1d62c91c`

Qualified source checkpoint: `15e88569b21aa304ec7437511aa44840547beca1`

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

## Implemented slices

### KBW-17A — recovery identity — COMPLETE

- added a pure recoverable-source matcher;
- filename matching is case-insensitive;
- channel count must match;
- decoded duration must remain within 50 ms of saved metadata;
- decoded sample rate is deliberately not an identity requirement because Web Audio decoding may follow the active context rate;
- first-unrecovered matching remains deterministic;
- permanent tests cover valid, wrong-channel, materially different-duration, and already-recovered cases.

Commits:

- `4e5cc36c4a89bd603bb91b165b6ac30ff0aa76ef` — `feat(kahu-source): validate recoverable source identity`
- `f1afdbd2afbe3816fdfe11b5aeb4239d6132fd44` — `test(kahu-source): cover recoverable source matching`
- `3901a71e8d3ebf3d3b2507dfa5420c8356a64558` — `test(kahu-source): align recovery phase label`

### KBW-17B — sequential batch admission — COMPLETE

- the track chooser now accepts multiple audio files;
- the zero-track drop surface consumes every dropped file instead of only the first;
- batches are queued and decoded sequentially in browser file-list order;
- per-source decode failures are isolated and later files continue;
- live transport performs one final shared reschedule after a successful batch rather than one restart per source;
- session recovery uses the stronger recoverable-source identity contract;
- completion status reports loaded, recovered, failed, and still-missing session sources;
- permanent structural tests pin multi-file chooser/drop behavior, sequential admission, one-reschedule behavior, and recovery matching.

Commits:

- `2e2237a005501da12f68a97d3cfccfde18ca29d4` — `feat(kahu-source): admit stem batches sequentially`
- `15e88569b21aa304ec7437511aa44840547beca1` — `test(kahu-source): pin batch admission structure`

### KBW-17C — source qualification — COMPLETE

GitHub Actions run `37003519117` passed the complete child source-validation sequence at `15e88569b21aa304ec7437511aa44840547beca1`:

- dependency installation — PASS;
- OpenDAW package dependency build — PASS;
- `npm run typecheck:kahu` — PASS;
- `npm run test:kahu` — PASS;
- `npm run lint --workspace=@kahustack/opendaw-testbed` — PASS;
- `npm run build:kahu` — PASS.

The subsequent documentation-only KBW-16/17 closure changes do not alter the qualified behavior. A transient post-closure file replacement was immediately superseded by `fix(kahu-source): restore qualified batch workbench`, which restores the exact qualified `workbench.tsx` blob. Owner validation remains pending.

## Owner qualification still required

Source completion does **not** close browser/audio behavior. Validate in real Chrome and Edge sessions with representative stems and saved sessions:

1. choose several audio files in one file-picker action and confirm all tracks appear in file-list order;
2. drop several audio files onto the zero-track state and confirm all tracks are admitted;
3. include one unsupported/corrupt source between valid sources and confirm the valid sources before and after it remain admitted;
4. add a batch while transport is running and confirm playback restarts once on a shared epoch without repeated audible restarts;
5. audition multiple admitted stems together and verify existing mute, solo, gain, pan, rack, loop, seek, and A/B behavior remains correct;
6. recover a saved multi-track session by selecting its source files as one batch and verify stable track IDs, regions, gain/pan, rack state, selection, loop, and follow state;
7. provide a same-name file with the wrong channel count or materially different duration and verify it is not mistaken for the saved source;
8. verify ordinary single-file addition still behaves identically to the pre-KBW-17 path.

## Non-goals

- no directory traversal, cloud import, persistent browser file handles, OPFS source caching, streaming decode, disk streaming, or long-form audio work;
- no track grouping, buses, mixer expansion, recording, or project-model adoption;
- no change to Kahu DSP or AudioWorklet/rack topology.
