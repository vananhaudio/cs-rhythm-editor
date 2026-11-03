# Thẻ "Ôn nhanh" trên Feed /me (G3) — lesson_clip_card_v1

Trạng thái: **code + migration + test PASS trên DB/stack tạm. CHƯA migration production, CHƯA merge, CHƯA deploy. Chờ Owner duyệt.**

Context cần nó: học viên vắng/quên buổi, hoặc muốn ôn 2 phút trước buổi sau → thấy ngay trên `/me` rằng buổi của lớp mình có clip ôn nhanh và mở đúng chỗ.
Không phải object mới: clip là một **khối `video` trong giáo trình** (`class_lesson_content.blocks`, đã có RLS theo lớp — xem `GIAO-TRINH-CHUAN.md`). Video chỉ có MỘT bản (YouTube + khối giáo trình); thẻ chỉ **tham chiếu buổi học**.

## Hành vi
- Mỗi khối `kind:'video'` của giáo trình **đã xuất bản** (buổi `lesson`) có `added_at` hợp lệ = một thẻ `lesson_clip` trong `social_feed` ("Dành cho bạn").
- Payload CHỈ: `session_id, class_id, class_code, class_name, session_no, title (≤120), duration (≤20), added_at`. **Không** url / video id / note / blocks. Test quét payload + DOM + phản hồi RPC.
- Bấm "Xem clip" → `/me/classes/<class_id>/sessions/<session_no>` (Trang Buổi); video phát ở đó theo RLS giáo trình như cũ.
- Không Thích / Bình luận / Báo cáo: nội dung của Thầy, không tác giả, không UGC (`social_feed_safe` cho qua như `teamlab_publication`; Apple 1.2 không có bề mặt UGC mới). `feed_likes`/`feed_comments` KHÔNG thêm kind này.

## Quyền (kiểm từng dòng — hai hàm Feed là SECURITY DEFINER, cổng `is_class_member()` là toàn cục)
- Dòng chỉ vào khi `tva_private.can_read_class_curriculum(class_id)` (đúng vị từ RLS `class_lesson_content_student_read`) **và** `status='published'` **và** `event_type='lesson'`.
- `social_feed_scoped('my_classes')`: thêm điều kiện lớp ∈ lớp hiện tại của người xem; mảng lớp rỗng → 0 thẻ (không thành "mọi lớp"). `friends`: không có thẻ.
- Thu hồi quyền / gỡ xuất bản / nháp → thẻ biến mất ngay. Thầy chỉ thấy thẻ khi chính Thầy là thành viên có quyền giáo trình (đúng vị từ; kiểm bằng tài khoản thử học viên).
- **Lưu ý đã phát hiện khi làm E2E:** tab **"Lớp"** của giao diện hiện KHÔNG gọi `social_feed_scoped('my_classes')` mà ghép `social_class_activity` theo từng lớp. Nên thẻ chỉ hiện ở **"Dành cho bạn"**; tab "Lớp" không đổi hành vi (E2E khẳng định). Nhánh `my_classes` trong DB đã được test nhưng chưa có giao diện nào gọi. Muốn thẻ ở tab Lớp cần thêm nguồn vào `social_class_activity` (thay đổi riêng, cần đo md5 hàm đó + duyệt riêng).

## Sắp xếp ổn định
- `class_lesson_content` không có `published_at`; `updated_at` đổi mỗi lần sửa → **không dùng**.
- `sort_at` = `added_at` của khối (ISO UTC `…Z`). Công cụ chèn (`g2-insert-video`) ghi **một lần** khi chèn; chạy lại không đổi. Sửa/chèn khối khác trong buổi không đổi `sort_at` và khoá thẻ.
- Khoá thẻ `c:<session_id>:<md5(added_at|title)[0:10]>` — không dựa chỉ số khối.
- Không hiện: thiếu `added_at`, sai định dạng, ngày không tồn tại, **> 5 phút trong tương lai** (không "nổi" vĩnh viễn), quá **90 ngày**, tiêu đề rỗng. Giá trị hỏng chỉ làm mất đúng thẻ đó, không làm vỡ Feed (`social_clip_added_at` không ném lỗi).
- **Backfill một lần** cho khối đã xuất bản trước G3 (vd. HT2027.TH01 Buổi 7): `db/lesson_clip_card_v1_backfill_added_at.sql` — gắn `added_at = updated_at` của dòng, không đổi status/`updated_at`/khối nào khác, tự kiểm cuối file (sai → RAISE, huỷ transaction), idempotent. Không phải xuất bản lại bài học. Owner chạy riêng sau migration.

