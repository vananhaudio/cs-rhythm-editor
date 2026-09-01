import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Admin "Hành trình" — sửa journey_curriculum + course_prereqs (server-driven).
// Đổi môn/level/thứ tự/tiên quyết Ở ĐÂY là app (web + native đã cài) đổi theo,
// KHÔNG cần build. Teacher-only (RLS *_teacher_write).
// ─────────────────────────────────────────────────────────────────────────────

const C = { border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', surface: '#FFFFFF', accent: '#2D6A4F' }
const inp: React.CSSProperties = { padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }

type Course = { id: string; name: string; code: string | null; status: string | null }
type Row = { course_id: string; subject: string; level: number; sort_order: number }
type Track = { key: string; title: string }
type Prereq = { code: string; requires: string[] }

export default function JourneyAdmin() {
  const [courses, setCourses] = useState<Course[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const [prereqs, setPrereqs] = useState<Prereq[]>([])
  const [msg, setMsg] = useState('')

  const load = async () => {
    const [c, r, t, p] = await Promise.all([
      supabase.from('edu_courses').select('id,name,code,status').order('sort_order'),
      supabase.from('journey_curriculum').select('*').order('sort_order'),
      supabase.from('journey_tracks').select('key,title').order('sort_order'),
      supabase.from('course_prereqs').select('*').order('code'),
    ])
    setCourses((c.data ?? []) as Course[]); setRows((r.data ?? []) as Row[])
    setTracks((t.data ?? []) as Track[]); setPrereqs((p.data ?? []) as Prereq[])
  }
  useEffect(() => { load() }, [])
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2000) }

  const saveRow = async (r: Row) => {
    const { error } = await supabase.from('journey_curriculum').upsert(r, { onConflict: 'course_id' })
    flash(error ? 'Lỗi: ' + error.message : 'Đã lưu'); if (!error) load()
  }
  const removeRow = async (course_id: string) => {
    await supabase.from('journey_curriculum').delete().eq('course_id', course_id); load()
  }
  const savePrereq = async (p: Prereq) => {
    const { error } = await supabase.from('course_prereqs').upsert(p, { onConflict: 'code' })
    flash(error ? 'Lỗi: ' + error.message : 'Đã lưu'); if (!error) load()
  }

  const nameOf = (id: string) => courses.find(c => c.id === id)?.name ?? id
  const notInJourney = courses.filter(c => (c.status ?? 'on') !== 'off' && !rows.some(r => r.course_id === c.id))

  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 20, color: C.text1 }}>🗺️ Hành trình (server-driven)</h2>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 14 }}>
        Đổi môn / level / thứ tự / tiên quyết ở đây → app học viên (kể cả bản đã cài trên máy) đổi theo trong ~5 phút. KHÔNG cần build hay nộp store.
      </div>
      {msg && <div style={{ background: '#E9F3EC', color: C.accent, borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{msg}</div>}

      <div style={{ fontWeight: 800, fontSize: 15, color: C.text1, margin: '14px 0 8px' }}>Khoá trong hành trình</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => (
          <div key={r.course_id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px', fontSize: 13.5, fontWeight: 700, color: C.text1 }}>{nameOf(r.course_id)}</div>
            <select style={inp} value={r.subject} onChange={e => saveRow({ ...r, subject: e.target.value })}>
              {tracks.map(t => <option key={t.key} value={t.key}>{t.title}</option>)}
            </select>
            <label style={{ fontSize: 12, color: C.text3 }}>Level
              <input type="number" style={{ ...inp, width: 60, marginLeft: 6 }} value={r.level}
                onChange={e => setRows(rs => rs.map(x => x.course_id === r.course_id ? { ...x, level: Number(e.target.value) } : x))}
                onBlur={e => saveRow({ ...r, level: Number(e.target.value) })} />
            </label>
            <label style={{ fontSize: 12, color: C.text3 }}>Thứ tự
              <input type="number" style={{ ...inp, width: 70, marginLeft: 6 }} value={r.sort_order}
                onChange={e => setRows(rs => rs.map(x => x.course_id === r.course_id ? { ...x, sort_order: Number(e.target.value) } : x))}
                onBlur={e => saveRow({ ...r, sort_order: Number(e.target.value) })} />
            </label>
            <button onClick={() => removeRow(r.course_id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#DC2626', fontSize: 14 }}>🗑</button>
          </div>
        ))}
      </div>

      <div style={{ fontWeight: 800, fontSize: 15, color: C.text1, margin: '18px 0 8px' }}>+ Thêm khoá vào hành trình</div>
      <select style={{ ...inp, minWidth: 320 }} value="" onChange={e => {
        if (!e.target.value) return
        saveRow({ course_id: e.target.value, subject: tracks[0]?.key ?? 'dem_hat', level: 1, sort_order: (rows.at(-1)?.sort_order ?? 0) + 10 })
      }}>
        <option value="">— chọn khoá —</option>
        {notInJourney.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <div style={{ fontWeight: 800, fontSize: 15, color: C.text1, margin: '22px 0 8px' }}>Tiên quyết theo mã năng lực</div>
      <div style={{ fontSize: 12.5, color: C.text3, marginBottom: 8 }}>Mã cách nhau bằng dấu phẩy (vd: DH1, NL1). Trống = không tiên quyết.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {prereqs.map(p => (
          <div key={p.code} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 60, fontSize: 13, fontWeight: 800, color: C.text1 }}>{p.code}</div>
            <input style={{ ...inp, flex: 1, maxWidth: 420 }} defaultValue={p.requires.join(', ')}
              onBlur={e => savePrereq({ code: p.code, requires: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) })} />
          </div>
        ))}
      </div>
    </div>
  )
}
