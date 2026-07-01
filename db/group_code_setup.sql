-- Nhóm Zalo ≡ lớp học: gắn MÃ LỚP cho nhóm (nhóm Zalo trùng mã lớp, vd DH2.KD16).
-- Khi tạo lịch lớp, hệ thống tự khớp/tạo nhóm Zalo cùng mã. Chạy trong SQL Editor. Idempotent.

alter table public.edu_groups add column if not exists code text;
create unique index if not exists edu_groups_code_uidx on public.edu_groups (code) where code is not null;

notify pgrst, 'reload schema';
