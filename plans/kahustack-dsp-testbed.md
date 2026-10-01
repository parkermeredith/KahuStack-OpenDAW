# KahuStack DSP Testbed — Implementation Plan

Status: **active implementation design**

Date: 2026-10-01

Repository: `parkermeredith/KahuStack-OpenDAW`

Baseline: `20cb0cfcfb068e3c9d46c0b1053d0e26f1c70412`

Parent integration baseline: `parkermeredith/kahustack-dsp` commit `6f4eb0d1f6b7364cd6489c0ba34e113df20d05a9`

This document defines the implementation program for turning the KahuStack openDAW fork into a deliberately small browser host for evaluating KahuStack DSP processors in realistic audio context.

It is subordinate to the KahuStack DSP repository authorities for DSP semantics, module IDs, parameter/state behavior, Rust/WASM lineage, realtime rules, and validation policy. This repository owns the experimental DAW shell and its openDAW-derived integration code; it must not silently redefine KahuStack DSP behavior.

## Current implementation status

KOD-0 is **SOURCE COMPLETE / OWNER BROWSER VALIDATION PENDING**. The synchronized fork
baseline was `e6540064c0253e44910346d7faaf3d74e36c28c2`; the KOD-0 bootstrap commit is
`8186da17b5769f073b43eadc1f4747adf9b2ceec`. Node 24, Rust 1.95 MSVC, nightly Rust and
`wasm32-unknown-unknown` are installed. The full Studio build passes on Windows through
`npm run build -- --filter=@opendaw/app-studio`, including the Rust engine and device WASM
artifacts. Studio serves successfully at `https://localhost:8080/` with the required
cross-origin-isolation headers; visual/browser/audio-device qualification remains owner-run.

KOD-1 is **SOURCE COMPLETE / OWNER BROWSER VALIDATION PENDING** at child commit
`0e1e25a3f`. The separate `@kahustack/opendaw-testbed` Vite app has independent
`dev:kahu`, `build:kahu`, and `test:kahu` commands, openDAW-family colors/fonts/base styling,
and the minimal header, timeline, track list, and rack shell. Its focused test, lint, build,
and local HTTP launch checks pass; visual cross-browser qualification remains owner-run.

KOD-2 is **SOURCE COMPLETE / OWNER BROWSER VALIDATION PENDING** at child commit
`10087c69e`. The testbed now has a pure, bounded transport model with play/pause, stop,
seek-by-range, typed seek, timecode and musical-position displays, plus four passing focused
tests. Browser interaction and timing/audio-device qualification remain owner-run.

KOD-3 is **SOURCE COMPLETE / OWNER BROWSER VALIDATION PENDING** at child commit
`5c2107841`. The testbed now includes one browser-decodable audio track, file picker and
drag/drop loading, source metadata, bounded waveform peak rendering, horizontal zoom, and
Web Audio source scheduling on the shared transport. Focused tests, lint, and production build
pass; the first real audio-file/browser qualification remains owner-run.

KOD-4 is **SOURCE COMPLETE / OWNER BROWSER VALIDATION PENDING** at child commit
`b24ddfc1d`. The testbed now supports multiple stable-ID audio tracks, selected-track
waveform focus, create/remove through the shared loader, mute, solo, per-track gain, and
shared transport playback. Focused tests, lint, and production build pass; owner validation
still needs multiple-file playback and audible mute/solo/gain checks.

KOD-5 is **SOURCE COMPLETE / OWNER BROWSER VALIDATION PENDING** at child commit
`f1e925da4`. The selected-track rack now retains per-track audio-effect slot chains with
add/remove/reorder/bypass contracts and horizontal device framing. It is explicitly a
reference/no-op lifecycle slot, not a fake Kahu processor. Focused tests, lint, and build pass.

KOD-6 is **SOURCE COMPLETE / OWNER BROWSER VALIDATION PENDING** at child commit
`6c521662d`. The testbed now stages the generated parent catalog/WASM, emits a standalone
typed AudioWorklet, resolves stable `utility.gain` metadata, prepares the Rust-derived module,
and routes a track through the worklet with gain/bypass controls and failure surfacing. The
direct ABI smoke and app tests/build pass; owner browser listening and runtime-handshake proof
remain pending.

