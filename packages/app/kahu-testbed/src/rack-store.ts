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

export class RackStore {
    private readonly chains = new Map<string, RackDevice[]>()
    private nextId = 1

    devicesFor(trackId: string): ReadonlyArray<RackDevice> {
        return this.chains.get(trackId) ?? []
    }

    addReferenceSlot(trackId: string): RackDevice {
        const device: RackDevice = {
            id: `rack-${this.nextId.toString().padStart(2, "0")}`,
            trackId,
            name: "Reference effect slot",
            moduleId: undefined,
            parameterValues: {},
            bypassed: false
        }
        this.nextId += 1
        const chain = this.chains.get(trackId) ?? []
        chain.push(device)
        this.chains.set(trackId, chain)
        return device
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
    return candidate.chains.every(chain => {
        if (typeof chain !== "object" || chain === null) return false
        const value = chain as {trackId?: unknown, devices?: unknown}
        if (typeof value.trackId !== "string" || !Array.isArray(value.devices)) return false
        return value.devices.every(device => {
            if (typeof device !== "object" || device === null) return false
            const item = device as Record<string, unknown>
            const values = item.parameterValues
            return typeof item.id === "string" && typeof item.name === "string"
                && (item.moduleId === undefined || typeof item.moduleId === "string")
                && typeof item.bypassed === "boolean" && typeof values === "object" && values !== null
                && Object.values(values as Record<string, unknown>).every(value => typeof value === "number" && Number.isFinite(value))
        })
    })
}
