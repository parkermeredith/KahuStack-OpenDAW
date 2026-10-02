import {Option, type unitValue} from "@opendaw/lib-std"
import type {KahuParameterManifest} from "../kahu-runtime"
import {controlValueToParameterValue, editorKind, formatParameterValue, parameterValueToControlValue, quantizeParameterValue} from "../parameter-editor"
import {ValueDragging} from "./value-dragging"
import "./kahu-parameter-knob.sass"

export type KahuParameterKnobOptions = Readonly<{
    parameter: KahuParameterManifest
    getValue: () => number
    setValue: (value: number) => void
    disabled?: boolean
}>

const SvgNamespace = "http://www.w3.org/2000/svg"
const clampUnit = (value: number): unitValue => Math.min(1, Math.max(0, value))

const valueToUnit = (parameter: KahuParameterManifest, value: number): unitValue => {
    if (editorKind(parameter) === "logarithmic") return clampUnit(parameterValueToControlValue(parameter, value))
    const span = parameter.max - parameter.min
    return span <= 0 ? 0 : clampUnit((value - parameter.min) / span)
}

const unitToValue = (parameter: KahuParameterManifest, value: unitValue): number => {
    if (editorKind(parameter) === "logarithmic") return controlValueToParameterValue(parameter, clampUnit(value))
    return quantizeParameterValue(parameter, parameter.min + clampUnit(value) * (parameter.max - parameter.min))
}

