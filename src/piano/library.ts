// ── Thư viện "Bài hát của con" ────────────────────────────────────────────────
// Lưu lại mọi bản nhạc bé đã chơi, kèm điểm, để bé mở ra tập lại và phụ huynh
// mở ra xem con học thế nào.
//
// ⚠️ HIỆN LƯU TRÊN MÁY (localStorage), KHÔNG đồng bộ lên server.
// Nghĩa là: đổi máy hoặc xoá app là mất, và phụ huynh phải xem trên chính máy bé
// dùng. Muốn nhiều máy cùng thấy thì đổi 4 hàm đọc/ghi bên dưới sang Supabase —
// phần còn lại của app không phải sửa gì, vì mọi nơi đều chỉ gọi qua đây.
// (Chưa làm ngay vì tạo bảng cần chạy SQL trên dashboard, mà giai đoạn này đang
// thí nghiệm luồng.)

import type { Exercise } from './rules'

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

/** Chữ ký bài: cao độ + trường độ. Hai bài khác tiết tấu là hai bài khác nhau. */
export function songId(ex: Exercise): string {
  return ex.notes.map(n => `${n.pitch}:${n.duration}`).join('-')
}

function read(): SavedSong[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter(s => s && typeof s.id === 'string' && Array.isArray(s.exercise?.notes))
  } catch { return [] }
}

function write(list: SavedSong[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))) } catch { /* đầy bộ nhớ thì bỏ qua */ }
}

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
    return
  }
  list.unshift({
    id, title: ex.title, levelId, exercise: ex,
    createdAt: now, lastPlayedAt: now,
    plays: 0, bestHit: 0, bestTotal: 0,
  })
  write(list)
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
  // So bằng TỈ LỆ, vì hai lần chơi có thể khác tổng số nốt
  const cuTot = s.bestTotal ? s.bestHit / s.bestTotal : -1
  if (hit / total > cuTot) { s.bestHit = hit; s.bestTotal = total }
  write(list)
}

export function removeSong(id: string): void {
  write(read().filter(s => s.id !== id))
}

export function clearLibrary(): void {
  try { localStorage.removeItem(KEY) } catch { /* */ }
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
