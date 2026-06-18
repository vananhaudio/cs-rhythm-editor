// ── Tiếng đàn giả lập (WebAudio) ───────────────────────────────────────────────
// Tổng hợp 1 nốt dây buông: sawtooth + 2 sine hài, lọc lowpass tắt dần → nghe như gảy đàn.
let _ac: AudioContext | null = null

export function playTone(freq: number) {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!_ac) _ac = new Ctor()
    if (_ac.state === 'suspended') _ac.resume()
    const t = _ac.currentTime
    const lp = _ac.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(3600, t)
    lp.frequency.exponentialRampToValueAtTime(700, t + 1.3)
    const g = _ac.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0008, t + 1.7)
    lp.connect(g); g.connect(_ac.destination)
    ;([[1, 'sawtooth', 0.6], [2, 'sine', 0.22], [3, 'sine', 0.1]] as const).forEach(([h, ty, amp]) => {
      const o = _ac!.createOscillator(); o.type = ty as OscillatorType; o.frequency.value = freq * h
      const og = _ac!.createGain(); og.gain.value = amp
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + 1.75)
    })
  } catch { /* trình duyệt chặn audio — bỏ qua */ }
}
