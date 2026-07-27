// ── /story/tell — Màn trò chuyện kể chuyện cùng Mira ──
// UX: ~/App/1001 câu chuyện/docs/UX-FLOW-KE-CHUYEN.md (B0–B2) · API: docs/api.md
// Hạng mục hiện tại: kể + nháp tự lưu + kể tiếp. Bước ảnh/viết bài mở đợt sau.
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import type { User } from '@supabase/supabase-js'

type Msg = { role: 'user' | 'mira'; text: string; at?: string }
type Phase = 'telling' | 'suggest_photos' | 'suggest_write'

const GREETING: Msg = {
  role: 'mira',
  text: 'Chào bạn, mình là Mira 🌿 Mình đang giúp thầy Văn Anh gom đủ 1001 câu chuyện thật của những người yêu guitar.\n\nBạn không cần biết viết đâu — cứ trò chuyện với mình như một người bạn, phần viết để mình lo. Bạn đã có chuyện muốn kể chưa, hay để mình gợi nhớ giúp?',
}
const CHIPS = ['Mình có chuyện muốn kể', 'Mình chưa biết kể gì', 'Kể chuyện này là sao?']

export default function StoryTellPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [storyId, setStoryId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([GREETING])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [phase, setPhase] = useState<Phase>('telling')
  const [resumed, setResumed] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Đăng nhập / tạo tài khoản (người mới — B0)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [fName, setFName] = useState('')
  const [fEmail, setFEmail] = useState('')
  const [fPass, setFPass] = useState('')
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
          setMsgs([GREETING, ...(s.conversation as Msg[]),
            { role: 'mira', text: 'Mừng bạn quay lại 🌿 Mình vẫn nhớ câu chuyện đang kể dở — bạn kể tiếp cho mình nghe chứ?' }])
          setResumed(true)
        }
      })
  }, [user])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, sending])

  const send = async (text?: string) => {
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
  }

  const submitAuth = async () => {
    setAuthErr('')
    const email = fEmail.trim(), pass = fPass.trim(), name = fName.trim()
    if (!email || !pass || (mode === 'signup' && !name)) { setAuthErr('Bạn điền giúp mình đủ các ô nhé.'); return }
    setAuthBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.functions.invoke('signup-free', { body: { name, email, password: pass } })
        if (error || data?.error) throw new Error(data?.error || 'Không tạo được tài khoản')
      }
      const { error: liErr } = await supabase.auth.signInWithPassword({ email, password: pass })
      if (liErr) throw new Error(mode === 'login' ? 'Email hoặc mật khẩu chưa đúng.' : liErr.message)
    } catch (e) {
      setAuthErr(e instanceof Error ? e.message : 'Có lỗi, bạn thử lại nhé.')
    } finally { setAuthBusy(false) }
  }

  return (
    <div className="tva-tell">
      <style>{CSS}</style>

      <nav>
        <div className="wrap nav-in">
          <a className="brand" href="/story">
            <img className="mark" src="/logo-green.svg" alt="" /> 1001 Câu chuyện cùng Guitar
          </a>
          <div className="status">{storyId ? '🔥 Đang kể — chuyện của bạn đang dày lên từng chút' : 'Trò chuyện cùng Mira'}</div>
        </div>
      </nav>

      {!authChecked ? (
        <div className="center-note">Đang mở cửa…</div>
      ) : !user ? (
        /* B0 — người mới: lời mời ấm của Mira, không phải bức tường đăng ký */
        <div className="gate">
          <div className="gate-card">
            <div className="g-mira">M</div>
            <p className="g-say">
              "Trước khi kể, mình cần một chỗ để <b>giữ câu chuyện của bạn không bị mất</b> —
              kể dở hôm nay, mai kể tiếp, và để mình báo tin khi chuyện được đăng.
              {mode === 'signup' ? ' Tạo tài khoản miễn phí chỉ mất 30 giây nhé 🌿' : ' Bạn đăng nhập giúp mình nhé 🌿'}"
            </p>
            {mode === 'signup' && (
              <input placeholder="Tên của bạn" value={fName} onChange={e => setFName(e.target.value)} />
            )}
            <input placeholder="Email" type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} />
            <input placeholder="Mật khẩu" type="password" value={fPass} onChange={e => setFPass(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitAuth() }} />
            {authErr && <div className="g-err">{authErr}</div>}
            <button className="g-btn" onClick={submitAuth} disabled={authBusy}>
              {authBusy ? 'Chờ mình chút…' : mode === 'signup' ? 'Tạo tài khoản & bắt đầu kể' : 'Đăng nhập & bắt đầu kể'}
            </button>
            <div className="g-switch">
              {mode === 'login'
                ? <>Lần đầu đến đây? <a onClick={() => { setMode('signup'); setAuthErr('') }}>Tạo tài khoản miễn phí</a></>
                : <>Đã có tài khoản học viên? <a onClick={() => { setMode('login'); setAuthErr('') }}>Đăng nhập</a></>}
            </div>
          </div>
        </div>
      ) : (
        /* B1–B2 — trò chuyện */
        <div className="chat">
          <div className="chat-body" ref={bodyRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.role === 'mira' && <div className="av">M</div>}
                <div className="bubble">{m.text}</div>
              </div>
            ))}
            {sending && (
              <div className="msg mira"><div className="av">M</div>
                <div className="bubble typing"><span /><span /><span /></div>
              </div>
            )}
            {phase === 'suggest_write' && !sending && (
              <div className="phase-card">
                ✍️ Chất liệu đã đủ đầy! Bước <b>Mira viết lại thành bài</b> sẽ mở ở bản cập nhật
                sắp tới — toàn bộ câu chuyện của bạn đã được lưu, khi bước viết mở là dùng được ngay.
                Bạn vẫn có thể kể thêm chi tiết bên dưới nhé 🌿
              </div>
            )}
          </div>
          <div className="chat-foot">
            {msgs.length <= 1 && !resumed && (
              <div className="chips">
                {CHIPS.map(c => <button key={c} className="chip" disabled={sending} onClick={() => send(c)}>{c}</button>)}
              </div>
            )}
            <div className="input-row">
              <textarea
                value={input} disabled={sending} rows={1}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Kể tự nhiên như đang trò chuyện — sai chính tả cũng không sao…"
              />
              <button onClick={() => send()} disabled={sending || !input.trim()}>Gửi</button>
            </div>
            <div className="foot-note">Câu chuyện tự lưu sau mỗi tin nhắn — nghỉ lúc nào cũng được, quay lại Mira vẫn nhớ.</div>
          </div>
        </div>
      )}
    </div>
  )
}