KOD-7 is **SOURCE COMPLETE / OWNER BROWSER VALIDATION PENDING** at child commit
`07ef31b43`. The rack is catalog-driven, retains stable module/device identity across
reorder/remove, chains retained Rust-WASM worklet nodes, exposes generated parameters and
reset/bypass, and round-trips rack state. KOD-8 diagnostics include sample rate/block size,
output metering, latency display, bypass-all, and runtime error surfaces.

KOD-9 is **SOURCE COMPLETE / OWNER RECOVERY VALIDATION PENDING** at the same checkpoint.
Versioned local session metadata records track technical identity and rack/device state; source
audio remains an explicit browser-local reselect requirement.

KOD-10 is **SOURCE COMPLETE / OWNER LONG-FORM PERFORMANCE EVIDENCE PENDING**. The host keeps
waveform reduction, storage, playback, and rack/runtime seams separable, and `npm run perf:kahu`
reports generated artifact sizes. It does not claim multi-hour source readiness because decoding
still uses a resident `AudioBuffer`.

KOD-11 is **SOURCE COMPLETE / OWNER FINAL BROWSER VALIDATION PENDING**. The fork now documents
run/build/test/runtime-check/staging/provenance behavior and exposes permanent focused commands;
the remaining closure is owner-run browser, audible, recovery, and long-form qualification.

---

## 1. Product goal

Build a compact browser testbed with only the DAW facilities required to audition and validate KahuStack processors:

- transport;
- audio-file import;
- waveform timeline;
- one or more audio tracks;
- basic audio-region placement and seeking;
- track selection;
- mute, solo, gain and optional pan;
- a selected-track effects rack;
- KahuStack processor add/remove/reorder/bypass;
- processor parameter editing;
- output monitoring and basic runtime diagnostics.

The product is an engineering and listening host, not a general DAW.

Target interaction:

```text
+-------------------------------------------------------------------+
| openDAW-style header: play / stop / time / loop / output meter    |
+-----------+-------------------------------------------------------+
| Tracks    | Timeline                                              |
|-----------|-------------------------------------------------------|
| Vocal     | [================ waveform ========================]  |
| Guitar    |     [================ waveform ===================]  |
| Drums     | [================ waveform ========================]  |
+-----------+-------------------------------------------------------+
| Selected track: Vocal                                             |
| FX Rack: [Kahu EQ] -> [Tube] -> [Spectral] -> [+ Add Processor]  |
+-------------------------------------------------------------------+
```

The initial testbed should feel visually like openDAW. KahuStack branding and a dedicated Kahu visual design pass are explicitly deferred until the functional host is stable.

---

## 2. Non-negotiable constraints

### 2.1 Preserve openDAW visual language for the first complete implementation

For the initial program:

- reuse openDAW layout proportions where practical;
- reuse its dark color system and CSS custom properties;
- reuse existing Sass patterns and component styling;
- reuse openDAW iconography and control presentation where license-compatible within this fork;
- keep compact spacing, header sizing, lane sizing, separators, hover behavior and panel treatment consistent with current Studio;
- do not introduce a KahuStack redesign, new component library, Tailwind, React, Vue, Svelte or another UI framework;
- do not restyle working openDAW controls merely for preference;
- new Kahu-specific controls should visually match neighboring openDAW controls.

Relevant current styling authority includes `packages/app/studio/src/colors.sass`, `packages/app/studio/src/ui/header/Header.sass`, existing component Sass, `@opendaw/studio-enums` colors/icons, `@opendaw/lib-jsx`, and `@opendaw/lib-dom`.

### 2.2 Do not simplify Studio by destructive subtraction

Do not begin by deleting features from `@opendaw/app-studio`.

Create a separate minimal application and leave full Studio runnable as executable reference material during the entire extraction program.

Preferred location:

```text
packages/app/kahu-testbed/
```

Preferred package name:

```text
@kahustack/opendaw-testbed
```

The root workspace may add:

```text
npm run dev:kahu
npm run build:kahu
npm run test:kahu
```

Full Studio must remain independently buildable until an explicit later decision says otherwise.

### 2.3 KahuStack DSP remains canonical

Do not copy, fork or reinterpret Kahu DSP algorithms inside this repository.

The host may adapt:

- module identity;
- parameter transport;
- audio buffers;
- state serialization;
- host scheduling;
- UI presentation;
- latency reporting;
- processor lifecycle.

The host must not redefine:

- DSP equations;
- defaults;
- parameter meaning;
- module IDs;
- reset/reprepare semantics;
- latency/tail meaning;
- finite-input behavior;
- Kahu Rust/WASM lineage.

