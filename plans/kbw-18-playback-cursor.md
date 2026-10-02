# KBW-18 — Playback Cursor Correctness

Status: **SOURCE COMPLETE / OWNER BROWSER-AUDIO QUALIFICATION PENDING**

Program: **KBW — Kahu Browser Workbench v2**

Starting `main`: `5ef1b359d3fbd3670c4e1941c18d1d149e852674`

Qualified source checkpoint: `331e3972852bc76fb0c8d294e8c036a186a258cc`

## Goal

Correct the browser track-player source cursor so offset and bounded-region playback report and retain the actual source position. This is a host playback-state correction only; it does not change the shared transport clock, Kahu DSP, rack processing, region model, or session semantics.

## Defect closed in source

The pre-KBW-18 `AudioTrackPlayer.positionSeconds()` computed only `currentTime - startedAtSeconds` while a running source could have started from a non-zero source offset. A source scheduled from 12 seconds therefore reported approximately 0 seconds at playback start instead of 12 seconds. The pre-KBW-18 `onended` handler also always stored `buffer.duration`, even when `AudioBufferSourceNode.start()` had been given a bounded region duration and playback actually ended earlier.

## Implemented contract

1. While playing, source position equals `start source offset + elapsed AudioContext time`.
2. Before a future scheduled start time, position remains at the source start offset rather than moving backward or reporting zero.
3. Position is bounded by the scheduled playback end offset.
4. A duration-limited source stores `start offset + scheduled duration` when it ends, clamped to the buffer duration.
5. An unbounded or non-positive-duration start retains play-to-buffer-end behavior.
6. `pauseAt()` without an explicit offset captures the corrected running source position.
7. Stop, explicit seek, gain, pan, routing, shared transport epoch scheduling, and Kahu rack semantics remain unchanged.

## Implemented slices

### KBW-18A — pure cursor math — COMPLETE

`audio-track.ts` now exposes bounded source-cursor helpers:

- `playbackEndOffsetSeconds(...)` computes the actual source offset at natural completion;
- `playbackPositionSeconds(...)` computes source-offset-aware running position, holds at the source offset before a future scheduled start, and clamps to the scheduled end.

Permanent tests cover:

- non-zero source offsets;
- future scheduled starts;
- bounded completion;
- buffer-end clamping;
- unbounded/play-to-end behavior;
- finite containment of malformed cursor math inputs.

### KBW-18B — player state integration — COMPLETE

`AudioTrackPlayer` now:

- retains `scheduledEndOffsetSeconds` while a source is active;
- computes `positionSeconds()` from source offset plus elapsed context time;
- stores the real bounded end offset in `onended`;
- resets scheduling state without changing the existing explicit stop/seek semantics.

Source commits:

- `ecd9e2e6889016f2336884d1e0895f473c3d6186` — `fix(kahu-audio): correct offset playback cursor`
- `331e3972852bc76fb0c8d294e8c036a186a258cc` — `test(kahu-audio): cover offset playback cursor`

### KBW-18C — source qualification — COMPLETE

GitHub Actions run `37005069970` passed the full child source-validation sequence at `331e3972852bc76fb0c8d294e8c036a186a258cc`:

- dependency installation — PASS;
- OpenDAW package dependency build — PASS;
- `npm run typecheck:kahu` — PASS;
- `npm run test:kahu` — PASS;
- `npm run lint --workspace=@kahustack/opendaw-testbed` — PASS;
- `npm run build:kahu` — PASS.

This is source qualification only. It does not claim audible/browser behavior.

## Owner browser/audio qualification still required

Validate in current Chrome and Edge with real audio:

1. play a region with a non-zero source offset, pause mid-region, resume, and verify playback resumes from the audible source location rather than from elapsed-region time;
2. seek into and around a source-offset region while transport is stopped and running;
3. play a duration-limited region that ends before the source file ends and verify later resume/seek state reflects the bounded region end rather than the file end;
4. exercise a region whose playback is scheduled slightly in the future through the shared transport epoch and confirm no backward/zero cursor behavior is exposed;
5. confirm ordinary full-file playback from source offset zero is unchanged;
6. repeat with mono and stereo sources and with/without a Kahu rack attached to confirm routing changes are absent.

## Non-goals

- no transport redesign;
- no loop-model change;
- no time-stretch/warp behavior;
- no streaming or long-form source work;
- no DSP/rack changes.
