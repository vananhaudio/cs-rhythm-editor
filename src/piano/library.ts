// ── Thư viện "Bài hát của con" ────────────────────────────────────────────────
// Lưu lại mọi bản nhạc bé đã chơi, kèm điểm, để bé mở ra tập lại và phụ huynh
// mở ra xem con học thế nào.
//
// Đọc/ghi qua Supabase (bảng piano_songs) làm nguồn chính.
// localStorage + module cache làm fallback tức thời — UI không bao giờ phải chờ mạng.
// Mỗi lần ghi: cập nhật cache + localStorage NGAY, rồi đồng bộ lên server bất đồng bộ.

import type { Exercise } from './rules'
import { LEVELS, currentLevelId, setLevelId } from './rules'
import { supabase } from '../supabase'

export interface SavedSong {
  /** Khoá chống trùng — cùng giai điệu + trường độ thì coi là một bài. */
  id: string
  title: string
  levelId: number
  exercise: Exercise
  /** Mốc thời gian (ms) */
  createdAt: number
  lastPlayedAt: number
  /** Số lần bé chơi tới màn chấm điểm */
  plays: number
  /** Điểm CAO NHẤT từ trước tới nay */
  bestHit: number
  bestTotal: number
}

const KEY = 'piano_library'
const MAX = 60              // giữ 60 bài gần nhất, tránh phình localStorage

/** Module cache — null = chưa nạp. */
let _cache: SavedSong[] | null = null
let _serverLoaded = false

/** Chữ ký bài: cao độ + trường độ. Hai bài khác tiết tấu là hai bài khác nhau. */
export function songId(ex: Exercise): string {
  return ex.notes.map(n => `${n.pitch}:${n.duration}`).join('-')
}

function read(): SavedSong[] {
  if (_cache != null) return _cache
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(raw)) { _cache = []; return [] }
    _cache = raw.filter(s => s && typeof s.id === 'string' && Array.isArray(s.exercise?.notes))
    return _cache
  } catch { _cache = []; return [] }
}

function write(list: SavedSong[]) {
  _cache = list.slice(0, MAX)
  try { localStorage.setItem(KEY, JSON.stringify(_cache)) } catch { /* đầy bộ nhớ thì bỏ qua */ }
}

// ── Server sync ──────────────────────────────────────────────────────────────

async function _upsertToServer(s: SavedSong): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('piano_songs').upsert({
      user_id: session.user.id,
      song_id: s.id,
      title: s.title,
      level_id: s.levelId,
      exercise: s.exercise as any,
      created_at: new Date(s.createdAt).toISOString(),
      last_played_at: new Date(s.lastPlayedAt).toISOString(),
      plays: s.plays,
      best_hit: s.bestHit,
      best_total: s.bestTotal,
    }, { onConflict: 'user_id, song_id' })
  } catch { /* mạng lỗi — đã có cache + localStorage */ }
}

async function _deleteFromServer(songId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('piano_songs').delete().eq('song_id', songId).eq('user_id', session.user.id)
  } catch { /* */ }
}

/** Gọi MỘT LẦN khi app mount để kéo dữ liệu từ server.
 *  Merge với localStorage: server thắng khi cùng bài, giữ bài local chưa từng lên server. */
export async function loadLibraryFromServer(): Promise<void> {
  if (_serverLoaded) return
  _serverLoaded = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase.from('piano_songs')
      .select('*').eq('user_id', session.user.id)
      .order('last_played_at', { ascending: false }).limit(MAX)
    if (!data?.length) return

    const local = read()
    const map = new Map(local.map(s => [s.id, s]))
    const serverIds = new Set<string>()

    for (const r of data as any[]) {
      const ss: SavedSong = {
        id: r.song_id,
        title: r.title,
        levelId: r.level_id,
        exercise: r.exercise as Exercise,
        createdAt: new Date(r.created_at).getTime(),
        lastPlayedAt: new Date(r.last_played_at).getTime(),
        plays: r.plays ?? 0,
        bestHit: r.best_hit ?? 0,
        bestTotal: r.best_total ?? 0,
      }
      serverIds.add(ss.id)
      const loc = map.get(ss.id)
      // Server thắng, trừ khi local mới hơn (bé vừa tập xong trên máy này)
      if (!loc || ss.lastPlayedAt >= loc.lastPlayedAt) {
        map.set(ss.id, ss)
      }
    }

    const merged = [...map.values()].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
    write(merged)

    // Đồng bộ ngược: bài local chưa có trên server → đẩy lên
    for (const s of merged) {
      if (!serverIds.has(s.id)) void _upsertToServer(s)
    }
  } catch { /* mạng lỗi — đã có localStorage */ }
}

// ── Public API (không đổi chữ ký) ─────────────────────────────────────────────

/** Danh sách bài, mới chơi gần nhất lên đầu. */
export function listSongs(): SavedSong[] {
  return read().sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
}

