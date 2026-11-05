// Khung "Hỏi Mira" trong Trò chuyện (V1.3: mở là trò chuyện được — không cổng đồng ý; thông tin AI gọn ở MiraInfo). Tái dùng ChatHeader/Composer và CSS tin nhắn hiện có; KHÔNG phải hội thoại dm_* (không lưu, không tài khoản Mira).
import { useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import ChatHeader from './ChatHeader'
import MiraAvatar from './MiraAvatar'
import Composer from './Composer'
import { MIRA_NAME, type MiraAction } from './miraApi'
import MiraInfo from './MiraInfo'
import MiraGreeting from './MiraGreeting'
import { useMiraChat } from './useMiraChat'
import { useMiraConsent } from './useMiraConsent'

export default function MiraChatView({ onBack, onOpenClass }: { onBack: () => void; onOpenClass: (classId: string) => void }) {
  const consent = useMiraConsent()
  const chat = useMiraChat({ onConsentRequired: consent.refresh })
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight }, [chat.messages.length, chat.busy])
  const open = (a: MiraAction) => { const id = /^\/me\/classes\/([0-9a-f-]{36})$/i.exec(a.path)?.[1]; if (id) onOpenClass(id.toLowerCase()) }
  const header = (menu?: React.ReactNode) => <ChatHeader name={MIRA_NAME} avatarUrl={null} avatar={<MiraAvatar size={40} />} onBack={onBack} tag="Trợ lý AI của Thầy Văn Anh" menu={menu} />

  const menu = chat.messages.length > 0 ? (
    <button type="button" className="cs-icon-btn" onClick={chat.clear} aria-label="Xoá cuộc trò chuyện này khỏi màn hình" title="Xoá khỏi màn hình">
      <Trash2 size={18} aria-hidden="true" />
    </button>) : undefined
  return (
    <>
      {header(menu)}
      <MiraInfo consent={consent.view} busy={consent.busy} error={consent.actionError} onGrant={() => void consent.grant()} onWithdraw={consent.withdraw} />
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
