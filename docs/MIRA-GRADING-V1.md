# Mira cạnh màn chấm bài — V1 (CHƯA phát hành)

Trạng thái: nhánh `feat/mira-grading-dock` (Class) + `feat/class-grading-dock` (repo private `mira`). **Chưa migration, chưa merge, chưa deploy.**
Chạy thử cục bộ: `MIRA_PREVIEW_HOLD=1 MIRA_DIR=~/App/mira-grading bash scripts/e2e-mira-grading.sh` (dữ liệu giả).

## Nguyên tắc (Owner chốt)
Mira chỉ hỗ trợ trao đổi — không chấm, không sửa điểm, không viết/gửi nhận xét. Không chatbot mới, không nhân đôi hồ sơ, không phụ thuộc cứng CRM.
Quyền Teacher All Classes giữ nguyên. Hội thoại lưu tối đa 90 ngày. Giảm dữ liệu gửi OpenAI. Chưa làm iOS riêng.

## Luồng và quyền
1. Class (JWT của Thầy) gọi `mira_grading_ticket(thread)` → vé ngẫu nhiên 5 phút, gắn (Thầy, bài trả); DB chỉ lưu băm.
2. Class gửi iframe Mira `{mã bài trả, vé}` (giao thức `mira-context` v1, đích origin Mira). Không access token, không nội dung học viên.
3. Máy chủ Mira gọi `mira_grading_context(vé, nguồn)` bằng khoá anon + header `x-mira-grading-key`. DB đòi cả khoá lẫn vé, kiểm Thầy còn vai, trả dữ liệu cố định chỉ đọc cho ĐÚNG bài trả đó.
4. Mira ẩn tên học viên/email/số điện thoại trước khi gửi OpenAI (`store:false`, không công cụ, không DeepSeek), khôi phục tên thật ở câu trả lời.
5. Lưu: cuộc theo Thầy (`chat_conversations`, channel `class-grading`), phiên tất định UUID v5 theo (Thầy, bài trả), tin ở `conversations`. Không lưu khối ngữ cảnh, không chạm `people`/`memories`.

## Hai bảng, ba RPC mới của Class (`db/mira_grading_v1_setup.sql`)
| Đối tượng | Quyền | Ghi chú |
|---|---|---|
| `mira_grading_keys` | RLS bật, 0 policy, REVOKE hết, nằm trong `self_managed` của `rls_setup.sql` | chỉ băm khoá Mira |
| `mira_grading_tickets` | như trên; **không FK** (không khoá `auth.users`/`learning_threads`) | chỉ băm vé, 5 phút, dọn khi cấp vé kế tiếp |
| `mira_grading_ticket(uuid)` | authenticated; `is_teacher()`; ≤ 240 vé/giờ/Thầy | SECURITY DEFINER, search_path rỗng |
| `mira_grading_end(uuid)` | authenticated; chỉ xoá vé của chính mình | |
| `mira_grading_context(text,text)` | **chỉ anon**; đòi khoá + vé; STABLE (chỉ đọc) | 3 nguồn: thread, curriculum, student360 |
Ảnh hưởng hệ thống hiện có: thêm đối tượng mới, không đổi bảng/hàm Class nào (test khẳng định md5 hàm không đổi); migration không giữ khoá ghi lên bảng Class nào (đo bằng `pg_locks`, có đối chứng dương); sửa `rls_setup.sql` chỉ thêm 2 tên vào danh sách tự quản.
Rollback: `db/mira_grading_v1_rollback.sql` (drop 3 hàm + 2 bảng; idempotent; test ×2 + cài lại). Hệ quả: vé đang sống mất hiệu lực, khung Mira báo "chưa sẵn sàng", màn chấm bài không ảnh hưởng.

## Chính sách dữ liệu
- Tối đa 90 ngày: Netlify scheduled function `grading-purge` (03:17 VN mỗi ngày) → `POST /api/grading/purge` (Bearer `GRADING_PURGE_TOKEN`; thiếu biến → 503, không làm gì).
- Phạm vi xoá: tin `class-grading` quá hạn → phiên của kênh này đã hết tin và quá hạn → cuộc của kênh này đã hết phiên và quá hạn. Không đụng kênh khác, `people`, `memories`.
- Thầy xoá sớm: nút "Xoá trao đổi bài này" (hai lần bấm) chỉ xoá phiên của bài đang mở.
- Vé/khoá: chỉ băm; vé hết hạn dọn ở lần cấp kế tiếp.

## Trình tự bật thật (mỗi bước chờ Owner duyệt)
1. Owner đặt mật khẩu Keychain: `sh scripts/prod-db-keychain-init.sh` (ở `cs-rhythm-editor-wip`), rồi tôi chạy `prod-db.py query db/mira_grading_v1_preflight.sql` → GATE = PASS.
2. `dryrun` → `migrate db/mira_grading_v1_setup.sql` → `query db/mira_grading_v1_postflight.sql` → GATE = PASS (KEY = chưa đặt khoá).
3. Owner sinh khoá ngẫu nhiên 32 byte; đặt `MIRA_GRADING_KEY` (Netlify Mira) và `GRADING_PURGE_TOKEN`; chèn băm: `insert into public.mira_grading_keys (key_hash) values ('<sha256 hex>')` (qua `migrate` một file một dòng). Postflight KEY = đã đặt khoá.
4. Merge nhánh Mira vào `main` (deploy Netlify) — kênh tuyển sinh/Facebook không đổi (có test).
5. Build Class với `VITE_MIRA_GRADING_URL=https://mira-vananhaudio.netlify.app/grading` (trống = tắt).
Rollback nhanh: bỏ biến `VITE_MIRA_GRADING_URL` (Class tắt), hoặc thu hồi băm khoá (`revoked_at`), hoặc `mira_grading_v1_rollback.sql`.

## Test
`npm run test:db-mira-grading` (58) · `npm run test:mira-grading` (16) · `npm run e2e:mira-grading` (30, Chrome thật + Mira thật) · Mira: `npm run test:grading` (34).
