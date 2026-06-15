// ============================================================
// Tự nhận hợp âm khi dán lời kèm hợp âm (port từ LyricsChordParser.swift).
// Hỗ trợ 2 định dạng:
//   1) Ngoặc ChordPro:  [Em]Có khi nào [C]em hỏi
//   2) Hợp âm ở dòng TRÊN lời (canh cột):
//          Em            C
//          Có khi nào em hỏi
// Trả: lời SẠCH + danh sách SongChord theo wordIndex (khớp splitWords).
// ============================================================

import type { SongChord } from './songBuilder'

interface LineToken { text: string; start: number; end: number }

const CHORD_RE =
  /^[A-G][#b]?(maj7|maj9|maj|min|sus2|sus4|sus|add9|add11|add|dim7|dim|aug|m|M|\+)?[0-9]*(\/[A-G][#b]?)?$/

export function isChordToken(raw: string): boolean {
  const s = raw.trim()
  if (!s) return false
  return CHORD_RE.test(s)
}

function tokenize(line: string): LineToken[] {
  const out: LineToken[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length })
  }
  return out
}

function isChordOnlyLine(line: string): boolean {
  const toks = tokenize(line)
  if (toks.length === 0) return false
  return toks.every(t => isChordToken(t.text))
}

/** Bỏ [hợp âm] khỏi 1 dòng → lời sạch + (thứ tự từ trong dòng → hợp âm). */
function parseBracketLine(line: string): { clean: string; chords: Array<{ ordinal: number; name: string }> } {
  let clean = ''
  let pending: string | null = null
  let tokenOrdinal = -1
  let inToken = false
  const result: Array<{ ordinal: number; name: string }> = []
  let i = 0
  while (i < line.length) {
    const c = line[i]
    if (c === '[') {
      let name = ''
      i++
      while (i < line.length && line[i] !== ']') { name += line[i]; i++ }
      if (i < line.length) i++ // bỏ ']'
      pending = name.trim()
      continue
    }
    if (/\s/.test(c)) {
      clean += c; inToken = false; i++; continue
    }
    if (!inToken) {
      inToken = true
      tokenOrdinal++
      if (pending) { result.push({ ordinal: tokenOrdinal, name: pending }); pending = null }
    }
    clean += c
    i++
  }
  if (pending && tokenOrdinal >= 0) result.push({ ordinal: tokenOrdinal, name: pending })
  return { clean, chords: result }
}

function wordOrdinalForColumn(col: number, toks: LineToken[]): number | null {
  const inside = toks.findIndex(t => t.start <= col && col < t.end)
  if (inside >= 0) return inside
  const after = toks.findIndex(t => t.start >= col)
  if (after >= 0) return after
  return toks.length ? toks.length - 1 : null
}

/** Có hợp âm nhúng trong lời không (để quyết định tự tách). */
export function hasChordMarkup(raw: string): boolean {
  if (/\[[^\]]+\]/.test(raw)) return true
  const lines = raw.split(/\r?\n/)
  for (let idx = 0; idx < lines.length; idx++) {
    if (!isChordOnlyLine(lines[idx])) continue
    let j = idx + 1
    while (j < lines.length && lines[j].trim() === '') j++
    if (j < lines.length && !isChordOnlyLine(lines[j])) return true
  }
  return false
}

/** Tách lời + hợp âm. */
export function parseLyricsWithChords(raw: string): { lyrics: string; chords: SongChord[] } {
  const lines = raw.split(/\r?\n/)
  const cleanLines: string[] = []
  const chords: SongChord[] = []
  let wordBase = 0
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // Định dạng 2: dòng toàn hợp âm + dòng lời ngay dưới
    if (isChordOnlyLine(line)) {
      let j = i + 1
      while (j < lines.length && lines[j].trim() === '') j++
      if (j < lines.length && !isChordOnlyLine(lines[j])) {
        const chordToks = tokenize(line)
        const { clean: cleanLyric, chords: inlineChords } = parseBracketLine(lines[j])
        const lyricToks = tokenize(cleanLyric)
        if (lyricToks.length) {
          for (const ct of chordToks) {
            const ord = wordOrdinalForColumn(ct.start, lyricToks)
            if (ord !== null) chords.push({ wordIndex: wordBase + ord, name: ct.text })
          }
        }
        for (const ic of inlineChords) chords.push({ wordIndex: wordBase + ic.ordinal, name: ic.name })
        cleanLines.push(cleanLyric)
        wordBase += lyricToks.length
        i = j + 1
        continue
      }
    }
    // Định dạng 1 (hoặc dòng thường): bỏ [hợp âm]
    const { clean, chords: inlineChords } = parseBracketLine(line)
    for (const ic of inlineChords) chords.push({ wordIndex: wordBase + ic.ordinal, name: ic.name })
    cleanLines.push(clean)
    wordBase += tokenize(clean).length
    i++
  }
  // mỗi từ giữ 1 hợp âm (ưu tiên cái đầu theo wordIndex)
  const seen = new Set<number>()
  const deduped: SongChord[] = []
  for (const ch of [...chords].sort((a, b) => a.wordIndex - b.wordIndex)) {
    if (!seen.has(ch.wordIndex)) { seen.add(ch.wordIndex); deduped.push(ch) }
  }
  return { lyrics: cleanLines.join('\n'), chords: deduped }
}