The preferred integration consumes KahuStack's existing Rust-derived browser artifact or a purpose-built adapter artifact produced by `kahustack-dsp`. If an openDAW-specific Rust adapter is required, keep the adapter thin and keep the reusable processor implementation in `kahustack-dsp`.

### 2.4 No JavaScript fallback DSP

The browser may use TypeScript/JavaScript for host orchestration and UI. Kahu audio processing must remain Rust-derived WASM according to the parent repository's architecture rules.

### 2.5 Do not block the MVP on long-form storage work

The first usable host may retain openDAW's current sample-loading model. However, new application boundaries must not make a future chunked/tiled long-form source implementation difficult.

Do not spread direct assumptions that every source is one permanently resident `Float32Array` throughout new UI code. Keep sample/source access behind existing storage/project abstractions or a small Kahu testbed source service.

---

## 3. Explicit non-goals

The first complete testbed does not need:

- MIDI input or MIDI tracks;
- instruments;
- piano roll;
- note editing;
- clip launcher;
- recording;
- punch-in/out;
- count-in;
- metronome;
- tempo matching;
- warp-marker editing unless required for existing audio-region playback;
- automation lanes;
- modulation;
- sends/returns;
- a full mixer;
- collaboration;
- rooms/chat;
- cloud projects;
- publishing;
- scripting/code editor;
- soundfonts;
- sampler/synth browser;
- composite instruments;
- shadertoy;
- DAWProject import/export;
- mastering/export workflow;
- mobile layout optimization;
- a KahuStack visual redesign.

Do not retain a feature merely because removing it from the minimal application feels difficult. The testbed should depend only on facilities that support audio playback, navigation, effects evaluation, state and diagnostics.

---

## 4. Architecture boundary

Target architecture:

```text
KahuStack-OpenDAW
|
+-- packages/app/kahu-testbed
|   +-- app shell
|   +-- transport UI
|   +-- timeline UI
|   +-- audio tracks / regions
|   +-- waveform presentation
|   +-- selected-track rack UI
|   +-- diagnostics
|
+-- existing openDAW libraries
|   +-- lib-std
|   +-- lib-dom
|   +-- lib-jsx
|   +-- lib-box
|   +-- lib-dsp / lib-fusion as needed
|   +-- studio-boxes
|   +-- studio-adapters
|   +-- studio-core
|   +-- studio-core-wasm when required
|   +-- studio-enums / icons / scrollbars
|
+-- Kahu integration adapter
    |
    +-- consumes Kahu Rust-derived WASM/runtime contract
        from parkermeredith/kahustack-dsp
```

Avoid cross-importing private source directly from `packages/app/studio/src` as a permanent architecture. During extraction, either:

1. move a genuinely reusable app-level component into an existing/new shared openDAW package while keeping Studio working; or
2. create a testbed-specific adaptation when the Studio component is deeply coupled to unrelated Studio behavior.

Small temporary source duplication is acceptable during a bounded extraction slice when it keeps the change understandable, but remove accidental divergence before program closure.

---

## 5. Reuse map from current openDAW

The coding agent must inspect current source before implementation, but these are the expected seams.

### Header / transport

Current Studio already isolates transport and time display in:

- `packages/app/studio/src/ui/header/TransportGroup.tsx`
- `packages/app/studio/src/ui/header/TimeStateDisplay.tsx`
- `packages/app/studio/src/ui/header/Header.tsx`
- `packages/app/studio/src/ui/header/Header.sass`

The Kahu header should retain only the controls required by this testbed and preserve current styling.

### Timeline / audio units

Primary reference surface:

- `packages/app/studio/src/ui/timeline/Timeline.tsx`
- `packages/app/studio/src/ui/timeline/tracks/audio-unit/AudioUnitsTimeline.tsx`
- `TracksManager.ts`
- `Track.tsx`
- `headers/`
- `regions/`
- timeline range/scroll/zoom utilities.

The existing `AudioUnitsTimeline` includes instruments, modulators, presets, clipboard and other behavior. Do not copy it wholesale and then hide controls. Extract the minimum audio-track behavior intentionally.

### Waveforms

Primary references:

- `packages/lib/fusion/src/peaks/Peaks.ts`
- `packages/lib/fusion/src/peaks/PeaksPainter.ts`
- `packages/lib/fusion/src/peaks/SamplePeakWorker.ts`
- `packages/studio/core/src/ui/renderer/audio.ts`
- `packages/studio/core/src/samples/SampleStorage.ts`

