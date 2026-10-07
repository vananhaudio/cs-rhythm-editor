# Class Universal Share V1

Một lớp Share nhỏ để nhiều nội dung Class dùng chung vòng đời và UX đã được chứng minh ở BMS (`docs/BMS-SHARE-LIFECYCLE-V1.md`).
**Không** phải "Universal Attachment Framework": không upload, không sao chép nội dung vào Chat, không bắt mọi object theo một schema.

## Product model — Object ≠ Distribution

Một object có thể được phân phối qua nhiều nơi; gỡ khỏi một nơi không mặc định xoá object.

- **Object**: thứ người dùng làm/đang xem (bài BMS, bản Nhịp & Phách, lớp, buổi học…). Có id ổn định, chủ/quyền riêng, route canonical.
- **Distribution**: cách object tới người khác — `Gửi cho bạn bè` (Chat chỉ giữ THAM CHIẾU) · `Đăng lên cộng đồng` (bài Feed trỏ tới object).
- UX duy nhất: nút **`Chia sẻ`** → sheet theo KHẢ NĂNG của object:
  - **Gửi cho bạn bè** — *Gửi riêng qua Chat*
  - **Đăng lên cộng đồng** — *Chia sẻ để mọi người trong Class cùng xem* (chỉ khi object hỗ trợ và người dùng được phép)
  - Chỉ còn một lựa chọn hợp lệ → vào thẳng chọn bạn (không hiện menu một mục). Không hiện từ kỹ thuật (artifact/shared/class/promote).

## Hai họ object (hai mô hình quyền — cố ý KHÔNG hợp nhất)

| Họ | Ví dụ | Ai đọc được object | Tin DM làm gì |
|---|---|---|---|
| **A. Artifact (private-grant)** — object do chính chủ tạo, lưu trong `tool_artifacts` | BMS, Nhịp & Phách | `visibility='shared'`: chủ + người ĐÃ NHẬN qua DM · `visibility='class'`: thành viên Class | **Là grant** cho người nhận (chỉ với `shared`, chỉ tin do CHÍNH chủ bài gửi). Người nhận không forward. |
| **B. Object có quyền riêng (reference-only)** — đã tồn tại độc lập, có RLS/RPC của nó | Lớp học, Buổi học | do RLS/RPC của chính object (thành viên lớp, quyền giáo trình, Thầy…) | **Không cấp quyền gì.** Người gửi phải có quyền; người nhận mở bằng quyền của chính họ — không đủ → trang đích chặn. Không tạo artifact. |

Friendship chỉ quyết **ai được gửi DM cho ai** (`dm_rule`, không đổi). Ngoại lệ duy nhất cho "share không cấp quyền" là họ A với `visibility='shared'` — đã thiết kế, test và LIVE ở BMS.

## Destinations & Supported types

| TYPE | `ref_type` | DM | COMMUNITY | PRIVATE GRANT | CANONICAL URL | STATUS |
|---|---|---|---|---|---|---|
| BMS (bài hát đã dựng) | `tool_artifact` | ✔ | ✔ | ✔ (`shared`) | `/song-builder?artifact=<id>` | LIVE (BMS Share Lifecycle) |
| Nhịp & Phách (bản nhạc đã đánh số phách) | `tool_artifact` | ✔ | ✔ | ✔ (`shared`) | `/nhipphach?artifact=<id>` | **mới** (chưa production) |
| Lớp học | `class` | ✔ (người gửi là thành viên lớp hoặc Thầy) | ✘ | ✘ (không cấp quyền) | `/me/classes/<class_schedule.id>` | **mới** |
| Buổi học | `class_session` | ✔ (như trên; chỉ buổi `lesson`) | ✘ | ✘ | `/me/classes/<class id>/sessions/<số buổi>` (key = `class_sessions.id`) | **mới** |

Card hiển thị metadata công khai (tên lớp, mã lớp, số buổi) đọc qua RLS của object; nội dung (giáo án) chỉ mở được bằng quyền của chính người nhận.

