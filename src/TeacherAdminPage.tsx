import { useState, useEffect, type CSSProperties } from 'react'
import StudentList from './StudentList'
import StudentProfile from './StudentProfile'
import CourseEditorContent from './CourseEditorContent'
import ToolsManager from './ToolsManager'
import GroupManager from './GroupManager'
import AiAssistant from './AiAssistant'
import LeadsManager from './LeadsManager'
import ArticlesManager from './ArticlesManager'
import ClassAiAdmin from './ClassAiAdmin'
import ScheduleManager from './ScheduleManager'
import ShowcaseAdmin from './admin/ShowcaseAdmin'
import DailyMailPage from './admin/DailyMailPage'
import ChatMailPage from './admin/ChatMailPage'

const S = {
  sidebar: '#18181B', sidebarHover: '#27272A',
  accent: '#2D6A4F', accentLight: '#E9F3EC',
  border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  bg: '#F4F4F5', surface: '#FFFFFF',
}

type Section = 'students' | 'courses' | 'dashboard' | 'tools' | 'community' | 'assistant' | 'leads' | 'articles' | 'aichat' | 'schedule' | 'showcase' | 'dailymail' | 'chatmail'

const NAV = [
  { id: 'dashboard' as Section, icon: '⊞', label: 'Tổng quan'      },
  { id: 'leads'     as Section, icon: '📝', label: 'Đăng ký'        },
  { id: 'schedule'  as Section, icon: '🗓', label: 'Lịch lớp'       },
  { id: 'aichat'    as Section, icon: '💬', label: 'AI khách'       },
  { id: 'showcase'  as Section, icon: '📄', label: 'Showcase'      },
  { id: 'dailymail' as Section, icon: '📧', label: 'Daily Mail'     },
  { id: 'chatmail'  as Section, icon: '💬', label: 'Chat Mail'       },
  { id: 'articles'  as Section, icon: '📰', label: 'Bài viết'       },
  { id: 'students'  as Section, icon: '👥', label: 'Học viên'       },
  { id: 'courses'   as Section, icon: '📚', label: 'Khoá học'       },
  { id: 'tools'     as Section, icon: '🛠', label: 'Công cụ'        },
  { id: 'community' as Section, icon: '🌱', label: 'Cộng đồng'      },
  { id: 'assistant' as Section, icon: '🤖', label: 'Trợ lý AI'      },
]

