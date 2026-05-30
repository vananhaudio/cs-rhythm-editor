import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const D = {
  bg: '#F4F4F5', surface: '#FFFFFF', surfaceHover: '#FAFAFA',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  border: '#E4E4E7', borderLight: '#F0F0F1',
  accent: '#4F46E5', accentLight: '#EEF2FF', accentMid: '#818CF8',
  success: '#16A34A', successBg: '#F0FDF4',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
}
const NAV = [
  { icon: '⊞', label: 'Trang chủ', active: true },
  { icon: '◎', label: 'Học kiến thức', active: false },
  { icon: '◈', label: 'Luyện tập', active: false },
  { icon: '♫', label: 'Sống cùng âm nhạc', active: false },
  { icon: '◆', label: 'Thành quả', active: false },
  { icon: '≡', label: 'Lịch sử', active: false },
  { icon: '♡', label: 'Yêu thích', active: false },
]
const NAV_BOTTOM = [
  { icon: '⚙', label: 'Cài đặt' },
  { icon: '?', label: 'Trợ giúp' },
]
const COURSES = [
  { name: 'Nghệ thuật đệm hát', done: 5, total: 24, active: true, course_id: '' },
  { name: 'Hiểu biết âm nhạc', done: 5, total: 18, active: true, course_id: '' },
  { name: 'Nghệ thuật tỉa nốt', done: 0, total: 20, active: false, course_id: '' },
  { name: 'Con đường nghệ sĩ', done: 0, total: 15, active: false, course_id: '' },
]
const TASKS = [
  { name: 'Tap nhịp', sub: 'Thành phố buồn', time: '10 phút' },
  { name: 'Luyện hợp âm', sub: 'Am · Em · F · G', time: '15 phút' },
  { name: 'Nộp video bài tập', sub: 'Đệm hát 1 – Buổi 3', time: 'Còn 1 ngày' },
]
const EVENTS = [
  { name: 'Workshop cuối tuần', date: 'CN, 09/06/2025' },
  { name: 'Open Mic tháng 6', date: 'T7, 15/06/2025' },
  { name: 'Giao lưu cùng học viên', date: 'CN, 23/06/2025' },
]
const COMMUNITY = [
  { name: 'Nhóm lớp', locked: false },
  { name: 'Diễn đàn', locked: false },
  { name: 'Bài viết', locked: false },
  { name: 'Chia sẻ', locked: false },
  { name: 'Workshop', locked: true },
  { name: 'Open Mic', locked: true },
  { name: 'Biểu diễn', locked: true },
  { name: 'Sáng tác', locked: true },
]

interface Student { id: string; full_name: string; email: string | null; level: string | null }
interface DBTool { id: string; icon: string; name: string; description: string | null; category: string; route: string; tier: string; enabled: boolean }
interface Enrollment {
  id: string; course_id: string; enrolled_at: string
  course: { id: string; name: string; slug: string; type: string; track: string | null }
}

function uname(s: Student) {
  const n = s.full_name ?? ''
  return (n.includes('@') ? n.split('@')[0] : n).toUpperCase()
}
function Bar({ pct, color = D.accent }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 3, background: D.border, borderRadius: 99 }}>
      <div style={{ height: '100%', width: `${Math.max(pct > 0 ? pct : 0, 0)}%`, minWidth: pct > 0 ? 6 : 0, background: color, borderRadius: 99 }} />
    </div>
  )
}
function ColHeader({ icon, title, sub, badge, action }: { icon: string; title: string; sub: string; badge?: string; action?: string }) {
  return (
    <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${D.border}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: D.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{icon}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: D.text1 }}>{title}</div>
            <div style={{ fontSize: 11, color: D.text3, marginTop: 1 }}>{sub}</div>
          </div>
        </div>
        {(badge || action) && <div style={{ fontSize: 11, color: D.accent, fontWeight: 500, cursor: 'pointer', marginTop: 2 }}>{badge ?? action} →</div>}
      </div>
    </div>
  )
}

interface Props { student: Student; onLogout: () => void }

const TIER_ORDER = ['free', 'basic', 'standard', 'pro']
const LEVEL_TIER: Record<string, string> = { beginner: 'free', elementary: 'basic', intermediate: 'standard', advanced: 'pro' }