Ghi chú Nhịp & Phách: `/nhipphach?artifact=<id>` mở trang CHỈ XEM trước cổng quyền công cụ `nhipphach.access` (`NhipPhachGate`) — quyền đọc do RLS của artifact quyết, không cấp thêm quyền công cụ nào (không xuất, không lưu, không sửa).
Nút `Chia sẻ` của lớp chỉ hiện với thành viên/Thầy; của buổi học hiện khi giáo trình đọc được (server kiểm lại người gửi ở `dm_share`).

## Deferred / unsupported (có lý do)

| Loại | Vì sao chưa |
|---|---|
| Thư viện MusicXML (`musicxml_library`) | Kho master của admin; route `/thuvien` chỉ admin; không có visibility/owner theo người học (Group C). |
| Bài hát thư viện (`strum_songs`, `timming_songs`, `piano_songs`, `student_songs`) | Không có route deep-link thống nhất; `student_songs` RLS rộng (không an toàn để coi là private); `piano_songs` chỉ chủ. |
| Band / Team / Band songs | `bands`/`band_members` đóng RLS (chỉ RPC); route public TeamLab nằm ngoài repo; không có bảng "song trong Band". |
| Bài đăng Feed (`class_posts`) | Không có route deep-link bài đăng; quyền phụ thuộc bạn bè/audience. |
| Bài học (`edu_course_lessons`) | Thiếu route chuẩn + card; quyền theo `my_learning_state()` — cần adapter riêng (Group B, để sau). |
| Learning thread | Chứa bài nộp/media của học sinh; audit ghi nhận `visibility` trên production có giá trị ngoài CHECK trong file setup (chưa kiểm lại constraint thật) — cần audit riêng trước khi cho gửi tham chiếu. |
| Hồ sơ, Story | Group B giá trị thấp / route chưa đối chiếu — để sau. |
| Công cụ (Metronome…) | Là tóm tắt phiên luyện tập (không phải object bền); đã có Tool Share lên Feed. |

## Lifecycle (họ A — artifact)

`bản nháp local → lưu riêng (shared) → đăng cộng đồng (class) → gỡ khỏi cộng đồng → shared`; một bài = một artifact.

- `tool_artifact_save_for_share(tool, payload)` — lưu riêng, idempotent theo (chủ bài, tool, nội dung chuẩn hoá + MusicXML), khoá advisory ⇒ bấm đúp/đua nhau vẫn một artifact. Trả artifact có sẵn nếu đã có (shared hoặc class). `bms_save_for_share` là lớp bọc mỏng.
- `social_publish_tool_artifact(id)` — **promote chính artifact** `shared → class` + đúng MỘT bài Feed (payload theo tool). Idempotent.
- `social_unpublish_tool_artifact(id)` — gỡ khỏi cộng đồng: đã từng được chủ gửi DM → hạ về `shared` (giữ id, giữ grant); chưa từng → xoá (không mồ côi). Bài riêng chưa đăng: không làm gì.
- `social_delete_tool_artifact(id)` — chủ chủ động xoá (artifact + bài Feed); tin Chat luôn còn.
- `tool_artifact_demote_or_delete` + trigger xoá bài Feed: cùng luật hạ/xoá.
- Client: `src/share/artifactApi.ts` (RPC) + `src/share/useArtifactLifecycle.ts` (banner/remove/forward-guard) dùng chung cho `BmsArtifactPage` và `SharedScoreView` (Nhịp & Phách).

## Delete semantics

| Hành động | Kết quả |
|---|---|
| Gỡ khỏi cộng đồng — artifact đã gửi DM | Feed hết bài; artifact → `shared`; người nhận cũ vẫn mở; người Class khác không đọc được |
| Gỡ khỏi cộng đồng — chưa gửi DM | xoá bài Feed + artifact |
| Chủ xoá bài riêng (`Gỡ bài`) | xoá artifact; DM còn; card → "Nội dung này không còn khả dụng" |
| Object họ B bị xoá/mất quyền | tin còn; card "Nội dung này không còn khả dụng" (không phân biệt lý do) |

