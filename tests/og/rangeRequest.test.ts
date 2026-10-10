// Facebook gửi Range → upstream 206. HTML route: bỏ Range để nhận 200 đầy đủ + OG; file tĩnh/media giữ nguyên Range.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import og from '../../netlify/edge-functions/og.ts'
import ogTeamlab from '../../netlify/edge-functions/og-teamlab.ts'
import { resetShareMemo } from '../../netlify/og/adapter.ts'
import { INDEX, ORIGIN, tag } from './fixtures.ts'

const SHELL = readFileSync(new URL('./fixtures-html/teamlab-shell.html', import.meta.url), 'utf8')
const RANGE = 'bytes=0-524287'
const FB = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'

// next() giả như origin thật: có Range → 206 + nửa body; không Range → 200 đầy đủ.
function harness(html: string) {
  const seen: Array<{ range: string | null; ifRange: string | null; argc: number }> = []
  const ctx = { next: async (...a: [Request?]) => {
    const r = a[0]; seen.push({ range: r?.headers.get('range') ?? null, ifRange: r?.headers.get('if-range') ?? null, argc: a.length })
    return r ? new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' } })
             : new Response(html.slice(0, 100), { status: 206, headers: { 'content-type': 'text/html; charset=UTF-8', 'content-range': 'bytes 0-99/999' } })
  } }
  return { seen, ctx }
}
const withFetch = async <T>(rpc: unknown, f: () => Promise<T>) => {
  const real = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify(rpc), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch
  try { return await f() } finally { globalThis.fetch = real }
}
const get = (path: string, headers: Record<string, string>) => new Request(ORIGIN + path, { headers: { 'user-agent': FB, ...headers } })

test('GET HTML có Range → next() nhận request KHÔNG có Range/If-Range → 200 đầy đủ + OG đúng (route Class)', async () => {
  resetShareMemo()
  const h = harness(INDEX)
  const res = await og(get('/me/classes', { range: RANGE, 'if-range': 'W/"x"' }), h.ctx)
  assert.equal(res.status, 200); assert.equal(res.headers.get('content-range'), null)
  assert.equal(h.seen.length, 1); assert.equal(h.seen[0].range, null); assert.equal(h.seen[0].ifRange, null); assert.equal(h.seen[0].argc, 1)
  assert.equal(res.headers.get('x-og-fn'), 'page'); assert.equal(tag(await res.text(), 'og:url'), `${ORIGIN}/me/classes`)
})

test('TeamLab Band/Room/Song có Range → 200 + thẻ công khai đúng, HTML đầy đủ', async () => {
  const slug = 'la-mua-thu-k3x9a', PID = '3098cc4c-41cf-4617-8716-a3290d3eaad6', cover = `${PID}/cover-1791205085438-5cvpnrsj.jpg`
  for (const [path, rpc, fn, url] of [
    [`/teamlab/band/${slug}`, { slug, name: 'Lá Mùa Thu', description: 'Ban nhạc tình ca', cover_path: cover }, 'teamlab-band:public', `${ORIGIN}/teamlab/band/${slug}`],
    [`/teamlab/band/${slug}/room`, { slug, name: 'Lá Mùa Thu', description: 'Ban nhạc tình ca', cover_path: cover }, 'teamlab-band:public', `${ORIGIN}/teamlab/band/${slug}`],
    [`/teamlab/song/${slug}`, { slug, title: 'Mùa thu cho em', band: { name: 'Lá Mùa Thu' }, project: { name: 'Lá Mùa Thu', cover_path: cover } }, 'teamlab-song:public', `${ORIGIN}/teamlab/song/${slug}`],
  ] as const) {
    resetShareMemo()
    const h = harness(SHELL)
    const res = await withFetch(rpc, () => ogTeamlab(get(path, { range: RANGE }), h.ctx))
    const html = await res.text()
    assert.equal(res.status, 200, path); assert.equal(res.headers.get('x-og-fn'), fn, path); assert.equal(tag(html, 'og:url'), url, path)
    assert.match(html, /<script type="module"/, path); assert.equal(h.seen[0].range, null, path)
  }
})

test('file tĩnh / media / có đuôi file: Range GIỮ NGUYÊN (next() không đổi request), 206 đi thẳng', async () => {
  for (const p of ['/audio/take.mp3', '/video/clip.mp4', '/doc/file.pdf', '/x/Archive.ZIP', '/manifest.webmanifest', '/lessons/bai-1.html']) {
    const h = harness(INDEX)
    const res = await og(get(p, { range: RANGE }), h.ctx)
    assert.equal(h.seen[0].argc, 0, p); assert.equal(res.status, 206, p); assert.equal(res.headers.get('x-og-fn'), 'skip', p)
  }
})

test('không Range → hành vi cũ: next() không đối số; POST có Range không bị đổi', async () => {
  const h = harness(INDEX)
  await og(get('/me/classes', {}), h.ctx); assert.equal(h.seen[0].argc, 0)
  const h2 = harness(INDEX)
  await og(new Request(ORIGIN + '/me/classes', { method: 'POST', headers: { range: RANGE } }), h2.ctx); assert.equal(h2.seen[0].argc, 0)
})
