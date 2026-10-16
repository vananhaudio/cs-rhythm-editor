// Tiếng đập nhịp cho Play Scroll (trang học viên). KHÔNG có đồng hồ riêng: người gọi đưa vào "còn bao nhiêu giây tới phách kế"
// tính từ beat clock hiện có; ở đây chỉ hẹn một tiếng click ngắn bằng Web Audio tại đúng thời điểm đó.
export interface BeatClicker {
  /** Mở/resume AudioContext — gọi trong thao tác bấm của người dùng (iOS Safari). */
  unlock(): void
  /** Hẹn một tiếng click sau `delaySeconds`; accent = phách đầu ô. */
  click(delaySeconds: number, accent: boolean): void
  context(): AudioContext | null
  close(): void
}

/** Một tiếng click ngắn tại thời điểm `at` (giờ của `ctx`), đưa vào `destination`. Dùng chung cho Player (loa) và video (luồng ghi). */
export function playClick(ctx: AudioContext, destination: AudioNode, at: number, accent: boolean): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = accent ? 1760 : 1175
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.22, at + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.045)
  osc.connect(gain).connect(destination)
  osc.start(at)
  osc.stop(at + 0.06)
}

export function createBeatClicker(): BeatClicker {
  let ctx: AudioContext | null = null
  const ensure = (): AudioContext | null => {
    if (ctx) return ctx
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    return ctx
  }
  return {
    unlock() {
      const c = ensure()
      if (c && c.state === 'suspended') c.resume().catch(() => {})
    },
    click(delaySeconds, accent) {
      const c = ctx
      if (!c || c.state !== 'running') return
      playClick(c, c.destination, c.currentTime + Math.max(0, delaySeconds), accent)
    },
    context: () => ctx,
    close() { if (ctx) { ctx.close().catch(() => {}); ctx = null } },
  }
}
