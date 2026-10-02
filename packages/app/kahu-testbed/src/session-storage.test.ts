import {describe, expect, it} from "vitest"
import {
    LEGACY_SESSION_STORAGE_KEY,
    LEGACY_SESSION_V3_STORAGE_KEY,
    LEGACY_SESSION_V4_STORAGE_KEY,
    SESSION_STORAGE_KEY,
} from "./session-store"
import {promoteLegacyV4Session, type SessionStorage} from "./session-storage"

const validV4 = JSON.stringify({
    version: 4,
    tracks: [],
    rack: "{}",
    viewport: {min: 0, max: 1},
    loop: {enabled: false, startSeconds: 0, endSeconds: 300},
    follow: false,
})

const storage = (initial: Readonly<Record<string, string>> = {}): SessionStorage & {values: Map<string, string>} => {
    const values = new Map(Object.entries(initial))
    return {
        values,
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value) },
    }
}

describe("KBW-16 session storage migration", () => {
    it("pins the v5 save key and complete legacy key sequence", () => {
        expect(SESSION_STORAGE_KEY).toBe("kahustack-dsp-testbed.session.v5")
        expect(LEGACY_SESSION_V4_STORAGE_KEY).toBe("kahustack-dsp-testbed.session.v4")
        expect(LEGACY_SESSION_V3_STORAGE_KEY).toBe("kahustack-dsp-testbed.session.v3")
        expect(LEGACY_SESSION_STORAGE_KEY).toBe("kahustack-dsp-testbed.session.v2")
    })

    it("promotes a valid v4-key session without deleting the legacy record", () => {
        const store = storage({[LEGACY_SESSION_V4_STORAGE_KEY]: validV4})
        expect(promoteLegacyV4Session(store)).toBe(true)
        expect(store.values.get(SESSION_STORAGE_KEY)).toBe(validV4)
        expect(store.values.get(LEGACY_SESSION_V4_STORAGE_KEY)).toBe(validV4)
    })

    it("does not overwrite an existing v5 session", () => {
        const current = "current-v5"
        const store = storage({
            [SESSION_STORAGE_KEY]: current,
            [LEGACY_SESSION_V4_STORAGE_KEY]: validV4,
        })
        expect(promoteLegacyV4Session(store)).toBe(false)
        expect(store.values.get(SESSION_STORAGE_KEY)).toBe(current)
    })

    it("does not promote invalid v4 data", () => {
        const store = storage({[LEGACY_SESSION_V4_STORAGE_KEY]: "{\"version\":99}"})
        expect(promoteLegacyV4Session(store)).toBe(false)
        expect(store.values.has(SESSION_STORAGE_KEY)).toBe(false)
        expect(store.values.get(LEGACY_SESSION_V4_STORAGE_KEY)).toBe("{\"version\":99}")
    })

    it("leaves v3 and v2 records untouched for the existing recovery fallback", () => {
        const store = storage({
            [LEGACY_SESSION_V3_STORAGE_KEY]: "legacy-v3",
            [LEGACY_SESSION_STORAGE_KEY]: "legacy-v2",
        })
        expect(promoteLegacyV4Session(store)).toBe(false)
        expect(store.values.get(LEGACY_SESSION_V3_STORAGE_KEY)).toBe("legacy-v3")
        expect(store.values.get(LEGACY_SESSION_STORAGE_KEY)).toBe("legacy-v2")
    })
})
