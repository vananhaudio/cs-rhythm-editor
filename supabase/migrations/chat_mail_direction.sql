-- Thêm cột direction cho chat_mail_messages để phân biệt mail gửi đi và reply.
alter table chat_mail_messages add column if not exists direction text not null default 'outbound';
-- 'outbound' = mail ta gửi đi, 'inbound' = reply từ khách
