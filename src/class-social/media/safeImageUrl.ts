// URL ảnh (avatar/bìa) an toàn để đặt vào <img src>: chỉ https, blob: (ảnh vừa chọn trên máy)
// hoặc data:image raster. Mọi thứ khác (javascript:, http:, data:text…) → null → hiện ảnh dự phòng.
export function safeImageUrl(u: string | null | undefined): string | null {
  if (!u || typeof u !== 'string' || u.length > 2_000_000) return null
  if (/^https:\/\/[^\s"'<>]+$/.test(u)) return u
  if (/^blob:(https?:\/\/[^\s"'<>]+\/)?[0-9a-f-]{8,}$/i.test(u)) return u
  if (/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u)) return u
  return null
}
