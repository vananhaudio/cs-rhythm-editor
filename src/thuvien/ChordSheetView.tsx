import { useEffect, useMemo, useState } from 'react'
import type { ChordLibrary, ChordSheetDetail } from './chordLibrary.ts'
import { buildMeasureDisplay } from './chordAnchors.ts'
import { formatMeter, parseChordText } from './chordText.ts'
import MeasureSheet from './MeasureSheet.tsx'

// Trang XEM một bài hợp âm: chỉ đọc. Không có ô nhập, không có trình sửa, không ghi gì.
// "Sửa" chuyển sang khu vực biên tập (ChordEditor) — chỉ hiện khi `canEdit`. Quyền thật vẫn do RPC ở máy chủ quyết định.

type Props = {
  library: ChordLibrary
  versionId: string
  canEdit: boolean
  onBack: () => void
  onEdit: (versionId: string) => void
  onOpenVersion: (versionId: string) => void
  onRhythm: (versionId: string) => void
}

const STATUS: Record<ChordSheetDetail['status'], string> = {
  current: 'Bản đang dùng', draft: 'Bản nháp — chưa duyệt', old: 'Bản cũ — đã duyệt trước đây, hiện không dùng', discarded: 'Bản nháp đã bỏ',
}

export default function ChordSheetView({ library, versionId, canEdit, onBack, onEdit, onOpenVersion, onRhythm }: Props) {
  const [detail, setDetail] = useState<ChordSheetDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setDetail(null); setError('')
    library.getChordSheet(versionId).then(data => { if (active) setDetail(data) })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Không mở được bài.') })
    return () => { active = false }
  }, [library, versionId])

  const rows = useMemo(() => (detail?.anchors ? buildMeasureDisplay(detail.text, detail.anchors) : null), [detail])
  const lines = useMemo(() => (detail ? parseChordText(detail.text) : []), [detail])

  if (error) return <div className="cl-wrap">
    <p className="cl-empty" role="alert">{error}</p>
    <button type="button" className="cl-back" onClick={onBack}>← Danh sách</button>
  </div>
  if (!detail) return <div className="cl-wrap"><p className="cl-empty" aria-live="polite">Đang mở bài…</p></div>

  const meter = formatMeter(detail.meter)
  return <div className="cl-wrap cl-view">
    <header className="cl-view-head">
      <button type="button" className="cl-back" onClick={onBack}>← Danh sách</button>
      <div className="cl-view-title">
        <h1>{detail.title}</h1>
        <p>{detail.composer || 'Chưa rõ tác giả'}</p>
      </div>
      <div className="cl-view-actions">
        {detail.anchors && <button type="button" className="cl-secondary" onClick={() => onRhythm(detail.versionId)}>▶ Rhythm Scroll</button>}
        {canEdit && <button type="button" className="cl-primary" onClick={() => onEdit(detail.versionId)}>Sửa bài này</button>}
      </div>
    </header>

    <section className="cl-card" aria-label="Thông tin phiên bản">
      <ul className="cl-facts">
        <li><span>Phiên bản</span><strong>{detail.versionNumber}</strong></li>
        <li><span>Trạng thái</span><strong>{STATUS[detail.status]}</strong></li>
        <li><span>Nhịp</span><strong>{meter || '—'}</strong></li>
        <li><span>BPM gợi ý</span><strong>{detail.suggestedBpm ?? '—'}</strong></li>
        <li><span>Vạch nhịp</span><strong>{detail.anchors ? 'Đã có' : 'Chưa có'}</strong></li>
        <li><span>Sheet nguồn</span><strong>{detail.sources.length ? `${detail.sources.length} file` : 'Không có'}</strong></li>
      </ul>
      {detail.draftVersionId && detail.draftVersionId !== detail.versionId &&
        <p className="cl-warn" role="note">Bài này có bản nháp mới hơn, chưa được duyệt. <button type="button" className="cl-link" onClick={() => onOpenVersion(detail.draftVersionId!)}>Xem bản nháp</button></p>}
    </section>

    <section className="cl-card cl-preview" aria-label="Lời và hợp âm">
      <h2>Lời và hợp âm</h2>
      {rows ? <MeasureSheet rows={rows} label="Bản hợp âm có số ô" />
        : <div className="cl-sheet">
          {lines.map((line, index) => line.length
            ? <p key={index} className="cl-line" data-chords={line.some(segment => segment.chord !== null)}>{line.map((segment, at) =>
                <span key={at} className="cl-seg"><span className="cl-chord">{segment.chord ?? ' '}</span><span className="cl-lyric">{segment.text || ' '}</span></span>)}</p>
            : <p key={index} className="cl-line cl-line-gap" aria-hidden="true" />)}
        </div>}
    </section>
  </div>
}
