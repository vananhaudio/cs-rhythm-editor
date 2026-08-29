import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from './supabase'
import {
  APPLE_PRODUCT_TIER,
  APPLE_SUBSCRIPTION_PRODUCTS,
  getCurrentEntitlements,
  getIAPProducts,
  IAP_PROVIDER,
  isNativeIAP,
  manageSubscriptions,
  purchaseProduct,
  restorePurchases,
  TIER_LABEL,
  type IAPEntitlement,
  type IAPProduct,
  type SubscriptionTier,
} from './iap'

type SyncResult = {
  ok?: boolean
  error?: string
  reason?: string
  request_id?: string
  tier?: SubscriptionTier
  effective?: { effective_tier?: string; source?: string }
}

const COLORS = {
  bg: '#F6F5FB',
  surface: '#FFFFFF',
  soft: '#EFECF8',
  text: '#211C32',
  muted: '#464160',
  faint: '#8B87A0',
  border: '#DDD8EC',
  primary: '#4338CA',
  primaryDark: '#352BA3',
  danger: '#B42318',
  ok: '#166534',
}

const PLAN_TAGLINE: Record<SubscriptionTier, string> = {
  khoi_dau_99: 'Học và luyện tập nền tảng',
  can_ban_396: 'Mở rộng lộ trình học',
  nang_cao_499: 'Sắp có',
}

