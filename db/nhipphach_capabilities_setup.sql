-- ═══════════════════════════════════════════════════════════════════════════
-- Phân quyền tính năng công cụ (Giai đoạn 12)
--
-- Ba khái niệm TÁCH BIỆT, không được trộn:
--   ROLE        student | teacher | admin   ← máy chủ quyết, từ my_learning_state()
--   UI MODE     Cơ bản | Nâng cao           ← sở thích, nằm ở localStorage
--   CAPABILITY  quyền dùng từng tính năng   ← bảng dưới đây, CHỈ Admin chỉnh
--
-- Vì thế "học viên + giao diện Nâng cao + được PNG + không được Nhiều bài"
-- là một tổ hợp hoàn toàn hợp lệ.
--
-- THỨ BẬC quyền, quyết trong my_nhipphach_caps():
--   edu_tools.enabled  (công tắc tổng)
--        ↓
--   access             (vào được công cụ hay không)
--        ↓
--   advanced           (có mức Nâng cao hay không)
--        ↓
--   từng capability
-- Các tầng trên CHE tầng dưới chứ không xoá gì trong bảng: tắt rồi bật lại thì
-- mọi lựa chọn cũ còn nguyên. Admin đứng ngoài mọi tầng để không tự khoá.
--
-- Idempotent VÀ KHÔNG ghi đè cấu hình Admin đã chỉnh. Chạy lại bao nhiêu lần
-- cũng chỉ tạo thêm dòng còn thiếu.
-- Chạy xong nhớ: notify pgrst, 'reload schema';
-- `tool_capabilities` PHẢI nằm trong self_managed của db/rls_setup.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0) Ai là quản trị viên ────────────────────────────────────────────────
--
-- `is_teacher()` gộp cả teacher lẫn admin nên KHÔNG dùng được cho quyền ghi ma
-- trận: giáo viên sẽ tự bật Nhiều bài cho mình. Cần một vị từ hẹp hơn, dựng
-- đúng khuôn `is_teacher()` sẵn có.
--
-- An toàn vì `app_users` chỉ cho authenticated ĐỌC (xem db/rls_setup.sql) —
-- không ai tự UPDATE role='admin' cho mình được.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.app_users au
    where au.id = auth.uid() and au.role = 'admin'
  );
$$;
-- `revoke from public` KHÔNG gỡ được quyền mà Supabase cấp thẳng cho `anon`
-- qua ALTER DEFAULT PRIVILEGES, nên phải revoke đích danh. Hàm này trả false
-- cho khách nên không lộ gì, nhưng đã siết thì siết cho đều.
revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- ── 1) Nhịp Phách trở thành một công cụ CHÍNH THỨC trong sổ chung ──────────
--
-- Trước đây `/nhipphach` không có trong edu_tools, nên my_tool_route_access()
-- rơi vào nhánh "không phải công cụ → cho qua" và ai cũng lọt cổng ngoài; thứ
-- chặn thật lại là một dòng hard-code role ở client.
--
-- `enabled` là CÔNG TẮC TỔNG và là thứ Admin có quyền chỉnh, nên `on conflict`
-- TUYỆT ĐỐI không đụng tới nó: chạy lại migration không được bật lại một công
-- cụ mà Admin đã tắt. Cũng không đụng `status`, `tier`, `order_index`.
insert into public.edu_tools (id, name, description, icon, category, route, tier, enabled, status, order_index)
values (
  'nhipphach',
  'Đọc nhịp – phách',
  'Tạo bản nhạc có đánh dấu phách từ MusicXML.',
  '🎼',
  'Nhạc lý',
  '/nhipphach',
  'free',
  true,
  'on',
  90
)
on conflict (id) do update
  set name        = excluded.name,
      route       = excluded.route,
      description = excluded.description;

-- ── 2) Ma trận quyền ──────────────────────────────────────────────────────
--
-- Mở rộng per-user về sau: KHÔNG sửa khoá chính ở đây. Thêm một bảng phủ
-- `tool_capability_overrides(user_id, tool_id, capability, allowed)` rồi cho
-- RPC đọc chồng lên bảng này.
create table if not exists public.tool_capabilities (
  tool_id    text        not null references public.edu_tools(id) on delete cascade,
  -- Giai đoạn 12 chỉ có hai vai trò. Khách không có dòng nào: không có quyền
  -- là mặc định, không phải một trạng thái phải khai báo.
  role       text        not null check (role in ('student','teacher')),
  capability text        not null,
  allowed    boolean     not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid        references auth.users(id) on delete set null,
  constraint tool_capabilities_pkey primary key (tool_id, role, capability)
);
create index if not exists tool_capabilities_tool_idx
  on public.tool_capabilities (tool_id, role);

