// ── ADMIN: Soạn bài STRUM SCORE (nền synth) ───────────────────────────────────
// Thầy nhập: tên · điệu (quyết định nhịp) · tempo · kiểu quạt (chùm) · vòng hợp âm.
// Lưu vào bảng strum_songs. Có "Xem thử" mở ngay Strum Score player.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { STYLES } from './elearn/backing/backingStyles'
import { STRUM_PATTERNS } from './elearn/strumPatterns'
import ChordStrumPlayer, { type StrumSong } from './elearn/ChordStrumPlayer'

const A = { accent: '#4F46E5', bg: '#F4F4F5', surface: '#fff', border: '#E4E4E7', ink: '#18181B', sub: '#71717A' }

interface Row {
  id: string; title: string; time_signature: number; tempo: number
  style_id: string | null; pattern_id: string; chords: string[]; enabled: boolean; order_index: number
}

function rowToSong(r: { title: string; time_signature: number; tempo: number; style_id: string | null; pattern_id: string; chords: string[] }): StrumSong {
  return {
    title: r.title, bpm: r.tempo, timeSignature: r.time_signature, gridOffset: 0,
    patternId: r.pattern_id,
    backing: r.style_id ? { styleId: r.style_id, tempo: r.tempo } : undefined,
    bars: (r.chords || []).map((c) => ({ chord: c })),
  }
}

