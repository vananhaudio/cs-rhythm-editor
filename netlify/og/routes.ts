// ── Universal OG — bản đồ route của SPA (CHỈ phân loại, không chứa metadata) ──
// tests/og/routeCoverage.test.ts đọc mọi route trong src/AppRouter.tsx, resolveMeRoute.ts, bandModel.ts và
// public/_redirects: route nào chưa được phân loại ở đây → CI FAIL. Thêm trang mới = phân loại MỘT lần:
//   resource → có adapter (registry.ts) dựng metadata từ dữ liệu
//   page     → trang ứng dụng: thẻ mặc định Class (riêng path một đoạn trùng edu_tools.route → adapter tool tự nhận)
//   private  → nội dung thành viên / quản trị: thẻ mặc định Class
//   proxy    → site khác (_redirects) — Edge Function KHÔNG chạy (excludedPath trong og.ts)

export type RouteKind = 'resource' | 'page' | 'private' | 'proxy'
export type RouteClass = { prefix: string; kind: RouteKind; adapter?: string; subtree?: boolean }

/** Landing riêng của SPA đại diện cho một entity có dữ liệu — chữ + ảnh lấy từ entity (adapters/landing.ts). */
export type Landing = { path: string; resource: { type: 'course' | 'program'; code: string } }
export const LANDINGS: readonly Landing[] = [
  { path: '/solo01', resource: { type: 'course', code: 'SOLO' } },          // edu_courses.code
  { path: '/hanhtrinh2027', resource: { type: 'program', code: 'HT2027' } }, // class_schedule.program_code
]

const r = (prefix: string, adapter: string): RouteClass => ({ prefix, kind: 'resource', adapter, subtree: true })
const pages = (kind: RouteKind, subtree: boolean, ...prefixes: string[]): RouteClass[] =>
  prefixes.map(prefix => ({ prefix, kind, subtree }))

export const ROUTE_CLASSES: readonly RouteClass[] = [
  r('/band', 'band'),
  r('/story', 'story'),            // /story/tell|write|… là trang ứng dụng — adapter story tự bỏ qua
  r('/showcase', 'showcase'),
  r('/me/classes', 'class'),       // + session (/me/classes/<id>/sessions/<n>)
  r('/teamlab/band', 'teamlab-band'), // /teamlab/band/<slug> (trang Band công khai của TeamLab; KHÁC Class /band/*) + /teamlab/band/<slug>/room… (workspace của Team đó → cùng metadata công khai)
  r('/teamlab/song', 'teamlab-song'), // CHỈ /teamlab/song/<slug>: ngoại lệ HẸP của proxy /teamlab (edge function riêng og-teamlab.ts)
  r('/me/u', 'profile'),           // luôn private tới khi có opt-in công khai
  ...LANDINGS.map(l => r(l.path, 'landing')),

  ...pages('page', false, '/', '/me', '/class', '/learn', '/start', '/subscribe', '/unsubscribe', '/qr', '/join-group'),
  ...pages('page', true,
    // công cụ / trình phát / bài luyện — adapter tool nhận path nào trùng edu_tools.route
    '/metronome', '/tempo', '/tap', '/notesheet', '/guitarboard', '/chords', '/chord-ame', '/chord-basic1', '/chord-trainer',
    '/song-builder', '/strum-builder', '/strum-backing', '/strum-test', '/groove', '/piano-journey', '/piano-player',
    '/player', '/ytplayer', '/youtube-sync', '/thuvien', '/dieudemhat', '/amazing', '/chum2', '/chum2-strum',
    '/hbd', '/hbd-td1', '/jinglebell', '/ode', '/scarborough', '/welcome-td2', '/app-v2-preview', '/flow-lab'),

  ...pages('private', true,
    '/me/bands', '/me/chat', '/me/friends', '/me/queue', '/me/t', '/me/tools',
    '/admin', '/course', '/course-editor', '/editor', '/editorial', '/gp-editor', '/import', '/flow-migrate',
    '/students', '/student', '/delete-account'),

  ...pages('proxy', true, '/teamlab', '/azz', '/khobaigiang', '/login', '/api', '/_next', '/privacy', '/tvaprivacy'),
]

/** Phân loại cụ thể nhất cho một path (dùng cho test + chẩn đoán). */
export function classifyRoute(path: string): RouteClass | null {
  const p = path.replace(/\/+$/, '') || '/'
  let best: RouteClass | null = null
  for (const c of ROUTE_CLASSES) {
    const hit = p === c.prefix || (c.subtree === true && c.prefix !== '/' && p.startsWith(c.prefix + '/'))
    if (hit && (!best || c.prefix.length > best.prefix.length)) best = c
  }
  return best
}
