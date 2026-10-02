// KBW-16 browser persistence boundary: non-destructively promotes a valid v4-key session into the v5 key
// before the workbench initializes. Older records are never deleted or rewritten.

import {
    decodeSession,
    LEGACY_SESSION_V4_STORAGE_KEY,
    SESSION_STORAGE_KEY,
} from "./session-store"

export type SessionStorage = Pick<Storage, "getItem" | "setItem">

export const promoteLegacyV4Session = (storage: SessionStorage): boolean => {
    if (storage.getItem(SESSION_STORAGE_KEY) !== null) return false
    const legacy = storage.getItem(LEGACY_SESSION_V4_STORAGE_KEY)
    if (legacy === null) return false
    try {
        decodeSession(legacy)
    } catch {
        return false
    }
    storage.setItem(SESSION_STORAGE_KEY, legacy)
    return true
}
