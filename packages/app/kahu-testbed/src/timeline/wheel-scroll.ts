// KUI-2 wheel navigation authority: routes openDAW's horizontal modifier and trackpad gestures to
// TimelineRange, leaving unmodified vertical wheel input available for track scrolling.

import {TimelineRange} from "@opendaw/studio-core"
import * as WheelScaling from "./wheel-scaling"

export const moveByWheelPixels = (range: TimelineRange, event: WheelEvent): void =>
    range.moveUnitBy(WheelScaling.pixelsOf(event) * range.unitsPerPixel)

export const attachWheelScroll = (element: Element, range: TimelineRange): (() => void) => {
    const listener = (event: Event): void => {
        const wheelEvent = event as WheelEvent
        if (wheelEvent.shiftKey) {
            wheelEvent.preventDefault()
            wheelEvent.stopPropagation()
            WheelScaling.apply(element, range, wheelEvent)
            return
        }
        if (wheelEvent.altKey) {
            wheelEvent.preventDefault()
            wheelEvent.stopPropagation()
            moveByWheelPixels(range, wheelEvent)
            return
        }
        const deltaX = wheelEvent.deltaX
        const threshold = 1.0
        const clamped = Math.max(deltaX - threshold, 0.0) + Math.min(deltaX + threshold, 0.0)
        if (Math.abs(clamped) > 0) {
            wheelEvent.preventDefault()
            range.moveBy(clamped * 0.0001)
        }
    }
    element.addEventListener("wheel", listener, {passive: false})
    return () => element.removeEventListener("wheel", listener)
}
