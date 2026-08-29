// ── SEED: Hành trình 2027 — 40 buổi thực hành (IDEMPOTENT, chạy lại vô hại) ──
// Upsert lớp HT2027.TH01 + lịch nghỉ chung class_off_days + 48 dòng class_sessions
// (40 buổi học + 8 tuần nghỉ giữa chặng). Không tạo sự kiện trùng: giữ buổi
// 'completed', xoá buổi chưa hoàn thành rồi sinh lại (cùng cơ chế ScheduleManager).
//
// Chạy:  npx tsx scripts/seed-ht2027.ts
// Yêu cầu: 1) Migration db/ht2027_practice_setup.sql đã chạy trên Supabase.
//          2) SUPABASE_ACCESS_TOKEN (hoặc tự đọc từ Keychain "Supabase CLI").
//
// ⚠️ CHỈ CHẠY SAU KHI THẦY DUYỆT lịch dự kiến (docs/HT2027-40-BUOI-THUC-HANH.md).
import { execSync } from 'node:child_process'
import { generateSessions, realEndDate, realStartDate } from '../src/journey/sessions'
import { HT2027, ht2027LessonTitle } from '../src/data/ht2027Program'

const PROJECT = 'wojmdilyflffvdtpovmq'
const token = process.env.SUPABASE_ACCESS_TOKEN || (() => {
  try { return execSync(`security find-generic-password -s "Supabase CLI" -a "supabase" -w`).toString().trim() }
  catch { throw new Error('Thiếu SUPABASE_ACCESS_TOKEN (hoặc Keychain Supabase CLI)') }
})()
const API = `https://api.supabase.com/v1/projects/${PROJECT}/database/query`

// Escape chuỗi SQL (nháy đơn)
const sq = (v: string) => "'" + v.replace(/'/g, "''") + "'"

async function sql(query: string): Promise<any[]> {
  const r = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`SQL lỗi (${r.status}): ${t.slice(0, 800)}`)
  return t ? JSON.parse(t) : []
}

// ── Lịch nghỉ/lock chung 2027 (DỰ KIẾN — chỉnh sửa được trong class_off_days) ──
const OFF_DAYS_2027: { off_date: string; reason: string; source: 'official' | 'tet' | 'admin' }[] = [
  { off_date: '2027-01-01', reason: 'Tết Dương lịch 1/1', source: 'official' },
  { off_date: '2027-02-01', reason: 'Tết Nguyên Đán (dự kiến — chờ công bố chính thức)', source: 'tet' },
  { off_date: '2027-02-02', reason: 'Tết Nguyên Đán (dự kiến — chờ công bố chính thức)', source: 'tet' },
  { off_date: '2027-02-03', reason: 'Tết Nguyên Đán (dự kiến — chờ công bố chính thức)', source: 'tet' },
  { off_date: '2027-02-04', reason: 'Tết Nguyên Đán (dự kiến — chờ công bố chính thức)', source: 'tet' },
  { off_date: '2027-02-05', reason: 'Tết Nguyên Đán (dự kiến — chờ công bố chính thức)', source: 'tet' },
  { off_date: '2027-02-06', reason: 'Tết Nguyên Đán — Mùng 1 (dự kiến)', source: 'tet' },
  { off_date: '2027-02-07', reason: 'Tết Nguyên Đán (dự kiến — chờ công bố chính thức)', source: 'tet' },
  { off_date: '2027-02-08', reason: 'Tết Nguyên Đán (dự kiến — chờ công bố chính thức)', source: 'tet' },
  { off_date: '2027-02-09', reason: 'Tết Nguyên Đán (dự kiến — chờ công bố chính thức)', source: 'tet' },
  { off_date: '2027-02-10', reason: 'Tết Nguyên Đán (dự kiến — chờ công bố chính thức)', source: 'tet' },
  { off_date: '2027-02-11', reason: 'Tết Nguyên Đán (dự kiến — chờ công bố chính thức)', source: 'tet' },
  { off_date: '2027-02-12', reason: 'Tết Nguyên Đán (dự kiến — chờ công bố chính thức)', source: 'tet' },
  { off_date: '2027-02-13', reason: 'Tết Nguyên Đán (dự kiến — chờ công bố chính thức)', source: 'tet' },
  { off_date: '2027-02-14', reason: 'Tết Nguyên Đán (dự kiến — chờ công bố chính thức)', source: 'tet' },
  { off_date: '2027-04-16', reason: 'Giỗ Tổ Hùng Vương 10/3 AL (dự kiến)', source: 'official' },
  { off_date: '2027-04-30', reason: 'Ngày Giải phóng miền Nam 30/4', source: 'official' },
  { off_date: '2027-05-01', reason: 'Ngày Quốc tế Lao động 1/5', source: 'official' },
  { off_date: '2027-09-02', reason: 'Quốc khánh 2/9 — thứ Năm, bỏ buổi thực hành', source: 'official' },
]

