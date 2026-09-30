# Class Social — Tool Share V1 (chia sẻ kết quả công cụ)

Luồng: học sinh dùng một **công cụ** → có **kết quả thật** → bấm **"Chia sẻ thành tích"** → Feed có thẻ kết quả →
người khác bấm **"Thử ở 80 BPM"** → mở đúng công cụ với đúng tham số. Metronome là công cụ đầu tiên; BMS,
Nhịp & Phách, Ban nhạc về sau dùng lại cùng cơ chế (V1 chưa tích hợp).

## Mô hình (MỘT mô hình chung, không bảng riêng từng công cụ)

- Mở rộng `class_posts`: `type = 'tool_share'` + cột `tool_share jsonb` (có phiên bản `v`, tối đa 2 KB; bắt buộc khi và chỉ khi type là `tool_share`).
  Feed, Tường, bình luận, ẩn bài của Thầy, xoá bài dùng lại nguyên vẹn. Không có `metronome_posts`.
- **Ghi chỉ qua RPC** `social_share_tool_result(p_tool, p_result, p_client_key)` (SECURITY DEFINER):
  - chỉ thành viên Class (`is_class_member()`); anon không gọi được; tác giả = `auth.uid()`.
  - server kiểm payload theo danh sách công cụ và **tự dựng lại** payload (trường lạ bị bỏ).
    Metronome: `kind = practice_session`, `bpm` nguyên 30–260, `seconds` nguyên 60–21600.
  - chống bấm đúp: `client_key` (uuid do client sinh cho MỘT kết quả) có unique index → gọi lại trả đúng bài đã có; người khác dùng lại key bị từ chối.
  - policy insert trực tiếp hiện có KHÔNG cho type `tool_share`.
- Hiển thị: **"Cộng đồng học tập"** (`audience = 'class'`, luật đọc `class_posts_member_read` hiện có). Không có ngữ cảnh lớp → ở **Dành cho bạn** và Tường, **không** ở Lớp của tôi.
- Đọc: Feed/Tường trả bài như thường; thẻ lấy payload bằng `select class_posts(id, tool_share)` gom theo lô (không N+1), vẫn qua RLS. Không sửa `social_feed` / `user_wall` / `social_post_card`.

## Client

- `src/class-social/toolshare/registry.ts` — danh sách công cụ: nhãn, icon, đọc + kiểm payload, dòng tóm tắt, hành động "thử lại" (deep link). Thêm công cụ = một mục ở đây + một nhánh ở RPC.
- `ToolShareCard.tsx` — MỘT renderer cho mọi công cụ. Không hiện JSON / tool id / client_key. Payload hỏng hoặc công cụ lạ → "Kết quả này không còn hiển thị được."
- Danh tính học tập: dùng `IdentityBadges` hiện có cạnh tên (danh tính **hiện tại**, không snapshot).

## Metronome

- Phiên luyện tập **đo thật** (`src/lib/practiceSession.ts`): cộng dồn thời gian đang chạy từ Bắt đầu → Dừng; đổi BPM khi đang chạy thì kết quả là BPM dùng lâu nhất. Không XP, không streak, không điểm.
- Chỉ khi route `/metronome` và **đã đăng nhập** (prop `onShareSession`): sau khi Dừng một phiên ≥ 60 giây hiện khối nhỏ "Phiên luyện tập · 80 BPM · 10 phút" + nút phụ "Chia sẻ thành tích". Nút Bắt đầu/Dừng vẫn là hành động chính. Metronome nhúng trong App học / FlowPlayer không đổi.
- Deep link `/metronome?tempo=N`: chỉ nhận số nguyên 30–260 (`parseMetronomeTempo`); sai → 90. Tải lại giữ nguyên.

## Phát hành

1. `prod-db.py dryrun db/social_tool_share_v1_setup.sql` (có cổng kiểm hiện trạng) → `migrate` → `query db/social_tool_share_v1_postflight.sql`.
2. Deploy frontend. Frontend cũ bỏ qua type lạ nên DB đi trước an toàn.
- Rollback: `db/social_tool_share_v1_rollback.sql` (xoá hàm; chỉ gỡ cột/ràng buộc khi chưa có bài `tool_share` nào — có dữ liệu thì giữ).

## Kiểm thử

- DB: `db/tests/social_tool_share_v1_test.sql` (22 ca) trong `scripts/test-learning-threads-db.sh`.
- Unit: `tests/class-social/tool-share.test.tsx`.
- E2E Chrome: `scripts/e2e-learning-thread.sh` — Metronome → phiên 10 phút → chia sẻ (bấm đúp vẫn 1 bài) → Dành cho bạn → người khác bấm "Thử ở 80 BPM" → Metronome 80, tải lại giữ 80.
