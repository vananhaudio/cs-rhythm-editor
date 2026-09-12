-- ═══════════════════════════════════════════════════════════════════════════
-- Thư viện bài hát Nhịp Phách (Giai đoạn Nội dung 1)
--
-- HAI TẦNG TÁCH BẠCH:
--   STORAGE  bucket `nhipphach-scores`  ← file MusicXML THẬT
--   DATABASE hai bảng dưới đây           ← metadata, quyền, đồ thị phiên bản
-- KHÔNG có raw XML trong database: không cột text chứa XML, không base64 trong
-- jsonb. Có test soi thẳng nội dung cột để khoá điều này.
--
-- BẢN GỐC BẤT BIẾN. v1 là file thầy nạp vào lần đầu và không bao giờ bị ghi đè:
-- mọi sửa đổi về sau sinh version MỚI. Ở đây điều đó không chỉ là quy ước —
-- một trigger chặn thẳng UPDATE/DELETE trên bảng phiên bản.
--
-- Idempotent. Chạy xong nhớ: notify pgrst, 'reload schema';
-- Nếu chạy lại db/rls_setup.sql thì hai bảng này PHẢI nằm trong self_managed.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0) Quyền: đọc một cờ capability trong policy ───────────────────────────
--
-- `my_nhipphach_caps()` trả {role, caps:{…}} và là nguồn quyền duy nhất của
-- công cụ (Giai đoạn 12). Policy cần một boolean, nên bọc lại cho gọn —
-- KHÔNG viết `is_teacher()` rải rác trong policy, vì thế là dựng một đường
-- quyền thứ hai chạy song song với ma trận Admin đang chỉnh.
create or replace function public.nhipphach_can(cap text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(((public.my_nhipphach_caps() -> 'caps') ->> cap)::boolean, false);
$$;
revoke all on function public.nhipphach_can(text) from public;
revoke all on function public.nhipphach_can(text) from anon;
grant execute on function public.nhipphach_can(text) to authenticated;

-- ── 1) Ba quyền mới của Thư viện ───────────────────────────────────────────
--
-- Phải khớp `NHIPPHACH_CAPS` ở src/nhipphach/capabilities.ts — có test so hai
-- bên để không bên nào trôi.
create or replace function public.nhipphach_capability_list()
returns text[] language sql immutable set search_path = '' as $$
  select array[
    'access',
    'advanced',
    'export.pdf',
    'export.png',
    'export.svg',
    'export.beatmap',
    'batch',
    'presets',
    'history',
    'library.read',
    'library.save',
    'library.manage',
    -- Chọn/sửa nốt trên bản nhạc (Giai đoạn Nội dung 2). Chỉ có ở mức Nâng cao.
    'score.edit'
  ];
$$;

-- Thư viện CỐ Ý không nằm trong mức Nâng cao: mở một bài đã lưu là việc cơ bản
-- nhất của công cụ, che nó sau một công tắc là bắt học viên đi đường vòng.
-- (`nhipphach_advanced_only()` giữ nguyên, không đụng.)

insert into public.tool_capabilities (tool_id, role, capability, allowed) values
  -- Học viên ĐỌC được cả kho. Kho là chung của thầy, không phải kho riêng.
  ('nhipphach', 'student', 'library.read',   true),
  ('nhipphach', 'student', 'library.save',   false),
  ('nhipphach', 'student', 'library.manage', false),
  ('nhipphach', 'teacher', 'library.read',   true),
  ('nhipphach', 'teacher', 'library.save',   true),
  ('nhipphach', 'teacher', 'library.manage', true)
on conflict (tool_id, role, capability) do nothing;

-- CỐ Ý không clamp học viên như `presets`/`history`. Hai quyền kia bị khoá cứng
-- vì RLS của chúng vẫn là `is_teacher()` — bật lên là gặp lỗi. Thư viện thì RLS
-- đi thẳng theo capability, nên nếu mai này Admin muốn mở cho học viên tự lưu
-- bài, chỉ cần bật cờ trong trang quản trị, không phải sửa một dòng mã nào.

