// HOẠT ĐỘNG CỦA LỚP — một nguồn duy nhất: RPC social_class_activity (server lọc quyền; gồm bài trả checkpoint
// visibility 'class' của chính lớp). Dùng chung cho "Lớp của tôi" (/me?feed=classes) và Trang Lớp (/me/classes/<id>).
// Dòng GỌN: ai · vừa làm gì · bài nào · trạng thái — bấm mở cuộc trao đổi (/me/t/<id>).
import { useCallback, useMemo } from 'react'
import { isThreadEntry, relativeTime, type FeedEntry } from '../posts/postModel'
import { usePostsFeed } from '../posts/usePostsFeed'
import { storyLine, type ThreadCard } from '../../learning-thread/feedModel'
import { SOCIAL_STATUS_LABEL, STATUS_UI } from '../../learning-thread/ltModel'
import { fetchClassActivityPage } from './classesApi'

export function useClassRecent(classId: string) {
  const fetchPage = useCallback((c?: { createdAt: string; id: string; key: string }) => fetchClassActivityPage(classId, c), [classId])
  return usePostsFeed(fetchPage).state
}

/** Nhãn bài server ghép "Bài trả <id> · <tiêu đề>"; tiêu đề giáo án đã mở bằng "Bài trả <id> —" → bỏ phần lặp khi HIỂN THỊ. */
export function lessonLabel(title: string): string {
  const m = /^Bài trả (\S+) · (Bài trả (\S+)\s*[—–-].*)$/u.exec(title)
  return m && m[1] === m[3] ? m[2] : title
}

export function ActivityLine({ card, now, onOpenThread }: { card: ThreadCard; now: Date; onOpenThread: (id: string) => void }) {
  const story = storyLine(card)
  const who = story?.actor.name ?? card.learner.name
  const what = story?.text ?? 'vừa cập nhật'
  return (
    <li>
      <button type="button" className="cs-act-line" onClick={() => onOpenThread(card.id)}>
        <span className="cs-act-main"><b>{who}</b> {what}</span>
        <span className="cs-act-lesson">{lessonLabel(card.identity.lesson.title)}</span>
        <span className="cs-act-meta">
          <span className={'lt-chip is-' + STATUS_UI[card.status].tone}>{SOCIAL_STATUS_LABEL[card.status]}</span>
          <span>{relativeTime(card.lastEventAt, now)}</span>
        </span>
      </button>
    </li>
  )
}

/** Vài hoạt động mới nhất của lớp (đang tải / lỗi / trống đều có câu ngắn, không phá khung). */
export function ClassRecentList({ classId, limit, onOpenThread, emptyText = 'Chưa có hoạt động mới.' }: {
  classId: string; limit: number; onOpenThread: (id: string) => void; emptyText?: string
}) {
  const state = useClassRecent(classId)
  const now = useMemo(() => new Date(), [])
  if (state.status === 'loading') return <p className="cs-act-note" role="status">Đang tải hoạt động…</p>
  if (state.status === 'error') return <p className="cs-act-note" role="alert">{state.message}</p>
  const items = state.posts.filter((p: FeedEntry) => isThreadEntry(p)).slice(0, limit)
  if (!items.length) return <p className="cs-act-note">{emptyText}</p>
  return (
    <ul className="cs-act-list">
      {items.map(p => isThreadEntry(p) && <ActivityLine key={p.id} card={p.card} now={now} onOpenThread={onOpenThread} />)}
    </ul>
  )
}
