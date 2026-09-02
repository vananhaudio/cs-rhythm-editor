-- ════════════════════════════════════════════════════════════════════════════
-- SECURE LESSON CONTENT — đường đọc nội dung bài có KIỂM QUYỀN Ở SERVER
--
-- BỐI CẢNH GAP (audit 02/09/2026):
--   RLS trên edu_course_lessons chỉ chặn theo VISIBILITY, không theo quyền học.
--   ⇒ anon/authenticated SELECT được cột `content` của MỌI bài trong khoá visible,
--     kể cả bài đang khoá. Khoá bài hiện là presentation-only.
--
-- FILE NÀY LÀM GÌ:
--   Tạo đường đọc AN TOÀN (RPC) để client mới dùng. KHÔNG revoke quyền đọc
--   trực tiếp — xem phần "CHƯA REVOKE" ở cuối (app store bundled đang đọc
--   select('*'), revoke bây giờ = app học viên đã cài GÃY NGAY).
--
-- MỘT LUẬT DUY NHẤT:
--   can_student_access_lesson() KHÔNG viết lại luật quyền. Nó GỌI THẲNG
--   my_learning_state() — cùng resolver canonical mà app đang dùng để vẽ
--   mở/khoá (db/learning_state_setup.sql). Đổi luật ở RPC đó là cả hai đường
--   (hiển thị + đọc nội dung) đổi theo, không bao giờ lệch nhau.
--
-- AN TOÀN:
--   - KHÔNG nhận student_id từ browser. Danh tính lấy từ auth.uid() bên trong
--     my_learning_state() ⇒ không thể đọc hộ người khác.
--   - security definer + set search_path (chống search_path hijack).
--   - Teacher: my_learning_state trả 'open' cho mọi bài ⇒ Admin không gãy.
--
-- Idempotent. Chỉ THÊM function, không đụng bảng/dữ liệu/policy.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. KIỂM QUYỀN 1 BÀI (canonical, dùng chung) ──────────────────────────────
-- true khi bài MỞ với người đang đăng nhập (chương free / bài free / có gói /
-- được cấp quyền / teacher). Bài hidden, coming_soon, prereq, upgrade ⇒ false.
create or replace function public.can_student_access_lesson(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from jsonb_array_elements(public.my_learning_state() -> 'courses') c,
         jsonb_array_elements(c -> 'lessons') l
    where (l ->> 'id') = p_lesson_id::text
      and (l ->> 'access') = 'open'
  );
$$;

revoke all on function public.can_student_access_lesson(uuid) from public;
grant execute on function public.can_student_access_lesson(uuid) to anon, authenticated;

-- ── 2. ĐỌC NỘI DUNG BÀI (đường an toàn cho client mới) ───────────────────────
-- Chỉ trả payload nội dung khi bài THỰC SỰ mở. Không mở ⇒ lỗi 42501, KHÔNG
-- trả nội dung rỗng im lặng (client phân biệt được "khoá" với "bài trống").
create or replace function public.get_lesson_content(p_lesson_id uuid)
returns table (id uuid, content text, content_url text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_student_access_lesson(p_lesson_id) then
    raise exception 'Bài học chưa được mở khoá' using errcode = '42501';
  end if;
  return query
    select l.id, l.content, l.content_url
    from public.edu_course_lessons l
    where l.id = p_lesson_id;
end $$;

revoke all on function public.get_lesson_content(uuid) from public;
grant execute on function public.get_lesson_content(uuid) to anon, authenticated;

-- ── CHƯA REVOKE QUYỀN ĐỌC TRỰC TIẾP (có chủ đích) ────────────────────────────
-- KHÔNG chạy revoke dưới đây cho tới khi bản native MỚI đã phát hành và số
-- lượng bản cũ còn lại đủ nhỏ. Bundle iOS/Android đang phát hành gọi
-- select('*') trên edu_course_lessons ⇒ revoke = danh sách bài không tải được
-- trên máy học viên, không vá được OTA (app bundled, xem CLAUDE.md).
--
-- VÒNG NATIVE SAU, khi đã phát hành build mới, chạy:
--   revoke select (content) on public.edu_course_lessons from anon, authenticated;
--   grant select (id, module_id, title, lesson_type, content_url, description,
--                 tools, tier, order_index, is_published, access_policy_mode,
--                 required_tier, visibility, availability, allow_preview)
--     on public.edu_course_lessons to anon, authenticated;
--   -- teacher/admin ghi nội dung: Admin dùng role authenticated nên phải kiểm
--   -- lại CourseEditor trước khi revoke (nó đang select('*')).
-- Lưu ý: revoke cột làm MỌI select('*') GÃY CỨNG (PostgREST trả lỗi permission
-- denied cho cả query), không degrade mềm — phải migrate hết caller trước.

notify pgrst, 'reload schema';