export function getSong(id: string): SavedSong | null {
  return read().find(s => s.id === id) ?? null
}

/** Ghi lại một bài vừa được soạn (chưa có điểm). Gọi lúc bé bắt đầu tập. */
export function rememberSong(ex: Exercise, levelId: number, now: number): void {
  const id = songId(ex)
  const list = read()
  const cu = list.find(s => s.id === id)
  if (cu) {
    cu.lastPlayedAt = now
    write(list)
    void _upsertToServer(cu)
    return
  }
  const moi: SavedSong = {
    id, title: ex.title, levelId, exercise: ex,
    createdAt: now, lastPlayedAt: now,
    plays: 0, bestHit: 0, bestTotal: 0,
  }
  list.unshift(moi)
  write(list)
  void _upsertToServer(moi)
}

/** Ghi điểm sau khi bé chơi xong. Chỉ nâng điểm khi tốt hơn lần trước. */
export function recordScore(ex: Exercise, levelId: number, hit: number, total: number, now: number): void {
  if (!total) return
  const id = songId(ex)
  const list = read()
  let s = list.find(x => x.id === id)
  if (!s) {
    s = { id, title: ex.title, levelId, exercise: ex, createdAt: now, lastPlayedAt: now, plays: 0, bestHit: 0, bestTotal: 0 }
    list.unshift(s)
  }
  s.plays += 1
  s.lastPlayedAt = now
  const cuTot = s.bestTotal ? s.bestHit / s.bestTotal : -1
  if (hit / total > cuTot) { s.bestHit = hit; s.bestTotal = total }
  write(list)
  void _upsertToServer(s)
}

export function removeSong(id: string): void {
  write(read().filter(s => s.id !== id))
  void _deleteFromServer(id)
}

export function clearLibrary(): void {
  _cache = []
  try { localStorage.removeItem(KEY) } catch { /* */ }
  void (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await supabase.from('piano_songs').delete().eq('user_id', session.user.id)
    } catch { /* */ }
  })()
}

// ── Tiện ích hiển thị ────────────────────────────────────────────────────────

/** Số sao — DÙNG CHUNG ngưỡng với bảng điểm trong LearningFlow. */
export function starsOfSong(s: SavedSong): number {
  if (!s.bestTotal) return 0
  const r = s.bestHit / s.bestTotal
  return r >= 0.9 ? 3 : r >= 0.7 ? 2 : r >= 0.5 ? 1 : 0
}

/** Ngày dạng dd/mm — cho phụ huynh biết bé tập hôm nào. */
export function ngayGon(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Tổng kết cho phụ huynh xem nhanh. */
export function tongKet(list: SavedSong[]) {
  const daChoi = list.filter(s => s.plays > 0)
  const tongLuot = list.reduce((n, s) => n + s.plays, 0)
  const soSao = list.reduce((n, s) => n + starsOfSong(s), 0)
  return { soBai: list.length, soBaiDaChoi: daChoi.length, tongLuot, soSao }
}

// ── Tự lên bậc ──────────────────────────────────────────────────────────────
const ADVANCE_KEY = 'piano_just_advanced'

/** Số bài khác nhau phải đạt ≥2 sao ở một bậc thì mới được lên bậc kế. */
export const CAN_DE_LEN_BAC = 3

/** Số bài đã đạt ≥2 sao ở một bậc — dùng cho cả việc lên bậc lẫn thanh tiến độ. */
export function soBaiDatSao(levelId: number): number {
  return read().filter(s => s.levelId === levelId && starsOfSong(s) >= 2).length
}

/** Gọi sau mỗi lần chấm điểm. Trả về bậc mới nếu vừa lên, không thì null.
 *  Gọi SAU recordScore, vì hàm này đếm trên dữ liệu đã ghi. */
export function advanceIfEarned(levelId: number, hit: number, total: number): number | null {
  if (!total) return null
  const sao = hit / total >= 0.9 ? 3 : hit / total >= 0.7 ? 2 : hit / total >= 0.5 ? 1 : 0
  if (sao < 2) return null
  if (levelId !== currentLevelId()) return null       // đang tập lại bài bậc cũ thì thôi
  if (soBaiDatSao(levelId) < CAN_DE_LEN_BAC) return null
  const i = LEVELS.findIndex(l => l.id === levelId)
  if (i < 0 || i >= LEVELS.length - 1) return null    // đã ở bậc cuối
  const moi = LEVELS[i + 1].id
  setLevelId(moi)
  try { localStorage.setItem(ADVANCE_KEY, String(moi)) } catch { /* */ }
  return moi
}

/** Đọc RỒI XOÁ cờ vừa lên bậc — để lời chúc mừng chỉ hiện đúng một lần. */
export function takeJustAdvanced(): number | null {
  try {
    const v = parseInt(localStorage.getItem(ADVANCE_KEY) || '', 10)
    localStorage.removeItem(ADVANCE_KEY)
    return LEVELS.some(l => l.id === v) ? v : null
  } catch { return null }
}
