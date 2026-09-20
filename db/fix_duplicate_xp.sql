-- Chặn ghi trùng điểm (XP) + dọn XP khống
-- Bối cảnh: chốt chặn chống đúp ở client dựa trên React state (cập nhật bất đồng bộ),
-- nên nhiều lần gọi trong cùng một tick đều lọt qua. Ghi nhận thực tế: 13 bản ghi
-- `practiced_lesson` cho cùng một bài trong 100ms → 130 XP khống từ một lần học.
-- Client đã sửa (useRef, chặn trước await). File này là CHỐT CHẶN CUỐI ở database,
-- để bản app cũ ngoài store (bundled, không tự cập nhật) cũng không ghi trùng được nữa.
-- Idempotent: chạy lại nhiều lần an toàn.

begin;

-- 1) Dọn action trùng — giữ bản ghi SỚM NHẤT mỗi nhóm
delete from student_action_logs where id in (
  select id from (
    select id, row_number() over (
      partition by user_id, action_type, lesson_id order by created_at, id
    ) rn from student_action_logs
  ) x where rn > 1
);

-- 2) Dọn XP khống — CHỈ các nguồn "thưởng một lần".
--    KHÔNG đụng source 'practice': luyện tập nhiều lần cùng một bài là hợp lệ.
delete from student_xp_log where id in (
  select id from (
    select id, row_number() over (
      partition by student_id, source, ref_id order by created_at, id
    ) rn from student_xp_log
    where ref_id is not null
      and source in ('lesson', 'practiced_lesson', 'submitted_video_self_report', 'flow')
  ) x where rn > 1
);

-- 3) Chốt chặn cuối: một hành động chỉ ghi được MỘT lần cho mỗi bài
create unique index if not exists student_action_logs_user_action_lesson_uniq
  on public.student_action_logs (user_id, action_type, lesson_id);

-- 4) Chốt chặn cuối cho XP thưởng-một-lần (partial: chừa 'practice' ra)
create unique index if not exists student_xp_log_once_per_ref_uniq
  on public.student_xp_log (student_id, source, ref_id)
  where ref_id is not null
    and source in ('lesson', 'practiced_lesson', 'submitted_video_self_report', 'flow');

commit;

notify pgrst, 'reload schema';
