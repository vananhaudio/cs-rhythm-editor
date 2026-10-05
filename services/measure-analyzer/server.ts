// Measure Analyzer — WORKER PRODUCTION (Slice 5C). Chạy trên Mac mini sau Tailscale Funnel; bind 127.0.0.1.
//
//   GET  /health            → { ok, version, python, poppler }
//   POST /analyze-measures  → { versionId }  (Authorization: Bearer <JWT Supabase của người dùng>)
//
// Chuỗi xác thực — worker KHÔNG tin bất cứ thứ gì browser khai:
//   JWT → /auth/v1/user (chính token) → RPC my_chordlib_caps (chính token, bắt buộc review)
//   → RPC chord_sheet_get(versionId) (chính token) → tải file nguồn private bằng CHÍNH token (policy Storage quyết)
//   → tokenizer của app → Python analyzer → MeasureAnalysisResult.
// Không service-role key (chỉ anon key — vốn công khai). Không ghi DB, không gọi accept_anchors: ANALYZE ≠ ACCEPT.
// Không ghi log JWT / lời / byte file / URL / đường dẫn nguồn.
import { execFile, spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { appendFile, mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { IncomingMessage, Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { analysisLineCounts, analysisTokenLengths, parseAnalysisResult } from '../../src/thuvien/measureAnalysis.ts'

export const VERSION = 'measure-analyzer/0.2.0'
const BUCKET = 'chord-sheet-sources'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
// đường dẫn nguồn hợp lệ — đúng khuôn policy/N1: {uid}/{version_id}/{0-9}.{ext}. Chỉ dùng làm KHOÁ Storage, không làm đường dẫn đĩa.
const SOURCE_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9]\.(pdf|jpg|jpeg|png|webp)$/
const MIME_EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export const LIMITS = {
  maxSources: 10, maxFileBytes: 20 * 1024 * 1024, maxBodyBytes: 4096,
  requestTimeoutMs: 30_000, maxConcurrent: 2, maxQueue: 3,
  perMinute: 10, perDay: 100, maxRssBytes: 1024 * 1024 * 1024, logRotateBytes: 5 * 1024 * 1024,
}

export type WorkerConfig = {
  supabaseUrl: string
  anonKey: string
  python: string
  analyzer: string
  allowedOrigins: string[]
  logDir: string
  /** PATH cho tiến trình con (để thấy pdftoppm/pdfinfo/pdfimages của Homebrew) */
  childPath?: string
  /** Thư mục gốc cho thư mục tạm mỗi request (test kiểm dọn dẹp) */
  tempRoot?: string
  limits?: Partial<typeof LIMITS>
  now?: () => number
}

class HttpError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code }
}

// mã lỗi của analyzer → HTTP
const STATUS_OF: Record<string, number> = {
  too_large: 413, bad_pdf: 422, unsupported: 422, no_staff: 422, no_pages: 422, no_lyrics: 422,
  analysis_failed: 422, analyzer_crash: 422, invalid_anchors: 422, timeout: 504,
}
const PUBLIC_MESSAGES: Record<string, string> = {
  too_large: 'File quá lớn hoặc quá nhiều trang.', bad_pdf: 'Không đọc được file PDF.', unsupported: 'Không đọc được file nguồn.',
  no_staff: 'Không tìm thấy khuông nhạc nào.', no_pages: 'Không có trang nào để phân tích.', no_lyrics: 'Lời chuẩn không có chữ hát.',
  timeout: 'Hết thời gian phân tích.', invalid_anchors: 'Kết quả phân tích không khớp lời hiện tại.',
}
const publicMessage = (code: string) => PUBLIC_MESSAGES[code] ?? 'Phân tích không thành công.'
const analyzerError = (code: string) => {
  const known = STATUS_OF[code]
  const mapped = known ? (code === 'analyzer_crash' || code === 'invalid_anchors' || code.startsWith('no_') ? 'analysis_failed' : code) : 'analysis_failed'
  return new HttpError(known ?? 422, mapped, publicMessage(code))
}