// onBack: khi nhúng overlay trong portal → đóng overlay (giữ nguyên context);
// khi chạy như route /subscribe độc lập → về /start như cũ.
export default function SubscriptionPage({ onBack }: { onBack?: () => void } = {}) {
  const goBack = () => { if (onBack) onBack(); else window.location.href = '/start' }
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<IAPProduct[]>([])
  const [sessionReady, setSessionReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const [effectiveTier, setEffectiveTier] = useState<string>('free')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showLogin, setShowLogin] = useState(false)

  const sortedProducts = useMemo(() => {
    const order = new Map<string, number>(APPLE_SUBSCRIPTION_PRODUCTS.map((id, index) => [id, index]))
    return [...products].sort((a, b) => (order.get(a.productId) ?? 99) - (order.get(b.productId) ?? 99))
  }, [products])

  const selectableProducts = sortedProducts.filter((p) => APPLE_PRODUCT_TIER[p.productId] !== 'nang_cao_499')
  const advancedProduct = sortedProducts.find((p) => APPLE_PRODUCT_TIER[p.productId] === 'nang_cao_499')
  const selectedProduct = selectableProducts.find((p) => p.productId === selectedId) ?? null

  useEffect(() => {
    void boot()
  }, [])

  // Chọn mặc định gói đầu tiên khi products về (chỉ set 1 lần, không đè lựa chọn của user)
  useEffect(() => {
    if (!selectedId && selectableProducts.length) setSelectedId(selectableProducts[0].productId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products])

  async function boot() {
    setLoading(true)
    setMessage(null)
    const { data: { session } } = await supabase.auth.getSession()
    setSessionReady(Boolean(session?.user))
    await Promise.all([loadProducts(), loadEffective()])
    setLoading(false)
  }

  async function loadProducts() {
    if (!isNativeIAP) {
      setProducts([])
      return
    }
    const list = await getIAPProducts()
    setProducts(list.filter((p) => APPLE_PRODUCT_TIER[p.productId]))
  }

  async function loadEffective() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      setEffectiveTier('free')
      return
    }
    const { data: student } = await supabase
      .from('edu_students')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (!student?.id) {
      setEffectiveTier('free')
      return
    }
    const { data } = await supabase.rpc('get_effective_student_entitlement', { p_student_id: student.id })
    const row = Array.isArray(data) ? data[0] : data
    setEffectiveTier(row?.effective_tier ?? 'free')
  }

  async function login(): Promise<boolean> {
    if (!email.trim() || !password.trim()) {
      setMessage({ type: 'err', text: 'Nhập email và mật khẩu để tiếp tục.' })
      return false
    }
    setBusy('login')
    setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(null)
    if (error) {
      setMessage({ type: 'err', text: 'Đăng nhập chưa thành công. Kiểm tra lại email hoặc mật khẩu.' })
      return false
    }
    setSessionReady(true)
    setShowLogin(false)
    await loadEffective()
    return true
  }

  async function syncTransaction(entitlement: IAPEntitlement): Promise<SyncResult> {
    if (IAP_PROVIDER === 'google' ? !entitlement.purchaseToken : (!entitlement.signedTransactionInfo && !entitlement.transactionId)) {
      return { error: 'missing_transaction' }
    }
    const accessToken = await getValidAccessToken()
    if (!accessToken) {
      setSessionReady(false)
      return { error: 'invalid_local_session' }
    }
    const clientRequestId = crypto.randomUUID()
    console.info('[subscription] sync_request', {
      requestId: clientRequestId,
      provider: IAP_PROVIDER,
      productId: entitlement.productId,
      hasSignedTransactionInfo: Boolean(entitlement.signedTransactionInfo),
      hasTransactionId: Boolean(entitlement.transactionId),
      hasPurchaseToken: Boolean(entitlement.purchaseToken),
      hasAccessToken: true,
    })
    const syncFunction = IAP_PROVIDER === 'google' ? 'google-subscription-sync' : 'apple-subscription-sync'
    const syncBody = IAP_PROVIDER === 'google'
      ? { purchaseToken: entitlement.purchaseToken, productId: entitlement.productId, clientRequestId }
      : { signedTransactionInfo: entitlement.signedTransactionInfo, transactionId: entitlement.transactionId, clientRequestId }
    const { data, error } = await supabase.functions.invoke(syncFunction, {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: syncBody,
    })
    if (error) {
      const details = await readFunctionError(error)
      console.info('[subscription] sync_error', {
        requestId: clientRequestId,
        productId: entitlement.productId,
        error: details.error,
        reason: details.reason,
      })
      return { ...details, request_id: clientRequestId }
    }
    console.info('[subscription] sync_result', {
      requestId: clientRequestId,
      productId: entitlement.productId,
      ok: Boolean((data as SyncResult)?.ok),
      tier: (data as SyncResult)?.tier ?? null,
    })
    return { ...(data as SyncResult), request_id: clientRequestId }
  }

  async function buy(product: IAPProduct) {
    console.info('[subscription] purchase_button_clicked', { productId: product.productId, loggedIn: sessionReady })
    if (!sessionReady) {
      setShowLogin(true)
      return
    }
    setBusy(product.productId)
    setMessage({ type: 'info', text: 'Đang mở giao dịch App Store...' })
    try {
      console.info('[subscription] purchase_native_call', { productId: product.productId })
      const result = await purchaseProduct(product.productId)
      console.info('[subscription] purchase_native_result', { productId: product.productId, status: result.status })
      if (result.status === 'cancelled') {
        setMessage({ type: 'info', text: 'Bạn đã hủy giao dịch. Chưa có gói nào được kích hoạt.' })
        return
      }
      if (result.status === 'pending') {
        setMessage({ type: 'info', text: 'Giao dịch đang chờ App Store xử lý. Mở lại màn này để kiểm tra sau.' })
        return
      }
      const synced = await syncTransaction(result)
      if (!synced.ok) {
        setMessage({ type: 'err', text: syncFailureMessage(synced) })
        return
      }
      setEffectiveTier(synced.effective?.effective_tier ?? synced.tier ?? 'free')
      setMessage({ type: 'ok', text: `Gói ${TIER_LABEL[synced.tier as SubscriptionTier] ?? 'đăng ký'} đã được kích hoạt.` })
    } catch (e: any) {
      const text = String(e?.message ?? '')
      const code = e?.code ? ` (${String(e.code)})` : ''
      console.info('[subscription] purchase_native_error', { productId: product.productId, code: e?.code ?? null, message: text })
      if (!text.toLowerCase().includes('cancel')) {
        setMessage({ type: 'err', text: `Không thể mở giao dịch App Store${code}: ${text || 'Không hoàn tất được giao dịch.'}` })
      }
    } finally {
      setBusy(null)
    }
  }

  async function continuePurchase() {
    if (!selectedProduct) return
    if (!sessionReady) {
      setShowLogin(true)
      return
    }
    await buy(selectedProduct)
  }

  async function loginThenPurchase() {
    const ok = await login()
    if (ok && selectedProduct) await buy(selectedProduct)
  }

  async function restore() {
    if (!sessionReady) {
      setShowLogin(true)
      setMessage({ type: 'info', text: 'Đăng nhập trước khi khôi phục giao dịch.' })
      return
    }
    setBusy('restore')
    setMessage({ type: 'info', text: 'Đang kiểm tra giao dịch App Store trên thiết bị...' })
    try {
      let entitlements = await getCurrentEntitlements()
      if (!entitlements.length) {
        setMessage({ type: 'info', text: 'Chưa thấy giao dịch trên thiết bị. Đang hỏi lại App Store...' })
        await restorePurchases()
        entitlements = await getCurrentEntitlements()
      }
      const results = await Promise.all(entitlements.map(syncTransaction))
      const ok = results.filter((r) => r.ok)
      if (!ok.length) {
        const failed = results.find((r) => r.error)
        setMessage({
          type: failed ? 'err' : 'info',
          text: failed ? syncFailureMessage(failed) : 'Chưa tìm thấy gói App Store còn hiệu lực để khôi phục.',
        })
        return
      }
      await loadEffective()
      setMessage({ type: 'ok', text: 'Đã khôi phục giao dịch và cập nhật quyền học.' })
    } catch {
      setMessage({ type: 'err', text: 'Không khôi phục được giao dịch.' })
    } finally {
      setBusy(null)
    }
  }

  async function openManage() {
    setBusy('manage')
    setMessage(null)
    try {
      await manageSubscriptions()
    } catch {
      setMessage({ type: 'err', text: 'Không mở được màn quản lý đăng ký của Apple.' })
    } finally {
      setBusy(null)
    }
  }

  const currentTierLabel = TIER_LABEL[effectiveTier as SubscriptionTier]
  const selectedTrial = selectedProduct ? trialLabel(selectedProduct) : null

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: COLORS.bg, fontFamily: '"Segoe UI", Inter, system-ui, sans-serif', color: COLORS.text, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
      <main style={{ width: '100%', maxWidth: 430, margin: '0 auto', boxSizing: 'border-box', padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 18px calc(env(safe-area-inset-bottom, 0px) + 12px)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

        {/* Header gọn */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={goBack} style={linkButton()}>‹ Quay lại</button>
          <span style={{ fontSize: 12, color: COLORS.faint, fontWeight: 700 }}>Thầy Văn Anh Guitar</span>
        </div>
        <h1 style={{ margin: '6px 0 2px', fontSize: 24, lineHeight: 1.15, fontWeight: 850 }}>Chọn gói học</h1>
        <p style={{ margin: '0 0 10px', color: COLORS.muted, fontSize: 13.5, lineHeight: 1.45 }}>
          Chọn mức phù hợp với hành trình của bạn.
          {' '}<span style={{ color: COLORS.faint }}>
            {currentTierLabel ? `Gói hiện tại: ${currentTierLabel}.` : 'Bạn đang dùng Free.'}
          </span>
        </p>

        {loading && <div style={notice('info')}>Đang tải gói từ App Store...</div>}
        {!loading && isNativeIAP && sortedProducts.length === 0 && (
          <div style={notice('err')}>Chưa tải được gói đăng ký từ App Store. Thử lại sau.</div>
        )}
        {!isNativeIAP && (
          <div style={notice('info')}>Mua gói chỉ hiển thị trong app TVA Guitar (iOS/Android).</div>
        )}

        {/* Options — radio compact */}
        <div style={{ display: 'grid', gap: 8 }}>
          {selectableProducts.map((product) => {
            const tier = APPLE_PRODUCT_TIER[product.productId]
            const selected = product.productId === selectedId
            const trial = trialLabel(product)
            return (
              <button key={product.productId} onClick={() => setSelectedId(product.productId)} style={optionRow(selected)}>
                <span style={radio(selected)}>{selected ? '✓' : ''}</span>
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 16 }}>{TIER_LABEL[tier]}</strong>
                    {tier === 'can_ban_396' && <span style={popularBadge()}>Phổ biến</span>}
                    {effectiveTier === tier && <span style={currentBadge()}>Gói hiện tại</span>}
                  </span>
                  <span style={{ display: 'block', fontSize: 12.5, color: COLORS.muted, marginTop: 2 }}>
                    {PLAN_TAGLINE[tier]}{trial ? ` · ${trial}` : ''}
                  </span>
                </span>
                <span style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 850 }}>{product.price}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: COLORS.faint }}>{periodLabel(product)}</span>
                </span>
              </button>
            )
          })}

          {/* Nâng cao — disabled, không selectable, không purchase */}
          {(advancedProduct || selectableProducts.length > 0) && (
            <div style={{ ...optionRow(false), opacity: 0.55, cursor: 'default' }}>
              <span style={radio(false)} />
              <span style={{ flex: 1, textAlign: 'left' }}>
                <strong style={{ fontSize: 16 }}>{TIER_LABEL.nang_cao_499}</strong>
                <span style={{ display: 'block', fontSize: 12.5, color: COLORS.muted, marginTop: 2 }}>Sắp có</span>
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.faint }}>Sắp có</span>
            </div>
          )}
        </div>

        {/* Login inline — chỉ hiện khi cần (bấm Tiếp tục mà chưa đăng nhập) */}
        {showLogin && !sessionReady && (
          <div style={{ marginTop: 10, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 8 }}>Đăng nhập để gói được gắn đúng tài khoản</div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" style={input()} />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Mật khẩu" style={{ ...input(), marginTop: 8 }} />
          </div>
        )}

        {message && <div style={notice(message.type)}>{message.text}</div>}

        {/* CTA duy nhất */}
        <button
          onClick={showLogin && !sessionReady ? loginThenPurchase : continuePurchase}
          disabled={!selectedProduct || busy !== null}
          style={cta(!selectedProduct || busy !== null)}>
          {busy === 'login' ? 'Đang đăng nhập...'
            : busy && busy !== 'restore' && busy !== 'manage' ? 'Đang xử lý...'
            : showLogin && !sessionReady ? 'Đăng nhập và tiếp tục'
            : 'Tiếp tục'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 12.5, color: COLORS.muted, marginTop: 8 }}>
          Bạn đang dùng Free — <button onClick={goBack} style={{ ...linkButton(), padding: 0, fontSize: 12.5 }}>tiếp tục dùng Free bất cứ lúc nào</button>.
        </div>

        {/* Footer legal — đẩy xuống đáy */}
        <footer style={{ marginTop: 'auto', paddingTop: 12, color: COLORS.faint, fontSize: 11, lineHeight: 1.55, textAlign: 'center' }}>
          {IAP_PROVIDER === 'google'
            ? 'Đăng ký tự động gia hạn theo giá Google Play; thanh toán tính vào tài khoản Google. Quản lý hoặc hủy trong Google Play → Đăng ký.'
            : 'Đăng ký tự động gia hạn theo giá App Store; thanh toán tính vào Apple ID. Quản lý hoặc hủy trong cài đặt App Store.'}
          {selectedTrial ? ' Sau thời gian dùng thử, gói tự chuyển sang trả phí nếu không hủy.' : ''}
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 10px' }}>
            <button onClick={restore} disabled={busy === 'restore'} style={footLink()}>{busy === 'restore' ? 'Đang khôi phục...' : 'Khôi phục giao dịch'}</button>
            <span>·</span>
            <button onClick={openManage} disabled={busy === 'manage'} style={footLink()}>Quản lý đăng ký</button>
            <span>·</span>
            <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noreferrer" style={{ ...footLink(), textDecoration: 'underline' }}>Điều khoản</a>
            <span>·</span>
            <a href="https://timming.vananhaudio.com/tvaprivacy" target="_blank" rel="noreferrer" style={{ ...footLink(), textDecoration: 'underline' }}>Quyền riêng tư</a>
          </div>
        </footer>
      </main>
    </div>
  )
}

