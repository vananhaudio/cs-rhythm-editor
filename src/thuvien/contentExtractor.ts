// Phân tích NỘI DUNG sheet (PDF/ảnh → chữ + hợp âm) — hợp đồng cho UI. Không DOM, không biết Python/Tesseract.
// Chỉ Owner dùng, chạy thẳng trên Mac mini: trang https → worker loopback http://127.0.0.1:7430.
//
// Mọi lời gọi tới worker là POST (service worker của trang chặn GET loopback). JWT lấy từ phiên Supabase,
// chỉ đi tới worker; browser không gửi lời, đường dẫn Storage, byte file, uid hay vai trò.
//  • staged    — file đã nạp vào Storage nhưng CHƯA lưu bài: POST /extract-staged → POST /extract-staged/status (kết quả tạm trong RAM worker).
//  • persisted — phiên bản đã lưu: POST /extract-content → đọc lại kết quả bằng RPC chord_extraction_get.
// Cả hai trả CÙNG một mô hình: { ok:true, document } hoặc { ok:false, error }.

export type ExtractionTarget =
  | { kind: 'staged'; draftId: string; sourceIndex: number; mime: string }
  | { kind: 'persisted'; versionId: string; sourceIndex: number }

export type ExtractionOutcome =
  | { ok: true; document: unknown }
  | { ok: false; error: { code: string; message: string } }

export interface ContentExtractor {
  /** Worker có đang chạy không (POST thăm dò, không đăng nhập, không chạm DB/Storage). */
  available(): Promise<boolean>
  extract(target: ExtractionTarget, signal?: AbortSignal): Promise<ExtractionOutcome>
}

export const DEFAULT_EXTRACT_URL = 'http://127.0.0.1:7430'
const POLL_MS = 1500
const MAX_WAIT_MS = 4 * 60_000

const ERROR_VI: Record<string, string> = {
  unauthorized: 'Cần đăng nhập lại để phân tích.',
  forbidden: 'Tài khoản này không có quyền phân tích.',
  busy: 'Máy phân tích đang bận — thử lại sau ít phút.',
  too_many_jobs: 'Đang có quá nhiều lần phân tích chưa xong — chờ một lát.',
  rate_limited: 'Bấm hơi nhanh — chờ một phút rồi thử lại.',
  source_missing: 'Không tìm thấy file nguồn trên kho — nạp lại file.',
  unsupported_mime: 'Loại file này máy chưa đọc được.',
  bad_request: 'Yêu cầu không hợp lệ.',
  not_found: 'Kết quả đã hết hạn hoặc máy phân tích vừa khởi động lại — bấm Phân tích lại.',
  timeout: 'Phân tích quá lâu nên đã dừng — thử file nhẹ hơn.',
  too_large: 'Kết quả quá lớn để xử lý.',
  abandoned: 'Lần phân tích trước bị bỏ dở — bấm Phân tích lại.',
  unreachable: 'Không gọi được máy phân tích — kiểm tra máy đang chạy.',
  not_configured: 'Máy phân tích chưa bật tính năng này.',
}
const fail = (code: string, message?: string): ExtractionOutcome => ({ ok: false, error: { code, message: message ?? ERROR_VI[code] ?? 'Phân tích không thành công.' } })

