import { useEffect, useMemo, useState } from 'react'
import {
  addSilent, addSustain, anchorLines, anchorWord, anchorsPayload, buildMeasureDisplay, firstLyricAnchor, moveMeasure, removeMeasure, toggleGap,
} from './chordAnchors.ts'
import type { ChordAnchors, MeasureAnchor } from './chordAnchors.ts'
import MeasureSheet from './MeasureSheet.tsx'

// Trình sửa vạch nhịp THỦ CÔNG. Thầy bấm vào khe giữa hai chữ để đặt / bỏ vạch; dòng thời gian bên dưới là
// thứ tự hát (sửa được: lên/xuống, ô ngân, ô không lời, xoá). Không nhập JSON, không thấy line/token.
// Chấp nhận → onAccept(bộ vạch) — trang gọi máy chủ để tạo PHIÊN BẢN MỚI; trình sửa không lưu gì.

type Props = {
  text: string
  initial: ChordAnchors | null
  busy: boolean
  onAccept: (anchors: ChordAnchors) => void
  onCancel: () => void
  /** Bộ vạch hiện tại mỗi lần đổi — để bản bên phải đánh số lại NGAY. */
  onChange?: (anchors: ChordAnchors | null) => void
  /** Ô máy phân tích chưa chắc (số ô theo đề xuất ban đầu) — đánh dấu nhẹ ⚠ trong dòng thời gian, KHÔNG đụng bản bên phải. */
  flagged?: number[]
  notes?: string[]
}

