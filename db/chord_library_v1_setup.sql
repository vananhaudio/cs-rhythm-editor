-- ═══════════════════════════════════════════════════════════════════════════
-- THƯ VIỆN HỢP ÂM CHUẨN HOÁ V1 — LÁT 1: NỀN DỮ LIỆU (bảng + bucket riêng tư + RPC + quyền).
-- Rollback: db/chord_library_v1_rollback.sql.
-- Test (cluster PostgreSQL tạm, KHÔNG production): scripts/test-chord-library-db.sh.
--
-- Context: học sinh muốn tập đệm hát MỘT bài cụ thể → cần lời + hợp âm đáng tin. Chưa có thì tự đóng
-- góp, dùng ngay bản của mình; thầy duyệt thì thành bản chuẩn dùng chung → thư viện tích luỹ dần.
--
-- Nguyên tắc:
--   • Thư viện là CHỦ dữ liệu chuẩn. TeamLab / app học / Rhythm Scroll là consumer: chép snapshot và
--     giữ {sheet_id, version_id, text_hash}.
--   • HAI TRỤC trạng thái tách nhau:
--       review_status   private → approved | rejected      (ai được thấy)
--       anchors_status  none | processing | needs_review | ready | failed   (neo ô nhịp cho Rhythm Scroll)
--     Lời + hợp âm dùng được NGAY khi anchors_status = 'none'. Neo là phần nâng cấp, không phải điều kiện.
--   • PHIÊN BẢN BẤT BIẾN: nội dung (text, hash, meter, bpm, anchors, sources…) VÀ phả hệ (parent_version_id)
--     ghi rồi không sửa, không xoá. Mọi sửa = phiên bản mới có parent_version_id. Chỉ các cột vòng đời
--     (review_*, anchors_status) được đổi, và chỉ qua RPC. Vị trí trong bài (sheet_id, version_number) chỉ đổi
--     được khi bản còn private (gộp lúc duyệt). Bản đã approved thì giữ nguyên mãi: không dời, không từ chối.
--   • THỨ TỰ KHOÁ thống nhất ở mọi RPC ghi: (khoá tư vấn theo người gọi) → bài (chord_sheets, theo id) →
--     phiên bản. Đảo thứ tự là deadlock.
--   • canonical_version_id chỉ dời qua chord_sheet_approve (thầy/admin). Bản đã duyệt cũ không đổi nghĩa.
--   • KHÔNG UNIQUE(title_key, composer_key): hai bài khác nhau có thể trùng tên; khoá chỉ để GỢI Ý bài đã
--     có, thầy quyết lúc duyệt (bài mới hay phiên bản của bài đã có).
--   • Bản private: CHỈ người đóng góp + người có quyền review. Không bạn cùng lớp, không band, không public.
--   • RLS bật, KHÔNG policy, KHÔNG quyền bảng: client chỉ đi qua RPC chord_sheet_* (SECURITY DEFINER).
--   • Quyền = tool_capabilities (tool_id 'chordlib': search / contribute / review). Admin luôn đủ quyền.
--   • text chuẩn: "Chiều [Am] nao, tiễn nhau [E7] đi". Nhãn "1." / "2." / "ĐK:" được phép nằm trong text;
--     parser về sau coi chúng là NHÃN, không tính vào chỉ số chữ. Lát này chưa có parser.
--
-- KHÔNG đụng kho MusicXML (bảng, policy, dữ liệu): không câu lệnh nào dưới đây nhắc tới bảng đó.
-- Không gắn neo (attach anchors) ở lát này.
--
-- ⛔ CỔNG DEPLOY — CHƯA CHẠY FILE NÀY TRÊN PRODUCTION cho tới khi (review 04/10/2026):
--   1. Xác nhận trên Supabase thật: `select rolbypassrls from pg_roles where rolname = 'postgres'` = true.
--      → ĐÃ XÁC NHẬN 04/10/2026 (chỉ đọc): postgres rolbypassrls = true; có quyền TRIGGER trên storage.objects.
--      Các hàm SECURITY DEFINER dưới đây đọc storage.objects bằng quyền chủ hàm. Nếu chủ hàm KHÔNG thấy
--      được dòng (RLS áp lên nó) thì hạn mức 20 file đếm ra 0 và MẤT TÁC DỤNG (hở), còn mọi đóng góp
--      kèm file thì bị từ chối (đóng).
--   2. Kiểm N1 với Storage API thật: Storage chạy THỬ policy INSERT rồi rollback, tải file, sau đó ghi
--      dòng bằng quyền superuser (không qua RLS). Khi đó hạn mức và điều kiện "phiên bản chưa ghi" ở mục 7
--      chỉ đúng tại lúc thử: tải song song có thể vượt 20 file, và file có thể lọt vào thư mục của phiên
--      bản đã ghi. Kiểm cả đường tải resumable (TUS) và signed upload.
--   3. N1 ĐÃ XỬ LÝ (04/10, phương án 1 do Owner chọn): trigger chord_source_guard_trg ép lại luật ở lượt ghi
--      thật (mục 7). Còn phải xác nhận trên production rằng trigger thật sự chặn được một lượt tải qua
--      Storage API (một lần tải thử vượt luật → bị từ chối) TRƯỚC khi bật UI tải file.
--   Cũng cần xem trên production: metadata.mimetype có phải kiểu trần không (mục 6b đối chiếu với nó);
--   không policy storage cũ nào thiếu lọc bucket_id; DDL thật của edu_tools khớp câu INSERT ở mục 5.
--   Backlog đã chấp nhận, chưa sửa: hàng chờ duyệt cắt ở 50 (M6) · bản approved chưa có đường thu hồi (N4)
--   · tên bài toàn ký tự trắng lạ / zero-width (L1) · lower() theo locale (L2) · service_role/TRUNCATE vượt
--   bất biến tầng RPC (L4) · chạy lại file đặt lại cấu hình bucket (L5) · một thư mục phiên bản nhận 50 tên
--   file chứ không phải 10 (N2) · "version_id đã được dùng" lộ một UUID có tồn tại (N3).
--
-- ⚠ Production cấp mặc định MỌI quyền bảng + EXECUTE hàm mới cho anon/authenticated (default privileges)
--   → mọi bảng/hàm dưới đây REVOKE tường minh. 2 bảng nằm trong self_managed của db/rls_setup.sql.
-- Chỉ TẠO MỚI — không sửa/thay bảng, hàm hay policy sẵn có. Idempotent.
-- CHẠY cả file trong MỘT transaction (file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════
set local lock_timeout = '5s';

-- ── 0) Cổng: phụ thuộc có đủ; tên mới chưa bị object lạ chiếm ───────────────────────────────
do $gate$
declare n int;
begin
  if (select md5(prosrc) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
       where s.nspname = 'public' and p.proname = 'is_teacher') is distinct from '19b164504b4ce59b9bbdb4b0b64e48ad' then
    raise exception 'GATE: public.is_teacher() khác bản repo — dừng';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'GATE: thiếu public.is_admin() (db/nhipphach_capabilities_setup.sql) — dừng';
  end if;
  if to_regclass('public.tool_capabilities') is null or to_regclass('public.edu_tools') is null then
    raise exception 'GATE: thiếu tool_capabilities / edu_tools — dừng';
  end if;
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    raise exception 'GATE: thiếu schema storage — dừng';
  end if;
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public'
     and (p.proname like 'chord\_sheet%' or p.proname like 'chordlib\_%' or p.proname like 'chord\_source\_%'
          or p.proname in ('chord_fold_vi', 'chord_canonical_text', 'chord_meter_ok', 'my_chordlib_caps'))
     and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'chord_library_v1:%';
  if n > 0 then raise exception 'GATE: đã có % hàm chord_* lạ — dừng', n; end if;
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relname in ('chord_sheets', 'chord_sheet_versions')
     and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'chord_library_v1:%';
  if n > 0 then raise exception 'GATE: đã có % bảng chord_sheets/chord_sheet_versions lạ — dừng', n; end if;
  -- Trigger N1 trên storage.objects: cần quyền TRIGGER (bảng thuộc supabase_storage_admin).
  if not has_table_privilege(current_user, 'storage.objects', 'TRIGGER') then
    raise exception 'GATE: % không có quyền TRIGGER trên storage.objects — dừng', current_user;
  end if;
end $gate$;

