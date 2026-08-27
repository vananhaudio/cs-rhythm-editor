-- ── edu_modules.level — metadata Level sư phạm (additive, presentation-only) ──
-- Bối cảnh: Journey học viên gộp course→module→lesson thành MỘT rail ngang.
-- Level là mốc trình bày (đổi tone) trong cùng rail; KHÔNG dính tới access/tier/entitlement.
-- Additive · nullable · không default cưỡng bức · không đổi title/order/relation/lesson.

alter table public.edu_modules
  add column if not exists level integer;

-- Ràng buộc tối thiểu: null (chưa xác định) hoặc >= 1. Không giới hạn max.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'edu_modules_level_check'
  ) then
    alter table public.edu_modules
      add constraint edu_modules_level_check check (level is null or level >= 1);
  end if;
end $$;

-- ── BACKFILL ONE-TIME — chỉ những module CHẮC CHẮN suy được Level từ title ──
-- Runtime KHÔNG parse title; đây là thao tác một lần khi migrate.
-- Chỉ set khi title chứa "Level N" (vd "Level 3: Vòng hoà âm...") và level đang null.
-- Module không rõ (vd "Kiểm tra đầu vào", "Chương 2: ...") → để NULL (backward-compatible).
update public.edu_modules
set level = (substring(lower(name) from 'level\s*([0-9]+)'))::int
where level is null
  and name is not null
  and lower(name) ~ 'level\s*[0-9]+';

-- Reload PostgREST schema cache (bắt buộc sau khi đổi schema).
notify pgrst, 'reload schema';
