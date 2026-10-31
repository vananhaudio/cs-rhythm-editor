-- Dữ liệu + migration cho E2E Mira cạnh màn chấm bài (cluster TẠM, KHÔNG production). Nạp sau fixture SOLO01.TH01 (A, B là học viên; T là Thầy).
\ir ../../db/student_360_p1_setup.sql
\ir ../../db/mira_grading_v1_setup.sql
insert into public.mira_grading_keys (key_hash) values (encode(sha256(convert_to('e2e-mira-key', 'UTF8')), 'hex'));

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}', false);
set role authenticated;
select public.lt_submit_checkpoint('b1000000-0000-4000-8000-000000000001', 1, '1.1', 'BÀI-NỘP-CỦA-AN: em đặt ngón 1 ở thế I vì cả câu quanh vùng đó.', 'https://youtu.be/aaaaaaaaaaa', 'youtube', 'aaaaaaaaaaa') \gset a_
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-00000000000b","role":"authenticated"}', false);
set role authenticated;
select public.lt_submit_checkpoint('b1000000-0000-4000-8000-000000000001', 1, '1.1', 'BÀI-NỘP-CỦA-BÌNH: em chọn cho dễ.') \gset b_
reset role;
select set_config('request.jwt.claims', '{}', false);
insert into public.student_360_facts (user_id, category, content, origin, source_kind, source_ref)
values ('aaaaaaaa-0000-4000-8000-00000000000a', 'goal', 'MỤC-TIÊU-CỦA-AN: muốn đệm hát Diễm Xưa', 'self_reported', 'student', 'REF-NỘI-BỘ-AN');
