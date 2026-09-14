// ── SEED: SOLO-01 — Solo Guitar Căn Bản, 24 buổi (IDEMPOTENT, chạy lại vô hại) ──
// Upsert lớp SOLO01.TH01 + 28 dòng class_sessions (24 buổi học + 4 tuần nghỉ giữa chặng).
// Cùng cơ chế với scripts/seed-ht2027.ts: giữ buổi 'completed', xoá phần chưa học rồi sinh lại.
// Ngày nghỉ lễ ĐỌC TỪ class_off_days đang active (KHÔNG hardcode lại lịch nghỉ chung).
//
// Chạy:  npx tsx scripts/seed-solo01.ts
// Yêu cầu: SUPABASE_ACCESS_TOKEN (hoặc tự đọc Keychain "Supabase CLI").
import { execSync } from 'node:child_process'
import { generateSessions, realEndDate, realStartDate } from '../src/journey/sessions'
import { SOLO01, solo01LessonTitle } from '../src/data/solo01Program'

const PROJECT = 'wojmdilyflffvdtpovmq'
const token = process.env.SUPABASE_ACCESS_TOKEN || (() => {
  try { return execSync(`security find-generic-password -s "Supabase CLI" -a "supabase" -w`).toString().trim() }
  catch { throw new Error('Thiếu SUPABASE_ACCESS_TOKEN (hoặc Keychain Supabase CLI)') }
})()
const API = `https://api.supabase.com/v1/projects/${PROJECT}/database/query`
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

async function main() {
  console.log('→ Đọc lịch nghỉ chung (class_off_days đang active)…')
  const off = await sql(`select off_date from public.class_off_days where is_active = true order by off_date`)
  const skipDates = off.map((o: any) => String(o.off_date).slice(0, 10))
  console.log(`  ✓ ${skipDates.length} ngày nghỉ/lock dùng để dời buổi`)

  const sessions = generateSessions(
    SOLO01.proposedStartDate, SOLO01.weekday, SOLO01.startTime,
    SOLO01.durationMinutes, SOLO01.totalSessions,
    { breaksAfter: SOLO01.breaksAfter, skipDates },
  )
  const lessons = sessions.filter(s => s.event_type === 'lesson')
  const breaks = sessions.filter(s => s.event_type === 'break')
  if (lessons.length !== SOLO01.totalSessions) throw new Error(`Sinh lịch sai: ${lessons.length} buổi (kỳ vọng ${SOLO01.totalSessions})`)
  if (breaks.length !== SOLO01.breaksAfter.length * 2) throw new Error(`Sinh lịch sai: ${breaks.length} tuần nghỉ (kỳ vọng ${SOLO01.breaksAfter.length * 2})`)
  console.log(`→ Sinh lịch: ${lessons.length} buổi học + ${breaks.length} tuần nghỉ`)
  console.log(`  Khai giảng: ${realStartDate(sessions)} → Kết thúc: ${realEndDate(sessions)}`)

  console.log('→ Upsert lớp SOLO01.TH01…')
  const cls = await sql(`select id from public.class_schedule where program_code = '${SOLO01.programCode}' limit 1`)
  const clsRow = cls[0] ?? (await sql(`select id from public.class_schedule where code = '${SOLO01.classCode}' limit 1`))[0]
  let cid: string | null = clsRow?.id ?? null
  const common = `
    code = '${SOLO01.classCode}', name = ${sq(SOLO01.name)},
    schedule = 'Thứ 5 · 19h00', start_text = ${sq(realStartDate(sessions)!)},
    duration = '24 buổi · 90 phút/buổi · khoảng 6 tháng',
    start_date = ${sq(realStartDate(sessions)!)}, weekday = ${SOLO01.weekday},
    start_time = ${sq(SOLO01.startTime)}, duration_minutes = ${SOLO01.durationMinutes},
    total_sessions = ${SOLO01.totalSessions}, end_date = ${sq(realEndDate(sessions)!)},
    status = 'scheduled', program_code = ${sq(SOLO01.programCode)},
    breaks_after = '{${SOLO01.breaksAfter.join(',')}}', timezone = ${sq(SOLO01.timezone)}`
  if (!cid) {
    // is_active = false → KHÔNG hiện trên trang tuyển sinh /class; landing /solo01 đọc theo program_code.
    const ins = await sql(`insert into public.class_schedule (code, name, section, course_ids, group_id, zoom_url, sort_order, is_active, main_course_id, price)
      values ('${SOLO01.classCode}', ${sq(SOLO01.name)}, 'upcoming', '{}', NULL, NULL, 0, false, NULL, NULL) returning id`)
    if (!ins[0]?.id) throw new Error('Không tạo được lớp SOLO-01')
    cid = ins[0].id
    await sql(`update public.class_schedule set ${common} where id = '${cid}'`)
    console.log('  ✓ Tạo lớp mới (ẩn khỏi trang tuyển sinh — is_active=false)')
  } else {
    await sql(`update public.class_schedule set ${common} where id = '${cid}'`)
    console.log('  ✓ Đã có lớp, cập nhật theo lịch mới')
  }

  console.log('→ Đồng bộ class_sessions…')
  const old = await sql(`select session_number from public.class_sessions where class_id = '${cid}' and status = 'completed'`)
  const doneNums = new Set(old.map((r: any) => r.session_number))
  await sql(`delete from public.class_sessions where class_id = '${cid}' and status <> 'completed'`)
  const rows = sessions
    .filter(s => !(s.event_type === 'lesson' && doneNums.has(s.session_number)))
    .map(s => {
      const num = s.session_number === null ? 'null' : s.session_number
      const title = s.event_type === 'lesson'
        ? `Buổi ${s.session_number} · ${solo01LessonTitle(s.session_number as number)}`
        : 'Nghỉ giữa chặng – thời gian tự luyện và hoàn thiện sản phẩm'
      const note = s.event_type === 'lesson' ? `Chặng ${Math.ceil((s.session_number as number) / 8)}` : 'nghỉ giữa chặng'
      const status = s.event_type === 'break' ? 'holiday' : 'scheduled'
      return `('${cid}', ${num}, ${sq(title)}, '${s.start_at}', '${s.end_at}', '${status}', ${sq(note)}, '${s.event_type}')`
    })
  for (let i = 0; i < rows.length; i += 200) {
    await sql(`insert into public.class_sessions (class_id, session_number, title, start_at, end_at, status, note, event_type)
      values ${rows.slice(i, i + 200).join(',')}`)
  }
  const cnt = await sql(`select count(*) as n, count(*) filter (where event_type = 'break') as br from public.class_sessions where class_id = '${cid}'`)
  console.log(`  ✓ ${cnt[0].n} dòng (${cnt[0].n - cnt[0].br} buổi học + ${cnt[0].br} tuần nghỉ) — giữ ${doneNums.size} buổi đã hoàn thành`)
  console.log('\n✅ XONG — landing /solo01 sẽ đọc lịch này từ class_sessions/class_off_days.')
}

main().catch(e => { console.error('\n❌ LỖI:', e.message); process.exit(1) })
