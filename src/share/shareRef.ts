// Class Universal Share — THAM CHIẾU chia sẻ (THUẦN, dùng chung Chat / sheet / resolver).
// Chat chỉ mang tham chiếu tới object gốc; quyền xem do CHÍNH object quyết (RLS/RPC của object) — tham chiếu không cấp quyền.
// Loại mới = thêm vào SHARE_REF_TYPES + CHECK dm_messages_ref_valid_check + nhánh dm_share + một resolver ở refCards.ts (xem docs/CLASS-UNIVERSAL-SHARE-V1.md).
export const SHARE_REF_TYPES = ['tool_artifact', 'class', 'class_session'] as const
export type ShareRefType = (typeof SHARE_REF_TYPES)[number]
export type ShareRef = { type: ShareRefType; key: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Tham chiếu hợp lệ (loại biết + uuid, chữ thường) hoặc null. Loại lạ/khoá hỏng → null → tin hiện như text (body cố định), không lỗi. */
export function toShareRef(type: string | null | undefined, key: string | null | undefined): ShareRef | null {
  const k = (key ?? '').toLowerCase()
  return (SHARE_REF_TYPES as readonly string[]).includes(type ?? '') && UUID_RE.test(k) ? { type: type as ShareRefType, key: k } : null
}

export const artifactRef = (id: string): ShareRef => ({ type: 'tool_artifact', key: id.toLowerCase() })
export const refId = (r: ShareRef): string => `${r.type}:${r.key}`
