// Biểu mẫu chính sách cập nhật (thuần). Server (app_update_policy_save) kiểm lại mọi luật — đây chỉ để báo lỗi sớm.
import { compareVersions } from '../app-update/policy'

export type PlatformKey = 'ios' | 'android'
export type PolicyRow = {
  platform: PlatformKey; enabled: boolean; latest_version: string | null; latest_build: number | null
  min_version: string | null; min_build: number | null; force_enabled: boolean; notes: string | null; updated_at: string
}
export type PolicyForm = { enabled: boolean; latestVersion: string; latestBuild: string; minVersion: string; minBuild: string; force: boolean; notes: string }

export const toForm = (r: PolicyRow): PolicyForm => ({
  enabled: r.enabled, latestVersion: r.latest_version ?? '', latestBuild: r.latest_build?.toString() ?? '',
  minVersion: r.min_version ?? '', minBuild: r.min_build?.toString() ?? '', force: r.force_enabled, notes: r.notes ?? '',
})

const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/
const BUILD = /^[1-9]\d{0,8}$/

export function formError(p: PlatformKey, f: PolicyForm): string | null {
  const android = p === 'android'
  const [lv, mv, lb, mb] = [f.latestVersion, f.minVersion, f.latestBuild, f.minBuild].map(s => s.trim())
  if ((lv && !VERSION.test(lv)) || (mv && !VERSION.test(mv))) return 'Phiên bản phải có dạng 1.7.0.'
  if (android && ((lb && !BUILD.test(lb)) || (mb && !BUILD.test(mb)))) return 'versionCode phải là số nguyên dương.'
  if (f.enabled && (!lv || (android && !lb))) return android ? 'Muốn bật thông báo cần phiên bản mới nhất và versionCode.' : 'Muốn bật thông báo cần phiên bản mới nhất.'
  if (f.force && !f.enabled) return 'Cập nhật bắt buộc cần bật thông báo trước.'
  if (f.force && (android ? !mb : !mv)) return android ? 'Cập nhật bắt buộc cần versionCode tối thiểu.' : 'Cập nhật bắt buộc cần phiên bản tối thiểu.'
  if (android ? (!!mb && !!lb && Number(mb) > Number(lb)) : compareVersions(mv, lv) === 1) return 'Mức tối thiểu không được cao hơn bản mới nhất.'
  if (f.notes.trim().length > 300) return 'Ghi chú tối đa 300 ký tự.'
  return null
}

export function saveArgs(r: PolicyRow, f: PolicyForm) {
  const android = r.platform === 'android'
  const text = (s: string) => s.trim() || null
  const num = (s: string) => (android && s.trim() ? Number(s.trim()) : null)
  return {
    p_platform: r.platform, p_enabled: f.enabled, p_latest_version: text(f.latestVersion), p_latest_build: num(f.latestBuild),
    p_min_version: android ? null : text(f.minVersion), p_min_build: num(f.minBuild), p_force: f.force,
    p_notes: text(f.notes), p_expected_updated_at: r.updated_at,
  }
}

/** Câu hỏi xác nhận khi thay đổi làm nhiều học viên bị khoá app. null = không cần hỏi. */
export function forceConfirmText(r: PolicyRow, f: PolicyForm): string | null {
  if (!f.force) return null
  const next = r.platform === 'android' ? f.minBuild.trim() : f.minVersion.trim()
  const prev = r.platform === 'android' ? String(r.min_build ?? '') : r.min_version ?? ''
  if (r.force_enabled && next === prev) return null
  return `CẬP NHẬT BẮT BUỘC ${r.platform === 'ios' ? 'iOS' : 'Android'}: mọi máy thấp hơn ${next} sẽ KHÔNG dùng được app cho tới khi cập nhật (khi kho đã phát bản đạt mức này). Bạn chắc chắn muốn bật?`
}
