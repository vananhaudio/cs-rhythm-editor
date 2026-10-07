// TeamLab Public Song — adapter + cổng crawler + edge function og-teamlab (chỉ /teamlab/song/*). DB/fetch giả đúng dạng RPC thật.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolveShare } from '../../netlify/og/registry.ts'
import { renderShareMeta } from '../../netlify/og/render.ts'
import { isSocialCrawler } from '../../netlify/og/crawler.ts'
import ogTeamlab from '../../netlify/edge-functions/og-teamlab.ts'
import { INDEX, mockCtx, ORIGIN, tag, title, type Db } from './fixtures.ts'

const SHELL = readFileSync(new URL('./fixtures-html/teamlab-shell.html', import.meta.url), 'utf8')   // HTML production của TeamLab (/teamlab/song/* trả shell này)
const read = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const STORAGE = 'https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/teamlab-team-avatars'
const PID = '3098cc4c-41cf-4617-8716-a3290d3eaad6'
const COVER = `${PID}/cover-1791205085438-5cvpnrsj.jpg`
const AVATAR = `${PID}/1791132763562-udhitj29.jpg`
const SLUG = 'mua-thu-cho-em-1a093'
const payload = (o: Record<string, unknown> = {}) => ({
  slug: SLUG, title: 'Mùa thu cho em', published_at: '2026-10-06T03:07:15+00:00', band: { name: 'Lá Mùa Thu 1' },
  project: { name: 'Lá Mùa Thu', cover_path: COVER, avatar_path: AVATAR }, contributors: [{ name: 'An', role_key: 'vocal' }], ...o,
})
const dbWith = (fn: (b: Record<string, unknown>) => unknown): Db => ({ tables: { edu_tools: [] }, rpc: { teamlab_public_song: fn } })
const published = dbWith(b => (b.p_slug === SLUG ? payload() : null))   // wrong slug VÀ bài đã gỡ đều là NULL từ RPC

async function share(path: string, html = SHELL, ctx = mockCtx(published)) {
  const r = await resolveShare(new URL(ORIGIN + path), ctx)
  const out = renderShareMeta(html, r.meta, r.canonicalUrl)
  return { r, out, t: title(out), d: tag(out, 'og:description'), img: tag(out, 'og:image'), url: tag(out, 'og:url'), ty: tag(out, 'og:type') }
}

test('đã xuất bản: title "Tên bài · Band", mô tả, ảnh cover, og:url canonical, twitter:* — trên HTML TeamLab thật và trên HTML Class', async () => {
  for (const html of [SHELL, INDEX]) {
    const o = await share(`/teamlab/song/${SLUG}`, html)
    assert.equal(o.r.note, 'teamlab-song:public')
    assert.equal(o.t, 'Mùa thu cho em · Lá Mùa Thu 1')
    assert.equal(tag(o.out, 'og:title'), 'Mùa thu cho em · Lá Mùa Thu 1'); assert.equal(tag(o.out, 'twitter:title'), 'Mùa thu cho em · Lá Mùa Thu 1')
    assert.equal(o.d, 'Nghe bản thu của Lá Mùa Thu trên TeamLab.'); assert.equal(tag(o.out, 'twitter:description'), o.d); assert.equal(tag(o.out, 'description'), o.d)
    assert.equal(o.img, `${STORAGE}/${COVER}`); assert.equal(tag(o.out, 'twitter:image'), o.img)
    assert.equal(o.url, `${ORIGIN}/teamlab/song/${SLUG}`)
    assert.equal(tag(o.out, 'twitter:card'), 'summary_large_image')
    assert.doesNotMatch(o.out, /og:image:(width|height)/)   // cover 1920×720 không phải 1200×630
  }
  assert.equal((await share(`/teamlab/song/${SLUG}/`)).url, `${ORIGIN}/teamlab/song/${SLUG}`)   // gạch chéo cuối bỏ
})

