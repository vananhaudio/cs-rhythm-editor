-- ROLLBACK — Play Scroll Video V1 Cổng C. Chạy bằng scripts/prod-db.py. Quay FE về cổng Admin TRƯỚC, rồi chạy file này.
-- Không tin dữ liệu khác: chỉ xoá đúng hai hàm và đúng hai dòng capability do setup tạo.
drop function if exists public.chord_video_export_ok(uuid, text);
drop function if exists public.chord_video_export_eval(uuid, uuid, text);
delete from public.tool_capabilities where tool_id = 'chordlib' and capability = 'export_video';
notify pgrst, 'reload schema';
