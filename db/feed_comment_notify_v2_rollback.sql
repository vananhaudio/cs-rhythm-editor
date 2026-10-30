-- Rollback Feed Comment Notify V2: trả feed_comment_notify về bản Feed Comments V2 (chỉ thread), gỡ trigger bài Social,
-- XOÁ các thông báo ref_type 'post'/'teamlab_publication' rồi mới thu hẹp lại ràng buộc ref. Revert frontend TRƯỚC.
-- Không đụng feed_comments / class_post_comments / thông báo thread. Idempotent.
drop trigger if exists class_post_comment_notify on public.class_post_comments;
drop function if exists public.class_post_comment_notify();
create or replace function public.feed_comment_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  if new.target_kind <> 'learning_thread' or new.hidden_at is not null then return new; end if;
  begin
    select t.learner_user_id into v_owner from public.learning_threads t
     where t.id = new.target_id and t.hidden_at is null and t.archived_at is null and t.visibility = 'community';
    if v_owner is null or v_owner = new.author_user_id then return new; end if;
    insert into public.class_system_notices (user_id, kind, body, ref_type, ref_key, dedupe_key)
    values (v_owner, 'feed_comment', 'Có bình luận mới trên bài của bạn.', 'thread', new.target_id::text,
            'fc:' || new.target_id::text || ':' || new.author_user_id::text || ':' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'))
    on conflict (user_id, dedupe_key) do nothing;
  exception when others then
    raise warning 'feed_comment_notify: bỏ qua thông báo (comment %, SQLSTATE %)', new.id, sqlstate;
  end;
  return new;
end $$;
revoke all on function public.feed_comment_notify() from public, anon, authenticated;
delete from public.class_system_notices where ref_type in ('post', 'teamlab_publication');
alter table public.class_system_notices drop constraint if exists class_system_notices_ref_check;
alter table public.class_system_notices add constraint class_system_notices_ref_check
  check (ref_type = 'thread' and ref_key ~ '^[0-9a-f-]{36}$');
