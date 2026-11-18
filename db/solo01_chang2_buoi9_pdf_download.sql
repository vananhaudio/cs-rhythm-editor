-- SOLO01 Chặng 2 · Buổi 9: thêm khối "Tải bản nhạc PDF" (v5-2026-11-17) vào cuối Phần 2 — Phụ lục hiểu sâu.
-- Chỉ thêm MỘT khối vào study.blocks; không đổi status/khoá/bài trả/đáp án. Sao lưu: tva_private.class_lesson_content_bak_20261118_pdf.
-- md5 bảo vệ: nội dung đổi so với lúc đọc → dừng. Hoàn tác: db/solo01_chang2_buoi9_pdf_download_rollback.sql
create table if not exists tva_private.class_lesson_content_bak_20261118_pdf (like public.class_lesson_content);
alter table tva_private.class_lesson_content_bak_20261118_pdf enable row level security;
insert into tva_private.class_lesson_content_bak_20261118_pdf (session_id, event_type, status, blocks, updated_at, updated_by)
  select session_id, event_type, status, blocks, updated_at, updated_by from public.class_lesson_content
  where session_id = '028adc12-051f-4d23-a514-d85a4aa064a2'
    and not exists (select 1 from tva_private.class_lesson_content_bak_20261118_pdf b where b.session_id = '028adc12-051f-4d23-a514-d85a4aa064a2');
do $dl$
declare n int;
begin
  update public.class_lesson_content set blocks = jsonb_set(blocks, '{16,blocks}',
    (blocks->16->'blocks') || $j$[{"b":"download","title":"Bản nhạc thực hành – Con Đường Xưa Em Đi (PDF A4)","note":"In ra và tự ghi thêm Bass, hợp âm, kỹ thuật diễn tấu bằng bút chì. Bản chuẩn có lời ca, Tie/Slur và TAB (v5-2026-11-17).","label":"Tải bản nhạc PDF","href":"https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/lessons/solo01/chang2/con-duong-xua-em-di_v5-co-loi.pdf"}]$j$::jsonb)
   where session_id = '028adc12-051f-4d23-a514-d85a4aa064a2' and md5(blocks::text) = 'e5aa81e08c8e75cc6cb850b004f47430'
     and blocks->16->>'kind' = 'study' and jsonb_array_length(blocks->16->'blocks') = 12;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Buổi 9: nội dung đã đổi so với lúc đọc (md5/vị trí) — dừng'; end if;
end $dl$;
