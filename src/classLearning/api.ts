// ── Lớp đang học — truy vấn Supabase (mọi quyền do RLS ở DB quyết) ──
import type { supabase } from '../supabase'
import type { LessonSection } from '../lesson/lessonTypes'
import { parseSections, type ClassRow, type ContentState, type SessionRow, type StageRow } from './outline'

export type Db = Pick<typeof supabase, 'from' | 'rpc'>

const CLASS_COLS = 'id,code,name,status,start_date'
const STAGE_COLS = 'id,class_id,stage_no,public_title,summary,from_session,to_session,starts_on,ends_on'
const SESSION_COLS = 'id,session_number,event_type,status,start_at,end_at,title,stage_id'

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message) }

/**
 * Lớp mà người dùng đang là thành viên cohort (membership active, đọc qua policy egm_self_read).
 * Đây chỉ là danh sách để hiển thị — giáo trình buổi nào đọc được vẫn do RLS của
 * class_lesson_content quyết (cần thêm entitlement + published).
 */
export async function fetchMyClasses(db: Db, userId: string): Promise<ClassRow[]> {
  const mem = await db.from('edu_group_members').select('group_id').eq('user_id', userId).eq('status', 'active')
  fail(mem.error)
  const groupIds = [...new Set((mem.data ?? []).map((m: { group_id: string }) => m.group_id))]
  if (!groupIds.length) return []
  const cls = await db.from('class_schedule').select(CLASS_COLS).in('cohort_group_id', groupIds).order('start_date')
  fail(cls.error)
  return (cls.data ?? []) as ClassRow[]
}

export interface ClassOutlineData { stages: StageRow[]; sessions: SessionRow[]; contents: ContentState[] }

/** Chặng + buổi của lớp, cùng trạng thái giáo trình của các buổi mà RLS cho phép thấy. */
export async function fetchClassOutline(db: Db, classId: string): Promise<ClassOutlineData> {
  const [st, se] = await Promise.all([
    db.from('class_stages').select(STAGE_COLS).eq('class_id', classId).order('stage_no'),
    db.from('class_sessions').select(SESSION_COLS).eq('class_id', classId).order('start_at'),
  ])
  fail(st.error); fail(se.error)
  const sessions = (se.data ?? []) as SessionRow[]
  const lessonIds = sessions.filter(s => s.event_type === 'lesson').map(s => s.id)
  let contents: ContentState[] = []
  if (lessonIds.length) {
    const c = await db.from('class_lesson_content').select('session_id,status').in('session_id', lessonIds)
    fail(c.error)
    contents = (c.data ?? []) as ContentState[]
  }
  return { stages: (st.data ?? []) as StageRow[], sessions, contents }
}

// ── Ghi (Admin / teacher). RLS: class_stages, class_sessions, class_lesson_content chỉ teacher ghi. ──

export async function createStage(db: Db, classId: string, row: Omit<StageRow, 'id' | 'class_id'>): Promise<StageRow> {
  const r = await db.from('class_stages').insert({ class_id: classId, ...row }).select(STAGE_COLS).single()
  fail(r.error)
  return r.data as StageRow
}

export async function updateStage(db: Db, stageId: number, patch: Partial<Omit<StageRow, 'id' | 'class_id'>>): Promise<void> {
  const r = await db.from('class_stages').update(patch).eq('id', stageId).select('id')
  fail(r.error)
  if (!r.data?.length) throw new Error('Không cập nhật được chặng (không có quyền hoặc chặng đã bị xoá).')
}

/** DB chặn xoá nếu còn buổi gắn stage_id (FK RESTRICT) — gỡ buổi trước. */
export async function deleteStage(db: Db, stageId: number): Promise<void> {
  const r = await db.from('class_stages').delete().eq('id', stageId).select('id')
  fail(r.error)
  if (!r.data?.length) throw new Error('Không xoá được chặng.')
}

/** Gắn (hoặc gỡ khi stageId=null) một buổi lesson vào chặng — chỉ đổi stage_id, giữ nguyên ID buổi. */
export async function assignSessionStage(db: Db, sessionId: string, stageId: number | null): Promise<void> {
  const r = await db.from('class_sessions').update({ stage_id: stageId }).eq('id', sessionId).eq('event_type', 'lesson').select('id')
  fail(r.error)
  if (!r.data?.length) throw new Error('Không gắn được buổi vào chặng.')
}

/** Gắn nhiều buổi lesson vào một chặng trong một request. */
export async function assignSessionsStage(db: Db, sessionIds: string[], stageId: number): Promise<void> {
  if (!sessionIds.length) return
  const r = await db.from('class_sessions').update({ stage_id: stageId }).in('id', sessionIds).eq('event_type', 'lesson').select('id')
  fail(r.error)
  if ((r.data?.length ?? 0) !== sessionIds.length) throw new Error('Không gắn được đủ buổi vào chặng.')
}

export async function saveSessionContent(db: Db, sessionId: string, sections: LessonSection[],
  status: ContentState['status']): Promise<void> {
  if (status === 'published' && !sections.length) throw new Error('Không thể xuất bản giáo trình trống.')
  const r = await db.from('class_lesson_content')
    .upsert({ session_id: sessionId, status, blocks: sections }, { onConflict: 'session_id' }).select('session_id')
  fail(r.error)
  if (!r.data?.length) throw new Error('Không lưu được giáo trình.')
}

export async function deleteSessionContent(db: Db, sessionId: string): Promise<void> {
  const r = await db.from('class_lesson_content').delete().eq('session_id', sessionId).select('session_id')
  fail(r.error)
}

export interface SessionContent { status: ContentState['status']; sections: LessonSection[]; updated_at: string }

/** Giáo trình một buổi; null = không có hoặc không được đọc (RLS trả 0 hàng). */
export async function fetchSessionContent(db: Db, sessionId: string): Promise<SessionContent | null> {
  const r = await db.from('class_lesson_content').select('status,blocks,updated_at').eq('session_id', sessionId).maybeSingle()
  fail(r.error)
  if (!r.data) return null
  const row = r.data as { status: ContentState['status']; blocks: unknown; updated_at: string }
  const parsed = parseSections(row.blocks)
  if (!parsed.ok) throw new Error(parsed.error)
  return { status: row.status, sections: parsed.sections, updated_at: row.updated_at }
}