-- ── 1) Chuẩn hoá ────────────────────────────────────────────────────────────────────────────
--
-- Cùng NGỮ NGHĨA với foldVi (src/class-social/comments/khoAdapter.ts) + gộp khoảng trắng như
-- `fold` của /thuvien: bỏ dấu (NFD, bỏ U+0300–U+036F), đ→d, thường hoá, gộp khoảng trắng, cắt hai đầu.
-- "Con đường xưa em đi" = "CON ĐƯỜNG XƯA EM ĐI" = "con duong xua em di".
-- Đổi Đ→D TRƯỚC lower(): sau khi bỏ dấu chỉ còn ASCII nên kết quả không phụ thuộc locale của database.
-- scripts/test-chord-library-db.sh đối chiếu hàm này với foldVi thật trên cùng bộ ca.
create or replace function public.chord_fold_vi(p text)
returns text language sql immutable strict parallel safe set search_path = '' as $$
  select btrim(regexp_replace(
    lower(replace(replace(regexp_replace(normalize(p, NFD), '[̀-ͯ]', '', 'g'), 'đ', 'd'), 'Đ', 'D')),
    '[\s   -     　﻿]+', ' ', 'g'));
$$;
comment on function public.chord_fold_vi(text) is 'chord_library_v1: khoá tìm kiếm không dấu (ngữ nghĩa foldVi)';

-- Văn bản chuẩn TRƯỚC khi băm: NFC, xuống dòng = \n, bỏ khoảng trắng cuối dòng, bỏ dòng trống đầu/cuối.
-- text_hash = sha256(utf8(text đã lưu)) → consumer tự băm lại đúng chuỗi nhận được là kiểm được.
create or replace function public.chord_canonical_text(p text)
returns text language sql immutable strict parallel safe set search_path = '' as $$
  select regexp_replace(regexp_replace(regexp_replace(
           replace(replace(normalize(p, NFC), E'\r\n', E'\n'), E'\r', E'\n'),
           '[ \t ]+(\n|$)', '\1', 'g'),
         '^\n+', ''), '\n+$', '');
$$;
comment on function public.chord_canonical_text(text) is 'chord_library_v1: chuẩn hoá lời + hợp âm trước khi băm';

-- Nhịp = đúng hình dạng RhythmScrollMeter: {"beats": 1..32, "beatType": 1|2|4|8|16}. Không ép kiểu (cast)
-- để một giá trị rác không làm CHECK nổ lỗi khác. coalesce(…, false): thiếu khoá cho ra NULL, mà CHECK coi
-- NULL là ĐẠT — phải ép về false.
create or replace function public.chord_meter_ok(p jsonb)
returns boolean language sql immutable parallel safe set search_path = '' as $$
  select p is null or coalesce(
    jsonb_typeof(p) = 'object' and (p - 'beats' - 'beatType') = '{}'::jsonb
    and jsonb_typeof(p -> 'beats') = 'number' and (p ->> 'beats') ~ '^([1-9]|[12][0-9]|3[0-2])$'
    and jsonb_typeof(p -> 'beatType') = 'number' and (p ->> 'beatType') in ('1', '2', '4', '8', '16'), false);
$$;
comment on function public.chord_meter_ok(jsonb) is 'chord_library_v1: kiểm hình dạng meter';

-- Bộ file nguồn của một phiên bản → một khoá so sánh: các sha256 đã sắp xếp. Hai phiên bản cùng lời/nhịp/BPM
-- nhưng KHÁC bộ file nguồn là hai phiên bản khác nhau (thay sheet nguồn = phiên bản mới). Rỗng/null → ''.
create or replace function public.chord_source_key(p jsonb)
returns text language sql immutable parallel safe set search_path = '' as $$
  select coalesce((select string_agg(e ->> 'sha256', ',' order by e ->> 'sha256')
                     from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) e), '');
$$;
comment on function public.chord_source_key(jsonb) is 'chord_library_v1: khoá so sánh bộ file nguồn (sha256 đã sắp xếp)';

-- ── 2) Bảng ─────────────────────────────────────────────────────────────────────────────────
-- Một BÀI: danh tính để tìm. title_key/composer_key là cột SINH — không ai gửi khoá sai được.
create table if not exists public.chord_sheets (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null check (length(btrim(title)) between 1 and 200),
  composer              text check (composer is null or length(btrim(composer)) between 1 and 200),
  title_key             text generated always as (public.chord_fold_vi(title)) stored,
  composer_key          text generated always as (public.chord_fold_vi(composer)) stored,
  -- null = chưa có bản nào được duyệt (bài còn riêng tư của người đóng góp).
  canonical_version_id  uuid,
  -- set null: học viên xoá tài khoản (delete_my_account) thì đóng góp ở lại, không còn tên.
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on table public.chord_sheets is 'chord_library_v1: một bài trong Thư viện hợp âm chuẩn hoá';
create index if not exists chord_sheets_title_key_idx on public.chord_sheets (title_key);
create index if not exists chord_sheets_composer_key_idx on public.chord_sheets (composer_key);

create table if not exists public.chord_sheet_versions (
  id                 uuid primary key default gen_random_uuid(),
  -- restrict: xoá bài không được kéo theo phiên bản.
  sheet_id           uuid not null references public.chord_sheets(id) on delete restrict,
  version_number     integer not null check (version_number >= 1),
  parent_version_id  uuid references public.chord_sheet_versions(id),
  -- ── NỘI DUNG — bất biến (trigger ở mục 3) ──
  text               text not null check (length(text) between 1 and 20000),
  text_hash          text not null check (text_hash ~ '^[0-9a-f]{64}$'),
  meter              jsonb check (public.chord_meter_ok(meter)),
  suggested_bpm      integer check (suggested_bpm between 20 and 300),
  -- { pickup?: {line, token}, measures: [{line, token}] } — không pixel, không DOM. Lát 1 luôn null.
  anchors            jsonb check (anchors is null or jsonb_typeof(anchors) = 'object'),
  -- Phụ liệu cho người duyệt (độ tin cậy từng ô, …); runtime không dùng.
  anchor_review      jsonb check (anchor_review is null or jsonb_typeof(anchor_review) = 'object'),
  -- [{path, sha256, mime, page?, size_bytes?}] trong bucket chord-sheet-sources.
  sources            jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  -- Ai/cái gì sinh ra phiên bản: 'manual', hoặc tên + phiên bản pipeline.
  generator          text check (generator is null or length(generator) <= 120),
  contributed_by     uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  -- ── VÒNG ĐỜI — chỉ RPC đổi ──
  review_status      text not null default 'private' check (review_status in ('private', 'approved', 'rejected')),
  anchors_status     text not null default 'none'
                       check (anchors_status in ('none', 'processing', 'needs_review', 'ready', 'failed')),
  reviewed_by        uuid references auth.users(id) on delete set null,
  reviewed_at        timestamptz,
  rejection_reason   text check (rejection_reason is null or length(btrim(rejection_reason)) between 1 and 500),
  constraint chord_sheet_versions_seq_uniq unique (sheet_id, version_number),
  constraint chord_sheet_versions_sheet_id_uniq unique (sheet_id, id),
  constraint chord_sheet_versions_anchors_chk
    check ((anchors is null) = (anchors_status in ('none', 'processing', 'failed'))),
  constraint chord_sheet_versions_review_chk
    check ((review_status = 'private') = (reviewed_at is null)),
  constraint chord_sheet_versions_reject_chk
    check ((review_status = 'rejected') = (rejection_reason is not null))
);
comment on table public.chord_sheet_versions is 'chord_library_v1: phiên bản bất biến của một bài (lời + hợp âm + neo)';
create index if not exists chord_sheet_versions_sheet_idx on public.chord_sheet_versions (sheet_id, version_number desc);
create index if not exists chord_sheet_versions_contrib_idx on public.chord_sheet_versions (contributed_by, review_status);
create index if not exists chord_sheet_versions_hash_idx on public.chord_sheet_versions (text_hash);
create index if not exists chord_sheet_versions_pending_idx on public.chord_sheet_versions (created_at)
  where review_status = 'private';

-- Con trỏ canonical PHẢI trỏ tới một phiên bản của CHÍNH bài đó (khoá ngoại kép).
alter table public.chord_sheets drop constraint if exists chord_sheets_canonical_fk;
alter table public.chord_sheets add constraint chord_sheets_canonical_fk
  foreign key (id, canonical_version_id) references public.chord_sheet_versions (sheet_id, id);

-- ── 3) PHIÊN BẢN BẤT BIẾN — chặn ở database, không chỉ ở mã ─────────────────────────────────
-- Cột nội dung + parent_version_id: không bao giờ đổi, kể cả với RPC hay service_role. Cột vòng đời: đổi
-- được (bảng không cấp quyền cho client nên chỉ RPC tới được đây). contributed_by chỉ được về NULL (xoá
-- tài khoản).
create or replace function public.chord_sheet_versions_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'CHORDLIB_VERSION_UNDELETABLE: không xoá phiên bản; từ chối (reject) hoặc tạo phiên bản mới'
      using errcode = '23514';
  end if;
  if (new.id, new.text, new.text_hash, new.meter, new.suggested_bpm, new.anchors, new.anchor_review,
      new.sources, new.generator, new.created_at, new.parent_version_id)
     is distinct from
     (old.id, old.text, old.text_hash, old.meter, old.suggested_bpm, old.anchors, old.anchor_review,
      old.sources, old.generator, old.created_at, old.parent_version_id)
     or (new.contributed_by is distinct from old.contributed_by and new.contributed_by is not null) then
    raise exception 'CHORDLIB_VERSION_IMMUTABLE: phiên bản đã ghi thì không sửa, hãy tạo phiên bản mới'
      using errcode = '23514';
  end if;
  -- Dời sang bài khác / đổi số phiên bản: chỉ khi còn private (gộp lúc duyệt). Bản đã approved hay rejected
  -- giữ nguyên {sheet_id, version_number} — consumer đang cầm đúng bộ đó.
  if (new.sheet_id, new.version_number) is distinct from (old.sheet_id, old.version_number)
     and old.review_status <> 'private' then
    raise exception 'CHORDLIB_VERSION_IMMUTABLE: phiên bản đã duyệt/từ chối không dời sang bài khác'
      using errcode = '23514';
  end if;
  -- approved là trạng thái cuối: không quay về private, không thành rejected.
  if old.review_status = 'approved' and new.review_status <> 'approved' then
    raise exception 'CHORDLIB_VERSION_IMMUTABLE: bản đã duyệt không đổi trạng thái được nữa'
      using errcode = '23514';
  end if;
  return new;
