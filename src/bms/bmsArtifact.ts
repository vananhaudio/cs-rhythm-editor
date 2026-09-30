// BMS Artifact Share V1 — chuyển bài BMS (nháp LOCAL) ⇄ artifact server (tool_artifacts, schema 'bms.song' v1).
// BMS vẫn local-first: file này CHỈ được gọi khi chủ bài bấm "Chia sẻ lên cộng đồng" (ghi) hoặc khi mở
// /song-builder?artifact=<id> (đọc, chỉ luyện). Server kiểm + dựng lại dữ liệu (db/social_bms_artifact_v1_setup.sql).
// supabase nạp ĐỘNG → phần thuần test được trên Node.
import { splitWords, makeAnchor } from '../logic/songBuilder'
import type { SongChord } from '../logic/songBuilder'
import type { SongDraft } from '../logic/songDraftStorage'
import type { TempoFit } from '../logic/tempoFit'
import { shareErrorText } from '../class-social/toolshare/toolShareApi'

export const MAX_LYRICS = 8000
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type BmsSongPayload = {
  title: string; video_id: string; lyrics: string
  fit: { bpm: number; beat_duration: number; grid_offset: number }
  time_signature: number; downbeat_position: number; group_beats: boolean | null
  anchors: { word_index: number; beat_index: number }[]
  chords: { word_index: number; name: string }[]
}

/** Bài đủ để người khác LUYỆN lại được: có video, lời, lưới nhịp, ít nhất một mốc. Thiếu → lý do (để hiện cho chủ bài). */
export function songShareBlocker(d: SongDraft): string | null {
  if (!d.videoId || !YT_ID_RE.test(d.videoId)) return 'Cần chọn video YouTube.'
  if (!d.lyricsText.trim()) return 'Cần có lời bài hát.'
  if (d.lyricsText.length > MAX_LYRICS) return 'Lời bài hát quá dài để chia sẻ.'
  if (!d.fit?.ok) return 'Cần tap nhịp để có BPM.'
  if (d.fit.bpm < 30 || d.fit.bpm > 260) return 'BPM nằm ngoài 30–260.'
  if (!d.anchors.length) return 'Cần gắn ít nhất một mốc lời.'
  return null
}

/** Nháp local → payload gửi server (CHỈ các trường cần để tái tạo bài; bỏ id nháp, tap thô, youtubeUrl, thumbnail). */
export function songPayloadFromDraft(d: SongDraft): BmsSongPayload | null {
  if (songShareBlocker(d) || !d.fit || !d.videoId) return null
  const title = (d.title || '').trim().slice(0, 120) || 'Bài hát chưa đặt tên'
  return {
    title, video_id: d.videoId, lyrics: d.lyricsText,
    fit: { bpm: d.fit.bpm, beat_duration: d.fit.beatDuration, grid_offset: d.fit.gridOffset },
    time_signature: d.timeSignature, downbeat_position: d.downbeatPosition, group_beats: d.groupBeats,
    anchors: d.anchors.map(a => ({ word_index: a.wordIndex, beat_index: a.beatIndex })),
    chords: (d.chords ?? []).map(c => ({ word_index: c.wordIndex, name: c.name })),
  }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const intIn = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null)

