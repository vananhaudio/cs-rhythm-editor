# Class UGC Safety V1 — hợp đồng API (Apple Guideline 1.2) — 2026-10-26
Nguồn sự thật cho DB + UI. Tái dùng: story_reports/ReportsPage (1001 Câu chuyện), class_moderate, lt_moderate, edu_students.blocked_at. KHÔNG nhân đôi nghiệp vụ.
Nguyên tắc: thêm bảng/hàm/trigger MỚI, KHÔNG ghi đè hàm production hiện có (class_feed, dm_*, bandchat_*, send_friend_request...). Ghi chặn = trigger BEFORE INSERT trên bảng sẵn có; đọc = hàm bọc `*_safe` (client đổi sang gọi). Rollback = drop các đối tượng mới.

## Bảng mới (RLS bật; client KHÔNG ghi trực tiếp, chỉ qua RPC)
- class_reports(id bigint identity pk, reporter_id uuid not null, kind text check in (post,comment,profile,dm_message,band_message,thread), target_id text not null, target_user_id uuid, reason text check in (spam,harassment,inappropriate,hate,sexual,violence,other), note text(<=500), status text default 'new' check in (new,handled,dismissed), created_at, handled_by uuid, handled_at, handled_action text, handled_note text). Unique index (reporter_id,kind,target_id) where status='new' (chống trùng). Select/Update: chỉ is_teacher(); người báo KHÔNG đọc báo cáo của người khác.
- class_user_blocks(blocker_id uuid, blocked_id uuid, created_at, pk(blocker_id,blocked_id), check blocker<>blocked). Select: chính blocker (own rows) ; ghi chỉ qua RPC.
- class_ugc_consent(user_id uuid pk, version int, accepted_at). Phiên bản quy tắc hiện hành = 1 (hằng trong hàm class_ugc_required_version()).
- class_ugc_blocklist(id, pattern text, kind text check in (word,phrase), severity text default 'block', active bool default true, note) — dữ liệu do Thầy quản lý, KHÔNG hardcode trong bundle; seed khiêm tốn.

## RPC (security definer, search_path='', execute: authenticated)
- class_report_submit(p_kind text, p_target_id text, p_reason text, p_note text default null) returns bigint — server tự lấy auth.uid(), tự suy target_user_id; người báo phải là thành viên Class; chặn tự báo cáo mình; trùng báo cáo mở => trả id cũ; giới hạn tần suất (vd ≤ 20 báo cáo/giờ/người).
- class_block_user(p_user_id uuid) returns void — tạo block + huỷ quan hệ bạn bè hai chiều; KHÔNG đụng quyền học/thành viên lớp.
- class_unblock_user(p_user_id uuid) returns void
- class_my_blocks() returns table(user_id uuid, name text, avatar_url text, created_at timestamptz)
- class_is_blocked_pair(a uuid, b uuid) returns boolean — chặn một trong hai chiều (nội bộ + client cần)
- class_ugc_status() returns table(accepted_version int, required_version int)
- class_ugc_accept(p_version int) returns void
- class_feed_safe(p_before timestamptz default null, p_before_id uuid default null, p_limit int default 20) — CÙNG cột với class_feed, lọc tác giả bị chặn hai chiều, lặp lấy tiếp để đủ trang (tối đa vài vòng).
- class_comments_for_posts_safe(p_post_ids uuid[], p_per_post int default 3) — CÙNG cột với class_comments_for_posts, lọc bình luận của người bị chặn hai chiều.
- DM / Band chat đọc: dm_messages_safe(...), bandchat_messages_safe(...) CÙNG cột với bản gốc, lọc tin của người bị chặn (Band: chỉ lọc tin của người mình chặn/chặn mình; không phá phòng).
- Teacher: class_reports_list(p_status text default 'new', p_limit int default 100) returns table(id, kind, target_id, target_user_id, target_user_name, reporter_name, reason, note, status, created_at, handled_at, handled_action, excerpt text) ; class_report_resolve(p_id bigint, p_action text, p_note text default null) — action in (dismiss, hide, hide_and_block, handled); hide gọi class_moderate/lt_moderate sẵn có; hide_and_block đặt edu_students.blocked_at (cột sẵn có) — Class kiểm blocked_at khi tạo bài/bình luận/DM/chat (trigger).
## Trigger ghi (BEFORE INSERT, raise exception với mã 'ugc_blocked' / 'user_blocked' / 'account_suspended')
- friendships (yêu cầu kết bạn) : không cho nếu hai bên có block.
- tin DM, tin Band chat, class_posts, class_post_comments, thread events: (1) người gửi có edu_students.blocked_at => 'account_suspended'; (2) DM: hai bên có block => 'user_blocked'; (3) nội dung khớp class_ugc_blocklist => 'ugc_blocked'.
## Client
- src/class-safety/ (mới): api (gọi RPC), ReportSheet, BlockConfirm, CommunityRulesGate (chặn khung 5 tab tới khi chấp nhận version hiện hành), BlockedUsersPage (Tôi → Tài khoản & cài đặt), SupportRow (mục "Hỗ trợ & liên hệ" cố định).
- Điểm đặt "⋯": PostCard, CommentItem, ProfilePage, DM thread, Band chat message, thread view. Lỗi 'ugc_blocked' → hiện "Nội dung chưa phù hợp với quy tắc cộng đồng".
- Quản trị: mở rộng src/story/ReportsPage.tsx thêm tab "Class" (không tạo trang quản trị thứ hai).
## Đã có, giữ nguyên
Thầy ẩn bài/bình luận (class_moderate), ẩn lượt thread (lt_moderate), xóa bình luận của chính chủ, xóa tài khoản, /story báo cáo+chặn người kể.
