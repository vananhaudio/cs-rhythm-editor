// Khung "Hỏi Mira" trong Trò chuyện. Tái dùng ChatHeader/Composer và CSS tin nhắn hiện có; KHÔNG phải hội thoại dm_* (không lưu, không tài khoản Mira).
import { useEffect, useRef, useState } from 'react'
import { ShieldOff, Trash2 } from 'lucide-react'
import ChatHeader from './ChatHeader'
import MiraAvatar from './MiraAvatar'
import Composer from './Composer'
import { MIRA_NAME, type MiraAction } from './miraApi'
import MiraConsentGate from './MiraConsentGate'
import MiraGreeting from './MiraGreeting'
import { useMiraChat } from './useMiraChat'
import { useMiraConsent } from './useMiraConsent'

export default function MiraChatView({ onBack, onOpenClass }: { onBack: () => void; onOpenClass: (classId: string) => void }) {
  const consent = useMiraConsent()
  const chat = useMiraChat({ onConsentRequired: consent.refresh })
  const [confirming, setConfirming] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight }, [chat.messages.length, chat.busy])
  const open = (a: MiraAction) => { const id = /^\/me\/classes\/([0-9a-f-]{36})$/i.exec(a.path)?.[1]; if (id) onOpenClass(id.toLowerCase()) }
  const header = (menu?: React.ReactNode) => <ChatHeader name={MIRA_NAME} avatarUrl={null} avatar={<MiraAvatar size={40} />} onBack={onBack} tag="Trợ lý AI học tập · không lưu cuộc trò chuyện" menu={menu} />

  // Chưa biết / lỗi / chưa đồng ý ⇒ KHÔNG hiện khung chat và không có ô soạn: không thể gửi gì tới Mira
  if (consent.view.status === 'loading') return <>{header()}<div className="cs-chat-scroll-wrap"><div className="cs-chat-scroll"><p role="status" style={{ padding: 16 }}>Đang kiểm tra…</p></div></div></>
  if (consent.view.status === 'error') return (
    <>{header()}<div className="cs-chat-scroll-wrap"><div className="cs-chat-scroll"><div style={{ padding: 16, display: 'grid', gap: 8 }}>
      <p role="alert" style={{ margin: 0 }}>Chưa kiểm tra được trạng thái tham gia Mira. Kiểm tra mạng rồi thử lại nhé.</p>
      <div><button type="button" className="cs-btn cs-btn-soft" onClick={() => void consent.refresh()}>Thử lại</button></div></div></div></div></>)
  const c = consent.view.consent
  if (c.state === 'unavailable') return <>{header()}<div className="cs-chat-scroll-wrap"><div className="cs-chat-scroll"><p role="status" style={{ padding: 16 }}>Mira chưa sẵn sàng cho tài khoản của bạn.</p></div></div></>
  if (c.state !== 'granted') return <>{header()}<MiraConsentGate consent={c} busy={consent.busy} error={consent.actionError} onGrant={() => void consent.grant()} onDecline={onBack} /></>

  const menu = (
    <>
      {chat.messages.length > 0 && (
        <button type="button" className="cs-icon-btn" onClick={chat.clear} aria-label="Xoá cuộc trò chuyện này khỏi màn hình" title="Xoá khỏi màn hình">
          <Trash2 size={18} aria-hidden="true" />
        </button>)}
      <button type="button" className="cs-icon-btn" onClick={() => setConfirming(true)} aria-label="Rút lại đồng ý tham gia Mira" title="Rút lại đồng ý" data-testid="mira-withdraw">
        <ShieldOff size={18} aria-hidden="true" />
      </button>
    </>)
  return (
    <>
      {header(menu)}
      {confirming && (
        <div role="alertdialog" aria-label="Rút lại đồng ý" data-testid="mira-withdraw-confirm" style={{ padding: '10px 16px', display: 'grid', gap: 8 }}>
          <p style={{ margin: 0 }}>Rút lại đồng ý? Mira sẽ ngừng đọc dữ liệu của bạn ngay. Nội dung đã gửi trước đó do nhà cung cấp AI xóa theo thời hạn của họ.</p>
          {consent.actionError && <p role="alert" style={{ margin: 0 }}>{consent.actionError}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="cs-btn" disabled={consent.busy} data-testid="mira-withdraw-yes"
              onClick={async () => { if (await consent.withdraw()) { setConfirming(false); chat.clear() } }}>Rút lại đồng ý</button>
            <button type="button" className="cs-btn cs-btn-soft" disabled={consent.busy} onClick={() => setConfirming(false)}>Giữ nguyên</button>
          </div>
        </div>)}
      <div className="cs-chat-scroll-wrap">
        <div ref={box} className="cs-chat-scroll" role="log" aria-live="polite" aria-label="Trò chuyện với Mira">
          <MiraGreeting />
          {chat.messages.map(m => (
            <div key={m.id}>
              <div className={'cs-msg-row ' + (m.role === 'user' ? 'is-mine' : 'is-theirs')}>
                <div className={'cs-msg-bubble' + (m.kind === 'error' ? ' is-failed' : '')} style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
              </div>
              {m.actions && m.actions.length > 0 && (
                <div className="cs-msg-row is-theirs is-cont" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {m.actions.map(a => <button key={a.path} type="button" className="cs-btn cs-btn-soft cs-btn-sm" onClick={() => open(a)}>{a.label}</button>)}
                </div>
              )}
            </div>
          ))}
          {chat.busy && <div className="cs-msg-row is-theirs"><div className="cs-msg-bubble is-pending" role="status">Mira đang soạn…</div></div>}
        </div>
      </div>
      <Composer onSend={chat.send} placeholder="Hỏi Mira về bài học, luyện tập…" label="Tin nhắn gửi Mira" />
    </>
  )
}
