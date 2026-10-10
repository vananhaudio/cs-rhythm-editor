// TeamLab Public Band — adapter /teamlab/band/<slug> + edge og-teamlab (không phụ thuộc User-Agent) + không đụng Class /band/* và /teamlab/song/*.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveShare } from '../../netlify/og/registry.ts'
import { renderShareMeta } from '../../netlify/og/render.ts'
import ogTeamlab from '../../netlify/edge-functions/og-teamlab.ts'
import { resetShareMemo } from '../../netlify/og/adapter.ts'
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
  resetShareMemo()
  const calls: string[] = []; const realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => { calls.push(String(input)); if (opts.fail) throw new Error('network'); return new Response(JSON.stringify(slug === SLUG ? band() : null), { status: 200, headers: { 'content-type': 'application/json' } }) }) as typeof fetch
  let nextCalls = 0; const upstream = new Response(SHELL, { status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' } })
  try {
    const headers = new Headers(); if (ua !== null) headers.set('user-agent', ua)
    const res = await ogTeamlab(new Request(`${ORIGIN}/teamlab/band/${slug}`, { headers }), { next: async () => { nextCalls++; return upstream } })
    return { res, upstream, calls, nextCalls, html: await res.clone().text() }
  } finally { globalThis.fetch = realFetch }
}

test('edge: KHÔNG phụ thuộc User-Agent — người thường / UA lạ / không UA nhận cùng OG Band, đúng một RPC (chỉ p_slug)', async () => {
  for (const ua of [CHROME, FB, 'Mozilla/5.0 something-unknown', 'Viber', 'Skype', '', null]) {
    const e = await edge(ua); assert.equal(e.nextCalls, 1, String(ua)); assert.equal(e.calls.length, 1, String(ua)); assert.match(e.calls[0], /\/rest\/v1\/rpc\/teamlab_public_band$/)
    assert.equal(e.res.headers.get('x-og-fn'), 'teamlab-band:public', String(ua)); assert.equal(title(e.html), 'Lá Mùa Thu · TeamLab', String(ua))
    assert.equal(tag(e.html, 'og:image'), `${STORAGE}/${COVER}`, String(ua)); assert.equal(tag(e.html, 'og:url'), `${ORIGIN}/teamlab/band/${SLUG}`, String(ua))
    assert.equal(tag(e.html, 'og:description'), 'Ban nhạc tình ca', String(ua)); assert.match(e.html, /<script type="module"/)
  }
})
test('edge: một RPC (chỉ p_slug) → OG Band đúng; slug sai → mặc định; lỗi → fail closed', async () => {
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
    resetShareMemo()   // đếm RPC theo từng path, không bị cache che
    const o = await share(p, SHELL, ctx)
    for (const v of [BAND_ID, SONG_ID, 'studio', 'group']) for (const t of [o.t, o.d, o.img, o.url, tag(o.out, 'twitter:title'), tag(o.out, 'twitter:description')]) assert.ok(!String(t).includes(v), `${p}: "${v}" lọt vào thẻ`)
  }
  assert.deepEqual(seen, ROOM_PATHS.map(() => ({ p_slug: SLUG })), 'RPC chỉ nhận p_slug')
  // Studio: thêm ĐÚNG MỘT RPC công khai về bài (nhường lại Team khi NULL); không bảng nào, không take/thành viên.
  assert.deepEqual([...new Set(log)].sort(), ['rpc:teamlab_public_band', 'rpc:teamlab_public_workspace_song'], 'chỉ hai RPC công khai')
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

test('Slice E edge: /room… → OG Team công khai với MỌI User-Agent (kể cả người thường / không UA)', async () => {
  const ua = ['facebookexternalhit/1.1', 'Zalo', 'Twitterbot/1.0', 'WhatsApp/2.23', 'Slackbot-LinkExpanding 1.0', CHROME, 'Viber', '']
  for (const path of ROOM_PATHS.slice(0, 1).concat(ROOM_PATHS.slice(2, 4))) for (const u of ua) {   // Studio có test riêng bên dưới
    resetShareMemo(); const calls: string[] = []; const realFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => { calls.push(String(input)); return new Response(JSON.stringify(band()), { status: 200, headers: { 'content-type': 'application/json' } }) }) as typeof fetch
    try {
      const res = await ogTeamlab(new Request(`${ORIGIN}${path}`, { headers: { 'user-agent': u } }), { next: async () => new Response(SHELL, { status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' } }) })
      const html = await res.text()
      assert.equal(res.headers.get('x-og-fn'), 'teamlab-band:public', `${u} ${path}`); assert.equal(title(html), 'Lá Mùa Thu · TeamLab'); assert.equal(tag(html, 'og:url'), `${ORIGIN}/teamlab/band/${SLUG}`)
      assert.equal(calls.length, 1)
    } finally { globalThis.fetch = realFetch }
  }
})

// ─── Studio: xem trước theo BÀI (teamlab_public_workspace_song) ─────────────────────────────────────────────────
const PUB_SONG = '99999999-aaaa-bbbb-cccc-dddddddddddd', DRAFT_SONG = '88888888-aaaa-bbbb-cccc-dddddddddddd', OTHER_TEAM_SONG = '77777777-aaaa-bbbb-cccc-dddddddddddd'
const PROJECT = { name: 'Lá Mùa Thu', slug: SLUG, cover_path: COVER, avatar_path: AVATAR }
const SONGS: Record<string, unknown> = {
  [`${SLUG}|${PUB_SONG}`]: { title: 'Mùa thu cho em', song_slug: 'mua-thu-cho-em-1a093', published: true, project: PROJECT },
  [`${SLUG}|${DRAFT_SONG}`]: { title: 'Khói thuốc đợi chờ', song_slug: null, published: false, project: PROJECT },
}
const studioDb: Db = { tables: { edu_tools: [] }, rpc: {
  teamlab_public_workspace_song: b => SONGS[`${b.p_slug}|${b.p_song_id}`] ?? null,   // như RPC thật: Team khác / id lạ → NULL
  teamlab_public_band: b => (b.p_slug === SLUG ? band() : null),
} }
const studio = (slug: string, id: string, log?: string[]) => share(`/teamlab/band/${slug}/room/studio/${id}`, SHELL, mockCtx(studioDb, { log }))

test('Studio bài ĐÃ XUẤT BẢN: title "<Tên bài> · <Team>", ảnh cover Team, canonical = /teamlab/song/<slug> của chính bài', async () => {
  const o = await studio(SLUG, PUB_SONG)
  assert.equal(o.r.note, 'teamlab-studio:public'); assert.equal(o.t, 'Mùa thu cho em · Lá Mùa Thu'); assert.equal(tag(o.out, 'og:title'), o.t); assert.equal(tag(o.out, 'twitter:title'), o.t)
  assert.equal(o.d, 'Nghe bản thu của Lá Mùa Thu trên TeamLab.'); assert.equal(o.img, `${STORAGE}/${COVER}`); assert.equal(tag(o.out, 'twitter:image'), o.img)
  assert.equal(o.url, `${ORIGIN}/teamlab/song/mua-thu-cho-em-1a093`)
})

test('Studio bài ĐANG TẬP (Team công khai): tên bài + Team, mô tả trung tính, canonical = chính URL Studio; không lộ slug bài, Band con, take', async () => {
  const o = await studio(SLUG, DRAFT_SONG)
  assert.equal(o.r.note, 'teamlab-studio:public'); assert.equal(o.t, 'Khói thuốc đợi chờ · Lá Mùa Thu'); assert.equal(o.d, 'Phòng tập của Lá Mùa Thu trên TeamLab.')
  assert.equal(o.img, `${STORAGE}/${COVER}`); assert.equal(o.url, `${ORIGIN}/teamlab/band/${SLUG}/room/studio/${DRAFT_SONG}`)
  for (const t of [o.t, o.d, o.img, tag(o.out, 'twitter:description')]) assert.doesNotMatch(String(t), /Nghe bản thu|SECRET|Band con|take|thành viên/i)
})

test('Studio: ảnh cover → avatar → mặc định TeamLab; khoá ảnh sai dạng bị bỏ', async () => {
  const one = async (project: Record<string, unknown>) => {
    const db: Db = { tables: { edu_tools: [] }, rpc: { teamlab_public_workspace_song: () => ({ title: 'Bài', song_slug: null, published: false, project: { ...PROJECT, ...project } }) } }
    return share(`/teamlab/band/${SLUG}/room/studio/${DRAFT_SONG}`, SHELL, mockCtx(db))
  }
  assert.equal((await one({ cover_path: null })).img, `${STORAGE}/${AVATAR}`)
  assert.equal((await one({ cover_path: null, avatar_path: null })).img, `${ORIGIN}/teamlab/og-image.png`)
  assert.equal((await one({ cover_path: '../../x.jpg', avatar_path: 'javascript:1' })).img, `${ORIGIN}/teamlab/og-image.png`)
})

test('Studio CHỐNG ĐỔI ID: bài của Team khác / id lạ → RPC NULL → thẻ của Team công khai trong URL (không lộ bài kia); Team riêng tư/lạ → mặc định', async () => {
  for (const id of [OTHER_TEAM_SONG, '66666666-aaaa-bbbb-cccc-dddddddddddd']) {
    const o = await studio(SLUG, id)
    assert.equal(o.r.note, 'teamlab-band:public', 'nhường cho adapter Team'); assert.equal(o.t, 'Lá Mùa Thu · TeamLab'); assert.equal(o.url, `${ORIGIN}/teamlab/band/${SLUG}`)
    assert.doesNotMatch(o.out, /Mùa thu cho em|Khói thuốc/)
  }
  for (const slug of ['team-chua-len-home-zzzzz', 'khong-co-abcde']) {
    const o = await studio(slug, PUB_SONG)
    assert.equal(o.r.note, 'teamlab-band:not_found'); assert.equal(o.t, title(SHELL)); assert.doesNotMatch(o.out, /Mùa thu cho em|Lá Mùa Thu/)
  }
})

test('Studio: RPC chỉ nhận (p_slug, p_song_id); slug trả về lệch URL → bỏ; id sai dạng → không gọi RPC bài; lỗi DB → throw', async () => {
  const seen: Record<string, unknown>[] = []
  const db: Db = { tables: { edu_tools: [] }, rpc: { teamlab_public_workspace_song: b => { seen.push(b); return SONGS[`${b.p_slug}|${b.p_song_id}`] ?? null }, teamlab_public_band: () => null } }
  await share(`/teamlab/band/${SLUG}/room/studio/${PUB_SONG.toUpperCase()}`, SHELL, mockCtx(db))
  assert.deepEqual(seen, [{ p_slug: SLUG, p_song_id: PUB_SONG }])
  const lie: Db = { tables: { edu_tools: [] }, rpc: { teamlab_public_workspace_song: () => ({ title: 'Lệch', song_slug: null, published: false, project: { ...PROJECT, slug: 'team-khac-aaaaa' } }), teamlab_public_band: () => null } }
  assert.equal((await share(`/teamlab/band/${SLUG}/room/studio/${PUB_SONG}`, SHELL, mockCtx(lie))).r.meta, null)
  const log: string[] = []
  for (const p of [`/teamlab/band/${SLUG}/room/studio/not-a-uuid`, `/teamlab/band/${SLUG}/room/studio/none`, `/teamlab/band/${SLUG}/room/group/${PUB_SONG}`, `/teamlab/band/${SLUG}/room`])
    await share(p, SHELL, mockCtx(studioDb, { log }))
  assert.equal(log.filter(l => l === 'rpc:teamlab_public_workspace_song').length, 0, 'chỉ đúng /room/studio/<uuid> mới hỏi RPC bài')
  await assert.rejects(resolveShare(new URL(`${ORIGIN}/teamlab/band/${SLUG}/room/studio/${PUB_SONG}`), mockCtx(studioDb, { fail: true })))
})

test('Studio: group/<bandId> và room giữ thẻ Team (Band con chưa có metadata công khai riêng)', async () => {
  for (const p of [`/teamlab/band/${SLUG}/room`, `/teamlab/band/${SLUG}/room/group/none`, `/teamlab/band/${SLUG}/room/group/${BAND_ID}`]) {
    const o = await share(p, SHELL, mockCtx(studioDb)); assert.equal(o.r.note, 'teamlab-band:public'); assert.equal(o.t, 'Lá Mùa Thu · TeamLab'); assert.equal(o.url, `${ORIGIN}/teamlab/band/${SLUG}`)
  }
})

test('Studio edge: thẻ BÀI với MỌI User-Agent (kể cả người thường / không UA)', async () => {
  for (const u of ['facebookexternalhit/1.1', 'Zalo', 'Twitterbot/1.0', 'WhatsApp/2.23', CHROME, 'Viber', '']) {
    resetShareMemo(); const realFetch = globalThis.fetch; const calls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => { calls.push(String(input)); const b = JSON.parse(String(init?.body ?? '{}'))
      const r = String(input).endsWith('teamlab_public_workspace_song') ? SONGS[`${b.p_slug}|${b.p_song_id}`] ?? null : band()
      return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } }) }) as typeof fetch
    try {
      const res = await ogTeamlab(new Request(`${ORIGIN}/teamlab/band/${SLUG}/room/studio/${DRAFT_SONG}`, { headers: { 'user-agent': u } }), { next: async () => new Response(SHELL, { status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' } }) })
      const html = await res.text()
      assert.equal(res.headers.get('x-og-fn'), 'teamlab-studio:public', u); assert.equal(title(html), 'Khói thuốc đợi chờ · Lá Mùa Thu'); assert.equal(calls.length, 1)
    } finally { globalThis.fetch = realFetch }
  }
})
