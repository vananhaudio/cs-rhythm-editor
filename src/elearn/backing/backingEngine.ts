// ── ENGINE NỀN trống+bass synth (Web Audio thuần) ─────────────────────────────
// Port từ docs/groove-backing-track-engine.md (mục 4). Voices + lookahead scheduler giữ nguyên.
// Tiếng tự sinh bằng synth → KHÔNG dính bản quyền.
import { type Style, bassFreq } from './backingStyles'

export type Mutes = { drums: boolean; bass: boolean; click: boolean }
export interface MelodyNote { t: number; dur: number; midi: number }   // t,dur theo PHÁCH; midi nốt
export type EngineCallbacks = {
  getStyle: () => Style; getChords: () => string[]; getTempo: () => number; getMutes: () => Mutes
  getMelody?: () => MelodyNote[]                                        // (tuỳ chọn) giai điệu chơi kèm
  getOutro?: () => boolean[]                                            // (tuỳ chọn) ô nào là ô "Out"/kết (theo index chords)
}

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

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
  private master!: GainNode; private drumBus!: GainNode; private bassBus!: GainNode; private clickBus!: GainNode; private melBus!: GainNode

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
    this.melBus = ctx.createGain(); this.melBus.gain.value = 0.6; this.melBus.connect(this.master)
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
    // ĐẾM VÀO 1 ô (beatsPerBar nhịp) — gõ tiếng, rồi nền + khuông vào ở phách 1
    const beatSec = 60 / this.cb.getTempo()
    const cN = style.beatsPerBar
    const countStart = ctx.currentTime + LEAD_IN
    for (let i = 0; i < cN; i++) this.countClick(countStart + i * beatSec, i === 0)
    this.startTime = countStart + cN * beatSec   // t=0 của nền/khuông = SAU đếm vào
    this.nextStepTime = this.startTime
    this.scheduler()
    this.timer = setInterval(() => this.scheduler(), LOOKAHEAD_MS)
  }
  stop() { this.playing = false; if (this.timer) { clearInterval(this.timer); this.timer = null } }
  dispose() { this.stop(); try { this.ctx?.close() } catch { /* */ } this.ctx = null; this.master = null as unknown as GainNode }
  isPlaying() { return this.playing }

  // ── THU TRỘN: nền (master) + tiếng micro → 1 MediaStream để ghi (trộn số, sạch dù loa/tai nghe) ──
  private recDest: MediaStreamAudioDestinationNode | null = null
  private micSrc: MediaStreamAudioSourceNode | null = null
  private micGain: GainNode | null = null
  startMixRecording(micStream: MediaStream): MediaRecorder {
    this.getCtx(); this.ensureGraph()
    this.recDest = this.ctx!.createMediaStreamDestination()
    const back = this.ctx!.createGain(); back.gain.value = 0.7   // hạ nền nhẹ để tiếng đàn nổi
    this.master.connect(back); back.connect(this.recDest)        // nền → bản thu
    this.micSrc = this.ctx!.createMediaStreamSource(micStream)
    this.micGain = this.ctx!.createGain(); this.micGain.gain.value = 1.6   // tăng tiếng đàn (AGC tắt → mic nhỏ)
    this.micSrc.connect(this.micGain).connect(this.recDest)      // tiếng đàn (micro) → bản thu
    return new MediaRecorder(this.recDest.stream, { audioBitsPerSecond: 256000 })
  }
  stopMixRecording() {
    try { if (this.recDest) this.master.disconnect(this.recDest) } catch { /* */ }
    try { this.micSrc?.disconnect() } catch { /* */ }
    try { this.micGain?.disconnect() } catch { /* */ }
    this.recDest = null; this.micSrc = null; this.micGain = null
  }

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
    const outro = this.cb.getOutro?.() ?? []
    while (this.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const s = this.stepIdx, t = this.nextStepTime
      const isOutroBar = !!outro[this.barIdx]
      if (isOutroBar) {
        // Ô "Out"/kết: chỉ CHỐT phách 1 (kick + crash + bass nốt gốc) rồi IM cả ô.
        if (s === 0) {
          this.kick(t, 1.0); this.crash(t)
          const cur = chords[this.barIdx] ?? chords[0]
          const f = bassFreq(cur, 'R')
          if (f) this.bassNote(t, f)
        }
      } else {
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
      }
      const perBeat = style.stepsPerBar / style.beatsPerBar
      if (s % perBeat === 0) {
        if (!isOutroBar) this.click(t, s === 0)
        // Giai điệu (nếu có): chơi nốt rơi đúng phách này trong vòng
        const mel = this.cb.getMelody?.()
        if (mel && mel.length) {
          const beatInSong = this.barIdx * style.beatsPerBar + s / perBeat
          const beatSec = 60 / this.cb.getTempo()
          for (const m of mel) if (m.t === beatInSong) this.melodyNote(t, midiToFreq(m.midi), m.dur * beatSec)
        }
      }
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
  private crash(t: number) {   // chũm choẹ kết — noise ngân dài
    const ctx = this.ctx!, src = ctx.createBufferSource(); src.buffer = this.noise
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000; hp.Q.value = 0.5
    const g = ctx.createGain(), dec = 0.9
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.34, t + 0.003)
    g.gain.exponentialRampToValueAtTime(0.001, t + dec)
    src.connect(hp).connect(g).connect(this.drumBus); src.start(t, 0, dec + 0.05); src.stop(t + dec + 0.05)
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
  // Giai điệu — tiếng chuông/music-box (sine cơ bản + sine octave lấp lánh), gảy rồi ngân tắt dần.
  private melodyNote(t: number, freq: number, durSec: number) {
    const ctx = this.ctx!
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator()
    const g = ctx.createGain(), g2 = ctx.createGain()
    o1.type = 'sine'; o1.frequency.setValueAtTime(freq, t)
    o2.type = 'sine'; o2.frequency.setValueAtTime(freq * 2, t); g2.gain.value = 0.28
    const dur = Math.min(Math.max(durSec, 0.28), 1.3)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur)
    o1.connect(g); o2.connect(g2).connect(g); g.connect(this.melBus)
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05)
  }

  // Đếm vào — vào MASTER (luôn nghe được dù click trong loop bị mute)
  private countClick(t: number, accent: boolean) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'; o.frequency.setValueAtTime(accent ? 1850 : 1250, t)
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(accent ? 0.55 : 0.4, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.045)
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.06)
  }
}
