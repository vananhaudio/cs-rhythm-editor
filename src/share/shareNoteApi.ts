// Share Note V1 — "Chia sẻ tức thì": khoanh ô nhịp trong bản nhạc giáo trình (LessonScore) rồi chia sẻ qua Universal Share.
// Chỉ gọi RPC share_note_* (db/share_note_v1_setup.sql). Neo do SERVER dựng; client chỉ gửi (buổi, khối, đường dẫn, dải ô, lời nhắn).
// supabase nạp ĐỘNG (component lá test được trên Node). Thông báo lỗi dịu, không lộ chi tiết kỹ thuật.
import { shareErrorText } from '../class-social/toolshare/toolShareApi'
import type { TextAnchor } from './textAnchor'
import { parseRegionParts, type RegionPart } from './regionAnchor'

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

/** Loại neo: bars = khoanh ô nhịp (V1) · text = vùng văn bản (V2). Hàng V1 không có `kind` ⇒ bars. */
export type ShareNoteKind = 'bars' | 'text' | 'region'
type OpenBase = { note: string; authorId: string; isAuthor: boolean; classId: string; sessionNo: number; createdAt: string }
export type ShareNoteOpen =
  | ({ status: 'ok'; kind: 'bars'; score: ScoreKey; bars: BarRange } & OpenBase)
  /** text: `moved` = server đã TÌM LẠI ở vị trí khác (toạ độ đã giải quyết); `sha` = sha256(UTF-8 của đoạn chọn) để client kiểm lại trước khi tô */
  | ({ status: 'ok' | 'moved'; kind: 'text'; text: TextAnchor; sha: string } & OpenBase)
  /** region (V3): các PHẦN (khối + lá + dải ô) đã được server xác nhận còn NGUYÊN VĂN; `moved` = có khối đổi chỉ số */
  | ({ status: 'ok' | 'moved'; kind: 'region'; parts: RegionPart[] } & OpenBase)
  | ({ status: 'stale' | 'no_access'; kind: ShareNoteKind } & OpenBase)
  | { status: 'unavailable' }

/** Mở ĐƯỢC (ok/moved) và là vùng văn bản / ô nhịp — để thu hẹp kiểu */
export type ShareNoteTextOpen = Extract<ShareNoteOpen, { kind: 'text'; sha: string }>
export type ShareNoteBarsOpen = Extract<ShareNoteOpen, { kind: 'bars'; score: ScoreKey }>
export type ShareNoteRegionOpen = Extract<ShareNoteOpen, { kind: 'region'; parts: RegionPart[] }>
export const isRegionOpen = (o: ShareNoteOpen): o is ShareNoteRegionOpen => o.status !== 'unavailable' && 'parts' in o && o.kind === 'region'
export const isTextOpen = (o: ShareNoteOpen): o is ShareNoteTextOpen => o.status !== 'unavailable' && 'text' in o && o.kind === 'text'
export const isBarsOpen = (o: ShareNoteOpen): o is ShareNoteBarsOpen => o.status !== 'unavailable' && 'bars' in o && o.kind === 'bars'

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

type OpenRow = { status: string; kind?: string | null; note: string; author_id: string; is_author: boolean; class_id: string; session_no: number | null;
  section_idx: number | null; score_path: unknown; bar_from: number | null; bar_to: number | null; created_at: string
  text_path?: unknown; char_from?: number | null; char_to?: number | null; text_sha?: string | null }
const TEXT_PATH_OK = (p: unknown): p is string[] => Array.isArray(p) && p.length >= 1 && p.length <= 5 && p.every(x => typeof x === 'string' && /^(text|items|steps|blocks|rows|[0-9]{1,3})$/.test(x))
const SHA_OK = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)

