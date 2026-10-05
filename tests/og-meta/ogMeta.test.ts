// Dynamic OG V1 — luật route + ghi thẻ (netlify/og/ogMeta.ts)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyMeta, bandMeta, canonicalUrl, classMeta, ogRouteFromPath, PROFILE_META, safeImage, STATIC_META, staticMeta } from '../../netlify/og/ogMeta.ts'

const ID = '9431adee-d0d3-4f48-9156-5228533bd9c2'
const INDEX = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const tag = (html: string, key: string) => {
  const attr = key.startsWith('og:') ? 'property' : 'name'
  return new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`, 'i').exec(html)?.[1] ?? null
}
const title = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1]

test('route: landing tĩnh', () => {
  assert.deepEqual(ogRouteFromPath('/solo01'), { kind: 'static', key: 'solo01' })
  assert.deepEqual(ogRouteFromPath('/solo01/buoi-3'), { kind: 'static', key: 'solo01' })
  assert.deepEqual(ogRouteFromPath('/hanhtrinh2027/'), { kind: 'static', key: 'hanhtrinh2027' })
  assert.deepEqual(ogRouteFromPath('/nhipphach'), { kind: 'static', key: 'nhipphach' })
  assert.deepEqual(ogRouteFromPath('/nhipphach/'), { kind: 'static', key: 'nhipphach' })
  assert.deepEqual(ogRouteFromPath('/thuvien'), { kind: 'static', key: 'thuvien' })
  assert.equal(ogRouteFromPath('/solo012').kind, 'fallback')
})

test('route: band — slug hợp lệ mới đi DB', () => {
  assert.deepEqual(ogRouteFromPath('/band/la-mua-thu'), { kind: 'band', slug: 'la-mua-thu' })
  assert.deepEqual(ogRouteFromPath('/band/La-Mua-Thu/'), { kind: 'band', slug: 'la-mua-thu' })
  assert.equal(ogRouteFromPath('/band/a b').kind, 'fallback')
  assert.equal(ogRouteFromPath('/band/x/y').kind, 'fallback')
  assert.equal(ogRouteFromPath('/band/' + 'a'.repeat(61)).kind, 'fallback')
})

test('route: lớp / buổi / không gian lớp', () => {
  assert.deepEqual(ogRouteFromPath(`/me/classes/${ID}`), { kind: 'class', classId: ID })
  assert.deepEqual(ogRouteFromPath(`/me/classes/${ID.toUpperCase()}/space`), { kind: 'class', classId: ID })
  assert.deepEqual(ogRouteFromPath(`/me/classes/${ID}/sessions/7`), { kind: 'session', classId: ID, sessionNo: 7 })
  assert.equal(ogRouteFromPath(`/me/classes/${ID}/sessions/0`).kind, 'fallback')
  assert.equal(ogRouteFromPath('/me/classes/not-a-uuid').kind, 'fallback')
  assert.equal(ogRouteFromPath('/me/classes').kind, 'fallback')
})

test('route: profile luôn chung, không mang id', () => {
  assert.deepEqual(ogRouteFromPath(`/me/u/${ID}`), { kind: 'profile' })
  assert.equal(ogRouteFromPath('/me/u/abc').kind, 'fallback')
  for (const p of ['/', '/me', '/me/friends', '/me/bands/la-mua-thu', '/story/x', '/teamlab']) assert.equal(ogRouteFromPath(p).kind, 'fallback', p)
})

test('band meta: tên + tagline; thiếu tên → null', () => {
  const m = bandMeta({ name: 'Lá Mùa Thu', tagline: 'Ban nhạc tình ca' })!
  assert.match(m.title, /^Lá Mùa Thu · Band · /)
  assert.equal(m.description, 'Ban nhạc tình ca')
  assert.equal(m.image, null)
  assert.equal(bandMeta(null), null)
  assert.equal(bandMeta({ name: '  ' }), null)
  assert.match(bandMeta({ name: 'X' })!.description, /^X — Band/)
})

test('class meta: tên lớp + ảnh khoá; buổi = Buổi NN · tên lớp', () => {
  const img = 'https://x.supabase.co/storage/v1/object/public/course-logos/a.png'
  const c = classMeta({ name: 'Solo Guitar', image: img })!
  assert.match(c.title, /^Solo Guitar · /)
  assert.equal(c.image, img)
  const s = classMeta({ name: 'Solo Guitar', image: null }, 3)!
  assert.match(s.title, /^Buổi 03 · Solo Guitar · /)
  assert.equal(s.image, null)
  assert.equal(classMeta(null), null)
})

test('safeImage chỉ nhận https tuyệt đối', () => {
  assert.equal(safeImage('http://a.com/x.png'), null)
  assert.equal(safeImage('/og.png'), null)
  assert.equal(safeImage('javascript:alert(1)'), null)
  assert.equal(safeImage(42), null)
  assert.equal(safeImage('https://a.com/x.png'), 'https://a.com/x.png')
})

test('canonicalUrl bỏ query/hash/gạch cuối', () => {
  assert.equal(canonicalUrl('https://class.vananhaudio.com/band/x/?fbclid=1#a'), 'https://class.vananhaudio.com/band/x')
  assert.equal(canonicalUrl('http://class.vananhaudio.com/'), 'https://class.vananhaudio.com/')
})

test('applyMeta trên index.html thật: đổi đủ thẻ', () => {
  const url = 'https://class.vananhaudio.com/nhipphach?x=1'
  const out = applyMeta(INDEX, STATIC_META.nhipphach, url)
  const m = STATIC_META.nhipphach
  assert.equal(title(out), m.title.replace(/&/g, '&amp;'))
  for (const k of ['og:title', 'twitter:title']) assert.equal(tag(out, k), m.title.replace(/&/g, '&amp;'), k)
  for (const k of ['description', 'og:description', 'twitter:description']) assert.equal(tag(out, k), m.description, k)
  assert.equal(tag(out, 'og:url'), 'https://class.vananhaudio.com/nhipphach')
  assert.equal(tag(out, 'og:image'), 'https://class.vananhaudio.com/og-default.png')
  assert.ok(out.includes('og:image:width'), 'ảnh mặc định giữ kích thước')
  assert.notEqual(tag(out, 'og:title'), tag(INDEX, 'og:title'))
})

test('applyMeta: ảnh riêng thay og/twitter image và bỏ kích thước cố định', () => {
  const img = 'https://x.supabase.co/a.png'
  const out = applyMeta(INDEX, { title: 'T', description: 'D', image: img }, 'https://class.vananhaudio.com/me/classes/' + ID)
  assert.equal(tag(out, 'og:image'), img)
  assert.equal(tag(out, 'twitter:image'), img)
  assert.ok(!out.includes('og:image:width'))
})

test('applyMeta(null) = fallback: chỉ sửa og:url', () => {
  const out = applyMeta(INDEX, null, 'https://class.vananhaudio.com/me')
  assert.equal(tag(out, 'og:url'), 'https://class.vananhaudio.com/me')
  assert.equal(title(out), title(INDEX))
  assert.equal(tag(out, 'og:image'), tag(INDEX, 'og:image'))
  assert.equal(out.replace(/og:url" content="[^"]*"/, ''), INDEX.replace(/og:url" content="[^"]*"/, ''))
})

test('applyMeta escape HTML + không bị $-pattern của replace', () => {
  const out = applyMeta(INDEX, { title: '<b>"A" & $1 $&</b>', description: "x'y", image: null }, 'https://class.vananhaudio.com/band/a')
  assert.equal(title(out), '&lt;b&gt;&quot;A&quot; &amp; $1 $&amp;&lt;/b&gt;')
  assert.equal(tag(out, 'og:title'), '&lt;b&gt;&quot;A&quot; &amp; $1 $&amp;&lt;/b&gt;')
})

test('profile chung không chứa dữ liệu người dùng', () => {
  assert.ok(!/@|\d{6,}/.test(PROFILE_META.title + PROFILE_META.description))
  assert.equal(PROFILE_META.image, null)
})

test('landing tĩnh: ảnh khoá từ DB nếu https, không thì mặc định; không lộ courseCode', () => {
  const img = 'https://x.supabase.co/storage/v1/object/public/course-logos/solo.png'
  const m = staticMeta('solo01', img)
  assert.equal(m.image, img)
  assert.ok(!('courseCode' in m))
  assert.equal(staticMeta('solo01', null).image, null)
  assert.equal(staticMeta('solo01', 'http://x/a.png').image, null)
  assert.equal(staticMeta('nhipphach', img).image, img)
  assert.equal(STATIC_META.solo01.courseCode, 'SOLO')
  assert.equal(STATIC_META.nhipphach.courseCode, undefined)
})
