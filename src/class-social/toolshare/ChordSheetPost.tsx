// Bài đăng Play Scroll trên Feed /me: xem trước nội dung hợp âm thật + chạy Play Scroll NGAY trong bài (dùng lại RhythmScrollPage, chế độ nhúng).
// - Xem trước chỉ nạp khi thẻ gần vào khung nhìn (IntersectionObserver, hàng đợi một yêu cầu một lúc).
// - Player chỉ dựng khi người xem bấm "Tập ngay"; mỗi lúc MỘT player trên Feed (dùng chung store "đang mở" với player TeamLab); không tự phát.
// - Không còn quyền đọc / bị thu hồi → "Nội dung này không còn khả dụng". Mở rộng → /hopam/<id> (trang đầy đủ).
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Music4 } from 'lucide-react'
import { parseChordLines } from '../../rhythm-scroll-viewer/chordLines'
import { UNAVAILABLE_TEXT } from '../../share/refCards'
import { closeEmbed, openEmbed, useActiveEmbed } from '../sections/publicationEmbed'
import { loadChordDetail } from './chordPostStore'
import type { ChordSheetDetail } from '../../thuvien/chordLibrary'
import type { ToolShareView } from './registry'

const RhythmScrollPage = lazy(() => import('../../thuvien/RhythmScrollPage'))
const PREVIEW_LINES = 6

export function ChordPreview({ text }: { text: string }) {
  const lines = useMemo(() => parseChordLines(text).filter(line => line.words.length).slice(0, PREVIEW_LINES), [text])
  return <div className="cs-chord-preview" aria-label="Xem trước hợp âm">
    {lines.map(line => <div key={line.index} className="cs-chord-line">
      {line.words.map((word, i) => <span key={i} className="cs-chord-word">
        <span className="cs-chord-name">{word.chord ?? ' '}</span><span className="cs-chord-lyric">{word.text}</span>
      </span>)}
    </div>)}
  </div>
}

export function ChordSheetPostView({ view, versionId, preview, onShare, playing, onPlay, onClose, player }: {
  view: ToolShareView | null; versionId: string
  /** undefined = đang tải/chưa tới; null = không khả dụng */
  preview: ChordSheetDetail | null | undefined
  onShare?: () => void; playing: boolean; onPlay: () => void; onClose: () => void; player?: React.ReactNode
}) {
  if (!view || preview === null) return <div className="cs-share-card is-unavailable" role="note">{UNAVAILABLE_TEXT}</div>
  return <div className="cs-tool-share cs-chord-post" data-testid="chord-post">
    <div className="cs-tool-share-kind"><Music4 size={15} aria-hidden="true" /> {view.toolLabel} · {view.kindLabel}</div>
    <div className="cs-tool-share-headline">{view.headline}</div>
    {view.detail && <div className="cs-tool-share-detail">{view.detail}</div>}
    {playing
      ? player
      : preview === undefined
        ? <div className="cs-chord-preview is-loading" aria-busy="true"><span className="cs-skeleton" style={{ width: '70%', height: 16 }} /><span className="cs-skeleton" style={{ width: '55%', height: 16, marginTop: 10 }} /></div>
        : <ChordPreview text={preview.text} />}
    {!playing && <>
      <div className="cs-chord-dock">
        <button type="button" className="cs-chord-play" onClick={onPlay} disabled={preview === undefined} aria-label="Phát Play Scroll">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
        </button>
        <div className="cs-chord-dock-text"><strong>Play Scroll</strong><span>Bấm Play để tự cuộn hợp âm</span></div>
      </div>
      <div className="cs-chord-actions">
        <a className="cs-btn cs-btn-ghost cs-btn-sm" href={`/hopam/${versionId}`}>Mở rộng</a>
        {onShare && <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" onClick={onShare}>Chia sẻ</button>}
      </div>
    </>}
    {playing && <div className="cs-chord-actions"><button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" onClick={onClose}>Thu gọn</button></div>}
  </div>
}

export default function ChordSheetPost({ postId, view, versionId, onShare }: { postId: string; view: ToolShareView | null; versionId: string; onShare?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [preview, setPreview] = useState<ChordSheetDetail | null | undefined>(undefined)
  const [library, setLibrary] = useState<import('../../thuvien/chordLibrary').ChordLibrary | null>(null)
  const embedId = `chord:${postId}`
  const active = useActiveEmbed()
  const playing = active === embedId

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') { setNear(true); return }
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setNear(true); io.disconnect() } }, { rootMargin: '300px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!near || !view) return
    let alive = true
    void loadChordDetail(versionId).then(r => { if (alive && r.ok) setPreview(r.detail) })
    return () => { alive = false }
  }, [near, versionId, view])
  useEffect(() => { if (playing && !library) void import('../../thuvien/chordLibrary').then(m => setLibrary(m.getChordLibrary())) }, [playing, library])
  // Rời Feed / thẻ bị gỡ khỏi cây → nhả vị trí "đang mở" (player tự bị gỡ cùng thẻ).
  useEffect(() => () => closeEmbed(embedId), [embedId])

  const player = playing && preview
    ? <Suspense fallback={<div className="cs-chord-preview is-loading" aria-busy="true">Đang mở trình phát…</div>}>
        {library && <RhythmScrollPage embedded autoStart library={library} versionId={versionId} initialDetail={preview} onBack={() => closeEmbed(embedId)} />}
      </Suspense>
    : null
  return <div ref={rootRef}>
    <ChordSheetPostView view={view} versionId={versionId} preview={preview} onShare={onShare} playing={playing && !!preview}
      onPlay={() => openEmbed(embedId)} onClose={() => closeEmbed(embedId)} player={player} />
  </div>
}
