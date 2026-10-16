// admin-ai create_schedule: bỏ qua class_off_days + bảo toàn nhóm có sẵn. DB giả trong bộ nhớ — không chạm production.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateSessions } from '../../src/journey/sessions.ts'
import { createSchedule, genSessionsVN, resolveClassGroup, buildClassCode } from '../../supabase/functions/admin-ai/schedule.ts'

type Row = Record<string, any>
class FakeDb {
  t: Record<string, Row[]> = { edu_courses: [], edu_groups: [], class_schedule: [], class_sessions: [], class_off_days: [] }
  failOn: Record<string, string> = {}          // tên bảng → thông báo lỗi khi đọc
  failSessionsInsert = false
  writes: string[] = []
  seq = 0
  from(table: string) { return new Q(this, table) }
  id() { return 'id-' + (++this.seq) }
}
class Q {
  rows: Row[]; mode: 'select' | 'insert' = 'select'; payload: Row[] = []; single_ = false
  db: FakeDb; table: string
  constructor(db: FakeDb, table: string) { this.db = db; this.table = table; this.rows = [...db.t[table]] }
  select(_c?: string) { return this }
  ilike(col: string, v: string) { this.rows = this.rows.filter(r => String(r[col] ?? '').toLowerCase() === v.toLowerCase()); return this }
  eq(col: string, v: any) { this.rows = this.rows.filter(r => r[col] === v); return this }
  or(expr: string) { const ps = expr.split(',').map(x => x.split('.eq.')); this.rows = this.rows.filter(r => ps.some(([c, v]) => r[c] === v)); return this }
  limit(n: number) { this.rows = this.rows.slice(0, n); return this }
  insert(p: Row | Row[]) { this.mode = 'insert'; this.payload = Array.isArray(p) ? p : [p]; return this }
  single() { this.single_ = true; return this }
  then(res: (v: any) => any, rej?: (e: any) => any) { return Promise.resolve(this.run()).then(res, rej) }
  run() {
    const db = this.db, t = this.table
    if (this.mode === 'select') {
      if (db.failOn[t]) return { data: null, error: { message: db.failOn[t] } }
      return { data: this.rows, error: null }
    }
    if (t === 'class_sessions' && db.failSessionsInsert) return { data: null, error: { message: 'sessions boom' } }
    if (t === 'edu_groups') {   // unique(code) phân biệt hoa/thường như db/group_code_setup.sql
      for (const p of this.payload) if (db.t.edu_groups.some(g => g.code === p.code)) return { data: null, error: { code: '23505', message: 'duplicate key' } }
    }
    const made = this.payload.map(p => { const r = { id: db.id(), ...p }; db.t[t].push(r); db.writes.push(t); return r })
    return { data: this.single_ ? made[0] : made, error: null }
  }
}
const seed = (db: FakeDb) => { db.t.edu_courses.push({ id: 'c-dh1', name: 'Đệm hát 1', code: 'DH1' }); return db }
const CLS = (extra: Row = {}) => ({ nangLuc: 'DH1', so: '17', weekday: 2, time: '19:00', startDate: '2026-12-01', totalSessions: 4, ...extra })
const ymds = (db: FakeDb) => db.t.class_sessions.map(s => new Date(s.start_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }))

// ── Hành vi CŨ (bản trước khi sửa) — chứng minh lỗi ───────────────────────────────
function oldGen(startYmd: string, weekday: number, total: number) {
  const base = new Date(`${startYmd}T12:00:00+07:00`)
  const diff = ((weekday - base.getUTCDay()) % 7 + 7) % 7
  return Array.from({ length: total }, (_, i) => new Date(base.getTime() + (diff + i * 7) * 86400000).toISOString().slice(0, 10))
}
test('bản cũ: lịch rơi đúng vào ngày nghỉ (lỗi cần sửa)', () => {
  assert.ok(oldGen('2026-12-01', 2, 4).includes('2026-12-15'))
})

