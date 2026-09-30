// ─────────────────────────────────────────────────────────────────────────────
// LEARNING IDENTITY V1 — "Danh tính học tập". MỘT helper duy nhất (THUẦN, test được): từ các lớp người đó
// đang là thành viên (RPC social_learning_identities — đúng luật thành viên Lớp học V1) suy ra:
//   nhãn CHƯƠNG TRÌNH thân thiện · trạng thái Đang học / Sắp học / Đã tốt nghiệp · bậc hiển thị · thứ tự.
// Không component nào tự đặt tên badge. Không đổi tên gốc trong DB. Không liên quan quyền lợi/gói (phase sau có thể
// nối Learning Identity → Benefits qua `key`). Khác HẲN danh tính LỊCH SỬ của Learning Thread (snapshot, không đổi).
// ─────────────────────────────────────────────────────────────────────────────

/** Một lớp mà người đó là thành viên (dạng hàng từ RPC). */
export type MembershipRow = {
  class_id?: string | null
  class_code?: string | null
  class_name?: string | null
  status?: string | null
  program_code?: string | null
  course_code?: string | null
  course_name?: string | null
  track?: string | null
  start_date?: string | null
}

export type IdentityState = 'current' | 'upcoming' | 'graduated'
/** Bậc hiển thị = độ đặc biệt / cao của CHƯƠNG TRÌNH (không xếp hạng con người). */
export type IdentityTier = 'base' | 'intermediate' | 'advanced' | 'special'

export type LearningIdentity = {
  key: string            // khoá chương trình ổn định (vd 'dh-2', 'ht-2027') — dùng để gộp trùng / loại trừ ngữ cảnh
  label: string          // "Đệm hát 2" · "Hành trình 2027" · "Solo Guitar"
  state: IdentityState
  tier: IdentityTier
  level: number          // tiến trình trong cùng họ chương trình (1, 2, 3…) — chỉ để sắp xếp / độ đậm nhẹ
  title: string          // tooltip: tên lớp đầy đủ (+ mã) — mã lớp chỉ là metadata phụ
}

export type LearningIdentities = { current: LearningIdentity[]; upcoming: LearningIdentity[]; graduated: LearningIdentity[] }
export const NO_IDENTITY: LearningIdentities = Object.freeze({ current: [], upcoming: [], graduated: [] }) as LearningIdentities

// Trạng thái lớp (class_schedule.status) → trạng thái danh tính. cancelled / merged / draft: không có danh tính.
const STATE_OF: Record<string, IdentityState> = {
  active: 'current', ending_soon: 'current', paused: 'current',
  recruiting: 'upcoming', ready_to_open: 'upcoming', scheduled: 'upcoming', upcoming: 'upcoming',
  completed: 'graduated',
}
const STATE_RANK: Record<IdentityState, number> = { current: 3, upcoming: 2, graduated: 1 }

const tierOf = (level: number): IdentityTier => (level >= 3 ? 'advanced' : level === 2 ? 'intermediate' : 'base')

/**
 * CHƯƠNG TRÌNH của một lớp — theo mã khoá / mã chương trình (quy luật mã, không hard-code từng lớp):
 *   HT2027 (program_code / mã lớp HT2027.*)  → "Hành trình 2027"  (đặc biệt)
 *   DH1 / DH2 → "Đệm hát 1/2" · DHNC, DH3 → "Đệm hát nâng cao" · TN1… → "Tỉa nốt 1…" · SOLO… → "Solo Guitar"
 *   CB1 / CB2 → "Guitar căn bản 1/2" · khác → tên khoá / tên lớp thân thiện (không bao giờ bỏ, không "?")
 */
export function programOf(r: MembershipRow): Pick<LearningIdentity, 'key' | 'label' | 'tier' | 'level'> {
  const codes = [r.program_code, r.course_code, r.class_code].map(c => (c ?? '').trim().toUpperCase())
  for (const c of codes) {
    const ht = /^HT[\s._-]?(20\d{2})\b/.exec(c)
    if (ht) return { key: 'ht-' + ht[1], label: 'Hành trình ' + ht[1], tier: 'special', level: 9 }
  }
  // Ưu tiên mã KHOÁ; không có thì tiền tố mã lớp (DH2.KD0826 → DH2) hoặc mã chương trình
  const base = codes[1] || codes[0] || codes[2].split('.')[0]
  let m: RegExpExecArray | null
  if (/^DH(NC|3)/.test(base)) return { key: 'dh-nc', label: 'Đệm hát nâng cao', tier: tierOf(3), level: 3 }
  if ((m = /^DH(\d)/.exec(base))) { const n = +m[1]; return { key: 'dh-' + n, label: 'Đệm hát ' + n, tier: tierOf(n), level: n } }
  if ((m = /^TN(\d)/.exec(base))) { const n = +m[1]; return { key: 'tn-' + n, label: 'Tỉa nốt ' + n, tier: tierOf(n), level: n } }
  if (/^SOLO/.test(base)) return { key: 'solo', label: 'Solo Guitar', tier: tierOf(2), level: 2 }
  if ((m = /^CB(\d)/.exec(base))) { const n = +m[1]; return { key: 'cb-' + n, label: 'Guitar căn bản ' + n, tier: tierOf(n), level: n } }
  const label = friendlyFallback(r)
  return { key: 'name:' + label.toLowerCase(), label, tier: 'base', level: 1 }
}

