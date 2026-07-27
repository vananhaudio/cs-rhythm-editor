// ── /story/tell — Trang giấy đang viết cùng Mira ──
// Hiến pháp: MIRA_CONSTITUTION.md — UI không được giống chat AI.
// Thiết kế: lời người kể = dòng chảy chính; lời Mira = ghi chú nhỏ bên lề.
// Component: LivingBookBar · StoryPage · TellComposer · AuthGate
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../supabase'
import type { User } from '@supabase/supabase-js'

type Msg = { role: 'user' | 'mira'; text: string; at?: string }
type Phase = 'telling' | 'suggest_photos' | 'suggest_write'

const GREETING: Msg = {
  role: 'mira',
  text: 'Chào bạn, mình là Mira 🌿 Mình đang giúp thầy Văn Anh gom đủ 1001 câu chuyện thật của những người yêu guitar.\n\nBạn không cần biết viết đâu — cứ kể tự nhiên, phần viết để mình lo.',
}

// ── AuthGate: màn đăng nhập/tạo tài khoản giọng Mira (B0) ──
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

// ── LivingBookBar: dòng Cuốn sách sống cố định trên đầu ──
function LivingBookBar() {
  return (
    <div className="lb-bar">
      📖 Bạn đang viết một trang cho <b>1001 Câu chuyện cùng Guitar</b>.
    </div>
  )
}

// ── StoryPage: dòng chảy văn bản chính (lời người kể) + ghi chú Mira bên lề ──
function StoryPage({ msgs, sending, phase }: {
  msgs: Msg[]; sending: boolean; phase: Phase
}) {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, sending])

  return (
    <div className="sp-body" ref={bodyRef}>
      <div className="sp-page">
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <p key={i} className="sp-teller">{m.text}</p>
          ) : (
            <div key={i} className="sp-mira">{m.text}</div>
          )
        )}
        {sending && <div className="sp-listening">Mira đang nghe…</div>}
        {phase === 'suggest_write' && !sending && (
          <div className="sp-write-hint">
            ✍️ Chất liệu đã đủ đầy. Bước <b>Mira viết lại thành bài</b> sẽ mở ở bản cập nhật
            sắp tới — toàn bộ câu chuyện của bạn đã được lưu. Bạn vẫn có thể kể thêm nhé 🌿
          </div>
        )}
      </div>
    </div>
  )
}

