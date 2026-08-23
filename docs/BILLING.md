# BILLING.md — Billing Foundation Class 2.0

> BƯỚC 8A — PHA B · Ngày 23/08/2026 · Trạng thái: **code + test local xong, CHƯA chạy migration production, CHƯA deploy, CHƯA có provider.**

## 1. Mục tiêu

- Vận hành được **10.000 user** là kiến trúc đích (không mua/xây hạ tầng enterprise hôm nay).
- Dưới **1.000 user**: **80% automation + 20% manual fallback** — phần làm tay CHỈ là tạm thời, sẽ thay bằng automation/webhook, không viết lại nghiệp vụ.
- Billing Foundation này là phần **chắc chắn sẽ dùng** khi payment provider thật đến. Những phần phụ thuộc đặc tính provider → trì hoãn.

## 2. Bốn domain tách biệt

| Domain | Bảng | Ý nghĩa |
|---|---|---|
| **Billing** | `billing_customers`, `billing_provider_customers`, `billing_products`, `billing_subscriptions`, `billing_events` | Ai thanh toán, đăng ký gói nào, vòng đời subscription |
| **Payment** | `billing_payments` | Từng giao dịch tiền THẬT (tách khỏi subscription) |
| **Entitlement** | `packages`, `student_packages`, `edu_course_access`, `activate_student_package` | Quyền HỌC — **không đụng ở bước này** |
| **Student/Account** | `edu_students`, `auth.users`, `app_users` | Học viên — **không tự tạo ở bước này** |

Billing KHÔNG gọi entitlement. Entitlement không biết billing.

## 3. Bảng

### billing_customers — danh tính billing NỘI BỘ
`id, lead_id?, student_id?, name, email, phone, metadata, created_at, updated_at`
- Độc lập provider; một khách dùng được nhiều provider/phương thức.
- `lead_id`/`student_id` chỉ là liên kết mềm (SET NULL) — không giả định lead tồn tại mãi.

### billing_provider_customers — định danh bên provider
`id, billing_customer_id, provider, provider_customer_id, created_at, updated_at`
- `UNIQUE(provider, provider_customer_id)` + `UNIQUE(billing_customer_id, provider)`.
- Provider-specific IDs chỉ là metadata/reference ngoài.

### billing_products — catalog giá (nguồn sự thật DUY NHẤT của giá)
| package_code | amount (VND) | interval | trial |
|---|---|---|---|
| `khoi_dau_99` | 99.000 | 1 tháng | ✅ |
| `can_ban_396` | 396.000 | 1 tháng | ✅ |
| `nang_cao_499` | 499.000 | 1 tháng | ✅ |
| `hanh_trinh_9990` | 9.990.000 | 12 tháng | ❌ |

KHÔNG hardcode giá rải rác ngoài catalog này.

### billing_subscriptions
`id, customer_id, package_code (CHECK 4 mã), provider, provider_subscription_id,
status, trial_started_at, trial_ends_at, current_period_start, current_period_end,
cancel_at_period_end, cancelled_at, created_at, updated_at`
- `UNIQUE(provider, provider_subscription_id)`.
- `trial_started_at`/`trial_ends_at` = **source of truth mới** của trial Class 2.0.
- `leads.trial_started_at` là **legacy** (giữ nguyên, không DROP) — sync 1 chiều khi subscription vào trialing và customer có lead_id.

### billing_payments
`id, customer_id, subscription_id?, package_code?, amount, currency, provider,
provider_payment_id, status, paid_at, failed_at, failure_reason, note, created_at, updated_at`
- **Mỗi giao dịch/attempt mới = 1 record MỚI.** KHÔNG overwrite lịch sử thất bại.
- `UNIQUE(provider, provider_payment_id)`.
- KHÔNG lưu card number / CVV / expiry / raw credentials / PCI data.

### billing_events — audit + idempotency
`id, provider, external_event_id, event_type, business_event, payload (sanitized),
customer_id?, subscription_id?, payment_id?, status, processed_at, error, created_at`
- `UNIQUE(provider, external_event_id)` — webhook gửi 2–10 lần → xử lý 1 lần.

## 4. Status lifecycle (internal — độc lập provider)

**Subscription:** `pending → trialing → active → (past_due → active) → cancelled | expired`

| Business event | Điều kiện | Kết quả |
|---|---|---|
| `PAYMENT_METHOD_CONFIRMED` | pending + trial_eligibility + provider ≠ manual | → trialing (trial 1 tháng, period bắt đầu sau trial) |
| `PAYMENT_METHOD_CONFIRMED` | pending + (không trial hoặc manual) | → active (period từ hôm nay) |
| `SUBSCRIPTION_TRIAL_STARTED` | pending + trial_eligibility + không manual | → trialing |
| `PAYMENT_SUCCEEDED` | payment pending; sub pending | → sub active |
| `PAYMENT_SUCCEEDED` | payment pending; sub trialing | → giữ trialing (period đã đặt) |
| `PAYMENT_SUCCEEDED` | payment pending; sub past_due | → sub active (nối period) |
| `PAYMENT_SUCCEEDED` | payment pending; sub active | → gia hạn period |
| `PAYMENT_FAILED` | payment pending; sub active | → payment failed; sub past_due |
| `SUBSCRIPTION_CANCELLED` | pending/trialing/active/past_due | → cancelled (+cancelled_at) |
| `SUBSCRIPTION_CANCELLED` + `cancel_at_period_end=true` | active | → giữ active, đặt cờ, chờ hết period |

