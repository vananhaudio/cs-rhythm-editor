-- LEADS PHONE NULLABLE — preview vòng redesign flow đăng ký (2/9/2026)
-- ------------------------------------------------------------------------------
-- CHƯA APPLY PRODUCTION. Flow mới chỉ hỏi Họ tên + Email trước thanh toán
-- (số điện thoại/Zalo thu SAU thanh toán/onboarding — không hỏi lúc giao dịch).
-- leads.phone hiện NOT NULL → bỏ ràng buộc (backward-compatible: lead cũ vẫn có
-- giá trị; chỉ cho phép lead mới không cần phone). Email 1 KHÔNG dùng phone.
-- Code preview insert KHÔNG kèm phone (submitRegistration trong ClassLandingPage);
-- preview dev KHÔNG insert thật (mock + log). Khi duyệt: chạy file này rồi deploy
-- bản production build.

alter table public.leads
  alter column phone drop not null;
