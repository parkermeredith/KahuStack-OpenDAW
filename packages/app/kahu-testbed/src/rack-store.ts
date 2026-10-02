// KBW-7/12 rack authority: persists ordered device intent while Rust-WASM owns DSP execution.

export type RackDevice = {
    readonly id: string
    readonly trackId: string
    readonly name: string
    readonly moduleId: string | undefined
    readonly parameterValues: Record<string, number>
    bypassed: boolean
}

export type RackSession = Readonly<{
    version: 2
    chains: ReadonlyArray<Readonly<{trackId: string, devices: ReadonlyArray<Readonly<RackDevice>>}>>
}>

export type RackRecoveryReport = Readonly<{
    restoredChains: number
    restoredDevices: number
    skippedChains: number
    skippedDevices: number
    errors: ReadonlyArray<string>
}>

export class RackStore {
    private readonly chains = new Map<string, RackDevice[]>()
    private nextId = 1

    devicesFor(trackId: string): ReadonlyArray<RackDevice> {
        return this.chains.get(trackId) ?? []
    }

    addModule(trackId: string, moduleId: string, name: string, parameterValues: Record<string, number> = {}): RackDevice {
        const device: RackDevice = {
            id: `rack-${this.nextId.toString().padStart(2, "0")}`,
            trackId,
            name,
            moduleId,
            parameterValues: {...parameterValues},
            bypassed: false
        }
        this.nextId += 1
        const chain = this.chains.get(trackId) ?? []
        chain.push(device)
        this.chains.set(trackId, chain)
        return device
    }

    remove(trackId: string, deviceId: string): boolean {
        const chain = this.chains.get(trackId)
        if (chain === undefined) {
            return false
        }
        const index = chain.findIndex(device => device.id === deviceId)
        if (index < 0) {
            return false
        }
        chain.splice(index, 1)
        return true
    }

    setBypassed(trackId: string, deviceId: string, bypassed: boolean): void {
        const device = this.find(trackId, deviceId)
        if (device !== undefined) {
            device.bypassed = bypassed
        }
    }

    setParameter(trackId: string, deviceId: string, key: string, value: number): void {
        const device = this.find(trackId, deviceId)
        if (device !== undefined) {
            device.parameterValues[key] = value
        }
    }

    move(trackId: string, deviceId: string, direction: -1 | 1): void {
        const chain = this.chains.get(trackId)
        const index = chain?.findIndex(device => device.id === deviceId) ?? -1
        const target = index + direction
        if (chain === undefined || index < 0 || target < 0 || target >= chain.length) {
            return
        }
        const [device] = chain.splice(index, 1)
        chain.splice(target, 0, device)
    }

    removeTrack(trackId: string): void {
        this.chains.delete(trackId)
    }

    serialize(): string {
        const session: RackSession = {
            version: 2,
            chains: Array.from(this.chains.entries()).map(([trackId, devices]) => ({trackId, devices}))
        }
        return JSON.stringify(session)
    }

    restore(serialized: string): void {
        const parsed: unknown = JSON.parse(serialized)
        if (!isRackSession(parsed)) {
            throw new Error("Invalid Kahu rack session.")
        }
        this.chains.clear()
        let highestId = 0
        for (const chain of parsed.chains) {
            const devices = chain.devices.map(device => ({
                id: device.id,
                trackId: chain.trackId,
                name: device.name,
                moduleId: device.moduleId,
                parameterValues: {...device.parameterValues},
                bypassed: device.bypassed
            }))
            this.chains.set(chain.trackId, devices)
            for (const device of devices) {
                highestId = Math.max(highestId, Number(device.id.replace("rack-", "")) || 0)
            }
        }
        this.nextId = highestId + 1
    }

    restoreRecoverable(serialized: string): RackRecoveryReport {
        const errors: string[] = []
        let parsed: unknown
        try {
            parsed = JSON.parse(serialized)
        } catch {
            this.chains.clear()
            this.nextId = 1
            return {restoredChains: 0, restoredDevices: 0, skippedChains: 0, skippedDevices: 0, errors: ["Rack metadata is not valid JSON."]}
        }
        if (typeof parsed !== "object" || parsed === null) {
            this.chains.clear()
            this.nextId = 1
            return {restoredChains: 0, restoredDevices: 0, skippedChains: 0, skippedDevices: 0, errors: ["Rack metadata is not an object."]}
        }
        const candidate = parsed as {version?: unknown, chains?: unknown}
        if ((candidate.version !== 1 && candidate.version !== 2) || !Array.isArray(candidate.chains)) {
            this.chains.clear()
            this.nextId = 1
            return {restoredChains: 0, restoredDevices: 0, skippedChains: 0, skippedDevices: 0, errors: ["Rack metadata has an unsupported shape."]}
        }

        this.chains.clear()
        let highestId = 0
        let restoredChains = 0
        let restoredDevices = 0
        let skippedChains = 0
        let skippedDevices = 0
        for (const rawChain of candidate.chains) {
            if (!isRackChainContainer(rawChain)) {
                skippedChains += 1
                errors.push("Skipped malformed rack chain.")
                continue
            }
            const devices: RackDevice[] = []
            for (const rawDevice of rawChain.devices) {
                if (!isRackDevice(rawDevice)) {
                    skippedDevices += 1
                    errors.push(`Skipped malformed device in ${rawChain.trackId}.`)
                    continue
                }
                const device: RackDevice = {
                    id: rawDevice.id,
                    trackId: rawChain.trackId,
                    name: rawDevice.name,
                    moduleId: rawDevice.moduleId,
                    parameterValues: {...rawDevice.parameterValues},
                    bypassed: rawDevice.bypassed,
                }
                devices.push(device)
                highestId = Math.max(highestId, Number(device.id.replace("rack-", "")) || 0)
                restoredDevices += 1
            }
            this.chains.set(rawChain.trackId, devices)
            restoredChains += 1
        }
        this.nextId = highestId + 1
        return {restoredChains, restoredDevices, skippedChains, skippedDevices, errors}
    }

    private find(trackId: string, deviceId: string): RackDevice | undefined {
        return this.chains.get(trackId)?.find(device => device.id === deviceId)
    }
}

const isRackSession = (value: unknown): value is RackSession => {
    if (typeof value !== "object" || value === null) {
        return false
    }
    const candidate = value as {version?: unknown, chains?: unknown}
    if (candidate.version !== 1 && candidate.version !== 2 || !Array.isArray(candidate.chains)) return false
    return candidate.chains.every(isRackChain)
}

const isRackChain = (value: unknown): value is {trackId: string, devices: ReadonlyArray<RackDevice>} => {
    return isRackChainContainer(value) && value.devices.every(isRackDevice)
}

const isRackChainContainer = (value: unknown): value is {trackId: string, devices: ReadonlyArray<unknown>} => {
    if (typeof value !== "object" || value === null) return false
    const chain = value as {trackId?: unknown, devices?: unknown}
    return typeof chain.trackId === "string" && Array.isArray(chain.devices)
}

const isRackDevice = (value: unknown): value is RackDevice => {
    if (typeof value !== "object" || value === null) return false
    const item = value as Record<string, unknown>
    const values = item.parameterValues
    return typeof item.id === "string" && typeof item.name === "string"
        && (item.moduleId === undefined || typeof item.moduleId === "string")
        && typeof item.bypassed === "boolean" && typeof values === "object" && values !== null
        && Object.values(values as Record<string, unknown>).every(value => typeof value === "number" && Number.isFinite(value))
}
