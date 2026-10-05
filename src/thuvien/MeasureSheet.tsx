import type { MeasureItem, MeasureRow } from './chordAnchors.ts'

// Bản hợp âm có vạch nhịp + SỐ Ô — chỉ VẼ mô hình buildMeasureDisplay (không tự đánh số).
// Dùng chung cho bản bên phải và khung "Xem lại" của trình sửa. Vạch luôn dính với chữ ngay sau nó (không xuống dòng tách rời).

export default function MeasureSheet({ rows, label }: { rows: MeasureRow[]; label: string }) {
  return <div className="cl-sheet cl-msheet" aria-label={label}>
    {rows.map((row, index) => row.gap
      ? <p key={index} className="cl-line cl-line-gap" aria-hidden="true" />
      : <p key={index} className="cl-line" data-chords={row.items.some(item => item.kind === 'word' && item.chord !== null)}>
        {row.label && <span className="cl-seg cl-mlabel"><span className="cl-chord">{' '}</span><span className="cl-lyric">{row.label}</span></span>}
        {groups(row.items).map((group, at) => group.length > 1
          ? <span key={at} className="cl-mgroup">{group.map(render)}</span>
          : render(group[0], at))}
      </p>)}
  </div>
}

/** Vạch + chữ ngay sau nó thành một khối không ngắt dòng. */
function groups(items: MeasureItem[]): MeasureItem[][] {
  const out: MeasureItem[][] = []
  items.forEach((item, index) => {
    const prev = items[index - 1]
    if (prev && (prev.kind === 'pickup' || (prev.kind === 'bar' && prev.mark === null)) && item.kind === 'word') out[out.length - 1].push(item)
    else out.push([item])
  })
  return out
}

function render(item: MeasureItem, key: number) {
  if (item.kind === 'pickup') return <span key={key} className="cl-mpickup" title="Nhịp lấy đà — không tính số ô">Lấy đà</span>
  if (item.kind === 'word') return <span key={key} className="cl-seg" data-pickup={item.pickup || undefined}>
    <span className="cl-chord">{item.chord ?? ' '}</span><span className="cl-lyric">{item.word || ' '}</span>
  </span>
  return <span key={key} className="cl-mbar" data-start={item.start || undefined} data-mark={item.mark ?? undefined} aria-label={`Ô ${item.number}${item.mark === 'silent' ? ' không lời' : item.mark === 'sustain' ? ' ngân' : ''}`}>
    <span className="cl-mnum">{item.number}</span>
    <span className="cl-mline">{item.start ? '' : '|'}{item.mark === 'silent' ? <em> ♪</em> : item.mark === 'sustain' ? <em> ngân</em> : null}</span>
  </span>
}
