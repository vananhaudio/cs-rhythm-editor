-- ROLLBACK Class System Chat V3 → khôi phục HÀNH VI trigger V2 (thân hàm giống hệt V2). Idempotent. Chạy bằng prod-db.py (một transaction).
-- BẢO TOÀN DỮ LIỆU: KHÔNG xoá thông báo nào (kể cả kind 'teacher_commented' đã tạo bởi V3); trạng thái đọc giữ nguyên.
-- CHECK kind GIỮ NGUYÊN bản mở rộng của V3 (tập cha của V2, vô hại; hàm V2 không bao giờ sinh 'teacher_commented'). Vì vậy KHÔNG cần xoá hay NOT VALID.
-- Thông báo 'teacher_commented' còn lại vẫn đọc / đánh dấu đã đọc bình thường qua RPC (RPC không lọc theo kind); app cũ hiện nút 'Xem chi tiết'.
-- Không đụng lt_*, dm_*, dữ liệu Learning Thread, RLS, quyền. Rollback FE (revert nhánh V3) TRƯỚC khi chạy file này.
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
