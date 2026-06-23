// Edge Function: class-schedule
// Đọc thời khoá biểu thật từ Google Sheet (tab TongHop) → JSON cho trang /class.
// Tự phân khối theo dòng tiêu đề (đang học / sắp khai giảng / 1 kèm 1 / nhóm nhỏ).
// Lớp 1 kèm 1 & nhóm nhỏ: GIẤU TÊN học viên, lịch hiển thị "linh động".
// DEPLOY: Verify JWT = TẮT (khách ẩn danh gọi). Sheet phải để "Anyone with link: Viewer".
const SHEET_ID = '17x2Uhw6iDqS13mbOPRVNGyh8D8clmYHIjAKyO4ShOe8'
const GID = '602951409'
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}&headers=0`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } })

// Parser CSV nhỏ, hỗ trợ trường có dấu phẩy/ngoặc kép
function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false }
      else cur += c
    } else {
      if (c === '"') q = true
      else if (c === ',') { row.push(cur); cur = '' }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
      else if (c === '\r') { /* skip */ }
      else cur += c
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row) }
  return rows
}

const norm = (s: string) => (s || '').trim()
const up = (s: string) => norm(s).toUpperCase()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const res = await fetch(CSV_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return json({ error: 'Không đọc được sheet', status: res.status }, 502)
    const rows = parseCSV(await res.text())

    const upcoming: any[] = []   // sắp khai giảng (có tên khoá)
    const active: any[] = []     // đang học (lớp nhóm, tên khoá)
    const smallGroup: any[] = [] // nhóm nhỏ (ẩn tên, chỉ lịch)
    let oneOnOneCount = 0        // 1 kèm 1 (chỉ đếm, ẩn tên)

    let section: 'active' | 'upcoming' | 'oneonone' | 'smallgroup' = 'active'
    for (let r = 0; r < rows.length; r++) {
      const a = norm(rows[r][0]); if (!a) continue
      const A = up(a)
      if (r === 0 && A === 'LỚP') continue                 // dòng tiêu đề cột
      if (A.includes('SẮP KHAI GIẢNG')) { section = 'upcoming'; continue }
      if (A.includes('KÈM 1')) { section = 'oneonone'; continue }
      if (A.includes('NHÓM NHỎ')) { section = 'smallgroup'; continue }
      if (A === 'LỚP' || A === 'MÃ SỐ LỚP HỌC') continue   // dòng tiêu đề lặp

      const code = norm(rows[r][1]); const schedule = norm(rows[r][2])
      const start = norm(rows[r][3]); const duration = norm(rows[r][4])

      if (section === 'oneonone') { oneOnOneCount++; continue }                 // GIẤU TÊN
      if (section === 'smallgroup') { if (schedule) smallGroup.push({ schedule }); else oneOnOneCount += 0; continue } // ẩn tên, chỉ lịch
      const item = { name: a, code, schedule, start, duration }
      if (section === 'upcoming') upcoming.push(item)
      else active.push(item)
    }

    return json({
      upcoming, active, smallGroup, oneOnOneCount,
      activeCount: active.length + smallGroup.length + oneOnOneCount,
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
