import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planSessionSync, type StoredSession } from '../../src/journey/sessionSync.ts'
import { syncSeedSessions } from '../../scripts/session-sync-sql.ts'
import type { GenSession } from '../../src/journey/sessions.ts'

const at = (day: number, hour = 12) => new Date(Date.UTC(2026, 8, day, hour)).toISOString()
const lesson = (n: number, day = n, hour = 12): GenSession => ({
  session_number: n, event_type: 'lesson', start_at: at(day, hour), end_at: at(day, hour + 1),
})
const breakRow = (day: number): GenSession => ({
  session_number: null, event_type: 'break', start_at: at(day), end_at: at(day, 13),
})

function store() {
  const rows: StoredSession[] = []
  let nextId = 1
  const sync = (generated: GenSession[], title = 'Lịch tự sinh') => {
    const plan = planSessionSync(rows, generated, () => ({ title, note: 'Ghi chú lịch' }))
    for (const { id, patch } of plan.updates) Object.assign(rows.find(r => r.id === id)!, patch)
    for (const item of plan.inserts) rows.push({ ...item, id: `id-${nextId++}` })
    return plan
  }
  return { rows, sync }
}

test('sync/seed chạy lặp giữ ID, không tạo duplicate và không ghi đè title/note', () => {
  const db = store()
  db.sync([lesson(1), lesson(2), breakRow(3)])
  const ids = db.rows.map(r => r.id)
  const first = db.rows.find(r => r.session_number === 1)!
  first.title = 'Giáo viên đã sửa tiêu đề'
  first.note = 'Ghi chú riêng'
  const again = db.sync([lesson(1), lesson(2), breakRow(3)], 'Tên giáo trình mới')
  assert.deepEqual(again, { updates: [], inserts: [] })
  assert.deepEqual(db.rows.map(r => r.id), ids)
  assert.equal(first.title, 'Giáo viên đã sửa tiêu đề')
  assert.equal(first.note, 'Ghi chú riêng')
  assert.equal(new Set(db.rows.filter(r => r.session_number !== null).map(r => r.session_number)).size, 2)
  assert.equal(db.rows.find(r => r.event_type === 'break')?.session_number, null)
})

test('đổi ngày/giờ cập nhật buổi scheduled tại cùng ID; title chỉ điền lúc tạo', () => {
  const db = store()
  db.sync([lesson(1)])
  const original = db.rows[0]
  const id = original.id
  db.sync([lesson(1, 8, 20)], 'Tiêu đề sinh lại')
  assert.equal(original.id, id)
  assert.equal(original.start_at, at(8, 20))
  assert.equal(original.end_at, at(8, 21))
  assert.equal(original.title, 'Lịch tự sinh')
  // Postgres returns +00:00 while the generator emits Z: same instant means no write.
  original.start_at = original.start_at.replace('Z', '+00:00')
  original.end_at = original.end_at!.replace('Z', '+00:00')
  assert.equal(db.sync([lesson(1, 8, 20)]).updates.length, 0)
})

test('completed, cancelled và trạng thái giáo viên chỉnh giữ nguyên ID, thời gian và nội dung', () => {
  const db = store()
  db.sync([lesson(1), lesson(2), lesson(3), lesson(4)])
  const statuses = ['completed', 'cancelled', 'rescheduled', 'confirmed']
  db.rows.forEach((r, i) => { r.status = statuses[i]; r.note = `teacher-${i}` })
  const snapshot = structuredClone(db.rows)
  assert.equal(db.sync([lesson(1, 10), lesson(2, 11), lesson(3, 12), lesson(4, 13)]).updates.length, 0)
  assert.deepEqual(db.rows, snapshot)
})

test('buổi mới được thêm một lần; giảm số buổi chỉ hủy hàng cũ, tăng lại không tạo ID thứ hai', () => {
  const db = store()
  db.sync([lesson(1), lesson(2)])
  const id2 = db.rows[1].id
  const added = db.sync([lesson(1), lesson(2), lesson(3)])
  assert.equal(added.inserts.length, 1)
  const id3 = db.rows[2].id
  db.sync([lesson(1)])
  assert.equal(db.rows.find(r => r.id === id2)?.status, 'cancelled')
  assert.equal(db.rows.find(r => r.id === id3)?.status, 'cancelled')
  db.sync([lesson(1), lesson(2), lesson(3)])
  assert.equal(db.rows.length, 3)
  assert.equal(db.rows[1].id, id2)
  assert.equal(db.rows[2].id, id3)
})

test('break đồng bộ riêng, không va vào buổi đánh số và không bị tạo lại khi đổi ngày', () => {
  const db = store()
  db.sync([lesson(1), breakRow(2), lesson(2, 3)])
  const breakId = db.rows.find(r => r.event_type === 'break')!.id
  const lessonIds = db.rows.filter(r => r.event_type === 'lesson').map(r => r.id)
  db.sync([lesson(1), breakRow(9), lesson(2, 10)])
  assert.equal(db.rows.find(r => r.event_type === 'break')!.id, breakId)
  assert.deepEqual(db.rows.filter(r => r.event_type === 'lesson').map(r => r.id), lessonIds)
  assert.equal(db.rows.find(r => r.id === breakId)?.start_at, at(9))
  db.sync([lesson(1), lesson(2, 10)])
  assert.equal(db.rows.find(r => r.id === breakId)?.status, 'cancelled')
})

test('dữ liệu sinh sai hoặc va chạm với sự kiện khác bị chặn trước khi ghi', () => {
  assert.throws(() => planSessionSync([], [lesson(1), lesson(1)]), /trùng/)
  assert.throws(() => planSessionSync([{
    id: 'special', session_number: 1, event_type: 'special', status: 'scheduled', start_at: at(1), end_at: at(1, 13),
  }], [lesson(1)]), /đã thuộc/)
})

test('SQL seed adapter đọc lại DB mỗi lần và không phát INSERT/UPDATE khi chạy lặp', async () => {
  const rows: StoredSession[] = []
  const statements: string[] = []
  const sql = async (query: string): Promise<any[]> => {
    statements.push(query)
    if (query.startsWith('select id, session_number')) return structuredClone(rows)
    if (query.startsWith('insert into public.class_sessions')) {
      rows.push({ id: 'persisted-id', ...lesson(1), status: 'scheduled', title: 'Buổi 1', note: 'Giáo viên' })
      return []
    }
    if (query.startsWith('update public.class_sessions')) {
      const date = query.match(/start_at = '([^']+)'/)?.[1]
      if (date) rows[0].start_at = date
      const end = query.match(/end_at = '([^']+)'/)?.[1]
      if (end) rows[0].end_at = end
      return []
    }
    return [{ lessons: rows.length, breaks: 0 }]
  }
  const fields = () => ({ title: 'Buổi 1', note: 'Ghi chú lịch' })
  await syncSeedSessions(sql, 'class-id', [lesson(1)], fields)
  const writesAfterFirst = statements.filter(s => /^(insert|update|delete)/.test(s)).length
  await syncSeedSessions(sql, 'class-id', [lesson(1)], fields)
  assert.equal(statements.filter(s => /^(insert|update|delete)/.test(s)).length, writesAfterFirst)
  await syncSeedSessions(sql, 'class-id', [lesson(1, 9, 20)], fields)
  assert.equal(rows[0].id, 'persisted-id')
  assert.equal(rows[0].start_at, at(9, 20))
  assert.equal(rows[0].title, 'Buổi 1')
  assert.equal(rows[0].note, 'Giáo viên')
  assert.equal(statements.some(s => /^delete/i.test(s)), false)
})
