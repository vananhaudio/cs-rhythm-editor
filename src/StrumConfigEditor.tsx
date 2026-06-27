// ── Cấu hình bài STRUM SCORE — dùng trong trình soạn khoá (lesson_type='strum') ─
// value = JSON lưu ở cột content của bài. onChange trả JSON-string.
import { useMemo, useState } from 'react'
import { STYLES } from './elearn/backing/backingStyles'
import { STRUM_PATTERNS } from './elearn/strumPatterns'
import ChordStrumPlayer, { type StrumSong } from './elearn/ChordStrumPlayer'

export interface StrumConfig { styleId: string; tempo: number; patternId: string; timeSignature: number; chords: string[] }

export function parseStrumConfig(content: string | null | undefined): StrumConfig {
  try { const c = JSON.parse(content || '{}'); if (c && Array.isArray(c.chords)) return c } catch { /* */ }
  return { styleId: 'ballad', tempo: 70, patternId: 'chum2', timeSignature: 4, chords: ['C', 'Am', 'F', 'G'] }
}

export function configToSong(c: StrumConfig, title = 'Strum Score'): StrumSong {
  return {
    title, bpm: c.tempo, timeSignature: c.timeSignature, gridOffset: 0,
    patternId: c.patternId,
    backing: c.styleId ? { styleId: c.styleId, tempo: c.tempo } : undefined,
    bars: (c.chords || []).map((ch) => ({ chord: ch })),
  }
}

const A = { accent: '#4F46E5', border: '#E4E4E7', sub: '#71717A' }

export default function StrumConfigEditor({ value, onChange, title }: { value: string | null; onChange: (json: string) => void; title?: string }) {
  const cfg = useMemo(() => parseStrumConfig(value), [value])
  const [chordsText, setChordsText] = useState(cfg.chords.join(' '))
  const [preview, setPreview] = useState<StrumSong | null>(null)

  const style = STYLES.find((s) => s.id === cfg.styleId) ?? STYLES[0]
  const N = style.beatsPerBar
  const patterns = STRUM_PATTERNS.filter((p) => p.beatsPerBar === N)
  const set = (patch: Partial<StrumConfig>) => onChange(JSON.stringify({ ...cfg, ...patch, timeSignature: N }))

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${A.border}`, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: A.sub, marginBottom: 4, display: 'block' }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <label style={lbl}>Điệu nền (quyết định nhịp)</label>
        <select style={inp} value={cfg.styleId} onChange={(e) => { const s = STYLES.find((x) => x.id === e.target.value)!; const np = STRUM_PATTERNS.filter((p) => p.beatsPerBar === s.beatsPerBar); const pid = np.find((p) => p.id === cfg.patternId) ? cfg.patternId : np[0]?.id ?? 'chum2'; onChange(JSON.stringify({ ...cfg, styleId: s.id, tempo: s.defaultTempo, timeSignature: s.beatsPerBar, patternId: pid })) }}>
          {STYLES.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.beatsPerBar}/4)</option>)}
        </select>
      </div>
      <div>
        <label style={lbl}>Tempo (bpm)</label>
        <input style={inp} type="number" value={cfg.tempo} min={40} max={200} onChange={(e) => set({ tempo: +e.target.value || 70 })} />
      </div>
      <div>
        <label style={lbl}>Kiểu quạt (chùm) · nhịp {N}/4</label>
        <select style={inp} value={cfg.patternId} onChange={(e) => set({ patternId: e.target.value })}>
          {patterns.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label style={lbl}>Vòng hợp âm (cách bằng dấu cách)</label>
        <input style={inp} value={chordsText} onChange={(e) => { setChordsText(e.target.value); set({ chords: e.target.value.trim().split(/\s+/).filter(Boolean) }) }} placeholder="C Am F G" />
      </div>
      <div style={{ gridColumn: '1 / 3' }}>
        <button type="button" onClick={() => setPreview(configToSong({ ...cfg, chords: chordsText.trim().split(/\s+/).filter(Boolean) }, title || 'Xem thử'))}
          style={{ background: '#fff', color: A.accent, border: `1.5px solid ${A.accent}`, borderRadius: 8, padding: '8px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>▶ Xem thử</button>
        <span style={{ fontSize: 12, color: A.sub, marginLeft: 10 }}>{chordsText.trim().split(/\s+/).filter(Boolean).length} ô · {STRUM_PATTERNS.find((p) => p.id === cfg.patternId)?.note}</span>
      </div>
      {preview && <ChordStrumPlayer song={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
