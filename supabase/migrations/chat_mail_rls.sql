-- RLS policies cho Chat Mail — cho phép authenticated user đọc/ghi bảng chat_mail.
-- Chạy trong Supabase SQL Editor.

-- Cho phép authenticated user đọc tất cả
create policy "Authenticated can read chat_mails"
  on chat_mails for select
  to authenticated
  using (true);

create policy "Authenticated can insert chat_mails"
  on chat_mails for insert
  to authenticated
  with check (true);

create policy "Authenticated can update chat_mails"
  on chat_mails for update
  to authenticated
  using (true);

create policy "Authenticated can delete chat_mails"
  on chat_mails for delete
  to authenticated
  using (true);

-- chat_mail_messages
create policy "Authenticated can read chat_mail_messages"
  on chat_mail_messages for select
  to authenticated
  using (true);

create policy "Authenticated can insert chat_mail_messages"
  on chat_mail_messages for insert
  to authenticated
  with check (true);

-- chat_mail_lists
create policy "Authenticated can read chat_mail_lists"
  on chat_mail_lists for select
  to authenticated
  using (true);

create policy "Authenticated can insert chat_mail_lists"
  on chat_mail_lists for insert
  to authenticated
  with check (true);

create policy "Authenticated can delete chat_mail_lists"
  on chat_mail_lists for delete
  to authenticated
  using (true);
