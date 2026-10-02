# Kahu Interaction Parity — OpenDAW Timeline and Control Convergence Plan

Status: **KUI-1 SOURCE COMPLETE / KUI-2 IMPLEMENTATION IN PROGRESS**  
Program: **KUI — Kahu UI Interaction Parity**  
Date: 2026-10-01  
Repository: `parkermeredith/KahuStack-OpenDAW`  
Plan baseline: child `f16ea8872fa7f5e36f15db2326ff8255634e91b4`, parent `parkermeredith/kahustack-dsp` `27cd36e65f9a22be2cf684b34e9c0f8c950b0019`

This plan follows the KBW v2 source program in `plans/kahustack-dsp-testbed.md`.

The objective is not to add more DAW features. The objective is to make the Kahu browser workbench use the same timeline navigation and control interaction model as openDAW wherever Kahu needs an equivalent control, while keeping Kahu's DSP/runtime/session semantics authoritative.

The workbench should feel like a reduced openDAW engineering surface, not a custom DAW that merely uses openDAW colors.

## KUI-0 evidence — synchronized baseline and parity inventory

The required pre-change synchronization was completed on 2026-10-01.

```text
parent starting HEAD: 27cd36e65f9a22be2cf684b34e9c0f8c950b0019
child starting HEAD:  f16ea8872fa7f5e36f15db2326ff8255634e91b4
parent main == origin/main: yes
child main == origin/main: yes
parent worktree: clean
child worktree: clean
parent submodule pin: f16ea8872fa7f5e36f15db2326ff8255634e91b4
```

The current Kahu baseline was run before implementation. All required commands passed:

| Command | Result |
| --- | --- |
| `npm run typecheck:kahu` | PASS |
| `npm run test:kahu` | PASS — 10 files / 33 tests |
| `npm run build:kahu` | PASS |
| `npm run check:kahu-runtime` | PASS — 44 modules, 1,471,242-byte WASM artifact |
| `npm run perf:kahu-rack` | PASS — KBW-8 Node/WASM comparison emitted |

The current visible-control inventory is the implementation contract for KUI-9:

| Visible control | Current Kahu implementation | openDAW reference | Final Kahu interaction | Phase |
| --- | --- | --- | --- | --- |
| Play/pause | Unicode button in `main.tsx` | `TransportGroup.tsx`, `Button.tsx`, `Icon.tsx` | persistent openDAW-style icon button; Space | KUI-8/9 |
| Stop | Unicode button in `main.tsx` | `TransportGroup.tsx`, `Button.tsx`, `Icon.tsx` | icon button; Period | KUI-8/9 |
| Loop | absent | `TransportGroup.tsx`, `Checkbox.tsx` | persistent real transport toggle; Shift+L | KUI-8/9 |
| Follow | absent | `TimelineHeader.tsx`, `Checkbox.tsx` | persistent range-follow toggle; Shift+F | KUI-8/9 |
| Time readout | spans in `main.tsx` | `TimeStateDisplay.tsx` | range-independent transport readout | KUI-8 |
| Typed position | native number input | `ParameterLabel.tsx`, value controls | precision number input; keyboard-safe | KUI-8/9 |
| Region start | native number input | `RegionsArea.tsx`, `RegionMoveModifier.ts` | inspector precision field plus direct body drag | KUI-7 |
| Source offset | native number input | region content timing precedent | inspector precision field; preserved during body drag | KUI-7 |
| Current zoom | native `.zoom-control` range input and `waveformZoom` | `TimelineRange.ts`, `TimelineRangeSlider.tsx` | shared `TimelineRange` plus range navigator | KUI-1/4 |
| Current seek | native `.seek-slider` range input and canvas click | `TimeAxis.tsx` | dynamic ruler scrub; typed position remains precision path | KUI-3 |
| Track mute | text `M` button | `IconSymbol.Mute`, `Checkbox.tsx` | persistent icon toggle | KUI-9 |
| Track solo | text `S` button | `IconSymbol.Solo`, `Checkbox.tsx` | persistent icon toggle | KUI-9 |
| Track gain | native range input | `ParameterLabelKnob.tsx`, `RelativeUnitValueDragging.tsx` | compact value drag with Kahu gain semantics | KUI-9 |
| Add/remove track | `+` and `×` buttons | `Button.tsx`, `IconSymbol.Add/Close` | icon buttons | KUI-9 |
| Processor add | select plus `ADD SLOT` | `Button.tsx`, device controls | compact selector plus action button | KUI-9 |
| Processor bypass | text `BYP` button | `Checkbox.tsx`, `IconSymbol.Bypass` equivalent if available | persistent toggle | KUI-9 |
| Processor reset | text `RST` button | `Button.tsx`, `IconSymbol.Reset` equivalent if available | action button | KUI-9 |
| Processor reorder | text chevrons | `Button.tsx`, `IconSymbol.ArrowLeft/ArrowRight` | icon action buttons | KUI-9 |
| Processor remove | text `×` button | `Button.tsx`, `IconSymbol.Close` | icon action button | KUI-9 |
| Parameter continuous | native range input | `ParameterLabel.tsx`, `ParameterLabelKnob.tsx` | value drag/label; manifest mapping unchanged | KUI-9 |
| Parameter boolean | native checkbox | `Checkbox.tsx` | openDAW-style persistent toggle | KUI-9 |
| Parameter enum | native select | compact device selector precedent | discrete selector; manifest enum mapping unchanged | KUI-9 |
| Input trim | native footer range input | value dragging precedent | compact value control; dB semantics unchanged | KUI-9 |
| Output trim | native footer range input | value dragging precedent | compact value control; dB semantics unchanged | KUI-9 |
| Bypass all | text button | `Checkbox.tsx` / `Button.tsx` | persistent toggle/action with active state | KUI-9 |
| A/B compare | text `PROC`/`DRY` button | `Checkbox.tsx` | persistent binary toggle | KUI-9 |

