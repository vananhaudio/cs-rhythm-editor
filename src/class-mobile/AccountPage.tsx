// Tài khoản & cài đặt (trong tab Tôi) — QUẢN LÝ TÀI KHOẢN, tách khỏi hồ sơ cộng đồng (ProfilePage).
// Dùng lại: ProfileEditDialog (tên + ảnh đại diện), useProfileMediaEditor (ảnh bìa), signOut (Supabase Auth hiện có),
// /subscribe (gói — không viết lại thanh toán), /delete-account (xóa tài khoản — hàm delete_my_account hiện có).
import { ChevronRight, CreditCard, ImagePlus, KeyRound, LogOut, Pencil, Trash2, UserX } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import BlockedUsersPage from '../class-safety/BlockedUsersPage'
import SupportRow from '../class-safety/SupportRow'
import type { ClassIdentity } from '../class-social/useClassSession'
import type { ImageKind } from '../class-social/profile/imageFile'

function Row({ icon, title, hint, onClick, href, danger, disabled }: {
  icon: ReactNode; title: string; hint?: string; onClick?: () => void; href?: string; danger?: boolean; disabled?: boolean
}) {
  const cls = 'cm-row' + (danger ? ' is-danger' : '')
  const body = (
    <>
      <span className="cm-row-ic" aria-hidden="true">{icon}</span>
      <span className="cm-row-body"><div className="cm-row-t">{title}</div>{hint && <div className="cm-row-s">{hint}</div>}</span>
      {!disabled && <ChevronRight className="cm-row-chev" aria-hidden="true" />}
    </>
  )
  if (disabled) return <li><div className={cls} aria-disabled="true">{body}</div></li>
  return <li>{href ? <a className={cls} href={href}>{body}</a> : <button type="button" className={cls} onClick={onClick}>{body}</button>}</li>
}

export default function AccountPage({ me, canEditAvatar, onEditMedia, onEditProfile, onSignOut }: {
  me: ClassIdentity
  canEditAvatar: boolean
  onEditMedia: (kind: ImageKind) => void
  onEditProfile?: () => void
  onSignOut: () => void
}) {
  const [sub, setSub] = useState<'blocked' | null>(null)
  if (sub === 'blocked') return <BlockedUsersPage />
  return (
    <div className="cm-page">
      <h1 className="cm-title">Tài khoản & cài đặt</h1>
      <p className="cm-note" style={{ marginTop: 0 }}>Đăng nhập với <strong>{me.email ?? me.name}</strong></p>

      <h2 className="cm-h2">Hồ sơ</h2>
      <ul className="cm-list">
        {onEditProfile && <Row icon={<Pencil />} title="Chỉnh sửa tên và ảnh đại diện" onClick={onEditProfile} />}
        {canEditAvatar && <Row icon={<ImagePlus />} title="Đổi ảnh đại diện" onClick={() => onEditMedia('avatar')} />}
        <Row icon={<ImagePlus />} title="Đổi ảnh bìa" onClick={() => onEditMedia('cover')} />
      </ul>

      <h2 className="cm-h2">Gói và bảo mật</h2>
      <ul className="cm-list">
        <Row icon={<CreditCard />} title="Gói của tôi" hint="Gói học đang dùng" href="/subscribe" />
        <Row icon={<KeyRound />} title="Đổi mật khẩu" hint="Trong App học → Tôi → Hồ sơ" href="/learn?tab=me" />
      </ul>

      <h2 className="cm-h2">An toàn cộng đồng</h2>
      <ul className="cm-list">
        <Row icon={<UserX />} title="Người đã chặn" hint="Xem và bỏ chặn" onClick={() => setSub('blocked')} />
      </ul>

      <SupportRow />

      <h2 className="cm-h2">Thông báo</h2>
      <ul className="cm-list">
        <Row icon={<CreditCard />} title="Cài đặt thông báo" hint="Chưa có — ứng dụng chưa hỗ trợ thông báo đẩy" disabled />
      </ul>

      <h2 className="cm-h2">Phiên đăng nhập</h2>
      <ul className="cm-list">
        <Row icon={<LogOut />} title="Đăng xuất" onClick={onSignOut} danger />
        <Row icon={<Trash2 />} title="Xóa tài khoản" hint="Xóa vĩnh viễn tài khoản và dữ liệu" href="/delete-account" danger />
      </ul>
    </div>
  )
}
