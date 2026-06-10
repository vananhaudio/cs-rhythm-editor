/**
 * Wrapper nhỏ giao tiếp với IAPPlugin (native StoreKit iOS).
 * Trên web/browser: mọi hàm trả về lỗi "not available" để không bị crash.
 */

const isCapacitor = typeof (window as any).Capacitor !== 'undefined'
  && (window as any).Capacitor?.isNativePlatform?.();

function getIAPPlugin(): any | null {
  if (!isCapacitor) return null;
  try {
    const { registerPlugin } = (window as any).Capacitor;
    if (!registerPlugin) return null;
    return registerPlugin('IAP');
  } catch {
    return null;
  }
}

export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
}

export interface IAPPurchaseResult {
  productId: string;
  status: 'purchased' | 'restored';
}

/**
 * Lấy danh sách sản phẩm từ App Store.
 * Trả về [] nếu không chạy trên native.
 */
export async function getIAPProducts(): Promise<IAPProduct[]> {
  const plugin = getIAPPlugin();
  if (!plugin) return [];
  try {
    const result = await plugin.getProducts();
    return result.products ?? [];
  } catch {
    return [];
  }
}

/**
 * Kích hoạt màn hình mua subscription từ App Store.
 * Throws nếu bị cancel hoặc lỗi.
 */
export async function purchaseMonthly(): Promise<IAPPurchaseResult> {
  const plugin = getIAPPlugin();
  if (!plugin) throw new Error('In-App Purchase chỉ có trên app iOS.');
  return plugin.purchase({ productId: 'com.vananhaudio.guitar.monthly' });
}

/**
 * Khôi phục giao dịch đã mua trước (cho nút "Khôi phục mua hàng").
 */
export async function restorePurchases(): Promise<{ status: string }> {
  const plugin = getIAPPlugin();
  if (!plugin) throw new Error('Chỉ có trên app iOS.');
  return plugin.restore();
}

/** Đang chạy trên native iOS Capacitor không? */
export const isNativeIOS = isCapacitor;
