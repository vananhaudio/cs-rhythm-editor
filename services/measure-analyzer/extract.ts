// /extract-content — Slice 2A. PDF/ảnh đã nạp → engine chord_extract (Python) → chord-extraction/1 → lưu (RPC) → đọc lại (RPC).
//
// Dùng LẠI cơ chế của worker phân tích vạch nhịp, không tạo cơ chế xác thực thứ hai:
//   JWT người gọi → /auth/v1/user → RPC my_chordlib_caps (bắt buộc review) → RPC chord_extraction_begin (DB quyết quyền, tìm phiên bản,
//   chọn file nguồn theo sources[sourceIndex], chống trùng) → tải file private bằng CHÍNH token (policy Storage quyết) → engine → RPC
//   chord_extraction_complete/fail bằng CHÍNH token. Không service-role; trình duyệt chỉ gửi {versionId, sourceIndex, force?, forceVision?}
//   — KHÔNG đường dẫn, URL, lời, file, khoá Vision.
// Bất đồng bộ: begin xong trả 202 ngay; việc chạy tiếp ở nền (Vision có thể >30 s). Trình duyệt đọc kết quả bằng RPC chord_extraction_get
// (không qua worker). Worker chết giữa chừng → lease ở DB hết hạn → đọc ra failed/abandoned.
// Không ghi log: JWT, khoá API, lời bài hát, byte file, đường dẫn nguồn.
import { execFile, spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { IncomingMessage } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpError, makeUpstream, readBody, readCapped } from './shared.ts'

const BUCKET = 'chord-sheet-sources'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SOURCE_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9]\.(pdf|jpg|jpeg|png|webp)$/
const MIME_EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const MAGIC: Record<string, (b: Buffer) => boolean> = {
  'application/pdf': b => b.subarray(0, 5).toString('latin1') === '%PDF-',
  'image/png': b => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': b => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
}
/** Mã lỗi đóng — khớp CHECK của chord_sheet_extractions.error_code (db/chord_library_v1_3_extractions_setup.sql). */
export type FailCode = 'source_missing' | 'forbidden_source' | 'unsupported_mime' | 'sha_mismatch' | 'too_large' | 'timeout'
  | 'ocr_unavailable' | 'engine_failed' | 'invalid_result' | 'upstream' | 'internal' | 'bad_file'
class JobFailure extends Error { readonly code: FailCode; constructor(code: FailCode) { super(code); this.code = code } }

export const EXTRACT_LIMITS = {
  maxFileBytes: 20 * 1024 * 1024, maxBodyBytes: 4096,
  perMinute: 4, perDay: 40,
  maxConcurrent: 1, maxQueue: 2,               // engine OCR nặng: một việc một lúc, hàng chờ ngắn; đầy → 429 TRƯỚC khi tạo bản ghi
  jobTimeoutMs: 120_000, jobTimeoutVisionMs: 240_000,   // < lease 5 phút của DB
  maxStdoutBytes: 16 * 1024 * 1024, maxRssBytes: 1024 * 1024 * 1024, maxPages: 20,
}

export type ExtractWorkerConfig = {
  /** Python có numpy + Pillow (cùng loại với analyzer) */
  python: string
  /** Thư mục chứa gói `chord_extract` (cwd của tiến trình con) */
  packageDir: string
  /** Gói ngôn ngữ OCR (vie). Thiếu → job thất bại `ocr_unavailable`. */
  tessdataDir?: string
  childPath?: string
  /** Vision: CHỈ từ môi trường của worker. Vắng = Vision tắt. */
  vision?: { model: string; apiKey: string; baseUrl?: string }
  tempRoot?: string
  limits?: Partial<typeof EXTRACT_LIMITS>
}

type Deps = { config: ExtractWorkerConfig; supabaseUrl: string; anonKey: string; now: () => number; writeLog: (entry: Record<string, unknown>) => Promise<void> | void }
type Source = { path: string; mime: string; sha256: string; size_bytes?: number }

