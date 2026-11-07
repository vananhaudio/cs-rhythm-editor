-- TEST-ONLY (DB tạm, KHÔNG production): dữ liệu xem tay Feed Comments A–D trên iPhone. Chạy SAU feed_comments_v2 + paging_v1 + safety.
-- Người: A (An · chủ bài), B, C, T (Thầy). Mọi tài khoản @test.local. Bình luận chèn trực tiếp (seq theo thứ tự ghi).
do $$
declare
  u uuid[] := array['aaaaaaaa-0000-4000-8000-00000000000a','bbbbbbbb-0000-4000-8000-00000000000b','cccccccc-0000-4000-8000-00000000000c','dddddddd-0000-4000-8000-00000000000d']::uuid[];
  post_big constant uuid := '00000000-fa00-4000-8000-000000000002';
  post_small constant uuid := '00000000-fa00-4000-8000-000000000001';
  thr constant uuid := '00000000-fb00-4000-8000-000000000001';
  pub constant uuid := 'd1111111-0000-4000-8000-000000000001';
  i int; r uuid; r2 uuid; ts timestamptz;
begin
  if exists (select 1 from auth.users where email not like '%@test.local') then raise exception 'DỪNG: có user thật'; end if;
  -- Bài Social NHIỀU bình luận (nằm trên cùng Feed)
  insert into public.class_posts (id, author_user_id, type, audience, body, created_at)
    values (post_big, u[1], 'practice', 'class', '📌 THỬ BÌNH LUẬN NHIỀU (Social): 120 bình luận gốc, có trả lời và trả lời lồng', now() - interval '30 seconds')
    on conflict (id) do nothing;
  insert into public.class_post_comments (post_id, author_user_id, body) values (post_small, u[2], 'POSTCMT của B') on conflict do nothing;
  for i in 1..120 loop
    ts := now() - make_interval(mins => 130 - i);
    r := gen_random_uuid();
    insert into public.class_post_comments (id, post_id, author_user_id, body, created_at, updated_at)
      values (r, post_big, u[1 + (i % 3)], format('Gốc #%s — bình luận thứ %s của bài Social', i, i), ts, ts);
    if i % 6 = 0 then
      r2 := gen_random_uuid();
      insert into public.class_post_comments (id, post_id, parent_comment_id, author_user_id, body, created_at, updated_at)
        values (r2, post_big, r, u[2], format('↳ Trả lời cho gốc #%s', i), ts + interval '20 seconds', ts + interval '20 seconds');
      if i % 12 = 0 then
        insert into public.class_post_comments (post_id, parent_comment_id, author_user_id, body, created_at, updated_at)
          values (post_big, r2, u[3], format('↳↳ Trả lời của trả lời (gốc #%s)', i), ts + interval '40 seconds', ts + interval '40 seconds');
      end if;
    end if;
  end loop;
  -- Learning Thread (thẻ Thread): 70 gốc + trả lời
  for i in 1..70 loop
    ts := now() - make_interval(mins => 100 - i);
    r := gen_random_uuid();
    insert into public.feed_comments (id, target_kind, target_id, author_user_id, body, created_at)
      values (r, 'learning_thread', thr, u[1 + (i % 4)], format('Thread gốc #%s', i), ts);
    if i % 5 = 0 then
      insert into public.feed_comments (target_kind, target_id, parent_comment_id, author_user_id, body, created_at)
        values ('learning_thread', thr, r, u[2], format('↳ Trả lời Thread #%s', i), ts + interval '15 seconds'),
               ('learning_thread', thr, r, u[3], format('↳ Trả lời thứ hai Thread #%s', i), ts + interval '30 seconds');
    end if;
  end loop;
  -- Bài TeamLab đã xuất bản: 55 gốc + trả lời
  for i in 1..55 loop
    ts := now() - make_interval(mins => 90 - i);
    r := gen_random_uuid();
    insert into public.feed_comments (id, target_kind, target_id, author_user_id, body, created_at)
      values (r, 'teamlab_publication', pub, u[1 + (i % 4)], format('TeamLab gốc #%s', i), ts);
    if i % 7 = 0 then
      insert into public.feed_comments (target_kind, target_id, parent_comment_id, author_user_id, body, created_at)
        values ('teamlab_publication', pub, r, u[4], format('↳ Trả lời TeamLab #%s', i), ts + interval '15 seconds');
    end if;
  end loop;
end $$;
