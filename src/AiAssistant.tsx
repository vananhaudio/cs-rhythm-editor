// Tab "Trợ lý AI" trong /admin — thầy chat → AI đề xuất (tạo tài khoản / gán nhóm) → thầy duyệt → mới làm.
// Gọi Edge Function 'admin-ai' (động cơ ẩn). KHÔNG giữ khoá nào ở đây.
import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabase'

const S = {
  accent: '#4F46E5', accentLight: '#EEF2FF', surface: '#FFFFFF', bg: '#F4F4F5',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', border: '#E4E4E7',
  ok: '#16A34A', okBg: '#F0FDF4', err: '#DC2626', errBg: '#FEF2F2',
}

type Msg = { role: 'user' | 'assistant'; content: string }
type Student = { email: string; full_name?: string; password?: string }
type Assignment = { studentEmail: string; groupName: string }
type Proposal = { type: 'students'; students: Student[] } | { type: 'group'; assignments: Assignment[] }
type Result = { email: string; full_name?: string; student?: string; password?: string; group?: string; ok: boolean; error?: string }

const EXAMPLES = [
  'Tạo tài khoản cho em Lan, email lan@gmail.com',
  'Tạo 2 tài khoản: an@gmail.com và binh@gmail.com',
  'Thêm hocsinh02@gmail.com vào nhóm Zalo',
]

// Mật khẩu mặc định khi thầy không nói rõ — học sinh đổi sau trong app
const DEFAULT_PW = '12345678'

