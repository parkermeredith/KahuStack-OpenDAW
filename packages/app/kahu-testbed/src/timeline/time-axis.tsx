// KUI-3 time-axis authority: paints an adaptive seconds ruler from TimelineRange and translates
// pointer scrubbing through the existing sample-clock Transport boundary.

import {TimelineRange} from "@opendaw/studio-core"
import {attachWheelScroll} from "./wheel-scroll"

export const TickIntervalsSeconds = [
    0.01, 0.02, 0.05,
    0.1, 0.2, 0.5,
    1, 2, 5, 10, 15, 30,
    60, 120, 300, 600,
] as const

export const selectTickInterval = (visibleDurationSeconds: number, canvasWidth: number): number => {
    const safeWidth = Math.max(1, canvasWidth)
    const ideal = Math.max(0, visibleDurationSeconds) / (safeWidth / 80)
    return TickIntervalsSeconds.find(interval => interval >= ideal)
        ?? TickIntervalsSeconds[TickIntervalsSeconds.length - 1]
}

export const formatTimeAxisLabel = (seconds: number, interval: number): string => {
    const safeSeconds = Math.max(0, seconds)
    if (interval < 1) {
        const hundredths = Math.round(safeSeconds * 100)
        const minutes = Math.floor(hundredths / 6000)
        const remaining = hundredths % 6000
        return `${minutes}:${Math.floor(remaining / 100).toString().padStart(2, "0")}.${(remaining % 100).toString().padStart(2, "0")}`
    }
    const wholeSeconds = Math.floor(safeSeconds)
    const secondsPart = wholeSeconds % 60
    const minutesTotal = Math.floor(wholeSeconds / 60)
    if (interval >= 60) {
        const hours = Math.floor(minutesTotal / 60)
        const minutes = minutesTotal % 60
        return hours > 0
            ? `${hours}:${minutes.toString().padStart(2, "0")}:${secondsPart.toString().padStart(2, "0")}`
            : `${minutesTotal}:${secondsPart.toString().padStart(2, "0")}`
    }
    return `${minutesTotal}:${secondsPart.toString().padStart(2, "0")}`
}

export type TimeAxisHandle = Readonly<{
    element: HTMLElement
    updatePosition: (positionSeconds: number) => void
}>

export type TimeAxisOptions = Readonly<{
    range: TimelineRange
    getPosition: () => number
    onSeek: (positionSeconds: number) => void
}>

export const createTimeAxis = ({range, getPosition, onSeek}: TimeAxisOptions): TimeAxisHandle => {
    const element = document.createElement("div")
    element.className = "kahu-time-axis"
    element.tabIndex = -1
    const canvas = document.createElement("canvas")
    canvas.className = "kahu-time-axis-canvas"
    canvas.setAttribute("aria-label", "Timeline seconds ruler")
    const cursor = document.createElement("div")
    cursor.className = "kahu-time-axis-cursor"
    cursor.setAttribute("aria-hidden", "true")
    element.append(canvas, cursor)

    let dragging = false
    const paint = (): void => {
        if (!canvas.isConnected) return
        const logicalWidth = Math.max(1, canvas.clientWidth || element.clientWidth)
        const logicalHeight = Math.max(1, canvas.clientHeight || element.clientHeight)
        const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
        const width = Math.max(1, Math.floor(logicalWidth * dpr))
        const height = Math.max(1, Math.floor(logicalHeight * dpr))
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
        }
        range.width = logicalWidth
        const context = canvas.getContext("2d")
        if (context === null) return
        context.clearRect(0, 0, width, height)
        context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-gray")
        context.strokeStyle = "rgba(255,255,255,0.12)"
        context.lineWidth = dpr
        context.font = `${Math.max(8, Math.floor(10 * dpr))}px Rubik, sans-serif`
        context.textBaseline = "top"
        const interval = selectTickInterval(range.unitRange, logicalWidth)
        const subdivisions = interval >= 1 ? 4 : 5
        const minor = interval / subdivisions
        const first = Math.max(0, Math.floor(range.unitMin / minor) * minor)
        const last = Math.min(range.maxUnits, range.unitMax + minor)
        for (let seconds = first; seconds <= last + minor * 0.5; seconds += minor) {
            const x = range.unitToX(seconds)
            if (x < -1 || x > logicalWidth + 1) continue
            const major = Math.abs(seconds / interval - Math.round(seconds / interval)) < 1e-6
            const px = Math.floor(x * dpr) + 0.5
            context.beginPath()
            context.moveTo(px, major ? 0 : height * 0.48)
            context.lineTo(px, height)
            context.stroke()
            if (major) {
                context.fillText(formatTimeAxisLabel(seconds, interval), px + 4 * dpr, 3 * dpr)
            }
        }
    }

    const updatePosition = (positionSeconds: number): void => {
        const x = range.unitToX(positionSeconds)
        cursor.style.left = `${x}px`
        cursor.style.visibility = x >= 0 && x <= range.width ? "visible" : "hidden"
    }

    const seekFromPointer = (event: PointerEvent): void => {
        const rect = canvas.getBoundingClientRect()
        const position = Math.min(range.maxUnits, Math.max(0, range.xToUnit(event.clientX - rect.left)))
        onSeek(position)
        updatePosition(position)
    }

    canvas.addEventListener("pointerdown", event => {
        if (event.button !== 0) return
        dragging = true
        canvas.setPointerCapture(event.pointerId)
        event.preventDefault()
        seekFromPointer(event)
    })
    canvas.addEventListener("pointermove", event => {
        if (dragging) seekFromPointer(event)
    })
    canvas.addEventListener("pointerup", event => {
        dragging = false
        canvas.releasePointerCapture(event.pointerId)
    })
    canvas.addEventListener("pointercancel", () => {dragging = false})
    attachWheelScroll(canvas, range)

    const resizeObserver = new ResizeObserver(paint)
    resizeObserver.observe(element)
    range.subscribe(() => {
        paint()
        updatePosition(getPosition())
    })
    element.addEventListener("dblclick", () => range.showAll())
    paint()
    updatePosition(getPosition())
    return {element, updatePosition}
}