## Security invariants (đã có test)

- DM: người lạ/ngoài Class/unfriend không gửi được (`dm_rule` không đổi); rate limit 30 tin/phút chung cho text+share; canonical conversation + `seq`; client không CRUD `dm_*`.
- Artifact private: chủ đọc · người nhận hợp lệ đọc · người khác (kể cả Thầy) không đọc · tin giả do người khác chèn không cấp quyền · người nhận không forward · unfriend không mất grant lịch sử · chủ xoá → unavailable · gỡ khỏi cộng đồng → người nhận vẫn đọc.
- Họ B: share không cấp quyền (người nhận không thành thành viên lớp); người gửi không phải thành viên → từ chối với MỘT thông báo chung (không lộ tồn tại/quyền); buổi `break` bị từ chối; không tạo artifact/Feed.
- Resolver card: chỉ SELECT qua RLS của chính object, gom lô theo loại (không N+1), lỗi mạng ≠ "đã xoá".
- SECURITY DEFINER (mọi hàm mới): `set search_path = ''`, tên schema đầy đủ, `auth.uid()` làm danh tính (không nhận user id từ client), kiểm thành viên Class, `REVOKE ALL … FROM public, anon`; chỉ RPC client được `GRANT EXECUTE … TO authenticated`; `tool_artifact_demote_or_delete`, `dm_append`, `dm_open` là nội bộ (không ai ngoài owner gọi được). `dm_artifact_granted` (BMS Share Lifecycle, không đổi ở đây) được policy `tool_artifacts_read` gọi nên cần EXECUTE cho `authenticated`; nó chỉ tiết lộ quyền của CHÍNH người gọi. Không SQL động; không đệ quy RLS (chủ bảng không bị RLS).

Threat model ngắn: (1) *Lách quyền bằng tham chiếu* — chặn: họ B không cấp quyền; họ A chỉ cấp khi tin do chính chủ gửi; (2) *Thăm dò tồn tại* — một thông báo lỗi chung, card "không còn khả dụng"; (3) *Spam/nhân bản* — rate limit, idempotent theo nội dung, khoá advisory, chỉ mục unique một bài Feed/artifact; (4) *Rò nội dung nặng* — card không kéo lời/MusicXML/giáo án; (5) *Forward bài riêng* — `dm_share` chỉ cho chủ bài hoặc bài `class`.

## DB (migration mới, chưa chạy production)

`db/universal_share_v1_setup.sql` (+ preflight/postflight/rollback + `db/tests/universal_share_v1_test.sql`, `scripts/test-universal-share-db.sh`):
`tool_artifact_save_for_share` (mới, gom logic) · thay `bms_save_for_share` (lớp bọc), `social_publish_tool_artifact`, `social_unpublish_tool_artifact`, `dm_share` (nhận theo loại) · CHECK `dm_messages_ref_valid_check` thêm `class`, `class_session`.
Không đổi: `dm_rule/dm_append/dm_open/dm_messages`, `dm_artifact_granted`, policy `tool_artifacts_read`, `tool_artifact_demote_or_delete`, trigger Feed, `social_delete_tool_artifact`, `social_share_tool_result`. Không CREATE/ALTER POLICY, không FK ⇒ không khoá `auth.users`; migration chỉ khoá `dm_messages` (đổi CHECK) — đã đo bằng `pg_locks`. Gate drift ghim md5 các hàm LIVE (đã đối chiếu read-only với production).

## Rollback / recovery

- Ưu tiên rollback frontend (client cũ vẫn chạy trên DB mới: `bms_save_for_share`, `social_publish/unpublish`, `dm_share(artifact)` giữ hành vi).
- `db/universal_share_v1_rollback.sql`: khôi phục NGUYÊN VĂN 4 hàm LIVE (md5 baseline), gỡ `tool_artifact_save_for_share`; CHECK chỉ thu hẹp khi không còn tin `class`/`class_session`; artifact nhipphach `shared` được giữ; không xoá tin/artifact. Test rollback ×2.
- Không bao giờ chạy `dm_v1_rollback.sql` (xoá toàn bộ tin).

