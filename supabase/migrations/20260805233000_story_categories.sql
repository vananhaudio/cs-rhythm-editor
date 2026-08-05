-- ============================================================
-- Story Categories — Danh mục cho "1001 Câu chuyện cùng Guitar"
-- Bảng categories + junction story_categories
-- ============================================================

-- 1. Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add sort_order if missing (from earlier partial creation)
DO $$ BEGIN
  ALTER TABLE categories ADD COLUMN sort_order INT NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
-- Authenticated users can read
CREATE POLICY categories_read ON categories FOR SELECT USING (true);
-- Only teacher/admin can insert/update/delete
CREATE POLICY categories_write ON categories FOR ALL
  USING (EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('teacher', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('teacher', 'admin')));

-- Seed 8 categories
INSERT INTO categories (name, slug, sort_order) VALUES
  ('Bạn bè',          'ban-be',              1),
  ('Band',            'band',                2),
  ('Bắt đầu học Guitar', 'bat-dau-hoc-guitar', 3),
  ('Biểu diễn',        'bieu-dien',           4),
  ('Đại hội Guitar',   'dai-hoi-guitar',      5),
  ('Động lực',         'dong-luc',            6),
  ('Gia đình',         'gia-dinh',            7),
  ('Người thầy',        'nguoi-thay',          8)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- 2. Junction: story <-> category (many-to-many)
CREATE TABLE IF NOT EXISTS story_categories (
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, category_id)
);

ALTER TABLE story_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY story_categories_read ON story_categories FOR SELECT USING (true);
CREATE POLICY story_categories_write ON story_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('teacher', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('teacher', 'admin')));
