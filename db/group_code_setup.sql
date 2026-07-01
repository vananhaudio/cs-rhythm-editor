-- Nhóm Zalo ≡ lớp học: gắn MÃ LỚP cho nhóm (nhóm Zalo trùng mã lớp, vd DH2.KD16).
-- Khi tạo lịch lớp, hệ thống tự khớp/tạo nhóm Zalo cùng mã. Chạy trong SQL Editor. Idempotent.

alter table public.edu_groups add column if not exists code text;

-- ⚠️ Index cũ là PARTIAL (where code is not null) → ON CONFLICT (code) không khớp. Đổi sang index ĐẦY ĐỦ.
drop index if exists public.edu_groups_code_uidx;
create unique index if not exists edu_groups_code_key on public.edu_groups (code);  -- NULL vẫn cho nhiều dòng; non-null là duy nhất

notify pgrst, 'reload schema';
