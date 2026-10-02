// KUI-3 timeline navigation composition: keeps the seconds ruler as a focused child of the shared
// range navigation strip, leaving track lanes responsible only for audio content.

import {TimelineRange} from "@opendaw/studio-core"
import {createTimeAxis, type TimeAxisHandle} from "./time-axis"

export type TimelineNavigationHandle = Readonly<{
    element: HTMLElement
    timeAxis: TimeAxisHandle
}>

export const createTimelineNavigation = (
    range: TimelineRange,
    getPosition: () => number,
    onSeek: (positionSeconds: number) => void,
): TimelineNavigationHandle => {
    const element = document.createElement("div")
    element.className = "timeline-navigation"
    const timeAxis = createTimeAxis({range, getPosition, onSeek})
    element.append(timeAxis.element)
    return {element, timeAxis}
}
