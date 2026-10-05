# Friends UX V2 — trung tâm bạn bè theo mô hình Facebook (05/10/2026)

## Vấn đề
Audit 05/10: dữ liệu bạn bè production KHÔNG mất. Nhưng `/me/friends` chỉ có
"Lời mời kết bạn" (lời mời ĐẾN) và "Tất cả bạn bè" → lời mời MÌNH đã gửi mà người kia chưa chấp nhận không hiện ở đâu,
người dùng tưởng "mất bạn". "Huỷ kết bạn" xoá ngay, không hỏi. "Từ chối" giữ hàng `declined`, người gửi thấy
"Đã gửi lời mời" mãi.

## Mental model: Request → Pending → Accepted → Friends
| Trạng thái (`friendship_status`) | Nút trên trang cá nhân | Lựa chọn |
|---|---|---|
| `none` | **Kết bạn** (làm ngay) | — |
| `outgoing` | **Đã gửi lời mời ▾** | Huỷ lời mời |
| `incoming` | **Phản hồi lời mời ▾** | Xác nhận · Xóa lời mời |
| `friends` | **Bạn bè ▾** | Huỷ kết bạn → hộp xác nhận "Huỷ kết bạn với [Tên]?" [Huỷ] [Huỷ kết bạn] |

- Mỗi trạng thái đúng MỘT nút. Sau khi server xác nhận: nút đổi ngay theo trạng thái DB trả về + câu báo
  (vd. "Đã gửi lời mời — chờ người kia chấp nhận."), rồi nạp lại hồ sơ (quyền xem tường lấy từ DB).
- Menu: desktop = popover cố định dưới nút; mobile (<1024) = action sheet đáy màn hình (thẻ hồ sơ cắt tràn để bo ảnh bìa,
  nên menu không nằm trong thẻ).
- `/me/friends`: **Lời mời kết bạn** [Xác nhận][Xóa] · **Lời mời đã gửi** "Đã gửi lời mời · <thời điểm>" [Huỷ lời mời]
  · **Tất cả bạn bè** (bấm → trang cá nhân; ⋯ → Huỷ kết bạn có xác nhận). Hai mục lời mời chỉ hiện khi có.
  Danh sách đổi ngay sau khi server xác nhận, rồi nạp lại để đối chiếu.
- RPC `unfriend` CHỈ được gọi từ nút xác nhận của hộp thoại (unit test chốt nguồn + E2E đếm request).
- Quyền xem tường KHÔNG đổi: chính chủ · bạn `accepted` · Thầy/admin. Pending ≠ friends.

## DB (`db/friends_ux_v2_setup.sql`, additive, không đổi schema bảng)
1. RPC mới `outgoing_friend_requests()` — khuôn y hệt `incoming_friend_requests`: SECURITY DEFINER, `search_path=''`,
   `auth.uid()`, `is_class_member()`, chỉ lời mời của chính người gọi; REVOKE public/anon, GRANT authenticated.
   Gồm cả hàng `declined` cũ (nếu có) vì `friendship_status` vẫn báo `outgoing` cho người gửi chúng → danh sách và nút khớp.
2. `respond_friend_request(p, false)` = "Xóa" như Facebook: **xoá** hàng pending (trước: đổi sang `declined`).
   Lời mời biến mất ở cả hai phía, hai bên gửi lại được. Chấp nhận giữ nguyên.
3. Cổng trong migration: drift `respond_friend_request` (md5 cũ `a09b7ad5…` / mới `8f03c840…`) + dấu vân tay toàn bảng
   `friendships` trước/sau trong cùng transaction — migration lỡ ghi một hàng nào là DỪNG, huỷ cả transaction.

md5(prosrc) mới: `respond_friend_request` = `8f03c840dc8ab3607851c824d40d566e`, `outgoing_friend_requests` =
`7b2e12aa4c3bf8c54877f9256dd984fe`. Tính năng sau đụng các hàm này phải ghim hằng mới.
Lưu ý: chạy lại `db/class_social_friends_wall_setup.sql` sẽ đưa `respond_friend_request` về bản cũ (cổng drift của file đó
cũng sẽ FAIL vì md5 đã đổi) — đúng thứ tự là friends_wall → friends_ux_v2.

## File
- `db/friends_ux_v2_{preflight,setup,postflight,rollback}.sql`
- Test DB: `bash scripts/test-friends-ux-v2-db.sh` (cluster PG17 tạm: GATE, migration ×2 trên bảng có dữ liệu, test SQL
  theo identity A/B/C/D/T/N, rollback ×2, drift, cổng dữ liệu).
- E2E: `PUPPETEER_DIR=… bash scripts/e2e-friends-v2.sh` (`E2E_FULL=1` chạy cả kịch bản cũ trên DB đã migrate).
  `scripts/e2e-learning-thread.sh` có thêm `E2E_PRE_SQL` (migration chạy trước mọi kịch bản).
- Unit: `tests/class-social/friends-ux-v2.test.tsx`.
- Smoke production (tự huỷ): `prod-db.py dryrun db/tests/friends_ux_v2_prod_smoke.sql` — 2 học sinh chọn động, luôn ROLLBACK.

## Deploy / rollback
DB TRƯỚC frontend: `prod-db.py query preflight → dryrun setup → migrate setup → query postflight` (dấu vân tay
friendships ở postflight phải giống preflight) → FF main.
Rollback: frontend về bản trước TRƯỚC (frontend cũ gọi `respond_friend_request` như cũ, không gọi RPC mới), rồi
`migrate db/friends_ux_v2_rollback.sql` (khôi phục md5 `a09b7ad5…`, bỏ `outgoing_friend_requests`; không đụng hàng nào).
