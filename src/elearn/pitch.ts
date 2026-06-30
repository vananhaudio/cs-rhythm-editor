// ── Dò cao độ MỘT nốt (ACF2+ autocorrelation) — tách từ GuitarTuner, nới range cho giai điệu ──
// Tuner gốc cap ~380Hz (dây buông); giai điệu tỉa nốt lên tới Sol (G4≈392Hz) nên nới tới ~900Hz.
export function detectPitch(buf: Float32Array, sampleRate: number): { freq: number; clarity: number } {
  const SIZE = buf.length
  let sum = 0
  for (let i = 0; i < SIZE; i++) sum += buf[i] * buf[i]
  if (Math.sqrt(sum / SIZE) < 0.01) return { freq: -1, clarity: 0 }   // quá nhỏ → bỏ

  const HALF = Math.floor(SIZE / 2)
  const r = new Float32Array(HALF)
  for (let lag = 0; lag < HALF; lag++) {
    let s = 0
    for (let i = 0; i < HALF; i++) s += buf[i] * buf[i + lag]
    r[lag] = s
  }

  let firstMin = 1
  for (let i = 1; i < HALF - 1; i++) {
    if (r[i] <= r[i - 1] && r[i] <= r[i + 1]) { firstMin = i; break }
  }

  const minLag = Math.floor(sampleRate / 900)   // tới ~900Hz (dư cho giai điệu)
  const maxLag = Math.floor(sampleRate / 70)
  const searchFrom = Math.max(firstMin, minLag)

  let bestLag = -1, bestVal = -Infinity
  for (let i = searchFrom; i < Math.min(HALF - 1, maxLag); i++) {
    if (r[i] > bestVal) { bestVal = r[i]; bestLag = i }
  }

  if (bestLag < 2) return { freq: -1, clarity: 0 }
  const clarity = r[0] > 0 ? bestVal / r[0] : 0
  if (clarity < 0.55) return { freq: -1, clarity: 0 }

  const y0 = r[bestLag - 1], y1 = r[bestLag], y2 = r[bestLag + 1] ?? y1
  const denom = 2 * (2 * y1 - y0 - y2)
  const refined = denom !== 0 ? bestLag - (y0 - y2) / denom : bestLag

  return { freq: sampleRate / refined, clarity }
}

// Lớp cao độ (pitch class) 0–11 (C=0 … B=11) — để khớp nốt THEO TÊN (bất kể quãng tám).
export function pitchClass(freq: number): number {
  const midi = 69 + 12 * Math.log2(freq / 440)
  return ((Math.round(midi) % 12) + 12) % 12
}