export default function AnchorEditor({ text, initial, busy, onAccept, onCancel, onChange, flagged = [], notes = [] }: Props) {
  const lines = useMemo(() => anchorLines(text), [text])
  const [measures, setMeasures] = useState<MeasureAnchor[]>(() => initial?.measures.map(anchor => ({ ...anchor })) ?? [])
  const [pickup, setPickup] = useState<MeasureAnchor | null>(() => initial?.pickup ?? null)
  const [mode, setMode] = useState<'order' | 'append'>('order')
  const [selected, setSelected] = useState<number | null>(null)
  const pickupAt = useMemo(() => firstLyricAnchor(text), [text])

  const marks = useMemo(() => {
    const map = new Map<string, number[]>()
    measures.forEach((anchor, index) => {
      if (anchor.line === null) return
      const key = `${anchor.line}:${anchor.token}`
      map.set(key, [...(map.get(key) ?? []), index + 1])
    })
    return map
  }, [measures])
  const live = useMemo(() => (measures.length ? anchorsPayload(measures, pickup) : null), [measures, pickup])
  const preview = useMemo(() => (live ? buildMeasureDisplay(text, live) : []), [text, live])
  useEffect(() => { onChange?.(live) }, [live, onChange])
  const pickupClash = !!pickup && measures.length > 0 && measures[0].line === pickup.line && measures[0].token === pickup.token

  const click = (line: number, token: number) => { setMeasures(current => toggleGap(current, { line, token }, mode)); setSelected(null) }
  const at = (index: number) => setSelected(current => (current === index ? null : index))

  return <div className="cl-anchor-editor" role="group" aria-label="Trình sửa vạch nhịp">
    <p className="cl-help">Bấm vào <strong>khe giữa hai chữ</strong> để đặt vạch nhịp ở đó; bấm lại để bỏ. Vạch đặt TRƯỚC chữ hát đầu tiên của ô nhịp. Khe cuối dòng = vạch sau chữ cuối.</p>
    <div className="cl-anchor-modes" role="radiogroup" aria-label="Cách thêm vạch">
      <label><input type="radio" name="anchor-mode" checked={mode === 'order'} onChange={() => setMode('order')} /> Theo thứ tự lời</label>
      <label><input type="radio" name="anchor-mode" checked={mode === 'append'} onChange={() => setMode('append')} /> Thêm vào cuối (đoạn hát lại)</label>
    </div>
    <label className="cl-anchor-pickup">
      <input type="checkbox" checked={!!pickup} disabled={!pickupAt} onChange={event => setPickup(event.target.checked ? pickupAt : null)} />
      Bài có nhịp lấy đà — phần hát từ chữ đầu bài tới vạch đầu tiên
    </label>
    {pickupClash && <p className="cl-warn" role="note">Ô 1 đang bắt đầu ngay ở chữ đầu bài — với nhịp lấy đà, hãy đặt vạch đầu tiên ở chữ thứ hai trở đi.</p>}

    <div className="cl-anchor-sheet" aria-label="Lời để đặt vạch nhịp">
      {lines.map((line, lineIndex) => line.tokens.length === 0
        ? <p key={lineIndex} className="cl-anchor-row cl-anchor-row-empty">{line.label ?? ' '}</p>
        : <p key={lineIndex} className="cl-anchor-row">
          {line.label && <span className="cl-anchor-label">{line.label}</span>}
          {line.tokens.map((token, tokenIndex) => <span key={tokenIndex} className="cl-anchor-unit">
            <Gap line={lineIndex} token={tokenIndex} numbers={marks.get(`${lineIndex}:${tokenIndex}`)} pickup={pickup?.line === lineIndex && pickup.token === tokenIndex}
              word={token.word || `[${token.chord}]`} disabled={busy} onClick={click} />
            <span className="cl-seg"><span className="cl-chord">{token.chord ?? ' '}</span><span className="cl-lyric">{token.word || ' '}</span></span>
          </span>)}
          <Gap line={lineIndex} token={line.tokens.length} numbers={marks.get(`${lineIndex}:${line.tokens.length}`)} pickup={false}
            word={null} disabled={busy} onClick={click} />
        </p>)}
    </div>

    {(flagged.length > 0 || notes.length > 0) && <div className="cl-anchor-flags" role="note" aria-label="Máy chưa chắc">
      {flagged.length > 0 && <p><strong>⚠ Cần kiểm: ô {flagged.join(', ')}</strong> — máy chưa chắc ở các ô này (theo đề xuất ban đầu).</p>}
      {notes.map(note => <p key={note}>{note}</p>)}
    </div>}

    <div className="cl-anchor-timeline">
      <div className="cl-anchor-timeline-head">
        <h3>Dòng thời gian · {measures.length} ô{pickup ? ' + nhịp lấy đà' : ''}</h3>
        <button type="button" className="cl-secondary" disabled={busy} onClick={() => { setMeasures(current => addSilent(current, selected ?? current.length - 1)); setSelected(null) }}>
          + Ô không lời{selected !== null ? ` sau ô ${selected + 1}` : ''}
        </button>
      </div>
      {measures.length === 0
        ? <p className="cl-placeholder">Chưa có vạch nào — bấm vào khe giữa các chữ ở trên.</p>
        : <ol className="cl-anchor-list" aria-label="Các ô nhịp theo thứ tự hát">
          {measures.map((anchor, index) => <li key={index} data-selected={selected === index} data-silent={anchor.line === null}>
            <button type="button" className="cl-anchor-pick" onClick={() => at(index)} aria-pressed={selected === index}>
              {flagged.includes(index + 1) && <span className="cl-anchor-flag" title="Máy chưa chắc ô này">⚠ </span>}<strong>Ô {index + 1}</strong> → {anchorWord(text, anchor)}
              {index > 0 && anchor.line !== null && measures[index - 1].line === anchor.line && measures[index - 1].token === anchor.token && <em> (ngân)</em>}
            </button>
            <span className="cl-anchor-actions">
              <button type="button" aria-label={`Đưa ô ${index + 1} lên`} disabled={busy || index === 0} onClick={() => { setMeasures(current => moveMeasure(current, index, -1)); setSelected(index - 1) }}>↑</button>
              <button type="button" aria-label={`Đưa ô ${index + 1} xuống`} disabled={busy || index === measures.length - 1} onClick={() => { setMeasures(current => moveMeasure(current, index, 1)); setSelected(index + 1) }}>↓</button>
              {anchor.line !== null && <button type="button" disabled={busy} onClick={() => setMeasures(current => addSustain(current, index))}>+ Ô ngân</button>}
              <button type="button" aria-label={`Xoá ô ${index + 1}`} disabled={busy} onClick={() => { setMeasures(current => removeMeasure(current, index)); setSelected(null) }}>Xoá</button>
            </span>
          </li>)}
        </ol>}
    </div>

    <div className="cl-anchor-review" aria-label="Xem lại vạch nhịp">
      <h3>Xem lại</h3>
      {preview.length
        ? <MeasureSheet rows={preview} label="Bản xem lại có số ô" />
        : <p className="cl-placeholder">Chưa có vạch nhịp.</p>}
    </div>

    <div className="cl-anchor-buttons">
      <button type="button" className="cl-secondary cl-approve" disabled={busy || measures.length === 0} onClick={() => onAccept(anchorsPayload(measures, pickup))}>
        {busy ? 'Đang lưu…' : 'Chấp nhận vạch nhịp'}
      </button>
      <button type="button" className="cl-secondary" disabled={busy} onClick={onCancel}>Huỷ</button>
    </div>
    <p className="cl-help">Chấp nhận sẽ tạo <strong>phiên bản mới</strong> (cùng lời, hợp âm, nhịp, BPM và sheet nguồn) — bản hiện tại giữ nguyên. Sau đó bấm “Duyệt bản này”.</p>
  </div>
}

function Gap({ line, token, numbers, pickup, word, disabled, onClick }: {
  line: number; token: number; numbers: number[] | undefined; pickup: boolean; word: string | null; disabled: boolean
  onClick: (line: number, token: number) => void
}) {
  const label = word === null ? `Khe cuối dòng ${line + 1}` : `Khe trước “${word}” — dòng ${line + 1}`
  return <button type="button" className="cl-gap" data-on={!!numbers} data-pickup={pickup} disabled={disabled}
    aria-pressed={!!numbers} aria-label={numbers ? `${label}: vạch ô ${numbers.join(', ')}` : label} title={numbers ? `Ô ${numbers.join(', ')}` : 'Đặt vạch nhịp ở đây'}
    onClick={() => onClick(line, token)}>
    <span className="cl-gap-bar" aria-hidden="true">{numbers ? '|' : pickup ? '↦' : ''}</span>
    {numbers && <span className="cl-gap-num" aria-hidden="true">{numbers.join(',')}</span>}
  </button>
}
