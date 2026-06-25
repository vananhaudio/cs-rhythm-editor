// ── 8 slide "Chùm 2 Nốt Móc Đơn" (Beaming) dựng native từ nội dung PPTX ────────
// Vẽ nốt móc đơn + chùm (beam) bằng SVG. Đơn vị cqw/cqh co theo khung.
import type { ReactNode } from 'react'

const IND = '#8B82F0', GOLD = '#E8B96B', SUB = '#A9AECB', GREEN = '#5DCAA5', RED = '#E07A7A'

function Frame({ children, align = 'center' }: { children: ReactNode; align?: 'center' | 'flex-start' }) {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '7cqh 8cqw', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: align, textAlign: align === 'center' ? 'center' : 'left', color: '#fff', background: 'radial-gradient(120% 120% at 80% 0%, #20223A 0%, #0E0F18 70%)' }}>
      {children}
    </div>
  )
}
const Eyebrow = ({ c = IND, children }: { c?: string; children: ReactNode }) => <div style={{ fontSize: '3.3cqw', fontWeight: 800, letterSpacing: '.16em', color: c, marginBottom: '2.5cqh' }}>{children}</div>

// Vẽ một dãy nốt móc đơn theo nhóm chùm. groups = [2,2,2,2] → 4 chùm đôi.
// flagSingle: nhóm 1 nốt vẽ đuôi cong (chưa nối). heightCqh: cao của hình theo khung.
function Beamed({ groups, color = '#EDEFFB', flagSingle = false, heightCqh = 22 }: { groups: number[]; color?: string; flagSingle?: boolean; heightCqh?: number }) {
  const NW = 26, GAP = 16, H = 86, top = 18, baseY = 64
  const els: ReactNode[] = []
  let x = 10, key = 0
  groups.forEach(g => {
    const startX = x
    for (let i = 0; i < g; i++) {
      const cx = x, stemX = cx + 6.4
      els.push(<ellipse key={key++} cx={cx} cy={baseY} rx={7.2} ry={5.2} fill={color} transform={`rotate(-22 ${cx} ${baseY})`} />)
      els.push(<line key={key++} x1={stemX} y1={baseY - 3} x2={stemX} y2={top} stroke={color} strokeWidth={2.6} strokeLinecap="round" />)
      if (g === 1 && flagSingle) els.push(<path key={key++} d={`M ${stemX} ${top} q 11 5 7.5 19`} stroke={color} strokeWidth={2.6} fill="none" strokeLinecap="round" />)
      x += NW
    }
    if (g > 1) {
      const lastStemX = startX + 6.4 + (g - 1) * NW
      els.push(<rect key={key++} x={startX + 6.4 - 1.3} y={top - 1} width={lastStemX - (startX + 6.4) + 2.6} height={6} rx={1} fill={color} />)
    }
    x += GAP
  })
  return <svg viewBox={`0 0 ${x} ${H}`} style={{ height: `${heightCqh}cqh`, width: 'auto', maxWidth: '88cqw', overflow: 'visible' }}>{els}</svg>
}

