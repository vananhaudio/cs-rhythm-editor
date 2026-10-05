// Phân tích vạch nhịp TỰ ĐỘNG — hợp đồng (Slice 5B, POC). Không phụ thuộc DOM, không biết Python/OpenCV.
// UI chỉ thấy interface MeasureAnalyzer; bản dev nối tới analyzer cục bộ, sau này thay bằng worker/cloud mà UI không đổi.
//
// QUAN TRỌNG: `anchors` dùng ĐÚNG contract 5A ({pickup?, measures}) — confidence/review/diagnostics là kết quả TẠM
// của lần phân tích, KHÔNG bao giờ nằm trong anchors gửi máy chủ.
import { anchorLines, parseAnchors } from './chordAnchors.ts'
import type { ChordAnchors } from './chordAnchors.ts'

export type AnalysisConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

export type MeasureAnalysisInput = {
  /** File sheet nguồn: PNG/JPEG/WebP; PDF nếu analyzer rasterize được. */
  files: { name: string; mime: string; data: Blob }[]
  /** Lời + hợp âm CHUẨN của phiên bản — token hoá bằng tokenizer của app (analysisLineCounts), không tách lại nơi khác. */
  text: string
  meter: { beats: number; beatType: number } | null
  /** Chỉ để truy vết cục bộ. */
  traceId?: string
}

export type MeasureConfidence = { measure: number; confidence: AnalysisConfidence; score: number; reasons: string[]; boundary?: number }

export type MeasureAnalysisResult =
  | {
    ok: true
    anchors: ChordAnchors
    confidence: { overall: AnalysisConfidence; measures: MeasureConfidence[] }
    review: { needsReview: boolean; measures: number[]; notes: string[] }
    diagnostics: {
      engine: string
      pages: number
      systems: { page: number; index: number; bars: number[]; words: number; splitWords: number }[]
      boundaries: { index: number; system: number; x: number; token: number; confidence: AnalysisConfidence; reasons: string[] }[]
      sheetTokens: number
      canonicalTokens: number
      pickupDetected: boolean
      warnings: { code: string; message: string }[]
    }
  }
  | { ok: false; error: { code: string; message: string } }

export interface MeasureAnalyzer {
  /** Analyzer có sẵn sàng không (vd. cầu cục bộ đang chạy). */
  available(): Promise<boolean>
  analyze(input: MeasureAnalysisInput): Promise<MeasureAnalysisResult>
}

/** Số chữ hát mỗi dòng — thứ DUY NHẤT analyzer cần biết về lời (cùng tokenizer với accept_anchors). */
export const analysisLineCounts = (text: string): number[] => anchorLines(text).map(line => line.tokens.length)
/** Độ dài (số chữ cái/số) từng token — để analyzer căn chỉnh cụm mực trên sheet với token theo ĐỘ RỘNG, không đếm dồn.
 *  Chỉ gửi con số, không gửi chữ. Token chỉ có hợp âm (không chữ) = 1. */
export const analysisTokenLengths = (text: string): number[][] =>
  anchorLines(text).map(line => line.tokens.map(token => [...token.word.normalize('NFC')].filter(ch => /[\p{L}\p{N}]/u.test(ch)).length || 1))

const LEVELS = new Set(['HIGH', 'MEDIUM', 'LOW'])

/** Đọc kết quả analyzer trả về; anchors phải hợp lệ theo ĐÚNG lời hiện tại, không thì coi là lỗi (không nạp vào editor). */
export function parseAnalysisResult(raw: unknown, text: string): MeasureAnalysisResult {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (data.ok !== true) {
    const error = (data.error ?? {}) as { code?: unknown; message?: unknown }
    return { ok: false, error: { code: String(error.code ?? 'analyzer_failed'), message: String(error.message ?? 'Phân tích không thành công.') } }
  }
  const anchors = parseAnchors(data.anchors, text)
  if (!anchors) return { ok: false, error: { code: 'invalid_anchors', message: 'Kết quả phân tích không khớp lời hiện tại.' } }
  const confidence = data.confidence as { overall?: unknown; measures?: unknown } | undefined
  const review = data.review as { needsReview?: unknown; measures?: unknown; notes?: unknown } | undefined
  const measures = Array.isArray(confidence?.measures) ? confidence.measures as MeasureConfidence[] : []
  return {
    ok: true,
    // chỉ đúng 2 khoá — không để lọt trường lạ (confidence…) vào bộ vạch
    anchors: { ...(anchors.pickup ? { pickup: { line: anchors.pickup.line, token: anchors.pickup.token } } : {}), measures: anchors.measures.map(a => ({ line: a.line, token: a.token })) },
    confidence: {
      overall: LEVELS.has(String(confidence?.overall)) ? confidence!.overall as AnalysisConfidence : 'LOW',
      measures: measures.filter(m => m && LEVELS.has(m.confidence)),
    },
    review: {
      needsReview: review?.needsReview !== false,
      measures: Array.isArray(review?.measures) ? (review!.measures as unknown[]).filter((n): n is number => Number.isInteger(n)) : [],
      notes: Array.isArray(review?.notes) ? (review!.notes as unknown[]).map(String) : [],
    },
    diagnostics: data.diagnostics as Extract<MeasureAnalysisResult, { ok: true }>['diagnostics'],
  }
}

const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let text = ''
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(text)
}

/** Analyzer qua HTTP (POST /analyze, GET /health). Dev: cầu cục bộ; sau này: worker/cloud — UI không đổi. */
export function createHttpMeasureAnalyzer(baseUrl: string, fetcher: typeof fetch = (...args) => fetch(...args)): MeasureAnalyzer {
  return {
    async available() {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 1500)
        const reply = await fetcher(`${baseUrl}/health`, { signal: controller.signal })
        clearTimeout(timer)
        return reply.ok && (await reply.json() as { ok?: boolean }).ok === true
      } catch { return false }
    },
    async analyze(input) {
      let raw: unknown
      try {
        const reply = await fetcher(`${baseUrl}/analyze`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            files: await Promise.all(input.files.map(async file => ({ mime: file.mime, base64: await toBase64(file.data) }))),
            lineTokenCounts: analysisLineCounts(input.text), lineTokenLengths: analysisTokenLengths(input.text), meter: input.meter, traceId: input.traceId ?? null,
          }),
        })
        raw = await reply.json()
      } catch (cause) {
        return { ok: false, error: { code: 'unreachable', message: `Không gọi được bộ phân tích: ${cause instanceof Error ? cause.message : String(cause)}` } }
      }
      return parseAnalysisResult(raw, input.text)
    },
  }
}
