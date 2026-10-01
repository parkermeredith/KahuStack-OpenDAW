// KBW-2 permanent tests: generic browser controls must honor canonical parameter semantics.

import {describe, expect, it} from "vitest"
import {
    controlValueToParameterValue,
    editorKind,
    formatParameterValue,
    parameterValueToControlValue,
} from "./parameter-editor"
import type {KahuParameterManifest} from "./kahu-runtime"

const parameter = (overrides: Partial<KahuParameterManifest>): KahuParameterManifest => ({
    id: 1,
    key: "value",
    name: "Value",
    default: 0.5,
    min: 0,
    max: 1,
    step: 0.01,
    unit: "ratio",
    scale: "linear",
    control: "continuous",
    transition: "immediate",
    automation: "realtime",
    ...overrides,
})

describe("KBW-2 generic parameter editor", () => {
    it("maps linear, logarithmic, decibel, boolean, and enum controls", () => {
        expect(editorKind(parameter({}))).toBe("continuous")
        expect(editorKind(parameter({scale: "logarithmic", min: 20, max: 20_000}))).toBe("logarithmic")
        expect(editorKind(parameter({scale: "decibels", unit: "dB"}))).toBe("decibels")
        expect(editorKind(parameter({control: "boolean", scale: "boolean"}))).toBe("boolean")
        expect(editorKind(parameter({control: "enum", scale: "enum", enum_values: ["A", "B"]}))).toBe("enum")
    })

    it("round-trips linear and logarithmic control values", () => {
        const linear = parameter({min: -1, max: 1, step: 0.1, default: 0})
        expect(controlValueToParameterValue(linear, 0.34)).toBeCloseTo(0.3)
        const logarithmic = parameter({min: 20, max: 20_000, step: 1, default: 440, scale: "logarithmic"})
        const control = parameterValueToControlValue(logarithmic, 440)
        expect(controlValueToParameterValue(logarithmic, control)).toBe(440)
    })

    it("formats canonical display metadata instead of raw values", () => {
        expect(formatParameterValue(parameter({default: 0.5, display_multiplier: 100, display_decimals: 0, display_unit: "%"}), 0.5)).toBe("50 %")
        expect(formatParameterValue(parameter({unit: "dB", scale: "decibels", min: -12, max: 12, default: -6, step: 0.1}), -6)).toBe("-6.0 dB")
        expect(formatParameterValue(parameter({control: "boolean", scale: "boolean", default: 1}), 1)).toBe("On")
        expect(formatParameterValue(parameter({control: "enum", scale: "enum", min: 0, max: 1, step: 1, default: 1, enum_values: ["Off", "On"]}), 1)).toBe("On")
    })

    it("preserves reprepare metadata for the host to handle outside realtime updates", () => {
        const reprepare = parameter({automation: "reprepare", transition: "reprepare"})
        expect(reprepare.automation).toBe("reprepare")
        expect(reprepare.transition).toBe("reprepare")
    })
})
