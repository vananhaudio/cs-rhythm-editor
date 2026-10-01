// ─────────────────────────────────────────────────────────────────────────────
// Learning Thread P2 — thẻ "câu chuyện học tập" trên Feed/Tường + Hành trình. Hàm THUẦN (test được).
// Dữ liệu từ RPC social_feed / user_wall (thẻ = lt_thread_card) và learning_journey — CHỈ cách nhìn của
// learning_threads, không bản sao. Tên Thầy lấy từ dữ liệu (không hard-code).
// ─────────────────────────────────────────────────────────────────────────────
import { safeImageUrl } from '../class-social/media/safeImageUrl'
import { toIdentity, toVisibility, type EventKind, type Identity, type Person, type ThreadStatus, type Verdict, type Visibility } from './ltModel'

const STATUSES: ThreadStatus[] = ['waiting_teacher', 'teacher_responded', 'needs_retry', 'passed', 'archived']
const KINDS: EventKind[] = ['submission', 'question', 'teacher_feedback', 'teacher_answer']

type J = Record<string, unknown>
const obj = (v: unknown): J => (v && typeof v === 'object' && !Array.isArray(v) ? v as J : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const person = (v: unknown, fallback: string): Person => {
  const o = obj(v)
  return { userId: str(o.user_id), name: str(o.name) ?? fallback, avatarUrl: safeImageUrl(str(o.avatar_url)) }
}

// ── Thẻ thread trên Feed / Tường ─────────────────────────────────────────────
export type ThreadCard = {
  id: string
  status: ThreadStatus
  visibility: Visibility
  identity: Identity
  learner: Person
  isMine: boolean
  isHidden: boolean
  archived: boolean
  createdAt: string
  lastEventAt: string
  firstKind: 'submission' | 'question' | null
  lastEvent: null | {
    kind: EventKind
    verdict: Verdict | null
    authorRole: 'student' | 'teacher'
    author: Person
    hasResources: boolean
    isResubmission: boolean
  }
}

export function toThreadCard(v: unknown): ThreadCard | null {
  const o = obj(v)
  const status = o.status as ThreadStatus
  const lastEventAt = str(o.last_event_at)
  if (!str(o.id) || !STATUSES.includes(status) || !lastEventAt) return null
  const le = o.last_event ? obj(o.last_event) : null
  const role = le?.author_role === 'teacher' ? 'teacher' : 'student'
  return {
    id: o.id as string,
    status,
    visibility: toVisibility(o.visibility),
    identity: toIdentity(o.identity),
    learner: person(o.learner, 'Học viên'),
    isMine: o.is_mine === true,
    isHidden: o.is_hidden === true,
    archived: o.archived === true,
    createdAt: str(o.created_at) ?? lastEventAt,
    lastEventAt,
    firstKind: o.first_kind === 'question' || o.first_kind === 'submission' ? o.first_kind : null,
    lastEvent: le && KINDS.includes(le.kind as EventKind) ? {
      kind: le.kind as EventKind,
      verdict: le.verdict === 'retry' || le.verdict === 'pass' ? le.verdict : null,
      authorRole: role,
      author: person(le.author, role === 'teacher' ? 'Thầy' : 'Học viên'),
      hasResources: le.has_resources === true,
      isResubmission: le.is_resubmission === true,
    } : null,
  }
}

/** Nhãn gốc của câu chuyện (theo lượt đầu của học sinh). */
export function originBadge(c: Pick<ThreadCard, 'firstKind'>): { icon: string; label: string } {
  return c.firstKind === 'question' ? { icon: '❓', label: 'Hỏi bài' } : { icon: '🎸', label: 'Trả bài' }
}

export type Story = { actor: Person; text: string; verdict: Verdict | null; resourceNote: string | null }

/** "Chuyện gì vừa xảy ra" — theo event mới nhất (Phần U). Tên người lấy từ dữ liệu. */
export function storyLine(c: Pick<ThreadCard, 'lastEvent' | 'learner'>): Story | null {
  const e = c.lastEvent
  if (!e) return null
  const resourceNote = e.authorRole === 'teacher' && e.hasResources ? 'Thầy đã gửi bài giảng nên xem' : null
  switch (e.kind) {
    case 'submission': return { actor: c.learner, text: e.isResubmission ? 'vừa trả lại bài' : 'vừa trả bài', verdict: null, resourceNote }
    case 'question': return { actor: c.learner, text: 'vừa hỏi bài', verdict: null, resourceNote }
    case 'teacher_answer': return { actor: e.author, text: 'vừa trả lời', verdict: null, resourceNote }
    default:
      return {
        actor: e.author,
        text: e.verdict === 'retry' ? 'vừa nhận xét · Cần làm lại' : e.verdict === 'pass' ? 'vừa nhận xét · Đạt' : 'vừa nhận xét',
        verdict: e.verdict, resourceNote,
      }
  }
}

// ── Hành trình (RPC learning_journey) ─────────────────────────────────────────
export type JourneyEvent = { kind: EventKind; verdict: Verdict | null; authorRole: 'student' | 'teacher'; hasResources: boolean; createdAt: string }
export type JourneyItem = {
  id: string; status: ThreadStatus; visibility: Visibility; identity: Identity
  createdAt: string; lastEventAt: string | null; passedAt: string | null; isHidden: boolean; archived: boolean
  events: JourneyEvent[]
}
export type JourneyRow = {
  id: string; status: string; visibility: string; identity: unknown; created_at: string; last_event_at: string | null
  passed_at: string | null; is_hidden: boolean | null; archived: boolean | null; events: unknown
}

export function toJourneyItem(r: JourneyRow): JourneyItem | null {
  if (!r.id || !STATUSES.includes(r.status as ThreadStatus) || !r.created_at) return null
  const events = (Array.isArray(r.events) ? r.events : []).map(obj)
    .filter(e => KINDS.includes(e.kind as EventKind))
    .map(e => ({
      kind: e.kind as EventKind,
      verdict: e.verdict === 'retry' || e.verdict === 'pass' ? e.verdict as Verdict : null,
      authorRole: e.author_role === 'teacher' ? 'teacher' as const : 'student' as const,
      hasResources: e.has_resources === true,
      createdAt: str(e.created_at) ?? '',
    }))
  return {
    id: r.id, status: r.status as ThreadStatus, visibility: toVisibility(r.visibility),
    identity: toIdentity(r.identity), createdAt: r.created_at, lastEventAt: r.last_event_at, passedAt: r.passed_at,
    isHidden: r.is_hidden === true, archived: r.archived === true, events,
  }
}

export type JourneyStep = { icon: string; label: string; times?: number }

/** Tóm tắt một mốc: chuỗi bước ngắn (không bung nội dung). Nhiều vòng "Cần làm lại → Trả lại" liên tiếp
 *  gộp thành MỘT cặp kèm số vòng (×n) — Hành trình kể câu chuyện, không liệt kê từng lượt. */
export function eventSteps(events: JourneyEvent[]): JourneyStep[] {
  let seenSub = false
  const out: JourneyStep[] = []
  for (const e of events) {
    if (e.kind === 'submission') { out.push({ icon: '🎸', label: seenSub ? 'Trả lại' : 'Trả bài' }); seenSub = true }
    else if (e.kind === 'question') out.push({ icon: '❓', label: 'Hỏi bài' })
    else if (e.kind === 'teacher_answer') out.push({ icon: '💬', label: 'Thầy trả lời' })
    else out.push(e.verdict === 'pass' ? { icon: '✅', label: 'Đạt' } : e.verdict === 'retry' ? { icon: '🔄', label: 'Cần làm lại' } : { icon: '💬', label: 'Thầy nhận xét' })
    if (e.authorRole === 'teacher' && e.hasResources) out.push({ icon: '📘', label: 'Bài giảng nên xem' })
  }
  return collapseCycles(out)
}

function collapseCycles(steps: JourneyStep[]): JourneyStep[] {
  const out: JourneyStep[] = []
  for (let i = 0; i < steps.length;) {
    const a = steps[i], b = steps[i + 1]
    let n = 1
    if (b) while (steps[i + 2 * n]?.label === a.label && steps[i + 2 * n + 1]?.label === b.label) n++
    if (n > 1) { out.push(a, { ...b, times: n }); i += 2 * n } else { out.push(a); i++ }
  }
  return out
}

// ── Màu chặng: XÁC ĐỊNH theo môn (track) — dùng lại đúng bộ màu nhận diện khoá của App học
// (MobileStudentPortal courseFallbackStyle: dem_hat / tia_not / solo / nhac_ly). Không màu ngẫu nhiên.
export type TrackTheme = { key: string; label: string; from: string; to: string }
export const TRACK_THEMES: Record<string, TrackTheme> = {
  dem_hat: { key: 'dem_hat', label: 'Đệm hát', from: '#4338CA', to: '#EA580C' },
  tia_not: { key: 'tia_not', label: 'Tỉa nốt', from: '#15803D', to: '#0F766E' },
  solo: { key: 'solo', label: 'Solo', from: '#211C32', to: '#4338CA' },
  nhac_ly: { key: 'nhac_ly', label: 'Nhạc lý / Cảm âm', from: '#7C3AED', to: '#2563EB' },
  khac: { key: 'khac', label: 'Âm nhạc', from: '#4338CA', to: '#64748B' },
}
export function trackTheme(subject: string | null): TrackTheme {
  return (subject && TRACK_THEMES[subject]) || TRACK_THEMES.khac
}

const STAGE_LABEL: Record<string, string> = { co_ban: 'Căn bản', phat_trien: 'Phát triển', nang_cao: 'Nâng cao' }

/** Một chặng của Hành trình = (lớp hoặc Tự học) × khoá — theo DANH TÍNH LỊCH SỬ, không theo hồ sơ hiện tại. */
export type JourneyPhase = {
  key: string
  title: string          // "DH2.KD18 · Đệm hát 2" | "Tự học · DH2"
  subtitle: string | null // tên khoá · chặng lớp
  theme: TrackTheme
  level: number | null
  year: number
  items: JourneyItem[]
}

export function phaseKey(id: Identity): string {
  return `${id.klass?.code ?? 'self'}|${id.course.code ?? id.course.name ?? '?'}`
}

export function groupJourney(items: JourneyItem[]): JourneyPhase[] {
  const sorted = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  const phases = new Map<string, JourneyPhase>()
  for (const it of sorted) {
    const id = it.identity
    const key = phaseKey(id)
    let ph = phases.get(key)
    if (!ph) {
      const course = id.course.code || id.course.name || 'Khoá học'
      const k = id.klass
      ph = {
        key,
        title: k ? `${k.code || k.name} · ${k.stageTitle || id.course.name || course}` : `Tự học · ${course}`,
        subtitle: [id.course.name, k?.stage ? STAGE_LABEL[k.stage] ?? null : null].filter(Boolean).join(' · ') || null,
        theme: trackTheme(id.course.subject),
        level: id.course.level ?? id.module.level,
        year: new Date(it.createdAt).getFullYear(),
        items: [],
      }
      phases.set(key, ph)
    }
    ph.items.push(it)
  }
  return [...phases.values()]   // Map giữ thứ tự chèn = thứ tự hoạt động đầu tiên
}