KUI-0 is documentation-only. No runtime or interaction behavior is considered complete from this
inventory; owner browser qualification remains pending.

KUI-1 implementation evidence: `TimelineController` owns one published `TimelineRange` configured
in seconds with a 0.05-second minimum. Kahu region, playhead, seek, and selected-waveform geometry
now consume that range; the enlarged DOM strip and native horizontal scrollbar are no longer the
viewport authority. The old `TimelineViewport` source and test were removed after the new focused
range tests passed. Legacy `zoom`/`scrollFraction` conversion is retained only at the existing
session boundary until KUI-7 performs the versioned normalized-range migration.

---

## 1. Non-negotiable implementation rule

Before implementing any Kahu timeline/navigation/control behavior, inspect the corresponding openDAW source already present in this repository.

If openDAW already solves the interaction, reuse its published package directly or copy/adapt the smallest app-level implementation needed inside `packages/app/kahu-testbed/`.

Do **not** invent another behavior merely because the Kahu version is smaller.

The source hierarchy is:

1. KahuStack DSP parent repository owns DSP, module IDs, parameter meaning, runtime behavior and state semantics.
2. openDAW owns interaction precedent for DAW-style navigation and controls used by this workbench.
3. `@kahustack/opendaw-testbed` owns only the reduced composition required for audio tracks + Kahu FX racks.

Do not import full Studio merely to obtain a control.

Do not add React, Vue, Svelte, Tailwind or another UI framework.

Do not implement recording, MIDI, piano roll, automation lanes, clip launcher, instruments, full mixer, cloud project features or long-form streaming audio.

Long-form streaming remains explicitly deferred.

---

## 2. Required starting procedure

Before changing source:

1. fetch/synchronize actual `main`;
2. record the starting SHA;
3. confirm the worktree is clean;
4. read `plans/kahustack-dsp-testbed.md`;
5. read this file completely;
6. inspect every current Kahu file listed in section 4;
7. inspect every openDAW reference file listed in section 5;
8. run the existing Kahu baseline commands;
9. record baseline results before implementation.

Required baseline commands:

```bash
npm run typecheck:kahu
npm run test:kahu
npm run build:kahu
npm run check:kahu-runtime
npm run perf:kahu-rack
```

Do not begin UI refactoring until the existing baseline is recorded.

---

## 3. Target end state

The Kahu workbench timeline must use one shared visible-range authority for:

- ruler;
- waveform viewport;
- region geometry;
- playhead geometry;
- click/drag seeking;
- wheel zoom;
- horizontal pan;
- range navigator;
- follow-playhead behavior;
- persisted viewport state.

The desired interaction contract is:

```text
Space                 play / pause
Period                stop
Left Arrow            move playback position backward
Right Arrow           move playback position forward
Shift + L             toggle loop
Shift + F             toggle follow playhead

Shift + wheel         pointer-anchored horizontal zoom
Alt + wheel           horizontal timeline pan
horizontal trackpad   horizontal timeline pan
vertical wheel        vertical track scroll when track area can scroll

ruler pointer drag    scrub / seek
range slider center   pan visible interval
range slider left     resize visible interval from left
range slider right    resize visible interval from right
double-click slider   show complete timeline

click region          select region / track
drag region body      change region timeline start
drag near viewport    horizontal auto-scroll while moving region
```

The transport must remain sample-clock based as established by KBW-3.

The Kahu DSP rack/runtime architecture must not be changed by this program except where UI bindings require adaptation.

---

## 4. Current Kahu files that MUST be inspected before implementation

These are the current implementation authorities that this program modifies or protects.

### Application composition

- `packages/app/kahu-testbed/src/main.tsx`
- `packages/app/kahu-testbed/src/main.sass`
- `packages/app/kahu-testbed/src/shell.ts`
- `packages/app/kahu-testbed/src/shell.test.ts`

### Current timeline/navigation model

- `packages/app/kahu-testbed/src/timeline.ts`
- `packages/app/kahu-testbed/src/timeline.test.ts`
- `packages/app/kahu-testbed/src/transport.ts`
- `packages/app/kahu-testbed/src/transport.test.ts`
- `packages/app/kahu-testbed/src/region.ts`
- `packages/app/kahu-testbed/src/region.test.ts`

### Track/source model

- `packages/app/kahu-testbed/src/track-store.ts`
- `packages/app/kahu-testbed/src/track-store.test.ts`
- `packages/app/kahu-testbed/src/audio-track.ts`

### Waveform model

- `packages/app/kahu-testbed/src/waveform.ts`
- `packages/app/kahu-testbed/src/waveform-worker.ts`
- `packages/app/kahu-testbed/src/waveform.test.ts`

### Session state

- `packages/app/kahu-testbed/src/session-store.ts`
- `packages/app/kahu-testbed/src/session-store.test.ts`

### Rack/control model