end $$;
comment on function public.chord_sheet_versions_guard() is 'chord_library_v1: trigger bất biến của phiên bản';
drop trigger if exists chord_sheet_versions_guard_trg on public.chord_sheet_versions;
create trigger chord_sheet_versions_guard_trg
  before update or delete on public.chord_sheet_versions
  for each row execute function public.chord_sheet_versions_guard();

-- ── 4) RLS: bật, KHÔNG policy, KHÔNG quyền bảng ─────────────────────────────────────────────
alter table public.chord_sheets enable row level security;
alter table public.chord_sheet_versions enable row level security;
revoke all on public.chord_sheets, public.chord_sheet_versions from public, anon, authenticated;
grant all on public.chord_sheets, public.chord_sheet_versions to service_role;

-- ── 5) Quyền: tool_capabilities, tool_id 'chordlib' ─────────────────────────────────────────
-- tool_capabilities.tool_id tham chiếu edu_tools → cần MỘT dòng edu_tools. Dòng này ẨN (enabled=false,
-- status='off', route rỗng): lát này chưa có UI, không được hiện thành thẻ công cụ, và route rỗng nên
-- my_tool_route_access() không coi nó là một trang phải gác. `enabled` ở đây KHÔNG phải công tắc quyền;
-- quyền nằm ở ba dòng capability bên dưới. `do nothing`: chạy lại không đè thứ Admin đã chỉnh.
insert into public.edu_tools (id, name, description, icon, category, route, tier, enabled, status, order_index)
values ('chordlib', 'Thư viện hợp âm', 'Lời + hợp âm chuẩn hoá dùng chung.', '🎸', 'Thư viện', '', 'free', false, 'off', 95)
on conflict (id) do nothing;

insert into public.tool_capabilities (tool_id, role, capability, allowed) values
  ('chordlib', 'student', 'search',     true),
  ('chordlib', 'student', 'contribute', true),
  ('chordlib', 'student', 'review',     false),
  ('chordlib', 'teacher', 'search',     true),
  ('chordlib', 'teacher', 'contribute', true),
  ('chordlib', 'teacher', 'review',     true)
on conflict (tool_id, role, capability) do nothing;

-- Admin đứng ngoài ma trận (không tự khoá mình). Thầy → dòng 'teacher'. Mọi tài khoản đã đăng nhập
-- còn lại → dòng 'student'. Khách → không có quyền nào.
create or replace function public.chordlib_can(p_cap text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null then false
    when public.is_admin() then p_cap in ('search', 'contribute', 'review')
    else coalesce((
      select tc.allowed from public.tool_capabilities tc
       where tc.tool_id = 'chordlib' and tc.capability = p_cap
         and tc.role = case when public.is_teacher() then 'teacher' else 'student' end), false)
  end;
$$;
comment on function public.chordlib_can(text) is 'chord_library_v1: người gọi có capability này không';

create or replace function public.my_chordlib_caps()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'role', case when auth.uid() is null then 'guest' when public.is_admin() then 'admin'
                 when public.is_teacher() then 'teacher' else 'student' end,
    'caps', jsonb_build_object(
      'search', public.chordlib_can('search'),
      'contribute', public.chordlib_can('contribute'),
      'review', public.chordlib_can('review')));
$$;
comment on function public.my_chordlib_caps() is 'chord_library_v1: quyền của người gọi (cho UI)';

-- ── 6) RPC ──────────────────────────────────────────────────────────────────────────────────
-- Lỗi: 42501 = CHORDLIB_FORBIDDEN · 22023 = CHORDLIB_INVALID · P0002 = CHORDLIB_NOT_FOUND ·
--      54000 = CHORDLIB_LIMIT. "Không có" và "không được xem" trả CÙNG một lỗi NOT_FOUND (không lộ tồn tại).

