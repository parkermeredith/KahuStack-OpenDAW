// KBW-1 permanent contract tests: the browser host accepts only the parent-owned manifest semantics.

import {readFileSync} from "node:fs"
import {describe, expect, it} from "vitest"
import {parseLibraryManifest} from "./generated/kahu-manifest-runtime"

type JsonRecord = Record<string, unknown>

const manifestPath = new URL("../public/kahu-runtime/library-manifest.json", import.meta.url)
const baseline = JSON.parse(readFileSync(manifestPath, "utf8")) as JsonRecord

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
    it("parses the staged generated manifest with the parent validator", () => {
        const catalog = parseLibraryManifest(baseline)
        expect(catalog.moduleCount).toBe(catalog.modules.length)
        expect(catalog.modules.find(module => module.id === "utility.gain")?.runtime.registry_index).toBe(43)
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
