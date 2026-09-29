// ── Lớp đang học — logic thuần (không gọi mạng) cho Chặng → Buổi → Giáo trình ──
// Quyền đọc giáo trình do RLS quyết (membership + entitlement + published).
// Ở đây chỉ sắp xếp dữ liệu server trả về; KHÔNG suy luận quyền.
import type { LessonDoc, LessonSection } from '../lesson/lessonTypes'

export interface ClassRow {
  id: string
  code: string
  name: string
  status: string
  start_date: string | null
}
export interface StageRow {
  id: number
  class_id: string
  stage_no: number
  public_title: string
  summary: string | null
  from_session: number
  to_session: number
  starts_on: string | null
  ends_on: string | null
}
export interface SessionRow {
  id: string
  session_number: number | null
  event_type: string
  status: string
  start_at: string
  end_at: string | null
  title: string | null
  stage_id: number | null
}
export interface ContentState { session_id: string; status: 'draft' | 'published' }

export interface OutlineLesson {
  session: SessionRow
  no: number
  title: string
  content: ContentState['status'] | null
}
export interface OutlineStage {
  stage: StageRow | null        // null = buổi chưa thuộc chặng nào
  lessons: OutlineLesson[]
}

/** "Buổi 3 · Xếp ngón…" → "Xếp ngón…"; không có tiêu đề thì "Buổi N". */
export function lessonTitle(s: Pick<SessionRow, 'title' | 'session_number'>): string {
  const raw = (s.title ?? '').trim()
  const stripped = raw.replace(/^Buổi\s*\d+\s*[·:–-]\s*/i, '').trim()
  return stripped || `Buổi ${s.session_number ?? '?'}`
}

/** Chặng của một buổi: stage_id (Admin gắn) ưu tiên, sau đó khoảng from_session..to_session. */
export function stageOf(s: SessionRow, stages: StageRow[]): StageRow | null {
  if (s.stage_id != null) {
    const byId = stages.find(st => st.id === s.stage_id)
    if (byId) return byId
  }
  const n = s.session_number
  if (n == null) return null
  return stages.find(st => n >= st.from_session && n <= st.to_session) ?? null
}

/** Chỉ buổi lesson có số buổi; nhóm theo chặng (theo stage_no), cuối cùng là nhóm chưa xếp chặng. */
export function groupOutline(stages: StageRow[], sessions: SessionRow[], contents: ContentState[]): OutlineStage[] {
  const sortedStages = [...stages].sort((a, b) => a.stage_no - b.stage_no)
  const byContent = new Map(contents.map(c => [c.session_id, c.status]))
  const groups = new Map<number | null, OutlineLesson[]>()
  const lessons = sessions
    .filter(s => s.event_type === 'lesson' && s.session_number != null)
    .sort((a, b) => (a.session_number as number) - (b.session_number as number))
  for (const s of lessons) {
    const st = stageOf(s, sortedStages)
    const key = st ? st.id : null
    const list = groups.get(key) ?? []
    list.push({ session: s, no: s.session_number as number, title: lessonTitle(s), content: byContent.get(s.id) ?? null })
    groups.set(key, list)
  }
  const out: OutlineStage[] = sortedStages.map(st => ({ stage: st, lessons: groups.get(st.id) ?? [] }))
  const loose = groups.get(null)
  if (loose?.length) out.push({ stage: null, lessons: loose })
  return out
}

/** Kiểm tra tối thiểu cho blocks lấy từ DB/Admin: mảng các object có `kind` là chuỗi. */
export function parseSections(value: unknown): { ok: true; sections: LessonSection[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: false, error: 'Giáo trình phải là một mảng các phần (sections).' }
  for (let i = 0; i < value.length; i++) {
    const s = value[i] as { kind?: unknown } | null
    if (!s || typeof s !== 'object' || Array.isArray(s)) return { ok: false, error: `Phần #${i + 1} không phải object.` }
    if (typeof s.kind !== 'string' || !s.kind) return { ok: false, error: `Phần #${i + 1} thiếu "kind".` }
  }
  return { ok: true, sections: value as LessonSection[] }
}

/** Dựng LessonDoc để render: meta lấy từ lớp/chặng/buổi (không lưu trong blocks). */
export function toLessonDoc(cls: Pick<ClassRow, 'code' | 'name'>, stage: StageRow | null,
  session: Pick<SessionRow, 'title' | 'session_number'>, sections: LessonSection[]): LessonDoc {
  return {
    meta: {
      programCode: cls.code,
      programName: cls.name,
      sessionNo: session.session_number ?? 0,
      title: lessonTitle(session),
      stageLabel: stage ? `Chặng ${stage.stage_no} · ${stage.public_title}` : undefined,
    },
    sections,
  }
}

export interface StageTemplate { no: number; title: string; summary?: string }
export interface StagePlanRow { stage_no: number; public_title: string; summary: string | null; from_session: number; to_session: number }

/**
 * Kế hoạch khởi tạo chặng cho một lớp CHƯA có chặng: mỗi chặng `perStage` buổi liên tiếp.
 * Trả rỗng nếu lớp đã có chặng (idempotent — không bao giờ chạm chặng cũ).
 */
export function planStagesFromTemplate(existing: StageRow[], template: StageTemplate[], perStage: number): StagePlanRow[] {
  if (existing.length) return []
  return [...template].sort((a, b) => a.no - b.no).map(t => ({
    stage_no: t.no,
    public_title: t.title,
    summary: t.summary ?? null,
    from_session: (t.no - 1) * perStage + 1,
    to_session: t.no * perStage,
  }))
}

/** Ngày đầu/cuối của chặng suy từ buổi lesson trong khoảng (múi giờ VN, dạng YYYY-MM-DD). */
export function stageDates(sessions: SessionRow[], from: number, to: number): { starts_on: string | null; ends_on: string | null } {
  const ymd = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10)
  const days = sessions
    .filter(s => s.event_type === 'lesson' && s.session_number != null && s.session_number >= from && s.session_number <= to)
    .map(s => ymd(s.start_at)).sort()
  return { starts_on: days[0] ?? null, ends_on: days[days.length - 1] ?? null }
}
