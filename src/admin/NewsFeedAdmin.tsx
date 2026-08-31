import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { FEED_TYPE_META, type HomeFeedItem } from '../HomeFeed'

// ─────────────────────────────────────────────────────────────────────────────
// Admin "Bản tin" — CMS đơn giản cho home_feed_items (server-driven feed).
// Teacher-only (RLS home_feed_teacher_all). Thumbnail upload vào bucket 'lessons'
// thư mục feed/ (bucket public, tái dụng — không lưu binary vào DB).
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  bg: '#F4F4F5', surface: '#FFFFFF', accent: '#2D6A4F', danger: '#DC2626',
}

type Row = HomeFeedItem & {
  published: boolean
  published_at: string
  expires_at: string | null
  sort_order: number
}

const EMPTY: Partial<Row> = {
  type: 'article', kicker: '', title: '', summary: '', icon: '', tone: '',
  thumbnail_url: null, content_url: '', content_data: {}, open_mode: 'in_app',
  published: true, expires_at: null, sort_order: 100,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 10,
  fontSize: 14, fontFamily: 'inherit', color: C.text1, background: '#fff', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 4, display: 'block' }

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function NewsFeedAdmin() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Row> | null>(null)  // null = đóng form; không id = tạo mới
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('home_feed_items')
      .select('*').order('sort_order', { ascending: true }).order('published_at', { ascending: false })
    if (!error && data) setRows(data as Row[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  const save = async () => {
    if (!editing?.title?.trim()) { flash('Cần nhập tiêu đề'); return }
    setSaving(true)
    const payload = {
      type: editing.type, kicker: editing.kicker ?? '', title: editing.title.trim(),
      summary: editing.summary ?? '', icon: editing.icon ?? '', tone: editing.tone ?? '',
      thumbnail_url: editing.thumbnail_url || null, content_url: editing.content_url?.trim() || null,
      open_mode: editing.open_mode, published: editing.published ?? true,
      published_at: editing.published_at ? new Date(editing.published_at).toISOString() : new Date().toISOString(),
      expires_at: editing.expires_at ? new Date(editing.expires_at).toISOString() : null,
      sort_order: editing.sort_order ?? 100,
    }
    const q = editing.id
      ? supabase.from('home_feed_items').update(payload).eq('id', editing.id)
      : supabase.from('home_feed_items').insert(payload)
    const { error } = await q
    setSaving(false)
    if (error) { flash('Lỗi: ' + error.message); return }
    setEditing(null); flash(editing.id ? 'Đã lưu' : 'Đã đăng'); load()
  }

  const togglePublish = async (r: Row) => {
    await supabase.from('home_feed_items').update({ published: !r.published }).eq('id', r.id)
    load()
  }

  const remove = async (r: Row) => {
    if (!window.confirm(`Xóa bản tin "${r.title}"?`)) return
    await supabase.from('home_feed_items').delete().eq('id', r.id)
    load()
  }

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    const a = rows[i], b = rows[j]
    // sort_order trùng nhau (mặc định 100) thì đổi chỗ không có tác dụng → đánh lại 10,20,30…
    if (a.sort_order === b.sort_order) {
      await Promise.all(rows.map((r, k) => {
        const newOrder = (k === i ? j : k === j ? i : k) * 10 + 10
        return supabase.from('home_feed_items').update({ sort_order: newOrder }).eq('id', r.id)
      }))
    } else {
      await Promise.all([
        supabase.from('home_feed_items').update({ sort_order: b.sort_order }).eq('id', a.id),
        supabase.from('home_feed_items').update({ sort_order: a.sort_order }).eq('id', b.id),
      ])
    }
    load()
  }

  const uploadThumb = async (file: File) => {
    setUploading(true)
    const path = `feed/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const { error } = await supabase.storage.from('lessons').upload(path, file, { upsert: false })
    setUploading(false)
    if (error) { flash('Upload lỗi: ' + error.message); return }
    const { data } = supabase.storage.from('lessons').getPublicUrl(path)
    setEditing(e => e ? { ...e, thumbnail_url: data.publicUrl } : e)
  }

  const meta = (t: Row['type']) => FEED_TYPE_META[t] ?? FEED_TYPE_META.link

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: C.text1 }}>📰 Bản tin hôm nay</h2>
        <button onClick={() => setEditing({ ...EMPTY })}
          style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Đăng bản tin
        </button>
      </div>
      {msg && <div style={{ background: '#E9F3EC', color: C.accent, borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{msg}</div>}

      {/* ── Form tạo/sửa ── */}
      {editing && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.text1, marginBottom: 14 }}>{editing.id ? 'Sửa bản tin' : 'Đăng bản tin mới'}</div>

          <label style={labelStyle}>Loại nội dung</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {(Object.keys(FEED_TYPE_META) as Row['type'][]).map(t => (
              <button key={t} onClick={() => setEditing(e => e ? { ...e, type: t } : e)}
                style={{ padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${editing.type === t ? C.accent : C.border}`, background: editing.type === t ? '#E9F3EC' : '#fff', color: editing.type === t ? C.accent : C.text2, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {FEED_TYPE_META[t].icon} {FEED_TYPE_META[t].label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Tiêu đề *</label>
              <input style={inputStyle} value={editing.title ?? ''} onChange={e => setEditing(v => v ? { ...v, title: e.target.value } : v)} />
            </div>
            <div>
              <label style={labelStyle}>Kicker (nhãn nhỏ — trống = theo loại)</label>
              <input style={inputStyle} placeholder={meta(editing.type ?? 'link').label} value={editing.kicker ?? ''} onChange={e => setEditing(v => v ? { ...v, kicker: e.target.value } : v)} />
            </div>
            <div>
              <label style={labelStyle}>Icon emoji (trống = theo loại)</label>
              <input style={inputStyle} placeholder={meta(editing.type ?? 'link').icon} value={editing.icon ?? ''} onChange={e => setEditing(v => v ? { ...v, icon: e.target.value } : v)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Tóm tắt</label>
              <input style={inputStyle} value={editing.summary ?? ''} onChange={e => setEditing(v => v ? { ...v, summary: e.target.value } : v)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>URL nội dung (link bài viết / video / ảnh / PDF; hoặc route trong app nếu chọn Native)</label>
              <input style={inputStyle} placeholder="https://..." value={editing.content_url ?? ''} onChange={e => setEditing(v => v ? { ...v, content_url: e.target.value } : v)} />
            </div>
            <div>
              <label style={labelStyle}>Cách mở</label>
              <select style={inputStyle} value={editing.open_mode ?? 'in_app'} onChange={e => setEditing(v => v ? { ...v, open_mode: e.target.value as Row['open_mode'] } : v)}>
                <option value="in_app">Trong app (overlay, có nút Đóng)</option>
                <option value="native">Màn hình native của TVA (route)</option>
                <option value="external">Trình duyệt/app ngoài</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Màu nhấn (trống = theo loại)</label>
              <input style={inputStyle} placeholder={meta(editing.type ?? 'link').tone} value={editing.tone ?? ''} onChange={e => setEditing(v => v ? { ...v, tone: e.target.value } : v)} />
            </div>
            <div>
              <label style={labelStyle}>Ngày xuất bản (trống = ngay bây giờ)</label>
              <input type="datetime-local" style={inputStyle} value={toLocalInput(editing.published_at ?? null)} onChange={e => setEditing(v => v ? { ...v, published_at: e.target.value } : v)} />
            </div>
            <div>
              <label style={labelStyle}>Hết hạn (trống = không hết hạn)</label>
              <input type="datetime-local" style={inputStyle} value={toLocalInput(editing.expires_at ?? null)} onChange={e => setEditing(v => v ? { ...v, expires_at: e.target.value || null } : v)} />
            </div>
            <div>
              <label style={labelStyle}>Thumbnail (ảnh — trống = dùng icon)</label>
              <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadThumb(f) }} style={{ fontSize: 13 }} />
              {uploading && <div style={{ fontSize: 12, color: C.text3 }}>Đang tải lên...</div>}
              {editing.thumbnail_url && <img src={editing.thumbnail_url} alt="" style={{ height: 44, borderRadius: 8, marginTop: 6 }} />}
            </div>
            <div>
              <label style={labelStyle}>Thứ tự (nhỏ = lên đầu)</label>
              <input type="number" style={inputStyle} value={editing.sort_order ?? 100} onChange={e => setEditing(v => v ? { ...v, sort_order: Number(e.target.value) } : v)} />
            </div>
          </div>

          {/* Xem trước — đúng khuôn card học viên thấy */}
          <label style={labelStyle}>Xem trước</label>
          {(() => {
            const m = meta(editing.type ?? 'link')
            const tone = editing.tone || m.tone
            return (
              <div style={{ background: '#F0F2F5', borderRadius: 14, padding: 14, marginBottom: 16, maxWidth: 420 }}>
                <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: 92, minHeight: 76, flexShrink: 0, background: editing.thumbnail_url ? '#111' : `linear-gradient(135deg, ${tone}, ${tone}bb)`, display: 'grid', placeItems: 'center', fontSize: 30, overflow: 'hidden' }}>
                    {editing.thumbnail_url ? <img src={editing.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (editing.icon || m.icon)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: tone, textTransform: 'uppercase', letterSpacing: '.04em' }}>{editing.kicker || m.label}</div>
                    <div style={{ fontSize: 14.5, fontWeight: 900, color: '#111827', lineHeight: 1.25, marginTop: 3 }}>{editing.title || '(tiêu đề)'}</div>
                    {editing.summary && <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 4 }}>{editing.summary}</div>}
                  </div>
                </div>
              </div>
            )
          })()}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={save} disabled={saving}
              style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? .6 : 1 }}>
              {saving ? 'Đang lưu...' : editing.id ? 'Lưu' : 'Đăng'}
            </button>
            <button onClick={() => setEditing(null)}
              style={{ background: '#fff', color: C.text2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* ── Danh sách ── */}
      {loading ? <div style={{ color: C.text3, fontSize: 14 }}>Đang tải...</div> : rows.length === 0 ? (
        <div style={{ color: C.text3, fontSize: 14 }}>Chưa có bản tin nào. Bấm "+ Đăng bản tin".</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r, i) => {
            const m = meta(r.type)
            const expired = r.expires_at && new Date(r.expires_at) < new Date()
            const scheduled = new Date(r.published_at) > new Date()
            return (
              <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: r.published && !expired ? 1 : .55 }}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>{r.icon || m.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: C.text3 }}>
                    {m.label} · {r.open_mode === 'in_app' ? 'trong app' : r.open_mode === 'native' ? 'native' : 'ngoài'}
                    {!r.published && ' · ĐANG ẨN'}{expired && ' · HẾT HẠN'}{scheduled && ` · hẹn ${new Date(r.published_at).toLocaleString('vi-VN')}`}
                  </div>
                </div>
                <button onClick={() => move(i, -1)} title="Lên" style={{ border: `1px solid ${C.border}`, background: '#fff', borderRadius: 8, width: 32, height: 32, cursor: 'pointer' }}>↑</button>
                <button onClick={() => move(i, 1)} title="Xuống" style={{ border: `1px solid ${C.border}`, background: '#fff', borderRadius: 8, width: 32, height: 32, cursor: 'pointer' }}>↓</button>
                <button onClick={() => togglePublish(r)} style={{ border: `1px solid ${C.border}`, background: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: r.published ? C.text2 : C.accent, fontFamily: 'inherit' }}>
                  {r.published ? 'Ẩn' : 'Xuất bản'}
                </button>
                <button onClick={() => setEditing({ ...r, published_at: toLocalInput(r.published_at), expires_at: r.expires_at ? toLocalInput(r.expires_at) : null })}
                  style={{ border: `1px solid ${C.border}`, background: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: C.text1, fontFamily: 'inherit' }}>Sửa</button>
                <button onClick={() => remove(r)} style={{ border: 'none', background: 'transparent', fontSize: 14, cursor: 'pointer', color: C.danger }}>🗑</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
