# Band Chat V1 — nhóm chat theo Band trong Trò chuyện (/me/chat)

Mỗi **Band** (`teamlab_bands`, không phải Team = `projects`) có đúng một nhóm chat. Hiện cùng danh sách hội thoại cá nhân, có nhãn "Band".

## Nghiệp vụ đã chốt (Owner, 15/10) và cách thực hiện
1. **Thành viên hiện hành** đọc toàn bộ lịch sử + gửi tin. Rời Band → mất quyền đọc/gửi, tin đã gửi giữ nguyên. Người mới vào: đọc lịch sử, tin trước lúc vào không tính chưa đọc.
2. **Lưu trữ Band** → nhóm chỉ đọc cho những người là thành viên LÚC lưu trữ (ảnh chụp `bandchat_frozen`); người vào/rời sau đó không đổi quyền. **Khôi phục** → quyền theo thành viên hiện hành, ảnh chụp bị xoá.
   - Production CHƯA có chức năng lưu trữ Band (`teamlab_bands` không có cột trạng thái; chỉ bài hát có `archived_at`). Trạng thái lưu trữ nằm ở phía chat: RPC `bandchat_set_archived(band, bool)` (chỉ Thầy/Admin) là móc nối để TeamLab gọi khi thêm tính năng lưu trữ Band.
3. **Không xoá vĩnh viễn chat:** `band_id` không có khoá ngoại → xoá Band/Team (kể cả cascade `projects → teamlab_bands`) KHÔNG xoá tin. Thành viên cũ không đọc được; Thầy/Admin vẫn đọc (tên Band lưu ở `name_snapshot`).
4. **Thầy/Admin xem nhóm Band để hỗ trợ/quản lý:** nguồn quyền chuẩn `public.is_teacher()` (`app_users.role` ∈ teacher|admin), kiểm ở backend. Chỉ ĐỌC: không gửi thay, không giả danh, xem không tạo/đổi trạng thái đọc của ai. Hiển thị ở mục "Hỗ trợ" trong danh sách + ghi chú trong thông tin nhóm (danh sách thành viên) để thành viên biết.

## V1.1 — Nhóm Band quản trị theo TeamLab (16/10, chờ nghiệm thu; chưa migrate/deploy production)

TeamLab là nguồn chuẩn; Trò chuyện chỉ phản ánh, không quản lý lại ở hai nơi.

| # | Quy tắc | Trạng thái |
|---|---|---|
| 1 | Mỗi Band đúng một nhóm, hiện cho thành viên kể cả chưa có tin; phòng vật lý chỉ tạo khi có tin đầu | Có sẵn (V1), xác minh lại bằng test V1.1 |
| 2 | Tên + ảnh lấy từ Band lúc đọc (không bản sao) | Có sẵn (V1) |
| 3 | Thành viên = `teamlab_band_members` hiện hành; rời → mất đọc/gửi, tin giữ | Có sẵn (V1) |
| 4 | Trưởng Band = Chủ nhóm, Phó Band = Quản trị viên, còn lại = Thành viên | **Mới (V1.1)** |
| 5 | Đổi Trưởng/Phó ở TeamLab → vai trò đổi ở lần gọi tiếp theo | **Mới (V1.1)** — tính lúc gọi, không đồng bộ |
| 6 | Không có thao tác đổi tên/thêm-gỡ thành viên/bổ nhiệm trong chat; có liên kết "Quản lý tại TeamLab" | **Mới (V1.1)** — liên kết tới Band Home TeamLab, TeamLab tự kiểm quyền |
| 7 | Biên tập âm nhạc và Trưởng Team không sinh quyền quản trị chat | **Mới (V1.1)** — chỉ `leader`/`deputy` được xét |
| 8 | Thầy/Admin ngoài Band: đọc, không gửi; là thành viên thì gửi như thành viên | Có sẵn (V1), xác minh lại |
| 9 | Không đổi chính sách lưu trữ/xoá Band hay giới hạn số Band/người | Giữ nguyên |

**Nguồn dữ liệu chuẩn:** `public.teamlab_band_roles (band_id, user_id, role)` — `leader` (tối đa 1/Band), `deputy` (tối đa 1/Band), `music_editor`. Không có cột trạng thái; vai trò chỉ tính khi người đó CÒN là thành viên Band (dòng vai trò sót lại sau khi bị gỡ khỏi Band không có hiệu lực).

