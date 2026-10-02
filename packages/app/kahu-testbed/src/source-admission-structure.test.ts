import {readFileSync} from "node:fs"
import {fileURLToPath} from "node:url"
import {describe, expect, it} from "vitest"

const source = readFileSync(fileURLToPath(new URL("./workbench.tsx", import.meta.url)), "utf8")

describe("KBW-17 batch source admission structure", () => {
    it("admits every selected or dropped file instead of only the first", () => {
        expect(source).toContain("type=\"file\" accept=\"audio/*\" multiple")
        expect(source).toContain("Array.from(element.files ?? [])")
        expect(source).toContain("Array.from(event.dataTransfer?.files ?? [])")
        expect(source).not.toContain("files?.[0]")
        expect(source).not.toContain("dataTransfer?.files[0]")
    })

    it("serializes batch decoding and performs one final running-transport reschedule", () => {
        const batchStart = source.indexOf("const loadAudioFiles")
        const batchEnd = source.indexOf("const enqueueAudioFiles", batchStart)
        const batch = source.slice(batchStart, batchEnd)
        expect(batchStart).toBeGreaterThan(-1)
        expect(batch).toContain("for (const file of files)")
        expect(batch).toContain("await loadAudio(file)")
        expect(batch.match(/transport\.reschedule\(\)/g)).toHaveLength(1)
        expect(source).toContain("sourceAdmissionQueue = sourceAdmissionQueue.then(() => loadAudioFiles(files))")
    })

    it("uses the recoverable source identity matcher before restoring session state", () => {
        const loadStart = source.indexOf("const loadAudio")
        const loadEnd = source.indexOf("const loadAudioFiles", loadStart)
        expect(source.slice(loadStart, loadEnd)).toContain("findRecoverableSessionTrack")
    })
})
