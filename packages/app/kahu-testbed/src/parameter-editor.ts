// KBW-2 pure parameter-editor contract: maps canonical metadata to bounded browser control values.
// It formats display values only; parameter meaning, range, scale, transition, and automation remain
// owned by the parent-generated manifest and the Rust runtime.

import type {KahuParameterManifest} from "./kahu-runtime"

export type ParameterEditorKind = "continuous" | "logarithmic" | "decibels" | "boolean" | "enum"

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const decimalsFromStep = (step: number): number => {
    if (!Number.isFinite(step) || step <= 0) return 2
    return Math.min(6, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)))
}

export const editorKind = (parameter: KahuParameterManifest): ParameterEditorKind => {
    if (parameter.control === "boolean" || parameter.scale === "boolean") return "boolean"
    if (parameter.control === "enum" || parameter.scale === "enum") return "enum"
    if (parameter.scale === "logarithmic") return "logarithmic"
    if (parameter.scale === "decibels") return "decibels"
    return "continuous"
}

export const parameterValueToControlValue = (parameter: KahuParameterManifest, value: number): number => {
    const safeValue = clamp(value, parameter.min, parameter.max)
    if (editorKind(parameter) !== "logarithmic" || parameter.min <= 0 || parameter.max <= parameter.min) {
        return safeValue
    }
    return clamp(Math.log(safeValue / parameter.min) / Math.log(parameter.max / parameter.min), 0, 1)
}

export const controlValueToParameterValue = (parameter: KahuParameterManifest, controlValue: number): number => {
    const kind = editorKind(parameter)
    if (kind === "boolean") return controlValue >= 0.5 ? 1 : 0
    if (kind === "enum") {
        const index = Math.round(controlValue)
        return clamp(parameter.min + index * parameter.step, parameter.min, parameter.max)
    }
    if (kind === "logarithmic" && parameter.min > 0 && parameter.max > parameter.min) {
        const value = parameter.min * Math.pow(parameter.max / parameter.min, clamp(controlValue, 0, 1))
        return quantizeParameterValue(parameter, value)
    }
    return quantizeParameterValue(parameter, controlValue)
}

export const quantizeParameterValue = (parameter: KahuParameterManifest, value: number): number => {
    const clamped = clamp(value, parameter.min, parameter.max)
    const steps = Math.round((clamped - parameter.min) / parameter.step)
    return clamp(parameter.min + steps * parameter.step, parameter.min, parameter.max)
}

export const enumLabel = (parameter: KahuParameterManifest, value: number): string | undefined => {
    if (parameter.control !== "enum" || parameter.enum_values === undefined) return undefined
    const index = Math.round((value - parameter.min) / parameter.step)
    return parameter.enum_values[index]
}

export const formatParameterValue = (parameter: KahuParameterManifest, value: number): string => {
    const kind = editorKind(parameter)
    if (kind === "boolean") return value >= 0.5 ? "On" : "Off"
    const label = enumLabel(parameter, value)
    if (label !== undefined) return label
    const multiplier = parameter.display_multiplier ?? 1
    const decimals = parameter.display_decimals ?? decimalsFromStep(parameter.step * Math.abs(multiplier))
    const unit = parameter.display_unit ?? (kind === "decibels" ? "dB" : parameter.unit)
    const rendered = (value * multiplier).toFixed(decimals)
    return unit.length > 0 ? `${rendered} ${unit}` : rendered
}

export const controlStep = (parameter: KahuParameterManifest): string => {
    const kind = editorKind(parameter)
    if (kind === "boolean") return "1"
    if (kind === "enum") return "1"
    if (kind === "logarithmic") return "0.001"
    return parameter.step.toString()
}
