// Hiển thị MỘT learning thread — renderer DÙNG CHUNG cho App học (sheet) và Social (/me/t/<id>).
// Đầu: người học + danh tính học tập LỊCH SỬ (đóng dấu lúc mở thread, không theo hồ sơ hiện tại).
// Thân: dòng thời gian mọi lượt Trả bài / Hỏi bài / Thầy phản hồi theo đúng thứ tự.
// Nội dung là plain text (React escape); video chỉ qua ExternalMediaView (tự dựng embed từ ID đã kiểm).
// CSS nạp ở container (./styles) — file này không import CSS để test render được bằng Node.
import ExternalMediaView from '../class-social/media/ExternalMediaView'
import { parseExternalMedia } from '../class-social/media/parseExternalMedia'
import ResourceCard from '../class-social/sections/comments/ResourceCard'
import { relativeTime } from '../class-social/posts/postModel'
import { Avatar, PersonLink } from '../class-social/ui'
import { IdentityBadges } from '../class-social/identity/IdentityBadges'
import {
  SOCIAL_STATUS_LABEL, STATUS_UI, VISIBILITY_LABEL, eventLabels, identityLine, moduleLabel,
  type ThreadDetail, type ThreadEvent, type ThreadStatus,
} from './ltModel'

/** social = nhãn cho người XEM trên Feed/Tường/Hành trình ("Chờ Thầy phản hồi", không "Đã gửi"). */
export function StatusChip({ status, social = false }: { status: ThreadStatus; social?: boolean }) {
  const s = STATUS_UI[status]
  return <span className={'lt-chip is-' + s.tone}>{social ? SOCIAL_STATUS_LABEL[status] : s.label}</span>
}

function fullTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric', year: 'numeric' })
}