// ── TellComposer: ô nhập + nút "Mình đang bí…" (sáng sau 60s im lặng) ──
function TellComposer({ input, setInput, send, sending, msgsLen, onStuck }: {
  input: string; setInput: (v: string) => void; send: (text?: string) => void
  sending: boolean; msgsLen: number; onStuck: () => void
}) {
  const [idleSec, setIdleSec] = useState(0)
  const idleTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset idle timer mỗi khi input thay đổi hoặc gửi tin
  useEffect(() => {
    setIdleSec(0)
    if (idleTimer.current) clearInterval(idleTimer.current)
    idleTimer.current = setInterval(() => setIdleSec(s => s + 1), 1000)
    return () => { if (idleTimer.current) clearInterval(idleTimer.current) }
  }, [input, msgsLen])

  const showStuck = idleSec >= 60 && !sending
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="tc-foot">
      <div className="tc-input-row">
        <textarea
          value={input} disabled={sending} rows={1}
          onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Kể tự nhiên như đang nói chuyện — sai chính tả cũng không sao…"
        />
        <button onClick={() => send()} disabled={sending || !input.trim()}>Gửi</button>
      </div>
      <div className="tc-bottom">
        <div className="tc-note">Câu chuyện tự lưu sau mỗi tin nhắn — nghỉ lúc nào cũng được, quay lại Mira vẫn nhớ.</div>
        <button
          className={`tc-stuck ${showStuck ? 'tc-stuck--show' : ''}`}
          disabled={sending}
          onClick={onStuck}
        >
          Mình đang bí…
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
  const [msgs, setMsgs] = useState<Msg[]>([GREETING])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [phase, setPhase] = useState<Phase>('telling')
  const [resumed, setResumed] = useState(false)

  // Auth
  const [authBusy, setAuthBusy] = useState(false)
  const [authErr, setAuthErr] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null); setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null); setAuthChecked(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Nháp tự lưu: mở lại bài đang kể dở gần nhất (B2b)
  useEffect(() => {
    if (!user) return
    supabase.from('stories')
      .select('id,conversation,status')
      .eq('user_id', user.id).in('status', ['telling', 'collecting_photos'])
      .order('updated_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        const s = data?.[0]
        if (s && Array.isArray(s.conversation) && s.conversation.length > 0) {
          setStoryId(s.id)
          setMsgs([
            GREETING,
            ...(s.conversation as Msg[]),
            { role: 'mira', text: 'Mừng bạn quay lại 🌿 Mình vẫn nhớ câu chuyện đang kể dở — bạn kể tiếp cho mình nghe chứ?' },
          ])
          setResumed(true)
        }
      })
  }, [user])

  const send = useCallback(async (text?: string) => {
    const t = (text ?? input).trim()
    if (!t || sending) return
    setInput('')
    setMsgs(m => [...m, { role: 'user', text: t }])
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('story-ai', {
        body: { action: 'chat', storyId, message: t },
      })
      if (error || !data?.reply) throw error ?? new Error('empty')
      if (data.storyId) setStoryId(data.storyId)
      if (data.phase) setPhase(data.phase as Phase)
      setMsgs(m => [...m, { role: 'mira', text: data.reply }])
    } catch (e) {
      console.error('story-ai chat', e)
      setMsgs(m => [...m, { role: 'mira', text: 'Xin lỗi, mình gặp trục trặc nhỏ 🌿 Bạn gửi lại tin vừa rồi giúp mình nhé — những gì đã kể vẫn được lưu.' }])
    } finally { setSending(false) }
  }, [input, sending, storyId])

  const stuck = useCallback(async () => {
    if (sending) return
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('story-ai', {
        body: { action: 'chat', storyId, message: '', stuck: true },
      })
      if (error || !data?.reply) throw error ?? new Error('empty')
      if (data.storyId) setStoryId(data.storyId)
      if (data.phase) setPhase(data.phase as Phase)
      setMsgs(m => [...m, { role: 'mira', text: data.reply }])
    } catch (e) {
      console.error('story-ai stuck', e)
      setMsgs(m => [...m, { role: 'mira', text: 'Mình đây 🌿 Bạn cứ kể bất cứ điều gì hiện lên trong đầu — không cần theo thứ tự đâu.' }])
    } finally { setSending(false) }
  }, [sending, storyId])

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

  return (
    <div className="tva-tell">
      <style>{CSS}</style>

      {!authChecked ? (
        <div className="center-note">Đang mở cửa…</div>
      ) : !user ? (
        <AuthGate onSubmit={submitAuth} busy={authBusy} err={authErr} />
      ) : (
        <>
          <LivingBookBar />
          <StoryPage msgs={msgs} sending={sending} phase={phase} />
          <TellComposer
            input={input} setInput={setInput} send={send} sending={sending}
            msgsLen={msgs.length} onStuck={stuck}
          />
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
  --line: #E4DED4;
  --line-soft: #EDE8DF;
  --honey: #C9711E;
  --honey-tint: #FBF1E4;
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

/* ── StoryPage ── */
.sp-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
  display: flex;
  justify-content: center;
}
.sp-page {
  max-width: 680px;
  width: 100%;
  padding: 36px 0 24px;
}
.sp-teller {
  margin: 0 0 20px;
  font-size: 17px;
  line-height: 1.75;
  color: var(--ink);
  white-space: pre-wrap;
  word-break: break-word;
}
.sp-mira {
  margin: 0 0 16px;
  padding-left: 14px;
  border-left: 2px solid var(--ink-subtle);
  font-size: 14px;
  font-style: italic;
  color: var(--ink-faint);
  line-height: 1.6;
  white-space: pre-wrap;
}
.sp-listening {
  margin: 0 0 16px;
  padding-left: 14px;
  border-left: 2px solid var(--ink-subtle);
  font-size: 13px;
  font-style: italic;
  color: var(--ink-subtle);
  animation: sp-pulse 2s infinite;
}
@keyframes sp-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
.sp-write-hint {
  margin: 20px 0;
  padding: 14px 16px;
  background: var(--honey-tint);
  border: 1px solid #F0DFC8;
  border-radius: 12px;
  font-size: 14px;
  color: var(--ink-soft);
  line-height: 1.55;
}

/* ── TellComposer ── */
.tc-foot {
  flex: none;
  border-top: 1px solid var(--line);
  background: rgba(254, 252, 247, 0.95);
  padding: 14px 20px calc(14px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
}
.tc-input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  max-width: 680px;
  width: 100%;
}
.tc-input-row textarea {
  flex: 1;
  resize: none;
  padding: 13px 15px;
  background: var(--bg);
  border: 1.5px solid var(--line);
  border-radius: 14px;
  font-size: 15px;
  font-family: inherit;
  outline: none;
  max-height: 120px;
  line-height: 1.45;
}
.tc-input-row textarea:focus { border-color: var(--indigo); }
.tc-input-row button {
  background: var(--indigo);
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 13px 22px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  flex: none;
}
.tc-input-row button:disabled { opacity: 0.5; cursor: default; }
.tc-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 680px;
  width: 100%;
  margin-top: 8px;
  gap: 12px;
}
.tc-note {
  font-size: 11.5px;
  color: var(--ink-subtle);
}
.tc-stuck {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-subtle);
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  padding: 4px 10px;
  border-radius: 8px;
  opacity: 0;
  transition: opacity 0.6s, color 0.6s, background 0.6s;
  white-space: nowrap;
}
.tc-stuck--show {
  opacity: 1;
  color: var(--ink-faint);
}
.tc-stuck--show:hover {
  background: var(--honey-tint);
  color: var(--honey);
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
