-- PO1.1 — Dữ liệu Demo cho Home Tạp chí "1001 Câu chuyện"
-- Chạy trong Supabase SQL Editor (project: wojmdilyflffvdtpovmq)
-- Tạo 8 câu chuyện mẫu để Home không trống.
-- Sau này thay bằng dữ liệu thật từ cộng đồng.

do $$
declare
  v_user_id uuid;
begin
  -- Lấy user_id của admin/teacher đầu tiên làm tác giả demo
  select id into v_user_id from public.app_users where role in ('admin','teacher') limit 1;
  if v_user_id is null then
    select id into v_user_id from public.app_users limit 1;
  end if;
  if v_user_id is null then
    raise exception 'Không tìm thấy user nào trong app_users để gán demo stories.';
  end if;

  -- ── 1 ──
  insert into public.stories (user_id, status, title, slug, pen_name, location, content, photos, story_number, published_at, created_at, updated_at, conversation, topic)
  values (v_user_id, 'published',
    'Cây đàn gỗ cũ của ông ngoại',
    'cay-dan-go-cu-cua-ong-ngoai',
    'Minh', 'Hà Nội',
    E'Tôi bắt đầu với cây đàn guitar cũ của ông ngoại — một cây đàn gỗ đã ngả màu, dây rỉ, action cao đến mức bấm đau tay. Nhưng đó là cây đàn duy nhất tôi có.\n\nHồi đó nhà nghèo, không có tiền mua đàn mới. Ông ngoại bảo: "Đàn cũ nhưng tiếng vẫn hay, quan trọng là người đánh." Tôi tập trên cây đàn đó suốt 3 năm, đến khi ngón tay chai cứng.\n\nGiờ tôi đã đổi nhiều cây đàn khác, nhưng cây đàn của ông vẫn nằm ở góc phòng. Mỗi lần nhìn nó, tôi lại nhớ những buổi chiều ông ngồi nghe tôi tập, gật gù khen "tiến bộ rồi đấy."',
    '[]'::jsonb, null,
    '2026-06-15 08:00:00+07', '2026-06-15 08:00:00+07', '2026-06-15 08:00:00+07',
    '[]'::jsonb, 'cay-dan-dau-tien'
  )
on conflict (slug) do update set status = 'published', published_at = excluded.published_at, content = excluded.content;

  -- ── 2 ──
  insert into public.stories (user_id, status, title, slug, pen_name, location, content, photos, story_number, published_at, created_at, updated_at, conversation, topic)
  values (v_user_id, 'published',
    '10 năm tôi không đụng vào cây đàn',
    '10-nam-toi-khong-dung-vao-cay-dan',
    'Hoàng', 'Đà Nẵng',
    E'Mười năm. Từ lúc ra trường đến lúc 35 tuổi, tôi không một lần chạm vào cây đàn. Công việc, gia đình, con cái — cuộc sống cuốn tôi đi.\n\nMột hôm tình cờ nghe lại bài "Yesterday" trên radio lúc kẹt xe. Tự nhiên nước mắt chảy ra. Về nhà, tôi lôi cây đàn cũ trong kho ra, lau bụi, thay dây. Ngón tay đau vì lâu không tập, nhưng cảm giác thật lạ — như gặp lại người bạn cũ.\n\nTôi không tập để giỏi. Tôi tập vì nhớ. Và vì tôi nhận ra mình đã bỏ quên một phần của chính mình suốt 10 năm qua.',
    '[]'::jsonb, null,
    '2026-06-22 14:30:00+07', '2026-06-22 14:30:00+07', '2026-06-22 14:30:00+07',
    '[]'::jsonb, 'bo-do-roi-quay-lai'
  )
