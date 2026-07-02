// ── JOURNEY OS — GĐ3: Bảng nhu cầu mở lớp (class_demands) ──
// Thầy nhập tay: ai muốn học mã năng lực nào + khung giờ. Gom theo khoá → rule R2 đề xuất mở lớp nháp.
import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../supabase'
import { TEN_NANG_LUC } from '../hanhtrinh'

const S = { surface: '#FFFFFF', border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', accent: '#4F46E5', accentLight: '#EEF2FF', bg: '#F4F4F5', ok: '#16A34A', okBg: '#F0FDF4', warn: '#B45309', warnBg: '#FEF3C7', err: '#DC2626' }
const THRESHOLD = 4  // rule R2: đủ ngần này người chờ cùng 1 khoá → gợi ý mở lớp

interface Demand {
  id: string; student_id: string | null; student_name: string | null; course_code: string
  preferred_days: string | null; preferred_times: string | null; priority: number; status: string; note: string | null
}
interface Course { id: string; name: string; code: string | null }

const blank = () => ({ student_name: '', course_code: '', preferred_days: '', preferred_times: '', priority: 0, note: '' })

export default function DemandsBoard({ courses, onCreateDraft }: {
  courses: Course[]; onCreateDraft: (code: string, demandIds: string[]) => void
}) {
  const [rows, setRows] = useState<Demand[]>([])
  const [f, setF] = useState(blank())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    const { data } = await supabase.from('class_demands').select('*').order('created_at', { ascending: false })
    setRows((data ?? []) as Demand[])
  }
  useEffect(() => { load() }, [])

  // các mã năng lực có khoá thật trong DB (ưu tiên), fallback toàn bộ TEN_NANG_LUC
  const codeOptions = Array.from(new Set(courses.map(c => (c.code || '').toUpperCase()).filter(Boolean)))
  const allCodes = codeOptions.length ? codeOptions : Object.keys(TEN_NANG_LUC)

  const add = async () => {
    if (!f.course_code) { setMsg('Chọn mã năng lực muốn học.'); return }
    setBusy(true); setMsg('')
    const { error } = await supabase.from('class_demands').insert({
      student_name: f.student_name.trim() || null, course_code: f.course_code,
      preferred_days: f.preferred_days.trim() || null, preferred_times: f.preferred_times.trim() || null,
      priority: f.priority, note: f.note.trim() || null, source: 'admin', status: 'waiting',
    })
    setBusy(false)
    if (error) { setMsg('Lưu lỗi: ' + error.message); return }
    setF(blank()); load()
  }
  const setStatus = async (id: string, status: string) => { await supabase.from('class_demands').update({ status }).eq('id', id); load() }
  const del = async (id: string) => { if (!confirm('Xoá nhu cầu này?')) return; await supabase.from('class_demands').delete().eq('id', id); load() }

  // gom theo mã năng lực (chỉ đang chờ)
  const waiting = rows.filter(r => r.status === 'waiting')
  const groups = allCodes
    .map(code => ({ code, items: waiting.filter(r => r.course_code.toUpperCase() === code) }))
    .filter(g => g.items.length)
    .sort((a, b) => b.items.length - a.items.length)

  const inp: CSSProperties = { width: '100%', padding: '8px 11px', border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl: CSSProperties = { fontSize: 11.5, fontWeight: 700, color: S.text2, marginBottom: 3, display: 'block' }

  return (
    <div>
      {msg && <div style={{ background: '#FEF2F2', color: S.err, border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>⚠ {msg}</div>}

      {/* Form ghi nhu cầu */}
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: S.text1, marginBottom: 10 }}>＋ Ghi nhu cầu học</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>Học viên (tên)</label><input style={inp} value={f.student_name} onChange={e => setF({ ...f, student_name: e.target.value })} placeholder="Cô Lan / SĐT…" /></div>
          <div><label style={lbl}>Muốn học *</label>
            <select style={inp} value={f.course_code} onChange={e => setF({ ...f, course_code: e.target.value })}>
              <option value="">— chọn —</option>
              {allCodes.map(c => <option key={c} value={c}>{c} · {TEN_NANG_LUC[c] ?? c}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Khung ngày</label><input style={inp} value={f.preferred_days} onChange={e => setF({ ...f, preferred_days: e.target.value })} placeholder="T3, T5" /></div>
          <div><label style={lbl}>Khung giờ</label><input style={inp} value={f.preferred_times} onChange={e => setF({ ...f, preferred_times: e.target.value })} placeholder="tối 19h" /></div>
          <div style={{ gridColumn: '1 / 4' }}><label style={lbl}>Ghi chú</label><input style={inp} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="đã học DH1, muốn học tiếp…" /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', color: S.text2 }}>
              <input type="checkbox" checked={f.priority === 1} onChange={e => setF({ ...f, priority: e.target.checked ? 1 : 0 })} /> Ưu tiên
            </label>
          </div>
        </div>
        <button onClick={add} disabled={busy} style={{ marginTop: 12, background: busy ? S.text3 : S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{busy ? 'Đang lưu…' : 'Thêm nhu cầu'}</button>
      </div>

      {/* Gom theo khoá */}
      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', color: S.text3, padding: 30 }}>Chưa có nhu cầu nào đang chờ.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.map(g => {
            const ready = g.items.length >= THRESHOLD
            return (
              <div key={g.code} style={{ background: S.surface, border: `1.5px solid ${ready ? S.ok : S.border}`, borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: S.accent, background: S.accentLight, borderRadius: 6, padding: '2px 8px' }}>{g.code}</span>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: S.text1 }}>{TEN_NANG_LUC[g.code] ?? g.code}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: ready ? S.ok : S.text2 }}>{g.items.length} người chờ</span>
                  {ready
                    ? <span style={{ fontSize: 11.5, fontWeight: 800, color: S.ok, background: S.okBg, borderRadius: 6, padding: '2px 8px' }}>✓ Đủ mở lớp (≥{THRESHOLD})</span>
                    : <span style={{ fontSize: 11.5, fontWeight: 700, color: S.warn, background: S.warnBg, borderRadius: 6, padding: '2px 8px' }}>còn thiếu {THRESHOLD - g.items.length}</span>}
                  <button onClick={() => onCreateDraft(g.code, g.items.map(i => i.id))}
                    style={{ marginLeft: 'auto', background: ready ? S.ok : '#fff', color: ready ? '#fff' : S.accent, border: `1px solid ${ready ? S.ok : S.accent}`, borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✎ Tạo lớp nháp
                  </button>
                </div>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {g.items.map(it => (
                    <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, background: S.bg, borderRadius: 8, padding: '7px 10px' }}>
                      {it.priority === 1 && <span title="Ưu tiên" style={{ color: '#F59E0B' }}>★</span>}
                      <span style={{ fontWeight: 700, color: S.text1 }}>{it.student_name || '(chưa ghi tên)'}</span>
                      <span style={{ color: S.text3 }}>
                        {[it.preferred_days, it.preferred_times].filter(Boolean).join(' · ') || 'chưa rõ giờ'}
                        {it.note ? ` — ${it.note}` : ''}
                      </span>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <button onClick={() => setStatus(it.id, 'planned')} title="Đánh dấu đã lên kế hoạch" style={miniBtn}>đã xếp</button>
                        <button onClick={() => del(it.id)} style={{ ...miniBtn, color: S.err }}>xoá</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 14, fontSize: 11.5, color: S.text3 }}>
        Ngưỡng gợi ý mở lớp: {THRESHOLD} người/khoá (rule R2). "Tạo lớp nháp" mở form lớp mới với khoá chính đã chọn sẵn, trạng thái Nháp.
      </div>
    </div>
  )
}

const miniBtn: CSSProperties = { background: '#fff', border: `1px solid ${S.border}`, borderRadius: 6, padding: '3px 9px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: S.text2 }