-- ── 2) Một bài hát trong kho ───────────────────────────────────────────────
create table if not exists public.nhipphach_scores (
  id                  uuid        primary key default gen_random_uuid(),
  -- Tên hiển thị. Sửa tên ở đây KHÔNG sửa <work-title> bên trong MusicXML:
  -- file là bằng chứng gốc, tên chỉ là nhãn để tìm.
  title               text        not null check (length(btrim(title)) > 0),
  composer            text,
  lyricist            text,
  -- Tên file lúc nạp — chỉ để hiển thị, KHÔNG bao giờ dùng làm khoá.
  source_filename     text,
  owner_id            uuid        not null references auth.users(id) on delete cascade,
  current_version_id  uuid,
  -- Vòng đầu cả kho là 'shared': thầy lưu, học viên đọc. Cột có sẵn để sau này
  -- bật riêng tư từng bài mà không phải migrate lần nữa.
  visibility          text        not null default 'shared'
                        check (visibility in ('shared', 'private')),
  -- Vài con số để hiện trong danh sách. KHÔNG chép MusicXML thành metadata.
  primary_meter       text,
  page_count          integer     check (page_count is null or page_count >= 0),
  -- Xoá là ĐÁNH DẤU, không phải huỷ. Storage không bị đụng tới ở giai đoạn này.
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid        not null references auth.users(id) on delete cascade
);
create index if not exists nhipphach_scores_recent_idx
  on public.nhipphach_scores (archived_at, updated_at desc);
-- Tìm theo tên bài và tên tác giả — đúng hai thứ ô tìm kiếm nhận.
create index if not exists nhipphach_scores_title_idx
  on public.nhipphach_scores (lower(title));
create index if not exists nhipphach_scores_composer_idx
  on public.nhipphach_scores (lower(coalesce(composer, '')));

-- ── 3) Mỗi phiên bản là một sự kiện đã xảy ra ──────────────────────────────
create table if not exists public.nhipphach_score_versions (
  id                 uuid        primary key default gen_random_uuid(),
  score_id           uuid        not null references public.nhipphach_scores(id) on delete cascade,
  version_number     integer     not null check (version_number >= 1),
  parent_version_id  uuid        references public.nhipphach_score_versions(id),
  -- Đường dẫn trong bucket. Sinh từ id, KHÔNG từ tên file người dùng đặt.
  storage_path       text        not null unique,
  -- SHA-256 của chính byte đã tải lên, viết thường 64 ký tự hex.
  sha256             text        not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes         integer     not null check (size_bytes > 0),
  change_type        text        not null check (change_type in ('original', 'edit', 'import')),
  change_note        text        check (change_note is null or length(change_note) <= 300),
  created_by         uuid        not null references auth.users(id) on delete cascade,
  created_at         timestamptz not null default now(),
  constraint nhipphach_score_versions_seq_uniq unique (score_id, version_number)
);
create index if not exists nhipphach_score_versions_score_idx
  on public.nhipphach_score_versions (score_id, version_number desc);
-- Nạp lại đúng file cũ thì nhận ra ngay, không tạo bài trùng trong im lặng.
create index if not exists nhipphach_score_versions_sha_idx
  on public.nhipphach_score_versions (sha256);

alter table public.nhipphach_scores
  drop constraint if exists nhipphach_scores_current_version_fk;
alter table public.nhipphach_scores
  add constraint nhipphach_scores_current_version_fk
  foreign key (current_version_id) references public.nhipphach_score_versions(id);

-- ── 4) PHIÊN BẢN LÀ BẤT BIẾN — chặn ở database, không chỉ ở mã ─────────────
--
-- Editor mai sau, một script sửa vội, hay chính tôi trong một phiên khác đều
-- không được PATCH đè lên v1. Ứng dụng có thể quên; trigger thì không.
create or replace function public.nhipphach_versions_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'NHIPPHACH_VERSION_IMMUTABLE: phiên bản đã ghi thì không sửa, hãy tạo phiên bản mới'
      using errcode = '23514';
  end if;
  raise exception 'NHIPPHACH_VERSION_UNDELETABLE: không xoá phiên bản; hãy lưu trữ cả bài'
    using errcode = '23514';
end $$;
drop trigger if exists nhipphach_versions_immutable_trg on public.nhipphach_score_versions;
create trigger nhipphach_versions_immutable_trg
  before update or delete on public.nhipphach_score_versions
  for each row execute function public.nhipphach_versions_immutable();

