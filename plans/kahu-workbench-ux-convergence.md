# Kahu Workbench UX Convergence

Status: **KUX-0 through KUX-7 SOURCE COMPLETE / KUX-8 OWNER QUALIFICATION PENDING**  
Program: **KUX — Kahu Workbench UX Convergence**  
Date: 2026-10-02  
Repository: `parkermeredith/KahuStack-OpenDAW`  
Starting `main`: `3ac411ccf63c05a2ac8ab51c27f1bdabb5e7cce0`  
Qualified behavior checkpoint: `a8fa94f0f38d1c133eadef7a9484f4ac2f7936ac`

KUX follows the source-complete KBW v2 and KUI interaction-parity programs. It does not broaden the workbench into a full DAW. It closes the remaining structural UX gap between the Kahu browser host and the openDAW editing/device-panel model while keeping KahuStack DSP, Kahu module manifests, Kahu rack state, Rust/WASM processing, transport semantics, and session state authoritative.

The child standalone source gate is green at the qualified behavior checkpoint: OpenDAW package dependencies build, `typecheck:kahu`, `test:kahu`, workspace lint, and `build:kahu` all pass. Parent-built canonical Rust/WASM runtime staging/checks, the consolidated-rack benchmark rerun, and the browser/audio matrix remain owner-run qualification gates. Source completion does not imply those manual/runtime gates passed.

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

- `packages/app/kahu-testbed/src/workbench.tsx`
- `packages/app/kahu-testbed/src/workbench.sass`
- `packages/app/kahu-testbed/src/track-store.ts`
- `packages/app/kahu-testbed/src/waveform.ts`
- `packages/app/kahu-testbed/src/timeline/visible-waveform.ts`
- `packages/app/kahu-testbed/src/rack-store.ts`
- `packages/app/kahu-testbed/src/kahu-runtime.ts`
- `packages/app/kahu-testbed/src/parameter-editor.ts`
- `packages/app/kahu-testbed/src/bypass-policy.ts`
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

The defects below are the baseline defects that motivated KUX. KUX-0 through KUX-7 close them in source; they remain useful regression descriptions.

### D1 — source preview is not the clip

The baseline workbench rendered one global waveform canvas in the source/drop zone. Actual timeline regions were separate and contained only text. Loaded audio therefore showed a waveform above the track instead of inside the region.

### D2 — track controls and lane content can drift

The baseline left track list and right lane list were independent vertical structures. A fixed `track-header-spacer` compensated for unrelated timeline content. This was not DPI-, zoom-, or layout-safe.

### D3 — loaded-state source prompt remains in the timeline

The baseline large `LOAD AUDIO`/status surface remained visible after tracks were active. KUX makes it a zero-track empty state; the persistent TRACKS add button remains the normal add-source affordance.

### D4 — stale rack presentation after source load

The baseline load path could select a newly loaded track without refreshing the rack, allowing the no-selection placeholder to remain stale.

### D5 — rack is too shallow and not collapsible

The baseline rack was fixed near 11rem while openDAW's Device Panel uses a roughly 248px working height. KUX provides a real editing surface when open and a compact collapsed header.

### D6 — generic rack card is not openDAW-like

The baseline card used a vertically scrolling parameter list. KUX adopts the openDAW device-panel shape, minimized device strip, complete expanded control surface, and house rotary control language while retaining Kahu runtime/state authority.

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
- preserve reorder/remove/reset behavior and Kahu rack semantics;
- compose global bypass with persisted per-device bypass so the global state cannot erase or defeat local intent.

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

Standalone child source gates:

```bash
npm run typecheck:kahu
npm run test:kahu
npm run lint --workspace=@kahustack/opendaw-testbed
npm run build:kahu
```

These gates are green at `a8fa94f0f38d1c133eadef7a9484f4ac2f7936ac`. The standalone manifest-contract tests use a deterministic fixture against the pinned parent validator snapshot so a clean child checkout does not falsely require generated runtime assets.

Parent-integration/runtime gates remain owner-run from the canonical `kahustack-dsp` environment, where the Rust/WASM artifact is built and staged:

```bash
npm run build:wasm
# from the child with KAHU_DSP_ROOT pointing at the parent checkout
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
- bypass/reorder/remove/reset, including local bypass persistence across bypass-all on/off;
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

The actual implementation consolidated inseparable row/waveform/rack structural work into `c4626bdf` so `main` did not pass through intentionally broken intermediate layouts. Subsequent commits separate styling cleanup, interaction documentation, rotary scheduling, regression tests, standalone contract/CI hardening, and layered bypass correctness.

## Actual commit/evidence mapping

| Commit | Responsibility |
| --- | --- |
| `8ea4d669` | Start and define the KUX program. |
| `905648b2` | Add the Kahu adapter for openDAW-style rotary controls. |
| `c4626bdf` | Unify track rows, move waveforms into regions, establish zero-track loading, refresh selected-track rack state, expand/collapse the rack, adopt the horizontal retained-device chain, and expose complete expanded editors. |
| `9411a166` | Remove superseded shell styling after the structural convergence. |
| `40b41b72` | Document the resulting workbench interaction model. |
| `0d5e8b09` | Coalesce rotary realtime updates for bounded UI-to-runtime traffic. |
| `ba0bd0c7` | Lock row and rotary contracts with permanent tests. |
| `a5a17d1f` | Promote the KUX workbench identity. |
| `47c8f02f` | Make canonical manifest contract tests standalone and deterministic without generated runtime assets. |
| `d8c5cdb` | Separate the reproducible child source gate from parent-built runtime qualification. |
| `5b1496f` | Define the global/local layered bypass invariant. |
| `a8fa94f` | Apply layered bypass composition to device mutation, runtime initialization, and bypass-all restoration. |

## Progress register

| Phase | Status | Evidence |
| --- | --- | --- |
| KUX-0 | **SOURCE COMPLETE / OWNER VALIDATION PENDING** | `c4626bdf`, `ba0bd0c7` |
| KUX-1 | **SOURCE COMPLETE / OWNER VALIDATION PENDING** | `c4626bdf`, `9411a166`, `ba0bd0c7` |
| KUX-2 | **SOURCE COMPLETE / OWNER VALIDATION PENDING** | `c4626bdf` |
| KUX-3 | **SOURCE COMPLETE / OWNER VALIDATION PENDING** | `c4626bdf` |
| KUX-4 | **SOURCE COMPLETE / OWNER VALIDATION PENDING** | `c4626bdf` |
| KUX-5 | **SOURCE COMPLETE / OWNER VALIDATION PENDING** | `c4626bdf`, `5b1496f`, `a8fa94f` |
| KUX-6 | **SOURCE COMPLETE / OWNER VALIDATION PENDING** | `905648b2`, `0d5e8b09`, `ba0bd0c7` |
| KUX-7 | **SOURCE COMPLETE / OWNER VALIDATION PENDING** | `c4626bdf` |
| KUX-8 | **CHILD SOURCE GATES COMPLETE / OWNER PARENT-RUNTIME + BROWSER/AUDIO QUALIFICATION PENDING** | green source gate at `a8fa94f`; parent-built runtime check/benchmark and manual matrix remain pending |

## End-state invariant

The browser workbench remains a Kahu-native audio engineering host: Kahu owns DSP/runtime/state, openDAW supplies the interaction and presentation precedent, and every visible track/device surface is directly connected to those canonical Kahu contracts rather than maintaining a parallel browser-only DSP model.