**Cơ chế:** hàm nội bộ `bandchat_group_role(band, user)` → `owner | admin | member | null` (MỘT chỗ duy nhất) và `bandchat_can_admin(band)` → boolean (nền để mở rộng quyền quản trị về sau; **chưa có thao tác quản trị nào dùng**: chưa xoá tin người khác, cấm gửi, ghim, duyệt). `bandchat_members` trả thêm cột `group_role`, sắp Chủ nhóm → Quản trị viên → Thành viên. Giao diện chỉ hiển thị; mọi kiểm tra ở backend. Band chưa có Trưởng: không tự chọn ai, panel báo "Band này chưa có Trưởng Band".

**Migration V1.1** (`db/band_chat_v1_1_roles_{setup,rollback}.sql`): chỉ CREATE/DROP **hàm**; không bảng, policy, dữ liệu; chạy sau V1; idempotent. Rollback trả `bandchat_members` về dạng V1 và gỡ 2 hàm, **không xoá tin nhắn**. FE cũ vẫn chạy (cột thêm bị bỏ qua).

## V1.2 — Thầy/Admin thấy mọi Band ở mục Hỗ trợ (16/10)
- **Nguyên nhân Owner chỉ thấy 2 Band:** danh sách hỗ trợ chỉ lấy nhóm đã có tin (`bandchat_rooms.last_seq > 0`); Band chưa có phòng/tin bị bỏ. Không phải do quyền hay lọc theo tên.
- **Sửa:** `bandchat_rooms()` cho Thầy/Admin liệt kê mọi `teamlab_bands` (+ nhóm còn tin của Band đã xoá). Band mình là thành viên nằm danh sách chính; còn lại `support = true`, chỉ đọc, không tính chưa đọc, không tạo phòng. Band chưa có tin hiện "Chưa có tin nhắn". Học viên không đổi (chỉ Band mình).
- Tối đa 100 nhóm/lần gọi (nhóm có tin mới nhất trước); vượt thì cần phân trang.
- Migration: `db/band_chat_v1_2_support_list_{setup,rollback}.sql` — chỉ thay hàm `bandchat_rooms`, không đụng dữ liệu; rollback về V1.

## Nguồn dữ liệu & quyền
- Quyền = MỘT hàm nội bộ `bandchat_access(band)` → `send | read | null`, tính ở thời điểm gọi, từ `teamlab_band_members` (+ `bandchat_frozen` khi lưu trữ, + `is_teacher()`).
- Tên + ảnh lấy lúc đọc từ `teamlab_bands.name` / `cover_path` (dự phòng `projects.avatar_path`) — không có bản sao.
- Không có quyền và không tồn tại → cùng lỗi `P0002`; có quyền đọc nhưng gửi → `42501` "chỉ đọc".

## DB (additive, `db/band_chat_v1_*.sql`)
- 4 bảng mới: `bandchat_rooms` (PK = band_id → mỗi Band đúng một phòng; `archived_at`, `name_snapshot`), `bandchat_messages`, `bandchat_reads`, `bandchat_frozen`. RLS bật, 0 grant, 0 policy.
- 7 RPC client + 2 hàm nội bộ (`bandchat_access`, `bandchat_append`): `bandchat_rooms/messages/send/mark_read/unread_count/members/set_archived`.
- KHÔNG sửa/xoá bảng, hàm, policy hay dữ liệu hiện có; không đụng `dm_*`, `teamlab_*`.
- Quy trình: preflight → dryrun → migrate → postflight (`scripts/prod-db.py`), DB TRƯỚC frontend. Frontend tự ẩn nhóm Band khi RPC chưa có.
- **Rollback:** (a) mềm — revert frontend: nhóm biến mất khỏi UI, bảng + tin giữ nguyên, không mất dữ liệu; (b) cứng — `db/band_chat_v1_rollback.sql` XOÁ 4 bảng + tin phát sinh sau migration. Trước (b) phải xuất 4 bảng (`prod-db.py query --sql "select * from public.bandchat_messages"` …). Chat 1-1 không bị ảnh hưởng ở cả hai.

## Frontend
- Id hội thoại nhóm = `band:<band id>`; route `/me/chat/b/<band id>`. `chatApi` định tuyến `band:` → `bandchat_*`, còn lại → `dm_*`.
- Dùng lại `useConversation` (polling 4 s), `MessageList`, `Composer`, badge; thêm tên + ảnh người gửi, dòng "Nhóm Band · n thành viên", danh sách thành viên.

## Kiểm thử
- `bash scripts/test-band-chat-v1-db.sh` — DB (quyền, cô lập, rời/vào Band, đồng thời, rollback, hồi quy `dm_v1_test`).
- `npm run test:class-social` — model/route/API/render.
- `PUPPETEER_DIR=… bash scripts/e2e-band-chat-v1.sh` — Chrome thật trên stack local (2 tài khoản + mobile 320…1440).

---


---

## Nhóm tự tạo ('Tạo nhóm') — HOÃN (Owner chốt 16/10)

