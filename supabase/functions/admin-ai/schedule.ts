// Tạo lịch lớp cho action `create_schedule` của admin-ai. Tách khỏi index.ts để kiểm thử được (không dùng Deno global,
// client Supabase được truyền vào). Quy tắc lấy từ form Lớp & lịch (src/ScheduleManager.tsx, src/journey/sessions.ts).

// Bộ luật Hành trình 2027 — mã năng lực → dạng lớp; ghép mã lớp. (đồng bộ với src/hanhtrinh.ts)
const DANG_LOP: Record<string, string> = { DH1: 'KD', DH2: 'KD', DH3: 'BP', TN1: 'GL', TN2: 'GL', TN3: 'GL' }
export const buildClassCode = (nangLuc: string, so: string | number): string | null => {
  const c = (nangLuc || '').trim().toUpperCase(); const dl = DANG_LOP[c]
  const n = String(so ?? '').replace(/\D/g, '')
  return (dl && n) ? `${c}.${dl}${n.padStart(2, '0')}` : null
}

// ── Sinh buổi học theo GIỜ VIỆT NAM (+07:00) — edge function chạy UTC nên phải ghim múi giờ ──
// Cùng quy ước src/journey/sessions.ts: buổi 1 = ngày đầu >= startDate rơi đúng thứ; mỗi buổi cách 7 ngày.
// skipDates (class_off_days đang bật): ngày trùng thì DỜI sang tuần sau và GIỮ số thứ tự buổi — như form Lớp & lịch.
const DAY_MS = 86400000
const ymdOfVN = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
export function genSessionsVN(startYmd: string, weekday: number, hm: string, durMin: number, total: number, skipDates: string[] = []) {
  // mốc 12:00 VN của startYmd → getUTCDay() trả đúng thứ theo lịch VN
  const base = new Date(`${startYmd}T12:00:00+07:00`)
  if (isNaN(base.getTime())) return []
  const skip = new Set(skipDates.map(d => (d || '').slice(0, 10)))
  const diff = ((weekday - base.getUTCDay()) % 7 + 7) % 7
  const out: { session_number: number; start_at: string; end_at: string; ymd: string }[] = []
  // Mỗi tuần là một ngày khác nhau nên mỗi ngày nghỉ chỉ chặn tối đa một lần → vòng lặp luôn dừng.
  for (let week = 0; out.length < total && week < total + skip.size + 1; week++) {
    const day = new Date(base.getTime() + (diff + week * 7) * DAY_MS)   // 05:00Z = 12:00 VN cùng ngày → getUTC* ra đúng lịch VN
    const ymd = ymdOfVN(day)
    if (skip.has(ymd)) continue
    const s = new Date(`${ymd}T${hm}:00+07:00`)
    out.push({ session_number: out.length + 1, start_at: s.toISOString(), end_at: new Date(s.getTime() + durMin * 60000).toISOString(), ymd })
  }
  return out
}
export const dmyVN = (ymd: string) => { const [y, m, d] = ymd.split('-'); return `${d}/${m}/${y}` }

// Nhóm thành viên của lớp mới ≡ mã lớp. NHÓM ĐÃ CÓ ĐƯỢC BẢO TOÀN: không đổi tên/loại/zalo_url/trạng thái/thành viên.
// (Trước đây upsert đè group_type='zalo' + name=code lên cả nhóm loại 'class' — service_role bỏ qua RLS đã chặn việc đó.)
// Trả { id } khi dùng được, { error } khi không nên gắn tự động.
type Db = { from: (table: string) => any }
export async function resolveClassGroup(admin: Db, code: string): Promise<{ id: string; reused: boolean } | { error: string }> {
  const find = async () => {
    const { data, error } = await admin.from('edu_groups').select('id,group_type').ilike('code', code).limit(1)
    if (error) throw new Error('không kiểm tra được nhóm của lớp: ' + error.message)
    return (data ?? [])[0] as { id: string; group_type: string } | undefined
  }
  let g = await find()
  if (g) {
    // Nhóm đã gắn lớp khác thì không tự gắn thêm lớp mới vào (tránh trộn thành viên hai lớp).
    const { data: used, error } = await admin.from('class_schedule').select('id').or(`group_id.eq.${g.id},cohort_group_id.eq.${g.id}`).limit(1)
    if (error) throw new Error('không kiểm tra được nhóm đã gắn lớp: ' + error.message)
    if (used?.length) return { error: `nhóm mã ${code} đã gắn với một lớp khác — không tự gắn lại; kiểm tra ở Lớp & lịch` }
    return { id: g.id, reused: true }
  }
  const ins = await admin.from('edu_groups').insert({ code, name: code, group_type: 'zalo', is_active: true }).select('id').single()
  if (ins.error) {
    // Hai yêu cầu cùng mã gần đồng thời: unique(code) chặn một bên → đọc lại nhóm bên kia vừa tạo, không ghi đè.
    if ((ins.error as { code?: string }).code === '23505') {
      g = await find()
      if (g) return { id: g.id, reused: true }
    }
    throw new Error('tạo nhóm của lớp lỗi: ' + ins.error.message)
  }
  return { id: ins.data.id, reused: false }
}

