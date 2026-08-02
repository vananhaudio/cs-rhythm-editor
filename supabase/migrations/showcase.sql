-- ============================================================
-- Showcase CMS — Standard CMS Architecture
-- Pages + Categories + Content Blocks
-- ============================================================

-- 1. Categories
CREATE TABLE IF NOT EXISTS showcase_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Seed initial categories
INSERT INTO showcase_categories (name, slug, sort_order) VALUES
  ('Điều cần biết', 'dieu-can-biet', 1),
  ('Phía sau sản phẩm', 'phia-sau-san-pham', 2),
  ('Quy trình', 'quy-trinh', 3),
  ('Đồng hành', 'dong-hanh', 4)
ON CONFLICT (slug) DO NOTHING;

-- 2. Pages
CREATE TABLE IF NOT EXISTS showcase_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES showcase_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  cover_image TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Content Blocks
CREATE TABLE IF NOT EXISTS showcase_page_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES showcase_pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- heading | paragraph | image | gallery | youtube | video | quote | divider | pdf | button | embed | callout
  sort_order INT NOT NULL DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_showcase_pages_category ON showcase_pages(category_id);
CREATE INDEX IF NOT EXISTS idx_showcase_pages_published ON showcase_pages(published);
CREATE INDEX IF NOT EXISTS idx_showcase_pages_slug ON showcase_pages(slug);
CREATE INDEX IF NOT EXISTS idx_showcase_page_blocks_page ON showcase_page_blocks(page_id);
CREATE INDEX IF NOT EXISTS idx_showcase_categories_slug ON showcase_categories(slug);

-- RLS: public read, teacher/admin write
ALTER TABLE showcase_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_page_blocks ENABLE ROW LEVEL SECURITY;

-- Categories: public read
CREATE POLICY "Public read categories" ON showcase_categories
  FOR SELECT USING (is_active = true);

-- Categories: teacher/admin write
CREATE POLICY "Admin manage categories" ON showcase_categories
  FOR ALL USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid()
      AND role IN ('teacher', 'admin')
    )
  );

-- Pages: public read published
CREATE POLICY "Public read published pages" ON showcase_pages
  FOR SELECT USING (published = true);

-- Pages: teacher/admin full access
CREATE POLICY "Admin manage pages" ON showcase_pages
  FOR ALL USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid()
      AND role IN ('teacher', 'admin')
    )
  );

-- Blocks: public read (via page)
CREATE POLICY "Public read blocks" ON showcase_page_blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM showcase_pages
      WHERE id = showcase_page_blocks.page_id
      AND published = true
    )
  );

-- Blocks: teacher/admin full access
CREATE POLICY "Admin manage blocks" ON showcase_page_blocks
  FOR ALL USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM app_users
      WHERE id = auth.uid()
      AND role IN ('teacher', 'admin')
    )
  );
