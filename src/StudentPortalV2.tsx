import { useState } from 'react'
import { supabase } from './supabase'

// ─── Grayscale palette ────────────────────────────────────────────────────────
const G = {
  white:  '#FFFFFF',
  50:     '#FAFAFA',
  100:    '#F4F4F4',
  200:    '#E8E8E8',
  300:    '#D0D0D0',
  400:    '#A8A8A8',
  500:    '#787878',
  600:    '#4A4A4A',
  700:    '#2C2C2C',
  800:    '#1A1A1A',
  900:    '#0D0D0D',
  black:  '#000000',
}

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV = [
  { icon: '⌂', label: 'Trang chủ',         active: true  },
  { icon: '🎓', label: 'Học kiến thức',     active: false },
  { icon: '🎯', label: 'Luyện tập',         active: false },
  { icon: '🎸', label: 'Sống cùng âm nhạc', active: false },
  { icon: '🏆', label: 'Thành quả',         active: false },
  { icon: '📋', label: 'Lịch sử',           active: false },
  { icon: '❤', label: 'Yêu thích',         active: false },
]
const NAV_BOTTOM = [
  { icon: '⚙', label: 'Cài đặt'  },
  { icon: '?', label: 'Trợ giúp' },
]

// ─── Mock data ────────────────────────────────────────────────────────────────
const COURSES = [
  { name: 'Nghệ thuật đệm hát',  progress: 5,  total: 24, status: 'Đang học'  },
  { name: 'Hiểu biết âm nhạc',   progress: 5,  total: 18, status: 'Đang học'  },
  { name: 'Nghệ thuật tỉa nốt',  progress: 0,  total: 20, status: 'Chưa học'  },
  { name: 'Con đường nghệ sĩ',   progress: 0,  total: 15, status: 'Chưa học'  },
]
const TASKS = [
  { icon: '🔔', name: 'Tap nhịp',          sub: 'Bài: Thành phố buồn',   time: '10 phút'  },
  { icon: '🎹', name: 'Luyện hợp âm',      sub: 'Am - Em - F - G',       time: '15 phút'  },
  { icon: '☁', name: 'Nộp video bài tập', sub: 'Đệm hát 1 - Buổi 3',   time: 'Còn 1 ngày' },
]
const TOOLS = [
  { name: 'Metronome',          locked: false },
  { name: 'Backing Track',      locked: false },
  { name: 'Nhận diện hợp âm',  locked: false },
  { name: 'Luyện tai',          locked: true  },
  { name: 'Thư viện bài tập',   locked: true  },
  { name: 'Ghi âm - Ghi hình', locked: true  },
]
const EVENTS = [
  { name: 'Workshop cuối tuần',    date: 'Chủ nhật, 09/06/2025' },
  { name: 'Open Mic tháng 6',      date: 'Thứ bảy, 15/06/2025'  },
  { name: 'Giao lưu cùng học viên',date: 'Chủ nhật, 23/06/2025' },
]
const COMMUNITY = [
  { name: 'Nhóm lớp',  locked: false },
  { name: 'Diễn đàn',  locked: false },
  { name: 'Bài viết',  locked: false },
  { name: 'Chia sẻ',   locked: false },
  { name: 'Workshop',  locked: true  },
  { name: 'Open Mic',  locked: true  },
  { name: 'Biểu diễn', locked: true  },
  { name: 'Sáng tác',  locked: true  },
]

interface Student { id: string; full_name: string; email: string | null; level: string | null }

function displayName(s: Student) {
  const n = s.full_name ?? ''
  return n.includes('@') ? n.split('@')[0].toUpperCase() : n.toUpperCase()
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: G.white, border: `1px solid ${G[200]}`,
  borderRadius: 8, padding: 20,
}
const label: React.CSSProperties = {
  fontSize: 11, color: G[400], fontWeight: 500,
  textTransform: 'uppercase', letterSpacing: '.06em',
}
const sectionHead: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start',
  justifyContent: 'space-between', marginBottom: 16,
}

