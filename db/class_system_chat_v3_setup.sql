-- CLASS SYSTEM CHAT V3 — hoàn thiện thông báo học tập: NHẬN XÉT / ĐẠT / NỘP LẠI tách bạch. *** BẢN NHÁP — CHƯA CHẠY PRODUCTION, chờ Owner duyệt riêng. ***
-- Chạy bằng scripts/prod-db.py (một transaction; file KHÔNG có begin/commit). Idempotent, ADDITIVE trên V2 (V2 đang LIVE).
--   • KHÔNG bảng mới, KHÔNG sửa lt_* / dm_* / RPC client / RLS / quyền. Chỉ: (1) nới CHECK `kind` thêm 'teacher_commented', (2) thay thân hàm trigger V2.
--   • Mỗi thao tác của Thầy = MỘT sự kiện Learning Thread = tối đa MỘT thông báo cho học viên:
--       chấm ĐẠT (có thể kèm nhận xét)  → kind checkpoint_graded   "Bài trả Buổi 02 của bạn đã ĐẠT."
--       yêu cầu NỘP LẠI (kèm nhận xét)  → kind checkpoint_graded   "Thầy yêu cầu bạn nộp lại bài trả Buổi 02."
--       chỉ nhận xét, chưa chấm         → kind teacher_commented    "Thầy vừa nhận xét bài trả Buổi 02 của bạn."   (MỚI)
--       trả lời Hỏi bài                 → kind question_answered    (V2)
--     Giữ kind cũ cho ĐẠT/NỘP LẠI để app đã phát hành (không biết kind mới) vẫn mở đúng chỗ ("Xem kết quả"); chỉ 'teacher_commented' là kind mới
--     (app cũ hiển thị với nút "Xem chi tiết", vẫn mở đúng thread).
--   • Học viên nộp lại sau 'retry' → cùng kind submission_received nhưng nội dung "nộp LẠI" để Thầy phân biệt.
--   • Chống trùng (unique(user_id, dedupe_key)) — theo VÒNG ĐỜI NGHIỆP VỤ, không theo giờ client:
--       grade:<thread>:<lượt nộp>:<verdict>   cùng kết quả trong cùng lượt nộp = 1 thông báo (lưu lại/gửi lại do mạng không nhân đôi);
--                                             ĐỔI kết quả (nộp lại → đạt) = thông báo mới, không bị nuốt.
--       comment:<thread>:<seq sự kiện>        + chỉ bỏ qua khi học viên còn một thông báo 'teacher_commented' CHƯA ĐỌC cho thread này
--                                             (Thầy nhận xét nhiều lần liền = 1; học viên đã đọc rồi Thầy nhận xét tiếp = thông báo mới)
--       answer:<thread>:<seq sự kiện>         + cùng luật "đang còn thông báo trả lời chưa đọc thì không thêm"
--       submit:<thread>:<seq phản hồi gần nhất của Thầy> · ask:<thread>:<seq câu hỏi>   GIỮ NGUYÊN V2
--     Hàng V1/V2 cũ giữ nguyên (khoá cũ không khớp khoá mới → không xung đột; tối đa 1 thông báo thừa duy nhất cho thread đang chấm đúng lúc triển khai).
--   • An toàn transaction + người nhận: GIỮ NGUYÊN V2 (khối EXCEPTION con; lỗi thông báo không phá nghiệp vụ; Thầy phụ trách → Thầy thuộc lớp;
--     không bao giờ gửi cho tác giả sự kiện; không đưa tên/nội dung bài vào thông báo). KHÔNG backfill.

-- 0) Cổng nền: phải có V2
do $gate$
begin
  if to_regclass('public.class_system_notices') is null or to_regclass('public.class_system_notice_reads') is null
     or to_regprocedure('public.class_system_notice_on_event()') is null then
    raise exception 'DỪNG — thiếu System Chat V1/V2';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'class_system_notices_kind_check'
                  and conrelid = 'public.class_system_notices'::regclass and pg_get_constraintdef(oid) like '%question_answered%') then
    raise exception 'DỪNG — thiếu System Chat V2 (CHECK kind chưa có question_answered): chạy class_system_chat_v2_setup.sql trước';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'class_system_notice_on_event'
                  and tgrelid = 'public.learning_thread_events'::regclass and not tgisinternal) then
    raise exception 'DỪNG — thiếu trigger class_system_notice_on_event trên learning_thread_events';
  end if;
end $gate$;