-- 6a) TÌM. Học viên: bản chuẩn đã duyệt + đóng góp của CHÍNH mình. Người review: thêm mọi bản đang chờ.
-- Tìm theo khoá không dấu của tên bài HOẶC tác giả. Hàm này KHÔNG đọc kho MusicXML.
create or replace function public.chord_sheet_search(p_query text default '', p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_review boolean;
  v_key text := public.chord_fold_vi(coalesce(p_query, ''));
begin
  if v_uid is null or not public.chordlib_can('search') then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  v_review := public.chordlib_can('review');
  return coalesce((
    select jsonb_agg(r.item order by r.rank, r.title_key, r.is_canonical desc, r.created_at desc)
    from (
      select s.title_key, v.created_at, coalesce(v.id = s.canonical_version_id, false) as is_canonical,
             case when s.title_key = v_key then 0 when left(s.title_key, length(v_key)) = v_key then 1 else 2 end as rank,
             jsonb_build_object(
               'sheet_id', s.id, 'title', s.title, 'composer', s.composer,
               'version_id', v.id, 'version_number', v.version_number,
               'is_canonical', coalesce(v.id = s.canonical_version_id, false),
               'review_status', v.review_status, 'anchors_status', v.anchors_status,
               'mine', coalesce(v.contributed_by = v_uid, false),
               'created_at', v.created_at)
             || case when v_review then jsonb_build_object('contributed_by', v.contributed_by) else '{}'::jsonb end as item
        from public.chord_sheets s
        join public.chord_sheet_versions v on v.sheet_id = s.id
       where (v_key = '' or position(v_key in s.title_key) > 0 or position(v_key in coalesce(s.composer_key, '')) > 0)
         and (v.id = s.canonical_version_id
              or (v.contributed_by = v_uid and v.review_status in ('private', 'rejected'))
              or (v_review and v.review_status = 'private'))
       order by 4, s.title_key, 3 desc, v.created_at desc
       limit least(greatest(coalesce(p_limit, 20), 1), 50)
    ) r), '[]'::jsonb);
end $$;
comment on function public.chord_sheet_search(text, integer) is 'chord_library_v1: tìm bài (không dấu) theo quyền người gọi';

-- 6b) ĐÓNG GÓP. p_sheet_id null = bài mới; có p_sheet_id = phiên bản mới của bài đã có (sửa/nâng chất
-- lượng — KHÔNG sửa bản chuẩn trực tiếp). Người đóng góp = auth.uid(), không bao giờ lấy từ payload.
-- p_version_id do client sinh TRƯỚC để tải file nguồn lên {uid}/{version_id}/{n}.{ext} rồi mới gọi hàm.
create or replace function public.chord_sheet_contribute(
  p_text text,
  p_title text default null,
  p_composer text default null,
  p_meter jsonb default null,
  p_suggested_bpm integer default null,
  p_sources jsonb default '[]'::jsonb,
  p_version_id uuid default null,
  p_sheet_id uuid default null,
  p_parent_version_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_review boolean;
  v_text text := public.chord_canonical_text(p_text);
  v_hash text;
  v_title text := btrim(coalesce(p_title, ''));
  v_composer text := nullif(btrim(coalesce(p_composer, '')), '');
  v_vid uuid := coalesce(p_version_id, gen_random_uuid());
  v_sources jsonb := coalesce(p_sources, '[]'::jsonb);
  v_sheet public.chord_sheets%rowtype;
  v_dup uuid;
  v_dup_sheet uuid;
  v_parent uuid;
  v_num integer := 1;
  v_src jsonb;
  v_ok boolean;
  v_path text;
  v_paths text[] := '{}';
  v_meta jsonb;
begin
  if v_uid is null or not public.chordlib_can('contribute') then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  v_review := public.chordlib_can('review');
  -- MỘT người, MỘT lượt ghi tại một thời điểm: đếm bản chờ, dò trùng, và kiểm file nguồn đều đọc-rồi-ghi;
  -- không khoá thì hai request song song cùng lọt (31 bản chờ, 2 bài y hệt, file bị xoá ngay sau khi kiểm).
  -- Cùng khoá này được policy tải lên/xoá của bucket giữ (chord_source_can_write) → xoá file và đóng góp
  -- của cùng một người không chạy chéo nhau. Giữ tới hết transaction.
  perform pg_advisory_xact_lock(hashtextextended('chordlib:' || v_uid::text, 0));

  if v_text is null or length(btrim(v_text)) = 0 then
    raise exception 'CHORDLIB_INVALID: thiếu lời + hợp âm' using errcode = '22023';
  end if;
  if length(v_text) > 20000 then
    raise exception 'CHORDLIB_INVALID: lời + hợp âm quá dài (tối đa 20000 ký tự)' using errcode = '22023';
  end if;
  if not public.chord_meter_ok(p_meter) then
    raise exception 'CHORDLIB_INVALID: nhịp phải có dạng {"beats": 1..32, "beatType": 1|2|4|8|16}' using errcode = '22023';
  end if;
  if p_suggested_bpm is not null and p_suggested_bpm not between 20 and 300 then
    raise exception 'CHORDLIB_INVALID: BPM gợi ý phải trong khoảng 20–300' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to(v_text, 'UTF8')), 'hex');

  -- File nguồn. Mỗi mục CHỈ gồm {path, mime, sha256, page?, size_bytes?}:
  --   path        {uid của người gọi}/{version_id này}/{0-9}.{pdf|jpg|jpeg|png|webp}, không lặp
  --   mime        khớp ĐUÔI file; khớp cả mimetype mà Storage ghi nhận (nếu có)
  --   sha256      64 hex — do CLIENT khai (server không đọc được byte của file); dùng để đối chiếu, không phải bằng chứng
  --   page        số nguyên 1..999
  --   size_bytes  số nguyên 1..20MB; khớp size mà Storage ghi nhận (nếu có)
  -- File phải ĐÃ nằm trong bucket, và MỌI file trong thư mục phiên bản phải được khai — không để lại file
  -- mồ côi không ai xoá được sau khi phiên bản đã ghi.
  if jsonb_typeof(v_sources) <> 'array' or jsonb_array_length(v_sources) > 10 then
    raise exception 'CHORDLIB_INVALID: sources phải là mảng tối đa 10 file' using errcode = '22023';
  end if;
  for v_src in select value from jsonb_array_elements(v_sources) loop
    v_ok := jsonb_typeof(v_src) = 'object';
    if v_ok then
      v_path := v_src ->> 'path';
      -- coalesce(…, false): thiếu khoá cho ra NULL, không được coi là đạt.
      v_ok := coalesce(
        (v_src - 'path' - 'mime' - 'sha256' - 'page' - 'size_bytes') = '{}'::jsonb
        and jsonb_typeof(v_src -> 'path') = 'string' and jsonb_typeof(v_src -> 'mime') = 'string'
        and jsonb_typeof(v_src -> 'sha256') = 'string'
        and v_path ~ ('^' || v_uid::text || '/' || v_vid::text || '/[0-9]\.(pdf|jpg|jpeg|png|webp)$')
        and (v_src ->> 'mime') = case substring(v_path from '\.([a-z]+)$')
              when 'pdf' then 'application/pdf' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg'
              when 'png' then 'image/png' when 'webp' then 'image/webp' end
        and (v_src ->> 'sha256') ~ '^[0-9a-f]{64}$'
        and (not v_src ? 'page'
             or (jsonb_typeof(v_src -> 'page') = 'number' and (v_src ->> 'page') ~ '^[1-9][0-9]{0,2}$'))
        and (not v_src ? 'size_bytes'
             or (jsonb_typeof(v_src -> 'size_bytes') = 'number' and (v_src ->> 'size_bytes') ~ '^[1-9][0-9]{0,7}$'
                 and (v_src -> 'size_bytes') <= to_jsonb(20971520))),
        false);
    end if;
    if not v_ok then
      raise exception 'CHORDLIB_INVALID: file nguồn không hợp lệ — chỉ {path, mime, sha256, page, size_bytes}; đường dẫn {uid}/{version_id}/{0-9}.{pdf|jpg|jpeg|png|webp}; mime khớp đuôi file'
        using errcode = '22023';
    end if;
    if v_path = any (v_paths) then
      raise exception 'CHORDLIB_INVALID: file nguồn bị khai lặp: %', v_path using errcode = '22023';
    end if;
    v_paths := v_paths || v_path;
    select o.metadata into v_meta from storage.objects o
     where o.bucket_id = 'chord-sheet-sources' and o.name = v_path;
    if not found then
      raise exception 'CHORDLIB_INVALID: file nguồn chưa được tải lên: %', v_path using errcode = '22023';
    end if;
    if (v_meta ? 'mimetype' and (v_meta ->> 'mimetype') <> (v_src ->> 'mime'))
       or (v_src ? 'size_bytes' and v_meta ? 'size' and (v_meta ->> 'size') <> (v_src ->> 'size_bytes')) then
      raise exception 'CHORDLIB_INVALID: mime/size khai không khớp file đã tải lên: %', v_path using errcode = '22023';
    end if;
  end loop;
  if (select count(*) from storage.objects o
       where o.bucket_id = 'chord-sheet-sources' and o.name like v_uid::text || '/' || v_vid::text || '/%')
     <> jsonb_array_length(v_sources) then
    raise exception 'CHORDLIB_INVALID: thư mục phiên bản có file chưa được khai trong sources — khai đủ hoặc xoá bớt'
      using errcode = '22023';
  end if;

  -- Chặn spam: tối đa 30 bản đang chờ duyệt cho một người (người review không bị giới hạn).
  if not v_review and (select count(*) from public.chord_sheet_versions v
                        where v.contributed_by = v_uid and v.review_status = 'private') >= 30 then
    raise exception 'CHORDLIB_LIMIT: bạn đang có 30 bản chờ duyệt — chờ thầy duyệt bớt rồi gửi tiếp' using errcode = '54000';
  end if;

  if p_sheet_id is null then
    if length(v_title) not between 1 and 200 then
      raise exception 'CHORDLIB_INVALID: thiếu tên bài (1–200 ký tự)' using errcode = '22023';
    end if;
    if v_composer is not null and length(v_composer) > 200 then
      raise exception 'CHORDLIB_INVALID: tên tác giả quá dài' using errcode = '22023';
    end if;
    if p_parent_version_id is not null then
      raise exception 'CHORDLIB_INVALID: bài mới không có phiên bản cha' using errcode = '22023';
    end if;
    -- Gửi lại y hệt (cùng người, cùng tên bài, cùng NỘI DUNG, chưa bị từ chối) → trả bản đã có.
    -- Nội dung = lời + nhịp + BPM + bộ file nguồn. text_hash vẫn CHỈ băm lời (neo ô nhịp bám theo lời) — nên
    -- trùng text_hash chưa đủ để gọi là trùng: đổi riêng nhịp, BPM, hay sheet nguồn là một phiên bản mới hợp lệ.
    select v.id, v.sheet_id into v_dup, v_dup_sheet
      from public.chord_sheet_versions v join public.chord_sheets s on s.id = v.sheet_id
     where v.contributed_by = v_uid and v.text_hash = v_hash and v.review_status <> 'rejected'
       and v.meter is not distinct from p_meter and v.suggested_bpm is not distinct from p_suggested_bpm
       and public.chord_source_key(v.sources) = public.chord_source_key(v_sources)
       and s.title_key = public.chord_fold_vi(v_title)
     order by v.created_at limit 1;
    if v_dup is not null then
      return jsonb_build_object('ok', true, 'duplicate', true, 'sheet_id', v_dup_sheet, 'version_id', v_dup);
    end if;
    insert into public.chord_sheets (title, composer, created_by)
    values (v_title, v_composer, v_uid) returning * into v_sheet;
  else
    select * into v_sheet from public.chord_sheets s where s.id = p_sheet_id for update;
    if not found or not (v_sheet.canonical_version_id is not null or v_review
         or exists (select 1 from public.chord_sheet_versions v where v.sheet_id = p_sheet_id and v.contributed_by = v_uid)) then
      raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002';
    end if;
    -- Trùng NỘI DUNG (lời + nhịp + BPM + bộ file nguồn) với bản chuẩn hiện hành, hoặc với bản mình đã gửi
    -- (chưa bị từ chối) → trả bản đó.
    select v.id into v_dup from public.chord_sheet_versions v
     where v.sheet_id = p_sheet_id and v.text_hash = v_hash
       and v.meter is not distinct from p_meter and v.suggested_bpm is not distinct from p_suggested_bpm
       and public.chord_source_key(v.sources) = public.chord_source_key(v_sources)
       and (v.id = v_sheet.canonical_version_id or (v.contributed_by = v_uid and v.review_status <> 'rejected'))
     order by (v.id = v_sheet.canonical_version_id) desc nulls last, v.created_at limit 1;
    if v_dup is not null then
      return jsonb_build_object('ok', true, 'duplicate', true, 'sheet_id', p_sheet_id, 'version_id', v_dup);
    end if;
    -- Cha: người gọi chỉ định → bản chuẩn → bản gần nhất của chính mình trong bài.
    v_parent := coalesce(p_parent_version_id, v_sheet.canonical_version_id,
      (select v.id from public.chord_sheet_versions v
        where v.sheet_id = p_sheet_id and v.contributed_by = v_uid order by v.version_number desc limit 1));
    if v_parent is not null and not exists (
         select 1 from public.chord_sheet_versions v
          where v.id = v_parent and v.sheet_id = p_sheet_id
            and (v.review_status = 'approved' or v.contributed_by = v_uid or v_review)) then
      raise exception 'CHORDLIB_INVALID: phiên bản cha không thuộc bài này' using errcode = '22023';
    end if;
    select coalesce(max(v.version_number), 0) + 1 into v_num
      from public.chord_sheet_versions v where v.sheet_id = p_sheet_id;
  end if;

  if exists (select 1 from public.chord_sheet_versions v where v.id = v_vid) then
    raise exception 'CHORDLIB_INVALID: version_id đã được dùng' using errcode = '22023';
  end if;
  insert into public.chord_sheet_versions
    (id, sheet_id, version_number, parent_version_id, text, text_hash, meter, suggested_bpm, sources,
     generator, contributed_by, review_status, anchors_status)
  values
    (v_vid, v_sheet.id, v_num, v_parent, v_text, v_hash, p_meter, p_suggested_bpm, v_sources,
     'manual', v_uid, 'private', 'none');

  return jsonb_build_object('ok', true, 'duplicate', false, 'sheet_id', v_sheet.id, 'version_id', v_vid,
    'version_number', v_num, 'text_hash', v_hash, 'review_status', 'private', 'anchors_status', 'none');
