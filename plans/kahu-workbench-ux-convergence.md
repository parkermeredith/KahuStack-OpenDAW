# Kahu Workbench UX Convergence

Status: **KUX ACTIVE**  
Program: **KUX — Kahu Workbench UX Convergence**  
Date: 2026-10-01  
Repository: `parkermeredith/KahuStack-OpenDAW`  
Starting `main`: `3ac411ccf63c05a2ac8ab51c27f1bdabb5e7cce0`

KUX follows the source-complete KBW v2 and KUI interaction-parity programs. It does not broaden the workbench into a full DAW. It closes the remaining structural UX gap between the Kahu browser host and the openDAW editing/device-panel model while keeping KahuStack DSP, Kahu module manifests, Kahu rack state, Rust/WASM processing, transport semantics, and session state authoritative.

## Goal

The browser workbench must converge on these visible contracts:

1. every audio region renders its own source waveform inside the clip;
2. a track's controls and timeline lane are one logical row and therefore cannot drift vertically;
3. the large timeline load/drop prompt exists only while there are zero active tracks;
4. the processing rack has an openDAW-like working height and can collapse globally;
5. the effect chain is a horizontal retained-device strip with per-device minimize/expand, bypass, reorder, remove, and reset behavior;
6. expanded devices expose all admitted manifest controls;
7. continuous controls use an openDAW-style rotary presentation and relative-drag behavior while Kahu parameter semantics remain manifest-owned;
8. diagnostics/QA information stays secondary to ordinary sound controls;
9. existing KUI timeline range, wheel, ruler, region drag, transport, loop/follow, and session behavior remains intact.

## Authority hierarchy

1. `kahustack-dsp` owns DSP algorithms, module identity, parameter meaning, runtime behavior, latency, analysis and state semantics.
2. openDAW owns the visual/interaction precedent for timeline editing, device chains, device minimization and rotary controls used by this workbench.
3. `packages/app/kahu-testbed` owns only the reduced browser-workbench composition and Kahu-to-openDAW presentation adapters.

Do not import the full openDAW Studio project model merely to obtain interface behavior. Do not add React or another UI framework.

## Source references

Kahu workbench authorities:

- `packages/app/kahu-testbed/src/main.tsx`
- `packages/app/kahu-testbed/src/main.sass`
- `packages/app/kahu-testbed/src/track-store.ts`
- `packages/app/kahu-testbed/src/waveform.ts`
- `packages/app/kahu-testbed/src/timeline/visible-waveform.ts`
- `packages/app/kahu-testbed/src/rack-store.ts`
- `packages/app/kahu-testbed/src/kahu-runtime.ts`
- `packages/app/kahu-testbed/src/parameter-editor.ts`
- `plans/kahu-interaction-parity.md`

openDAW references:

- `packages/app/studio/src/ui/devices/panel/DevicePanel.tsx`
- `packages/app/studio/src/ui/devices/panel/DevicePanel.sass`
- `packages/app/studio/src/ui/devices/panel/DeviceMount.tsx`
- `packages/app/studio/src/ui/devices/DeviceEditor.tsx`
- `packages/app/studio/src/ui/devices/DeviceEditor.sass`
- `packages/app/studio/src/ui/devices/ParameterLabelKnob.tsx`
- `packages/app/studio/src/ui/composite/LabelKnob.tsx`
- `packages/app/studio/src/ui/components/Knob.tsx`

Prior Kahu UX references in the parent DSP repo:

- Browser Host retained rack/device identity
- manifest-driven complete parameter editors
- compact rotary interaction and precise entry/reset behavior
- explicit empty/source lifecycle
- visualization waveform pyramid and viewport-bounded rendering

## Current defects captured by KUX

### D1 — source preview is not the clip

The current workbench renders one global waveform canvas in the source/drop zone. Actual timeline regions are separate and contain only text. Loaded audio therefore shows a waveform above the track instead of inside the region.

### D2 — track controls and lane content can drift

The left track list and right lane list are independent vertical structures. A fixed `track-header-spacer` compensates for unrelated timeline content. This is not DPI-, zoom-, or layout-safe.

### D3 — loaded-state source prompt remains in the timeline

The large `LOAD AUDIO`/status surface remains visible after tracks are active. It should be a zero-track empty state only; the persistent TRACKS add button remains the normal add-source affordance.

### D4 — stale rack presentation after source load

New tracks are selected by the track store, but the load path does not refresh the rack after selection changes, allowing the rack to continue showing the no-selection placeholder.

### D5 — rack is too shallow and not collapsible

The rack is fixed near 11rem while openDAW's Device Panel uses a roughly 248px working height. The rack should provide a real editing surface when open and a compact bar when collapsed.

### D6 — generic rack card is not openDAW-like

The current card uses a vertically scrolling parameter list. It does not use the openDAW device-panel shape, minimized device strip, full expanded control surface, or house rotary control language.

## Program

### KUX-0 — corrective baseline and regression contracts

- record synchronized starting SHA;
- fix stale rack refresh after source load;
- remove impossible cross-column selected-track styling assumptions;
- add focused source tests/structural checks for KUX requirements where practical;
- keep KUI behavior unchanged.

Exit: loaded selected track immediately owns the rack presentation and the source records no known stale-selection path.

### KUX-1 — one track-row authority

Replace the separate left track list/right lane list with one scrollable row composition. Each track row contains:

- fixed-width track controls cell;
- timeline lane cell;
- one shared row-height token;
- one selected state;
- one vertical scroll owner.

