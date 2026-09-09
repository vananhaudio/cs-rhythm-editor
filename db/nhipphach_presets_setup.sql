-- ═══════════════════════════════════════════════════════════════════════════
-- Preset công cụ Nhịp Phách theo TÀI KHOẢN (Giai đoạn 10A)
--
-- Preset cá nhân của thầy đi theo tài khoản, không phụ thuộc máy hay trình duyệt.
-- Chỉ lưu THIẾT LẬP TRÌNH BÀY. KHÔNG lưu MusicXML, KHÔNG lưu PDF, và tuyệt đối
-- KHÔNG lưu cách chia nhịp lẻ (5/8, 7/8) — cách chia là thuộc tính của bản nhạc,
-- để vào preset là mở đường cho hệ thống tự đoán 2+3 hay 2+2+3.
--
-- Idempotent. Chạy xong nhớ: notify pgrst, 'reload schema';
-- Nếu chạy lại db/rls_setup.sql thì PHẢI thêm hai bảng này vào mảng self_managed.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Preset cá nhân ──────────────────────────────────────────────────────
-- `id` là TEXT chứ không phải uuid: id do client sinh (usr-xxxx) đã tồn tại trong
-- localStorage của thầy từ Giai đoạn 9A. Giữ nguyên id thì việc đưa preset cũ lên
-- tài khoản mới idempotent được — cùng id là cùng preset, chạy lại không nhân đôi.
create table if not exists public.nhipphach_presets (
  id          text        not null,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null check (length(btrim(name)) between 1 and 60),
  settings    jsonb       not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Khoá chính GHÉP: id chỉ duy nhất TRONG PHẠM VI một người dùng.
  -- Hai thầy hoàn toàn có thể sinh trùng id (id do client sinh), và quan trọng
  -- hơn: không truy vấn nào có thể chạm tới dòng của người khác chỉ bằng `id`.
  constraint nhipphach_presets_pkey primary key (user_id, id)
);

-- Nâng cấp bảng đã tạo từ lần chạy trước: đổi khoá chính (id) → (user_id, id).
do $$
declare
  pk_name text;
  pk_cols text[];
begin
  select c.conname,
         array_agg(a.attname order by k.ord)
    into pk_name, pk_cols
    from pg_constraint c
    join lateral unnest(c.conkey) with ordinality as k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
   where c.conrelid = 'public.nhipphach_presets'::regclass and c.contype = 'p'
   group by c.conname;

  if pk_name is not null and pk_cols is distinct from array['user_id','id'] then
    execute format('alter table public.nhipphach_presets drop constraint %I', pk_name);
    pk_name := null;
  end if;

  if pk_name is null then
    alter table public.nhipphach_presets
      add constraint nhipphach_presets_pkey primary key (user_id, id);
  end if;
end $$;

create index if not exists nhipphach_presets_user_idx
  on public.nhipphach_presets (user_id, updated_at desc);

-- ── 2) Lựa chọn của người dùng ─────────────────────────────────────────────
-- Tách riêng vì preset MẶC ĐỊNH có thể là một preset HỆ THỐNG (Phách cơ bản,
-- Chia móc đơn, Chia móc kép, Tài liệu học sinh). Preset hệ thống nằm trong mã
-- nguồn và KHÔNG được nhân bản xuống DB, nên không thể dùng cột is_default trên
-- bảng trên để trỏ tới nó. Một dòng cho mỗi người dùng cũng tự bảo đảm
-- "nhiều nhất một mặc định", không cần unique index từng phần.
create table if not exists public.nhipphach_prefs (
  user_id               uuid        primary key references auth.users(id) on delete cascade,
  default_preset_id     text,
  -- Mặc định trỏ tới preset HỆ THỐNG (nằm trong mã nguồn) hay preset CÁ NHÂN
  -- (nằm ở bảng trên). Có cột này thì client không phải đoán từ hình dạng id.
  default_preset_source text check (default_preset_source in ('system','custom')),
  updated_at            timestamptz not null default now(),
  -- Hai cột đi cùng nhau: có id thì phải có nguồn, và ngược lại.
  constraint nhipphach_prefs_default_pair check (
    (default_preset_id is null and default_preset_source is null)
    or (default_preset_id is not null and default_preset_source is not null)
  )
);
-- Bổ sung cột khi bảng đã tồn tại từ lần chạy trước (script phải idempotent).
alter table public.nhipphach_prefs
  add column if not exists default_preset_source text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'nhipphach_prefs_source_valid') then
    alter table public.nhipphach_prefs add constraint nhipphach_prefs_source_valid
      check (default_preset_source is null or default_preset_source in ('system','custom'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nhipphach_prefs_default_pair') then
    alter table public.nhipphach_prefs add constraint nhipphach_prefs_default_pair
      check ((default_preset_id is null and default_preset_source is null)
          or (default_preset_id is not null and default_preset_source is not null));
  end if;
end $$;

-- ── 3) updated_at tự cập nhật ──────────────────────────────────────────────
create or replace function public.nhipphach_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists nhipphach_presets_touch on public.nhipphach_presets;
create trigger nhipphach_presets_touch before update on public.nhipphach_presets
  for each row execute function public.nhipphach_touch();
drop trigger if exists nhipphach_prefs_touch on public.nhipphach_prefs;
create trigger nhipphach_prefs_touch before update on public.nhipphach_prefs
  for each row execute function public.nhipphach_touch();

-- ── 4) RLS: chủ sở hữu, VÀ phải là thầy ────────────────────────────────────
-- Ràng buộc kép có chủ đích: `user_id = auth.uid()` chặn người này đọc/sửa dữ
-- liệu người kia; `is_teacher()` giữ đúng luật "không mở quyền cho học viên chỉ
-- vì bảng có RLS" — công cụ Nhịp Phách vốn chỉ dành cho teacher/admin.
alter table public.nhipphach_presets enable row level security;
alter table public.nhipphach_prefs   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['nhipphach_presets','nhipphach_prefs'] loop
    -- Xoá MỌI policy đang có trên bảng, không chỉ policy do script này đặt tên.
    -- Policy trong Postgres được OR với nhau: chỉ cần một policy rộng sót lại từ
    -- lần chạy rls_setup.sql trước khi hai bảng được đưa vào self_managed là mọi
    -- người đọc được preset của nhau, dù các policy hẹp bên dưới vẫn đúng.
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

-- anon không có policy nào → không đọc, không ghi.
revoke all on public.nhipphach_presets from anon;
revoke all on public.nhipphach_prefs   from anon;
grant select, insert, update, delete on public.nhipphach_presets to authenticated;
grant select, insert, update, delete on public.nhipphach_prefs   to authenticated;

notify pgrst, 'reload schema';
