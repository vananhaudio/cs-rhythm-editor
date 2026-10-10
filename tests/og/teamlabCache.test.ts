// TeamLab OG — cache 60 s trong isolate (loadMemo): hit / miss / hết hạn / đổi ảnh bìa / cách ly Band-Song / không nhớ lỗi hay private.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadMemo, resetShareMemo, type Ctx } from '../../netlify/og/adapter.ts'
import { resolveShare } from '../../netlify/og/registry.ts'
import { renderShareMeta } from '../../netlify/og/render.ts'
import { teamlabBandAdapter } from '../../netlify/og/adapters/teamlabBand.ts'
import { tag, title, ORIGIN } from './fixtures.ts'

const SHELL = readFileSync(new URL('./fixtures-html/teamlab-shell.html', import.meta.url), 'utf8')
const PID = '3098cc4c-41cf-4617-8716-a3290d3eaad6'
const COVER_A = `${PID}/cover-1111111111111-aaaaaaaa.jpg`, COVER_B = `${PID}/cover-2222222222222-bbbbbbbb.jpg`
const bandOf = (name: string, cover: string) => ({ slug: '', name, description: `Slogan ${name}`, cover_path: cover, avatar_path: null })

function world() {
  const state = { now: 1_000_000, calls: [] as string[], fail: false, bands: new Map<string, ReturnType<typeof bandOf>>(), songs: new Map<string, unknown>() }
  const ctx = (origin = ORIGIN): Ctx => ({
    origin, now: () => state.now, get: async () => [],
    rpc: async (fn, b) => {
      state.calls.push(`${fn}:${JSON.stringify(b)}`)
      if (state.fail) throw new Error('db-500')
      if (fn === 'teamlab_public_band') { const x = state.bands.get(String(b.p_slug)); return x ? { ...x, slug: b.p_slug } : null }
      if (fn === 'teamlab_public_song') return state.songs.get(String(b.p_slug)) ?? null
      return null
    },
  })
  return { state, ctx }
}
const card = async (path: string, c: Ctx) => { const r = await resolveShare(new URL(ORIGIN + path), c); const out = renderShareMeta(SHELL, r.meta, r.canonicalUrl); return { r, out, t: title(out), img: tag(out, 'og:image') } }
const imgOf = (cover: string) => `https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/teamlab-team-avatars/${cover}`

test('cache miss rồi hit: lượt 2 trong 60 s KHÔNG gọi RPC, thẻ y hệt', async () => {
  resetShareMemo(); const w = world(); w.state.bands.set('la-mua-thu-k3x9a', bandOf('Lá Mùa Thu', COVER_A))
  const a = await card('/teamlab/band/la-mua-thu-k3x9a', w.ctx()); assert.equal(w.state.calls.length, 1)
  w.state.now += 59_999
  const b = await card('/teamlab/band/la-mua-thu-k3x9a', w.ctx()); assert.equal(w.state.calls.length, 1, 'hit')
  assert.equal(b.out, a.out); assert.equal(b.t, 'Lá Mùa Thu · TeamLab'); assert.equal(b.img, imgOf(COVER_A))
})

test('hết hạn đúng 60 s → RPC lại; đổi ảnh bìa: trong TTL còn ảnh cũ, sau TTL ảnh mới', async () => {
  resetShareMemo(); const w = world(); w.state.bands.set('la-mua-thu-k3x9a', bandOf('Lá Mùa Thu', COVER_A))
  await card('/teamlab/band/la-mua-thu-k3x9a', w.ctx())
  w.state.bands.set('la-mua-thu-k3x9a', bandOf('Lá Mùa Thu', COVER_B))
  w.state.now += 30_000
  assert.equal((await card('/teamlab/band/la-mua-thu-k3x9a', w.ctx())).img, imgOf(COVER_A), 'trong TTL: ảnh cũ (tối đa 60 s trễ)')
  w.state.now += 30_000   // đúng 60 s
  assert.equal((await card('/teamlab/band/la-mua-thu-k3x9a', w.ctx())).img, imgOf(COVER_B), 'sau TTL: ảnh mới')
  assert.equal(w.state.calls.length, 2)
})

