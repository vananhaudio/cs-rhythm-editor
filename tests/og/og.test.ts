// Universal OG — URL → Registry → Adapter → ShareMeta → Renderer (netlify/og). DB giả đúng dạng PostgREST (fixtures.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveShare } from '../../netlify/og/registry.ts'
import { renderShareMeta } from '../../netlify/og/render.ts'
import { publicMeta, resolveOgImage, safeImage } from '../../netlify/og/contract.ts'
import {
  BAND_COVER, CANCELLED_ID, CLASS_ID, DB, DH1_LOGO, INDEX, mockCtx, NOSESSION_ID, OPEN_ID, ORIGIN, SOLO_LOGO, STORY_PHOTO, tag, title,
} from './fixtures.ts'

const DEFAULT_TITLE = title(INDEX)
const DEFAULT_IMAGE = tag(INDEX, 'og:image')
const DEFAULT_DESC = tag(INDEX, 'og:description')

/** Chạy đủ đường ống như edge: resolve → render. */
async function share(path: string, ctx = mockCtx()) {
  const url = new URL(ORIGIN + path)
  const r = await resolveShare(url, ctx)
  const html = renderShareMeta(INDEX, r.meta, r.canonicalUrl)
  return { r, html, t: title(html), d: tag(html, 'og:description'), img: tag(html, 'og:image'), url: tag(html, 'og:url') }
}
const isDefault = (o: { t?: string; d: string | null; img: string | null }) =>
  o.t === DEFAULT_TITLE && o.d === DEFAULT_DESC && o.img === DEFAULT_IMAGE

// ── contract ──
test('contract: resolveOgImage = ảnh https đầu tiên; safeImage chặn http/tương đối/quá dài', () => {
  assert.equal(resolveOgImage([null, '', 'http://x/a.png', '/a.png', 'https://a.com/1.png', 'https://a.com/2.png']), 'https://a.com/1.png')
  assert.equal(resolveOgImage([]), null)
  assert.equal(safeImage('javascript:alert(1)'), null)
  assert.equal(safeImage('https://a.com/' + 'x'.repeat(1000)), null)
  const m = publicMeta({ title: '  ', description: 'd', image: null, canonicalUrl: ORIGIN + '/x' })
  assert.equal(m.visibility, 'not_found', 'không tiêu đề → không public')
})

