-- BMS SHARE LIFECYCLE V1 — local → shared → class (MỘT bài = MỘT artifact). Chạy bằng scripts/prod-db.py (một transaction; file KHÔNG có begin/commit).
-- Nguyên tắc: "Lưu nội dung" ≠ "Phân phối nội dung". Một object được lưu trước, rồi phân phối riêng cho người qua Chat hoặc cho cộng đồng.
--   • tool_artifacts.visibility thêm 'shared' = RIÊNG TƯ: chủ bài đọc được + CHỈ những người đã NHẬN artifact qua DM (tin DM do chủ bài gửi = grant).
--     Thành viên Class khác KHÔNG đọc được. 'class' giữ nguyên quyền hiện tại. Gửi artifact 'shared' không tạo bài Feed.
--   • bms_save_for_share(song): lưu riêng (idempotent theo NỘI DUNG + chủ bài, khoá advisory → bấm đúp / đua nhau vẫn một artifact).
--   • social_publish_tool_artifact(id): chủ bài ĐĂNG cộng đồng — PROMOTE chính artifact 'shared' → 'class' + tạo đúng MỘT bài Feed (idempotent).
--   • dm_artifact_granted(id) (SECURITY DEFINER) cho policy đọc: tránh policy tool_artifacts ↔ dm_* đệ quy / quyền bảng (dm_* đóng với client).
--   • "Gỡ khỏi cộng đồng" ≠ "Xoá artifact" (Object ≠ nơi phân phối object): tool_artifact_demote_or_delete(): artifact ĐÃ TỪNG được chủ bài gửi qua DM → chỉ gỡ bài Feed và HẠ class → shared
--     (người đã nhận vẫn mở được, người Class khác không đọc được, đăng lại được trên chính artifact); CHƯA từng gửi → xoá như cũ (không để object mồ côi).
--     Áp cho cả hai đường: RPC social_unpublish_tool_artifact và xoá bài Feed trực tiếp (trigger class_posts_tool_artifact_cleanup).
--     Chủ bài chủ động xoá bài (social_delete_tool_artifact) vẫn xoá artifact; tin Chat luôn còn.
-- KHÔNG đổi: social_share_tool_result (md5 ghim), dm_share/dm_append/dm_messages/dm_rule, social_delete_tool_artifact (xoá artifact + bài Feed; KHÔNG xoá tin Chat),
--   dữ liệu hiện có. Không CREATE POLICY (ALTER POLICY), không FK mới → không khoá auth.users.
-- Chủ bài gỡ artifact → tin Chat còn, card thành "Nội dung này không còn khả dụng". Huỷ kết bạn → người đã nhận vẫn mở được.

-- 0) Cổng drift
do $gate$
declare
  v_pol text; v_chk text; v_rpc text := (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('public.social_share_tool_result(text,jsonb,uuid)'));
  v_dm text; v_exist oid; v_del text := (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('public.social_delete_tool_artifact(uuid)'));
  v_clean text := (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('public.tool_artifacts_cleanup_on_post_delete()'));
