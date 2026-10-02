// KUI-9 control primitive: provides the compact OpenDAW button/toggle interaction model for
// dynamically rendered Kahu controls while keeping action ownership in the workbench composition.

import {Icon} from "@opendaw/studio-icons"
import {IconSymbol} from "@opendaw/studio-enums"
import {Option, type unitValue} from "@opendaw/lib-std"
import {ValueDragging} from "./value-dragging"

export type OpenDAWButtonOptions = Readonly<{
    symbol: IconSymbol
    label: string
    onClick: (event: MouseEvent) => void
    className?: string
    disabled?: boolean
}>

export const createOpenDAWIconButton = ({symbol, label, onClick, className, disabled}: OpenDAWButtonOptions): HTMLButtonElement => {
    const button = document.createElement("button")
    button.type = "button"
    button.className = `opendaw-button${className === undefined ? "" : ` ${className}`}`
    button.title = label
    button.setAttribute("aria-label", label)
    button.disabled = disabled === true
    button.append(Icon({symbol, className: "opendaw-button-icon"}))
    button.onclick = onClick
    return button
}

export type OpenDAWToggleOptions = Readonly<{
    symbol: IconSymbol
    label: string
    active: boolean
    onChange: (active: boolean, event: MouseEvent) => void
    className?: string
    disabled?: boolean
}>

export const setOpenDAWToggleState = (button: HTMLButtonElement, active: boolean): void => {
    button.classList.toggle("active", active)
    button.setAttribute("aria-pressed", active ? "true" : "false")
}

export const createOpenDAWToggle = ({symbol, label, active, onChange, className, disabled}: OpenDAWToggleOptions): HTMLButtonElement => {
    const button = createOpenDAWIconButton({symbol, label, className: `opendaw-toggle${className === undefined ? "" : ` ${className}`}`, disabled, onClick: event => {
        const next = !button.classList.contains("active")
        setOpenDAWToggleState(button, next)
        onChange(next, event)
    }})
    setOpenDAWToggleState(button, active)
    return button
}

export type OpenDAWValueControlOptions = Readonly<{
    min: number
    max: number
    step: number
    getValue: () => number
    setValue: (value: number) => void
    formatValue: (value: number) => string
    label: string
    className?: string
    disabled?: boolean
    horizontal?: boolean
    commitOnFinalise?: boolean
}>

const clampUnit = (value: unitValue): unitValue => Math.min(1, Math.max(0, value))

export const createOpenDAWValueControl = (options: OpenDAWValueControlOptions): HTMLButtonElement => {
    const button = document.createElement("button")
    button.type = "button"
    button.className = `opendaw-value-control${options.className === undefined ? "" : ` ${options.className}`}`
    button.title = options.label
    button.setAttribute("aria-label", options.label)
    button.setAttribute("role", "slider")
    button.tabIndex = 0
    button.disabled = options.disabled === true
    const span = document.createElement("span")
    span.className = "opendaw-value-text"
    button.append(span)

    const spanValue = (): number => Math.max(0, options.max - options.min)
    const toUnit = (value: number): unitValue => spanValue() <= 0 ? 0 : clampUnit((value - options.min) / spanValue())
    const fromUnit = (value: unitValue): number => options.min + clampUnit(value) * spanValue()
    const render = (value: number): void => {
        span.textContent = options.formatValue(value)
        button.setAttribute("aria-valuemin", options.min.toString())
        button.setAttribute("aria-valuemax", options.max.toString())
        button.setAttribute("aria-valuenow", value.toString())
    }
    const refresh = (): void => render(Math.min(options.max, Math.max(options.min, options.getValue())))
    const setValue = (value: number): void => {
        const safe = Math.min(options.max, Math.max(options.min, value))
        options.setValue(safe)
        render(safe)
    }

    ValueDragging.installUnitValueRelativeDragging(() => Option.wrap(new class implements ValueDragging.Process {
        start(): unitValue {return toUnit(options.getValue())}
        modify(value: unitValue): void {
            const safe = fromUnit(value)
            if (options.commitOnFinalise !== true) options.setValue(safe)
            render(safe)
        }
        finalise(_previous: unitValue, value: unitValue): void {
            void _previous
            setValue(fromUnit(value))
        }
        cancel(): void {refresh()}
    }), button, {horizontal: options.horizontal ?? true, ratio: 1.5})

    button.onkeydown = event => {
        const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1
                : 0
        if (event.key === "Home") {
            event.preventDefault()
            setValue(options.min)
        } else if (event.key === "End") {
            event.preventDefault()
            setValue(options.max)
        } else if (direction !== 0) {
            event.preventDefault()
            const step = Number.isFinite(options.step) && options.step > 0 ? options.step : spanValue() / 100
            setValue(options.getValue() + direction * step * (event.shiftKey ? 10 : 1))
        }
    }
    refresh()
    return button
}
