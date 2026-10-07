// Phân tích vạch nhịp TỰ ĐỘNG — hợp đồng (Slice 5B, POC). Không phụ thuộc DOM, không biết Python/OpenCV.
// UI chỉ thấy interface MeasureAnalyzer; bản dev nối tới analyzer cục bộ, sau này thay bằng worker/cloud mà UI không đổi.
//
// QUAN TRỌNG: `anchors` dùng ĐÚNG contract 5A ({pickup?, measures}) — confidence/review/diagnostics là kết quả TẠM
// của lần phân tích, KHÔNG bao giờ nằm trong anchors gửi máy chủ.
import { anchorLines, parseAnchors } from './chordAnchors.ts'
import type { ChordAnchors } from './chordAnchors.ts'

export type AnalysisConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

export type MeasureAnalysisInput = {
  /** Phiên bản cần phân tích — worker production CHỈ nhận trường này, tự lấy lời + nguồn từ DB bằng JWT người gọi. */
  versionId: string
  /** Tải file sheet nguồn (PNG/JPEG/WebP/PDF) — chỉ adapter dev/cục bộ gọi; production không gửi byte file từ browser. */
  loadFiles: () => Promise<{ name: string; mime: string; data: Blob }[]>
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
/** Các chữ hát CHUẨN từng dòng (đúng tokenizer của app, chỉ số = {line, token}). CHỈ worker/test dùng để ghép với OCR lời gần đúng trên
 *  sheet — browser KHÔNG gửi lời cho worker; worker tự lấy lời từ DB bằng JWT. Không được ghi log. */
export const analysisLineWords = (text: string): string[][] => anchorLines(text).map(line => line.tokens.map(token => token.word))
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

/** Analyzer DEV qua cầu cục bộ (POST /analyze kèm byte file + số chữ). CHỈ trang thử dùng — production dùng createWorkerMeasureAnalyzer. */
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
            files: await Promise.all((await input.loadFiles()).map(async file => ({ mime: file.mime, base64: await toBase64(file.data) }))),
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

/**
 * Analyzer PRODUCTION: worker riêng (Mac mini / sau này cloud) — POST /analyze-measures { versionId } kèm
 * Authorization: Bearer <JWT phiên hiện tại>. Browser KHÔNG gửi lời, đường dẫn, byte file, uid hay vai trò:
 * worker tự xác thực + kiểm quyền review + đọc phiên bản/nguồn private bằng chính JWT đó.
 * Không phân tích được (offline, hết phiên, lỗi) → ok:false; trình sửa thủ công vẫn dùng bình thường.
 */
export function createWorkerMeasureAnalyzer(baseUrl: string, getToken: () => Promise<string | null>, fetcher: typeof fetch = (...args) => fetch(...args)): MeasureAnalyzer {
  const base = baseUrl.replace(/\/$/, '')
  return {
    async available() {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 3000)
        // POST (không GET): service worker của trang chặn GET tới loopback. Probe không cần đăng nhập, không chạm DB/Storage.
        const reply = await fetcher(`${base}/extract-probe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: controller.signal })
        clearTimeout(timer)
        const body = await reply.json() as { ok?: boolean; kind?: string }
        return reply.ok && body.ok === true && body.kind === 'chord-extract-worker'
      } catch { return false }
    },
    async analyze(input) {
      const token = await getToken().catch(() => null)
      if (!token) return { ok: false, error: { code: 'unauthorized', message: 'Cần đăng nhập lại để phân tích.' } }
      let raw: unknown
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 40_000)
        const reply = await fetcher(`${base}/analyze-measures`, {
          method: 'POST', signal: controller.signal,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ versionId: input.versionId }),
        })
        clearTimeout(timer)
        raw = await reply.json().catch(() => ({ ok: false, error: { code: 'upstream', message: `Máy phân tích trả ${reply.status}.` } }))
      } catch {
        return { ok: false, error: { code: 'unreachable', message: 'Không gọi được máy phân tích — vẫn đặt vạch thủ công được.' } }
      }
      return parseAnalysisResult(raw, input.text)
    },
  }
}

/** Analyzer cho bản build: https (worker có tên miền) HOẶC loopback http (worker chạy ngay trên máy của Owner, vd. http://127.0.0.1:7430).
 *  Không có / `off` / địa chỉ http không phải loopback → undefined (nút Phân tích vạch nhịp khoá). */
export function productionMeasureAnalyzer(url: string | undefined, getToken: () => Promise<string | null>): MeasureAnalyzer | undefined {
  const ok = !!url && (/^https:\/\/[^/\s]+/.test(url) || /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/.test(url))
  return ok ? createWorkerMeasureAnalyzer(url!, getToken) : undefined
}
