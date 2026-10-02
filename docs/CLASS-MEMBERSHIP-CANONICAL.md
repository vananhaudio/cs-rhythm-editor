# Class Membership Canonical V1

**Lớp học là đơn vị canonical để quản trị học sinh.** Một lớp → một nhóm thành viên → một luật → một nguồn sự thật ở server.

## CLASS MEMBERSHIP SOURCE OF TRUTH

```
class_schedule.cohort_group_id  →  edu_group_members (status = 'active')  →  học sinh của lớp
```

- Định nghĩa **duy nhất**: view `tva_private.class_memberships(class_id, group_id, user_id, source, joined_at)`.
- Không consumer nào tự viết lại phép join. Đọc view (trong SQL SECURITY DEFINER) hoặc gọi RPC bên dưới.
- **KHÔNG BAO GIỜ** suy membership bằng: tên nhóm giống tên lớp · mã nhóm trùng mã lớp · `edu_students.ht_member`
  · `leads` (đăng ký/chờ duyệt) · gói (`packages.config.zalo_group_id`) · cột `group_id` thứ hai · heuristic.
  Thiếu dữ liệu → báo Owner, không đoán.

### Nhóm canonical
- Là nhóm Admin chỉ định rõ trong `cohort_group_id`. Có thể là nhóm Zalo đang có (đã chính là danh sách học sinh thật),
  hoặc nhóm kiểu `class`. Không bắt buộc mã `CLASS.<mã lớp>`, không tạo nhóm mới chỉ để đẹp schema.
- `class_schedule.group_id` = **bản sao tương thích**, luôn bằng `cohort_group_id`
  (trigger `class_schedule_sync_member_group` + CHECK `class_schedule_one_member_group`). Code cũ ghi `group_id` →
  `cohort_group_id` tự đi theo; ghi `cohort_group_id` → `group_id` đi theo. Hai giá trị khác nhau bị từ chối.
- Nhóm thừa sau khi gộp: `is_active = false`, giữ nguyên tên/mã/link/hàng thành viên. Không xoá.

### Membership ≠ quyền Giáo trình
- Thành viên lớp = view canonical.
- Đọc Giáo trình (`tva_private.can_read_class_curriculum`) = thành viên canonical **và** `class_curriculum_access.status = 'active'`.
- Một học sinh có thể thuộc lớp mà Giáo trình chưa bật. UI phải hiển thị hai thứ riêng.

## Consumer (tất cả đọc cùng nguồn)

| Consumer | Hàm |
|---|---|
| Social: Lớp của tôi, thẻ lớp, thành viên, Khám phá, hoạt động | `social_class_members_of` → view; sĩ số `tva_private.class_student_count` |
| App "Lớp đang học" | RPC `my_class_memberships()` |
| Admin → Lịch lớp | RPC `admin_class_member_summary()` (nhóm canonical, sĩ số, số người bật Giáo trình) |
| Admin → Lớp học (danh sách) | RPC `class_roster(class)`; ghi qua `manage_class_membership` |
| Giáo trình | `can_read_class_curriculum`, `class_learning_state`, `lt_submit_checkpoint`, policy `class_lesson_content` |
| Learning Identity | `social_learning_identities` |
| Learning Thread (đóng dấu lớp cho thread MỚI) | `lt_identity_snapshot` — identity thread cũ không viết lại |
| Quyền lợi membership | `my_membership.classes` |
| Cấp khoá khi vào lớp | trigger `grant_class_courses_on_join` (nhóm canonical → `course_ids` của chính lớp đó), `backfill_class` |
| Bảng xếp hạng lớp | `my_class_leaderboard` (bạn cùng lớp canonical) |

## Mọi đường GHI đều vào nhóm canonical
- Admin: `manage_class_membership(class, user, add|remove)` — mọi lớp có nhóm (trừ lớp `cancelled`/`merged` khi thêm).
- Gói membership: `activate_class_membership(lead)` → `cohort_group_id`.
- Mã tham gia (Join Code): `class_join(code)` → `cohort_group_id` của lớp (xem phần Join Code bên dưới).
- Không có đường nào tạo membership "vô hình" với App/Admin.

