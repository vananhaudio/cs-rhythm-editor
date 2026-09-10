/**
 * Quyền tính năng của công cụ Nhịp Phách.
 *
 * Ba thứ TÁCH BIỆT, đừng suy cái này ra cái kia:
 *   - vai trò (student/teacher/admin) — máy chủ quyết,
 *   - mức giao diện (Cơ bản/Nâng cao) — sở thích, ở localStorage,
 *   - quyền tính năng — bảng `tool_capabilities`, Admin chỉnh.
 *
 * Học viên xem giao diện Nâng cao mà không được dùng Nhiều bài là hợp lệ, và
 * thầy giáo bị Admin tắt Nhiều bài thì cũng không thấy Nhiều bài. Không chỗ nào
 * trong mã được viết `if (role === 'teacher')` để quyết định tính năng.
 */

export const NHIPPHACH_CAPS = [
  "access",
  "advanced",
  "export.pdf",
  "export.png",
  "export.svg",
  "export.beatmap",
  "batch",
  "presets",
  "history",
] as const;

export type Capability = (typeof NHIPPHACH_CAPS)[number];
export type Role = "guest" | "student" | "teacher" | "admin";

export interface CapState {
  role: Role;
  caps: Partial<Record<Capability, boolean>>;
}

/**
 * Chưa biết gì thì KHÔNG có quyền gì.
 *
 * Mặc định phải là từ chối: lỗi mạng, RPC hỏng hay dữ liệu lạ đều không được
 * biến thành "mở hết". Cổng đọc quyền phân biệt riêng "đang tải" với "bị từ chối".
 */
export const NO_CAPS: CapState = { role: "guest", caps: {} };

/** Chỉ `true` mới là có quyền — thiếu khoá, `undefined`, `null` đều là không. */
export function can(state: CapState | null, cap: Capability): boolean {
  return state?.caps?.[cap] === true;
}

/**
 * Đọc jsonb thô của `my_nhipphach_caps()` thành thứ dùng được, bỏ mọi khoá lạ.
 *
 * Máy chủ trả thừa hay thiếu đều không được làm client tin nhầm: chỉ nhận đúng
 * danh sách quyền đã biết, và chỉ nhận giá trị boolean `true`.
 */
export function parseCaps(raw: unknown): CapState {
  if (!raw || typeof raw !== "object") return NO_CAPS;
  const o = raw as Record<string, unknown>;
  const role = o.role;
  const caps = (o.caps ?? {}) as Record<string, unknown>;
  const sach: Partial<Record<Capability, boolean>> = {};
  for (const c of NHIPPHACH_CAPS) if (caps[c] === true) sach[c] = true;
  return {
    role:
      role === "student" || role === "teacher" || role === "admin"
        ? role
        : "guest",
    caps: sach,
  };
}

/**
 * Quyền Admin CHƯA mở được ở Giai đoạn 12 vì backend còn chặn.
 *
 * `nhipphach_presets` và `nhipphach_jobs` vẫn có RLS `is_teacher()`. Bật cờ cho
 * học viên lúc này chỉ tạo ra nút bấm rồi API trả lỗi — nên trang quản trị khoá
 * hẳn hai ô đó lại thay vì để thầy bật nhầm.
 */
export const KHOA_CHO_HOC_VIEN: readonly Capability[] = ["presets", "history"];

export const isKhoa = (role: string, cap: Capability): boolean =>
  role === "student" && KHOA_CHO_HOC_VIEN.includes(cap);

/** Tên tiếng Việt của từng quyền, dùng chung cho trang quản trị. */
export const CAP_LABEL: Record<Capability, string> = {
  access: "Sử dụng công cụ",
  advanced: "Thiết lập nâng cao",
  "export.pdf": "Xuất PDF",
  "export.png": "Xuất PNG",
  "export.svg": "Xuất SVG",
  "export.beatmap": "Tải beat-map JSON",
  batch: "Xử lý nhiều bài",
  presets: "Mẫu trình bày",
  history: "Lịch sử xử lý",
};