export default function StudentPortalV2({ student, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [dbTools, setDbTools] = useState<DBTool[]>([])

  useEffect(() => {
    supabase.from('edu_enrollments')
      .select('id,course_id,enrolled_at,is_active,course:edu_courses(id,name,slug,type,track)')
      .eq('student_id', student.id).eq('is_active', true)
      .then(({ data }) => setEnrollments((data ?? []) as unknown as Enrollment[]))
    supabase.from('edu_tools').select('*').eq('enabled', true).order('order_index')
      .then(({ data }) => { if (data?.length) setDbTools(data as DBTool[]) })
  }, [student.id])

  const name = uname(student)
  const studentTierIdx = TIER_ORDER.indexOf(LEVEL_TIER[student.level ?? 'beginner'] ?? 'free')
  const isUnlocked = (tier: string) => TIER_ORDER.indexOf(tier) <= studentTierIdx

  const realCourses = enrollments.map(e => ({
    name: e.course?.name ?? '', course_id: e.course_id, done: 0, total: 10,
    active: e.course?.type === 'hanh_trinh' || e.course?.type === 'canh_cua',
  }))
  const displayCourses = realCourses.length > 0 ? realCourses : COURSES

  const displayTools: DBTool[] = dbTools.length > 0 ? dbTools : []

  const btnPrimary: React.CSSProperties = {
    background: D.accent, color: '#fff', border: 'none', borderRadius: 8,
    padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', letterSpacing: '.01em',
  }
  const btnSecondary: React.CSSProperties = {
    background: 'none', color: D.text2, border: `1px solid ${D.border}`,
    borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit', width: '100%',
  }
  const card: React.CSSProperties = { background: D.surface, borderRadius: 12, boxShadow: D.shadow, overflow: 'hidden' }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: D.bg, fontFamily: '"Inter", system-ui, sans-serif', color: D.text1, fontSize: 14 }}>
      <aside style={{ width: collapsed ? 52 : 200, flexShrink: 0, background: D.surface, borderRight: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', transition: 'width .2s ease', overflow: 'hidden' }}>
        <button onClick={() => setCollapsed(!collapsed)}
          style={{ padding: '16px 16px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: D.text3, fontSize: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          {collapsed ? '→' : '←'}
        </button>
        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {NAV.map(item => (
            <div key={item.label}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px' : '9px 10px', borderRadius: 8, cursor: 'pointer', background: item.active ? D.accentLight : 'transparent', color: item.active ? D.accent : D.text2, fontWeight: item.active ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', marginBottom: 1, justifyContent: collapsed ? 'center' : 'flex-start' }}
              onMouseEnter={el => { if (!item.active) el.currentTarget.style.background = D.bg }}
              onMouseLeave={el => { if (!item.active) el.currentTarget.style.background = 'transparent' }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span style={{ fontSize: 13 }}>{item.label}</span>}
            </div>
          ))}
        </nav>
        <div style={{ borderTop: `1px solid ${D.border}`, padding: '8px' }}>
          {NAV_BOTTOM.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px' : '9px 10px', borderRadius: 8, cursor: 'pointer', color: D.text3, whiteSpace: 'nowrap', overflow: 'hidden', justifyContent: collapsed ? 'center' : 'flex-start' }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span style={{ fontSize: 13 }}>{item.label}</span>}
            </div>
          ))}
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <header style={{ background: D.surface, borderBottom: `1px solid ${D.border}`, padding: '0 24px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: D.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🎸</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: D.text1, lineHeight: 1.2 }}>Thầy Văn Anh Guitar</div>
              <div style={{ fontSize: 10, color: D.text3 }}>Music Learning System</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '5px 10px' }}>
              <span style={{ fontSize: 14 }}>🔥</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#C2410C' }}>1</span>
              <span style={{ fontSize: 11, color: '#92400E', marginLeft: 4 }}>ngày</span>
            </div>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.text3, fontSize: 18 }}>🔔</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 4px', borderRadius: 8, border: `1px solid ${D.border}`, cursor: 'pointer' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: D.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: D.accent, fontWeight: 700 }}>{name.charAt(0)}</div>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{name}</span>
              <span style={{ color: D.text3, fontSize: 11 }}>▾</span>
            </div>
            <button onClick={onLogout} style={{ background: 'none', border: `1px solid ${D.border}`, borderRadius: 7, padding: '5px 12px', fontSize: 12, color: D.text2, cursor: 'pointer', fontFamily: 'inherit' }}>Đăng xuất</button>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...card, display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 140px' }}>
            <div style={{ padding: '18px 20px', borderRight: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: D.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: D.accent, fontWeight: 700, flexShrink: 0 }}>{name.charAt(0)}</div>
              <div>
                <div style={{ fontSize: 10, color: D.text3, marginBottom: 2 }}>Xin chào</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{name}</div>
                <div style={{ fontSize: 11, color: D.text3, marginTop: 3 }}>Học viên · {enrollments.length || 2} khóa</div>
              </div>
            </div>
            <div style={{ padding: '18px 20px', borderRight: `1px solid ${D.border}` }}>
              <div style={{ fontSize: 10, color: D.text3, marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em' }}>Hành trình hiện tại</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: D.accent, marginBottom: 3 }}>
                {enrollments.find(e => e.course?.type === 'hanh_trinh')?.course?.name?.toUpperCase() ?? 'NGHỆ THUẬT ĐỆM HÁT'}
              </div>
              <div style={{ fontSize: 12, color: D.text2 }}>Đệm hát 1 · Buổi 3 / 10</div>
              <Bar pct={30} />
            </div>
            <div style={{ padding: '18px 24px', borderRight: `1px solid ${D.border}`, display: 'flex', alignItems: 'center' }}>
              <div style={{ fontSize: 24, color: D.border, lineHeight: 1, marginRight: 8 }}>"</div>
              <div style={{ fontSize: 13, color: D.text2, lineHeight: 1.65, fontStyle: 'italic' }}>Âm nhạc không chỉ để học — mà để sống cùng mỗi ngày.</div>
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>0</div>
              <div style={{ fontSize: 11, color: D.text3, marginTop: 4 }}>việc hôm nay</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: '4px 0 2px' }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '.05em' }}>HỌC · TẬP · SỐNG CÙNG ÂM NHẠC</div>
            <div style={{ fontSize: 12, color: D.text3, marginTop: 5 }}>Bạn đang tiến bộ mỗi ngày. Mỗi bước nhỏ đều đưa bạn đến gần hơn với đam mê.</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {/* COL 1 */}
            <div style={card}>
              <ColHeader icon="🎓" title="HỌC KIẾN THỨC" sub="Hiểu · Biết · Nắm vững" badge={`${enrollments.length || 2} khóa đang học`} />
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${D.border}` }}>
                <div style={{ fontSize: 10, color: D.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Tiếp tục học</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: D.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🎸</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Đệm hát 1</div>
                    <div style={{ fontSize: 12, color: D.text3, marginBottom: 6 }}>Buổi 3 / 10</div>
                    <div style={{ fontSize: 12, color: D.text2, marginBottom: 8 }}>Bài tiếp: <span style={{ fontWeight: 500 }}>Kỹ thuật gảy dây liên tục</span></div>
                    <Bar pct={30} />
                  </div>
                </div>
                <button onClick={() => {
                  const first = enrollments.find(e => e.course?.type === 'hanh_trinh') ?? enrollments[0]
                  if (first?.course_id) window.location.href = '/course?id=' + first.course_id
                }} style={{ ...btnPrimary, width: '100%', textAlign: 'center' }}>Học ngay →</button>
              </div>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${D.border}` }}>
                <div style={{ fontSize: 10, color: D.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Các khóa đang học</div>
                {displayCourses.map((c, i) => (
                  <div key={i} onClick={() => { if (c.active && c.course_id) window.location.href = '/course?id=' + c.course_id }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i > 0 ? `1px solid ${D.borderLight}` : 'none', cursor: c.active ? 'pointer' : 'default' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: c.active ? D.accentLight : D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>🎸</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: c.active ? D.text1 : D.text3 }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: D.text3 }}>{c.done} / {c.total} buổi</div>
                    </div>
                    <span style={{ fontSize: 11, color: c.active ? D.success : D.text3, fontWeight: 500, flexShrink: 0 }}>{c.active ? 'Đang học ›' : 'Chưa học'}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 20px' }}>
                <button style={btnSecondary}>Xem tất cả khóa học →</button>
              </div>
            </div>

            {/* COL 2 */}
            <div style={card}>
              <ColHeader icon="🎯" title="LUYỆN TẬP HẰNG NGÀY" sub="Luyện · Thực hành · Tiến bộ" badge="3 nhiệm vụ" />
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${D.border}` }}>
                <div style={{ fontSize: 10, color: D.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Nhiệm vụ hôm nay</div>
                {TASKS.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i > 0 ? `1px solid ${D.borderLight}` : 'none', cursor: 'pointer' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', border: `2px solid ${D.border}`, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: D.text3 }}>{t.sub}</div>
                    </div>
                    <span style={{ fontSize: 11, color: D.text3, flexShrink: 0 }}>{t.time}</span>
                    <span style={{ color: D.text3, fontSize: 12 }}>›</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${D.border}` }}>
                <div style={{ fontSize: 10, color: D.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Công cụ luyện tập</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {displayTools.map((t: DBTool) => {
                    const unlocked = isUnlocked(t.tier)
                    return (
                      <div key={t.id} onClick={() => { if (unlocked && t.route) window.location.href = t.route }}
                        style={{ background: unlocked ? D.surface : D.bg, border: `1px solid ${D.border}`, borderRadius: 8, padding: '10px 8px', textAlign: 'center', cursor: unlocked ? 'pointer' : 'default', position: 'relative', opacity: unlocked ? 1 : .5 }}>
                        {!unlocked && <span style={{ position: 'absolute', top: 4, right: 4, fontSize: 8, color: D.text3 }}>🔒</span>}
                        <div style={{ fontSize: 14, marginBottom: 2 }}>{t.icon}</div>
                        <div style={{ fontSize: 11, color: unlocked ? D.text2 : D.text3, fontWeight: 500, lineHeight: 1.3 }}>{t.name}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ padding: '12px 20px' }}>
                <button style={btnSecondary}>Mở tất cả công cụ →</button>
              </div>
            </div>

            {/* COL 3 */}
            <div style={card}>
              <ColHeader icon="🎸" title="SỐNG CÙNG ÂM NHẠC" sub="Kết nối · Trải nghiệm · Truyền cảm hứng" action="Xem tất cả" />
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${D.border}` }}>
                <div style={{ fontSize: 10, color: D.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Sự kiện & hoạt động</div>
                {EVENTS.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i > 0 ? `1px solid ${D.borderLight}` : 'none' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: D.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>📅</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{e.name}</div>
                      <div style={{ fontSize: 11, color: D.text3 }}>{e.date}</div>
                    </div>
                    <button style={{ background: 'none', border: `1px solid ${D.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: D.text2, flexShrink: 0 }}>Tham gia</button>
                  </div>
                ))}
              </div>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${D.border}` }}>
                <div style={{ fontSize: 10, color: D.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Cộng đồng</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {COMMUNITY.map((c, i) => (
                    <div key={i} style={{ textAlign: 'center', cursor: c.locked ? 'default' : 'pointer', opacity: c.locked ? .45 : 1, position: 'relative' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, margin: '0 auto 5px', position: 'relative' }}>
                        {['👥','💬','📝','↑','📅','🎤','🎵','🎼'][i]}
                        {c.locked && <span style={{ position: 'absolute', top: -2, right: -2, fontSize: 8 }}>🔒</span>}
                      </div>
                      <div style={{ fontSize: 10, color: D.text3, lineHeight: 1.2 }}>{c.name}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '16px 20px', borderLeft: `3px solid ${D.accentLight}` }}>
                <div style={{ fontSize: 12, color: D.text2, lineHeight: 1.7, fontStyle: 'italic' }}>
                  "Bạn không cần phải giỏi ngay từ đầu. Nhưng bạn phải bắt đầu để trở nên giỏi."
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...card, display: 'flex', alignItems: 'center', padding: '14px 24px', gap: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginRight: 28, flexShrink: 0 }}>Thành Quả</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              {[
                { icon: '🎵', v: 0, label: 'bài hát' },
                { icon: '🎬', v: 0, label: 'video' },
                { icon: '🔥', v: 1, label: 'ngày liên tục' },
                { icon: '🚪', v: 0, label: 'cánh cửa' },
                { icon: '📚', v: 0, label: 'khóa hoàn thành' },
              ].map((a, i, arr) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: i < arr.length - 1 ? 24 : 0, marginRight: i < arr.length - 1 ? 24 : 0, borderRight: i < arr.length - 1 ? `1px solid ${D.border}` : 'none' }}>
                  <span style={{ fontSize: 16 }}>{a.icon}</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: a.v > 0 ? D.accent : D.text1 }}>{a.v}</span>
                  <span style={{ fontSize: 11, color: D.text3 }}>{a.label}</span>
                </div>
              ))}
            </div>
            <button style={{ ...btnPrimary, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              🗺 Xem bản đồ hành trình →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
