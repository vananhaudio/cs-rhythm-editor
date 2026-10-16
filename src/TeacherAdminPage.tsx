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
import Ht2027ScheduleAdmin from './admin/Ht2027ScheduleAdmin'
import ShowcaseAdmin from './admin/ShowcaseAdmin'
import DailyMailPage from './admin/DailyMailPage'
import ChatMailPage from './admin/ChatMailPage'
import NewsFeedAdmin from './admin/NewsFeedAdmin'
import JourneyAdmin from './admin/JourneyAdmin'
import NhipPhachAdmin from './admin/NhipPhachAdmin'
import { ADMIN_NAV_GROUPS, adminSectionFromPath, adminLegacyRedirect, adminPathForSection, adminLabel, adminQuickLinks, type AdminSection } from './admin/adminNav'
import { isSocialHost } from './class-social/resolveMeRoute'
import ClassAdminSpace from './admin/ClassAdminSpace'

const S = {
  sidebar: '#18181B', sidebarHover: '#27272A',
  accent: '#4F46E5', accentLight: '#EEF2FF',
  border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  bg: '#F4F4F5', surface: '#FFFFFF',
}

type Section = AdminSection

const SHORTCUTS: { id: Section; icon: string; desc: string }[] = [
  { id: 'lop',      icon: '🏫', desc: 'Chọn một lớp để xem lịch, học viên, giáo trình' },
  { id: 'leads',    icon: '📝', desc: 'Duyệt đăng ký từ trang tuyển sinh' },
  { id: 'schedule', icon: '🗓', desc: 'Tạo lớp, lịch học, thành viên' },
  { id: 'students', icon: '👥', desc: 'Danh sách, tài khoản, ghi chú' },
]

