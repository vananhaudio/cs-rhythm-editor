// Tab "🗓 Lịch lớp" trong /admin — quản lý lịch lớp học (thay Google Sheet).
// Mỗi lớp gắn NHIỀU khoá (tick) + 1 nhóm Zalo → nền tảng cho đăng ký 1-chạm.
import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from './supabase'
import { buildClassCode, dangLop, soFromClassCode } from './hanhtrinh'

const S = {
  accent: '#4F46E5', accentLight: '#EEF2FF', surface: '#FFFFFF', bg: '#F4F4F5',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', border: '#E4E4E7',
  ok: '#16A34A', okBg: '#F0FDF4', err: '#DC2626',
}
const SECTIONS = [
  { v: 'upcoming', l: 'Sắp khai giảng' },
  { v: 'active', l: 'Đang học' },
  { v: 'smallgroup', l: 'Nhóm nhỏ' },
  { v: 'oneonone', l: '1 kèm 1' },
]

interface Cls {
  id: string; code: string | null; name: string; section: string
  schedule: string | null; start_text: string | null; duration: string | null; price: string | null
  course_ids: string[]; main_course_id: string | null; group_id: string | null; zoom_url: string | null
  sort_order: number; is_active: boolean
}
interface Course { id: string; name: string; code: string | null }
interface Grp { id: string; name: string; code: string | null; zalo_url: string | null }

const blank = (): Cls => ({
  id: '', code: '', name: '', section: 'upcoming', schedule: '', start_text: '', duration: '8 buổi · mỗi buổi 90 phút',
  price: '990k', course_ids: [], main_course_id: null, group_id: null, zoom_url: '', sort_order: 0, is_active: true,
})