Retain the multiresolution min/max peak strategy, viewport culling and inexpensive Canvas2D rendering.

### Device/effect presentation

Primary references:

- `packages/app/studio/src/ui/devices/panel/DevicePanel.tsx`
- `DevicePanel.sass`
- `DeviceMount`
- `DevicePanelDragAndDrop`
- audio-effect factories/adapters in `studio-adapters` / `studio-core`.

The Kahu testbed does not need Studio's instrument or MIDI device sections. Its device surface should be audio-effects-only.

### Audio engine / runtime

Primary references include:

- `packages/studio/core-wasm`
- `packages/studio/adapters`
- `crates/engine`
- current audio-region player/runtime code.

Do not replace working sample-accurate transport behavior with UI timers.

---

## 6. Application state model

The minimum persistent testbed session should contain:

```text
session
+-- transport
|   +-- position
|   +-- loop enabled/range
|
+-- tracks[]
|   +-- stable track id
|   +-- label
|   +-- gain
|   +-- pan (optional for MVP)
|   +-- mute
|   +-- solo
|   +-- regions[]
|   +-- rack
|
+-- selected track id
+-- view
    +-- horizontal range / zoom
    +-- vertical scroll
    +-- rack scroll
```

Each rack entry should retain stable identity independently of its position:

```text
rack device
+-- instance id
+-- Kahu module id
+-- enabled/bypassed
+-- parameter state
+-- processor-owned serialized state when supported
+-- reported latency
+-- error state
```

Reordering must not recreate unaffected processors when the chosen Kahu runtime supports retained instances.

---

## 7. Kahu DSP integration strategy

### 7.1 Preferred host contract

Treat the selected track's Kahu rack as one intentional host subsystem. Do not make every Kahu processor depend on openDAW UI/project implementation details.

Logical boundary:

```text
openDAW track audio
       |
       v
KahuRackHost
       |
       +-- Kahu processor instance A
       +-- Kahu processor instance B
       +-- Kahu processor instance C
       |
       v
openDAW track/output graph
```

The integration implementation may use the existing Kahu Browser Host 2.0 runtime topology initially if that is the smallest correct route. A future consolidated openDAW-style engine is an optimization program, not a prerequisite for the first complete testbed.

### 7.2 Integration decision gate

Before modifying realtime engine code, inspect both repositories and write a short implementation note under this plan's commit history or an architecture note that answers:

1. Where can audio enter and leave an audio-unit effect chain in the current openDAW runtime?
2. Can the existing Kahu Rust-WASM runtime be inserted there without a second uncontrolled transport clock?
3. Is the smallest safe implementation:
   - a thin openDAW audio-effect adapter around Kahu WASM;
   - a Kahu Rack device compiled into/adapted to the openDAW engine;
   - an AudioWorklet node integrated at the track effect boundary;
   - or another existing supported extension seam?
4. How are latency, reset, sample-rate changes, bypass and failure containment represented?
5. How is the Kahu artifact supplied when this repository is cloned standalone versus checked out as the `kahustack-dsp/openDAW` submodule?

Choose the least-coupled route that preserves Kahu semantics and realtime safety. Do not invent duplicate processor semantics in openDAW boxes/adapters merely to make the integration visually convenient.

### 7.3 Artifact integration

The standalone fork must not assume its filesystem parent is always `kahustack-dsp`.

Support an explicit Kahu artifact/build input, for example an environment/configured path or a documented synchronization script. When checked out as the parent submodule, a convenient default may be supported, but standalone clone/build behavior must fail clearly rather than silently substituting fake DSP.

Do not commit generated `.wasm` binaries unless both repositories' policies explicitly change.

---

## 8. Development phases

Each phase is a coherent milestone. Complete implementation, focused tests, static review and documentation for the phase before advancing. Do not stop for owner approval between source-safe phases when executing under an explicit autonomous implementation goal.

### KOD-0 — Baseline and authority

Goal: prove the fork and parent topology are reproducible before feature work.

Tasks:

- synchronize actual `main` in both repositories;
- record starting SHAs;
- confirm clean worktrees;
- verify submodule URL and pinned commit;
- perform a fresh/throwaway clone or equivalent submodule initialization check;
- verify Node, Rust and WASM prerequisites;
- run the current build needed to launch Studio;
- verify full Studio still starts;
- add root scripts only as required for later Kahu app work;
- preserve the upstream-derived license and provenance.

