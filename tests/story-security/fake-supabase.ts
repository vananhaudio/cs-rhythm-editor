// Supabase giả cho test Edge Function: ghi lại MỌI truy cập dữ liệu để chứng minh lượt bị từ chối không chạm gì.
export const state = {
  log: [] as { table: string; op: string; payload?: unknown }[],
  rows: {} as Record<string, Record<string, unknown>[]>,
}
const USERS: Record<string, string> = { 'tok-teacher': 'u-teacher', 'tok-admin': 'u-admin', 'tok-student': 'u-student', 'tok-owner': 'u-owner' }
class Q {
  filters: [string, unknown][] = []; op = 'select'; payload: unknown
  constructor(public table: string) {}
  select() { return this } order() { return this } limit() { return this } not() { return this } in() { return this }
  eq(c: string, v: unknown) { this.filters.push([c, v]); return this }
  update(p: unknown) { this.op = 'update'; this.payload = p; return this }
  insert(p: unknown) { this.op = 'insert'; this.payload = p; return this }
  upsert(p: unknown) { this.op = 'upsert'; this.payload = p; return this }
  delete() { this.op = 'delete'; return this }
  private run(one: boolean) {
    if (this.table !== 'app_users' || this.op !== 'select') state.log.push({ table: this.table, op: this.op, payload: this.payload })
    const hit = (state.rows[this.table] ?? []).filter(r => this.filters.every(([c, v]) => r[c] === v))
    return { data: one ? (hit[0] ?? (this.op === 'insert' ? { id: 'new' } : null)) : hit, error: null, count: hit.length }
  }
  single() { return Promise.resolve(this.run(true)) }
  maybeSingle() { return Promise.resolve(this.run(true)) }
  then(ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) { return Promise.resolve(this.run(false)).then(ok, bad) }
}
const touch = (op: string) => state.log.push({ table: 'auth/storage', op })
export function createClient() {
  return {
    from: (t: string) => new Q(t),
    auth: {
      getUser: (t: string) => Promise.resolve({ data: { user: USERS[t] ? { id: USERS[t] } : null } }),
      admin: { listUsers: () => { touch('listUsers'); return Promise.resolve({ data: { users: [] } }) } },
    },
    storage: {
      from: () => ({ upload: () => { touch('upload'); return Promise.resolve({ error: null }) }, getPublicUrl: () => ({ data: { publicUrl: 'https://x/p.png' } }) }),
      listBuckets: () => { touch('listBuckets'); return Promise.resolve({ data: [{ name: 'story-photos' }] }) },
      createBucket: () => Promise.resolve({}),
    },
  }
}
