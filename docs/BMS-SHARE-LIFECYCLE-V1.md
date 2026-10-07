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

## Gỡ bài

- Chủ bài gỡ artifact `shared`: artifact xoá; **tin Chat không bị xoá** (không FK) → card "Nội dung này không còn khả dụng"; người nhận không mở được nữa. Xác nhận 2 bước, nói rõ "Tin nhắn trong Chat vẫn còn".
- Artifact `class`: giữ semantics hiện tại (`social_delete_tool_artifact` xoá artifact + bài Feed). **Lưu ý còn mở:** xoá bài Feed (đường hiện có) kích trigger xoá artifact ⇒ các card đã gửi cho bạn cũng thành "không còn khả dụng". Đề xuất (chưa làm, cần Owner): khi bài Feed bị xoá mà artifact đã được gửi qua DM thì hạ về `shared` thay vì xoá.

## Kiểm thử

| Gate | Lệnh | Kết quả (08/10) |
|---|---|---|
| DB lifecycle + hồi quy V1b/V1a + đồng thời + rollback | `bash scripts/test-bms-share-lifecycle-db.sh` | 61 kiểm tra lifecycle · 56 V1b · 89 V1a · 3 phiên song song: 1 artifact, 1 bài Feed · rollback ×2 |
| Unit/render | `npm run test:class-social` | 279/279 |
| E2E lifecycle (Chrome thật) | `bash scripts/e2e-bms-share-lifecycle.sh` | 8 kịch bản |
| E2E V1b | `bash scripts/e2e-chat-share-v1b.sh` | xem báo cáo |
| E2E V1a trên DB+FE mới | `CHAT_V1B=1 bash scripts/e2e-chat-v1.sh` | xem báo cáo |

## Phát hành (CHƯA duyệt)

1. `prod-db.py query db/bms_share_lifecycle_v1_preflight.sql` → GATE PASS (đã chạy read-only: PASS).
2. `dryrun` → `migrate db/bms_share_lifecycle_v1_setup.sql` → `query db/bms_share_lifecycle_v1_postflight.sql` → GATE PASS. DB trước, frontend sau (frontend cũ không bị ảnh hưởng: policy/RPC cũ giữ nguyên hành vi).
3. Rollback: revert frontend. `db/bms_share_lifecycle_v1_rollback.sql` trả policy/check/RPC về baseline; còn artifact `shared` thì giữ check và artifact (chỉ chủ bài đọc được), không xoá dữ liệu/tin.