begin
  if to_regclass('public.tool_artifacts') is null or to_regclass('public.class_posts') is null or to_regclass('public.dm_messages') is null
     or to_regprocedure('public.bms_song_normalize(jsonb)') is null or to_regprocedure('public.dm_share(uuid,text,text)') is null then
    raise exception 'DỪNG — thiếu nền (tool_artifacts, class_posts, dm_messages, bms_song_normalize, dm_share)';
  end if;
  select string_agg(p.proname || '=' || left(md5(p.prosrc), 8), ',' order by p.proname) into v_dm from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('dm_append', 'dm_messages', 'dm_open', 'dm_share', 'dm_rule');
  if v_dm is distinct from 'dm_append=00aefca4,dm_messages=0605c799,dm_open=7cdcea48,dm_rule=763d62ac,dm_share=120fe4b6' then
    raise exception 'DỪNG — hàm Chat V1a/V1b khác baseline: %', v_dm;
  end if;
  select pg_get_expr(pl.polqual, pl.polrelid) into v_pol from pg_policy pl where pl.polrelid = 'public.tool_artifacts'::regclass and pl.polname = 'tool_artifacts_read';
  v_exist := to_regprocedure('public.dm_artifact_granted(uuid)');
  if v_exist is null then
    -- chưa có lifecycle: policy + check + RPC chung phải đúng baseline production
    if v_pol is distinct from $p$((owner_id = auth.uid()) OR ((visibility = 'class'::text) AND is_class_member()))$p$ then
      raise exception 'DỪNG — policy tool_artifacts_read khác baseline: %', v_pol;
    end if;
    if v_clean is distinct from '084462af8e4a71394dafe2b6b5b0b2ad' then raise exception 'DỪNG — tool_artifacts_cleanup_on_post_delete khác baseline (md5 %)', v_clean; end if;
    select pg_get_constraintdef(c.oid) into v_chk from pg_constraint c where c.conrelid = 'public.tool_artifacts'::regclass and c.conname = 'tool_artifacts_visibility_check';
    if v_chk is distinct from $c$CHECK ((visibility = 'class'::text))$c$ then raise exception 'DỪNG — tool_artifacts_visibility_check khác baseline: %', v_chk; end if;
  elsif coalesce(obj_description(v_exist, 'pg_proc'), '') not like 'bms_share_v1:%' then
    raise exception 'DỪNG — dm_artifact_granted đã có nhưng không thuộc BMS Share Lifecycle';
  end if;
  if v_del is distinct from 'cbcac72830a72003d414863d1aee8806' then
    raise exception 'DỪNG — social_delete_tool_artifact khác baseline production (md5 %)', v_del;
  end if;
  if v_rpc is distinct from '932a8b041487bd5a75d72884485d2c35' then
    raise exception 'DỪNG — social_share_tool_result khác baseline production (md5 %)', v_rpc;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
              and p.proname in ('bms_save_for_share', 'social_publish_tool_artifact', 'social_unpublish_tool_artifact', 'tool_artifact_demote_or_delete') and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'bms_share_v1:%') then
    raise exception 'DỪNG — đã có hàm cùng tên không thuộc BMS Share Lifecycle';
  end if;
end $gate$;

-- 1) visibility 'shared' (bảng nhỏ; ACCESS EXCLUSIVE rất ngắn)
alter table public.tool_artifacts drop constraint if exists tool_artifacts_visibility_check;
alter table public.tool_artifacts add constraint tool_artifacts_visibility_check check (visibility in ('class', 'shared'));

-- 2) Chỉ mục: tra "ai đã nhận artifact" + MỘT bài Feed cho mỗi artifact
create index if not exists dm_messages_ref_idx on public.dm_messages (ref_key, conversation_id) where ref_type is not null;
create unique index if not exists class_posts_tool_artifact_once on public.class_posts ((tool_share ->> 'artifact_id'))
  where type = 'tool_share' and tool_share ? 'artifact_id';

-- 3) Grant qua DM (cho policy đọc): người dùng hiện tại là người tham gia hội thoại có tin share do CHÍNH CHỦ BÀI gửi.
--    Tin do người khác gửi (forward) không cấp quyền. SECURITY DEFINER vì dm_* đóng với client; chủ bảng không bị RLS ⇒ không đệ quy.
create or replace function public.dm_artifact_granted(p_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select auth.uid() is not null and exists (
    select 1
      from public.tool_artifacts a
      join public.dm_messages m on m.ref_type = 'tool_artifact' and m.ref_key = a.id::text and m.sender_id = a.owner_id
      join public.dm_participants p on p.conversation_id = m.conversation_id and p.user_id = auth.uid()
     where a.id = p_id and a.visibility = 'shared');
$$;
comment on function public.dm_artifact_granted(uuid) is 'bms_share_v1: tôi đã nhận artifact shared này qua DM (chỉ tiết lộ quyền CỦA CHÍNH MÌNH)';
revoke all on function public.dm_artifact_granted(uuid) from public, anon;
grant execute on function public.dm_artifact_granted(uuid) to authenticated;

-- 4) Policy đọc: chủ bài · 'class' cho thành viên Class · 'shared' chỉ cho người đã nhận (ALTER, không CREATE → không khoá auth.users/storage)
alter policy tool_artifacts_read on public.tool_artifacts
  using (owner_id = auth.uid()
         or (visibility = 'class' and public.is_class_member())
         or (visibility = 'shared' and public.is_class_member() and public.dm_artifact_granted(id)));

