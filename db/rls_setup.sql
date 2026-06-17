-- =====================================================================
-- RLS SETUP — Thầy Văn Anh Guitar LMS (wojmdilyflffvdtpovmq)
-- Mục tiêu: chặn anon key (ai cũng có trong bundle JS) đọc/ghi/xóa dữ liệu.
--
-- Chiến lược (mức nền — siết theo từng-hàng là bước SAU, tách riêng):
--   1. Bật RLS trên MỌI bảng public.
--   2. MỌI bảng -> role 'authenticated' TOÀN QUYỀN (thầy + học viên đã đăng
--      nhập dùng y như cũ).
--   3. CHỈ 6 bảng nội dung (không PII) -> role 'anon' ĐƯỢC SELECT.
--      anon KHÔNG được ghi/xóa bất cứ đâu, KHÔNG đọc bảng PII.
--
-- edu_students / student_taps / flow_progress KHÔNG cho anon đọc — app đã
-- được sửa (deploy) để không còn đọc chúng khi chưa đăng nhập.
--
-- Idempotent: chạy lại nhiều lần vô hại. delete_my_account là SECURITY
-- DEFINER (owner postgres) nên RLS không chặn — giữ nguyên.
-- =====================================================================

-- ── KIỂM TRA TRƯỚC: nếu trả về dòng nào, BÁO LẠI, đừng chạy phần dưới ──
-- (loop bật RLS cần role chạy SQL là chủ sở hữu bảng; Supabase editor = postgres)
--   SELECT tablename, tableowner FROM pg_tables
--   WHERE schemaname = 'public' AND tableowner <> 'postgres';

-- ── STEP 1: Bật RLS trên mọi bảng public ──
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t.tablename);
  END LOOP;
END $$;

-- ── STEP 2+3: policy theo loop ──
DO $$
DECLARE
  t record;
  -- 6 bảng nội dung (KHÔNG PII) được anon đọc:
  content_tables text[] := ARRAY[
    'edu_courses', 'edu_modules', 'edu_course_lessons',
    'edu_tools', 'flows', 'timming_songs'
  ];
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    -- (2) authenticated toàn quyền trên MỌI bảng
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;',
      'rls_authenticated_all_' || t.tablename, t.tablename);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
      'rls_authenticated_all_' || t.tablename, t.tablename);

    -- (3) anon CHỈ SELECT, và chỉ trên bảng nội dung
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;',
      'rls_anon_select_' || t.tablename, t.tablename);
    IF t.tablename = ANY (content_tables) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true);',
        'rls_anon_select_' || t.tablename, t.tablename);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- ── KIỂM TRA SAU: liệt kê policy đang có ──
--   SELECT tablename, policyname, roles, cmd
--   FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
