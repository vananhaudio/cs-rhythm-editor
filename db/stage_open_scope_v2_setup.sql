-- ═══════════════════════════════════════════════════════════════════════════
-- STAGE_OPEN_SCOPE_V2 (Owner 25/11/2026) — quy tắc mở đầu chặng chỉ áp cho chương trình được KHAI BÁO (đã duyệt: SOLO01).
-- CB1/CB2 chia class_stages 4 buổi theo đợt học → giữ nguyên cơ chế tiến độ trước đây. Lớp SOLO01 mở sau tự được áp.
-- Thêm chương trình khác: CHỈ khi Thầy duyệt, bằng 1 dòng trong tva_private.stage_open_program.
-- KHÔNG đổi dòng khoá, bản ghi mở, tiến độ. Cần STAGE_OPEN_V1. Hoàn tác: db/stage_open_scope_v2_rollback.sql
-- Chạy lại stage_open_v1_setup.sql sẽ GHI ĐÈ phạm vi này → phải chạy lại file này ngay sau đó.
-- CHẠY bằng scripts/prod-db.py (không có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

do $gate$
declare src text;
begin
  select p.prosrc into src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'tva_private' and p.proname = 'session_needs_stage_open';
  if src is null then raise exception 'DỪNG — chưa có STAGE_OPEN_V1'; end if;
  if position('STAGE_OPEN_SCOPE_V2' in src) = 0 and md5(src) <> '5ad92a1a062e7d8be4938f817e33c730' then
    raise exception 'DỪNG — session_needs_stage_open khác bản đã kiểm (md5 %)', md5(src);
  end if;
end $gate$;

create table if not exists tva_private.stage_open_program (
  program_code text primary key,
  approved_note text not null,
  added_at timestamptz not null default now()
);
alter table tva_private.stage_open_program enable row level security;
revoke all on tva_private.stage_open_program from public, anon, authenticated;
insert into tva_private.stage_open_program (program_code, approved_note)
values ('SOLO01', 'Thầy duyệt quy tắc mở đầu chặng của SOLO01 · 25/11/2026')
on conflict (program_code) do nothing;

create or replace function tva_private.session_needs_stage_open(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    -- STAGE_OPEN_SCOPE_V2: chỉ chương trình ĐÃ KHAI BÁO. Lớp có khai chặng KHÔNG tự động là có chặng độc lập về sư phạm.
    select exists (select 1 from tva_private.stage_open_program sp where sp.program_code = c.program_code)
       and coalesce(c.unlock_policy, 'sequential') <> 'open'
       and tva_private.session_stage_id(s.id) is not null
       and exists (select 1 from public.class_sessions e where e.class_id = s.class_id and e.event_type = 'lesson'
                    and e.session_number >= 1 and e.session_number < s.session_number)
       and not exists (select 1 from public.class_sessions e where e.class_id = s.class_id and e.event_type = 'lesson'
                    and e.session_number >= 1 and e.session_number < s.session_number
                    and tva_private.session_stage_id(e.id) = tva_private.session_stage_id(s.id))
       and exists (select 1 from public.class_sessions x join public.class_lesson_content lc on lc.session_id = x.id
                    where x.class_id = s.class_id and x.event_type = 'lesson' and lc.status = 'published'
                      and lc.blocks @> '[{"kind":"checkpoint"}]'::jsonb)
      from public.class_sessions s join public.class_schedule c on c.id = s.class_id
     where s.id = p_session and s.event_type = 'lesson' and s.session_number >= 1), false);
$$;
revoke all on function tva_private.session_needs_stage_open(uuid) from public, anon, authenticated;