-- 5) Lưu RIÊNG một bài BMS (chưa đăng): idempotent theo (chủ bài, nội dung đã chuẩn hoá). Đã có artifact cùng nội dung (shared HOẶC class) → dùng lại.
create or replace function public.bms_save_for_share(p_song jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_song jsonb; v_id uuid;
begin
  if v_me is null or not public.is_class_member() then raise exception 'TS_NOT_MEMBER' using errcode = '42501'; end if;
  v_song := public.bms_song_normalize(p_song);
  if v_song is null or pg_column_size(v_song) > 65536 then raise exception 'TS_BAD_RESULT' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_me::text || ':bms:' || md5(v_song::text), 21));
  select a.id into v_id from public.tool_artifacts a
   where a.owner_id = v_me and a.tool = 'bms' and a.kind = 'song' and a.data = v_song order by a.created_at, a.id limit 1;
  if v_id is not null then return v_id; end if;
  if (select count(*) from public.tool_artifacts a where a.owner_id = v_me and a.visibility = 'shared' and a.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Bạn lưu quá nhiều bài trong thời gian ngắn. Hãy chờ một chút.' using errcode = '54000';
  end if;
  insert into public.tool_artifacts (owner_id, tool, kind, schema_version, title, data, visibility, client_key)
  values (v_me, 'bms', 'song', 1, v_song ->> 'title', v_song, 'shared', gen_random_uuid())
  returning id into v_id;
  return v_id;
end $$;
comment on function public.bms_save_for_share(jsonb) is 'bms_share_v1: lưu riêng bài BMS (shared), idempotent theo nội dung';
revoke all on function public.bms_save_for_share(jsonb) from public, anon;
grant execute on function public.bms_save_for_share(jsonb) to authenticated;

-- 6) ĐĂNG lên cộng đồng: PROMOTE chính artifact (shared → class) + đúng MỘT bài Feed. Idempotent; chỉ chủ bài; chỉ BMS (V1).
create or replace function public.social_publish_tool_artifact(p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); a public.tool_artifacts%rowtype; v_post uuid; v_payload jsonb;
begin
  if v_me is null or not public.is_class_member() then raise exception 'TS_NOT_MEMBER' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_id::text, ''), 22));
  select * into a from public.tool_artifacts t where t.id = p_id and t.owner_id = v_me and t.tool = 'bms' and t.kind = 'song' for update;
  if not found then raise exception 'TS_NOT_OWNER' using errcode = '42501'; end if;
  select p.id into v_post from public.class_posts p
   where p.type = 'tool_share' and p.author_user_id = v_me and p.tool_share ->> 'artifact_id' = p_id::text;
  if v_post is not null then
    if a.visibility <> 'class' then update public.tool_artifacts set visibility = 'class' where id = p_id; end if;
    return v_post;
  end if;
  if a.visibility <> 'class' then update public.tool_artifacts set visibility = 'class' where id = p_id; end if;
  v_payload := jsonb_build_object('v', 1, 'tool', 'bms', 'kind', 'song', 'artifact_id', a.id::text,
    'title', a.data ->> 'title', 'video_id', a.data ->> 'video_id',
    'bpm', round((a.data -> 'fit' ->> 'bpm')::numeric)::int, 'beats_per_bar', (a.data ->> 'time_signature')::int,
    'chord_count', (select count(distinct e ->> 'name') from jsonb_array_elements(a.data -> 'chords') e)::int,
    'client_key', a.client_key::text);
  insert into public.class_posts (author_user_id, type, audience, body, tool_share)
  values (v_me, 'tool_share', 'class', '', v_payload) returning id into v_post;
  return v_post;
