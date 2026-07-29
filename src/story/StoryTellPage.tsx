// ── /story/tell — MVP 03: Story Workspace ──
// Document-first design. Mira = interviewer. Story = the product.
// Sections: Header → Conversation → Story Raw → Composer → (future sections)
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../supabase'
import type { User } from '@supabase/supabase-js'

type Phase = 'telling' | 'asking' | 'ready_for_draft' | 'draft_loading' | 'draft' | 'editing' | 'submitting' | 'submitted'
type ChatMsg = { role: 'user' | 'mira'; text: string; at: string }

// ── Helpers ──
function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} giờ trước`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Hôm qua'
  if (days < 7) return `${days} ngày trước`
  return new Date(ts).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })
}

async function getErrMsg(e: unknown): Promise<string> {
  if (e && typeof e === 'object' && 'context' in e) {
    try {
      const ctx = (e as { context: { json?: () => Promise<unknown> } }).context
      if (ctx?.json) {
        const body = await ctx.json()
        if (body && typeof body === 'object' && 'error' in body)
          return String((body as { error: string }).error)
      }
    } catch { /* fall through */ }
  }
  return (e as { message?: string })?.message || String(e)
}

const INVITATIONS = [
  'Có một câu chuyện nào bạn nghĩ đáng để người khác đọc không?',
  'Có một câu chuyện nào bạn muốn lưu giữ và chia sẻ với cộng đồng không?',
  'Có câu chuyện nào bạn nghĩ sẽ mang lại điều gì đó cho một người khác không?',
  'Có một câu chuyện thật mà bạn nghĩ đáng được lưu giữ không?',
]

// ── AuthGate ──
function AuthGate({ onSubmit, busy, err }: {
  onSubmit: (mode: 'login' | 'signup', email: string, pass: string, name: string) => void
  busy: boolean; err: string
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const submit = () => onSubmit(mode, email, pass, name)

  return (
    <div className="ag-gate">
      <div className="ag-card">
        <div className="ag-avatar">M</div>
        <p className="ag-say">
          "Trước khi kể, mình cần một chỗ để <b>giữ câu chuyện của bạn không bị mất</b> —
          kể dở hôm nay, mai kể tiếp, và để mình báo tin khi chuyện được đăng.
          {mode === 'signup' ? ' Tạo tài khoản miễn phí chỉ mất 30 giây nhé 🌿' : ' Bạn đăng nhập giúp mình nhé 🌿'}"
        </p>
        {mode === 'signup' && (
          <input placeholder="Tên của bạn" value={name} onChange={e => setName(e.target.value)} />
        )}
        <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder="Mật khẩu" type="password" value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }} />
        {err && <div className="ag-err">{err}</div>}
        <button className="ag-btn" onClick={submit} disabled={busy}>
          {busy ? 'Chờ mình chút…' : mode === 'signup' ? 'Tạo tài khoản & bắt đầu kể' : 'Đăng nhập & bắt đầu kể'}
        </button>
        <div className="ag-switch">
          {mode === 'login'
            ? <>Lần đầu đến đây? <a onClick={() => setMode('signup')}>Tạo tài khoản miễn phí</a></>
            : <>Đã có tài khoản học viên? <a onClick={() => setMode('login')}>Đăng nhập</a></>}
        </div>
      </div>
    </div>
  )
}

// ── DraftView ──
function DraftView({ title, topic, content, onAccept, onEdit, onTellMore, busy }: {
  title: string; topic: string; content: string
  onAccept: () => void; onEdit: () => void; onTellMore: () => void
  busy: boolean
}) {
  const TOPIC_LABELS: Record<string, string> = {
    'cay-dan-dau-tien': 'Cây đàn đầu tiên',
    'bai-hat-thay-doi-toi': 'Bài hát thay đổi tôi',
    'guitar-va-tuoi-tho': 'Guitar và tuổi thơ',
    'vuot-qua-kho-khan': 'Vượt qua giai đoạn khó khăn',
    'guitar-trong-gia-dinh': 'Guitar trong gia đình',
    'nguoi-thay-dau-tien': 'Người thầy đầu tiên',
    'dau-tay-va-chai-san': 'Đau tay và chai sạn',
    'lan-dau-dan-truoc-moi-nguoi': 'Lần đầu đàn trước mọi người',
    'bo-do-roi-quay-lai': 'Bỏ dở rồi quay lại',
    'cay-dan-va-nguoi-than': 'Cây đàn và người thân',
  }

  return (
    <div className="dv-wrap">
      <div className="dv-header">📄 Bản thảo câu chuyện</div>
      <div className="dv-body">
        {topic && TOPIC_LABELS[topic] && (
          <span className="dv-topic">{TOPIC_LABELS[topic]}</span>
        )}
        <h2 className="dv-title">{title}</h2>
        <div className="dv-content">{content.split('\n').map((p, i) => (
          <p key={i}>{p}</p>
        ))}</div>
      </div>
      <div className="dv-actions">
        <button className="dv-btn dv-btn-primary" onClick={onAccept} disabled={busy}>
          ✓ Đúng rồi
        </button>
        <button className="dv-btn" onClick={onEdit} disabled={busy}>
          ✏️ Biên tập lại
        </button>
        <button className="dv-btn" onClick={onTellMore} disabled={busy}>
          ➕ Tôi muốn kể thêm
        </button>
      </div>
    </div>
  )
}

// ── AutoGrow Textarea ──
function AutoTextarea({ value, onChange, onKeyDown, disabled, placeholder }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent) => void; disabled: boolean; placeholder: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [value])

  return (
    <textarea
      ref={ref}
      className="sw-textarea"
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      disabled={disabled}
      rows={1}
      placeholder={placeholder}
    />
  )
}

// ══════════════════════════════════════════════════════════════
// STORY WORKSPACE
// ══════════════════════════════════════════════════════════════
export default function StoryTellPage() {
  // ── Auth ──
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authErr, setAuthErr] = useState('')

  // ── Story ──
  const [storyId, setStoryId] = useState<string | null>(null)
  const [storyTitle, setStoryTitle] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [phase, setPhase] = useState<Phase>('telling')
  const [miraReady, setMiraReady] = useState(false)
  const [draftResumed, setDraftResumed] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [showRaw, setShowRaw] = useState(false)  // collapsible Story Raw

  // ── MVP 04: Sidebar + Story Library ──
  const [showSidebar, setShowSidebar] = useState(false)
  const [storyList, setStoryList] = useState<{ id: string; title: string; status: string; updated_at: string; conversation: ChatMsg[] }[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [storyMenuId, setStoryMenuId] = useState<string | null>(null)
  const [sidebarRenameId, setSidebarRenameId] = useState<string | null>(null)
  const [sidebarRenameInput, setSidebarRenameInput] = useState('')

  // ── Conversation + Story Raw ──
  const [conversation, setConversation] = useState<ChatMsg[]>([])
  const [rawContent, setRawContent] = useState('')

  // ── Draft ──
  const [draftTitle, setDraftTitle] = useState('')
  const [draftTopic, setDraftTopic] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // ── Refs ──
  const titleInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const convoEndRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const invitation = useMemo(() => INVITATIONS[Math.floor(Math.random() * INVITATIONS.length)], [])

  // ── Auth listener ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null); setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null); setAuthChecked(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Close menu on outside click ──
  useEffect(() => {
    if (!showMenu) return
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showMenu])

  // ── Auto-scroll conversation về cuối ──
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
  }, [conversation])

  // ── Focus title input when editing ──
  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitle])

  // ── Resume draft ──
  const draftLoadedRef = useRef(false)

  // ── MVP 04: Load story vào workspace ──
  const loadStory = useCallback(async (sid: string) => {
    const { data: s } = await supabase.from('stories')
      .select('id,status,title,conversation,content,topic')
      .eq('id', sid).maybeSingle()
    if (!s) return
    draftLoadedRef.current = true
    setStoryId(s.id)
    setStoryTitle(s.title || '')
    setDraftResumed(true)
    setShowSidebar(false)
    setShowRaw(false)

    if (s.status === 'user_review' && s.title && s.content) {
      setDraftTitle(s.title)
      setDraftTopic(s.topic || '')
      setDraftContent(s.content)
      setPhase('draft')
      return
    }

    const conv = Array.isArray(s.conversation) ? s.conversation : []
    setConversation(conv.filter((m: ChatMsg) => m.role !== 'mira' || !m.text.includes('(silent')))
    setPhase('telling')
    setMiraReady(false)
    setInput('')

    supabase.from('story_chunks')
      .select('content, order_index')
      .eq('story_id', s.id)
      .order('order_index', { ascending: true })
      .then(({ data: chunks }) => {
        if (chunks) {
          const unique = chunks.filter((c, i, arr) => i === 0 || c.content !== arr[i - 1].content)
          setRawContent(unique.map(c => c.content).join('\n\n'))
        }
      })
  }, [])

  // ── MVP 04: Fetch story list ──
  const fetchStoryList = useCallback(async () => {
    if (!user) return
    setLoadingList(true)
    const { data } = await supabase.from('stories')
      .select('id,title,status,updated_at,conversation')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    if (data) setStoryList(data as any)
    setLoadingList(false)
  }, [user])
  useEffect(() => {
    if (!user || draftLoadedRef.current) return
    supabase.from('stories')
      .select('id,status,title,conversation,content,topic')
      .eq('user_id', user.id)
      .in('status', ['telling', 'user_review'])
      .order('updated_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        const s = data?.[0]
        if (!s) return
        if (s.status === 'user_review' && s.title && s.content) {
          setStoryId(s.id)
          setStoryTitle(s.title)
          setDraftTitle(s.title)
          setDraftTopic(s.topic || '')
          setDraftContent(s.content)
          setPhase('draft')
          setDraftResumed(true)
        } else if (Array.isArray(s.conversation) && s.conversation.length > 0) {
          draftLoadedRef.current = true
          setStoryId(s.id)
          setStoryTitle(s.title || '')
          setConversation(s.conversation)
          setPhase('telling')
          setDraftResumed(true)
          // Load Story Raw
          supabase.from('story_chunks')
            .select('content, order_index')
            .eq('story_id', s.id)
            .order('order_index', { ascending: true })
            .then(({ data: chunks }) => {
              if (chunks) {
                const unique = chunks.filter((c, i, arr) =>
                  i === 0 || c.content !== arr[i - 1].content
                )
                setRawContent(unique.map(c => c.content).join('\n\n'))
              }
            })
        }
      })
    fetchStoryList()
  }, [user, fetchStoryList])

  // ── Send message ──
  const send = useCallback(async () => {
    const t = input.trim()
    if (!t || sending) return
    setInput('')
    setSending(true)

    const userMsg: ChatMsg = { role: 'user', text: t, at: new Date().toISOString() }
    setConversation(prev => [...prev, userMsg])

    try {
      const { data, error } = await supabase.functions.invoke('story-ai', {
        body: { action: 'chat', storyId, message: t },
      })
      if (error || !data) throw error ?? new Error('empty')
      const newStoryId = data.storyId
      if (newStoryId) setStoryId(newStoryId)

      const p = data.phase as string
      const miraText = data.reply || ''
      const miraMsg: ChatMsg = { role: 'mira', text: miraText, at: new Date().toISOString() }
      setConversation(prev => [...prev, miraMsg])

      // Fetch raw từ DB (tránh duplicate)
      const sid = newStoryId || storyId
      if (sid) {
        supabase.from('story_chunks')
          .select('content, order_index')
          .eq('story_id', sid)
          .order('order_index', { ascending: true })
          .then(({ data: chunks }) => {
            if (chunks) {
              const unique = chunks.filter((c, i, arr) =>
                i === 0 || c.content !== arr[i - 1].content
              )
              setRawContent(unique.map(c => c.content).join('\n\n'))
            }
          })
      }

      if (p === 'ready_for_draft') {
        setMiraReady(true)
        setPhase('ready_for_draft')
      } else {
        setPhase('asking')
      }
    } catch (e) {
      console.error('story-ai chat', e)
      const errMsg: ChatMsg = { role: 'mira', text: 'Có lỗi xảy ra. Bạn thử lại nhé.', at: new Date().toISOString() }
      setConversation(prev => [...prev, errMsg])
    } finally { setSending(false) }
  }, [input, sending, storyId])

  // ── MVP 04: Hoàn thành lời kể ──
  const completeStory = useCallback(async () => {
    if (!storyId || sending || !rawContent) return
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('story-ai', {
        body: { action: 'complete', storyId, rawContent },
      })
      if (error || !data) throw error ?? new Error('empty')
      if (data.ready) {
        setMiraReady(true)
        setPhase('ready_for_draft')
        const miraMsg: ChatMsg = { role: 'mira', text: data.reply || 'Câu chuyện đã sẵn sàng để tạo bản thảo.', at: new Date().toISOString() }
        setConversation(prev => [...prev, miraMsg])
      } else {
        const miraMsg: ChatMsg = { role: 'mira', text: data.reply || 'Bạn có thể kể thêm một chút nữa không?', at: new Date().toISOString() }
        setConversation(prev => [...prev, miraMsg])
        setPhase('asking')
      }
    } catch (e) {
      console.error('completeStory', e)
    } finally { setSending(false) }
  }, [storyId, sending, rawContent])
  const requestDraft = useCallback(async () => {
    if (!storyId || sending) return
    setErrorMsg('')
    setSending(true)
    setPhase('draft_loading')
    try {
      const { data, error } = await supabase.functions.invoke('story-ai', {
        body: { action: 'write', storyId },
      })
      if (error) {
        const ctx = (error as any)?.context
        let msg = (error as any)?.message || 'Lỗi Edge Function'
        if (ctx) {
          try { const j = await ctx.json(); if (j?.error) msg = j.error } catch {}
        }
        throw new Error(msg)
      }
      if (!data) throw new Error('Không có dữ liệu trả về')
      if (data.error) throw new Error(data.error)
      setDraftTitle(data.title || '')
      setDraftTopic(data.topic || '')
      setDraftContent(data.content || '')
      setPhase('draft')
    } catch (e) {
      console.error('story-ai write', e)
      setErrorMsg((e as Error).message || 'Lỗi khi tạo bản thảo')
      setPhase('ready_for_draft')
    } finally { setSending(false) }
  }, [storyId, sending])

  // ── Submit review ──
  const submitReview = useCallback(async () => {
    if (!storyId || sending) return
    setSending(true)
    setPhase('submitting')
    await supabase.from('stories').update({ status: 'submitted', title: storyTitle || draftTitle }).eq('id', storyId)
    try { await supabase.functions.invoke('story-ai', { body: { action: 'review', storyId } }) } catch { /* retry later */ }
    setPhase('submitted')
    setSending(false)
  }, [storyId, sending, storyTitle, draftTitle])

  // ── Edit draft ──
  const startEdit = useCallback(() => setPhase('editing'), [])
  const sendEdit = useCallback(async () => {
    const t = input.trim()
    if (!t || sending || !storyId) return
    setInput('')
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('story-ai', {
        body: { action: 'revise', storyId, instruction: t },
      })
      if (error || !data) throw error ?? new Error('empty')
      setDraftTitle(data.title || draftTitle)
      setDraftTopic(data.topic || draftTopic)
      setDraftContent(data.content || draftContent)
      setPhase('draft')
    } catch (e) {
      console.error('story-ai revise', e)
    } finally { setSending(false) }
  }, [input, sending, storyId, draftTitle, draftTopic, draftContent])

  // ── Tell more ──
  const tellMore = useCallback(() => {
    setMiraReady(false)
    setPhase('telling')
  }, [])

  // ── Start new ──
  const startNew = useCallback(() => {
    draftLoadedRef.current = false
    setStoryId(null); setStoryTitle(''); setConversation([]); setRawContent('')
    setMiraReady(false); setDraftResumed(false); setShowRaw(false)
    setPhase('telling'); setInput('')
  }, [])

  // ── Rename story ──
  const renameStory = useCallback(() => {
    setEditingTitle(true)
    setShowMenu(false)
  }, [])
  const saveTitle = useCallback(async () => {
    setEditingTitle(false)
    if (storyId && storyTitle.trim()) {
      await supabase.from('stories').update({ title: storyTitle.trim() }).eq('id', storyId)
    }
  }, [storyId, storyTitle])

  // ── Sidebar rename ──
  const startSidebarRename = (sid: string, currentTitle: string) => {
    setStoryMenuId(null)
    setSidebarRenameId(sid)
    setSidebarRenameInput(currentTitle || '')
  }
  const submitSidebarRename = async (sid: string) => {
    const t = sidebarRenameInput.trim()
    setSidebarRenameId(null)
    if (t) {
      await supabase.from('stories').update({ title: t }).eq('id', sid)
      if (sid === storyId) setStoryTitle(t)
      fetchStoryList()
    }
  }

  // ── Sidebar delete ──
  const deleteStoryById = async (sid: string) => {
    setStoryMenuId(null)
    if (!window.confirm('Bạn có chắc muốn xóa câu chuyện này? Hành động này không thể hoàn tác.')) return
    await supabase.from('stories').delete().eq('id', sid)
    if (sid === storyId) startNew()
    fetchStoryList()
  }

  // ── Delete story ──
  const deleteStory = useCallback(async () => {
    if (!storyId || !window.confirm('Bạn có chắc muốn xóa câu chuyện này? Hành động này không thể hoàn tác.')) return
    await supabase.from('stories').delete().eq('id', storyId)
    startNew()
  }, [storyId, startNew])

  // ── Auth ──
  const submitAuth = async (mode: 'login' | 'signup', email: string, pass: string, name: string) => {
    setAuthErr('')
    if (!email.trim() || !pass.trim() || (mode === 'signup' && !name.trim())) {
      setAuthErr('Bạn điền giúp mình đủ các ô nhé.'); return
    }
    setAuthBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.functions.invoke('signup-free', {
          body: { name: name.trim(), email: email.trim(), password: pass.trim() },
        })
        if (error || data?.error) throw new Error(data?.error || 'Không tạo được tài khoản')
      }
      const { error: liErr } = await supabase.auth.signInWithPassword({
        email: email.trim(), password: pass.trim(),
      })
      if (liErr) throw new Error(mode === 'login' ? 'Email hoặc mật khẩu chưa đúng.' : liErr.message)
    } catch (e) {
      setAuthErr(e instanceof Error ? e.message : 'Có lỗi, bạn thử lại nhé.')
    } finally { setAuthBusy(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (phase === 'editing') sendEdit()
      else send()
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); saveTitle() }
    if (e.key === 'Escape') setEditingTitle(false)
  }

  // ── Computed ──
  const userMsgCount = conversation.filter(m => m.role === 'user').length
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Người kể'
  const statusLabel = phase === 'editing' ? 'Đang biên tập' : phase === 'ready_for_draft' ? 'Sẵn sàng tạo bản thảo' : 'Đang kể'

  // ── Date grouping cho conversation ──
  const groupedConvo = useMemo(() => {
    const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)

    const formatDate = (d: Date) => {
      const d0 = new Date(d); d0.setHours(0, 0, 0, 0)
      if (d0.getTime() === today.getTime()) return 'Hôm nay'
      if (d0.getTime() === yesterday.getTime()) return 'Hôm qua'
      const diffDays = Math.floor((today.getTime() - d0.getTime()) / 86400000)
      if (diffDays < 7) return DAY_NAMES[d.getDay()]
      return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })
    }

    const groups: { date: string; msgs: ChatMsg[] }[] = []
    for (const msg of conversation) {
      const dateStr = formatDate(new Date(msg.at))
      const last = groups[groups.length - 1]
      if (last && last.date === dateStr) {
        last.msgs.push(msg)
      } else {
        groups.push({ date: dateStr, msgs: [msg] })
      }
    }
    return groups
  }, [conversation])

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="tva-tell">
      <style>{CSS}</style>

      {!authChecked ? (
        <div className="sw-center">Đang mở cửa…</div>
      ) : !user ? (
        <AuthGate onSubmit={submitAuth} busy={authBusy} err={authErr} />
      ) : phase === 'submitted' ? (
        <div className="sw-page">
          <div className="sw-submitted">
            <div className="sw-done-icon">🎉</div>
            <h2>Câu chuyện của bạn đã được gửi đến Ban biên tập</h2>
            <p>Cảm ơn bạn đã chia sẻ. Ban biên tập sẽ đọc và phản hồi sớm nhất.</p>
            <a className="sw-link" href="/story">← Về trang 1001 Câu chuyện</a>
          </div>
        </div>
      ) : phase === 'draft' ? (
        <div className="sw-page">
          <div className="sw-draft-wrap">
            <DraftView
              title={draftTitle} topic={draftTopic} content={draftContent}
              onAccept={submitReview} onEdit={startEdit} onTellMore={tellMore}
              busy={sending}
            />
          </div>
        </div>
      ) : phase === 'draft_loading' || phase === 'submitting' ? (
        <div className="sw-page">
          <div className="sw-loading">
            <div className="sw-spinner" />
            <p>{phase === 'draft_loading' ? 'Mira đang sắp xếp lại câu chuyện của bạn…' : 'Đang gửi câu chuyện…'}</p>
          </div>
        </div>
      ) : (
        /* ═══ STORY WORKSPACE ═══ */
        <>
          {/* ── SIDEBAR OVERLAY ── */}
          {showSidebar && (
            <div className="sw-overlay" onClick={() => setShowSidebar(false)} />
          )}

          {/* ── SIDEBAR DRAWER ── */}
          <div className={`sw-drawer ${showSidebar ? 'sw-drawer-open' : ''}`}>
            <div className="sw-drawer-header">
              <div className="sw-drawer-avatar">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="sw-drawer-name">{displayName}</div>
                <div className="sw-drawer-count">{storyList.length} câu chuyện</div>
              </div>
            </div>

            <button className="sw-drawer-new" onClick={() => { startNew(); fetchStoryList() }}>
              + Bắt đầu câu chuyện mới
            </button>

            <div className="sw-drawer-list">
              {loadingList ? (
                <div className="sw-drawer-loading">Đang tải…</div>
              ) : storyList.length === 0 ? (
                <div className="sw-drawer-empty">Chưa có câu chuyện nào</div>
              ) : (
                storyList.map(s => (
                  <div key={s.id} className={`sw-drawer-item-row ${s.id === storyId ? 'sw-drawer-item-row-active' : ''}`}>
                    {sidebarRenameId === s.id ? (
                      <div className="sw-drawer-item-rename">
                        <input
                          className="sw-drawer-rename-input"
                          value={sidebarRenameInput}
                          onChange={e => setSidebarRenameInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); submitSidebarRename(s.id) }
                            if (e.key === 'Escape') setSidebarRenameId(null)
                          }}
                          onBlur={() => submitSidebarRename(s.id)}
                          placeholder="Tên câu chuyện…"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <button
                        className={`sw-drawer-item ${s.id === storyId ? 'sw-drawer-item-active' : ''}`}
                        onClick={() => loadStory(s.id)}
                      >
                        <span className="sw-drawer-item-icon">📖</span>
                        <div className="sw-drawer-item-body">
                          <div className="sw-drawer-item-top">
                            <span className="sw-drawer-item-title">{s.title || '✍️ Đang kể câu chuyện'}</span>
                            <span className={`sw-drawer-badge sw-drawer-badge-${s.status === 'published' ? 'done' : s.status === 'submitted' || s.status === 'pending_publish' ? 'done' : 'telling'}`}>
                              {s.status === 'published' ? 'Đã xuất bản' : s.status === 'submitted' || s.status === 'pending_publish' ? 'Đã hoàn thành' : s.status === 'user_review' ? 'Đã hoàn thành' : 'Đang kể'}
                            </span>
                          </div>
                          <div className="sw-drawer-item-time">{timeAgo(s.updated_at)}</div>
                        </div>
                      </button>
                    )}
                    <div className="sw-drawer-item-actions">
                      <button
                        className="sw-drawer-item-menu-btn"
                        onClick={e => { e.stopPropagation(); setStoryMenuId(storyMenuId === s.id ? null : s.id) }}
                        aria-label="Tùy chọn"
                      >
                        ⋯
                      </button>
                      {storyMenuId === s.id && (
                        <>
                          <div className="sw-drawer-item-menu-overlay" onClick={() => setStoryMenuId(null)} />
                          <div className="sw-drawer-item-menu-drop">
                            <button onClick={() => startSidebarRename(s.id, s.title)}>✎ Đổi tên</button>
                            <button onClick={() => deleteStoryById(s.id)} className="sw-menu-danger">🗑 Xóa</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="sw-drawer-footer">
              <button className="sw-drawer-item" onClick={() => setShowSidebar(false)}>
                <span className="sw-drawer-item-title">⚙️ Cài đặt</span>
              </button>
            </div>
          </div>

          <div className="sw-workspace">
          {/* ── TOP BAR: back to magazine ── */}
          <div className="sw-topbar">
            <a href="/story" className="sw-back-link">← 1001 Câu chuyện</a>
            <div className="sw-menu-wrap" ref={menuRef}>
              <button className="sw-menu-btn" onClick={() => setShowMenu(!showMenu)}>···</button>
              {showMenu && (
                <div className="sw-menu-drop">
                  <button onClick={renameStory}>Đổi tên câu chuyện</button>
                  <button onClick={deleteStory} className="sw-menu-danger">Xóa câu chuyện</button>
                  <hr />
                  <button onClick={() => { setShowMenu(false) }}>Báo lỗi</button>
                </div>
              )}
            </div>
          </div>

          {/* ── HEADER ── */}
          <header className="sw-header">
            <button className="sw-sidebar-btn" onClick={() => { setShowSidebar(true); fetchStoryList() }} aria-label="Menu">
              ☰
            </button>

            <div className="sw-header-main">
              {editingTitle ? (
                <input
                  ref={titleInputRef}
                  className="sw-title-input"
                  value={storyTitle}
                  onChange={e => setStoryTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  onBlur={saveTitle}
                  placeholder="Nhập tiêu đề câu chuyện…"
                />
              ) : (
                <h1
                  className="sw-title"
                  onClick={() => storyId && setEditingTitle(true)}
                  title="Nhấn để đổi tên"
                >
                  {storyTitle || '✍️ Đang kể câu chuyện'}
                  {storyId && <span className="sw-title-icon">✎</span>}
                </h1>
              )}
              <div className="sw-status-line">
                <span className="sw-status-dot" />
                {statusLabel}
              </div>
            </div>

          </header>

          {/* ── STORY RAW PANEL — neo cố định, không cuộn theo chat ── */}
          {rawContent && userMsgCount >= 2 && (
            <div className="sw-raw-panel">
              <button
                className="sw-raw-toggle"
                onClick={() => setShowRaw(!showRaw)}
              >
                <span className="sw-raw-toggle-icon">{showRaw ? '▾' : '▸'}</span>
                📄 Lời kể của bạn
                <span className="sw-raw-toggle-hint">{showRaw ? 'Thu gọn' : 'Xem'}</span>
              </button>
              {showRaw && (
                <div className="sw-raw">{rawContent}</div>
              )}
            </div>
          )}

          {/* ── CONTENT ── */}
          <div className="sw-content" ref={contentRef}>
            {/* ── SECTION: MIRA INTRODUCTION ── */}
            {conversation.length === 0 && (
              <section className="sw-section sw-mira-intro">
                <div className="sw-mira-avatar">M</div>
                <div className="sw-msg sw-msg-mira sw-msg-intro">
                  <div className="sw-msg-text">
                    Xin chào!<br /><br />
                    Tôi là Mira.<br /><br />
                    Tôi sẽ giúp bạn ghi lại câu chuyện này.<br /><br />
                    Đừng lo về câu chữ.<br /><br />
                    Hãy kể như đang trò chuyện với một người bạn.<br /><br />
                    Tôi sẽ giúp bạn sắp xếp lại sau.
                  </div>
                </div>
              </section>
            )}

            {/* ── SECTION: CONVERSATION ── */}
            {conversation.length > 0 && (
              <section className="sw-section">
                <div className="sw-convo">
                  {groupedConvo.map((group, gi) => (
                    <div key={gi} style={{ display: 'contents' }}>
                      <div className="sw-date-sep">{group.date}</div>
                      {group.msgs.map((msg, i) => (
                        <div key={i} className={`sw-msg ${msg.role === 'user' ? 'sw-msg-user' : 'sw-msg-mira'}`}>
                          {msg.role === 'mira' && <div className="sw-msg-name">Mira</div>}
                          <div className="sw-msg-text">{msg.text}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                  {sending && (
                    <div className="sw-msg sw-msg-mira sw-msg-pending">
                      <div className="sw-msg-name">Mira</div>
                      <div className="sw-msg-text sw-msg-dots">đang nghĩ…</div>
                    </div>
                  )}
                  <div ref={convoEndRef} />
                </div>
              </section>
            )}

            {/* ── SECTION: READY ── */}
            {miraReady && (
              <section className="sw-section">
                <div className="sw-ready-card">
                  <button className="sw-ready-btn" onClick={requestDraft} disabled={sending}>
                    ✨ Biên tập thành bản thảo
                  </button>
                  {errorMsg && (
                    <div className="sw-error">{errorMsg}</div>
                  )}
                </div>
              </section>
            )}

            {/* ── SECTION: COMPOSER ── */}
            {!miraReady && (
              <section className="sw-section sw-composer-section">
                <div className="sw-composer">
                  <AutoTextarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sending}
                    placeholder={phase === 'editing' ? 'Bạn muốn sửa phần nào?' : 'Bắt đầu từ điều bạn nhớ nhất…'}
                  />
                  <button
                    className="sw-send"
                    onClick={phase === 'editing' ? sendEdit : send}
                    disabled={sending || !input.trim()}
                    aria-label="Gửi"
                  />
                </div>
              </section>
            )}

            {/* ── SECTION: COMPLETE CTA ── */}
            {!miraReady && rawContent && userMsgCount >= 2 && (
              <section className="sw-section sw-complete-section">
                <button
                  className="sw-complete-btn"
                  onClick={completeStory}
                  disabled={sending}
                >
                  {sending ? 'Mira đang đọc lại câu chuyện…' : '✓ Hoàn thành lời kể'}
                </button>
                <div className="sw-complete-hint">
                  Bạn luôn có thể quay lại chỉnh sửa hoặc kể thêm sau.
                </div>
              </section>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// CSS — Document-first design
// ══════════════════════════════════════════════════════════════
const CSS = `
.tva-tell {
  --bg: #F2F2F7;
  --surface: #FFFFFF;
  --ink: #000000;
  --ink-soft: #3C3C43;
  --ink-muted: #8E8E93;
  --ink-faint: #C7C7CC;
  --blue: #007AFF;
  --blue-dark: #0062CC;
  --mira-bg: #E9E9EB;
  --green: #34C759;
  --red: #FF3B30;
  --separator: #E5E5EA;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif;
  background: var(--bg);
  color: var(--ink);
  height: 100dvh;
  display: flex;
  flex-direction: column;
  font-size: 17px;
  line-height: 1.47;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.tva-tell * { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Shared ── */
.sw-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.sw-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-muted);
}

