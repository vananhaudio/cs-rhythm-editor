# Share Note V1 — "Chia sẻ tức thì" từ bản nhạc giáo trình (LessonScore)

Học viên đang đọc bản nhạc trong trang Buổi chọn/khoanh **một ô hoặc một dải ô** → **Hỏi / Chia sẻ** → gửi bạn qua
**Trò chuyện** hoặc **đăng Feed** → người nhận mở **đúng bản nhạc, đúng đoạn** → **trả lời** (Trò chuyện / bình luận Feed).

Là phần mở rộng của Universal Share V1 (docs/CLASS-UNIVERSAL-SHARE-V1.md) — KHÔNG có hệ thống chia sẻ thứ hai.

## Nguyên tắc bất biến
Một asset gốc, nhiều tham chiếu. Bản nhạc gốc = `class_lesson_content.blocks[khối] #> đường dẫn` (alphaTex). Chia sẻ chỉ tạo
một hàng `share_notes` (≤ 1 KB): buổi · khối · đường dẫn (`{tex}` | `{layers,k,tex}` | `{pieces,k,tex}`) · sha256 của CHÍNH chuỗi
alphaTex (server tính) · dải ô (đánh số từ 1) · lời nhắn ≤ 500. Không ảnh, PDF, âm thanh, bản sao nhạc, không toạ độ pixel.

## Quyền (server quyết — `db/share_note_v1_setup.sql`)
| Mức | Ai |
|---|---|
| THẤY câu hỏi | tác giả · người trong hội thoại có tin share_note DO CHÍNH tác giả gửi · thành viên Class khi tác giả đã đăng Feed |
| MỞ bản nhạc tại đúng ô | (THẤY) + Thầy, hoặc có quyền giáo trình của lớp (`can_read_class_curriculum`) và buổi đã xuất bản |
| Gửi Chat / đăng Feed / gỡ | chỉ tác giả (không chuyển tiếp) |

`share_note_open` trả `ok` (khối + đường dẫn + dải ô) · `stale` (bản nhạc đã đổi — KHÔNG trả vị trí ⇒ không thể tô sai) ·
`no_access` (thấy câu hỏi, không mở được bản nhạc) · 0 hàng = "không còn khả dụng" (không phân biệt lý do).
Bảng `share_notes` đóng (RLS bật, 0 policy, không grant; nằm trong `self_managed` của `rls_setup.sql`).

## Frontend
- `src/lesson/ScoreShareLayer.tsx` + `scoreShare.ts` (lõi thuần) — lớp "Khoanh để hỏi" trên LessonScore; vùng tô tính lại từ
  `api.renderer.boundsLookup` (alphaTab 1.8.3) sau MỖI lần khắc. Chế độ Khoanh bật bằng nút; tắt thì cuộn/chụm phóng như cũ.
- `src/lesson/scoreShareSlot.ts` — chỉ trang Buổi (/me) cấp; trang công khai / in / Admin KHÔNG có lớp khoanh.
- `src/share/shareNoteApi.ts`, `ShareNoteComposer.tsx`, `shareNoteLink.ts` (`/me/classes/<lớp>/sessions/<buổi>?note=<id>`),
  resolver thẻ Chat (`refCards.ts`), thẻ Feed (`toolshare/registry.ts`, tool `share_note`).

## Kiểm thử
- DB: `bash scripts/test-share-note-db.sh` — cổng tĩnh, khoá, migration ×2, drift, 74 kiểm tra theo identity, đua 12 phiên,
  rollback ×2 về đúng md5 `dm_share` LIVE (202766fc…), giữ dữ liệu, cài lại.
- Đơn vị: `npm run test:class-social` (tests/class-social/share-note.test.tsx).
- E2E (DB tạm, Chrome + WebKit): `PUPPETEER_DIR=… PLAYWRIGHT_DIR=… bash scripts/e2e-share-note.sh`.

## Phát hành (cần Owner duyệt từng bước)
1. DB trước: `prod-db.py` preflight (md5 `dm_share` = 202766fca632bc9cf22d092b07f0251b, CHECK chưa có share_note) →
   dryrun → migrate `db/share_note_v1_setup.sql` → postflight. Không khoá auth.users / class_posts / giáo trình.
2. Frontend (web) sau. App iOS/Android đóng gói sẵn web → tính năng chỉ tới app khi phát hành bản native mới.
3. Rollback: frontend trước, rồi `db/share_note_v1_rollback.sql` (giữ tin Chat + note; dm_share về đúng md5 LIVE).

## Giới hạn V1
- Hỏi Thầy qua Trò chuyện chỉ khi Thầy là bạn bè (dm_rule hiện tại). Nhánh Thầy↔học viên (GĐ3) chờ Owner duyệt.
- Chưa vẽ tay trong một ô; chưa thử trong khung "Xem lớn"; chưa có thao tác bàn phím; chưa nghiệm thu iPhone/Safari iOS thật.
