import type { UncoveredRange } from './chordAnchors.ts'

/** Cảnh báo (không chặn lưu): đoạn lời hát chưa có ô nào — thường là lời 2 hát lại giai điệu của lời 1. Hết cảnh báo khi đã phủ. */
export default function UncoveredNotice({ ranges, where }: { ranges: UncoveredRange[]; where: string }) {
  if (!ranges.length) return null
  const label = ranges.map(r => r.from === r.to ? `dòng ${r.from + 1}` : `dòng ${r.from + 1}–${r.to + 1}`).join(', ')
  const tokens = ranges.reduce((sum, r) => sum + r.tokens, 0)
  return <p className="cl-warn cl-uncovered" role="note">Lời chưa có vạch nhịp {where}: {label} ({tokens} chữ). Nếu đó là lời 2 hát lại giai điệu, hãy phân tích lại hoặc thêm vạch ở chế độ "Thêm vào cuối (đoạn hát lại)".</p>
}
