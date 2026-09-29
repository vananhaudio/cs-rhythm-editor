// ─────────────────────────────────────────────────────────────────────────────
// Learning Thread P1 — domain THUẦN (không React, không mạng) để test được.
// Một bài học = MỘT câu chuyện học tập (thread); mỗi lượt Trả bài / Hỏi bài / Thầy phản hồi là một event.
// Quyền + trạng thái do server quyết định (RPC lt_*); file này chỉ đọc kết quả và dịch sang giao diện.
// Xem docs/LEARNING-THREAD-P1.md.
// ─────────────────────────────────────────────────────────────────────────────
import { safeImageUrl } from '../class-social/media/safeImageUrl'

export type SubmissionMode = 'off' | 'allowed' | 'required'
export type QuestionMode = 'off' | 'allowed'
export type ThreadStatus = 'waiting_teacher' | 'teacher_responded' | 'needs_retry' | 'passed' | 'archived'
export type Visibility = 'community' | 'private'
export type StudentKind = 'submission' | 'question'
export type TeacherKind = 'teacher_feedback' | 'teacher_answer'
export type EventKind = StudentKind | TeacherKind
export type Verdict = 'retry' | 'pass'

export const MAX_EVENT_BODY = 4000

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  community: 'Cộng đồng học tập',
  private: 'Chỉ Thầy',
}
export const VISIBILITY_HINT: Record<Visibility, string> = {
  community: 'Thành viên Class xem được để cùng học từ lời Thầy sửa.',
  private: 'Chỉ bạn và Thầy xem được.',
}

// ── Trạng thái Trả/Hỏi bài của MỘT bài (RPC lt_lessons_state) ─────────────────
export type LessonStateRow = {
  lesson_id: string
  submission_mode: string | null
  question_mode: string | null
  prompt: string | null
  thread_id: string | null
  status: string | null
  visibility: string | null
  passed_at: string | null
  last_event_at: string | null
  event_count: number | null
}

export type LessonThreadState = {
  lessonId: string
  submission: SubmissionMode
  question: QuestionMode
  prompt: string | null
  thread: null | { id: string; status: ThreadStatus; visibility: Visibility; passedAt: string | null; eventCount: number }
}

const SUB_MODES: SubmissionMode[] = ['off', 'allowed', 'required']
const STATUSES: ThreadStatus[] = ['waiting_teacher', 'teacher_responded', 'needs_retry', 'passed', 'archived']

export function toLessonState(r: LessonStateRow): LessonThreadState {
  const submission = SUB_MODES.includes(r.submission_mode as SubmissionMode) ? r.submission_mode as SubmissionMode : 'off'
  const question: QuestionMode = r.question_mode === 'allowed' ? 'allowed' : 'off'
  const status = STATUSES.includes(r.status as ThreadStatus) ? r.status as ThreadStatus : null
  return {
    lessonId: r.lesson_id,
    submission,
    question,
    prompt: r.prompt?.trim() || null,
    thread: r.thread_id && status
      ? { id: r.thread_id, status, visibility: r.visibility === 'private' ? 'private' : 'community', passedAt: r.passed_at, eventCount: r.event_count ?? 0 }
      : null,
  }
}

/** Bài có bật Learning Thread không (cả hai tắt → KHÔNG hiện CTA). */
export function isEnabled(s: Pick<LessonThreadState, 'submission' | 'question'>): boolean {
  return s.submission !== 'off' || s.question === 'allowed'
}

export const canSubmit = (s: Pick<LessonThreadState, 'submission'>) => s.submission !== 'off'
export const canAsk = (s: Pick<LessonThreadState, 'question'>) => s.question === 'allowed'

/** Tên khu vực/nút chính theo cấu hình bài. */
export function ctaTitle(s: Pick<LessonThreadState, 'submission' | 'question'>): string {
  if (canSubmit(s) && canAsk(s)) return 'Trả bài / Hỏi bài'
  return canSubmit(s) ? 'Trả bài' : 'Hỏi bài'
}

