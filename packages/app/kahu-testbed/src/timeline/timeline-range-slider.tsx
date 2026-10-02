// KUI-4 range navigator: reduced openDAW TimelineRangeSlider behavior for the Kahu seconds range.
// Handles edit normalized min/max, the center pans, empty track clicks recenter, and double-click
// returns to the complete duration.

import {TimelineRange} from "@opendaw/studio-core"
import {Option, Terminator, type unitValue} from "@opendaw/lib-std"
import {ValueDragging} from "../ui/value-dragging"

export type RangeSliderPart = "min" | "max" | "center"

export const modifyRangeSliderPart = (range: TimelineRange, part: RangeSliderPart, value: number): void => {
    if (part === "min") range.min = value
    else if (part === "max") range.max = value
    else range.center = value
}

export const recenterRangeSlider = (range: TimelineRange, normalizedCenter: number): void => {
    range.center = normalizedCenter
}

export const showAllFromRangeSlider = (range: TimelineRange): void => {
    range.showAll()
}

export const createTimelineRangeSlider = (range: TimelineRange): HTMLElement => {
    const root = document.createElement("div")
    root.className = "timeline-range-slider"
    const slider = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    slider.classList.add("slider")
    slider.setAttribute("shape-rendering", "geometricPrecision")
    root.append(slider)
    const radius = 5
    const padding = radius * 2
    const leftHandle = document.createElementNS("http://www.w3.org/2000/svg", "path")
    leftHandle.setAttribute("d", `M ${radius} 0h ${radius}v ${radius * 2}h -${radius}a ${radius} ${radius} 0 0 1 -${radius} -${radius}a ${radius} ${radius} 0 0 1 ${radius} -${radius}`)
    leftHandle.setAttribute("fill", "rgba(255,255,255,0.25)")
    const rightHandle = document.createElementNS("http://www.w3.org/2000/svg", "path")
    rightHandle.setAttribute("d", `M ${radius * 2} 0h ${radius}a ${radius} ${radius} 0 0 1 0 ${radius * 2}h ${-radius}v ${-radius * 2}`)
    rightHandle.setAttribute("fill", "rgba(255,255,255,0.25)")
    const body = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    body.setAttribute("height", `${radius * 2}`)
    body.setAttribute("fill", "rgba(255,255,255,0.125)")
    slider.append(leftHandle, rightHandle, body)
    const dragLifetime = new Terminator()

    const computeSize = () => {
        const clientWidth = slider.clientWidth
        const clientHeight = slider.clientHeight
        return {clientWidth, clientHeight, trackLength: Math.max(1, clientWidth - padding * 2)}
    }
    const update = (): void => {
        if (!slider.isConnected) return
        const {trackLength} = computeSize()
        const x0 = Math.floor(range.min * trackLength)
        const x1 = Math.floor(range.max * trackLength)
        leftHandle.setAttribute("transform", `translate(${x0}, 0)`)
        rightHandle.setAttribute("transform", `translate(${x1}, 0)`)
        body.setAttribute("x", `${x0 + padding}`)
        body.setAttribute("width", `${Math.max(0, x1 - x0)}`)
    }
    const installDragging = (): void => {
        const {clientWidth, clientHeight, trackLength} = computeSize()
        if (clientWidth === 0 || clientHeight === 0) return
        slider.setAttribute("viewBox", `0 0 ${clientWidth} ${clientHeight}`)
        dragLifetime.terminate()
        dragLifetime.own(ValueDragging.installUnitValueRelativeDragging((event: PointerEvent) => {
            const part = event.target === leftHandle ? "min" : event.target === rightHandle ? "max" : "center"
            return Option.wrap(new class implements ValueDragging.Process {
                start(): unitValue {
                    if (part === "min") return range.min
                    if (part === "max") return range.max
                    if (event.target === slider) {
                        const rect = slider.getBoundingClientRect()
                        const normalized = (event.clientX - rect.left - padding) / trackLength
                        return range.center = normalized
                    }
                    return range.center
                }
                modify(value: unitValue): void {
                    modifyRangeSliderPart(range, part, value)
                }
                cancel(prevValue: unitValue): void {void prevValue}
                finalise(prevValue: unitValue, newValue: unitValue): void {
                    void prevValue
                    void newValue
                }
            })
        }, slider, {horizontal: true, trackLength, ratio: 1.0}))
        update()
    }

    const resizeObserver = new ResizeObserver(installDragging)
    resizeObserver.observe(slider)
    range.subscribe(update)
    slider.addEventListener("dblclick", () => showAllFromRangeSlider(range))
    installDragging()
    return root
}