/* ── SIDEBAR ── */
.sw-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  z-index: 200;
  animation: sw-fade-overlay 0.2s ease;
}
@keyframes sw-fade-overlay { from { opacity: 0; } to { opacity: 1; } }
.sw-drawer {
  position: fixed;
  top: 0; left: 0; bottom: 0;
  width: min(300px, 85vw);
  background: var(--bg);
  z-index: 201;
  display: flex;
  flex-direction: column;
  transform: translateX(-100%);
  transition: transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);
}
.sw-drawer-open { transform: translateX(0); box-shadow: 0 0 30px rgba(0,0,0,0.1); }
.sw-drawer-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 48px 16px 20px;
}
.sw-drawer-avatar {
  width: 44px; height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5856D6, #AF52DE);
  color: #fff;
  font-weight: 600;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sw-drawer-name { font-size: 17px; font-weight: 700; color: var(--ink); }
.sw-drawer-count { font-size: 13px; color: var(--ink-muted); margin-top: 1px; }
.sw-drawer-new {
  display: block;
  width: calc(100% - 24px);
  margin: 0 12px 8px;
  padding: 10px 14px;
  background: var(--surface);
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  color: var(--blue);
  cursor: pointer;
  text-align: left;
}
.sw-drawer-new:active { background: rgba(0,122,255,0.06); }
.sw-drawer-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px;
}
.sw-drawer-loading,
.sw-drawer-empty {
  font-size: 14px;
  color: var(--ink-muted);
  text-align: center;
  padding: 40px 0;
}
.sw-drawer-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 12px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.sw-drawer-item:active { background: rgba(0,0,0,0.04); }
.sw-drawer-item-active { background: rgba(0,122,255,0.08); }
.sw-drawer-item-icon {
  font-size: 18px;
  flex-shrink: 0;
  line-height: 1;
}
.sw-drawer-item-body {
  flex: 1;
  min-width: 0;
}
.sw-drawer-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.sw-drawer-item-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.sw-drawer-item-time {
  font-size: 12px;
  color: var(--ink-muted);
  margin-top: 2px;
}
.sw-drawer-item-row {
  display: flex;
  align-items: center;
  border-radius: 12px;
  margin-bottom: 2px;
  position: relative;
}
.sw-drawer-item-row-active { background: rgba(0,122,255,0.08); }
.sw-drawer-item-row .sw-drawer-item { flex: 1; margin-bottom: 0; }
.sw-drawer-item-actions { position: relative; flex-shrink: 0; padding-right: 6px; }
.sw-drawer-item-menu-btn { width: 28px; height: 28px; border: none; border-radius: 8px; background: transparent; color: var(--ink-muted); font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 700; letter-spacing: 1px; }
.sw-drawer-item-menu-btn:hover { background: rgba(0,0,0,0.06); }
.sw-drawer-item-menu-overlay { position: fixed; inset: 0; z-index: 299; }
.sw-drawer-item-menu-drop { position: absolute; top: 100%; right: 0; margin-top: 2px; background: var(--surface); border-radius: 12px; box-shadow: 0 2px 14px rgba(0,0,0,0.14); min-width: 150px; z-index: 300; overflow: hidden; }
.sw-drawer-item-menu-drop button { display: block; width: 100%; padding: 10px 14px; border: none; background: transparent; font-size: 14px; font-family: inherit; color: var(--ink); cursor: pointer; text-align: left; }
.sw-drawer-item-menu-drop button:hover { background: rgba(0,0,0,0.04); }
.sw-drawer-item-rename { flex: 1; padding: 6px 12px; }
.sw-drawer-rename-input { width: 100%; padding: 6px 8px; font-size: 15px; font-family: inherit; border: 1.5px solid var(--blue); border-radius: 8px; background: var(--surface); color: var(--ink); outline: none; }
.sw-drawer-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 6px;
  flex-shrink: 0;
}
.sw-drawer-badge-telling { background: rgba(255,149,0,0.1); color: #C93400; }
.sw-drawer-badge-done { background: rgba(52,199,89,0.1); color: #248A3D; }
.sw-drawer-footer {
  padding: 8px 12px;
  border-top: 1px solid var(--separator);
}

/* ── Workspace ── */
.sw-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── HEADER — PO1: tối giản, ưu tiên câu chuyện ── */
.sw-topbar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px 6px 16px;
  border-bottom: 1px solid var(--line);
}
.sw-back-link {
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink-muted);
  transition: color .15s;
}
.sw-back-link:hover { color: var(--ink); }
.sw-topbar .sw-menu-btn {
  width: 28px; height: 28px;
  font-size: 14px;
}