// ── Nhãn trạng thái (chip) ────────────────────────────────────────────────────
export type Tone = 'wait' | 'info' | 'warn' | 'ok' | 'muted'
export const STATUS_UI: Record<ThreadStatus, { label: string; tone: Tone }> = {
  waiting_teacher: { label: 'Đã gửi · Chờ Thầy phản hồi', tone: 'wait' },
  teacher_responded: { label: 'Thầy đã phản hồi', tone: 'info' },
  needs_retry: { label: 'Cần làm lại', tone: 'warn' },
  passed: { label: 'Đã đạt', tone: 'ok' },
  archived: { label: 'Đã lưu trữ', tone: 'muted' },
}

/** Nhãn ngắn cho hàng đợi của Thầy */
export const QUEUE_STATUS_LABEL: Record<ThreadStatus, string> = {
  waiting_teacher: 'Chờ Thầy',
  teacher_responded: 'Đã phản hồi',
  needs_retry: 'Cần làm lại',
  passed: 'Đã đạt',
  archived: 'Lưu trữ',
}

// ── Học sinh được làm gì tiếp theo (theo cấu hình bài + trạng thái thread) ────
export type StudentAction = { id: 'view' | StudentKind; label: string; kind?: StudentKind; primary?: boolean }

export function studentActions(s: LessonThreadState): StudentAction[] {
  if (!isEnabled(s)) return []
  const sub = canSubmit(s), ask = canAsk(s)
  const t = s.thread
  if (!t || t.status === 'archived') {
    return [
      ...(sub ? [{ id: 'submission' as const, kind: 'submission' as const, label: 'Trả bài', primary: true }] : []),
      ...(ask ? [{ id: 'question' as const, kind: 'question' as const, label: 'Hỏi bài', primary: !sub }] : []),
    ]
  }
  const view: StudentAction = { id: 'view', label: 'Xem cuộc trao đổi' }
  const resubmit = { id: 'submission' as const, kind: 'submission' as const, label: 'Trả lại' }
  const followUp = { id: 'question' as const, kind: 'question' as const, label: 'Hỏi tiếp' }
  switch (t.status) {
    case 'needs_retry':
      return [...(sub ? [{ ...resubmit, primary: true }] : []), view, ...(ask ? [followUp] : [])]
    case 'teacher_responded':
      return [{ ...view, primary: true }, ...(sub ? [resubmit] : []), ...(ask ? [followUp] : [])]
    case 'passed':
      return [{ ...view, primary: true }, ...(ask ? [followUp] : [])]
    default: // waiting_teacher
      return [{ ...view, primary: true }, ...(ask ? [followUp] : [])]
  }
}

// ── Chi tiết thread (RPC lt_detail → jsonb) ──────────────────────────────────
export type Person = { userId: string | null; name: string; avatarUrl: string | null }

export type Identity = {
  lesson: { id: string | null; title: string; orderIndex: number | null; lessonType: string | null }
  module: { name: string | null; level: number | null }
  course: { code: string | null; name: string | null; subject: string | null; level: number | null }
  klass: null | { code: string | null; name: string | null; stage: string | null; stageTitle: string | null; stageNo: number | null }
  capturedAt: string | null
}

export type ThreadEvent = {
  id: string
  seq: number
  kind: EventKind
  verdict: Verdict | null
  authorRole: 'student' | 'teacher'
  author: Person
  body: string
  mediaUrl: string | null
  resources: { resourceType: 'kho_video'; resourceId: string; title: string | null; startSeconds: number | null; excerpt: string | null }[]
  tags: { id: number; name: string }[]
  isHidden: boolean
  createdAt: string
}

export type ThreadDetail = {
  id: string
  lessonId: string | null
  identity: Identity
  visibility: Visibility
  status: ThreadStatus
  passedAt: string | null
  passedBy: Person | null
  createdAt: string
  lastEventAt: string | null
  archived: boolean
  isHidden: boolean
  isMine: boolean
  canRespond: boolean
  learner: Person
  events: ThreadEvent[]
}

