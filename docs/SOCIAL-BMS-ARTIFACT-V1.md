# Class Social — BMS Artifact Share V1

Chủ bài dựng xong một bài trong **BMS (Beat my Songs)** → bấm **"Chia sẻ lên cộng đồng"** → Feed có thẻ
**BMS · Dựng bài hát** → người khác bấm **"Luyện bài này"** → mở ĐÚNG bài đó (video, lời, lưới nhịp, mốc, hợp âm)
ở chế độ **chỉ luyện**.

## Local-first (không đổi)

- Nháp và "Bài của tôi" vẫn chỉ nằm trong `localStorage` của máy. Trình dựng (`SongBuilderPage`) và kho nháp không gọi server.
- CHỈ khi chủ bài bấm Chia sẻ mới tạo artifact trên server (qua prop `onShareSong`). Prop này chỉ có ở route `/song-builder` khi đã đăng nhập; không có khi BMS nhúng trong App học, `?embedded=1` hoặc `?standalone=1` (Android).
- Nút chia sẻ chỉ bật khi bài đủ: có video, lời, BPM (tap nhịp) và ít nhất một mốc. Thiếu thì hiện lý do.

## Mô hình

- **`tool_artifacts`** — kho sản phẩm công cụ dùng chung (V1 chỉ nhận `tool='bms'`, `kind='song'`):
  - `id` ổn định, `owner_id` (tài khoản bị xoá thì artifact bị xoá theo), `schema_version`, `title`, `visibility='class'`, `client_key` unique.
  - `data` ≤ 64 KB. Server **kiểm và dựng lại** (`bms_song_normalize`):
    `{schema:'bms.song', v:1, title, video_id, lyrics ≤ 8000, fit{bpm, beat_duration, grid_offset}, time_signature, downbeat_position, group_beats, anchors[{word_index, beat_index}], chords[{word_index, name}]}`.
  - Server bỏ id nháp, tap thô, `youtubeUrl`, thumbnail URL và mọi trường lạ.
  - Không dùng `student_songs`. Bảng đó đang có policy `authenticated ALL` nên không an toàn.
- **Feed:** dùng lại Tool Share V1. Nhánh `bms` trong `social_share_tool_result` tạo artifact + đúng MỘT bài `class_posts` (`tool_share`) trong cùng transaction.
  - `tool_share` chỉ có: `artifact_id`, tên bài, `video_id`, BPM (làm tròn), số phách, số hợp âm khác nhau.
  - **Không có lời bài hát.** Không có `bms_posts`.
- **Lời / bản quyền:** lời chỉ nằm trong artifact và chỉ thành viên Class đọc được, giống mô hình chia sẻ file `.bms` gửi Thầy hiện có. Thẻ Feed không hiện lời. Video vẫn là YouTube nhúng; không lưu hay phát lại âm thanh.

## Quyền (RLS)

`tool_artifacts` là bảng tự quản, có trong `self_managed` của `rls_setup.sql`.

| Ai | Đọc | Ghi / sửa | Gỡ |
|---|---|---|---|
| Chủ bài | ✓ | chỉ tạo qua RPC Chia sẻ | ✓ `social_delete_tool_artifact` |
| Thành viên Class (học sinh khác, Thầy) | ✓ | ✗ | ✗ |
| Ngoài Class | ✗ | ✗ | ✗ |
| anon | ✗ (không có grant) | ✗ | ✗ |

Không có policy insert/update/delete. authenticated chỉ có `SELECT`, nên không ai sửa được bản gốc, kể cả chủ bài.

## Xem / luyện

- `/song-builder?artifact=<uuid>` mở `BmsArtifactPage` → `PracticePlayer` với dữ liệu artifact. Chế độ chỉ luyện: không Lưu, không ghi vào "Bài của tôi", không sửa.
- Người xem thấy "Bài chia sẻ · chỉ luyện, không sửa bài gốc". Chủ bài thấy "Bài của bạn" và nút **Gỡ chia sẻ** (bấm 2 bước).
- V1 chưa có "Tạo bản của tôi từ bài này".
- Id lạ, bài đã gỡ, hoặc không có quyền → "Bài này không còn được chia sẻ…". Chưa đăng nhập → "Đăng nhập Class để luyện bài này."

## Gỡ / xoá

- Chủ bài gỡ bằng `social_delete_tool_artifact`: artifact và bài Feed trỏ tới nó biến mất cùng lúc.
- Xoá bài Feed theo cách khác (tác giả xoá bài, tài khoản bị xoá) → trigger `class_posts_tool_artifact_cleanup` xoá artifact theo, không để dữ liệu mồ côi.
- Nháp local của chủ bài không bị đụng tới.

## Phát hành

1. `prod-db.py query db/social_bms_artifact_v1_preflight.sql`.
2. `dryrun` / `migrate db/social_bms_artifact_v1_setup.sql` (có cổng kiểm hiện trạng).
3. `query db/social_bms_artifact_v1_postflight.sql`.
4. Deploy frontend.

Rollback: `db/social_bms_artifact_v1_rollback.sql`. RPC trở về bản Metronome-only. Nếu chưa có artifact thì gỡ sạch; nếu đã có thì giữ bảng, trigger và RPC gỡ.

## Kiểm thử

- DB: `db/tests/social_bms_artifact_v1_test.sql`, gồm owner / B cùng Class / Thầy / ngoài Class / anon, dữ liệu sai, bấm đúp, gỡ, xoá bài. Có thêm kiểm `rls_setup.sql` không áp policy rộng và rollback ×2.
- Unit: `tests/class-social/bms-artifact.test.tsx`.
- E2E Chrome: `scripts/e2e-learning-thread.sh`. Nháp local không gọi server → Chia sẻ (bấm đúp) → Feed → B luyện đúng bài và tải lại → id lạ / khách → A gỡ → Feed sạch, nháp local còn. Chạy ở 390px.
