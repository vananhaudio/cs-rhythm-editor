-- CLASS SYSTEM CHAT V2 — thông báo HAI CHIỀU trong Trò chuyện (Class 2.0). *** BẢN NHÁP — CHƯA CHẠY PRODUCTION, chờ Owner duyệt. ***
-- Chạy bằng scripts/prod-db.py (một transaction; file KHÔNG có begin/commit). Idempotent, ADDITIVE trên hạ tầng V1.
-- Thiết kế: docs/CLASS-SYSTEM-CHAT-V2.md.
--   • KHÔNG bảng mới, KHÔNG sửa lt_* / dm_* / RPC client của V1 / RLS. Chỉ: (1) nới CHECK `kind`, (2) thay thân hàm trigger V1.
--   • Sự kiện (đều là event Learning Thread có sẵn, KHÔNG tạo loại nghiệp vụ mới):
--       học viên nộp bài (submission)      → Thầy phụ trách        kind submission_received
--       học viên hỏi bài (question)        → Thầy phụ trách        kind question_received
--       Thầy chấm bài (teacher_feedback+verdict) → học viên        kind checkpoint_graded   (GIỮ NGUYÊN V1: nội dung + dedupe_key)
--       Thầy trả lời Hỏi bài (teacher_answer)    → học viên        kind question_answered
--   • Người nhận do SERVER xác định, không nhận tham số từ client:
--       học viên: learning_threads.learner_user_id.
--       Thầy: (1) learning_threads.last_teacher_user_id nếu còn role teacher/admin (cùng điều kiện is_teacher() mà lt_respond đòi);
--             (2) nếu chưa có → các tài khoản teacher/admin LÀ THÀNH VIÊN lớp của thread (tva_private.class_memberships,
--                 nguồn lớp canonical). KHÔNG suy ra "mọi giáo viên xử lý mọi thread": thread không lớp/lớp chưa có Thầy → KHÔNG gửi, ghi WARNING.
--       Không bao giờ gửi cho chính tác giả sự kiện.
--   • Chống trùng (unique(user_id, dedupe_key), key theo vòng đời nghiệp vụ, không dùng giờ client):
--       submit:<thread>:<seq phản hồi gần nhất của Thầy>  → một lượt chờ chấm = tối đa 1 thông báo/Thầy; Thầy phản hồi rồi mới nộp lại = thông báo mới
--       ask:<thread>:<seq câu hỏi>                         → mỗi câu hỏi mới 1 thông báo
--       answer:<thread>:<seq câu hỏi gần nhất>            → nhiều câu trả lời cho cùng câu hỏi = 1 thông báo
--       grade:<thread>:<seq lượt nộp gần nhất>            → V1 nguyên văn
--   • AN TOÀN TRANSACTION: toàn bộ nhánh thông báo nằm trong khối BEGIN … EXCEPTION WHEN OTHERS (savepoint con): lỗi → rollback
--     riêng phần thông báo, RAISE WARNING (chỉ thread/event id + SQLSTATE, không nội dung), sự kiện nghiệp vụ VẪN commit.
--     Lỗi của chính INSERT sự kiện (nằm ngoài trigger) không bị nuốt.
--   • KHÔNG backfill.

-- 0) Cổng nền
do $gate$
begin
  if to_regclass('public.class_system_notices') is null or to_regclass('public.class_system_notice_reads') is null
     or to_regprocedure('public.class_system_notice_on_event()') is null then
    raise exception 'DỪNG — thiếu System Chat V1 (class_system_chat_v1_setup.sql chưa chạy)';
  end if;
  if to_regclass('tva_private.class_memberships') is null then
    raise exception 'DỪNG — thiếu tva_private.class_memberships (Class Membership Canonical V1)';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'class_system_notice_on_event'
                  and tgrelid = 'public.learning_thread_events'::regclass and not tgisinternal) then
    raise exception 'DỪNG — thiếu trigger class_system_notice_on_event trên learning_thread_events';
  end if;
end $gate$;

-- 1) Nới CHECK kind (dòng V1 'checkpoint_graded' vẫn hợp lệ). Bảng nhỏ; khoá ngắn.
alter table public.class_system_notices drop constraint if exists class_system_notices_kind_check;
alter table public.class_system_notices add constraint class_system_notices_kind_check
  check (kind in ('checkpoint_graded', 'submission_received', 'question_received', 'question_answered'));

-- 2) Thay thân hàm trigger (trigger giữ nguyên, AFTER INSERT trên learning_thread_events)
create or replace function public.class_system_notice_on_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_t public.learning_threads%rowtype;
  v_cycle bigint;
  v_kind text;
  v_body text;
  v_key text;
  v_to uuid[];
  v_session text;