.sw-header {
  flex: none;
  display: flex;
  align-items: center;
  padding: 12px 12px 12px 8px;
  background: var(--bg);
  gap: 4px;
}
.sw-sidebar-btn {
  width: 34px; height: 34px;
  border-radius: 8px;
  border: none;
  background: transparent;
  font-size: 18px;
  color: var(--ink);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sw-sidebar-btn:active { background: rgba(0,0,0,0.05); }
.sw-header-main {
  flex: 1;
  min-width: 0;
  padding: 0 4px;
}
.sw-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--ink);
  cursor: default;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
.sw-title:hover { opacity: 0.7; }
.sw-title-icon {
  display: inline-block;
  margin-left: 4px;
  font-size: 12px;
  color: var(--ink-muted);
  opacity: 0;
}
.sw-title:hover .sw-title-icon { opacity: 1; }
.sw-title-input {
  font-size: 17px;
  font-weight: 700;
  font-family: inherit;
  color: var(--ink);
  border: none;
  border-bottom: 2px solid var(--blue);
  background: transparent;
  outline: none;
  width: 100%;
  padding: 1px 0;
}
.sw-status-line {
  font-size: 12px;
  color: var(--ink-muted);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 1px;
}
.sw-status-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--green);
  flex-shrink: 0;
}
.sw-header-right { flex-shrink: 0; }
.sw-menu-wrap { position: relative; }
.sw-menu-btn {
  width: 34px; height: 34px;
  border-radius: 50%;
  border: none;
  background: transparent;
  font-size: 16px;
  color: var(--blue);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}
