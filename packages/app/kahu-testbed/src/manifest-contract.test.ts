// KBW-1 permanent contract tests: the browser host accepts only the parent-owned manifest semantics.

import {describe, expect, it} from "vitest"
import {parseLibraryManifest} from "./generated/kahu-manifest-runtime"

type JsonRecord = Record<string, unknown>

const baseline: JsonRecord = {
    schemaVersion: 1,
    library: {
        id: "kahustack-dsp",
        name: "KahuStack DSP",
        version: "test",
        schema_version: 1,
        manifest_format: 1,
        domains: [{id: "utility", name: "Utility"}],
        kinds: {allowed: ["utility"]},
    },
    moduleCount: 2,
    modules: [
        {
            id: "utility.gain",
            name: "Gain",
            domain: "utility",
            family: "gain",
            kind: "utility",
            maturity: "qa",
            version: "1",
            targets: ["native", "wasm"],
            parameters: [
                {
                    id: 0,
                    key: "gain_db",
                    name: "Gain",
                    default: 0,
                    min: -24,
                    max: 24,
                    step: 0.1,
                    unit: "dB",
                    scale: "decibels",
                    control: "continuous",
                    transition: "linear-ramp:10ms",
                    automation: "realtime",
                },
                {
                    id: 1,
                    key: "mode",
                    name: "Mode",
                    default: 0,
                    min: 0,
                    max: 1,
                    step: 1,
                    unit: "",
                    scale: "enum",
                    control: "enum",
                    transition: "immediate",
                    automation: "realtime",
                    enum_values: ["Clean", "Color"],
                },
            ],
            runtime: {registry_index: 0, latency_samples: 0},
        },
        {
            id: "utility.trim",
            name: "Trim",
            domain: "utility",
            family: "gain",
            kind: "utility",
            maturity: "qa",
            version: "1",
            targets: ["native", "wasm"],
            parameters: [{
                id: 0,
                key: "trim_db",
                name: "Trim",
                default: 0,
                min: -12,
                max: 12,
                step: 0.1,
                unit: "dB",
                scale: "decibels",
                control: "continuous",
                transition: "linear-ramp:10ms",
                automation: "realtime",
            }],
            runtime: {registry_index: 1, latency_samples: 0},
        },
    ],
}

const cloneManifest = (): JsonRecord => structuredClone(baseline) as JsonRecord

const modulesOf = (manifest: JsonRecord): JsonRecord[] => manifest.modules as JsonRecord[]

const firstParameterOf = (manifest: JsonRecord): JsonRecord => {
    const module = modulesOf(manifest)[0]
    if (module === undefined) throw new Error("The generated catalog must contain a module.")
    const parameter = (module.parameters as JsonRecord[])[0]
    if (parameter === undefined) throw new Error("The generated catalog must contain a parameter.")
    return parameter
}

describe("KBW-1 canonical manifest contract", () => {
    it("parses a standalone fixture with the parent validator", () => {
        const catalog = parseLibraryManifest(baseline)
        expect(catalog.moduleCount).toBe(catalog.modules.length)
        expect(catalog.modules.find(module => module.id === "utility.gain")?.runtime.registry_index).toBe(0)
    })

    it("rejects malformed modules and parameters", () => {
        const malformedModule = cloneManifest()
        delete modulesOf(malformedModule)[0]?.name
        expect(() => parseLibraryManifest(malformedModule)).toThrow(/name/)

        const malformedParameter = cloneManifest()
        firstParameterOf(malformedParameter).min = "not-a-number"
        expect(() => parseLibraryManifest(malformedParameter)).toThrow(/min/)
    })

    it("rejects duplicate module and parameter IDs", () => {
        const duplicateModule = cloneManifest()
        const modules = modulesOf(duplicateModule)
        modules[1]!.id = modules[0]!.id
        expect(() => parseLibraryManifest(duplicateModule)).toThrow(/duplicate value/)

        const duplicateParameter = cloneManifest()
        const parameters = modulesOf(duplicateParameter)[0]!.parameters as JsonRecord[]
        parameters[1]!.id = parameters[0]!.id
        expect(() => parseLibraryManifest(duplicateParameter)).toThrow(/parameter ids/)
    })

    it("rejects invalid enum metadata and registry indices", () => {
        const invalidEnum = cloneManifest()
        const enumParameter = modulesOf(invalidEnum)
            .flatMap(module => module.parameters as JsonRecord[])
            .find(parameter => parameter.control === "enum")
        if (enumParameter === undefined) throw new Error("The generated catalog must contain an enum parameter.")
        enumParameter.enum_values = []
        expect(() => parseLibraryManifest(invalidEnum)).toThrow(/enum_values/)

        const invalidRegistryIndex = cloneManifest()
        const runtime = modulesOf(invalidRegistryIndex)[0]!.runtime as JsonRecord
        runtime.registry_index = -1
        expect(() => parseLibraryManifest(invalidRegistryIndex)).toThrow(/registry_index/)
    })

    it("rejects unsupported controls, scales, and transitions", () => {
        const invalidControl = cloneManifest()
        firstParameterOf(invalidControl).control = "unsupported"
        expect(() => parseLibraryManifest(invalidControl)).toThrow(/unsupported control/)

        const invalidScale = cloneManifest()
        firstParameterOf(invalidScale).scale = "unsupported"
        expect(() => parseLibraryManifest(invalidScale)).toThrow(/unsupported scale/)

        const invalidTransition = cloneManifest()
        firstParameterOf(invalidTransition).transition = "unsupported"
        expect(() => parseLibraryManifest(invalidTransition)).toThrow(/unsupported transition/)
    })
})
