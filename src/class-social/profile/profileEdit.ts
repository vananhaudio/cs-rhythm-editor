// Chỉnh sửa trang cá nhân V1 — kiểm tên hiển thị (THUẦN, test được). Tên hiển thị = edu_students.display_name,
// CÙNG cột App học (Cài đặt → Hồ sơ của tôi) sửa; mọi màn Social đọc qua class_public_identity.
export const MAX_DISPLAY_NAME = 60

export type NameCheck = { ok: true; name: string } | { ok: false; error: string }

/** Bỏ khoảng trắng đầu/cuối (và gộp khoảng trắng liền nhau); KHÔNG đổi hoa/thường; tiếng Việt đầy đủ. */
export function checkDisplayName(raw: string): NameCheck {
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (!name) return { ok: false, error: 'Nhập tên hiển thị.' }
  if ([...name].length > MAX_DISPLAY_NAME) return { ok: false, error: `Tên hiển thị tối đa ${MAX_DISPLAY_NAME} ký tự.` }
  return { ok: true, name }
}
