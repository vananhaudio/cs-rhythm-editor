// TeamLab Public Band — adapter /teamlab/band/<slug> + edge og-teamlab (crawler-only) + không đụng Class /band/* và /teamlab/song/*.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveShare } from '../../netlify/og/registry.ts'
import { renderShareMeta } from '../../netlify/og/render.ts'
import ogTeamlab from '../../netlify/edge-functions/og-teamlab.ts'
import { DB, INDEX, mockCtx, ORIGIN, tag, title, type Db } from './fixtures.ts'

const SHELL = readFileSync(new URL('./fixtures-html/teamlab-shell.html', import.meta.url), 'utf8')
const STORAGE = 'https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/teamlab-team-avatars'
const PID = '3098cc4c-41cf-4617-8716-a3290d3eaad6'
const COVER = `${PID}/cover-1791205085438-5cvpnrsj.jpg`, AVATAR = `${PID}/1791132763562-udhitj29.jpg`
const SLUG = 'la-mua-thu-k3x9a'
const band = (o: Record<string, unknown> = {}) => ({ slug: SLUG, name: 'Lá Mùa Thu', description: 'Ban nhạc tình ca', music_tastes: ['Bolero'], avatar_path: AVATAR, cover_path: COVER, member_count: 14,
  members: [{ name: 'An', avatar_url: null }], songs: [{ slug: 'mua-thu-cho-em-1a093', title: 'Mùa thu cho em', published_at: '2026-10-06T03:07:15+00:00' }], ...o })
const dbWith = (fn: (b: Record<string, unknown>) => unknown): Db => ({ tables: { edu_tools: [] }, rpc: { teamlab_public_band: fn } })
const published = dbWith(b => (b.p_slug === SLUG ? band() : null))

async function share(path: string, html = SHELL, ctx = mockCtx(published)) {
  const r = await resolveShare(new URL(ORIGIN + path), ctx)
  const out = renderShareMeta(html, r.meta, r.canonicalUrl)
  return { r, out, t: title(out), d: tag(out, 'og:description'), img: tag(out, 'og:image'), url: tag(out, 'og:url') }
}

test('Band đã công khai: title "<Tên> · TeamLab", mô tả = slogan, ảnh cover, og:url canonical, twitter:* — trên HTML TeamLab và Class', async () => {
  for (const html of [SHELL, INDEX]) {
    const o = await share(`/teamlab/band/${SLUG}`, html)
    assert.equal(o.r.note, 'teamlab-band:public'); assert.equal(o.t, 'Lá Mùa Thu · TeamLab')
    assert.equal(tag(o.out, 'og:title'), 'Lá Mùa Thu · TeamLab'); assert.equal(tag(o.out, 'twitter:title'), 'Lá Mùa Thu · TeamLab')
    assert.equal(o.d, 'Ban nhạc tình ca'); assert.equal(tag(o.out, 'twitter:description'), o.d); assert.equal(tag(o.out, 'description'), o.d)
    assert.equal(o.img, `${STORAGE}/${COVER}`); assert.equal(tag(o.out, 'twitter:image'), o.img)
    assert.equal(o.url, `${ORIGIN}/teamlab/band/${SLUG}`); assert.equal(tag(o.out, 'twitter:card'), 'summary_large_image')
  }
  assert.equal((await share(`/teamlab/band/${SLUG}/`)).url, `${ORIGIN}/teamlab/band/${SLUG}`)
})

test('mô tả: không slogan → "Các bài đã xuất bản của <Tên> trên TeamLab."; ảnh: cover → avatar → mặc định; khoá lạ bị bỏ', async () => {
  const one = async (o: Record<string, unknown>) => share(`/teamlab/band/${SLUG}`, SHELL, mockCtx(dbWith(() => band(o))))
  assert.equal((await one({ description: '' })).d, 'Các bài đã xuất bản của Lá Mùa Thu trên TeamLab.')
  assert.equal((await one({ description: null })).d, 'Các bài đã xuất bản của Lá Mùa Thu trên TeamLab.')
  assert.equal((await one({ cover_path: null })).img, `${STORAGE}/${AVATAR}`)
  assert.equal((await one({ cover_path: null, avatar_path: null })).img, `${ORIGIN}/teamlab/og-image.png`)
  assert.equal((await one({ cover_path: '../../etc/x.jpg', avatar_path: 'javascript:alert(1)' })).img, `${ORIGIN}/teamlab/og-image.png`)
  assert.equal((await one({ cover_path: AVATAR, avatar_path: null })).img, `${ORIGIN}/teamlab/og-image.png`)    // ảnh đại diện KHÔNG làm cover
})

