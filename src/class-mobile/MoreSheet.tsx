// Ngăn kéo "Chức năng khác" (nút ▦ trên thanh trên) — nơi các chức năng KHÔNG nằm trong 5 tab:
// công cụ âm nhạc, thư viện, kho bài giảng, TeamLab, Story, App học cũ… Không bỏ sót chức năng nào chỉ vì không ở tab.
// Nguồn: danh mục Class Social (tools.ts, nav.ts) — cùng quyền: ToolRouteGate / my_tool_route_access quyết, ở đây CHỈ điều hướng.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BookMarked, BookOpen, Library, GraduationCap, Inbox, MessageCircle, ShieldCheck, Users, X, BookText, Mic } from 'lucide-react'
import { TOOLS } from '../class-social/tools'
import { HT_ONLY_NOTE } from '../class-social/nav'
import { thuVienAccess } from '../thuvien/masterLibrary'
import { IS_NATIVE_CAPACITOR } from '../supabase'
import { proxiedHref } from './config'

type Props = {
  userId: string
  isTeacher: boolean
  onClose: () => void
  onOpenQueue: () => void
  onOpenBands: () => void
}

function Row({ icon, title, hint, href, external, onClick, locked }: {
  icon: ReactNode; title: string; hint?: string; href?: string; external?: boolean; onClick?: () => void; locked?: string
}) {
  const body = (
    <>
      <span className="cm-row-ic" aria-hidden="true">{icon}</span>
      <span className="cm-row-body"><div className="cm-row-t">{title}</div>{(locked || hint) && <div className="cm-row-s">{locked ? `🔒 ${locked}` : hint}</div>}</span>
    </>
  )
  if (locked) return <li><div className="cm-row" aria-disabled="true">{body}</div></li>
  if (href) return <li><a className="cm-row" href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{body}</a></li>
  return <li><button type="button" className="cm-row" onClick={onClick}>{body}</button></li>
}

export default function MoreSheet({ userId, isTeacher, onClose, onOpenQueue, onOpenBands }: Props) {
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [zaloUrl, setZaloUrl] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let alive = true
    void thuVienAccess(userId).then(a => { if (alive) setLibraryOpen(a !== null) })
    // Liên hệ Thầy: zalo_url canonical từ public_app_config (server-driven như App học cũ) — lỗi → không hiện mục
    void import('../supabase').then(m => m.supabase.from('public_app_config').select('key,value').eq('key', 'zalo_url').maybeSingle())
      .then(r => { const v = (r.data as { value?: unknown } | null)?.value; if (alive && typeof v === 'string' && /^https:\/\//.test(v)) setZaloUrl(v) })
      .catch(() => { /* không có Zalo → ẩn mục */ })
    return () => { alive = false }
  }, [userId])

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const teamlab = proxiedHref('/teamlab', IS_NATIVE_CAPACITOR)
  const kho = proxiedHref('/khobaigiang', IS_NATIVE_CAPACITOR)

  return (
    <>
      <div className="cm-sheet-bg" onClick={onClose} aria-hidden="true" />
      <div className="cm-sheet" role="dialog" aria-modal="true" aria-label="Chức năng khác">
        <div className="cm-sheet-grab" aria-hidden="true" />
        <div className="cm-sheet-head">
          <span>Chức năng khác</span>
          <button ref={closeRef} type="button" className="cm-icon-btn" onClick={onClose} aria-label="Đóng"><X aria-hidden="true" /></button>
        </div>
        <div className="cm-sheet-body">
          <h2 className="cm-h2" style={{ marginTop: 4 }}>Công cụ âm nhạc</h2>
          <ul className="cm-tools">
            {TOOLS.map(t => {
              const Icon = t.icon
              return (
                <li key={t.id}>
                  <a className="cm-tool" href={t.href}>
                    <span className="cm-row-ic" aria-hidden="true"><Icon /></span>{t.label}
                  </a>
                </li>
              )
            })}
          </ul>

          <h2 className="cm-h2">Thư viện & học liệu</h2>
          <ul className="cm-list">
            <Row icon={<BookOpen />} title="Kho bài giảng" hint="Video bài giảng của Thầy" href={kho.href} external={kho.external} />
            {libraryOpen
              ? <Row icon={<Library />} title="Thư viện bản nhạc" hint="Bản nhạc và hợp âm" href="/thuvien" />
              : <Row icon={<Library />} title="Thư viện bản nhạc" locked={HT_ONLY_NOTE} />}
            <Row icon={<BookMarked />} title="Kho giáo trình" locked={HT_ONLY_NOTE} />
          </ul>

          <h2 className="cm-h2">Khám phá</h2>
          <ul className="cm-list">
            <Row icon={<Mic />} title="Studio thu âm (TeamLab)" hint="Công cụ thu âm — không phải Ban Nhạc" href={teamlab.href} external={teamlab.external} />
            <Row icon={<BookText />} title="1001 Câu chuyện cùng Guitar" href="/story" />
            <Row icon={<GraduationCap />} title="App học (giao diện cũ)" hint="Khoá học, luyện tập, buổi thực hành cùng Thầy" href="/learn" />
          </ul>

          {(zaloUrl || isTeacher) && <h2 className="cm-h2">{isTeacher ? 'Dành cho Thầy' : 'Hỗ trợ'}</h2>}
          <ul className="cm-list">
            {zaloUrl && <Row icon={<MessageCircle />} title="Nhắn Thầy qua Zalo" hint="Trò chuyện Thầy ↔ học viên trong Class chưa mở" href={zaloUrl} external />}
            {isTeacher && <Row icon={<Inbox />} title="Hàng đợi Trả bài / Hỏi bài" onClick={() => { onClose(); onOpenQueue() }} />}
            {isTeacher && <Row icon={<Users />} title="Quản lý Band (tuyển thành viên)" onClick={() => { onClose(); onOpenBands() }} />}
            {isTeacher && <Row icon={<ShieldCheck />} title="Báo cáo Class" hint="Báo cáo nội dung cần xem xét" href="/story/reports?tab=class" />}
            {isTeacher && <Row icon={<ShieldCheck />} title="Trang quản trị" hint="Mở trên giao diện máy tính" href="/admin" />}
          </ul>
        </div>
      </div>
    </>
  )
}

