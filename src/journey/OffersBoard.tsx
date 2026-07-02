// ── JOURNEY OS — GĐ4A: Ưu đãi (offer_campaigns) ──
import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../supabase'
import { TEN_NANG_LUC } from '../hanhtrinh'
import { fmtDMY } from './sessions'

const S = { surface: '#FFFFFF', border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', accent: '#4F46E5', accentLight: '#EEF2FF', bg: '#F4F4F5', ok: '#16A34A', okBg: '#F0FDF4', warn: '#B45309', warnBg: '#FEF3C7', err: '#DC2626' }

interface Offer {
  id: string; name: string; course_code: string | null; package_code: string | null
  original_price: string | null; offer_price: string | null; start_at: string | null; end_at: string | null
  quota: number | null; used_quota: number; target_rules: string | null; status: string; note: string | null
}
interface Course { id: string; name: string; code: string | null }

const blank = (): Partial<Offer> & { id?: string } => ({
  name: '', course_code: '', package_code: '', original_price: '', offer_price: '',
  start_at: null, end_at: null, quota: null, used_quota: 0, target_rules: '', status: 'active', note: '',
})

// trạng thái hiệu lực THỰC theo ngày + quota (khác status lưu)
function liveState(o: Offer): { label: string; color: string; bg: string } {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (o.status === 'paused') return { label: 'Tạm dừng', color: S.text3, bg: '#F4F4F5' }
  if (o.status === 'draft') return { label: 'Nháp', color: S.text3, bg: '#F4F4F5' }
  if (o.end_at && new Date(o.end_at) < today) return { label: 'Hết hạn', color: S.err, bg: '#FEF2F2' }
  if (o.start_at && new Date(o.start_at) > today) return { label: 'Sắp mở', color: S.warn, bg: S.warnBg }
  if (o.quota != null && o.used_quota >= o.quota) return { label: 'Hết suất', color: S.err, bg: '#FEF2F2' }
  return { label: 'Đang chạy', color: S.ok, bg: S.okBg }
}

export default function OffersBoard({ courses }: { courses: Course[] }) {
  const [rows, setRows] = useState<Offer[]>([])
  const [form, setForm] = useState<(Partial<Offer> & { id?: string }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    const { data } = await supabase.from('offer_campaigns').select('*').order('created_at', { ascending: false })
    setRows((data ?? []) as Offer[])
  }
  useEffect(() => { load() }, [])

  const codes = Array.from(new Set(courses.map(c => (c.code || '').toUpperCase()).filter(Boolean)))
  const allCodes = codes.length ? codes : Object.keys(TEN_NANG_LUC)

  const save = async () => {
    if (!form || !form.name?.trim()) { setMsg('Nhập tên chương trình.'); return }
    setBusy(true); setMsg('')
    const rec: any = {
      name: form.name.trim(), course_code: form.course_code || null, package_code: form.package_code?.trim() || null,
      original_price: form.original_price?.trim() || null, offer_price: form.offer_price?.trim() || null,
      start_at: form.start_at || null, end_at: form.end_at || null,
      quota: form.quota ?? null, used_quota: form.used_quota ?? 0,
      target_rules: form.target_rules?.trim() || null, status: form.status || 'active', note: form.note?.trim() || null,
    }
    const q = form.id ? supabase.from('offer_campaigns').update(rec).eq('id', form.id) : supabase.from('offer_campaigns').insert(rec)
    const { error } = await q
    setBusy(false)
    if (error) { setMsg('Lưu lỗi: ' + error.message); return }
    setForm(null); load()
  }
  const del = async (o: Offer) => { if (!confirm(`Xoá ưu đãi "${o.name}"?`)) return; await supabase.from('offer_campaigns').delete().eq('id', o.id); load() }

  const inp: CSSProperties = { width: '100%', padding: '8px 11px', border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl: CSSProperties = { fontSize: 11.5, fontWeight: 700, color: S.text2, marginBottom: 3, display: 'block' }
  const set = (p: Partial<Offer>) => setForm(f => f ? { ...f, ...p } : f)

  return (
    <div>
      {msg && <div style={{ background: '#FEF2F2', color: S.err, border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>⚠ {msg}</div>}

      {!form && <button onClick={() => setForm(blank())} style={{ background: S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16 }}>＋ Thêm ưu đãi</button>}

      {form && (
        <div style={{ background: S.surface, border: `1.5px solid ${S.accent}`, borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: S.text1, marginBottom: 10 }}>{form.id ? 'Sửa ưu đãi' : 'Ưu đãi mới'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1 / 3' }}><label style={lbl}>Tên chương trình *</label><input style={inp} value={form.name ?? ''} onChange={e => set({ name: e.target.value })} placeholder="Đăng ký sớm HT2027" /></div>
            <div><label style={lbl}>Trạng thái</label>
              <select style={inp} value={form.status} onChange={e => set({ status: e.target.value })}>
                {['active', 'draft', 'paused'].map(s => <option key={s} value={s}>{s === 'active' ? 'Đang chạy' : s === 'draft' ? 'Nháp' : 'Tạm dừng'}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Gắn mã năng lực</label>
              <select style={inp} value={form.course_code ?? ''} onChange={e => set({ course_code: e.target.value })}>
                <option value="">— (không gắn) —</option>
                {allCodes.map(c => <option key={c} value={c}>{c} · {TEN_NANG_LUC[c] ?? c}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Gói / Combo</label><input style={inp} value={form.package_code ?? ''} onChange={e => set({ package_code: e.target.value })} placeholder="Combo 10 khoá" /></div>
            <div><label style={lbl}>Suất (quota)</label><input type="number" min={0} style={inp} value={form.quota ?? ''} onChange={e => set({ quota: e.target.value === '' ? null : +e.target.value })} placeholder="không giới hạn" /></div>
            <div><label style={lbl}>Giá gốc</label><input style={inp} value={form.original_price ?? ''} onChange={e => set({ original_price: e.target.value })} placeholder="990k" /></div>
            <div><label style={lbl}>Giá ưu đãi</label><input style={inp} value={form.offer_price ?? ''} onChange={e => set({ offer_price: e.target.value })} placeholder="690k" /></div>
            <div><label style={lbl}>Đã dùng</label><input type="number" min={0} style={inp} value={form.used_quota ?? 0} onChange={e => set({ used_quota: +e.target.value || 0 })} /></div>
            <div><label style={lbl}>Bắt đầu</label><input type="date" style={inp} value={form.start_at ?? ''} onChange={e => set({ start_at: e.target.value || null })} /></div>
            <div><label style={lbl}>Hết hạn</label><input type="date" style={inp} value={form.end_at ?? ''} onChange={e => set({ end_at: e.target.value || null })} /></div>
            <div style={{ gridColumn: '1 / 4' }}><label style={lbl}>Điều kiện / đối tượng</label><input style={inp} value={form.target_rules ?? ''} onChange={e => set({ target_rules: e.target.value })} placeholder="HV đã hoàn thành DH2 hoặc TN2" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={save} disabled={busy} style={{ background: busy ? S.text3 : S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{busy ? 'Đang lưu…' : '💾 Lưu'}</button>
            <button onClick={() => { setForm(null); setMsg('') }} style={{ background: '#fff', color: S.text2, border: `1px solid ${S.border}`, borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Huỷ</button>
          </div>
        </div>
      )}

      {rows.length === 0 && !form ? (
        <div style={{ textAlign: 'center', color: S.text3, padding: 30 }}>Chưa có ưu đãi nào.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(o => {
            const st = liveState(o)
            return (
              <div key={o.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: '13px 15px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: S.text1 }}>{o.name}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: st.color, background: st.bg, borderRadius: 6, padding: '2px 8px' }}>{st.label}</span>
                    {o.course_code && <span style={{ fontSize: 11, fontWeight: 800, color: S.accent, background: S.accentLight, borderRadius: 5, padding: '1px 6px' }}>{o.course_code}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: S.text2, marginTop: 4 }}>
                    {o.original_price && o.offer_price ? <><span style={{ textDecoration: 'line-through', color: S.text3 }}>{o.original_price}</span> → <b style={{ color: S.err }}>{o.offer_price}</b></> : (o.offer_price || o.original_price || '')}
                    {o.package_code ? ` · ${o.package_code}` : ''}
                    {o.quota != null ? ` · ${o.used_quota}/${o.quota} suất` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: S.text3, marginTop: 3 }}>
                    {o.start_at || o.end_at ? `${fmtDMY(o.start_at)} → ${fmtDMY(o.end_at)}` : 'không giới hạn thời gian'}
                    {o.target_rules ? ` · ${o.target_rules}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setForm({ ...o })} style={{ background: S.accentLight, color: S.accent, border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Sửa</button>
                  <button onClick={() => del(o)} style={{ background: '#fff', color: S.err, border: `1px solid ${S.border}`, borderRadius: 7, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Xoá</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
