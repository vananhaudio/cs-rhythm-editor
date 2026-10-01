// ── Lớp của tôi V1 — trạng thái học theo BUỔI (logic THUẦN, không mạng — test được) ──
// Nguồn sự thật = RPC class_learning_state (server mở/khoá buổi, đọc checkpoint canonical, thread của chính mình).
// File này chỉ dịch kết quả server sang giao diện: buổi hiện tại, nhãn khoá, màu nhịp tuần, nút tại checkpoint.
// KHÔNG suy luận quyền ở client. Màu tuần suy từ opened_at / completed_at (DB không lưu màu).
import type { ThreadStatus, Visibility } from '../learning-thread/ltModel'
import { toVisibility } from '../learning-thread/ltModel'
import { lessonTitle } from './outline'

export type CheckpointThread = { id: string; status: ThreadStatus; visibility: Visibility; passedAt: string | null; lastEventAt: string | null }
export type CheckpointState = { id: string; title: string; required: boolean; accepts: string[]; thread: CheckpointThread | null }
export type SessionState = {
  sessionId: string
  no: number
  title: string            // đã bỏ tiền tố "Buổi N ·"
  stageNo: number | null
  stageTitle: string | null
  published: boolean
  openedAt: string | null
  completedAt: string | null
  checkpoints: CheckpointState[]
}
export type ClassLearningState =
  | { enabled: false; classId: string }
  | {
      enabled: true
      classId: string
      role: 'learner' | 'teacher'
      programCode: string
      classCode: string | null
      className: string
      serverNow: string | null
      paceDays: number
      sessions: SessionState[]
    }

