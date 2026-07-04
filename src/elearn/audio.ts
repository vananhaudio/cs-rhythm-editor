// ── Tiếng đàn giả lập (WebAudio) ───────────────────────────────────────────────
// Tổng hợp 1 nốt dây buông: sawtooth + 2 sine hài + transient "chạm", lọc lowpass tắt dần.
// Cắt nốt đang vang khi gảy nốt mới → gảy nhanh nhiều dây không bị chồng tiếng "organ".
let _ac: AudioContext | null = null
let _voices: { gain: GainNode; oscs: OscillatorNode[] }[] = []

function ctx(): AudioContext | null {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!_ac) _ac = new Ctor()
    if (_ac.state === 'suspended') _ac.resume()
    return _ac
  } catch { return null }
}

// Tắt nhanh mọi nốt đang vang (fade 60ms) — gọi trước khi phát nốt mới
function cutActive(ac: AudioContext, fade = 0.06) {
  const t = ac.currentTime
  _voices.forEach(v => {
    try {
      v.gain.gain.cancelScheduledValues(t)
      v.gain.gain.setValueAtTime(Math.max(v.gain.gain.value, 0.0001), t)
      v.gain.gain.exponentialRampToValueAtTime(0.0001, t + fade)
      v.oscs.forEach(o => { try { o.stop(t + fade + 0.02) } catch { /* */ } })
    } catch { /* */ }
  })
  _voices = []
}

export function playTone(freq: number) {
  const ac = ctx()
  if (!ac) return
  try {
    cutActive(ac)
    const t = ac.currentTime
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(3600, t)
    lp.frequency.exponentialRampToValueAtTime(700, t + 1.3)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0008, t + 1.7)
    lp.connect(g); g.connect(ac.destination)

    const oscs: OscillatorNode[] = []
    ;([[1, 'sawtooth', 0.6], [2, 'sine', 0.22], [3, 'sine', 0.1]] as const).forEach(([h, ty, amp]) => {
      const o = ac.createOscillator(); o.type = ty as OscillatorType; o.frequency.value = freq * h
      const og = ac.createGain(); og.gain.value = amp
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + 1.75)
      oscs.push(o)
    })

    // Transient "chạm" — burst nhiễu rất ngắn cho cảm giác gảy/móng chạm dây
    const dur = 0.03
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length)
    const noise = ac.createBufferSource(); noise.buffer = buf
    const ng = ac.createGain(); ng.gain.value = 0.18
    const nhp = ac.createBiquadFilter(); nhp.type = 'highpass'; nhp.frequency.value = 1500
    noise.connect(nhp); nhp.connect(ng); ng.connect(ac.destination); noise.start(t)

    _voices.push({ gain: g, oscs })
  } catch { /* trình duyệt chặn audio — bỏ qua */ }
}

// Tiếng "tick" metronome — blip ngắn, gọn; KHÔNG cắt tiếng đàn đang vang (không đụng _voices).
// accent = phách mạnh (cao & to hơn) để định hướng đầu ô nhịp.
export function playClick(accent = false) {
  const ac = ctx()
  if (!ac) return
  try {
    const t = ac.currentTime
    const o = ac.createOscillator(); o.type = 'square'
    o.frequency.value = accent ? 2000 : 1300
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(accent ? 0.3 : 0.19, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
    o.connect(g); g.connect(ac.destination)
    o.start(t); o.stop(t + 0.06)
  } catch { /* trình duyệt chặn audio — bỏ qua */ }
}

// Gảy 1 chuỗi dây liền mạch (dùng cuối bài LÀM: "nghe lại 6 dây bạn vừa gảy")
export function playSequence(freqs: number[], gapMs = 380) {
  freqs.forEach((f, i) => setTimeout(() => playTone(f), i * gapMs))
}

// ── NỀN ĐỆM: trống + bass + strings pad (cho bài Vận dụng, nghe như ban nhạc) ──
// Trống — kick (thump trầm)
export function playKick() {
  const ac = ctx(); if (!ac) return
  try {
    const t = ac.currentTime
    const o = ac.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.11)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26)
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.3)
  } catch { /* */ }
}
// Trống — snare (nhiễu + tí thân)
export function playSnare() {
  const ac = ctx(); if (!ac) return
  try {
    const t = ac.currentTime, dur = 0.16
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate)
    const ch = buf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length)
    const n = ac.createBufferSource(); n.buffer = buf
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400
    const g = ac.createGain(); g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    n.connect(hp); hp.connect(g); g.connect(ac.destination); n.start(t)
  } catch { /* */ }
}
// Trống — hi-hat (nhiễu cao rất ngắn)
export function playHat() {
  const ac = ctx(); if (!ac) return
  try {
    const t = ac.currentTime, dur = 0.04
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate)
    const ch = buf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1)
    const n = ac.createBufferSource(); n.buffer = buf
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000
    const g = ac.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    n.connect(hp); hp.connect(g); g.connect(ac.destination); n.start(t)
  } catch { /* */ }
}
// Bass — nốt trầm gọn, ấm
export function playBass(freq: number) {
  const ac = ctx(); if (!ac) return
  try {
    const t = ac.currentTime
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = freq
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    o.connect(lp); lp.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.55)
  } catch { /* */ }
}
// Strings pad — hợp âm êm, ngân cả ô nhịp rồi tắt dần (lót nhẹ dưới giai điệu)
// Đệm hợp âm = tiếng PIANO (tổng hợp): búa gõ dây, hài âm sine, tắt dần tự nhiên, sáng→tối
export function playPad(freqs: number[], durMs: number) {
  const ac = ctx(); if (!ac) return
  try {
    const t = ac.currentTime, rel = Math.max(0.6, durMs / 1000)
    freqs.forEach((f, idx) => {
      const g = ac.createGain()
      const peak = idx === 0 ? 0.05 : 0.036                        // nốt trầm nhất to hơn chút
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(peak, t + 0.004)         // búa gõ — attack rất nhanh
      g.gain.exponentialRampToValueAtTime(peak * 0.32, t + 0.28)   // giảm nhanh ban đầu
      g.gain.exponentialRampToValueAtTime(0.0001, t + rel + 0.5)   // ngân tắt dần (piano)
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'
      lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(1300, t + 0.7)  // sáng lúc gõ, tối dần
      lp.connect(g); g.connect(ac.destination)
      ;([[1, 1], [2, 0.45], [3, 0.22], [4, 0.1]] as const).forEach(([h, amp]) => {
        const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f * h    // hài âm sine kiểu piano
        const og = ac.createGain(); og.gain.value = amp
        o.connect(og); og.connect(lp); o.start(t); o.stop(t + rel + 0.6)
      })
    })
    // tiếng "búa chạm dây" — burst nhiễu rất ngắn cho chất gõ
    const nb = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.015), ac.sampleRate)
    const ch = nb.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length)
    const noise = ac.createBufferSource(); noise.buffer = nb
    const ng = ac.createGain(); ng.gain.value = 0.025
    const nbp = ac.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.value = 2600
    noise.connect(nbp); nbp.connect(ng); ng.connect(ac.destination); noise.start(t)
  } catch { /* */ }
}