// Đầu thread: NGƯỜI HỌC → BÀI (chính) → chương (phụ) → danh tính lớp/khoá lúc bắt đầu (nhỏ) → trạng thái.
export function ThreadHeader({ thread, onOpenProfile, showIdentity = false }: { thread: ThreadDetail; onOpenProfile?: (userId: string) => void; showIdentity?: boolean }) {
  const id = thread.identity
  const module = moduleLabel(id.module.name)
  const identity = identityLine(id)
  const context = [identity, id.course.name && !identity.includes(id.course.name) ? id.course.name : null].filter(Boolean).join(' · ')
  const learner = thread.learner
  return (
    <div className="lt-head">
      {learner.userId ? (
        <PersonLink userId={learner.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${learner.name}`}>
          <Avatar name={learner.name} url={learner.avatarUrl} size={48} />
        </PersonLink>
      ) : <Avatar name={learner.name} url={learner.avatarUrl} size={48} />}
      <div className="lt-head-main">
        {learner.userId && onOpenProfile
          ? <PersonLink userId={learner.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${learner.name}`} className="lt-head-name">{learner.name}</PersonLink>
          : <span className="lt-head-name">{learner.name}</span>}
        {showIdentity && <IdentityBadges userId={learner.userId} />}
        <span className="lt-head-lesson">{id.lesson.title}</span>
        {module && <span className="lt-head-module">{module}</span>}
        <span className="lt-head-identity" title="Lớp / khoá lúc bắt đầu cuộc trao đổi">{context}</span>
        <div className="lt-head-meta">
          {/* Chính chủ thấy "Đã gửi · …" như trong App; người khác (Thầy, bạn) thấy nhãn của người xem */}
          <StatusChip status={thread.status} social={!thread.isMine} />
          <span className="lt-badge">{VISIBILITY_LABEL[thread.visibility]}</span>
          {thread.isHidden && <span className="lt-badge">Đang ẩn</span>}
        </div>
      </div>
    </div>
  )
}

function EventItem({ e, label, now, canModerate, onModerate, onOpenProfile }: {
  e: ThreadEvent
  label: string
  now?: Date
  canModerate: boolean
  onModerate?: (e: ThreadEvent, hidden: boolean) => void
  onOpenProfile?: (userId: string) => void
}) {
  const teacher = e.authorRole === 'teacher'
  const parsed = e.mediaUrl ? parseExternalMedia(e.mediaUrl) : null
  const cls = 'lt-ev' + (teacher ? ' is-teacher' : '') + (e.verdict ? ' is-' + e.verdict : '') + (e.isHidden ? ' is-hidden' : '')
  const avatar = <Avatar name={e.author.name} url={e.author.avatarUrl} size={32} />
  return (
    <li className={cls}>
      {e.author.userId
        ? <PersonLink userId={e.author.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${e.author.name}`}>{avatar}</PersonLink>
        : avatar}
      <div className="lt-ev-main">
        <div className="lt-ev-bubble">
          <div className="lt-ev-head">
            <span className="lt-ev-author">{e.author.name}</span>
            {teacher && <span className="lt-ev-role">Thầy</span>}
            {/* Bong bóng Thầy đã có nhãn "Thầy" → "nhận xét · Đạt" (không lặp "Thầy … Thầy nhận xét") */}
            <span className="lt-ev-kind">· {teacher ? label.replace(/^Thầy /, '') : label}</span>
            {e.createdAt && <time className="lt-ev-time" dateTime={e.createdAt} title={fullTime(e.createdAt)}>{relativeTime(e.createdAt, now)}</time>}
          </div>
          {e.body && <p className="lt-ev-body">{e.body}</p>}
          {parsed?.ok && <ExternalMediaView media={parsed.media} title={`Video · ${label} · ${e.author.name}`} />}
          {e.tags.length > 0 && (
            <ul className="cs-tags" aria-label="Thẻ kiến thức">{e.tags.map(t => <li key={t.id} className="cs-tag">#{t.name}</li>)}</ul>
          )}
          {e.resources.length > 0 && (
            <div className="cs-res-list">
              {e.resources.map((r, i) => <ResourceCard key={r.resourceId + i} res={{ ...r }} />)}
            </div>
          )}
          {e.isHidden && <span className="lt-note">Đã ẩn · chỉ Thầy thấy</span>}
        </div>
        {canModerate && onModerate && (
          <div className="lt-ev-tools">
            <button type="button" className="lt-link-btn" onClick={() => onModerate(e, !e.isHidden)}>{e.isHidden ? 'Bỏ ẩn' : 'Ẩn lượt này'}</button>
          </div>
        )}
      </div>
    </li>
  )
}

export function ThreadTimeline({ thread, now, canModerate = false, onModerate, onOpenProfile }: {
  thread: ThreadDetail
  now?: Date
  canModerate?: boolean
  onModerate?: (e: ThreadEvent, hidden: boolean) => void
  onOpenProfile?: (userId: string) => void
}) {
  const labels = eventLabels(thread.events)
  if (thread.events.length === 0) return <p className="lt-empty">Chưa có lượt trao đổi nào.</p>
  return (
    <ol className="lt-timeline" aria-label="Dòng thời gian trao đổi">
      {thread.events.map((e, i) => (
        <EventItem key={e.id} e={e} label={labels[i]} now={now} canModerate={canModerate} onModerate={onModerate} onOpenProfile={onOpenProfile} />
      ))}
    </ol>
  )
}

export default function ThreadView(props: {
  thread: ThreadDetail
  now?: Date
  canModerate?: boolean
  onModerate?: (e: ThreadEvent, hidden: boolean) => void
  onOpenProfile?: (userId: string) => void
  /** Social (/me/t/<id>): nhãn danh tính HIỆN TẠI của người học cạnh tên — tách khỏi danh tính lịch sử của bài */
  showIdentity?: boolean
}) {
  return (
    <div className="lt-page">
      <section className="lt-card"><ThreadHeader thread={props.thread} onOpenProfile={props.onOpenProfile} showIdentity={props.showIdentity} /></section>
      <section className="lt-card"><ThreadTimeline {...props} /></section>
    </div>
  )
}