-- 1) Nới CHECK kind (mọi kind cũ vẫn hợp lệ; dữ liệu cũ đọc được nguyên vẹn)
alter table public.class_system_notices drop constraint if exists class_system_notices_kind_check;
alter table public.class_system_notices add constraint class_system_notices_kind_check
  check (kind in ('checkpoint_graded', 'submission_received', 'question_received', 'question_answered', 'teacher_commented'));

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
  v_guard boolean := false;   -- true = bỏ qua nếu học viên còn thông báo CÙNG LOẠI chưa đọc cho thread này
  v_resub boolean;
begin
  if new.hidden_at is not null then return new; end if;
  -- Chỉ các sự kiện có ý nghĩa với người kia; mọi thứ khác thoát ngay, không tốn truy vấn
  if not ((new.author_role = 'teacher' and new.kind in ('teacher_feedback', 'teacher_answer'))
       or (new.author_role = 'student' and new.kind in ('submission', 'question'))) then
    return new;
  end if;

  begin   -- ── khối an toàn: lỗi ở đây KHÔNG làm hỏng nghiệp vụ chính ──
    select * into v_t from public.learning_threads where id = new.thread_id;
    if not found or v_t.learner_user_id is null then return new; end if;
    v_session := case when v_t.session_no is not null then ' Buổi ' || lpad(v_t.session_no::text, 2, '0') else '' end;

    if new.author_role = 'teacher' and new.kind = 'teacher_feedback' then
      -- Thầy phản hồi bài trả → học viên. Một lần lưu (nhận xét + kết quả) = MỘT thông báo, nội dung theo kết quả.
      select coalesce(max(e.seq), 0) into v_cycle from public.learning_thread_events e
       where e.thread_id = new.thread_id and e.author_role = 'student' and e.seq < new.seq;
      v_to := array[v_t.learner_user_id];
      if new.verdict is not null then
        v_kind := 'checkpoint_graded';
        v_body := case new.verdict
                    when 'pass' then 'Bài trả' || v_session || ' của bạn đã ĐẠT.'
                    else 'Thầy yêu cầu bạn nộp lại bài trả' || v_session || '.' end;
        v_key  := 'grade:' || v_t.id::text || ':' || v_cycle::text || ':' || new.verdict;
      else
        v_kind := 'teacher_commented';
        v_body := 'Thầy vừa nhận xét bài trả' || v_session || ' của bạn.';
        v_key  := 'comment:' || v_t.id::text || ':' || new.seq::text;
        v_guard := true;
      end if;

    elsif new.author_role = 'teacher' then
      -- Thầy trả lời Hỏi bài → học viên. Nhiều câu trả lời liền nhau khi chưa đọc = 1 thông báo.
      v_kind := 'question_answered';
      v_body := 'Thầy đã trả lời câu hỏi của bạn.';
      v_key  := 'answer:' || v_t.id::text || ':' || new.seq::text;
      v_to   := array[v_t.learner_user_id];
      v_guard := true;

    else
      -- Học viên nộp bài / hỏi bài → Thầy phụ trách (GIỮ NGUYÊN V2, thêm nội dung "nộp lại")
      if v_t.hidden_at is not null or v_t.archived_at is not null then return new; end if;
      if new.kind = 'submission' then
        select coalesce(max(e.seq), 0) into v_cycle from public.learning_thread_events e
         where e.thread_id = new.thread_id and e.author_role = 'teacher' and e.seq < new.seq;
        -- Nộp LẠI = lần chấm gần nhất trước lượt nộp này là 'retry'
        select (select e.verdict from public.learning_thread_events e
                 where e.thread_id = new.thread_id and e.kind = 'teacher_feedback' and e.verdict is not null and e.seq < new.seq
                 order by e.seq desc limit 1) = 'retry' into v_resub;
        v_kind := 'submission_received';
        v_body := case when coalesce(v_resub, false) then 'Học viên vừa nộp lại bài' else 'Học viên vừa nộp bài' end || v_session || '.';
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

    -- Đang còn thông báo cùng loại CHƯA ĐỌC cho thread này → không thêm (nhận xét/trả lời liền nhau, mạng gửi lại). Đã đọc rồi → thông báo mới.
    if v_guard and exists (
         select 1 from public.class_system_notices n
          where n.user_id = v_to[1] and n.kind = v_kind and n.ref_key = v_t.id::text
            and n.seq > coalesce((select r.last_read_seq from public.class_system_notice_reads r where r.user_id = v_to[1]), 0)) then
      return new;
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
comment on function public.class_system_notice_on_event() is 'class_system_chat_v3: thông báo hai chiều, nhận xét/đạt/nộp lại tách bạch; lỗi thông báo không phá nghiệp vụ';
revoke all on function public.class_system_notice_on_event() from public, anon, authenticated;

notify pgrst, 'reload schema';