-- Ai đổi quyền, đổi lúc nào — ghi tự động, KHÔNG tin client gửi lên.
create or replace function public.tool_capabilities_touch()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists tool_capabilities_touch on public.tool_capabilities;
create trigger tool_capabilities_touch
  before insert or update on public.tool_capabilities
  for each row execute function public.tool_capabilities_touch();

-- ── 3) RLS: CHỈ ADMIN, kể cả đọc ──────────────────────────────────────────
--
-- Giáo viên không được chạm bảng này: đây là trang quản trị chung, cho giáo
-- viên ghi là cho họ tự bật Nhiều bài/SVG cho mình và đổi quyền của học viên.
-- Runtime của giáo viên lẫn học viên chỉ cần my_nhipphach_caps(), không cần
-- đọc bảng.
alter table public.tool_capabilities enable row level security;

do $$
declare p record;
begin
  -- Xoá MỌI policy đang có: policy trong Postgres được OR, sót một policy rộng
  -- cũ là mất sạch giới hạn.
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'tool_capabilities' loop
    execute format('drop policy if exists %I on public.tool_capabilities', p.policyname);
  end loop;
end $$;

create policy tool_capabilities_admin_select on public.tool_capabilities
  for select to authenticated using (public.is_admin());
create policy tool_capabilities_admin_insert on public.tool_capabilities
  for insert to authenticated with check (public.is_admin());
create policy tool_capabilities_admin_update on public.tool_capabilities
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy tool_capabilities_admin_delete on public.tool_capabilities
  for delete to authenticated using (public.is_admin());

revoke all on public.tool_capabilities from anon;
grant select, insert, update, delete on public.tool_capabilities to authenticated;

-- ── 4) Danh sách quyền chuẩn của Nhịp Phách ───────────────────────────────
--
-- CỐ Ý không có quyền nào cho 4/4, 6/8, 5/8, 7/8 hay cách chia nhịp lẻ: đó là
-- logic âm nhạc để tính cho ĐÚNG, không phải tính năng đem ra bán.
--
-- Danh sách này phải khớp `NHIPPHACH_CAPS` ở src/nhipphach/capabilities.ts —
-- có test so hai bên để không bên nào trôi.
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
    -- Thư viện bài hát (db/nhipphach_library_setup.sql): kho chung của thầy.
    'library.read',
    'library.save',
    'library.manage'
  ];
$$;

-- Những quyền chỉ xuất hiện bên trong mức Nâng cao.
--
-- `export.png` CỐ Ý không nằm đây: khi Admin tắt PDF thì PNG lên làm nút chính
-- ở mức Cơ bản, che nó đi là người dùng mất hẳn đường xuất file.
-- `history` cũng không: khu "Gần đây" có mặt ở cả mức Cơ bản.
create or replace function public.nhipphach_advanced_only()
returns text[] language sql immutable set search_path = '' as $$
  select array['batch', 'presets', 'export.svg', 'export.beatmap'];
$$;

-- ── 5) Seed ban đầu ───────────────────────────────────────────────────────
--
-- CHỈ tạo dòng còn thiếu. `do nothing` chứ không `do update`: chạy lại
-- migration không được xoá lựa chọn Admin đã đặt.
insert into public.tool_capabilities (tool_id, role, capability, allowed) values
  ('nhipphach', 'student', 'access',         true),
  ('nhipphach', 'student', 'advanced',       true),
  ('nhipphach', 'student', 'export.pdf',     true),
  ('nhipphach', 'student', 'export.png',     true),
  ('nhipphach', 'student', 'export.svg',     false),
  ('nhipphach', 'student', 'export.beatmap', false),
  ('nhipphach', 'student', 'batch',          false),
  -- Hai quyền dưới đây bị KHOÁ ở Giai đoạn 12 ngay trong resolver: RLS của
  -- preset và lịch sử vẫn là `is_teacher()`.
  ('nhipphach', 'student', 'presets',        false),
  ('nhipphach', 'student', 'history',        false),
  ('nhipphach', 'teacher', 'access',         true),
  ('nhipphach', 'teacher', 'advanced',       true),
  ('nhipphach', 'teacher', 'export.pdf',     true),
  ('nhipphach', 'teacher', 'export.png',     true),
  ('nhipphach', 'teacher', 'export.svg',     true),
  ('nhipphach', 'teacher', 'export.beatmap', true),
  ('nhipphach', 'teacher', 'batch',          true),
  ('nhipphach', 'teacher', 'presets',        true),
  ('nhipphach', 'teacher', 'history',        true),
  -- Thư viện: học viên ĐỌC kho chung, thầy lưu và quản lý.
  ('nhipphach', 'student', 'library.read',   true),
  ('nhipphach', 'student', 'library.save',   false),
  ('nhipphach', 'student', 'library.manage', false),
  ('nhipphach', 'teacher', 'library.read',   true),
  ('nhipphach', 'teacher', 'library.save',   true),
  ('nhipphach', 'teacher', 'library.manage', true)
