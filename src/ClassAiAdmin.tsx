// ClassAiAdmin — tab admin cho trợ lý AI tuyển sinh.
// 2 phần: (1) Xem hội thoại AI ↔ khách. (2) Huấn luyện AI (persona + bộ kiến thức).
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const C = {
  accent: '#4F46E5', accentLight: '#EEF2FF', border: '#E4E4E7',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', bg: '#F4F4F5', surface: '#FFFFFF', danger: '#DC2626',
}
const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: C.text1, background: C.surface,
}
const Label = ({ children }: { children: React.ReactNode }) =>
  <div style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 6 }}>{children}</div>

interface Session { id: string; last_at: string; created_at: string; note: string | null }
interface Msg { id: number; role: string; content: string; created_at: string }
interface Cfg { id: number; enabled: boolean; model: string; greeting: string | null; persona: string | null }
interface Know { id: number; title: string; content: string; enabled: boolean; order_index: number }

const fmt = (s: string) => { const d = new Date(s); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }

export default function ClassAiAdmin() {
  const [tab, setTab] = useState<'chats' | 'train'>('chats')
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg }}>
      <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <button onClick={() => setTab('chats')} style={pill(tab === 'chats')}>💬 Hội thoại khách</button>
        <button onClick={() => setTab('train')} style={pill(tab === 'train')}>🎓 Huấn luyện AI</button>
      </div>
      {tab === 'chats' ? <Chats /> : <Train />}
    </div>
  )
}
function pill(active: boolean): React.CSSProperties {
  return { padding: '8px 14px', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accent : C.surface, color: active ? '#fff' : C.text2 }
}

