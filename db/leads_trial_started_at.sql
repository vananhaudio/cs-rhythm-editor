-- BƯỚC 7 — Ngày bắt đầu trải nghiệm của lead Class 2.0.
-- trial_started_at = thời điểm khách THỰC SỰ bắt đầu tháng trải nghiệm miễn phí
-- (khác created_at = thời điểm đăng ký; khác status Đã xác nhận = Thầy đã xác nhận).
-- Backward-compatible: nullable → lead cũ giữ NULL. KHÔNG thêm trial_ends_at/subscription.
-- RLS hiện tại đã đủ: leads_auth_update (using/with check true) cho admin update cột mới.

alter table public.leads
  add column if not exists trial_started_at timestamptz;

-- Không index: truy vấn theo trial_started_at chưa cần ở bước này.
