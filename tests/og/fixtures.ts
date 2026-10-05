// Dữ liệu mẫu ĐÚNG dạng PostgREST/RPC trả về (giá trị giống production 05/10, id giả) + ctx giả cho adapter.
import { readFileSync } from 'node:fs'
import type { Ctx } from '../../netlify/og/adapter.ts'
import { resetToolIndex } from '../../netlify/og/adapters/tool.ts'

export const ORIGIN = 'https://class.vananhaudio.com'
export const INDEX = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
export const STORAGE = 'https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public'
export const BAND_COVER = `${STORAGE}/course-logos/band-b1-1791184246613.png`
export const DH1_LOGO = `${STORAGE}/course-logos/65bccb3e-dh1.png`
export const SOLO_LOGO = `${STORAGE}/course-logos/fd4bbeb2-solo.png`
export const STORY_PHOTO = `${STORAGE}/stories/song-lo.jpg`
export const CLASS_ID = '11111111-1111-4111-8111-111111111111'
export const CANCELLED_ID = '22222222-2222-4222-8222-222222222222'
export const NOSESSION_ID = '33333333-3333-4333-8333-333333333333'
export const DH1_ID = '44444444-4444-4444-8444-444444444444'

export type Db = { tables: Record<string, Record<string, unknown>[]>; rpc?: Record<string, (b: Record<string, unknown>) => unknown> }

export const DB: Db = {
  tables: {
    class_schedule: [
      { id: CLASS_ID, name: 'Khởi đầu đam mê khoá 17 - KD17', cover_url: null, main_course_id: DH1_ID, status: 'upcoming', is_active: true },
      { id: CANCELLED_ID, name: 'Lớp đã huỷ KD19', cover_url: null, main_course_id: DH1_ID, status: 'cancelled', is_active: true },
      { id: NOSESSION_ID, name: 'Lớp nháp', cover_url: null, main_course_id: null, status: 'draft', is_active: true },
      { id: 'ht', name: 'Hành trình 2027 — 40 buổi thực hành', cover_url: null, main_course_id: null, status: 'scheduled', is_active: true, program_code: 'HT2027' },
    ],
    class_sessions: [{ class_id: CLASS_ID, session_number: 3 }, { class_id: CANCELLED_ID, session_number: 3 }],
    edu_courses: [
      { id: DH1_ID, code: 'DH1', name: 'Đệm hát 1', image_url: DH1_LOGO, thumbnail_url: null, status: 'on', visibility: 'visible' },
      { id: 'solo', code: 'SOLO', name: 'Solo Guitar Căn Bản', description: null, showcase_desc: null, outcome: null,
        image_url: SOLO_LOGO, thumbnail_url: null, status: 'on', visibility: 'visible' },
    ],
    edu_tools: [
      { route: '/nhipphach', name: 'Đọc nhịp – phách', description: 'Đọc nhịp và phách trên bản nhạc', image_url: null, status: 'on' },
      { route: '/metronome', name: 'Máy đập nhịp', description: 'Giữ nhịp khi luyện tập', image_url: null, status: 'on' },
      { route: '/tempo', name: 'Tap Tempo', description: null, image_url: null, status: 'off' },
      { route: '/tap', name: 'Bài A', status: 'on' }, { route: '/tap', name: 'Bài B', status: 'on' },
      { route: '#', name: 'Luyện ngón', status: 'on' },
    ],
    stories: [{ slug: 'song-lo', title: '20 năm ngắt quãng, đam mê vẫn còn nguyên', content: 'Một  câu chuyện\n dài…',
      photos: [{ url: STORY_PHOTO }], pen_name: 'Lô', status: 'published' }],
    showcase_pages: [{ slug: 'ai-lam-ra-cay-dan', title: 'Ai làm ra cây đàn? | Văn Anh Audio', seo_title: null, seo_description: null,
      summary: 'Hành trình của một cây đàn.', cover_image: null, published: true }],
  },
  rpc: {
    band_recruitment_public: b => b.p_slug === 'la-mua-thu'
      ? { band: { slug: 'la-mua-thu', name: 'Lá Mùa Thu', tagline: 'Ban nhạc tình ca', cover_url: BAND_COVER } } : null,
  },
}

/** PostgREST tối giản: lọc theo `col=eq.v`, `col=not.in.(…)`, bỏ qua select/order/limit. */
function query(db: Db, path: string): unknown {
  const u = new URL('http://x' + path)
  const table = u.pathname.replace('/rest/v1/', '')
  let rows = db.tables[table]
  if (!rows) throw new Error('no table ' + table)
  for (const [k, v] of u.searchParams) {
    if (['select', 'order', 'limit'].includes(k)) continue
    if (v.startsWith('eq.')) rows = rows.filter(r => String(r[k]) === v.slice(3))
    else if (v.startsWith('not.in.(')) { const s = v.slice(8, -1).split(','); rows = rows.filter(r => !s.includes(String(r[k]))) }
    else throw new Error('filter? ' + k + '=' + v)
  }
  return rows
}

export function mockCtx(db: Db = DB, opts: { fail?: boolean; log?: string[] } = {}): Ctx {
  resetToolIndex()
  return {
    origin: ORIGIN,
    get: async p => { opts.log?.push(p); if (opts.fail) throw new Error('db-500'); return query(db, p) },
    rpc: async (fn, b) => { opts.log?.push('rpc:' + fn); if (opts.fail) throw new Error('db-500'); return db.rpc?.[fn]?.(b) ?? null },
    now: () => 0,
  }
}

export const tag = (html: string, key: string) => {
  const attr = key.startsWith('og:') ? 'property' : 'name'
  return new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`, 'i').exec(html)?.[1] ?? null
}
export const title = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1]
