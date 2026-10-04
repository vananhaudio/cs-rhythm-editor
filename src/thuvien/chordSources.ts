// File nguồn (PDF/ảnh sheet) của một phiên bản Hợp âm chuẩn hóa. Thuần TS + một interface lưu trữ.
// Hợp đồng với máy chủ (db/chord_library_v1_setup.sql):
//   • bucket riêng tư `chord-sheet-sources`, đường dẫn {uid}/{version_id}/{0-9}.{pdf|jpg|jpeg|png|webp};
//   • file tải lên TRƯỚC, rồi chord_sheet_contribute(p_version_id, p_sources) ghi phiên bản kèm danh sách file;
//   • phiên bản đã ghi thì thư mục của nó đóng băng — không thêm, không xoá (trigger N1 ép ở lượt ghi thật);
//   • sources mỗi mục CHỈ gồm {path, mime, sha256, page, size_bytes}; mime khớp đuôi; khớp metadata Storage.
// sha256 do TRÌNH DUYỆT tính trên đúng byte tải lên — máy chủ không đọc được byte nên KHÔNG kiểm chứng nó.

export const SOURCE_BUCKET = 'chord-sheet-sources'
export const MAX_SOURCE_FILES = 10
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024
/** Thời hạn link xem file (bucket riêng tư → link ký, ngắn hạn). */
export const SOURCE_VIEW_SECONDS = 300

export type SourceMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'
const EXT: Record<SourceMime, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const MIME_BY_EXT: Record<string, SourceMime> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
export const SOURCE_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp'

/** Một file nguồn ĐÃ nằm trong bucket. `page` = thứ tự trong phiên bản (1, 2, …). */
export type ChordSource = { path: string; mime: SourceMime; sha256: string; sizeBytes: number; page: number }

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const PATH = new RegExp(`^(${UUID})/(${UUID})/([0-9])\\.(pdf|jpg|jpeg|png|webp)$`)

export function parseSourcePath(path: string): { ownerId: string; versionId: string; index: number; ext: string } | null {
  const match = PATH.exec(path)
  return match ? { ownerId: match[1], versionId: match[2], index: Number(match[3]), ext: match[4] } : null
}

export const sourcePath = (ownerId: string, versionId: string, index: number, mime: SourceMime) => `${ownerId}/${versionId}/${index}.${EXT[mime]}`

/**
 * Loại file thật sự: tin `type` của trình duyệt nếu là một trong 4 loại; trình duyệt để trống (hay gặp với PDF
 * kéo từ vài ứng dụng) thì suy từ đuôi tên. HEIC và mọi loại khác → null.
 */
export function sourceMimeOf(file: { name: string; type: string }): SourceMime | null {
  if (file.type in EXT) return file.type as SourceMime
  if (file.type) return null
  return MIME_BY_EXT[/\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? ''] ?? null
}

/** Lỗi dễ hiểu cho thầy, kiểm TRƯỚC khi tải. Máy chủ/Storage vẫn là nơi ép cuối cùng. */
export function sourceFileProblem(file: { name: string; type: string; size: number }, filesAlready: number): string | null {
  if (!sourceMimeOf(file)) return `“${file.name}”: chỉ nhận PDF, JPEG, PNG hoặc WebP (chưa nhận HEIC — xuất ảnh sang JPEG trước).`
  if (file.size <= 0) return `“${file.name}”: file rỗng.`
  if (file.size > MAX_SOURCE_BYTES) return `“${file.name}”: lớn hơn 20 MB.`
  if (filesAlready >= MAX_SOURCE_FILES) return `Một phiên bản tối đa ${MAX_SOURCE_FILES} file nguồn.`
  return null
}

/** Số thứ tự trống nhỏ nhất (0–9) trong thư mục phiên bản. */
export function nextFreeIndex(used: number[]): number | null {
  for (let index = 0; index < MAX_SOURCE_FILES; index += 1) if (!used.includes(index)) return index
  return null
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Dạng `sources` gửi máy chủ — đúng 5 khoá máy chủ nhận, theo thứ tự trang. */
export const sourcesPayload = (sources: ChordSource[]) =>
  sources.map((source, at) => ({ path: source.path, mime: source.mime, sha256: source.sha256, size_bytes: source.sizeBytes, page: at + 1 }))

export function sourcesFromServer(raw: unknown): ChordSource[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item, at) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const path = String(row.path ?? '')
    const mime = String(row.mime ?? '') as SourceMime
    if (!parseSourcePath(path) || !(mime in EXT)) return []
    return [{ path, mime, sha256: String(row.sha256 ?? ''), sizeBytes: Number(row.size_bytes ?? 0), page: Number(row.page ?? at + 1) }]
  })
}

export const sourceKindLabel = (mime: SourceMime) => (mime === 'application/pdf' ? 'PDF' : mime === 'image/jpeg' ? 'JPEG' : mime === 'image/png' ? 'PNG' : 'WebP')

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

