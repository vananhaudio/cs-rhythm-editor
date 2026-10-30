# Class Web/Mobile 1.6 + Thông báo V3 — nghiệm thu và kế hoạch phát hành

Nhánh: `integrate/class-mobile-1.6-notices` · PR #39 (Draft) · Trạng thái: **sẵn sàng chờ Owner duyệt phát hành**.
Tài liệu này không chứa khoá, dữ liệu hay hạ tầng production.

## 1. Phạm vi
Class Mobile 1.6 (Capacitor) + Lát 1 (tách Thông báo/Trò chuyện) + Lát 2/V3 (nộp bài, nhận xét, ĐẠT, NỘP LẠI) + bản vá rollback V3 + giao diện Thông báo kiểu Facebook (popover desktop, trang `/me/notices`, màn toàn trang trên Mobile) + Student 360 P2 (đã gộp từ `main`).

## 2. Hành vi Thông báo đã chốt
- Hàng gọn: biểu tượng + nhãn loại (Nộp bài / Nộp lại / Nhận xét / ĐẠT / NỘP LẠI / Đã chấm) + nội dung + thời gian + chấm chưa đọc; mới nhất ở trên. Không tạo avatar/tên người gửi (dữ liệu hiện không có).
- Badge Thông báo và Trò chuyện độc lập.
- **Mở popover/trang KHÔNG đánh dấu đã đọc.** Đánh dấu khi người dùng chọn một thông báo hoặc bấm "Đánh dấu tất cả đã đọc". Đóng không đổi trạng thái.
- Đọc theo **con trỏ** `last_read_seq` (server, chỉ tăng): chọn thông báo N = đã đọc tới N (gồm cả cũ hơn); thông báo mới hơn N vẫn chưa đọc. Không mất thông báo cũ.
- Deep-link Learning Thread + `focus` giữ nguyên (Web đọc `?focus=`, Mobile đi theo view state).

## 3. Giới hạn đã biết / cần Owner quyết
- **Đọc từng thông báo độc lập** (chọn thông báo cũ mà không đánh dấu các thông báo cũ hơn nữa) cần schema mới (bảng đọc theo `notice_id`) → thay đổi database production, KHÔNG làm khi chưa được duyệt. Phương án đề xuất: thêm bảng `class_system_notice_item_reads(user_id, seq)` + sửa 2 RPC `class_system_notices`/`class_system_notice_summary` tính `unread` theo bảng này; rollback = khôi phục 2 RPC. Hiện tại con trỏ đủ dùng.
- Avatar/tên người thực hiện: cần thêm trường vào RPC (cũng là thay đổi DB). Chưa làm.

## 4. Bằng chứng kiểm thử
Tự động: tsc, class-social 416, class-mobile 37, student360 26, ios-payment 8, class-safety 8, route-guard 22, og 68, `npm run build`; DB trên PostgreSQL tạm (`scripts/test-class-system-chat-db.sh`) ALL DB PASS gồm V2→V3→rollback→V3.
Chưa kiểm thực tế bởi người: giao diện trên trình duyệt/iPhone, vòng nghiệp vụ nộp bài → nhận xét → NỘP LẠI → nộp lại → ĐẠT bằng tài khoản thử, tương tác TeamLab/UGC Safety/IAP trên thiết bị.

## 5. Phát hành (mỗi bước cần Owner duyệt)
**A. Web.** Merge PR #39 vào `main` (Netlify tự deploy). DB V3 đã chạy trên production trước đó → không cần migration. Trước merge: Owner nghiệm thu vòng nghiệp vụ bằng tài khoản thử. 
**Rollback Web:** deploy lại bản `main` trước merge (ghi lại deploy id/commit `6e421f8c`) hoặc revert merge commit. Frontend cũ vẫn hiển thị `teacher_commented` bằng "Xem chi tiết".
**Rollback DB (chỉ khi bắt buộc):** `db/class_system_chat_v3_rollback.sql` — chỉ thay hàm trigger về V2, giữ dữ liệu và CHECK; cần Owner duyệt riêng.

**B. iOS.** Nhánh có sẵn `MARKETING_VERSION 1.6.0`, `CURRENT_PROJECT_VERSION 26`. Chưa xác minh được build 26 đã tải lên App Store Connect/TestFlight hay chưa (không có quyền). Nếu build 26 đã tải lên mà nội dung thay đổi so với nay → dùng **build 27**; nếu chưa tải lên → có thể dùng 26. Quy trình: `npm run build` → `npx cap copy ios` → Xcode Archive → Upload → TestFlight → gửi duyệt. Nhớ: app là BUNDLED, web deploy không cập nhật app cài sẵn.
**C. Android.** `android/app/build.gradle` vẫn `versionCode 13` / `versionName "1.4.2"` — chưa nâng. Cần đặt `1.6.0` và `versionCode` = 14 (hoặc cao hơn bản đã có trên Google Play), `npx cap copy android`, build AAB, thử nội bộ, rồi đưa lên production track.
**Thứ tự đề xuất:** Web (sau nghiệm thu) → TestFlight/Internal testing → gửi duyệt iOS + Android.

## 6. Kiểm tra trước phát hành (Owner/QA)
Xem checklist ở báo cáo C1.5: popover, Escape/bấm ngoài, "Xem tất cả", chọn thông báo mở đúng thread + `focus`, "Đánh dấu tất cả đã đọc", iPhone safe area, vòng nghiệp vụ với tài khoản thử, regression TeamLab/UGC Safety/IAP.
