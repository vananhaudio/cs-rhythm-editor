# Class UX V3 — Learning Map + Bài trả của tôi + Không gian lớp

Trang lớp (`/me/classes/<id>`) = **không gian HỌC**, không phải Social. Con đường mòn giữ nguyên:
Lớp của tôi → Lớp (mục lục) → **bấm TÊN BUỔI** → Trang Buổi → Nhịp → Bài trả.

## Trang học của lớp
1. **Tên lớp + lịch** (nếu có). Không lặp tên khoá / Thầy / mã / sĩ số.
2. **Mục lục ↔ Bài trả của tôi**
   - Vùng nội dung ≥ 900px (desktop ~≥1180px): **master-detail** — mục lục trái (~62%), panel "Bài trả của tôi" phải (~38%),
     khung tối đa 1160px. Bấm "1/3 bài trả Đạt" = CHỌN buổi cho panel (không điều hướng). Mặc định panel = buổi hiện tại.
   - Hẹp hơn (mobile, tablet 768, desktop hẹp): một cột, bấm "1/3 bài trả Đạt" bung tại chỗ.
   - Không có bài trả (chế độ giáo trình) / không giáo trình (vd Z2): không master-detail giả.
   - Mục lục: cột số 01/02/…; tên buổi là trục riêng; buổi khoá = chữ nhạt + ổ khoá ("Chưa mở" cho trình đọc màn hình),
     chỉ buổi khoá đầu tiên có một câu gợi ý; dấu chân hiện tại = vạch xám nhẹ. Không "Đang học", không tím nghĩa nội dung.
   - Panel: Buổi NN · tên buổi (→ Trang Buổi) · "1/3 bài trả Đạt" · từng bài trả (Chưa trả / Chờ Thầy / Thầy đã phản hồi /
     Cần làm lại / Đạt). Có thread → cuộc trao đổi; chưa trả → Trang Buổi tại đúng khối bài trả. Không progress bar/%/XP.
3. **Cánh cửa "Không gian lớp"** — một lối nhẹ cuối trang, không preview feed.

## Không gian lớp — `/me/classes/<id>/space`
Feed của ĐÚNG MỘT lớp (`social_class_activity` + `ActivityLine`) + Thành viên (`social_class_members` + `MemberList`,
quyền xem do server `can_view_members`). Không hệ Social mới. "← <tên lớp>" về đúng trang học.
Hai phạm vi: Home → tab **Lớp** = hoạt động mọi lớp của tôi · Lớp → **Không gian lớp** = hoạt động của một lớp.

## Dữ liệu
Không DB mới. Mục lục + bài trả = `useClassLearning` (một `class_learning_state` / giáo trình qua RLS) — không N+1.
Code: `ClassPage.tsx`, `ClassMap.tsx`, `SubmissionsPanel.tsx`, `ClassSpacePage.tsx`, `ClassParts.tsx` (ClassSpaceDoor),
`resolveMeRoute.ts` (`classSpace`). Test: `tests/class-social/{my-classes-v2,classes}.test.tsx`, E2E `scripts/e2e-class-canonical.sh`.
