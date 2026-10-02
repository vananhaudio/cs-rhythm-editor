-- ═══════════════════════════════════════════════════════════════════════════
-- DỮ LIỆU Band "Lá Mùa Thu" — Band đầu tiên dùng hệ Tuyển thành viên V1 (db/band_recruit_v1_setup.sql).
-- Đây CHỈ là dữ liệu: Band mới = copy file này, đổi nội dung → chạy. Không sửa code/component.
-- Idempotent (chạy lại không tạo trùng; không ghi đè Band/Rule/đợt tuyển đã có).
-- Đổi Rule sau này: INSERT band_rule_versions version 2 rồi UPDATE band_recruitments.rule_version_id
-- (bản cũ bất biến — đơn cũ vẫn trỏ version 1).
-- CHẠY bằng scripts/prod-db.py (file KHÔNG có begin/commit).
-- ═══════════════════════════════════════════════════════════════════════════
insert into public.bands (slug, name, leader_name, tagline, music_style, schedule_text, reference_songs, highlights, description, status)
values (
  'la-mua-thu',
  'Lá Mùa Thu',
  'Thầy Văn Anh',
  'Ban nhạc tình ca của lớp Thầy Văn Anh Guitar — cùng nhau chơi những bài hát nhẹ nhàng, sâu lắng.',
  'Tình ca nhẹ nhàng, sâu lắng, giàu giai điệu',
  '19:00 Thứ Tư hàng tuần',
  '[{"title": "Mùa thu cho em"}]',
  '[{"label": "Band Leader", "value": "Thầy Văn Anh"},
    {"label": "Lịch tập", "value": "19:00 Thứ Tư hàng tuần (dự kiến)"},
    {"label": "Chương trình đào tạo", "value": "Miễn phí cho Band đầu tiên"}]',
  'Lá Mùa Thu là Band đầu tiên của Class. Mỗi thành viên tự tập phần của mình, rồi cùng ghép bài ở buổi tập chung mỗi tuần.',
  'active'
)
on conflict (slug) do nothing;

insert into public.band_rule_versions (band_id, version, title, items, agree_label)
select b.id, 1, 'Rule của Lá Mùa Thu',
  '["Tôi tham gia đều đặn và báo trước khi phải vắng.",
    "Tôi tự tập phần của mình trước buổi tập chung.",
    "Tôi tôn trọng, hỗ trợ và không chê bai đồng đội.",
    "Tôi sẵn sàng nhận một vai trò để cùng xây dựng Band.",
    "Tôi chủ động cùng mọi người vận hành Band, không chờ Thầy bố trí mọi việc."]',
  'Tôi đã đọc và đồng ý thực hiện'
from public.bands b
where b.slug = 'la-mua-thu'
  and not exists (select 1 from public.band_rule_versions v where v.band_id = b.id and v.version = 1);

insert into public.band_recruitments (band_id, title, intro, positions, questions, reason_label, success_message, rule_version_id, status)
select b.id,
  'Tuyển thành viên Lá Mùa Thu',
  'Band đang tìm những người yêu tình ca, muốn cùng nhau tập luyện đều đặn mỗi tuần. Không cần chơi giỏi — cần tinh thần đều đặn và tôn trọng đồng đội.',
  '[{"key": "vocal", "label": "Vocal"},
    {"key": "guitar_dem", "label": "Guitar đệm"},
    {"key": "guitar_lead", "label": "Guitar tỉa / Lead"},
    {"key": "keyboard", "label": "Keyboard"},
    {"key": "bass", "label": "Bass"},
    {"key": "drums", "label": "Trống / Percussion"},
    {"key": "other", "label": "Khác", "other": true}]',
  '[{"key": "level", "label": "Trình độ của bạn", "type": "single", "required": true,
     "options": [{"value": "beginner", "label": "Mới học"},
                 {"value": "basic", "label": "Chơi được cơ bản"},
                 {"value": "good", "label": "Chơi tương đối tốt"},
                 {"value": "band", "label": "Đã từng chơi Band"}]},
    {"key": "taste_fit", "label": "\"Mùa thu cho em\" có phải kiểu âm nhạc bạn muốn chơi cùng Band?", "short_label": "Gu nhạc", "type": "single", "required": true,
     "options": [{"value": "very", "label": "Rất đúng gu"},
                 {"value": "fair", "label": "Khá phù hợp"},
                 {"value": "no", "label": "Không phải gu của tôi"}]},
    {"key": "schedule", "label": "Có thể tham gia cố định 19:00 Thứ Tư hàng tuần?", "short_label": "Lịch tập", "type": "single", "required": true,
     "options": [{"value": "yes", "label": "Có, tôi có thể ưu tiên lịch này"},
                 {"value": "sometimes", "label": "Thỉnh thoảng sẽ vắng"},
                 {"value": "unsure", "label": "Tôi chưa chắc chắn"}]}]',
  'Vì sao bạn muốn trở thành thành viên của Lá Mùa Thu?',
  'Thầy đã nhận được đơn của bạn. Thầy sẽ liên hệ qua Zalo trong vài ngày tới.',
  v.id,
  'open'
from public.bands b
join public.band_rule_versions v on v.band_id = b.id and v.version = 1
where b.slug = 'la-mua-thu'
  and not exists (select 1 from public.band_recruitments r where r.band_id = b.id);