.sw-menu-btn:hover { background: rgba(0,0,0,0.05); }
.sw-menu-drop {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--surface);
  border-radius: 14px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.12);
  min-width: 200px;
  z-index: 100;
  overflow: hidden;
}
.sw-menu-drop button {
  display: block;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  font-size: 15px;
  font-family: inherit;
  color: var(--blue);
  cursor: pointer;
  text-align: left;
}
.sw-menu-drop button:hover { background: rgba(0,0,0,0.04); }
.sw-menu-drop hr { border: none; border-top: 1px solid var(--separator); margin: 4px 0; }
.sw-menu-danger { color: var(--red) !important; }

/* ── CONTENT ── */
.sw-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.sw-section { max-width: 640px; width: 100%; }

/* ── MIRA INTRODUCTION ── */
.sw-mira-intro {
  padding: 32px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  animation: sw-fade-in 0.5s ease;
}
.sw-mira-avatar {
  width: 44px; height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5856D6, #AF52DE);
  color: #fff;
  font-weight: 700;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sw-msg-intro {
  max-width: 85% !important;
  align-self: center !important;
}
.sw-msg-intro .sw-msg-text {
  background: #E9E9EB;
  font-size: 15px;
  line-height: 1.55;
  border-radius: 18px;
  border-bottom-left-radius: 6px;
  max-width: none;
}

/* ── CONVERSATION — iMessage style ── */
.sw-convo { display: flex; flex-direction: column; gap: 6px; padding-bottom: 8px; }
.sw-msg { max-width: 66%; }
@keyframes sw-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.sw-msg-user { align-self: flex-end; }
.sw-msg-mira { align-self: flex-start; }
.sw-msg-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-muted);
  margin-bottom: 1px;
  padding: 0 12px;
}
.sw-msg-text {
  font-size: 16px;
  line-height: 1.4;
  white-space: pre-wrap;
  padding: 7px 14px;
  border-radius: 18px;
  position: relative;
}
.sw-msg-user .sw-msg-text {
  background: var(--blue);
  color: #fff;
  border-bottom-right-radius: 6px;
}
.sw-msg-mira .sw-msg-text {
  background: #E9E9EB;
  color: var(--ink);
  border-bottom-left-radius: 6px;
}
.sw-msg-pending { opacity: 0.5; }
.sw-msg-dots { color: var(--ink-muted); }

