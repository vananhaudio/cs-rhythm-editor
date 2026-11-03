// Thẻ "Đề bài" trong màn chấm (Thầy): tiêu đề + yêu cầu của bài trả, đặt giữa phần đầu và dòng thời gian (gần bài nộp).
// Chỉ ĐỌC giáo trình của chính buổi/lớp ghi trên thread; lỗi/thiếu → báo gọn, không chặn việc chấm.
// Cùng quy tắc với Mira (mira_grading_context): CHỈ bản đã xuất bản (status='published') là đề chính thức. Bản nháp KHÔNG được
// hiện như đề — chỉ báo "chưa xuất bản" — để Thầy và Mira không nhìn hai đề khác nhau.
import { useEffect, useState } from 'react'
import { promptStateOf, type PromptState, type SessionBlocks } from './checkpointPrompt'

export function CheckpointPromptView({ state }: { state: PromptState }) {
  if (state.status === 'loading') return <section className="lt-card lt-prompt" aria-busy="true"><p className="lt-note">Đang tải đề bài…</p></section>
  if (state.status === 'missing') return <section className="lt-card lt-prompt"><p className="lt-note">Chưa tải được đề bài — mở giáo trình để xem.</p></section>
  if (state.status === 'unpublished') return <section className="lt-card lt-prompt"><p className="lt-note">Giáo trình buổi này chưa xuất bản nên chưa có đề chính thức (Mira cũng chưa thấy đề). Mở giáo trình để xem bản nháp.</p></section>
  const { cp } = state
  return (
    <details className="lt-card lt-prompt" open>
      <summary className="lt-prompt-sum"><span className="lt-prompt-kicker">Đề bài · {cp.id}</span><span className="lt-prompt-title">{cp.title}</span></summary>
      {cp.prompt ? <p className="lt-prompt-body">{cp.prompt}</p> : <p className="lt-note">Bài trả này chưa có phần yêu cầu cụ thể.</p>}
    </details>
  )
}

async function loadContent(classId: string, sessionNo: number): Promise<SessionBlocks | null> {
  const db = (await import('../supabase')).supabase
  const s = await db.from('class_sessions').select('id').eq('class_id', classId).eq('session_number', sessionNo).eq('event_type', 'lesson').limit(1).maybeSingle()
  if (s.error || !s.data) return null
  const { fetchSessionContent } = await import('../classLearning/api')
  return await fetchSessionContent(db, (s.data as { id: string }).id)
}

export default function CheckpointPromptCard({ classId, sessionNo, checkpointId, load = loadContent }: {
  classId: string; sessionNo: number; checkpointId: string
  load?: (classId: string, sessionNo: number) => Promise<SessionBlocks | null>
}) {
  const [res, setRes] = useState<{ key: string; state: PromptState } | null>(null)
  const key = `${classId}|${sessionNo}|${checkpointId}`
  useEffect(() => {
    let alive = true
    load(classId, sessionNo)
      .then(c => { if (alive) setRes({ key, state: promptStateOf(c, checkpointId) }) })
      .catch(() => { if (alive) setRes({ key, state: { status: 'missing' } }) })
    return () => { alive = false }
  }, [classId, sessionNo, checkpointId, key, load])
  return <CheckpointPromptView state={res && res.key === key ? res.state : { status: 'loading' }} />
}
