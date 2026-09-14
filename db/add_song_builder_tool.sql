-- Mở quyền BMS (Beat my Songs, route /song-builder) cho TẤT CẢ user.
-- Vì sao cần: gate công cụ trong app đọc my_learning_state()->flags->tools, mà map này
-- chỉ gồm các id CÓ TRONG edu_tools. Trước đây bảng thiếu hẳn hàng 'song-builder' ⇒ giá trị
-- undefined ⇒ mọi user (kể cả thầy) bấm BMS đều bị đá sang màn "nâng cấp gói".
-- tier='free' ⇒ công thức trong RPC (enabled AND (teacher OR tier_idx >= tier tool)) luôn true.
-- Chạy trên Supabase SQL editor. Idempotent.
INSERT INTO edu_tools (id, icon, name, description, category, route, tier, enabled, status, order_index)
VALUES (
  'song-builder',
  '🎼',
  'BMS — Beat my Songs',
  'Dựng nhịp & tempo cho bài hát của bạn',
  'Luyện nhịp',
  '/song-builder',
  'free',
  true,
  'on',
  45
)
ON CONFLICT (id) DO UPDATE SET
  icon = EXCLUDED.icon,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  route = EXCLUDED.route,
  tier = EXCLUDED.tier,
  enabled = EXCLUDED.enabled,
  status = EXCLUDED.status,
  order_index = EXCLUDED.order_index;

NOTIFY pgrst, 'reload schema';

-- Kiểm tra:
-- SELECT (public.my_learning_state()->'flags'->'tools'->>'song-builder') AS bms_flag,
--        public.my_tool_route_access('/song-builder') AS route_ok;
