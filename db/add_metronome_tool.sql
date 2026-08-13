-- Thêm "Máy đập nhịp" (metronome thật, route /metronome) vào edu_tools.
-- Chạy trên Supabase SQL editor. Idempotent (chạy lại bao nhiêu lần cũng được).
-- Sau khi chạy: tool hiện ở mục "Công cụ luyện tập" của học viên + quản trong /admin → Công cụ.
-- (ToolsManager cũng tự seed dòng này khi thầy mở admin, nhưng chạy SQL thì bật ngay không cần vào admin.)
INSERT INTO edu_tools (id, icon, name, description, category, route, tier, enabled, status, order_index)
VALUES (
  'metronome',
  '🎼',
  'Máy đập nhịp',
  'Giữ nhịp khi luyện tập',
  'Luyện',
  '/metronome',
  'free',
  true,
  'on',
  40
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

-- Kiểm tra: SELECT id, name, route, category, status FROM edu_tools WHERE id = 'metronome';