> Hướng ưu tiên hiện tại là nhóm Band quản trị theo TeamLab (mục V1.1 ở trên). Nhóm tự tạo/nút "Tạo nhóm" **chưa làm**; nội dung dưới đây chỉ là ghi chú định hướng cũ, không phải kế hoạch hiện hành.

### Ghi chú định hướng cũ (15/10)

Đây là định hướng + đề xuất lát nhỏ nhất, **không phải tính năng đã làm**. Chưa có code/migration. Chờ Owner chốt các quyết định ở cuối.

**Hai loại nhóm**
- *Nhóm theo tổ chức* (Band, lớp học): thành viên suy ra từ dữ liệu nghiệp vụ chuẩn (như `bandchat_access`). Không có thao tác thêm/xoá thành viên trong chat.
- *Nhóm tạo riêng*: người dùng tạo cho học tập/tập luyện/dự án; thành viên do quản trị nhóm quản lý.

**Trải nghiệm V1 "Tạo nhóm"**: bấm "Tạo nhóm" → đặt tên → chọn bạn (từ danh sách bạn bè) → tạo xong vào trò chuyện ngay; người tạo là chủ nhóm. Trong nhóm: danh sách thành viên, thêm/xoá, đổi tên, rời nhóm.

**Quyền tối thiểu (nhóm tạo riêng)**
| Hành động | Chủ nhóm | Quản trị | Thành viên |
|---|---|---|---|
| Đọc / gửi tin | ✓ | ✓ | ✓ |
| Xem danh sách thành viên | ✓ | ✓ | ✓ |
| Thêm thành viên | ✓ | ✓ | – |
| Xoá thành viên | ✓ (mọi người) | ✓ (chỉ thành viên thường) | – |
| Đặt/bỏ quản trị | ✓ | – | – |
| Đổi tên nhóm | ✓ | ✓ | – |
| Lưu trữ / giải tán nhóm | ✓ | – | – |
| Chuyển quyền chủ | ✓ | – | – |
| Rời nhóm | cần chuyển quyền trước | ✓ | ✓ |

**Tái sử dụng / bổ sung**
- Tái dùng nguyên: UI (`ConversationList`, `MessageList`, `Composer`, `useConversation` polling, badge, danh sách thành viên, route), mẫu RPC `SECURITY DEFINER` + seq + đã đọc, khái niệm lưu trữ chỉ-đọc.
- KHÔNG mở rộng `bandchat_*`: PK = `band_id`, quyền suy từ `teamlab_band_members` — không có khái niệm thành viên/vai trò tự quản.
- Bổ sung (additive): bảng `groupchat_rooms`, `groupchat_members` (role: owner|admin|member, `left_at`), `groupchat_messages`, `groupchat_reads`; RPC tạo/liệt kê/đọc/gửi/đã đọc/thành viên/thêm/xoá/đặt vai trò/đổi tên/rời/lưu trữ. Id hội thoại `grp:<uuid>`, `chatApi` định tuyến thêm tiền tố này. Không đụng `dm_*`, `bandchat_*`, `teamlab_*`.
- Nhóm lớp học: để sau, dùng cùng mô hình "thành viên suy ra" như Band, không qua bảng `groupchat_members`.

**Quyết định cần Owner chốt**
1. Ai được tạo nhóm: mọi tài khoản đã đăng nhập, hay chỉ Thầy/Trưởng Band/…?
2. Thêm thành viên: chỉ bạn bè của người thêm, hay cả người cùng lớp/Band?
3. Người mới vào có đọc lịch sử không (Band: có)? Đề xuất nhóm riêng: không, chỉ từ lúc vào.
4. Thầy/Admin có xem được nhóm riêng không? Đề xuất: KHÔNG mặc định (riêng tư); chỉ xem khi có báo cáo (đợt sau).
5. Giới hạn: số thành viên/nhóm (đề xuất 50) và số nhóm mỗi người tạo.
6. Chủ nhóm rời: bắt buộc chuyển quyền, hay tự chuyển cho quản trị lâu nhất?

**Phạm vi & mức công việc dự kiến**: 1 migration additive (4 bảng, ~12 RPC, RLS 0 grant như Band Chat) + test DB; FE: nút Tạo nhóm, màn chọn bạn, thông tin nhóm (thêm/xoá/đổi tên/rời). Khoảng 2–3 phiên (DB+test → FE → E2E+deploy). **Ngoài V1**: mời/duyệt tham gia, ghim thông báo, báo cáo vi phạm, nhóm lớp, ảnh nhóm. Phương án nhỏ hơn nếu cần: V1a chỉ chủ nhóm quản lý (chưa có vai trò quản trị), bảng vẫn có cột `role` để mở rộng không cần migrate lại.
