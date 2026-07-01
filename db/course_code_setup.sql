-- MÃ NĂNG LỰC cho khoá học (Bộ luật Hành trình 2027 — quản lý theo MÃ).
-- Mã ổn định: NM, DH1/DH2/DH3, DHNC, TN1/TN2/TN3, NL1/NL2/NL3, SOLO.
-- Tên khoá chỉ là nhãn; mã là khoá gốc cho tiên quyết/mở khoá/hiển thị.
-- Chạy trong Supabase SQL Editor. Idempotent.

alter table public.edu_courses add column if not exists code text;
create index if not exists edu_courses_code_idx on public.edu_courses (code);

notify pgrst, 'reload schema';