## Phạm vi thay đổi
| | |
|---|---|
| DB | `db/lesson_clip_card_v1_setup.sql`: thay `social_feed`, `social_feed_scoped` (create or replace ⇒ ACL giữ nguyên; nhánh cũ giữ nguyên từng dòng, chỉ thêm cột `payload` = null) + 2 hàm nội bộ `social_clip_added_at(text)`, `social_feed_clip_items(uuid[])` (REVOKE public/anon/authenticated). **0 bảng / cột / policy / trigger / chỉ mục / audience mới, không ghi dữ liệu.** |
| FE | `postModel.ts` (`LessonClipEntry`, `toLessonClipEntry`, nhánh `toFeedEntries`, `entryKey` tiền tố `c:`), `LessonClipCard.tsx`, `FeedEntryCard.tsx` (1 nhánh), `classSocial.css` (nút ≥ 44px), `lessonTypes.ts` (`added_at?`). FE cũ bỏ qua kind lạ ⇒ DB trước hay FE trước đều an toàn. |
| Công cụ | `g2-insert-video.mjs` (ngoài repo) ghi `added_at` một lần, idempotent. |

## Chống ghi đè hàm Feed khi production thay đổi
- md5 production đã xác minh 01/11: `social_feed` `2697eb50daaf7c085da22adaddc2baa2` = `db/social_feed_teamlab_publications_v2_setup.sql`; `social_feed_scoped` `47bf0f5f3382086d19ad6d0b184644cc` = `db/social_feed_v1_setup.sql` (tính lại từ file, khớp nguyên văn).
- Cổng đầu migration: md5 hiện tại ∈ {bản production trên, bản G3} hoặc `RAISE LESSON_CLIP_GATE_FAIL` và không ghi gì (test: sửa `social_feed`, sửa `social_feed_scoped`, thiếu `can_read_class_curriculum` → đều DỪNG).
- Trước ngày chạy: chạy `db/lesson_clip_card_v1_preflight.sql` (GATE=PASS, in md5) + `git fetch` xem main có migration mới định nghĩa hai hàm không. Lệch → **không tự gộp**: gộp lại khối `union all` lên bản mới + chạy lại test.
- Rollback `db/lesson_clip_card_v1_rollback.sql`: khôi phục NGUYÊN VĂN hai hàm gốc (kiểm md5 sau khi ghi), gỡ 2 hàm nội bộ; **cổng riêng**: nếu dự án khác đã đổi hai hàm sau G3 thì DỪNG, không ghi đè. Ưu tiên rollback FE trước (thẻ biến mất ngay, DB vô hại).
- Phương án dự phòng nếu NO-GO về hàm nóng: RPC riêng `class_recap_strip()` (không đụng `social_feed*`).

## Kiểm thử
| Gate | Lệnh |
|---|---|
| DB (PG17 tạm): nền khớp md5 production · cổng drift · migration ×2 · postflight · quyền theo lớp (for_you / my_classes / friends, hàm `_safe` THẬT trích từ UGC Safety) · payload sạch · sắp xếp ổn định · keyset · hồi quy loại Feed cũ (16 bộ người × góc nhìn, trang size 3) · backfill · hiệu năng · rollback ×2 + cổng | `bash scripts/test-lesson-clip-card-db.sh` |
| Unit/render | `npm run test:class-social` (`tests/class-social/lesson-clip-card.test.tsx`) |
| E2E Chrome 390px (DB tạm + PostgREST + vite) | `PUPPETEER_DIR=… bash scripts/e2e-lesson-clip.sh` |
| tsc / build | `npx tsc -p tsconfig.app.json --noEmit` · `npm run build` |

**Chưa nghiệm thu (cần tài khoản thật / thiết bị thật):** WebKit/iPhone thật, Class Mobile/TVA Guitar bản native, tài khoản thử đúng lớp + khác lớp trên production, đo md5 ngay trước migrate.