on conflict (tool_id, role, capability) do nothing;

-- ── 6) Quyền HIỆU LỰC của CHÍNH người đang gọi ────────────────────────────
--
-- SECURITY DEFINER nên phải rất chặt:
--   · không nhận tham số nào — không có role, không có user_id;
--   · người gọi xác định bằng auth.uid();
--   · vai trò lấy từ my_learning_state() phía máy chủ;
--   · search_path cố định rỗng, mọi tên đều viết đủ;
--   · anon không được chạy.
--
-- Thiếu dòng trong ma trận nghĩa là KHÔNG có quyền — mặc định là từ chối.
create or replace function public.my_nhipphach_caps()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_mode     text;
  v_enabled  boolean;
  v_caps     jsonb;
  v_tat_het  jsonb;
begin
  select jsonb_object_agg(c, false) into v_tat_het
    from unnest(public.nhipphach_capability_list()) as c;

  -- Khách: không đăng nhập thì không có quyền nào, kể cả quyền vào công cụ.
  if v_uid is null then
    return jsonb_build_object('role', 'guest', 'caps', v_tat_het);
  end if;

  -- Admin đứng NGOÀI công tắc tổng và mọi cờ. Nếu không, một cú bấm nhầm
  -- trong trang quản trị có thể tự khoá đường vào chính trang đó.
  if public.is_admin() then
    return jsonb_build_object(
      'role', 'admin',
      'caps', (select jsonb_object_agg(c, true)
                 from unnest(public.nhipphach_capability_list()) as c)
    );
  end if;

  v_mode := public.my_learning_state() ->> 'mode';
  if v_mode is null or v_mode not in ('student', 'teacher') then
    return jsonb_build_object('role', 'guest', 'caps', v_tat_het);
  end if;

  -- Tầng 1 — CÔNG TẮC TỔNG. Tắt công cụ là tắt cho cả học viên lẫn giáo viên;
  -- không dựa vào my_tool_route_access() vì hàm đó cho giáo viên đi vòng.
  select coalesce(t.enabled, false) into v_enabled
    from public.edu_tools t where t.id = 'nhipphach';
  if not coalesce(v_enabled, false) then
    return jsonb_build_object('role', v_mode, 'caps', v_tat_het);
  end if;

  select jsonb_object_agg(c, coalesce(tc.allowed, false)) into v_caps
    from unnest(public.nhipphach_capability_list()) as c
    left join public.tool_capabilities tc
      on tc.tool_id = 'nhipphach' and tc.role = v_mode and tc.capability = c;
  v_caps := coalesce(v_caps, v_tat_het);

  -- KHOÁ tạm của Giai đoạn 12: dù ai sửa thẳng vào bảng thành true thì học
  -- viên vẫn không có hai quyền này, vì backend chưa đỡ nổi. Bỏ clamp này khi
  -- và chỉ khi đã mở RLS cho học viên.
  if v_mode = 'student' then
    v_caps := v_caps || jsonb_build_object('presets', false, 'history', false);
  end if;

  -- Tầng 2 — access. CHE hết phần còn lại, nhưng không xoá gì trong bảng:
  -- bật access lại là mọi lựa chọn cũ trở về.
  if not coalesce((v_caps ->> 'access')::boolean, false) then
    return jsonb_build_object('role', v_mode, 'caps', v_tat_het);
  end if;

  -- Tầng 3 — advanced. Cũng chỉ CHE những tính năng nằm trong mức Nâng cao.
  if not coalesce((v_caps ->> 'advanced')::boolean, false) then
    v_caps := v_caps || (
      select jsonb_object_agg(c, false)
        from unnest(public.nhipphach_advanced_only()) as c
    );
  end if;

  return jsonb_build_object('role', v_mode, 'caps', v_caps);
end $$;

revoke all on function public.my_nhipphach_caps() from public;
revoke all on function public.my_nhipphach_caps() from anon;
grant execute on function public.my_nhipphach_caps() to authenticated;
revoke all on function public.nhipphach_capability_list() from public;
revoke all on function public.nhipphach_capability_list() from anon;
grant execute on function public.nhipphach_capability_list() to authenticated;
revoke all on function public.nhipphach_advanced_only() from public;
revoke all on function public.nhipphach_advanced_only() from anon;
grant execute on function public.nhipphach_advanced_only() to authenticated;

notify pgrst, 'reload schema';
