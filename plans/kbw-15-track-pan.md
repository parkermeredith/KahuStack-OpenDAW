# KBW-15 — Track Pan Completion

Status: **ACTIVE**

Program: **KBW — Kahu Browser Workbench v2**

Starting `main`: `dcdffbd20aa583c0a754121691fb32887197c204`

## Goal

Complete the original compact engineering-host channel contract by adding per-track stereo pan without changing Kahu DSP semantics or broadening the workbench into a full mixer.

## Contract

1. Track state owns one normalized pan value in `[-1, 1]`, where `-1` is left, `0` is center, and `1` is right.
2. Browser playback applies pan after track gain and before the existing input-trim / comparison / Kahu processing route.
3. Pan must not be implemented inside Kahu DSP modules; it is a host channel-control responsibility.
4. Pan changes must update active playback immediately without rescheduling transport or rebuilding the Kahu rack.
5. Session persistence must retain pan while older session versions recover centered pan deterministically.
6. Track controls stay compact and use the existing openDAW-style value-control language.
7. Mono sources may be spatialized by the browser `StereoPannerNode`; stereo sources retain Web Audio's standard stereo-panner semantics.

## Implementation slices

### KBW-15A — track/session state

- add `pan` to `TrackState` and restored metadata;
- clamp restored and edited values to `[-1, 1]`;
- add `TrackStore.setPan`;
- version the testbed session format forward;
- migrate v1-v4 sessions to centered pan;
- add focused permanent tests for clamping, round-trip, and migration.

Exit: pan is a stable recoverable channel-state contract independent of browser audio nodes.

### KBW-15B — Web Audio routing

- insert a `StereoPannerNode` into `AudioTrackPlayer` after track gain and before input trim;
- add `setPan` with bounded immediate updates;
- preserve the existing dry/processed comparison routing and Kahu rack topology.

Exit: each track owns one host-level stereo pan stage and existing comparison/output routes remain unchanged.

### KBW-15C — compact UI integration

- add one compact pan value control beside gain;
- use `L`, `C`, and `R` display semantics;
- update the active player immediately on edits;
- retain row height, mute/solo/remove behavior, timeline alignment, and KUX layout contracts.

Exit: users can pan tracks during playback without leaving the track row or rebuilding DSP.

### KBW-15D — qualification and closure

Run the existing standalone gates:

```bash
npm run typecheck:kahu
npm run test:kahu
npm run lint --workspace=@kahustack/opendaw-testbed
npm run build:kahu
```

Owner browser/audio qualification remains required for audible left/center/right behavior in Chrome and Edge. Source completion must not claim that manual listening gate.

## Atomic commit sequence

1. `docs(kbw): start track-pan completion slice`
2. `feat(kahu-track): persist bounded stereo pan`
3. `feat(kahu-audio): route tracks through stereo pan`
4. `feat(kahu-ui): expose compact track pan control`
5. `docs(kbw): record track-pan qualification status`

## Non-goals

- no sends, buses, mixer strips, automation lanes, surround panning, binaural processing, balance-law redesign, or Kahu DSP-module changes;
- no change to rack state semantics;
- no change to transport scheduling or waveform/timeline behavior.
