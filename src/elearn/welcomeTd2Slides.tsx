// ── 8 slide "Chào mừng Trình độ 2" dựng native (từ nội dung PPTX) ─────────────
// Dùng đơn vị cqw/cqh để chữ co theo khung 16:9. Màu: nền tối + tím + vàng.
import type { ReactNode } from 'react'

const IND = '#8B82F0', GOLD = '#E8B96B', SUB = '#A9AECB'

function Frame({ children, align = 'center' }: { children: ReactNode; align?: 'center' | 'flex-start' }) {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '7cqh 8cqw', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: align, textAlign: align === 'center' ? 'center' : 'left', color: '#fff', background: 'radial-gradient(120% 120% at 80% 0%, #20223A 0%, #0E0F18 70%)' }}>
      {children}
    </div>
  )
}
const Eyebrow = ({ c = IND, children }: { c?: string; children: ReactNode }) => <div style={{ fontSize: '2.6cqw', fontWeight: 800, letterSpacing: '.18em', color: c, marginBottom: '2.5cqh' }}>{children}</div>
const Card = ({ tag, en, vi, desc, c }: { tag: string; en: string; vi: string; desc: string; c: string }) => (
  <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: `1px solid ${c}55`, borderRadius: '2cqw', padding: '3.4cqh 3cqw' }}>
    <div style={{ fontSize: '2.1cqw', fontWeight: 800, color: c, letterSpacing: '.05em' }}>{tag}</div>
    <div style={{ fontSize: '4.6cqw', fontWeight: 800, margin: '.6cqh 0 .2cqh' }}>{en}</div>
    <div style={{ fontSize: '2.2cqw', color: SUB, marginBottom: '1.4cqh' }}>{vi}</div>
    <div style={{ fontSize: '2.5cqw', color: '#D7DAEE', lineHeight: 1.5 }}>{desc}</div>
  </div>
)