Exit criteria:

- clean clone initializes the submodule;
- fork builds from documented prerequisites;
- current Studio remains runnable;
- no Kahu testbed behavior added yet.

### KOD-1 — Standalone minimal app scaffold

Goal: create a second Vite application without altering full Studio behavior.

Tasks:

- create `packages/app/kahu-testbed`;
- derive TypeScript/Vite/Sass setup from Studio;
- keep `@opendaw/lib-jsx` and current DOM/component patterns;
- install only dependencies actually required by the app;
- add `dev:kahu`, `build:kahu`, `test:kahu` root commands;
- establish global openDAW colors/fonts/base styles;
- render a minimal header, empty timeline area and bottom rack panel;
- add a clear application title in document metadata, but do not visually redesign controls.

Exit criteria:

- `npm run dev:kahu` launches independently;
- `npm run build:kahu` succeeds;
- full `dev:studio`/Studio build remains intact;
- testbed visually belongs to the openDAW family.

### KOD-2 — Minimal transport

Goal: make the transport real before adding editor complexity.

Required controls:

- play/pause or play/stop according to current engine semantics;
- stop;
- click/type/drag seek through existing time state behavior where appropriate;
- current musical/time display;
- optional loop enable and range if inexpensive to retain.

Explicitly omit MIDI capture, undo/redo, manuals, metronome, base-frequency control, screen selector, cloud status and unrelated header actions.

Requirements:

- transport position must come from the audio engine/runtime;
- seeking while stopped and playing must remain deterministic;
- keyboard shortcut reuse is allowed where it does not pull in large unrelated systems;
- retain openDAW header height, spacing, separators and control styling.

Exit criteria:

- transport runs without audio material;
- play/stop/seek state is internally consistent;
- no UI-only fake clock.

### KOD-3 — Single audio track and waveform

Goal: first audible end-to-end testbed.

Tasks:

- provide one audio track;
- support file picker and drag/drop for an admitted audio format already supported by openDAW;
- persist/import through the current sample storage path where practical;
- generate/load peak data using existing worker infrastructure;
- draw waveform with existing LOD/pixel-strip behavior;
- play source through the engine;
- click timeline to seek;
- horizontal zoom and scroll;
- clip waveform and rendering work to visible range;
- preserve sample-rate/channel metadata.

First major success condition:

```text
npm run dev:kahu
-> drop WAV
-> waveform appears
-> Play produces audio
-> Stop works
-> click waveform seeks
-> output is metered
```

### KOD-4 — Multiple tracks and minimal region editing

Goal: create realistic stem-based audition context.

Tasks:

- create/delete audio tracks;
- multiple concurrent audio files;
- stable track identity;
- selected track state;
- track labels;
- mute/solo;
- gain;
- optional pan if current channel-strip support makes it low-risk;
- basic region move/start positioning;
- visual selection/focus;
- vertical scrolling;
- preserve sample-accurate shared transport behavior.

Do not add recording, comping, take lanes, advanced fades, automation or full mixer behavior.

Exit criteria:

- a stem session can be assembled and played in sync;
- selecting a track is unambiguous;
- muting/soloing/gain changes affect the intended track only.

### KOD-5 — Audio-effects-only rack shell

Goal: establish the UX before Kahu DSP integration.

Tasks:

- create a bottom panel derived from the visual behavior of `DevicePanel`;
- bind it to selected audio track;
- remove instrument and MIDI-effect sections;
- show audio-effect chain only;
- implement horizontal rack scrolling;
- implement empty-rack state;
- establish add/remove/reorder/bypass interaction contracts;
- use openDAW device framing, spacing and control language.

A temporary no-op/reference effect may be used only to prove rack lifecycle and routing. Do not create fake Kahu implementations.

Exit criteria:

- selecting a track switches the displayed rack;
- rack state remains stable while changing selection;
- reorder/bypass UI contracts are covered by focused tests.

### KOD-6 — Kahu runtime bridge

Goal: process real track audio through one real Kahu processor.

Tasks:

- resolve the integration-decision gate in section 7;
- consume the canonical Kahu Rust-derived browser artifact/runtime;
- map one stable Kahu module ID into a rack entry;
- instantiate/prepare/reset/process through the canonical runtime contract;
- transport parameters without redefining semantics;
- handle sample-rate and channel configuration explicitly;
- surface initialization/processing failure without killing transport;
- report latency where available;
- preserve finite output containment expected by the parent host contracts;
- ensure removal/bypass returns correct audio and cleans up resources.