/** Không nhận ra mã: tên khoá ngắn (≤ 28 ký tự) hoặc phần đầu tên lớp (bỏ "— 40 buổi…", "- KD17"). */
function friendlyFallback(r: MembershipRow): string {
  const course = (r.course_name ?? '').trim()
  if (course && course.length <= 28) return course
  const name = (r.class_name ?? '').trim()
  const head = /^(.+?)\s*(?:—|–|\s-\s)\s*.+$/.exec(name)?.[1]?.trim()
  return (head && head.length >= 4 ? head : name) || course || (r.class_code ?? '').trim() || 'Lớp học'
}

const byImportance = (a: LearningIdentity, b: LearningIdentity) =>
  (b.tier === 'special' ? 1 : 0) - (a.tier === 'special' ? 1 : 0) || b.level - a.level || a.label.localeCompare(b.label, 'vi') || a.key.localeCompare(b.key)

/**
 * Hàng lớp → danh tính: gộp theo CHƯƠNG TRÌNH (2 cohort DH2 = một "Đệm hát 2"), lấy trạng thái mạnh nhất
 * (Đang học > Sắp học > Đã tốt nghiệp — đang học lại thì không lặp ở Đã tốt nghiệp). Thứ tự xác định.
 */
export function buildIdentities(rows: MembershipRow[] | null | undefined): LearningIdentities {
  const groups = new Map<string, { p: ReturnType<typeof programOf>; items: { state: IdentityState; title: string }[] }>()
  for (const r of rows ?? []) {
    const state = STATE_OF[(r.status ?? '').trim()]
    if (!state) continue
    const p = programOf(r)
    const code = (r.class_code ?? '').trim()
    const name = (r.class_name ?? '').trim()
    const title = [name, code && !name.toUpperCase().includes(code.toUpperCase()) ? code : ''].filter(Boolean).join(' · ')
    const g = groups.get(p.key) ?? { p, items: [] }
    g.items.push({ state, title })
    groups.set(p.key, g)
  }
  const all: LearningIdentity[] = [...groups.values()].map(({ p, items }) => {
    const state = items.reduce<IdentityState>((s, x) => (STATE_RANK[x.state] > STATE_RANK[s] ? x.state : s), 'graduated')
    const titles = [...new Set(items.filter(x => x.state === state && x.title).map(x => x.title))].sort()
    return { ...p, state, title: titles.join(' • ') || p.label }
  })
  const pick = (s: IdentityState) => all.filter(i => i.state === s).sort(byImportance)
  return { current: pick('current'), upcoming: pick('upcoming'), graduated: pick('graduated') }
}

/**
 * Nhãn cạnh TÊN (Feed, bình luận, bạn bè, thành viên lớp): CHỈ đang học; ưu tiên chương trình đặc biệt → cao hơn;
 * `exclude` bỏ chương trình trùng ngữ cảnh (vd trong trang lớp DH2 không lặp "Đệm hát 2"). Thừa → +N.
 */
export function nameBadges(ids: LearningIdentities, max: number, exclude?: string | null): { shown: LearningIdentity[]; more: LearningIdentity[] } {
  const list = ids.current.filter(i => i.key !== exclude)
  return { shown: list.slice(0, Math.max(0, max)), more: list.slice(Math.max(0, max)) }
}

/** Khoá chương trình của MỘT lớp (trang lớp: bỏ nhãn trùng ngữ cảnh cho thành viên). */
export function programKeyOfClass(c: { code: string | null; name: string; programCode: string | null; course: { code: string | null; name: string | null } | null }): string {
  return programOf({ class_code: c.code, class_name: c.name, program_code: c.programCode, course_code: c.course?.code ?? null, course_name: c.course?.name ?? null }).key
}
