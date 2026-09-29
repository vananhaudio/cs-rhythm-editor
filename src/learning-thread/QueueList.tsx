// Danh sách thread (hàng đợi Thầy / "Trả bài của tôi") — hiển thị THUẦN, không CSS import, test được.
import { relativeTime } from '../class-social/posts/postModel'
import { Avatar } from '../class-social/ui'
import { VISIBILITY_LABEL, eventLabel, identityLine, moduleLabel, type MyThread, type QueueItem } from './ltModel'
import { StatusChip } from './ThreadView'

export function QueueList({ items, onOpen, empty, now }: { items: QueueItem[]; onOpen: (id: string) => void; empty: string; now?: Date }) {
  if (items.length === 0) return <p className="lt-card lt-empty">{empty}</p>
  return (
    <ul className="lt-list" aria-label="Danh sách cuộc trao đổi">
      {items.map(it => (
        <li key={it.id}>
          <button type="button" className="lt-row" onClick={() => onOpen(it.id)} aria-label={`Mở cuộc trao đổi của ${it.learner.name}: ${it.identity.lesson.title}`}>
            <Avatar name={it.learner.name} url={it.learner.avatarUrl} size={40} />
            <span className="lt-row-main">
              <span className="lt-row-title">{it.learner.name} · {identityLine(it.identity)}</span>
              <span className="lt-row-sub">{[it.identity.lesson.title, moduleLabel(it.identity.module.name)].filter(Boolean).join(' · ')}</span>
              {it.lastKind && (
                <span className="lt-row-excerpt">{eventLabel({ kind: it.lastKind, verdict: null }, it.eventCount <= 1)}{it.lastExcerpt ? ': ' + it.lastExcerpt : ''}</span>
              )}
            </span>
            <span className="lt-row-side">
              <StatusChip status={it.status} />
              {it.lastStudentEventAt && <time className="lt-row-time" dateTime={it.lastStudentEventAt}>{relativeTime(it.lastStudentEventAt, now)}</time>}
              {it.visibility === 'private' && <span className="lt-badge">{VISIBILITY_LABEL.private}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function MyThreadList({ items, onOpen, now }: { items: MyThread[]; onOpen: (id: string) => void; now?: Date }) {
  return (
    <ul className="lt-list" aria-label="Trả bài / Hỏi bài của tôi">
      {items.map(it => (
        <li key={it.id}>
          <button type="button" className="lt-row" onClick={() => onOpen(it.id)} aria-label={`Mở: ${it.identity.lesson.title}`}>
            <span className="lt-row-main">
              <span className="lt-row-title">{it.identity.lesson.title}</span>
              <span className="lt-row-sub">{[identityLine(it.identity), moduleLabel(it.identity.module.name)].filter(Boolean).join(' · ')}</span>
              {it.lastEventAt && <span className="lt-row-excerpt">{relativeTime(it.lastEventAt, now)}</span>}
            </span>
            <span className="lt-row-side" style={{ display: 'flex' }}><StatusChip status={it.status} /></span>
          </button>
        </li>
      ))}
    </ul>
  )
}
