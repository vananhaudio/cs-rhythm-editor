// ── ENGINE NỀN trống+bass synth (Web Audio thuần) ─────────────────────────────
// Port từ docs/groove-backing-track-engine.md (mục 4). Voices + lookahead scheduler giữ nguyên.
// Tiếng tự sinh bằng synth → KHÔNG dính bản quyền.
import { type Style, bassFreq } from './backingStyles'

export type Mutes = { drums: boolean; bass: boolean; click: boolean }
export type EngineCallbacks = {
  getStyle: () => Style; getChords: () => string[]; getTempo: () => number; getMutes: () => Mutes
}

const LOOKAHEAD_MS = 25, SCHEDULE_AHEAD = 0.12, LEAD_IN = 0.15

export class BackingEngine {
  private ctx: AudioContext | null = null
  private cb: EngineCallbacks
  private timer: ReturnType<typeof setInterval> | null = null
  private playing = false
  private nextStepTime = 0; private stepIdx = 0; private barIdx = 0; private startTime = 0
  private stepsPerBar = 8; private barsTotal = 1
  private noise: AudioBuffer | null = null
  private satCurve: Float32Array | null = null
  private master!: GainNode; private drumBus!: GainNode; private bassBus!: GainNode; private clickBus!: GainNode

  constructor(cb: EngineCallbacks) { this.cb = cb }

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    return this.ctx
  }

  private ensureGraph() {
    const ctx = this.getCtx()
    if (this.master) return
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination)
    this.drumBus = ctx.createGain(); this.drumBus.connect(this.master)
    this.bassBus = ctx.createGain(); this.bassBus.connect(this.master)
    this.clickBus = ctx.createGain(); this.clickBus.gain.value = 0.6; this.clickBus.connect(this.master)
    const len = Math.floor(ctx.sampleRate * 1)
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const N = 1024, drive = 1.8, c = new Float32Array(N), k = Math.tanh(drive)
    for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1; c[i] = Math.tanh(x * drive) / k }
    this.satCurve = c
  }

  async start() {
    if (this.playing) return
    const ctx = this.getCtx(); this.ensureGraph()
    if (ctx.state === 'suspended') { try { await ctx.resume() } catch { /* */ } }  // PHẢI gọi trong cử chỉ user
    const style = this.cb.getStyle()
    this.stepsPerBar = style.stepsPerBar
    this.barsTotal = Math.max(1, this.cb.getChords().length)
    this.playing = true; this.stepIdx = 0; this.barIdx = 0; this.applyMutes()
    this.nextStepTime = ctx.currentTime + LEAD_IN; this.startTime = this.nextStepTime
    this.scheduler()
    this.timer = setInterval(() => this.scheduler(), LOOKAHEAD_MS)
  }
  stop() { this.playing = false; if (this.timer) { clearInterval(this.timer); this.timer = null } }
  dispose() { this.stop(); try { this.ctx?.close() } catch { /* */ } this.ctx = null; this.master = null as unknown as GainNode }
  isPlaying() { return this.playing }

  setMutes() { this.applyMutes() }
  private applyMutes() {
    const m = this.cb.getMutes()
    if (this.drumBus) this.drumBus.gain.value = m.drums ? 0 : 1
    if (this.bassBus) this.bassBus.gain.value = m.bass ? 0 : 1
    if (this.clickBus) this.clickBus.gain.value = m.click ? 0 : 0.6
  }

  // Giây đã trôi kể từ phách 1 (cùng đồng hồ audio) — khuông Strum Score đọc để highlight.
  getElapsed(): number {
    if (!this.playing || !this.ctx) return -1
    return this.ctx.currentTime - this.startTime
  }
  getBarIndex(): number {
    const elapsed = this.getElapsed()
    if (elapsed < 0) return -1
    const totalSteps = Math.floor(elapsed / this.stepDur(this.cb.getStyle()))
    return Math.floor(totalSteps / this.stepsPerBar) % this.barsTotal
  }
  private stepDur(style: Style): number {
    return (style.beatsPerBar * (60 / this.cb.getTempo())) / style.stepsPerBar
  }

  private scheduler() {
    if (!this.playing || !this.ctx) return
    const ctx = this.ctx, style = this.cb.getStyle(), chords = this.cb.getChords()
    this.applyMutes()
    while (this.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const s = this.stepIdx, t = this.nextStepTime
      const hh = style.drum.hh[s]
      if (hh !== 0) this.hihat(t, hh === 'o')
      if (style.drum.snare[s]) this.snare(t)
      if (style.drum.kick[s]) this.kick(t)
      const isLast = this.barIdx === chords.length - 1
      const useAlt = style.bassAlt && style.altEvery && this.barIdx % style.altEvery === style.altEvery - 1
      const pat = isLast && style.bassFinal ? style.bassFinal : useAlt ? style.bassAlt! : style.bass
      const deg = pat[s]
      if (deg) {
        const cur = chords[this.barIdx] ?? chords[0]
        const nxt = chords[(this.barIdx + 1) % chords.length] ?? cur
        const f = bassFreq(cur, deg, nxt)
        if (f) this.bassNote(t, f)
      }
      const perBeat = style.stepsPerBar / style.beatsPerBar
      if (s % perBeat === 0) this.click(t, s === 0)
      this.nextStepTime += this.stepDur(style)
      if (++this.stepIdx >= style.stepsPerBar) { this.stepIdx = 0; this.barIdx = (this.barIdx + 1) % Math.max(1, chords.length) }
    }
  }

  // ── VOICES (Web Audio API thuần) ──
  private kick(t: number, peak = 1.0) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.11)
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    o.connect(g).connect(this.drumBus); o.start(t); o.stop(t + 0.2)
  }
  private snare(t: number) {
    const ctx = this.ctx!, src = ctx.createBufferSource(); src.buffer = this.noise
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400; hp.Q.value = 0.7
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.6, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13)
    src.connect(hp).connect(g).connect(this.drumBus); src.start(t, 0, 0.16); src.stop(t + 0.16)
  }
  private hihat(t: number, open: boolean) {
    const ctx = this.ctx!, src = ctx.createBufferSource(); src.buffer = this.noise
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000; hp.Q.value = 0.7
    const g = ctx.createGain(), dec = open ? 0.18 : 0.035
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.28, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.001, t + dec)
    src.connect(hp).connect(g).connect(this.drumBus); src.start(t, 0, dec + 0.02); src.stop(t + dec + 0.02)
  }
  private bassNote(t: number, freq: number) {
    const ctx = this.ctx!
    const sub = ctx.createOscillator(), sawA = ctx.createOscillator(), sawB = ctx.createOscillator()
    const subG = ctx.createGain(), sawG = ctx.createGain()
    const lp = ctx.createBiquadFilter(), drive = ctx.createWaveShaper(), amp = ctx.createGain()
    sub.type = 'sine'; sawA.type = 'sawtooth'; sawB.type = 'sawtooth'
    sub.frequency.setValueAtTime(freq, t)
    sawA.frequency.setValueAtTime(freq, t); sawA.detune.setValueAtTime(7, t)
    sawB.frequency.setValueAtTime(freq, t); sawB.detune.setValueAtTime(-7, t)
    subG.gain.value = 0.9; sawG.gain.value = 0.16
    lp.type = 'lowpass'; lp.Q.value = 1.1
    lp.frequency.setValueAtTime(Math.min(1800, freq * 6), t)
    lp.frequency.exponentialRampToValueAtTime(Math.max(150, freq * 2.2), t + 0.18)
    if (this.satCurve) { drive.curve = this.satCurve as unknown as Float32Array<ArrayBuffer>; drive.oversample = '2x' }
    const peak = 0.62, sustain = 0.42
    amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(peak, t + 0.014)
    amp.gain.exponentialRampToValueAtTime(sustain, t + 0.16)
    amp.gain.setValueAtTime(sustain, t + 0.30); amp.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
    sub.connect(subG).connect(amp)
    sawA.connect(sawG); sawB.connect(sawG); sawG.connect(lp).connect(drive).connect(amp)
    amp.connect(this.bassBus)
    sub.start(t); sawA.start(t); sawB.start(t)
    sub.stop(t + 0.57); sawA.stop(t + 0.57); sawB.stop(t + 0.57)
  }
  private click(t: number, accent: boolean) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'; o.frequency.setValueAtTime(accent ? 1600 : 1100, t)
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(accent ? 0.5 : 0.32, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.03)
    o.connect(g).connect(this.clickBus); o.start(t); o.stop(t + 0.04)
  }
}
