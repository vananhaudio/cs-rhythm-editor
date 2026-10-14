-- TEST-ONLY: 3 Song — 2 đã xuất bản (một có Band + bìa, một không Band), 1 đã gỡ. Mốc published_at tăng dần.
insert into public.projects (id, name, cover_path, avatar_path, public_slug) values
  ('11111111-2222-4333-8444-555555555555', 'Team Mưa Thu', '11111111-2222-4333-8444-555555555555/cover-1700000000-ab12cd34.jpg', '11111111-2222-4333-8444-555555555555/a-1.jpg', 'mua-thu-band-1a2b3'),
  ('11111111-2222-4333-8444-666666666666', 'Team Gió', null, null, null);
insert into public.teamlab_bands (id, name) values ('bb111111-0000-4000-8000-000000000001', 'Mưa Thu Band');
insert into public.teams (id, name, band_id, project_id) values
  ('c1111111-0000-4000-8000-000000000001', 'Đêm nàng giả bạn', 'bb111111-0000-4000-8000-000000000001', '11111111-2222-4333-8444-555555555555'),
  ('c1111111-0000-4000-8000-000000000002', 'Bài của Gió', null, '11111111-2222-4333-8444-666666666666'),
  ('c1111111-0000-4000-8000-000000000003', 'Bài đã gỡ', null, '11111111-2222-4333-8444-666666666666'),
  ('c1111111-0000-4000-8000-000000000004', 'Mùa thu cho em', null, '11111111-2222-4333-8444-666666666666');
insert into public.teamlab_publications (id, project_id, song_id, status, published_at, public_slug) values
  ('d1111111-0000-4000-8000-000000000001', '11111111-2222-4333-8444-555555555555', 'c1111111-0000-4000-8000-000000000001', 'published', now() - interval '1 hour', 'dem-nang-gia-ban'),
  ('d1111111-0000-4000-8000-000000000002', '11111111-2222-4333-8444-666666666666', 'c1111111-0000-4000-8000-000000000002', 'published', now() - interval '2 hours', 'bai-cua-gio'),
  ('d1111111-0000-4000-8000-000000000003', '11111111-2222-4333-8444-666666666666', 'c1111111-0000-4000-8000-000000000003', 'unpublished', now() - interval '3 hours', 'bai-da-go'),
  -- slug THẬT của bài đang published trên production: iframe nhúng đọc RPC công khai thật (chỉ đọc) để nghe được âm thanh thật
  ('d1111111-0000-4000-8000-000000000004', '11111111-2222-4333-8444-666666666666', 'c1111111-0000-4000-8000-000000000004', 'published', now() - interval '4 hours', 'mua-thu-cho-em-1a093');