function periodLabel(product: IAPProduct): string {
  if (product.subscriptionPeriodUnit === 'month' && product.subscriptionPeriodValue === 1) return '/ tháng'
  if (product.subscriptionPeriod) return `/ ${product.subscriptionPeriod}`
  return ''
}

function trialLabel(product: IAPProduct): string | null {
  if (product.introOfferPaymentMode !== 'freeTrial') return null
  const value = product.introOfferPeriodValue
  const unit = product.introOfferPeriodUnit
  if (!value || !unit) return 'Dùng thử miễn phí'
  const unitVi: Record<string, string> = { day: 'ngày', week: 'tuần', month: 'tháng', year: 'năm' }
  return `Dùng thử miễn phí ${value} ${unitVi[unit] ?? unit}`
}

function optionRow(selected: boolean): CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box',
    background: COLORS.surface, border: `2px solid ${selected ? COLORS.primary : COLORS.border}`,
    borderRadius: 14, padding: '11px 12px', cursor: 'pointer', fontFamily: 'inherit', color: COLORS.text,
    boxShadow: selected ? '0 6px 16px rgba(67,56,202,.14)' : '0 3px 10px rgba(33,28,50,.05)',
  }
}

function radio(selected: boolean): CSSProperties {
  return {
    width: 22, height: 22, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
    border: `2px solid ${selected ? COLORS.primary : COLORS.border}`,
    background: selected ? COLORS.primary : 'transparent', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900,
  }
}

