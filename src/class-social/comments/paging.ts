// Phân trang bình luận theo BÌNH LUẬN GỐC (Lát D) — hàm THUẦN, dùng chung Social và Thread/TeamLab.
// Server (db/feed_comments_paging_v1_setup.sql) trả mỗi trang = N gốc + mọi trả lời của chúng, kèm seq / root_seq / older_roots.
// Client chỉ gộp theo id (không trùng, không mất), giữ các trang cũ khi tải lại trang mới nhất.
export const PAGE_ROOTS = 20

export type SeqItem = { id: string; createdAt: string; seq: number | null; rootSeq: number | null }

const num = (v: unknown): number | null => { const n = typeof v === 'string' ? Number(v) : v; return typeof n === 'number' && Number.isFinite(n) ? n : null }
export const toSeq = num

const cmp = (a: SeqItem, b: SeqItem) => (Date.parse(a.createdAt) - Date.parse(b.createdAt)) || ((a.seq ?? 0) - (b.seq ?? 0))

/** Gộp theo id (bản mới ghi đè), sắp CŨ → MỚI. Không bao giờ nhân đôi hay làm mất bình luận đã có. */
export function mergeById<T extends SeqItem>(existing: T[], incoming: T[]): T[] {
  const m = new Map<string, T>(existing.map(x => [x.id, x]))
  for (const x of incoming) m.set(x.id, x)
  return [...m.values()].sort(cmp)
}

/** Con trỏ trang kế tiếp = root_seq nhỏ nhất đang có. */
export function minRootSeq(items: SeqItem[]): number | null {
  let m: number | null = null
  for (const x of items) if (x.rootSeq !== null && (m === null || x.rootSeq < m)) m = x.rootSeq
  return m
}

/**
 * Tải lại TRANG MỚI NHẤT (sau gửi/sửa/xoá/ẩn) mà không mất các trang cũ đã mở:
 * phần thuộc các gốc mới hơn hoặc bằng gốc cũ nhất của trang mới thì thay bằng dữ liệu mới (xoá ở đó biến mất đúng);
 * phần của gốc cũ hơn giữ nguyên.
 */
export function replaceHead<T extends SeqItem>(existing: T[], head: T[], headHasMore: boolean): T[] {
  if (!headHasMore) return mergeById([], head)
  const floor = minRootSeq(head)
  const keep = floor === null ? [] : existing.filter(x => x.rootSeq !== null && x.rootSeq < floor)
  return mergeById(keep, head)
}

/** Gỡ cục bộ một bình luận và mọi hậu duệ (DB xoá cascade) — dùng sau xoá thành công cho vùng ngoài trang mới nhất. */
export function dropWithDescendants<T extends { id: string; parentId: string | null }>(items: T[], id: string): T[] {
  const gone = new Set<string>([id])
  for (let changed = true; changed;) {
    changed = false
    for (const x of items) if (!gone.has(x.id) && x.parentId && gone.has(x.parentId)) { gone.add(x.id); changed = true }
  }
  return items.filter(x => !gone.has(x.id))
}

/** RPC phân trang chưa được cài (trước khi áp dụng migration) → frontend lùi về hàm cũ. */
export function isMissingRpc(e: { code?: string; message?: string } | null | undefined, status?: number): boolean {
  if (!e) return false
  return e.code === 'PGRST202' || e.code === '42883' || status === 404 || /could not find the function|does not exist/i.test(e.message ?? '')
}