export const createKahuParameterKnob = (options: KahuParameterKnobOptions): HTMLElement => {
    const {parameter} = options
    const root = document.createElement("div")
    root.className = "kahu-parameter-knob"
    const label = document.createElement("span")
    label.className = "kahu-parameter-knob-label"
    label.textContent = parameter.name
    const button = document.createElement("button")
    button.type = "button"
    button.className = "kahu-parameter-knob-control"
    button.disabled = options.disabled === true
    button.title = `${parameter.key} · ${parameter.automation} · ${parameter.transition}`
    button.setAttribute("role", "slider")
    button.setAttribute("aria-label", parameter.name)
    button.setAttribute("aria-valuemin", parameter.min.toString())
    button.setAttribute("aria-valuemax", parameter.max.toString())
    const svg = document.createElementNS(SvgNamespace, "svg")
    svg.setAttribute("viewBox", "0 0 40 36")
    svg.setAttribute("aria-hidden", "true")
    svg.classList.add("kahu-parameter-knob-svg")
    const shadow = document.createElementNS(SvgNamespace, "circle")
    shadow.setAttribute("cx", "20")
    shadow.setAttribute("cy", "20")
    shadow.setAttribute("r", "11")
    shadow.classList.add("kahu-parameter-knob-shadow")
    const dial = document.createElementNS(SvgNamespace, "circle")
    dial.setAttribute("cx", "20")
    dial.setAttribute("cy", "19")
    dial.setAttribute("r", "10")
    dial.classList.add("kahu-parameter-knob-dial")
    const track = document.createElementNS(SvgNamespace, "circle")
    track.setAttribute("cx", "20")
    track.setAttribute("cy", "19")
    track.setAttribute("r", "15")
    track.setAttribute("pathLength", "100")
    track.setAttribute("stroke-dasharray", "75 25")
    track.setAttribute("transform", "rotate(135 20 19)")
    track.classList.add("kahu-parameter-knob-track")
    const valueArc = document.createElementNS(SvgNamespace, "circle")
    valueArc.setAttribute("cx", "20")
    valueArc.setAttribute("cy", "19")
    valueArc.setAttribute("r", "15")
    valueArc.setAttribute("pathLength", "100")
    valueArc.setAttribute("transform", "rotate(135 20 19)")
    valueArc.classList.add("kahu-parameter-knob-value-arc")
    const indicator = document.createElementNS(SvgNamespace, "line")
    indicator.setAttribute("x1", "20")
    indicator.setAttribute("y1", "19")
    indicator.setAttribute("x2", "20")
    indicator.setAttribute("y2", "11")
    indicator.classList.add("kahu-parameter-knob-indicator")
    svg.append(shadow, track, valueArc, dial, indicator)
    button.append(svg)
    const readout = document.createElement("input")
    readout.className = "kahu-parameter-knob-readout"
    readout.type = "text"
    readout.disabled = options.disabled === true
    readout.setAttribute("aria-label", `${parameter.name} exact value`)
    root.append(label, button, readout)
    let previewValue: number | undefined
    let pendingValue: number | undefined
    let animationFrame: number | undefined
    const currentValue = (): number => previewValue ?? options.getValue()
    const render = (value: number): void => {
        const safe = quantizeParameterValue(parameter, value)
        const normalized = valueToUnit(parameter, safe)
        valueArc.setAttribute("stroke-dasharray", `${normalized * 75} 100`)
        indicator.setAttribute("transform", `rotate(${-135 + normalized * 270} 20 19)`)
        button.setAttribute("aria-valuenow", safe.toString())
        button.setAttribute("aria-valuetext", formatParameterValue(parameter, safe))
        if (document.activeElement !== readout) readout.value = formatParameterValue(parameter, safe)
    }
    const clearScheduled = (): void => {
        if (animationFrame !== undefined) cancelAnimationFrame(animationFrame)
        animationFrame = undefined
        pendingValue = undefined
    }
    const scheduleRealtimeValue = (value: number): void => {
        pendingValue = value
        if (animationFrame !== undefined) return
        animationFrame = requestAnimationFrame(() => {
            animationFrame = undefined
            const pending = pendingValue
            pendingValue = undefined
            if (pending !== undefined) options.setValue(pending)
        })
    }
    const commit = (value: number): void => {
        const safe = quantizeParameterValue(parameter, value)
        clearScheduled()
        previewValue = undefined
        options.setValue(safe)
        render(safe)
    }
    ValueDragging.installUnitValueRelativeDragging(() => Option.wrap(new class implements ValueDragging.Process {
        start(): unitValue {return valueToUnit(parameter, options.getValue())}
        modify(value: unitValue): void {
            const next = unitToValue(parameter, value)
            previewValue = next
            if (parameter.automation !== "reprepare") scheduleRealtimeValue(next)
            render(next)
        }
        finalise(_previous: unitValue, value: unitValue): void {
            void _previous
            commit(unitToValue(parameter, value))
        }
        cancel(): void {
            clearScheduled()
            previewValue = undefined
            render(options.getValue())
        }
    }), button, {horizontal: false, ratio: 1.5})
    button.ondblclick = event => {
        event.preventDefault()
        commit(parameter.default)
    }
    button.onkeydown = event => {
        const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1
                : 0
        if (event.key === "Enter") {
            event.preventDefault()
            readout.focus()
            readout.select()
        } else if (event.key === "Home") {
            event.preventDefault()
            commit(parameter.min)
        } else if (event.key === "End") {
            event.preventDefault()
            commit(parameter.max)
        } else if (direction !== 0) {
            event.preventDefault()
            const multiplier = event.shiftKey ? 10 : 1
            commit(currentValue() + direction * parameter.step * multiplier)
        }
    }
    readout.onfocus = () => {
        const multiplier = parameter.display_multiplier ?? 1
        readout.value = (currentValue() * multiplier).toString()
    }
    readout.onblur = () => {
        const multiplier = parameter.display_multiplier ?? 1
        const numeric = Number(readout.value)
        if (Number.isFinite(numeric) && multiplier !== 0) commit(numeric / multiplier)
        else render(options.getValue())
    }
    readout.onkeydown = event => {
        if (event.key === "Enter") {
            event.preventDefault()
            readout.blur()
        } else if (event.key === "Escape") {
            event.preventDefault()
            clearScheduled()
            previewValue = undefined
            render(options.getValue())
            readout.blur()
        }
    }
    render(options.getValue())
    return root
}