/* ── Date separator ── */
.sw-date-sep {
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink-muted);
  padding: 12px 0 6px;
}

/* ── STORY RAW PANEL — Apple Notes style ── */
.sw-raw-panel {
  flex: none;
  background: var(--surface);
  border-bottom: 1px solid var(--separator);
}
.sw-raw-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  background: var(--surface);
  border: none;
  font-size: 15px;
  font-weight: 500;
  font-family: inherit;
  color: var(--ink-soft);
  cursor: pointer;
  text-align: left;
}
.sw-raw-toggle:active { background: rgba(0,0,0,0.03); }
.sw-raw-toggle-icon { font-size: 13px; color: var(--ink-muted); }
.sw-raw-toggle-hint {
  margin-left: auto;
  font-size: 13px;
  color: var(--ink-muted);
}
.sw-raw-panel .sw-raw {
  margin: 0;
  border: none;
  border-top: 1px solid var(--separator);
  border-radius: 0;
  background: var(--surface);
  padding: 16px 20px 20px;
  font-size: 17px;
  line-height: 1.55;
  color: var(--ink);
  white-space: pre-wrap;
  text-align: left;
  max-height: 240px;
  overflow-y: auto;
  box-shadow: none;
}

/* ── COMPLETE CTA — dưới composer ── */
.sw-complete-section {
  padding: 12px 0 24px;
  text-align: center;
}
.sw-complete-btn {
  background: transparent;
  color: var(--ink-soft);
  border: 1.5px solid var(--separator);
  border-radius: 14px;
  padding: 12px 28px;
  font-size: 15px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}