test('PRIVACY: slug sai / Team không đủ điều kiện (RPC NULL) → thẻ TeamLab mặc định, không chữ nào của Band; kết quả giống nhau', async () => {
  const a = await share('/teamlab/band/khong-co-abcde'), b = await share('/teamlab/band/team-chua-len-home-zzzzz')
  for (const o of [a, b]) { assert.equal(o.r.note, 'teamlab-band:not_found'); assert.equal(o.r.meta, null); assert.equal(o.t, title(SHELL)); assert.equal(o.d, tag(SHELL, 'og:description')); assert.equal(o.img, tag(SHELL, 'og:image')); assert.doesNotMatch(o.out, /Lá Mùa Thu|Ban nhạc tình ca/) }
  assert.equal(a.out.replace(a.url!, 'U'), b.out.replace(b.url!, 'U'))
})

test('slug sai dạng / đường dẫn khác → adapter Band KHÔNG nhận, KHÔNG gọi RPC Band; Class /band/* vẫn là adapter band; /teamlab/song/* vẫn là teamlab-song', async () => {
  const log: string[] = []
  for (const p of ['/teamlab/band', '/teamlab/band/', '/teamlab/band/Sai-Dang', '/teamlab/band/a/b', '/teamlab/band/a b', `/teamlab/band/${'a'.repeat(61)}`, '/teamlab/bands/x']) {
    const o = await share(p, SHELL, mockCtx(published, { log })); assert.equal(o.r.type === 'teamlab-band', false, p); assert.equal(o.r.meta, null)
  }
  assert.deepEqual(log.filter(l => l.includes('teamlab_public_band')), [])
  const cls = await resolveShare(new URL(`${ORIGIN}/band/la-mua-thu`), mockCtx(DB)); assert.equal(cls.type, 'band'); assert.equal(cls.meta?.title.includes('Band'), true)
  const song = await resolveShare(new URL(`${ORIGIN}/teamlab/song/mua-thu-cho-em-1a093`), mockCtx({ tables: { edu_tools: [] }, rpc: { teamlab_public_song: () => null } })); assert.equal(song.type, 'teamlab-song')
})

test('RPC chỉ nhận p_slug; lỗi DB → throw (edge fail closed)', async () => {
  const seen: Record<string, unknown>[] = []
  await share(`/teamlab/band/${SLUG}`, SHELL, mockCtx(dbWith(b => { seen.push(b); return band() })))
  assert.deepEqual(seen, [{ p_slug: SLUG }])
  await assert.rejects(resolveShare(new URL(`${ORIGIN}/teamlab/band/${SLUG}`), mockCtx(published, { fail: true })))
})

const FB = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
async function edge(ua: string | null, slug = SLUG, opts: { fail?: boolean } = {}) {
  const calls: string[] = []; const realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => { calls.push(String(input)); if (opts.fail) throw new Error('network'); return new Response(JSON.stringify(slug === SLUG ? band() : null), { status: 200, headers: { 'content-type': 'application/json' } }) }) as typeof fetch
  let nextCalls = 0; const upstream = new Response(SHELL, { status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' } })
  try {
    const headers = new Headers(); if (ua !== null) headers.set('user-agent', ua)
    const res = await ogTeamlab(new Request(`${ORIGIN}/teamlab/band/${slug}`, { headers }), { next: async () => { nextCalls++; return upstream } })
    return { res, upstream, calls, nextCalls, html: await res.clone().text() }
  } finally { globalThis.fetch = realFetch }
}

test('edge: người thường / UA lạ / không UA → context.next() NGUYÊN VẸN, không đọc body, không RPC', async () => {
  for (const ua of [CHROME, 'Mozilla/5.0 something-unknown', '', null]) {
    const e = await edge(ua); assert.equal(e.res, e.upstream); assert.equal(e.nextCalls, 1); assert.deepEqual(e.calls, []); assert.equal(e.upstream.bodyUsed, false); assert.equal(e.res.headers.get('x-og-fn'), null)
  }
})
test('edge: crawler → một RPC (chỉ p_slug) → OG Band đúng; slug sai → mặc định; lỗi → fail closed', async () => {
  const e = await edge(FB)
  assert.equal(e.calls.length, 1); assert.match(e.calls[0], /\/rest\/v1\/rpc\/teamlab_public_band$/); assert.equal(e.res.headers.get('x-og-fn'), 'teamlab-band:public')
  assert.equal(title(e.html), 'Lá Mùa Thu · TeamLab'); assert.equal(tag(e.html, 'og:image'), `${STORAGE}/${COVER}`); assert.equal(tag(e.html, 'og:url'), `${ORIGIN}/teamlab/band/${SLUG}`); assert.match(e.html, /<script type="module"/)
  const w = await edge(FB, 'sai-slug-abcde'); assert.equal(w.res.headers.get('x-og-fn'), 'teamlab-band:not_found'); assert.equal(title(w.html), title(SHELL)); assert.doesNotMatch(w.html, /Lá Mùa Thu/)
  const f = await edge(FB, SLUG, { fail: true }); assert.match(f.res.headers.get('x-og-fn') ?? '', /^error:/); assert.equal(title(f.html), title(SHELL))
})