function popularBadge(): CSSProperties {
  return { background: COLORS.primary, color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 10.5, fontWeight: 800, flexShrink: 0 }
}

function currentBadge(): CSSProperties {
  return { background: COLORS.soft, color: COLORS.primaryDark, borderRadius: 999, padding: '2px 8px', fontSize: 10.5, fontWeight: 800, flexShrink: 0 }
}

function cta(disabled: boolean): CSSProperties {
  return {
    marginTop: 10, width: '100%', border: 'none', borderRadius: 13,
    background: disabled ? COLORS.border : COLORS.primary, color: disabled ? COLORS.faint : '#fff',
    fontSize: 16, fontWeight: 850, padding: '14px', fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer',
  }
}

function input(): CSSProperties {
  return { width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '11px 12px', fontSize: 16, fontFamily: 'inherit', outline: 'none', background: '#fff' }
}

function linkButton(): CSSProperties {
  return { border: 'none', background: 'transparent', color: COLORS.primary, fontSize: 14, fontWeight: 800, padding: '6px 0', fontFamily: 'inherit', cursor: 'pointer' }
}

function footLink(): CSSProperties {
  return { border: 'none', background: 'transparent', color: COLORS.faint, fontSize: 11, fontWeight: 700, padding: 0, fontFamily: 'inherit', cursor: 'pointer' }
}

