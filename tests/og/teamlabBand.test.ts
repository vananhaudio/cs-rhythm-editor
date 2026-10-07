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

// ─── Slice E: path workspace /teamlab/band/<slug>/room… dùng metadata CÔNG KHAI của Team ───────────────────────────
const BAND_ID = '11111111-2222-3333-4444-555555555555', SONG_ID = '99999999-aaaa-bbbb-cccc-dddddddddddd'
const ROOM_PATHS = [`/teamlab/band/${SLUG}/room`, `/teamlab/band/${SLUG}/room/`, `/teamlab/band/${SLUG}/room/group/none`, `/teamlab/band/${SLUG}/room/group/${BAND_ID}`, `/teamlab/band/${SLUG}/room/studio/${SONG_ID}`]

test('Slice E: /room, /room/group/none|<id>, /room/studio/<id> → CÙNG title/mô tả/ảnh/og:url canonical với trang Band công khai', async () => {
  const base = await share(`/teamlab/band/${SLUG}`)
  for (const p of ROOM_PATHS) {
    const o = await share(p)
    assert.equal(o.r.note, 'teamlab-band:public', p)
    assert.equal(o.t, 'Lá Mùa Thu · TeamLab', p); assert.equal(o.d, base.d, p); assert.equal(o.img, `${STORAGE}/${COVER}`, p)
    assert.equal(tag(o.out, 'twitter:image'), o.img, p); assert.equal(tag(o.out, 'twitter:title'), o.t, p)
    assert.equal(o.url, `${ORIGIN}/teamlab/band/${SLUG}`, `${p}: og:url phải về trang Band công khai, không phải /room hay /studio`)
    assert.equal(o.out, base.out, `${p}: toàn bộ thẻ giống trang Band công khai`)
  }
})

test('Slice E PRIVACY: id Band con / id bài KHÔNG vào RPC, tiêu đề, mô tả, ảnh hay og:url; chỉ một RPC teamlab_public_band theo p_slug', async () => {
  const log: string[] = []; const seen: Record<string, unknown>[] = []
  const ctx = mockCtx(dbWith(b => { seen.push(b); return b.p_slug === SLUG ? band() : null }), { log })
  for (const p of ROOM_PATHS) {
    const o = await share(p, SHELL, ctx)
    for (const v of [BAND_ID, SONG_ID, 'studio', 'group']) for (const t of [o.t, o.d, o.img, o.url, tag(o.out, 'twitter:title'), tag(o.out, 'twitter:description')]) assert.ok(!String(t).includes(v), `${p}: "${v}" lọt vào thẻ`)
  }
  assert.deepEqual(seen, ROOM_PATHS.map(() => ({ p_slug: SLUG })), 'RPC chỉ nhận p_slug')
  assert.equal(log.filter(l => !l.includes('teamlab_public_band')).length, 0, 'không truy vấn nào khác (không bài, take, thành viên)')
})

test('Slice E: Team chưa công khai / riêng tư / slug lạ qua /room… → thẻ TeamLab mặc định, KHÔNG chữ nào của Band, kết quả giống nhau', async () => {
  const outs: string[] = []
  for (const slug of ['khong-co-abcde', 'team-chua-len-home-zzzzz']) for (const suffix of ['/room', `/room/group/${BAND_ID}`, `/room/studio/${SONG_ID}`]) {
    const o = await share(`/teamlab/band/${slug}${suffix}`)
    assert.equal(o.r.note, 'teamlab-band:not_found'); assert.equal(o.r.meta, null); assert.equal(o.t, title(SHELL)); assert.equal(o.img, tag(SHELL, 'og:image'))
    assert.ok(!o.out.includes('Lá Mùa Thu') && !o.out.includes('Ban nhạc tình ca'))
    outs.push(o.out.replace(o.url!, 'U'))
  }
  assert.ok(outs.every(x => x === outs[0]), 'Team chưa công khai và slug lạ không phân biệt được (trừ og:url)')
})

test('Slice E: dạng hỏng/lạ dưới /room không được nhận (không RPC, mặc định); trang khác không đổi', async () => {
  const log: string[] = []
  for (const p of [`/teamlab/band/${SLUG}/room/group`, `/teamlab/band/${SLUG}/room/group/zzz`, `/teamlab/band/${SLUG}/room/studio/none`, `/teamlab/band/${SLUG}/room/studio/not-a-uuid`,
    `/teamlab/band/${SLUG}/room/foo`, `/teamlab/band/${SLUG}/room/studio/${SONG_ID}/x`, `/teamlab/band/${SLUG}/roomy`, `/teamlab/band/${SLUG}/ROOM`, `/teamlab/band/${SLUG}/studio/${SONG_ID}`, `/teamlab/band/${SLUG}/x/y/z/w`]) {
    const o = await share(p, SHELL, mockCtx(published, { log })); assert.equal(o.r.type === 'teamlab-band', false, p); assert.equal(o.r.meta, null, p)
  }
  assert.deepEqual(log.filter(l => l.includes('teamlab_public_band')), [])
})

test('Slice E edge: crawler ở /room… → OG Team công khai; người thường → context.next() nguyên vẹn; UA Zalo/Twitterbot/WhatsApp cùng kết quả', async () => {
  const ua = ['facebookexternalhit/1.1', 'Zalo', 'Twitterbot/1.0', 'WhatsApp/2.23', 'Slackbot-LinkExpanding 1.0']
  for (const path of ROOM_PATHS.slice(0, 1).concat(ROOM_PATHS.slice(2))) for (const u of ua) {
    const calls: string[] = []; const realFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => { calls.push(String(input)); return new Response(JSON.stringify(band()), { status: 200, headers: { 'content-type': 'application/json' } }) }) as typeof fetch
    try {
      const res = await ogTeamlab(new Request(`${ORIGIN}${path}`, { headers: { 'user-agent': u } }), { next: async () => new Response(SHELL, { status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' } }) })
      const html = await res.text()
      assert.equal(res.headers.get('x-og-fn'), 'teamlab-band:public', `${u} ${path}`); assert.equal(title(html), 'Lá Mùa Thu · TeamLab'); assert.equal(tag(html, 'og:url'), `${ORIGIN}/teamlab/band/${SLUG}`)
      assert.equal(calls.length, 1)
    } finally { globalThis.fetch = realFetch }
  }
  const upstream = new Response(SHELL, { status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' } })
  const res = await ogTeamlab(new Request(`${ORIGIN}${ROOM_PATHS[0]}`, { headers: { 'user-agent': CHROME } }), { next: async () => upstream })
  assert.equal(res, upstream); assert.equal(upstream.bodyUsed, false)
})
