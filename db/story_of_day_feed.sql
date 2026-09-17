-- "1001 Câu chuyện" → Bản tin hôm nay: mỗi ngày một câu chuyện.
-- Idempotent. Yêu cầu: db/home_feed_v2.sql đã chạy; pg_cron + bảng stories có sẵn.
--
-- THIẾT KẾ: hoàn toàn phía server — app (kể cả bản native bundled đã cài) KHÔNG cần
-- đổi code: nó đã đọc home_feed_items và mở in-app theo content_url.
--   · MỘT hàng cố định trong home_feed_items (id bên dưới) được cron ghi đè mỗi 0h VN.
--   · Chọn truyện TẤT ĐỊNH theo ngày: (số ngày) mod (số truyện published) — không cần
--     lưu trạng thái; hết vòng thì quay lại truyện đầu. Truyện mới xuất bản tự vào vòng.
--   · Chỉ ghi các cột NỘI DUNG. published / sort_order / expires_at để Thầy điều khiển
--     ở Admin → Bản tin (ẩn, đổi thứ tự) — cron không bao giờ lật lại.
--   · content_data.source = 'story_of_day' để nhận diện hàng này.

create or replace function public.refresh_story_of_the_day()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  feed_id constant uuid := '5a0f1001-0000-4000-8000-000000000001';
  today   date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  n       int;
  s       record;
  excerpt text;
begin
  select count(*) into n from stories where status = 'published';
  if n = 0 then return; end if;   -- không có truyện → giữ nguyên hàng cũ

  select * into s from stories
   where status = 'published'
   order by published_at, story_number, id
   offset ((today - date '2026-01-01') % n + n) % n
   limit 1;

  -- Trích đoạn: bỏ dòng tiêu đề markdown (#...) và dòng lặp lại tiêu đề, gộp khoảng trắng
  excerpt := regexp_replace(coalesce(s.content, ''), '^\s*#[^\n]*\n?', '', 'gn');
  excerpt := btrim(excerpt);
  if upper(split_part(excerpt, E'\n', 1)) = upper(btrim(s.title)) then
    excerpt := btrim(substr(excerpt, length(split_part(excerpt, E'\n', 1)) + 1));
  end if;
  excerpt := btrim(regexp_replace(excerpt, '\s+', ' ', 'g'));
  if length(excerpt) > 110 then excerpt := left(excerpt, 110) || '…'; end if;

  insert into home_feed_items
    (id, type, kicker, title, summary, icon, tone, thumbnail_url, content_url,
     content_data, open_mode, published, published_at, expires_at, sort_order)
  values
    (feed_id, 'article', '1001 CÂU CHUYỆN', s.title, excerpt, '📖', '#B45309',
     s.photos -> 0 ->> 'url',
     'https://timming.vananhaudio.com/story/' || s.slug,
     jsonb_build_object('source', 'story_of_day', 'story_id', s.id,
                        'story_number', s.story_number, 'day', today),
     'in_app', true, now(), null, 20)
  on conflict (id) do update set
    type          = excluded.type,
    kicker        = excluded.kicker,
    title         = excluded.title,
    summary       = excluded.summary,
    icon          = excluded.icon,
    thumbnail_url = excluded.thumbnail_url,
    content_url   = excluded.content_url,
    content_data  = excluded.content_data,
    open_mode     = excluded.open_mode;
    -- KHÔNG đụng: published, sort_order, expires_at, tone (Thầy chỉnh ở Admin)
end $$;

revoke all on function public.refresh_story_of_the_day() from public, anon, authenticated;

-- 0h giờ Việt Nam = 17:00 UTC
select cron.unschedule(jobid) from cron.job where jobname = 'story-of-the-day';
select cron.schedule('story-of-the-day', '0 17 * * *', $$ select public.refresh_story_of_the_day(); $$);

-- Chạy ngay lần đầu
select public.refresh_story_of_the_day();