-- ── 5) Lưu một phiên bản: MỘT giao dịch ────────────────────────────────────
--
-- Ghi bảng bài rồi ghi bảng phiên bản bằng hai request có một khe hở thật:
-- hỏng ở giữa để lại một bài không có phiên bản nào, hoặc một phiên bản mà
-- con trỏ `current` không trỏ tới. Cả ba bước đi qua một hàm.
--
-- SECURITY INVOKER, cố ý — RLS của chính người gọi vẫn có hiệu lực. Không dùng
-- SECURITY DEFINER: làm thế là tự tay mở cửa sau đi vòng qua policy.
-- `created_by`/`owner_id` lấy từ auth.uid(), KHÔNG BAO GIỜ từ payload.
create or replace function public.nhipphach_save_version(
  score_json   jsonb,
  version_json jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  uid          uuid := auth.uid();
  v_score_id   uuid := nullif(score_json ->> 'id', '')::uuid;
  v_next       integer;
  v_parent     uuid;
  v_version_id uuid;
  v_is_new     boolean := false;
begin
  if uid is null then
    raise exception 'NHIPPHACH_LIBRARY_NO_SESSION' using errcode = '28000';
  end if;
  if coalesce(btrim(score_json ->> 'title'), '') = '' then
    raise exception 'NHIPPHACH_LIBRARY_NO_TITLE' using errcode = '22023';
  end if;
  if (version_json ->> 'storage_path') is null
     or (version_json ->> 'sha256') is null then
    raise exception 'NHIPPHACH_LIBRARY_NO_OBJECT' using errcode = '22023';
  end if;

  -- Client sinh sẵn id để biết trước THƯ MỤC sẽ tải file lên; nếu id đó chưa có
  -- trong kho thì đây là bài mới. Nhận id từ client vẫn an toàn: RLS kẹp
  -- owner_id = auth.uid(), nên không ai chèn bài vào chỗ của người khác.
  if v_score_id is null then
    v_score_id := gen_random_uuid();
  end if;
  if not exists (select 1 from public.nhipphach_scores where id = v_score_id) then
    v_is_new := true;
    insert into public.nhipphach_scores
      (id, title, composer, lyricist, source_filename, owner_id, created_by,
       primary_meter, page_count)
    values (
      v_score_id,
      btrim(score_json ->> 'title'),
      nullif(btrim(coalesce(score_json ->> 'composer', '')), ''),
      nullif(btrim(coalesce(score_json ->> 'lyricist', '')), ''),
      nullif(btrim(coalesce(score_json ->> 'source_filename', '')), ''),
      uid, uid,
      nullif(btrim(coalesce(score_json ->> 'primary_meter', '')), ''),
      nullif(score_json ->> 'page_count', '')::integer
    );
  end if;

  select coalesce(max(version_number), 0) + 1,
         (select id from public.nhipphach_score_versions
            where score_id = v_score_id
            order by version_number desc limit 1)
    into v_next, v_parent
    from public.nhipphach_score_versions
   where score_id = v_score_id;

  insert into public.nhipphach_score_versions
    (score_id, version_number, parent_version_id, storage_path, sha256,
     size_bytes, change_type, change_note, created_by)
  values (
    v_score_id, v_next, v_parent,
    version_json ->> 'storage_path',
    lower(version_json ->> 'sha256'),
    (version_json ->> 'size_bytes')::integer,
    coalesce(version_json ->> 'change_type', case when v_next = 1 then 'original' else 'edit' end),
    nullif(btrim(coalesce(version_json ->> 'change_note', '')), ''),
    uid
  )
  returning id into v_version_id;

  -- Con trỏ `current` chỉ TIẾN. Khôi phục bản cũ là tạo phiên bản mới từ nội
  -- dung cũ, không phải quay con trỏ ngược về v1.
  update public.nhipphach_scores
     set current_version_id = v_version_id,
         updated_at = now()
   where id = v_score_id;

  return jsonb_build_object(
    'score_id', v_score_id,
    'version_id', v_version_id,
    'version_number', v_next,
    'created_score', v_is_new
  );
end $fn$;
revoke all on function public.nhipphach_save_version(jsonb, jsonb) from public;
revoke all on function public.nhipphach_save_version(jsonb, jsonb) from anon;
grant execute on function public.nhipphach_save_version(jsonb, jsonb) to authenticated;

-- ── 6) RLS ─────────────────────────────────────────────────────────────────
alter table public.nhipphach_scores          enable row level security;
alter table public.nhipphach_score_versions  enable row level security;

-- Xoá MỌI policy đang có trước khi tạo policy hẹp: nếu không, một policy rộng
-- do rls_setup.sql để lại sẽ OR với policy mới và mở toang cả kho.
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
            where schemaname = 'public'
              and tablename in ('nhipphach_scores', 'nhipphach_score_versions')
  loop
    execute format('drop policy %I on public.%I;', p.policyname, p.tablename);
  end loop;
end $$;

