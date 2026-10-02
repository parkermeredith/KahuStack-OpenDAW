# KBW-18 — Playback Cursor Correctness

Status: **IN PROGRESS**

Program: **KBW — Kahu Browser Workbench v2**

Starting `main`: `5ef1b359d3fbd3670c4e1941c18d1d149e852674`

## Goal

Correct the browser track-player source cursor so offset and bounded-region playback report and retain the actual source position. This is a host playback-state correction only; it does not change the shared transport clock, Kahu DSP, rack processing, region model, or session semantics.

## Defect

The current `AudioTrackPlayer.positionSeconds()` computes only `currentTime - startedAtSeconds` while a running source may have started from a non-zero source offset. A source scheduled for offset 12 s therefore reports approximately 0 s at playback start instead of 12 s. In addition, the `onended` handler always stores `buffer.duration`, even when `AudioBufferSourceNode.start()` was given a bounded region duration and playback actually ended earlier.

## Contract

1. While playing, source position equals `start source offset + elapsed AudioContext time`.
2. Before a future scheduled start time, position remains at the source start offset rather than moving backward or reporting zero.
3. Position is bounded by the scheduled playback end offset.
4. A duration-limited source stores `start offset + scheduled duration` when it ends, clamped to the buffer duration.
5. An unbounded or non-positive-duration start retains the existing play-to-buffer-end behavior.
6. `pauseAt()` without an explicit offset captures the corrected running source position.
7. Stop, explicit seek, gain, pan, routing, shared transport epoch scheduling, and Kahu rack semantics remain unchanged.

## Slices

### KBW-18A — pure cursor math

- add bounded pure source-position/end-offset helpers;
- cover non-zero offsets, future starts, duration limits and buffer-end clamping with permanent tests.

### KBW-18B — player state integration

- retain the scheduled end offset while a source is active;
- use corrected cursor math for `positionSeconds()`;
- retain the actual bounded end offset in `onended`;
- clear only transient scheduling state when stopping a node.

### KBW-18C — source qualification

Run the normal child source gates:

```bash
npm run typecheck:kahu
npm run test:kahu
npm run lint --workspace=@kahustack/opendaw-testbed
npm run build:kahu
```

Owner browser/audio qualification remains required for audible pause/resume and region-end behavior with real source audio.

## Non-goals

- no transport redesign;
- no loop-model change;
- no time-stretch/warp behavior;
- no streaming or long-form source work;
- no DSP/rack changes.
