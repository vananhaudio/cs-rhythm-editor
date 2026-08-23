// =====================================================================
// BILLING PROVIDER BOUNDARY — provider-neutral (BƯỚC 8A — PHA B)
// ---------------------------------------------------------------------
// Đây CHỈ là contract/điểm cắm. KHÔNG implement provider thật.
// KHÔNG giả Stripe. KHÔNG giả provider đang liên hệ.
// Khi provider được chốt (có API/docs): implement 1 adapter thỏa
// interface này + đăng ký trong getProviderAdapter() qua env.
//
// Billing Core (edge functions billing-*) CHỈ nói chuyện qua interface
// này — không gọi API provider rải rác. Status nội bộ độc lập provider:
// adapter phải mapping qua mapSubscriptionStatus().
// =====================================================================

/** Internal subscription status — độc lập tên status của từng provider. */
export type InternalSubscriptionStatus =
  | 'pending'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'

/** Internal business events — provider KHÔNG biết, Core KHÔNG phụ thuộc provider. */
export type BusinessEvent =
  | 'PAYMENT_METHOD_CONFIRMED'
  | 'SUBSCRIPTION_TRIAL_STARTED'
  | 'PAYMENT_SUCCEEDED'
  | 'PAYMENT_FAILED'
  | 'SUBSCRIPTION_CANCELLED'

/** Event đã parse từ webhook thô (đã lược bỏ dữ liệu nhạy cảm). */
export interface ProviderEvent {
  /** ID ổn định từ provider — chống xử lý trùng (unique provider+external_event_id). */
  externalEventId: string
  /** Raw event type của provider (lưu audit). */
  eventType: string
  /** Business event đã map — adapter tự map hoặc để null nếu không nhận dạng được. */
  businessEvent: BusinessEvent | null
  /** Payload đã SANITIZE (KHÔNG card/CVV/PCI). */
  payload: Record<string, unknown>
  /** ID nội bộ nếu event mang theo (subscription/payment/customer). */
  subscriptionId?: string | null
  paymentId?: string | null
  customerId?: string | null
}

export interface CheckoutInput {
  customerId: number
  packageCode: string
  successUrl?: string
  cancelUrl?: string
}

export interface CheckoutResult {
  /** URL hosted checkout của provider để redirect khách. */
  checkoutUrl: string
  /** Tham chiếu ngoài (session/subscription id của provider) nếu có. */
  referenceId?: string
}

/**
 * Contract tối thiểu — triển khai khi có provider thật.
 * Tên hàm điều chỉnh theo provider nhưng Billing Core chỉ dùng interface này.
 */
export interface ProviderAdapter {
  readonly id: string
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>
  createSubscription(input: {
    customerId: number
    packageCode: string
    providerCustomerId?: string
  }): Promise<{ providerSubscriptionId: string }>
  cancelSubscription(providerSubscriptionId: string): Promise<void>
  getSubscription(providerSubscriptionId: string): Promise<{ rawStatus: string }>
  /** Xác thực chữ ký webhook — implementation CỤ THỂ chờ provider. */
  verifyWebhookSignature(request: Request): Promise<boolean>
  /** Parse body webhook thô → ProviderEvent (sau khi sanitize). */
  parseWebhookEvent(rawBody: string): Promise<ProviderEvent | null>
  /** Map raw provider status → InternalSubscriptionStatus. */
  mapSubscriptionStatus(rawStatus: string): InternalSubscriptionStatus
}

/**
 * Trả adapter của provider đang bật — BƯỚC 8A: LUÔN null (chưa chốt provider).
 * Khi chốt provider: đọc `BILLING_PROVIDER` env, khởi tạo adapter tương ứng.
 * Production KHÔNG set env → KHÔNG thể vô tình bật adapter sai.
 */
export function getProviderAdapter(): ProviderAdapter | null {
  return null
}
