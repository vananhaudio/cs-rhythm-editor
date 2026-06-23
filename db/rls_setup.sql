-- =====================================================================
-- RLS SETUP — Thầy Văn Anh Guitar LMS (wojmdilyflffvdtpovmq)
-- Mục tiêu: chặn anon key (ai cũng có trong bundle JS) đọc/ghi/xóa dữ liệu.
--
-- Chiến lược (mức nền — siết theo từng-hàng là bước SAU, tách riêng):
--   1. Bật RLS trên MỌI bảng public.
--   2. Hầu hết bảng -> role 'authenticated' TOÀN QUYỀN (thầy + học viên dùng như cũ).
--      NGOẠI LỆ app_users -> authenticated CHỈ ĐƯỢC ĐỌC (không cho học viên tự
--      UPDATE role='admin' để leo quyền; đổi role chỉ qua SQL/service_role).
--   3. CHỈ 6 bảng nội dung (không PII) -> role 'anon' ĐƯỢC SELECT.
--      anon KHÔNG được ghi/xóa bất cứ đâu, KHÔNG đọc bảng PII.
--   * Bảng tự-quản-RLS (edu_groups/edu_group_members/edu_group_claim_tokens của
--     tính năng "Cộng đồng") có policy HẸP riêng do migration của nó đặt —
--     vòng lặp dưới BỎ QUA, không áp policy rộng lên chúng.
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

-- ── STEP 2+3: XÓA SẠCH policy cũ + tạo lại policy sạch ──
-- (xóa MỌI policy hiện có trên từng bảng — gồm policy rác cũ cho anon/public
--  tên lạ — rồi tạo lại đúng những policy cần. Đây là điểm khác bản đầu:
--  bản đầu chỉ xóa policy do nó đặt tên nên policy rác cũ vẫn sót, vẫn lộ.)
DO $$
DECLARE
  t record;
  p record;
  -- 6 bảng nội dung (KHÔNG PII) được anon đọc:
  content_tables text[] := ARRAY[
    'edu_courses', 'edu_modules', 'edu_course_lessons',
    'edu_tools', 'flows', 'timming_songs'
  ];
  -- Bảng tự quản RLS riêng (policy hẹp do migration tính năng đặt) — BỎ QUA:
  self_managed text[] := ARRAY[
    'edu_groups', 'edu_group_members', 'edu_group_claim_tokens',
    'student_action_logs',
    -- Trang tuyển sinh class.vananhaudio.com — policy HẸP riêng (xem db/class_tuyensinh_setup.sql).
    -- articles: anon đọc bài published. leads: anon CHỈ ghi (không đọc). ĐỪNG để vòng lặp áp policy rộng.
    'articles', 'leads',
    -- Quyền mở khoá từng khoá: authenticated ĐỌC, chỉ thầy GHI (xem db/course_access_setup.sql)
    'edu_course_access'
  ];
  -- Bảng authenticated CHỈ ĐƯỢC ĐỌC, không ghi (chặn tự leo quyền qua role):
  read_only_auth text[] := ARRAY['app_users'];
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    -- Bỏ qua bảng tự-quản-RLS: giữ nguyên policy hẹp của chúng
    IF t.tablename = ANY (self_managed) THEN CONTINUE; END IF;

    -- (1) xóa MỌI policy hiện có trên bảng này
    FOR p IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = t.tablename
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I;', p.policyname, t.tablename);
    END LOOP;

    -- (2) authenticated: read-only cho app_users, toàn quyền cho phần còn lại
    IF t.tablename = ANY (read_only_auth) THEN
      EXECUTE format('CREATE POLICY rls_authenticated_read ON public.%I FOR SELECT TO authenticated USING (true);',
        t.tablename);
    ELSE
      EXECUTE format('CREATE POLICY rls_authenticated_all ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
        t.tablename);
    END IF;

    -- (3) anon CHỈ SELECT, và chỉ trên bảng nội dung
    IF t.tablename = ANY (content_tables) THEN
      EXECUTE format('CREATE POLICY rls_anon_select ON public.%I FOR SELECT TO anon USING (true);',
        t.tablename);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- ── KIỂM TRA SAU: liệt kê policy đang có ──
--   SELECT tablename, policyname, roles, cmd
--   FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