export const CHUM2_SLIDES: ReactNode[] = [
  // 1 — Tiêu đề
  <Frame key={1}>
    <Eyebrow c={GOLD}>LÝ THUYẾT ÂM NHẠC · MUSIC THEORY</Eyebrow>
    <div style={{ fontSize: '9cqw', fontWeight: 900, lineHeight: 1.05, background: `linear-gradient(90deg,${IND},${GOLD})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Chùm 2 Nốt Móc Đơn</div>
    <div style={{ fontSize: '4.2cqw', fontWeight: 700, color: '#EDEFFB', margin: '2.5cqh 0 4cqh' }}>Beaming — Nối Đuôi Nốt Nhạc</div>
    <div style={{ marginBottom: '4cqh' }}><Beamed groups={[2, 2]} color={GOLD} heightCqh={18} /></div>
    <div style={{ display: 'flex', gap: '2.4cqw', flexWrap: 'wrap', justifyContent: 'center' }}>
      {['Nốt móc đơn là gì?', 'Tại sao nối đuôi?', 'Quy tắc beaming'].map(t => (
        <span key={t} style={{ fontSize: '3.4cqw', fontWeight: 700, color: '#EDEFFB', background: 'rgba(139,130,240,.18)', border: `1px solid ${IND}66`, borderRadius: '5cqw', padding: '1.3cqh 3cqw' }}>{t}</span>
      ))}
    </div>
  </Frame>,

  // 2 — Nốt móc đơn là gì (cấu tạo)
  <Frame key={2} align="flex-start">
    <Eyebrow>NỐT MÓC ĐƠN LÀ GÌ? · EIGHTH NOTE</Eyebrow>
    <div className="ntd-row" style={{ display: 'flex', gap: '4cqw', width: '100%', flex: 1, alignItems: 'center', maxHeight: '64cqh' }}>
      <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'center', minWidth: '26cqw' }}>
        <svg viewBox="0 0 120 200" style={{ height: '30cqh', width: 'auto', overflow: 'visible' }}>
          <ellipse cx={40} cy={150} rx={20} ry={14} fill={GOLD} transform="rotate(-22 40 150)" />
          <line x1={58} y1={142} x2={58} y2={40} stroke="#EDEFFB" strokeWidth={6} strokeLinecap="round" />
          <path d="M 58 40 q 34 14 22 52" stroke={IND} strokeWidth={6} fill="none" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.6cqh' }}>
        {[['①', 'Đầu nốt (Notehead)', 'Hình bầu dục đặc, nghiêng nhẹ', GOLD], ['②', 'Thân nốt (Stem)', 'Đường thẳng dọc nối vào đầu nốt', '#EDEFFB'], ['③', 'Đuôi nốt (Flag)', 'Đường cong gắn vào đỉnh thân nốt', IND]].map(([n, h, d, c]) => (
          <div key={n as string} style={{ display: 'flex', gap: '2.4cqw', alignItems: 'baseline' }}>
            <span style={{ fontSize: '4.4cqw', fontWeight: 900, color: c as string }}>{n}</span>
            <div><div style={{ fontSize: '3.9cqw', fontWeight: 800 }}>{h}</div><div style={{ fontSize: '3.4cqw', color: SUB }}>{d}</div></div>
          </div>
        ))}
        <div style={{ marginTop: '1cqh', fontSize: '3.8cqw', fontWeight: 800, color: GREEN }}>Giá trị: ½ phách <span style={{ color: SUB, fontWeight: 600 }}>( = ½ nốt đen )</span></div>
      </div>
    </div>
  </Frame>,

  // 3 — Chùm (beam) là gì
  <Frame key={3} align="flex-start">
    <Eyebrow>CHÙM (BEAM) LÀ GÌ?</Eyebrow>
    <div className="ntd-row" style={{ display: 'flex', gap: '3cqw', width: '100%', alignItems: 'stretch' }}>
      <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid #33365088', borderRadius: '2cqw', padding: '2.2cqh 3cqw', textAlign: 'center' }}>
        <div style={{ fontSize: '3.2cqw', fontWeight: 800, color: SUB, letterSpacing: '.06em', marginBottom: '1.4cqh' }}>ĐUÔI RIÊNG LẺ</div>
        <Beamed groups={[1, 1, 1, 1]} flagSingle color="#C9CCE8" heightCqh={15} />
        <div style={{ fontSize: '3.2cqw', color: SUB, marginTop: '1.2cqh' }}>Khó đọc khi nhiều nốt</div>
      </div>
      <div style={{ alignSelf: 'center', fontSize: '4.4cqw', color: IND, fontWeight: 900 }}>→</div>
      <div style={{ flex: 1, background: 'rgba(139,130,240,.12)', border: `1px solid ${IND}66`, borderRadius: '2cqw', padding: '2.2cqh 3cqw', textAlign: 'center' }}>
        <div style={{ fontSize: '3.2cqw', fontWeight: 800, color: IND, letterSpacing: '.06em', marginBottom: '1.4cqh' }}>CHÙM (BEAM)</div>
        <Beamed groups={[2, 2]} color={GOLD} heightCqh={15} />
        <div style={{ fontSize: '3.2cqw', color: '#E3E6F5', marginTop: '1.2cqh' }}>Rõ ràng, dễ đọc hơn</div>
      </div>
    </div>
    <div style={{ marginTop: '2cqh', width: '100%', background: 'rgba(232,185,107,.1)', border: `1px solid ${GOLD}55`, borderRadius: '1.6cqw', padding: '2.2cqh 3cqw' }}>
      <div style={{ fontSize: '3cqw', fontWeight: 800, color: GOLD, letterSpacing: '.08em', marginBottom: '.6cqh' }}>⚠ LƯU Ý QUAN TRỌNG</div>
      <div style={{ fontSize: '3.6cqw', color: '#EDEFFB' }}>Chùm <b>KHÔNG</b> thay đổi âm thanh — chỉ là cách viết khác nhau, âm phát ra hoàn toàn giống nhau.</div>
    </div>
  </Frame>,

  // 4 — Giá trị thời gian
  <Frame key={4}>
    <Eyebrow c={GOLD}>GIÁ TRỊ THỜI GIAN</Eyebrow>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3.5cqw', marginBottom: '3cqh' }}>
      <Pill main="♪" sub="½ phách" c={IND} />
      <span style={{ fontSize: '5cqw', fontWeight: 900, color: SUB }}>+</span>
      <Pill main="♪" sub="½ phách" c={IND} />
      <span style={{ fontSize: '5cqw', fontWeight: 900, color: SUB }}>=</span>
      <div style={{ textAlign: 'center' }}>
        <Beamed groups={[2]} color={GOLD} heightCqh={16} />
        <div style={{ fontSize: '3cqw', color: GOLD, fontWeight: 700, marginTop: '.5cqh' }}>1 chùm</div>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3.5cqw', marginBottom: '4cqh' }}>
      <span style={{ fontSize: '3.4cqw', color: GOLD, fontWeight: 700 }}>1 chùm</span>
      <span style={{ fontSize: '5cqw', fontWeight: 900, color: SUB }}>=</span>
      <Pill main="♩" sub="1 nốt đen" c={GREEN} />
    </div>
    <div style={{ fontSize: '4.6cqw', fontWeight: 800, color: '#EDEFFB' }}>½ phách + ½ phách = <span style={{ color: GREEN }}>1 phách</span></div>
    <div style={{ fontSize: '3.6cqw', color: SUB, marginTop: '2cqh' }}>Chùm 2 nốt móc đơn = 1 nốt đen (♩)</div>
  </Frame>,

  // 5 — Tại sao cần nối đuôi
  <Frame key={5} align="flex-start">
    <Eyebrow>TẠI SAO CẦN NỐI ĐUÔI?</Eyebrow>
    <div className="ntd-row" style={{ display: 'flex', gap: '3cqw', width: '100%', flex: 1, maxHeight: '62cqh' }}>
      <div style={{ flex: 1, background: 'rgba(224,122,122,.08)', border: `1px solid ${RED}55`, borderRadius: '2cqw', padding: '3cqh 3cqw', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '3.6cqw', fontWeight: 800, color: RED, marginBottom: '2cqh' }}>✗ Không nối đuôi — khó đọc</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Beamed groups={[1, 1, 1, 1, 1, 1, 1, 1]} flagSingle color="#D8B0B0" heightCqh={18} /></div>
        <div style={{ fontSize: '3.2cqw', color: SUB, marginTop: '2cqh' }}>Không biết phách bắt đầu và kết thúc ở đâu.</div>
      </div>
      <div style={{ flex: 1, background: 'rgba(93,202,165,.1)', border: `1px solid ${GREEN}66`, borderRadius: '2cqw', padding: '3cqh 3cqw', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '3.6cqw', fontWeight: 800, color: GREEN, marginBottom: '2cqh' }}>✓ Nối đuôi đúng — thấy rõ phách</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Beamed groups={[2, 2, 2, 2]} color="#BfeAd6" heightCqh={18} /></div>
        <div style={{ fontSize: '3.2cqw', color: '#E3E6F5', marginTop: '2cqh' }}>Mỗi chùm = 1 phách → thấy ngay 4 phách rõ ràng.</div>
      </div>
    </div>
  </Frame>,

  // 6 — Quy tắc vàng
  <Frame key={6} align="flex-start">
    <Eyebrow c={GOLD}>QUY TẮC VÀNG CỦA BEAMING</Eyebrow>
    <div style={{ fontSize: '4.4cqw', fontWeight: 800, color: '#EDEFFB', lineHeight: 1.4, marginBottom: '3cqh' }}>Luôn <span style={{ color: GOLD }}>ngắt đường nối</span> tại ranh giới giữa các phách.</div>
    <div className="ntd-row" style={{ display: 'flex', gap: '3cqw', width: '100%' }}>
      <div style={{ flex: 1, background: 'rgba(224,122,122,.08)', border: `1px solid ${RED}55`, borderRadius: '2cqw', padding: '2.6cqh 3cqw', textAlign: 'center' }}>
        <div style={{ fontSize: '3.2cqw', fontWeight: 800, color: RED, marginBottom: '1.6cqh' }}>✗ Sai — nối vượt ranh giới</div>
        <Beamed groups={[4]} color="#D8B0B0" heightCqh={18} />
      </div>
      <div style={{ flex: 1, background: 'rgba(93,202,165,.1)', border: `1px solid ${GREEN}66`, borderRadius: '2cqw', padding: '2.6cqh 3cqw', textAlign: 'center' }}>
        <div style={{ fontSize: '3.2cqw', fontWeight: 800, color: GREEN, marginBottom: '1.6cqh' }}>✓ Đúng — ngắt tại ranh giới</div>
        <Beamed groups={[2, 2]} color="#BfeAd6" heightCqh={18} />
      </div>
    </div>
    <div style={{ fontSize: '3.4cqw', color: SUB, marginTop: '3cqh' }}>Nốt cùng phách → nối lại · Nốt khác phách → tách ra</div>
  </Frame>,

  // 7 — Beaming 4/4
  <Frame key={7}>
    <Eyebrow>BEAMING TRONG NHỊP 4/4</Eyebrow>
    <div style={{ fontSize: '3.7cqw', color: SUB, marginBottom: '4cqh' }}>4 phách · 8 nốt móc đơn · 4 chùm (mỗi chùm = 1 phách)</div>
    <div style={{ display: 'flex', gap: '2cqw', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '2cqh' }}>
      {[1, 2, 3, 4].map(b => (
        <div key={b} style={{ background: 'rgba(139,130,240,.12)', border: `1px solid ${IND}55`, borderRadius: '1.4cqw', padding: '2cqh 1.6cqw', textAlign: 'center' }}>
          <Beamed groups={[2]} color={GOLD} heightCqh={15} />
          <div style={{ fontSize: '2.8cqw', color: IND, fontWeight: 700, marginTop: '.6cqh' }}>Phách {b}</div>
        </div>
      ))}
    </div>
    <div style={{ fontSize: '3.4cqw', color: '#E3E6F5', marginTop: '2cqh' }}>Thanh nối <span style={{ color: GOLD }}>vàng</span> = 1 chùm = 1 phách · 4 chùm riêng biệt, không nối liên tiếp.</div>
  </Frame>,

  // 8 — Nhịp 3/4 + Tóm tắt
  <Frame key={8} align="flex-start">
    <Eyebrow>NHỊP 3/4 · TÓM TẮT BÀI HỌC</Eyebrow>
    <div style={{ display: 'flex', gap: '2cqw', alignItems: 'flex-end', marginBottom: '1.4cqh' }}>
      {[1, 2, 3].map(b => (
        <div key={b} style={{ flex: 1, background: 'rgba(139,130,240,.12)', border: `1px solid ${IND}55`, borderRadius: '1.4cqw', padding: '1.6cqh 1.4cqw', textAlign: 'center' }}>
          <Beamed groups={[2]} color={GOLD} heightCqh={13} />
          <div style={{ fontSize: '2.6cqw', color: IND, fontWeight: 700 }}>Phách {b}</div>
        </div>
      ))}
    </div>
    <div style={{ fontSize: '3.2cqw', color: SUB, marginBottom: '3cqh' }}>3 phách · 6 nốt · 3 chùm</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4cqh', width: '100%' }}>
      {[['♪ Nốt móc đơn = ½ phách', 'Có đầu nốt đặc, thân nốt và một đuôi cong'], ['Chùm 2 nốt = 1 phách (= ♩)', 'Thanh ngang thay thế hai đuôi riêng lẻ'], ['Không thay đổi âm thanh', 'Chỉ giúp đọc nhịp phách dễ hơn'], ['Quy tắc vàng', 'Ngắt đường nối tại ranh giới phách']].map(([h, d]) => (
        <div key={h} style={{ display: 'flex', gap: '2cqw', alignItems: 'baseline' }}>
          <span style={{ color: GREEN, fontSize: '3.6cqw' }}>✓</span>
          <div><span style={{ fontSize: '3.6cqw', fontWeight: 800 }}>{h}</span> <span style={{ fontSize: '3.2cqw', color: SUB }}>— {d}</span></div>
        </div>
      ))}
    </div>
  </Frame>,
]

function Pill({ main, sub, c }: { main: string; sub: string; c: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '7cqw', fontWeight: 900, color: c, lineHeight: 1 }}>{main}</div>
      <div style={{ fontSize: '3cqw', color: SUB, marginTop: '.6cqh' }}>{sub}</div>
    </div>
  )
}
