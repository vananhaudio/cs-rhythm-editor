-- ═══════════════════════════════════════════════════════════════════════════
-- Lịch sử xử lý công cụ Nhịp Phách (Giai đoạn 10B.1)
--
-- CHỈ LƯU METADATA. Tuyệt đối không có MusicXML, SVG, PDF, PNG, ZIP, base64
-- hay blob URL trong hai bảng này — xem sanitizer ở src/nhipphach/jobs.ts và
-- bộ test soi thẳng nội dung cột.
--
-- Idempotent. Chạy xong nhớ: notify pgrst, 'reload schema';
-- Nếu chạy lại db/rls_setup.sql thì hai bảng này PHẢI nằm trong self_managed.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Mỗi lần xử lý là một "job" ──────────────────────────────────────────
create table if not exists public.nhipphach_jobs (
  id                    text        not null,
  user_id               uuid        not null references auth.users(id) on delete cascade,
  mode                  text        not null check (mode in ('single','batch')),
  export_format         text        not null check (export_format in ('pdf','svg','png')),
  preset_id             text,
  preset_name           text,
  -- Ảnh chụp thiết lập TẠI THỜI ĐIỂM xử lý. Sửa preset về sau không đổi job cũ.
  -- Đã qua sanitizer: không mang cách chia 5/8, 7/8 (xem mục 5 của đặc tả).
  settings_snapshot     jsonb       not null,
  counting_mode         text,
  page_size             text        not null default 'A4',
  orientation           text        not null check (orientation in ('portrait','landscape')),
  total_items           integer     not null check (total_items >= 0),
  done_items            integer     not null default 0 check (done_items >= 0),
  error_items           integer     not null default 0 check (error_items >= 0),
  needs_grouping_items  integer     not null default 0 check (needs_grouping_items >= 0),
  status                text        not null check (status in ('completed','completed_with_errors','failed')),
  started_at            timestamptz not null,
  finished_at           timestamptz not null,
  duration_ms           integer     not null check (duration_ms >= 0),
  created_at            timestamptz not null default now(),
  constraint nhipphach_jobs_pkey primary key (user_id, id)
);
-- Danh sách "Gần đây" luôn đọc theo thứ tự mới nhất trước.
create index if not exists nhipphach_jobs_recent_idx
  on public.nhipphach_jobs (user_id, created_at desc);

-- ── 2) Từng bài trong một job ──────────────────────────────────────────────
create table if not exists public.nhipphach_job_items (
  user_id           uuid    not null,
  job_id            text    not null,
  item_id           text    not null,
  -- CHỈ tên file, không bao giờ là nội dung file.
  source_name       text    not null,
  output_name       text,
  status            text    not null check (status in ('done','error','needs_grouping')),
  error_code        text,
  -- Đã cắt ngắn và bỏ mọi mảnh mã nguồn; xem sanitizeErrorMessage().
  error_message     text    check (error_message is null or length(error_message) <= 500),
  meter_summary     jsonb,
  -- Cách chia THỰC SỰ đã dùng cho chính bài này. Đây là sự kiện quá khứ, khác
  -- hẳn preset: lịch sử được phép nhớ, nhưng KHÔNG BAO GIỜ thành mặc định cho
  -- bài mới (xem mục 5 của đặc tả và bộ test "không tái sử dụng toàn cục").
  grouping_snapshot jsonb,
  page_count        integer check (page_count is null or page_count >= 0),
  annotation_count  integer check (annotation_count is null or annotation_count >= 0),
  duration_ms       integer check (duration_ms is null or duration_ms >= 0),
  created_at        timestamptz not null default now(),
  constraint nhipphach_job_items_pkey primary key (user_id, job_id, item_id),
  constraint nhipphach_job_items_job_fkey foreign key (user_id, job_id)
    references public.nhipphach_jobs (user_id, id) on delete cascade
);
create index if not exists nhipphach_job_items_job_idx
  on public.nhipphach_job_items (user_id, job_id);

-- ── 3) RLS: chủ sở hữu, VÀ phải là thầy ────────────────────────────────────
alter table public.nhipphach_jobs      enable row level security;
alter table public.nhipphach_job_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['nhipphach_jobs','nhipphach_job_items'] loop
    -- Xoá MỌI policy đang có, không chỉ policy do script này đặt tên: policy
    -- trong Postgres được OR, chỉ một policy rộng sót lại là mọi người đọc
    -- được lịch sử của nhau.
    declare p record;
    begin
      for p in select policyname from pg_policies
               where schemaname = 'public' and tablename = t loop
        execute format('drop policy if exists %I on public.%I', p.policyname, t);
      end loop;
    end;
    execute format($f$create policy %I on public.%I
      for select to authenticated using (user_id = auth.uid() and public.is_teacher())$f$,
      t || '_own_select', t);
    execute format($f$create policy %I on public.%I
      for insert to authenticated with check (user_id = auth.uid() and public.is_teacher())$f$,
      t || '_own_insert', t);
    execute format($f$create policy %I on public.%I
      for update to authenticated using (user_id = auth.uid() and public.is_teacher())
      with check (user_id = auth.uid() and public.is_teacher())$f$,
      t || '_own_update', t);
    execute format($f$create policy %I on public.%I
      for delete to authenticated using (user_id = auth.uid() and public.is_teacher())$f$,
      t || '_own_delete', t);
  end loop;
