-- Chat Mail — bảng lưu lịch sử gửi mail nhanh (dùng chung project cs-rhythm-editor).
-- Chạy trong Supabase → SQL Editor của project wojmdilyflffvdtpovmq.

-- Danh sách người nhận cho gửi nhanh
create table if not exists chat_mail_lists (
  id         uuid default gen_random_uuid() primary key,
  created_at timestamptz not null default now(),
  name       text        not null,
  emails     text[]      not null default '{}'
);

-- Mỗi thread là một lần soạn & gửi mail
create table if not exists chat_mails (
  id         uuid default gen_random_uuid() primary key,
  created_at timestamptz not null default now(),
  subject    text        not null default '',
  recipients text[]      not null default '{}',
  list_id    uuid        references chat_mail_lists(id) on delete set null,
  last_at    timestamptz not null default now(),
  status     text        not null default 'draft'  -- draft | sending | sent | partial | failed
);

-- Từng email đã gửi
create table if not exists chat_mail_messages (
  id         uuid default gen_random_uuid() primary key,
  created_at timestamptz not null default now(),
  thread_id  uuid        not null references chat_mails(id) on delete cascade,
  to_email   text        not null,
  subject    text        not null,
  content    text        not null,
  status     text        not null default 'pending',  -- pending | sent | failed
  error      text
);

-- Index
create index if not exists idx_chat_mails_last     on chat_mails (last_at desc);
create index if not exists idx_chat_mail_msgs_thread on chat_mail_messages (thread_id);

-- RLS (service role bỏ qua)
alter table chat_mail_lists    enable row level security;
alter table chat_mails         enable row level security;
alter table chat_mail_messages enable row level security;
