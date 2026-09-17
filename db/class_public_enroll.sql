-- Phase 1 (09/2026): tách LỊCH TUYỂN SINH PUBLIC khỏi lịch vận hành.
-- class_schedule vẫn là toàn bộ lớp thật; landing chỉ hiện dòng public_enroll=true,
-- gom theo 4 sản phẩm public. Mặc định false ⇒ không lớp legacy nào tự lộ ra.
-- Idempotent. Không sửa/xoá dữ liệu cũ.
alter table public.class_schedule
  add column if not exists public_product text,
  add column if not exists public_enroll boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'class_schedule_public_product_chk') then
    alter table public.class_schedule add constraint class_schedule_public_product_chk
      check (public_product is null or public_product in
        ('dem_hat_can_ban','guitar_can_ban','dem_hat_nang_cao','solo_guitar'));
  end if;
end $$;

comment on column public.class_schedule.public_product is
  'Sản phẩm tuyển sinh public mà cohort này thuộc về (null = không thuộc sản phẩm public)';
comment on column public.class_schedule.public_enroll is
  'true = cohort đang tuyển, được hiện trên class.vananhaudio.com';

notify pgrst, 'reload schema';