async function main() {
  console.log('→ Upsert lịch nghỉ chung class_off_days 2027…')
  for (const od of OFF_DAYS_2027) {
    await sql(`insert into public.class_off_days (off_date, reason, source, is_active)
      values ('${od.off_date}', ${sq(od.reason)}, '${od.source}', true)
      on conflict (off_date) do update set reason = excluded.reason, source = excluded.source, is_active = true`)
  }
  console.log(`  ✓ ${OFF_DAYS_2027.length} ngày nghỉ/lock (chạy lại = cập nhật, không trùng)`)

  // ── Upsert lớp chương trình ──
  const skipDates = OFF_DAYS_2027.map(o => o.off_date)
  const sessions = generateSessions(
    HT2027.proposedStartDate, HT2027.weekday, HT2027.startTime,
    HT2027.durationMinutes, HT2027.totalSessions,
    { breaksAfter: HT2027.breaksAfter, skipDates },
  )
  if (sessions.length !== HT2027.totalSessions + HT2027.breaksAfter.length * 2) throw new Error(`Sinh lịch sai: ${sessions.length} dòng (kỳ vọng ${HT2027.totalSessions} buổi + ${HT2027.breaksAfter.length * 2} tuần nghỉ)`)
  const lessons = sessions.filter(s => s.event_type === 'lesson')
  if (lessons.length !== HT2027.totalSessions) throw new Error(`Sinh lịch sai: chỉ ${lessons.length} buổi học (kỳ vọng ${HT2027.totalSessions})`)
  const breaks = sessions.filter(s => s.event_type === 'break')
  console.log(`→ Sinh lịch: ${lessons.length} buổi học + ${breaks.length} tuần nghỉ`)
  console.log(`  Khai giảng: ${realStartDate(sessions)} → Kết thúc: ${realEndDate(sessions)}`)

  console.log('→ Upsert lớp HT2027.TH01…')
  const cls = await sql(`select id from public.class_schedule where program_code = '${HT2027.programCode}' limit 1`)
  const clsRow = cls[0] ?? (await sql(`select id from public.class_schedule where code = '${HT2027.classCode}' limit 1`))[0]
  let cid: string | null = clsRow?.id ?? null
  if (!cid) {
    const ins = await sql(`insert into public.class_schedule (
        code, name, section, schedule, start_text, duration, price, course_ids, group_id, zoom_url,
        sort_order, is_active, main_course_id,
        start_date, weekday, start_time, duration_minutes, total_sessions, end_date, status,
        program_code, breaks_after, timezone
      ) values (
        '${HT2027.classCode}', ${sq(HT2027.name)}, 'upcoming',
        'Thứ 5 · 20h30', ${sq(realStartDate(sessions) || '')}, '40 buổi · 90 phút/buổi · 1 năm',
        NULL, '{}', NULL, NULL, 0, false, NULL,
        ${sq(realStartDate(sessions)!)}, ${HT2027.weekday}, ${sq(HT2027.startTime)},
        ${HT2027.durationMinutes}, ${HT2027.totalSessions}, ${sq(realEndDate(sessions)!)}, 'scheduled',
        ${sq(HT2027.programCode)}, '{${HT2027.breaksAfter.join(',')}}', ${sq(HT2027.timezone)}
      ) returning id`)
    if (!ins[0]?.id) throw new Error('Không tạo được lớp HT2027')
    cid = ins[0].id
    console.log(`  ✓ Tạo lớp mới (ẩn khỏi trang tuyển sinh — is_active=false)`)
  } else {
    await sql(`update public.class_schedule set
        code = '${HT2027.classCode}', name = ${sq(HT2027.name)},
        schedule = 'Thứ 5 · 20h30', start_text = ${sq(realStartDate(sessions) || '')},
        duration = '40 buổi · 90 phút/buổi · 1 năm', course_ids = '{}', is_active = is_active,
        start_date = ${sq(realStartDate(sessions)!)}, weekday = ${HT2027.weekday},
        start_time = ${sq(HT2027.startTime)}, duration_minutes = ${HT2027.durationMinutes},
        total_sessions = ${HT2027.totalSessions}, end_date = ${sq(realEndDate(sessions)!)},
        status = 'scheduled', program_code = ${sq(HT2027.programCode)},
        breaks_after = '{${HT2027.breaksAfter.join(',')}}', timezone = ${sq(HT2027.timezone)}
      where id = '${cid}'`)
    console.log(`  ✓ Đã có lớp, cập nhật theo lịch mới`)
  }
  // ── Đồng bộ buổi học (giữ buổi completed, xoá + sinh lại phần còn lại) ──
  console.log('→ Đồng bộ class_sessions…')
  const old = await sql(`select session_number from public.class_sessions where class_id = '${cid}' and status = 'completed'`)
  const doneNums = new Set(old.map((r: any) => r.session_number))
  await sql(`delete from public.class_sessions where class_id = '${cid}' and status <> 'completed'`)
  const rows = sessions
    .filter(s => !(s.event_type === 'lesson' && doneNums.has(s.session_number)))
    .map(s => {
      const num = s.session_number === null ? 'null' : s.session_number
      const title = s.event_type === 'lesson'
        ? `Buổi ${s.session_number} · ${ht2027LessonTitle(s.session_number as number)}`
        : 'Nghỉ giữa chặng – thời gian tự luyện và hoàn thiện sản phẩm'
      const note = s.event_type === 'lesson' ? `Chặng ${Math.ceil((s.session_number as number) / 8)}` : 'nghỉ giữa chặng'
      const status = s.event_type === 'break' ? 'holiday' : 'scheduled'
      return `('${cid}', ${num}, ${sq(title)}, '${s.start_at}', '${s.end_at}', '${status}', '${note}', '${s.event_type}')`
    })
  if (rows.length) {
    const chunk = 200
    for (let i = 0; i < rows.length; i += chunk) {
      await sql(`insert into public.class_sessions (class_id, session_number, title, start_at, end_at, status, note, event_type)
        values ${rows.slice(i, i + chunk).join(',')}`)
    }
  }
  const cnt = await sql(`select count(*) as n, count(*) filter (where event_type = 'break') as br from public.class_sessions where class_id = '${cid}'`)
  console.log(`  ✓ ${cnt[0].n} dòng (${cnt[0].n - cnt[0].br} buổi học + ${cnt[0].br} tuần nghỉ) — giữ ${doneNums.size} buổi đã hoàn thành`)
  console.log('\n✅ XONG — landing /hanhtrinh2027 sẽ đọc lịch này từ class_sessions/class_off_days.')
}

main().catch(e => { console.error('\n❌ LỖI:', e.message); process.exit(1) })