export function createWorker(config: WorkerConfig): Server {
  const limits = { ...LIMITS, ...config.limits }
  const now = config.now ?? Date.now
  const minute = new Map<string, number[]>()
  const day = new Map<string, number[]>()
  let running = 0
  const waiting: (() => void)[] = []
  let versions: Promise<{ python: string; poppler: string }> | null = null

  const health = () => versions ??= Promise.all([
    run(config.python, ['--version'], config.childPath).then(text => text.trim().split('\n')[0] || 'unknown', () => 'missing'),
    run('pdftoppm', ['-v'], config.childPath).then(text => text.trim().split('\n')[0] || 'unknown', () => 'missing'),
  ]).then(([python, poppler]) => ({ python, poppler }))

  async function acquire() {
    if (running < limits.maxConcurrent) { running += 1; return }
    if (waiting.length >= limits.maxQueue) throw new HttpError(429, 'busy', 'Máy phân tích đang bận — thử lại sau ít phút.')
    await new Promise<void>(resolve => waiting.push(resolve))
    running += 1
  }
  const release = () => { running -= 1; waiting.shift()?.() }

  function rateLimit(uid: string) {
    const t = now()
    const keep = (map: Map<string, number[]>, window: number) => { const list = (map.get(uid) ?? []).filter(x => t - x < window); map.set(uid, list); return list }
    const m = keep(minute, 60_000), d = keep(day, 86_400_000)
    if (m.length >= limits.perMinute || d.length >= limits.perDay) throw new HttpError(429, 'rate_limited', 'Phân tích quá nhiều lần — thử lại sau.')
    m.push(t); d.push(t)
  }

  async function upstream(path: string, token: string, signal: AbortSignal, body?: unknown): Promise<Response> {
    try {
      return await fetch(`${config.supabaseUrl}${path}`, {
        method: body === undefined ? 'GET' : 'POST', signal, redirect: 'error',
        headers: { apikey: config.anonKey, authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      if (signal.aborted) throw new HttpError(504, 'timeout', 'Hết thời gian phân tích.')
      throw new HttpError(502, 'upstream', 'Không kết nối được máy chủ dữ liệu.')
    }
  }

  async function analyzeRequest(req: IncomingMessage, log: Record<string, unknown>, signal: AbortSignal) {
    const token = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(req.headers.authorization ?? '')?.[1]
    if (!token) throw new HttpError(401, 'unauthorized', 'Cần đăng nhập.')
    const body = await readBody(req, limits.maxBodyBytes)
    let parsed: unknown
    try { parsed = JSON.parse(body) } catch { throw new HttpError(400, 'bad_request', 'Yêu cầu không hợp lệ.') }
    const keys = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed) : null
    const versionId = (parsed as { versionId?: unknown } | null)?.versionId
    // chỉ đúng { versionId } — không nhận đường dẫn, lời, file, uid, vai trò từ browser
    if (!keys || keys.length !== 1 || keys[0] !== 'versionId' || typeof versionId !== 'string' || !UUID.test(versionId)) {
      throw new HttpError(400, 'bad_request', 'Chỉ nhận { versionId } dạng UUID.')
    }
    log.versionId = versionId

    // 1) xác thực bằng chính Supabase Auth
    const user = await upstream('/auth/v1/user', token, signal)
    if (user.status === 401 || user.status === 403) throw new HttpError(401, 'unauthorized', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.')
    if (!user.ok) throw new HttpError(502, 'upstream', 'Không xác thực được phiên đăng nhập.')
    const uid = String(((await user.json().catch(() => ({}))) as { id?: unknown }).id ?? '')
    if (!UUID.test(uid)) throw new HttpError(401, 'unauthorized', 'Phiên đăng nhập không hợp lệ.')
    log.uidHash = createHash('sha256').update(uid).digest('hex').slice(0, 12)
    rateLimit(uid)

    // 2) quyền review — DB quyết (chordlib_can)
    const caps = await upstream('/rest/v1/rpc/my_chordlib_caps', token, signal, {})
    if (caps.status === 401) throw new HttpError(401, 'unauthorized', 'Phiên đăng nhập không hợp lệ.')
    if (!caps.ok) throw new HttpError(502, 'upstream', 'Không đọc được quyền.')
    const capsBody = await caps.json().catch(() => ({})) as { caps?: { review?: unknown } }
    if (capsBody.caps?.review !== true) throw new HttpError(403, 'forbidden', 'Chỉ người duyệt Hợp âm chuẩn hóa mới phân tích được.')

    await acquire()
    let dir: string | null = null
    try {
      // 3) phiên bản + nguồn + lời CHỈ từ DB
      const got = await upstream('/rest/v1/rpc/chord_sheet_get', token, signal, { p_version_id: versionId })
      if (!got.ok) {
        const text = await got.text().catch(() => '')
        if (/CHORDLIB_NOT_FOUND/.test(text) || got.status === 404) throw new HttpError(404, 'not_found', 'Không tìm thấy phiên bản này.')
        if (/CHORDLIB_FORBIDDEN/.test(text) || got.status === 403 || got.status === 401) throw new HttpError(403, 'forbidden', 'Không có quyền với phiên bản này.')
        throw new HttpError(502, 'upstream', 'Không đọc được phiên bản.')
      }
      const detail = await got.json().catch(() => ({})) as { text?: unknown; meter?: unknown; sources?: unknown }
      const text = typeof detail.text === 'string' ? detail.text : ''
      const sources = Array.isArray(detail.sources) ? detail.sources as { path?: unknown; mime?: unknown; size_bytes?: unknown }[] : []
      log.sourceCount = sources.length
      if (!sources.length) throw new HttpError(404, 'source_missing', 'Phiên bản này chưa có sheet nguồn.')
      if (sources.length > limits.maxSources) throw new HttpError(413, 'too_large', `Tối đa ${limits.maxSources} file nguồn.`)
      for (const source of sources) {
        if (typeof source.path !== 'string' || !SOURCE_PATH.test(source.path) || typeof source.mime !== 'string' || !MIME_EXT[source.mime]) {
          throw new HttpError(422, 'unsupported', 'File nguồn không đúng khuôn.')
        }
        if (typeof source.size_bytes === 'number' && source.size_bytes > limits.maxFileBytes) throw new HttpError(413, 'too_large', 'File nguồn lớn hơn 20 MB.')
      }

      // 4) tải file private bằng chính token; tên file tạm do worker đặt ({thứ tự}.{đuôi theo mime})
      dir = await mkdtemp(join(config.tempRoot ?? tmpdir(), 'measure-analyzer-'))
      const files = []
      for (const [index, source] of sources.entries()) {
        const key = (source.path as string).split('/').map(encodeURIComponent).join('/')
        const reply = await upstream(`/storage/v1/object/authenticated/${BUCKET}/${key}`, token, signal)
        if (reply.status === 404 || reply.status === 400) throw new HttpError(404, 'source_missing', 'Không tìm thấy file nguồn.')
        if (reply.status === 401 || reply.status === 403) throw new HttpError(403, 'forbidden', 'Không có quyền đọc file nguồn.')
        if (!reply.ok || !reply.body) throw new HttpError(502, 'upstream', 'Không tải được file nguồn.')
        const path = join(dir, `${index}.${MIME_EXT[source.mime as string]}`)
        await writeFile(path, await readCapped(reply, limits.maxFileBytes, signal))
        files.push({ path, mime: source.mime })
      }

      // 5) phân tích — tokenizer của app (5A/5B) trên lời chuẩn lấy từ DB
      const raw = await runAnalyzer(config, limits, {
        sources: files, lineTokenCounts: analysisLineCounts(text), lineTokenLengths: analysisTokenLengths(text),
        meter: detail.meter ?? null, traceId: versionId,
      }, signal) as { ok?: unknown; error?: { code?: unknown }; diagnostics?: { generator?: unknown } }
      if (raw.ok !== true) throw analyzerError(String(raw.error?.code ?? 'analysis_failed'))
      const result = parseAnalysisResult(raw, text)
      if (!result.ok) throw analyzerError(result.error.code)
      const d = result.diagnostics as unknown as { pages?: number; systems?: unknown[]; boundaries?: unknown[] }
      const generator = typeof raw.diagnostics?.generator === 'string' ? raw.diagnostics.generator : VERSION
      Object.assign(log, {
        pageCount: d.pages, systemsFound: d.systems?.length, barlinesFound: d.boundaries?.length,
        high: result.confidence.measures.filter(m => m.confidence === 'HIGH').length,
        medium: result.confidence.measures.filter(m => m.confidence === 'MEDIUM').length,
        low: result.confidence.measures.filter(m => m.confidence === 'LOW').length,
        reordered: result.review.notes.some(note => note.startsWith('Đã xếp lại thứ tự trang')),
      })
      return { ...result, diagnostics: { ...result.diagnostics, generator, worker: VERSION } }
    } finally {
      release()
      if (dir) await rm(dir, { recursive: true, force: true })
    }
  }

  async function writeLog(entry: Record<string, unknown>) {
    try {
      await mkdir(config.logDir, { recursive: true })
      const file = join(config.logDir, 'requests.log')
      if ((await stat(file).then(s => s.size, () => 0)) > limits.logRotateBytes) await rename(file, `${file}.1`)
      await appendFile(file, `${JSON.stringify(entry)}\n`)
    } catch { /* log hỏng không được làm hỏng phân tích */ }
  }

  return createServer(async (req, res) => {
    const requestId = randomUUID()
    const started = now()
    const path = (req.url ?? '').split('?')[0]
    const log: Record<string, unknown> = { requestId, generatorVersion: VERSION, path }
    const origin = req.headers.origin
    const allowed = !!origin && config.allowedOrigins.includes(origin)
    if (allowed) { res.setHeader('access-control-allow-origin', origin); res.setHeader('vary', 'origin') }
    const send = (status: number, body: unknown) => {
      if (res.headersSent) return res.end()
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-request-id': requestId, 'x-content-type-options': 'nosniff' })
      res.end(JSON.stringify(body))
    }
    // client bỏ đi / hết 30 s → huỷ upstream + giết Python
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), limits.requestTimeoutMs)
    res.on('close', () => { if (!res.writableFinished) controller.abort() })
    try {
      if (req.method === 'OPTIONS') {
        if (!allowed) throw new HttpError(403, 'origin', 'Nguồn gọi không được phép.')
        // Chrome Private/Local Network Access: máy trong tailnet phân giải tên ra IP riêng 100.x → preflight có cờ này
        const privateNetwork = req.headers['access-control-request-private-network'] === 'true' ? { 'access-control-allow-private-network': 'true' } : {}
        res.writeHead(204, { 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'authorization, content-type', 'access-control-max-age': '600', ...privateNetwork })
        return res.end()
      }
      if (req.method === 'GET' && path === '/health') return send(200, { ok: true, version: VERSION, ...(await health()) })
      if (req.method === 'POST' && path === '/analyze-measures') {
        // origin lạ: không cấp CORS (trình duyệt chặn đọc) VÀ từ chối luôn — không tốn tài nguyên phân tích
        if (origin && !allowed) throw new HttpError(403, 'origin', 'Nguồn gọi không được phép.')
        const result = await analyzeRequest(req, log, controller.signal)
        log.status = 200
        return send(200, { ...result, requestId })
      }
      throw new HttpError(404, 'not_found', 'Không có.')
    } catch (error) {
      const known = error instanceof HttpError ? error : new HttpError(500, 'internal', 'Lỗi máy phân tích.')
      log.status = known.status; log.errorCode = known.code
      send(known.status, { ok: false, error: { code: known.code, message: known.message }, requestId })
    } finally {
      clearTimeout(deadline)
      log.durationMs = now() - started
      if (path !== '/health') void writeLog(log)
    }
  })
}

function readBody(req: IncomingMessage, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > max) { reject(new HttpError(413, 'too_large', 'Yêu cầu quá lớn.')); req.resume() } else chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', () => reject(new HttpError(400, 'bad_request', 'Yêu cầu không hợp lệ.')))
  })
}

