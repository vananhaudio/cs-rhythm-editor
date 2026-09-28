import { planSessionSync, type StoredSession, type SessionInsert } from '../src/journey/sessionSync'
import type { GenSession } from '../src/journey/sessions'

type Query = (sql: string) => Promise<any[]>
const quote = (value: string) => "'" + value.replace(/'/g, "''") + "'"

export async function syncSeedSessions(
  sql: Query,
  classId: string,
  generated: GenSession[],
  newLessonFields: (sessionNo: number) => Pick<SessionInsert, 'title' | 'note'>,
): Promise<{ lessons: number; breaks: number; updated: number; inserted: number }> {
  const stored = await sql(`select id, session_number, event_type, status, start_at, end_at, title, note
    from public.class_sessions where class_id = ${quote(classId)} order by start_at, id`) as StoredSession[]
  const plan = planSessionSync(stored, generated, newLessonFields)

  for (const { id, expectedStatus, patch } of plan.updates) {
    const sets = Object.entries(patch).map(([key, value]) => `${key} = ${quote(value)}`)
    if (sets.length) await sql(`update public.class_sessions set ${sets.join(', ')}
      where id = ${quote(id)} and status = ${quote(expectedStatus)}`)
  }
  for (let i = 0; i < plan.inserts.length; i += 100) {
    const chunk = plan.inserts.slice(i, i + 100).map(item => item.event_type === 'break'
      ? { ...item, title: 'Nghỉ giữa chặng – thời gian tự luyện và hoàn thiện sản phẩm', note: 'nghỉ giữa chặng' }
      : item)
    const rows = chunk.map(s => `(${quote(classId)}, ${s.session_number === null ? 'null' : s.session_number},
      ${quote(s.event_type)}, ${quote(s.start_at)}, ${quote(s.end_at)}, ${quote(s.status)},
      ${s.title ? quote(s.title) : 'null'}, ${s.note ? quote(s.note) : 'null'})`)
    // Numbered lessons have a unique business key. A concurrent insert must not
    // replace its ID or teacher-owned fields. Breaks are planned separately.
    await sql(`insert into public.class_sessions
      (class_id, session_number, event_type, start_at, end_at, status, title, note)
      values ${rows.join(', ')} on conflict (class_id, session_number) do nothing`)
  }
  const counts = await sql(`select count(*) filter (where event_type = 'lesson') as lessons,
    count(*) filter (where event_type = 'break' and status <> 'cancelled') as breaks
    from public.class_sessions where class_id = ${quote(classId)}`)
  return {
    lessons: Number(counts[0]?.lessons ?? 0), breaks: Number(counts[0]?.breaks ?? 0),
    updated: plan.updates.length, inserted: plan.inserts.length,
  }
}
