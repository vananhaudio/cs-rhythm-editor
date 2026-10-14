// Play Scroll Share V1 — đăng một phiên bản hợp âm đã duyệt lên tường. Gửi cho bạn dùng ShareToFriendSheet (dm_share) như loại khác.
// supabase nạp ĐỘNG (test được trên Node). Quyền + trạng thái approved do máy chủ quyết (social_share_chord_sheet).
import { shareErrorText } from '../class-social/toolshare/toolShareApi'

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

export async function publishChordSheet(versionId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { supabase } = await import('../supabase')
    const { data, error } = await supabase.rpc('social_share_chord_sheet', { p_version: versionId })
    if (error || typeof data !== 'string') {
      if (error?.code === '22023') return { ok: false, message: 'Bài này chưa được duyệt nên chưa chia sẻ được.' }
      if (error?.code === '54000') return { ok: false, message: 'Bạn chia sẻ quá nhiều trong thời gian ngắn. Hãy chờ một chút.' }
      return { ok: false, message: shareErrorText(error?.message, isOnline()) }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: shareErrorText((e as Error)?.message, isOnline()) }
  }
}

/** Metadata thẻ (chỉ ĐỌC, theo lô) của các phiên bản approved. Bản không đọc được không có trong kết quả. Lỗi mạng ném ra (≠ "đã xoá"). */
export async function fetchChordCards(ids: string[]): Promise<Array<{ version_id: string; title: string | null; composer: string | null; meter: unknown; bpm: number | null }>> {
  const { supabase } = await import('../supabase')
  const { data, error } = await supabase.rpc('chord_share_card', { p_ids: ids })
  if (error) throw new Error(error.message ?? 'card')
  return (data ?? []) as Array<{ version_id: string; title: string | null; composer: string | null; meter: unknown; bpm: number | null }>
}