type J = Record<string, unknown>
const obj = (v: unknown): J => (v && typeof v === 'object' && !Array.isArray(v) ? v as J : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const STATUSES: ThreadStatus[] = ['waiting_teacher', 'teacher_responded', 'needs_retry', 'passed', 'archived']

function toThread(v: unknown): CheckpointThread | null {
  const o = obj(v)
  if (!str(o.id) || !STATUSES.includes(o.status as ThreadStatus)) return null
  return { id: o.id as string, status: o.status as ThreadStatus, visibility: toVisibility(o.visibility), passedAt: str(o.passed_at), lastEventAt: str(o.last_event_at) }
}

export function toClassLearningState(v: unknown, classId: string): ClassLearningState {
  const o = obj(v)
  if (o.enabled !== true || !str(o.program_code)) return { enabled: false, classId }
  const sessions = (Array.isArray(o.sessions) ? o.sessions : []).map(obj)
    .filter(s => str(s.session_id) && num(s.session_no) !== null)
    .map((s): SessionState => ({
      sessionId: s.session_id as string,
      no: s.session_no as number,
      title: lessonTitle({ title: str(s.title), session_number: s.session_no as number }),
      stageNo: num(s.stage_no),
      stageTitle: str(s.stage_title),
      published: s.published === true,
      openedAt: str(s.opened_at),
      completedAt: str(s.completed_at),
      checkpoints: (Array.isArray(s.checkpoints) ? s.checkpoints : []).map(obj).filter(c => str(c.id)).map(c => ({
        id: c.id as string,
        title: typeof c.title === 'string' ? c.title : '',
        required: c.required !== false,
        accepts: Array.isArray(c.accepts) ? c.accepts.filter((a): a is string => typeof a === 'string') : [],
        thread: toThread(c.thread),
      })),
    }))
    .sort((a, b) => a.no - b.no)
  return {
    enabled: true,
    classId,
    role: o.role === 'teacher' ? 'teacher' : 'learner',
    programCode: o.program_code as string,
    classCode: str(o.class_code),
    className: str(o.class_name) ?? str(o.class_code) ?? 'Lớp học',
    serverNow: str(o.server_now),
    paceDays: num(o.pace_days) ?? 7,
    sessions,
  }
}

export const pad2 = (n: number) => String(n).padStart(2, '0')
export const sessionLabel = (s: Pick<SessionState, 'no' | 'title'>) => `Buổi ${pad2(s.no)} · ${s.title}`

/** Buổi xem được: người học = đã mở (server); Thầy = mọi buổi (xem trước). */
export function sessionPhase(s: SessionState, role: 'learner' | 'teacher'): 'locked' | 'open' | 'done' {
  if (role === 'teacher') return 'open'
  if (!s.openedAt) return 'locked'
  return s.completedAt ? 'done' : 'open'
}

/** Buổi tự mở khi vào lớp: buổi đã mở mà chưa xong, số nhỏ nhất; xong hết → buổi đã mở cuối cùng. Thầy: buổi đã xuất bản đầu tiên. */
export function currentSessionNo(st: Extract<ClassLearningState, { enabled: true }>): number | null {
  if (st.role === 'teacher') return st.sessions.find(s => s.published)?.no ?? st.sessions[0]?.no ?? null
  const open = st.sessions.filter(s => s.openedAt)
  return open.find(s => !s.completedAt)?.no ?? open[open.length - 1]?.no ?? null
}

/** Copy ngắn cho buổi khoá — không trừng phạt. */
export function lockedHint(sessions: SessionState[], s: SessionState): string {
  const prev = [...sessions].filter(x => x.no < s.no).sort((a, b) => b.no - a.no)[0]
  return prev ? `Hoàn thành Buổi ${pad2(prev.no)} để mở` : 'Buổi này sẽ mở khi bạn bắt đầu học'
}

// ── Nhịp tuần (1 tuần = 1 buổi, chuẩn paceDays) — CHỈ trình bày, không phạt, không khoá ──
export type PaceTone = 'early' | 'on_time' | 'late' | 'in_progress' | 'overdue'
export type Pace = { tone: PaceTone; label: string }
const DAY = 86_400_000
/** Xong trước hạn ≥ EARLY_MARGIN_DAYS ngày = 🟢 sớm; trong hạn = 🟡 đúng nhịp; sau hạn = 🔴 quá nhịp. */
export const EARLY_MARGIN_DAYS = 2

export function sessionPace(s: Pick<SessionState, 'openedAt' | 'completedAt'>, now: Date, paceDays = 7): Pace | null {
  if (!s.openedAt) return null
  const opened = new Date(s.openedAt).getTime()
  if (!Number.isFinite(opened)) return null
  const due = opened + paceDays * DAY
  if (s.completedAt) {
    const done = new Date(s.completedAt).getTime()
    if (!Number.isFinite(done)) return null
    if (done <= due - EARLY_MARGIN_DAYS * DAY) return { tone: 'early', label: 'Xong sớm' }
    if (done <= due) return { tone: 'on_time', label: 'Đúng nhịp' }
    return { tone: 'late', label: 'Xong sau nhịp tuần' }
  }
  const t = now.getTime()
  if (t <= due) {
    const left = Math.max(0, Math.ceil((due - t) / DAY))
    return { tone: 'in_progress', label: left <= 0 ? 'Hôm nay là ngày cuối tuần học' : `Còn ${left} ngày trong nhịp tuần` }
  }
  const over = Math.max(1, Math.floor((t - due) / DAY))
  return { tone: 'overdue', label: `Quá nhịp tuần ${over} ngày · vẫn học tiếp bình thường` }
}

export const PACE_DOT: Record<PaceTone, string> = { early: '🟢', on_time: '🟡', late: '🔴', in_progress: '', overdue: '🔴' }

/** Tiến độ bài trả BẮT BUỘC của một buổi: "1/2 bài trả bắt buộc đã Đạt". */
export function requiredProgress(s: SessionState): { passed: number; total: number } {
  const req = s.checkpoints.filter(c => c.required)
  return { passed: req.filter(c => !!c.thread?.passedAt).length, total: req.length }
}

// ── Nút + trạng thái NGAY tại checkpoint ──
export type CheckpointUi = { chip: null | { label: string; tone: 'wait' | 'info' | 'warn' | 'ok' }; submit: null | 'first' | 'again'; canView: boolean }

/** Trạng thái tại chỗ: Chưa trả → TRẢ BÀI · Đã trả (Chờ chấm) · Đã có phản hồi (+ Trả lại) · Cần làm lại (+ TRẢ LẠI) · Đạt. */
export function checkpointUi(t: CheckpointThread | null): CheckpointUi {
  if (!t || t.status === 'archived') return { chip: null, submit: 'first', canView: false }
  switch (t.status) {
    case 'waiting_teacher': return { chip: { label: 'Đã trả · Chờ chấm', tone: 'wait' }, submit: null, canView: true }
    case 'teacher_responded': return { chip: { label: 'Đã có phản hồi', tone: 'info' }, submit: 'again', canView: true }
    case 'needs_retry': return { chip: { label: 'Cần làm lại', tone: 'warn' }, submit: 'again', canView: true }
    case 'passed': return { chip: { label: 'Đạt', tone: 'ok' }, submit: null, canView: true }
  }
  return { chip: null, submit: 'first', canView: false }
}

/** Huy hiệu ngắn trên dòng buổi (khi thu gọn). */
export function sessionBadge(s: SessionState, role: 'learner' | 'teacher', now: Date, paceDays: number): string {
  if (role === 'teacher') return s.published ? '' : 'Đang soạn'
  const phase = sessionPhase(s, role)
  if (phase === 'locked') return '🔒'
  const pace = sessionPace(s, now, paceDays)
  if (phase === 'done') return `✓ ${pace ? `${PACE_DOT[pace.tone]} ${pace.label}` : 'Hoàn thành'}`.trim()
  if (!s.published) return 'Đang soạn'
  return pace?.tone === 'overdue' ? '🔴 Đang học' : 'Đang học'
}
