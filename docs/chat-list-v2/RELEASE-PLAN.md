# Chat List V2 — Kế hoạch phát hành (CHƯA THỰC HIỆN — dừng ở cổng phê duyệt production)

Nhánh `feat/chat-list-v2`. Migration: `db/chat_list_v2_{preflight,setup,postflight,rollback}.sql` (additive: 1 bảng `chat_pins` + 6 hàm `chat_*`; không sửa `dm_*`/`bandchat_*`/`teamlab_*`).

## Thứ tự bắt buộc: DB → Web → App
Frontend mới gọi RPC mới; nếu RPC chưa có, FE tự rơi về danh sách cũ (100 cuộc gần nhất, không ghim, có ghi chú). Bản app CŨ chỉ dùng RPC cũ nên không bị ảnh hưởng ở mọi bước.

## 1. Migration production (cần Owner duyệt; Owner nhập mật khẩu Keychain ở Terminal.app)
Công cụ: `~/Projects/cs-prod-db-infra/scripts/prod-db.py` (gọi tắt `P`), file ở `~/Projects/cs-chat-list-v2/db` (gọi tắt `D`).

1. `python3 $P identity`
2. `python3 $P query $D/chat_list_v2_preflight.sql` — GATE phải = PASS
3. `python3 $P dryrun $D/chat_list_v2_setup.sql` — BEGIN…ROLLBACK
4. `python3 $P migrate $D/chat_list_v2_setup.sql --confirm wojmdilyflffvdtpovmq`
5. `python3 $P query $D/chat_list_v2_postflight.sql` — GATE phải = PASS

Đối chiếu sha256 bằng `shasum -a 256` ngay trước khi chạy (xem commit cuối của nhánh).
Rollback: `migrate $D/chat_list_v2_rollback.sql --confirm …` (mất duy nhất danh sách ghim; không mất tin nhắn).
Khoá: chỉ tạo bảng mới + hàm; không CREATE POLICY ⇒ không dính khoá `auth.users/realtime/storage`.

## 2. Web
Sau khi postflight PASS: merge `feat/chat-list-v2` → `main` (Netlify production tự build cho Class). Smoke bằng tài khoản thật: Trò chuyện — tìm kiếm, lọc, ghim, Chưa đọc, gửi/nhận tin; Thầy: mục Quản lý Band. Rollback FE: revert merge (DB giữ nguyên, tương thích).

## 3. App (Capacitor `webDir: dist`, bundle nội trong app ⇒ cần build mới)
- Chỉ làm sau khi web + DB ổn; app cũ vẫn chạy bình thường (danh sách cũ).
- Dòng phát hành: nhánh này mang iOS 1.6.0 (build 26), trong khi đã có `release/class-mobile-1.6.0-build27/28` ⇒ build mới phải cắt từ dòng build28 (build 29) rồi merge Chat V2, KHÔNG cắt từ nhánh này. Android versionCode 13 / 1.4.2 cần đối chiếu.
- Không tự phát hành; ký và upload TestFlight/Store do Owner.

## Chưa kiểm chứng
Dữ liệu/quy mô production (số DM/Band thật) · iPhone/Safari thật · Android · hiệu năng trên Supabase thật (cục bộ: 1800 hội thoại, trang đầu ~314 ms).
