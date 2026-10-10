import { useMemo, useState } from 'react'
import { chordLineCells, insertRestAtGap, isRest, normalizeChord, nudgeMeasure, placeChordOnRest, remapAnchorsForRemove, removeRest, setChordAtToken } from './chordEdit.ts'
import { anchorLines, anchorsPayload, toggleGap } from './chordAnchors.ts'
import type { ChordAnchors, MeasureAnchor } from './chordAnchors.ts'
import { canonicalChordText, listChords } from './chordText.ts'

// MỘT bản nhạc để biên tập: hợp âm hiện phía trên chữ, vạch nhịp hiện ngay trong dòng (có số ô).
//   • chạm CHỮ        → đặt / đổi / xoá hợp âm; chạm "(-)" → hợp âm, xoá vị trí nghỉ
//   • chạm KHE giữa hai chữ (đầu dòng, cuối dòng, cạnh "(-)") → "Đặt hợp âm tại đây" (tự sinh "(-)") hoặc "Đặt vạch nhịp tại đây"
//   • chạm VẠCH đã có → xoá vạch, dịch sang khe trước / sau
// Không có chế độ bật/tắt. Nguồn sự thật: chuỗi văn bản `text` + bộ vạch `bars` do trang giữ; component chỉ nhớ chỗ đang chọn.

/** Gợi ý cho người mới: các hợp âm thông dụng, hiện sau các hợp âm đã có trong bài. */
const COMMON = ['C', 'D', 'E', 'F', 'G', 'A', 'Am', 'Dm', 'Em', 'Bm', 'G7', 'E7'] as const

type Selected = { kind: 'word'; line: number; token: number } | { kind: 'gap'; line: number; gap: number }

/** Chèn/xoá vị trí nghỉ "(-)": đổi số chữ của dòng nên trang cần `line`/`at`/`side` để dời vạch nhịp đúng chữ. */
export type StructureEdit = { text: string; line: number; at: number; kind: 'insert' | 'remove'; side: 'before' | 'after' }

type Props = {
  text: string
  bars: ChordAnchors | null
  onChange: (text: string) => void
  onStructure: (edit: StructureEdit) => void
  onBars: (next: ChordAnchors | null) => void
}

const keyOf = (line: number, token: number) => `${line}:${token}`
const superscript = (n: number) => String(n).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]).join('')

