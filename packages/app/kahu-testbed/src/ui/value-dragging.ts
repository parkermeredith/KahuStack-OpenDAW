// KUI-4 control primitive: the openDAW relative-value drag contract, extracted for Kahu range and
// parameter controls without importing Studio application-private modules.

import {Dragging, type PointerCaptureTarget} from "@opendaw/lib-dom"
import {Func, Option, safeExecute, Terminable, unitValue, ValueGuide} from "@opendaw/lib-std"

// The openDAW extraction intentionally groups this primitive under a namespace-like API.
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ValueDragging {
    export interface Process {
        start(): unitValue
        modify(value: unitValue): void
        finalise(prevValue: unitValue, newValue: unitValue): void
        cancel(prevValue: unitValue): void
        finally?(): void
        abortSignal?: AbortSignal
    }

    export const installUnitValueRelativeDragging = (
        factory: Func<PointerEvent, Option<Process>>,
        target: PointerCaptureTarget,
        options?: ValueGuide.Options,
    ): Terminable => Dragging.attach(target, (event: PointerEvent) => {
        const optProcess = factory(event)
        if (optProcess.isEmpty()) return Option.None
        const process = optProcess.unwrap()
        const startValue = process.start()
        if (!Number.isFinite(startValue)) {
            console.warn(`ValueDragging: start() returned non-finite value (${startValue}); aborting drag`)
            safeExecute(process.finally)
            return Option.None
        }
        const horizontal = options?.horizontal === true
        const guide = ValueGuide.create(options)
        if (event.shiftKey) guide.disable()
        else guide.enable()
        guide.begin(startValue)
        guide.ratio(event.altKey ? 0.25 : options?.ratio ?? 1.5)
        let pointer = horizontal ? event.clientX : -event.clientY
        return Option.wrap({
            abortSignal: process.abortSignal,
            update: (dragEvent: Dragging.Event): void => {
                if (dragEvent.shiftKey) guide.disable()
                else guide.enable()
                guide.ratio(dragEvent.altKey ? 0.25 : options?.ratio ?? 1.5)
                const newPointer = horizontal ? dragEvent.clientX : -dragEvent.clientY
                guide.moveBy(newPointer - pointer)
                pointer = newPointer
                process.modify(guide.value())
            },
            approve: () => process.finalise(startValue, guide.value()),
            cancel: () => process.cancel(startValue),
            finally: () => safeExecute(process.finally),
        })
    }, {pointerLock: true})
}
