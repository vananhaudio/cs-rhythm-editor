-- ============================================================
-- 1001 Câu Chuyện — Database Refactor
-- Chạy trong Supabase SQL Editor
-- ============================================================

-- 1. Thêm cột featured vào stories
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;

-- 2. Bảng chủ đề (categories)
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. Bảng series
CREATE TABLE IF NOT EXISTS public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- 4. Junction: story ↔ categories (N-N)
CREATE TABLE IF NOT EXISTS public.story_categories (
  story_id uuid REFERENCES public.stories(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, category_id)
);

-- 5. Junction: story ↔ series (N-N)
CREATE TABLE IF NOT EXISTS public.story_series (
  story_id uuid REFERENCES public.stories(id) ON DELETE CASCADE,
  series_id uuid REFERENCES public.series(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, series_id)
);

-- ============================================================
-- Seed data: Chủ đề
-- ============================================================
INSERT INTO public.categories (name, slug) VALUES
  ('Bắt đầu học Guitar', 'bat-dau-hoc-guitar'),
  ('Gia đình', 'gia-dinh'),
  ('Người thầy', 'nguoi-thay'),
  ('Bạn bè', 'ban-be'),
  ('Động lực', 'dong-luc'),
  ('Biểu diễn', 'bieu-dien'),
  ('Đại hội Guitar', 'dai-hoi-guitar'),
  ('Band', 'band')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Seed data: Series
-- ============================================================
INSERT INTO public.series (name, slug, description) VALUES
  ('Guitar và gia đình', 'guitar-va-gia-dinh', 'Những câu chuyện về guitar trong không gian gia đình'),
  ('Hành trình bắt đầu', 'hanh-trinh-bat-dau', 'Những bước đầu tiên trên hành trình học guitar'),
  ('Những người thầy', 'nhung-nguoi-thay', 'Câu chuyện về những người thầy dạy guitar'),
  ('Guitar thay đổi cuộc đời', 'guitar-thay-doi-cuoc-doi', 'Khi guitar mang đến những thay đổi lớn')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Gán chủ đề + series cho stories hiện có
-- ============================================================
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

  -- Lan: Điều tôi tiếc nhất — bat-dau + dong-luc
  INSERT INTO public.story_categories (story_id, category_id)
    SELECT id, cat_bat_dau FROM public.stories WHERE slug = 'dieu-toi-tiec-nhat-la-khong-hoc-som-hon'
    ON CONFLICT DO NOTHING;
  INSERT INTO public.story_categories (story_id, category_id)
    SELECT id, cat_dong_luc FROM public.stories WHERE slug = 'dieu-toi-tiec-nhat-la-khong-hoc-som-hon'
    ON CONFLICT DO NOTHING;
  INSERT INTO public.story_series (story_id, series_id)
    SELECT id, ser_hanh_trinh FROM public.stories WHERE slug = 'dieu-toi-tiec-nhat-la-khong-hoc-som-hon'
    ON CONFLICT DO NOTHING;

  -- Khánh: Chiếc capo — dong-luc
  INSERT INTO public.story_categories (story_id, category_id)
    SELECT id, cat_dong_luc FROM public.stories WHERE slug = 'mot-chiec-capo-lam-toi-thay-doi'
    ON CONFLICT DO NOTHING;

  -- Mai: Buổi biểu diễn — gia-dinh + bieu-dien
  INSERT INTO public.story_categories (story_id, category_id)
    SELECT id, cat_gia_dinh FROM public.stories WHERE slug = 'buoi-bieu-dien-dau-tien-truoc-gia-dinh'
    ON CONFLICT DO NOTHING;
  INSERT INTO public.story_series (story_id, series_id)
    SELECT id, ser_gia_dinh FROM public.stories WHERE slug = 'buoi-bieu-dien-dau-tien-truoc-gia-dinh'
    ON CONFLICT DO NOTHING;

  -- Hương: Bài hát ru con — gia-dinh
  INSERT INTO public.story_categories (story_id, category_id)
    SELECT id, cat_gia_dinh FROM public.stories WHERE slug = 'bai-hat-dau-tien-danh-cho-con-gai'
    ON CONFLICT DO NOTHING;
  INSERT INTO public.story_series (story_id, series_id)
    SELECT id, ser_gia_dinh FROM public.stories WHERE slug = 'bai-hat-dau-tien-danh-cho-con-gai'
    ON CONFLICT DO NOTHING;

  -- Tuấn: Sau mười năm — dong-luc + bat-dau
  INSERT INTO public.story_categories (story_id, category_id)
    SELECT id, cat_dong_luc FROM public.stories WHERE slug = 'sau-muoi-nam-toi-lai-cam-dan'
    ON CONFLICT DO NOTHING;
  INSERT INTO public.story_series (story_id, series_id)
    SELECT id, ser_thay_doi FROM public.stories WHERE slug = 'sau-muoi-nam-toi-lai-cam-dan'
    ON CONFLICT DO NOTHING;

  -- Minh: Cây đàn đầu tiên — bat-dau + dong-luc
  INSERT INTO public.story_categories (story_id, category_id)
    SELECT id, cat_bat_dau FROM public.stories WHERE slug = 'cay-dan-dau-tien-van-con-o-goc-phong'
    ON CONFLICT DO NOTHING;
  INSERT INTO public.story_series (story_id, series_id)
    SELECT id, ser_hanh_trinh FROM public.stories WHERE slug = 'cay-dan-dau-tien-van-con-o-goc-phong'
    ON CONFLICT DO NOTHING;

  -- Đánh dấu featured
  UPDATE public.stories SET featured = true WHERE slug IN (
    'dieu-toi-tiec-nhat-la-khong-hoc-som-hon',
    'buoi-bieu-dien-dau-tien-truoc-gia-dinh',
    'sau-muoi-nam-toi-lai-cam-dan'
  );

END $$;

-- ============================================================
-- RLS: cho phép đọc công khai
-- ============================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.series FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.story_categories FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.story_series FOR SELECT USING (true);

-- ============================================================
-- Kiểm tra
-- ============================================================
SELECT 'categories' as tbl, count(*) FROM public.categories
UNION ALL
SELECT 'series', count(*) FROM public.series
UNION ALL
SELECT 'story_categories', count(*) FROM public.story_categories
UNION ALL
SELECT 'story_series', count(*) FROM public.story_series
UNION ALL
SELECT 'stories featured', count(*) FROM public.stories WHERE featured = true;