end $$;
comment on function public.chord_sheet_contribute(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid)
  is 'chord_library_v1: đóng góp bài mới / phiên bản mới (private, anchors none)';

-- 6c) ĐỌC một phiên bản. approved (kể cả bản đã duyệt cũ, để consumer giữ snapshot kiểm lại được): mọi
-- người có quyền search. private/rejected: người đóng góp + người review. File nguồn, lý do từ chối,
-- phụ liệu duyệt chỉ trả cho người đóng góp + người review.
create or replace function public.chord_sheet_get(p_version_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_review boolean;
  v public.chord_sheet_versions%rowtype;
  s public.chord_sheets%rowtype;
  v_inner boolean;
begin
  if v_uid is null or not public.chordlib_can('search') then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  v_review := public.chordlib_can('review');
  select * into v from public.chord_sheet_versions x where x.id = p_version_id;
  v_inner := found and (v_review or coalesce(v.contributed_by = v_uid, false));
  if v.id is null or not (v.review_status = 'approved' or v_inner) then
    raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into s from public.chord_sheets x where x.id = v.sheet_id;
  return jsonb_build_object(
    'sheet_id', s.id, 'title', s.title, 'composer', s.composer,
    'canonical_version_id', s.canonical_version_id,
    'version_id', v.id, 'version_number', v.version_number, 'parent_version_id', v.parent_version_id,
    'is_canonical', coalesce(v.id = s.canonical_version_id, false),
    'text', v.text, 'text_hash', v.text_hash, 'meter', v.meter, 'suggested_bpm', v.suggested_bpm,
    'anchors', v.anchors, 'anchors_status', v.anchors_status, 'generator', v.generator,
    'review_status', v.review_status, 'reviewed_at', v.reviewed_at,
    'mine', coalesce(v.contributed_by = v_uid, false), 'created_at', v.created_at)
  -- Bàn biên tập: đang xem một bản mà bài còn bản chờ duyệt MỚI HƠN → trỏ tới bản đó. Chỉ cho người review.
  || case when v_review then jsonb_build_object('draft_version_id', (
       select x.id from public.chord_sheet_versions x
        where x.sheet_id = v.sheet_id and x.review_status = 'private' and x.version_number > v.version_number
        order by x.version_number desc limit 1))
     else '{}'::jsonb end
  || case when v_inner then jsonb_build_object(
       'sources', v.sources, 'anchor_review', v.anchor_review, 'rejection_reason', v.rejection_reason,
       'contributed_by', v.contributed_by, 'reviewed_by', v.reviewed_by)
     else '{}'::jsonb end;
end $$;
comment on function public.chord_sheet_get(uuid) is 'chord_library_v1: đọc một phiên bản theo quyền';

-- 6d) DUYỆT = đặt bản chuẩn. Chỉ người có quyền review.
--   • p_sheet_id null hoặc = bài hiện tại: duyệt tại chỗ.
--   • p_sheet_id = bài KHÁC: "bài 'mới' này thật ra là bài đã có" → dời phiên bản sang bài đó (số phiên bản
--     kế tiếp) rồi đặt làm bản chuẩn; bài nguồn rỗng thì xoá. CHỈ áp dụng cho một đóng góp ĐỘC LẬP còn
--     private: không có cha, không có con. Bản đã duyệt/từ chối, hay bản nằm trong một chuỗi phiên bản,
--     không dời được (dời là viết lại lịch sử) — duyệt tại chỗ, hoặc đóng góp lại vào bài đích.
--     parent_version_id KHÔNG bao giờ bị đổi.
--   • Gọi lại trên một bản ĐÃ duyệt = chọn lại bản chuẩn (quay về bản cũ).
-- Bản chuẩn cũ vẫn 'approved' và nguyên nội dung — consumer đang giữ nó không bị đổi nghĩa.
-- KHOÁ: bài trước (theo id), phiên bản sau — cùng thứ tự với chord_sheet_contribute (khoá bài rồi mới chèn
-- dòng tham chiếu phiên bản cha). Đọc sheet_id KHÔNG khoá, khoá bài, rồi kiểm lại dưới khoá.
create or replace function public.chord_sheet_approve(p_version_id uuid, p_sheet_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_sid uuid;
  v_target uuid;
  v public.chord_sheet_versions%rowtype;
  v_to public.chord_sheets%rowtype;
  v_prev uuid;
  v_num integer;
begin
  if v_uid is null or not public.chordlib_can('review') then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  select x.sheet_id into v_sid from public.chord_sheet_versions x where x.id = p_version_id;
  if v_sid is null then raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002'; end if;
  v_target := coalesce(p_sheet_id, v_sid);
  perform 1 from public.chord_sheets x where x.id in (v_sid, v_target) order by x.id for update;
  select * into v from public.chord_sheet_versions x where x.id = p_version_id for update;
  if v.sheet_id is distinct from v_sid then
    raise exception 'CHORDLIB_RETRY: phiên bản vừa được dời sang bài khác — thử lại' using errcode = '40001';
  end if;
  select * into v_to from public.chord_sheets x where x.id = v_target;
  if v_to.id is null then raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002'; end if;

  if v_target <> v_sid then
    if v.review_status <> 'private' then
      raise exception 'CHORDLIB_INVALID: chỉ gộp được đóng góp còn private; bản đã duyệt/từ chối giữ nguyên bài của nó'
        using errcode = '22023';
    end if;
    if v.parent_version_id is not null
       or exists (select 1 from public.chord_sheet_versions c where c.parent_version_id = v.id) then
      raise exception 'CHORDLIB_INVALID: phiên bản nằm trong một chuỗi phiên bản (có cha hoặc có con) — duyệt tại chỗ, không gộp'
        using errcode = '22023';
    end if;
    select coalesce(max(x.version_number), 0) + 1 into v_num
      from public.chord_sheet_versions x where x.sheet_id = v_target;
    update public.chord_sheet_versions set sheet_id = v_target, version_number = v_num where id = v.id;
    if not exists (select 1 from public.chord_sheet_versions x where x.sheet_id = v_sid) then
      delete from public.chord_sheets where id = v_sid;
    end if;
  end if;

  v_prev := v_to.canonical_version_id;
  update public.chord_sheet_versions
     set review_status = 'approved', reviewed_by = v_uid, reviewed_at = now(), rejection_reason = null
   where id = v.id;
  update public.chord_sheets set canonical_version_id = v.id, updated_at = now() where id = v_target;

  return jsonb_build_object('ok', true, 'sheet_id', v_target, 'version_id', v.id,
    'canonical_version_id', v.id, 'previous_canonical_version_id', v_prev);
end $$;
comment on function public.chord_sheet_approve(uuid, uuid) is 'chord_library_v1: duyệt + đặt bản chuẩn (chỉ người review)';

-- 6e) TỪ CHỐI. Chỉ người có quyền review; bắt buộc có lý do (người đóng góp đọc được). Bản ĐÃ DUYỆT không
-- từ chối được, kể cả khi đã thôi làm bản chuẩn: consumer đang giữ {version_id, text_hash} phải luôn đọc
-- lại được nó. Muốn thay bản chuẩn → approve bản khác. Khoá: bài trước, phiên bản sau (như approve).
create or replace function public.chord_sheet_reject(p_version_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_sid uuid;
  v public.chord_sheet_versions%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_uid is null or not public.chordlib_can('review') then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  if length(v_reason) not between 1 and 500 then
    raise exception 'CHORDLIB_INVALID: cần lý do từ chối (1–500 ký tự)' using errcode = '22023';
  end if;
  select x.sheet_id into v_sid from public.chord_sheet_versions x where x.id = p_version_id;
  if v_sid is null then raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002'; end if;
  perform 1 from public.chord_sheets x where x.id = v_sid for update;
  select * into v from public.chord_sheet_versions x where x.id = p_version_id for update;
  if v.sheet_id is distinct from v_sid then
    raise exception 'CHORDLIB_RETRY: phiên bản vừa được dời sang bài khác — thử lại' using errcode = '40001';
  end if;
  if v.review_status = 'approved' then
    raise exception 'CHORDLIB_INVALID: bản đã duyệt không từ chối được — muốn thay bản chuẩn thì duyệt bản khác'
      using errcode = '22023';
  end if;
  update public.chord_sheet_versions
     set review_status = 'rejected', reviewed_by = v_uid, reviewed_at = now(), rejection_reason = v_reason
   where id = v.id;
  return jsonb_build_object('ok', true, 'version_id', v.id, 'review_status', 'rejected');
end $$;
comment on function public.chord_sheet_reject(uuid, text) is 'chord_library_v1: từ chối một đóng góp (chỉ người review)';

-- 6f) SỬA TÊN BÀI / TÁC GIẢ của một bài đã có. Chỉ người có quyền review (bàn biên tập của thầy).
-- Tên bài/tác giả là danh tính của BÀI, không thuộc phiên bản: sửa ở đây KHÔNG tạo phiên bản, không đụng
-- nội dung phiên bản nào, không dời con trỏ canonical, không đổi created_by. title_key/composer_key là
-- cột sinh nên tự cập nhật theo. Có hiệu lực ngay (không qua duyệt) — vì người sửa chính là người duyệt.
create or replace function public.chord_sheet_update_info(p_sheet_id uuid, p_title text, p_composer text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_composer text := nullif(btrim(coalesce(p_composer, '')), '');
  v_sheet public.chord_sheets%rowtype;
begin
  if v_uid is null or not public.chordlib_can('review') then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  if length(v_title) not between 1 and 200 then
    raise exception 'CHORDLIB_INVALID: thiếu tên bài (1–200 ký tự)' using errcode = '22023';
  end if;
  if v_composer is not null and length(v_composer) > 200 then
    raise exception 'CHORDLIB_INVALID: tên tác giả quá dài' using errcode = '22023';
  end if;
  select * into v_sheet from public.chord_sheets s where s.id = p_sheet_id for update;
  if v_sheet.id is null then raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_sheet.title is distinct from v_title or v_sheet.composer is distinct from v_composer then
    update public.chord_sheets set title = v_title, composer = v_composer, updated_at = now() where id = p_sheet_id;
  end if;
  return jsonb_build_object('ok', true, 'sheet_id', p_sheet_id, 'title', v_title, 'composer', v_composer);
end $$;
comment on function public.chord_sheet_update_info(uuid, text, text) is 'chord_library_v1: sửa tên bài / tác giả (chỉ người review)';

-- >>> V1.2 ANCHORS ───────────────────────────────────────────────────────────────────────────
-- VẠCH NHỊP THỦ CÔNG (lát 5A). Vạch nhịp là NỘI DUNG: không bao giờ ghi vào phiên bản đã có — "Chấp nhận vạch
-- nhịp" tạo PHIÊN BẢN MỚI (cùng lời, nhịp, BPM, file nguồn; cha = phiên bản nguồn; anchors_status = ready;
-- review_status = private — vẫn phải Duyệt). Hình dạng (khớp prototype RhythmScrollAnchoredData):
--   { "pickup"?: {"line": n, "token": n}, "measures": [ {"line": n|null, "token": n|null}, … ] }
--   • measures là DÒNG THỜI GIAN biểu diễn (theo thứ tự hát, được quay lại dòng cũ khi điệp khúc lặp);
--   • line = dòng của lời chuẩn; token = chữ hát đầu ô, đếm SAU khi bỏ [hợp âm] và bỏ NHÃN đầu dòng;
--     token = số chữ của dòng = vạch cuối dòng; line null + token null = ô không lời; hai ô liền nhau
--     cùng vị trí = ô ngân. Không pixel, không toạ độ DOM.