export default function ScheduleManager() {
  const [rows, setRows] = useState<Cls[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [groups, setGroups] = useState<Grp[]>([])
  const [form, setForm] = useState<Cls | null>(null)   // null = không mở form
  const [soKhoa, setSoKhoa] = useState('')             // số khoá (biến đổi) → ghép mã lớp
  const [zaloUrl, setZaloUrl] = useState('')           // link nhóm Zalo (nhóm ≡ mã lớp)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    const { data } = await supabase.from('class_schedule').select('*').order('sort_order').order('created_at')
    setRows((data ?? []) as Cls[])
  }
  useEffect(() => {
    load()
    supabase.from('edu_courses').select('id,name,code').order('sort_order').then(({ data }) => setCourses((data ?? []) as Course[]))
    supabase.from('edu_groups').select('id,name,code,zalo_url').order('name').then(({ data }) => setGroups((data ?? []) as Grp[]))
  }, [])

  const mainCode = () => courses.find(c => c.id === form?.main_course_id)?.code ?? null   // mã năng lực khoá chính
  const maLop = () => buildClassCode(mainCode(), soKhoa) ?? (form?.code || '')            // mã lớp = DH2.KD16

  const set = (patch: Partial<Cls>) => setForm(f => f ? { ...f, ...patch } : f)
  const toggleCourse = (id: string) => setForm(f => {
    if (!f) return f
    const has = f.course_ids.includes(id)
    const course_ids = has ? f.course_ids.filter(x => x !== id) : [...f.course_ids, id]
    // bỏ tick khoá đang là "chính" → gỡ chính; tick khoá đầu tiên → tự làm chính
    let main_course_id = f.main_course_id
    if (has && main_course_id === id) main_course_id = null
    if (!has && !main_course_id) main_course_id = id
    return { ...f, course_ids, main_course_id }
  })

  const save = async () => {
    if (!form || !form.name.trim()) { setMsg('Nhập tên lớp trước nhé.'); return }
    setBusy(true); setMsg('')
    const code = maLop().trim() || null
    // Nhóm Zalo ≡ mã lớp: tự khớp/tạo nhóm cùng mã, cập nhật link (nếu có mã lớp)
    let group_id = form.group_id || null
    if (code) {
      const uid = (await supabase.auth.getUser()).data.user?.id
      const { data: g, error: gErr } = await supabase.from('edu_groups')
        .upsert({ code, name: code, group_type: 'zalo', is_active: true, zalo_url: zaloUrl.trim() || null }, { onConflict: 'code' })
        .select('id').single()
      if (gErr) { setBusy(false); setMsg('Tạo/khớp nhóm Zalo lỗi: ' + gErr.message); return }
      group_id = g?.id ?? group_id
      void uid
    }
    // Khoá chính: ưu tiên ★ đã chọn; nếu chưa, lấy khoá đầu KHÔNG PHẢI NM (NM không làm khoá chính)
    const nonNM = form.course_ids.find(id => courses.find(c => c.id === id)?.code !== 'NM')
    const rec: any = {
      code, name: form.name.trim(), section: form.section,
      schedule: form.schedule?.trim() || null, start_text: form.start_text?.trim() || null,
      duration: form.duration?.trim() || null, price: form.price?.trim() || null,
      course_ids: form.course_ids, main_course_id: form.main_course_id || nonNM || form.course_ids[0] || null,
      group_id, zoom_url: form.zoom_url?.trim() || null,
      sort_order: form.sort_order || 0, is_active: form.is_active,
    }
    const q = form.id
      ? supabase.from('class_schedule').update(rec).eq('id', form.id)
      : supabase.from('class_schedule').insert(rec)
    const { error } = await q
    setBusy(false)
    if (error) { setMsg('Lưu lỗi: ' + error.message); return }
    setForm(null)
    supabase.from('edu_groups').select('id,name,code,zalo_url').order('name').then(({ data }) => setGroups((data ?? []) as Grp[]))
    load()
  }
  const del = async (r: Cls) => {
    if (!confirm(`Xoá lớp "${r.name}"?`)) return
    const { error } = await supabase.from('class_schedule').delete().eq('id', r.id)
    if (error) { alert('Xoá lỗi: ' + error.message); return }
    load()
  }

  const inp: CSSProperties = { width: '100%', padding: '9px 12px', border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl: CSSProperties = { fontSize: 12, fontWeight: 700, color: S.text2, marginBottom: 4, display: 'block' }
  const courseNames = (ids: string[]) => ids.map(id => courses.find(c => c.id === id)?.name).filter(Boolean)
  const groupName = (id: string | null) => groups.find(g => g.id === id)?.name

  return (
    <div style={{ minHeight: '100%', background: S.bg, fontFamily: '"Inter", system-ui, sans-serif' }}>
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${S.border}`, background: S.surface, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: S.text1 }}>🗓 Lịch lớp học</div>
          <div style={{ fontSize: 13, color: S.text3, marginTop: 2 }}>Mỗi lớp gắn sẵn khoá học + nhóm Zalo — set 1 lần, đăng ký tự chảy.</div>
        </div>
        {!form && <button onClick={() => { setForm(blank()); setSoKhoa(''); setZaloUrl('') }} style={{ background: S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>＋ Thêm lớp</button>}
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 24px' }}>
        {msg && <div style={{ background: '#FEF2F2', color: S.err, border: '1px solid #FECACA', borderRadius: 8, padding: '9px 14px', fontSize: 13, marginBottom: 14 }}>⚠ {msg}</div>}

        {/* FORM thêm/sửa */}
        {form && (
          <div style={{ background: S.surface, border: `1.5px solid ${S.accent}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: S.text1, marginBottom: 10 }}>{form.id ? 'Sửa lớp' : 'Lớp mới'}</div>
            {(() => {
              const nl = mainCode(); const ml = buildClassCode(nl, soKhoa)
              return (
                <div style={{ background: nl ? S.accentLight : '#FEF9C3', borderRadius: 10, padding: '8px 12px', marginBottom: 14, fontSize: 13.5 }}>
                  {nl
                    ? <>Mã năng lực: <b>{nl}</b> · dạng lớp <b>{dangLop(nl) ?? '—'}</b> → Mã lớp: <b style={{ color: S.accent, fontSize: 15 }}>{ml ?? '(nhập số khoá)'}</b>{ml && <span style={{ color: S.text3 }}> · nhóm Zalo ≡ {ml}</span>}</>
                    : <span style={{ color: '#854D0E' }}>⚠ Chọn <b>khoá chính (★)</b> ở dưới để tự sinh mã lớp. (Khoá chính chưa có mã năng lực thì mã lớp để trống — gõ tay được.)</span>}
                </div>
              )
            })()}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>Số khoá (khoá thứ mấy)</label><input style={inp} value={soKhoa} onChange={e => setSoKhoa(e.target.value.replace(/\D/g, ''))} placeholder="16" inputMode="numeric" /></div>
              <div><label style={lbl}>Khối</label>
                <select style={inp} value={form.section} onChange={e => set({ section: e.target.value })}>
                  {SECTIONS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / 3' }}><label style={lbl}>Tên lớp *</label><input style={inp} value={form.name} onChange={e => set({ name: e.target.value })} placeholder="Khởi đầu đam mê – Đệm hát TĐ1" /></div>
              <div><label style={lbl}>Lịch (thứ · giờ)</label><input style={inp} value={form.schedule ?? ''} onChange={e => set({ schedule: e.target.value })} placeholder="Thứ 3 · 19h00" /></div>
              <div><label style={lbl}>Khai giảng</label><input style={inp} value={form.start_text ?? ''} onChange={e => set({ start_text: e.target.value })} placeholder="07/07/2026" /></div>
              <div><label style={lbl}>Thời lượng</label><input style={inp} value={form.duration ?? ''} onChange={e => set({ duration: e.target.value })} placeholder="8 buổi · 90 phút" /></div>
              <div><label style={lbl}>Học phí</label><input style={inp} value={form.price ?? ''} onChange={e => set({ price: e.target.value })} placeholder="990k / Combo" /></div>
              <div style={{ gridColumn: '1 / 3' }}><label style={lbl}>Link Zoom (tuỳ chọn)</label><input style={inp} value={form.zoom_url ?? ''} onChange={e => set({ zoom_url: e.target.value })} placeholder="https://zoom.us/j/..." /></div>

              <div><label style={lbl}>💬 Link nhóm Zalo (nhóm ≡ mã lớp, tự khớp)</label>
                <input style={inp} value={zaloUrl} onChange={e => setZaloUrl(e.target.value)} placeholder="https://zalo.me/g/..." />
              </div>
              <div><label style={lbl}>Thứ tự · Hiển thị</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input style={{ ...inp, width: 80 }} type="number" value={form.sort_order} onChange={e => set({ sort_order: +e.target.value || 0 })} />
                  <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_active} onChange={e => set({ is_active: e.target.checked })} /> Đang bật
                  </label>
                </div>
              </div>

              <div style={{ gridColumn: '1 / 3' }}>
                <label style={lbl}>🎓 Khoá học lớp này mở (tick nhiều khoá · chọn ★ khoá CHÍNH để hiện trên trang)</label>
                <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, maxHeight: 220, overflowY: 'auto' }}>
                  {courses.map((c, i) => {
                    const on = form.course_ids.includes(c.id)
                    const main = form.main_course_id === c.id
                    return (
                      <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', fontSize: 13.5, borderTop: i ? `1px solid ${S.border}` : 'none', background: on ? S.accentLight : 'transparent' }}>
                        <input type="checkbox" checked={on} onChange={() => toggleCourse(c.id)} style={{ cursor: 'pointer' }} />
                        {c.code && <span style={{ fontSize: 11, fontWeight: 800, color: '#4F46E5', background: S.accentLight, borderRadius: 5, padding: '1px 6px', flexShrink: 0 }}>{c.code}</span>}
                        <span style={{ flex: 1, color: c.code ? S.text1 : S.text3 }}>{c.name}{!c.code && ' (ngoài hành trình)'}</span>
                        {on && (
                          <button type="button" onClick={() => set({ main_course_id: c.id })}
                            style={{ background: main ? '#FEF3C7' : '#fff', border: `1px solid ${main ? '#F59E0B' : S.border}`, color: main ? '#B45309' : S.text3, borderRadius: 6, padding: '3px 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {main ? '★ Khoá chính' : '☆ Đặt chính'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 12, color: S.text3, marginTop: 4 }}>Đã chọn {form.course_ids.length} khoá · khoá chính = {courses.find(c => c.id === form.main_course_id)?.name ?? '(chưa chọn — mặc định khoá đầu)'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={save} disabled={busy} style={{ background: busy ? S.text3 : S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{busy ? 'Đang lưu…' : '💾 Lưu lớp'}</button>
              <button onClick={() => { setForm(null); setMsg('') }} style={{ background: '#fff', color: S.text2, border: `1px solid ${S.border}`, borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Huỷ</button>
            </div>
          </div>
        )}

        {/* DANH SÁCH lớp */}
        {rows.length === 0 && !form ? (
          <div style={{ textAlign: 'center', color: S.text3, padding: 40 }}>Chưa có lớp nào. Bấm "＋ Thêm lớp" để tạo.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map(r => (
              <div key={r.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 16px', opacity: r.is_active ? 1 : 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: S.text1 }}>
                      {r.code && <span style={{ color: S.accent, marginRight: 6 }}>{r.code}</span>}{r.name}
                      {!r.is_active && <span style={{ fontSize: 11, color: S.text3, fontWeight: 500 }}> · ẩn</span>}
                    </div>
                    <div style={{ fontSize: 13, color: S.text2, marginTop: 3 }}>
                      {SECTIONS.find(s => s.v === r.section)?.l}{r.schedule ? ` · ${r.schedule}` : ''}{r.start_text ? ` · KG ${r.start_text}` : ''}{r.price ? ` · ${r.price}` : ''}
                    </div>
                    <div style={{ fontSize: 12.5, color: S.text3, marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
                      <span>💬 {groupName(r.group_id) ?? <em>chưa gắn nhóm</em>}</span>
                      <span>🎓 {courseNames(r.course_ids).length ? courseNames(r.course_ids).join(', ') : <em>chưa gắn khoá</em>}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => { setForm({ ...r, code: r.code ?? '', schedule: r.schedule ?? '', start_text: r.start_text ?? '', duration: r.duration ?? '', price: r.price ?? '', zoom_url: r.zoom_url ?? '', course_ids: r.course_ids ?? [] }); setSoKhoa(soFromClassCode(r.code)); setZaloUrl(groups.find(g => g.id === r.group_id)?.zalo_url ?? '') }} style={{ background: S.accentLight, color: S.accent, border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Sửa</button>
                    <button onClick={() => del(r)} style={{ background: '#fff', color: S.err, border: `1px solid ${S.border}`, borderRadius: 7, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Xoá</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