## How to add a new shareable type (checklist ngắn)

1. **Chọn họ.** Object nằm trong `tool_artifacts` (chủ tạo, cần gửi riêng)? → họ A. Object đã có quyền riêng (RLS/RPC)? → họ B (tham chiếu thuần). Không có id ổn định/route canonical/quyền rõ → KHÔNG làm.
2. **Họ A:** thêm `tool` vào CHECK `(tool, kind)` + `tool_artifact_save_for_share` (nhánh chuẩn hoá) + nhánh payload Feed trong `social_publish_tool_artifact` + allowlist ở `social_unpublish_tool_artifact`/`dm_share` + `describe` ở `toolshare/registry.ts` + `artifactCardView`. Trang xem dùng `useArtifactLifecycle`.
   **Họ B:** thêm loại vào `SHARE_REF_TYPES` + CHECK `dm_messages_ref_valid_check` + nhánh `dm_share` (điều kiện NGƯỜI GỬI có quyền, lỗi chung) + một resolver ở `REF_RESOLVERS` (`src/share/refCards.ts`, chỉ SELECT qua RLS, trả null nếu không đọc được) + `<ShareButton target={{ type, key }} title=… />` ở trang object.
3. Test: DB (quyền gửi, không cấp quyền, lỗi không rò, rate limit), unit (card/resolver), E2E (gửi → card → mở bằng quyền người nhận → fail-safe).
4. Migration mới (không sửa migration đã LIVE): preflight/drift gate/dryrun/postflight/rollback ×2.

## Kiểm thử

| Gate | Lệnh | Kết quả |
|---|---|---|
| DB Universal Share + hồi quy + đồng thời + rollback | `bash scripts/test-universal-share-db.sh` | 58 kiểm tra mới; hồi quy trên DB đã migrate: lifecycle 89 · V1b 56 · V1a 89 · BMS Artifact 37 · Nhịp & Phách 39; đua lưu/đăng/gỡ nhất quán; rollback ×2 về đúng md5 LIVE |
| Unit/render | `npm run test:class-social` | 292/292 (`tests/class-social/universal-share.test.tsx` + các bộ Chat/BMS/Nhịp & Phách) |
| E2E Universal Share | `bash scripts/e2e-universal-share.sh` | 10 kịch bản (Nhịp & Phách lifecycle, lớp/buổi học tham chiếu, mobile 320–430) |
| E2E BMS lifecycle / Chat V1b / Chat V1a | `e2e-bms-share-lifecycle.sh` · `e2e-chat-share-v1b.sh` · `CHAT_V1B=1 e2e-chat-v1.sh` | 10 · 12 · 19 PASS |
| E2E nền (mặc định, không cần biến môi trường) | `bash scripts/e2e-learning-thread.sh` | 75 PASS. Script tự nạp DB Chat/BMS/Universal Share và, khi chưa có `class_sessions`, nạp fixture TEST-ONLY `db/tests/local/universal_share_fixture.sql` (production có bảng đầy đủ; gate migration không bị bỏ). |

Pre-existing (không thuộc Universal Share): `run-checkpoints.mjs` (chạy kèm `E2E_CHECKPOINTS=1`) fail ở cùng một bước trên main nguyên bản — không sửa ở đây.

## Production plan (đề xuất — CHƯA làm)

1. Preflight read-only (`db/universal_share_v1_preflight.sql` đã PASS với production hiện tại) → `dryrun` ROLLBACK → `migrate` → `postflight` GATE=PASS; xác nhận dữ liệu BMS/Nhịp & Phách/Chat nguyên vẹn (fingerprint).
2. Tích hợp vào main mới nhất bằng merge (không force), build/test lại trên đúng commit deploy.
3. Deploy frontend (DB trước, frontend sau). Smoke kỹ thuật read-only; Owner test thật vài thao tác.
