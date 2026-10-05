-- Entity Cover V1 (Dynamic OG V1.1, 05/10/2026) — ảnh bìa của entity, dùng chung cho giao diện + thẻ chia sẻ.
-- KHÔNG phải trường "OG thumbnail": Band / Tool / Lớp có ảnh bìa riêng; Edge Function og-meta đọc cùng nguồn.
--   bands.cover_url          → Owner/Admin đặt trong Quản lý Band (RPC band_admin_set_cover)
--   edu_tools.image_url      → Admin đặt trong Quản lý công cụ (ghi thẳng như các cột khác của edu_tools)
--   class_schedule.cover_url → Admin đặt trong Lịch lớp (ghi thẳng, policy cs_auth_teacher_write có sẵn)
-- Chỉ THÊM cột nullable + đổi 2 RPC Band + 1 RPC mới. KHÔNG đổi RLS/policy, không đụng dữ liệu cũ.
-- Ảnh tải lên bucket course-logos sẵn có. Rollback: db/entity_cover_v1_rollback.sql.

alter table public.bands add column if not exists cover_url text;
alter table public.bands add constraint bands_cover_url_check
  check (cover_url is null or (cover_url ~ '^https://[^\s"<>]+$' and length(cover_url) <= 1000));
comment on column public.bands.cover_url is 'entity_cover_v1: ảnh bìa Band (https) — landing /band + thẻ chia sẻ';

alter table public.edu_tools add column if not exists image_url text;
alter table public.edu_tools add constraint edu_tools_image_url_check
  check (image_url is null or (image_url ~ '^https://[^\s"<>]+$' and length(image_url) <= 1000));
comment on column public.edu_tools.image_url is 'entity_cover_v1: ảnh công cụ (https) — giao diện + thẻ chia sẻ';

alter table public.class_schedule add column if not exists cover_url text;
alter table public.class_schedule add constraint class_schedule_cover_url_check
  check (cover_url is null or (cover_url ~ '^https://[^\s"<>]+$' and length(cover_url) <= 1000));
comment on column public.class_schedule.cover_url is 'entity_cover_v1: ảnh bìa lớp (https); trống → ảnh khoá chính';

-- Landing công khai: thêm cover_url (giữ nguyên mọi trường cũ)
create or replace function public.band_recruitment_public(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'band', jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'leader_name', b.leader_name,
      'tagline', b.tagline, 'music_style', b.music_style, 'schedule_text', b.schedule_text,
      'reference_songs', b.reference_songs, 'highlights', b.highlights, 'description', b.description,
      'cover_url', b.cover_url),
    'recruitment', case when r.id is null then null else jsonb_build_object('id', r.id, 'title', r.title, 'intro', r.intro,
      'positions', r.positions, 'questions', r.questions, 'reason_label', r.reason_label,
      'success_message', r.success_message) end,
    'rules', case when v.id is null then null else jsonb_build_object('id', v.id, 'version', v.version, 'title', v.title,
      'items', v.items, 'agree_label', v.agree_label) end)
  from public.bands b
  left join public.band_recruitments r on r.band_id = b.id and r.status = 'open'
  left join public.band_rule_versions v on v.id = r.rule_version_id
  where b.slug = lower(btrim(p_slug)) and b.status = 'active'
$$;

-- Bàn quản lý: thêm cover_url + can_edit_cover (chỉ Thầy/admin sửa ảnh bìa; Leader xem)
create or replace function public.band_admin_overview(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare b public.bands;
begin
  select * into b from public.bands where slug = lower(btrim(p_slug));
  if b.id is null or not public.band_can_manage(b.id) then
    raise exception 'Không có quyền quản trị Band này' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'band', jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'leader_name', b.leader_name,
      'schedule_text', b.schedule_text, 'music_style', b.music_style, 'status', b.status,
      'cover_url', b.cover_url, 'can_edit_cover', public.is_teacher()),
    'position_catalog', b.position_catalog,
    'role_catalog', b.role_catalog,
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'full_name', m.full_name, 'phone', m.phone,
        'status', m.status, 'joined_at', m.joined_at, 'positions', to_jsonb(m.positions), 'position_note', m.position_note,
        'application_id', m.application_id, 'has_account', m.user_id is not null,
        'roles', coalesce((select jsonb_agg(r.role_key order by r.assigned_at) from public.band_member_roles r where r.member_id = m.id), '[]'::jsonb))
        order by (m.status = 'LEFT'), m.joined_at, m.full_name)
      from public.band_members m where m.band_id = b.id), '[]'::jsonb),
    'counts', jsonb_build_object(
      'members', (select count(*) from public.band_members m where m.band_id = b.id and m.status <> 'LEFT'),
      'active', (select count(*) from public.band_members m where m.band_id = b.id and m.status = 'ACTIVE'),
      'new_applications', (select count(*) from public.band_applications a where a.band_id = b.id and a.status = 'NEW')));
end $$;

-- Đặt / gỡ ảnh bìa Band. Chỉ Thầy/admin. p_url null hoặc '' = gỡ.
create or replace function public.band_admin_set_cover(p_band_id uuid, p_url text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if auth.uid() is null or not public.is_teacher() then
    raise exception 'Không có quyền sửa ảnh bìa Band' using errcode = '42501';
  end if;
  if v is not null and (v !~ '^https://[^\s"<>]+$' or length(v) > 1000) then
    return jsonb_build_object('ok', false, 'code', 'bad_url', 'message', 'Ảnh không hợp lệ (cần đường dẫn https).');
  end if;
  update public.bands set cover_url = v, updated_at = now() where id = p_band_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Không tìm thấy Band.');
  end if;
  return jsonb_build_object('ok', true, 'cover_url', v);
end $$;
comment on function public.band_admin_set_cover(uuid, text) is 'entity_cover_v1: Thầy/admin đặt ảnh bìa Band';
revoke all on function public.band_admin_set_cover(uuid, text) from public, anon;
grant execute on function public.band_admin_set_cover(uuid, text) to authenticated;

notify pgrst, 'reload schema';