test('ảnh: cover → ảnh đại diện Team → ảnh mặc định TeamLab; khoá sai dạng (chống path lạ) bị bỏ qua', async () => {
  const img = async (project: Record<string, unknown>) =>
    (await share(`/teamlab/song/${SLUG}`, SHELL, mockCtx(dbWith(() => payload({ project: { name: 'Lá Mùa Thu', ...project } }))))).img
  assert.equal(await img({ cover_path: COVER, avatar_path: AVATAR }), `${STORAGE}/${COVER}`)
  assert.equal(await img({ cover_path: null, avatar_path: AVATAR }), `${STORAGE}/${AVATAR}`)
  assert.equal(await img({ cover_path: null, avatar_path: null }), `${ORIGIN}/teamlab/og-image.png`)
  assert.equal(await img({ cover_path: '../../etc/x.jpg', avatar_path: null }), `${ORIGIN}/teamlab/og-image.png`)
  assert.equal(await img({ cover_path: AVATAR, avatar_path: null }), `${ORIGIN}/teamlab/og-image.png`)   // khoá ảnh đại diện KHÔNG được dùng làm cover
  assert.equal(await img({ cover_path: 'https://evil.example/x.jpg', avatar_path: 'javascript:alert(1)' }), `${ORIGIN}/teamlab/og-image.png`)
})

test('không có Band → dùng tên Team; không có cả hai → "TeamLab"', async () => {
  const t = async (o: Record<string, unknown>) => (await share(`/teamlab/song/${SLUG}`, SHELL, mockCtx(dbWith(() => payload(o))))).t
  assert.equal(await t({ band: null }), 'Mùa thu cho em · Lá Mùa Thu')
  assert.equal(await t({ band: null, project: { name: '' } }), 'Mùa thu cho em · TeamLab')
})

test('PRIVACY: slug sai / bài chưa xuất bản / đã gỡ (RPC NULL) → CÙNG thẻ mặc định TeamLab, không chữ nào của bài', async () => {
  const wrong = await share('/teamlab/song/sai-slug-abcde'), gone = await share('/teamlab/song/mua-thu-cho-em-2-0400d')
  for (const o of [wrong, gone]) {
    assert.equal(o.r.note, 'teamlab-song:not_found'); assert.equal(o.r.meta, null)
    assert.equal(o.t, title(SHELL)); assert.equal(o.d, tag(SHELL, 'og:description')); assert.equal(o.img, tag(SHELL, 'og:image'))
    assert.doesNotMatch(o.out, /Mùa thu|Lá Mùa Thu/)
  }
  // Hai kết quả chỉ khác og:url (đúng URL được mở)
  assert.equal(wrong.out.replace(wrong.url!, 'U'), gone.out.replace(gone.url!, 'U'))
})

test('slug sai dạng / đường dẫn khác → adapter TeamLab KHÔNG nhận, KHÔNG gọi RPC TeamLab (thẻ mặc định)', async () => {
  const log: string[] = []
  for (const p of ['/teamlab/song', '/teamlab/song/', '/teamlab/song/Mua-Thu', '/teamlab/song/a/b', '/teamlab/song/a b', `/teamlab/song/${'a'.repeat(61)}`, '/teamlab', '/teamlab/project/x', '/teamlab/songs/x']) {
    const o = await share(p, SHELL, mockCtx(published, { log }))
    assert.equal(o.r.type, 'page', p); assert.equal(o.r.meta, null)
  }
  assert.deepEqual(log.filter(l => l.includes('teamlab')), [])   // (đường dẫn một đoạn có thể tới adapter tool — không liên quan TeamLab)
})

test('RPC chỉ nhận p_slug; lỗi DB → throw (edge fail closed, không metadata dở dang)', async () => {
  const seen: Record<string, unknown>[] = []
  await share(`/teamlab/song/${SLUG}`, SHELL, mockCtx(dbWith(b => { seen.push(b); return payload() })))
  assert.deepEqual(seen, [{ p_slug: SLUG }])
  await assert.rejects(resolveShare(new URL(`${ORIGIN}/teamlab/song/${SLUG}`), mockCtx(published, { fail: true })))
})

test('crawler matcher: nhận crawler mạng xã hội; trình duyệt thường / UA lạ / rỗng / quá dài → KHÔNG', () => {
  const yes = [
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'facebookexternalhit/1.1;line-poker/1.0',
    'Facebot', 'Twitterbot/1.0', 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
    'TelegramBot (like TwitterBot)', 'WhatsApp/2.23.20.0 A', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)', 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Zalo/23.1',
  ]
  const no = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'curl/8.7.1', 'Mozilla/5.0 something-unknown', 'face', '',
    'x'.repeat(600) + ' facebookexternalhit',
  ]
  for (const ua of yes) assert.equal(isSocialCrawler(ua), true, ua)
  for (const ua of no) assert.equal(isSocialCrawler(ua), false, ua.slice(0, 60))
  assert.equal(isSocialCrawler(null), false); assert.equal(isSocialCrawler(undefined), false)
})

