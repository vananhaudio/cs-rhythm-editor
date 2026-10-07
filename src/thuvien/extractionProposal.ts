// Đề xuất từ kết quả phân tích sheet (chord-extraction/1) — HÀM THUẦN, không DOM, không mạng.
// Máy CHỈ đề xuất: không suy hợp âm không có trên trang, không đoán nhịp/tông, không tự lưu/duyệt.
// Mọi cảnh báo bằng tiếng Việt để thầy đọc thẳng.

export type ProposalWarning = { code: string; message: string }

export type ExtractionProposal = {
  /** Bản nháp dạng `[Am]` — rỗng nếu máy không đọc được chữ nào. */
  text: string
  title: string | null
  author: string | null
  bpm: number | null
  /** Máy không đọc được nhịp/tông từ bản in — luôn báo để thầy tự chọn. */
  meterReadable: boolean
  chords: 'DETECTED' | 'NO_CHORDS_DETECTED' | 'UNKNOWN'
  chordCount: number
  /** Đọc từ lớp chữ của PDF, từ OCR, hay lẫn cả hai (Vision không bật ở bản này). */
  reading: 'text_layer' | 'ocr' | 'mixed' | 'vision' | 'unknown'
  pageCount: number
  lowConfidence: boolean
  warnings: ProposalWarning[]
}

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const fieldValue = (f: unknown): unknown => obj(f).value

const CHORD_MARK = /\[[^\]]*\]/g
const plain = (line: string) => line.replace(CHORD_MARK, ' ').replace(/\s+/g, ' ').trim().toLowerCase()

const WARNING_VI: Record<string, string> = {
  TITLE_NOT_FOUND: 'Máy không nhận ra tiêu đề trên trang đầu — thầy nhập tay.',
  NO_CHORDS_DETECTED: 'Máy không thấy hợp âm in trên sheet. Chỉ có lời được điền — thầy tự thêm hợp âm, máy không đoán.',
  LOW_OCR_CONFIDENCE: 'Chữ nhận dạng chưa chắc — đọc lại kỹ từng dòng.',
  HIGH_NOISE_RATIO: 'Sheet nhiều nhiễu (nét mờ, nền bẩn) — có thể sai chữ.',
  STAFF_LYRIC_MISMATCH: 'Số chữ lời không khớp khuông nhạc — kiểm tra chỗ ngắt dòng.',
  METADATA_MISSING: 'Thiếu thông tin đầu bài (tiêu đề/tác giả).',
  NO_TEXT_RECOGNIZED: 'Máy không đọc được chữ nào trên sheet này.',
  USER_REQUESTED: 'Phân tích theo yêu cầu của thầy.',
}
const messageOf = (w: unknown): ProposalWarning | null => {
  const o = obj(w)
  const code = str(o.code)
  if (!code) return null
  return { code, message: WARNING_VI[code] ?? str(o.message) ?? code }
}