type J = Record<string, unknown>
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const obj = (v: unknown): J => (v && typeof v === 'object' && !Array.isArray(v) ? v as J : {})

function toPerson(v: unknown, fallback: string): Person {
  const o = obj(v)
  return { userId: str(o.user_id), name: str(o.name) ?? fallback, avatarUrl: safeImageUrl(str(o.avatar_url)) }
}

export function toIdentity(v: unknown): Identity {
  const o = obj(v)
  const l = obj(o.lesson), m = obj(o.module), c = obj(o.course)
  const k = o.class && typeof o.class === 'object' ? obj(o.class) : null
  return {
    lesson: { id: str(l.id), title: str(l.title) ?? 'Bài học', orderIndex: num(l.order_index), lessonType: str(l.lesson_type) },
    module: { name: str(m.name), level: num(m.level) },
    course: { code: str(c.code), name: str(c.name), subject: str(c.subject), level: num(c.level) },
    klass: k ? { code: str(k.code), name: str(k.name), stage: str(k.stage), stageTitle: str(k.stage_title), stageNo: num(k.stage_no) } : null,
    capturedAt: str(o.captured_at),
  }
}

const EVENT_KINDS: EventKind[] = ['submission', 'question', 'teacher_feedback', 'teacher_answer']

function toEvent(v: unknown): ThreadEvent | null {
  const o = obj(v)
  const kind = o.kind as EventKind
  if (!str(o.id) || !EVENT_KINDS.includes(kind)) return null
  const role = o.author_role === 'teacher' ? 'teacher' : 'student'
  const resources = Array.isArray(o.resources) ? o.resources.map(obj).filter(r => r.resource_type === 'kho_video' && str(r.resource_id)) : []
  const tags = Array.isArray(o.tags) ? o.tags.map(obj).filter(t => num(t.id) !== null && str(t.name)) : []
  return {
    id: o.id as string,
    seq: num(o.seq) ?? 0,
    kind,
    verdict: o.verdict === 'retry' || o.verdict === 'pass' ? o.verdict : null,
    authorRole: role,
    author: toPerson(o.author, role === 'teacher' ? 'Thầy' : 'Học viên'),
    body: typeof o.body === 'string' ? o.body : '',
    mediaUrl: str(o.media_url),
    resources: resources.map(r => ({ resourceType: 'kho_video' as const, resourceId: r.resource_id as string, title: str(r.title_snapshot), startSeconds: num(r.start_seconds), excerpt: str(r.excerpt) })),
    tags: tags.map(t => ({ id: t.id as number, name: t.name as string })),
    isHidden: o.is_hidden === true,
    createdAt: str(o.created_at) ?? '',
  }
}

export function toThreadDetail(v: unknown): ThreadDetail | null {
  const o = obj(v)
  const status = o.status as ThreadStatus
  if (!str(o.id) || !STATUSES.includes(status)) return null
  const events = (Array.isArray(o.events) ? o.events : []).map(toEvent).filter((e): e is ThreadEvent => !!e).sort((a, b) => a.seq - b.seq)
  return {
    id: o.id as string,
    lessonId: str(o.lesson_id),
    identity: toIdentity(o.identity),
    visibility: o.visibility === 'private' ? 'private' : 'community',
    status,
    passedAt: str(o.passed_at),
    passedBy: o.passed_by ? toPerson(o.passed_by, 'Thầy') : null,
    createdAt: str(o.created_at) ?? '',
    lastEventAt: str(o.last_event_at),
    archived: !!o.archived_at,
    isHidden: o.is_hidden === true,
    isMine: o.is_mine === true,
    canRespond: o.can_respond === true,
    learner: toPerson(o.learner, 'Học viên'),
    events,
  }
}