export const WELCOME_TD2_SLIDES: ReactNode[] = [
  // 1 — Tiêu đề
  <Frame key={1}>
    <Eyebrow c={GOLD}>KHỞI ĐẦU ĐAM MÊ</Eyebrow>
    <div style={{ fontSize: '11cqw', fontWeight: 900, lineHeight: 1, background: `linear-gradient(90deg,${IND},${GOLD})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TRÌNH ĐỘ 2</div>
    <div style={{ fontSize: '4.4cqw', fontWeight: 700, color: '#EDEFFB', marginTop: '3cqh' }}>Chùm Nốt &amp; Tiết Tấu</div>
  </Frame>,
  // 2 — Ôn lại TĐ1
  <Frame key={2} align="flex-start">
    <Eyebrow>ÔN LẠI TRÌNH ĐỘ 1 · NỀN TẢNG ĐÃ CÓ</Eyebrow>
    <div style={{ display: 'flex', gap: '3cqw', width: '100%', flex: 1, maxHeight: '62cqh' }}>
      <Card c="#5DCAA5" tag="✓ ĐÃ HỌC" en="PHÁCH" vi="Beat" desc="Đơn vị thời gian cơ bản mà con người cảm nhận được trong âm nhạc." />
      <Card c="#5DA8E0" tag="✓ ĐÃ HỌC" en="NHỊP" vi="Meter" desc="Cách tổ chức các phách mạnh – nhẹ thành chu kỳ có trật tự." />
    </div>
  </Frame>,
  // 3 — Quote
  <Frame key={3}>
    <Eyebrow c={GOLD}>TRÌNH ĐỘ 2</Eyebrow>
    <div style={{ fontSize: '5.6cqw', fontWeight: 800, lineHeight: 1.4, color: '#EDEFFB', maxWidth: '82cqw' }}>“Khi hiểu Phách – Nhịp,<br />hành trình bắt đầu <span style={{ color: GOLD }}>thú vị hơn</span>.”</div>
  </Frame>,
  // 4 — Hai khái niệm mới
  <Frame key={4} align="flex-start">
    <Eyebrow>TRÌNH ĐỘ 2 · HAI KHÁI NIỆM MỚI</Eyebrow>
    <div style={{ display: 'flex', gap: '3cqw', width: '100%', flex: 1, maxHeight: '62cqh' }}>
      <Card c={IND} tag="01" en="CHÙM NỐT" vi="Note grouping" desc="Cách chia nhỏ một phách thành những nhóm âm thanh khác nhau." />
      <Card c={GOLD} tag="02" en="TIẾT TẤU" vi="Rhythm" desc="Cách sắp xếp các trường độ ngắn – dài trong thời gian để tạo nên chuyển động âm nhạc." />
    </div>
  </Frame>,
  // 5 — Khi tiết tấu thay đổi
  <Frame key={5}>
    <div style={{ fontSize: '3cqw', color: SUB, marginBottom: '2cqh' }}>Cùng một vòng hợp âm · Cùng một tốc độ · Cùng một bài hát</div>
    <div style={{ fontSize: '6.2cqw', fontWeight: 900, color: GOLD, marginBottom: '3cqh' }}>Khi tiết tấu thay đổi…</div>
    <div style={{ display: 'flex', gap: '2cqw', flexWrap: 'wrap', justifyContent: 'center' }}>
      {['Mềm hơn', 'Dày hơn', 'Mạnh mẽ hơn', 'Uyển chuyển hơn', 'Cuốn hút hơn'].map(t => (
        <span key={t} style={{ fontSize: '3cqw', fontWeight: 700, color: '#EDEFFB', background: 'rgba(139,130,240,.18)', border: `1px solid ${IND}66`, borderRadius: '5cqw', padding: '1.2cqh 3cqw' }}>{t}</span>
      ))}
    </div>
  </Frame>,
  // 6 — Lộ trình
  <Frame key={6} align="flex-start">
    <Eyebrow>LỘ TRÌNH · BẢN ĐỒ PHÁT TRIỂN</Eyebrow>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.6cqw', width: '100%', flexWrap: 'wrap' }}>
      {[['Phách', 1], ['Nhịp', 1], ['Chùm nốt', 2], ['Tiết tấu', 2], ['Điệu', 0]].map(([t, st], i, a) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '1.4cqw' }}>
          <span style={{ fontSize: '3cqw', fontWeight: 800, padding: '1.4cqh 2.6cqw', borderRadius: '2cqw', background: st === 1 ? 'rgba(93,202,165,.18)' : st === 2 ? 'rgba(139,130,240,.2)' : 'rgba(255,255,255,.06)', border: `1px solid ${st === 1 ? '#5DCAA5' : st === 2 ? IND : '#3A3D55'}`, color: st === 1 ? '#5DCAA5' : st === 2 ? IND : SUB }}>
            {st === 1 ? '✓ ' : st === 2 ? '◉ ' : ''}{t}
          </span>
          {i < a.length - 1 && <span style={{ color: '#4A4D6B', fontSize: '3cqw' }}>→</span>}
        </span>
      ))}
    </div>
    <div style={{ fontSize: '2.4cqw', color: SUB, marginTop: '3cqh' }}>✓ Đã học · ◉ Đang chinh phục ở Trình độ 2</div>
  </Frame>,
  // 7 — Mục tiêu
  <Frame key={7} align="flex-start">
    <Eyebrow>MỤC TIÊU TRÌNH ĐỘ 2 · HIỂU GỐC CỦA ĐIỆU</Eyebrow>
    <div style={{ display: 'flex', gap: '2.4cqw', width: '100%', flex: 1, maxHeight: '60cqh' }}>
      {[['01', 'Học điệu nhanh hơn', 'Hiểu nguyên lý, không cần ghi nhớ máy móc từng điệu.'], ['02', 'Nhớ lâu hơn', 'Gốc rễ vững thì kiến thức không bị quên theo thời gian.'], ['03', 'Chơi linh hoạt hơn', 'Tiếng đàn có sức sống và cảm giác âm nhạc riêng biệt.']].map(([n, h, d]) => (
        <div key={n} style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid #33365088', borderRadius: '2cqw', padding: '3cqh 2.4cqw' }}>
          <div style={{ fontSize: '4cqw', fontWeight: 900, color: GOLD }}>{n}</div>
          <div style={{ fontSize: '3.2cqw', fontWeight: 800, margin: '1cqh 0' }}>{h}</div>
          <div style={{ fontSize: '2.4cqw', color: '#D7DAEE', lineHeight: 1.45 }}>{d}</div>
        </div>
      ))}
    </div>
  </Frame>,
  // 8 — Kết
  <Frame key={8}>
    <div style={{ fontSize: '5.4cqw', fontWeight: 800, color: '#EDEFFB', lineHeight: 1.5 }}>Từ <span style={{ color: '#5DCAA5' }}>chơi chắc nhịp</span><br />đến <span style={{ color: GOLD }}>chơi có tiết tấu</span>.</div>
    <div style={{ fontSize: '3.4cqw', color: SUB, marginTop: '3.5cqh' }}>Từ đánh <b style={{ color: '#fff' }}>đúng</b> đến đánh <b style={{ color: GOLD }}>hay hơn</b>.</div>
  </Frame>,
]