function notice(type: 'ok' | 'err' | 'info'): CSSProperties {
  const color = type === 'ok' ? COLORS.ok : type === 'err' ? COLORS.danger : COLORS.muted
  return { background: COLORS.surface, border: `1px solid ${COLORS.border}`, color, borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.45, marginTop: 8 }
}

async function readFunctionError(error: any): Promise<SyncResult> {
  const fallback = String(error?.message ?? 'sync_failed')
  const context = error?.context
  if (!context?.clone) return { error: fallback }
  try {
    const body = await context.clone().json()
    return {
      error: safeText(body?.error) || fallback,
      reason: safeText(body?.reason),
    }
  } catch {
    return { error: fallback }
  }
}

async function getValidAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null

  const { data: userData, error: userError } = await supabase.auth.getUser(session.access_token)
  if (!userError && userData.user) return session.access_token

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError || !refreshed.session?.access_token) return null

  const { data: refreshedUser, error: refreshedUserError } = await supabase.auth.getUser(refreshed.session.access_token)
  if (refreshedUserError || !refreshedUser.user) return null

  return refreshed.session.access_token
}

function syncFailureMessage(result: SyncResult): string {
  const code = result.error ? ` (${result.error})` : ''
  const reason = result.reason ? ` Chi tiết: ${result.reason}` : ''
  const request = result.request_id ? ` Mã kiểm tra: ${result.request_id}` : ''
  return `Giao dịch đã hoàn tất trên App Store nhưng quyền học chưa được đồng bộ${code}.${reason}${request} Bấm Khôi phục giao dịch để thử đồng bộ lại.`
}

function safeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.replace(/[A-Za-z0-9_-]{80,}/g, '[hidden]').slice(0, 240)
}
