// Trang cá nhân — /me/u/<id>. Chưa có opt-in công khai → LUÔN private, không đọc DB (thẻ mặc định Class).
import { defineAdapter, UUID_RE } from '../adapter.ts'
import { hidden } from '../contract.ts'
import { canonicalUrl } from '../render.ts'

export const profileAdapter = defineAdapter<string>({
  type: 'profile',
  match(path) {
    const m = /^\/me\/u\/([0-9a-f-]{36})$/i.exec(path)
    return m && UUID_RE.test(m[1]) ? m[1].toLowerCase() : null
  },
  async load(id, ctx) {
    return hidden('private', canonicalUrl(ctx.origin, `/me/u/${id}`))
  },
})
