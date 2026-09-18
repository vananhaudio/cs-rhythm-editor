-- Mở tuyển sinh công khai 2 lớp T4 "trung cấp" (19/09/2026). Idempotent. Chỉ đụng public_product/public_enroll.
--   DH2.KD21 → dem_hat_trung_cap · TN2.GL15 → guitar_trung_cap · cả hai public_enroll=true
-- Giữ nguyên 4 key cũ (backward compatible). T3 giữ nguyên; T5/T6 (SOLO01.*, HT2027, DHNC01.*) KHÔNG public.
-- Không đổi membership/entitlement/course_ids. Kích hoạt gói dùng main_course_id của lớp (DH2 / TN2).
-- An toàn thứ tự deploy: landing CŨ chỉ hiện public_product nằm trong danh sách sản phẩm cũ của nó,
-- nên chạy file này TRƯỚC code mới thì 2 lớp T4 vẫn không hiện ở bản cũ.
begin;
alter table public.class_schedule drop constraint if exists class_schedule_public_product_chk;
alter table public.class_schedule add constraint class_schedule_public_product_chk
  check (public_product is null or public_product in
    ('dem_hat_can_ban', 'guitar_can_ban', 'dem_hat_trung_cap', 'guitar_trung_cap', 'dem_hat_nang_cao', 'solo_guitar'));

do $$ begin
  if (select count(*) from public.class_schedule where code in ('DH2.KD21', 'TN2.GL15')) <> 2 then
    raise exception 'Không tìm thấy đủ 2 lớp T4';
  end if;
end $$;
update public.class_schedule set public_product = 'dem_hat_trung_cap', public_enroll = true where code = 'DH2.KD21';
update public.class_schedule set public_product = 'guitar_trung_cap',  public_enroll = true where code = 'TN2.GL15';

-- Bảo đảm lớp dài hạn T5/T6 không public (không đổi gì nếu đã đúng)
update public.class_schedule set public_enroll = false
 where public_enroll and (code like 'SOLO01.%' or code like 'HT2027.%' or code like 'DHNC01.%');
commit;
notify pgrst, 'reload schema';
