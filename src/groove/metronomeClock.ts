// Port từ Groove Lab audio/clock.ts sang Web Audio THUẦN (bỏ react-native-audio-api/AudioManager).
// "Hai đồng hồ": JS timer 25ms chỉ lên lịch trước; tiếng phát chính xác trên audio thread.
// UI đọc vị trí TRỰC TIẾP từ đồng hồ audio (getProgress) -> hình luôn khớp tiếng.

export type ClockCell = {
  startBeat: number
  durationBeats: number   // PHÁCH (1, 0.5, 1/3, 0.25)
  isRest: boolean
  downbeatNumber: number | null
}

export type MetronomeCallbacks = {
  getTempo: () => number
  getCells: () => ClockCell[]
  getAccentsOn: () => boolean
  getAccentPattern: () => number[]
  onStop?: () => void
  onDownbeat?: (downbeatNumber: number) => void
}

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.1
const LEAD_IN = 0.12

export class MetronomeClock {
  private ctx: AudioContext | null = null
  private cb: MetronomeCallbacks
  private timer: ReturnType<typeof setInterval> | null = null
  private nextNoteTime = 0
  private cellIdx = 0
  private playing = false
  private startTime = 0
  private barBeats = 0
  private pendingTimers: ReturnType<typeof setTimeout>[] = []
  private master: GainNode | null = null

  constructor(cb: MetronomeCallbacks) { this.cb = cb }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AC()
    }
    return this.ctx
  }

  private ensureMaster() {
    const ctx = this.getCtx()
    if (!this.master) {
      this.master = ctx.createGain()
      this.master.gain.value = 0.85
      this.master.connect(ctx.destination)
    }
  }

  async start() {
    if (this.playing) return
    const ctx = this.getCtx()
    this.ensureMaster()
    if (ctx.state === 'suspended') { try { await ctx.resume() } catch { /* ignore */ } }

    const cells = this.cb.getCells()
    this.barBeats = cells.reduce((s, c) => s + c.durationBeats, 0)

    this.playing = true
    this.cellIdx = 0
    this.nextNoteTime = ctx.currentTime + LEAD_IN
    this.startTime = this.nextNoteTime

    this.scheduler()
    this.timer = setInterval(() => this.scheduler(), LOOKAHEAD_MS)
  }

  stop() {
    this.playing = false
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    this.pendingTimers.forEach(clearTimeout)
    this.pendingTimers = []
    this.cb.onStop?.()
  }

  dispose() {
    this.stop()
    try { this.ctx?.close() } catch { /* ignore */ }
    this.ctx = null
    this.master = null
  }

  getProgress(): number {
    if (!this.playing || !this.ctx || this.barBeats <= 0) return 0
    const elapsed = this.ctx.currentTime - this.startTime
    if (elapsed <= 0) return 0
    const barDur = (this.barBeats * 60) / this.cb.getTempo()
    return (elapsed % barDur) / barDur
  }

  private scheduler() {
    if (!this.playing || !this.ctx) return
    const ctx = this.ctx
    const cells = this.cb.getCells()
    if (!cells.length) return

    while (this.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const cell = cells[this.cellIdx]
      const beatDur = 60 / this.cb.getTempo()

      if (!cell.isRest) {
        const isDownbeat = cell.downbeatNumber != null
        const accented =
          this.cb.getAccentsOn() &&
          isDownbeat &&
          this.cb.getAccentPattern().includes(cell.downbeatNumber as number)
        this.scheduleClick(this.nextNoteTime, accented)

        if (isDownbeat && this.cb.onDownbeat) {
          const delayMs = Math.max(0, (this.nextNoteTime - ctx.currentTime) * 1000)
          const dn = cell.downbeatNumber as number
          const ht = setTimeout(() => { if (this.playing) this.cb.onDownbeat!(dn) }, delayMs)
          this.pendingTimers.push(ht)
        }
      }

      this.nextNoteTime += cell.durationBeats * beatDur
      this.cellIdx += 1
      if (this.cellIdx >= cells.length) this.cellIdx = 0
    }
  }

  // Click ĐỀU & SẠCH: tần số cố định, attack tuyến tính từ 0, tắt hẳn về 0 -> không pop, không méo.
  private scheduleClick(time: number, accented: boolean) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(accented ? 1500 : 1000, time)

    const peak = accented ? 0.8 : 0.5
    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(peak, time + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0008, time + 0.032)
    gain.gain.linearRampToValueAtTime(0, time + 0.04)

    osc.connect(gain).connect(this.master!)
    osc.start(time)
    osc.stop(time + 0.05)
  }
}