- `packages/app/kahu-testbed/src/parameter-editor.ts`
- `packages/app/kahu-testbed/src/parameter-editor.test.ts`
- `packages/app/kahu-testbed/src/rack-store.ts`
- `packages/app/kahu-testbed/src/rack-store.test.ts`
- `packages/app/kahu-testbed/src/kahu-runtime.ts`

### Package/build boundaries

- `packages/app/kahu-testbed/package.json`
- root `package.json`
- `scripts/build-kahu-worklet.mjs`
- `scripts/stage-kahu-runtime.mjs`

Do not replace Kahu DSP/runtime code while doing UI parity work.

---

## 5. Exact openDAW source files to use as reference or extraction source

The coding agent must read these files before implementing the corresponding KUI phase.

### 5.1 Shared horizontal timeline range

Primary source:

- `packages/studio/core/src/ui/timeline/TimelineRange.ts`

Use this implementation directly from `@opendaw/studio-core`.

Do **not** write another Kahu range class.

`TimelineRange` becomes the Kahu timeline viewport authority.

Kahu uses **seconds** as `TimelineRange` units.

Required configuration:

```ts
range.maxUnits = transportDurationSeconds
range.minimum = 0.05
```

The range's normalized `min` and `max` values are the session-persisted viewport representation.

### 5.2 Wheel zoom normalization

Source:

- `packages/app/studio/src/ui/timeline/WheelScaling.ts`

Destination:

- `packages/app/kahu-testbed/src/timeline/wheel-scaling.ts`

Copy the implementation and preserve:

- `DeltaModeToPixels = [1.0, 33.0, 400.0]`;
- `QuantumFloor = 2.0`;
- `QuantumDecayMs = 300.0`;
- `StepPerTick = 0.1`;
- recent-wheel-magnitude calibration;
- pointer-position anchoring;
- clamping anchor into the visible range;
- non-passive wheel event behavior.

Allowed adaptation:

`WheelScaling.ts` reads `StudioPreferences.settings.pointer["wheel-zoom-speed"]`. The Kahu workbench does not need the full Studio preference service during this program. Replace that single dependency with:

```ts
const speed = 1.0
```

Do not change the remaining wheel math.

### 5.3 Horizontal wheel / trackpad pan

Source:

- `packages/app/studio/src/ui/timeline/editors/WheelScroll.ts`

Destination:

- `packages/app/kahu-testbed/src/timeline/wheel-scroll.ts`

Copy/adapt this file and retain the openDAW contract exactly:

- Shift + wheel -> `WheelScaling.apply(...)`;
- Alt + wheel -> pixel-based horizontal move;
- non-trivial `deltaX` -> horizontal range movement;
- `preventDefault()` only when the timeline consumes the gesture.

Do not use browser `scrollLeft` as the canonical timeline position after this phase.

### 5.4 Timeline overview/range navigator

Primary source:

- `packages/app/studio/src/ui/timeline/TimelineRangeSlider.tsx`
- `packages/app/studio/src/ui/timeline/TimelineRangeSlider.sass`

Supporting source:

- `packages/app/studio/src/ui/hooks/dragging.ts`

Destination files:

- `packages/app/kahu-testbed/src/timeline/timeline-range-slider.tsx`
- `packages/app/kahu-testbed/src/timeline/timeline-range-slider.sass`
- `packages/app/kahu-testbed/src/ui/value-dragging.ts`

Copy `ValueDragging.installUnitValueRelativeDragging` from `ui/hooks/dragging.ts` into the local Kahu helper with only import-path changes.

Copy `TimelineRangeSlider` behavior with these exact semantics:

- left handle edits `range.min`;
- right handle edits `range.max`;
- center edits `range.center`;
- click elsewhere repositions the center;
- double-click calls `range.showAll()`;
- normalized range remains clamped by the `TimelineRange`/`Range` authority.

The Kahu range slider must replace the current raw `<input type="range">` timeline zoom control.

Do not retain both as competing primary navigation systems.

### 5.5 Timeline navigation composition

Reference:

- `packages/app/studio/src/ui/timeline/TimelineNavigation.tsx`
- `packages/app/studio/src/ui/timeline/TimelineNavigation.sass`

Kahu destination:

- `packages/app/kahu-testbed/src/timeline/timeline-navigation.tsx`
- `packages/app/kahu-testbed/src/timeline/timeline-navigation.sass`

The Kahu navigation strip contains:

1. Kahu time axis/ruler;
2. optional Kahu loop strip after loop implementation;
3. no unrelated Studio primary tracks.

Keep the openDAW compact two-row visual language where useful.

### 5.6 Time axis / ruler / scrub interaction

Primary source:

- `packages/app/studio/src/ui/timeline/TimeAxis.tsx`
- `packages/app/studio/src/ui/timeline/TimeAxis.sass`

Kahu destination:

- `packages/app/kahu-testbed/src/timeline/time-axis.tsx`
- `packages/app/kahu-testbed/src/timeline/time-axis.sass`

Do NOT port signature-track/PPQN/project-duration behavior.

Do copy the interaction structure:

- canvas-based ruler;
- range width set from element resize;
- range subscription invalidates/repaints ruler;
- playhead/cursor uses `range.unitToX(positionSeconds)`;
- cursor hidden when outside visible interval;
- pointer dragging scrubs transport;
- wheel zoom installed on ruler;
- cursor follows visible range math rather than total-duration percentages.