/** Lỗi Storage/máy chủ → câu đọc được (bỏ tiền tố kỹ thuật CHORDLIB_SOURCE). */
export function sourceErrorMessage(message: string): string {
  const source = /CHORDLIB_SOURCE: ([^"]+)/.exec(message)
  if (source) return source[1]
  if (/row-level security|Unauthorized|403/i.test(message)) return 'Không có quyền ghi file này (đường dẫn sai, đã đủ hạn mức, hoặc phiên bản đã ghi).'
  if (/exceeded the maximum allowed size|Payload too large|413/i.test(message)) return 'File lớn hơn 20 MB.'
  if (/mime type .* is not supported|invalid_mime_type/i.test(message)) return 'Loại file không được nhận (chỉ PDF, JPEG, PNG, WebP).'
  if (/already exists|Duplicate/i.test(message)) return 'Vị trí file này đã có file khác — tải lại trang rồi thử lại.'
  return message || 'Không xử lý được file nguồn.'
}

/** Nơi lưu file thật. Hiện thực: Supabase Storage (production), bộ nhớ (thử), cầu DB tạm (trang thử local). */
export interface ChordSourceStore {
  ownerId(): Promise<string>
  upload(path: string, file: Blob, mime: SourceMime): Promise<void>
  /** Xoá; KHÔNG xoá được (đã gắn phiên bản / không có quyền) thì ném lỗi — không bao giờ im lặng. */
  remove(path: string): Promise<void>
  copy(fromPath: string, toPath: string): Promise<void>
  /** Link xem ngắn hạn (bucket riêng tư — không có URL công khai). */
  viewUrl(path: string): Promise<string>
}

type StorageError = { message: string } | null
type StorageBucket = {
  upload(path: string, file: Blob, options: { contentType: string; upsert: boolean; cacheControl: string }): PromiseLike<{ error: StorageError }>
  remove(paths: string[]): PromiseLike<{ data: unknown[] | null; error: StorageError }>
  copy(fromPath: string, toPath: string): PromiseLike<{ error: StorageError }>
  createSignedUrl(path: string, expiresIn: number): PromiseLike<{ data: { signedUrl: string } | null; error: StorageError }>
}

/** Supabase Storage API thật — đi đúng đường có policy + trigger N1. */
export function createSupabaseSourceStore(deps: { bucket: () => Promise<StorageBucket>; userId: () => Promise<string | null> }): ChordSourceStore {
  const fail = (error: StorageError) => { if (error) throw new Error(sourceErrorMessage(error.message)) }
  return {
    async ownerId() {
      const id = await deps.userId()
      if (!id) throw new Error('Phiên đăng nhập đã hết — đăng nhập lại rồi thử lại.')
      return id
    },
    async upload(path, file, mime) { fail((await (await deps.bucket()).upload(path, file, { contentType: mime, upsert: false, cacheControl: '3600' })).error) },
    async remove(path) {
      const { data, error } = await (await deps.bucket()).remove([path])
      fail(error)
      if (!data?.length) throw new Error('Không xoá được file này — file đã gắn với một phiên bản.')
    },
    async copy(fromPath, toPath) { fail((await (await deps.bucket()).copy(fromPath, toPath)).error) },
    async viewUrl(path) {
      const { data, error } = await (await deps.bucket()).createSignedUrl(path, SOURCE_VIEW_SECONDS)
      fail(error)
      if (!data?.signedUrl) throw new Error('Không tạo được link xem file.')
      return data.signedUrl
    },
  }
}

/**
 * Kho trong bộ nhớ cho chế độ thử/test — ép cùng các luật của bucket thật (đường dẫn của chính mình, 0–9,
 * tối đa 10 file/thư mục, thư mục đã ghi thì đóng băng). `isRecorded` = thư mục đã thành phiên bản chưa.
 */
export function createMemorySourceStore(options: { ownerId: string; isRecorded: (versionId: string) => boolean }) {
  const files = new Map<string, { blob: Blob; mime: SourceMime }>()
  const folderCount = (versionId: string) => [...files.keys()].filter(path => parseSourcePath(path)?.versionId === versionId).length
  const guard = (path: string) => {
    const parsed = parseSourcePath(path)
    if (!parsed || parsed.ownerId !== options.ownerId) throw new Error('đường dẫn phải là {uid}/{version_id}/{0-9}.{pdf|jpg|jpeg|png|webp}')
    if (options.isRecorded(parsed.versionId)) throw new Error('phiên bản đã ghi — bộ file nguồn không đổi được nữa')
    return parsed
  }
  const store: ChordSourceStore & { files: typeof files } = {
    files,
    async ownerId() { return options.ownerId },
    async upload(path, file, mime) {
      const parsed = guard(path)
      if (MIME_BY_EXT[parsed.ext] !== mime) throw new Error('Loại file không được nhận (chỉ PDF, JPEG, PNG, WebP).')
      if (file.size > MAX_SOURCE_BYTES) throw new Error('File lớn hơn 20 MB.')
      if (files.has(path)) throw new Error('Vị trí file này đã có file khác — tải lại trang rồi thử lại.')
      if (folderCount(parsed.versionId) >= MAX_SOURCE_FILES) throw new Error('một phiên bản tối đa 10 file nguồn')
      files.set(path, { blob: file, mime })
    },
    async remove(path) {
      guard(path)
      if (!files.delete(path)) throw new Error('Không xoá được file này — file đã gắn với một phiên bản.')
    },
    async copy(fromPath, toPath) {
      const from = files.get(fromPath)
      if (!from) throw new Error('Không tìm thấy file nguồn để chép (dữ liệu thử không giữ file sau khi tải lại trang).')
      await store.upload(toPath, from.blob, from.mime)
    },
    async viewUrl(path) {
      const file = files.get(path)
      if (!file) throw new Error('Dữ liệu thử: nội dung file không còn (chỉ giữ trong lần mở trang này).')
      try { return URL.createObjectURL(file.blob) } catch { return `mock:${path}` }   // ngoài trình duyệt (test) không có blob URL
    },
  }
  return store
}

/** Kho cho bản production chưa bật backend — từ chối mọi thứ. */
export function createRefusingSourceStore(message: string): ChordSourceStore {
  const refuse = async (): Promise<never> => { throw new Error(message) }
  return { ownerId: refuse, upload: refuse, remove: refuse, copy: refuse, viewUrl: refuse }
}
