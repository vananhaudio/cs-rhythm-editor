-- Gắn mã 'GL11' cho nhóm Zalo THẬT (đang có 6 thành viên, chưa có mã), rồi cấp bù khoá.
-- Chạy trong Supabase SQL Editor.

update public.edu_groups set code = 'GL11'
where id = '0d48698d-723e-4b97-9c16-6bcb056c2707';   -- "Lớp guitar tỉa nốt khoá 11 – GL11"

select public.backfill_class('GL11') as so_quyen_da_cap;   -- kỳ vọng: 6 học sinh × 3 khoá
