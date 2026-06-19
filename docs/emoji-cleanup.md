# Dọn emoji UI — audit & quyết định (2026-06-19)

Sinh từ workflow đa-agent. Đợt "DỌN NGAY" đã áp (commit refactor(ui)). Phần "ĐỂ LẠI" dành cho ngày làm bộ icon line chính thức — swap một lượt cho đồng bộ.

## ✅ ĐÃ DỌN (mặt học viên — bỏ emoji trang trí + nhãn section, giữ chữ)
MobileStudentPortal, StudentPortalV2, StudentOnboarding, FlowPlayer, SupportFlow, ElearnLessonView, guitarRenderers, LessonViewerPage, TapTempoTool, TapWithSong.
Ví dụ: 👋 "Xin chào", 🗺️ "Hành trình", 📅 "Nhịp luyện tập", 🔥 streak/XP, 🎉 màn hoàn thành, 🎯/✋/📚/🧭 nhãn section, avatar/chip trang trí.

## ⏳ ĐỂ LẠI CHO NGÀY LÀM ICON (đừng đụng lẻ — swap cả set)
- **Bottom nav mobile** (Học/Tập/Sống: 📖🎯✨) + **nav admin/desktop** (👥📚🛠🌱🎓...).
- **Thẻ công cụ & icon loại bài** lấy từ DB: `edu_tools.icon`, `edu_courses.icon`, `TOOL_LABELS`, `LESSON_TYPES`, `SLIDE_TYPES` → sửa ở DB + đồng bộ cả set.
- **Badge cấp độ & danh hiệu**: `ARTIST_LEVELS`, `HONOR_CONFIG` (🥉🥈🥇💎👑), medal top 3.
- **Nút CHỈ-icon** (không có chữ → KHÔNG bỏ kẻo trống): 🔍 search, ⚙️ settings, 📷 avatar, 🎙🔊 Tuner, nav TapWithSong, ☀️🌙 theme.
- **Callout & tool card trong Flow**: 🎚️ guitar_tool, 🧭 support, ⚠️/💡 callout, cụm nút SupportFlow (😣🔍🔎🤖✍️💬) — xử lý cùng lúc.
- **Mặt admin/soạn bài** (TeacherAdminPage, ToolsManager, CourseEditor, FlowInlineEditor: 💾📥✨👁📁) — ưu tiên thấp, để chung đợt admin.

## 🔒 GIỮ NGUYÊN (glyph chức năng — KHÔNG đụng)
Mũi tên `← → ‹ › ↗ ↑ ↓ ▶ ⏸ ↺ ▲ ▼` · đúng/sai `✓ ✗ ✅ ❌` · đóng/xóa `✕ × ⊕` · chấm/sao trạng thái `● ★ •` · cảnh báo modal `⚠️` · vặn khóa Tuner `⬆️⬇️` · 🔒 khóa · 🔊 phát âm · dữ liệu thầy chọn (emoji logo khoá, MOOD_EMOJI thang cảm xúc).

## Lưu ý kỹ thuật
- `LOGIC_META.icon` trong FlowPlayer = dead code (header render chấm màu) — bỏ qua.
- FlowManager.tsx, ElearnLessonsManager.tsx = dead code (đã gỡ khỏi menu) — xoá file được sau khi chắc.