Kahu tick generation is seconds-based and must use the following fixed interval table:

```ts
const TickIntervalsSeconds = [
    0.01, 0.02, 0.05,
    0.1, 0.2, 0.5,
    1, 2, 5, 10, 15, 30,
    60, 120, 300, 600
]
```

Tick selection algorithm:

```text
target major spacing = 80 CSS pixels
ideal interval = visibleDurationSeconds / (canvasWidth / 80)
choose first TickIntervalsSeconds value >= ideal interval
if no value qualifies, use final value
```

Label formatting:

- interval < 1 second -> `m:ss.SS`;
- interval >= 1 second and < 60 seconds -> `m:ss`;
- interval >= 60 seconds -> `h:mm:ss` when hour > 0, otherwise `m:ss`.

Minor ticks:

- major interval >= 1 second -> 4 subdivisions;
- major interval < 1 second -> 5 subdivisions.

Do not retain the static `1 2 3 4 5 6 7 8` ruler.

### 5.7 Follow-playhead behavior

Primary source:

- `packages/app/studio/src/ui/timeline/Timeline.tsx`
- `packages/app/studio/src/ui/timeline/TimelineHeader.tsx`

Kahu destination:

- implement range-follow logic in `packages/app/kahu-testbed/src/timeline/timeline-controller.ts`;
- expose the toggle through `packages/app/kahu-testbed/src/timeline/timeline-toolbar.tsx`.

Copy openDAW's page-follow contract:

- if follow becomes enabled and playhead is outside the current range, move range to the playback position;
- while following, if playback crosses the right range boundary, move right by exactly one current visible range length;
- if playback crosses the left range boundary, move left by exactly one current visible range length;
- disable automatic range movement while a region drag modifier is active.

Default Kahu follow state: `false`.

Shortcut: `Shift + F`.

### 5.8 Fixed track headers and vertical scroll

Primary openDAW references:

- `packages/app/studio/src/ui/timeline/tracks/audio-unit/AudioUnitsTimeline.tsx`
- `packages/app/studio/src/ui/timeline/tracks/audio-unit/headers/HeadersArea.tsx`
- `packages/app/studio/src/ui/components/ScrollModel.ts`
- `packages/app/studio/src/ui/components/Scroller.tsx`

Kahu destination:

- `packages/app/kahu-testbed/src/timeline/track-headers.tsx`
- `packages/app/kahu-testbed/src/timeline/track-lanes.tsx`
- `packages/app/kahu-testbed/src/timeline/track-scroll.ts`

Required layout:

```text
+----------------------+------------------------------------------+
| fixed track headers  | horizontally navigable timeline         |
+----------------------+------------------------------------------+
| Vocal  [M] [S] gain  | [ waveform region..................... ] |
| Gtr    [M] [S] gain  |      [ waveform region............... ] |
| Drums  [M] [S] gain  | [ waveform region..................... ] |
+----------------------+------------------------------------------+
|                      | TimelineRangeSlider                      |
+----------------------+------------------------------------------+
```

Remove duplicate track-name rendering inside horizontally moving content.

There must be one track header row per Kahu track.

Headers and lanes share one vertical scroll position.

Horizontal range movement affects only the timeline/ruler/regions/waveforms, never the header column.

### 5.9 Region selection and drag

Primary references:

- `packages/app/studio/src/ui/timeline/tracks/audio-unit/regions/RegionsArea.tsx`
- `packages/app/studio/src/ui/timeline/tracks/audio-unit/regions/RegionMoveModifier.ts`
- `packages/app/studio/src/ui/AutoScroll.ts`
- `@opendaw/lib-dom` `Dragging`

Kahu destination:

- `packages/app/kahu-testbed/src/timeline/region-lane.tsx`
- `packages/app/kahu-testbed/src/timeline/region-drag.ts`

Only port the subset Kahu needs:

- click region -> select containing track;
- drag region body -> update `track.region.timelineStartSeconds`;
- maintain the source offset while moving a region;
- clamp region timeline start to `>= 0`;
- use `TimelineRange.xToUnit()` for pointer-to-time conversion;
- install horizontal auto-scroll while dragging near viewport edges;
- cancel restores original start;
- approve commits final start and session state.

Do NOT port:

- cutting;
- fades;
- loop-duration editing;
- region resize;
- content start handles;
- multi-region selection;
- snapping menus;
- overlap resolver;
- clipboard region editing.

The existing numeric START and SOURCE OFFSET fields may remain as precision inspector controls, but direct region dragging becomes the primary timing interaction.

### 5.10 Browser overscroll protection

Source:

- `packages/app/studio/src/main.sass`

Destination:

- `packages/app/kahu-testbed/src/main.sass`

Add:

```sass
html, body
  overscroll-behavior: none
```

This prevents Chromium horizontal history-swipe navigation while using the timeline.

### 5.11 Transport control behavior

Primary openDAW references:

- `packages/app/studio/src/ui/header/TransportGroup.tsx`
- `packages/app/studio/src/ui/header/TransportGroup.sass`
- `packages/app/studio/src/ui/shortcuts/GlobalShortcuts.ts`
- `packages/app/studio/src/ui/shortcuts/CommonShortcuts.ts`
- `packages/app/studio/src/service/StudioShortcutManager.ts`

Kahu keeps only:

- play/pause;
- stop;
- loop;
- follow cursor.

