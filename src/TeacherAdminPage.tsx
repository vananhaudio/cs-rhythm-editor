import { useState } from 'react'
import StudentList from './StudentList'
import StudentProfile from './StudentProfile'
import CourseEditorContent from './CourseEditorContent'
import ToolsManager from './ToolsManager'

const S = {
  sidebar: '#18181B', sidebarHover: '#27272A',
  accent: '#4F46E5', accentLight: '#EEF2FF',
  border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  bg: '#F4F4F5', surface: '#FFFFFF',
}

type Section = 'students' | 'courses' | 'dashboard' | 'tools'

const NAV = [
  { id: 'dashboard' as Section, icon: '⊞', label: 'Tổng quan'      },
  { id: 'students'  as Section, icon: '👥', label: 'Học viên'       },
  { id: 'courses'   as Section, icon: '📚', label: 'Khoá học'       },
  { id: 'tools'     as Section, icon: '🛠', label: 'Công cụ'       },
]

export default function TeacherAdminPage() {
  const [section, setSection]       = useState<Section>('dashboard')
  const [studentId, setStudentId]   = useState<string | null>(null)
  const [collapsed, setCollapsed]   = useState(false)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: '"Inter", system-ui, sans-serif' }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
      <aside style={{ width: collapsed ? 56 : 200, flexShrink: 0, background: S.sidebar, display: 'flex', flexDirection: 'column', transition: 'width .2s ease', overflow: 'hidden' }}>
        {/* Logo */}
        <div style={{ padding: collapsed ? '16px 0' : '16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #27272A', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: S.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🎸</div>
          {!collapsed && <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>Thầy Văn Anh</div>}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px' }}>
          {NAV.map(item => {
            const active = section === item.id
            return (
              <div key={item.id} onClick={() => { setSection(item.id); setStudentId(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px' : '9px 10px', borderRadius: 8, cursor: 'pointer', background: active ? S.accent : 'transparent', color: active ? '#fff' : '#A1A1AA', fontWeight: active ? 600 : 400, marginBottom: 2, justifyContent: collapsed ? 'center' : 'flex-start', whiteSpace: 'nowrap', overflow: 'hidden', transition: 'background .1s' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = S.sidebarHover }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span style={{ fontSize: 13 }}>{item.label}</span>}
              </div>
            )
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '8px', borderTop: '1px solid #27272A' }}>
          <div onClick={() => setCollapsed(!collapsed)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px' : '9px 10px', borderRadius: 8, cursor: 'pointer', color: '#71717A', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <span style={{ fontSize: 14 }}>{collapsed ? '→' : '←'}</span>
            {!collapsed && <span style={{ fontSize: 12 }}>Thu gọn</span>}
          </div>
          <div onClick={() => window.location.href = '/start'}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px' : '9px 10px', borderRadius: 8, cursor: 'pointer', color: '#71717A', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <span style={{ fontSize: 14 }}>↗</span>
            {!collapsed && <span style={{ fontSize: 12 }}>Trang học sinh</span>}
          </div>
        </div>
      </aside>

      {/* ── CONTENT ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Dashboard */}
        {section === 'dashboard' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 32, background: S.bg }}>
            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 24 }}>Tổng quan</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
              {[
                { icon: '👥', label: 'Học viên', value: '577', sub: 'đang hoạt động' },
                { icon: '📚', label: 'Khoá học', value: '13',  sub: 'đã tạo'         },
                { icon: '🎬', label: 'Bài học',  value: '—',   sub: 'đang cập nhật'  },
              ].map(s => (
                <div key={s.label} style={{ background: S.surface, borderRadius: 12, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: S.text1 }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: S.text2, marginTop: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: S.text3 }}>{s.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div onClick={() => setSection('students')} style={{ background: S.surface, borderRadius: 12, padding: '20px 24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${S.border}` }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>👥 Quản lý học viên →</div>
                <div style={{ fontSize: 13, color: S.text3 }}>Xem danh sách, thêm khoá học, ghi chú</div>
              </div>
              <div onClick={() => setSection('courses')} style={{ background: S.surface, borderRadius: 12, padding: '20px 24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${S.border}` }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>📚 Soạn khoá học →</div>
                <div style={{ fontSize: 13, color: S.text3 }}>Tạo chương, thêm bài, gắn YouTube</div>
              </div>
              <div onClick={() => setSection('tools')} style={{ background: S.surface, borderRadius: 12, padding: '20px 24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${S.border}` }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>🛠 Quản lý công cụ →</div>
                <div style={{ fontSize: 13, color: S.text3 }}>Bật/tắt, phân cấp unlock cho học sinh</div>
              </div>
            </div>
          </div>
        )}

        {/* Students */}
        {section === 'students' && !studentId && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <StudentList onSelect={id => setStudentId(id)} />
          </div>
        )}
        {section === 'students' && studentId && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <StudentProfile
              studentId={studentId}
              onBack={() => setStudentId(null)}
            />
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

      </div>
    </div>
  )
}
