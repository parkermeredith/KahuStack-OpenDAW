// KUI-8 shortcut authority: implements only the openDAW transport subset and suppresses it while a
// text, number, or select control owns keyboard input.

export type TransportShortcutActions = Readonly<{
    togglePlayback: () => void
    stop: () => void
    movePosition: (direction: -1 | 1) => void
    toggleLoop: () => void
    toggleFollow: () => void
}>

export const isTextEditingTarget = (target: EventTarget | null): boolean => {
    if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false
    return target.isContentEditable
        || target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
}

export const dispatchTransportShortcut = (
    event: Pick<KeyboardEvent, "key" | "code" | "shiftKey" | "preventDefault" | "target">,
    actions: TransportShortcutActions,
): boolean => {
    if (isTextEditingTarget(event.target)) return false
    if (event.key === " " || event.code === "Space") {
        event.preventDefault()
        actions.togglePlayback()
        return true
    }
    if (event.key === "." || event.code === "Period") {
        event.preventDefault()
        actions.stop()
        return true
    }
    if (event.key === "ArrowLeft") {
        event.preventDefault()
        actions.movePosition(-1)
        return true
    }
    if (event.key === "ArrowRight") {
        event.preventDefault()
        actions.movePosition(1)
        return true
    }
    if (event.shiftKey && (event.key.toLowerCase() === "l" || event.code === "KeyL")) {
        event.preventDefault()
        actions.toggleLoop()
        return true
    }
    if (event.shiftKey && (event.key.toLowerCase() === "f" || event.code === "KeyF")) {
        event.preventDefault()
        actions.toggleFollow()
        return true
    }
    return false
}