on conflict (slug) do update set status = 'published', published_at = excluded.published_at, content = excluded.content;

  -- ── 3 ──
  insert into public.stories (user_id, status, title, slug, pen_name, location, content, photos, story_number, published_at, created_at, updated_at, conversation, topic)
  values (v_user_id, 'published',
    'Tôi bắt đầu học guitar ở tuổi 42',
    'toi-bat-dau-hoc-guitar-o-tuoi-42',
    'Chị Hương', 'TP.HCM',
    E'Bốn mươi hai tuổi. Các con đã lớn. Công việc ổn định. Tôi tự hỏi: "Mình còn muốn làm gì cho bản thân?"\n\nTôi đăng ký một lớp guitar gần nhà. Buổi đầu tiên, tôi là người lớn tuổi nhất lớp. Mấy đứa nhỏ nhìn tôi hơi lạ. Nhưng tôi kệ.\n\nNgón tay cứng, học chậm, quên nốt liên tục. Nhưng mỗi lần bấm được một hợp âm mới, tôi thấy vui như hồi còn đi học. Sau 6 tháng, tôi đàn được bài "Bèo dạt mây trôi" — bài hát mẹ tôi thích nhất.\n\nChưa bao giờ là quá muộn để bắt đầu một điều mới.',
    '[]'::jsonb, null,
    '2026-07-01 10:00:00+07', '2026-07-01 10:00:00+07', '2026-07-01 10:00:00+07',
    '[]'::jsonb, 'guitar-trong-gia-dinh'
  )
on conflict (slug) do update set status = 'published', published_at = excluded.published_at, content = excluded.content;

  -- ── 4 ──
  insert into public.stories (user_id, status, title, slug, pen_name, location, content, photos, story_number, published_at, created_at, updated_at, conversation, topic)
  values (v_user_id, 'published',
    'Mỗi tối tôi đàn cho con gái nghe',
    'moi-toi-toi-dan-cho-con-gai-nghe',
    'Anh Tuấn', 'Hải Phòng',
    E'Con gái tôi 4 tuổi. Mỗi tối trước khi ngủ, nó đòi bố đàn cho nghe. Tôi chỉ biết vài bài đơn giản — "Chúc bé ngủ ngon", "Bắc kim thang", mấy bài thiếu nhi vòng hòa thanh cơ bản. Nhưng với con bé, bố là nghệ sĩ guitar hay nhất thế giới.\n\nCó hôm tôi mệt, định bỏ một buổi. Con bé khóc. Từ đó, tối nào tôi cũng đàn. Nhiều khi chỉ 10 phút, nhưng đều đặn.\n\nKhông biết sau này con có nhớ không. Nhưng tôi thì sẽ nhớ mãi — những đêm con ôm gối, mắt lim dim, miệng cười khi nghe bố đàn.',
    '[]'::jsonb, null,
    '2026-07-08 20:00:00+07', '2026-07-08 20:00:00+07', '2026-07-08 20:00:00+07',
    '[]'::jsonb, 'guitar-trong-gia-dinh'
  )
on conflict (slug) do update set status = 'published', published_at = excluded.published_at, content = excluded.content;

  -- ── 5 ──
  insert into public.stories (user_id, status, title, slug, pen_name, location, content, photos, story_number, published_at, created_at, updated_at, conversation, topic)
  values (v_user_id, 'published',
    'Lần đầu tôi đứng trên sân khấu',
    'lan-dau-toi-dung-tren-san-khau',
    'Khánh', 'Cần Thơ',
    E'Hồi cấp 3, trường tổ chức văn nghệ. Lớp tôi không ai chơi được nhạc cụ gì, nên tôi bị "đẩy" lên — dù mới học guitar được 3 tháng.\n\nBài tôi chọn là "Mưa hồng" của Trịnh Công Sơn. Tuần trước khi diễn, tôi tập ngày tập đêm, đến nỗi mẹ phải la vì hàng xóm kêu ồn. Hôm diễn, tay tôi run đến mức suýt đánh rơi pick. Intro đàn sai một nốt. Nhưng đoạn điệp khúc thì ổn.\n\nKhi cả trường vỗ tay, tôi không tin đó là sự thật. Tôi chưa bao giờ nghĩ mình có thể đứng trên sân khấu. Hôm đó tôi hiểu: đôi khi điều quan trọng không phải là chơi hay, mà là dám bước lên.',
    '[]'::jsonb, null,
    '2026-07-12 16:00:00+07', '2026-07-12 16:00:00+07', '2026-07-12 16:00:00+07',
    '[]'::jsonb, 'lan-dau-dan-truoc-moi-nguoi'
  )