export default function AiAssistant() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [results, setResults] = useState<{ kind: 'students' | 'group'; items: Result[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }, [messages, proposal, results, loading])

  async function readErr(e: any): Promise<string> {
    try { const j = await e?.context?.json?.(); if (j?.error) return j.error } catch { /* ignore */ }
    return e?.message || 'Lỗi gọi trợ lý'
  }

  async function send(text?: string) {
    const t = (text ?? input).trim()
    if (!t || loading) return
    setErr(''); setResults(null); setProposal(null)
    const next = [...messages, { role: 'user' as const, content: t }]
    setMessages(next); setInput(''); setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-ai', { body: { action: 'chat', messages: next } })
      if (error) throw error
      const reply: string = data.reply || (data.proposal ? 'Đây là đề xuất của tôi — thầy kiểm rồi bấm xác nhận:' : '(không có phản hồi)')
      setMessages(m => [...m, { role: 'assistant', content: reply }])
      if (data.proposal) setProposal(data.proposal as Proposal)
    } catch (e) { setErr(await readErr(e)) }
    finally { setLoading(false) }
  }

  async function confirm() {
    if (!proposal || busy) return
    const kind = proposal.type
    setBusy(true); setErr('')
    try {
      const body = kind === 'students'
        ? { action: 'create', students: proposal.students.map(s => ({ ...s, password: (s.password || '').trim() || DEFAULT_PW })) }
        : { action: 'add_group', assignments: proposal.assignments }
      const { data, error } = await supabase.functions.invoke('admin-ai', { body })
      if (error) throw error
      const rs: Result[] = data.results || []
      setResults({ kind, items: rs }); setProposal(null)
      const ok = rs.filter(r => r.ok).length
      setMessages(m => [...m, { role: 'assistant', content: kind === 'students'
        ? `Đã tạo ${ok}/${rs.length} tài khoản. Chi tiết (kèm mật khẩu) ở dưới.`
        : `Đã gán ${ok}/${rs.length} vào nhóm. Chi tiết ở dưới.` }])
    } catch (e) { setErr(await readErr(e)) }
    finally { setBusy(false) }
  }

  const count = proposal ? (proposal.type === 'students' ? proposal.students.length : proposal.assignments.length) : 0
  const confirmLabel = proposal?.type === 'group' ? `✓ Xác nhận thêm ${count} vào nhóm` : `✓ Xác nhận tạo ${count} tài khoản`

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: S.bg, fontFamily: '"Inter", system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${S.border}`, background: S.surface }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: S.text1 }}>🤖 Trợ lý AI</div>
        <div style={{ fontSize: 13, color: S.text3, marginTop: 2 }}>Tạo tài khoản học sinh & gán nhóm Zalo — thầy duyệt rồi mới làm.</div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {messages.length === 0 && !proposal && (
          <div style={{ maxWidth: 560, margin: '24px auto', textAlign: 'center', color: S.text3 }}>
            <div style={{ fontSize: 14, marginBottom: 14, color: S.text2 }}>Thử gõ một câu như:</div>
            {EXAMPLES.map((ex, i) => (
              <div key={i} onClick={() => send(ex)}
                style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, fontSize: 14, color: S.text2, cursor: 'pointer' }}>
                « {ex} »
              </div>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <div style={{
              maxWidth: '76%', padding: '10px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? S.accent : S.surface, color: m.role === 'user' ? '#fff' : S.text1,
              border: m.role === 'user' ? 'none' : `1px solid ${S.border}`,
            }}>{m.content}</div>
          </div>
        ))}

        {loading && <div style={{ color: S.text3, fontSize: 13, padding: '4px 2px' }}>Trợ lý đang nghĩ…</div>}

        {/* Đề xuất → chờ thầy duyệt */}
        {proposal && (
          <div style={{ background: S.surface, border: `1.5px solid ${S.accent}`, borderRadius: 12, padding: 16, marginTop: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: S.text1, marginBottom: 10 }}>
              {proposal.type === 'group' ? `Đề xuất thêm ${count} học sinh vào nhóm — thầy kiểm:` : `Đề xuất tạo ${count} tài khoản — thầy kiểm:`}
            </div>
            <div style={{ border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden' }}>
              {proposal.type === 'students'
                ? proposal.students.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 12px', fontSize: 13, borderTop: i ? `1px solid ${S.border}` : 'none' }}>
                    <span style={{ flex: 1, color: S.text1, fontWeight: 600 }}>{s.email}</span>
                    <span style={{ flex: 1, color: S.text2 }}>{s.full_name || <em style={{ color: S.text3 }}>tên từ email</em>}</span>
                    <span style={{ color: S.text3 }}>mk: {s.password || DEFAULT_PW}{s.password ? '' : ' (mặc định)'}</span>
                  </div>
                ))
                : proposal.assignments.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 12px', fontSize: 13, borderTop: i ? `1px solid ${S.border}` : 'none' }}>
                    <span style={{ flex: 1, color: S.text1, fontWeight: 600 }}>{a.studentEmail}</span>
                    <span style={{ color: S.text3 }}>→</span>
                    <span style={{ flex: 1, color: S.text2 }}>{a.groupName}</span>
                  </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={confirm} disabled={busy}
                style={{ padding: '9px 18px', background: busy ? S.text3 : S.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>
                {busy ? 'Đang làm…' : confirmLabel}
              </button>
              <button onClick={() => setProposal(null)} disabled={busy}
                style={{ padding: '9px 18px', background: '#fff', color: S.text2, border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Bỏ
              </button>
            </div>
          </div>
        )}

        {/* Kết quả */}
        {results && (
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: 16, marginTop: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: S.text1, marginBottom: 10 }}>
              {results.kind === 'group' ? 'Kết quả gán nhóm:' : 'Kết quả — lưu mật khẩu để đưa học sinh:'}
            </div>
            {results.items.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 6, background: r.ok ? S.okBg : S.errBg }}>
                <span style={{ color: r.ok ? S.ok : S.err, fontWeight: 700 }}>{r.ok ? '✓' : '✕'}</span>
                <span style={{ flex: 1, color: S.text1, fontWeight: 600 }}>{r.email}</span>
                {r.ok
                  ? (results.kind === 'group'
                    ? <span style={{ color: S.text2 }}>→ {r.group}</span>
                    : <span style={{ color: S.text2, fontFamily: 'monospace' }}>mật khẩu: <b>{r.password}</b></span>)
                  : <span style={{ color: S.err }}>{r.error}</span>}
              </div>
            ))}
          </div>
        )}

        {err && <div style={{ background: S.errBg, color: S.err, border: `1px solid #FECACA`, borderRadius: 8, padding: '10px 14px', fontSize: 13, marginTop: 8 }}>⚠ {err}</div>}
      </div>

      {/* Input */}
      <div style={{ borderTop: `1px solid ${S.border}`, background: S.surface, padding: '12px 24px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Nhắn yêu cầu cho trợ lý… (Enter để gửi, Shift+Enter xuống dòng)"
          rows={1}
          style={{ flex: 1, resize: 'none', maxHeight: 120, padding: '10px 14px', border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: S.text1, lineHeight: 1.5 }} />
        <button onClick={() => send()} disabled={loading || !input.trim()}
          style={{ padding: '10px 20px', background: loading || !input.trim() ? S.text3 : S.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading || !input.trim() ? 'default' : 'pointer', flexShrink: 0 }}>
          Gửi
        </button>
      </div>
    </div>
  )
}
