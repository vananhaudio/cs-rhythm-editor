// ── FretboardMap — sơ đồ cần đàn (SVG) cho tài liệu học ──
// Vẽ bằng SVG để in A4 sắc nét và không phụ thuộc kích thước màn hình.
// string: 1 = Mi cao (trên cùng) … 6 = Mi trầm (dưới cùng) — chuẩn như alphaTab.
import type { FretDot, FretZone } from './lessonTypes'

interface Props { frets: number; zones: FretZone[]; dots: FretDot[] }

const PAD_L = 46, PAD_T = 34, PAD_B = 30, PAD_R = 16
const FW = 54            // bề rộng một ngăn
const SG = 30            // khoảng cách dây
const R = 11             // bán kính nốt
const MARKERS = [3, 5, 7, 9, 12, 15, 17]

const strY = (s: number) => PAD_T + (s - 1) * SG
// tâm của ngăn n (n>=1); ngăn 0 = dây buông, nằm TRÁI phím đàn
const fretX = (n: number) => (n === 0 ? PAD_L - 24 : PAD_L + (n - 1) * FW + FW / 2)
const fretLineX = (n: number) => PAD_L + n * FW

export default function FretboardMap({ frets, zones, dots }: Props) {
  const W = PAD_L + frets * FW + PAD_R
  const H = PAD_T + 5 * SG + PAD_B
  const top = strY(1), bot = strY(6)
  // Sơ đồ ngắn (vài ngăn) thì đừng kéo giãn cho bằng sơ đồ cả cần — nhìn sẽ quá khổ.
  const compact = frets <= 7

  return (
    <div className={`lsn-fb${compact ? ' is-compact' : ''}`} style={compact ? { maxWidth: 430 } : undefined}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
           aria-label="Bản đồ nốt giản lược C–Am trên cần đàn">
        {/* nền vùng */}
        {zones.map(z => {
          const x0 = z.fromFret === 0 ? PAD_L - 40 : fretLineX(z.fromFret - 1)
          const x1 = fretLineX(z.toFret)
          const y0 = strY(z.strings[0]) - SG * 0.6
          const y1 = strY(z.strings[1]) + SG * 0.6
          return (
            <g key={z.no}>
              <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={10}
                    fill={z.color} fillOpacity={0.1} stroke={z.color} strokeOpacity={0.55}
                    strokeDasharray="5 4" />
              {/* nhãn đặt trong lòng phím đàn, không lấn cột tên dây */}
              <text x={Math.max(x0 + 8, PAD_L + 6)} y={Math.max(y0 - 6, 14)} fontSize={12.5}
                    fontWeight={700} fill={z.color}>
                {z.tag ?? `VÙNG ${z.no}`}
              </text>
            </g>
          )
        })}

        {/* phím đàn */}
        {Array.from({ length: frets + 1 }, (_, i) => (
          <line key={i} x1={fretLineX(i)} y1={top} x2={fretLineX(i)} y2={bot}
                stroke={i === 0 ? '#1D1930' : '#B8B3C8'} strokeWidth={i === 0 ? 5 : 1.4} />
        ))}
        {/* dây */}
        {[1, 2, 3, 4, 5, 6].map(s => (
          <line key={s} x1={PAD_L} y1={strY(s)} x2={fretLineX(frets)} y2={strY(s)}
                stroke="#6A6580" strokeWidth={0.6 + (s - 1) * 0.22} />
        ))}
        {/* chấm định vị cần đàn */}
        {MARKERS.filter(m => m <= frets).map(m => (
          <circle key={m} cx={fretX(m)} cy={(top + bot) / 2} r={4} fill="#CFC9E0" />
        ))}
        {/* số ngăn */}
        {Array.from({ length: frets }, (_, i) => i + 1).map(n => (
          <text key={n} x={fretX(n)} y={bot + 20} fontSize={11.5} textAnchor="middle" fill="#6A6580">{n}</text>
        ))}
        {/* tên dây */}
        {['e', 'B', 'G', 'D', 'A', 'E'].map((l, i) => (
          <text key={l + i} x={12} y={strY(i + 1) + 4} fontSize={12} fontWeight={600} fill="#3E3952">{l}</text>
        ))}

        {/* nốt */}
        {dots.map((d, i) => {
          const z = zones.find(zz => zz.no === d.zone)
          const c = z?.color ?? '#4338CA'
          return (
            <g key={i}>
              <circle cx={fretX(d.fret)} cy={strY(d.string)} r={R}
                      fill={d.root ? c : '#FFFFFF'} stroke={c} strokeWidth={2} />
              <text x={fretX(d.fret)} y={strY(d.string) + 4} fontSize={12} fontWeight={700}
                    textAnchor="middle" fill={d.root ? '#FFFFFF' : c}>{d.name}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