end $$;

revoke all on public.nhipphach_jobs      from anon;
revoke all on public.nhipphach_job_items from anon;
grant select, insert, update, delete on public.nhipphach_jobs      to authenticated;
grant select, insert, update, delete on public.nhipphach_job_items to authenticated;

-- ── 4) Ghi lịch sử trong MỘT giao dịch ─────────────────────────────────────
--
-- Vì sao cần function: ghi job rồi ghi item bằng hai request riêng thì một lần
-- hỏng giữa chừng để lại job RỖNG — "6 bài" mà không có bài nào. Toàn bộ thân
-- function chạy trong đúng một giao dịch: item hỏng thì job cũng biến mất theo.
--
-- SECURITY INVOKER (mặc định, ghi rõ cho khỏi hiểu nhầm): RLS của CHÍNH người
-- gọi vẫn có hiệu lực. KHÔNG dùng SECURITY DEFINER — làm thế là tự tay mở một
-- cửa sau đi vòng qua policy.
--
-- `user_id` LẤY TỪ auth.uid(), không bao giờ từ payload: client gửi kèm user_id
-- của người khác cũng không ghi sang được.
create or replace function public.nhipphach_create_history(
  job_json   jsonb,
  items_json jsonb
) returns text
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  uid    uuid := auth.uid();
  job_id text := job_json ->> 'id';
begin
  if uid is null then
    raise exception 'NHIPPHACH_HISTORY_NO_SESSION' using errcode = '28000';
  end if;
  if job_id is null or length(job_id) = 0 then
    raise exception 'NHIPPHACH_HISTORY_NO_ID' using errcode = '22023';
  end if;
  if jsonb_typeof(items_json) <> 'array' then
    raise exception 'NHIPPHACH_HISTORY_ITEMS_NOT_ARRAY' using errcode = '22023';
  end if;

  insert into public.nhipphach_jobs (
    id, user_id, mode, export_format, preset_id, preset_name,
    settings_snapshot, counting_mode, page_size, orientation,
    total_items, done_items, error_items, needs_grouping_items,
    status, started_at, finished_at, duration_ms
  ) values (
    job_id,
    uid,
    job_json ->> 'mode',
    job_json ->> 'export_format',
    job_json ->> 'preset_id',
    job_json ->> 'preset_name',
    coalesce(job_json -> 'settings_snapshot', '{}'::jsonb),
    job_json ->> 'counting_mode',
    coalesce(job_json ->> 'page_size', 'A4'),
    job_json ->> 'orientation',
    (job_json ->> 'total_items')::integer,
    coalesce((job_json ->> 'done_items')::integer, 0),
    coalesce((job_json ->> 'error_items')::integer, 0),
    coalesce((job_json ->> 'needs_grouping_items')::integer, 0),
    job_json ->> 'status',
    (job_json ->> 'started_at')::timestamptz,
    (job_json ->> 'finished_at')::timestamptz,
    (job_json ->> 'duration_ms')::integer
  );

  insert into public.nhipphach_job_items (
    user_id, job_id, item_id, source_name, output_name, status,
    error_code, error_message, meter_summary, grouping_snapshot,
    page_count, annotation_count, duration_ms
  )
  select
    uid,
    job_id,
    it ->> 'item_id',
    it ->> 'source_name',
    it ->> 'output_name',
    it ->> 'status',
    it ->> 'error_code',
    it ->> 'error_message',
    nullif(it -> 'meter_summary',     'null'::jsonb),
    nullif(it -> 'grouping_snapshot', 'null'::jsonb),
    (it ->> 'page_count')::integer,
    (it ->> 'annotation_count')::integer,
    (it ->> 'duration_ms')::integer
  from jsonb_array_elements(items_json) as it;

  return job_id;
end
$fn$;

revoke all on function public.nhipphach_create_history(jsonb, jsonb) from public;
revoke all on function public.nhipphach_create_history(jsonb, jsonb) from anon;
grant execute on function public.nhipphach_create_history(jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