// ── Nhãn danh tính học tập (lịch sử — đóng dấu lúc mở thread) ─────────────────
const STAGE_LABEL: Record<string, string> = { co_ban: 'Căn bản', phat_trien: 'Phát triển', nang_cao: 'Nâng cao' }

/** "DH2.KD18 · Đệm hát 2" hoặc "Tự học · DH2" */
export function identityLine(id: Identity): string {
  const course = id.course.code || id.course.name || ''
  if (!id.klass) return ['Tự học', course].filter(Boolean).join(' · ')
  const k = id.klass
  return [k.code || k.name, k.stageTitle || (k.stage ? STAGE_LABEL[k.stage] ?? null : null) || course].filter(Boolean).join(' · ')
}

/** "Chương 4: … · Bài 4.3 — …" */
export function lessonLine(id: Identity): string {
  return [id.module.name, id.lesson.title].filter(Boolean).join(' · ')
}

export function courseLine(id: Identity): string | null {
  return [id.course.code, id.course.name].filter(Boolean).join(' · ') || null
}

// ── Event → nhãn giao diện ───────────────────────────────────────────────────
export function eventLabel(e: Pick<ThreadEvent, 'kind' | 'verdict'>, isFirstSubmission = false): string {
  switch (e.kind) {
    case 'submission': return isFirstSubmission ? 'Trả bài' : 'Trả lại'
    case 'question': return 'Hỏi bài'
    case 'teacher_answer': return 'Thầy trả lời'
    default:
      return e.verdict === 'pass' ? 'Thầy nhận xét · ĐẠT' : e.verdict === 'retry' ? 'Thầy nhận xét · Cần làm lại' : 'Thầy nhận xét'
  }
}

/** Nhãn cho từng event theo thứ tự (lần Trả bài đầu = "Trả bài", sau đó = "Trả lại"). */
export function eventLabels(events: ThreadEvent[]): string[] {
  let seenSubmission = false
  return events.map(e => {
    const first = e.kind === 'submission' && !seenSubmission
    if (e.kind === 'submission') seenSubmission = true
    return eventLabel(e, first)
  })
}

// ── Soạn (học sinh / Thầy) ───────────────────────────────────────────────────
export function checkBody(body: string, hasMedia: boolean): { ok: true; body: string } | { ok: false; error: string } {
  const b = body.trim()
  if (b.length > MAX_EVENT_BODY) return { ok: false, error: `Nội dung tối đa ${MAX_EVENT_BODY} ký tự.` }
  if (!b && !hasMedia) return { ok: false, error: 'Hãy viết nội dung hoặc dán liên kết video.' }
  return { ok: true, body: b }
}

/** Loại phản hồi của Thầy: có kết luận (làm lại/đạt) → nhận xét; không → trả lời nếu học sinh vừa hỏi, ngược lại nhận xét. */
export function teacherKind(verdict: Verdict | null, events: Pick<ThreadEvent, 'authorRole' | 'kind'>[]): TeacherKind {
  if (verdict) return 'teacher_feedback'
  const lastStudent = [...events].reverse().find(e => e.authorRole === 'student')
  return lastStudent?.kind === 'question' ? 'teacher_answer' : 'teacher_feedback'
}

// ── Hàng đợi Thầy (RPC lt_teacher_queue) ──────────────────────────────────────
export type QueueRow = {
  id: string
  status: string
  visibility: string
  identity: unknown
  learner_user_id: string
  learner_name: string | null
  learner_avatar_url: string | null
  last_student_event_at: string | null
  last_event_at: string | null
  event_count: number | null
  last_event_kind: string | null
  last_event_excerpt: string | null
  is_hidden: boolean | null
}

export type QueueItem = {
  id: string
  status: ThreadStatus
  visibility: Visibility
  identity: Identity
  learner: Person
  lastStudentEventAt: string | null
  lastEventAt: string | null
  eventCount: number
  lastKind: EventKind | null
  lastExcerpt: string
  isHidden: boolean
}