// ─── Hội thoại ───────────────────────────────────────────────────────────────
function Chats() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setErr(null)
    const { data, error } = await supabase.from('class_chat_sessions').select('*').order('last_at', { ascending: false }).limit(200)
    if (error) { setErr(error.message); setLoading(false); return }
    setSessions((data ?? []) as Session[]); setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!sel) { setMsgs([]); return }
    supabase.from('class_chat_messages').select('*').eq('session_id', sel).order('created_at').then(({ data }) => setMsgs((data ?? []) as Msg[]))
  }, [sel])

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ width: 300, flexShrink: 0, borderRight: `1px solid ${C.border}`, background: C.surface, overflowY: 'auto' }}>
        <div style={{ padding: 14, borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ fontSize: 14, color: C.text1 }}>{sessions.length} cuộc</b>
          <button onClick={load} style={{ ...inp, width: 'auto', cursor: 'pointer', padding: '6px 10px' }}>↻</button>
        </div>
        {loading ? <div style={{ padding: 16, color: C.text3, fontSize: 14 }}>Đang tải...</div>
          : err ? <div style={{ padding: 16, color: C.danger, fontSize: 13 }}>Lỗi: {err}<br /><span style={{ color: C.text2 }}>Bảng chưa tạo? Chạy <code>db/class_ai_setup.sql</code>.</span></div>
          : sessions.length === 0 ? <div style={{ padding: 16, color: C.text3, fontSize: 14 }}>Chưa có cuộc trò chuyện nào.</div>
          : sessions.map(s => (
            <div key={s.id} onClick={() => setSel(s.id)} style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', background: sel === s.id ? C.accentLight : 'transparent' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>Khách · {s.id.slice(0, 8)}</div>
              <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>{fmt(s.last_at)}</div>
            </div>
          ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {!sel ? <div style={{ color: C.text3, fontSize: 14, paddingTop: 40, textAlign: 'center' }}>Chọn một cuộc trò chuyện để xem.</div>
          : <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgs.map(m => (
              <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-start' : 'flex-end', maxWidth: '82%' }}>
                <div style={{ fontSize: 10.5, color: C.text3, marginBottom: 3, textAlign: m.role === 'user' ? 'left' : 'right' }}>
                  {m.role === 'user' ? 'Khách' : m.role === 'teacher' ? 'Thầy' : 'AI'} · {fmt(m.created_at)}
                </div>
                <div style={{ padding: '10px 13px', borderRadius: 13, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                  background: m.role === 'user' ? '#F4F2EE' : m.role === 'teacher' ? '#FEF3C7' : C.accent,
                  color: m.role === 'ai' ? '#fff' : C.text1,
                  borderBottomLeftRadius: m.role === 'user' ? 4 : 13, borderBottomRightRadius: m.role === 'user' ? 13 : 4 }}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>}
      </div>
    </div>
  )
}

// ─── Huấn luyện AI ───────────────────────────────────────────────────────────
function Train() {
  const [cfg, setCfg] = useState<Cfg | null>(null)
  const [knows, setKnows] = useState<Know[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [editK, setEditK] = useState<Partial<Know> | null>(null)

  const load = async () => {
    const { data: c, error } = await supabase.from('class_ai_config').select('*').eq('id', 1).single()
    if (error) { setErr(error.message); return }
    setCfg(c as Cfg)
    const { data: k } = await supabase.from('class_ai_knowledge').select('*').order('order_index')
    setKnows((k ?? []) as Know[])
  }
  useEffect(() => { load() }, [])

  const saveCfg = async () => {
    if (!cfg) return
    setSaving(true)
    const { error } = await supabase.from('class_ai_config').update({ enabled: cfg.enabled, model: cfg.model, greeting: cfg.greeting, persona: cfg.persona, updated_at: new Date().toISOString() }).eq('id', 1)
    setSaving(false)
    if (error) alert('Lưu lỗi: ' + error.message); else alert('Đã lưu cấu hình AI.')
  }
  const saveK = async () => {
    if (!editK || !editK.title?.trim() || !editK.content?.trim()) { alert('Cần tiêu đề + nội dung.'); return }
    const payload = { title: editK.title.trim(), content: editK.content, enabled: editK.enabled ?? true, order_index: editK.order_index ?? knows.length, updated_at: new Date().toISOString() }
    const { error } = editK.id
      ? await supabase.from('class_ai_knowledge').update(payload).eq('id', editK.id)
      : await supabase.from('class_ai_knowledge').insert(payload)
    if (error) { alert('Lưu lỗi: ' + error.message); return }
    setEditK(null); load()
  }
  const delK = async (id: number) => { if (!confirm('Xóa tài liệu này?')) return; await supabase.from('class_ai_knowledge').delete().eq('id', id); load() }
  const toggleK = async (k: Know) => { await supabase.from('class_ai_knowledge').update({ enabled: !k.enabled }).eq('id', k.id); load() }

  if (err) return <div style={{ padding: 24, color: C.danger }}>Lỗi: {err}<br /><span style={{ color: C.text2 }}>Bảng chưa tạo? Chạy <code>db/class_ai_setup.sql</code>.</span></div>
  if (!cfg) return <div style={{ padding: 24, color: C.text3 }}>Đang tải...</div>

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Cấu hình */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <b style={{ fontSize: 16, color: C.text1 }}>Cấu hình trợ lý</b>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={cfg.enabled} onChange={e => setCfg({ ...cfg, enabled: e.target.checked })} style={{ accentColor: C.accent }} />
              {cfg.enabled ? 'Đang bật' : 'Đang tắt'}
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12, marginBottom: 12 }}>
            <div><Label>Lời chào đầu</Label><input style={inp} value={cfg.greeting ?? ''} onChange={e => setCfg({ ...cfg, greeting: e.target.value })} /></div>
            <div><Label>Model</Label>
              <select style={{ ...inp, cursor: 'pointer' }} value={cfg.model} onChange={e => setCfg({ ...cfg, model: e.target.value })}>
                <option value="claude-sonnet-4-6">Sonnet (tư vấn mượt)</option>
                <option value="claude-haiku-4-5">Haiku (rẻ, nhanh)</option>
                <option value="claude-opus-4-8">Opus (cao cấp)</option>
              </select>
            </div>
          </div>
          <Label>Persona / quy tắc gốc (system prompt)</Label>
          <textarea style={{ ...inp, minHeight: 200, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: 13, lineHeight: 1.5 }} value={cfg.persona ?? ''} onChange={e => setCfg({ ...cfg, persona: e.target.value })} />
          <div style={{ fontSize: 12.5, color: C.text3, marginTop: 6 }}>Đây là tính cách + giới hạn cốt lõi. Kiến thức chi tiết để ở phần "Bộ kiến thức" bên dưới.</div>
          <button onClick={saveCfg} disabled={saving} style={{ marginTop: 14, background: C.accent, color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Đang lưu...' : '💾 Lưu cấu hình'}
          </button>
        </div>

        {/* Bộ kiến thức */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <b style={{ fontSize: 16, color: C.text1 }}>Bộ kiến thức ({knows.length})</b>
            <button onClick={() => setEditK({ title: '', content: '', enabled: true })} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Thêm tài liệu</button>
          </div>
          <div style={{ fontSize: 13, color: C.text3, marginBottom: 12 }}>Mỗi tài liệu là một mảng kiến thức (vd: chi tiết lớp, học phí, lịch, chính sách, cách xếp trình độ...). AI ghép tất cả tài liệu <b>đang bật</b> vào câu trả lời.</div>

          {knows.length === 0 && <div style={{ color: C.text3, fontSize: 14, padding: 12 }}>Chưa có tài liệu. Bấm "+ Thêm tài liệu" để nạp kiến thức cho AI.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {knows.map(k => (
              <div key={k.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span title={k.enabled ? 'Đang dùng' : 'Tắt'} style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: k.enabled ? '#16A34A' : '#D4D4D8' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text1 }}>{k.title}</div>
                  <div style={{ fontSize: 12, color: C.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.content.slice(0, 90)}</div>
                </div>
                <button onClick={() => toggleK(k)} style={mini()}>{k.enabled ? 'Tắt' : 'Bật'}</button>
                <button onClick={() => setEditK(k)} style={mini()}>Sửa</button>
                <button onClick={() => delK(k.id)} style={{ ...mini(), color: C.danger }}>Xóa</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Editor tài liệu (overlay) */}
      {editK && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditK(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: C.surface, borderRadius: 14, padding: 24, width: '100%', maxWidth: 680, maxHeight: '88vh', overflowY: 'auto' }}>
            <b style={{ fontSize: 16 }}>{editK.id ? 'Sửa tài liệu' : 'Tài liệu mới'}</b>
            <div style={{ margin: '14px 0' }}><Label>Tiêu đề</Label><input style={inp} value={editK.title ?? ''} onChange={e => setEditK({ ...editK, title: e.target.value })} placeholder="VD: Chi tiết lớp Đệm hát · Chính sách học phí · Cách xếp trình độ" /></div>
            <Label>Nội dung</Label>
            <textarea style={{ ...inp, minHeight: 320, resize: 'vertical', lineHeight: 1.6 }} value={editK.content ?? ''} onChange={e => setEditK({ ...editK, content: e.target.value })} placeholder="Dán tài liệu của thầy vào đây — càng chi tiết, AI càng tự tin trả lời đúng." />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button onClick={() => setEditK(null)} style={{ ...inp, width: 'auto', cursor: 'pointer' }}>Hủy</button>
              <button onClick={saveK} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 9, padding: '10px 22px', fontWeight: 700, cursor: 'pointer' }}>💾 Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
function mini(): React.CSSProperties {
  return { border: `1px solid ${C.border}`, background: C.surface, borderRadius: 7, padding: '5px 10px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }
}
