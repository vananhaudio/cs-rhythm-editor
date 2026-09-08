/**
 * Luật vào route chỉ-dành-cho-thầy, viết lại nguyên văn luật đang chạy trong
 * `AppRouter.tsx`: vai trò lấy từ bảng `app_users`, `isTeacher = role === 'teacher'
 * || role === 'admin'`, và phải đợi phiên nạp xong (`loading`) rồi mới quyết.
 *
 * KHÔNG phải hệ auth mới: không thêm vai trò, không đọc nguồn khác, không tự cấp
 * quyền. Tách ra thành hàm thuần chỉ để test được ba nhánh unauth / thường / thầy.
 *
 * Fail-closed: đăng nhập rồi mà chưa đọc được `role` (lỗi mạng hoặc RLS) thì coi
 * như không đủ quyền — giống hệt hành vi sẵn có của các route thầy khác.
 */
export type TeacherRouteDecision = "wait" | "allow" | "redirect";

export function isTeacherRole(role: string | null | undefined): boolean {
  return role === "teacher" || role === "admin";
}

export function teacherRouteAccess(state: {
  loading: boolean;
  signedIn: boolean;
  role: string | null | undefined;
}): TeacherRouteDecision {
  // Chưa biết phiên → chưa quyết. Quyết sớm sẽ đá cả thầy ra khi mở thẳng URL,
  // khi F5 và khi bấm Back/Forward.
  if (state.loading) return "wait";
  if (!state.signedIn || !isTeacherRole(state.role)) return "redirect";
  return "allow";
}