export default function TeacherAdminPage() {
  const [section, setSection]       = useState<Section>('dashboard')
  const [studentId, setStudentId]   = useState<string | null>(null)
  const [collapsed, setCollapsed]   = useState(false)
  const [isMobile, setIsMobile]     = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  const [menuOpen, setMenuOpen]     = useState(false)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  // Mobile: sidebar là drawer trượt từ trái, không bao giờ thu gọn
  const showLabels = isMobile ? true : !collapsed
  const asideStyle: CSSProperties = isMobile
    ? { position: 'fixed', top: 0, left: 0, bottom: 0, width: 240, zIndex: 1001, transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform .25s ease', boxShadow: menuOpen ? '4px 0 24px rgba(0,0,0,.35)' : 'none', paddingTop: 'env(safe-area-inset-top)' }
    : { width: collapsed ? 56 : 200, transition: 'width .2s ease' }
  const currentLabel = NAV.find(n => n.id === section)?.label ?? 'Admin'

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100dvh', overflow: 'hidden', fontFamily: '"Inter", system-ui, sans-serif' }}>

      {/* ── TOP BAR (mobile) ───────────────────────────────────────── */}
      {isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 52, padding: '0 8px 0 4px', paddingTop: 'env(safe-area-inset-top)', boxSizing: 'content-box', background: S.sidebar, color: '#fff', flexShrink: 0 }}>
          <button onClick={() => setMenuOpen(true)} aria-label="Mở menu"
            style={{ width: 44, height: 44, border: 'none', background: 'transparent', color: '#fff', fontSize: 24, cursor: 'pointer', borderRadius: 8 }}>☰</button>
          <div style={{ fontWeight: 700, fontSize: 16, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentLabel}</div>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: S.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🎸</div>
        </div>
      )}
      {isMobile && menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000 }} />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
      <aside style={{ ...asideStyle, flexShrink: 0, background: S.sidebar, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Logo */}
        <div style={{ padding: showLabels ? '16px' : '16px 0', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #27272A', justifyContent: showLabels ? 'flex-start' : 'center' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: S.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>🎸</div>
          {showLabels && <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', flex: 1 }}>Thầy Văn Anh</div>}
          {isMobile && <button onClick={() => setMenuOpen(false)} aria-label="Đóng" style={{ border: 'none', background: 'transparent', color: '#A1A1AA', fontSize: 22, cursor: 'pointer', width: 36, height: 36 }}>✕</button>}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
          {NAV.map(item => {
            const active = section === item.id
            return (
              <div key={item.id} onClick={() => { setSection(item.id); setStudentId(null); setMenuOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: showLabels ? (isMobile ? '12px 12px' : '9px 10px') : '10px', borderRadius: 8, cursor: 'pointer', background: active ? S.accent : 'transparent', color: active ? '#fff' : '#A1A1AA', fontWeight: active ? 600 : 400, marginBottom: 2, justifyContent: showLabels ? 'flex-start' : 'center', whiteSpace: 'nowrap', overflow: 'hidden', transition: 'background .1s' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = S.sidebarHover }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                <span style={{ fontSize: 17, flexShrink: 0 }}>{item.icon}</span>
                {showLabels && <span style={{ fontSize: isMobile ? 15 : 14 }}>{item.label}</span>}
              </div>
            )
          })}

          {/* Kho Tri Thức — app riêng, mở tab mới (cùng tài khoản đăng nhập) */}
          <a href="https://khotrithuc.netlify.app" target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: showLabels ? '9px 10px' : '10px', borderRadius: 8, cursor: 'pointer', background: 'transparent', color: '#A1A1AA', fontWeight: 400, marginTop: 10, paddingTop: 12, borderTop: '1px solid #27272A', justifyContent: showLabels ? 'flex-start' : 'center', whiteSpace: 'nowrap', overflow: 'hidden', textDecoration: 'none' }}
            onMouseEnter={e => { e.currentTarget.style.background = S.sidebarHover }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            <span style={{ fontSize: 17, flexShrink: 0 }}>🧠</span>
            {showLabels && <span style={{ fontSize: 14 }}>Kho Tri Thức ↗</span>}
          </a>
        </nav>

        {/* Bottom */}
        <div style={{ padding: '8px', borderTop: '1px solid #27272A', paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}>
          {!isMobile && <div onClick={() => setCollapsed(!collapsed)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px' : '9px 10px', borderRadius: 8, cursor: 'pointer', color: '#71717A', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <span style={{ fontSize: 15 }}>{collapsed ? '→' : '←'}</span>
            {!collapsed && <span style={{ fontSize: 13 }}>Thu gọn</span>}
          </div>}
          <div onClick={() => window.location.href = '/start'}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: showLabels ? '9px 10px' : '10px', borderRadius: 8, cursor: 'pointer', color: '#71717A', justifyContent: showLabels ? 'flex-start' : 'center' }}>
            <span style={{ fontSize: 15 }}>↗</span>
            {showLabels && <span style={{ fontSize: 13 }}>Trang học sinh</span>}
          </div>
        </div>
      </aside>

      {/* ── CONTENT ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Dashboard */}
        {section === 'dashboard' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : 32, background: S.bg }}>
            {!isMobile && <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 24 }}>Tổng quan</div>}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 20 : 32 }}>
              {[
                { icon: '👥', label: 'Học viên', value: '577', sub: 'đang hoạt động' },
                { icon: '📚', label: 'Khoá học', value: '13',  sub: 'đã tạo'         },
                { icon: '🎬', label: 'Bài học',  value: '—',   sub: 'đang cập nhật'  },
              ].map(s => (
                <div key={s.label} style={{ background: S.surface, borderRadius: 12, padding: isMobile ? '12px' : '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: isMobile ? 18 : 24, marginBottom: isMobile ? 4 : 8 }}>{s.icon}</div>
                  <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 800, color: S.text1 }}>{s.value}</div>
                  <div style={{ fontSize: 14, color: S.text2, marginTop: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: S.text3 }}>{s.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 12 : 16 }}>
              <div onClick={() => setSection('students')} style={{ background: S.surface, borderRadius: 12, padding: isMobile ? '14px 16px' : '20px 24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${S.border}` }}>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>👥 Quản lý học viên →</div>
                <div style={{ fontSize: 14, color: S.text3 }}>Xem danh sách, thêm khoá học, ghi chú</div>
              </div>
              <div onClick={() => setSection('courses')} style={{ background: S.surface, borderRadius: 12, padding: isMobile ? '14px 16px' : '20px 24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${S.border}` }}>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>📚 Soạn khoá học →</div>
                <div style={{ fontSize: 14, color: S.text3 }}>Tạo chương, thêm bài, gắn YouTube</div>
              </div>
              <div onClick={() => setSection('tools')} style={{ background: S.surface, borderRadius: 12, padding: isMobile ? '14px 16px' : '20px 24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${S.border}` }}>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>🛠 Quản lý công cụ →</div>
                <div style={{ fontSize: 14, color: S.text3 }}>Bật/tắt, phân cấp unlock cho học sinh</div>
              </div>
            </div>
          </div>
        )}

        {/* Students */}
        {section === 'students' && !studentId && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <StudentList onSelect={id => setStudentId(id)} />
          </div>
        )}
        {section === 'students' && studentId && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <StudentProfile
              studentId={studentId}
              onBack={() => setStudentId(null)}
            />
          </div>
        )}

        {/* Leads — đăng ký từ trang tuyển sinh */}
        {section === 'leads' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <LeadsManager />
          </div>
        )}

        {/* Lịch lớp học */}
        {section === 'schedule' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <ScheduleManager />
          </div>
        )}

        {/* AI khách — trợ lý tư vấn tuyển sinh */}
        {section === 'aichat' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <ClassAiAdmin />
          </div>
        )}

        {/* Showcase CMS — block-based page builder */}
        {section === 'showcase' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <ShowcaseAdmin onClose={() => setSection('dashboard')} />
          </div>
        )}

        {/* Chat Mail */}
        {section === 'chatmail' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <ChatMailPage />
          </div>
        )}

        {/* Daily Mail */}
        {section === 'dailymail' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <DailyMailPage />
          </div>
        )}

        {/* Articles — bài viết cho trang tuyển sinh */}
        {section === 'articles' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <ArticlesManager />
          </div>
        )}

        {/* Courses */}
        {section === 'courses' && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <CourseEditorContent />
          </div>
        )}

        {section === 'tools' && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ToolsManager />
          </div>
        )}


        {section === 'community' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <GroupManager />
          </div>
        )}

        {section === 'assistant' && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <AiAssistant />
          </div>
        )}

      </div>
    </div>
  )
}