/** Dữ liệu artifact (đọc từ server) → SongDraft CHỈ-ĐỌC cho PracticePlayer. Hỏng / sai schema → null (không crash). */
export function draftFromArtifact(artifactId: string, data: unknown): SongDraft | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const o = data as Record<string, unknown>
  if (o.schema !== 'bms.song' || o.v !== 1) return null
  const title = typeof o.title === 'string' ? o.title : ''
  const vid = typeof o.video_id === 'string' && YT_ID_RE.test(o.video_id) ? o.video_id : null
  const lyrics = typeof o.lyrics === 'string' ? o.lyrics : null
  const f = (o.fit && typeof o.fit === 'object' ? o.fit : {}) as Record<string, unknown>
  const bpm = num(f.bpm), bd = num(f.beat_duration), go = num(f.grid_offset)
  const ts = intIn(o.time_signature, 2, 12), dp = intIn(o.downbeat_position, 0, 12)
  if (!title || !vid || lyrics === null || bpm === null || bd === null || go === null || ts === null || dp === null) return null
  if (!Array.isArray(o.anchors) || !Array.isArray(o.chords)) return null
  const words = splitWords(lyrics)
  const anchors = []
  for (const a of o.anchors as Record<string, unknown>[]) {
    const wi = intIn(a?.word_index, 0, words.length - 1), bi = intIn(a?.beat_index, -999999, 999999)
    if (wi === null || bi === null) continue   // mốc trỏ ra ngoài lời → bỏ, không crash
    anchors.push(makeAnchor(wi, words[wi].text, bi))
  }
  const chords: SongChord[] = []
  for (const c of o.chords as Record<string, unknown>[]) {
    const wi = intIn(c?.word_index, 0, words.length - 1)
    if (wi !== null && typeof c.name === 'string' && c.name.length <= 16) chords.push({ wordIndex: wi, name: c.name })
  }
  const fit: TempoFit = { ok: true, fitted: true, bpm, beatDuration: bd, gridOffset: go, validTaps: 0, rejected: 0, avgError: 0, maxError: 0, assign: [] }
  return {
    id: 'artifact:' + artifactId, title, youtubeUrl: `https://www.youtube.com/watch?v=${vid}`, videoId: vid,
    thumbnail: `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`, lyricsText: lyrics, fit, timeSignature: ts, downbeatPosition: dp,
    groupBeats: typeof o.group_beats === 'boolean' ? o.group_beats : null, anchors, chords, step: 5, createdAt: 0, updatedAt: 0,
  }
}

export const isArtifactId = (s: string | null | undefined): s is string => !!s && UUID_RE.test(s)

export type ShareSongResult = { ok: true; artifactId: string | null } | { ok: false; message: string }

/** Chủ bài bấm Chia sẻ → RPC tạo artifact + đúng MỘT bài Feed. clientKey sinh một lần cho một phiên bản bài. */
export async function shareBmsSong(d: SongDraft, clientKey: string): Promise<ShareSongResult> {
  const song = songPayloadFromDraft(d)
  if (!song) return { ok: false, message: songShareBlocker(d) ?? 'Bài chưa đủ dữ liệu để chia sẻ.' }
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false
  try {
    const { supabase } = await import('../supabase')
    const { data, error } = await supabase.rpc('social_share_tool_result', { p_tool: 'bms', p_result: { kind: 'song', song }, p_client_key: clientKey })
    if (error || typeof data !== 'string') return { ok: false, message: shareErrorText(error?.message, online) }
    const { data: post } = await supabase.from('class_posts').select('tool_share').eq('id', data).maybeSingle()
    const art = (post?.tool_share as { artifact_id?: unknown } | null)?.artifact_id
    return { ok: true, artifactId: typeof art === 'string' && isArtifactId(art) ? art : null }
  } catch (e) {
    return { ok: false, message: shareErrorText((e as Error)?.message, online) }
  }
}

export type LoadedArtifact =
  | { status: 'ready'; draft: SongDraft; isMine: boolean }
  | { status: 'signed_out' } | { status: 'missing' } | { status: 'error' }

/** Đọc artifact qua RLS (chủ bài / thành viên Class). Không có / không được xem / đã gỡ → 'missing'. */
export async function loadBmsArtifact(id: string): Promise<LoadedArtifact> {
  if (!isArtifactId(id)) return { status: 'missing' }
  try {
    const { supabase } = await import('../supabase')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { status: 'signed_out' }
    const { data, error } = await supabase.from('tool_artifacts').select('id,owner_id,tool,kind,data').eq('id', id).maybeSingle()
    if (error) return { status: 'error' }
    if (!data || data.tool !== 'bms' || data.kind !== 'song') return { status: 'missing' }
    const draft = draftFromArtifact(id, data.data)
    return draft ? { status: 'ready', draft, isMine: data.owner_id === session.user.id } : { status: 'missing' }
  } catch { return { status: 'error' } }
}

/** Chủ bài gỡ chia sẻ: artifact + bài Feed trỏ tới nó (RPC, cùng transaction). */
export async function deleteBmsArtifact(id: string): Promise<boolean> {
  try {
    const { supabase } = await import('../supabase')
    const { data, error } = await supabase.rpc('social_delete_tool_artifact', { p_id: id })
    return !error && data === true
  } catch { return false }
}
