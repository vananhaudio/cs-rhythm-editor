// Lời + hợp âm dạng chuẩn của Thư viện: "Chiều [Am] nao, tiễn nhau [E7] đi".
// File thuần TS (không React/DOM/Supabase) — dùng chung cho editor, xem thử và test.

export type ChordMeter = { beats: number; beatType: number }

/** Một đoạn của dòng: `chord` đứng TRÊN `text`. `chord: null` = lời trước hợp âm đầu tiên. */
export type ChordSegment = { chord: string | null; text: string }

export type ChordDraft = {
  title: string
  composer: string
  meter: ChordMeter | null
  suggestedBpm: number | null
  text: string
}

export type ChordDraftErrors = Partial<Record<'title' | 'composer' | 'meter' | 'suggestedBpm' | 'text', string>>

export const MAX_TITLE = 200
export const MAX_TEXT = 20000
export const BPM_RANGE = { min: 20, max: 300 } as const
/** Các nhịp cho chọn trong editor; cùng miền giá trị máy chủ nhận (beats 1..32, beatType 1|2|4|8|16). */
export const METER_CHOICES = ['2/4', '3/4', '4/4', '6/8', '9/8', '12/8', '2/2', '3/8', '5/4', '7/8'] as const

// [Am] [E7] [F#m7b5] [C/G]: không khoảng trắng đầu, không xuống dòng, tối đa 16 ký tự.
const CHORD = /\[([^[\]\s][^[\]\n]{0,15})\]/g

/**
 * Cùng phép chuẩn hoá với `chord_canonical_text` ở máy chủ (db/chord_library_v1_setup.sql):
 * NFC, xuống dòng = \n, bỏ khoảng trắng cuối dòng, bỏ dòng trống đầu/cuối.
 */
export function canonicalChordText(text: string): string {
  return text.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[ \t\u00a0]+(\n|$)/g, '$1').replace(/^\n+/, '').replace(/\n+$/, '')
}

export function parseChordLine(line: string): ChordSegment[] {
  const segments: ChordSegment[] = []
  const push = (chord: string | null, text: string) => { if (chord !== null || text) segments.push({ chord, text }) }
  let cursor = 0
  let pending: string | null = null
  CHORD.lastIndex = 0
  for (let match = CHORD.exec(line); match; match = CHORD.exec(line)) {
    push(pending, line.slice(cursor, match.index))
    pending = match[1].trim()
    cursor = match.index + match[0].length
    // "nhau [E7] đi": khoảng trắng trước ngoặc đã tách chữ rồi — bỏ MỘT khoảng trắng sau ngoặc
    // để hợp âm nằm ngay trên chữ nó thuộc về (cả khi đứng liền sau một hợp âm khác: "[Am][E7] hết").
    // "ti[Am]ễn" (giữa chữ) thì giữ nguyên.
    if (line[cursor] === ' ' && (match.index === 0 || /[\s\]]/.test(line[match.index - 1]))) cursor += 1
  }
  push(pending, line.slice(cursor))
  return segments
}

/** Mỗi phần tử = một dòng; dòng trống = mảng rỗng. Nhãn "1." / "ĐK:" đi qua như lời bình thường. */
export function parseChordText(text: string): ChordSegment[][] {
  return canonicalChordText(text).split('\n').map(parseChordLine)
}

/** Các hợp âm xuất hiện trong bài, theo thứ tự gặp lần đầu. */
export function listChords(text: string): string[] {
  const seen = new Set<string>()
  for (const line of parseChordText(text)) for (const segment of line) if (segment.chord) seen.add(segment.chord)
  return [...seen]
}

/** Dòng (đếm từ 1) còn ngoặc vuông không ghép được thành hợp âm — cảnh báo, không chặn lưu. */
export function chordTextIssues(text: string): number[] {
  return canonicalChordText(text).split('\n')
    .map((line, index) => (/[[\]]/.test(line.replace(CHORD, '')) ? index + 1 : 0))
    .filter(Boolean)
}

export function parseMeter(value: string): ChordMeter | null {
  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(value.trim())
  if (!match) return null
  const meter = { beats: Number(match[1]), beatType: Number(match[2]) }
  return meterOk(meter) ? meter : null
}

export const formatMeter = (meter: ChordMeter | null): string => (meter ? `${meter.beats}/${meter.beatType}` : '')

const meterOk = (meter: ChordMeter) =>
  Number.isInteger(meter.beats) && meter.beats >= 1 && meter.beats <= 32 && [1, 2, 4, 8, 16].includes(meter.beatType)

/** Ô BPM là chữ người dùng gõ: rỗng = chưa có; không phải số nguyên = NaN (để validate báo lỗi). */
export function parseBpm(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN
}

/** Cùng luật với RPC `chord_sheet_contribute`, để lỗi hiện ngay tại ô nhập thay vì chờ máy chủ. */
export function validateChordDraft(draft: ChordDraft): ChordDraftErrors {
  const errors: ChordDraftErrors = {}
  const title = draft.title.trim()
  if (!title) errors.title = 'Vui lòng nhập Tên bài.'
  else if (title.length > MAX_TITLE) errors.title = `Tên bài tối đa ${MAX_TITLE} ký tự.`
  if (draft.composer.trim().length > MAX_TITLE) errors.composer = `Tên tác giả tối đa ${MAX_TITLE} ký tự.`
  if (draft.meter && !meterOk(draft.meter)) errors.meter = 'Nhịp không hợp lệ.'
  const bpm = draft.suggestedBpm
  if (bpm !== null && !(Number.isInteger(bpm) && bpm >= BPM_RANGE.min && bpm <= BPM_RANGE.max)) {
    errors.suggestedBpm = `BPM là số nguyên từ ${BPM_RANGE.min} đến ${BPM_RANGE.max}.`
  }
  const text = canonicalChordText(draft.text)
  if (!text.trim()) errors.text = 'Vui lòng nhập lời + hợp âm.'
  else if (text.length > MAX_TEXT) errors.text = `Lời + hợp âm tối đa ${MAX_TEXT} ký tự.`
  return errors
}