const CSS = `
.tva-tell{--bg:#F2EEE7;--surface:#FFFFFF;--ink:#211C32;--ink-soft:#5A5470;--ink-faint:#8A8499;--indigo:#4338CA;--indigo-dark:#352BA3;--indigo-tint:#EEEBFB;--honey:#C9711E;--honey-tint:#FBF1E4;--line:#E4DED4;font-family:'Be Vietnam Pro',system-ui,sans-serif;background:var(--bg);color:var(--ink);height:100dvh;display:flex;flex-direction:column;font-size:16px;line-height:1.55;color-scheme:light;text-align:left;}
.tva-tell *{box-sizing:border-box;}
.tva-tell .wrap{max-width:760px;margin:0 auto;padding:0 16px;width:100%;}
.tva-tell nav{background:rgba(242,238,231,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);flex:none;}
.tva-tell .nav-in{display:flex;align-items:center;justify-content:space-between;height:56px;gap:10px;}
.tva-tell .brand{display:flex;align-items:center;gap:8px;font-weight:800;font-size:14px;color:var(--ink);text-decoration:none;}
.tva-tell .brand .mark{width:28px;height:28px;border-radius:7px;}
.tva-tell .status{font-size:12.5px;color:var(--honey);font-weight:600;text-align:right;}
.tva-tell .center-note{flex:1;display:flex;align-items:center;justify-content:center;color:var(--ink-faint);}
.tva-tell .gate{flex:1;display:flex;align-items:center;justify-content:center;padding:20px;}
.tva-tell .gate-card{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:26px;max-width:400px;width:100%;box-shadow:0 20px 50px -24px rgba(33,28,50,.25);}
.tva-tell .g-mira{width:42px;height:42px;border-radius:999px;background:var(--indigo);color:#fff;font-weight:800;font-size:18px;display:flex;align-items:center;justify-content:center;margin-bottom:12px;}
.tva-tell .g-say{font-size:15px;color:var(--ink-soft);margin:0 0 16px;line-height:1.6;}
.tva-tell .gate-card input{width:100%;padding:11px 13px;background:#FBFAF7;border:1.5px solid var(--line);border-radius:10px;font-size:15px;margin-bottom:10px;font-family:inherit;outline:none;}
.tva-tell .gate-card input:focus{border-color:var(--indigo);}
.tva-tell .g-err{background:#FEE2E2;border:1px solid #FECACA;color:#B91C1C;border-radius:9px;padding:9px 12px;font-size:13.5px;margin-bottom:10px;}
.tva-tell .g-btn{width:100%;background:var(--indigo);color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;}
.tva-tell .g-btn:hover{background:var(--indigo-dark);}
.tva-tell .g-btn:disabled{opacity:.65;}
.tva-tell .g-switch{font-size:13px;color:var(--ink-faint);text-align:center;margin-top:12px;}
.tva-tell .g-switch a{color:var(--indigo);font-weight:600;cursor:pointer;}
.tva-tell .chat{flex:1;display:flex;flex-direction:column;min-height:0;width:100%;max-width:760px;margin:0 auto;}
.tva-tell .chat-body{flex:1;overflow-y:auto;padding:20px 16px;display:flex;flex-direction:column;gap:14px;}
.tva-tell .msg{display:flex;gap:10px;align-items:flex-end;}
.tva-tell .msg.user{justify-content:flex-end;}
.tva-tell .av{width:30px;height:30px;border-radius:999px;background:var(--indigo);color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex:none;}
.tva-tell .bubble{max-width:78%;padding:11px 15px;border-radius:16px;font-size:15px;white-space:pre-wrap;word-break:break-word;}
.tva-tell .msg.mira .bubble{background:var(--surface);border:1px solid var(--line);border-bottom-left-radius:6px;color:var(--ink);}
.tva-tell .msg.user .bubble{background:var(--indigo);color:#fff;border-bottom-right-radius:6px;}
.tva-tell .typing{display:flex;gap:5px;align-items:center;padding:15px;}
.tva-tell .typing span{width:7px;height:7px;border-radius:999px;background:var(--ink-faint);animation:tvat-b 1.2s infinite;}
.tva-tell .typing span:nth-child(2){animation-delay:.2s}
.tva-tell .typing span:nth-child(3){animation-delay:.4s}
@keyframes tvat-b{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
.tva-tell .phase-card{background:var(--honey-tint);border:1px solid #F0DFC8;border-radius:14px;padding:14px 16px;font-size:14px;color:var(--ink-soft);line-height:1.55;}
.tva-tell .chat-foot{flex:none;border-top:1px solid var(--line);background:rgba(242,238,231,.95);padding:10px 16px calc(12px + env(safe-area-inset-bottom));}
.tva-tell .chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
.tva-tell .chip{background:var(--surface);border:1.5px solid #D3CEE8;border-radius:999px;padding:8px 15px;font-size:13.5px;font-weight:600;color:var(--indigo);cursor:pointer;font-family:inherit;}
.tva-tell .chip:hover{background:var(--indigo-tint);}
.tva-tell .input-row{display:flex;gap:8px;align-items:flex-end;}
.tva-tell .input-row textarea{flex:1;resize:none;padding:12px 14px;background:var(--surface);border:1.5px solid var(--line);border-radius:14px;font-size:15px;font-family:inherit;outline:none;max-height:120px;line-height:1.45;}
.tva-tell .input-row textarea:focus{border-color:var(--indigo);}
.tva-tell .input-row button{background:var(--indigo);color:#fff;border:none;border-radius:12px;padding:12px 20px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;flex:none;}
.tva-tell .input-row button:disabled{opacity:.5;cursor:default;}
.tva-tell .foot-note{font-size:11.5px;color:var(--ink-faint);margin-top:7px;text-align:center;}
`