// ── genSessionsVN + ngày nghỉ ─────────────────────────────────────────────────────
const dates = (s: ReturnType<typeof genSessionsVN>) => s.map(x => x.ymd)
test('không có ngày nghỉ: giống hành vi cũ', () => {
  const s = genSessionsVN('2026-12-01', 2, '19:00', 90, 4)
  assert.deepEqual(dates(s), oldGen('2026-12-01', 2, 4)); assert.deepEqual(s.map(x => x.session_number), [1, 2, 3, 4])
})
test('một ngày nghỉ trùng thứ học: dời sang tuần sau, giữ đủ số buổi và số thứ tự', () => {
  const s = genSessionsVN('2026-12-01', 2, '19:00', 90, 4, ['2026-12-15'])
  assert.deepEqual(dates(s), ['2026-12-01', '2026-12-08', '2026-12-22', '2026-12-29']); assert.equal(s.length, 4)
  assert.deepEqual(s.map(x => x.session_number), [1, 2, 3, 4])
})
test('nhiều ngày nghỉ liên tiếp', () => {
  assert.deepEqual(dates(genSessionsVN('2026-12-01', 2, '19:00', 90, 3, ['2026-12-08', '2026-12-15', '2026-12-22'])), ['2026-12-01', '2026-12-29', '2027-01-05'])
})
test('ngày nghỉ không trùng thứ học: không ảnh hưởng', () => {
  assert.deepEqual(dates(genSessionsVN('2026-12-01', 2, '19:00', 90, 3, ['2026-12-10'])), ['2026-12-01', '2026-12-08', '2026-12-15'])
})
test('ngày bắt đầu trùng ngày nghỉ: buổi 1 dời sang tuần sau', () => {
  assert.deepEqual(dates(genSessionsVN('2026-12-01', 2, '19:00', 90, 2, ['2026-12-01'])), ['2026-12-08', '2026-12-15'])
})
test('qua cuối tháng và cuối năm, theo giờ Việt Nam', () => {
  const s = genSessionsVN('2026-12-22', 2, '19:00', 90, 4, ['2026-12-29'])
  assert.deepEqual(dates(s), ['2026-12-22', '2027-01-05', '2027-01-12', '2027-01-19'])
  assert.equal(s[0].start_at, '2026-12-22T12:00:00.000Z')   // 19:00 +07
})
test('ngày nghỉ sát buổi cuối: vẫn đủ số buổi', () => {
  const s = genSessionsVN('2026-12-01', 2, '19:00', 90, 4, ['2026-12-22'])
  assert.equal(s.length, 4); assert.equal(s[3].ymd, '2026-12-29'); assert.ok(!dates(s).includes('2026-12-22'))
})
test('ngày nghỉ dạng timestamp/khoảng trắng vẫn khớp; danh sách rất dài vẫn dừng', () => {
  assert.ok(!dates(genSessionsVN('2026-12-01', 2, '19:00', 90, 3, ['2026-12-08T00:00:00+00:00'])).includes('2026-12-08'))
  const many = Array.from({ length: 200 }, (_, i) => new Date(Date.UTC(2026, 11, 1 + i * 7)).toISOString().slice(0, 10))
  assert.equal(genSessionsVN('2026-12-01', 2, '19:00', 90, 3, many).length, 3)
})

// ── createSchedule: ngày nghỉ ─────────────────────────────────────────────────────
test('createSchedule bỏ qua class_off_days (chỉ bật)', async () => {
  const db = seed(new FakeDb())
  db.t.class_off_days.push({ off_date: '2026-12-15', is_active: true }, { off_date: '2026-12-22', is_active: false })
  // fake không lọc is_active ở .eq('is_active', true)? — eq có lọc theo cột → dòng tắt bị loại
  const r = await createSchedule(db as any, [CLS()])
  assert.equal(r[0].ok, true, JSON.stringify(r))
  assert.deepEqual(ymds(db), ['2026-12-01', '2026-12-08', '2026-12-22', '2026-12-29'])
  assert.equal(db.t.class_schedule[0].end_date, '2026-12-29'); assert.equal(db.t.class_sessions.length, 4)
})
test('lỗi đọc class_off_days: không ghi gì (không lặng lẽ bỏ qua)', async () => {
  const db = seed(new FakeDb()); db.failOn.class_off_days = 'boom'
  const r = await createSchedule(db as any, [CLS()])
  assert.equal(r[0].ok, false); assert.match(r[0].error, /class_off_days/)
  assert.deepEqual(db.writes, [])
})

