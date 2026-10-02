import {readFileSync} from "node:fs"
import {fileURLToPath} from "node:url"
import {describe, expect, it} from "vitest"

const source = readFileSync(fileURLToPath(new URL("./workbench.tsx", import.meta.url)), "utf8")
const styles = readFileSync(fileURLToPath(new URL("./workbench.sass", import.meta.url)), "utf8")

describe("KUX workbench structure", () => {
    it("uses one track row authority without spacer alignment", () => {
        expect(source).toContain("track-workspace-row")
        expect(source).toContain("row.append(createTrackControls(track), createTimelineLane(track))")
        expect(source).not.toContain("track-header-spacer")
        expect(source).not.toContain("TrackScrollModel")
        expect(styles).toContain("--kahu-track-row-height")
        expect(styles).toContain("grid-template-columns: var(--kahu-track-rail) minmax(0, 1fr)")
    })

    it("renders the waveform in each timeline region", () => {
        expect(source).toContain("timeline-region-waveform")
        expect(source).toContain("drawRegionWaveform(track, region, waveform)")
        expect(source).toContain("projectVisibleWaveform")
        expect(source).not.toContain("Source audio waveform")
    })

    it("keeps the loader as a zero-track timeline state", () => {
        expect(source).toContain("if (tracks.length === 0)")
        expect(source).toContain("createEmptyTimeline()")
        expect(source).toContain("Drop audio here")
        expect(source).not.toContain("Audio ready — press Play")
    })

    it("uses the OpenDAW-style collapsible rack and Kahu knob adapter", () => {
        expect(source).toContain("minimizedRackDevices")
        expect(source).toContain("createKahuParameterKnob")
        expect(source).toContain("toggleRackCollapsed")
        expect(source).toContain("IconSymbol.Minimized")
        expect(source).toContain("IconSymbol.Maximized")
        expect(styles).toContain("flex: 0 0 17.5rem")
        expect(styles).toContain("&.collapsed")
        expect(styles).toContain("&.minimized")
    })

    it("refreshes the selected rack when source loading changes track selection", () => {
        const loadStart = source.indexOf("const loadAudio")
        const loadEnd = source.indexOf("const toggleTransport", loadStart)
        expect(loadStart).toBeGreaterThan(-1)
        expect(source.slice(loadStart, loadEnd)).toContain("refreshRack()")
    })
})