-- Số chữ hát của từng dòng — CÙNG quy tắc với lyricTokens (src/thuvien/chordAnchors.ts), có test đối chiếu:
--   • [hợp âm] là ranh giới chữ, không phải chữ ("ti[Am]ễn" = 2 chữ);
--   • hợp âm cuối dòng mà không có chữ nào sau nó vẫn chiếm 1 vị trí (để vạch đặt được trước nó);
--   • chữ ĐẦU dòng, đứng trước mọi hợp âm, là NHÃN nếu (bỏ dấu, thường hoá) khớp: "1."…"99.", "đk", "coda",
--     "intro", "dạo", "verse", "chorus", "bridge" (có/không dấu ":") — nhãn không tính là chữ;
--   • khoảng trắng = tập \s của JavaScript.
create or replace function public.chord_lyric_token_counts(p_text text)
returns integer[] language plpgsql immutable strict parallel safe set search_path = '' as $$
declare
  v_marker constant text := '\[[^][[:space:]][^][\n]{0,15}\]';
  -- Khoảng trắng = đúng tập \s của JavaScript (gồm NBSP và các khoảng trắng Unicode).
  v_ws constant text := '[[:space:]   -     　﻿]';
  v_line text;
  v_words text;
  v_counts integer[] := '{}';
  v_n integer;
  v_prefix text;
  v_first text;
begin
  -- Lời rỗng = MỘT dòng trống (như split('\n') của JavaScript), không phải 0 dòng.
  foreach v_line in array coalesce(nullif(string_to_array(public.chord_canonical_text(p_text), E'\n'), '{}'), '{""}') loop
    v_words := regexp_replace(regexp_replace(v_line, v_marker, ' ', 'g'), '^' || v_ws || '+|' || v_ws || '+$', '', 'g');
    v_n := case when v_words = '' then 0 else array_length(regexp_split_to_array(v_words, v_ws || '+'), 1) end;
    -- hợp âm cuối dòng, sau nó không còn chữ → thêm 1 vị trí
    if v_line ~ v_marker and regexp_replace(v_line, '^.*' || v_marker, '') ~ ('^' || v_ws || '*$') then
      v_n := v_n + 1;
    end if;
    -- nhãn đầu dòng: chữ đầu tiên, đứng TRƯỚC hợp âm đầu tiên
    v_prefix := regexp_replace(split_part(regexp_replace(v_line, v_marker, E'\x01'), E'\x01', 1), '^' || v_ws || '+', '');
    v_first := (regexp_split_to_array(v_prefix, v_ws || '+'))[1];
    if coalesce(v_first, '') <> '' and public.chord_fold_vi(v_first) ~ '^(\d{1,2}\.|dk:?|coda:?|intro:?|dao:?|verse:?|chorus:?|bridge:?)$' then
      v_n := v_n - 1;
    end if;
    v_counts := v_counts || v_n;
  end loop;
  return v_counts;
end $$;
comment on function public.chord_lyric_token_counts(text) is 'chord_library_v1: số chữ hát mỗi dòng (bỏ hợp âm + nhãn) — nền kiểm vạch nhịp';

-- Kiểm vạch nhịp với ĐÚNG lời của phiên bản. NULL = hợp lệ; chuỗi = lý do. Không tin client.
create or replace function public.chord_anchors_problem(p_anchors jsonb, p_counts integer[])
returns text language plpgsql immutable parallel safe set search_path = '' as $$
declare
  v_anchor jsonb;
  v_at integer := 0;
  v_line integer;
  v_token integer;
  v_lines integer := coalesce(array_length(p_counts, 1), 0);
