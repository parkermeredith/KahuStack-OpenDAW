// KOD-5 rack authority: retained audio-effect slot lifecycle without implementing fake DSP.

export type RackDevice = {
    readonly id: string
    readonly trackId: string
    readonly name: string
    bypassed: boolean
}

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

    private find(trackId: string, deviceId: string): RackDevice | undefined {
        return this.chains.get(trackId)?.find(device => device.id === deviceId)
    }
}
