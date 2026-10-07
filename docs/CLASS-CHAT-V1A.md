# Class Chat V1a — Text 1-1 (`/me/chat`)

Tầm nhìn: **Chat Class = Text + Share nội bộ + Mira**. V1a chỉ làm **Text 1-1**. Chưa Share, chưa Mira, chưa media, chưa group, chưa realtime/push.
Nguyên tắc kiến trúc: *Chat sở hữu cuộc hội thoại, KHÔNG sở hữu tài sản được chia sẻ* (V1b sẽ thêm `ref_type/ref_key` bằng `ALTER TABLE ADD COLUMN NULL` — không phá model).

## Quyền nhắn tin (chốt bởi Owner 07/10/2026) — MỘT chỗ duy nhất: `dm_rule(a, b)`
| Cặp | Luật | Trạng thái |
|---|---|---|
| học viên ↔ học viên | friendship `accepted` (cùng lớp KHÔNG tự động được nhắn) | **ĐÃ làm** |
| Thầy ↔ học viên | không cần friendship **nếu Thầy có quyền thật với lớp của học viên** | **DỪNG — chờ helper canonical** (xem dưới) |
| group | — | không làm |

Đọc lịch sử luôn được (người trong hội thoại). **Gửi mới** phải còn đủ quyền ở thời điểm gửi: huỷ kết bạn → chỉ đọc (`can_send = false`).
Thầy đã là bạn `accepted` của học viên thì nhắn bình thường (luật bạn bè chung cho mọi thành viên Class).

### Vì sao nhánh Thầy đang dừng
Mô hình hiện tại (đã kiểm production 07/10):
- Quyền Thầy canonical = `is_teacher()` (`app_users.role in ('teacher','admin')`) và **áp cho MỌI lớp** (Teacher All Classes V1 — `social_all_classes`, `social_class_members`).
- Thành viên lớp canonical = `tva_private.class_memberships` (CLAUDE.md: CẤM suy heuristic khác). Lớp còn hiệu lực = `class_schedule.status` không thuộc `cancelled/merged/draft` (cùng bộ lọc `social_all_classes`).
- `class_schedule` **không có cột giáo viên**; không tồn tại helper nào diễn đạt "Thầy có quyền với lớp của học viên X". Chỉ `is_teacher()` (quá rộng: Owner đã nói KHÔNG dùng đơn thuần) và `social_class_is_member(class, user)` (mỗi lần một lớp).
- Production: 737 học viên nhưng chỉ ~111 người có thành viên lớp canonical.

### Helper nhỏ nhất đề xuất (CHƯA làm — chờ Owner duyệt)
```sql
-- Thầy/admin đang đăng nhập "với tới" học viên p_student: học viên thuộc ÍT NHẤT MỘT lớp còn hiệu lực
create function public.social_teacher_reaches(p_student uuid) returns boolean
language sql security definer set search_path = '' stable as $$
  select public.is_teacher() and exists (
    select 1 from tva_private.class_memberships m
      join public.class_schedule cs on cs.id = m.class_id
     where m.user_id = p_student and coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft'));
$$;
```
Rồi thêm vào `dm_rule`: `or (is_teacher(a) and social_teacher_reaches(b)) or (is_teacher(b) and social_teacher_reaches(a))` — đổi MỘT hàm, không đổi schema/RPC/UI.
Hệ quả cần Owner xác nhận: học viên chưa thuộc lớp nào (~85%) thì Thầy chưa nhắn trực tiếp được (vẫn nhắn được nếu là bạn). Nếu muốn "Thầy nhắn mọi học viên" thì đó là quyết định khác (chỉ `is_teacher()`), không phải "quyền với lớp".

## Mô hình dữ liệu (`db/dm_v1_setup.sql`)
- `dm_conversations(id, user_lo, user_hi, last_seq, last_message_at)` — `user_lo < user_hi` + unique ⇒ **một hội thoại chuẩn tắc cho mỗi cặp**.
- `dm_participants(conversation_id, user_id, last_read_seq)` — đã đọc theo người, **không** có hàng cho từng tin.
- `dm_messages(conversation_id, seq, sender_kind, sender_id, body ≤ 2000)` — `seq` tăng ổn định (khoá hàng hội thoại khi gửi). `sender_kind ∈ {user, mira}` chừa chỗ cho Mira, chưa dùng.
- RLS BẬT, thu hồi mọi grant, **không có policy** → client không CRUD thẳng. Không `CREATE POLICY` ⇒ không dính khoá `policy_grants` (xem memory supabase-storage-policy-locks).

## RPC (SECURITY DEFINER, search_path rỗng, `auth.uid()`, chỉ `authenticated`)
`dm_can_message(user)` · `dm_find(user)` · `dm_start(user, body)` (tìm-hoặc-tạo + gửi tin đầu — hội thoại **chỉ tạo khi gửi tin đầu**) · `dm_send(conv, body)` · `dm_conversations(limit)` · `dm_messages(conv, after_seq, before_seq, limit)` · `dm_mark_read(conv, seq)` · `dm_unread_count()`. Nội bộ (không ai gọi được): `dm_rule`, `dm_append`.
Lỗi không lộ sự tồn tại: hội thoại không tồn tại ≡ không thuộc về mình → cùng `P0002 "Không tìm thấy cuộc trò chuyện"`. Giới hạn tốc độ: ≤ 30 tin/phút/người/hội thoại.

## Polling (không realtime)
`chat/chatLive.ts` định nghĩa interface `ChatLive` (`watchUnread/watchList/watchConversation`); `chat/polling.ts` là cài đặt polling: tab ẩn → dừng, focus → tải ngay, không chồng lượt, lỗi → giãn nhịp ×2 (tối đa 60 s). Hội thoại đang mở (4 s) chỉ hỏi `seq > đã có`; danh sách 15 s; badge 30 s. Thay bằng realtime = viết một `ChatLive` khác — UI/hook/data model giữ nguyên.

## Kiểm thử
- `bash scripts/test-dm-v1-db.sh` — DB tạm: preflight/migration ×2/khoá/test quyền 89 kiểm tra/postflight/rollback ×2/va chạm tên/drift/proof production.
- `npm run test:class-social` (có `tests/class-social/chat-v1.test.tsx`).
- `PUPPETEER_DIR=… bash scripts/e2e-chat-v1.sh` — Chrome thật: mobile 320–430, desktop 1120–1440.
- Production: preflight → `dryrun db/dm_v1_prod_dryrun.sql` (setup + proof bằng tài khoản thật, luôn ROLLBACK) → migrate `db/dm_v1_setup.sql` → postflight. Rollback: `db/dm_v1_rollback.sql` (XOÁ toàn bộ tin nhắn).
- Thứ tự deploy: **DB trước, frontend sau**. Rollback frontend = revert commit (Chat V1a thêm file mới + sửa nhẹ `ClassSocialPage`, `Friends`, `ProfilePage`, `resolveMeRoute`).
