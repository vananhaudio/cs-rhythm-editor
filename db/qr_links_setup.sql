-- ── QR SÁCH GIẤY → APP: bảng chuyển hướng động ──────────────────────────────
-- Sách "Tỉa Nốt 1" in QR cố định: timming.vananhaudio.com/qr/<slug>
-- Route /qr/<slug> (QrRedirectPage) tra bảng này rồi chuyển hướng.
-- ĐỔI ĐÍCH SAU KHI SÁCH ĐÃ IN: UPDATE qr_links SET target='...' WHERE slug='...';
--   (vd thầy quay video tư thế → trỏ 'tuthe' sang link YouTube/video trong app)
-- Idempotent: chạy lại bao nhiêu lần cũng được.

CREATE TABLE IF NOT EXISTS qr_links (
  slug   text PRIMARY KEY,
  target text NOT NULL,          -- '/course?id=…' | '/tuner' | 'https://…'
  note   text                    -- ghi chú cho thầy: QR này in ở đâu trong sách
);

ALTER TABLE qr_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_authenticated_all ON qr_links;
CREATE POLICY rls_authenticated_all ON qr_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS rls_anon_read ON qr_links;
CREATE POLICY rls_anon_read ON qr_links FOR SELECT TO anon USING (true);  -- QR quét được TRƯỚC khi đăng nhập

-- ── Đích tĩnh (id bài TN1 cố định trong repo) ──
INSERT INTO qr_links (slug, target, note) VALUES
  ('tuner',     '/tuner',                                                'Bài 0 + Phụ lục D — công cụ Chỉnh dây'),
  ('nhapmon',   '/start',                                                'Phần I — khoá Nhập môn (vào portal)'),
  ('c1',        '/course?id=a2710000-0000-4000-8000-000000000002',       'Chặng 2 sách ↔ Chương 1 app (Cụm Mi–Fa–Sol)'),
  ('nghemau',   '/course?id=a2710000-0000-4000-8000-000000000003',       'Bài 12–13 NGHE ↔ Câu nhạc đầu tiên (▶ Nghe mẫu)'),
  ('c2',        '/course?id=a2720000-0000-4000-8000-000000000001',       'Chặng 3 sách ↔ Chương 2 app (Cụm Sol–La)'),
  ('c3',        '/course?id=a3720000-0000-4000-8000-000000000001',       'Chặng 4 sách ↔ Chương 3 app (Cụm dây 5)'),
  ('gamdo',     '/course?id=a3720000-0000-4000-8000-000000000005',       'Bài 20 ↔ Gam Đô trưởng trên app'),
  ('tronbo',    '/course?id=a3720000-0000-4000-8000-000000000004',       'Bài 30 ↔ Đọc trọn cần đàn (2 quãng tám)'),
  ('nhip',      '/course?id=a5720000-0000-4000-8000-000000000001',       'Chặng 1 sách ↔ Chương 5 app (Đọc nhịp)'),
  ('tietau',    '/course?id=a5720000-0000-4000-8000-000000000006',       'Bài 10 ↔ Bản tiết tấu đầu tiên trên app'),
  ('dauhoa',    '/course?id=a8720000-0000-4000-8000-000000000001',       'Chặng 5 sách ↔ Chương 8 app (Dấu hoá)'),
  ('thitau',    '/course?id=aa720000-0000-4000-8000-000000000001',       'Bài 31 + Chặng 7 ↔ Chương 10 Thị tấu'),
  ('baihat',    '/course?id=a2730000-0000-4000-8000-000000000002',       'Chặng 6 ↔ Chương 4 app (Happy Birthday)'),
  ('totnghiep', '/course?id=a7720000-0000-4000-8000-000000000003',       'Bài 39 ↔ Ode to Joy cùng ban nhạc (chấm sao)')
ON CONFLICT (slug) DO UPDATE SET target = EXCLUDED.target, note = EXCLUDED.note;

-- ── Đích khoá NHẬP MÔN (id sinh động khi seed → tra theo tiêu đề lúc chạy) ──
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT l.id INTO v_id FROM edu_course_lessons l
    JOIN edu_modules m ON m.id = l.module_id
    WHERE m.course_id = 'fd23a7a2-bfce-44c6-8bde-6d76289a3625' AND l.title = 'Tư thế ngồi & đặt đàn' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO qr_links (slug, target, note)
      VALUES ('tuthe', '/course?id=' || v_id, 'Bài 2 — tư thế (sau này trỏ video thầy quay)')
      ON CONFLICT (slug) DO UPDATE SET target = EXCLUDED.target;
  END IF;

  SELECT l.id INTO v_id FROM edu_course_lessons l
    JOIN edu_modules m ON m.id = l.module_id
    WHERE m.course_id = 'fd23a7a2-bfce-44c6-8bde-6d76289a3625' AND l.title = 'Cầm pick / dùng ngón phải' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO qr_links (slug, target, note)
      VALUES ('tayphai', '/course?id=' || v_id, 'Bài 3 — tay phải p·i·m·a (sau này trỏ video)')
      ON CONFLICT (slug) DO UPDATE SET target = EXCLUDED.target;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
