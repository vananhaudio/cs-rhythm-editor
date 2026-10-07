# Class Chat V1b — Share nội bộ (BMS artifact)

Tầm nhìn: **Chat = Text + Share nội bộ + Mira**. Nguyên tắc: *Messenger về cách dùng, Class về nội dung.*
V1b chứng minh MỘT luồng end-to-end:

`Đang xem BMS artifact → Gửi bạn bè → chọn bạn accepted → Gửi → card xuất hiện trong Chat → người nhận bấm card → mở đúng artifact.`

Chat chỉ mang **tham chiếu** tới object gốc. Không upload/copy nội dung vào Chat, không snapshot, không attachment framework tổng quát.
V1a không bị thiết kế lại: text 1-1, bạn `accepted`, polling, unread/badge, `seq`/`last_read_seq`, RLS đóng + RPC SECURITY DEFINER giữ nguyên.

## Quyết định Owner (07/10/2026)

1. Slice 1 = **BMS artifact** (`tool_artifacts`, `tool='bms'`, `kind='song'`). Chỉ share artifact ĐÃ tồn tại; bài nháp local KHÔNG tự tạo artifact.
2. Artifact bị xoá / người nhận không còn quyền: **giữ nguyên message**, card hiện `Nội dung này không còn khả dụng`; tuyệt đối không bypass authorization.
3. Preview danh sách hội thoại giữ fallback `Đã chia sẻ một nội dung` (không thêm `last_kind`).
4. Teacher/Admin vẫn theo luật bạn bè của V1a.
5. **Không có ô ghi chú** trong Share Sheet. `body` của tin share là chuỗi CỐ ĐỊNH `Đã chia sẻ một nội dung` (tương thích client cũ). Muốn "gửi kèm lời nhắn" về sau → một tin text riêng + một tin share riêng, KHÔNG overload tin share.
6. Không realtime, media, group chat, Mira, attachment framework.

## Mô hình dữ liệu (`db/dm_share_v1_setup.sql`, additive)

- `dm_messages` thêm `ref_type text`, `ref_key text` (NULL). CHECK `dm_messages_ref_pair_check`: cả hai null hoặc cả hai có; `dm_messages_ref_valid_check`: `ref_type in ('tool_artifact')` và `ref_key` là uuid chữ thường.
- `dm_append(conv, me, body, ref_type default null, ref_key default null)` (nội bộ): tin share luôn ghi `body = 'Đã chia sẻ một nội dung'`, bỏ qua body người gọi. Cùng khoá hàng hội thoại, `seq`, rate limit 30 tin/phút/hội thoại như text.
- `dm_open(me, user)` (nội bộ): tìm-hoặc-tạo hội thoại canonical (cùng khoá cặp như `dm_start`).
- `dm_share(p_user, p_ref_type, p_ref_key)` (client, `authenticated`): thành viên Class → `dm_rule` (bạn accepted) → allowlist `tool_artifact` + uuid + artifact tồn tại, `tool='bms' and kind='song'`, và **người gửi đọc được** (`owner_id = me` hoặc `visibility='class'`) → `dm_open` → `dm_append`. Mọi lỗi về object dùng MỘT thông báo (`22023 Nội dung này không thể chia sẻ`) — không lộ tồn tại.
- `dm_messages` (RPC) trả thêm `ref_type`, `ref_key` (cột V1a giữ nguyên tên/thứ tự).
- KHÔNG đổi: `dm_rule`, `dm_start`, `dm_send`, `dm_conversations`, `dm_mark_read`, `dm_unread_count`, `dm_can_message`, `dm_find`, RLS, grant bảng, `friendships`, `tool_artifacts`.
- Không có FK/policy mới → không khoá `auth.users`; migration chỉ khoá `dm_messages` (đã kiểm bằng `pg_locks` trong test).

## Quyền truy cập

- Friendship chỉ quyết **ai được gửi cho ai**. Nó KHÔNG cấp quyền xem object.
- Người nhận mở card → route Class của object (`/song-builder?artifact=<id>`) → quyền do RLS `tool_artifacts` quyết ở thời điểm xem. Card cũng đọc qua RLS đó (`select` theo lô trên `tool_artifacts`, KHÔNG qua RPC share) nên không thể dùng Chat để lách quyền.
- Object đã xoá / không đọc được / dữ liệu hỏng → không có dòng trả về → card "Nội dung này không còn khả dụng" (không link, không rò id). Lỗi mạng KHÔNG bị coi là "đã xoá" (không ghi cache, đọc lại sau).
- Card chỉ kéo các trường cần thiết (`title`, `video_id`, `fit.bpm`, `time_signature`, `chords`) — KHÔNG kéo lời bài hát.
- Hết bạn: đọc lịch sử + mở card vẫn được (quyền object độc lập); gửi mới (kể cả share) bị `dm_rule` chặn.

