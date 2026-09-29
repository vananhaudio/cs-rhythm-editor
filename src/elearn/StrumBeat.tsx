// ── STRUM SCORE — vẽ MỘT PHÁCH (tách từ ChordStrumPlayer để dùng chung, không kéo theo Supabase) ──
// Vẽ MỘT CHÙM (1..4 nốt) trong một phách — đầu nốt slash dày, thân cao, nối chùm + ↓/↑.
// M=1 nốt đen; M=2 chùm 2; M=3 liên ba (có số "3", CHIA ĐỀU) hoặc đơn kép kép (CHIA LỆCH, không có số 3); M=4 móc kép.
// Vị trí từng cú quạt tính theo `frac` (tỉ lệ trường độ) — hình chia lệch (vd đơn kép kép 2:1:1) sẽ dãn cách không đều. lit = phách đang chơi.
// detail (giáo trình): nhãn event dưới nốt thay mũi tên (B, 3, Chát, Bùm…), dấu nhấn >, dầm thứ hai cho móc kép.
// Không bật detail → hiển thị y như màn gảy-theo trước đây.
import type { FigureStroke } from './strumPatterns'

const INDIGO = '#4338CA', DIM = '#C0C6D2'
const INK = '#1F2430'
const isSixteenth = (s: FigureStroke) => s.frac <= 0.25 + 1e-6

export function StrumBeat({ strokes, lit, detail = false }: { strokes: FigureStroke[]; lit: boolean; detail?: boolean }) {
  const c = lit ? INDIGO : detail ? INK : DIM, ac = lit ? INDIGO : detail ? INK : '#9AA0B0'
  const M = Math.max(1, strokes.length)
  const longest = detail ? Math.max(0, ...strokes.map((s) => (s.label ?? '').length)) : 0
  const SP = Math.max(19, longest * 7 + 8), pad = 6, W = pad * 2 + (M - 1) * SP + 10 + (longest > 2 ? longest * 3 : 0)   // bề rộng theo số nốt (+ nhãn dài)
  const top = 4, stemBot = 31, base = 40
  const trackW = (M - 1) * SP
  const fracLast = strokes[M - 1]?.frac ?? 1 / M
  const denom = Math.max(0.0001, 1 - fracLast)   // quy đổi vị trí cú CUỐI luôn về đúng mép trackW (giữ nguyên cỡ hình chia đều cũ)
  const starts = strokes.map((_, i) => strokes.slice(0, i).reduce((sum, s) => sum + s.frac, 0))   // vị trí bắt đầu (tổng frac trước đó)
  const xs = starts.map((cum) => pad + 5 + trackW * (cum / denom))
  const isTriplet = M === 3 && strokes.every((s) => Math.abs(s.frac - 1 / 3) < 0.01)   // chỉ liên ba (chia đều) mới có số "3"
  const accentY = isTriplet ? top - 12 : top - 3
  return (
    <svg viewBox={`0 ${detail ? -14 : 0} ${W} ${detail ? 82 : 60}`} style={{ height: detail ? 72 : 52, width: 'auto', maxWidth: '100%', overflow: 'visible', display: 'block' }}>
      {M >= 2 && <rect x={xs[0]} y={top} width={xs[M - 1] - xs[0]} height={4} rx={1} fill={c} />}
      {/* dầm thứ hai: nối các móc kép liền nhau (chỉ ở chế độ giáo trình) */}
      {detail && M >= 2 && strokes.map((s, i) => i < M - 1 && isSixteenth(s) && isSixteenth(strokes[i + 1])
        ? <rect key={`b2${i}`} x={xs[i]} y={top + 7} width={xs[i + 1] - xs[i]} height={4} rx={1} fill={c} /> : null)}
      {isTriplet && <text x={(xs[0] + xs[2]) / 2} y={top - 1} fontSize={9} textAnchor="middle" fontWeight={800} fill={ac}>3</text>}
      {xs.map((x, i) => (
        <g key={i}>
          <line x1={x} y1={M >= 2 ? top + 2 : 8} x2={x} y2={stemBot} stroke={c} strokeWidth={3} />
          <line x1={x - 9.5} y1={base + 7} x2={x + 1} y2={base - 3} stroke={c} strokeWidth={4.6} strokeLinecap="round" />
          {detail && strokes[i].accent && <text x={x} y={accentY} fontSize={12} textAnchor="middle" fontWeight={900} fill={ac}>&gt;</text>}
          {detail && strokes[i].label
            ? <text x={x - 4} y={64} fontSize={12} textAnchor="middle" fontWeight={800} fill={ac}>{strokes[i].label}</text>
            : (!detail || strokes[i].dir) && <text x={x - 4} y={detail ? 64 : 57} fontSize={11.5} textAnchor="middle" fontWeight={800} fill={ac}>{strokes[i].dir === 'U' ? '↑' : '↓'}</text>}
        </g>
      ))}
    </svg>
  )
}