**Payment:** `pending → succeeded (paid_at)` · `pending → failed (failed_at, reason)`.
`failed → succeeded` trên CÙNG record KHÔNG tồn tại — attempt mới = record mới.
(Provider thật sau này có semantics khác thì adapter mapping — Core bảo toàn lịch sử tài chính.)

Transition ngoài bảng trên → **invalid transition** → event `failed` + `error` (audit/retry).

## 5. Billing Core — provider-neutral

Hàm (SECURITY DEFINER):

- `billing_ingest_event(provider, external_event_id, event_type, business_event, payload, customer_id?, subscription_id?, payment_id?)`
  - Insert event `received` → `ON CONFLICT (provider, external_event_id)` → **skipped_duplicate** (không apply lại, không overwrite).
  - Apply transition trong CÙNG transaction; thành công → event `processed`; thất bại → event `failed` + `error`.
  - Không bao giờ có trạng thái "processed nhưng state chưa đổi".
- `billing_apply_event_internal(...)` — transition map (bảng trên). Raise = invalid.
- `billing_record_manual_payment(lead_id?, package_code, amount?, transaction_ref, note?)` — **teacher only**
  - Chuyển khoản: **KHÔNG trial** (chính sách BƯỚC 7.2). Tạo payment mới mỗi lần; mã giao dịch trùng → bị chặn.
  - Đi qua **CÙNG** `billing_ingest_event('PAYMENT_SUCCEEDED')` như webhook tương lai → **1 nghiệp vụ, 2 nguồn**.
- `billing_sanitize_payload(jsonb)` — loại key nhạy cảm (card/cvv/…) trước khi lưu event.

**Manual fallback principle:** hôm nay admin xác nhận tay → `PAYMENT_SUCCEEDED` → Billing Core; ngày mai webhook provider → `PAYMENT_SUCCEEDED` → Billing Core. Không có hai hệ nghiệp vụ.

## 6. Provider Adapter boundary

`supabase/functions/_shared/billing/provider.ts` — interface `ProviderAdapter`:
`createCheckout / createSubscription / cancelSubscription / getSubscription /
verifyWebhookSignature / parseWebhookEvent / mapSubscriptionStatus`.

- **BƯỚC 8A:** `getProviderAdapter()` trả **null** → mọi request webhook bị từ chối (503).
- **KHÔNG** implement API cụ thể, **KHÔNG** giả signature, **KHÔNG** giả Stripe/provider đang liên hệ.
- Khi có provider: implement adapter + đọc env `BILLING_PROVIDER`; business code không đổi.

## 7. Webhook foundation

Edge function `billing-webhook` (Verify JWT: TẮT — xác thực bằng chữ ký provider):
`verifyWebhookSignature → parseWebhookEvent → billing_ingest_event → 200 {received, processed}`.
Event không nhận dạng được → 200 nhận nhưng không xử lý (không phá vỡ provider retry).

## 8. Security / RLS

- 6 bảng: RLS bật. **anon: không policy nào** (không SELECT/INSERT/UPDATE/DELETE).
- authenticated: CHỈ teacher `SELECT` (xem Billing trên Admin). Không policy write → mọi write qua SECURITY DEFINER functions.
- `billing_ingest_event`: revoke khỏi anon/authenticated → chỉ service_role (webhook) + gọi nội bộ.
- `billing_record_manual_payment`: chỉ authenticated + guard `is_teacher()`.
- KHÔNG expose service-role key ra frontend.
- 6 bảng nằm trong `self_managed` của `db/rls_setup.sql`.

## 9. Trạng thái hiện tại

> Cập nhật 23/08/2026 — RELEASE BILLING FOUNDATION (commit `bb2d652` + migration production PASS).

| Phần | Trạng thái |
|---|---|
| **BILLING FOUNDATION (data model + Billing Core + security + provider boundary)** | ✅ **PRODUCTION SCHEMA READY** (6 bảng + 4 products + 5 functions trên `wojmdilyflffvdtpovmq`) |
| **PAYMENT PROVIDER** | ⛔ **NOT CONFIGURED** (`getProviderAdapter()` = null; chưa chọn provider) |
| **CHECKOUT** | ⛔ **NOT ACTIVE** (không tồn tại; không form thẻ giả) |
| **WEBHOOK** | ⛔ **NOT DEPLOYED** (`billing-webhook` chưa deploy; URL 404) |
| **ENTITLEMENT AUTOMATION** | ⛔ **NOT CONNECTED** (không gọi activate_student_package) |
| **STUDENT/EMAIL AUTOMATION** | ⛔ **NOT CONNECTED** |

Billing state production đang **“ngủ”**: chỉ có data model + core + security, không có đường nào để khách thật thanh toán. Không có UI giả. `leads.trial_started_at` (vd lead 152 “Trần A”) giữ nguyên — chưa backfill.

## 10. Bước tiếp theo khi có provider (cần duyệt riêng)

1. Implement `ProviderAdapter` thật (checkout, subscription, webhook signature).
2. Bật env `BILLING_PROVIDER` + secret; deploy `billing-webhook`.
3. Nối flow: `#/dang-ky` → insert lead (giữ nguyên) → tạo `billing_customers` từ lead → `createCheckout` → redirect provider.
4. Webhook → `billing_ingest_event` → Billing state chuẩn.
5. Backfill lead đang "Đang trải nghiệm" cũ (script riêng, chạy sau khi provider chốt).
6. Entitlement/onboarding nối SAU khi Billing state chính xác.
