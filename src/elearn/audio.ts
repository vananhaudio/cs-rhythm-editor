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

// Gảy 1 chuỗi dây liền mạch (dùng cuối bài LÀM: "nghe lại 6 dây bạn vừa gảy")
export function playSequence(freqs: number[], gapMs = 380) {
  freqs.forEach((f, i) => setTimeout(() => playTone(f), i * gapMs))
}