end $$;
comment on function public.social_publish_tool_artifact(uuid) is 'bms_share_v1: đăng cộng đồng = promote chính artifact + một bài Feed';
revoke all on function public.social_publish_tool_artifact(uuid) from public, anon;
grant execute on function public.social_publish_tool_artifact(uuid) to authenticated;

-- 7) GỠ KHỎI CỘNG ĐỒNG ≠ XOÁ artifact. Nội bộ: artifact đã từng được CHỦ BÀI gửi qua DM → hạ class → shared (giữ id, giữ grant của người đã nhận);
--    chưa từng gửi → xoá (không mồ côi). Khoá cùng khoá với publish → không trạng thái nửa vời khi đăng/gỡ đua nhau.
create or replace function public.tool_artifact_demote_or_delete(p_id uuid, p_owner uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_vis text;
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_id::text, ''), 22));
  select t.visibility into v_vis from public.tool_artifacts t where t.id = p_id and t.owner_id = p_owner for update;
  if not found then return 'gone'; end if;
  if exists (select 1 from public.dm_messages m where m.ref_type = 'tool_artifact' and m.ref_key = p_id::text and m.sender_id = p_owner) then
    if v_vis <> 'shared' then update public.tool_artifacts set visibility = 'shared' where id = p_id; end if;
    return 'private';
  end if;
  delete from public.tool_artifacts where id = p_id;
  return 'deleted';
end $$;
comment on function public.tool_artifact_demote_or_delete(uuid, uuid) is 'bms_share_v1: gỡ khỏi cộng đồng — đã gửi DM thì hạ về shared, chưa thì xoá (nội bộ)';
revoke all on function public.tool_artifact_demote_or_delete(uuid, uuid) from public, anon, authenticated;

-- Xoá bài Feed trực tiếp (đường hiện có) dùng CÙNG luật (trước đây: luôn xoá artifact → card Chat đã gửi hỏng)
create or replace function public.tool_artifacts_cleanup_on_post_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.type = 'tool_share' and (old.tool_share ->> 'artifact_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    perform public.tool_artifact_demote_or_delete((old.tool_share ->> 'artifact_id')::uuid, old.author_user_id);
  end if;
  return null;
end $$;

-- RPC cho chủ bài: "Gỡ khỏi cộng đồng". Trả 'private' (artifact còn, chỉ gửi riêng) | 'deleted' (chưa từng gửi → đã xoá). Idempotent.
create or replace function public.social_unpublish_tool_artifact(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_vis text; v_r text;
begin
  if v_me is null or not public.is_class_member() then raise exception 'TS_NOT_MEMBER' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_id::text, ''), 22));
  select t.visibility into v_vis from public.tool_artifacts t where t.id = p_id and t.owner_id = v_me and t.tool = 'bms' and t.kind = 'song' for update;
  if not found then raise exception 'TS_NOT_OWNER' using errcode = '42501'; end if;
  if v_vis = 'shared' then return 'private'; end if;     -- chưa đăng: không có gì để gỡ (KHÔNG xoá bài riêng)
  delete from public.class_posts p where p.type = 'tool_share' and p.author_user_id = v_me and p.tool_share ->> 'artifact_id' = p_id::text;
  v_r := public.tool_artifact_demote_or_delete(p_id, v_me);
  return case when v_r = 'gone' or v_r = 'deleted' then 'deleted' else 'private' end;
end $$;
comment on function public.social_unpublish_tool_artifact(uuid) is 'bms_share_v1: gỡ khỏi cộng đồng (không mặc định xoá artifact)';
revoke all on function public.social_unpublish_tool_artifact(uuid) from public, anon;
grant execute on function public.social_unpublish_tool_artifact(uuid) to authenticated;

notify pgrst, 'reload schema';