Do not port record/count-in/metronome.

Required shortcut contract:

```text
Space       play / pause
Period      stop
ArrowLeft   position decrement
ArrowRight  position increment
Shift+L     toggle loop
Shift+F     toggle follow
```

Arrow movement amount is exactly:

```text
max(0.01 seconds, visibleRangeDuration / 100)
```

Holding Left/Right may repeat.

Loop implementation is Kahu-local transport behavior but must follow openDAW interaction presentation.

Kahu loop model:

```ts
{
  enabled: boolean,
  startSeconds: number,
  endSeconds: number
}
```

Initial loop range after first audio load:

```text
startSeconds = 0
endSeconds = transport duration
```

When enabled and playback crosses `endSeconds`, reschedule all tracks at `startSeconds` from one shared transport epoch.

The loop control is a toggle, not a momentary button.

### 5.12 Button / checkbox / icon presentation

Primary sources:

- `packages/app/studio/src/ui/components/Button.tsx`
- `packages/app/studio/src/ui/components/Checkbox.tsx`
- `packages/app/studio/src/ui/components/ButtonCheckboxRadio.tsx`
- `packages/app/studio/src/ui/components/ButtonCheckboxRadio.sass`
- `packages/app/studio/src/ui/components/Icon.tsx`
- package `@opendaw/studio-icons`

Do not import Studio app-private files through `@/...` aliases from the Kahu app.

Instead create:

- `packages/app/kahu-testbed/src/ui/opendaw-button.tsx`
- `packages/app/kahu-testbed/src/ui/opendaw-checkbox.tsx`
- `packages/app/kahu-testbed/src/ui/opendaw-control.sass`

These are reduced extractions of the openDAW control behavior.

Use `Icon` directly from `@opendaw/studio-icons`.

Required Kahu control behavior:

- pointerdown prevents text selection;
- active state uses openDAW color variables;
- disabled state opacity and pointer behavior match `ButtonCheckboxRadio.sass`;
- toggle controls are actual persistent state, not CSS-only active classes;
- visible text/Unicode play symbols are replaced with openDAW icons where a matching `IconSymbol` exists.

### 5.13 Parameter/control interaction references

Kahu parameter semantics remain driven by `parameter-editor.ts` and the parent manifest.

For interaction/presentation, inspect:

- `packages/app/studio/src/ui/components/ParameterLabel.tsx`
- `packages/app/studio/src/ui/components/ParameterLabel.sass`
- `packages/app/studio/src/ui/components/Knob.tsx`
- `packages/app/studio/src/ui/components/Knob.sass`
- `packages/app/studio/src/ui/devices/ParameterLabelKnob.tsx`
- `packages/app/studio/src/ui/wrapper/RelativeUnitValueDragging.tsx`
- `packages/app/studio/src/ui/devices/ControlGroup.tsx`

Do not adopt openDAW parameter adapters; Kahu manifest semantics remain authoritative.

Required generic Kahu mapping after this pass:

```text
boolean            -> openDAW-style checkbox/toggle
enum               -> compact openDAW-style discrete selector presentation
continuous linear  -> openDAW-style compact value control with drag/value label
continuous log     -> same UI, Kahu logarithmic mapping retained
continuous dB      -> same UI, Kahu dB formatting retained
```

Primary rule: no browser-native `<input type="range">` should remain as a major visible Kahu control after KUI closure unless there is no openDAW-equivalent interaction and the exception is documented.

Do not change Kahu's value conversion, formatting, reprepare policy or transition semantics.

---

## 6. Package dependency changes

Update:

`packages/app/kahu-testbed/package.json`

Add these workspace dependencies because KUI uses them directly:

```json
{
  "@opendaw/lib-dom": "^0.0.91",
  "@opendaw/lib-std": "^0.0.86",
  "@opendaw/studio-core": "^0.2.7",
  "@opendaw/studio-icons": "^0.0.3"
}
```

Keep existing:

- `@opendaw/lib-jsx`;
- `@opendaw/studio-enums`.

Do not add `@opendaw/app-studio` as a dependency.

Do not import the whole Studio application.

If package versions have advanced on actual `main`, use the versions already present in the root workspace lockfile for those same packages instead of forcing these baseline numbers.

---

## 7. File structure required after KUI

The timeline-specific code should converge to:

```text
packages/app/kahu-testbed/src/
  timeline/
    timeline-controller.ts
    timeline-navigation.tsx
    timeline-navigation.sass
    time-axis.tsx
    time-axis.sass
    timeline-range-slider.tsx
    timeline-range-slider.sass
    wheel-scaling.ts
    wheel-scroll.ts
    track-headers.tsx
    track-lanes.tsx
    track-scroll.ts
    region-lane.tsx
    region-drag.ts
    timeline-controller.test.ts
    wheel-scaling.test.ts
    timeline-range-slider.test.ts
    region-drag.test.ts
  ui/
    value-dragging.ts
    opendaw-button.tsx
    opendaw-checkbox.tsx
    opendaw-control.sass
```

The old flat file:

- `packages/app/kahu-testbed/src/timeline.ts`

must be deleted after all callers/tests migrate to `TimelineRange`.

`timeline.test.ts` must be deleted or rewritten into the new focused test files. Do not leave two viewport authorities.

---

## 8. KUI phase program

## KUI-0 — Baseline + parity inventory

Read all files in sections 4 and 5.

