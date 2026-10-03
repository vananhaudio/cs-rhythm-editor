// ── RHYTHM SCROLL VIEWER — đồng hồ thử nghiệm ──
// NGUỒN THỜI GIAN DUY NHẤT của prototype: chỉ sinh ra "số giây đã trôi". Không biết BPM, ô nhịp hay bài hát.
// Consumer có transport thật (TeamLab) sẽ KHÔNG dùng file này mà đưa thẳng vị trí của họ vào viewer.

export interface ProofClock {
  readonly playing: boolean
  elapsedSeconds(): number
  play(): void
  pause(): void
  restart(): void
  /** Đặt lại số giây đã trôi mà không đổi trạng thái chạy/dừng. */
  seek(seconds: number): void
}

/** `now` trả mili-giây (mặc định performance.now) — tiêm vào để test không phụ thuộc thời gian thật. */
export function createProofClock(now: () => number = () => performance.now()): ProofClock {
  let playing = false
  let base = 0        // giây đã tích luỹ tới lần play/seek gần nhất
  let startedAt = 0   // mốc `now` của lần play gần nhất
  const elapsed = () => (playing ? base + (now() - startedAt) / 1000 : base)
  return {
    get playing() { return playing },
    elapsedSeconds: elapsed,
    play() {
      if (playing) return
      startedAt = now()
      playing = true
    },
    pause() {
      base = elapsed()
      playing = false
    },
    restart() {
      base = 0
      startedAt = now()
    },
    seek(seconds: number) {
      if (!Number.isFinite(seconds)) throw new RangeError('seconds phải là số hữu hạn.')
      base = Math.max(0, seconds)
      startedAt = now()
    },
  }
}

/**
 * Đổi BPM giữa chừng: quy đổi số giây đã trôi để VỊ TRÍ Ô NHỊP giữ nguyên, chỉ tốc độ đổi.
 * (measurePosition = giây × BPM / …, nên giữ nguyên giây thì bài sẽ nhảy cóc.)
 */
export function secondsAfterTempoChange(elapsedSeconds: number, fromBpm: number, toBpm: number): number {
  if (!(fromBpm > 0) || !(toBpm > 0) || !Number.isFinite(fromBpm) || !Number.isFinite(toBpm)) {
    throw new RangeError('BPM phải là số dương hữu hạn.')
  }
  return (elapsedSeconds * fromBpm) / toBpm
}