export default function TeacherAdminPage() {
  // Mục đang mở lấy từ URL (/admin/<slug>); bấm menu đẩy URL, Back/Forward đọc lại URL.
  const [section, setSection]       = useState<Section>(() => adminSectionFromPath(window.location.pathname) ?? 'dashboard')
  const [pathname, setPathname]   = useState(() => adminLegacyRedirect(window.location.pathname) ?? window.location.pathname)
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
  const currentLabel = adminLabel(section)
  const meBase = isSocialHost(window.location.hostname, false) ? '' : 'https://class.vananhaudio.com'
  const quickLinks = adminQuickLinks(meBase)

  // URL không hợp lệ (/admin/abc) → về Tổng quan và sửa URL, không thêm history.
  // Đường cũ /admin/classes → /admin/lop (cũng không thêm history).
  useEffect(() => {
    const legacy = adminLegacyRedirect(window.location.pathname)
    if (legacy) window.history.replaceState(null, '', legacy)
    else if (adminSectionFromPath(window.location.pathname) === null) window.history.replaceState(null, '', '/admin')
  }, [])

  useEffect(() => {
    const onPop = () => {
      const next = adminSectionFromPath(window.location.pathname)
      if (next === null) { window.location.reload(); return }   // Back ra ngoài Admin: để router chính quyết
      const legacy = adminLegacyRedirect(window.location.pathname)
      if (legacy) window.history.replaceState(null, '', legacy)
      setPathname(legacy ?? window.location.pathname); setSection(next); setStudentId(null); setMenuOpen(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Đi tới một đường dẫn trong /admin (kể cả /admin/lop/<id>/<tab>). Bấm lại đúng URL đang mở: không thêm history.
  const navigate = (target: string) => {
    const here = window.location.pathname.replace(/\/+$/, '') || '/'
    if (here !== target) window.history.pushState(null, '', target)
    setPathname(target)
    setSection(adminSectionFromPath(target) ?? 'dashboard'); setStudentId(null); setMenuOpen(false)
  }
  const goSection = (id: Section) => navigate(adminPathForSection(id))

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

        {/* Nav — nhóm; cuộn được; mỗi mục là link thật (chuột giữa / mở tab mới dùng được) */}
        <nav aria-label="Menu Admin" style={{ flex: 1, padding: '8px', overflowY: 'auto', overscrollBehavior: 'contain' }}>
          {ADMIN_NAV_GROUPS.map((group, gi) => (
            <div key={group.title ?? 'root'} style={{ marginTop: gi === 0 ? 0 : 14 }}>
              {group.title && (showLabels
                ? <div style={{ padding: '0 10px 6px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#71717A', whiteSpace: 'nowrap' }}>{group.title}</div>
                : <div style={{ height: 1, background: '#27272A', margin: '0 8px 8px' }} />)}
              {group.items.map(item => {
                const active = section === item.id
                return (
                  <a key={item.id} href={adminPathForSection(item.id)} title={showLabels ? undefined : item.label}
                    aria-current={active ? 'page' : undefined}
                    onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); goSection(item.id) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: isMobile ? 44 : 38, padding: showLabels ? '0 10px' : 0, borderRadius: 8, textDecoration: 'none', background: active ? S.accent : 'transparent', color: active ? '#fff' : '#A1A1AA', fontWeight: active ? 600 : 400, marginBottom: 2, justifyContent: showLabels ? 'flex-start' : 'center', whiteSpace: 'nowrap', overflow: 'hidden', transition: 'background .1s' }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = S.sidebarHover }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                    <span style={{ fontSize: 17, flexShrink: 0, width: 22, textAlign: 'center' }}>{item.icon}</span>
                    {showLabels && <span style={{ fontSize: isMobile ? 15 : 14, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
                  </a>
                )
              })}
            </div>
          ))}

          {/* Mở nhanh — trang nằm ngoài khung Admin; quyền do trang đích quyết */}
          <div style={{ marginTop: 14 }}>
            {showLabels
              ? <div style={{ padding: '0 10px 6px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#71717A', whiteSpace: 'nowrap' }}>Mở nhanh</div>
              : <div style={{ height: 1, background: '#27272A', margin: '0 8px 8px' }} />}
            {quickLinks.map(l => (
              <a key={l.label} href={l.href} {...(l.external ? { target: '_blank', rel: 'noreferrer' } : {})} title={showLabels ? undefined : l.label}
                style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: isMobile ? 44 : 38, padding: showLabels ? '0 10px' : 0, borderRadius: 8, textDecoration: 'none', color: '#A1A1AA', marginBottom: 2, justifyContent: showLabels ? 'flex-start' : 'center', whiteSpace: 'nowrap', overflow: 'hidden' }}
                onMouseEnter={e => { e.currentTarget.style.background = S.sidebarHover }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <span style={{ fontSize: 17, flexShrink: 0, width: 22, textAlign: 'center' }}>{l.icon}</span>
                {showLabels && <span style={{ fontSize: isMobile ? 15 : 14, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.label}{l.external ? ' ↗' : ''}</span>}
              </a>
            ))}
          </div>
        </nav>

        {/* Bottom */}
        <div style={{ padding: '8px', borderTop: '1px solid #27272A', paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}>
          {!isMobile && <div role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setCollapsed(c => !c) }} onClick={() => setCollapsed(!collapsed)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px' : '9px 10px', borderRadius: 8, cursor: 'pointer', color: '#71717A', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <span style={{ fontSize: 15 }}>{collapsed ? '→' : '←'}</span>
            {!collapsed && <span style={{ fontSize: 13 }}>Thu gọn</span>}
          </div>}
        </div>
      </aside>

      {/* ── CONTENT ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Tổng quan — chỉ lối tắt; không hiển thị số liệu khi chưa có nguồn thật */}
        {section === 'dashboard' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : 32, background: S.bg }}>
            {!isMobile && <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 20 }}>Tổng quan</div>}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))', gap: isMobile ? 12 : 16 }}>
              {SHORTCUTS.map(sc => (
                <a key={sc.id} href={adminPathForSection(sc.id)}
                  onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); goSection(sc.id) }}
                  style={{ display: 'block', textDecoration: 'none', color: S.text1, background: S.surface, borderRadius: 12, padding: isMobile ? '14px 16px' : '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${S.border}` }}>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{sc.icon} {adminLabel(sc.id)} →</div>
                  <div style={{ fontSize: 14, color: S.text3 }}>{sc.desc}</div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Students */}
        {section === 'students' && !studentId && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <StudentList onSelect={id => setStudentId(id)} />
          </div>
        )}

        {section === 'lop' && <ClassAdminSpace pathname={pathname} navigate={navigate} goSection={goSection} />}
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

        {/* Lịch thực hành Hành trình 2027 */}
        {section === 'ht2027' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <Ht2027ScheduleAdmin onOpenSchedule={() => goSection('schedule')} />
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
            <ShowcaseAdmin embedded onClose={() => goSection('dashboard')} />
          </div>
        )}

        {/* Chat Mail */}
        {section === 'chatmail' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <ChatMailPage embedded />
          </div>
        )}

        {/* Daily Mail */}
        {section === 'dailymail' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <DailyMailPage />
          </div>
        )}

        {/* Bản tin hôm nay — CMS cho home_feed_items (server-driven feed trên app) */}
        {section === 'newsfeed' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            <NewsFeedAdmin />
          </div>
        )}

        {section === 'journey' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            <JourneyAdmin />
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

        {section === 'nhipphach' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <NhipPhachAdmin />
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
