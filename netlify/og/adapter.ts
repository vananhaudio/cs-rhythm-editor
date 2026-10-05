// ── Universal OG — giao diện Resource Adapter ──
// Một loại resource = MỘT adapter, đăng ký một lần trong registry.ts. Adapter:
//   match(path, search) → khoá resource (slug/id) hoặc null nếu URL không thuộc loại này
//   load(key, ctx)      → ShareMeta (visibility quyết theo DỮ LIỆU) hoặc null = không có resource
// Adapter chỉ đọc dữ liệu khách (anon) vốn đọc được, qua ctx — không service key, không cột riêng tư.
import type { ShareMeta } from './contract.ts'

export type Ctx = {
  /** origin request (https://class.vananhaudio.com hoặc draft) — để dựng canonicalUrl */
  origin: string
  /** GET PostgREST, vd '/rest/v1/bands?select=…' → JSON; lỗi/quá giờ → throw */
  get: (path: string) => Promise<unknown>
  /** POST RPC công khai, vd ('band_recruitment_public', {p_slug}) */
  rpc: (fn: string, body: Record<string, unknown>) => Promise<unknown>
  /** đồng hồ (test thay được) — dùng cho cache chỉ mục */
  now: () => number
}

export type Adapter<K = unknown> = {
  type: string
  match: (path: string, search: URLSearchParams) => K | null
  load: (key: K, ctx: Ctx) => Promise<ShareMeta | null>
  /**
   * true = URL khớp nhưng không có resource → coi như route thường (thẻ mặc định, ghi 'page'),
   * dùng cho adapter dò theo dữ liệu (tool: mọi path một đoạn đều "có thể" là tool).
   */
  fallthrough?: boolean
}

export const defineAdapter = <K>(a: Adapter<K>): Adapter<unknown> => a as Adapter<unknown>

/** Dòng đầu của kết quả PostgREST dạng mảng. */
export async function first<T>(ctx: Ctx, path: string): Promise<T | null> {
  const rows = await ctx.get(path)
  return Array.isArray(rows) && rows.length ? (rows[0] as T) : null
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