-- Quyền cấp BẢNG phải có trước, RLS chỉ lọc hàng chứ không tự mở cửa.
-- `anon` không được chạm vào kho: khách chưa đăng nhập không có việc gì ở đây.
revoke all on public.nhipphach_scores from anon;
revoke all on public.nhipphach_score_versions from anon;
grant select, insert, update, delete on public.nhipphach_scores to authenticated;
-- Bảng phiên bản CỐ Ý không cấp update/delete: bản gốc là bằng chứng, không
-- phải bản nháp. Trigger ở mục 4 chặn lần nữa nếu ai đó cấp nhầm về sau.
grant select, insert on public.nhipphach_score_versions to authenticated;
-- Supabase cấp sẵn ALL cho authenticated qua default privileges khi tạo bảng —
-- rộng hơn ý ở trên. RLS và trigger vẫn chặn, nhưng quyền bảng phải nói đúng
-- điều mình muốn: phiên bản không sửa, không xoá.
revoke update, delete, truncate, references, trigger on public.nhipphach_score_versions from authenticated;
revoke truncate, references, trigger on public.nhipphach_scores from authenticated;
-- `service_role` đi vòng qua RLS nhưng vẫn cần quyền bảng. Nó dùng cho việc
-- quản trị và dọn dẹp phía máy chủ, KHÔNG phải cho ứng dụng.
grant all on public.nhipphach_scores to service_role;
grant all on public.nhipphach_score_versions to service_role;

-- Đọc: ai có library.read. Kho là chung nên không lọc theo owner.
-- Bài đã lưu trữ thì chỉ người quản lý còn thấy.
create policy nhipphach_scores_read on public.nhipphach_scores
  for select to authenticated
  using (
    public.nhipphach_can('library.read')
    and (archived_at is null or public.nhipphach_can('library.manage'))
  );
-- Tạo bài mới: ai có library.save, và chỉ đứng tên chính mình.
create policy nhipphach_scores_insert on public.nhipphach_scores
  for insert to authenticated
  with check (
    public.nhipphach_can('library.save')
    and owner_id = auth.uid() and created_by = auth.uid()
  );
-- Sửa metadata (đổi tên, dời con trỏ current, lưu trữ): library.save.
create policy nhipphach_scores_update on public.nhipphach_scores
  for update to authenticated
  using (public.nhipphach_can('library.save'))
  with check (public.nhipphach_can('library.save'));
-- Xoá hẳn một bài: chỉ library.manage. Giai đoạn này giao diện không gọi tới.
create policy nhipphach_scores_delete on public.nhipphach_scores
  for delete to authenticated
  using (public.nhipphach_can('library.manage'));

create policy nhipphach_versions_read on public.nhipphach_score_versions
  for select to authenticated
  using (
    public.nhipphach_can('library.read')
    and exists (
      select 1 from public.nhipphach_scores s
       where s.id = score_id
         and (s.archived_at is null or public.nhipphach_can('library.manage'))
    )
  );
create policy nhipphach_versions_insert on public.nhipphach_score_versions
  for insert to authenticated
  with check (public.nhipphach_can('library.save') and created_by = auth.uid());
-- CỐ Ý không có policy UPDATE và DELETE. Trigger ở mục 4 đã chặn, nhưng thiếu
-- policy nghĩa là request còn chẳng tới được trigger.

-- ── 7) Bucket riêng tư ─────────────────────────────────────────────────────
--
-- Đây là bucket KHÔNG công khai đầu tiên của repo: mọi bucket cũ (`lessons`,
-- `strum-sheets`, `avatars`…) đều public vì chúng phục vụ <img src>. Bản nhạc
-- thì khác — không ai được đoán đường dẫn để tải file mình không có quyền đọc.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nhipphach-scores',
  'nhipphach-scores',
  false,
  10485760,  -- 10MB: bản nhạc MusicXML lớn nhất đo được chưa tới 1MB
  array['application/xml', 'text/xml', 'application/vnd.recordare.musicxml+xml']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "nhipphach scores read"   on storage.objects;
drop policy if exists "nhipphach scores insert" on storage.objects;
-- Tải về đi qua SDK có JWT (storage.download), không qua URL công khai.
create policy "nhipphach scores read" on storage.objects
  for select to authenticated
  using (bucket_id = 'nhipphach-scores' and public.nhipphach_can('library.read'));
create policy "nhipphach scores insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'nhipphach-scores' and public.nhipphach_can('library.save'));
-- Không policy UPDATE: object đã tải lên là bằng chứng của một phiên bản.
--
-- DELETE mở đúng MỘT khe: dọn chính file mình vừa tải lên khi bước ghi database
-- hỏng giữa chừng. `not exists` là bản lề — một khi đường dẫn đã được ghi nhận
-- thành phiên bản thì không ai xoá được nữa, kể cả người đã tải nó lên.
drop policy if exists "nhipphach scores cleanup" on storage.objects;
create policy "nhipphach scores cleanup" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'nhipphach-scores'
    and public.nhipphach_can('library.save')
    and owner = auth.uid()
    and not exists (
      select 1 from public.nhipphach_score_versions v where v.storage_path = name
    )
  );

notify pgrst, 'reload schema';