## Migration
- Schema + hàm (chung): `db/class_membership_canonical_v1_setup.sql`, rollback `db/class_membership_canonical_v1_rollback.sql`
  (khôi phục nguyên văn thân hàm cũ từ bảng `tva_private.ccm_v1_backup`).
- Ánh xạ lớp → nhóm canonical của production là **dữ liệu vận hành** có id thật → nằm ở hạ tầng **private**
  (`cs-rhythm-editor-wip`, `prod-migrations/class-membership-canonical-v1/`), chạy trước setup trong cùng transaction,
  có cổng drift + hậu kiểm no-loss/no-expansion. Repo public không chứa id/sĩ số production.
- Test chung (dữ liệu giả): `bash scripts/test-class-membership-canonical-db.sh`.

## Lớp mới về sau
Tạo lớp ở Admin → Lịch lớp, chọn (hoặc để hệ thống tạo) nhóm thành viên. Học sinh vào lớp bằng: Admin thêm,
kích hoạt gói, hoặc mã tham gia. Admin hiện cảnh báo nhẹ khi lớp còn sống mà chưa có nhóm hoặc nhóm 0 người.

## Join Class by Code V1 (`db/class_join_code_v1_setup.sql`)
- Mã tham gia = token trong `edu_group_claim_tokens` (hạ tầng claim-link sẵn có) gắn **nhóm canonical** của lớp.
  8 ký tự `A–Z/2–9` (bỏ I, L, O, 0, 1), hiển thị `XXXX-XXXX`. **Không** dùng mã lớp (vd `Z2`) làm bí mật.
- Admin: Lịch lớp (dòng lớp) và Lớp học (đầu trang lớp) → **Mã tham gia · Lấy mã / Sao chép / Đổi mã**
  (`admin_class_join_code(class, rotate)`; đổi mã chỉ tắt mã tham gia cũ, không tắt link claim khác của nhóm).
- Học sinh: `/me` → Lớp học → **Nhập mã lớp của bạn** → Xem lớp (`class_join_preview`) → **Tham gia lớp** (`class_join`).
  Server tự lấy `auth.uid()`, resolve mã → nhóm → lớp; ghi `edu_group_members(source = 'join_code')` vào nhóm canonical.
  Idempotent. Lớp huỷ/gộp/nháp/đã kết thúc → `JOIN_CLOSED`. Người Thầy đã bỏ khỏi lớp → `JOIN_REMOVED` (không tự vào lại).
  Chưa có hồ sơ học viên → `JOIN_NO_PROFILE`. Sau khi tham gia: Lớp của tôi, sidebar, Learning Identity, sĩ số cập nhật ngay.
- Lưu ý: vào nhóm canonical kích hoạt trigger cấp khoá như mọi đường vào lớp (cấp `course_ids` của lớp, nếu có).

## Lối vào HỌC của lớp
- Trang lớp (`/me/classes/<id>`) có khối **Học** (`class_learning_entry`): khoá chính của lớp + quyền học thật
  (`has_course_access`) → nút **Tiếp tục học** mở route học sẵn có `/course?id=` (Trả/Hỏi bài = Learning Thread trong bài);
  Giáo trình lớp (nếu xuất bản) báo riêng theo `class_curriculum_access`; lớp có checkpoint dùng màn học "Vào học" sẵn có.
- Không có hệ giáo trình hay hệ Trả bài thứ hai. Lớp chưa gắn khoá (vd Gen Z — Z2) hiện "Lớp chưa gắn khoá học hay giáo trình".

## Test
- DB (dữ liệu giả): `bash scripts/test-class-membership-canonical-db.sh` — canonical + Join Code + rollback.
- E2E Chrome (stack local): `PUPPETEER_DIR=… bash scripts/e2e-class-canonical.sh` — kịch bản cũ (hồi quy) + lớp Zalo cũ
  (Social/App/Admin) + Nhập mã lớp.
- Giao diện: `npm run test:class-social` (`tests/class-social/class-membership-canonical.test.tsx`).
