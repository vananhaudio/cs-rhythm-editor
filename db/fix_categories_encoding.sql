-- ============================================================
-- Fix: Sửa lỗi encoding bảng categories (lỗi phông tiếng Việt)
-- Chạy trong Supabase SQL Editor
-- ============================================================

-- Xóa dữ liệu cũ bị lỗi encoding
DELETE FROM public.story_categories;
DELETE FROM public.categories;

-- Insert lại với encoding chuẩn UTF-8
INSERT INTO public.categories (name, slug) VALUES
  ('Bắt đầu học Guitar', 'bat-dau-hoc-guitar'),
  ('Gia đình', 'gia-dinh'),
  ('Người thầy', 'nguoi-thay'),
  ('Bạn bè', 'ban-be'),
  ('Động lực', 'dong-luc'),
  ('Biểu diễn', 'bieu-dien'),
  ('Đại hội Guitar', 'dai-hoi-guitar'),
  ('Band', 'band');

-- Gán lại chủ đề cho stories hiện có
DO $$
DECLARE
  cat_gia_dinh uuid; cat_dong_luc uuid; cat_bieu_dien uuid; cat_bat_dau uuid;
  ser_gia_dinh uuid; ser_hanh_trinh uuid; ser_thay_doi uuid;
BEGIN
  SELECT id INTO cat_gia_dinh FROM public.categories WHERE slug = 'gia-dinh';
  SELECT id INTO cat_dong_luc FROM public.categories WHERE slug = 'dong-luc';
  SELECT id INTO cat_bieu_dien FROM public.categories WHERE slug = 'bieu-dien';
  SELECT id INTO cat_bat_dau FROM public.categories WHERE slug = 'bat-dau-hoc-guitar';
  SELECT id INTO ser_gia_dinh FROM public.series WHERE slug = 'guitar-va-gia-dinh';
  SELECT id INTO ser_hanh_trinh FROM public.series WHERE slug = 'hanh-trinh-bat-dau';
  SELECT id INTO ser_thay_doi FROM public.series WHERE slug = 'guitar-thay-doi-cuoc-doi';

  -- Lan: Điều tôi tiếc nhất
  INSERT INTO public.story_categories (story_id, category_id)
    SELECT id, cat_bat_dau FROM public.stories WHERE slug = 'dieu-toi-tiec-nhat-la-khong-hoc-som-hon'
    ON CONFLICT DO NOTHING;
  INSERT INTO public.story_categories (story_id, category_id)
    SELECT id, cat_dong_luc FROM public.stories WHERE slug = 'dieu-toi-tiec-nhat-la-khong-hoc-som-hon'
    ON CONFLICT DO NOTHING;
  INSERT INTO public.story_series (story_id, series_id)
    SELECT id, ser_hanh_trinh FROM public.stories WHERE slug = 'dieu-toi-tiec-nhat-la-khong-hoc-som-hon'
    ON CONFLICT DO NOTHING;

  -- Khánh: Chiếc capo
  INSERT INTO public.story_categories (story_id, category_id)
    SELECT id, cat_dong_luc FROM public.stories WHERE slug = 'mot-chiec-capo-lam-toi-thay-doi'
    ON CONFLICT DO NOTHING;

  -- Mai: Buổi biểu diễn
  INSERT INTO public.story_categories (story_id, category_id)
    SELECT id, cat_gia_dinh FROM public.stories WHERE slug = 'buoi-bieu-dien-dau-tien-truoc-gia-dinh'
    ON CONFLICT DO NOTHING;
  INSERT INTO public.story_series (story_id, series_id)
    SELECT id, ser_gia_dinh FROM public.stories WHERE slug = 'buoi-bieu-dien-dau-tien-truoc-gia-dinh'
    ON CONFLICT DO NOTHING;

  -- Hương: Bài hát ru con
  INSERT INTO public.story_categories (story_id, category_id)
    SELECT id, cat_gia_dinh FROM public.stories WHERE slug = 'bai-hat-dau-tien-danh-cho-con-gai'
    ON CONFLICT DO NOTHING;
  INSERT INTO public.story_series (story_id, series_id)
    SELECT id, ser_gia_dinh FROM public.stories WHERE slug = 'bai-hat-dau-tien-danh-cho-con-gai'
    ON CONFLICT DO NOTHING;

  -- Tuấn: Sau mười năm
  INSERT INTO public.story_categories (story_id, category_id)
    SELECT id, cat_dong_luc FROM public.stories WHERE slug = 'sau-muoi-nam-toi-lai-cam-dan'
    ON CONFLICT DO NOTHING;
  INSERT INTO public.story_series (story_id, series_id)
    SELECT id, ser_thay_doi FROM public.stories WHERE slug = 'sau-muoi-nam-toi-lai-cam-dan'
    ON CONFLICT DO NOTHING;

  -- Minh: Cây đàn đầu tiên
  INSERT INTO public.story_categories (story_id, category_id)
    SELECT id, cat_bat_dau FROM public.stories WHERE slug = 'cay-dan-dau-tien-van-con-o-goc-phong'
    ON CONFLICT DO NOTHING;
  INSERT INTO public.story_series (story_id, series_id)
    SELECT id, ser_hanh_trinh FROM public.stories WHERE slug = 'cay-dan-dau-tien-van-con-o-goc-phong'
    ON CONFLICT DO NOTHING;

END $$;

-- Kiểm tra
SELECT name, slug FROM public.categories ORDER BY name;
