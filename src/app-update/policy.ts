// App Update Manager V1 — luật quyết định (thuần, không mạng, không DOM).
// Chỉ báo khi CẢ HAI đúng: (1) Owner bật chính sách, (2) chính kho ứng dụng xác nhận máy này tải được bản mới hơn.
// Mọi dữ liệu thiếu / sai dạng → KHÔNG báo gì (không làm gián đoạn việc học).

export type Platform = 'ios' | 'android'
export type Installed = { platform: Platform; version: string; build: number }
export type Policy = {
  latestVersion: string | null; latestBuild: number | null
  minVersion: string | null; minBuild: number | null
  force: boolean; notes: string | null
}
/** iOS: version đang phát hành trên App Store. Android: versionCode Google Play đang phát cho máy này. */
export type StoreState = { available: boolean; version?: string; build?: number }
export type Snooze = { target: string; until: number }
export type Decision =
  | { kind: 'none' }
  | { kind: 'soft' | 'force'; target: string; version: string | null; notes: string | null }

export const SNOOZE_MS = 24 * 60 * 60 * 1000
const NONE: Decision = { kind: 'none' }

const parse = (v: unknown): number[] | null =>
  typeof v === 'string' && /^\d+(\.\d+){0,3}$/.test(v) ? v.split('.').map(Number) : null

/** -1 | 0 | 1; null nếu một bên sai dạng. So theo SỐ từng đoạn: 1.10.0 > 1.9.0, 1.7 = 1.7.0. */
export function compareVersions(a: unknown, b: unknown): number | null {
  const x = parse(a), y = parse(b)
  if (!x || !y) return null
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d) return d < 0 ? -1 : 1
  }
  return 0
}

const isBuild = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0

export function toPolicy(raw: unknown): Policy | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const num = (v: unknown) => (isBuild(v) ? v : null)
  return {
    latestVersion: text(r.latestVersion), latestBuild: num(r.latestBuild),
    minVersion: text(r.minVersion), minBuild: num(r.minBuild),
    force: r.force === true, notes: text(r.notes),
  }
}

/** Có đáng hỏi kho không: bản đang cài còn thấp hơn "mới nhất" Owner khai. Tránh gọi kho vô ích. */
export function behindPolicy(me: Installed, p: Policy | null): boolean {
  if (!p) return false
  if (me.platform === 'ios') return compareVersions(me.version, p.latestVersion) === -1
  return isBuild(me.build) && p.latestBuild !== null && me.build < p.latestBuild
}

export function decide(me: Installed, p: Policy | null, store: StoreState | null): Decision {
  if (!p || !behindPolicy(me, p) || !store || store.available !== true) return NONE

  if (me.platform === 'ios') {
    if (compareVersions(me.version, store.version) !== -1) return NONE
    // Đích = bản thấp hơn giữa "Owner công bố" và "App Store đang phát": không quảng cáo bản chưa tải được
    const target = compareVersions(store.version, p.latestVersion) === -1 ? store.version! : p.latestVersion!
    const force = p.force && compareVersions(me.version, p.minVersion) === -1
      && (compareVersions(store.version, p.minVersion) ?? -1) >= 0   // kho phải có bản đạt mức tối thiểu, nếu không sẽ khoá chết
    return { kind: force ? 'force' : 'soft', target, version: target, notes: p.notes }
  }

  if (!isBuild(store.build) || store.build <= me.build) return NONE
  const code = Math.min(store.build, p.latestBuild!)
  const force = p.force && p.minBuild !== null && me.build < p.minBuild && store.build >= p.minBuild
  // Play chỉ trả versionCode → chỉ nêu tên phiên bản khi đúng là bản Owner khai
  return { kind: force ? 'force' : 'soft', target: String(code), version: code === p.latestBuild ? p.latestVersion : null, notes: p.notes }
}

/** "Để sau": im 24 giờ cho đúng bản đó. Bản mới hơn → báo lại. Bắt buộc → không hoãn được. */
export function isSnoozed(d: Decision, s: Snooze | null, now: number): boolean {
  if (d.kind !== 'soft' || !s || s.target !== d.target) return false
  return now < s.until && s.until - now <= SNOOZE_MS   // đồng hồ máy bị vặn lùi không làm im mãi
}

export function parseSnooze(text: string | null): Snooze | null {
  try {
    const v = JSON.parse(text ?? '') as Snooze
    return typeof v?.target === 'string' && Number.isFinite(v?.until) ? v : null
  } catch { return null }
}