.sw-complete-btn:active { background: var(--separator); }
.sw-complete-btn:disabled { opacity: 0.4; cursor: default; }
.sw-complete-hint {
  font-size: 12px;
  color: var(--ink-muted);
  margin-top: 8px;
}
.sw-ready-card {
  background: rgba(52,199,89,0.08);
  border-radius: 16px;
  padding: 20px;
  text-align: center;
}
.sw-ready-btn {
  background: var(--green);
  color: #fff;
  border: none;
  border-radius: 20px;
  padding: 12px 28px;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.sw-ready-btn:active { opacity: 0.8; }
.sw-ready-btn:disabled { opacity: 0.4; cursor: default; }
.sw-error {
  margin-top: 10px;
  font-size: 13px;
  color: var(--red);
  text-align: center;
}

/* ── COMPOSER — iMessage style ── */
.sw-composer-section {
  padding: 8px 0;
  padding-bottom: max(8px, env(safe-area-inset-bottom));
}
.sw-composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--separator);
  border-radius: 24px;
  padding: 5px 5px 5px 16px;
}
.sw-textarea {
  flex: 1;
  resize: none;
  padding: 6px 0;
  background: transparent;
  border: none;
  font-size: 17px;
  font-family: inherit;
  line-height: 1.35;
  outline: none;
  color: var(--ink);
  overflow: hidden;
  max-height: 120px;
}
.sw-textarea::placeholder { color: var(--ink-faint); }
.sw-textarea:disabled { opacity: 0.4; }
.sw-send {
  font-size: 18px;
  width: 34px; height: 34px;
  border-radius: 50%;
  background: var(--blue);
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.15s;
}
.sw-send::after { content: '↑'; font-weight: 700; }
.sw-send:active { opacity: 0.7; }
.sw-send:disabled { opacity: 0.25; cursor: default; }

