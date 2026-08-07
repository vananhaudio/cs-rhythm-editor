// ChatMailPage — Gửi mail nhanh kiểu chat (admin)
// Dùng chung hạ tầng: Supabase + edge function send-mail + Resend API key

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase'

// ── Types ──
interface ChatMailThread {
  id: string
  created_at: string
  subject: string
  recipients: string[]
  list_id: string | null
  last_at: string
  status: string
}

interface ChatMailMessage {
  id: string
  created_at: string
  thread_id: string
  to_email: string
  subject: string
  content: string
  status: string
  direction?: string // 'outbound' | 'inbound'
}

interface MailList {
  id: string
  name: string
  emails: string[]
}

// ── Const ──
const EDGE_URL = `${SUPABASE_URL}/functions/v1/send-mail`

// ── Styles ──
const Z = {
  accent: '#0068ff', accentHover: '#0054cc', bg: '#FAFAF8', card: '#FFFFFF',
  border: '#EEEEEE', fg: '#1A1A1A', muted: '#8A8A86', bubble: '#DBEBFF', bubbleFg: '#081C36',
  threadBg: '#EEF0F4', red: '#E64D43', green: '#16A34A', amber: '#F59E0B', gray: '#9CA3AF',
}

// ── Helpers ──
function shortEmail(e: string) { return e.length > 28 ? e.slice(0, 25) + '…' : e }
function initials(s: string) {
  if (!s) return '?'
  if (s.includes('@')) return s.split('@')[0].slice(0, 2).toUpperCase()
  const p = s.split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p.at(-1)![0] : '')).toUpperCase()
}
function hue(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h }
function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'Vừa xong'; if (s < 3600) return `${Math.floor(s / 60)}ph`; if (s < 86400) return `${Math.floor(s / 3600)}h`
  return new Date(iso).toLocaleDateString('vi-VN')
}
function statusLabel(s: string) { const m: Record<string,string> = { draft:'Nháp', sending:'Đang gửi…', sent:'Đã gửi', partial:'1 phần', failed:'Lỗi' }; return m[s] ?? s }
function statusColor(s: string) { const m: Record<string,string> = { draft:Z.gray, sending:Z.amber, sent:Z.green, partial:Z.amber, failed:Z.red }; return m[s] ?? Z.gray }

// ── Rail ──
const RAIL = [
  { key: 'all', label: 'Tất cả', icon: '📬' },
  { key: 'sent', label: 'Đã gửi', icon: '📤' },
  { key: 'draft', label: 'Nháp', icon: '📝' },
  { key: 'lists', label: 'Danh sách', icon: '👥' },
]

