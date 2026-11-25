# TVA Guitar 1.6.2 — ma trận phụ thuộc migration/RPC (05/11/2026)

Nhánh `release/tva-guitar-1.6.2` = `release/tva-guitar-1.6.1` (4c0db3e8) + `origin/main` 59cc4983. Chưa push. 1.6.1 giữ nguyên.

Production đã đối chiếu bằng prod-db.py query (BEGIN READ ONLY…ROLLBACK) ngày 05/11/2026, theo phê duyệt của Owner.

| Tính năng (main) | RPC/bảng FE gọi | Production (read-only 05/11) | Phân loại |
|---|---|---|---|
| Feed Thích/Bình luận/Chặn/Báo cáo | feed_like_set, feed_comment_add/delete/report, bảng feed_likes/feed_comments, trigger feed_comment_notify, CHECK kind có feed_comment | Có đủ | Đủ điều kiện |
| Chat List V2 | chat_inbox (8 tham số, khớp repo), chat_inbox_base, chat_inbox_summary, chat_pin_set, chat_conversation_info, chat_fold, bảng chat_pins | Có đủ | Đủ điều kiện |
| G3 thẻ Ôn nhanh | social_feed / social_feed_scoped (định nghĩa chứa lesson_clip), social_feed_clip_items, social_clip_added_at | Có; hash social_feed 21891915 ≠ hash ghi 01/11 (2697eb50) → đã đổi, khớp việc G3 đã áp | Đủ điều kiện |
| Share Note / Contextual Share | share_note_card(_v2), share_note_create, share_note_open(_v2), share_note_session_open, share_text_* (13 hàm), social_share_share_note/text, bảng share_notes (cột ctx_sha) | Có đủ, chữ ký khớp repo | Đủ điều kiện (chưa nghiệm thu thao tác thật) |
| Mira chấm bài (web, tắt trên native) | mira_grading_* , mira_student_*, ai_consent_*, bảng mira_* | Có đủ (gồm curriculum_data = V2, pilot) | Đủ điều kiện, không ảnh hưởng native |
| Vá TapWithSong | app_user_names(uuid[]) | Có | Đủ điều kiện |
| Notify V2 | trigger feed_comment_notify, class_post_comment_notify | Có | Đủ điều kiện |

**Kết quả đối chiếu tổng:** cả 97 tên RPC mà FE 1.6.2 gọi đều tồn tại trong schema public production (0 thiếu). Chữ ký chat_inbox/share_note_create/share_text_create khớp repo. Giới hạn: chỉ so tên + chữ ký + dấu hiệu nội dung; chưa so từng thân hàm với file setup, nên "tồn tại" chưa đồng nghĩa "nghiệm thu".

## Đã kiểm trên nhánh này
tsc -p tsconfig.app.json OK · test:class-social 556/556 · class-mobile 37/37 · class-safety 8/8 · ios-payment 8/8 · og 68/68 · mira-grading 49/49 · `npm run build` OK.
Xung đột đã giải: Chat.tsx, InboxList.tsx, chat-preview/main.tsx (lấy Mira/nút loa/searchrow của main), classMobileLight.css (giữ khối danh sách phẳng 1.6.1).
E2E (DB tạm, Chrome 390px): Feed Comments TẤT CẢ PASS (18/18). Feed Likes: 6 PASS rồi FAIL ở bước "giữ trạng thái đã xác nhận" (offline/lỗi). **Cùng bước đó cũng FAIL trên origin/main nguyên bản** (59cc4983) nên không do merge 1.6.2; mã Feed không bị sửa trong merge. Cần phiên Feed xem lại test hoặc hành vi.
WebKit (Playwright 1.49.1, WebKit 18.2, 390px, isMobile): bộ Like/Bình luận/Trả lời/Sửa/Xoá/Báo cáo/Chặn đạt 18/18 qua `scripts/e2e-feed-webkit.sh` (chuyển từ run-feed-comments). Lưu ý: bước Chặn ghi thẳng bảng chặn như bản Chrome (không bấm nút Chặn); WebKit Playwright ≠ Safari iPhone thật nên vẫn cần nghiệm thu máy thật.
Version: Android 1.6.2 / versionCode 17; iOS 1.6.2 / Build 33. Build thử chưa ký: iOS Release iphoneos BUILD SUCCEEDED (Info.plist 1.6.2 (33), bundle chứa feed_like_set + feed_comment_report); Android assembleDebug OK (cần ANDROID_HOME=~/Library/Android/sdk). Chưa có AAB/IPA ký, không upload.
