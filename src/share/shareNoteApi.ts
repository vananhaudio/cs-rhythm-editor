// Share Note V1 — "Chia sẻ tức thì": khoanh ô nhịp trong bản nhạc giáo trình (LessonScore) rồi chia sẻ qua Universal Share.
// Chỉ gọi RPC share_note_* (db/share_note_v1_setup.sql). Neo do SERVER dựng; client chỉ gửi (buổi, khối, đường dẫn, dải ô, lời nhắn).
// supabase nạp ĐỘNG (component lá test được trên Node). Thông báo lỗi dịu, không lộ chi tiết kỹ thuật.
import { shareErrorText } from '../class-social/toolshare/toolShareApi'

/** Đường dẫn tới chuỗi alphaTex trong một khối giáo trình — đúng 3 chỗ LessonDocument dựng LessonScore. */
export type ScorePath = ['tex'] | ['layers', string, 'tex'] | ['pieces', string, 'tex']
/** Vị trí một bản nhạc trong buổi: khối (chỉ số trong class_lesson_content.blocks) + đường dẫn */
export type ScoreKey = { section: number; path: ScorePath }
/** Dải ô nhịp, đánh số từ 1 (như số ô in trên bản nhạc) */
export type BarRange = { from: number; to: number }

export const scoreKeyId = (k: ScoreKey) => `${k.section}:${k.path.join('.')}`
export const sameScoreKey = (a: ScoreKey | null | undefined, b: ScoreKey | null | undefined) => !!a && !!b && scoreKeyId(a) === scoreKeyId(b)
export const barRangeText = (r: BarRange) => (r.from === r.to ? `Ô ${r.from}` : `Ô ${r.from}–${r.to}`)

const PATH_OK = (p: unknown): p is ScorePath => Array.isArray(p) && (
  (p.length === 1 && p[0] === 'tex') ||
  (p.length === 3 && (p[0] === 'layers' || p[0] === 'pieces') && typeof p[1] === 'string' && /^[0-9]{1,3}$/.test(p[1]) && p[2] === 'tex'))

export type ShareNoteOpen =
  | { status: 'ok'; note: string; authorId: string; isAuthor: boolean; classId: string; sessionNo: number; score: ScoreKey; bars: BarRange; createdAt: string }
  | { status: 'stale' | 'no_access'; note: string; authorId: string; isAuthor: boolean; classId: string; sessionNo: number; createdAt: string }
  | { status: 'unavailable' }

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)
type RpcErr = { code?: string; message?: string } | null

function createErrorText(e: RpcErr): string {
  if (e?.code === '54000') return 'Bạn chia sẻ quá nhiều trong thời gian ngắn. Hãy chờ một chút.'
  if (e?.code === '22023' && /Lời nhắn/.test(e.message ?? '')) return 'Lời nhắn cần từ 1 đến 500 ký tự.'
  if (e?.code === '22023') return 'Đoạn nhạc này chưa chia sẻ được. Hãy tải lại trang và thử lại.'
  return shareErrorText(e?.message, isOnline())
}

/** Tạo tham chiếu (idempotent theo clientKey: bấm đúp / thử lại = cùng một note). */
export async function createShareNote(input: { sessionId: string; score: ScoreKey; bars: BarRange; note: string; clientKey: string }):
  Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const { supabase } = await import('../supabase')
    const { data, error } = await supabase.rpc('share_note_create', {
      p_session: input.sessionId, p_section: input.score.section, p_path: input.score.path,
      p_from: input.bars.from, p_to: input.bars.to, p_note: input.note, p_client_key: input.clientKey,
    })
    if (error || typeof data !== 'string') return { ok: false, message: createErrorText(error) }
    return { ok: true, id: data.toLowerCase() }
  } catch (e) {
    return { ok: false, message: shareErrorText((e as Error)?.message, isOnline()) }
  }
}

type OpenRow = { status: string; note: string; author_id: string; is_author: boolean; class_id: string; session_no: number | null;
  section_idx: number | null; score_path: unknown; bar_from: number | null; bar_to: number | null; created_at: string }

/** Hàng RPC → kết quả mở (THUẦN, kiểm lại mọi trường; dữ liệu lạ → unavailable). */
export function parseShareNoteOpen(rows: unknown): ShareNoteOpen {
  const r = (Array.isArray(rows) ? rows[0] : null) as OpenRow | null
  if (!r || typeof r.note !== 'string' || typeof r.author_id !== 'string' || typeof r.class_id !== 'string' || !Number.isInteger(r.session_no)) return { status: 'unavailable' }
  const base = { note: r.note, authorId: r.author_id, isAuthor: r.is_author === true, classId: r.class_id, sessionNo: r.session_no as number, createdAt: r.created_at }
  if (r.status === 'ok') {
    if (!Number.isInteger(r.section_idx) || !PATH_OK(r.score_path) || !Number.isInteger(r.bar_from) || !Number.isInteger(r.bar_to)) return { status: 'unavailable' }
    return { status: 'ok', ...base, score: { section: r.section_idx as number, path: r.score_path }, bars: { from: r.bar_from as number, to: r.bar_to as number } }
  }
  if (r.status === 'stale' || r.status === 'no_access') return { status: r.status, ...base }
  return { status: 'unavailable' }
}

/** Mở tham chiếu. Lỗi mạng ném ra (≠ "không khả dụng"). */
export async function openShareNote(id: string): Promise<ShareNoteOpen> {
  const { supabase } = await import('../supabase')
  const { data, error } = await supabase.rpc('share_note_open', { p_id: id })
  if (error) throw new Error(error.message ?? 'open')
  return parseShareNoteOpen(data)
}

export type ShareNoteCardRow = { id: string; note: string; author_id: string; class_id: string; session_no: number; bar_from: number; bar_to: number; created_at: string }
/** Thẻ Chat theo lô (≤ 50). Note không thấy được không có trong kết quả. Lỗi mạng ném ra. */
export async function fetchShareNoteCards(ids: string[]): Promise<ShareNoteCardRow[]> {
  const { supabase } = await import('../supabase')
  const { data, error } = await supabase.rpc('share_note_card', { p_ids: ids })
  if (error) throw new Error(error.message ?? 'card')
  return (data ?? []) as ShareNoteCardRow[]
}

/** Đăng lên Feed (một bài mỗi note). */
export async function publishShareNote(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { supabase } = await import('../supabase')
    const { data, error } = await supabase.rpc('social_share_share_note', { p_note: id })
    if (error || typeof data !== 'string') {
      if (error?.code === '54000') return { ok: false, message: 'Bạn chia sẻ quá nhiều trong thời gian ngắn. Hãy chờ một chút.' }
      if (error?.code === '22023') return { ok: false, message: 'Đoạn nhạc này chưa đăng được.' }
      return { ok: false, message: shareErrorText(error?.message, isOnline()) }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: shareErrorText((e as Error)?.message, isOnline()) }
  }
}

/** Khoá chống trùng cho MỘT lần soạn (giữ nguyên khi bấm lại / thử lại). */
export function newClientKey(): string {
  try { return crypto.randomUUID() } catch { return `sn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}` }
}
