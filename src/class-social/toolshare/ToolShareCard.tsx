// Thân bài "Kết quả công cụ" trên Feed / Tường — MỘT renderer cho mọi công cụ (nội dung do registry quyết).
// Không hiện payload/JSON/tool id; hành động "thử lại" là link cùng tab tới công cụ với tham số đã kiểm.
import { lazy, Suspense, useState } from 'react'
import { describeToolShare, type ToolShareView } from './registry'
import { useToolSharePayload } from './toolShareApi'

const ShareToFriendSheet = lazy(() => import('../../share/ShareToFriendSheet'))

export function ToolShareBodyView({ view, onShareToFriend }: { view: ToolShareView | null; onShareToFriend?: (ref: NonNullable<ToolShareView['shareRef']>, title: string) => void }) {
  if (!view) return <p className="cs-tool-share-missing">Kết quả này không còn hiển thị được.</p>
  const Icon = view.icon
  return (
    <div className="cs-tool-share">
      <div className="cs-tool-share-kind"><Icon size={15} aria-hidden="true" /> {view.toolLabel} · {view.kindLabel}</div>
      <div className="cs-tool-share-headline">{view.headline}</div>
      {view.detail && <div className="cs-tool-share-detail">{view.detail}</div>}
      {view.thumbnail && <img className="cs-tool-share-thumb" src={view.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"
        onError={e => { e.currentTarget.style.display = 'none' }} />}
      {view.note && <div className="cs-tool-share-note">{view.note}</div>}
      {view.action && <a className="cs-btn cs-btn-soft cs-tool-share-cta" href={view.action.href}>{view.action.label}</a>}
      {view.shareRef && onShareToFriend && (
        <button type="button" className="cs-btn cs-btn-soft cs-tool-share-cta" onClick={() => onShareToFriend(view.shareRef!, view.headline)}>Chia sẻ</button>
      )}
    </div>
  )
}

export default function ToolShareBody({ postId }: { postId: string }) {
  const raw = useToolSharePayload(postId)
  const [sheet, setSheet] = useState<{ target: NonNullable<ToolShareView['shareRef']>; title: string } | null>(null)
  if (raw === undefined) return <div className="cs-tool-share"><span className="cs-skeleton" style={{ width: '45%', height: 18 }} /></div>
  return (
    <>
      <ToolShareBodyView view={describeToolShare(raw)} onShareToFriend={(ref, title) => setSheet({ target: ref, title })} />
      {sheet && <Suspense fallback={null}><ShareToFriendSheet target={sheet.target} title={sheet.title} onClose={() => setSheet(null)} /></Suspense>}
    </>
  )
}
