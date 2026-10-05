// Band — Tuyển thành viên: CHỈ qua RPC band_* (SECURITY DEFINER). Không query thẳng bảng band_*
// (RLS bật, không policy). Client không gửi danh tính — server tự lấy auth.uid().
import {
  parseAdminBands, parseAdminDetail, parseBandPublic, parseOverview,
  type AdminBand, type AdminBandDetail, type ApplicationStatus, type BandOverview, type BandPublic, type MemberStatus,
} from './bandModel'

export type Result<T> = { ok: true; value: T } | { ok: false; message: string; code?: string }

// Nạp client khi GỌI → component render được trong test Node.
const db = () => import('../supabase').then(m => m.supabase)

function errorText(raw: string | undefined): string {
  const m = raw ?? ''
  if (/Không có quyền/.test(m) || /permission denied/i.test(m)) return 'Bạn không có quyền xem mục này.'
  if (/Could not find the function|PGRST202/i.test(m)) return 'Tính năng chưa sẵn sàng. Vui lòng thử lại sau.'
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Mất kết nối mạng. Kiểm tra mạng rồi thử lại.'
  return 'Có lỗi xảy ra. Vui lòng thử lại.'
}

/** Landing công khai. Band không tồn tại / chưa công khai → value null. */
export async function fetchBandPublic(slug: string): Promise<Result<BandPublic | null>> {
  try {
    const { data, error } = await (await db()).rpc('band_recruitment_public', { p_slug: slug })
    if (error) return { ok: false, message: errorText(error.message) }
    return { ok: true, value: data == null ? null : parseBandPublic(data) }
  } catch (e) { return { ok: false, message: errorText((e as Error).message) } }
}

export type ApplyOutcome = { duplicate: boolean }

export async function submitBandApplication(recruitmentId: string, payload: Record<string, unknown>): Promise<Result<ApplyOutcome>> {
  try {
    const { data, error } = await (await db()).rpc('band_apply', { p_recruitment_id: recruitmentId, p: payload })
    if (error) return { ok: false, message: errorText(error.message) }
    const r = (data ?? {}) as { ok?: boolean; duplicate?: boolean; code?: string; message?: string }
    if (r.ok) return { ok: true, value: { duplicate: r.duplicate === true } }
    return { ok: false, code: r.code, message: r.message || 'Chưa gửi được đơn. Vui lòng thử lại.' }
  } catch (e) { return { ok: false, message: errorText((e as Error).message) } }
}

export async function fetchAdminBands(): Promise<Result<AdminBand[]>> {
  try {
    const { data, error } = await (await db()).rpc('band_admin_bands')
    if (error) return { ok: false, message: errorText(error.message) }
    return { ok: true, value: parseAdminBands(data) }
  } catch (e) { return { ok: false, message: errorText((e as Error).message) } }
}

export async function fetchAdminBandDetail(slug: string): Promise<Result<AdminBandDetail>> {
  try {
    const { data, error } = await (await db()).rpc('band_admin_applications', { p_slug: slug })
    if (error) return { ok: false, message: errorText(error.message) }
    const d = parseAdminDetail(data)
    return d ? { ok: true, value: d } : { ok: false, message: 'Không tìm thấy Band.' }
  } catch (e) { return { ok: false, message: errorText((e as Error).message) } }
}

export async function setApplicationStatus(applicationId: string, status: ApplicationStatus): Promise<Result<ApplicationStatus>> {
  try {
    const { error } = await (await db()).rpc('band_admin_set_status', { p_application_id: applicationId, p_status: status })
    if (error) return { ok: false, message: errorText(error.message) }
    return { ok: true, value: status }
  } catch (e) { return { ok: false, message: errorText((e as Error).message) } }
}

// ── Quản lý Band V1 ──────────────────────────────────────────────────────────
export async function fetchBandOverview(slug: string): Promise<Result<BandOverview>> {
  try {
    const { data, error } = await (await db()).rpc('band_admin_overview', { p_slug: slug })
    if (error) return { ok: false, message: errorText(error.message) }
    const o = parseOverview(data)
    return o ? { ok: true, value: o } : { ok: false, message: 'Không tìm thấy Band.' }
  } catch (e) { return { ok: false, message: errorText((e as Error).message) } }
}

/** Gọi RPC quản lý trả {ok} hoặc {ok:false, code, message} (lỗi nhập liệu có câu tiếng Việt từ server). */
async function manageCall<T = undefined>(fn: string, args: Record<string, unknown>, pick?: (d: Record<string, unknown>) => T): Promise<Result<T>> {
  try {
    const { data, error } = await (await db()).rpc(fn, args)
    if (error) return { ok: false, message: errorText(error.message) }
    const r = (data ?? {}) as Record<string, unknown>
    if (r.ok === true) return { ok: true, value: (pick ? pick(r) : undefined) as T }
    return { ok: false, code: typeof r.code === 'string' ? r.code : undefined, message: typeof r.message === 'string' ? r.message : 'Chưa lưu được. Vui lòng thử lại.' }
  } catch (e) { return { ok: false, message: errorText((e as Error).message) } }
}

export type AcceptOutcome = { memberId: string; created: boolean }

/** Chấp nhận ứng viên VÀ thêm vào Band (một transaction ở server; bấm lại không tạo trùng). */
export const acceptApplication = (applicationId: string) =>
  manageCall<AcceptOutcome>('band_admin_accept', { p_application_id: applicationId },
    d => ({ memberId: String(d.member_id ?? ''), created: d.created === true }))

export type NewMember = { fullName: string; phone: string; positions: string[]; positionNote: string }
export const addMember = (slug: string, m: NewMember) =>
  manageCall('band_admin_add_member', { p_slug: slug, p: { full_name: m.fullName, phone: m.phone, positions: m.positions, position_note: m.positionNote } })

export type MemberPatch = { positions?: string[]; positionNote?: string | null; status?: MemberStatus }
export const updateMember = (memberId: string, patch: MemberPatch) => {
  const p: Record<string, unknown> = {}
  if (patch.positions) p.positions = patch.positions
  if (patch.positionNote !== undefined) p.position_note = patch.positionNote
  if (patch.status) p.status = patch.status
  return manageCall('band_admin_update_member', { p_member_id: memberId, p })
}

export const setMemberRole = (memberId: string, roleKey: string, on: boolean) =>
  manageCall('band_admin_set_role', { p_member_id: memberId, p_role_key: roleKey, p_on: on })

/** Ảnh bìa Band (Thầy/admin). url null = gỡ. */
export const setBandCover = (bandId: string, url: string | null) =>
  manageCall('band_admin_set_cover', { p_band_id: bandId, p_url: url })
