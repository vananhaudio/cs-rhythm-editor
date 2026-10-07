// Card của tin share trong dòng chat (V1b). Cả card là MỘT liên kết tới object gốc (route Class do registry quyết);
// không có URL thô, không JSON/id. Object không đọc được → "Nội dung này không còn khả dụng" (không link, không rò chi tiết).
import { useEffect } from 'react'
import type { ToolShareView } from '../toolshare/registry'
import { UNAVAILABLE_TEXT, useSharedArtifactView } from './shareCards'

export function ShareCardView({ view }: { view: ToolShareView | null | undefined }) {
  if (view === undefined) return <div className="cs-share-card is-loading" aria-busy="true"><span className="cs-skeleton" style={{ width: '55%', height: 16 }} /></div>
  if (view === null) return <div className="cs-share-card is-unavailable" role="note">{UNAVAILABLE_TEXT}</div>
  const Icon = view.icon
  const body = (
    <>
      <div className="cs-share-kind"><Icon size={14} aria-hidden="true" /> {view.toolLabel} · {view.kindLabel}</div>
      <div className="cs-share-title">{view.headline}</div>
      {view.detail && <div className="cs-share-detail">{view.detail}</div>}
      {view.thumbnail && <img className="cs-share-thumb" src={view.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"
        onError={e => { e.currentTarget.style.display = 'none' }} />}
      {view.action && <span className="cs-share-cta">{view.action.label}</span>}
    </>
  )
  return view.action
    ? <a className="cs-share-card" href={view.action.href} aria-label={`${view.toolLabel}: ${view.headline}. ${view.action.label}`}>{body}</a>
    : <div className="cs-share-card">{body}</div>
}

export default function ShareMessageCard({ refKey, onSettle }: { refKey: string; onSettle?: () => void }) {
  const view = useSharedArtifactView(refKey)
  // card đổi chiều cao khi tải xong → báo danh sách tin (giữ vị trí cuối nếu đang ở cuối)
  useEffect(() => { if (view !== undefined) onSettle?.() }, [view, onSettle])
  return <ShareCardView view={view} />
}
