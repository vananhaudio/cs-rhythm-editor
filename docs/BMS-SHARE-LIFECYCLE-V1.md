# BMS Share Lifecycle V1 — một nút "Chia sẻ", một bài = một đối tượng

Nguyên tắc kiến trúc: **Lưu nội dung ≠ Phân phối nội dung.** Một object được lưu trước, rồi mới được phân phối:
riêng cho một hoặc nhiều người qua Chat, hoặc cho cộng đồng. V1 chỉ triển khai BMS; mô hình là nền cho các object khác sau này.

```
bản nháp local ──(Gửi cho bạn bè)──▶ lưu riêng (shared) ──(Đăng lên cộng đồng)──▶ cộng đồng (class)
                                         │  gửi thêm bạn khác: dùng lại chính nó        │ gửi bạn: chỉ gửi tham chiếu
                                         └─ chủ bài gỡ: artifact xoá, tin Chat còn      └─ giữ semantics gỡ hiện tại
```

## UX (người dùng chỉ thấy)

`Chia sẻ` → sheet:
- **Gửi cho bạn bè** — *Gửi riêng qua Chat* → (tự lưu riêng nếu chưa có) → chọn bạn → gửi.
- **Đăng lên cộng đồng** — *Chia sẻ để mọi người trong Class cùng xem* → nâng cấp chính bài đã lưu (không tạo bản sao) + một bài trên Feed.

Chỗ đặt: bước cuối "Nghe thử" của trình dựng BMS · trang xem bài (`/song-builder?artifact=`) · card BMS trên Feed (ở đây chỉ còn gửi bạn nên mở thẳng chọn bạn).
Chỉ còn một lựa chọn (bài đã đăng, hoặc người xem) → vào thẳng chọn bạn, không hiện menu một mục.
UI không hiện các từ artifact / shared / class / promote.

## Dữ liệu

`tool_artifacts.visibility`:
| Giá trị | Ai đọc được | Feed |
|---|---|---|
| `shared` (riêng tư) | chủ bài + người ĐÃ NHẬN qua DM (tin share do **chính chủ bài** gửi) | không có bài |
| `class` | thành viên Class (như trước) | có bài `tool_share` |

Không thêm bảng. Thêm: CHECK `visibility in ('class','shared')`, chỉ mục `dm_messages_ref_idx` (tra người nhận), chỉ mục unique `class_posts_tool_artifact_once` (tối đa một bài Feed / artifact).

### RPC (`db/bms_share_lifecycle_v1_setup.sql`, SECURITY DEFINER, `search_path` rỗng, chỉ `authenticated`)
- `bms_save_for_share(p_song)` → artifact id. Server chuẩn hoá bằng `bms_song_normalize`, rồi tìm artifact CÙNG chủ bài + CÙNG nội dung (`data = chuẩn hoá`, shared hoặc class) → dùng lại; không có → tạo `shared`. Khoá advisory theo (chủ bài, hash nội dung) → bấm đúp / hai phiên song song vẫn **một** artifact. Giới hạn 30 bài riêng mới / giờ.
- `social_publish_tool_artifact(p_id)` → id bài Feed. Chỉ chủ bài, chỉ BMS (V1). Khoá advisory theo artifact; promote `shared → class` trên **chính** artifact và tạo đúng **một** bài Feed (đã có bài thì trả bài đó). Lỗi "không phải chủ" ≡ "không tồn tại" (không lộ).
- `dm_artifact_granted(p_id)` — dùng cho policy đọc: "tôi là người tham gia hội thoại có tin share trỏ tới artifact này do chính chủ bài gửi". SECURITY DEFINER vì `dm_*` đóng với client; chủ bảng không bị RLS ⇒ không đệ quy giữa `tool_artifacts` ↔ `dm_*`.
- Policy `tool_artifacts_read` đổi bằng `ALTER POLICY` (không `CREATE POLICY` ⇒ không dính khoá `auth.users`/storage — đã kiểm bằng `pg_locks` trong test): chủ bài · `class` + thành viên · `shared` + thành viên + `dm_artifact_granted`.
- KHÔNG đổi: `social_share_tool_result` (md5 ghim), `dm_share`/`dm_append`/`dm_messages`/`dm_rule`, `social_delete_tool_artifact`, dữ liệu hiện có.

### Idempotency / concurrency
| Tình huống | Cơ chế |
|---|---|
| Bấm đúp "Gửi cho bạn bè" | client chặn + server: khoá advisory + tìm theo nội dung → một artifact |
| Gửi riêng rồi đăng (cùng nội dung, kể cả phiên/thiết bị khác của cùng chủ bài) | save trả CÙNG id → publish promote chính id đó |
| Đăng hai lần / song song | khoá theo artifact + chỉ mục unique → một bài Feed |
| Sửa nội dung (kể cả tên) rồi chia sẻ | nội dung mới = bài mới (đúng ngữ nghĩa "phiên bản") |
| Client cũ dùng RPC đăng cũ | vẫn chạy (artifact `class` + bài Feed); publish sau đó trả đúng bài Feed có sẵn |

## Quyền & riêng tư

