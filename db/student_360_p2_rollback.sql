-- Rollback Student 360 P2: chỉ bỏ RPC đổi visibility. Không mất dữ liệu (mục giữ nguyên visibility hiện tại). Idempotent.
drop function if exists public.student_360_set_visibility(uuid, text);
