// Menu "⋯" dùng chung: Báo cáo + Chặn người dùng. Chỉ render cho nội dung của NGƯỜI KHÁC (nơi gọi quyết định).
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { MoreMenu } from '../class-social/ui'
// Nạp lười: hộp thoại chỉ cần khi mở (và tránh kéo client Supabase vào mọi nơi chỉ để hiện menu)
const ReportSheet = lazy(() => import('./ReportSheet'))
const BlockConfirm = lazy(() => import('./BlockConfirm'))
import type { ReportKind } from './model'

export default function SafetyMenu({ label, kind, targetId, userId, userName, extraItems = [], noBlock = false, trigger, className }: {
  label: string
  kind: ReportKind
  targetId: string
  /** Tác giả nội dung (để Chặn). Thiếu → chỉ có Báo cáo */
  userId?: string | null
  userName?: string
  extraItems?: { label: string; onSelect: () => void; danger?: boolean }[]
  noBlock?: boolean
  trigger?: ReactNode
  className?: string
}) {
  const [dlg, setDlg] = useState<'report' | 'block' | null>(null)
  const items = [
    ...extraItems,
    { label: 'Báo cáo', onSelect: () => setDlg('report') },
    ...(userId && !noBlock ? [{ label: 'Chặn người dùng', danger: true, onSelect: () => setDlg('block') }] : []),
  ]
  return (
    <>
      <MoreMenu label={label} items={items} trigger={trigger} className={className} />
      <Suspense fallback={null}>
      {dlg === 'report' && <ReportSheet kind={kind} targetId={targetId} onClose={() => setDlg(null)} />}
      {dlg === 'block' && userId && <BlockConfirm userId={userId} name={userName || 'người dùng này'} onClose={() => setDlg(null)} />}
      </Suspense>
    </>
  )
}