Create a checked-in parity table in this document or a companion validation document containing every current visible Kahu control.

Inventory at minimum:

- play/pause;
- stop;
- time readout;
- typed position;
- region start;
- source offset;
- current zoom slider;
- current seek slider;
- track mute;
- track solo;
- track gain;
- add/remove track;
- processor add;
- processor bypass;
- processor reset;
- processor reorder;
- processor remove;
- parameter continuous control;
- boolean control;
- enum control;
- input trim;
- output trim;
- bypass all;
- A/B compare.

For every item record:

```text
current Kahu implementation
openDAW reference file
final Kahu interaction
implementation phase
```

No behavioral implementation in KUI-0.

Commit:

`docs(kahu-ui): inventory OpenDAW interaction parity`

## KUI-1 — Adopt `TimelineRange`

Add required package dependencies.

Create one application-level `TimelineRange` instance.

Replace `TimelineViewport` usage in `main.tsx`.

Set:

```ts
range.maxUnits = transport duration seconds
range.minimum = 0.05
```

All new geometry must use:

```text
range.unitMin
range.unitMax
range.unitRange
range.unitToX()
range.xToUnit()
range.unitsPerPixel
```

Remove percentage-based playhead/region positioning from the canonical path.

Do not delete `timeline.ts` until KUI-1 tests pass and all consumers migrate.

Session viewport migration is completed in KUI-7.

Commit:

`refactor(kahu-timeline): adopt OpenDAW timeline range authority`

## KUI-2 — Port openDAW wheel navigation

Create:

- `timeline/wheel-scaling.ts`;
- `timeline/wheel-scroll.ts`.

Install navigation on:

- time axis;
- track region surface;
- waveform/timeline body.

Required tests:

1. deltaMode 0/1/2 converts using 1/33/400 pixel factors;
2. zero delta returns zero scale;
3. zoom anchor is clamped into range;
4. repeated trackpad deltas remain fractional;
5. shift wheel changes range length while keeping pointer unit approximately fixed;
6. alt wheel moves horizontal range;
7. horizontal delta moves horizontal range;
8. consumed events call `preventDefault`.

Commit:

`feat(kahu-timeline): port OpenDAW wheel navigation`

## KUI-3 — Replace static ruler and seek slider

Create Kahu `TimeAxis` using section 5.6.

Remove from `main.tsx` / `main.sass`:

- static `ruler` containing fixed 1..8 labels;
- bottom `.seek-slider` as primary timeline seek control.

Ruler drag becomes the canonical scrub/seek interaction.

Typed position input may remain as a precision control.

Required tests:

- tick interval selection;
- seconds formatting;
- x -> seconds mapping;
- position -> x mapping;
- cursor hidden outside range;
- scrub clamps at >= 0;
- scrub while playing reschedules through existing shared transport epoch path.

Commit:

`feat(kahu-timeline): adopt OpenDAW-style time axis and scrub`

## KUI-4 — Replace zoom slider/native horizontal scroll with range navigator

Create Kahu `TimelineRangeSlider` from openDAW source.

Remove:

- `.zoom-control` raw range input;
- `waveformZoom` as separate range authority;
- `timelineScroll.scrollLeft` as canonical viewport state;
- `timelineContent.style.width = zoom * 100%` model.

The timeline body becomes a clipped fixed viewport driven by range coordinate transforms, not a physically enlarged DOM strip.

Range slider becomes the explicit overview navigator.

Double-click -> `range.showAll()`.

Required tests:

- left handle modifies only min;
- right handle modifies only max;
- center drag preserves length;
- click re-centers;
- double-click shows all;
- min/max never become non-finite;
- zero-width layout cannot produce NaN.

Commit:

`feat(kahu-timeline): add OpenDAW range navigator`

## KUI-5 — Fix waveform/ruler/region/playhead alignment

Update waveform rendering so visible PCM extraction is derived from the same `TimelineRange`.

For each track:

```text
visibleTimelineStart = range.unitMin
visibleTimelineEnd = range.unitMax
regionTimelineStart = track.region.timelineStartSeconds
sourceOffset = track.region.sourceOffsetSeconds
```

Convert visible timeline interval to source interval:

```text
sourceStart = sourceOffset + max(0, visibleTimelineStart - regionTimelineStart)
sourceEnd = sourceOffset + min(regionDuration, visibleTimelineEnd - regionTimelineStart)
```

Convert source seconds to sample frames with the source sample rate before calling waveform peak extraction.

Do not always extract waveform starting at sample zero.

Draw each region from `range.unitToX(regionStart)` to `range.unitToX(regionEnd)`.

Draw playhead from `range.unitToX(transportPosition)`.

Required permanent alignment test matrix:

```text
zoom/show all
zoom around center
zoom around pointer at 25%
pan left
pan right
region begins before viewport
region begins inside viewport
region ends inside viewport
region spans complete viewport
source offset > 0
```

For every case assert ruler, region and waveform calculations refer to the same time interval.

Commit:

`fix(kahu-timeline): unify waveform and playhead range mapping`

## KUI-6 — Fixed headers + clean track lanes

Split current timeline row rendering into fixed header and timeline body components.

Remove duplicate timeline track-name column.

Use one vertical scroll model for headers + region lanes.

Track header contains only Kahu-needed controls:

- track name;
- mute;
- solo;
- gain;
- remove.

