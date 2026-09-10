-- ═══════════════════════════════════════════════════════════════════════════
-- Mở vai trò `admin` trên production — 11/09/2026
--
-- Bối cảnh: toàn bộ mã nguồn và các hàm DB đã trông đợi vai trò 'admin'
-- (`isTeacher = role === 'teacher' || role === 'admin'`, `is_teacher()` gồm cả
-- admin, `is_admin()` của Giai đoạn 12), NHƯNG ràng buộc CHECK trên app_users
-- lại không có 'admin' trong danh sách hợp lệ. Vì vậy `is_admin()` không bao
-- giờ có thể đúng với bất kỳ ai, và ma trận quyền Nhịp Phách không ai sửa được.
--
-- Idempotent: chạy lại nhiều lần không sao.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Cho phép giá trị 'admin'. Thuần THÊM: không dòng nào đang có bị ảnh hưởng,
--    ADD CONSTRAINT vẫn kiểm lại toàn bộ bảng.
alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check
  check (role = any (array['admin','teacher','team_leader','truong_nhom','student','guest']));

-- 2. Hàm cũ này so sánh CHẶT role='teacher' — nâng một tài khoản lên admin sẽ
--    âm thầm làm nó mất quyền. Đưa về đúng quy ước chung: admin bao hàm teacher.
--    (Hiện không app hay edge function nào gọi; đặt lại mật khẩu đi qua edge
--    function `admin-ai`, vốn đã chấp nhận teacher||admin.)
create or replace function public.reset_user_password(target_user_id uuid)
returns void language plpgsql security definer as $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_users
    WHERE id = auth.uid() AND role IN ('teacher','admin')
  ) THEN
    RAISE EXCEPTION 'Không có quyền thực hiện';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt('123456', gen_salt('bf'))
  WHERE id = target_user_id;

  UPDATE app_users
  SET must_change_password = true
  WHERE id = target_user_id;
END;
$function$;

-- 3. Nâng tài khoản của thầy. KHÔNG dùng UPDATE trần: phải đúng 1 dòng.
do $$
declare n int;
begin
  select count(*) into n from public.app_users where email='vananhaudio@gmail.com';
  if n <> 1 then raise exception 'HUỶ: khớp % dòng, chỉ được đúng 1', n; end if;
  update public.app_users set role='admin'
   where email='vananhaudio@gmail.com' and role in ('teacher','admin');
end $$;

-- LƯU Ý VẬN HÀNH: sau bước này production KHÔNG còn tài khoản role='teacher'.
-- Cột "Giáo viên" trong ma trận quyền Nhịp Phách vẫn đúng và vẫn có tác dụng,
-- nhưng hiện chưa chi phối tài khoản nào. Tạo tài khoản giáo viên mới thì cột
-- đó có hiệu lực ngay, không phải sửa gì thêm.

notify pgrst, 'reload schema';
