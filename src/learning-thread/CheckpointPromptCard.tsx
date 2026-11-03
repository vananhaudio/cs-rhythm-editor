// Thẻ "Đề bài" trong màn chấm (Thầy): tiêu đề + yêu cầu của bài trả, đặt giữa phần đầu và dòng thời gian (gần bài nộp).
// Chỉ ĐỌC giáo trình của chính buổi/lớp ghi trên thread; lỗi/thiếu → báo gọn, không chặn việc chấm.
import { useEffect, useState } from 'react'
import { pickCheckpointPrompt, type CheckpointPrompt } from './checkpointPrompt'
import type { LessonSection } from '../lesson/lessonTypes'

export type PromptState = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; cp: CheckpointPrompt }

export function CheckpointPromptView({ state }: { state: PromptState }) {
  if (state.status === 'loading') return <section className="lt-card lt-prompt" aria-busy="true"><p className="lt-note">Đang tải đề bài…</p></section>
  if (state.status === 'missing') return <section className="lt-card lt-prompt"><p className="lt-note">Chưa tải được đề bài — mở giáo trình để xem.</p></section>
  const { cp } = state
  return (
    <details className="lt-card lt-prompt" open>
      <summary className="lt-prompt-sum"><span className="lt-prompt-kicker">Đề bài · {cp.id}</span><span className="lt-prompt-title">{cp.title}</span></summary>
      {cp.prompt ? <p className="lt-prompt-body">{cp.prompt}</p> : <p className="lt-note">Bài trả này chưa có phần yêu cầu cụ thể.</p>}
    </details>
  )
}

async function loadSections(classId: string, sessionNo: number): Promise<LessonSection[] | null> {
  const db = (await import('../supabase')).supabase
  const s = await db.from('class_sessions').select('id').eq('class_id', classId).eq('session_number', sessionNo).eq('event_type', 'lesson').limit(1).maybeSingle()
  if (s.error || !s.data) return null
  const { fetchSessionContent } = await import('../classLearning/api')
  return (await fetchSessionContent(db, (s.data as { id: string }).id))?.sections ?? null
}

export default function CheckpointPromptCard({ classId, sessionNo, checkpointId, load = loadSections }: {
  classId: string; sessionNo: number; checkpointId: string
  load?: (classId: string, sessionNo: number) => Promise<LessonSection[] | null>
}) {
  const [res, setRes] = useState<{ key: string; state: PromptState } | null>(null)
  const key = `${classId}|${sessionNo}|${checkpointId}`
  useEffect(() => {
    let alive = true
    load(classId, sessionNo)
      .then(sec => { if (alive) { const cp = sec ? pickCheckpointPrompt(sec, checkpointId) : null; setRes({ key, state: cp ? { status: 'ready', cp } : { status: 'missing' } }) } })
      .catch(() => { if (alive) setRes({ key, state: { status: 'missing' } }) })
    return () => { alive = false }
  }, [classId, sessionNo, checkpointId, key, load])
  return <CheckpointPromptView state={res && res.key === key ? res.state : { status: 'loading' }} />
}