/** Gộp chữ nhận từ nhiều tờ (đúng thứ tự thầy đã xếp) thành MỘT đề xuất. `documents[i]` ứng với nguồn thứ i. */
export function buildProposal(documents: unknown[]): ExtractionProposal {
  const warnings: ProposalWarning[] = []
  const seen = new Set<string>()
  const push = (w: ProposalWarning | null) => { if (w && !seen.has(w.code)) { seen.add(w.code); warnings.push(w) } }

  let title: string | null = null
  let author: string | null = null
  let bpm: number | null = null
  const bodies: string[] = []
  let chordCount = 0
  let pageCount = 0
  let lowConfidence = false
  const sources = new Set<string>()
  const chordStatus: string[] = []
  const titleSeen: string[] = []

  documents.forEach((raw, index) => {
    const doc = obj(raw)
    const interp = obj(doc.interpretation)
    const meta = obj(interp.metadata)
    const draft = obj(interp.draft)
    const chords = obj(interp.chords)
    const pipeline = obj(doc.pipeline)

    pageCount += Number(obj(doc.input).pageCount) || arr(doc.pages).length
    chordStatus.push(String(chords.status ?? 'UNKNOWN'))
    chordCount += Number(chords.count) || 0
    if (arr(pipeline.fallbackReasons).length) lowConfidence = true
    for (const page of arr(doc.pages)) for (const region of arr(obj(page).regions)) for (const line of arr(obj(region).lines))
      for (const token of arr(obj(line).tokens)) { const s = str(obj(token).source); if (s) sources.add(s) }

    // Tiêu đề/tác giả/BPM: lấy từ tờ ĐẦU TIÊN có; tờ sau mâu thuẫn → báo, không âm thầm ghi đè.
    const t = str(fieldValue(meta.title))
    if (t) { if (title && plain(t) !== plain(title)) push({ code: 'TITLE_CONFLICT', message: `Tờ ${index + 1} có tiêu đề khác (“${t}”) — giữ tiêu đề tờ đầu.` }); title ??= t; titleSeen.push(t) }
    const a = str(fieldValue(meta.author))
    if (a) { if (author && plain(a) !== plain(author)) push({ code: 'AUTHOR_CONFLICT', message: `Tờ ${index + 1} có tác giả khác (“${a}”) — giữ tác giả tờ đầu.` }); author ??= a }
    const b = fieldValue(meta.bpm)
    if (typeof b === 'number' && Number.isInteger(b) && b >= 30 && b <= 240) { if (bpm !== null && bpm !== b) push({ code: 'BPM_CONFLICT', message: `Tờ ${index + 1} ghi tốc độ khác (${b}) — giữ ${bpm}.` }); bpm ??= b }

    for (const w of arr(draft.warnings)) push(messageOf(w))
    const text = typeof draft.text === 'string' ? draft.text : ''
    // Bỏ dòng đầu nếu CHÍNH LÀ tiêu đề (máy nhận tiêu đề nhưng vẫn để dòng đó trong lời).
    const lines = text.split('\n')
    const own = str(fieldValue(meta.title))
    if (own) {
      const at = lines.findIndex(line => line.trim() !== '')
      if (at >= 0 && plain(lines[at]) === plain(own)) lines.splice(at, 1)
    }
    const body = lines.join('\n').replace(/^\n+|\n+$/g, '')
    if (body.trim()) bodies.push(body)
  })

  const detected = chordStatus.filter(s => s === 'DETECTED').length
  const chordsOverall: ExtractionProposal['chords'] = !chordStatus.length ? 'UNKNOWN'
    : detected > 0 ? 'DETECTED' : chordStatus.every(s => s === 'NO_CHORDS_DETECTED') ? 'NO_CHORDS_DETECTED' : 'UNKNOWN'
  if (detected > 0 && detected < chordStatus.length) push({ code: 'CHORDS_PARTIAL', message: 'Chỉ một số tờ có hợp âm — kiểm tra các tờ còn lại.' })
  if (chordsOverall === 'NO_CHORDS_DETECTED') push({ code: 'NO_CHORDS_DETECTED', message: WARNING_VI.NO_CHORDS_DETECTED })
  if (!title) push({ code: 'TITLE_NOT_FOUND', message: WARNING_VI.TITLE_NOT_FOUND })
  if (lowConfidence) push({ code: 'LOW_CONFIDENCE', message: 'Máy báo độ tin cậy thấp ở một số chỗ — đọc lại kỹ trước khi dùng.' })
  // Hợp âm mồ côi: có hợp âm nhưng bản nháp không mang dấu [..] nào → hợp âm không được gắn vào lời, không tự gắn.
  const text = bodies.join('\n\n')
  const attached = (text.match(CHORD_MARK) ?? []).length
  if (chordCount > 0 && attached < chordCount) {
    push({ code: 'ORPHAN_CHORDS', message: `Máy thấy ${chordCount} hợp âm nhưng chỉ gắn được ${attached} vào lời; phần còn lại KHÔNG tự gắn — thầy thêm tay.` })
  }
  if (!text.trim()) push({ code: 'NO_TEXT_RECOGNIZED', message: WARNING_VI.NO_TEXT_RECOGNIZED })
  push({ code: 'METER_UNREADABLE', message: 'Máy không đọc được nhịp (2/4, 3/4, 4/4, 6/8) từ bản in — thầy tự chọn Nhịp.' })

  const reading: ExtractionProposal['reading'] = sources.size === 0 ? 'unknown'
    : sources.has('vision') ? 'vision'
      : sources.has('ocr') && sources.has('text_layer') ? 'mixed'
        : sources.has('ocr') ? 'ocr' : 'text_layer'

  return { text, title, author, bpm, meterReadable: false, chords: chordsOverall, chordCount, reading, pageCount, lowConfidence, warnings }
}

export type AdoptInput = { title: string; composer: string; bpm: string; text: string }
/** Áp đề xuất vào form: lời LUÔN thay (đã được thầy xác nhận ở UI nếu ô đang có nội dung); tên/tác giả/BPM chỉ khi ô trống. */
export function applyProposal(form: AdoptInput, proposal: ExtractionProposal): AdoptInput {
  return {
    text: proposal.text.trim() ? proposal.text : form.text,
    title: form.title.trim() ? form.title : proposal.title ?? form.title,
    composer: form.composer.trim() ? form.composer : proposal.author ?? form.composer,
    bpm: form.bpm.trim() ? form.bpm : proposal.bpm !== null ? String(proposal.bpm) : form.bpm,
  }
}
/** Ô lời đang có nội dung đáng kể (cần hỏi trước khi ghi đè). */
export const hasSubstantialText = (text: string): boolean => text.replace(/\s+/g, '').length >= 20