type Fetch = typeof fetch
export type ExtractionReader = (extractionId: string) => Promise<unknown>
export type ExtractorOptions = {
  urls?: string[]
  getToken: () => Promise<string | null>
  /** Đọc extraction đã lưu (RPC chord_extraction_get) — chỉ cần cho đường persisted. */
  readExtraction?: ExtractionReader
  fetcher?: Fetch
  sleep?: (ms: number) => Promise<void>
  pollMs?: number
  maxWaitMs?: number
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export function createContentExtractor(options: ExtractorOptions): ContentExtractor {
  const fetcher: Fetch = options.fetcher ?? ((...args) => fetch(...args))
  const sleep = options.sleep ?? wait
  const pollMs = options.pollMs ?? POLL_MS
  const maxWait = options.maxWaitMs ?? MAX_WAIT_MS
  const urls = (options.urls?.length ? options.urls : [DEFAULT_EXTRACT_URL]).map(url => url.replace(/\/$/, ''))
  let base: string | null = null

  async function post(path: string, body: unknown, token: string | null, signal?: AbortSignal, timeoutMs = 20_000): Promise<{ status: number; json: Record<string, unknown> }> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort)
    try {
      const reply = await fetcher(`${base}${path}`, {
        method: 'POST', signal: controller.signal,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      })
      const json = await reply.json().catch(() => ({})) as Record<string, unknown>
      return { status: reply.status, json: json && typeof json === 'object' ? json : {} }
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort) }
  }
  const errorOf = (json: Record<string, unknown>, status: number): ExtractionOutcome => {
    const error = (json.error ?? {}) as { code?: unknown; message?: unknown }
    const code = typeof error.code === 'string' ? error.code : status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : status === 429 ? 'busy' : 'upstream'
    return fail(code, ERROR_VI[code] ? undefined : typeof error.message === 'string' ? error.message : undefined)
  }

  async function probe(): Promise<boolean> {
    for (const url of urls) {
      try {
        base = url
        const { json } = await post('/extract-probe', {}, null, undefined, 2500)
        if (json.ok === true && json.kind === 'chord-extract-worker' && json.schema === 'chord-extraction/1') return true
      } catch { /* thử URL kế */ }
    }
    base = null
    return false
  }

  async function pollUntil(step: () => Promise<ExtractionOutcome | null>, signal?: AbortSignal): Promise<ExtractionOutcome> {
    const started = Date.now()
    for (;;) {
      if (signal?.aborted) return fail('aborted', 'Đã huỷ phân tích.')
      const result = await step()
      if (result) return result
      if (Date.now() - started > maxWait) return fail('timeout')
      await sleep(pollMs)
    }
  }

  return {
    available: probe,
    async extract(target, signal) {
      if (!base && !(await probe())) return fail('unreachable')
      const token = await options.getToken().catch(() => null)
      if (!token) return fail('unauthorized')
      try {
        if (target.kind === 'staged') {
          const start = await post('/extract-staged', { draftId: target.draftId, sourceIndex: target.sourceIndex, mime: target.mime }, token, signal)
          const jobId = start.json.jobId
          if (start.status !== 202 || typeof jobId !== 'string') return errorOf(start.json, start.status)
          return await pollUntil(async () => {
            const reply = await post('/extract-staged/status', { jobId }, token, signal)
            if (reply.status !== 200) return errorOf(reply.json, reply.status)
            if (reply.json.status === 'running') return null
            if (reply.json.status === 'failed') return fail(String(reply.json.errorCode ?? 'internal'))
            if (reply.json.status === 'succeeded' && reply.json.document) return { ok: true, document: reply.json.document }
            return fail('upstream', 'Máy phân tích trả kết quả lạ.')
          }, signal)
        }
        if (!options.readExtraction) return fail('not_configured')
        const start = await post('/extract-content', { versionId: target.versionId, sourceIndex: target.sourceIndex }, token, signal)
        const extractionId = start.json.extractionId
        if ((start.status !== 200 && start.status !== 202) || typeof extractionId !== 'string') return errorOf(start.json, start.status)
        return await pollUntil(async () => {
          const row = await options.readExtraction!(extractionId) as Record<string, unknown> | null
          const status = row?.status
          if (status === 'succeeded' && row?.document) return { ok: true, document: row.document }
          if (status === 'failed') return fail(String(row?.error_code ?? 'internal'))
          return null
        }, signal)
      } catch (cause) {
        if (signal?.aborted) return fail('aborted', 'Đã huỷ phân tích.')
        return fail('unreachable', cause instanceof Error && cause.message === 'CHORDLIB_FORBIDDEN' ? ERROR_VI.forbidden : undefined)
      }
    },
  }
}

/** URL worker cho bản build: `VITE_EXTRACT_WORKER_URLS` (phẩy ngăn cách; `off` = tắt). Không đặt → loopback mặc định. */
export function extractorUrlsFrom(setting: string | undefined): string[] | null {
  const raw = (setting ?? '').trim()
  if (raw.toLowerCase() === 'off') return null
  const urls = raw.split(',').map(part => part.trim()).filter(part => /^https?:\/\/[^/\s]+/.test(part))
  return urls.length ? urls : [DEFAULT_EXTRACT_URL]
}
