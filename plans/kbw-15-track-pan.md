# KBW-15 — Track Pan Completion

Status: **SOURCE COMPLETE / OWNER BROWSER-AUDIO QUALIFICATION PENDING**

Program: **KBW — Kahu Browser Workbench v2**

Starting `main`: `dcdffbd20aa583c0a754121691fb32887197c204`

Qualified source checkpoint: `9360e09b0884b4c705501721d4d1244020a1e3b6`

## Goal

Complete the original compact engineering-host channel contract by adding per-track stereo pan without changing Kahu DSP semantics or broadening the workbench into a full mixer.

## Contract

1. Track state owns one normalized pan value in `[-1, 1]`, where `-1` is left, `0` is center, and `1` is right.
2. Browser playback applies pan after track gain and before the existing input-trim / comparison / Kahu processing route.
3. Pan is a host channel-control responsibility and is not implemented inside Kahu DSP modules.
4. Pan changes update active playback immediately without rescheduling transport or rebuilding the Kahu rack.
5. Session persistence retains pan while v1-v4 sessions recover centered pan deterministically.
6. Track controls remain compact and use the existing openDAW-style value-control language.
7. Mono sources may be spatialized by the browser `StereoPannerNode`; stereo sources retain Web Audio's standard stereo-panner semantics.

## Implemented slices

### KBW-15A — track/session state — COMPLETE

- added `pan` to `TrackState` and restored metadata;
- clamp restored and edited values to `[-1, 1]`;
- added `TrackStore.setPan`;
- advanced the serialized session payload to version 5;
- v1-v4 sessions migrate to centered pan;
- added permanent clamping, round-trip, migration, and invalid-range tests.

Commit: `33631e61213afa2d253b7ac5f62bf1e9e6f4ca36` — `feat(kahu-track): persist bounded stereo pan`

### KBW-15B — Web Audio routing — COMPLETE

- inserted a `StereoPannerNode` after track gain and before input trim;
- added bounded `AudioTrackPlayer.setPan` updates at the active audio-context time;
- preserved dry/processed comparison routing and Kahu rack topology.

Commit: `36a486801a33f4c6274c340808cadb71a414100e` — `feat(kahu-audio): route tracks through stereo pan`

### KBW-15C — compact UI integration — COMPLETE

- added a compact pan value control beside gain;
- display semantics use `L`, `C`, and `R` with percentage-style magnitude;
- edits update active player pan immediately;
- restored pan is applied when the browser player is admitted, before playback;
- existing row height, mute/solo/remove behavior, timeline alignment, and KUX layout remain intact.

Commit: `ae771872a2bf04174d0787cc11a5104c4bc3992a` — `feat(kahu-ui): expose compact track pan control`

### KBW-15D — source qualification — COMPLETE

The first qualification run exposed a TypeScript control-flow narrowing issue in the versioned session validator. The validated session version is now captured before the `Array.every` callback so strict TypeScript retains the discriminant.

Corrective commit: `9360e09b0884b4c705501721d4d1244020a1e3b6` — `fix(kahu-session): retain version narrowing in validator`

GitHub Actions run `36979186099` passed the complete child source-validation sequence at that checkpoint:

- dependency installation — PASS;
- OpenDAW package dependency build — PASS;
- `npm run typecheck:kahu` — PASS;
- `npm run test:kahu` — PASS;
- `npm run lint --workspace=@kahustack/opendaw-testbed` — PASS;
- `npm run build:kahu` — PASS.

## Owner qualification still required

Source completion does **not** close the audible/browser gate. Validate the following in real Chrome and Edge sessions with a representative stereo source and a mono source:

1. center (`C`) is perceptually centered;
2. full-left and full-right reach the expected browser stereo endpoints;
3. intermediate L/R edits move immediately during active playback without restart/glitch;
4. mute, solo, gain, input trim, A/B comparison, and rack processing remain correct while panned;
5. save/recover preserves non-center pan after reselecting browser-local source audio;
6. mono and stereo source behavior matches standard Web Audio `StereoPannerNode` expectations.

## Atomic commit sequence

1. `253dc06962d5a46615e47ea2abd92db7c0ece0d1` — `docs(kbw): start track-pan completion slice`
2. `33631e61213afa2d253b7ac5f62bf1e9e6f4ca36` — `feat(kahu-track): persist bounded stereo pan`
3. `36a486801a33f4c6274c340808cadb71a414100e` — `feat(kahu-audio): route tracks through stereo pan`
4. `ae771872a2bf04174d0787cc11a5104c4bc3992a` — `feat(kahu-ui): expose compact track pan control`
5. `9360e09b0884b4c705501721d4d1244020a1e3b6` — `fix(kahu-session): retain version narrowing in validator`
6. closure commit — `docs(kbw): record track-pan qualification status`

## Non-goals

- no sends, buses, mixer strips, automation lanes, surround panning, binaural processing, balance-law redesign, or Kahu DSP-module changes;
- no change to rack state semantics;
- no change to transport scheduling or waveform/timeline behavior.