function ProgressBar({ pct, h = 4 }: { pct: number; h?: number }) {
  return (
    <div style={{ height: h, background: G[200], borderRadius: h / 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(pct, pct > 0 ? pct : 0)}%`, background: G[700], borderRadius: h / 2, minWidth: pct > 0 ? 6 : 0 }} />
    </div>
  )
}

interface Props { student: Student; onLogout: () => void }

export default function StudentPortalV2({ student, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const name = displayName(student)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: G[100], fontFamily: '"Segoe UI", Inter, system-ui, sans-serif', color: G[800], fontSize: 14 }}>

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════ */}
      <aside style={{ width: collapsed ? 56 : 160, flexShrink: 0, background: G.white, borderRight: `1px solid ${G[200]}`, display: 'flex', flexDirection: 'column', transition: 'width .2s', overflow: 'hidden' }}>
        {/* Collapse toggle */}
        <button onClick={() => setCollapsed(!collapsed)} style={{ padding: '16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: G[500], fontSize: 18, flexShrink: 0 }}>≡</button>

        <nav style={{ flex: 1, padding: '4px 0' }}>
          {NAV.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', background: item.active ? G[100] : 'transparent', borderLeft: item.active ? `3px solid ${G[800]}` : '3px solid transparent', color: item.active ? G[800] : G[500], fontWeight: item.active ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden' }}
              onMouseEnter={el => { if (!item.active) el.currentTarget.style.background = G[50] }}
              onMouseLeave={el => { if (!item.active) el.currentTarget.style.background = 'transparent' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span style={{ fontSize: 13 }}>{item.label}</span>}
            </div>
          ))}
        </nav>

        <div style={{ borderTop: `1px solid ${G[200]}`, padding: '4px 0' }}>
          {NAV_BOTTOM.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', color: G[500], whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span style={{ fontSize: 13 }}>{item.label}</span>}
            </div>
          ))}
        </div>
      </aside>

      {/* ══ MAIN AREA ════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <header style={{ background: G.white, borderBottom: `1px solid ${G[200]}`, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: G[800] }}>Thầy Văn Anh Guitar</div>
            <div style={{ fontSize: 11, color: G[400] }}>Music Learning System</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{ fontSize: 16 }}>🔥</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1 }}>1</div>
                <div style={{ fontSize: 10, color: G[400] }}>ngày liên tục</div>
              </div>
            </div>
            <div style={{ width: 1, height: 32, background: G[200] }} />
            <span style={{ fontSize: 20, cursor: 'pointer', color: G[500] }}>🔔</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: G[200], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: G[500] }}>👤</div>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{name}</span>
              <span style={{ color: G[400], fontSize: 12 }}>▾</span>
            </div>
            <button onClick={onLogout} style={{ background: 'none', border: `1px solid ${G[300]}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, color: G[500], cursor: 'pointer', fontFamily: 'inherit' }}>Đăng xuất</button>
          </div>
        </header>

        {/* ── SCROLLABLE CONTENT ────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px' }}>

          {/* STUDENT INFO CARD */}
          <div style={{ ...card, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 160px', gap: 0, marginBottom: 20, padding: 0, overflow: 'hidden' }}>
            {/* 1. Xin chào */}
            <div style={{ padding: '20px 24px', borderRight: `1px solid ${G[200]}`, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: G[100], border: `1px solid ${G[200]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>👤</div>
              <div>
                <div style={{ fontSize: 11, color: G[400], marginBottom: 2 }}>Xin chào</div>
                <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '.01em' }}>{name}</div>
                <div style={{ fontSize: 12, color: G[500], marginTop: 2 }}>Học viên · 2 khóa đang học</div>
              </div>
            </div>
            {/* 2. Hành trình */}
            <div style={{ padding: '20px 24px', borderRight: `1px solid ${G[200]}` }}>
              <div style={{ ...label, marginBottom: 6 }}>Hành trình hiện tại:</div>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 3 }}>NGHỆ THUẬT ĐỆM HÁT</div>
              <div style={{ fontSize: 12, color: G[500] }}>Đệm hát 1 · Buổi 3 / 10</div>
            </div>
            {/* 3. Quote */}
            <div style={{ padding: '20px 24px', borderRight: `1px solid ${G[200]}`, display: 'flex', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 20, color: G[300], lineHeight: 1, float: 'left', marginRight: 6 }}>"</span>
                <span style={{ fontSize: 13, color: G[600], lineHeight: 1.6, fontStyle: 'italic' }}>Âm nhạc không chỉ để học, mà để sống cùng mỗi ngày.</span>
                <span style={{ fontSize: 20, color: G[300], lineHeight: 1 }}>"</span>
              </div>
            </div>
            {/* 4. Việc hôm nay */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: 22, marginBottom: 4 }}>📋</span>
              <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>0/–</div>
              <div style={{ fontSize: 12, color: G[400], marginTop: 4 }}>việc hôm nay</div>
            </div>
          </div>

          {/* CENTER TITLE */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '.04em', color: G[800] }}>HỌC - TẬP - SỐNG CÙNG ÂM NHẠC</div>
            <div style={{ fontSize: 13, color: G[500], marginTop: 6 }}>Bạn đang tiến bộ mỗi ngày. Mỗi bước nhỏ đều đưa bạn đến gần hơn với đam mê.</div>
          </div>

          {/* 3-COLUMN GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>

            {/* ── CỘT 1: HỌC KIẾN THỨC ──────────────────────────────── */}
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${G[200]}` }}>
                <div style={sectionHead}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>🎓</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '.03em' }}>HỌC KIẾN THỨC</div>
                      <div style={{ fontSize: 11, color: G[400] }}>Hiểu · Biết · Nắm vững</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: G[500] }}>2 khóa đang học ›</div>
                </div>
              </div>

              {/* Tiếp tục học */}
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${G[200]}` }}>
                <div style={{ ...label, marginBottom: 12 }}>Tiếp tục học</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 44, height: 44, background: G[100], borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🎸</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Đệm hát 1</div>
                    <div style={{ fontSize: 12, color: G[500], margin: '2px 0 6px' }}>Buổi 3 / 10</div>
                    <div style={{ fontSize: 12, color: G[600], marginBottom: 8 }}>Bài tiếp: Kỹ thuật gảy dây liên tục</div>
                    <ProgressBar pct={30} h={4} />
                  </div>
                </div>
                <button style={{ marginTop: 12, width: '100%', background: G[800], color: G.white, border: 'none', borderRadius: 6, padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Học ngay →
                </button>
              </div>

              {/* Các khóa */}
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${G[200]}` }}>
                <div style={{ ...label, marginBottom: 12 }}>Các khóa đang học</div>
                {COURSES.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i > 0 ? `1px solid ${G[100]}` : 'none' }}>
                    <div style={{ width: 30, height: 30, background: G[100], borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🎸</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: G[400] }}>{c.progress} / {c.total} buổi</div>
                    </div>
                    <div style={{ fontSize: 11, color: c.status === 'Đang học' ? G[600] : G[400], flexShrink: 0 }}>{c.status} ›</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 20px' }}>
                <button style={{ width: '100%', background: 'none', border: `1px solid ${G[300]}`, borderRadius: 6, padding: '8px', fontSize: 13, color: G[600], cursor: 'pointer', fontFamily: 'inherit' }}>
                  Xem tất cả khóa học →
                </button>
              </div>
            </div>

            {/* ── CỘT 2: LUYỆN TẬP ───────────────────────────────────── */}
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${G[200]}` }}>
                <div style={sectionHead}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>🎯</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '.03em' }}>LUYỆN TẬP HẰNG NGÀY</div>
                      <div style={{ fontSize: 11, color: G[400] }}>Luyện · Thực hành · Tiến bộ</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: G[500] }}>3 nhiệm vụ ›</div>
                </div>
              </div>

              {/* Nhiệm vụ */}
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${G[200]}` }}>
                <div style={{ ...label, marginBottom: 12 }}>Nhiệm vụ hôm nay</div>
                {TASKS.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: i > 0 ? `1px solid ${G[100]}` : 'none', cursor: 'pointer' }}>
                    <div style={{ width: 36, height: 36, background: G[100], borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{t.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: G[400] }}>{t.sub}</div>
                    </div>
                    <div style={{ fontSize: 11, color: G[500], flexShrink: 0 }}>{t.time} ›</div>
                  </div>
                ))}
              </div>

              {/* Công cụ */}
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${G[200]}` }}>
                <div style={{ ...label, marginBottom: 12 }}>Công cụ luyện tập (mở theo cấp độ)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {TOOLS.map((t, i) => (
                    <div key={i} style={{ background: G[50], border: `1px solid ${G[200]}`, borderRadius: 6, padding: '10px 8px', textAlign: 'center', cursor: t.locked ? 'default' : 'pointer', position: 'relative', opacity: t.locked ? .55 : 1 }}>
                      {t.locked && <span style={{ position: 'absolute', top: 4, right: 4, fontSize: 9 }}>🔒</span>}
                      <div style={{ fontSize: 11, fontWeight: 500, color: G[600], lineHeight: 1.3 }}>{t.name}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '12px 20px' }}>
                <button style={{ width: '100%', background: 'none', border: `1px solid ${G[300]}`, borderRadius: 6, padding: '8px', fontSize: 13, color: G[600], cursor: 'pointer', fontFamily: 'inherit' }}>
                  Mở tất cả công cụ luyện tập →
                </button>
              </div>
            </div>

            {/* ── CỘT 3: SỐNG CÙNG ÂM NHẠC ───────────────────────────── */}
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${G[200]}` }}>
                <div style={sectionHead}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>🎸</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '.03em' }}>SỐNG CÙNG ÂM NHẠC</div>
                      <div style={{ fontSize: 11, color: G[400] }}>Kết nối · Trải nghiệm · Truyền cảm hứng</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: G[500], cursor: 'pointer' }}>Xem tất cả ›</div>
                </div>
              </div>

              {/* Sự kiện */}
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${G[200]}` }}>
                <div style={{ ...label, marginBottom: 12 }}>Sự kiện & hoạt động</div>
                {EVENTS.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i > 0 ? `1px solid ${G[100]}` : 'none' }}>
                    <div style={{ width: 36, height: 36, background: G[100], borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📅</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{e.name}</div>
                      <div style={{ fontSize: 11, color: G[400] }}>{e.date}</div>
                    </div>
                    <button style={{ background: 'none', border: `1px solid ${G[300]}`, borderRadius: 5, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                      Tham gia
                    </button>
                  </div>
                ))}
              </div>

              {/* Cộng đồng */}
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${G[200]}` }}>
                <div style={{ ...label, marginBottom: 12 }}>Cộng đồng (mở theo cấp độ)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                  {COMMUNITY.map((c, i) => (
                    <div key={i} style={{ textAlign: 'center', cursor: c.locked ? 'default' : 'pointer', opacity: c.locked ? .5 : 1, position: 'relative' }}>
                      <div style={{ width: 36, height: 36, background: G[100], borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, margin: '0 auto 4px' }}>
                        {i === 0 ? '👥' : i === 1 ? '💬' : i === 2 ? '📝' : i === 3 ? '↑' : i === 4 ? '📅' : i === 5 ? '🎤' : i === 6 ? '🎵' : '🎼'}
                        {c.locked && <span style={{ position: 'absolute', top: 0, right: 0, fontSize: 8 }}>🔒</span>}
                      </div>
                      <div style={{ fontSize: 10, color: G[500] }}>{c.name}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quote */}
              <div style={{ padding: '16px 20px' }}>
                <span style={{ fontSize: 18, color: G[300], float: 'left', marginRight: 6, lineHeight: 1 }}>"</span>
                <span style={{ fontSize: 12, color: G[500], lineHeight: 1.7, fontStyle: 'italic' }}>
                  Bạn không cần phải giỏi ngay từ đầu. Nhưng bạn phải bắt đầu để trở nên giỏi.
                </span>
                <span style={{ fontSize: 18, color: G[300], lineHeight: 1 }}>"</span>
              </div>
            </div>
          </div>

          {/* ── THÀNH QUẢ BAR ──────────────────────────────────────────── */}
          <div style={{ ...card, display: 'flex', alignItems: 'center', padding: '14px 24px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: G[700], textTransform: 'uppercase', letterSpacing: '.05em', marginRight: 28, flexShrink: 0 }}>Thành Quả Của Tôi</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0 }}>
              {[
                { icon: '🎵', value: 0, label: 'bài hát'        },
                { icon: '🎬', value: 0, label: 'video'          },
                { icon: '🔥', value: 1, label: 'ngày liên tục'  },
                { icon: '🚪', value: 0, label: 'cánh cửa'       },
                { icon: '📚', value: 0, label: 'khóa hoàn thành'},
              ].map((a, i, arr) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: i < arr.length - 1 ? 24 : 0, marginRight: i < arr.length - 1 ? 24 : 0, borderRight: i < arr.length - 1 ? `1px solid ${G[200]}` : 'none' }}>
                  <span style={{ fontSize: 18 }}>{a.icon}</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: G[800] }}>{a.value}</span>
                  <span style={{ fontSize: 12, color: G[400] }}>{a.label}</span>
                </div>
              ))}
            </div>
            <button style={{ flexShrink: 0, background: G[800], color: G.white, border: 'none', borderRadius: 6, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
              🗺 Xem bản đồ hành trình →
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
