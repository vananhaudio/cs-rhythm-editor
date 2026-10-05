-- ROLLBACK db/entity_cover_v1_setup.sql — trả 2 RPC Band về bản 05/10 trước V1.1, gỡ RPC mới + 3 cột.
-- LƯU Ý: xoá cột = mất ảnh bìa đã đặt (URL; file ảnh trong bucket course-logos vẫn còn).
-- Frontend V1.1 đọc cột mới qua select → rollback DB phải đi SAU khi frontend đã về bản cũ.

drop function if exists public.band_admin_set_cover(uuid, text);

CREATE OR REPLACE FUNCTION public.band_recruitment_public(p_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'band', jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'leader_name', b.leader_name,
      'tagline', b.tagline, 'music_style', b.music_style, 'schedule_text', b.schedule_text,
      'reference_songs', b.reference_songs, 'highlights', b.highlights, 'description', b.description),
    'recruitment', case when r.id is null then null else jsonb_build_object('id', r.id, 'title', r.title, 'intro', r.intro,
      'positions', r.positions, 'questions', r.questions, 'reason_label', r.reason_label,
      'success_message', r.success_message) end,
    'rules', case when v.id is null then null else jsonb_build_object('id', v.id, 'version', v.version, 'title', v.title,
      'items', v.items, 'agree_label', v.agree_label) end)
  from public.bands b
  left join public.band_recruitments r on r.band_id = b.id and r.status = 'open'
  left join public.band_rule_versions v on v.id = r.rule_version_id
  where b.slug = lower(btrim(p_slug)) and b.status = 'active'
$function$;

CREATE OR REPLACE FUNCTION public.band_admin_overview(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare b public.bands;
begin
  select * into b from public.bands where slug = lower(btrim(p_slug));
  if b.id is null or not public.band_can_manage(b.id) then
    raise exception 'Không có quyền quản trị Band này' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'band', jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'leader_name', b.leader_name,
      'schedule_text', b.schedule_text, 'music_style', b.music_style, 'status', b.status),
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
end $function$;

alter table public.bands          drop column if exists cover_url;
alter table public.edu_tools      drop column if exists image_url;
alter table public.class_schedule drop column if exists cover_url;

notify pgrst, 'reload schema';
