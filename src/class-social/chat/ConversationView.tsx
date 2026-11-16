// Một hội thoại có sẵn: header · dòng tin · ô soạn (hoặc ghi chú khi không còn gửi được — DB quyết qua can_send).
import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw, X } from 'lucide-react'
import { Avatar } from '../ui'
import ClassLogo from '../classes/ClassLogo'
import { useClassDisplay } from '../classes/useClassDisplay'
import { fetchBandMembers, fetchClassMembers } from './chatApi'
import { classIdOf, type BandGroupRole, type BandMember } from './chatModel'
import { bandHomeHref } from '../mybands/myBandsModel'
import ChatHeader from './ChatHeader'
import Composer from './Composer'
import MessageList from './MessageList'
import { useConversation } from './useChat'
import SafetyMenu from '../../class-safety/SafetyMenu'

export type Peer = {
  id: string; name: string; avatarUrl: string | null; isTeacher: boolean
  /** Nhóm Band: tên/ảnh là của Band; số thành viên cho dòng phụ ở header */
  kind?: 'dm' | 'band' | 'class'; memberCount?: number
  readOnly?: 'archived' | 'support' | null
  /** Nhóm Band: Team chứa Band — đường dẫn "Quản lý tại TeamLab" */
  projectId?: string | null
}

