// Band sở hữu bài trong Thư viện (hợp âm + MusicXML). Band = teamlab_bands. Quyền thật do máy chủ
// (RPC chord_sheet_contribute_publish_band / trigger musicxml_library_guard_band_insert); đây chỉ quyết định hiện ô chọn nào.

export type BandOption = { id: string; name: string }
/** Admin được chọn mọi Band; Biên tập chỉ Band mình giữ vai. `admin` quyết định có lựa chọn "Chưa gán Band" hay không. */
export type BandChoices = { bands: BandOption[]; admin: boolean }

export const NO_BAND_LABEL = 'Chưa gán Band'
/** Giá trị của lựa chọn "Chưa gán Band" (chỉ Admin). '' = chưa chọn. */
export const NO_BAND_CHOICE = '__none'
export const NO_BANDS: BandChoices = { bands: [], admin: false }

export const bandLabel = (name: string | null | undefined): string => name && name.trim() ? name.trim() : NO_BAND_LABEL

const byName = (a: BandOption, b: BandOption) => a.name.localeCompare(b.name, 'vi')

/**
 * Lựa chọn ban đầu: Biên tập → Band của mình (Band đầu tiên theo tên khi giữ vai ở nhiều Band);
 * Admin → '' (bắt buộc chọn, không đoán). Không có Band hợp lệ → NO_BAND_CHOICE (luồng cũ, lưu không Band).
 */
export function initialBandChoice(choices: BandChoices): string {
  if (!choices.bands.length) return NO_BAND_CHOICE
  if (choices.admin) return ''
  return [...choices.bands].sort(byName)[0].id
}

/** Có hiện ô "Lưu vào Band" không: chỉ khi tài khoản có ít nhất một Band hợp lệ để chọn. */
export const showsBandField = (choices: BandChoices): boolean => choices.bands.length > 0

/** Lý do chặn lưu (null = được lưu). Khi ô được hiện thì phải chọn rõ ràng. */
export function bandChoiceProblem(choices: BandChoices, choice: string): string | null {
  if (!showsBandField(choices)) return null
  if (choice === NO_BAND_CHOICE) return choices.admin ? null : 'Chọn Band để lưu bài.'
  if (!choice || !choices.bands.some(band => band.id === choice)) return 'Chọn Band để lưu bài.'
  return null
}

/** id gửi lên máy chủ (null = không gán Band). */
export const bandIdOfChoice = (choice: string): string | null => !choice || choice === NO_BAND_CHOICE ? null : choice

export const sortedBands = (bands: BandOption[]): BandOption[] => [...bands].sort(byName)

/** Tải các Band mà tài khoản đang đăng nhập được lưu bài vào. Lỗi → không có ô chọn (lưu như cũ), không chặn việc lưu. */
export async function loadWritableBands(): Promise<BandChoices> {
  try {
    const { supabase } = await import('../supabase.ts')
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id
    if (!uid) return NO_BANDS
    const { data: me } = await supabase.from('app_users').select('role').eq('id', uid).maybeSingle<{ role: string | null }>()
    const admin = me?.role === 'admin'
    if (admin) {
      const { data, error } = await supabase.from('teamlab_bands').select('id,name').order('name').limit(500)
      if (error || !data) return NO_BANDS
      return { bands: data as BandOption[], admin: true }
    }
    const { data: roles, error } = await supabase.from('teamlab_band_roles').select('band_id').eq('user_id', uid).eq('role', 'music_editor')
    if (error || !roles?.length) return NO_BANDS
    const ids = roles.map(row => row.band_id as string)
    const { data: bands } = await supabase.from('teamlab_bands').select('id,name').in('id', ids)
    return { bands: (bands ?? []) as BandOption[], admin: false }
  } catch { return NO_BANDS }
}