## Client

- `chat/chatModel.ts`: `ChatMessage.ref`, `toShareRef` (loại lạ/khoá hỏng → null → hiện như text với body cố định, không lỗi).
- `chat/shareCards.ts`: đọc object theo lô + cache 60 s; `bmsCardView` dựng payload rồi dùng lại `describeToolShare` (registry Tool Share) → tiêu đề · "76 BPM · 4/4 · 3 hợp âm" · ảnh YouTube · link luyện.
- `chat/ShareMessageCard.tsx`: card = MỘT liên kết; trạng thái đang tải / không khả dụng; báo `MessageList` giữ vị trí cuối khi card đổi chiều cao.
- `chat/ShareToFriendSheet.tsx`: `Gửi bạn bè` → chọn bạn accepted (`fetchFriends`) → `Gửi cho <tên>` → `Đã gửi cho <tên>` + `Mở cuộc trò chuyện` / `Xong` (không bắt buộc chuyển trang). Chống bấm đúp. Tự chứa style (nằm trên cả trang tối BMS lẫn Feed sáng).
- Entry point: `BmsArtifactPage` (nút trong banner) và card BMS ở Feed (`ToolShareBodyView` + `registry` `shareRef`; Metronome/Nhịp & Phách chưa có).

## Tương thích ngược

- DB đi trước frontend: client V1a cũ gọi `dm_messages` nhận thêm 2 cột (bỏ qua) và thấy tin share là một bong bóng text `Đã chia sẻ một nội dung`; `dm_conversations`/preview không đổi.
- `dm_start`/`dm_send` (text) gọi `dm_append` 3 tham số nhờ default → md5 hai hàm này KHÔNG đổi.
- Postflight V1a (`db/dm_v1_postflight.sql`) pin md5 `dm_append`/`dm_messages` của V1a nên sẽ báo FAIL sau V1b — đúng thiết kế; dùng `db/dm_share_v1_postflight.sql` (pin md5 V1b, cùng các hàm V1a không đổi).

## Kiểm thử

| Gate | Lệnh | Kết quả (07/10) |
|---|---|---|
| DB V1b + hồi quy V1a trên DB đã lên V1b + seq đồng thời + rollback | `bash scripts/test-dm-share-v1-db.sh` | 56 kiểm tra V1b + 89 V1a, seq 1..25 từ 2 phiên song song, rollback trả đúng md5 V1a |
| Unit/render | `npm run test:class-social` | gồm `chat-share-v1b.test.tsx` + `chat-v1.test.tsx` (rào chắn phạm vi cập nhật: chỉ mở `ref_type/ref_key`) |
| E2E V1b (Chrome thật) | `PUPPETEER_DIR=… bash scripts/e2e-chat-share-v1b.sh` | 12 kịch bản |
| E2E V1a trên DB+FE V1b | `CHAT_V1B=1 PUPPETEER_DIR=… bash scripts/e2e-chat-v1.sh` | 19/19 PASS (2 lần); 1 lần FAIL ở bước 8 (tin 420 ký tự) — flake đã có sẵn: cùng lỗi xảy ra 1/2 lần trên code V1a thuần (`0de9a4f5`) |

E2E V1b: BMS artifact → share (bấm đúp = 1 `dm_share`, chỉ gửi tham chiếu) → B thấy unread + preview fallback → mở Chat → card → unread hết → bấm card → đúng artifact · người lạ · artifact không có quyền · artifact bị gỡ · client V1a cũ · text trước/sau share · Feed entry · hết bạn · mobile 320–430 + desktop 1120–1440 (card ≤ 300px, sheet 320×568).

## Phát hành (S5 — CHƯA duyệt)

1. `prod-db.py query db/dm_share_v1_preflight.sql` → GATE = PASS (đã chạy read-only 07/10: PASS, 6 tin, chưa có cột ref_*).
2. `prod-db.py dryrun db/dm_share_v1_setup.sql` → `migrate` → `query db/dm_share_v1_postflight.sql` → GATE = PASS. (Production đang có tin thật: **KHÔNG** chạy rollback kiểu DROP.)
3. Deploy frontend (DB trước, frontend sau). Rollback = revert frontend; `db/dm_share_v1_rollback.sql` chỉ trả hợp đồng DB về V1a (khôi phục đúng nguyên văn hàm V1a, gỡ `dm_share`/`dm_open`; gỡ 2 cột CHỈ khi chưa có tin share, nếu đã có thì giữ cột) — không xoá tin nhắn.
4. Owner thử thiết bị thật: iPhone Safari + iPad + desktop, hai tài khoản bạn bè.

## Ngoài phạm vi (để sau)

Nhịp & Phách / Lớp / Band / profile / bài đang tập làm object share; lời nhắn đi kèm; `last_kind` cho preview; reaction/reply; media; group; realtime; Mira.
