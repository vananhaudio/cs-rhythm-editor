# TVA Guitar 1.6.2 — ma trận phụ thuộc migration/RPC (05/11/2026)

Nhánh `release/tva-guitar-1.6.2` = `release/tva-guitar-1.6.1` (4c0db3e8) + `origin/main` 59cc4983. Chưa push. 1.6.1 giữ nguyên.

Trạng thái "Production" = **CHƯA XÁC MINH** (tài liệu trong repo viết trước khi chạy; truy vấn chỉ đọc production bị chặn quyền trong phiên này). Cột "Hậu quả nếu thiếu" là suy từ mã.

| Tính năng (main) | Migration | RPC/bảng FE gọi | Hậu quả nếu DB thiếu | Production |
|---|---|---|---|---|
| Chat List V2 | chat_list_v2 (db/) | RPC danh sách hội thoại con trỏ/tìm kiếm/ghim | danh sách Trò chuyện lỗi — **đã nằm trong 1.6.1** | ? |
| G3 thẻ Ôn nhanh | lesson_clip_card_v1_setup (+backfill) | social_feed* (hàm Feed bị thay) | thẻ clip không hiện / Feed lỗi | ? |
| Share Note / Contextual Share | share_note_v1, share_note_session_open_v1, share_text_v2 | share_note_card(_v2), share_note_create, share_note_open(_v2), share_note_session_open, share_text_create, social_share_share_note/text | nút chia sẻ/khung trích đoạn lỗi trên Feed | ? |
| Mira chấm bài (chỉ Thầy, web, mặc định TẮT, tắt hẳn trên native) | mira_grading_v1, _pilot_v1, _curriculum_v2 | mira_grading_ticket/end/pilot_enabled, mira_student_pilot_enabled, ai_consent_* | không ảnh hưởng native | ? |
| Vá TapWithSong | (RPC app_user_names, RLS P3-E) | app_user_names | tên người khác không hiện | ? |
| Notify V2 (thông báo bình luận) | feed_comment_notify_v2 | trigger phía DB | thiếu thông báo, không vỡ giao diện | ? |

## Cần Owner cho phép (1 bước, chỉ đọc)
Chạy `prod-db.py query` (BEGIN READ ONLY…ROLLBACK) để liệt kê hàm `public` theo tên ở bảng trên và md5 `social_feed`, `social_feed_scoped`. Không ghi gì. Kết quả quyết định tính năng nào được vào bản 1.6.2.

## Đã kiểm trên nhánh này
tsc -p tsconfig.app.json OK · test:class-social 556/556 · class-mobile 37/37 · class-safety 8/8 · ios-payment 8/8 · og 68/68 · mira-grading 49/49 · `npm run build` OK.
Xung đột đã giải: Chat.tsx, InboxList.tsx, chat-preview/main.tsx (lấy Mira/nút loa/searchrow của main), classMobileLight.css (giữ khối danh sách phẳng 1.6.1).
Chưa chạy: E2E Feed (cần Postgres/PostgREST tạm), WebKit/iPhone, build native ký số, repo-guard finish.
