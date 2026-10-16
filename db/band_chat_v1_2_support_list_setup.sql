-- BAND CHAT V1.2 — Thầy/Admin thấy MỌI Band hiện có ở mục Hỗ trợ (chỉ đọc), kể cả Band chưa có phòng/chưa có tin.
-- Trước đó danh sách hỗ trợ chỉ gồm nhóm đã có tin (bandchat_rooms.last_seq > 0) nên chỉ hiện 2 Band.
-- Chỉ CREATE OR REPLACE bandchat_rooms (cùng chữ ký/grant) — không bảng, không dữ liệu, không tạo phòng hàng loạt.
-- Chạy bằng scripts/prod-db.py (một transaction; KHÔNG begin/commit). Idempotent. Quyền vẫn do bandchat_access quyết ở backend.

do $gate$
begin
  if to_regprocedure('public.bandchat_rooms(int)') is null or to_regprocedure('public.bandchat_access(uuid)') is null then
    raise exception 'DỪNG — chưa cài Band Chat V1';
  end if;
end $gate$;

-- Các nhóm Band của mình (mới nhất trước; nhóm chưa có tin xếp sau). Tên/ảnh lấy từ Band hiện hành.
-- Thầy/Admin thêm MỌI Band hiện có của TeamLab họ KHÔNG thuộc (support = true; chỉ xem, không tính chưa đọc), kể cả Band chưa có
-- phòng/chưa có tin (V1.2) + các nhóm còn tin của Band đã bị xoá. Không tạo phòng để hiển thị.
create or replace function public.bandchat_rooms(p_limit int default 50)
returns table(band_id uuid, band_name text, cover_path text, project_id uuid, project_name text, project_avatar_path text,
              last_seq bigint, last_body text, last_sender_name text, last_mine boolean, last_at timestamptz,
              unread int, member_count int, can_send boolean, archived boolean, support boolean)
language plpgsql security definer set search_path = '' stable as $$
declare v_me uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 50), 1), 100); v_teacher boolean;
begin
  if v_me is null then raise exception 'Chưa đăng nhập' using errcode = '42501'; end if;
  v_teacher := public.is_teacher();
  return query
  select c.band_id, coalesce(b.name, r.name_snapshot, 'Band đã xoá'), b.cover_path, p.id, p.name, p.avatar_path,
         coalesce(r.last_seq, 0), left(lm.body, 160),
         (select i.name from public.class_public_identity(lm.sender_id) i where lm.sender_id is not null),
         (lm.sender_id = v_me), r.last_message_at,
         case when mem.is_member then
           greatest(coalesce(r.last_seq, 0) - coalesce(rd.last_read_seq,
             (select coalesce(max(x.seq), 0) from public.bandchat_messages x where x.band_id = c.band_id and x.created_at <= coalesce(me.created_at, now()))), 0)::int
         else 0 end,
         (select count(*)::int from public.teamlab_band_members k where k.band_id = c.band_id),
         (acc.a = 'send'), (r.archived_at is not null), not mem.is_member
    from (select m.band_id from public.teamlab_band_members m where m.user_id = v_me
          union select f.band_id from public.bandchat_frozen f where f.user_id = v_me
          union select tb.id from public.teamlab_bands tb where v_teacher
          union select rr.band_id from public.bandchat_rooms rr where v_teacher and rr.last_seq > 0) c
    cross join lateral (select public.bandchat_access(c.band_id) a) acc
    left join public.teamlab_bands b on b.id = c.band_id
    left join public.projects p on p.id = b.project_id
    left join public.bandchat_rooms r on r.band_id = c.band_id
    left join public.teamlab_band_members me on me.band_id = c.band_id and me.user_id = v_me
    left join public.bandchat_reads rd on rd.band_id = c.band_id and rd.user_id = v_me
    cross join lateral (select (me.user_id is not null or exists (select 1 from public.bandchat_frozen f2 where f2.band_id = c.band_id and f2.user_id = v_me)) is_member) mem
    left join lateral (select x.body, x.sender_id from public.bandchat_messages x where x.band_id = c.band_id and x.seq = r.last_seq) lm on true
   where acc.a is not null
   order by r.last_message_at desc nulls last, 2, c.band_id
   limit v_lim;
end $$;
comment on function public.bandchat_rooms(int) is 'bandchat_v1: các nhóm Band của mình (+ mọi Band cho Thầy/Admin ở chế độ hỗ trợ)';
revoke all on function public.bandchat_rooms(int) from public, anon;
grant execute on function public.bandchat_rooms(int) to authenticated;
