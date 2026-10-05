// Universal OG — ROUTE COVERAGE: mọi route của SPA phải được phân loại ở netlify/og/routes.ts.
// Thêm trang mới ở AppRouter / /me / _redirects mà quên phân loại → test này FAIL (CI bắt, Owner không phải nhớ).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { classifyRoute, LANDINGS, ROUTE_CLASSES } from '../../netlify/og/routes.ts'
import { ADAPTERS } from '../../netlify/og/registry.ts'

const read = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const norm = (p: string) => p.replace(/\/+$/, '') || '/'

/** Route literal trong mã SPA. */
function spaRoutes(): string[] {
  const out = new Set<string>()
  const router = read('src/AppRouter.tsx')
  for (const m of router.matchAll(/path(?:\.startsWith\(| === )'(\/[^']*)'/g)) out.add(norm(m[1]))
  for (const m of read('src/class-social/resolveMeRoute.ts').matchAll(/'(\/(?:me|learn)[^']*)'/g)) out.add(norm(m[1]))
  for (const m of read('src/band/bandModel.ts').matchAll(/BAND_PUBLIC_PREFIX = '(\/[^']*)'/g)) out.add(norm(m[1]))
  return [...out].sort()
}

function redirectSources(): string[] {
  return read('public/_redirects').split('\n')
    .map(l => l.trim().split(/\s+/)[0])
    .filter(s => s && !s.startsWith('#') && s !== '/*')
    .map(s => norm(s.replace(/\/\*$/, '')))
}

test('mọi route SPA đã được phân loại (resource / page / private / proxy)', () => {
  const routes = spaRoutes()
  assert.ok(routes.length > 60, 'trích được route từ AppRouter: ' + routes.length)
  const missing = routes.filter(r => !classifyRoute(r))
  assert.deepEqual(missing, [], 'route chưa phân loại ở netlify/og/routes.ts: ' + missing.join(', '))
})

test('mọi nguồn proxy trong _redirects là proxy VÀ nằm trong excludedPath của Edge Function', () => {
  const edge = read('netlify/edge-functions/og.ts')
  const excluded = [...edge.matchAll(/'(\/[^']*)'/g)].map(m => m[1])
  for (const src of redirectSources()) {
    const c = classifyRoute(src)
    assert.equal(c?.kind, 'proxy', `${src} phải là proxy`)
    const covered = excluded.some(e => e === src || (e.endsWith('/*') && src.startsWith(e.slice(0, -1))))
    assert.ok(covered && excluded.some(e => e === src + '/*' || (e.endsWith('/*') && (src + '/').startsWith(e.slice(0, -1)))),
      `${src} và ${src}/* chưa có trong excludedPath`)
  }
  for (const c of ROUTE_CLASSES.filter(c => c.kind === 'proxy')) {
    assert.ok(excluded.includes(c.prefix) && excluded.includes(c.prefix + '/*'), `proxy ${c.prefix} phải loại trừ cả /*`)
  }
})

test('resource ↔ adapter khớp hai chiều: mỗi resource có adapter đăng ký; mỗi adapter có route', () => {
  const types = new Set(ADAPTERS.map(a => a.type))
  for (const c of ROUTE_CLASSES.filter(c => c.kind === 'resource')) assert.ok(types.has(c.adapter!), `${c.prefix} → adapter ${c.adapter} chưa đăng ký`)
  const routed = new Set(ROUTE_CLASSES.map(c => c.adapter).filter(Boolean))
  // session dùng chung route /me/classes với class; tool dò theo dữ liệu trên các route 'page'
  for (const t of types) if (!['session', 'tool'].includes(t)) assert.ok(routed.has(t), `adapter ${t} không có route nào`)
})

test('landing nào cũng là route SPA thật và gắn entity có mã', () => {
  const routes = new Set(spaRoutes())
  for (const l of LANDINGS) {
    assert.ok(routes.has(l.path), `${l.path} không có trong AppRouter`)
    assert.ok(l.resource.code)
  }
})

test('mỗi route được phân loại phải gặp đúng adapter của nó (resource) hoặc không adapter nào ngoài tool (page/private)', () => {
  const sample: Record<string, string> = {
    '/band/x': 'band', '/story/x': 'story', '/showcase/x': 'showcase', '/me/u/00000000-0000-4000-8000-000000000000': 'profile',
    '/me/classes/00000000-0000-4000-8000-000000000000': 'class', '/me/classes/00000000-0000-4000-8000-000000000000/sessions/2': 'session',
    '/solo01': 'landing', '/hanhtrinh2027/x': 'landing',
  }
  for (const [path, type] of Object.entries(sample)) {
    const a = ADAPTERS.find(a => a.match(path, new URLSearchParams()) !== null)
    assert.equal(a?.type, type, path)
  }
  for (const c of ROUTE_CLASSES.filter(c => c.kind !== 'resource' && c.prefix !== '/')) {
    const a = ADAPTERS.find(a => a.match(c.prefix, new URLSearchParams()) !== null)
    assert.ok(!a || a.type === 'tool', `${c.prefix} (${c.kind}) bị adapter ${a?.type} nhận`)
  }
})
