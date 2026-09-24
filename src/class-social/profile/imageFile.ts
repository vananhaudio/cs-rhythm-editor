// Chuẩn bị ảnh đại diện / ảnh bìa trước khi tải lên.
// - Không tin đuôi file / tên file: nhận diện loại ảnh bằng BYTE ĐẦU (magic bytes).
// - Giới hạn dung lượng ảnh gốc.
// - Thu nhỏ + mã hoá lại JPEG trên trình duyệt → file nhẹ, và XOÁ EXIF (kể cả vị trí GPS).
// Đường dẫn lưu theo đúng quy ước App học: bucket 'avatars', tên phẳng `<id>-<thời điểm>.<ext>`
// (mỗi lần đổi là URL mới → không bị cache ảnh cũ).

export type ImageKind = 'avatar' | 'cover'
export type SniffedType = 'jpeg' | 'png' | 'webp' | 'gif' | 'heic'

export const MAX_INPUT_BYTES = 15 * 1024 * 1024          // ảnh gốc từ điện thoại có thể lớn
export const OUTPUT: Record<ImageKind, { maxW: number; maxH: number; quality: number }> = {
  avatar: { maxW: 800, maxH: 800, quality: 0.88 },
  cover: { maxW: 1920, maxH: 1080, quality: 0.85 },
}

/** Nhận diện loại ảnh từ 12 byte đầu. Không khớp → null. */
export function sniffImageType(b: Uint8Array): SniffedType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png'
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return 'gif'
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp'
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11])
    if (/^(heic|heix|hevc|mif1|msf1)$/.test(brand)) return 'heic'
  }
  return null
}

/** Kích thước sau khi thu nhỏ vào khung (giữ tỉ lệ, không phóng to). */
export function fitWithin(w: number, h: number, maxW: number, maxH: number): { w: number; h: number } {
  if (!(w > 0 && h > 0)) return { w: 0, h: 0 }
  const s = Math.min(1, maxW / w, maxH / h)
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) }
}

// Tên file theo quy ước App học (hàm uploadAvatar của App học): `<studentId>-<ms>.jpg`.
export function avatarPath(studentId: string, now = Date.now()): string {
  return `${studentId.replace(/[^A-Za-z0-9-]/g, '')}-${now}.jpg`
}
/** Ảnh bìa: cùng bucket, tiền tố `cover-`, gắn với tài khoản: `cover-<userId>-<ms>.jpg`. */
export function coverPath(userId: string, now = Date.now()): string {
  return `cover-${userId.replace(/[^A-Za-z0-9-]/g, '')}-${now}.jpg`
}

export type PrepareError = 'not_image' | 'too_large' | 'unsupported' | 'decode_failed'
export const PREPARE_ERROR_TEXT: Record<PrepareError, string> = {
  not_image: 'Tệp này không phải ảnh. Hãy chọn ảnh JPG, PNG hoặc WebP.',
  too_large: 'Ảnh quá lớn (tối đa 15 MB).',
  unsupported: 'Trình duyệt chưa đọc được định dạng ảnh này. Hãy chọn ảnh JPG hoặc PNG.',
  decode_failed: 'Không đọc được ảnh này. Hãy thử ảnh khác.',
}

/** Kiểm tra + thu nhỏ + mã hoá lại JPEG (trình duyệt). */
export async function prepareImage(file: File, kind: ImageKind): Promise<{ ok: true; blob: Blob; previewUrl: string } | { ok: false; error: PrepareError }> {
  if (file.size > MAX_INPUT_BYTES) return { ok: false, error: 'too_large' }
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const type = sniffImageType(head)
  if (!type) return { ok: false, error: 'not_image' }
  let bmp: ImageBitmap
  try { bmp = await createImageBitmap(file) } catch { return { ok: false, error: type === 'heic' ? 'unsupported' : 'decode_failed' } }
  const o = OUTPUT[kind]
  const { w, h } = fitWithin(bmp.width, bmp.height, o.maxW, o.maxH)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) { bmp.close(); return { ok: false, error: 'decode_failed' } }
  ctx.fillStyle = '#ffffff'                       // ảnh PNG trong suốt → nền trắng (JPEG không có alpha)
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', o.quality))
  if (!blob) return { ok: false, error: 'decode_failed' }
  return { ok: true, blob, previewUrl: URL.createObjectURL(blob) }
}
