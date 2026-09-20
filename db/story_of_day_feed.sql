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
--   · content_data.body = TOÀN VĂN truyện, content_url = NULL ⇒ app render thẳng chữ
--     trong overlay, KHÔNG iframe, KHÔNG dựng Supabase client thứ hai (xem ghi chú dài
--     ở phần insert). Ảnh đại diện vẫn hiện trên thẻ bản tin qua thumbnail_url.

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
  body    text;
begin
  select count(*) into n from stories where status = 'published';
  if n = 0 then return; end if;   -- không có truyện → giữ nguyên hàng cũ

  select * into s from stories
   where status = 'published'
   order by published_at, story_number, id
   offset ((today - date '2026-01-01') % n + n) % n
   limit 1;

  -- TOÀN VĂN (body): bỏ dòng tiêu đề markdown (#...) và dòng lặp lại tiêu đề,
  -- nhưng GIỮ NGUYÊN xuống dòng — renderer chữ của app tách đoạn theo dòng trống.
  body := regexp_replace(coalesce(s.content, ''), '^\s*#[^\n]*\n?', '', 'gn');
  body := btrim(body);
  if upper(split_part(body, E'\n', 1)) = upper(btrim(s.title)) then
    body := btrim(substr(body, length(split_part(body, E'\n', 1)) + 1));
  end if;

  -- Trích đoạn cho thẻ ngoài bản tin: gộp khoảng trắng, cắt 110 ký tự.
  excerpt := btrim(regexp_replace(body, '\s+', ' ', 'g'));
  if length(excerpt) > 110 then excerpt := left(excerpt, 110) || '…'; end if;

  insert into home_feed_items
    (id, type, kicker, title, summary, icon, tone, thumbnail_url, content_url,
     content_data, open_mode, published, published_at, expires_at, sort_order)
  values
    (feed_id, 'article', '1001 CÂU CHUYỆN', s.title, excerpt, '📖', '#B45309',
     s.photos -> 0 ->> 'url',
     -- content_url PHẢI LÀ NULL. Renderer chữ của app (FeedOverlay: `isText = !url && !!body`)
     -- chỉ chạy khi KHÔNG có URL — lúc đó truyện hiện thẳng trong overlay, mở tức thì.
     --
     -- ĐỪNG đặt URL trở lại, bằng bất kỳ dạng nào:
     --  · URL tuyệt đối (timming.vananhaudio.com) ⇒ iframe tải LẠI toàn bộ SPA (~4,4MB JS)
     --    qua mạng, boot React lần 2 ⇒ chờ lâu, màn đen, có khi bị iOS thu hồi webview.
     --  · Đường dẫn tương đối (/story/<slug>) ⇒ iframe chạy app lần 2 TRONG CÙNG ORIGIN
     --    https://localhost. Trong WKWebView, iframe vẫn thấy webkit.messageHandlers.bridge
     --    nên Capacitor.isNativePlatform() = true ⇒ supabase.ts dựng GoTrueClient THỨ HAI
     --    cùng storageKey. Hai client tranh nhau một refresh token (Supabase xoay vòng,
     --    dùng một lần) ⇒ một bên nhận 'Invalid Refresh Token' và tự đăng xuất ⇒ AppRouter
     --    setUser(null) ⇒ cả portal bị tháo, overlay "nháy lên rồi tắt" + mất đăng nhập.
     --    (Đo thực tế trong app: IFRAME bridge=true cap=true native=true plat=ios.)
     null,
     jsonb_build_object('source', 'story_of_day', 'story_id', s.id,
                        'story_number', s.story_number, 'day', today,
                        -- TOÀN VĂN đi kèm bản tin: app không phải tải gì thêm khi mở.
                        'body', body, 'slug', s.slug),
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