test('cách ly: Band khác slug / Room cùng Team dùng chung 1 mục; Band ≠ Song ≠ origin không lẫn metadata', async () => {
  resetShareMemo(); const w = world()
  w.state.bands.set('band-a-aaaaa', bandOf('Band A', COVER_A)); w.state.bands.set('band-b-bbbbb', bandOf('Band B', COVER_B))
  w.state.songs.set('band-a-aaaaa', { slug: 'band-a-aaaaa', title: 'Bài của A', band: { name: 'Band A' }, project: { name: 'Team A', cover_path: COVER_B } })
  assert.equal((await card('/teamlab/band/band-a-aaaaa', w.ctx())).t, 'Band A · TeamLab')
  assert.equal((await card('/teamlab/band/band-b-bbbbb', w.ctx())).t, 'Band B · TeamLab')
  assert.equal((await card('/teamlab/song/band-a-aaaaa', w.ctx())).t, 'Bài của A · Band A', 'cùng slug nhưng khác loại resource')
  assert.equal(w.state.calls.length, 3)
  const n = w.state.calls.length
  assert.equal((await card('/teamlab/band/band-a-aaaaa/room', w.ctx())).t, 'Band A · TeamLab'); assert.equal(w.state.calls.length, n, 'Room dùng chung mục Band')
  assert.equal((await card('/teamlab/band/band-a-aaaaa', w.ctx('https://deploy-preview-1--x.netlify.app'))).r.meta?.canonicalUrl, 'https://deploy-preview-1--x.netlify.app/teamlab/band/band-a-aaaaa')
  assert.equal(w.state.calls.length, n + 1, 'origin khác = mục khác (canonical/ảnh mặc định không lẫn)')
})

test('KHÔNG nhớ lỗi: RPC lỗi → throw; lượt sau gọi lại và thành công', async () => {
  resetShareMemo(); const w = world(); w.state.bands.set('la-mua-thu-k3x9a', bandOf('Lá Mùa Thu', COVER_A))
  w.state.fail = true
  await assert.rejects(card('/teamlab/band/la-mua-thu-k3x9a', w.ctx()))
  w.state.fail = false
  assert.equal((await card('/teamlab/band/la-mua-thu-k3x9a', w.ctx())).t, 'Lá Mùa Thu · TeamLab'); assert.equal(w.state.calls.length, 2)
})

test('không công khai: nhớ như "không có" (không chứa chữ nào); Band được công khai hiện sau tối đa 60 s; meta private không bao giờ được nhớ', async () => {
  resetShareMemo(); const w = world()
  const miss = await card('/teamlab/band/chua-len-home-zzzzz', w.ctx()); assert.equal(miss.r.meta, null); assert.equal(miss.t, title(SHELL))
  w.state.bands.set('chua-len-home-zzzzz', bandOf('Vừa công khai', COVER_A))
  assert.equal((await card('/teamlab/band/chua-len-home-zzzzz', w.ctx())).t, title(SHELL)); assert.equal(w.state.calls.length, 1)
  w.state.now += 60_000
  assert.equal((await card('/teamlab/band/chua-len-home-zzzzz', w.ctx())).t, 'Vừa công khai · TeamLab')
  // adapter giả trả private → không được ghi vào cache
  resetShareMemo(); let loads = 0
  const priv = { ...teamlabBandAdapter, cacheTtlMs: 60_000, load: async () => { loads++; return { title: 'BÍ MẬT', description: '', image: null, canonicalUrl: 'x', visibility: 'private' as const } } }
  await loadMemo(priv, 'k', w.ctx()); await loadMemo(priv, 'k', w.ctx()); assert.equal(loads, 2)
})

test('trần bộ nhớ: tối đa 200 mục, loại mục cũ nhất; adapter không opt-in (Class) không bao giờ bị nhớ', async () => {
  resetShareMemo(); const w = world()
  for (let i = 0; i < 205; i++) w.state.bands.set(`b-${i}-xxxxx`, bandOf(`B${i}`, COVER_A))
  for (let i = 0; i < 205; i++) await card(`/teamlab/band/b-${i}-xxxxx`, w.ctx())
  const n = w.state.calls.length; assert.equal(n, 205)
  await card('/teamlab/band/b-204-xxxxx', w.ctx()); assert.equal(w.state.calls.length, n, 'mục mới nhất còn')
  await card('/teamlab/band/b-0-xxxxx', w.ctx()); assert.equal(w.state.calls.length, n + 1, 'mục cũ nhất đã bị loại')
  const src = readFileSync(new URL('../../netlify/og/adapters/', import.meta.url).pathname + 'band.ts', 'utf8') + readFileSync(new URL('../../netlify/og/adapters/classPages.ts', import.meta.url).pathname, 'utf8')
  assert.doesNotMatch(src, /cacheTtlMs/)
})