Do not add openDAW recording/input-monitor/freeze controls.

Selection styling must be synchronized across header and lane.

Horizontal navigation may never move the header column.

Commit:

`refactor(kahu-timeline): align fixed headers with OpenDAW lanes`

## KUI-7 — Direct region manipulation + session migration

Add region body drag.

Keep numeric timing fields only for precise entry.

Upgrade session viewport format from KBW v2 `zoom + scrollFraction` to normalized range state:

```ts
viewport: {
  min: number,
  max: number
}
```

Bump session schema version.

Migration from old state is exact:

```ts
length = 1 / clamp(old.zoom, 1, 8)
min = clamp(old.scrollFraction, 0, 1) * (1 - length)
max = min + length
```

Clamp migrated min/max to `[0, 1]` and ensure `max > min`.

This normalized representation restores before local source audio is reselected.

Required tests:

- move region right;
- move region left;
- clamp at zero;
- cancel drag restores original;
- source offset unchanged;
- auto-scroll changes range during edge drag;
- session v2 -> v3 migration;
- v3 round trip.

Commit:

`feat(kahu-timeline): add region dragging and range session state`

## KUI-8 — Transport interaction parity

Add openDAW-style controls/icons for:

- play/pause;
- stop;
- loop;
- follow.

Implement shortcuts exactly as section 5.11.

Retain Kahu sample-clock epoch scheduling.

Add loop state to session persistence.

Add follow state to session persistence.

Required tests:

- Space toggles playback;
- Period stops and returns according to existing Kahu stop contract;
- Left/Right move by visibleRange/100 with 10ms floor;
- Shift+L toggles loop;
- playback crossing loop end schedules from loop start;
- Shift+F toggles follow;
- follow pages by exactly one visible range length when crossing boundary.

Commit:

`feat(kahu-transport): match OpenDAW transport interactions`

## KUI-9 — General control harmonization

Audit every Kahu-visible control from KUI-0.

Replace custom visual/interaction substitutes with the extracted openDAW-style control primitives where applicable.

Required mappings:

```text
momentary action   -> OpenDAW-style button
toggle state       -> OpenDAW-style checkbox/toggle
continuous value   -> OpenDAW-style value drag/label control
enum               -> compact discrete selector matching openDAW device controls
icon action        -> @opendaw/studio-icons icon
```

Do not change the Kahu manifest-driven type mapping.

Do not change DSP parameter value conversion.

Specific control targets:

### Track controls

- mute -> toggle;
- solo -> toggle;
- remove -> icon button;
- gain -> compact continuous value control.

### Rack controls

- add processor -> button;
- bypass -> toggle;
- reset -> button;
- move left/right -> icon buttons if drag reorder is not implemented;
- remove -> icon button;
- module selection -> compact discrete selector.

### Global engineering controls

- input trim -> continuous value control;
- output trim -> continuous value control;
- bypass all -> toggle;
- A/B dry/processed -> persistent binary toggle.

### Manifest parameter controls

- boolean -> toggle;
- enum -> discrete selector;
- continuous -> value label + drag control;
- retain canonical Kahu formatted display.

Any remaining raw browser-native visible range/select/button control must be listed in the KUI closure report with an explicit reason.

Commit:

`refactor(kahu-ui): converge controls on OpenDAW interactions`

## KUI-10 — Cleanup, regression closure and documentation

Delete obsolete timeline code only after all replacement paths are active and validated.

Expected removals/refactors:

- `src/timeline.ts` removed;
- old `timeline.test.ts` removed/replaced;
- `waveformZoom` removed;
- `timelineScroll` canonical state removed;
- `timelineContent` zoom-width model removed;
- `.zoom-control` removed;
- `.seek-slider` removed;
- static `.ruler` grid removed;
- duplicate timeline track-label column removed;
- Unicode transport glyphs removed when openDAW icons exist.

Run:

```bash
npm run typecheck:kahu
npm run test:kahu
npm run build:kahu
npm run check:kahu-runtime
npm run perf:kahu-rack
```

Also build full Studio to make sure shared package changes did not regress upstream reference code:

```bash
npm run build -- --filter=@opendaw/app-studio
```

Update:

- `packages/app/kahu-testbed/README.md`;
- `plans/kahustack-dsp-testbed.md`;
- this plan's status/phase register.

Commit:

`docs(kahu-ui): close OpenDAW interaction parity program`

---

## 9. Required KUI phase register

Use this table during implementation and update statuses only with evidence.

| Phase | Initial status | Closure requirement |
| --- | --- | --- |
| KUI-0 | PLANNED | Baseline + complete control parity inventory checked in. |
| KUI-1 | SOURCE COMPLETE / OWNER VALIDATION PENDING | `TimelineRange` is sole horizontal range authority. |
| KUI-2 | IMPLEMENTATION IN PROGRESS | openDAW wheel/trackpad interaction ported and tested. |
| KUI-3 | PLANNED | dynamic time axis + ruler scrub replace static ruler/seek slider. |
| KUI-4 | PLANNED | openDAW range navigator replaces zoom slider/native range navigation. |
| KUI-5 | PLANNED | waveform, regions, ruler and playhead share exact range mapping. |
| KUI-6 | PLANNED | fixed headers and horizontally navigable lanes are cleanly separated. |
| KUI-7 | PLANNED | region drag + session range migration complete. |
| KUI-8 | PLANNED | transport/loop/follow shortcuts and controls match intended openDAW subset. |
| KUI-9 | PLANNED | all workbench controls audited and harmonized. |
| KUI-10 | PLANNED | obsolete substitutes removed; full validation and docs complete. |