begin
  if p_anchors is null or jsonb_typeof(p_anchors) <> 'object' then return 'vạch nhịp phải là một object'; end if;
  if octet_length(p_anchors::text) > 100000 then return 'dữ liệu vạch nhịp quá lớn'; end if;
  if (p_anchors - 'pickup' - 'measures') <> '{}'::jsonb then return 'vạch nhịp chỉ gồm pickup và measures'; end if;
  if jsonb_typeof(p_anchors -> 'measures') is distinct from 'array' then return 'measures phải là một mảng'; end if;
  if jsonb_array_length(p_anchors -> 'measures') = 0 then return 'chưa có vạch nhịp nào'; end if;
  if jsonb_array_length(p_anchors -> 'measures') > 2000 then return 'tối đa 2000 ô nhịp'; end if;
  for v_anchor in
    select value from jsonb_array_elements(p_anchors -> 'measures')
    union all select p_anchors -> 'pickup' where p_anchors ? 'pickup'
  loop
    v_at := v_at + 1;
    if jsonb_typeof(v_anchor) is distinct from 'object' or (v_anchor - 'line' - 'token') <> '{}'::jsonb
       or not (v_anchor ? 'line') or not (v_anchor ? 'token') then
      return format('vị trí %s: phải là {line, token}', v_at);
    end if;
    if jsonb_typeof(v_anchor -> 'line') = 'null' then
      if jsonb_typeof(v_anchor -> 'token') <> 'null' then return format('vị trí %s: ô không lời thì token cũng phải null', v_at); end if;
      if v_at > jsonb_array_length(p_anchors -> 'measures') then return 'nhịp lấy đà phải nằm trên một chữ'; end if;
      continue;
    end if;
    if jsonb_typeof(v_anchor -> 'line') <> 'number' or jsonb_typeof(v_anchor -> 'token') <> 'number'
       or (v_anchor ->> 'line') !~ '^\d{1,5}$' or (v_anchor ->> 'token') !~ '^\d{1,5}$' then
      return format('vị trí %s: line và token phải là số nguyên ≥ 0', v_at);
    end if;
    v_line := (v_anchor ->> 'line')::integer;
    v_token := (v_anchor ->> 'token')::integer;
    if v_line >= v_lines then return format('vị trí %s: dòng %s không có trong lời', v_at, v_line + 1); end if;
    if p_counts[v_line + 1] = 0 then return format('vị trí %s: dòng %s không có chữ hát', v_at, v_line + 1); end if;
    if v_token > p_counts[v_line + 1] then return format('vị trí %s: dòng %s chỉ có %s chữ', v_at, v_line + 1, p_counts[v_line + 1]); end if;
  end loop;
  return null;
end $$;
comment on function public.chord_anchors_problem(jsonb, integer[]) is 'chord_library_v1: kiểm hình dạng + phạm vi vạch nhịp theo lời';

-- 6g) CHẤP NHẬN VẠCH NHỊP → PHIÊN BẢN MỚI. Chỉ người review. Phiên bản mới chép NGUYÊN nội dung của phiên
-- bản nguồn (lời, text_hash, nhịp, BPM) và TRỎ LẠI đúng các file nguồn của nó — không chép file: thư mục của
-- phiên bản nguồn đã đóng băng. Đây là đường DUY NHẤT tạo tham chiếu file nguồn sang thư mục khác; client không
-- gửi sources ở đây nên không thay được. anchor_review do máy chủ dựng (không tin client về người/giờ).
-- Trùng (cùng bài, cùng lời + nhịp + BPM + bộ nguồn + CÙNG vạch nhịp, chưa bị từ chối) → trả bản đã có.
-- Khoá: bài trước, phiên bản sau — như approve/reject; hai lượt Chấp nhận cùng bài xếp hàng trên khoá bài.
create or replace function public.chord_sheet_accept_anchors(p_from_version_id uuid, p_anchors jsonb, p_anchor_review jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_sid uuid;
  v public.chord_sheet_versions%rowtype;
  v_problem text;
  v_dup uuid;
  v_new uuid := gen_random_uuid();
  v_num integer;
begin
  if v_uid is null or not public.chordlib_can('review') then
    raise exception 'CHORDLIB_FORBIDDEN' using errcode = '42501';
  end if;
  if p_anchor_review is not null and (jsonb_typeof(p_anchor_review) <> 'object' or (p_anchor_review - 'mode') <> '{}'::jsonb
     or coalesce(p_anchor_review ->> 'mode', 'manual') <> 'manual') then
    raise exception 'CHORDLIB_INVALID: anchor_review chỉ nhận {"mode": "manual"}' using errcode = '22023';
  end if;
  select x.sheet_id into v_sid from public.chord_sheet_versions x where x.id = p_from_version_id;
  if v_sid is null then raise exception 'CHORDLIB_NOT_FOUND' using errcode = 'P0002'; end if;
  perform 1 from public.chord_sheets x where x.id = v_sid for update;
  select * into v from public.chord_sheet_versions x where x.id = p_from_version_id for update;
  if v.sheet_id is distinct from v_sid then
    raise exception 'CHORDLIB_RETRY: phiên bản vừa được dời sang bài khác — thử lại' using errcode = '40001';
  end if;
  if v.review_status = 'rejected' then
    raise exception 'CHORDLIB_INVALID: không gắn vạch nhịp vào bản đã bỏ' using errcode = '22023';
  end if;
  v_problem := public.chord_anchors_problem(p_anchors, public.chord_lyric_token_counts(v.text));
  if v_problem is not null then
    raise exception 'CHORDLIB_INVALID: vạch nhịp không hợp lệ — %', v_problem using errcode = '22023';
  end if;

  select x.id into v_dup from public.chord_sheet_versions x
   where x.sheet_id = v.sheet_id and x.review_status <> 'rejected' and x.anchors_status = 'ready'
     and x.text_hash = v.text_hash and x.meter is not distinct from v.meter and x.suggested_bpm is not distinct from v.suggested_bpm
     and public.chord_source_key(x.sources) = public.chord_source_key(v.sources) and x.anchors = p_anchors
   order by x.version_number limit 1;
  if v_dup is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'sheet_id', v.sheet_id, 'version_id', v_dup);
  end if;

  select coalesce(max(x.version_number), 0) + 1 into v_num from public.chord_sheet_versions x where x.sheet_id = v.sheet_id;
  insert into public.chord_sheet_versions
    (id, sheet_id, version_number, parent_version_id, text, text_hash, meter, suggested_bpm, sources,
     anchors, anchor_review, generator, contributed_by, review_status, anchors_status)
  values
    (v_new, v.sheet_id, v_num, v.id, v.text, v.text_hash, v.meter, v.suggested_bpm, v.sources,
     p_anchors,
     jsonb_build_object('mode', 'manual', 'reviewedBy', v_uid, 'reviewedAt', now(),
       'measureCount', jsonb_array_length(p_anchors -> 'measures'), 'hasPickup', p_anchors ? 'pickup'),
     'manual-anchors', v_uid, 'private', 'ready');
  return jsonb_build_object('ok', true, 'duplicate', false, 'sheet_id', v.sheet_id, 'version_id', v_new,
    'version_number', v_num, 'review_status', 'private', 'anchors_status', 'ready');
end $$;
comment on function public.chord_sheet_accept_anchors(uuid, jsonb, jsonb) is 'chord_library_v1: chấp nhận vạch nhịp → phiên bản mới (chỉ người review)';

