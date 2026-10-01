// KBW-5 worker boundary: builds peak data away from the UI thread and transfers typed-array levels back.

import {buildWaveformPyramid} from "./waveform"

type BuildMessage = Readonly<{type: "build", samples: Float32Array}>
type WorkerScope = {
    onmessage: ((event: MessageEvent<BuildMessage>) => void) | null
    postMessage: (message: unknown, transfer?: Transferable[]) => void
}

const workerScope = self as unknown as WorkerScope

workerScope.onmessage = event => {
    const message = event.data as BuildMessage
    if (message.type !== "build") return
    try {
        const pyramid = buildWaveformPyramid(message.samples)
        const transferables = pyramid.levels
            .flatMap(level => [level.minimum.buffer, level.maximum.buffer])
            .map(buffer => buffer as ArrayBuffer)
        workerScope.postMessage({type: "ready", pyramid}, transferables)
    } catch (error) {
        workerScope.postMessage({type: "error", message: error instanceof Error ? error.message : "Waveform peak generation failed."})
    }
}