export function createExtractor(deps: Deps) {
  const { config } = deps
  const limits = { ...EXTRACT_LIMITS, ...config.limits }
  const upstream = makeUpstream(deps.supabaseUrl, deps.anonKey)
  const minute = new Map<string, number[]>()
  const day = new Map<string, number[]>()
  let running = 0
  let inFlight = 0
  const waiting: (() => void)[] = []
  let engine: Promise<string> | null = null

  const childEnv = (tmp?: string) => ({
    PATH: config.childPath ?? process.env.PATH ?? '', HOME: process.env.HOME ?? '', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8',
    ...(tmp ? { TMPDIR: tmp } : {}),                 // file tạm của engine/tesseract nằm trong thư mục của lần chạy, xoá cùng nó
    ...(config.tessdataDir ? { CHORD_EXTRACT_TESSDATA: config.tessdataDir } : {}),
    ...(config.vision ? { ANTHROPIC_API_KEY: config.vision.apiKey } : {}),   // chỉ vào tiến trình con, không bao giờ vào log
  })

  /** Phiên bản engine (cache). Cũng là cổng "engine có chạy được không" của /health. */
  function engineVersion(): Promise<string> {
    return engine ??= new Promise<string>((resolve, reject) => execFile(config.python, ['-m', 'chord_extract', '--version'],
      { cwd: config.packageDir, timeout: 10_000, env: childEnv() }, (error, stdout) => {
        const version = stdout.trim()
        if (error || !/^[\w./+-]{1,80}$/.test(version)) { engine = null; reject(new HttpError(503, 'engine_unavailable', 'Engine đọc nội dung chưa sẵn sàng.')) } else resolve(version)
      }))
  }
  // Mọi thứ làm KẾT QUẢ khác đi phải nằm trong khoá chống trùng: ngôn ngữ OCR, trần trang, model Vision, và yêu cầu 'chính xác hơn' của người dùng.
  const configHash = (forceVision: boolean) => createHash('sha256').update(JSON.stringify({
    lang: 'vie', maxPages: limits.maxPages, vision: config.vision ? config.vision.model : null, forceVision,
  })).digest('hex')

  function rateLimit(uid: string) {
    const t = deps.now()
    const keep = (map: Map<string, number[]>, window: number) => { const list = (map.get(uid) ?? []).filter(x => t - x < window); map.set(uid, list); return list }
    const m = keep(minute, 60_000), d = keep(day, 86_400_000)
    if (m.length >= limits.perMinute || d.length >= limits.perDay) throw new HttpError(429, 'rate_limited', 'Phân tích quá nhiều lần — thử lại sau.')
    m.push(t); d.push(t)
  }

  async function acquire() {
    if (running < limits.maxConcurrent) { running += 1; return }
    await new Promise<void>(resolve => waiting.push(resolve))
    running += 1
  }
  const release = () => { running -= 1; waiting.shift()?.() }

  function rpcError(text: string, status: number): HttpError {
    if (/CHORDLIB_FORBIDDEN/.test(text) || status === 403) return new HttpError(403, 'forbidden', 'Chỉ người duyệt Hợp âm chuẩn hóa mới phân tích được.')
    if (/CHORDLIB_NOT_FOUND/.test(text)) return new HttpError(404, 'not_found', 'Không tìm thấy phiên bản này.')
    if (/CHORDLIB_LIMIT/.test(text)) return new HttpError(429, 'rate_limited', 'Phiên bản này đã phân tích quá nhiều lần — thử lại sau.')
    if (/CHORDLIB_INVALID/.test(text)) return new HttpError(422, 'invalid', 'File nguồn không hợp lệ hoặc không có.')
    return new HttpError(502, 'upstream', 'Không ghi được lần phân tích.')
  }

  async function handle(req: IncomingMessage, log: Record<string, unknown>, signal: AbortSignal): Promise<{ status: number; body: Record<string, unknown> }> {
    const token = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(req.headers.authorization ?? '')?.[1]
    if (!token) throw new HttpError(401, 'unauthorized', 'Cần đăng nhập.')
    let parsed: unknown
    try { parsed = JSON.parse(await readBody(req, limits.maxBodyBytes)) } catch (error) {
      throw error instanceof HttpError ? error : new HttpError(400, 'bad_request', 'Yêu cầu không hợp lệ.')
    }
    const body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
    const keys = body ? Object.keys(body) : []
    const { versionId, sourceIndex, force = false, forceVision = false } = (body ?? {}) as Record<string, unknown>
    // chỉ các khoá này — không nhận đường dẫn, URL, lời, file, uid, vai trò, khoá Vision từ browser
    if (!body || keys.some(k => !['versionId', 'sourceIndex', 'force', 'forceVision'].includes(k)) || typeof versionId !== 'string' || !UUID.test(versionId)
        || !Number.isInteger(sourceIndex) || (sourceIndex as number) < 0 || (sourceIndex as number) > 9 || typeof force !== 'boolean' || typeof forceVision !== 'boolean') {
      throw new HttpError(400, 'bad_request', 'Chỉ nhận { versionId, sourceIndex, force?, forceVision? }.')
    }
    log.versionId = versionId; log.sourceIndex = sourceIndex

    const user = await upstream('/auth/v1/user', token, signal)
    if (user.status === 401 || user.status === 403) throw new HttpError(401, 'unauthorized', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.')
    if (!user.ok) throw new HttpError(502, 'upstream', 'Không xác thực được phiên đăng nhập.')
    const uid = String(((await user.json().catch(() => ({}))) as { id?: unknown }).id ?? '')
    if (!UUID.test(uid)) throw new HttpError(401, 'unauthorized', 'Phiên đăng nhập không hợp lệ.')
    log.uidHash = createHash('sha256').update(uid).digest('hex').slice(0, 12)
    rateLimit(uid)

    const caps = await upstream('/rest/v1/rpc/my_chordlib_caps', token, signal, {})
    if (caps.status === 401) throw new HttpError(401, 'unauthorized', 'Phiên đăng nhập không hợp lệ.')
    if (!caps.ok) throw new HttpError(502, 'upstream', 'Không đọc được quyền.')
    if ((((await caps.json().catch(() => ({}))) as { caps?: { review?: unknown } }).caps?.review) !== true) {
      throw new HttpError(403, 'forbidden', 'Chỉ người duyệt Hợp âm chuẩn hóa mới phân tích được.')
    }

    // Chỗ chạy: đầy → từ chối TRƯỚC khi tạo bản ghi (không để lại hàng 'running' không ai chạy).
    if (inFlight >= limits.maxConcurrent + limits.maxQueue) throw new HttpError(429, 'busy', 'Máy phân tích đang bận — thử lại sau ít phút.')
    inFlight += 1
    let handedOff = false
    try {
      const version = await engineVersion()
      const begin = await upstream('/rest/v1/rpc/chord_extraction_begin', token, signal, {
        p_version_id: versionId, p_source_index: sourceIndex, p_engine_version: version, p_config_hash: configHash(forceVision), p_force: force,
      })
      if (!begin.ok) throw rpcError(await begin.text().catch(() => ''), begin.status)
      const out = await begin.json().catch(() => ({})) as { duplicate?: boolean; status?: string; extraction_id?: string; source?: Source }
      if (!out.extraction_id || !UUID.test(out.extraction_id)) throw new HttpError(502, 'upstream', 'Phản hồi ghi lần phân tích không hợp lệ.')
      log.extractionId = out.extraction_id
      if (out.duplicate) {
        log.duplicate = true; log.extractionStatus = out.status
        return { status: 200, body: { ok: true, extractionId: out.extraction_id, status: out.status, duplicate: true } }
      }
      if (!out.source) throw new HttpError(502, 'upstream', 'Phản hồi ghi lần phân tích thiếu nguồn.')
      handedOff = true
      void runJob({ token, extractionId: out.extraction_id, versionId, sourceIndex: sourceIndex as number, source: out.source, version, forceVision })
      return { status: 202, body: { ok: true, extractionId: out.extraction_id, status: 'running', duplicate: false } }
    } finally {
      if (!handedOff) inFlight -= 1
    }
  }

  async function rpc(token: string, fn: string, args: Record<string, unknown>, signal: AbortSignal) {
    const reply = await upstream(`/rest/v1/rpc/${fn}`, token, signal, args)
    if (!reply.ok) { await reply.text().catch(() => ''); throw new JobFailure('upstream') }
    return reply
  }

  async function runJob(job: { token: string; extractionId: string; versionId: string; sourceIndex: number; source: Source; version: string; forceVision: boolean }) {
    const started = deps.now()
    const log: Record<string, unknown> = { event: 'extract_job', extractionId: job.extractionId, versionId: job.versionId, sourceIndex: job.sourceIndex }
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), config.vision ? limits.jobTimeoutVisionMs : limits.jobTimeoutMs)
    let dir: string | null = null
    let slot = false
    const closeSignal = new AbortController().signal
    try {
      const { source } = job
      // 1) nguồn do DB trả lại (không phải browser): kiểm khuôn lần nữa trước khi dùng làm khoá Storage
      if (typeof source.path !== 'string' || !SOURCE_PATH.test(source.path) || !MIME_EXT[source.mime] || !/^[0-9a-f]{64}$/.test(source.sha256)) throw new JobFailure('unsupported_mime')
      log.mime = source.mime; log.sha8 = source.sha256.slice(0, 8)
      await acquire(); slot = true
      if (controller.signal.aborted) throw new JobFailure('timeout')

      // 2) tải file private bằng CHÍNH token (policy Storage quyết quyền đọc)
      const key = source.path.split('/').map(encodeURIComponent).join('/')
      let reply: Response
      try { reply = await upstream(`/storage/v1/object/authenticated/${BUCKET}/${key}`, job.token, controller.signal) } catch (error) {
        throw new JobFailure(error instanceof HttpError && error.code === 'timeout' ? 'timeout' : 'upstream')
      }
      if (reply.status === 404 || reply.status === 400) throw new JobFailure('source_missing')
      if (reply.status === 401 || reply.status === 403) throw new JobFailure('forbidden_source')
      if (!reply.ok || !reply.body) throw new JobFailure('upstream')
      let bytes: Buffer
      try { bytes = await readCapped(reply, limits.maxFileBytes, controller.signal) } catch (error) {
        throw new JobFailure(error instanceof HttpError && error.code === 'too_large' ? 'too_large' : error instanceof HttpError && error.code === 'timeout' ? 'timeout' : 'upstream')
      }
      // 3) toàn vẹn: loại thật của file + sha256 tính trên byte ĐÃ TẢI phải bằng sha256 đã khai ở phiên bản
      if (!MAGIC[source.mime](bytes)) throw new JobFailure('unsupported_mime')
      const sha = createHash('sha256').update(bytes).digest('hex')
      if (sha !== source.sha256) throw new JobFailure('sha_mismatch')

      // 4) engine
      dir = await mkdtemp(join(config.tempRoot ?? tmpdir(), 'chord-extract-'))
      const file = join(dir, `source.${MIME_EXT[source.mime]}`)
      await writeFile(file, bytes)
      const args = ['-m', 'chord_extract', file, '--json-errors', '--max-pages', String(limits.maxPages)]
      if (config.vision) {
        args.push('--vision', 'anthropic-api', '--vision-model', config.vision.model)
        if (config.vision.baseUrl) args.push('--vision-base-url', config.vision.baseUrl)
      }
      if (job.forceVision) args.push('--force-vision')
      const raw = await runEngine(config, limits, args, controller.signal, childEnv(dir))
      if (raw && typeof raw === 'object' && (raw as { ok?: unknown }).ok === false) {
        const code = String(((raw as { error?: { code?: unknown } }).error?.code) ?? 'engine_failed')
        throw new JobFailure((['bad_file', 'too_large', 'ocr_unavailable', 'engine_failed'] as string[]).includes(code) ? code as FailCode : 'engine_failed')
      }

      // 5) kết quả phải đúng khuôn tối thiểu và đúng file; gắn danh tính DB vào tài liệu
      const doc = raw as { schema?: unknown; extractionId?: unknown; input?: { sha256?: unknown; pageCount?: unknown }; pages?: unknown; interpretation?: unknown; pipeline?: { engineVersion?: unknown; vision?: { status?: unknown }; stages?: unknown; fallbackReasons?: unknown; metrics?: unknown } }
      if (!doc || doc.schema !== 'chord-extraction/1' || !Array.isArray(doc.pages) || !doc.pages.length || !doc.interpretation || !doc.pipeline
          || doc.input?.sha256 !== source.sha256 || doc.pipeline.engineVersion !== job.version) throw new JobFailure('invalid_result')
      doc.extractionId = job.extractionId
      log.pageCount = doc.pages.length
      log.methods = [...new Set((doc.pages as { method?: string }[]).map(p => p.method))]
      log.fallbackReasons = Array.isArray(doc.pipeline.fallbackReasons) ? (doc.pipeline.fallbackReasons as { code?: string }[]).map(r => r.code) : []
      log.visionStatus = doc.pipeline.vision?.status
      const visionStage = Array.isArray(doc.pipeline.stages) ? (doc.pipeline.stages as { stage?: string; engine?: string; model?: string }[]).find(s => s.stage === 'vision') : undefined
      if (visionStage) { log.provider = visionStage.engine; log.model = visionStage.model }

      // 6) ghi kết quả (RPC kiểm lại sha256, khuôn, kích thước)
      await rpc(job.token, 'chord_extraction_complete', {
        p_id: job.extractionId, p_input_sha256: sha, p_input_bytes: bytes.length, p_page_count: doc.pages.length,
        p_observation: doc.pages, p_interpretation: doc.interpretation, p_pipeline: doc.pipeline, p_duration_ms: deps.now() - started,
      }, closeSignal)
      log.status = 'succeeded'
    } catch (error) {
      const code: FailCode = error instanceof JobFailure ? error.code : controller.signal.aborted ? 'timeout' : 'internal'
      log.status = 'failed'; log.errorCode = code
      // đóng bản ghi bằng mã máy đọc được (không thông điệp tự do); nếu cả việc này hỏng thì lease ở DB sẽ đóng thành abandoned
      await rpc(job.token, 'chord_extraction_fail', { p_id: job.extractionId, p_error_code: code, p_duration_ms: deps.now() - started }, closeSignal).catch(() => { log.closeFailed = true })
    } finally {
      clearTimeout(deadline)
      if (slot) release()
      inFlight -= 1
      if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {})
      log.durationMs = deps.now() - started
      void deps.writeLog({ requestId: randomUUID(), ...log })
    }
  }

  async function health() {
    try { return { engine: await engineVersion(), vision: config.vision ? { provider: 'anthropic-api', model: config.vision.model } : null } }
    catch { return { engine: null, vision: null } }
  }

  return { handle, health }
}

