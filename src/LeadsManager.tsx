// LeadsManager — tab "Đăng ký" trong admin. Quản lý bảng leads từ trang tuyển sinh.
// Đọc/cập nhật status (authenticated). Lọc theo trạng thái, xem chi tiết, đổi trạng thái.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const C = {
  accent: '#4F46E5', accentLight: '#EEF2FF', border: '#E4E4E7',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', bg: '#F4F4F5', surface: '#FFFFFF',
}

const STATUSES = ['Mới đăng ký', 'Cần gọi', 'Đã tư vấn', 'Học thử', 'Dùng thử app', 'Đã đóng phí', 'Chưa phù hợp']
const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  'Mới đăng ký':  { bg: '#EEF2FF', fg: '#4338CA' },
  'Cần gọi':      { bg: '#FEF3C7', fg: '#92400E' },
  'Đã tư vấn':    { bg: '#E0F2FE', fg: '#075985' },
  'Học thử':      { bg: '#F3E8FF', fg: '#6B21A8' },
  'Dùng thử app': { bg: '#FAE8FF', fg: '#86198F' },
  'Đã đóng phí':  { bg: '#DCFCE7', fg: '#166534' },
  'Chưa phù hợp': { bg: '#F4F4F5', fg: '#71717A' },
}
const INTENT_LABEL: Record<string, string> = {
  dang_ky: 'Đăng ký lớp', hoc_thu_lop: 'Học thử lớp', dung_thu_app: 'Dùng thử app',
}

interface Lead {
  id: number; name: string; phone: string; zalo: string | null; email: string | null
  class_name: string | null; path: string | null; intent: string | null; note: string | null
  source: string | null; status: string; created_at: string
}

export default function LeadsManager() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [q, setQ] = useState('')

  const load = async () => {
    setLoading(true); setErr(null)
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (error) { setErr(error.message); setLoading(false); return }
    setLeads((data ?? []) as Lead[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    leads.forEach(l => { m[l.status] = (m[l.status] ?? 0) + 1 })
    return m
  }, [leads])

  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return leads.filter(l =>
      (filter === 'all' || l.status === filter) &&
      (!kw || [l.name, l.phone, l.zalo, l.email, l.class_name].some(x => (x ?? '').toLowerCase().includes(kw)))
    )
  }, [leads, filter, q])

  const setStatus = async (id: number, status: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))  // optimistic
    const { error } = await supabase.from('leads').update({ status }).eq('id', id)
    if (error) { alert('Đổi trạng thái lỗi: ' + error.message); load() }
  }

  const fmtDate = (s: string) => {
    const d = new Date(s)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.bg, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text1 }}>Đăng ký từ trang tuyển sinh</h2>
          <div style={{ fontSize: 13, color: C.text3, marginTop: 2 }}>{leads.length} người · cập nhật trạng thái để theo dõi phễu</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm tên / SĐT / email / lớp..."
            style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, width: 240, fontFamily: 'inherit', outline: 'none' }} />
          <button onClick={load} style={{ padding: '8px 14px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>↻ Tải lại</button>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => setFilter('all')}
          style={chipStyle(filter === 'all')}>Tất cả ({leads.length})</button>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)} style={chipStyle(filter === s)}>
            {s} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: C.text3, fontSize: 14, padding: 20 }}>Đang tải...</div>
      ) : err ? (
        <div style={{ color: '#DC2626', fontSize: 14, padding: 16, background: '#FEF2F2', borderRadius: 10, border: '1px solid #FECACA' }}>
          Lỗi đọc bảng leads: {err}<br />
          <span style={{ color: C.text2 }}>Có thể bảng <code>leads</code> chưa được tạo — chạy <code>db/class_tuyensinh_setup.sql</code> trong Supabase.</span>
        </div>
      ) : shown.length === 0 ? (
        <div style={{ color: C.text3, fontSize: 14, padding: 20 }}>Chưa có đăng ký nào{filter !== 'all' ? ' ở trạng thái này' : ''}.</div>
      ) : (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: '#FAFAFA', textAlign: 'left', color: C.text2 }}>
                <th style={th}>Ngày</th>
                <th style={th}>Họ tên</th>
                <th style={th}>Liên hệ</th>
                <th style={th}>Lớp / Ý định</th>
                <th style={th}>Ghi chú</th>
                <th style={th}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(l => (
                <tr key={l.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={td}><span style={{ color: C.text3, whiteSpace: 'nowrap' }}>{fmtDate(l.created_at)}</span></td>
                  <td style={td}><b style={{ color: C.text1 }}>{l.name}</b></td>
                  <td style={td}>
                    <div style={{ whiteSpace: 'nowrap' }}>{l.phone}</div>
                    {l.zalo && <div style={{ color: C.text3, fontSize: 12 }}>Zalo: {l.zalo}</div>}
                    {l.email && <div style={{ color: C.text3, fontSize: 12 }}>{l.email}</div>}
                  </td>
                  <td style={td}>
                    {l.class_name && <div>{l.class_name}</div>}
                    <span style={{ fontSize: 11.5, color: C.accent, background: C.accentLight, borderRadius: 5, padding: '1px 7px' }}>{INTENT_LABEL[l.intent ?? ''] ?? l.intent ?? '—'}</span>
                  </td>
                  <td style={{ ...td, maxWidth: 220, color: C.text2 }}>{l.note || <span style={{ color: C.text3 }}>—</span>}</td>
                  <td style={td}>
                    <select value={l.status} onChange={e => setStatus(l.id, e.target.value)}
                      style={{
                        padding: '5px 8px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        border: 'none', appearance: 'auto',
                        background: (STATUS_COLOR[l.status] ?? STATUS_COLOR['Chưa phù hợp']).bg,
                        color: (STATUS_COLOR[l.status] ?? STATUS_COLOR['Chưa phù hợp']).fg,
                      }}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 14px', fontWeight: 700, fontSize: 12.5 }
const td: React.CSSProperties = { padding: '11px 14px', verticalAlign: 'top' }
function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? C.accent : C.surface,
    color: active ? '#fff' : C.text2,
  }
}
