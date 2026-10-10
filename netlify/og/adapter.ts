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
  /**
   * Ghi nhớ kết quả load() theo (loại, origin, khoá) trong ms này — chỉ adapter opt-in (3 adapter TeamLab, nơi mọi lượt xem trang
   * đều qua OG). Chỉ nhớ meta 'public' hoặc null (không có resource); lỗi (throw) và private KHÔNG bao giờ được nhớ.
   */
  cacheTtlMs?: number
}

const MEMO_MAX = 200
const memo = new Map<string, { at: number; meta: ShareMeta | null }>()
export const resetShareMemo = () => memo.clear()

/** Cache tối thiểu trong bộ nhớ isolate (cùng kiểu với chỉ mục tool): TTL + trần số mục, mục cũ nhất bị loại trước. */
export async function loadMemo(a: Adapter, key: unknown, ctx: Ctx): Promise<ShareMeta | null> {
  if (!a.cacheTtlMs) return a.load(key, ctx)
  const id = `${a.type}|${ctx.origin}|${JSON.stringify(key)}`
  const hit = memo.get(id)
  if (hit && ctx.now() - hit.at < a.cacheTtlMs) return hit.meta
  const meta = await a.load(key, ctx)          // lỗi → throw, không ghi gì
  if (meta === null || meta.visibility === 'public') {
    memo.delete(id)
    memo.set(id, { at: ctx.now(), meta })
    while (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value as string)
  }
  return meta
}

export const defineAdapter = <K>(a: Adapter<K>): Adapter<unknown> => a as Adapter<unknown>

/** Dòng đầu của kết quả PostgREST dạng mảng. */
export async function first<T>(ctx: Ctx, path: string): Promise<T | null> {
  const rows = await ctx.get(path)
  return Array.isArray(rows) && rows.length ? (rows[0] as T) : null
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
