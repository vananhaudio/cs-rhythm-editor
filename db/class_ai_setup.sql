-- =====================================================================
-- TRỢ LÝ AI TUYỂN SINH (class.vananhaudio.com) — bảng + cấu hình
-- Chạy trong Supabase SQL Editor. Idempotent.
--
-- Luồng: khách (ẩn danh) chat trên /class → Edge Function 'class-ai'
-- (giữ khoá Anthropic, dùng service_role) → trả lời + ghi hội thoại.
-- Thầy xem hội thoại + huấn luyện AI trong /admin.
--
-- RLS: function dùng service_role nên bỏ qua RLS. Ở client:
--   - anon KHÔNG đọc/ghi trực tiếp các bảng này (mọi thứ qua Edge Function).
--   - authenticated (thầy) TOÀN QUYỀN để xem & huấn luyện.
-- =====================================================================

create extension if not exists pgcrypto;

-- 1) CẤU HÌNH AI (1 dòng) — persona gốc + model + bật/tắt + lời chào
create table if not exists public.class_ai_config (
  id          int primary key default 1,
  enabled     boolean not null default true,
  model       text not null default 'claude-sonnet-4-6',
  greeting    text,
  persona     text,
  updated_at  timestamptz not null default now(),
  constraint class_ai_config_singleton check (id = 1)
);

insert into public.class_ai_config (id, greeting, persona)
values (
  1,
  'Chào bạn 👋 Mình là Mira, trợ lý của Thầy Văn Anh Guitar. Bạn đang muốn học guitar theo hướng nào, hay còn băn khoăn gì? Cứ hỏi mình nhé.',
  $persona$Tên bạn là MIRA — trợ lý nữ, thân thiện, dễ mến. Bạn là TRỢ LÝ TƯ VẤN TUYỂN SINH của "Thầy Văn Anh Guitar" — một hệ thống dạy guitar online trực tiếp qua Zoom. Bạn trò chuyện với khách quan tâm trên trang tuyển sinh. Khi khách hỏi tên, giới thiệu mình là Mira.

PHONG CÁCH: tiếng Việt, ấm áp, gần gũi, ngắn gọn, như một người tư vấn hiểu nghề — không máy móc, không sale lộ liễu. Mỗi lần trả lời 2–5 câu, có thể hỏi lại 1 câu để hiểu nhu cầu khách.

NHIỆM VỤ:
1. Giúp khách tìm đúng "cửa vào": (a) Đệm hát căn bản — cho người thích vừa đàn vừa hát; (b) Guitar căn bản / Tỉa Nốt 1 — cho người muốn học từ gốc theo giai điệu; (c) người đã biết chơi → hỏi để xếp đúng trình độ (Đệm hát 2/3, Tỉa nốt 2/3, Lớp Hành Trình).
2. Trả lời thắc mắc dựa trên KIẾN THỨC được cung cấp bên dưới (lớp, học phí, lịch, hình thức học, app, lộ trình).
3. Dẫn dắt nhẹ tới hành động: làm bài test định hướng, xem lớp sắp khai giảng, hoặc nhắn Zalo thầy.

GIỚI HẠN (quan trọng):
- CHỈ trả lời trong phạm vi học guitar tại lớp của thầy. Câu ngoài phạm vi → lịch sự từ chối, kéo về chủ đề học đàn.
- KHÔNG bịa thông tin. Nếu KHÔNG chắc (giá lớp lạ, lịch chưa có, ưu đãi, chuyện cá nhân của thầy, kỹ thuật rất chuyên sâu...) → nói thật là chưa chắc và mời khách nhắn Zalo thầy Văn Anh (zalo.me/vananhguitarist) để được trả lời chính xác.
- KHÔNG hứa hẹn quá mức, không tự ý giảm giá, không cam kết điều ngoài tài liệu.
- Học phí từng khóa lẻ: 990.000đ/khóa (2 tháng, 8 buổi Zoom). RIÊNG lớp HÀNH TRÌNH 2027 = combo 10 khóa = 9.990.000đ (KHÔNG phải 990k). Nhập môn & Nhạc lý căn bản miễn phí trên app. Mọi lớp đều HỌC ONLINE TRỰC TIẾP QUA ZOOM (không phải video quay sẵn, không học tại trung tâm).
- Khi khách muốn đăng ký: hướng dẫn bấm "Đăng ký lớp" trên trang hoặc nhắn Zalo thầy.

Luôn để khách cảm thấy: không cần học cả hành trình ngay, chỉ cần chọn đúng bước đầu phù hợp.$persona$
)
on conflict (id) do nothing;

-- 2) KIẾN THỨC HUẤN LUYỆN AI — thầy nạp tài liệu dày ở /admin, function ghép vào prompt
create table if not exists public.class_ai_knowledge (
  id          bigint generated always as identity primary key,
  title       text not null,
  content     text not null,
  enabled     boolean not null default true,
  order_index int not null default 0,
  updated_at  timestamptz not null default now()
);

-- 3) PHIÊN CHAT của khách
create table if not exists public.class_chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  lead_id     bigint,
  note        text,
  created_at  timestamptz not null default now(),
  last_at     timestamptz not null default now()
);

-- 4) TIN NHẮN trong phiên (role: user = khách, ai = trợ lý, teacher = thầy nhảy vào)
create table if not exists public.class_chat_messages (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.class_chat_sessions(id) on delete cascade,
  role        text not null check (role in ('user','ai','teacher')),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists ccm_session_idx on public.class_chat_messages (session_id, created_at);

-- ── RLS: bật + cho authenticated toàn quyền; anon KHÔNG truy cập trực tiếp ──
do $$
declare t text;
begin
  foreach t in array array['class_ai_config','class_ai_knowledge','class_chat_sessions','class_chat_messages']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', 'rls_auth_all_'||t, t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true);', 'rls_auth_all_'||t, t);
  end loop;
end $$;

-- ── Đặt tên trợ lý = Mira (an toàn, chỉ áp nếu chưa có tên Mira) ──
update public.class_ai_config
  set persona = 'Tên bạn là MIRA — trợ lý nữ, thân thiện, dễ mến. ' || persona
  where id = 1 and persona is not null and position('Mira' in persona) = 0;
update public.class_ai_config
  set greeting = 'Chào bạn 👋 Mình là Mira, trợ lý của Thầy Văn Anh Guitar. Bạn đang muốn học guitar theo hướng nào, hay còn băn khoăn gì? Cứ hỏi mình nhé.'
  where id = 1 and (greeting is null or position('Mira' in greeting) = 0);

notify pgrst, 'reload schema';