/** Tiến trình engine: hết hạn / bị huỷ → SIGKILL CẢ NHÓM (tesseract, pdftoppm… con cháu) và trả lỗi NGAY, không chờ stdio đóng;
 *  RSS vượt trần → SIGKILL (too_large). stdout JSON có trần. Không bao giờ treo worker, không để tiến trình mồ côi. */
function runEngine(config: ExtractWorkerConfig, limits: typeof EXTRACT_LIMITS, args: string[], signal: AbortSignal, env: Record<string, string>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new JobFailure('timeout'))
    const child = spawn(config.python, args, { cwd: config.packageDir, stdio: ['ignore', 'pipe', 'ignore'], env, detached: true })
    let out = ''
    let settled = false
    const finish = (fn: () => void) => { if (settled) return; settled = true; clearInterval(watch); signal.removeEventListener('abort', onAbort); fn() }
    const kill = (failure: JobFailure) => {
      if (settled) return
      try { process.kill(-child.pid!, 'SIGKILL') } catch { child.kill('SIGKILL') }
      finish(() => reject(failure))
    }
    const onAbort = () => kill(new JobFailure('timeout'))
    signal.addEventListener('abort', onAbort, { once: true })
    const watch = setInterval(() => {
      if (!child.pid) return
      execFile('ps', ['-o', 'rss=', '-p', String(child.pid)], (error, stdout) => {
        if (!error && Number(stdout.trim()) * 1024 > limits.maxRssBytes) kill(new JobFailure('too_large'))
      })
    }, 200)
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => { out += chunk; if (out.length > limits.maxStdoutBytes) kill(new JobFailure('invalid_result')) })
    child.on('error', () => kill(new JobFailure('engine_failed')))
    child.on('close', () => finish(() => { try { resolve(JSON.parse(out)) } catch { reject(new JobFailure('engine_failed')) } }))
  })
}