// ── createSchedule: nhóm ──────────────────────────────────────────────────────────
const snap = (db: FakeDb) => JSON.stringify(db.t.edu_groups)
test('chưa có nhóm: tạo nhóm mới ≡ mã lớp và gắn vào lớp', async () => {
  const db = seed(new FakeDb())
  const r = await createSchedule(db as any, [CLS()])
  assert.equal(r[0].ok, true)
  assert.equal(db.t.edu_groups.length, 1); assert.equal(db.t.edu_groups[0].code, 'DH1.KD17'); assert.equal(db.t.edu_groups[0].group_type, 'zalo')
  assert.equal(db.t.class_schedule[0].group_id, db.t.edu_groups[0].id)
})
for (const type of ['class', 'zalo', 'facebook']) {
  test(`nhóm có sẵn loại ${type} (có zalo_url, tên riêng, metadata, thành viên): giữ NGUYÊN, chỉ gắn id`, async () => {
    const db = seed(new FakeDb())
    db.t.edu_groups.push({ id: 'g-old', code: 'DH1.KD17', name: 'Tên riêng', group_type: type, zalo_url: 'https://zalo.me/g/abc', is_active: false, metadata: { x: 1 }, member_count: 12 })
    const before = snap(db)
    const r = await createSchedule(db as any, [CLS()])
    assert.equal(r[0].ok, true, JSON.stringify(r))
    assert.equal(snap(db), before, 'dữ liệu nhóm không đổi')
    assert.equal(db.t.class_schedule[0].group_id, 'g-old')
    assert.ok(!db.writes.includes('edu_groups'))
  })
}
test('nhóm trùng mã (khác hoa/thường) vẫn được nhận ra, không tạo nhóm thứ hai', async () => {
  const db = seed(new FakeDb()); db.t.edu_groups.push({ id: 'g-old', code: 'dh1.kd17', name: 'x', group_type: 'zalo' })
  const r = await createSchedule(db as any, [CLS()])
  assert.equal(r[0].ok, true); assert.equal(db.t.edu_groups.length, 1)
})
test('nhóm đã gắn lớp khác: từ chối, không ghi gì', async () => {
  const db = seed(new FakeDb())
  db.t.edu_groups.push({ id: 'g-old', code: 'DH1.KD17', name: 'x', group_type: 'class' })
  db.t.class_schedule.push({ id: 'cls-other', code: 'KHAC', cohort_group_id: 'g-old', group_id: 'g-old' })
  const before = snap(db)
  const r = await createSchedule(db as any, [CLS()])
  assert.equal(r[0].ok, false); assert.match(r[0].error, /đã gắn với một lớp khác/)
  assert.equal(snap(db), before); assert.equal(db.t.class_schedule.length, 1); assert.equal(db.t.class_sessions.length, 0)
})
test('lỗi tạo lớp: nhóm có sẵn không bị đổi', async () => {
  const db = seed(new FakeDb())
  db.t.edu_groups.push({ id: 'g-old', code: 'DH1.KD17', name: 'x', group_type: 'class', zalo_url: 'z' })
  const before = snap(db)
  const orig = db.from.bind(db)
  db.from = (t: string) => { const q: any = orig(t); if (t === 'class_schedule') { const i = q.insert.bind(q); q.insert = (p: any) => { const r: any = i(p); r.then = (res: any) => Promise.resolve({ data: null, error: { message: 'insert boom' } }).then(res); return r } } return q }
  const r = await createSchedule(db as any, [CLS()])
  assert.equal(r[0].ok, false); assert.equal(snap(db), before)
})
test('hai yêu cầu cùng mã gần đồng thời: unique(code) → bên sau đọc lại nhóm bên trước, không ghi đè', async () => {
  const db = seed(new FakeDb())
  const [a, b] = await Promise.all([resolveClassGroup(db as any, 'DH1.KD17'), resolveClassGroup(db as any, 'DH1.KD17')])
  assert.ok('id' in a && 'id' in b)
  if ('id' in a && 'id' in b) assert.equal(a.id, b.id)
  assert.equal(db.t.edu_groups.length, 1)
})
test('mã lớp trùng class_schedule: từ chối, không tạo nhóm/buổi', async () => {
  const db = seed(new FakeDb()); db.t.class_schedule.push({ id: 'x', code: 'DH1.KD17' })
  const r = await createSchedule(db as any, [CLS()])
  assert.equal(r[0].ok, false); assert.equal(db.t.edu_groups.length, 0); assert.equal(db.t.class_sessions.length, 0)
})

// ── Hồi quy ───────────────────────────────────────────────────────────────────────
test('hồi quy: thiếu ngày/giờ → tạo lớp không sinh buổi; thiếu khoá; mã lớp; buổi lỗi → cảnh báo', async () => {
  const db = seed(new FakeDb())
  const r = await createSchedule(db as any, [{ nangLuc: 'DH1', so: '5' }, { nangLuc: 'XX', so: '1' }, { nangLuc: 'NM', so: '1' }])
  assert.equal(r[0].ok, true); assert.equal(db.t.class_sessions.length, 0)
  assert.equal(r[1].ok, false); assert.match(r[1].error, /không có khoá nào/)
  assert.equal(r[2].ok, false)
  assert.equal(buildClassCode('dh1', 7), 'DH1.KD07'); assert.equal(buildClassCode('NM', 1), null)
  const db2 = seed(new FakeDb()); db2.failSessionsInsert = true
  const r2 = await createSchedule(db2 as any, [CLS()])
  assert.equal(r2[0].ok, true); assert.match(r2[0].warn, /sinh buổi lỗi/)
})

// ── Tương đương với form Lớp & lịch (src/journey/sessions.ts generateSessions) ────────────────
test('khớp generateSessions của form: cùng ngày/số thứ tự với mọi ngày nghỉ (chạy ở giờ VN: TZ=Asia/Ho_Chi_Minh)', () => {
  const off = ['2026-12-15', '2027-01-05', '2027-01-12', '2027-02-09', '2027-02-16']
  for (const start of ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-31', '2027-02-08']) for (const wd of [0, 1, 2, 3, 6]) for (const skip of [[], off]) {
    const form = generateSessions(start, wd, '19:00', 90, 12, { skipDates: skip }).map(x => [x.session_number, x.start_at])
    const edge = genSessionsVN(start, wd, '19:00', 90, 12, skip).map(x => [x.session_number, x.start_at])
    assert.deepEqual(edge, form, `${start} wd${wd} skip${skip.length}`)
  }
})