// Tạo lịch lớp — từ MÃ NĂNG LỰC + SỐ KHOÁ: ghép mã lớp, gắn khoá chính, khớp/tạo nhóm ≡ mã lớp (xem resolveClassGroup).
// Có startDate + weekday + time → sinh LỊCH THẬT + BUỔI HỌC (class_sessions) như form trong /admin, bỏ qua class_off_days.
export async function createSchedule(admin: Db, classes: any[]) {
  const { data: allCourses } = await admin.from('edu_courses').select('id,name,code')
  const byCode: Record<string, any> = {}
  ;(allCourses ?? []).forEach((c: any) => { if (c.code) byCode[c.code.trim().toUpperCase()] = c })
  // Đọc ngày nghỉ MỘT lần, TRƯỚC mọi thao tác ghi. Lỗi đọc → không tạo gì (không lặng lẽ bỏ qua).
  const offQ = await admin.from('class_off_days').select('off_date').eq('is_active', true)
  if (offQ.error) {
    return classes.map((c: any) => ({ email: (c.nangLuc || '') + (c.so ? '.' + c.so : '') || '(lớp)', ok: false, error: 'không đọc được lịch nghỉ (class_off_days): ' + offQ.error.message }))
  }
  const skipDates = ((offQ.data ?? []) as { off_date: string }[]).map(r => r.off_date)
  const results: any[] = []
  for (const c of classes) {
    try {
      const nl = (c.nangLuc || '').trim().toUpperCase()
      const main = byCode[nl]
      if (!main) throw new Error('không có khoá nào mang mã năng lực "' + nl + '" (gán mã ở Khoá học trước)')
      const code = buildClassCode(nl, c.so)
      if (!code) throw new Error('không ghép được mã lớp (thiếu số khoá hoặc mã không có dạng lớp)')
      // Chặn trùng mã lớp (1 lớp = 1 mã)
      const { data: dup } = await admin.from('class_schedule').select('id').ilike('code', code).limit(1)
      if (dup?.length) throw new Error(`mã lớp ${code} đã có trong lịch — kiểm tra lại số khoá`)
      // Lịch thật (nếu AI đưa đủ startDate + weekday + time) — tính xong trước khi ghi nhóm/lớp
      const weekday = (typeof c.weekday === 'number' && c.weekday >= 0 && c.weekday <= 6) ? c.weekday : null
      const time = /^\d{1,2}:\d{2}$/.test(c.time || '') ? c.time : null
      const startDate = /^\d{4}-\d{2}-\d{2}$/.test(c.startDate || '') ? c.startDate : null
      const total = Math.max(1, Number(c.totalSessions) || 8)
      const durMin = Math.max(15, Number(c.durationMinutes) || 90)
      const sessions = (startDate && weekday !== null && time) ? genSessionsVN(startDate, weekday, time, durMin, total, skipDates) : []
      const realStart = sessions[0]?.ymd ?? startDate
      const realEnd = sessions[sessions.length - 1]?.ymd ?? null
      // Nhóm ≡ mã lớp — khớp nhóm có sẵn (không sửa) hoặc tạo mới
      const g = await resolveClassGroup(admin, code)
      if ('error' in g) throw new Error(g.error)
      const rec: any = {
        code, name: main.name, section: c.section || 'upcoming',
        schedule: (c.schedule || '').trim() || (weekday !== null && time ? `${weekday === 0 ? 'Chủ nhật' : 'Thứ ' + (weekday + 1)} · ${time.replace(':', 'h')}` : null),
        start_text: (c.start || '').trim() || (realStart ? dmyVN(realStart) : null),
        duration: `${total} buổi · mỗi buổi ${durMin} phút`,
        price: nl === 'NM' ? 'Free' : '990k',
        course_ids: [main.id], main_course_id: main.id, group_id: g.id,
        start_date: realStart, weekday, start_time: time,
        duration_minutes: durMin, total_sessions: total, end_date: realEnd, status: 'upcoming',
      }
      const { data: ins, error } = await admin.from('class_schedule').insert(rec).select('id').single()
      if (error) throw new Error(error.message)
      if (ins?.id && sessions.length) {
        const { error: sErr } = await admin.from('class_sessions').insert(
          sessions.map(s => ({ class_id: ins.id, session_number: s.session_number, start_at: s.start_at, end_at: s.end_at, status: 'scheduled' })))
        if (sErr) { results.push({ email: code, ok: true, group: `${main.name} · nhóm ${code}`, warn: 'lớp tạo OK nhưng sinh buổi lỗi: ' + sErr.message }); continue }
      }
      results.push({ email: code, ok: true, group: main.name + ' · nhóm ' + code + (g.reused ? ' (dùng nhóm có sẵn, giữ nguyên)' : ' (tạo mới)')
        + (sessions.length ? ` · ${total} buổi, KG ${dmyVN(realStart!)} → KT ${dmyVN(realEnd!)}` : ' · (chưa có ngày/giờ — lớp chỉ có text, vào form Sửa để bổ sung)') })
    } catch (e) {
      results.push({ email: (c.nangLuc || '') + (c.so ? '.' + c.so : '') || '(lớp)', ok: false, error: String((e as Error)?.message || e) })
    }
  }
  return results
}
