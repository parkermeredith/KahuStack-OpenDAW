// KUI-6 vertical scroll authority: keeps the fixed header viewport and timeline lane viewport on one
// bounded scroll position while horizontal TimelineRange movement remains lane-only.

export class TrackScrollModel {
    private syncing = false
    private readonly onHeaderScroll = (): void => this.copy(this.headers, this.lanes)
    private readonly onLaneScroll = (): void => this.copy(this.lanes, this.headers)

    constructor(
        private readonly headers: HTMLElement,
        private readonly lanes: HTMLElement,
    ) {
        headers.addEventListener("scroll", this.onHeaderScroll)
        lanes.addEventListener("scroll", this.onLaneScroll)
        this.copy(headers, lanes)
    }

    dispose(): void {
        this.headers.removeEventListener("scroll", this.onHeaderScroll)
        this.lanes.removeEventListener("scroll", this.onLaneScroll)
    }

    private copy(source: HTMLElement, target: HTMLElement): void {
        if (this.syncing) return
        this.syncing = true
        target.scrollTop = source.scrollTop
        this.syncing = false
    }
}
