// ── CLASS 2.0 — Bảng chủ đề hỗ trợ (practice_topic_interests) ──
// Học viên/khách đăng ký chủ đề muốn được Thầy hỗ trợ (buổi theo nhu cầu) từ /azz.
// Admin xem: chủ đề nào đang được quan tâm, ai đăng ký, đổi trạng thái xử lý.
import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../supabase'

const S = { surface: '#FFFFFF', border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', accent: '#7C3AED', accentLight: '#F3E8FF', bg: '#F4F4F5', ok: '#16A34A', okBg: '#F0FDF4', warn: '#B45309', warnBg: '#FEF3C7', err: '#DC2626' }

const STATUS: { v: string; l: string; c: string }[] = [
  { v: 'new', l: 'Mới', c: '#7C3AED' },
  { v: 'planned', l: 'Đã lên buổi', c: '#F59E0B' },
  { v: 'done', l: 'Đã tổ chức', c: '#16A34A' },
  { v: 'cancelled', l: 'Đã huỷ', c: '#A1A1AA' },
]
const statusInfo = (v?: string | null) => STATUS.find(s => s.v === v) ?? STATUS[0]
const fmtDT = (iso?: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

interface Row {
  id: string; topic: string; name: string | null; phone: string | null; zalo: string | null
  student_id: string | null; source: string | null; status: string; note: string | null; created_at: string
}

export default function TopicBoard() {
  const [rows, setRows] = useState<Row[]>([])
  const [filter, setFilter] = useState('all')

  const load = async () => {
    const { data } = await supabase.from('practice_topic_interests').select('*').order('created_at', { ascending: false })
    setRows((data ?? []) as Row[])
  }
  useEffect(() => { load() }, [])

  const setStatus = async (id: string, status: string) => { await supabase.from('practice_topic_interests').update({ status }).eq('id', id); load() }
  const del = async (id: string) => { if (!confirm('Xoá đăng ký chủ đề này?')) return; await supabase.from('practice_topic_interests').delete().eq('id', id); load() }

  const visible = filter === 'all' ? rows : rows.filter(r => r.status === filter)

  // Gom theo chủ đề — số người quan tâm (đang xử lý new/planned)
  const active = rows.filter(r => r.status === 'new' || r.status === 'planned')
  const byTopic = Array.from(new Map(active.map(r => [r.topic.toLowerCase(), r.topic])).values())
    .map(t => ({ topic: t, items: active.filter(r => r.topic.toLowerCase() === t.toLowerCase()) }))
    .sort((a, b) => b.items.length - a.items.length)

  const inp: CSSProperties = { padding: '8px 11px', border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff' }

  return (
    <div>
      {/* Tóm tắt theo chủ đề */}
      <div style={{ fontSize: 14, fontWeight: 800, color: S.text1, marginBottom: 4 }}>🧩 Chủ đề được quan tâm</div>
      <div style={{ fontSize: 12.5, color: S.text3, marginBottom: 12 }}>Từ đây có thể tạo buổi hỗ trợ (special session) khi đủ học viên cùng quan tâm.</div>
      {byTopic.length === 0 ? (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: 24, color: S.text3, fontSize: 13.5 }}>Chưa có chủ đề nào được đăng ký từ /azz.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 20 }}>
          {byTopic.map(g => (
            <div key={g.topic} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: S.text1 }}>{g.topic}</div>
              <div style={{ fontSize: 12.5, color: S.text3, marginTop: 3 }}>{g.items.length} người quan tâm{g.items[0].phone ? ` · ${g.items[0].phone}` : ''}</div>
            </div>
          ))}
        </div>
      )}

      {/* Danh sách chi tiết */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: S.text1 }}>Danh sách đăng ký</span>
        {[{ v: 'all', l: 'Tất cả' }, ...STATUS].map(s => (
          <button key={s.v} onClick={() => setFilter(s.v)}
            style={{ ...inp, cursor: 'pointer', fontWeight: filter === s.v ? 800 : 500, color: filter === s.v ? '#fff' : S.text2, background: filter === s.v ? S.accent : '#fff', borderColor: filter === s.v ? S.accent : S.border, padding: '5px 12px' }}>
            {s.l}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: 24, color: S.text3, fontSize: 13.5 }}>Không có đăng ký nào ở trạng thái này.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map(r => (
            <div key={r.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: S.text1 }}>{r.topic}</div>
                <div style={{ fontSize: 12.5, color: S.text2, marginTop: 3 }}>
                  {r.name || '(chưa có tên)'}{r.phone ? ` · ${r.phone}` : ''}{r.zalo ? ` · Zalo: ${r.zalo}` : ''}
                  {r.student_id ? ' · học viên' : ''} · nguồn {r.source ?? 'azz'} · {fmtDT(r.created_at)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={r.status} onChange={e => setStatus(r.id, e.target.value)} style={{ ...inp, cursor: 'pointer', fontWeight: 700, color: statusInfo(r.status).c }}>
                  {STATUS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
                <button onClick={() => del(r.id)} style={{ ...inp, cursor: 'pointer', color: S.err, borderColor: S.border }}>Xoá</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
