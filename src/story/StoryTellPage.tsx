// ── /story/tell — MVP 03: Giao diện kể chuyện ──
// Layout stacked: Conversation → Story Raw → Composer
// Mira luôn hỏi 1 câu sau mỗi message người dùng.
import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../supabase'
import type { User } from '@supabase/supabase-js'

type Phase = 'telling' | 'asking' | 'ready_for_draft' | 'draft_loading' | 'draft' | 'editing' | 'submitting' | 'submitted'
type ChatMsg = { role: 'user' | 'mira'; text: string; at: string }

// Helper: trích xuất thông điệp lỗi từ Edge Function response
async function getErrMsg(e: unknown): Promise<string> {
  if (e && typeof e === 'object' && 'context' in e) {
    try {
      const ctx = (e as { context: { json?: () => Promise<unknown> } }).context
      if (ctx?.json) {
        const body = await ctx.json()
        if (body && typeof body === 'object' && 'error' in body) {
          return String((body as { error: string }).error)
        }
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

// ── AuthGate: màn đăng nhập/tạo tài khoản giọng Mira ──
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

// ── LivingBookBar ──
function LivingBookBar() {
  return (
    <div className="lb-bar">
      📖 Bạn đang viết một trang cho <b>1001 Câu chuyện cùng Guitar</b>.
    </div>
  )
}

// ── DraftView: bản thảo + 3 nút ──
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

// ── StoryTellPage ──
export default function StoryTellPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [storyId, setStoryId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [phase, setPhase] = useState<Phase>('telling')
  const [miraReply, setMiraReply] = useState('')
  const [miraReady, setMiraReady] = useState(false) // Mira đã đánh giá đủ

  // Draft state
  const [draftTitle, setDraftTitle] = useState('')
  const [draftTopic, setDraftTopic] = useState('')
  const [draftContent, setDraftContent] = useState('')

  // Auth
  const [authBusy, setAuthBusy] = useState(false)
  const [authErr, setAuthErr] = useState('')

  // Lời mời ngẫu nhiên (chỉ chọn 1 lần khi mount)
  const invitation = useMemo(() => INVITATIONS[Math.floor(Math.random() * INVITATIONS.length)], [])

  // Mở lại bài kể dở (nếu có)
  const [draftResumed, setDraftResumed] = useState(false)

  // ── MVP 03: Conversation + Story Raw ──
  const [conversation, setConversation] = useState<ChatMsg[]>([])
  const [rawContent, setRawContent] = useState('')
  const [loadingRaw, setLoadingRaw] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null); setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null); setAuthChecked(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Nháp tự lưu: kiểm tra bài dở khi đăng nhập
  useEffect(() => {
    if (!user) return
    supabase.from('stories')
      .select('id,status,conversation,title,content,topic')
      .eq('user_id', user.id)
      .in('status', ['telling', 'user_review'])
      .order('updated_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        const s = data?.[0]
        if (!s) return
        if (s.status === 'user_review' && s.title && s.content) {
          // Có bản nháp đang chờ duyệt → hiển thị lại
          setStoryId(s.id)
          setDraftTitle(s.title)
          setDraftTopic(s.topic || '')
          setDraftContent(s.content)
          setPhase('draft')
          setDraftResumed(true)
        } else if (Array.isArray(s.conversation) && s.conversation.length > 0) {
          // Có bài đang kể dở → kể tiếp
          setStoryId(s.id)
          setConversation(s.conversation)
          setPhase('telling')
          setDraftResumed(true)
          // Tải Story Raw
          supabase.from('story_chunks')
            .select('content, order_index')
            .eq('story_id', s.id)
            .order('order_index', { ascending: true })
            .then(({ data: chunks }) => {
              if (chunks) setRawContent(chunks.map(c => c.content).join('\n\n'))
            })
        }
      })
  }, [user])

  // ── Gửi lời kể (chat) ──
  const send = useCallback(async () => {
    const t = input.trim()
    if (!t || sending) return
    setInput('')
    setSending(true)

    // Hiển thị message của user ngay lập tức
    const userMsg: ChatMsg = { role: 'user', text: t, at: new Date().toISOString() }
    setConversation(prev => [...prev, userMsg])

    // Cập nhật Story Raw ngay (thêm đoạn mới vào)
    setRawContent(prev => prev ? prev + '\n\n' + t : t)

    try {
      const { data, error } = await supabase.functions.invoke('story-ai', {
        body: { action: 'chat', storyId, message: t },
      })
      if (error || !data) throw error ?? new Error('empty')
      if (data.storyId) setStoryId(data.storyId)

      const p = data.phase as string
      const miraText = data.reply || ''
      const miraMsg: ChatMsg = { role: 'mira', text: miraText, at: new Date().toISOString() }
      setConversation(prev => [...prev, miraMsg])

      if (p === 'ready_for_draft') {
        setMiraReady(true)
        setPhase('ready_for_draft')
        setMiraReply(miraText)
      } else {
        setPhase('asking')
        setMiraReply(miraText)
      }
    } catch (e) {
      console.error('story-ai chat', e)
      const msg = (e as { message?: string })?.message || String(e)
      const errMsg: ChatMsg = { role: 'mira', text: 'Lỗi: ' + msg, at: new Date().toISOString() }
      setConversation(prev => [...prev, errMsg])
    } finally { setSending(false) }
  }, [input, sending, storyId])

  // ── Yêu cầu viết bản thảo ──
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
      const msg = (e as { message?: string })?.message || String(e)
      setMiraReply('Lỗi: ' + msg)
      setPhase('ready_for_draft')
    } finally { setSending(false) }
  }, [storyId, sending])

  // ── Gửi biên tập ──
  const submitReview = useCallback(async () => {
    if (!storyId || sending) return
    setSending(true)
    setPhase('submitting')
    // Cập nhật status trước
    await supabase.from('stories').update({ status: 'submitted' }).eq('id', storyId)
    try {
      await supabase.functions.invoke('story-ai', {
        body: { action: 'review', storyId },
      })
    } catch (e) {
      console.error('story-ai review', e)
      // Vẫn coi là submitted — review sẽ được retry
    }
    setPhase('submitted')
    setSending(false)
  }, [storyId, sending])

  // ── Biên tập lại ──
  const startEdit = useCallback(() => {
    setPhase('editing')
    setMiraReply('Bạn muốn mình sửa phần nào?')
  }, [])

  // ── Gửi yêu cầu biên tập ──
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
      setMiraReply('Có lỗi khi sửa bản thảo. Bạn thử lại giúp mình nhé 🌿')
    } finally { setSending(false) }
  }, [input, sending, storyId, draftTitle, draftTopic, draftContent])

  // ── Kể thêm (từ draft) ──
  const tellMore = useCallback(async () => {
    setMiraReady(false)
    setMiraReply('')
    setPhase('telling')
  }, [])

  // ── MVP 02: Lấy Story Raw từ chunks ──
  const fetchRaw = useCallback(async () => {
    if (!storyId) return
    setLoadingRaw(true)
    try {
      const { data, error } = await supabase
        .from('story_chunks')
        .select('content, order_index')
        .eq('story_id', storyId)
        .order('order_index', { ascending: true })
      if (error) { console.error('fetchRaw', error); return }
      const raw = (data || []).map(c => c.content).join('\n\n')
      setRawContent(raw)
    } catch (e) {
      console.error('fetchRaw', e)
    } finally { setLoadingRaw(false) }
  }, [storyId])

  // ── Bắt đầu câu chuyện mới ──
  const startNew = useCallback(() => {
    setStoryId(null)
    setConversation([])
    setRawContent('')
    setMiraReply('')
    setMiraReady(false)
    setDraftResumed(false)
    setPhase('telling')
    setInput('')
  }, [])

  // ── Đăng nhập / tạo tài khoản ──
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

  // ── Render ──
  return (
    <div className="tva-tell">
      <style>{CSS}</style>

      {!authChecked ? (
        <div className="center-note">Đang mở cửa…</div>
      ) : !user ? (
        <AuthGate onSubmit={submitAuth} busy={authBusy} err={authErr} />
      ) : phase === 'submitted' ? (
        <>
          <LivingBookBar />
          <div className="mv-body">
            <div className="mv-submitted">
              <div className="mv-done-icon">🎉</div>
              <h2>Câu chuyện của bạn đã được gửi đến Ban biên tập</h2>
              <p>Cảm ơn bạn đã chia sẻ câu chuyện của mình. Ban biên tập sẽ đọc và phản hồi trong thời gian sớm nhất.</p>
              <a className="mv-back" href="/story">← Về trang 1001 Câu chuyện</a>
            </div>
          </div>
        </>
      ) : phase === 'draft' ? (
        <>
          <LivingBookBar />
          <div className="mv-body">
            <DraftView
              title={draftTitle} topic={draftTopic} content={draftContent}
              onAccept={submitReview} onEdit={startEdit} onTellMore={tellMore}
              busy={sending}
            />
          </div>
        </>
      ) : phase === 'draft_loading' || phase === 'submitting' ? (
        <>
          <LivingBookBar />
          <div className="mv-body">
            <div className="mv-loading">
              <div className="mv-spinner" />
              <p>{phase === 'draft_loading' ? 'Mira đang sắp xếp lại câu chuyện của bạn…' : 'Đang gửi câu chuyện…'}</p>
            </div>
          </div>
        </>
      ) : (
        /* Telling / Asking / Ready for draft / Editing */
        <>
          {draftResumed && (
            <div className="mv-resume-bar">
              📝 Bạn có một câu chuyện đang kể dở — kể tiếp nhé.
              <button className="mv-new-btn" onClick={startNew}>+ Câu chuyện mới</button>
            </div>
          )}

          {!draftResumed && (
            <LivingBookBar />
          )}

          <div className="mv-body">
            {/* ── CONVERSATION ── */}
            {conversation.length > 0 && (
              <div className="mv-convo-wrap">
                {conversation.map((msg, i) => (
                  <div key={i} className={`mv-bubble ${msg.role === 'user' ? 'mv-bubble-user' : 'mv-bubble-mira'}`}>
                    {msg.role === 'mira' && <div className="mv-bubble-label">Mira</div>}
                    <div className="mv-bubble-text">{msg.text}</div>
                  </div>
                ))}
                {sending && (
                  <div className="mv-bubble mv-bubble-mira mv-bubble-typing">
                    <div className="mv-bubble-label">Mira</div>
                    <div className="mv-bubble-text mv-typing">đang nghĩ…</div>
                  </div>
                )}
              </div>
            )}

            {/* ── INVITATION (chỉ khi chưa có gì) ── */}
            {conversation.length === 0 && (
              <div className="mv-invitation">
                <p>{draftResumed ? 'Bạn đang kể dở — kể tiếp cho mình nghe chứ?' : invitation}</p>
              </div>
            )}

            {/* ── STORY RAW ── */}
            {rawContent && conversation.filter(m => m.role === 'user').length >= 2 && (
              <div className="mv-raw-section">
                <div className="mv-raw-label">📄 Lời kể của bạn</div>
                <div className="mv-raw-doc">{rawContent}</div>
              </div>
            )}

            {/* ── READY FOR DRAFT ── */}
            {miraReady && (
              <div className="mv-ready">
                <button className="mv-ready-btn" onClick={requestDraft} disabled={sending}>
                  ✨ Tạo bản thảo
                </button>
              </div>
            )}

            {/* ── COMPOSER ── */}
            {!miraReady && (
              <div className="mv-composer">
                <textarea
                  className="mv-textarea"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                  rows={4}
                  placeholder={
                    phase === 'editing'
                      ? 'Bạn muốn sửa phần nào?'
                      : 'Kể tiếp cho mình nghe nhé…'
                  }
                />
                <button
                  className="mv-send"
                  onClick={phase === 'editing' ? sendEdit : send}
                  disabled={sending || !input.trim()}
                >
                  {sending ? 'Đang gửi…' : phase === 'editing' ? 'Gửi yêu cầu sửa' : 'Gửi'}
                </button>
              </div>
            )}

            <div className="mv-footnote">
              Câu chuyện của bạn được lưu tự động — có thể nghỉ và quay lại bất cứ lúc nào.
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const CSS = `
.tva-tell {
  --bg: #F2EEE7;
  --page: #FEFCF7;
  --ink: #211C32;
  --ink-soft: #5A5470;
  --ink-faint: #8A8499;
  --ink-subtle: #B8B2A8;
  --indigo: #4338CA;
  --indigo-dark: #352BA3;
  --indigo-tint: #EEEBFB;
  --line: #E4DED4;
  --line-soft: #EDE8DF;
  --honey: #C9711E;
  --honey-tint: #FBF1E4;
  --green: #0D9488;
  --green-tint: #E6F7F5;
  font-family: 'Be Vietnam Pro', system-ui, sans-serif;
  background: var(--bg);
  color: var(--ink);
  height: 100dvh;
  display: flex;
  flex-direction: column;
  font-size: 16px;
  line-height: 1.55;
  color-scheme: light;
  text-align: left;
}
.tva-tell * { box-sizing: border-box; }

/* ── LivingBookBar ── */
.lb-bar {
  flex: none;
  text-align: center;
  padding: 12px 16px 10px;
  font-size: 13px;
  color: var(--ink-soft);
  background: var(--page);
  border-bottom: 1px solid var(--line-soft);
  letter-spacing: 0.2px;
}
.lb-bar b { color: var(--indigo); font-weight: 700; }

.mv-resume-bar {
  flex: none;
  text-align: center;
  padding: 10px 16px;
  font-size: 13px;
  color: var(--honey);
  background: var(--honey-tint);
  border-bottom: 1px solid #F0DFC8;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}
.mv-new-btn {
  font-size: 12px;
  font-weight: 600;
  color: var(--indigo);
  background: var(--indigo-tint);
  border: 1px solid #D3CEE8;
  border-radius: 8px;
  padding: 4px 12px;
  cursor: pointer;
  font-family: inherit;
}
.mv-new-btn:hover { background: var(--indigo); color: #fff; }

/* ── Main view body ── */
.mv-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px 16px 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

/* ── Invitation (chỉ khi chưa có conversation) ── */
.mv-invitation {
  max-width: 600px;
  width: 100%;
  padding: 40px 0;
  text-align: center;
}
.mv-invitation p {
  font-size: 19px;
  font-weight: 500;
  color: var(--ink-soft);
  line-height: 1.5;
  margin: 0;
}

/* ── MVP 03: Conversation bubbles ── */
.mv-convo-wrap {
  max-width: 600px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.mv-bubble {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 15px;
  line-height: 1.65;
  animation: mv-fade-in 0.25s ease;
}
@keyframes mv-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.mv-bubble-user {
  align-self: flex-end;
  background: var(--indigo-tint);
  color: var(--ink-soft);
  border-bottom-right-radius: 6px;
}
.mv-bubble-mira {
  align-self: flex-start;
  background: var(--page);
  color: var(--ink);
  border: 1px solid var(--line-soft);
  border-bottom-left-radius: 6px;
}
.mv-bubble-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--honey);
  margin-bottom: 4px;
}
.mv-bubble-text {
  white-space: pre-wrap;
}
.mv-bubble-typing { opacity: 0.7; }
.mv-typing {
  color: var(--ink-faint);
  font-style: italic;
}

/* ── MVP 03: Story Raw document ── */
.mv-raw-section {
  max-width: 640px;
  width: 100%;
  margin-top: 8px;
}
.mv-raw-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--honey);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}
.mv-raw-doc {
  background: var(--page);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 24px 28px;
  font-size: 17px;
  line-height: 1.85;
  color: var(--ink);
  white-space: pre-wrap;
  font-family: 'Be Vietnam Pro', system-ui, serif;
}

/* ── Ready for draft ── */
.mv-ready {
  max-width: 600px;
  width: 100%;
  padding: 18px;
  background: var(--green-tint);
  border: 1px solid #A7DED9;
  border-radius: 14px;
  text-align: center;
}
.mv-ready-btn {
  background: var(--green);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 12px 28px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.mv-ready-btn:hover:not(:disabled) { background: #0B827B; }
.mv-ready-btn:disabled { opacity: 0.6; cursor: default; }

/* ── Composer ── */
.mv-composer {
  max-width: 600px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mv-textarea {
  width: 100%;
  resize: vertical;
  padding: 14px 16px;
  background: var(--page);
  border: 1.5px solid var(--line);
  border-radius: 14px;
  font-size: 15px;
  font-family: inherit;
  line-height: 1.7;
  outline: none;
  min-height: 80px;
  color: var(--ink);
}
.mv-textarea:focus { border-color: var(--indigo); }
.mv-textarea::placeholder { color: var(--ink-subtle); }
.mv-textarea:disabled { opacity: 0.6; }
.mv-send {
  align-self: flex-end;
  background: var(--indigo);
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 11px 24px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}
.mv-send:hover:not(:disabled) { background: var(--indigo-dark); }
.mv-send:disabled { opacity: 0.5; cursor: default; }
.mv-footnote {
  max-width: 600px;
  width: 100%;
  margin-top: 4px;
  font-size: 12px;
  color: var(--ink-subtle);
  text-align: center;
}

/* ── Draft view ── */
.dv-wrap {
  max-width: 680px;
  width: 100%;
}
.dv-header {
  font-size: 13px;
  font-weight: 700;
  color: var(--honey);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 16px;
}
.dv-body {
  background: var(--page);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 28px;
  margin-bottom: 20px;
}
.dv-topic {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  color: var(--honey);
  background: var(--honey-tint);
  padding: 4px 10px;
  border-radius: 6px;
  margin-bottom: 10px;
}
.dv-title {
  font-size: 22px;
  font-weight: 800;
  margin: 0 0 16px;
  line-height: 1.3;
}
.dv-content { font-size: 15.5px; line-height: 1.75; color: var(--ink-soft); }
.dv-content p { margin: 0 0 12px; }
.dv-content p:last-child { margin-bottom: 0; }
.dv-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.dv-btn {
  flex: 1;
  min-width: 160px;
  background: var(--page);
  border: 1.5px solid var(--line);
  border-radius: 12px;
  padding: 14px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.dv-btn:hover:not(:disabled) { background: var(--bg); border-color: var(--ink-subtle); }
.dv-btn-primary {
  background: var(--green);
  color: #fff;
  border-color: var(--green);
}
.dv-btn-primary:hover:not(:disabled) { background: #0B827B; border-color: #0B827B; }
.dv-btn:disabled { opacity: 0.5; cursor: default; }

/* ── Submitted ── */
.mv-submitted {
  max-width: 500px;
  text-align: center;
  padding: 40px 0;
}
.mv-done-icon { font-size: 48px; margin-bottom: 16px; }
.mv-submitted h2 { font-size: 22px; font-weight: 800; margin: 0 0 12px; }
.mv-submitted p { font-size: 15px; color: var(--ink-soft); margin: 0 0 24px; line-height: 1.6; }
.mv-back {
  display: inline-block;
  color: var(--indigo);
  font-weight: 600;
  text-decoration: none;
  font-size: 15px;
}

/* ── Loading ── */
.mv-loading {
  text-align: center;
  padding: 60px 0;
}
.mv-spinner {
  width: 36px; height: 36px;
  border: 3px solid var(--line);
  border-top-color: var(--indigo);
  border-radius: 50%;
  animation: mv-spin 0.8s linear infinite;
  margin: 0 auto 16px;
}
@keyframes mv-spin { to { transform: rotate(360deg); } }
.mv-loading p {
  font-size: 15px;
  color: var(--ink-faint);
  margin: 0;
}

/* ── AuthGate ── */
.ag-gate {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--bg);
}
.ag-card {
  background: var(--page);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 26px;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 20px 50px -24px rgba(33, 28, 50, 0.25);
}
.ag-avatar {
  width: 42px; height: 42px;
  border-radius: 999px;
  background: var(--indigo);
  color: #fff;
  font-weight: 800;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.ag-say {
  font-size: 15px;
  color: var(--ink-soft);
  margin: 0 0 16px;
  line-height: 1.6;
}
.ag-card input {
  width: 100%;
  padding: 11px 13px;
  background: #FBFAF7;
  border: 1.5px solid var(--line);
  border-radius: 10px;
  font-size: 15px;
  margin-bottom: 10px;
  font-family: inherit;
  outline: none;
}
.ag-card input:focus { border-color: var(--indigo); }
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
  background: var(--indigo);
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 13px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.ag-btn:hover { background: var(--indigo-dark); }
.ag-btn:disabled { opacity: 0.65; }
.ag-switch {
  font-size: 13px;
  color: var(--ink-faint);
  text-align: center;
  margin-top: 12px;
}
.ag-switch a { color: var(--indigo); font-weight: 600; cursor: pointer; }

/* ── Shared ── */
.center-note {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-faint);
}
`