- Gửi artifact `shared` = **grant** cho người nhận (tin DM do chủ bài gửi). Người chưa nhận — kể cả Thầy/admin và thành viên Class khác — không đọc được, không liệt kê được.
- Huỷ kết bạn: không gửi thêm được (`dm_rule`); người đã nhận **vẫn mở được**, lịch sử Chat còn.
- Người nhận **không forward** artifact `shared` (`dm_share` chỉ cho chủ bài hoặc artifact `class`; tin giả do người khác chèn không cấp quyền — đã test).
- Gửi bài `class` cho bạn: chỉ tham chiếu, không đổi visibility.
- Người nhận bài riêng không thấy `Chia sẻ`/`Gỡ`; chỉ luyện.

## Gỡ bài — "Gỡ khỏi cộng đồng" ≠ "Xoá"

Nguyên tắc: **Object ≠ nơi phân phối object.** Một artifact có thể được phân phối qua DM và/hoặc Feed; gỡ khỏi một nơi không mặc định xoá object.

| Hành động | Artifact | Kết quả |
|---|---|---|
| **A.** `Gỡ khỏi cộng đồng` — bài `class` ĐÃ TỪNG được chủ bài gửi qua DM | giữ nguyên id | xoá bài Feed · hạ `class → shared` · người đã nhận vẫn mở được · thành viên Class khác không đọc được ngay lập tức · tin DM còn · đăng lại được trên chính artifact |
| **B.** `Gỡ khỏi cộng đồng` — bài `class` CHƯA từng gửi DM | xoá | xoá bài Feed + artifact (không để object mồ côi), như hành vi cũ |
| **C.** `Gỡ bài bài riêng` (chủ chủ động xoá bài `shared`) | xoá | tin DM giữ nguyên, card → "Nội dung này không còn khả dụng"; người nhận không mở được nữa |
| Bài riêng chưa đăng + `Gỡ khỏi cộng đồng` | giữ | không làm gì (không xoá bài riêng) |

- Hàm nội bộ `tool_artifact_demote_or_delete(id, owner)` quyết định A/B ở **server**: "đã từng gửi" = có tin DM trỏ tới artifact do **chính chủ bài** gửi (đọc `dm_messages` bằng SECURITY DEFINER; client không có quyền đọc `dm_*`). Tin do người nhận forward (artifact `class`) không tính là grant.
- Luật này áp cho CẢ HAI đường: RPC `social_unpublish_tool_artifact(id)` (trả `'private'` | `'deleted'`, idempotent) và **xoá bài Feed trực tiếp** (trigger `class_posts_tool_artifact_cleanup` đổi sang gọi hàm trên; trước đây luôn xoá artifact làm hỏng card Chat đã gửi).
- Khoá advisory cùng khoá với `social_publish_tool_artifact` → đăng / gỡ đua nhau không để trạng thái nửa vời (đã test: 3 phiên × 25 thao tác ngẫu nhiên, trạng thái luôn nhất quán: `class ⇔ có đúng 1 bài Feed`, `shared ⇔ 0 bài`, không mồ côi).
- `social_delete_tool_artifact` KHÔNG đổi (xoá chủ động: artifact + bài Feed; tin Chat luôn còn). UI dùng nó chỉ cho "Gỡ bài" của bài riêng.
- Gỡ khỏi cộng đồng ≠ thu hồi grant: người đã nhận qua DM giữ quyền mở (kể cả sau unfriend).

## Kiểm thử

| Gate | Lệnh | Kết quả (08/10) |
|---|---|---|
| DB lifecycle + hồi quy + đồng thời + rollback | `bash scripts/test-bms-share-lifecycle-db.sh` | 89 kiểm tra lifecycle · hồi quy 56 V1b · 89 V1a · 37 BMS Artifact · 39 Nhịp & Phách · đồng thời (save/publish; đăng/gỡ đua nhau) nhất quán · rollback ×2 về đúng md5 production |
| Unit/render | `npm run test:class-social` | 280/280 |
| E2E lifecycle (Chrome thật) | `bash scripts/e2e-bms-share-lifecycle.sh` | 10 kịch bản (gồm gỡ khỏi cộng đồng A/B) |
| E2E V1b | `bash scripts/e2e-chat-share-v1b.sh` | 12/12 PASS |
| E2E V1a trên DB+FE mới | `CHAT_V1B=1 bash scripts/e2e-chat-v1.sh` | 19/19 PASS |
| E2E nền (toàn bộ, gồm luồng BMS mới) | `bash scripts/e2e-learning-thread.sh` | 75 PASS (script tự nạp DB lifecycle khi không truyền `E2E_PRE_SQL`) |

## Phát hành (CHƯA duyệt)

1. `prod-db.py query db/bms_share_lifecycle_v1_preflight.sql` → GATE PASS (đã chạy read-only: PASS).
2. `dryrun` → `migrate db/bms_share_lifecycle_v1_setup.sql` → `query db/bms_share_lifecycle_v1_postflight.sql` → GATE PASS. DB trước, frontend sau (frontend cũ không bị ảnh hưởng: policy/RPC cũ giữ nguyên hành vi).
3. Rollback: revert frontend. `db/bms_share_lifecycle_v1_rollback.sql` trả policy/check/RPC về baseline; còn artifact `shared` thì giữ check và artifact (chỉ chủ bài đọc được), không xoá dữ liệu/tin.