/** Hàng RPC → kết quả mở (THUẦN, kiểm lại mọi trường; dữ liệu lạ → unavailable). */
export function parseShareNoteOpen(rows: unknown): ShareNoteOpen {
  const r = (Array.isArray(rows) ? rows[0] : null) as OpenRow | null
  if (!r || typeof r.note !== 'string' || typeof r.author_id !== 'string' || typeof r.class_id !== 'string' || !Number.isInteger(r.session_no)) return { status: 'unavailable' }
  const base = { note: r.note, authorId: r.author_id, isAuthor: r.is_author === true, classId: r.class_id, sessionNo: r.session_no as number, createdAt: r.created_at }
  const kind: ShareNoteKind | null = r.kind === undefined || r.kind === null || r.kind === 'bars' ? 'bars' : r.kind === 'text' ? 'text' : r.kind === 'region' ? 'region' : null
  if (!kind) return { status: 'unavailable' }                                       // loại neo lạ ⇒ không đoán
  if (r.status === 'ok' || r.status === 'moved') {
    if (kind === 'region') return { status: 'unavailable' }                            // đi đường share_region_open (parseRegionOpen)
    if (kind === 'text') {
      if (!Number.isInteger(r.section_idx) || !TEXT_PATH_OK(r.text_path) || !Number.isInteger(r.char_from) || !Number.isInteger(r.char_to) || !SHA_OK(r.text_sha)) return { status: 'unavailable' }
      return { status: r.status, kind, ...base, text: { section: r.section_idx as number, path: r.text_path, from: r.char_from as number, to: r.char_to as number }, sha: r.text_sha }
    }
    if (r.status !== 'ok') return { status: 'unavailable' }                          // ô nhịp không có "moved"
    if (!Number.isInteger(r.section_idx) || !PATH_OK(r.score_path) || !Number.isInteger(r.bar_from) || !Number.isInteger(r.bar_to)) return { status: 'unavailable' }
    return { status: 'ok', kind, ...base, score: { section: r.section_idx as number, path: r.score_path }, bars: { from: r.bar_from as number, to: r.bar_to as number } }
  }
  if (r.status === 'stale' || r.status === 'no_access') return { status: r.status, kind, ...base }
  return { status: 'unavailable' }
}

/** RPC chưa được cài (FE deploy trước DB, hoặc rollback DB): rơi về hàm V1 — chỉ còn ghi chú ô nhịp. */
const rpcMissing = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist/i.test(e.message ?? ''))

/** Mở tham chiếu (cả hai loại neo). Lỗi mạng ném ra (≠ "không khả dụng"). */
export async function openShareNote(id: string): Promise<ShareNoteOpen> {
  const { supabase } = await import('../supabase')
  const v2 = await supabase.rpc('share_note_open_v2', { p_id: id })
  if (!v2.error) {
    const row = (Array.isArray(v2.data) ? v2.data[0] : null) as { kind?: string } | null
    if (row?.kind === 'region') return openRegion(id, v2.data)
    return parseShareNoteOpen(v2.data)
  }
  if (!rpcMissing(v2.error)) throw new Error(v2.error.message ?? 'open')
  const { data, error } = await supabase.rpc('share_note_open', { p_id: id })
  if (error) throw new Error(error.message ?? 'open')
  return parseShareNoteOpen(data)
}

/** Tạo tham chiếu VÙNG VĂN BẢN (idempotent theo clientKey). Server tự cắt đoạn chọn và tự băm — client chỉ gửi toạ độ (điểm mã). */
export async function createShareText(input: { sessionId: string; anchor: TextAnchor; note: string; clientKey: string }):
  Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const { supabase } = await import('../supabase')
    const a = input.anchor
    const { data, error } = await supabase.rpc('share_text_create', {
      p_session: input.sessionId, p_section: a.section, p_path: a.path, p_from: a.from, p_to: a.to, p_note: input.note, p_client_key: input.clientKey,
    })
    if (error || typeof data !== 'string') {
      if (error?.code === '22023' && !/Lời nhắn/.test(error.message ?? '')) return { ok: false, message: 'Đoạn văn bản này chưa chia sẻ được. Hãy chọn lại hoặc tải lại trang.' }
      return { ok: false, message: createErrorText(error) }
    }
    return { ok: true, id: data.toLowerCase() }
  } catch (e) {
    return { ok: false, message: shareErrorText((e as Error)?.message, isOnline()) }
  }
}

/** Đăng vùng văn bản lên Feed (một bài mỗi ghi chú). */
export async function publishShareText(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { supabase } = await import('../supabase')
    const { data, error } = await supabase.rpc('social_share_share_text', { p_note: id })
    if (error || typeof data !== 'string') {
      if (error?.code === '54000') return { ok: false, message: 'Bạn chia sẻ quá nhiều trong thời gian ngắn. Hãy chờ một chút.' }
      if (error?.code === '22023') return { ok: false, message: 'Đoạn văn bản này chưa đăng được.' }
      return { ok: false, message: shareErrorText(error?.message, isOnline()) }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: shareErrorText((e as Error)?.message, isOnline()) }
  }
}

