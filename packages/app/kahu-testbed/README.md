# KahuStack DSP Testbed

This is a minimal, separate openDAW-family app for evaluating KahuStack DSP modules. It is
not a second Studio and does not redefine Kahu module IDs, parameter semantics, or realtime
processing contracts.

The active hardening programs are **KBW — Kahu Browser Workbench v2**, **KUI — Kahu UI
Interaction Parity**, and **KUX — Kahu Workbench UX Convergence**. Earlier prototype labels are
history. KBW targets normal songs, stems, and reference tracks from seconds through tens of
minutes; long-form streaming audio is explicitly deferred. KUI aligns the reduced workbench's
timeline and transport interactions with openDAW. KUX converges the track/clip and device-rack
surfaces on the same model without importing the full Studio application.

## Commands

From the fork root:

```text
npm run dev:kahu
npm run typecheck:kahu
npm run test:kahu
npm run lint --workspace=@kahustack/opendaw-testbed
npm run build:kahu
npm run check:kahu-runtime
npm run perf:kahu
npm run perf:kahu-rack
```

`build:kahu` stages the generated parent `kahu_dsp_wasm.wasm` and `library-manifest.json` when
the parent repository is available one directory above the fork. It also stages ignored generated
copies of the parent `types.ts` and `LibraryManifestRuntime.ts`; those files are the browser's
manifest contract and executable validator, not a child-authored schema. Set `KAHU_DSP_ROOT`,
`KAHU_DSP_WASM`, or `KAHU_DSP_MANIFEST` for another checkout. Staged binaries, generated
contract sources, and generated worklets are ignored and are never committed.

## Runtime boundary

```text
decoded source audio
        |
AudioBufferSourceNode -> track gain -> retained Kahu AudioWorklet rack -> monitor meter -> output
                                      |
                         Rust-derived kahu_dsp_wasm.wasm
```

The worklet calls the canonical `kahu_create` / `kahu_process` ABI. JavaScript owns browser
transport, file decoding, view state, and message transport only; it does not implement a DSP
fallback. A missing or failed Kahu artifact is surfaced in the rack while dry browser playback
remains available for diagnosis.

The generated catalog is the module-selection authority and is parsed through the parent-owned
canonical validator. The current host supports multiple audio tracks, retained per-track audio-effect
chains, complete manifest parameter surfaces, bypass/reset/reorder, output metering, and versioned
local session metadata. Timeline viewport state, loop state, and follow state are persisted in the v4
session boundary. Browser-local source files must be selected again after recovery; the session
records their names and technical metadata rather than copying full PCM data.

## Timeline and tracks

Track controls and timeline content use one shared vertical row authority. A track header and its
lane are two cells in the same row and therefore cannot drift because of independent scrolling,
spacers, font metrics, or display scaling. The large audio drop/load surface is a true empty state and
exists only while there are no tracks; after the first source is loaded, the persistent `+` button is
the normal add-track affordance.

Each audio region owns its waveform canvas. The canvas uses the existing asynchronous per-track
multiresolution peak pyramid and renders only the region/range overlap projected by the shared
timeline range. The raster height follows the actual clip height and device-pixel ratio rather than a
fixed source-preview size. Region movement, source offsets, zoom, pan, and viewport resizing all use
the same source-sample projection authority.

## Processing rack

The processing surface follows openDAW's Device Panel interaction model while retaining Kahu rack
identity and runtime state. The rack has a full editing height by default and can collapse globally to
return space to the timeline. Its device chain is horizontal and scrollable. Individual devices retain
stable Kahu IDs and can be minimized to a narrow strip or expanded to expose the complete admitted
manifest control surface.

Continuous Kahu parameters use a Kahu-native adapter around the openDAW rotary-control language:
relative pointer dragging, keyboard control, default reset, exact-value entry, and compact value
readout. Kahu manifest ranges, scaling, units, precision, defaults, automation policy, and transition
semantics remain authoritative. `reprepare` controls commit at gesture finalization rather than
reconstructing the runtime for every intermediate pointer event. Boolean and enum parameters remain
appropriate discrete controls.

KUI/KUX intentionally keep native precision number fields for exact timing/seek entry and compact
native selectors for module/enum choices. Diagnostics, model notes, and qualification evidence stay
secondary to ordinary sound controls rather than taking over each expanded device editor.

The AudioWorklet also routes the parent-owned level-match loudness profile and perceptual-spectrum
observer through the same Rust-WASM artifact. The monitor uses those observations for A/B dry
matching and spectrum display; native Web Audio analysis remains only the presentation fallback
until the Kahu observer has produced its first snapshot.

`perf:kahu` records generated artifact sizes. `perf:kahu-rack` is the retained rack performance
comparison surface. The current browser path decodes each selected source fully into an
`AudioBuffer`; long-form streaming is intentionally deferred.

The fork remains AGPL-3.0-or-later under the upstream openDAW provenance boundary. Canonical
Kahu DSP source, generated Rust, manifests, and validation authorities remain in the parent
`kahustack-dsp` repository.