async function readCapped(reply: Response, max: number, signal: AbortSignal): Promise<Buffer> {
  if (Number(reply.headers.get('content-length') ?? 0) > max) throw new HttpError(413, 'too_large', 'File nguồn lớn hơn 20 MB.')
  const reader = reply.body!.getReader()
  const parts: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > max) { await reader.cancel().catch(() => {}); throw new HttpError(413, 'too_large', 'File nguồn lớn hơn 20 MB.') }
      parts.push(value)
    }
  } catch (error) {
    if (error instanceof HttpError) throw error
    if (signal.aborted) throw new HttpError(504, 'timeout', 'Hết thời gian phân tích.')
    throw new HttpError(502, 'upstream', 'Tải file nguồn bị ngắt.')
  }
  return Buffer.concat(parts)
}

function run(cmd: string, args: string[], path?: string): Promise<string> {
  return new Promise((resolve, reject) => execFile(cmd, args, { timeout: 5000, env: { ...process.env, ...(path ? { PATH: path } : {}) } },
    (error, stdout, stderr) => (error && !`${stdout}${stderr}`.trim() ? reject(error) : resolve(`${stdout}${stderr}`))))
}

/** Python con: hết hạn / client bỏ đi → SIGKILL (504); RSS vượt trần → SIGKILL (413). Không bao giờ treo worker. */
function runAnalyzer(config: WorkerConfig, limits: typeof LIMITS, payload: unknown, signal: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new HttpError(504, 'timeout', 'Hết thời gian phân tích.'))
    const child = spawn(config.python, [config.analyzer], {
      stdio: ['pipe', 'pipe', 'ignore'],
      env: { PATH: config.childPath ?? process.env.PATH ?? '', HOME: process.env.HOME ?? '', LANG: 'en_US.UTF-8' },
    })
    let out = ''
    let killed: HttpError | null = null
    const kill = (error: HttpError) => { if (!killed) { killed = error; child.kill('SIGKILL') } }
    const onAbort = () => kill(new HttpError(504, 'timeout', 'Hết thời gian phân tích.'))
    signal.addEventListener('abort', onAbort, { once: true })
    const watch = setInterval(() => {
      if (!child.pid) return
      execFile('ps', ['-o', 'rss=', '-p', String(child.pid)], (error, stdout) => {
        if (!error && Number(stdout.trim()) * 1024 > limits.maxRssBytes) kill(new HttpError(413, 'too_large', 'File cần quá nhiều bộ nhớ để phân tích.'))
      })
    }, 200)
    child.stdout.on('data', chunk => { out += chunk; if (out.length > 5 * 1024 * 1024) kill(new HttpError(422, 'analysis_failed', 'Phân tích không thành công.')) })
    child.on('error', () => kill(new HttpError(500, 'internal', 'Không chạy được bộ phân tích.')))
    child.on('close', () => {
      clearInterval(watch)
      signal.removeEventListener('abort', onAbort)
      if (killed) return reject(killed)
      try { resolve(JSON.parse(out)) } catch { reject(new HttpError(422, 'analysis_failed', 'Phân tích không thành công.')) }
    })
    child.stdin.on('error', () => { /* con chết sớm */ })
    child.stdin.end(JSON.stringify(payload))
  })
}

