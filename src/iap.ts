/**
 * Wrapper giao tiếp với IAPPlugin (native StoreKit iOS).
 * Dùng @capacitor/core để registerPlugin — cách đúng cho Capacitor 8.
 */
import { registerPlugin, Capacitor } from '@capacitor/core'

export const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'

// Chỉ khởi tạo một lần
const IAPPlugin: any | null = isNativeIOS ? registerPlugin('IAP') : null

export interface IAPProduct {
  productId: string
  title: string
  description: string
  price: string
  subscriptionPeriod?: string
  subscriptionPeriodValue?: number
  subscriptionPeriodUnit?: string
  introOfferPaymentMode?: string
  introOfferPeriod?: string
  introOfferPeriodValue?: number
  introOfferPeriodUnit?: string
  isAvailable?: boolean
}

export interface IAPPurchaseResult {
  productId: string
  status: 'purchased' | 'restored' | 'cancelled' | 'pending'
  transactionId?: string
  originalTransactionId?: string
  signedTransactionInfo?: string
  expiresDate?: string | null
  environment?: string
}

export interface IAPEntitlement {
  productId: string
  transactionId?: string
  originalTransactionId?: string
  signedTransactionInfo?: string
  expiresDate?: string | null
  environment?: string
}

export const APPLE_SUBSCRIPTION_PRODUCTS = [
  'com.vananhaudio.guitar.subscription.khoi_dau',
  'com.vananhaudio.guitar.subscription.can_ban',
  'com.vananhaudio.guitar.monthly',
] as const

export type SubscriptionTier = 'khoi_dau_99' | 'can_ban_396' | 'nang_cao_499'

export const APPLE_PRODUCT_TIER: Record<string, SubscriptionTier> = {
  'com.vananhaudio.guitar.subscription.khoi_dau': 'khoi_dau_99',
  'com.vananhaudio.guitar.subscription.can_ban': 'can_ban_396',
  'com.vananhaudio.guitar.monthly': 'nang_cao_499',
}

export const TIER_LABEL: Record<SubscriptionTier, string> = {
  khoi_dau_99: 'Khởi đầu',
  can_ban_396: 'Căn bản',
  nang_cao_499: 'Nâng cao',
}

export async function getIAPProducts(): Promise<IAPProduct[]> {
  if (!IAPPlugin) return []
  try {
    const result = await IAPPlugin.getProducts()
    return result.products ?? []
  } catch {
    return []
  }
}

export async function purchaseProduct(productId: string): Promise<IAPPurchaseResult> {
  if (!IAPPlugin) throw new Error('In-App Purchase chỉ có trên app iOS.')
  return IAPPlugin.purchase({ productId })
}

export async function restorePurchases(): Promise<{ status: string }> {
  if (!IAPPlugin) throw new Error('Chỉ có trên app iOS.')
  return IAPPlugin.restore()
}

export async function getCurrentEntitlements(): Promise<IAPEntitlement[]> {
  if (!IAPPlugin) return []
  try {
    const result = await IAPPlugin.currentEntitlements()
    return result.entitlements ?? []
  } catch {
    return []
  }
}

export async function manageSubscriptions(): Promise<{ status: string }> {
  if (!IAPPlugin) throw new Error('Chỉ có trên app iOS.')
  return IAPPlugin.manageSubscriptions()
}