export function toQueueItem(r: QueueRow): QueueItem | null {
  if (!r.id || !STATUSES.includes(r.status as ThreadStatus)) return null
  return {
    id: r.id,
    status: r.status as ThreadStatus,
    visibility: r.visibility === 'private' ? 'private' : 'community',
    identity: toIdentity(r.identity),
    learner: { userId: r.learner_user_id, name: r.learner_name?.trim() || 'Học viên', avatarUrl: safeImageUrl(r.learner_avatar_url) },
    lastStudentEventAt: r.last_student_event_at,
    lastEventAt: r.last_event_at,
    eventCount: r.event_count ?? 0,
    lastKind: EVENT_KINDS.includes(r.last_event_kind as EventKind) ? r.last_event_kind as EventKind : null,
    lastExcerpt: (r.last_event_excerpt ?? '').trim(),
    isHidden: r.is_hidden === true,
  }
}

// ── Thread của tôi (RPC lt_my_threads) ────────────────────────────────────────
export type MyThreadRow = {
  id: string; content_key: string; lesson_id: string | null; identity: unknown; visibility: string; status: string
  passed_at: string | null; last_event_at: string | null; event_count: number | null; archived_at: string | null
}
export type MyThread = { id: string; lessonId: string | null; identity: Identity; visibility: Visibility; status: ThreadStatus; lastEventAt: string | null }

export function toMyThread(r: MyThreadRow): MyThread | null {
  if (!r.id || !STATUSES.includes(r.status as ThreadStatus)) return null
  return { id: r.id, lessonId: r.lesson_id, identity: toIdentity(r.identity), visibility: r.visibility === 'private' ? 'private' : 'community', status: r.status as ThreadStatus, lastEventAt: r.last_event_at }
}

// ── Lỗi server (LT_*) → tiếng Việt ───────────────────────────────────────────
const LT_ERROR_TEXT: Record<string, string> = {
  LT_NOT_AUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
  LT_NOT_MEMBER: 'Tài khoản của bạn chưa thuộc Class nên chưa gửi được.',
  LT_TEACHER_ONLY: 'Chỉ Thầy mới làm được việc này.',
  LT_TEACHER_CANNOT_SUBMIT: 'Tài khoản giáo viên không Trả bài thay học sinh.',
  LT_SUBMISSION_NOT_ENABLED: 'Bài này chưa mở Trả bài.',
  LT_QUESTION_NOT_ENABLED: 'Bài này chưa mở Hỏi bài.',
  LT_NO_ACCESS: 'Bạn chưa được mở bài này.',
  LT_NOT_FOUND: 'Không tìm thấy cuộc trao đổi này, hoặc bạn không có quyền xem.',
  LT_THREAD_HIDDEN: 'Cuộc trao đổi này đang tạm ẩn.',
  LT_THREAD_ARCHIVED: 'Cuộc trao đổi này đã được lưu trữ.',
  LT_BAD_MEDIA: 'Liên kết video chưa hợp lệ.',
  LT_BAD_TAGS: 'Thẻ không hợp lệ.',
  LT_BAD_RESOURCES: 'Bài giảng đính kèm không hợp lệ.',
}

export function ltErrorText(err: { message?: string; code?: string; status?: number } | null | undefined, online = true): string {
  const msg = err?.message ?? ''
  const code = Object.keys(LT_ERROR_TEXT).find(k => msg === k || msg.startsWith(k + ' ') || msg.includes(k))
  if (code) return LT_ERROR_TEXT[code]
  const low = msg.toLowerCase()
  if (!online || low.includes('failed to fetch') || low.includes('network') || low.includes('load failed')) return 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại.'
  if (err?.status === 401 || low.includes('jwt')) return 'Phiên đăng nhập đã hết hạn. Hãy tải lại trang và đăng nhập lại.'
  if (msg.includes('check constraint') || err?.code === '23514') return 'Nội dung chưa hợp lệ. Hãy kiểm tra lại rồi gửi.'
  return 'Chưa thực hiện được. Hãy thử lại.'
}