// ── chạy như service (launchd đặt MA_RUN=1) ──
if (process.env.MA_RUN === '1') {
  const env = process.env
  const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'MA_PYTHON', 'MA_ANALYZER'].filter(key => !env[key])
  if (missing.length) { console.error(`thiếu cấu hình: ${missing.join(', ')}`); process.exit(2) }
  const development = env.MA_MODE === 'development'
  const origins = (env.MA_ALLOWED_ORIGINS ?? 'https://class.vananhaudio.com').split(',').map(s => s.trim()).filter(Boolean)
    // origin localhost CHỈ khi chạy chế độ development rõ ràng; production luôn https
    .filter(origin => (development ? true : origin.startsWith('https://')))
  const port = Number(env.MA_PORT ?? 7430)
  createWorker({
    supabaseUrl: env.SUPABASE_URL!.replace(/\/$/, ''), anonKey: env.SUPABASE_ANON_KEY!, python: env.MA_PYTHON!, analyzer: env.MA_ANALYZER!,
    allowedOrigins: origins, logDir: env.MA_LOG_DIR ?? join(env.HOME ?? '.', 'Library/Logs/MeasureAnalyzer'), childPath: env.MA_CHILD_PATH,
  }).listen(port, '127.0.0.1', () => console.log(JSON.stringify({ event: 'listening', version: VERSION, host: '127.0.0.1', port, development, origins })))
}
