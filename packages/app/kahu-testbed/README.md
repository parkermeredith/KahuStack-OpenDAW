# KahuStack DSP Testbed

This is a minimal, separate openDAW-family app for evaluating KahuStack DSP modules. It is
not a second Studio and does not redefine Kahu module IDs, parameter semantics, or realtime
processing contracts.

## Commands

From the fork root:

```text
npm run dev:kahu
npm run typecheck:kahu
npm run test:kahu
npm run build:kahu
npm run check:kahu-runtime
npm run perf:kahu
```

`build:kahu` stages the generated parent `kahu_dsp_wasm.wasm` and `library-manifest.json` when
the parent repository is available one directory above the fork. Set `KAHU_DSP_ROOT`,
`KAHU_DSP_WASM`, or `KAHU_DSP_MANIFEST` for another checkout. Staged binaries and generated
worklets are ignored and are never committed.

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

The generated catalog is the module-selection authority. The current source-safe host path is
one compact audio track, retained audio-effect rack state, module parameters, bypass/reset,
output meter, and versioned local session metadata. Browser-local source files must be selected
again after recovery; the session records their names and technical metadata rather than copying
full PCM data.

`perf:kahu` records generated artifact sizes for local comparisons. It is not a claim of
five-hour-source readiness: the current browser path decodes each selected source fully into an
`AudioBuffer`. Waveform access is isolated behind the peak reducer so a future tiled/range source
can replace it without changing the rack or transport contracts.

The fork remains AGPL-3.0-or-later under the upstream openDAW provenance boundary. Canonical
Kahu DSP source, generated Rust, manifests, and validation authorities remain in the parent
`kahustack-dsp` repository.