begin
  if new.hidden_at is not null then return new; end if;
  -- Chỉ bốn dạng sự kiện; mọi thứ khác (nhận xét không chấm, …) thoát ngay, không tốn truy vấn
  if not ((new.author_role = 'teacher' and new.kind = 'teacher_feedback' and new.verdict is not null)
       or (new.author_role = 'teacher' and new.kind = 'teacher_answer')
       or (new.author_role = 'student' and new.kind in ('submission', 'question'))) then
    return new;
  end if;

  begin   -- ── khối an toàn: lỗi ở đây KHÔNG làm hỏng nghiệp vụ chính ──
    select * into v_t from public.learning_threads where id = new.thread_id;
    if not found or v_t.learner_user_id is null then return new; end if;
    v_session := case when v_t.session_no is not null then ' Buổi ' || lpad(v_t.session_no::text, 2, '0') else '' end;

    if new.author_role = 'teacher' and new.kind = 'teacher_feedback' then
      -- V1 NGUYÊN VĂN: hoàn tất chấm → học viên
      select coalesce(max(e.seq), 0) into v_cycle from public.learning_thread_events e
       where e.thread_id = new.thread_id and e.author_role = 'student' and e.seq < new.seq;
      v_kind := 'checkpoint_graded';
      v_body := case when v_t.session_no is not null then 'Bài trả Buổi ' || lpad(v_t.session_no::text, 2, '0') else 'Bài trả' end
                || ' của bạn đã được chấm.';
      v_key  := 'grade:' || v_t.id::text || ':' || v_cycle::text;
      v_to   := array[v_t.learner_user_id];

    elsif new.author_role = 'teacher' then
      -- Thầy trả lời Hỏi bài → học viên. Nhiều câu trả lời cho cùng một câu hỏi = 1 thông báo.
      select coalesce(max(e.seq), 0) into v_cycle from public.learning_thread_events e
       where e.thread_id = new.thread_id and e.kind = 'question' and e.seq < new.seq;
      v_kind := 'question_answered';
      v_body := 'Thầy đã trả lời câu hỏi của bạn.';
      v_key  := 'answer:' || v_t.id::text || ':' || v_cycle::text;
      v_to   := array[v_t.learner_user_id];

    else
      -- Học viên nộp bài / hỏi bài → Thầy phụ trách
      if v_t.hidden_at is not null or v_t.archived_at is not null then return new; end if;
      if new.kind = 'submission' then
        select coalesce(max(e.seq), 0) into v_cycle from public.learning_thread_events e
         where e.thread_id = new.thread_id and e.author_role = 'teacher' and e.seq < new.seq;
        v_kind := 'submission_received';
        v_body := 'Học viên vừa nộp bài' || v_session || '.';
        v_key  := 'submit:' || v_t.id::text || ':' || v_cycle::text;
      else
        v_kind := 'question_received';
        v_body := 'Học viên vừa gửi câu hỏi mới.';
        v_key  := 'ask:' || v_t.id::text || ':' || new.seq::text;
      end if;
      -- (1) Thầy phụ trách còn quyền xử lý
      select array(select au.id from public.app_users au
                    where au.id = v_t.last_teacher_user_id and au.role in ('teacher', 'admin')
                      and au.id is distinct from new.author_user_id) into v_to;
      -- (2) Chưa có → Thầy/Admin thuộc lớp của thread
      if coalesce(cardinality(v_to), 0) = 0 and v_t.class_schedule_id is not null then
        select array(select distinct au.id from tva_private.class_memberships m
                       join public.app_users au on au.id = m.user_id and au.role in ('teacher', 'admin')
                      where m.class_id = v_t.class_schedule_id
                        and au.id is distinct from new.author_user_id) into v_to;
      end if;
      if coalesce(cardinality(v_to), 0) = 0 then
        raise warning 'class_system_notice_on_event: không xác định được Thầy nhận (thread %, event %)', new.thread_id, new.id;
        return new;
      end if;
    end if;

    insert into public.class_system_notices (user_id, kind, body, ref_type, ref_key, dedupe_key)
    select r, v_kind, v_body, 'thread', v_t.id::text, v_key from unnest(v_to) r
    on conflict (user_id, dedupe_key) do nothing;
  exception when others then
    -- Chỉ định danh + SQLSTATE: không đưa nội dung bài/nhận xét vào log
    raise warning 'class_system_notice_on_event: bỏ qua thông báo (thread %, event %, SQLSTATE %)', new.thread_id, new.id, sqlstate;
  end;
  return new;
end $$;
comment on function public.class_system_notice_on_event() is 'class_system_chat_v2: thông báo hai chiều (nộp/hỏi → Thầy; chấm/trả lời → học viên); lỗi thông báo không phá nghiệp vụ';
revoke all on function public.class_system_notice_on_event() from public, anon, authenticated;

notify pgrst, 'reload schema';