export default function StrumSongsManager() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<StrumSong | null>(null)

  // form
  const [editId, setEditId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [styleId, setStyleId] = useState('ballad')
  const [tempo, setTempo] = useState(70)
  const [patternId, setPatternId] = useState('chum2')
  const [chordsText, setChordsText] = useState('C Am F G')
  const [saving, setSaving] = useState(false)

  const style = useMemo(() => STYLES.find((s) => s.id === styleId) ?? STYLES[0], [styleId])
  const N = style.beatsPerBar
  const patterns = useMemo(() => STRUM_PATTERNS.filter((p) => p.beatsPerBar === N), [N])
  const chords = useMemo(() => chordsText.trim().split(/\s+/).filter(Boolean), [chordsText])

  // pattern phải khớp nhịp của điệu
  useEffect(() => { if (!patterns.find((p) => p.id === patternId)) setPatternId(patterns[0]?.id ?? 'chum2') }, [patterns, patternId])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('strum_songs').select('*').order('order_index').order('created_at')
    setRows((data as Row[]) ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const resetForm = () => { setEditId(null); setTitle(''); setStyleId('ballad'); setTempo(70); setPatternId('chum2'); setChordsText('C Am F G') }
  const editRow = (r: Row) => { setEditId(r.id); setTitle(r.title); setStyleId(r.style_id ?? 'ballad'); setTempo(r.tempo); setPatternId(r.pattern_id); setChordsText((r.chords || []).join(' ')) }

  const save = async () => {
    if (!title.trim() || chords.length === 0) { alert('Cần Tên bài và ít nhất 1 hợp âm.'); return }
    setSaving(true)
    const id = editId ?? (crypto.randomUUID?.() ?? 'ss_' + Date.now())
    const payload = { id, title: title.trim(), time_signature: N, tempo, style_id: styleId, pattern_id: patternId, chords, enabled: true, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('strum_songs').upsert(payload)
    setSaving(false)
    if (error) { alert('Lỗi lưu: ' + error.message); return }
    resetForm(); load()
  }
  const del = async (r: Row) => { if (!confirm(`Xoá "${r.title}"?`)) return; await supabase.from('strum_songs').delete().eq('id', r.id); load() }
  const toggle = async (r: Row) => { await supabase.from('strum_songs').update({ enabled: !r.enabled }).eq('id', r.id); load() }

  const curSong = (): StrumSong => rowToSong({ title: title || 'Xem thử', time_signature: N, tempo, style_id: styleId, pattern_id: patternId, chords })

  const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 8, border: `1px solid ${A.border}`, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: A.sub, marginBottom: 5, display: 'block' }

  return (
    <div style={{ maxWidth: 760, fontFamily: 'inherit' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: A.ink, margin: '0 0 4px' }}>Soạn bài Strum Score</h2>
      <p style={{ fontSize: 13.5, color: A.sub, margin: '0 0 18px', lineHeight: 1.6 }}>Bài tập quạt theo <b>nền trống+bass tự sinh</b> (không cần thu âm, sạch bản quyền). Chọn điệu, kiểu quạt, nhập vòng hợp âm là xong.</p>

      {/* FORM */}
      <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 14, padding: 18, marginBottom: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: A.accent, marginBottom: 12 }}>{editId ? '✎ Sửa bài' : '+ Bài mới'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / 3' }}>
            <label style={lbl}>Tên bài</label>
            <input style={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Quạt Ballad — vòng Pop" />
          </div>
          <div>
            <label style={lbl}>Điệu nền (quyết định nhịp)</label>
            <select style={inp} value={styleId} onChange={(e) => { setStyleId(e.target.value); const s = STYLES.find((x) => x.id === e.target.value); if (s) setTempo(s.defaultTempo) }}>
              {STYLES.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.beatsPerBar}/4)</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Tempo (bpm)</label>
            <input style={inp} type="number" value={tempo} min={40} max={200} onChange={(e) => setTempo(+e.target.value || 70)} />
          </div>
          <div>
            <label style={lbl}>Kiểu quạt (chùm) · nhịp {N}/4</label>
            <select style={inp} value={patternId} onChange={(e) => setPatternId(e.target.value)}>
              {patterns.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div style={{ fontSize: 11.5, color: A.sub, marginTop: 4 }}>{STRUM_PATTERNS.find((p) => p.id === patternId)?.note}</div>
          </div>
          <div>
            <label style={lbl}>Vòng hợp âm (cách nhau bằng dấu cách)</label>
            <input style={inp} value={chordsText} onChange={(e) => setChordsText(e.target.value)} placeholder="C Am F G" />
            <div style={{ fontSize: 11.5, color: A.sub, marginTop: 4 }}>{chords.length} ô nhịp</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={save} disabled={saving} style={{ background: A.accent, color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? 'Đang lưu…' : editId ? 'Lưu thay đổi' : '+ Tạo bài'}</button>
          <button onClick={() => setPreview(curSong())} style={{ background: '#fff', color: A.accent, border: `1.5px solid ${A.accent}`, borderRadius: 9, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>▶ Xem thử</button>
          {editId && <button onClick={resetForm} style={{ background: 'none', color: A.sub, border: 'none', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Huỷ sửa</button>}
        </div>
      </div>

      {/* DANH SÁCH */}
      <div style={{ fontSize: 13, fontWeight: 800, color: A.ink, marginBottom: 10 }}>Bài đã soạn ({rows.length})</div>
      {loading ? <div style={{ color: A.sub }}>Đang tải…</div> : rows.length === 0 ? (
        <div style={{ color: A.sub, fontSize: 13.5 }}>Chưa có bài nào. Tạo bài đầu tiên ở trên ↑</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: r.enabled ? 1 : 0.5 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: A.ink }}>{r.title}</div>
                <div style={{ fontSize: 12, color: A.sub, marginTop: 2 }}>{STYLES.find((s) => s.id === r.style_id)?.name ?? '—'} · {r.tempo}bpm · {STRUM_PATTERNS.find((p) => p.id === r.pattern_id)?.name} · {(r.chords || []).join(' ')}</div>
              </div>
              <button onClick={() => setPreview(rowToSong(r))} style={{ background: '#EEF2FF', color: A.accent, border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>▶ Xem</button>
              <button onClick={() => editRow(r)} style={{ background: 'none', color: A.sub, border: `1px solid ${A.border}`, borderRadius: 7, padding: '7px 10px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Sửa</button>
              <button onClick={() => toggle(r)} style={{ background: 'none', color: A.sub, border: `1px solid ${A.border}`, borderRadius: 7, padding: '7px 10px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{r.enabled ? 'Ẩn' : 'Hiện'}</button>
              <button onClick={() => del(r)} style={{ background: 'none', color: '#DC2626', border: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Xoá</button>
            </div>
          ))}
        </div>
      )}

      {preview && <ChordStrumPlayer song={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
