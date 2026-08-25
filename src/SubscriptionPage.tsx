import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from './supabase'
import {
  APPLE_PRODUCT_TIER,
  APPLE_SUBSCRIPTION_PRODUCTS,
  getCurrentEntitlements,
  getIAPProducts,
  isNativeIOS,
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
  border: '#DDD8EC',
  primary: '#4338CA',
  primaryDark: '#352BA3',
  danger: '#B42318',
  ok: '#166534',
}

const planCopy: Record<SubscriptionTier, { tag: string; description: string }> = {
  khoi_dau_99: {
    tag: 'Bắt đầu',
    description: 'Mở quyền học nền tảng để vào lộ trình guitar cùng Thầy Văn Anh.',
  },
  can_ban_396: {
    tag: 'Đều đặn',
    description: 'Mở rộng lộ trình học và luyện tập căn bản cho người muốn đi chắc hơn.',
  },
  nang_cao_499: {
    tag: 'Đầy đủ',
    description: 'Mở quyền nâng cao cho học viên muốn đào sâu kỹ năng và lộ trình.',
  },
}

const BUILD_DIAGNOSTIC = 'TVA 1.2.0 (10) · bundled'

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<IAPProduct[]>([])
  const [sessionReady, setSessionReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busyProduct, setBusyProduct] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const [effectiveTier, setEffectiveTier] = useState<string>('free')

  const sortedProducts = useMemo(() => {
    const order = new Map<string, number>(APPLE_SUBSCRIPTION_PRODUCTS.map((id, index) => [id, index]))
    return [...products].sort((a, b) => (order.get(a.productId) ?? 99) - (order.get(b.productId) ?? 99))
  }, [products])

  useEffect(() => {
    void boot()
  }, [])

  async function boot() {
    setLoading(true)
    setMessage(null)
    const { data: { session } } = await supabase.auth.getSession()
    setSessionReady(Boolean(session?.user))
    await Promise.all([loadProducts(), loadEffective()])
    setLoading(false)
  }

  async function loadProducts() {
    if (!isNativeIOS) {
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

  async function login() {
    if (!email.trim() || !password.trim()) {
      setMessage({ type: 'err', text: 'Nhập email và mật khẩu để tiếp tục.' })
      return
    }
    setBusyProduct('login')
    setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusyProduct(null)
    if (error) {
      setMessage({ type: 'err', text: 'Đăng nhập chưa thành công. Kiểm tra lại email hoặc mật khẩu.' })
      return
    }
    setSessionReady(true)
    await loadEffective()
  }

  async function syncTransaction(entitlement: IAPEntitlement): Promise<SyncResult> {
    if (!entitlement.signedTransactionInfo && !entitlement.transactionId) {
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
      productId: entitlement.productId,
      hasSignedTransactionInfo: Boolean(entitlement.signedTransactionInfo),
      hasTransactionId: Boolean(entitlement.transactionId),
      hasAccessToken: true,
    })
    const { data, error } = await supabase.functions.invoke('apple-subscription-sync', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        signedTransactionInfo: entitlement.signedTransactionInfo,
        transactionId: entitlement.transactionId,
        clientRequestId,
      },
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
      setMessage({ type: 'err', text: 'Đăng nhập trước để gói mua được gắn đúng vào tài khoản của bạn.' })
      return
    }
    setBusyProduct(product.productId)
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
      setBusyProduct(null)
    }
  }

  async function restore() {
    if (!sessionReady) {
      setMessage({ type: 'err', text: 'Đăng nhập trước khi khôi phục giao dịch.' })
      return
    }
    setBusyProduct('restore')
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
      setBusyProduct(null)
    }
  }

  async function openManage() {
    setBusyProduct('manage')
    setMessage(null)
    try {
      await manageSubscriptions()
    } catch {
      setMessage({ type: 'err', text: 'Không mở được màn quản lý đăng ký của Apple.' })
    } finally {
      setBusyProduct(null)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', maxWidth: '100vw', minWidth: 0, minHeight: '100dvh', overflowX: 'hidden', overflowY: 'auto', background: COLORS.bg, fontFamily: '"Segoe UI", Inter, system-ui, sans-serif', color: COLORS.text }}>
      <main style={{ width: 'calc(100vw - 36px)', maxWidth: 444, minWidth: 0, boxSizing: 'border-box', margin: '0 auto', padding: 'calc(env(safe-area-inset-top, 0px) + 18px) 0 calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>
        <button onClick={() => { window.location.href = '/start' }} style={linkButton()}>
          Quay lại
        </button>

        <section style={{ padding: '14px 0 18px' }}>
          <div style={{ fontSize: 13, color: COLORS.muted, fontWeight: 700 }}>Thầy Văn Anh Guitar</div>
          <h1 style={{ margin: '5px 0 8px', fontSize: 28, lineHeight: 1.18, letterSpacing: 0, fontWeight: 850 }}>
            Chọn gói học
          </h1>
          <p style={{ margin: 0, color: COLORS.muted, fontSize: 15, lineHeight: 1.55, overflowWrap: 'anywhere' }}>
            Đăng nhập trước khi mua để quyền học được gắn vào đúng tài khoản.
          </p>
        </section>

        {!sessionReady && (
          <section style={panel()}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>Đăng nhập</div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" style={input()} />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Mật khẩu" style={{ ...input(), marginTop: 10 }} />
            <button onClick={login} disabled={busyProduct === 'login'} style={primaryButton()}>
              {busyProduct === 'login' ? 'Đang đăng nhập...' : 'Đăng nhập để mua gói'}
            </button>
          </section>
        )}

        <section style={planCard(false)}>
          <div>
            <div style={planTitleRow()}>
              <span style={badge()}>Miễn phí</span>
              <strong style={{ fontSize: 19 }}>FREE</strong>
            </div>
            <p style={planDesc()}>Tài khoản mới bắt đầu ở quyền miễn phí. Không cần App Store, không cần phương thức thanh toán.</p>
          </div>
          <button onClick={() => { window.location.href = '/start' }} style={secondaryButton()}>
            Tiếp tục miễn phí
          </button>
        </section>

        {loading && <div style={notice('info')}>Đang tải gói từ App Store...</div>}
        {!loading && isNativeIOS && sortedProducts.length === 0 && (
          <div style={notice('err')}>Chưa tải được gói đăng ký từ App Store. Kiểm tra lại product trong App Store Connect hoặc thử lại sau.</div>
        )}
        {!isNativeIOS && (
          <div style={notice('info')}>Mua gói qua App Store chỉ hiển thị trong app iOS TVA Guitar.</div>
        )}

        {sortedProducts.map((product) => {
          const tier = APPLE_PRODUCT_TIER[product.productId]
          const advancedPending = tier === 'nang_cao_499'
          return (
            <section key={product.productId} style={planCard(effectiveTier === tier)}>
              <div>
                <div style={planTitleRow()}>
                  <span style={badge()}>{planCopy[tier].tag}</span>
                  <strong style={{ fontSize: 19 }}>{TIER_LABEL[tier]}</strong>
                </div>
                <p style={planDesc()}>{planCopy[tier].description}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
                  <span style={{ fontSize: 24, fontWeight: 850 }}>{advancedPending ? 'Sắp có' : product.price}</span>
                  {!advancedPending && <span style={{ fontSize: 13, color: COLORS.muted }}>{periodLabel(product)}</span>}
                </div>
                {advancedPending && (
                  <p style={{ margin: '8px 0 0', color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
                    Gói Nâng cao đang được giữ lại để hoàn thiện kiểm thử App Store. Bạn chưa thể mua gói này trong phiên bản hiện tại.
                  </p>
                )}
                {!advancedPending && trialLabel(product) && (
                  <p style={{ margin: '8px 0 0', color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
                    {trialLabel(product)}. Sau thời gian dùng thử, gói tự động gia hạn theo giá App Store. Bạn có thể hủy trong Apple ID.
                  </p>
                )}
              </div>
              <button onClick={() => advancedPending ? undefined : buy(product)} disabled={advancedPending || busyProduct === product.productId} style={advancedPending ? disabledButton() : primaryButton(!sessionReady)}>
                {advancedPending ? 'Sắp có' : busyProduct === product.productId ? 'Đang xử lý...' : effectiveTier === tier ? 'Gói hiện tại' : 'Mua gói này'}
              </button>
            </section>
          )
        })}

        {message && <div style={notice(message.type)}>{message.text}</div>}

        <section style={{ marginTop: 18, display: 'grid', gap: 10 }}>
          <button onClick={restore} disabled={!sessionReady || busyProduct === 'restore'} style={secondaryButton()}>
            {busyProduct === 'restore' ? 'Đang khôi phục...' : 'Khôi phục giao dịch'}
          </button>
          <button onClick={openManage} disabled={busyProduct === 'manage'} style={secondaryButton()}>
            Quản lý đăng ký
          </button>
        </section>

        <footer style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.6, marginTop: 20, textAlign: 'center' }}>
          Giá, chu kỳ và ưu đãi dùng thử được lấy từ App Store tại thời điểm hiển thị.
          {' '}<a href="https://timming.vananhaudio.com/tvaprivacy" target="_blank" rel="noreferrer" style={{ color: COLORS.primary }}>Chính sách bảo mật</a>
          {' · '}
          <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noreferrer" style={{ color: COLORS.primary }}>Điều khoản sử dụng</a>
          <div style={{ marginTop: 8, fontSize: 11, color: COLORS.muted }}>{BUILD_DIAGNOSTIC}</div>
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

function panel(): CSSProperties {
  return { width: '100%', boxSizing: 'border-box', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: '0 8px 20px rgba(33,28,50,.06)' }
}

function planCard(active: boolean): CSSProperties {
  return { ...panel(), borderColor: active ? COLORS.primary : COLORS.border, boxShadow: active ? '0 10px 24px rgba(67,56,202,.14)' : '0 8px 20px rgba(33,28,50,.06)' }
}

function planTitleRow(): CSSProperties {
  return { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }
}

function planDesc(): CSSProperties {
  return { margin: '10px 0 0', color: COLORS.muted, fontSize: 14, lineHeight: 1.55 }
}

function badge(): CSSProperties {
  return { background: COLORS.soft, color: COLORS.primaryDark, border: `1px solid ${COLORS.border}`, borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 800 }
}

function input(): CSSProperties {
  return { width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 13px', fontSize: 16, fontFamily: 'inherit', outline: 'none', background: '#fff' }
}

function primaryButton(needsLogin = false): CSSProperties {
  return { marginTop: 14, width: '100%', border: 'none', borderRadius: 12, background: needsLogin ? COLORS.primaryDark : COLORS.primary, color: '#fff', fontSize: 15, fontWeight: 800, padding: '13px 14px', fontFamily: 'inherit', cursor: 'pointer' }
}

function secondaryButton(): CSSProperties {
  return { width: '100%', border: `1px solid ${COLORS.border}`, borderRadius: 12, background: COLORS.surface, color: COLORS.text, fontSize: 15, fontWeight: 800, padding: '13px 14px', fontFamily: 'inherit', cursor: 'pointer' }
}

function disabledButton(): CSSProperties {
  return { marginTop: 14, width: '100%', border: `1px solid ${COLORS.border}`, borderRadius: 12, background: COLORS.soft, color: COLORS.muted, fontSize: 15, fontWeight: 800, padding: '13px 14px', fontFamily: 'inherit', cursor: 'not-allowed' }
}

function linkButton(): CSSProperties {
  return { border: 'none', background: 'transparent', color: COLORS.primary, fontSize: 14, fontWeight: 800, padding: '8px 0', fontFamily: 'inherit', cursor: 'pointer' }
}

function notice(type: 'ok' | 'err' | 'info'): CSSProperties {
  const color = type === 'ok' ? COLORS.ok : type === 'err' ? COLORS.danger : COLORS.muted
  return { background: COLORS.surface, border: `1px solid ${COLORS.border}`, color, borderRadius: 12, padding: 13, fontSize: 14, lineHeight: 1.5, marginTop: 12 }
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
