// ── /story/tell — MVP 03: Story Workspace ──
// Document-first design. Mira = interviewer. Story = the product.
// Sections: Header → Conversation → Story Raw → Composer → (future sections)
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../supabase'
import type { User } from '@supabase/supabase-js'

type Phase = 'telling' | 'asking' | 'ready_for_draft' | 'draft_loading' | 'draft' | 'editing' | 'submitting' | 'submitted'
type ChatMsg = { role: 'user' | 'mira'; text: string; at: string }

// ── Helpers ──
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

  // ── Conversation + Story Raw ──
  const [conversation, setConversation] = useState<ChatMsg[]>([])
  const [rawContent, setRawContent] = useState('')

  // ── Draft ──
  const [draftTitle, setDraftTitle] = useState('')
  const [draftTopic, setDraftTopic] = useState('')
  const [draftContent, setDraftContent] = useState('')

  // ── Refs ──
  const titleInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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

  // ── Focus title input when editing ──
  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitle])

  // ── Resume draft ──
  const draftLoadedRef = useRef(false)
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
  }, [user])

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

  // ── Request draft ──
  const requestDraft = useCallback(async () => {
    if (!storyId || sending) return
    setSending(true)
    setPhase('draft_loading')
    try {
      const { data, error } = await supabase.functions.invoke('story-ai', {
        body: { action: 'write', storyId },
      })
      if (error || !data) throw error ?? new Error('empty')
      setDraftTitle(data.title || '')
      setDraftTopic(data.topic || '')
      setDraftContent(data.content || '')
      setPhase('draft')
    } catch (e) {
      console.error('story-ai write', e)
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
        <div className="sw-workspace">
          {/* ── HEADER ── */}
          <header className="sw-header">
            <div className="sw-header-left">
              <div className="sw-avatar">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="sw-header-meta">
                <div className="sw-author">{displayName}</div>
                <div className="sw-status">
                  <span className="sw-status-dot" />
                  {statusLabel}
                  <span className="sw-status-sep">·</span>
                  <span className="sw-autosave">Đã lưu tự động</span>
                </div>
              </div>
            </div>

            <div className="sw-header-center">
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
                  {storyTitle || 'Câu chuyện chưa đặt tên'}
                  {storyId && <span className="sw-title-icon">✎</span>}
                </h1>
              )}
            </div>

            <div className="sw-header-right">
              <div className="sw-menu-wrap" ref={menuRef}>
                <button className="sw-menu-btn" onClick={() => setShowMenu(!showMenu)}>
                  ···
                </button>
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
          </header>

          {/* ── RESUME BAR ── */}
          {draftResumed && (
            <div className="sw-resume">
              📝 Bạn có một câu chuyện đang kể dở — kể tiếp nhé.
              <button onClick={startNew}>+ Câu chuyện mới</button>
            </div>
          )}

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
          <div className="sw-content">
            {/* ── SECTION: INVITATION ── */}
            {conversation.length === 0 && (
              <section className="sw-section sw-invitation">
                <p>{draftResumed ? 'Bạn đang kể dở — kể tiếp cho mình nghe chứ?' : invitation}</p>
              </section>
            )}

            {/* ── SECTION: CONVERSATION ── */}
            {conversation.length > 0 && (
              <section className="sw-section">
                <div className="sw-convo">
                  {conversation.map((msg, i) => (
                    <div key={i} className={`sw-msg ${msg.role === 'user' ? 'sw-msg-user' : 'sw-msg-mira'}`}>
                      {msg.role === 'mira' && <div className="sw-msg-name">Mira</div>}
                      <div className="sw-msg-text">{msg.text}</div>
                    </div>
                  ))}
                  {sending && (
                    <div className="sw-msg sw-msg-mira sw-msg-pending">
                      <div className="sw-msg-name">Mira</div>
                      <div className="sw-msg-text sw-msg-dots">đang nghĩ…</div>
                    </div>
                  )}
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
                    placeholder={phase === 'editing' ? 'Bạn muốn sửa phần nào?' : 'Hãy kể tiếp câu chuyện…'}
                  />
                  <button
                    className="sw-send"
                    onClick={phase === 'editing' ? sendEdit : send}
                    disabled={sending || !input.trim()}
                  >
                    {sending ? 'Đang gửi…' : 'Gửi'}
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// CSS — Document-first design
// ══════════════════════════════════════════════════════════════
const CSS = `
.tva-tell {
  --bg: #FAF8F5;
  --surface: #FFFFFF;
  --ink: #1A1625;
  --ink-soft: #4A4458;
  --ink-muted: #787180;
  --ink-faint: #A09BA8;
  --border: #E8E3DC;
  --border-light: #F0EDE8;
  --accent: #4338CA;
  --accent-hover: #352BA3;
  --accent-tint: #EEEBFB;
  --green: #0D9488;
  --green-tint: #E6F7F5;
  --honey: #B3620C;
  --honey-tint: #FDF2E4;
  --radius: 12px;
  --radius-lg: 18px;
  --shadow-sm: 0 1px 2px rgba(26, 22, 37, 0.04);
  --shadow-md: 0 4px 16px rgba(26, 22, 37, 0.06);
  font-family: 'Be Vietnam Pro', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--ink);
  height: 100dvh;
  display: flex;
  flex-direction: column;
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.tva-tell * { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Shared page wrapper ── */
.sw-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

/* ── Workspace ── */
.sw-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── HEADER ── */
.sw-header {
  flex: none;
  display: flex;
  align-items: center;
  padding: 14px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  gap: 16px;
  position: relative;
}
.sw-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex-shrink: 0;
}
.sw-avatar {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-weight: 700;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sw-header-meta { min-width: 0; }
.sw-author {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sw-status {
  font-size: 12px;
  color: var(--ink-muted);
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.sw-status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--green);
  flex-shrink: 0;
}
.sw-status-sep { color: var(--ink-faint); }
.sw-autosave { color: var(--ink-faint); }

.sw-header-center {
  flex: 1;
  text-align: center;
  min-width: 0;
}
.sw-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  cursor: default;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  letter-spacing: normal;
  word-spacing: normal;
  transition: color 0.15s;
}
.sw-title:hover { color: var(--accent); }
.sw-title-icon {
  display: inline-block;
  margin-left: 6px;
  font-size: 11px;
  color: var(--ink-faint);
  opacity: 0;
  transition: opacity 0.15s;
}
.sw-title:hover .sw-title-icon { opacity: 1; }
.sw-title-input {
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  color: var(--ink);
  border: none;
  border-bottom: 2px solid var(--accent);
  background: transparent;
  text-align: center;
  outline: none;
  width: 100%;
  max-width: 320px;
  padding: 2px 0;
}

.sw-header-right { flex-shrink: 0; }
.sw-menu-wrap { position: relative; }
.sw-menu-btn {
  width: 36px; height: 36px;
  border-radius: 10px;
  border: none;
  background: transparent;
  font-size: 18px;
  font-weight: 700;
  color: var(--ink-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 1px;
  transition: all 0.15s;
}
.sw-menu-btn:hover { background: var(--border-light); color: var(--ink); }
.sw-menu-drop {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  min-width: 200px;
  z-index: 100;
  overflow: hidden;
}
.sw-menu-drop button {
  display: block;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-family: inherit;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}
.sw-menu-drop button:hover { background: var(--border-light); }
.sw-menu-drop hr {
  border: none;
  border-top: 1px solid var(--border-light);
  margin: 4px 0;
}
.sw-menu-danger { color: #DC2626 !important; }

/* ── RESUME BAR ── */
.sw-resume {
  flex: none;
  text-align: center;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--honey);
  background: var(--honey-tint);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.sw-resume button {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-tint);
  border: 1px solid #D3CEE8;
  border-radius: 8px;
  padding: 4px 12px;
  cursor: pointer;
  font-family: inherit;
}
.sw-resume button:hover { background: var(--accent); color: #fff; }

/* ── CONTENT ── */
.sw-content {
  flex: 1;
  overflow-y: auto;
  padding: 32px 20px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}

/* ── SECTIONS ── */
.sw-section {
  max-width: 640px;
  width: 100%;
}

/* ── INVITATION ── */
.sw-invitation {
  padding: 60px 0;
  text-align: center;
}
.sw-invitation p {
  font-size: 20px;
  font-weight: 500;
  color: var(--ink-soft);
  line-height: 1.5;
}

/* ── CONVERSATION ── */
.sw-convo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sw-msg {
  max-width: 88%;
  animation: sw-fade-in 0.3s ease;
}
@keyframes sw-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.sw-msg-user {
  align-self: flex-end;
}
.sw-msg-mira {
  align-self: flex-start;
}
.sw-msg-name {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--honey);
  margin-bottom: 4px;
}
.sw-msg-text {
  font-size: 15px;
  line-height: 1.65;
  white-space: pre-wrap;
}
.sw-msg-user .sw-msg-text {
  background: var(--accent-tint);
  color: var(--ink-soft);
  padding: 10px 16px;
  border-radius: var(--radius) var(--radius) 4px var(--radius);
  text-align: left;
}
.sw-msg-mira .sw-msg-text {
  color: var(--ink);
  padding: 10px 16px;
  background: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius) var(--radius) var(--radius) 4px;
}
.sw-msg-pending { opacity: 0.55; }
.sw-msg-dots { color: var(--ink-faint); font-style: italic; }

/* ── STORY RAW PANEL — neo cố định dưới header ── */
.sw-raw-panel {
  flex: none;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.sw-raw-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 20px;
  background: var(--surface);
  border: none;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  color: var(--honey);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}
.sw-raw-toggle:hover { background: var(--honey-tint); }
.sw-raw-toggle-icon {
  font-size: 12px;
  width: 14px;
  text-align: center;
  flex-shrink: 0;
}
.sw-raw-toggle-hint {
  margin-left: auto;
  font-size: 11px;
  font-weight: 500;
  color: var(--ink-faint);
  text-transform: none;
}
.sw-raw-panel .sw-raw {
  margin: 0;
  border: none;
  border-top: 1px solid var(--border-light);
  border-radius: 0;
  background: var(--surface);
  padding: 20px 24px;
  font-size: 16px;
  line-height: 1.7;
  color: var(--ink);
  white-space: pre-wrap;
  text-align: left;
  max-height: 220px;
  overflow-y: auto;
  box-shadow: none;
  font-family: 'Be Vietnam Pro', Georgia, serif;
}

/* ── READY CARD ── */
.sw-ready-card {
  background: var(--green-tint);
  border: 1px solid #A7DED9;
  border-radius: var(--radius);
  padding: 22px;
  text-align: center;
}
.sw-ready-btn {
  background: var(--green);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 13px 32px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}
.sw-ready-btn:hover:not(:disabled) { background: #0B827B; }
.sw-ready-btn:disabled { opacity: 0.6; cursor: default; }

/* ── COMPOSER ── */
.sw-composer-section {
  padding-top: 8px;
  padding-bottom: 12px;
}
.sw-composer {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}
.sw-textarea {
  width: 100%;
  resize: none;
  padding: 14px 16px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  font-size: 15px;
  font-family: inherit;
  line-height: 1.7;
  outline: none;
  color: var(--ink);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.sw-textarea:focus { border-color: var(--accent); }
.sw-textarea::placeholder { color: var(--ink-faint); }
.sw-textarea:disabled { opacity: 0.5; background: var(--border-light); }
.sw-send {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
  flex-shrink: 0;
}
.sw-send:hover:not(:disabled) { background: var(--accent-hover); }
.sw-send:disabled { opacity: 0.35; cursor: default; }

/* ── DRAFT ── */
.sw-draft-wrap {
  max-width: 680px;
  width: 100%;
}
.dv-wrap { width: 100%; }
.dv-header {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--honey);
  margin-bottom: 16px;
}
.dv-body {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 32px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-sm);
}
.dv-topic {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  color: var(--honey);
  background: var(--honey-tint);
  padding: 4px 10px;
  border-radius: 6px;
  margin-bottom: 12px;
}
.dv-title {
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 16px;
  line-height: 1.3;
}
.dv-content { font-size: 16px; line-height: 1.8; color: var(--ink-soft); }
.dv-content p { margin-bottom: 12px; }
.dv-content p:last-child { margin-bottom: 0; }
.dv-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.dv-btn {
  flex: 1; min-width: 160px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.dv-btn:hover:not(:disabled) { background: var(--bg); }
.dv-btn-primary { background: var(--green); color: #fff; border-color: var(--green); }
.dv-btn-primary:hover:not(:disabled) { background: #0B827B; }
.dv-btn:disabled { opacity: 0.5; cursor: default; }

/* ── SUBMITTED ── */
.sw-submitted { max-width: 480px; text-align: center; }
.sw-done-icon { font-size: 48px; margin-bottom: 16px; }
.sw-submitted h2 { font-size: 22px; font-weight: 800; margin-bottom: 12px; }
.sw-submitted p { font-size: 15px; color: var(--ink-soft); margin-bottom: 24px; line-height: 1.6; }
.sw-link { color: var(--accent); font-weight: 600; text-decoration: none; font-size: 15px; }

/* ── LOADING ── */
.sw-loading { text-align: center; padding: 60px 0; }
.sw-spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: sw-spin 0.7s linear infinite;
  margin: 0 auto 16px;
}
@keyframes sw-spin { to { transform: rotate(360deg); } }
.sw-loading p { font-size: 15px; color: var(--ink-faint); }

/* ── CENTER ── */
.sw-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-faint);
}

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
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 28px;
  max-width: 400px;
  width: 100%;
  box-shadow: var(--shadow-md);
}
.ag-avatar {
  width: 42px; height: 42px;
  border-radius: 12px;
  background: var(--accent);
  color: #fff;
  font-weight: 800;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.ag-say { font-size: 15px; color: var(--ink-soft); margin-bottom: 16px; line-height: 1.6; }
.ag-card input {
  width: 100%;
  padding: 11px 14px;
  background: var(--bg);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  font-size: 15px;
  margin-bottom: 10px;
  font-family: inherit;
  outline: none;
}
.ag-card input:focus { border-color: var(--accent); }
.ag-err {
  background: #FEE2E2;
  border: 1px solid #FECACA;
  color: #B91C1C;
  border-radius: 9px;
  padding: 9px 12px;
  font-size: 13.5px;
  margin-bottom: 10px;
}
.ag-btn {
  width: 100%;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 13px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.ag-btn:hover { background: var(--accent-hover); }
.ag-btn:disabled { opacity: 0.65; }
.ag-switch { font-size: 13px; color: var(--ink-faint); text-align: center; margin-top: 12px; }
.ag-switch a { color: var(--accent); font-weight: 600; cursor: pointer; }
`