Recommended first proof processor: a simple, well-qualified Kahu processor with obvious audible behavior and low integration complexity. Do not start with the most complex EQ/convolution path merely because it is visually prominent.

Exit criteria:

- one real Kahu processor runs on a selected track;
- bypass is click-safe;
- parameter changes affect the real processor;
- no JavaScript DSP fallback exists.

### KOD-7 — Full retained Kahu rack

Goal: make the testbed genuinely useful for KahuStack development.

Tasks:

- processor catalog sourced from canonical Kahu metadata rather than a hand-maintained duplicate list where possible;
- add multiple processors;
- remove processors;
- reorder processors;
- retained stable device identity;
- bypass per device;
- parameter editing;
- device reset/reprepare behavior;
- processor initialization rollback/failure containment;
- session state serialization;
- restore rack in correct order with correct module IDs/state;
- preserve unaffected device state/history across ordinary add/remove/reorder when supported by the chosen Kahu runtime topology.

If the current Kahu Browser Host 2.0 already provides a qualified behavior, adapt/reuse that contract rather than creating a new competing one.

Exit criteria:

- representative chains of at least several Kahu processors run correctly;
- reorder/remove operations do not restart the whole session unless the admitted runtime contract requires it;
- failed device initialization does not destroy the rest of the rack.

### KOD-8 — Kahu QA ergonomics

Goal: make the shell substantially more useful than a basic player.

Add compact engineering affordances without turning the application into a general DAW:

- sample rate;
- audio buffer/block information when available;
- output meter;
- per-rack/device latency visibility;
- CPU/runtime timing indicator when reliable;
- bypass-all;
- A/B rack state if the parent Kahu host contract already defines it;
- level matching if the existing Kahu Rack contract can be reused without semantic divergence;
- clear processor error state;
- optional input/output trim if it uses the canonical Kahu gain-staging behavior.

Keep these visually subordinate and consistent with openDAW styling.

### KOD-9 — Session persistence and recovery

Goal: make repeated processor evaluation practical.

Persist enough state to reopen a test session:

- audio source references according to browser storage limitations;
- track order and labels;
- region positions;
- gains/mute/solo;
- selected track;
- rack module IDs/order;
- parameters/device state;
- useful view state.

Failure requirements:

- missing source audio is reported clearly;
- unknown/removed Kahu module ID does not make the session unreadable;
- corrupt device state should isolate the affected device where practical;
- session schema should include a version.

### KOD-10 — Performance and long-form readiness

Goal: ensure the simple host scales beyond demo-sized files without prematurely rewriting storage.

Measure and document:

- waveform frame cost at common zoom levels;
- timeline frame cost with multiple tracks;
- peak memory footprint;
- audio memory footprint;
- rack process cost versus number of devices;
- UI responsiveness during peak generation/import;
- transport stability during rack edits.

Add long-form architecture seams if not already present:

- source access is not hard-coded throughout UI to full resident PCM;
- waveform access can later become tiled/range-based;
- storage and renderer remain separable;
- playback can later adopt chunked/read-ahead decoding.

Do not claim five-hour-source readiness merely because waveform drawing is fast. Current `SampleStorage.load()` reads and decodes the complete WAV and peak file; true long-form qualification requires separate evidence or a future chunked source implementation.

### KOD-11 — Product closure

Goal: finish a small coherent testbed rather than leave an extraction experiment.

Tasks:

- remove dead temporary adapters and duplicated proof code;
- minimize package dependencies;
- confirm full Studio still builds unless a later explicit decision removes that requirement;
- document run/build/test steps;
- document Kahu artifact synchronization;
- document license/provenance boundary;
- add architecture diagram;
- add focused validation checklist;
- update the parent `kahustack-dsp` canonical development authority with the actual achieved status;
- advance the parent submodule pointer to the final qualified fork commit;
- ensure parent and nested repositories are clean.

Final completion statement must distinguish automated/source validation from owner listening/browser validation that has not actually been executed.

---

## 9. Validation strategy

### Per-slice minimum

Every bounded implementation slice should run the narrowest relevant set of:

- TypeScript `--noEmit` typecheck;
- package lint;
- focused Vitest tests;
- Rust tests for touched engine/runtime code;
- WASM build/check when runtime code changes;
- testbed production build;
- static diff review.

Do not run enormous unrelated suites merely as ritual. Expand only when a dependency or failure makes them relevant.

### Permanent focused checks to establish

By closure, prefer stable commands resembling:

```text
npm run typecheck:kahu
npm run test:kahu
npm run build:kahu
npm run check:kahu-runtime
```

Exact naming may follow current workspace conventions.

### Browser/manual qualification

Owner/browser validation should eventually cover:

- launch;
- audio import;
- waveform visibility;
- play/stop/seek;
- multi-track synchronization;
- mute/solo/gain;
- track selection/rack switching;
- Kahu processor load;
- parameter changes;
- bypass;
- add/remove/reorder;
- failed processor recovery;
- session save/reload;
- audible clicks/pops during edits;
- runtime stability under representative racks.

Never convert unexecuted browser/listening steps into PASS evidence.

---

## 10. Commit and repository workflow

When an autonomous goal explicitly authorizes implementation and commits:

### KahuStack-OpenDAW

- work directly on `main` unless the owner explicitly requests another workflow;
- synchronize before each substantial slice;
- make small responsibility-coherent commits;
- keep full Studio buildable;
- do not mix broad formatting churn into functional slices;
- preserve upstream/openDAW provenance.

### Parent `kahustack-dsp`

- obey its `AGENTS.md` and canonical-plan authority;
- update the submodule pointer only at stable integration checkpoints, not for every exploratory nested commit;
- keep Kahu DSP changes in the parent repository rather than copying them into the fork;
- any new Kahu host/runtime contract belongs in parent authorities and validation where applicable.

The coding agent must always be explicit about which repository a commit belongs to.

---

## 11. Risk register

### Risk: accidentally rebuilding a DAW

Mitigation: enforce the non-goal list. Every new feature must answer, “Does this materially improve Kahu processor evaluation?”

### Risk: deeply coupling Kahu DSP to openDAW internals

Mitigation: keep a narrow `KahuRackHost`/adapter boundary and preserve canonical Kahu module semantics.

### Risk: private Studio component imports create a brittle second app

Mitigation: extract genuinely reusable pieces to shared packages or create small testbed adaptations rather than permanent cross-app source imports.

### Risk: style drift

Mitigation: reuse openDAW variables, Sass patterns, icons, sizing and components. No Kahu visual redesign during this program.

### Risk: two competing browser rack architectures

Mitigation: treat existing Kahu Browser Host 2.0 contracts as the behavioral authority unless explicitly superseded by evidence. This fork is a new shell/client, not permission to redefine rack semantics.

### Risk: AGPL/provenance confusion

Mitigation: preserve the fork's existing license/provenance and clearly separate reusable Kahu DSP code in its own repository. Do not casually move openDAW-derived UI/source back into differently licensed Kahu libraries.

### Risk: long-form files exhaust memory

Mitigation: do not claim long-form qualification under the current whole-file `SampleStorage` path. Keep storage/render boundaries clean and schedule chunked/tiled source work based on measured need.

---

## 12. Definition of done

The program is complete when all of the following are true:

1. `npm run dev:kahu` launches a standalone minimal testbed.
2. The testbed retains openDAW's current visual language.
3. Full openDAW Studio remains runnable unless explicitly retired later.
4. A user can import common audio files and see performant waveforms.
5. Multiple audio tracks play in sync under one transport.
6. Track selection, mute, solo and gain work reliably.
7. The selected track exposes an audio-effects-only rack.
8. Real Kahu Rust-derived WASM processors can be added to that rack.
9. Multiple Kahu processors can be added, removed, reordered and bypassed.
10. Parameter state reaches the canonical Kahu processors correctly.
11. Failure of one processor does not unnecessarily destroy the session/rack.
12. The session can persist enough state for repeated engineering work.
13. Basic diagnostics make processor testing practical.
14. Focused automated checks pass.
15. Browser/listening validation status is reported honestly.
16. The parent `kahustack-dsp` repository points at the intended final submodule commit and documents the achieved integration status.
17. Both repositories are clean at handoff.

The desired outcome is not “openDAW with features hidden.” It is a small KahuStack DSP engineering host that deliberately reuses the strongest openDAW transport, timeline, waveform and UI ideas while keeping Kahu DSP semantics and realtime behavior under KahuStack authority.