// ── edge function og-teamlab: fetch giả (không mạng) ──
const FB = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
async function edge(ua: string | null, slug = SLUG, opts: { method?: string; rpc?: () => unknown; fail?: boolean } = {}) {
  const calls: string[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input))
    if (opts.fail) throw new Error('network')
    return new Response(JSON.stringify(opts.rpc ? opts.rpc() : slug === SLUG ? payload() : null), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  let nextCalls = 0
  const upstream = new Response(SHELL, { status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' } })
  try {
    const headers = new Headers(); if (ua !== null) headers.set('user-agent', ua)
    const res = await ogTeamlab(new Request(`${ORIGIN}/teamlab/song/${slug}`, { method: opts.method ?? 'GET', headers }), { next: async () => { nextCalls++; return upstream } })
    return { res, upstream, calls, nextCalls, html: await res.clone().text() }
  } finally { globalThis.fetch = realFetch }
}

test('edge: người dùng bình thường / UA lạ / không UA → context.next() NGUYÊN VẸN, không đọc body, không gọi RPC', async () => {
  for (const ua of [CHROME, 'Mozilla/5.0 something-unknown', '', null]) {
    const e = await edge(ua)
    assert.equal(e.res, e.upstream, 'trả đúng response proxy, không bọc lại'); assert.equal(e.nextCalls, 1); assert.deepEqual(e.calls, [])
    assert.equal(e.upstream.bodyUsed, false); assert.equal(e.res.headers.get('x-og-fn'), null)
  }
})

test('edge: crawler → gọi RPC một lần (chỉ p_slug) và nhận HTML có OG đúng; header x-og-fn', async () => {
  const e = await edge(FB)
  assert.equal(e.nextCalls, 1); assert.equal(e.calls.length, 1); assert.match(e.calls[0], /\/rest\/v1\/rpc\/teamlab_public_song$/)
  assert.equal(e.res.headers.get('x-og-fn'), 'teamlab-song:public')
  assert.equal(title(e.html), 'Mùa thu cho em · Lá Mùa Thu 1'); assert.equal(tag(e.html, 'og:image'), `${STORAGE}/${COVER}`)
  assert.equal(tag(e.html, 'og:url'), `${ORIGIN}/teamlab/song/${SLUG}`); assert.match(e.html, /<script type="module"/)   // SPA giữ nguyên
})

test('edge: crawler + slug sai / đã gỡ → thẻ TeamLab mặc định; RPC lỗi → fail closed; POST bỏ qua', async () => {
  const w = await edge(FB, 'sai-slug-abcde')
  assert.equal(w.res.headers.get('x-og-fn'), 'teamlab-song:not_found'); assert.equal(title(w.html), title(SHELL)); assert.doesNotMatch(w.html, /Mùa thu/)
  const f = await edge(FB, SLUG, { fail: true })
  assert.match(f.res.headers.get('x-og-fn') ?? '', /^error:/); assert.equal(title(f.html), title(SHELL)); assert.equal(f.res.status, 200)
  const p = await edge(FB, SLUG, { method: 'POST' })
  assert.equal(p.res.headers.get('x-og-fn'), 'skip'); assert.deepEqual(p.calls, [])
})

test('cấu hình: og-teamlab CHỈ /teamlab/song/*; og.ts vẫn loại trừ /teamlab/* và không nhắc /teamlab/song; không có edge function thứ ba', () => {
  const t = read('netlify/edge-functions/og-teamlab.ts')
  assert.match(t, /path: '\/teamlab\/song\/\*'/); assert.doesNotMatch(t, /excludedPath/)
  assert.deepEqual([...t.matchAll(/path: ('[^']+'|\[[^\]]*\])/g)].map(m => m[1]), ["'/teamlab/song/*'"])
  const og = read('netlify/edge-functions/og.ts')
  const excluded = [...og.slice(og.indexOf('excludedPath')).matchAll(/'(\/[^']*)'/g)].map(m => m[1])
  assert.ok(excluded.includes('/teamlab') && excluded.includes('/teamlab/*')); assert.ok(!excluded.some(e => e.startsWith('/teamlab/song')))
  assert.match(og, /path: '\/\*'/)
  assert.deepEqual(readdirSync(new URL('../../netlify/edge-functions/', import.meta.url)).sort(), ['og-teamlab.ts', 'og.ts'])
  // Cổng crawler đứng TRƯỚC mọi xử lý: người thường đi thẳng context.next()
  assert.ok(t.indexOf('isSocialCrawler(') < t.indexOf('ogHandler(req'))
})
