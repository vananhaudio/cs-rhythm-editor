// "Band của tôi" — mô hình thuần (không nạp supabase). "Band" ở đây = Team của TeamLab (bảng projects),
// KHÔNG phải bảng `bands` của Tuyển thành viên (src/band). Nguồn: teamlab_project_members (quan hệ thành viên thật).

export type MyBand = { id: string; name: string }

type Row = Record<string, unknown>
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Ghép dòng thành viên + dòng Team → danh sách Band (theo tên, rồi id — ổn định). Id lạ/trùng/thiếu Team bị bỏ. */
export function toMyBands(memberRows: unknown, projectRows: unknown): MyBand[] {
  const members = Array.isArray(memberRows) ? (memberRows as Row[]) : []
  const projects = Array.isArray(projectRows) ? (projectRows as Row[]) : []
  const byId = new Map<string, string>()
  for (const p of projects) {
    const id = typeof p.id === 'string' ? p.id : ''
    if (UUID_RE.test(id)) byId.set(id, typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'Band')
  }
  const seen = new Set<string>()
  const out: MyBand[] = []
  for (const m of members) {
    const id = typeof m.project_id === 'string' ? m.project_id : ''
    if (!byId.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push({ id, name: byId.get(id)! })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'vi') || a.id.localeCompare(b.id))
}

/** Deep link vào Band Home (màn Team của TeamLab) — hash cũ, cùng cơ chế đăng nhập/SSO; áp dụng cho cả Band riêng tư. */
export function bandHomeHref(projectId: string): string {
  return `/teamlab/#/project/${encodeURIComponent(projectId)}`
}

/** Hành động khi bấm: 1 Band → đi thẳng; 0 → hộp thoại "chưa có Band"; ≥2 → chọn. */
export type MyBandAction = { kind: 'go'; href: string } | { kind: 'none' } | { kind: 'choose'; bands: MyBand[] }
export function actionFor(bands: MyBand[]): MyBandAction {
  if (bands.length === 0) return { kind: 'none' }
  if (bands.length === 1) return { kind: 'go', href: bandHomeHref(bands[0].id) }
  return { kind: 'choose', bands }
}
