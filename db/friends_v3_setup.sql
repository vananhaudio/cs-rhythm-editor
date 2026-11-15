-- FRIENDS V3 — tìm kiếm người dùng (có dấu/không dấu) + gợi ý kết bạn, theo mô hình Facebook Friends.
-- Chạy bằng scripts/prod-db.py (một transaction; file KHÔNG có begin/commit). Idempotent. ADDITIVE:
--   • KHÔNG sửa/xoá hàng friendships, không đổi bảng/hàm/policy nào đang có; cổng cuối so dấu vân tay friendships trước/sau.
--   • Chỉ thêm RPC ĐỌC (stable, SECURITY DEFINER, auth.uid()); kết bạn/huỷ/xác nhận vẫn dùng RPC cũ (send_friend_request, unfriend, respond_friend_request).
--   • Nhắn tin dùng nguyên Chat V1 (dm_start/dm_rule: chỉ bạn accepted) — không đổi.
-- Dữ liệu dùng (không suy đoán quan hệ): thành viên Class (như get_user_profile), lớp CÙNG (tva_private.class_memberships,
--   bỏ lớp huỷ/gộp/nháp), Band CÙNG (teamlab_band_members), bạn chung (friendships accepted). Người chặn nhau KHÔNG hiện.
-- Hàm mới: friends_fold (nội bộ) · friends_ctx (nội bộ) · friend_search(text,int) · friend_suggestions(int)

do $gate$
declare v_fp text;
begin
  if to_regclass('public.friendships') is null or to_regclass('public.teamlab_band_members') is null
     or to_regclass('public.teamlab_bands') is null or to_regclass('public.projects') is null
     or to_regclass('tva_private.class_memberships') is null or to_regclass('public.class_schedule') is null then
    raise exception 'DỪNG — thiếu bảng nền (friendships / teamlab_band_members / teamlab_bands / projects / class_memberships / class_schedule)';
  end if;
  if to_regprocedure('public.class_ugc_pair_blocked(uuid,uuid)') is null or to_regprocedure('public.friendship_status(uuid)') is null
     or to_regprocedure('public.class_public_identity(uuid)') is null or to_regprocedure('public.is_class_member_user(uuid)') is null then
    raise exception 'DỪNG — thiếu hàm nền (class_ugc_pair_blocked / friendship_status / class_public_identity / is_class_member_user)';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
              where s.nspname = 'public' and p.proname in ('friends_fold', 'friends_ctx', 'friend_search', 'friend_suggestions')
                and coalesce(obj_description(p.oid, 'pg_proc'), '') not like 'friends_v3:%') then
    raise exception 'DỪNG — đã có hàm cùng tên không thuộc Friends V3';
  end if;
  select count(*)::text || ':' || md5(coalesce(string_agg(f.id::text || f.requester_id::text || f.addressee_id::text || f.status
           || f.created_at::text || coalesce(f.responded_at::text, '-'), ',' order by f.id), '')) into v_fp from public.friendships f;
  perform set_config('friends_v3.fingerprint', v_fp, true);
end $gate$;

-- 1) Chuẩn hoá tên để so khớp không dấu (đ→d, bỏ dấu tiếng Việt, chữ thường). Không phụ thuộc extension unaccent / locale.
create or replace function public.friends_fold(p text)
returns text language sql immutable set search_path = '' as $$
  select lower(translate(normalize(coalesce(p, ''), NFC), 'àáảãạăằắẳẵặâầấẩẫậÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬèéẻẽẹêềếểễệÈÉẺẼẸÊỀẾỂỄỆìíỉĩịÌÍỈĨỊòóỏõọôồốổỗộơờớởỡợÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢùúủũụưừứửữựÙÚỦŨỤƯỪỨỬỮỰỳýỷỹỵỲÝỶỸỴđĐ', 'aaaaaaaaaaaaaaaaaAAAAAAAAAAAAAAAAAeeeeeeeeeeeEEEEEEEEEEEiiiiiIIIIIoooooooooooooooooOOOOOOOOOOOOOOOOOuuuuuuuuuuuUUUUUUUUUUUyyyyyYYYYYdD'))
$$;
comment on function public.friends_fold(text) is 'friends_v3: chuẩn hoá tên không dấu (nội bộ)';
revoke all on function public.friends_fold(text) from public, anon, authenticated;