on conflict (slug) do update set status = 'published', published_at = excluded.published_at, content = excluded.content;

  -- ── 6 ──
  insert into public.stories (user_id, status, title, slug, pen_name, location, content, photos, story_number, published_at, created_at, updated_at, conversation, topic)
  values (v_user_id, 'published',
    'Tôi không có năng khiếu — nhưng tôi vẫn học',
    'toi-khong-co-nang-khieu',
    'Mai', 'Huế',
    E'Tôi không có năng khiếu âm nhạc. Thật sự. Tôi không phân biệt được nốt cao nốt thấp, không cảm được nhịp, đàn lúc nào cũng sai. Bạn bè nói: "Mày bỏ đi, học làm gì cho khổ."\n\nNhưng tôi vẫn học. Mỗi ngày 30 phút. Chỉ tập đi tập lại mấy vòng hòa thanh cơ bản. Sau một năm, tôi đàn được bài "Happy Birthday" — không hay, nhưng đúng nốt.\n\nNgày sinh nhật mẹ, tôi đàn bài đó. Mẹ khóc. Không phải vì tôi đàn hay — mà vì mẹ biết tôi đã cố gắng thế nào.\n\nCó những thứ không cần năng khiếu. Chỉ cần không bỏ cuộc.',
    '[]'::jsonb, null,
    '2026-07-18 09:00:00+07', '2026-07-18 09:00:00+07', '2026-07-18 09:00:00+07',
    '[]'::jsonb, 'vuot-qua-kho-khan'
  )
on conflict (slug) do update set status = 'published', published_at = excluded.published_at, content = excluded.content;

  -- ── 7 ──
  insert into public.stories (user_id, status, title, slug, pen_name, location, content, photos, story_number, published_at, created_at, updated_at, conversation, topic)
  values (v_user_id, 'published',
    '15 phút mỗi ngày — điều nhỏ bé tôi giữ được',
    '15-phut-moi-ngay',
    'Phúc', 'Bình Dương',
    E'Tôi là nhân viên văn phòng. Ngày làm 10 tiếng, tối về mệt rã rời. Làm sao có thời gian học đàn?\n\nRồi tôi quyết định: chỉ 15 phút thôi. Tan làm, trước khi về nhà, tôi ngồi lại văn phòng 15 phút (có cây đàn mini để trong ngăn bàn). Không điện thoại, không email. Chỉ tôi và cây đàn.\n\nNgày đầu thấy 15 phút dài vô tận. Ngày thứ 30, tôi nhận ra mình đã đàn được một bài hoàn chỉnh. Ngày thứ 100, đồng nghiệp bắt đầu đứng ngoài cửa nghe.\n\n15 phút không nhiều. Nhưng 15 phút x 365 ngày = hơn 90 giờ. Đủ để thay đổi một điều gì đó.',
    '[]'::jsonb, null,
    '2026-07-22 18:30:00+07', '2026-07-22 18:30:00+07', '2026-07-22 18:30:00+07',
    '[]'::jsonb, 'vuot-qua-kho-khan'
  )
on conflict (slug) do update set status = 'published', published_at = excluded.published_at, content = excluded.content;

  -- ── 8 ──
  insert into public.stories (user_id, status, title, slug, pen_name, location, content, photos, story_number, published_at, created_at, updated_at, conversation, topic)
  values (v_user_id, 'published',
    'Cây đàn và người bạn tôi đã mất',
    'cay-dan-va-nguoi-ban-toi-da-mat',
    'Lan', 'Nha Trang',
    E'Năm lớp 11, tôi và Quân cùng học guitar. Mỗi chiều thứ 7, hai đứa ra công viên tập, đàn sai tè le mà vẫn cười như điên. Quân bảo: "Sau này tao với mày mở một quán cà phê, tối tối ngồi đàn cho khách nghe."\n\nNăm lớp 12, Quân bị tai nạn. Không qua khỏi.\n\nSuốt một năm sau đó, tôi không đụng vào cây đàn. Mỗi lần nhìn nó là nhớ Quân. Rồi một hôm, tôi lấy đàn ra, đánh lại bài "Ướt mi" — bài cuối cùng tụi tôi tập với nhau. Lần đầu tiên tôi khóc khi chơi đàn.\n\nGiờ tôi vẫn đàn. Mỗi lần đàn là mỗi lần nhớ Quân. Nhưng không còn buồn nữa — chỉ thấy biết ơn vì đã có một người bạn như thế.',
    '[]'::jsonb, null,
    '2026-07-26 07:00:00+07', '2026-07-26 07:00:00+07', '2026-07-26 07:00:00+07',
    '[]'::jsonb, 'cay-dan-dau-tien'
  )
on conflict (slug) do update set status = 'published', published_at = excluded.published_at, content = excluded.content;

  raise notice '✅ Done — 8 demo stories inserted for user %', v_user_id;
end $$;