export default function ConversationView({ id, peer, canSend, onBack, onOpenProfile, onActivity }: {
  id: string
  /** null = chưa biết (danh sách chưa tải xong) → header hiện khung chờ */
  peer: Peer | null
  /** undefined = chưa biết → cho gõ, server là người quyết */
  canSend: boolean | undefined
  onBack: () => void
  onOpenProfile: (userId: string) => void
  onActivity: () => void
}) {
  const c = useConversation(id, onActivity)
  const isClass = peer?.kind === 'class'
  const isBand = peer?.kind === 'band' || isClass   // nhóm nhiều người (Band hoặc lớp): cùng khung header/thành viên/ghi chú chỉ-đọc
  const [showMembers, setShowMembers] = useState(false)
  const classDisplay = useClassDisplay().get(isClass ? classIdOf(id) : '')

  return (
    <>
      <ChatHeader name={peer?.name ?? null} avatarUrl={peer?.avatarUrl ?? null} isTeacher={isBand ? false : peer?.isTeacher}
        avatar={isClass ? <ClassLogo url={classDisplay?.logo ?? null} courseCode={classDisplay?.code} name={peer?.name} size={40} /> : undefined}
        onBack={onBack}
        onOpenProfile={peer ? (isBand ? () => setShowMembers(v => !v) : () => onOpenProfile(peer.id)) : undefined}
        tag={isClass ? `${classDisplay?.schedule ? classDisplay.schedule + ' · ' : ''}Lớp học${peer?.readOnly === 'archived' ? ' · Chỉ đọc' : peer?.readOnly === 'support' ? ' · Chế độ hỗ trợ' : ''}${peer?.memberCount ? ` · ${peer.memberCount} thành viên` : ''}` : isBand ? `Nhóm Band${peer?.readOnly === 'archived' ? ' · Lưu trữ' : peer?.readOnly === 'support' ? ' · Chế độ hỗ trợ' : ''}${peer?.memberCount ? ` · ${peer.memberCount} thành viên` : ''}` : undefined}
        actionLabel={isBand && peer ? `Thành viên nhóm ${peer.name}` : undefined}
        menu={!isBand && peer ? <SafetyMenu label={`Tuỳ chọn về ${peer.name}`} kind="profile" targetId={peer.id} userId={peer.id} userName={peer.name} /> : undefined} />
      {isBand && showMembers && <BandMembers id={id} isClass={isClass} projectId={peer?.projectId ?? null} onClose={() => setShowMembers(false)} onOpenProfile={onOpenProfile} />}

      {c.status === 'loading' && <div className="cs-chat-body-state"><div className="cs-spinner" role="status" aria-label="Đang tải" /></div>}
      {c.status === 'notfound' && (
        <div className="cs-chat-body-state" role="alert">
          <p>Không tìm thấy cuộc trò chuyện này.</p>
          <button type="button" className="cs-btn cs-btn-soft" onClick={onBack}>Về danh sách</button>
        </div>
      )}
      {c.status === 'error' && (
        <div className="cs-chat-body-state" role="alert">
          <p>{c.error}</p>
          <button type="button" className="cs-btn cs-btn-soft" onClick={c.reload}><RefreshCw size={16} aria-hidden="true" />Thử lại</button>
        </div>
      )}

      {c.status === 'ready' && (
        <>
          <MessageList conversationId={id} messages={c.messages} pending={c.pending} hasMore={c.hasMore} loadingOlder={c.loadingOlder}
            onLoadOlder={() => void c.loadOlder()} onRetry={c.retry} onDiscard={c.discard} />
          {c.error && c.pending.every(p => p.state !== 'failed') && <p className="cs-form-error cs-chat-error" role="alert">{c.error}</p>}
          {canSend === false
            ? (
              <div className="cs-chat-locked" role="status">
                {isBand
                  ? <p>{peer?.readOnly === 'support'
                      ? 'Bạn đang xem nhóm này với tư cách Thầy/Admin để hỗ trợ — chỉ đọc, không gửi tin vào nhóm.'
                      : isClass ? 'Lớp này đã kết thúc, gộp hoặc chưa mở nên phòng chỉ đọc. Lịch sử trò chuyện vẫn được giữ.'
                      : 'Band đã được lưu trữ nên nhóm chỉ đọc. Lịch sử trò chuyện vẫn được giữ.'}</p>
                  : <p>Bạn chưa thể gửi tin mới cho {peer?.name ?? 'người này'}. Lịch sử trò chuyện vẫn được giữ.</p>}
                {peer && !isBand && <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" onClick={() => onOpenProfile(peer.id)}>Xem trang cá nhân</button>}
              </div>
            )
            : <Composer onSend={body => { c.send(body); return true }} autoFocus />}
        </>
      )}
    </>
  )
}

/** Danh sách thành viên hiện hành của nhóm Band (server trả theo quyền thành viên). Bấm một người → trang cá nhân. */
const GROUP_ROLE_LABEL: Record<BandGroupRole, string> = { owner: 'Chủ nhóm', admin: 'Quản trị viên', member: 'Thành viên' }

function BandMembers({ id, isClass, projectId, onClose, onOpenProfile }: { id: string; isClass: boolean; projectId: string | null; onClose: () => void; onOpenProfile: (userId: string) => void }) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: BandMember[] }>({ status: 'loading' })
  const [rev, setRev] = useState(0)
  useEffect(() => {
    let alive = true
    void (isClass ? fetchClassMembers(id) : fetchBandMembers(id)).then(r => { if (alive) setState(r.ok ? { status: 'ready', items: r.value } : { status: 'error', message: r.message }) })
    return () => { alive = false }
  }, [id, rev])
  return (
    <section className="cs-chat-members" aria-label="Thành viên nhóm">
      {isClass
        ? <p className="cs-chat-members-note">Thành viên lấy từ danh sách lớp hiện hành: học viên và Thầy phụ trách. Thầy/Admin ngoài lớp chỉ xem để hỗ trợ, không gửi tin thay thành viên.</p>
        : <>
            <p className="cs-chat-members-note">Thành viên và vai trò của nhóm lấy từ Band trên TeamLab: Trưởng Band là Chủ nhóm, Phó Band là Quản trị viên.</p>
            <p className="cs-chat-members-note">Thầy/Admin có thể xem nhóm Band để hỗ trợ và quản lý. Họ chỉ xem, không gửi tin thay thành viên.</p>
          </>}
      {!isClass && projectId && (
        <a className="cs-link-btn cs-chat-manage-link" href={bandHomeHref(projectId)} data-testid="band-manage-link">
          Quản lý tại TeamLab <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
      <div className="cs-chat-members-head">
        <span>Thành viên</span>
        <button type="button" className="cs-icon-btn" onClick={onClose} aria-label="Đóng danh sách thành viên"><X size={18} aria-hidden="true" /></button>
      </div>
      {state.status === 'loading' && <div className="cs-skeleton" style={{ height: 48 }} aria-label="Đang tải" />}
      {state.status === 'error' && (
        <p role="alert">{state.message} <button type="button" className="cs-link-btn" onClick={() => { setState({ status: 'loading' }); setRev(x => x + 1) }}>Thử lại</button></p>
      )}
      {!isClass && state.status === 'ready' && state.items.length > 0 && state.items.every(m => m.groupRole !== null) && !state.items.some(m => m.groupRole === 'owner') && (
        <p className="cs-chat-members-note" data-testid="band-no-owner">Band này chưa có Trưởng Band. Việc bổ nhiệm được thực hiện tại TeamLab.</p>
      )}
      {state.status === 'ready' && state.items.map(m => (
        <button key={m.id} type="button" className="cs-chat-member" onClick={() => onOpenProfile(m.id)}>
          <Avatar name={m.name} url={m.avatarUrl} size={36} />
          <span className="cs-chat-member-name">{m.name}{m.isTeacher && <span className="cs-post-role"> · Giáo viên</span>}</span>
          {(m.groupRole === 'owner' || m.groupRole === 'admin') && <span className={`cs-chat-role cs-chat-role-${m.groupRole}`} data-testid={`band-role-${m.groupRole}`}>{GROUP_ROLE_LABEL[m.groupRole]}</span>}
        </button>
      ))}
    </section>
  )
}
