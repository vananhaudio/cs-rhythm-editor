# Class Page V2 — "Bản đồ sống của lớp"

`/me/classes/<id>` là cửa vào học tập chính. Con đường cố định (lần đầu = lần thứ 20):

```
/me → Lớp của tôi → bấm lớp → MỤC LỤC (học + bài trả) → bấm TÊN BUỔI → Trang Buổi → Nhịp → Bài trả
```

## Cấu trúc (một trang cuộn dọc, không tab, không card)
1. **Tên lớp** + một dòng gọn (lịch · khoá · Thầy).
2. **Mục lục** (`ClassMap`): chặng → buổi. Mỗi buổi: `01 · Tên buổi` (nút → Trang Buổi) + dòng phụ
   `Đang học · 1/3 bài trả Đạt`. Bấm "1/3 bài trả Đạt" → bung nhẹ từng bài trả với trạng thái
   **Chưa trả · Chờ Thầy · Cần làm lại · Đạt** (+ "Thầy đã phản hồi" khi Thầy trả lời mà chưa chấm).
   Bài đã có thread → mở đúng cuộc trao đổi; bài chưa trả → Trang Buổi tại đúng khối bài trả.
   Buổi chưa mở vẫn thấy tên + "Chưa mở". Chặng hiện tại mở sẵn; chặng khác thu gọn nhưng thấy tên + số buổi.
3. **Lớp mình đang học**: hoạt động học tập thật của lớp (`social_class_activity`), dòng gọn, không lặp tên lớp,
   bấm → cuộc trao đổi. "Xem thêm" nhẹ khi còn trang.
4. **Lớp mình · N thành viên** (cuối trang) → bung danh sách thành viên sẵn có (kết bạn, quyền riêng tư giữ nguyên).

## Không có (cố ý)
"Tiếp tục học" / "Học tiếp" / "Vào học" trên trang lớp · card "Đang học" · "Hoạt động gần đây" tóm tắt ·
"Xem toàn bộ giáo trình" · tab Học/Trả bài/Hoạt động · tự cuộn tới buổi hiện tại · XP/xếp hạng/%.
Bảng "Lớp của tôi" chỉ hiện buổi hiện tại là MỘT dòng trạng thái (không nút nhảy qua mục lục).

## Nguồn dữ liệu (không DB mới)
- Mục lục + bài trả của chính mình: `useClassLearning` → `class_learning_state` (chế độ checkpoint) hoặc
  giáo trình đọc qua RLS (chế độ chỉ giáo trình — không giả tiến độ). Một request, không N+1.
- Lớp không có bản đồ giáo trình: `class_learning_entry` → khoá học của lớp (`/course?id=`) hoặc
  "Chưa có giáo trình được gắn với lớp này." Người ngoài lớp: "Mục lục và bài trả hiện với thành viên của lớp."
- Thành viên: canonical (`docs/CLASS-MEMBERSHIP-CANONICAL.md`); quyền xem danh sách do server (`can_view_members`).

Code: `src/class-social/classes/ClassPage.tsx`, `ClassMap.tsx`, `classMapModel.ts`.
Test: `tests/class-social/my-classes-v2.test.tsx`, E2E `scripts/e2e-class-canonical.sh`.
