// Ảnh Story hiển thị qua dịch vụ biến đổi ảnh của Supabase: thu nhỏ KHI TẢI (CDN đệm), KHÔNG tạo/lưu bản sao asset.
// resize=contain = giữ đúng tỉ lệ, không cắt. Lỗi (hết hạn mức, dịch vụ tắt…) → quay về đúng ảnh gốc.
const PUBLIC = /^(https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/)object(\/public\/story-photos\/[^?#]+\.(?:png|jpe?g|webp))(\?[^#]*)?$/i

export function resizedImage(url: string, width: number): string {
  const m = PUBLIC.exec(url)
  if (!m) return url
  return `${m[1]}render/image${m[2]}?${m[3] ? m[3].slice(1) + '&' : ''}width=${width}&resize=contain&quality=72`
}

export const IMAGE_SIZES = {
  /** thẻ trên Feed /me và /me/stories */
  card: { widths: [480, 800, 1200], sizes: '(max-width: 720px) 100vw, 680px' },
  /** ảnh trong trang đọc */
  article: { widths: [640, 960, 1360], sizes: '(max-width: 720px) 100vw, 680px' },
  /** lưới trang tạp chí */
  grid: { widths: [400, 640, 960], sizes: '(max-width: 640px) 100vw, 360px' },
  thumb: { widths: [240], sizes: '120px' },
  portrait: { widths: [200], sizes: '86px' },
} as const

export function storyImageProps(url: string, preset: keyof typeof IMAGE_SIZES): { src: string; srcSet?: string; sizes?: string } {
  if (!PUBLIC.test(url)) return { src: url }
  const { widths, sizes } = IMAGE_SIZES[preset]
  return {
    src: resizedImage(url, widths[Math.min(1, widths.length - 1)]),
    srcSet: widths.map(w => `${resizedImage(url, w)} ${w}w`).join(', '),
    sizes,
  }
}

/** Gọi trong onError: lần đầu đổi sang ảnh gốc và trả true; đã là ảnh gốc mà vẫn lỗi → false (nơi gọi xử lý tiếp). */
export function retryOriginal(img: HTMLImageElement, original: string): boolean {
  if (img.dataset.original === '1' || (!img.getAttribute('srcset') && img.getAttribute('src') === original)) return false
  img.dataset.original = '1'
  img.removeAttribute('srcset')
  img.removeAttribute('sizes')
  img.src = original
  return true
}