export default function ChatMailPage() {
  const [tab, setTab] = useState<string>('compose')
  const [chan, setChan] = useState('all')
  const [threads, setThreads] = useState<ChatMailThread[]>([])
  const [lists, setLists] = useState<MailList[]>([])
  const [msgs, setMsgs] = useState<ChatMailMessage[]>([])
  const [thread, setThread] = useState<ChatMailThread | null>(null)
  const [q, setQ] = useState('')

  // Compose
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [recipients, setRecipients] = useState('')
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [draftThreadId, setDraftThreadId] = useState<string | null>(null)

  // UI state
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [showListForm, setShowListForm] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListEmails, setNewListEmails] = useState('')
  const [error, setError] = useState('')

  const endRef = useRef<HTMLDivElement>(null)

  // ── Load data ──
  const loadThreads = useCallback(async () => {
    try {
      const { data } = await supabase.from('chat_mails').select('*').order('last_at', { ascending: false }).limit(100)
      setThreads((data || []) as ChatMailThread[])
    } catch { /* table may not exist yet */ }
  }, [])

  const loadLists = useCallback(async () => {
    try {
      const { data } = await supabase.from('chat_mail_lists').select('*').order('name')
      setLists((data || []) as MailList[])
    } catch { /* table may not exist yet */ }
  }, [])

  useEffect(() => { loadThreads(); loadLists(); const id = setInterval(() => { loadThreads(); loadLists() }, 5000); return () => clearInterval(id) }, [loadThreads, loadLists])

  useEffect(() => {
    if (tab === 'compose') { setThread(null); setMsgs([]); return }
    const load = async () => {
      try {
        const { data: t } = await supabase.from('chat_mails').select('*').eq('id', tab).single()
        setThread((t as ChatMailThread) ?? null)
        const { data: m } = await supabase.from('chat_mail_messages').select('*').eq('thread_id', tab).order('created_at', { ascending: true })
        setMsgs((m || []) as ChatMailMessage[])
      } catch { /* */ }
    }
    load()
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [tab])

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs.length])

  // ── Filter ──
  const filtered = threads.filter(t => {
    if (chan === 'sent') return t.status === 'sent' || t.status === 'partial'
    if (chan === 'draft') return t.status === 'draft'
    return true
  }).filter(t => {
    if (!q.trim()) return true
    const s = `${t.subject} ${t.recipients?.join(' ') ?? ''} ${statusLabel(t.status)}`.toLowerCase()
    return s.includes(q.trim().toLowerCase())
  })

  // ── Send mail ──
  const handleSend = async () => {
    if (!subject.trim() || !content.trim()) { setError('Thiếu tiêu đề hoặc nội dung'); return }
    let recips: string[] = []

    // Get from list
    if (selectedListId) {
      const list = lists.find(l => l.id === selectedListId)
      if (list) recips = [...list.emails]
    }
    // Get from manual input
    if (recipients.trim()) {
      recips = [...recips, ...recipients.split(/[,;\n]+/).map(e => e.trim()).filter(Boolean)]
    }
    recips = [...new Set(recips)]
    if (recips.length === 0) { setError('Chưa có người nhận'); return }

    setSending(true); setError(''); setSendResult('Đang gửi…')

    try {
      // 1. Create thread in DB
      const { data: threadData, error: te } = await supabase.from('chat_mails').insert({
        subject, recipients: recips, list_id: selectedListId, status: 'sending',
      }).select().single()
      if (te) throw new Error(`DB: ${te.message}`)
      const threadId = (threadData as any).id

      // 2. Call edge function
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ subject, content, recipients: recips, thread_id: threadId }),
      })
      if (!res.ok) throw new Error(`Edge: HTTP ${res.status}`)
      const { results } = await res.json()
      if (!results) throw new Error('Edge: no results')

      // 3. Save messages
      let okCount = 0; let failCount = 0
      for (const r of results) {
        await supabase.from('chat_mail_messages').insert({
          thread_id: threadId, to_email: r.email, subject, content,
          status: r.ok ? 'sent' : 'failed', error: r.error || null,
        })
        if (r.ok) okCount++; else failCount++
      }

      // 4. Update thread status
      const finalStatus = failCount === 0 ? 'sent' : okCount === 0 ? 'failed' : 'partial'
      await supabase.from('chat_mails').update({ status: finalStatus, last_at: new Date().toISOString() }).eq('id', threadId)

      setSendResult(`✅ Gửi ${okCount}/${recips.length} mail${failCount > 0 ? ` (${failCount} lỗi)` : ''}`)
      setSubject(''); setContent(''); setRecipients(''); setSelectedListId(null); setDraftThreadId(null)
      await loadThreads()
    } catch (err: any) {
      setError(err.message || 'Lỗi gửi mail'); setSendResult(null)
    } finally {
      setSending(false)
      setTimeout(() => { setSendResult(null); setError('') }, 8000)
    }
  }

  // ── Save draft ──
  const handleSaveDraft = async () => {
    const recips = recipients ? recipients.split(/[,;\n]+/).map(e => e.trim()).filter(Boolean) : []
    try {
      if (draftThreadId) {
        await supabase.from('chat_mails').update({
          subject: subject || '(không tiêu đề)', recipients: recips, list_id: selectedListId, last_at: new Date().toISOString(),
        }).eq('id', draftThreadId)
      } else {
        const { data, error: err } = await supabase.from('chat_mails').insert({
          subject: subject || '(không tiêu đề)', recipients: recips, list_id: selectedListId, status: 'draft',
        }).select().single()
        if (!err && data) setDraftThreadId((data as any).id)
      }
      setSendResult('💾 Đã lưu nháp')
      await loadThreads()
    } catch { setSendResult('❌ Không lưu được nháp') }
    setTimeout(() => setSendResult(null), 3000)
  }

  const openDraft = (t: ChatMailThread) => {
    setSubject(t.subject === '(không tiêu đề)' ? '' : t.subject)
    setContent(''); setRecipients((t.recipients || []).join(', '))
    setSelectedListId(t.list_id); setDraftThreadId(t.id); setTab('compose')
  }

  // ── Create list ──
  const handleCreateList = async () => {
    if (!newListName.trim()) return
    const emails = newListEmails.split(/[,;\n]+/).map(e => e.trim()).filter(Boolean)
    try {
      await supabase.from('chat_mail_lists').insert({ name: newListName.trim(), emails })
      setNewListName(''); setNewListEmails('')
      await loadLists()
      setSendResult('✅ Đã tạo danh sách')
    } catch { setSendResult('❌ Không tạo được') }
    setTimeout(() => setSendResult(null), 3000)
  }

  const handleDeleteList = async (id: string) => {
    await supabase.from('chat_mail_lists').delete().eq('id', id)
    await loadLists()
  }

  const handleDeleteThread = async (id: string) => {
    await supabase.from('chat_mail_messages').delete().eq('thread_id', id)
    await supabase.from('chat_mails').delete().eq('id', id)
    setTab('compose'); await loadThreads()
  }

  // ── Navigate back to admin ──
  const goAdmin = () => { window.location.href = '/admin' }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', background: Z.bg, color: Z.fg }}>

      {/* ── RAIL XANH TRÁI ── */}
      <aside style={{ flex: '0 0 64px', background: Z.accent, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '16px 0 14px' }}>
        <div style={{ width:44,height:44,borderRadius:'50%',background:'#fff',color:Z.accent,display:'grid',placeItems:'center',fontWeight:800,fontSize:19}}>M</div>
        {RAIL.map(r => (
          <button key={r.key} onClick={() => setChan(r.key)}
            style={{ position:'relative',width:52,minHeight:44,borderRadius:10,background:chan===r.key?'rgba(255,255,255,.22)':'transparent',color:'#fff',padding:'4px 0',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1,border:0,cursor:'pointer',fontSize:20 }}>
            <span style={{ fontSize:18,lineHeight:1 }}>{r.icon}</span>
            <span style={{ fontSize:9,fontWeight:600,opacity:.9 }}>{r.label}</span>
          </button>
        ))}
        <div style={{ flex:'1 1 auto' }} />
        <button onClick={() => { setTab('compose'); setSubject(''); setContent(''); setRecipients(''); setSelectedListId(null); setDraftThreadId(null) }}
          style={{ width:52,height:44,borderRadius:10,background:'transparent',color:'#fff',padding:'4px 0',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1,border:0,cursor:'pointer',fontSize:20 }}>
          <span style={{ fontSize:18 }}>✏️</span><span style={{ fontSize:9,fontWeight:600 }}>Soạn</span>
        </button>
        <button onClick={goAdmin}
          style={{ width:44,height:44,borderRadius:10,background:'transparent',color:'#fff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',border:0,cursor:'pointer',opacity:.75,fontSize:18 }}>
          <span>🏠</span><span style={{ fontSize:9,fontWeight:600 }}>Admin</span>
        </button>
      </aside>

      {/* ── CỘT DANH SÁCH ── */}
      <section style={{ flex:'0 0 330px',width:330,minWidth:330,maxWidth:330,display:'flex',flexDirection:'column',overflow:'hidden',background:Z.card,borderRight:`1px solid ${Z.border}` }}>
        <div style={{ padding:'12px 14px 8px' }}>
          <input placeholder="Tìm mail hoặc người nhận…" value={q} onChange={e => setQ(e.target.value)}
            style={{ width:'100%',border:0,borderRadius:8,padding:'8px 12px',fontSize:13,background:Z.threadBg,color:Z.fg,outline:'none',boxSizing:'border-box' }} />
        </div>

        {/* ── Lists tab ── */}
        {chan === 'lists' && (
          <div style={{ padding:'0 14px 8px', flex:1, overflow:'auto' }}>
            <button onClick={() => setShowListForm(!showListForm)}
              style={{ background:'transparent',color:Z.accent,border:`1px solid ${Z.accent}`,padding:'6px 14px',fontSize:12,borderRadius:8,cursor:'pointer',marginBottom:showListForm?8:0 }}>
              {showListForm ? 'Ẩn' : '+ Tạo danh sách mới'}
            </button>
            {showListForm && (
              <div style={{ background:Z.card,border:`1px solid ${Z.border}`,borderRadius:10,padding:10,marginBottom:8,display:'flex',flexDirection:'column',gap:6 }}>
                <input placeholder="Tên danh sách…" value={newListName} onChange={e => setNewListName(e.target.value)}
                  style={{ border:`1px solid ${Z.border}`,borderRadius:6,padding:'6px 10px',fontSize:13,background:Z.bg,color:Z.fg }} />
                <textarea placeholder="Email (mỗi dòng 1 địa chỉ)…" value={newListEmails} onChange={e => setNewListEmails(e.target.value)} rows={3}
                  style={{ border:`1px solid ${Z.border}`,borderRadius:6,padding:'6px 10px',fontSize:13,background:Z.bg,color:Z.fg,resize:'vertical' }} />
                <button onClick={handleCreateList} style={{ fontSize:12,padding:'6px 14px',borderRadius:8,border:'none',background:Z.accent,color:'#fff',cursor:'pointer' }}>Tạo danh sách</button>
              </div>
            )}
            {lists.map(l => (
              <div key={l.id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${Z.border}`,fontSize:13 }}>
                <span><strong>{l.name}</strong> <span style={{ color:Z.muted,fontSize:11 }}>({(l.emails||[]).length} người)</span></span>
                <button onClick={() => handleDeleteList(l.id)} style={{ background:'transparent',color:Z.red,border:0,padding:'2px 8px',fontSize:12,cursor:'pointer' }}>Xoá</button>
              </div>
            ))}
            {lists.length === 0 && <div style={{ padding:18,color:Z.muted,fontSize:13,fontStyle:'italic' }}>Chưa có danh sách nào.</div>}
          </div>
        )}

        {/* ── Mail threads ── */}
        {chan !== 'lists' && (
          <div style={{ flex:'1 1 auto',overflow:'auto' }}>
            <div onClick={() => { setTab('compose'); if(!draftThreadId) { setSubject(''); setContent(''); setRecipients(''); setSelectedListId(null) } }}
              style={{ display:'flex',alignItems:'center',gap:11,padding:'11px 14px',cursor:'pointer',background:tab==='compose'?Z.bubble:'transparent',minWidth:0 }}>
              <div style={{ flex:'0 0 46px',width:46,height:46,borderRadius:'50%',background:Z.accent,opacity:.85,display:'grid',placeItems:'center',color:'#fff',fontSize:18 }}>✏️</div>
              <div style={{ flex:'1 1 auto',minWidth:0 }}>
                <div style={{ fontSize:14,fontWeight:600 }}>{draftThreadId && subject ? subject : 'Soạn mail mới'}</div>
                <div style={{ fontSize:12,color:Z.muted,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{draftThreadId ? 'Tiếp tục soạn…' : 'Gửi mail cá nhân hoặc hàng loạt'}</div>
              </div>
            </div>
            {filtered.map(t => (
              <div key={t.id} onClick={() => t.status === 'draft' ? openDraft(t) : setTab(t.id)}
                style={{ display:'flex',alignItems:'center',gap:11,padding:'11px 14px',cursor:'pointer',background:tab===t.id?Z.bubble:'transparent',minWidth:0 }}>
                <div style={{ flex:'0 0 46px',width:46,height:46,borderRadius:'50%',background:`hsl(${hue(t.recipients?.[0]??'')} 55% 45%)`,display:'grid',placeItems:'center',color:'#fff',fontWeight:700,fontSize:15 }}>
                  {t.recipients?.[0] ? initials(t.recipients[0]) : '?'}
                </div>
                <div style={{ flex:'1 1 auto',minWidth:0 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8 }}>
                    <span style={{ fontSize:14,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{t.subject}</span>
                    <span style={{ fontSize:10,fontWeight:700,color:statusColor(t.status),whiteSpace:'nowrap' }}>{statusLabel(t.status)}</span>
                  </div>
                  <div style={{ fontSize:12,color:Z.muted,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                    {(t.recipients||[]).length > 1 ? `${t.recipients.length} người` : shortEmail(t.recipients?.[0]??'')} · {ago(t.last_at)}
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ padding:18,color:Z.muted,fontSize:13,fontStyle:'italic' }}>{q ? 'Không tìm thấy.' : 'Chưa có mail nào.'}</div>}
          </div>
        )}
      </section>

      {/* ── KHUNG CHÍNH PHẢI ── */}
      <section style={{ flex:'1 1 auto',display:'flex',flexDirection:'column',minWidth:0 }}>
        {tab === 'compose' ? (
          <>
            <header style={{ flex:'0 0 auto',display:'flex',alignItems:'center',gap:11,padding:'10px 18px',background:Z.card,borderBottom:`1px solid ${Z.border}` }}>
              <div style={{ flex:'0 0 44px',width:44,height:44,borderRadius:'50%',background:Z.accent,display:'grid',placeItems:'center',color:'#fff',fontSize:18 }}>{draftThreadId ? '📝' : '✏️'}</div>
              <div>
                <div style={{ fontSize:15,fontWeight:700 }}>{draftThreadId ? 'Tiếp tục soạn mail' : 'Soạn mail mới'}</div>
                <div style={{ fontSize:12,color:Z.muted }}>Gửi tới một người hoặc danh sách — giao diện chat</div>
              </div>
            </header>

            <div style={{ flex:'1 1 auto',overflow:'auto',padding:'16px 22px',background:Z.threadBg,display:'flex',flexDirection:'column',gap:14 }}>
              {/* Người nhận */}
              <div>
                <div style={{ fontSize:12,color:Z.muted,marginBottom:4,fontWeight:600 }}>📧 Người nhận</div>
                <div style={{ display:'flex',gap:8 }}>
                  <input placeholder="email1@example.com, email2@example.com…" value={recipients} onChange={e => setRecipients(e.target.value)}
                    style={{ flex:1,border:`1px solid ${Z.border}`,borderRadius:10,padding:'10px 14px',fontSize:14,background:Z.card,color:Z.fg }} />
                  <select value={selectedListId ?? ''} onChange={e => setSelectedListId(e.target.value || null)}
                    style={{ border:`1px solid ${Z.border}`,borderRadius:10,padding:'10px 8px',fontSize:13,background:Z.card,color:Z.fg,maxWidth:160 }}>
                    <option value="">+ Danh sách</option>
                    {lists.map(l => <option key={l.id} value={l.id}>{l.name} ({(l.emails||[]).length})</option>)}
                  </select>
                </div>
                {selectedListId && <div style={{ fontSize:11,color:Z.accent,marginTop:4 }}>✓ Gửi tới: {lists.find(l=>l.id===selectedListId)?.name}</div>}
              </div>

              {/* Tiêu đề */}
              <div>
                <div style={{ fontSize:12,color:Z.muted,marginBottom:4,fontWeight:600 }}>📌 Tiêu đề</div>
                <input placeholder="Tiêu đề mail…" value={subject} onChange={e => setSubject(e.target.value)}
                  style={{ width:'100%',border:`1px solid ${Z.border}`,borderRadius:10,padding:'10px 14px',fontSize:14,background:Z.card,color:Z.fg,boxSizing:'border-box' }} />
              </div>

              {/* Preview chat bubble */}
              {content && (
                <div style={{ alignSelf:'flex-end',maxWidth:'80%',marginBottom:10 }}>
                  <div style={{ fontSize:11,color:Z.muted,marginBottom:3,textAlign:'right' }}>Bạn</div>
                  <div style={{ background:Z.bubble,color:Z.bubbleFg,padding:'12px 15px',borderRadius:'14px 14px 4px 14px',whiteSpace:'pre-wrap',lineHeight:1.55,fontSize:14 }}>
                    {subject && <div style={{ fontWeight:700,marginBottom:6 }}>{subject}</div>}
                    {content}
                  </div>
                  {recipients && <div style={{ fontSize:10,color:Z.muted,marginTop:2,textAlign:'right' }}>→ {recipients.includes(',') ? 'nhiều người' : recipients}</div>}
                </div>
              )}
            </div>

            {/* Composer */}
            <div style={{ flex:'0 0 auto',borderTop:`1px solid ${Z.border}`,padding:'10px 16px 14px',background:Z.card }}>
              <div style={{ display:'flex',gap:8,alignItems:'flex-end' }}>
                <textarea placeholder="Nội dung mail (hỗ trợ xuống dòng)…" value={content} onChange={e => setContent(e.target.value)} rows={3}
                  onKeyDown={e => { if (e.key==='Enter' && e.metaKey) { e.preventDefault(); handleSend() } }}
                  style={{ flex:1,minHeight:80,border:`1px solid ${Z.border}`,borderRadius:10,padding:'12px 14px',fontSize:14,background:Z.card,color:Z.fg,resize:'vertical',fontFamily:'inherit' }} />
                <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                  <button onClick={handleSend} disabled={sending || !subject.trim() || !content.trim()}
                    style={{ padding:'10px 20px',borderRadius:10,border:'none',background:Z.accent,color:'#fff',cursor:(sending||!subject.trim()||!content.trim())?'not-allowed':'pointer',opacity:(sending||!subject.trim()||!content.trim())?.5:1,whiteSpace:'nowrap',fontSize:14 }}>
                    {sending ? 'Đang gửi…' : '📨 Gửi'}
                  </button>
                  <button onClick={handleSaveDraft}
                    style={{ padding:'10px 20px',borderRadius:10,border:`1px solid ${Z.accent}`,background:'transparent',color:Z.accent,cursor:'pointer',whiteSpace:'nowrap',fontSize:14 }}>
                    💾 Nháp
                  </button>
                </div>
              </div>

              {(sendResult || error) && (
                <div style={{ marginTop:8,padding:'6px 12px',borderRadius:8,fontSize:12,
                  background:error?'rgba(230,77,67,.12)':sendResult?.startsWith('✅')?'rgba(22,163,74,.12)':'rgba(0,104,255,.10)',
                  color:error?Z.red:sendResult?.startsWith('✅')?Z.green:Z.accent }}>
                  {error || sendResult}
                </div>
              )}
              <div style={{ marginTop:6,fontSize:11,color:Z.muted }}>⌘+Enter để gửi · Gửi tới từng người hoặc chọn danh sách để gửi hàng loạt</div>
            </div>
          </>
        ) : (
          <>
            {/* Thread view */}
            <header style={{ flex:'0 0 auto',display:'flex',alignItems:'center',gap:11,padding:'10px 18px',background:Z.card,borderBottom:`1px solid ${Z.border}` }}>
              <div style={{ flex:'0 0 44px',width:44,height:44,borderRadius:'50%',background:thread?.recipients?.[0]?`hsl(${hue(thread.recipients[0])} 55% 45%)`:Z.muted,display:'grid',placeItems:'center',color:'#fff',fontWeight:700,fontSize:15 }}>
                {thread?.recipients?.[0] ? initials(thread.recipients[0]) : '?'}
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:15,fontWeight:700,display:'flex',alignItems:'center',gap:8 }}>
                  {thread?.subject ?? 'Mail'}
                  <span style={{ fontSize:10,fontWeight:700,color:statusColor(thread?.status??''),padding:'1px 8px',borderRadius:999,background:`${statusColor(thread?.status??'')}18` }}>{statusLabel(thread?.status??'')}</span>
                </div>
                <div style={{ fontSize:12,color:Z.muted,display:'flex',gap:14 }}>
                  <span>👥 {(thread?.recipients||[]).length===1?shortEmail(thread?.recipients[0]??''):`${thread?.recipients?.length??0} người`}</span>
                  <span>🕐 {thread?.last_at?ago(thread.last_at):''}</span>
                </div>
              </div>
              <button onClick={() => handleDeleteThread(tab)} style={{ marginLeft:'auto',background:'transparent',color:Z.red,border:`1px solid ${Z.red}`,padding:'4px 10px',fontSize:11,borderRadius:6,cursor:'pointer' }}>🗑 Xoá</button>
            </header>

            <div style={{ flex:'1 1 auto',overflow:'auto',padding:'16px 22px',background:Z.threadBg,display:'flex',flexDirection:'column',gap:12 }}>
              {msgs.map(m => {
                const isReply = m.direction === 'inbound'
                return (
                <div key={m.id} style={{ alignSelf: isReply ? 'flex-start' : 'flex-end', maxWidth:'80%' }}>
                  <div style={{ fontSize:11,color:Z.muted,marginBottom:3,textAlign: isReply ? 'left' : 'right' }}>
                    {isReply ? `← ${shortEmail(m.to_email)}` : `→ ${shortEmail(m.to_email)}`} {m.status==='failed'?<span style={{ color:Z.red }}>❌</span>:<span style={{ color:Z.green }}>✓</span>}
                  </div>
                  <div style={{
                    background: isReply ? Z.card : Z.bubble,
                    color: isReply ? Z.fg : Z.bubbleFg,
                    padding:'12px 15px',
                    borderRadius: isReply ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
                    whiteSpace:'pre-wrap',lineHeight:1.55,fontSize:14,
                    border: isReply ? `1px solid ${Z.border}` : 'none',
                  }}>
                    <div style={{ fontWeight:700,marginBottom:4 }}>{m.subject}</div>
                    {m.content}
                  </div>
                </div>
                )})}
              <div ref={endRef} />
            </div>
          </>
        )}
      </section>
    </div>
  )
}
