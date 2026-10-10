import { useMemo, useState } from 'react'
import { chordLineCells, normalizeChord, setChordAtToken } from './chordEdit.ts'
import { canonicalChordText, listChords } from './chordText.ts'

// Vùng "Xem thử" có thể chạm: hợp âm hiện phía trên lời, chạm một chữ để thêm / đổi / xoá hợp âm.
// Nguồn sự thật vẫn là chuỗi văn bản (`text`): mỗi lần chọn chỉ gọi `setChordAtToken` rồi trả chuỗi mới qua `onChange`.
// Không contenteditable, không giữ trạng thái dữ liệu riêng — chỉ nhớ chữ đang được chọn.

/** Gợi ý cho người mới: các hợp âm thông dụng, hiện sau các hợp âm đã có trong bài. */
const COMMON = ['C', 'D', 'E', 'F', 'G', 'A', 'Am', 'Dm', 'Em', 'Bm', 'G7', 'E7'] as const

type Selected = { line: number; token: number }

export default function ChordSheetEditor({ text, onChange }: { text: string; onChange: (text: string) => void }) {
  const [selected, setSelected] = useState<Selected | null>(null)
  const [custom, setCustom] = useState('')
  const [problem, setProblem] = useState('')
  const lines = useMemo(() => canonicalChordText(text).split('\n').map(line => ({ line, cells: chordLineCells(line) })), [text])
  const songChords = useMemo(() => listChords(text), [text])

  const pick = (selection: Selected | null) => { setSelected(selection); setCustom(''); setProblem('') }

  function apply(chord: string | null) {
    if (!selected) return
    const result = setChordAtToken(text, selected.line, selected.token, chord)
    if (!result.ok) { setProblem(result.reason); return }
    if (result.changed) onChange(result.text)
    pick(null)
  }

  const submitCustom = () => {
    if (normalizeChord(custom) === null) { setProblem('Nhập tên hợp âm, ví dụ Am, F#m7, C/G (tối đa 16 ký tự, không có [ ]).'); return }
    apply(custom)
  }

  const current = selected
    ? lines[selected.line]?.cells.find(cell => cell.kind === 'word' && cell.token === selected.token)
    : undefined
  const currentChord = current && current.kind === 'word' ? current.chord : null
  const more = COMMON.filter(chord => !songChords.includes(chord))

  return <div className="cl-sheet cl-sheet-edit">
    <p className="cl-help">Chạm vào một chữ để thêm hoặc đổi hợp âm trên chữ đó.</p>
    {lines.map(({ line, cells }, index) => {
      if (!line.trim()) return <p key={index} className="cl-line cl-line-gap" aria-hidden="true" />
      const hasChords = cells.some(cell => (cell.kind === 'word' && cell.chord) || cell.kind === 'chord')
      const open = selected?.line === index
      return <div key={index} className="cl-edit-row">
        <p className="cl-line" data-chords={hasChords}>
          {cells.map((cell, at) => {
            const next = cells[at + 1]
            const tight = next?.kind === 'word' && next.joined
            if (cell.kind === 'label') return <span key={at} className="cl-seg cl-label"><span className="cl-chord">{' '}</span><span className="cl-lyric">{cell.text}</span></span>
            if (cell.kind === 'chord') return <span key={at} className="cl-seg"><span className="cl-chord">{cell.chord}</span><span className="cl-lyric">{' '}</span></span>
            const active = open && selected.token === cell.token
            return <span key={at} className="cl-seg" data-tight={tight}>
              <span className="cl-chord">{cell.chord ?? ' '}</span>
              <button type="button" className="cl-word" data-active={active} data-has-chord={cell.chord !== null} aria-pressed={active}
                aria-label={cell.chord ? `Đổi hợp âm ${cell.chord} trên chữ ${cell.word}` : `Thêm hợp âm cho chữ ${cell.word}`}
                onClick={() => pick(active ? null : { line: index, token: cell.token })}>{cell.word}</button>
            </span>
          })}
        </p>
        {open && current?.kind === 'word' && <div className="cl-picker" role="group" aria-label={`Chọn hợp âm cho chữ ${current.word}`}>
          <div className="cl-picker-head">
            <strong>Hợp âm cho “{current.word}”</strong>
            <button type="button" className="cl-link" onClick={() => pick(null)}>Đóng</button>
          </div>
          {songChords.length > 0 && <div className="cl-picker-row" aria-label="Hợp âm đã có trong bài">
            {songChords.map(chord => <button key={chord} type="button" className="cl-chip" aria-pressed={chord === currentChord} onClick={() => apply(chord)}>{chord}</button>)}
          </div>}
          <div className="cl-picker-row" aria-label="Hợp âm thông dụng">
            {more.map(chord => <button key={chord} type="button" className="cl-chip cl-chip-soft" onClick={() => apply(chord)}>{chord}</button>)}
          </div>
          <form className="cl-picker-custom" onSubmit={event => { event.preventDefault(); submitCustom() }}>
            <input value={custom} onChange={event => { setCustom(event.target.value); setProblem('') }} placeholder="Hợp âm khác, ví dụ F#m7" aria-label="Nhập hợp âm khác" maxLength={16} />
            <button type="submit" className="cl-secondary">Dùng</button>
            {currentChord && <button type="button" className="cl-secondary" onClick={() => apply(null)}>Xoá hợp âm {currentChord}</button>}
          </form>
          {problem && <p className="cl-error" role="alert">{problem}</p>}
        </div>}
      </div>
    })}
  </div>
}
