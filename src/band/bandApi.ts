// Band — Tuyển thành viên: CHỈ qua RPC band_* (SECURITY DEFINER). Không query thẳng bảng band_*
// (RLS bật, không policy). Client không gửi danh tính — server tự lấy auth.uid().
import {
  parseAdminBands, parseAdminDetail, parseBandPublic,
  type AdminBand, type AdminBandDetail, type ApplicationStatus, type BandPublic,
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
