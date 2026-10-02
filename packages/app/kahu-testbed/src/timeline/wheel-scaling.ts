// KUI-2 wheel authority: preserves openDAW's device-normalized, pointer-anchored timeline zoom
// while removing the Studio preference dependency from the reduced Kahu workbench.

import {TimelineRange} from "@opendaw/studio-core"

export const DeltaModeToPixels: ReadonlyArray<number> = [1.0, 33.0, 400.0]
export const QuantumFloor = 2.0
export const QuantumDecayMs = 300.0
export const StepPerTick = 0.1

const calibration = {quantum: 0.0, time: 0.0}

export const pixelsOf = (event: WheelEvent): number =>
    event.deltaY * (DeltaModeToPixels[event.deltaMode] ?? 1.0)

export const scaleOf = (event: WheelEvent): number => {
    const delta = pixelsOf(event)
    if (delta === 0.0) return 0.0
    const time = performance.now()
    const decayed = calibration.quantum * Math.exp((calibration.time - time) / QuantumDecayMs)
    calibration.quantum = Math.max(Math.abs(delta), decayed, QuantumFloor)
    calibration.time = time
    const speed = 1.0
    return delta / calibration.quantum * StepPerTick * speed
}

export const apply = (element: Element, range: TimelineRange, event: WheelEvent): void => {
    const rect = element.getBoundingClientRect()
    const pointerValue = range.xToValue(event.clientX - rect.left)
    const anchor = Math.min(range.max, Math.max(range.min, pointerValue))
    range.scaleBy(scaleOf(event), anchor)
}

export const install = (element: Element, range: TimelineRange): (() => void) => {
    const listener = (event: Event): void => {
        const wheelEvent = event as WheelEvent
        wheelEvent.preventDefault()
        apply(element, range, wheelEvent)
    }
    element.addEventListener("wheel", listener, {passive: false})
    return () => element.removeEventListener("wheel", listener)
}
