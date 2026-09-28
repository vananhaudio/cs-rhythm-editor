import type { GenSession } from './sessions'

export interface StoredSession {
  id: string
  session_number: number | null
  event_type: string
  status: string
  start_at: string
  end_at: string | null
  title?: string | null
  note?: string | null
}

export interface SessionChange {
  id: string
  expectedStatus: 'scheduled' | 'holiday'
  patch: { start_at?: string; end_at?: string; status?: 'cancelled' }
}

export interface SessionInsert {
  session_number: number | null
  event_type: 'lesson' | 'break'
  start_at: string
  end_at: string
  status: 'scheduled' | 'holiday'
  title?: string
  note?: string
}

export interface SessionSyncPlan {
  updates: SessionChange[]
  inserts: SessionInsert[]
}

const sameInstant = (left: string | null, right: string) =>
  left !== null && Date.parse(left) === Date.parse(right)

// Only `scheduled` lessons and `holiday` breaks are owned by the schedule generator.
// Other statuses signal a human decision; never reset them or rewrite their dates.
export function planSessionSync(
  stored: StoredSession[],
  generated: GenSession[],
  newLessonFields?: (sessionNo: number) => Pick<SessionInsert, 'title' | 'note'>,
): SessionSyncPlan {
  const lessons = new Map<number, StoredSession>()
  const existingBreaks: StoredSession[] = []
  for (const row of stored) {
    if (row.event_type === 'lesson') {
      if (row.session_number === null || lessons.has(row.session_number)) {
        throw new Error(`Buổi học trùng/thiếu số: ${row.session_number}`)
      }
      lessons.set(row.session_number, row)
    } else if (row.event_type === 'break') {
      if (row.session_number !== null) throw new Error('Buổi nghỉ không được có session_number')
      if (row.status === 'holiday') existingBreaks.push(row)
    } else if (row.session_number !== null) {
      throw new Error(`Số buổi ${row.session_number} đã thuộc sự kiện ${row.event_type}`)
    }
  }

  const updates: SessionChange[] = []
  const inserts: SessionInsert[] = []
  const plannedNumbers = new Set<number>()
  const plannedBreaks: GenSession[] = []
  for (const item of generated) {
    if (item.event_type === 'break') {
      if (item.session_number !== null) throw new Error('Buổi nghỉ không được có session_number')
      plannedBreaks.push(item)
      continue
    }
    const n = item.session_number
    if (n === null || plannedNumbers.has(n)) throw new Error(`Lịch sinh số buổi trùng/thiếu: ${n}`)
    plannedNumbers.add(n)
    const old = lessons.get(n)
    if (!old) {
      inserts.push({ ...item, status: 'scheduled', ...newLessonFields?.(n) })
    } else if (old.status === 'scheduled') {
      const patch: SessionChange['patch'] = {}
      if (!sameInstant(old.start_at, item.start_at)) patch.start_at = item.start_at
      if (!sameInstant(old.end_at, item.end_at)) patch.end_at = item.end_at
      if (Object.keys(patch).length) updates.push({ id: old.id, expectedStatus: 'scheduled', patch })
    }
  }

  // Reducing the lesson count retires old rows without changing their identity.
  for (const [n, old] of lessons) {
    if (!plannedNumbers.has(n) && old.status === 'scheduled') {
      updates.push({ id: old.id, expectedStatus: 'scheduled', patch: { status: 'cancelled' } })
    }
  }

  // Breaks have no business key. Pair generated breaks with active breaks in date
  // order; retain their IDs on reschedule and cancel surplus rows. Never touch
  // numbered lessons or manually cancelled breaks.
  existingBreaks.sort((a, b) => a.start_at.localeCompare(b.start_at) || a.id.localeCompare(b.id))
  plannedBreaks.sort((a, b) => a.start_at.localeCompare(b.start_at))
  plannedBreaks.forEach((item, index) => {
    const old = existingBreaks[index]
    if (!old) inserts.push({ ...item, status: 'holiday' })
    else {
      const patch: SessionChange['patch'] = {}
      if (!sameInstant(old.start_at, item.start_at)) patch.start_at = item.start_at
      if (!sameInstant(old.end_at, item.end_at)) patch.end_at = item.end_at
      if (Object.keys(patch).length) updates.push({ id: old.id, expectedStatus: 'holiday', patch })
    }
  })
  existingBreaks.slice(plannedBreaks.length).forEach(old => updates.push({ id: old.id, expectedStatus: 'holiday', patch: { status: 'cancelled' } }))
  return { updates, inserts }
}
