// SEO canonical: CHỈ Class (og.ts) chèn <link rel="canonical"> đúng URL đang phục vụ. TeamLab là site độc lập
// (og-teamlab.ts, renderer chung renderShareMeta) → HTML TeamLab giữ nguyên, không bao giờ có canonical Class.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import og, { config as ogConfig } from '../../netlify/edge-functions/og.ts'
import ogTeamlab, { config as teamlabConfig } from '../../netlify/edge-functions/og-teamlab.ts'
import { resetShareMemo } from '../../netlify/og/adapter.ts'
import { classifyRoute } from '../../netlify/og/routes.ts'
import { INDEX, ORIGIN, tag } from './fixtures.ts'

const SHELL = readFileSync(new URL('./fixtures-html/teamlab-shell.html', import.meta.url), 'utf8')
const canonicals = (html: string) => [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]*)"/gi)].map(m => m[1])
const ctxOf = (html: string) => ({ next: async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }) })
const withFetch = async <T>(rpc: unknown, f: () => Promise<T>) => {
  const real = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify(rpc), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch
  try { return await f() } finally { globalThis.fetch = real }
}

test('Class: mỗi URL có ĐÚNG MỘT canonical = chính URL đó (bỏ query rác, gạch chéo cuối), trùng og:url', async () => {
  for (const p of ['/', '/solo01', '/hanhtrinh2027/', '/showcase', '/me/classes', '/khong-ton-tai']) {
    resetShareMemo()
    const res = await withFetch([], () => og(new Request(ORIGIN + p + '?fbclid=x'), ctxOf(INDEX)))
    const html = await res.text()
    const want = ORIGIN + (p.replace(/\/+$/, '') || '/')
    assert.deepEqual(canonicals(html), [want], p)
    assert.equal(tag(html, 'og:url'), want, p)
  }
})

test('Class: canonical lấy theo host đang phục vụ (không hardcode class.)', async () => {
  resetShareMemo()
  const res = await withFetch([], () => og(new Request('https://deploy-preview-1--x.netlify.app/solo01'), ctxOf(INDEX)))
  assert.deepEqual(canonicals(await res.text()), ['https://deploy-preview-1--x.netlify.app/solo01'])
})

test('TeamLab: Band/Room/Song công khai, slug lạ, lỗi DB → KHÔNG có canonical; ngoài og:* HTML giữ nguyên', async () => {
  const slug = 'la-mua-thu-k3x9a'
  const band = { slug, name: 'Lá Mùa Thu', description: 'Ban nhạc', cover_path: null }
  const song = { slug, title: 'Mùa thu cho em', band: { name: 'Lá Mùa Thu' }, project: { name: 'Lá Mùa Thu', cover_path: null } }
  for (const [path, rpc] of [
    [`/teamlab/band/${slug}`, band], [`/teamlab/band/${slug}/room`, band], [`/teamlab/song/${slug}`, song],
    [`/teamlab/band/khong-co-abcde`, null], [`/teamlab/song/khong-co-abcde`, null],
  ] as const) {
    resetShareMemo()
    const res = await withFetch(rpc, () => ogTeamlab(new Request(ORIGIN + path), ctxOf(SHELL)))
    const html = await res.text()
    assert.deepEqual(canonicals(html), [], path)
    assert.ok(!html.includes('class.vananhaudio.com/"'), path)
  }
})

test('Phạm vi edge: og.ts (canonical Class) KHÔNG chạy trên /teamlab/*; og-teamlab.ts chỉ chạy dưới /teamlab', () => {
  for (const p of ['/teamlab', '/teamlab/*']) assert.ok(ogConfig.excludedPath.includes(p), p)
  for (const p of teamlabConfig.path) assert.ok(p.startsWith('/teamlab/'), p)
  assert.deepEqual(canonicals(SHELL), [], 'shell TeamLab gốc không có canonical')
  assert.deepEqual(canonicals(INDEX), [], 'index.html Class dùng chung mọi route → không canonical cố định')
})

test('robots.txt + sitemap.xml: file tĩnh thật; sitemap chỉ gồm trang công khai của Class, không bị robots chặn', () => {
  const read = (p: string) => readFileSync(new URL('../../public/' + p, import.meta.url), 'utf8')
  const robots = read('robots.txt'), sitemap = read('sitemap.xml')
  assert.match(robots, /^Sitemap: https:\/\/class\.vananhaudio\.com\/sitemap\.xml$/m)
  assert.match(sitemap, /^<\?xml/)
  const disallow = [...robots.matchAll(/^Disallow: (\S+)$/gm)].map(m => m[1])
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
  assert.ok(locs.includes('https://class.vananhaudio.com/'))
  for (const loc of locs) {
    const u = new URL(loc)
    assert.equal(u.origin, 'https://class.vananhaudio.com', loc)
    const kind = classifyRoute(u.pathname)?.kind
    assert.ok(kind === 'page' || kind === 'resource', `${loc}: ${kind}`)
    assert.ok(!disallow.some(d => u.pathname.startsWith(d)), `${loc} bị robots chặn`)
  }
  for (const priv of ['/admin', '/me/chat', '/students', '/course-editor']) assert.ok(disallow.some(d => priv.startsWith(d)), priv)
})
