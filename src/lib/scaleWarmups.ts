export interface ScaleWarmup {
  id: string
  name: string
  subtitle: string
  pos: { frets: number[][] }
  roots: { s: number; f: number }[]
  noteNames: Readonly<Record<number, string>>
}

const OPEN_PITCHES = [4, 9, 2, 7, 11, 4]

// Không phát mẫu thiếu dữ liệu hoặc có nốt/chủ âm không nằm trong thế bấm.
export function parseScaleWarmups(value: unknown): ScaleWarmup[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Thiếu mẫu âm giai')
  const ids = new Set<string>()
  for (const row of value) {
    if (!row || !['id', 'name', 'subtitle'].every(k => typeof row[k] === 'string' && row[k].trim()) || ids.has(row.id)) throw new Error('Mẫu âm giai không hợp lệ')
    ids.add(row.id)
    if (!Array.isArray(row.pos?.frets) || row.pos.frets.length !== 6 || !row.noteNames || typeof row.noteNames !== 'object') throw new Error('Thiếu thế bấm')
    if (!row.pos.frets.every((frets: unknown, s: number) => Array.isArray(frets) && frets.length > 0 && new Set(frets).size === frets.length && frets.every(f => Number.isInteger(f) && f >= 1 && f <= 24 && typeof row.noteNames[(OPEN_PITCHES[s] + f) % 12] === 'string' && row.noteNames[(OPEN_PITCHES[s] + f) % 12].trim()))) throw new Error('Nốt ngoài âm giai')
    if (!Array.isArray(row.roots) || row.roots.length === 0 || !row.roots.every((r: { s: number; f: number }) => r && Number.isInteger(r.s) && r.s >= 0 && r.s < 6 && row.pos.frets[r.s].includes(r.f))) throw new Error('Chủ âm ngoài thế bấm')
  }
  return value as ScaleWarmup[]
}
