// ── Piano Journey — TRANG ĐẦU (PO1) ──────────────────────────────────────────
// Dựng theo HOME_SCREEN_SPEC.md. Home KHÔNG phải dashboard — là nơi bé gặp Lyra.
//
// GHI CHÚ KỸ THUẬT:
// - Dùng INLINE STYLE, không Tailwind. Spec ghi Tailwind nhưng dự án cài
//   tailwindcss@4 mà index.css còn cú pháp v3 + thiếu plugin @tailwindcss/vite
//   ⇒ build ra 0 class tiện ích. Viết bằng class Tailwind là màn hình trắng trơn.
//   (CLAUDE.md cũng quy định toàn app dùng inline style.)
// - `#root` trong index.css có `text-align:center` cho cả app, nên mọi khối chữ
//   ở đây phải tự đặt textAlign, đừng tin vào mặc định.
// - HÌNH LYRA: thả file ảnh vào `public/lyra.png` là nó tự hiện, không phải sửa
//   code. Chưa có file thì tự lùi về vòng tròn gradient tạm (bắt lỗi onError).
//   Nên dùng ảnh vuông, nền trong suốt, tối thiểu 384×384 cho màn Retina.

import { useState } from 'react'
import type { CSSProperties } from 'react'

/** Thả ảnh vào public/lyra.png là tự dùng; không có thì hiện hình tạm. */
const LYRA_IMG = '/lyra.png'

const SAFE_TOP    = 'env(safe-area-inset-top, 0px)'
const SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)'

// Bảng màu — nền lấy đúng #F7F8FA theo spec; phần còn lại giữ tông ấm của app
const C = {
  bg: '#F7F8FA',
  card: '#FFFFFF',
  text: '#1F2430',
  dim: '#6B7280',
  muted: '#9CA3AF',
  line: '#EEF0F4',
  accent: '#F59E0B',
  accentDeep: '#D97706',
  track: '#EDEFF3',
}

const SHADOW = '0 2px 14px rgba(17,24,39,.05)'
const RADIUS = 24

const cardBase: CSSProperties = {
  background: C.card,
  borderRadius: RADIUS,
  boxShadow: SHADOW,
  textAlign: 'left',
}

export interface HomeScreenProps {
  /** Tên bé — spec ví dụ "Chào Minh!" */
  studentName?: string
  /** Bài đang học dở. Không có thì thẻ "Tiếp tục" mời bé bắt đầu bài mới. */
  current?: { title: string; step: number; totalSteps: number } | null
  /** Chạm nút micro → mở cuộc trò chuyện với Lyra */
  onTalkToLyra: () => void
  /** Chạm "Tiếp tục bài học" */
  onContinue: () => void
  onOpenMenu?: () => void
  onOpenNotifications?: () => void
  onOpenSongs?: () => void
  onOpenAchievements?: () => void
}

