/**
 * Wrapper giao tiếp với IAPPlugin (native StoreKit iOS).
 * Dùng @capacitor/core để registerPlugin — cách đúng cho Capacitor 8.
 */
import { registerPlugin, Capacitor } from '@capacitor/core'

export const isNativeIOS = Capacitor.isNativePlatform()

// Chỉ khởi tạo một lần
const IAPPlugin: any | null = isNativeIOS ? registerPlugin('IAP') : null

export interface IAPProduct {
  productId: string
  title: string
  description: string
  price: string
}

export interface IAPPurchaseResult {
  productId: string
  status: 'purchased' | 'restored'
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

export async function purchaseMonthly(): Promise<IAPPurchaseResult> {
  if (!IAPPlugin) throw new Error('In-App Purchase chỉ có trên app iOS.')
  return IAPPlugin.purchase({ productId: 'com.vananhaudio.guitar.monthly' })
}

export async function restorePurchases(): Promise<{ status: string }> {
  if (!IAPPlugin) throw new Error('Chỉ có trên app iOS.')
  return IAPPlugin.restore()
}