revoke all on function public.chord_lyric_token_counts(text), public.chord_anchors_problem(jsonb, integer[]),
  public.chord_sheet_accept_anchors(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.chord_sheet_accept_anchors(uuid, jsonb, jsonb) to authenticated;
-- <<< V1.2 ANCHORS ───────────────────────────────────────────────────────────────────────────

-- ── 7) Bucket riêng tư cho file nguồn (PDF/ảnh sheet) ───────────────────────────────────────
-- Đường dẫn: {uid}/{version_id}/{0-9}.{ext}. Không URL công khai — xem bằng signed URL (cần quyền SELECT
-- dưới đây). Không HEIC ở V1.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chord-sheet-sources', 'chord-sheet-sources', false, 20971520,  -- 20MB / file
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- LUẬT GHI của bucket — MỘT nguồn duy nhất, dùng chung cho policy (lượt THỬ của Storage API) và trigger
-- (lượt GHI THẬT). Trả NULL = cho phép; chuỗi = lý do từ chối. `p_uid` là chủ thư mục:
--   • policy: auth.uid() của người gọi (tên ngoài thư mục của chính mình → từ chối, không tra gì);
--   • trigger: uid đọc từ chính đường dẫn đã qua regex (lượt ghi thật chạy bằng superuser, không có JWT).
-- Luật:
--   • Tên đúng khuôn {uid}/{uuid}/{0-9}.{pdf|jpg|jpeg|png|webp}.
--   • Giữ khoá tư vấn theo uid (cùng khoá với chord_sheet_contribute) RỒI mới đếm/kiểm → các lượt ghi của
--     cùng một người xếp hàng; người khác không chờ nhau. Giữ tới hết transaction.
--   • Thư mục {uuid} đã là một phiên bản của chủ thư mục ("đã ghi") → không thêm, không xoá: bộ file nguồn
--     là bằng chứng. Version id của người khác không làm kết quả khác đi (không lộ tồn tại).
--   • Tải lên: tối đa 10 file trong một thư mục phiên bản, và tối đa 20 file CHƯA gắn phiên bản cho mỗi người.
-- VOLATILE: mỗi lần gọi đọc dữ liệu MỚI NHẤT sau khi có khoá, không dùng ảnh chụp cũ của câu lệnh.
create or replace function public.chord_source_rule(p_uid uuid, p_name text, p_op text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_version uuid;
  v_n integer;
begin
  if p_uid is null or p_name is null or p_op is null or p_op not in ('insert', 'delete')
     or p_name !~ ('^' || p_uid::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]\.(pdf|jpg|jpeg|png|webp)$') then
    return 'đường dẫn phải là {uid}/{version_id}/{0-9}.{pdf|jpg|jpeg|png|webp}';
  end if;
  v_version := split_part(p_name, '/', 2)::uuid;
  perform pg_advisory_xact_lock(hashtextextended('chordlib:' || p_uid::text, 0));
  if exists (select 1 from public.chord_sheet_versions v where v.id = v_version and v.contributed_by = p_uid) then
    return 'phiên bản đã ghi — bộ file nguồn không đổi được nữa';
  end if;
  if p_op = 'delete' then return null; end if;
  select count(*) into v_n from storage.objects o
   where o.bucket_id = 'chord-sheet-sources' and o.name like p_uid::text || '/' || v_version::text || '/%';
  if v_n >= 10 then return 'một phiên bản tối đa 10 file nguồn'; end if;
  select count(*) into v_n from storage.objects o
   where o.bucket_id = 'chord-sheet-sources' and o.name like p_uid::text || '/%'
     and not exists (select 1 from public.chord_sheet_versions v
                      where v.contributed_by = p_uid and v.id::text = split_part(o.name, '/', 2));
  if v_n >= 20 then return 'đã có 20 file chưa gắn phiên bản — đóng góp cho xong hoặc xoá bớt'; end if;
  return null;
end $$;
comment on function public.chord_source_rule(uuid, text, text) is 'chord_library_v1: luật ghi file nguồn (dùng chung cho policy + trigger)';

-- Cổng của policy (lượt THỬ): chỉ trả lời về thư mục của CHÍNH người gọi.
-- COST cao để điều kiện rẻ (bucket_id) được xét trước.
create or replace function public.chord_source_can_write(p_name text, p_op text)
returns boolean language sql volatile security definer set search_path = '' cost 1000 as $$
  select public.chord_source_rule(auth.uid(), p_name, p_op) is null;
$$;
comment on function public.chord_source_can_write(text, text) is 'chord_library_v1: cổng tải lên/xoá file nguồn (thư mục của chính mình, hạn mức, chưa gắn phiên bản)';

-- N1 — LƯỢT GHI THẬT. Storage API kiểm policy INSERT bằng một transaction THỬ rồi rollback (khoá tư vấn
-- nhả theo), tải file, rồi mới ghi dòng bằng quyền superuser — không qua RLS. Vì vậy mọi luật ở trên phải
-- được ép LẠI ở đây, trong chính transaction ghi dòng. Trigger chỉ đụng bucket chord-sheet-sources; bucket
-- khác trả NEW ngay ở dòng đầu. Không ghi bảng nào (không đệ quy). Không đụng SELECT/DELETE.
--   • INSERT vào bucket này → luật 'insert' với uid đọc từ đường dẫn; nếu dòng có chủ (owner/owner_id do
--     Storage ghi từ JWT) thì chủ đó phải trùng uid trong đường dẫn.
--   • UPDATE đổi tên / đổi bucket: không có policy UPDATE nên ứng dụng không bao giờ làm việc này — chặn đổi
--     tên/dời khỏi bucket; dời TỪ bucket khác VÀO thì xét như một lượt tải lên mới.
create or replace function public.chord_source_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_owner text;
  v_reason text;
begin
  if tg_op = 'UPDATE' then
    if new.bucket_id is not distinct from old.bucket_id and new.name is not distinct from old.name then return new; end if;
    if old.bucket_id = 'chord-sheet-sources' then
      raise exception 'CHORDLIB_SOURCE: file nguồn không đổi tên / không dời được' using errcode = '42501';
    end if;
  end if;
  if new.bucket_id is distinct from 'chord-sheet-sources' then return new; end if;
  if coalesce(new.name, '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then
    raise exception 'CHORDLIB_SOURCE: đường dẫn phải là {uid}/{version_id}/{0-9}.{pdf|jpg|jpeg|png|webp}' using errcode = '42501';
  end if;
  v_uid := split_part(new.name, '/', 1)::uuid;
  v_owner := coalesce(to_jsonb(new) ->> 'owner_id', to_jsonb(new) ->> 'owner');
  if v_owner is not null and v_owner <> v_uid::text then
    raise exception 'CHORDLIB_SOURCE: chủ file không khớp thư mục' using errcode = '42501';
  end if;
  v_reason := public.chord_source_rule(v_uid, new.name, 'insert');
  if v_reason is not null then
    raise exception 'CHORDLIB_SOURCE: %', v_reason using errcode = '42501';
  end if;
  return new;
end $$;
comment on function public.chord_source_guard() is 'chord_library_v1: trigger ép luật file nguồn ở lượt ghi thật (N1)';
drop trigger if exists chord_source_guard_trg on storage.objects;
create trigger chord_source_guard_trg
  before insert or update of bucket_id, name on storage.objects
  for each row execute function public.chord_source_guard();

-- Tên cũ của bản nháp trước khi review (chưa từng lên production) — gỡ nếu còn.
drop policy if exists "chord sheet sources read"    on storage.objects;
drop policy if exists "chord sheet sources insert"  on storage.objects;
drop policy if exists "chord sheet sources cleanup" on storage.objects;
drop function if exists public.chord_source_recorded(text);

-- Đọc: file trong thư mục của CHÍNH mình, hoặc người có quyền review. Bạn học khác / khách: không.
create policy "chord sheet sources read" on storage.objects
  for select to authenticated
  using (bucket_id = 'chord-sheet-sources'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.chordlib_can('review')));
-- Tải lên: chỉ vào thư mục của chính mình, đúng khuôn tên, trong hạn mức, và CHỈ khi phiên bản chưa được
-- ghi — đã ghi rồi thì bộ file nguồn là bằng chứng, không thêm được nữa.
create policy "chord sheet sources insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chord-sheet-sources'
              and public.chordlib_can('contribute')
              and public.chord_source_can_write(name, 'insert'));
-- Không policy UPDATE (không ghi đè, không đổi tên). DELETE mở đúng một khe: dọn file mình đã tải lên mà
-- chưa thành phiên bản.
create policy "chord sheet sources cleanup" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chord-sheet-sources'
         and public.chord_source_can_write(name, 'delete'));

-- ── 8) Quyền gọi hàm ────────────────────────────────────────────────────────────────────────
revoke all on function
  public.chord_fold_vi(text), public.chord_canonical_text(text), public.chord_meter_ok(jsonb), public.chord_source_key(jsonb),
  public.chord_sheet_versions_guard(), public.chordlib_can(text), public.my_chordlib_caps(),
  public.chord_sheet_search(text, integer),
  public.chord_sheet_contribute(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid),
  public.chord_sheet_get(uuid), public.chord_sheet_approve(uuid, uuid), public.chord_sheet_reject(uuid, text),
  public.chord_sheet_update_info(uuid, text, text), public.chord_source_can_write(text, text),
  public.chord_source_rule(uuid, text, text), public.chord_source_guard()
from public, anon, authenticated;
grant execute on function
  public.chord_fold_vi(text), public.chordlib_can(text), public.my_chordlib_caps(),
  public.chord_sheet_search(text, integer),
  public.chord_sheet_contribute(text, text, text, jsonb, integer, jsonb, uuid, uuid, uuid),
  public.chord_sheet_get(uuid), public.chord_sheet_approve(uuid, uuid), public.chord_sheet_reject(uuid, text),
  public.chord_sheet_update_info(uuid, text, text), public.chord_source_can_write(text, text)
to authenticated;

notify pgrst, 'reload schema';