-- 2) Ngữ cảnh quan hệ của MỌI thành viên Class khác với người đang đăng nhập (nội bộ; không chặn/không tự thêm quan hệ nào)
create or replace function public.friends_ctx()
returns table(user_id uuid, name text, avatar_url text, role text, relationship text,
              mutual_count int, same_class boolean, same_band boolean, class_label text, band_label text)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as uid),
  mine as (   -- bạn (accepted) của mình
    select case when f.requester_id = (select uid from me) then f.addressee_id else f.requester_id end as uid
    from public.friendships f
    where f.status = 'accepted' and (select uid from me) in (f.requester_id, f.addressee_id)),
  my_classes as (
    select m.class_id from tva_private.class_memberships m
    join public.class_schedule cs on cs.id = m.class_id
    where m.user_id = (select uid from me) and coalesce(cs.status, '') not in ('cancelled', 'merged', 'draft')),
  class_peers as (
    select m.user_id as uid, min(cs.name) as label from tva_private.class_memberships m
    join public.class_schedule cs on cs.id = m.class_id
    where m.class_id in (select class_id from my_classes) group by m.user_id),
  band_peers as (
    select bm.user_id as uid, min(p.name) as label from public.teamlab_band_members bm
    join public.teamlab_bands b on b.id = bm.band_id
    left join public.projects p on p.id = b.project_id
    where bm.band_id in (select x.band_id from public.teamlab_band_members x where x.user_id = (select uid from me))
    group by bm.user_id),
  cand as (
    select es.user_id as uid from public.edu_students es where es.user_id is not null
    union select au.id from public.app_users au where au.role in ('teacher', 'admin'))
  select c.uid, idn.name, idn.avatar_url, idn.role, public.friendship_status(c.uid),
         (select count(*)::int from mine m join public.friendships f2 on f2.status = 'accepted'
            and ((f2.requester_id = m.uid and f2.addressee_id = c.uid) or (f2.addressee_id = m.uid and f2.requester_id = c.uid))),
         cp.uid is not null, bp.uid is not null, cp.label, bp.label
  from cand c
  cross join lateral public.class_public_identity(c.uid) idn
  left join class_peers cp on cp.uid = c.uid
  left join band_peers bp on bp.uid = c.uid
  where public.is_class_member() and c.uid <> (select uid from me)
    and not public.class_ugc_pair_blocked((select uid from me), c.uid);
$$;
comment on function public.friends_ctx() is 'friends_v3: ngữ cảnh quan hệ (nội bộ)';
revoke all on function public.friends_ctx() from public, anon, authenticated;

-- 3) Tìm theo tên: mọi từ khoá phải có trong tên (không dấu, không phân biệt hoa/thường). Tối thiểu 2 ký tự.
create or replace function public.friend_search(p_query text, p_limit int default 20)
returns table(user_id uuid, name text, avatar_url text, role text, relationship text,
              mutual_count int, same_class boolean, same_band boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_q text; v_lim int := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if auth.uid() is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  v_q := btrim(regexp_replace(public.friends_fold(left(coalesce(p_query, ''), 80)), '\s+', ' ', 'g'));
  if length(v_q) < 2 then return; end if;
  return query
  select x.user_id, x.name, x.avatar_url, x.role, x.relationship, x.mutual_count, x.same_class, x.same_band
  from public.friends_ctx() x
  where not exists (select 1 from unnest(string_to_array(v_q, ' ')) tk
                    where tk <> '' and position(tk in public.friends_fold(x.name)) = 0)
  order by (public.friends_fold(x.name) like v_q || '%') desc,
           (x.relationship = 'friends') desc, (x.same_class or x.same_band) desc, x.mutual_count desc, x.name, x.user_id
  limit v_lim;
end $$;
comment on function public.friend_search(text, int) is 'friends_v3: tìm thành viên Class theo tên (có dấu/không dấu)';
revoke all on function public.friend_search(text, int) from public, anon;
grant execute on function public.friend_search(text, int) to authenticated;

-- 4) Gợi ý: CHỈ người cùng lớp / cùng Band / có bạn chung; chưa có quan hệ nào; không phải Thầy.
create or replace function public.friend_suggestions(p_limit int default 20)
returns table(user_id uuid, name text, avatar_url text, role text, reason text, shared_label text, mutual_count int)
language plpgsql stable security definer set search_path = '' as $$
declare v_lim int := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if auth.uid() is null or not public.is_class_member() then raise exception 'Chưa đăng nhập Class' using errcode = '42501'; end if;
  return query
  select x.user_id, x.name, x.avatar_url, x.role,
         case when x.same_class then 'class' when x.same_band then 'band' else 'mutual' end,
         case when x.same_class then x.class_label when x.same_band then x.band_label else null end,
         x.mutual_count
  from public.friends_ctx() x
  where x.relationship = 'none' and x.role <> 'teacher' and (x.same_class or x.same_band or x.mutual_count > 0)
  order by (case when x.same_class then 100 else 0 end + case when x.same_band then 50 else 0 end + least(x.mutual_count, 20) * 2) desc,
           x.name, x.user_id
  limit v_lim;
end $$;
comment on function public.friend_suggestions(int) is 'friends_v3: gợi ý kết bạn (cùng lớp, cùng Band, bạn chung)';
revoke all on function public.friend_suggestions(int) from public, anon;
grant execute on function public.friend_suggestions(int) to authenticated;

-- 5) Cổng cuối: không đụng hàng friendships nào
do $after$
declare v_now text := (select count(*)::text || ':' || md5(coalesce(string_agg(f.id::text || f.requester_id::text || f.addressee_id::text || f.status
           || f.created_at::text || coalesce(f.responded_at::text, '-'), ',' order by f.id), '')) from public.friendships f);
begin
  if v_now is distinct from current_setting('friends_v3.fingerprint', true) then
    raise exception 'DỪNG — dữ liệu friendships đổi trong migration';
  end if;
end $after$;

notify pgrst, 'reload schema';
