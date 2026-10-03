// MỤC LỤC SỐNG của lớp (Class Page V2) — logic THUẦN, không mạng (test được).
// Một bản đồ trả lời cùng lúc: "Tôi đang được học gì?" (buổi, chặng, mở/khoá) và "Tôi thực sự đã nắm được gì?"
// (bài trả của CHÍNH tôi). Nguồn: class_learning_state / giáo trình (useClassLearning) — KHÔNG tạo tiến độ mới,
// không suy từ "đã xem bài". Trạng thái bài trả = trạng thái Learning Thread thật, chỉ đổi cách GỌI tên.
import type { CheckpointThread, ClassLearningState, SessionState } from '../../classLearning/progress'
import { sessionPhase } from '../../classLearning/progress'

type Ready = Extract<ClassLearningState, { enabled: true }>
export type CpTone = 'none' | 'wait' | 'info' | 'warn' | 'ok'
export type CpStatus = { label: string; tone: CpTone; mark: string }

/** Ngôn ngữ thống nhất: Chưa trả · Chờ Thầy · Cần làm lại · Đạt (+ "Thầy đã phản hồi" khi Thầy trả lời mà chưa chấm). */
export function checkpointStatus(t: CheckpointThread | null): CpStatus {
  switch (t?.status) {
    case 'passed': return { label: 'Đạt', tone: 'ok', mark: '✓' }
    case 'needs_retry': return { label: 'Cần làm lại', tone: 'warn', mark: '↻' }
    case 'waiting_teacher': return { label: 'Chờ Thầy', tone: 'wait', mark: '…' }
    case 'teacher_responded': return { label: 'Thầy đã phản hồi', tone: 'info', mark: '…' }
    default: return { label: 'Chưa trả', tone: 'none', mark: '○' }
  }
}

export type SessionView = {
  /** buổi người học chưa được mở: vẫn thấy TÊN, không vào được */
  locked: boolean
  /** "Hoàn thành" · "Chưa mở" · "Đang soạn" · "" — không nhãn vị trí ("Đang học"): vị trí do bản đồ tự nói */
  state: string
  /** "1/3 bài trả Đạt" — null khi buổi không có bài trả hoặc không xem được bài trả */
  submissions: { passed: number; total: number } | null
}

export function sessionView(s: SessionState, st: Pick<Ready, 'role' | 'mode'>): SessionView {
  const phase = sessionPhase(s, st.role, st.mode)
  if (st.role === 'teacher') {
    return { locked: false, state: s.published ? '' : 'Đang soạn', submissions: s.checkpoints.length ? { passed: 0, total: s.checkpoints.length } : null }
  }
  if (st.mode === 'curriculum') return { locked: false, state: s.published ? '' : 'Đang soạn', submissions: null }
  if (phase === 'locked') return { locked: true, state: 'Chưa mở', submissions: null }
  const total = s.checkpoints.length
  const passed = s.checkpoints.filter(c => c.thread?.status === 'passed').length
  // Không nói điều người học tự nhận ra (vị trí "đang học"): chỉ trạng thái thật sự phân biệt — Hoàn thành / Đang soạn.
  const state = phase === 'done' ? 'Hoàn thành' : !s.published ? 'Đang soạn' : ''
  return { locked: false, state, submissions: total ? { passed, total } : null }
}

export const submissionsText = (x: { passed: number; total: number }, teacher = false) =>
  teacher ? `${x.total} bài trả` : `${x.passed}/${x.total} bài trả Đạt`

export type StageGroup = { key: string; no: number | null; title: string | null; sessions: SessionState[] }

/** Gom buổi theo chặng, giữ thứ tự (buổi không có chặng → một nhóm không tiêu đề). */
export function stageGroups(sessions: SessionState[]): StageGroup[] {
  const out: StageGroup[] = []
  for (const s of sessions) {
    const last = out[out.length - 1]
    if (last && last.no === s.stageNo) last.sessions.push(s)
    else out.push({ key: 'stage-' + (s.stageNo ?? 'x') + '-' + s.no, no: s.stageNo, title: s.stageTitle, sessions: [s] })
  }
  return out
}

export const stageLabel = (g: Pick<StageGroup, 'no' | 'title'>) =>
  `${g.no != null ? `Chặng ${g.no}` : 'Giáo trình'}${g.title ? ' · ' + g.title : ''}`

/** "Bài trả 1.2 · Liên thông 3 vùng"; tiêu đề đã mở bằng "Bài trả <id>" thì giữ nguyên. */
export function cpLabel(cp: { id: string; title: string }): string {
  const t = cp.title.trim()
  return /^Bài trả\s/u.test(t) ? t : `Bài trả ${cp.id}${t ? ' · ' + t : ''}`
}
