// Phiên luyện tập ĐO THẬT (Metronome): cộng dồn thời gian ĐANG CHẠY theo từng BPM; kết thúc → tổng giây + BPM dùng
// lâu nhất. THUẦN (test được) — không XP/điểm/streak, chỉ số liệu thật.
export type PracticeSession = { segStart: number; segBpm: number; msByBpm: Record<number, number> }

export const startSession = (now: number, bpm: number): PracticeSession => ({ segStart: now, segBpm: bpm, msByBpm: {} })

function closeSegment(s: PracticeSession, now: number): Record<number, number> {
  const ms = Math.max(0, now - s.segStart)
  return { ...s.msByBpm, [s.segBpm]: (s.msByBpm[s.segBpm] ?? 0) + ms }
}

/** Đổi BPM khi đang chạy → đóng đoạn cũ, mở đoạn mới. */
export const changeSessionBpm = (s: PracticeSession, now: number, bpm: number): PracticeSession =>
  bpm === s.segBpm ? s : { segStart: now, segBpm: bpm, msByBpm: closeSegment(s, now) }

/** Dừng → { seconds tổng, bpm dùng lâu nhất } (hoà thời gian → lấy BPM lớn hơn, cho kết quả xác định). */
export function endSession(s: PracticeSession, now: number): { seconds: number; bpm: number } {
  const map = closeSegment(s, now)
  const entries = Object.entries(map).map(([b, ms]) => [Number(b), ms] as const)
  const total = entries.reduce((a, [, ms]) => a + ms, 0)
  const [bpm] = entries.reduce((best, cur) => (cur[1] > best[1] || (cur[1] === best[1] && cur[0] > best[0]) ? cur : best), [s.segBpm, -1] as readonly [number, number])
  return { seconds: Math.floor(total / 1000), bpm }
}
