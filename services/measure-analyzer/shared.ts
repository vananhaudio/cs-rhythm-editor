// Phần dùng chung của worker (phân tích vạch nhịp + extraction): lỗi HTTP có mã, đọc body/ file có trần, gọi Supabase bằng JWT người gọi.
// Không service-role: mọi lời gọi đi bằng chính token của người dùng + anon key (vốn công khai).
export class HttpError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code }
}

export function readBody(req: import('node:http').IncomingMessage, max: number): Promise<string> {
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

export async function readCapped(reply: Response, max: number, signal: AbortSignal): Promise<Buffer> {
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

export function makeUpstream(supabaseUrl: string, anonKey: string) {
  return async function upstream(path: string, token: string, signal: AbortSignal, body?: unknown): Promise<Response> {
    try {
      return await fetch(`${supabaseUrl}${path}`, {
        method: body === undefined ? 'GET' : 'POST', signal, redirect: 'error',
        headers: { apikey: anonKey, authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      if (signal.aborted) throw new HttpError(504, 'timeout', 'Hết thời gian phân tích.')
      throw new HttpError(502, 'upstream', 'Không kết nối được máy chủ dữ liệu.')
    }
  }
}