test('renderer: escape; private/not_found chỉ sửa og:url, giữ toàn bộ thẻ mặc định', () => {
  const out = renderShareMeta(INDEX, { title: 'A "<b>" & C', description: 'D', image: null, canonicalUrl: ORIGIN + '/x', visibility: 'public' }, ORIGIN + '/x')
  assert.equal(title(out), 'A &quot;&lt;b&gt;&quot; &amp; C')
  for (const v of ['private', 'not_found'] as const) {
    const h = renderShareMeta(INDEX, { title: 'BÍ MẬT', description: 'BÍ MẬT', image: 'https://a.com/x.png', canonicalUrl: ORIGIN + '/y', visibility: v }, ORIGIN + '/y')
    assert.ok(!h.includes('BÍ MẬT') && !h.includes('a.com/x.png'))
    assert.equal(tag(h, 'og:url'), ORIGIN + '/y')
    assert.equal(h.replace(/og:url" content="[^"]*"/, ''), INDEX.replace(/og:url" content="[^"]*"/, ''))
  }
})

// ── adapters: resource MỚI không cần sửa code (dữ liệu mới → preview mới) ──
test('Band: mọi slug qua RPC công khai; ảnh bìa → mặc định; Band mới chỉ cần dữ liệu', async () => {
  const o = await share('/band/La-Mua-Thu/')
  assert.equal(o.t, 'Lá Mùa Thu · Band · Thầy Văn Anh Guitar')
  assert.equal(o.img, BAND_COVER)
  assert.equal(o.url, ORIGIN + '/band/la-mua-thu')
  const db = { ...DB, rpc: { band_recruitment_public: (b: Record<string, unknown>) =>
    ({ band: { slug: b.p_slug, name: 'Band Mới Toanh', tagline: null, cover_url: null } }) } }
  const n = await share('/band/band-moi-toanh', mockCtx(db))
  assert.equal(n.t, 'Band Mới Toanh · Band · Thầy Văn Anh Guitar')
  assert.equal(n.img, DEFAULT_IMAGE)
})

test('Tool: theo edu_tools.route, không khai từng tool — /metronome tự có preview; route trùng / off → mặc định', async () => {
  const np = await share('/nhipphach/')
  assert.equal(np.t, 'Đọc nhịp – phách | Thầy Văn Anh Guitar')
  assert.equal(np.d, 'Đọc nhịp và phách trên bản nhạc')
  assert.equal(np.url, ORIGIN + '/nhipphach')
  assert.equal((await share('/metronome')).t, 'Máy đập nhịp | Thầy Văn Anh Guitar')
  for (const p of ['/tap', '/tempo', '/thuvien', '/start']) {
    const o = await share(p)
    assert.ok(isDefault(o), p)
    assert.equal(o.r.note, 'page', p)
    assert.equal(o.url, ORIGIN + p)
  }
  const withImg = { ...DB, tables: { ...DB.tables, edu_tools: [{ route: '/nhipphach', name: 'N', status: 'on', image_url: 'https://x.co/n.png' }] } }
  assert.equal((await share('/nhipphach', mockCtx(withImg))).img, 'https://x.co/n.png')
})

test('Chỉ mục tool nạp một lần cho nhiều request (cache 60 giây)', async () => {
  const log: string[] = []
  const ctx = mockCtx(DB, { log })
  await resolveShare(new URL(ORIGIN + '/metronome'), ctx)
  await resolveShare(new URL(ORIGIN + '/start'), ctx)
  assert.equal(log.filter(p => p.includes('edu_tools')).length, 1)
})

test('Lớp / Buổi: ảnh lớp → ảnh khoá → mặc định; /space giữ URL', async () => {
  const c = await share(`/me/classes/${CLASS_ID}`)
  assert.equal(c.t, 'Khởi đầu đam mê khoá 17 - KD17 · Thầy Văn Anh Guitar')
  assert.equal(c.img, DH1_LOGO)
  assert.equal((await share(`/me/classes/${CLASS_ID}/space`)).url, `${ORIGIN}/me/classes/${CLASS_ID}/space`)
  const s = await share(`/me/classes/${CLASS_ID}/sessions/3`)
  assert.equal(s.t, 'Buổi 03 · Khởi đầu đam mê khoá 17 - KD17 · Thầy Văn Anh Guitar')
  assert.equal(s.img, DH1_LOGO)
  const covered = { ...DB, tables: { ...DB.tables, class_schedule: DB.tables.class_schedule.map(r =>
    r.id === CLASS_ID ? { ...r, cover_url: 'https://x.co/lop.png' } : r) } }
  assert.equal((await share(`/me/classes/${CLASS_ID}/sessions/3`, mockCtx(covered))).img, 'https://x.co/lop.png')
})

test('Landing gắn entity: /solo01 = khoá SOLO; /hanhtrinh2027 = lớp chương trình HT2027; trang con giữ URL', async () => {
  const s = await share('/solo01')
  assert.equal(s.t, 'Solo Guitar Căn Bản | Thầy Văn Anh Guitar')
  assert.equal(s.img, SOLO_LOGO)
  assert.equal((await share('/solo01/dang-ky')).url, ORIGIN + '/solo01/dang-ky')
  const h = await share('/hanhtrinh2027')
  assert.equal(h.t, 'Hành trình 2027 — 40 buổi thực hành · Thầy Văn Anh Guitar')
  assert.equal(h.img, DEFAULT_IMAGE)
})

test('Story: bài publish → tiêu đề + ảnh + article; trang ứng dụng /story/tell và bài lạ → mặc định, og:url đúng', async () => {
  const o = await share('/story/song-lo')
  assert.equal(o.t, '20 năm ngắt quãng, đam mê vẫn còn nguyên — 1001 Câu chuyện cùng Guitar')
  assert.equal(o.d, 'Một câu chuyện dài…')
  assert.equal(o.img, STORY_PHOTO)
  assert.equal(tag(o.html, 'og:type'), 'article')
  for (const p of ['/story/tell', '/story/khong-co']) {
    const d = await share(p)
    assert.ok(isDefault(d), p)
    assert.equal(d.url, ORIGIN + p)
  }
})

test('Showcase: trang publish → tiêu đề/mô tả; chưa publish → mặc định', async () => {
  const o = await share('/showcase/ai-lam-ra-cay-dan')
  assert.equal(o.t, 'Ai làm ra cây đàn? | Văn Anh Audio')
  assert.equal(o.d, 'Hành trình của một cây đàn.')
  const draft = { ...DB, tables: { ...DB.tables, showcase_pages: DB.tables.showcase_pages.map(p => ({ ...p, published: false })) } }
  assert.ok(isDefault(await share('/showcase/ai-lam-ra-cay-dan', mockCtx(draft))))
})

test('Route không phải resource → mặc định Class, og:url = đúng URL (không còn trỏ về trang chủ)', async () => {
  for (const p of ['/', '/me', '/learn', '/admin/x', '/course']) {
    const o = await share(p + '?fbclid=1')
    assert.ok(isDefault(o), p)
    assert.equal(o.url, ORIGIN + p.replace(/^\/$/, '/'))
  }
})

// ── PRIVACY: private / not_found / lỗi / quá giờ → fail closed ──
test('PRIVACY: lớp đã huỷ / nháp → mặc định, không lộ tên lớp; buổi của lớp đó cũng vậy', async () => {
  for (const p of [`/me/classes/${CANCELLED_ID}`, `/me/classes/${CANCELLED_ID}/sessions/3`, `/me/classes/${NOSESSION_ID}`]) {
    const o = await share(p)
    assert.ok(isDefault(o), p)
    assert.ok(!o.html.includes('huỷ KD19') && !o.html.includes('Lớp nháp'), p)
    assert.match(o.r.note, /:private$/)
    assert.equal(o.url, ORIGIN + p)
  }
})

test('PRIVACY: buổi KHÔNG tồn tại → mặc định (không còn "Buổi 99"); buổi có thật nhận theo total_sessions hoặc class_sessions', async () => {
  const o = await share(`/me/classes/${CLASS_ID}/sessions/99`)
  assert.ok(isDefault(o))
  assert.equal(o.r.note, 'session:not_found')
  assert.equal((await share(`/me/classes/${CLASS_ID}/sessions/8`)).r.note, 'session:public')   // 8 ≤ total_sessions, dù khách không đọc được class_sessions
  assert.equal((await share(`/me/classes/${OPEN_ID}/sessions/12`)).r.note, 'session:public')   // lớp mở: có dòng class_sessions
  assert.equal((await share(`/me/classes/${OPEN_ID}/sessions/13`)).r.note, 'session:not_found')
})

test('PRIVACY: trang cá nhân luôn private, KHÔNG đọc DB', async () => {
  const log: string[] = []
  const o = await share('/me/u/00000000-0000-4000-8000-000000000000', mockCtx(DB, { log }))
  assert.ok(isDefault(o))
  assert.equal(o.r.note, 'profile:private')
  assert.equal(log.length, 0)
})

test('PRIVACY: khoá học off → landing mặc định; Band không active (RPC trả null) → mặc định', async () => {
  const off = { ...DB, tables: { ...DB.tables, edu_courses: DB.tables.edu_courses.map(c => ({ ...c, status: 'off' })) } }
  assert.ok(isDefault(await share('/solo01', mockCtx(off))))
  assert.ok(isDefault(await share('/band/band-an')))
})

test('PRIVACY: lỗi DB → throw cho edge fail closed (không bao giờ trả metadata dở dang)', async () => {
  await assert.rejects(resolveShare(new URL(ORIGIN + '/band/la-mua-thu'), mockCtx(DB, { fail: true })))
  // route không cần DB vẫn chạy được khi DB hỏng
  assert.equal((await resolveShare(new URL(ORIGIN + '/me/u/00000000-0000-4000-8000-000000000000'), mockCtx(DB, { fail: true }))).note, 'profile:private')
})

test('PRIVACY: adapter chỉ đọc cột công khai — không select zoom_url / note / phone / email', async () => {
  const log: string[] = []
  for (const p of ['/band/la-mua-thu', `/me/classes/${CLASS_ID}/sessions/3`, '/solo01', '/hanhtrinh2027', '/nhipphach', '/story/song-lo', '/showcase/ai-lam-ra-cay-dan']) {
    await share(p, mockCtx(DB, { log }))
  }
  const all = log.join('\n')
  for (const col of ['zoom_url', 'note', 'phone', 'email', 'price', 'content_text', 'user_id']) assert.ok(!new RegExp(`[=,]${col}\\b`).test(all), col)
  assert.ok(log.every(p => !p.includes('select=*')))
})
