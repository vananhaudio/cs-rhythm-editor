-- Thêm Piano Journey vào edu_tools
INSERT INTO edu_tools (id, icon, name, description, category, route, tier, enabled, status, order_index)
VALUES (
  'piano-journey',
  '🎹',
  'Piano Journey',
  'Hành trình chơi piano',
  'Luyện',
  '/piano-journey',
  'free',
  true,
  'on',
  50
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