Remove `track-header-spacer`, duplicate moving-track structures and `TrackScrollModel` from the Kahu composition when no longer needed.

Exit: track controls N and timeline lane N are the same DOM grid row and cannot drift vertically.

### KUX-2 — region-native waveform rendering

- keep the existing per-track async waveform pyramid;
- create a waveform canvas for each visible region;
- render only the region/range overlap using `projectVisibleWaveform`;
- derive physical canvas height from the region/lane height and DPR;
- redraw on range change, pyramid readiness and resize;
- retain source-offset correctness and viewport-bounded peak extraction.

Exit: every active audio clip visibly contains its source waveform at the current track height.

### KUX-3 — true zero-track empty state

- remove the persistent loaded-state source-preview strip;
- render the large timeline drop/load affordance only when `tracks.length === 0`;
- keep the TRACKS add button and hidden file input available at all times;
- support file drag/drop on the empty timeline state.

Exit: no load prompt overlays or displaces active tracks.

### KUX-4 — rack workspace sizing and global disclosure

- use an expanded rack height aligned with openDAW's Device Panel baseline (approximately 248–280px);
- add a whole-rack collapse/expand action;
- collapsed rack becomes a compact processing header and returns vertical space to the timeline;
- retain selected-track title, bypass-all and add-device actions.

Exit: rack is useful as a device editor when open and unobtrusive when closed.

### KUX-5 — openDAW-style retained device chain

- retain Kahu device IDs/runtimes;
- render the chain horizontally;
- add per-device minimized state keyed by Kahu device ID;
- expanded device has openDAW-style header, enable/bypass, title, menu/action area and full body;
- minimized device becomes a narrow vertical strip;
- preserve reorder/remove/reset behavior and Kahu rack semantics.

Exit: rack lifecycle and visual composition match the openDAW Device Panel model without adopting the openDAW project graph.

### KUX-6 — Kahu adapter for openDAW rotary controls

Implement a Kahu-native rotary adapter using openDAW's knob visual language and relative-drag behavior while consuming `KahuParameterManifest` directly.

Required behavior:

- linear/logarithmic mapping remains Kahu-owned;
- Kahu display units/precision remain authoritative;
- pointer relative drag;
- fine modifier behavior;
- keyboard accessibility;
- double-click reset to manifest default;
- exact numeric entry where practical;
- realtime parameters may update during drag;
- `reprepare` parameters commit on finalization rather than flooding runtime reconstruction.

Boolean and enum parameters remain appropriate discrete controls.

Exit: ordinary continuous device controls are knobs, not slider-like value rows.

### KUX-7 — complete expanded editors and selective disclosure

- every expanded generic Kahu device displays every admitted manifest parameter;
- use compact columns/groups rather than a small vertical scroll list;
- use known Kahu semantic grouping where already defined;
- keep diagnostics, model notes, validation and QA detail secondary to normal controls;
- ensure large parameter sets scroll horizontally with the device chain rather than hiding parameters vertically.

Exit: an expanded device exposes the complete sound-control surface.

### KUX-8 — qualification and closure

Required source gates:

```bash
npm run typecheck:kahu
npm run test:kahu
npm run lint --workspace=@kahustack/opendaw-testbed
npm run build:kahu
npm run check:kahu-runtime
npm run perf:kahu-rack
```

Browser qualification matrix:

- Chrome and Edge;
- Windows display scaling 100%, 125%, 150%;
- 44.1/48/96 kHz contexts where available;
- mono/stereo sources;
- one and multiple tracks;
- one and multiple processors;
- region waveform after zoom/pan/move/source-offset changes;
- track-row alignment through vertical scrolling;
- rack global collapse/expand;
- device minimize/expand;
- bypass/reorder/remove/reset;
- continuous/enum/boolean/reprepare parameters;
- session save/recover;
- dry/processed A/B and trims.

Source completion does not claim owner browser/audio-device qualification. Record unavailable manual gates explicitly rather than implying they passed.

## Atomic commit policy

KUX is implemented directly on `main` as bounded commits. Do not bundle unrelated concerns.

Expected commit sequence:

1. `docs(kahu-ux): start workbench convergence program`
2. `fix(kahu-ux): correct track and rack presentation baseline`
3. `refactor(kahu-timeline): unify track and lane rows`
4. `feat(kahu-waveform): render waveforms inside regions`
5. `feat(kahu-timeline): make audio loader a zero-track state`
6. `feat(kahu-rack): add collapsible device workspace`
7. `refactor(kahu-rack): adopt OpenDAW device chain model`
8. `feat(kahu-controls): add OpenDAW-style Kahu knobs`
9. `feat(kahu-rack): expose complete expanded editors`
10. `docs(kahu-ux): record KUX qualification status`

A phase may share a commit with an inseparable adjacent phase only when splitting it would leave `main` in a knowingly broken intermediate state. The plan must record the actual commit/evidence mapping.

## Progress register

| Phase | Status | Evidence |
| --- | --- | --- |
| KUX-0 | pending | — |
| KUX-1 | pending | — |
| KUX-2 | pending | — |
| KUX-3 | pending | — |
| KUX-4 | pending | — |
| KUX-5 | pending | — |
| KUX-6 | pending | — |
| KUX-7 | pending | — |
| KUX-8 | pending | — |

## End-state invariant

The browser workbench remains a Kahu-native audio engineering host: Kahu owns DSP/runtime/state, openDAW supplies the interaction and presentation precedent, and every visible track/device surface is directly connected to those canonical Kahu contracts rather than maintaining a parallel browser-only DSP model.
