// ArticlesManager — tab "Bài viết" trong admin. CRUD bảng articles cho trang tuyển sinh.
// Mỗi bài gắn 1 "slot" (vị trí trên trang /class). Bài published + đúng slot → thẻ showcase sống dậy.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import RichEditor from './RichEditor'

const C = {
  accent: '#4F46E5', accentLight: '#EEF2FF', border: '#E4E4E7',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', bg: '#F4F4F5', surface: '#FFFFFF',
  danger: '#DC2626',
}

// Slot = vị trí thẻ trên trang /class (khớp với showcase STARTERS)
export const ARTICLE_SLOTS: { id: string; label: string }[] = [
  { id: '90-phut-moi-tuan', label: 'Thẻ "90 phút mỗi tuần"' },
  { id: 'hoc-vien-lon-tuoi', label: 'Thẻ "Học viên lớn tuổi"' },
  { id: 'mo-hinh-hoc',       label: 'Thẻ "Xem một buổi học"' },
  { id: 'dung-thu-app',      label: 'Thẻ "Mở bài học thử trên app"' },
  { id: 'cam-ket',           label: 'Thẻ "Bạn được hỗ trợ gì"' },
  { id: 'khac',              label: 'Khác (chưa gắn vị trí)' },
]
const SLOT_LABEL = Object.fromEntries(ARTICLE_SLOTS.map(s => [s.id, s.label]))

interface Article {
  id: number; title: string; slug: string | null; slot: string | null
  body: string | null; published: boolean; updated_at: string
}

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60)

export default function ArticlesManager() {
  const [list, setList] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [sel, setSel] = useState<Article | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true); setErr(null)
    const { data, error } = await supabase.from('articles').select('*').order('updated_at', { ascending: false })
    if (error) { setErr(error.message); setLoading(false); return }
    setList((data ?? []) as Article[]); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const newArticle = () => setSel({ id: 0, title: '', slug: null, slot: '90-phut-moi-tuan', body: '', published: false, updated_at: '' })

  const save = async () => {
    if (!sel) return
    if (!sel.title.trim()) { alert('Cần nhập tiêu đề bài viết.'); return }
    setSaving(true)
    const payload = {
      title: sel.title.trim(), slug: sel.slug || slugify(sel.title), slot: sel.slot,
      body: sel.body, published: sel.published, updated_at: new Date().toISOString(),
    }
    let error
    if (sel.id) ({ error } = await supabase.from('articles').update(payload).eq('id', sel.id))
    else ({ error } = await supabase.from('articles').insert(payload))
    setSaving(false)
    if (error) { alert('Lưu lỗi: ' + error.message); return }
    setSel(null); load()
  }

  const del = async (a: Article) => {
    if (!confirm(`Xóa bài "${a.title}"?`)) return
    const { error } = await supabase.from('articles').delete().eq('id', a.id)
    if (error) { alert('Xóa lỗi: ' + error.message); return }
    setSel(null); load()
  }

  const patch = (p: Partial<Article>) => setSel(s => s ? { ...s, ...p } : s)

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Danh sách */}
      <div style={{ width: 320, flexShrink: 0, borderRight: `1px solid ${C.border}`, background: C.surface, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ fontSize: 15, color: C.text1 }}>Bài viết</b>
          <button onClick={newArticle} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Bài mới</button>
        </div>
        {loading ? <div style={{ padding: 16, color: C.text3, fontSize: 14 }}>Đang tải...</div>
          : err ? <div style={{ padding: 16, color: C.danger, fontSize: 13 }}>Lỗi: {err}<br /><span style={{ color: C.text2 }}>Bảng <code>articles</code> chưa có? Chạy <code>db/class_tuyensinh_setup.sql</code>.</span></div>
          : list.length === 0 ? <div style={{ padding: 16, color: C.text3, fontSize: 14 }}>Chưa có bài nào. Bấm "+ Bài mới".</div>
          : list.map(a => (
            <div key={a.id} onClick={() => setSel(a)}
              style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', background: sel?.id === a.id ? C.accentLight : 'transparent' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text1, display: 'flex', alignItems: 'center', gap: 6 }}>
                {a.published ? <span title="Đã đăng" style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} /> : <span title="Nháp" style={{ width: 8, height: 8, borderRadius: '50%', background: '#D4D4D8', flexShrink: 0 }} />}
                {a.title || '(chưa đặt tên)'}
              </div>
              <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>{SLOT_LABEL[a.slot ?? ''] ?? a.slot ?? '—'}</div>
            </div>
          ))}
      </div>

      {/* Editor */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: C.bg }}>
        {!sel ? (
          <div style={{ color: C.text3, fontSize: 14, paddingTop: 40, textAlign: 'center' }}>Chọn một bài để sửa, hoặc tạo bài mới.</div>
        ) : (
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text1 }}>{sel.id ? 'Sửa bài viết' : 'Bài viết mới'}</h2>
              <button onClick={() => setSel(null)} style={{ border: `1px solid ${C.border}`, background: C.surface, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>Đóng</button>
            </div>

            <div>
              <Label>Tiêu đề</Label>
              <input value={sel.title} onChange={e => patch({ title: e.target.value })} placeholder="VD: 90 phút mỗi tuần cho cây đàn của bạn"
                style={inp} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
              <div>
                <Label>Hiển thị ở vị trí (slot)</Label>
                <select value={sel.slot ?? 'khac'} onChange={e => patch({ slot: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  {ARTICLE_SLOTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.text1, paddingBottom: 9, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={sel.published} onChange={e => patch({ published: e.target.checked })} style={{ accentColor: C.accent, width: 16, height: 16 }} />
                Đăng (hiện trên trang)
              </label>
            </div>

            <div>
              <Label>Nội dung bài viết</Label>
              <RichEditor value={sel.body ?? ''} onChange={html => patch({ body: html })} />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', paddingTop: 4 }}>
              {sel.id ? <button onClick={() => del(sel)} style={{ border: `1px solid ${C.danger}`, color: C.danger, background: C.surface, borderRadius: 9, padding: '10px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>🗑 Xóa</button> : <span />}
              <button onClick={save} disabled={saving} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 9, padding: '10px 22px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                {saving ? 'Đang lưu...' : '💾 Lưu bài viết'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: C.text1, background: C.surface,
}
const Label = ({ children }: { children: React.ReactNode }) =>
  <div style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 6 }}>{children}</div>