/* ── DRAFT ── */
.sw-draft-wrap { max-width: 680px; width: 100%; }
.dv-wrap { width: 100%; }
.dv-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-muted);
  margin-bottom: 12px;
}
.dv-body {
  background: var(--surface);
  border-radius: 16px;
  padding: 28px;
  margin-bottom: 16px;
}
.dv-topic {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-muted);
  margin-bottom: 8px;
}
.dv-title { font-size: 24px; font-weight: 800; margin-bottom: 12px; line-height: 1.25; }
.dv-content { font-size: 17px; line-height: 1.55; color: var(--ink-soft); }
.dv-content p { margin-bottom: 10px; }
.dv-content p:last-child { margin-bottom: 0; }
.dv-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.dv-btn {
  flex: 1; min-width: 140px;
  background: var(--surface);
  border: 1px solid var(--separator);
  border-radius: 14px;
  padding: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.dv-btn:active { background: rgba(0,0,0,0.04); }
.dv-btn-primary { background: var(--green); color: #fff; border-color: var(--green); }
.dv-btn-primary:active { opacity: 0.8; }
.dv-btn:disabled { opacity: 0.4; cursor: default; }

/* ── SUBMITTED ── */
.sw-submitted { max-width: 480px; text-align: center; }
.sw-done-icon { font-size: 48px; margin-bottom: 16px; }
.sw-submitted h2 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
.sw-submitted p { font-size: 15px; color: var(--ink-soft); margin-bottom: 20px; line-height: 1.5; }
.sw-link { color: var(--blue); font-weight: 600; text-decoration: none; font-size: 15px; }

/* ── LOADING ── */
.sw-loading { text-align: center; padding: 80px 0; }
.sw-spinner {
  width: 24px; height: 24px;
  border: 2.5px solid var(--separator);
  border-top-color: var(--ink-muted);
  border-radius: 50%;
  animation: sw-spin 0.7s linear infinite;
  margin: 0 auto 12px;
}
@keyframes sw-spin { to { transform: rotate(360deg); } }
.sw-loading p { font-size: 15px; color: var(--ink-muted); }

/* ── AUTH GATE ── */
.ag-gate {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--bg);
}
.ag-card {
  background: var(--surface);
  border-radius: 20px;
  padding: 28px;
  max-width: 380px;
  width: 100%;
  box-shadow: 0 2px 20px rgba(0,0,0,0.06);
}
.ag-avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5856D6, #AF52DE);
  color: #fff;
  font-weight: 700;
  font-size: 17px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.ag-say { font-size: 15px; color: var(--ink-soft); margin-bottom: 16px; line-height: 1.5; }
.ag-card input {
  width: 100%;
  padding: 12px 14px;
  background: var(--bg);
  border: none;
  border-radius: 12px;
  font-size: 15px;
  margin-bottom: 10px;
  font-family: inherit;
  outline: none;
}
.ag-card input:focus { background: rgba(0,122,255,0.04); }
.ag-err {
  background: rgba(255,59,48,0.08);
  color: var(--red);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  margin-bottom: 10px;
}
.ag-btn {
  width: 100%;
  background: var(--blue);
  color: #fff;
  border: none;
  border-radius: 14px;
  padding: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.ag-btn:active { opacity: 0.8; }
.ag-btn:disabled { opacity: 0.5; }
.ag-switch { font-size: 13px; color: var(--ink-muted); text-align: center; margin-top: 12px; }
.ag-switch a { color: var(--blue); font-weight: 600; cursor: pointer; }
`
