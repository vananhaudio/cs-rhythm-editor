// /me/mira-owner — Owner đọc và tìm toàn bộ hội thoại học viên với Mira. Quyền do server quyết: không phải Owner ⇒ RPC từ chối ⇒ màn "chỉ dành cho Owner".
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { getConversation, listConversations, student360Href, type MiraConvDetail, type MiraConvItem, type MiraConvList } from './miraOwnerApi'

const fmt = (iso: string) => { const d = new Date(iso); return Number.isNaN(+d) ? '' : d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) }
const card: CSSProperties = { background: 'var(--cs-surface, #fff)', borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }
const btn: CSSProperties = { border: '1px solid #c7c7d1', background: '#fff', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', font: 'inherit' }

export default function MiraOwnerPage({ onBack }: { onBack: () => void }) {
  const [q, setQ] = useState('')
  const [applied, setApplied] = useState('')
  const [list, setList] = useState<MiraConvList | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'forbidden' | 'failed'>('loading')
  const [more, setMore] = useState(false)
  const [open, setOpen] = useState<MiraConvDetail | null>(null)
  const [openErr, setOpenErr] = useState(false)

  const load = useCallback(async (query: string) => {
    setState('loading')
    const r = await listConversations({ q: query })
    if (!r.ok) { setState(r.reason); return }
    setList(r.data); setState('ok')
  }, [])
  useEffect(() => { void load('') }, [load])

  const search = (e: React.FormEvent) => { e.preventDefault(); setApplied(q.trim()); void load(q.trim()) }
  const loadMore = async () => {
    if (!list?.next_before) return
    setMore(true)
    const r = await listConversations({ q: applied, before: list.next_before })
    setMore(false)
    if (r.ok) setList({ ...r.data, items: [...list.items, ...r.data.items] })
  }
  const openConv = async (it: MiraConvItem) => {
    setOpenErr(false)
    const r = await getConversation(it.conversation_id)
    if (!r.ok || !r.data) { setOpenErr(true); return }
    setOpen(r.data)
  }

  if (state === 'forbidden') return <div className="cs-col cs-home"><div className="cs-card lt-empty">Mục này chỉ dành cho Owner.</div></div>

  if (open) {
    const href = student360Href(open.student_id)
    return (
      <div className="cs-col cs-home" style={{ maxWidth: 760 }}>
        <button type="button" style={btn} onClick={() => setOpen(null)}>← Danh sách hội thoại</button>
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{open.display_name ?? 'Học viên'}</div>
          <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>{open.turn_count} lượt · bắt đầu {fmt(open.started_at)} · cập nhật {fmt(open.last_at)}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {href ? <a href={href} style={{ ...btn, textDecoration: 'none', color: 'inherit' }}>Hồ sơ Student 360° →</a> : <span style={{ color: '#888', fontSize: 13 }}>Chưa có hồ sơ học viên</span>}
          </div>
        </div>
        {open.messages.map(m => (
          <div key={m.seq} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
            <div style={{ maxWidth: '86%', padding: '10px 12px', borderRadius: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45,
              background: m.role === 'user' ? '#e0e7ff' : '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.08)' }}>
              <div style={{ fontSize: 11, color: '#777', marginBottom: 3 }}>{m.role === 'user' ? (open.display_name ?? 'Học viên') : 'Mira'} · {fmt(m.created_at)}</div>
              {m.content}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="cs-col cs-home" style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 20, margin: '4px 0 2px' }}>Hội thoại học viên với Mira</h1>
      <div style={{ color: '#666', fontSize: 13, marginBottom: 10 }}>
        Chỉ Owner xem được. {list ? `${list.total_conversations} hội thoại · ${list.total_students} học viên.` : ''}
      </div>
      <form onSubmit={search} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo nội dung hoặc tên học viên (không cần dấu)" aria-label="Tìm hội thoại"
          style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #c7c7d1', font: 'inherit', minWidth: 0 }} />
        <button type="submit" style={btn}>Tìm</button>
      </form>
      {openErr && <div style={{ ...card, color: '#b42318' }}>Không mở được hội thoại này.</div>}
      {state === 'loading' && <div style={card}>Đang tải…</div>}
      {state === 'failed' && <div style={{ ...card, color: '#b42318' }}>Chưa tải được. <button type="button" style={btn} onClick={() => void load(applied)}>Thử lại</button></div>}
      {state === 'ok' && list && list.items.length === 0 && (
        <div style={card}>{applied ? 'Không có hội thoại nào khớp.' : 'Chưa có hội thoại nào. Hội thoại chỉ được lưu khi học viên đã đồng ý thông báo có lưu hội thoại.'}</div>)}
      {state === 'ok' && list?.items.map(it => (
        <button key={it.conversation_id} type="button" onClick={() => void openConv(it)}
          style={{ ...card, display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', font: 'inherit' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <strong>{it.display_name ?? 'Học viên'}</strong><span style={{ color: '#777', fontSize: 12 }}>{fmt(it.last_at)}</span>
          </div>
          <div style={{ color: '#444', marginTop: 4, fontSize: 14 }}>{it.snippet}</div>
          <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{it.turn_count} lượt{it.matched ? ' · khớp từ khoá' : ''}</div>
        </button>
      ))}
      {state === 'ok' && list?.next_before && <button type="button" style={btn} disabled={more} onClick={() => void loadMore()}>{more ? 'Đang tải…' : 'Xem thêm'}</button>}
    </div>
  )
}
