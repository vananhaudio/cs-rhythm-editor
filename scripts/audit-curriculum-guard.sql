-- CURRICULUM GUARD V1 — kiểm CHỈ ĐỌC giáo trình ĐÃ XUẤT BẢN trên production (và trước khi xuất bản một buổi trắc nghiệm).
-- Chạy:  python3 ~/Projects/cs-prod-db-infra/scripts/prod-db.py query scripts/audit-curriculum-guard.sql     (tx READ-ONLY)
-- KHÔNG ghi, KHÔNG tạo đáp án, KHÔNG in đáp án (chỉ so khớp tồn tại / kiểu / thuộc lựa chọn). 0 dòng = đạt.
-- Luật khớp server: cl_session_checkpoints (id hợp lệ, required mặc định true) · lsp_try_complete (buổi cần ≥ 1 bài bắt buộc) ·
--                   lt_answer_checkpoint (khoá phải có, đúng mode, nằm trong lựa chọn → nếu không: LT_QUIZ_NOT_READY).
with cp as (   -- mọi checkpoint của buổi đã xuất bản, kèm cờ chế độ lớp
  select sc.id class_id, sc.code, s.id session_id, s.session_number sn, b,
         b ->> 'id' cid,
         coalesce(b ->> 'id', '') ~ '^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$' id_ok,
         case when jsonb_typeof(b -> 'required') = 'boolean' then (b ->> 'required')::boolean else true end required,
         case when jsonb_typeof(b -> 'accepts') = 'array' then b -> 'accepts' else '["text","video_link"]'::jsonb end accepts
  from public.class_schedule sc
  join public.class_sessions s on s.class_id = sc.id and s.event_type = 'lesson'
  join public.class_lesson_content c on c.session_id = s.id and c.status = 'published'
  cross join lateral jsonb_array_elements(c.blocks) b
  where jsonb_typeof(b) = 'object' and b ->> 'kind' = 'checkpoint' and sc.status <> 'cancelled'),
mode_cls as (select distinct class_id from cp),            -- lớp ở chế độ bài trả (≥ 1 checkpoint đã xuất bản); HT2027 (0 bài trả) KHÔNG nằm đây
pub as (   -- buổi đã xuất bản của các lớp chế độ bài trả
  select sc.code, s.id session_id, s.session_number sn
  from mode_cls m join public.class_schedule sc on sc.id = m.class_id
  join public.class_sessions s on s.class_id = sc.id and s.event_type = 'lesson' and s.session_number >= 1
  join public.class_lesson_content c on c.session_id = s.id and c.status = 'published')
select code, sn as buoi, null::text as bai_tra, 'BUỔI KHÔNG CÓ BÀI BẮT BUỘC (không bao giờ hoàn thành, buổi kế không mở)' as van_de
from pub p where not exists (select 1 from cp where cp.session_id = p.session_id and cp.id_ok and cp.required)
union all
select code, sn, cid, 'BÀI BẮT BUỘC chỉ nhận loại chưa làm được (' || accepts::text || ')'
from cp where id_ok and required and not (accepts ? 'text' or accepts ? 'video_link' or accepts ? 'quiz')
union all
select code, sn, cid, 'TRẮC NGHIỆM THIẾU KHOÁ ĐÁP ÁN (học viên bấm sẽ gặp LT_QUIZ_NOT_READY)'
from cp where id_ok and accepts ? 'quiz'
  and not exists (select 1 from public.class_checkpoint_keys k where k.session_id = cp.session_id and k.checkpoint_id = cp.cid)
union all
select code, sn, cid, 'KHOÁ ĐÁP ÁN LỆCH: sai mode / rỗng / có đáp án ngoài danh sách lựa chọn'
from cp join public.class_checkpoint_keys k on k.session_id = cp.session_id and k.checkpoint_id = cp.cid
where cp.id_ok and cp.accepts ? 'quiz'
  and (k.mode is distinct from cp.b -> 'quiz' ->> 'mode' or coalesce(cardinality(k.correct), 0) = 0
       or (k.mode = 'single' and cardinality(k.correct) <> 1)
       or not (k.correct <@ coalesce((select array_agg(o ->> 'id') from jsonb_array_elements(coalesce(cp.b -> 'quiz' -> 'options', '[]'::jsonb)) o), '{}')))
union all
select sc.code, s.session_number, k.checkpoint_id, 'KHOÁ ĐÁP ÁN MỒ CÔI (không có bài trả tương ứng trong giáo án)'
from public.class_checkpoint_keys k
join public.class_sessions s on s.id = k.session_id join public.class_schedule sc on sc.id = s.class_id
where not exists (select 1 from public.class_lesson_content c cross join lateral jsonb_array_elements(c.blocks) b
                  where c.session_id = k.session_id and b ->> 'kind' = 'checkpoint' and b ->> 'id' = k.checkpoint_id)
order by 1, 2, 3;