export default function ChordSheetEditor({ text, bars, onChange, onStructure, onBars }: Props) {
  const [selected, setSelected] = useState<Selected | null>(null)
  const [custom, setCustom] = useState('')
  const [problem, setProblem] = useState('')
  const [restAfterBar, setRestAfterBar] = useState(true)
  const [confirmRemove, setConfirmRemove] = useState('')
  const lines = useMemo(() => canonicalChordText(text).split('\n').map((line, index) => ({ line, index, cells: chordLineCells(line) })), [text])
  const counts = useMemo(() => anchorLines(text).map(view => view.tokens.length), [text])
  const songChords = useMemo(() => listChords(text), [text])
  // khe → các số ô có vạch ở đó (theo dòng thời gian: ô i = i + 1)
  const marks = useMemo(() => {
    const map = new Map<string, { index: number }[]>()
    bars?.measures.forEach((anchor, index) => {
      if (anchor.line === null || anchor.token === null) return
      map.set(keyOf(anchor.line, anchor.token), [...(map.get(keyOf(anchor.line, anchor.token)) ?? []), { index }])
    })
    return map
  }, [bars])

  const pick = (selection: Selected | null) => { setSelected(selection); setCustom(''); setProblem(''); setConfirmRemove('') }
  const more = COMMON.filter(chord => !songChords.includes(chord))
  const measures = bars?.measures ?? []

  const commitBars = (next: MeasureAnchor[]) => onBars(next.length ? anchorsPayload(next, bars?.pickup ?? null) : null)

  // ── hợp âm trên một chữ / một "(-)" ──
  function applyWord(chord: string | null) {
    if (selected?.kind !== 'word') return
    const target = lines[selected.line]?.cells.find(cell => cell.kind === 'word' && cell.token === selected.token)
    const onRest = target?.kind === 'word' && isRest(target.word) && chord !== null
    const result = onRest ? placeChordOnRest(text, selected.line, selected.token, chord) : setChordAtToken(text, selected.line, selected.token, chord)
    if (!result.ok) { setProblem(result.reason); return }
    if (result.changed) onChange(result.text)
    pick(null)
  }

  function removeRestHere() {
    if (selected?.kind !== 'word') return
    const edit = removeRest(text, selected.line, selected.token)
    if (!edit.ok) { setProblem(edit.reason); return }
    // Vị trí nghỉ đang là CẢ MỘT ô (vạch trước và sau nó) → xoá sẽ biến ô đó thành ô ngân: hỏi trước, không âm thầm đổi.
    if (bars && !confirmRemove) {
      const remap = remapAnchorsForRemove(bars, selected.line, selected.token)
      if (remap.merged.length) {
        setConfirmRemove(`Vị trí nghỉ này đang là cả ô nhịp ${remap.merged.map(i => i + 1).join(', ')}. Xóa sẽ biến ô đó thành ô ngân (trùng vị trí ô trước). Vẫn xóa?`)
        return
      }
    }
    onStructure({ text: edit.text, line: edit.line, at: edit.at, kind: 'remove', side: 'before' })
    pick(null)
  }

  // ── khe: hợp âm không lời (một lần chọn: tự sinh "(-)" rồi gắn hợp âm) ──
  function applyGap(chord: string) {
    if (selected?.kind !== 'gap') return
    const name = normalizeChord(chord)
    if (!name) { setProblem('Nhập tên hợp âm, ví dụ Am, F#m7, C/G (tối đa 16 ký tự, không có [ ]).'); return }
    const inserted = insertRestAtGap(text, selected.line, selected.gap)
    if (!inserted.ok) { setProblem(inserted.reason); return }
    const withChord = placeChordOnRest(inserted.text, selected.line, inserted.at, name)
    if (!withChord.ok) { setProblem(withChord.reason); return }
    // Có vạch đúng khe này: "(-)" nằm SAU vạch (đầu ô mới) hoặc TRƯỚC vạch (cuối ô cũ) — do người dùng chọn, không đoán.
    onStructure({ text: withChord.text, line: selected.line, at: inserted.at, kind: 'insert', side: restAfterBar ? 'before' : 'after' })
    pick(null)
  }

  // ── khe: vạch nhịp ──
  function addBar() {
    if (selected?.kind !== 'gap') return
    commitBars(toggleGap(measures, { line: selected.line, token: selected.gap }, 'order'))
    pick(null)
  }
  function removeBar(index: number) {
    commitBars(measures.filter((_, at) => at !== index))
    pick(null)
  }
  function nudge(index: number, delta: -1 | 1) {
    const next = nudgeMeasure(measures, index, delta, counts)
    if (!next) return
    commitBars(next)
    const moved = next[index]
    if (moved.line !== null && moved.token !== null) setSelected({ kind: 'gap', line: moved.line, gap: moved.token })   // popover đi theo vạch
  }

  const submitCustom = () => {
    if (normalizeChord(custom) === null) { setProblem('Nhập tên hợp âm, ví dụ Am, F#m7, C/G (tối đa 16 ký tự, không có [ ]).'); return }
    if (selected?.kind === 'gap') applyGap(custom); else applyWord(custom)
  }

  const chips = (onPick: (chord: string) => void, currentChord: string | null) => <>
    {songChords.length > 0 && <div className="cl-picker-row" aria-label="Hợp âm đã có trong bài">
      {songChords.map(chord => <button key={chord} type="button" className="cl-chip" aria-pressed={chord === currentChord} onClick={() => onPick(chord)}>{chord}</button>)}
    </div>}
    <div className="cl-picker-row" aria-label="Hợp âm thông dụng">
      {more.map(chord => <button key={chord} type="button" className="cl-chip cl-chip-soft" onClick={() => onPick(chord)}>{chord}</button>)}
    </div>
    <form className="cl-picker-custom" onSubmit={event => { event.preventDefault(); submitCustom() }}>
      <input value={custom} onChange={event => { setCustom(event.target.value); setProblem('') }} placeholder="Hợp âm khác, ví dụ F#m7" aria-label="Nhập hợp âm khác" maxLength={16} />
      <button type="submit" className="cl-secondary">Dùng</button>
    </form>
  </>

  return <div className="cl-sheet cl-sheet-edit">
    {lines.map(({ index, cells }) => {
      const count = counts[index] ?? 0
      const words = cells.filter(cell => cell.kind === 'word') as { kind: 'word'; token: number; word: string; chord: string | null; joined: boolean }[]
      const wordAt = (token: number) => words.find(cell => cell.token === token)?.word
      const hasChords = cells.some(cell => (cell.kind === 'word' && cell.chord) || cell.kind === 'chord')
      const open = selected?.line === index

      /** Khe `gap` của dòng này: nút chạm được; có vạch thì vạch luôn hiện kèm số ô. */
      const slot = (gap: number, tight = false) => {
        const here = marks.get(keyOf(index, gap))
        const prev = gap > 0 ? wordAt(gap - 1) : undefined
        const next = wordAt(gap)
        const where = gap === 0 ? 'đầu dòng' : gap >= count ? 'cuối dòng' : `giữa “${prev ?? '·'}” và “${next ?? '·'}”`
        const pickup = bars?.pickup?.line === index && bars.pickup.token === gap
        const active = selected?.kind === 'gap' && selected.line === index && selected.gap === gap
        const numbers = here?.map(item => item.index + 1)
        const label = `${numbers ? `Vạch nhịp ô ${numbers.join(', ')} — ` : ''}Khe ${where} (dòng ${index + 1}, khe ${gap + 1})`
        return <button key={`slot-${gap}`} type="button" className="cl-slot" data-bar={!!numbers} data-pickup={pickup} data-active={active} data-tight={tight} data-end={gap === 0 || gap >= count}
          aria-label={label} aria-pressed={active} title={numbers ? `Ô ${numbers.join(', ')}` : 'Chèn hợp âm / đặt vạch nhịp tại đây'}
          onClick={() => (active ? pick(null) : (pick({ kind: 'gap', line: index, gap }), setRestAfterBar(true)))}>
          {numbers && <span className="cl-slot-num" aria-hidden="true">{numbers.map(superscript).join(',')}</span>}
        </button>
      }

      // Dòng chưa có chữ nào (trống, hay chỉ có nhãn như "Dạo:"): một khe duy nhất để đặt hợp âm không lời.
      if (count === 0 && !words.length) {
        const label = cells.find(cell => cell.kind === 'label')
        const active = selected?.kind === 'gap' && selected.line === index
        return <div key={index} className="cl-edit-row cl-edit-row-empty">
          <p className="cl-line" data-chords="false">
            {label?.kind === 'label' && <span className="cl-seg cl-label"><span className="cl-lyric">{label.text}</span></span>}
            <button type="button" className="cl-slot cl-slot-empty" data-active={active} aria-pressed={active} aria-label={`Khe trong dòng không lời (dòng ${index + 1}, khe 1)`}
              onClick={() => (active ? pick(null) : (pick({ kind: 'gap', line: index, gap: 0 }), setRestAfterBar(true)))}>＋</button>
          </p>
          {open && selected?.kind === 'gap' && <div className="cl-picker" role="group" aria-label="Đặt hợp âm tại đây">
            <div className="cl-picker-head"><strong>Đoạn không lời — đặt hợp âm tại đây</strong><button type="button" className="cl-link" onClick={() => pick(null)}>Đóng</button></div>
            {chips(applyGap, null)}
            {problem && <p className="cl-error" role="alert">{problem}</p>}
          </div>}
        </div>
      }

      const currentWord = open && selected?.kind === 'word' ? words.find(cell => cell.token === selected.token) : undefined
      const barsHere = open && selected?.kind === 'gap' ? marks.get(keyOf(index, selected.gap)) ?? [] : []
      const gapWhere = open && selected?.kind === 'gap'
        ? (selected.gap === 0 ? 'Đầu dòng' : selected.gap >= count ? 'Cuối dòng' : `Giữa “${wordAt(selected.gap - 1) ?? '·'}” và “${wordAt(selected.gap) ?? '·'}”`)
        : ''

      return <div key={index} className="cl-edit-row">
        <p className="cl-line" data-chords={hasChords}>
          {cells.map((cell, at) => {
            const next = cells[at + 1]
            const tight = next?.kind === 'word' && next.joined
            if (cell.kind === 'label') return <span key={at} className="cl-seg cl-label"><span className="cl-chord">{'\u00a0'}</span><span className="cl-lyric">{cell.text}</span></span>
            if (cell.kind === 'chord') {
              return <span key={at} className="cl-seg cl-orphan"><span className="cl-chord">{cell.chord}</span><span className="cl-lyric">{'\u00a0'}</span></span>
            }
            const active = selected?.kind === 'word' && selected.line === index && selected.token === cell.token
            return <span key={at} className="cl-cell">
              {slot(cell.token, cell.joined)}
              <span className="cl-seg" data-tight={tight}>
                <span className="cl-chord">{cell.chord ?? '\u00a0'}</span>
                <button type="button" className="cl-word" data-active={active} data-has-chord={cell.chord !== null} data-rest={isRest(cell.word)} aria-pressed={active}
                  aria-label={`${cell.chord ? `Đổi hợp âm ${cell.chord} trên chữ ${cell.word}` : `Thêm hợp âm cho chữ ${cell.word}`}${isRest(cell.word) ? ` (dòng ${index + 1}, vị trí ${cell.token + 1})` : ''}`}
                  onClick={() => (active ? pick(null) : pick({ kind: 'word', line: index, token: cell.token }))}>{cell.word}</button>
              </span>
            </span>
          })}
          {slot(count)}
        </p>

        {currentWord && selected?.kind === 'word' && <div className="cl-picker" role="group" aria-label={`Chọn hợp âm cho chữ ${currentWord.word}`}>
          <div className="cl-picker-head">
            <strong>{isRest(currentWord.word) ? 'Vị trí nghỉ (-)' : `Hợp âm cho “${currentWord.word}”`}</strong>
            <button type="button" className="cl-link" onClick={() => pick(null)}>Đóng</button>
          </div>
          {chips(applyWord, currentWord.chord)}
          <div className="cl-picker-row">
            {currentWord.chord && <button type="button" className="cl-secondary" onClick={() => applyWord(null)}>Xoá hợp âm {currentWord.chord}</button>}
            {isRest(currentWord.word) && <button type="button" className="cl-secondary" onClick={removeRestHere}>Xóa vị trí nghỉ{currentWord.chord ? ` (và hợp âm ${currentWord.chord})` : ''}</button>}
          </div>
          {confirmRemove && <div className="cl-warn" role="alert">{confirmRemove} <button type="button" className="cl-secondary" onClick={removeRestHere}>Vẫn xóa</button></div>}
          {problem && <p className="cl-error" role="alert">{problem}</p>}
        </div>}

        {open && selected?.kind === 'gap' && <div className="cl-picker" role="group" aria-label={`Thao tác tại khe: ${gapWhere}`}>
          <div className="cl-picker-head">
            <strong>{gapWhere}</strong>
            <button type="button" className="cl-link" onClick={() => pick(null)}>Đóng</button>
          </div>
          {barsHere.length > 0
            ? <div className="cl-picker-bars">
              {barsHere.map(({ index: at }) => <div key={at} className="cl-picker-bar">
                <span><strong>Vạch ô {at + 1}</strong></span>
                <button type="button" className="cl-secondary" onClick={() => nudge(at, -1)} disabled={!nudgeMeasure(measures, at, -1, counts)} aria-label={`Dịch vạch ô ${at + 1} sang khe trước`}>◀ Khe trước</button>
                <button type="button" className="cl-secondary" onClick={() => nudge(at, 1)} disabled={!nudgeMeasure(measures, at, 1, counts)} aria-label={`Dịch vạch ô ${at + 1} sang khe sau`}>Khe sau ▶</button>
                <button type="button" className="cl-secondary" onClick={() => removeBar(at)} aria-label={`Xóa vạch ô ${at + 1}`}>Xóa vạch</button>
              </div>)}
            </div>
            : <div className="cl-picker-row"><button type="button" className="cl-secondary" onClick={addBar}>｜ Đặt vạch nhịp tại đây</button></div>}
          <p className="cl-picker-sub">Đặt hợp âm tại đây</p>
          {barsHere.length > 0 && <div className="cl-picker-row cl-picker-side" role="radiogroup" aria-label="Vị trí hợp âm so với vạch">
            <label><input type="radio" name="rest-side" checked={restAfterBar} onChange={() => setRestAfterBar(true)} /> Sau vạch</label>
            <label><input type="radio" name="rest-side" checked={!restAfterBar} onChange={() => setRestAfterBar(false)} disabled={selected.gap === 0} /> Trước vạch</label>
          </div>}
          {chips(applyGap, null)}
          {problem && <p className="cl-error" role="alert">{problem}</p>}
        </div>}
      </div>
    })}
  </div>
}