export default function HomeScreen({
  studentName = 'Minh',
  current = null,
  onTalkToLyra,
  onContinue,
  onOpenMenu,
  onOpenNotifications,
  onOpenSongs,
  onOpenAchievements,
}: HomeScreenProps) {
  const [anhLyraOk, setAnhLyraOk] = useState(true)
  const step = current?.step ?? 2
  const total = current?.totalSteps ?? 4
  const title = current?.title ?? 'Chú Chim Non'
  const pct = Math.max(0, Math.min(100, Math.round((step / total) * 100)))

  return (
    <div style={{
      height: '100dvh', width: '100%', background: C.bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: 'Inter, system-ui, sans-serif', color: C.text,
      overflow: 'hidden', textAlign: 'left',
    }}>
      <div style={{
        width: '100%', maxWidth: 480, flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ── HEADER: hamburger · Piano Journey · chuông ── */}
        <header style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `calc(${SAFE_TOP} + 14px) 24px 8px`,
        }}>
          <IconBtn label="Menu" onClick={onOpenMenu}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </IconBtn>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.2px' }}>Piano Journey</div>
          <IconBtn label="Thông báo" onClick={onOpenNotifications}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
          </IconBtn>
        </header>

        {/* ── Vùng cuộn ── */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          padding: '8px 24px 34px', display: 'flex', flexDirection: 'column', gap: 22,
        }}>

          {/* ── HERO: Lyra ── */}
          <section style={{
            ...cardBase, padding: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
            background: 'linear-gradient(135deg,#FFF6E9 0%,#FDEFF6 100%)',
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-.5px', marginBottom: 4 }}>Lyra</div>
              <div style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.45 }}>Chuyên tạo bài tập thực hành</div>
            </div>
            {/* Ảnh Lyra: có public/lyra.png thì dùng, không thì hình tạm */}
            {anhLyraOk ? (
              <img
                src={LYRA_IMG} alt="Lyra"
                onError={() => setAnhLyraOk(false)}
                style={{ width: 92, height: 92, flexShrink: 0, objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <div style={{
                width: 92, height: 92, flexShrink: 0, borderRadius: '50%',
                background: 'radial-gradient(circle at 32% 28%, #FFD9A8 0%, #F7A86B 45%, #E0708F 100%)',
                boxShadow: '0 10px 24px rgba(224,112,143,.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
              }}>
                🎹
              </div>
            )}
          </section>

          {/* ── LỜI CHÀO ── */}
          <section>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-.4px', marginBottom: 4 }}>
              Chào {studentName}!
            </div>
            <div style={{ fontSize: 16, color: C.dim }}>Hôm nay mình học gì nào?</div>
          </section>

          {/* ── THẺ TIẾP TỤC BÀI HỌC (CTA chính) ── */}
          <section style={{ ...cardBase, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 6 }}>Tiếp tục bài học</div>
            <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 3 }}>{title}</div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 14 }}>Bước {step} / {total}</div>

            <div style={{ height: 8, background: C.track, borderRadius: 99, overflow: 'hidden', marginBottom: 18 }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 99,
                background: `linear-gradient(90deg,${C.accent},${C.accentDeep})`,
                transition: 'width .4s ease',
              }} />
            </div>

            <button onClick={onContinue} style={{
              width: '100%', height: 52, borderRadius: 16, border: 'none',
              background: `linear-gradient(135deg,${C.accent},${C.accentDeep})`,
              color: '#fff', fontSize: 16, fontWeight: 800, fontFamily: 'inherit',
              cursor: 'pointer', boxShadow: '0 6px 18px rgba(217,119,6,.28)',
              touchAction: 'manipulation',
            }}>
              Tiếp tục
            </button>
          </section>

          {/* ── HAI LỐI TẮT ── */}
          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <QuickAction icon="🎵" label="Bài hát của con" onClick={onOpenSongs} />
            <QuickAction icon="🏆" label="Thành tích" onClick={onOpenAchievements} />
          </section>

          {/* ── NÚT NÓI VỚI LYRA ── */}
          <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 2 }}>
            <button onClick={onTalkToLyra} aria-label="Hỏi Lyra bất cứ điều gì" style={{
              width: 84, height: 84, borderRadius: '50%', border: 'none',
              background: `linear-gradient(135deg,${C.accent},${C.accentDeep})`,
              boxShadow: '0 10px 28px rgba(217,119,6,.32)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
            }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, textAlign: 'center' }}>
              Hỏi Lyra bất cứ điều gì
            </div>
          </section>
        </div>

        {/* ── THANH ĐIỀU HƯỚNG DƯỚI ── */}
        <nav style={{
          flexShrink: 0, display: 'flex', borderTop: `1px solid ${C.line}`, background: C.card,
          padding: `8px 12px calc(${SAFE_BOTTOM} + 8px)`,
        }}>
          <NavItem active label="Trang chủ" icon={
            <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
          } />
          <NavItem label="Bài học" icon={
            <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
          } />
          <NavItem label="Cá nhân" icon={
            <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>
          } />
        </nav>
      </div>
    </div>
  )
}

// ── Mảnh nhỏ ─────────────────────────────────────────────────────────────────

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} style={{
      width: 40, height: 40, borderRadius: 14, border: 'none', background: 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
    }}>
      {children}
    </button>
  )
}

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      ...cardBase, border: 'none', padding: '18px 16px',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
      cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <span style={{ fontSize: 24, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: C.text, textAlign: 'left', lineHeight: 1.35 }}>{label}</span>
    </button>
  )
}

function NavItem({ label, icon, active = false }: { label: string; icon: React.ReactNode; active?: boolean }) {
  const col = active ? C.accentDeep : C.muted
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      padding: '4px 0', color: col,
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
      <span style={{ fontSize: 11, fontWeight: active ? 800 : 600 }}>{label}</span>
    </div>
  )
}