---

## 10. Browser validation matrix

Source-safe tests do not replace real browser interaction qualification.

Owner/browser validation must cover Chrome and Edge at minimum.

Test with:

- normal mouse wheel;
- Windows mouse configured for multiple lines per notch;
- precision touchpad;
- 100% display scale;
- 125% display scale;
- 150% display scale where available.

Validate:

### Navigation

- Shift+wheel zoom is smooth and pointer anchored;
- zoom does not jump to minimum/maximum on one Windows wheel notch;
- Alt+wheel pans horizontally;
- two-finger horizontal trackpad gesture pans instead of navigating browser history;
- range navigator handles are easy to acquire;
- range center drag pans smoothly;
- double-click range navigator shows all;
- ruler scrub follows pointer;
- waveform never visibly disagrees with ruler after pan/zoom;
- playhead stays aligned at all zoom levels.

### Track lanes

- headers remain horizontally fixed;
- vertical header/lane alignment is exact;
- selecting a lane selects the correct header;
- mute/solo/gain remain usable while timeline is zoomed/panned.

### Region movement

- click selects;
- drag moves region;
- edge dragging auto-scrolls;
- region cannot move before zero;
- source offset remains unchanged;
- audio starts at the expected time after movement.

### Transport

- Space play/pause;
- Period stop;
- arrows seek;
- loop repeats without obvious inter-track desynchronization;
- follow pages timeline at boundaries;
- disabling follow stops automatic panning.

### General controls

- buttons/toggles show correct active state;
- no accidental text selection while manipulating controls;
- disabled controls are visually and behaviorally disabled;
- parameter controls retain correct Kahu units/formatting;
- drag/value behavior feels consistent with openDAW.

---

## 11. Performance requirements

KUI must not regress the runtime architecture established by KBW.

Timeline repaint must be range/invalidation driven.

Do not rebuild waveform pyramids during pan/zoom.

Do not create a new worker per paint.

Do not scan complete PCM on every range update.

Waveform draw work should remain approximately bounded by visible pixel width.

Do not perform DOM reconstruction on every animation frame.

Transport animation may update playhead/metering, but track rows/rack controls must not be rebuilt every frame.

Wheel/pointer handlers must remain bounded and allocation-light.

KUI must not alter the AudioWorklet/WASM processor topology unless a UI binding bug directly requires a fix.

---

## 12. Scope exclusions

Do not use this plan to add:

- recording;
- MIDI;
- metronome;
- piano roll;
- automation lanes;
- region fades;
- region cutting;
- clip launcher;
- time stretching;
- warp markers;
- sends/returns;
- full mixer;
- cloud save;
- collaboration;
- long-form streaming;
- Kahu visual redesign.

The purpose is parity and cleanliness for the small set of controls the Kahu workbench actually needs.

---

## 13. Definition of done

KUI is complete only when all of the following are true:

- `TimelineRange` is the only horizontal viewport authority;
- no Kahu `TimelineViewport` authority remains;
- openDAW wheel calibration behavior is ported;
- Shift+wheel zoom works around the pointer;
- Alt+wheel and horizontal trackpad pan work;
- browser history-swipe is suppressed over the app;
- ruler is dynamic and range-aware;
- ruler supports pointer scrubbing;
- playhead geometry is range-aware;
- waveform extraction uses the visible source interval;
- waveform/region/ruler/playhead remain aligned through pan/zoom;
- static 1..8 ruler is gone;
- raw primary zoom slider is gone;
- raw primary seek slider is gone;
- openDAW-style range navigator is present;
- double-click range navigator shows all;
- track headers are horizontally fixed;
- duplicate moving track labels are gone;
- region body drag works;
- edge auto-scroll works during region drag;
- session viewport uses normalized range min/max;
- old session viewport migrates;
- play/pause/stop/loop/follow interaction matches the intended openDAW subset;
- keyboard shortcuts are implemented;
- visible Kahu controls have been audited against openDAW equivalents;
- openDAW icons replace improvised glyphs where equivalent icons exist;
- manifest-driven Kahu parameter semantics are unchanged;
- Kahu Rust/WASM runtime behavior is unchanged;
- all focused Kahu tests/typecheck/build/runtime checks pass;
- full Studio still builds;
- browser/manual interaction gates are explicitly recorded rather than claimed as automated passes.

---

## 14. Final implementation report requirements

At closure, report:

1. starting and final SHA;
2. every commit grouped by KUI phase;
3. exact openDAW files reused/copied/adapted;
4. exact Kahu files created/removed/changed;
5. package dependencies added;
6. final timeline range architecture;
7. final wheel/trackpad behavior;
8. final ruler/navigation behavior;
9. final waveform alignment architecture;
10. final track header/lane architecture;
11. final region interaction model;
12. final transport shortcut/loop/follow behavior;
13. complete control parity inventory and exceptions;
14. session schema migration behavior;
15. validation commands actually executed;
16. browser/manual gates still pending;
17. confirmation that DSP/runtime semantics were not redefined;
18. confirmation that long-form audio remains deferred.

Do not declare KUI complete based on visual resemblance alone.

The closure standard is interaction parity for the intentionally supported subset of openDAW behavior.