/** Buổi chứa note có đang MỞ cho tôi không (RPC chỉ đọc; không đổi tiến độ). Lỗi mạng / hàm vắng ném ra → client KHÔNG vẽ nhạc. */
export async function isShareNoteSessionOpen(id: string): Promise<boolean> {
  const { supabase } = await import('../supabase')
  const { data, error } = await supabase.rpc('share_note_session_open', { p_note: id })
  if (error) throw new Error(error.message ?? 'session_open')
  return data === true
}

export type ShareNoteCardRow = { id: string; note: string; author_id: string; class_id: string; session_no: number; anchor_kind?: string | null; bar_from: number | null; bar_to: number | null; created_at: string }
/** Thẻ Chat theo lô (≤ 50). Note không thấy được không có trong kết quả. Lỗi mạng ném ra. */
export async function fetchShareNoteCards(ids: string[]): Promise<ShareNoteCardRow[]> {
  const { supabase } = await import('../supabase')
  const v2 = await supabase.rpc('share_note_card_v2', { p_ids: ids })
  if (!v2.error) return (v2.data ?? []) as ShareNoteCardRow[]
  if (!rpcMissing(v2.error)) throw new Error(v2.error.message ?? 'card')
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

/** V3: vùng khoanh hỗn hợp. `v2rows` = hàng share_note_open_v2 (đã cho biết kind='region' và đã qua cổng truy cập); phần/toạ độ lấy ở share_region_open. Dữ liệu lạ ⇒ unavailable. */
async function openRegion(id: string, v2rows: unknown): Promise<ShareNoteOpen> {
  const { supabase } = await import('../supabase')
  const { data, error } = await supabase.rpc('share_region_open', { p_id: id })
  if (error) throw new Error(error.message ?? 'open')
  return parseRegionOpen(Array.isArray(v2rows) ? v2rows : [], data)
}
export function parseRegionOpen(v2rows: unknown, rows: unknown): ShareNoteOpen {
  const r = (Array.isArray(rows) ? rows[0] : null) as { status?: string; note?: string; author_id?: string; is_author?: boolean; class_id?: string; session_no?: number | null; region?: unknown; created_at?: string } | null
  if (!r || typeof r.note !== 'string' || typeof r.author_id !== 'string' || typeof r.class_id !== 'string' || !Number.isInteger(r.session_no)) return { status: 'unavailable' }
  const base = { note: r.note, authorId: r.author_id, isAuthor: r.is_author === true, classId: r.class_id, sessionNo: r.session_no as number, createdAt: String(r.created_at ?? '') }
  void v2rows
  if (r.status === 'stale' || r.status === 'no_access') return { status: r.status, kind: 'region', ...base }
  if (r.status !== 'ok' && r.status !== 'moved') return { status: 'unavailable' }
  const parts = parseRegionParts(r.region)
  return parts ? { status: r.status, kind: 'region', parts, ...base } : { status: 'unavailable' }
}

/** Tạo tham chiếu VÙNG KHOANH (idempotent theo clientKey). Server tự kiểm từng phần theo giáo trình hiện hành và tự băm từng khối. */
export async function createShareRegion(input: { sessionId: string; parts: RegionPart[]; note: string; clientKey: string }):
  Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const { supabase } = await import('../supabase')
    const { data, error } = await supabase.rpc('share_region_create', { p_session: input.sessionId, p_parts: input.parts, p_note: input.note, p_client_key: input.clientKey })
    if (error || typeof data !== 'string') {
      if (error?.code === '22023' && !/Lời nhắn/.test(error.message ?? '')) return { ok: false, message: 'Vùng này chưa chia sẻ được. Hãy khoanh lại hoặc tải lại trang.' }
      return { ok: false, message: createErrorText(error) }
    }
    return { ok: true, id: data.toLowerCase() }
  } catch (e) {
    return { ok: false, message: shareErrorText((e as Error)?.message, isOnline()) }
  }
}

export async function publishShareRegion(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { supabase } = await import('../supabase')
    const { data, error } = await supabase.rpc('social_share_share_region', { p_note: id })
    if (error || typeof data !== 'string') {
      if (error?.code === '54000') return { ok: false, message: 'Bạn chia sẻ quá nhiều trong thời gian ngắn. Hãy chờ một chút.' }
      if (error?.code === '22023') return { ok: false, message: 'Vùng này chưa đăng được.' }
      return { ok: false, message: shareErrorText(error?.message, isOnline()) }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: shareErrorText((e as Error)?.message, isOnline()) }
  }
}
