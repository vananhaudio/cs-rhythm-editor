// deno test --no-lock --no-check --allow-env --import-map=tests/story-security/import_map.json tests/story-security/functions.test.ts
import { state } from './fake-supabase.ts'

for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY', 'REPLICATE_API_TOKEN']) Deno.env.set(k, 'test')
type H = (r: Request) => Promise<Response>
let captured: H | null = null
// deno-lint-ignore no-explicit-any
;(Deno as any).serve = (h: H) => { captured = h }
let outbound = 0
globalThis.fetch = () => { outbound++; return Promise.resolve(new Response(JSON.stringify({ error: 'stub', content: [{ type: 'text', text: '{"ready":true,"reply":"ok"}' }] }))) }
await import('../../supabase/functions/story-ai/index.ts'); const storyAi = captured!
await import('../../supabase/functions/publish-story/index.ts'); const publish = captured!

const published = { id: 's1', user_id: 'u-owner', status: 'published', title: 'Bài cũ', content: 'x', story_number: 11, slug: 'bai-cu-11', published_at: '2026-07-29T00:00:00Z', pen_name: 'a@b.com', author_name: 'a@b.com', photos: [], conversation: [] }
function reset(story: Record<string, unknown> = published) {
  state.log = []; outbound = 0
  state.rows = { stories: [{ ...story }], app_users: [{ id: 'u-teacher', role: 'teacher' }, { id: 'u-admin', role: 'admin' }, { id: 'u-student', role: 'student' }, { id: 'u-owner', role: 'student' }], story_private: [{ story_id: 's1', conversation: [{ role: 'user', text: 'riêng' }] }] }
}
async function call(h: H, body: unknown, token?: string) {
  const r = await h(new Request('http://t', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) }))
  return { status: r.status, body: await r.json() }
}
const eq = (a: unknown, b: unknown, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`) }

const ADMIN = ['list_all', 'search_users', 'admin_publish', 'admin_update_story', 'admin_insert_story', 'admin_update_photo', 'admin_delete_story']
const payload = { story_id: 's1', title: 't', content: 'c', q: 'a', status: 'published', image_base64: 'aGk=', admin_key: 'bat-ky-khoa-cu' }

Deno.test('story-ai: khách / token anon / token giả — kể cả kèm admin_key — bị 401, không chạm dữ liệu', async () => {
  for (const action of ADMIN) for (const tok of [undefined, 'anon-key', 'tok-gia']) {
    reset(); const r = await call(storyAi, { ...payload, action }, tok)
    eq(r.status, 401, `${action}/${tok}`); eq(state.log, [], `${action}/${tok} chạm dữ liệu`)
  }
})
Deno.test('story-ai: học viên (kể cả chủ bài, kể cả kèm admin_key) bị 403, không chạm dữ liệu', async () => {
  for (const action of ADMIN) for (const tok of ['tok-student', 'tok-owner']) {
    reset(); const r = await call(storyAi, { ...payload, action }, tok)
    eq(r.status, 403, `${action}/${tok}`); eq(state.log, [], `${action}/${tok} chạm dữ liệu`)
  }
})
Deno.test('story-ai: Thầy và admin dùng được mọi thao tác biên tập', async () => {
  for (const action of ADMIN) for (const tok of ['tok-teacher', 'tok-admin']) {
    reset(); const r = await call(storyAi, { ...payload, action }, tok)
    eq(r.status, 200, `${action}/${tok} ${JSON.stringify(r.body)}`)
  }
})
Deno.test('story-ai: list_all ghép lại hội thoại đã niêm của bài đã đăng', async () => {
  reset(); const r = await call(storyAi, { action: 'list_all' }, 'tok-teacher')
  eq(r.body.stories[0].conversation, [{ role: 'user', text: 'riêng' }], 'hội thoại')
})
Deno.test('story-ai: đăng lại giữ nguyên số, đường dẫn, ngày; che email', async () => {
  reset({ ...published, status: 'unpublished' })
  const r = await call(storyAi, { action: 'admin_publish', story_id: 's1' }, 'tok-teacher')
  eq([r.body.slug, r.body.story_number], ['bai-cu-11', 11], 'định danh')
  const u = state.log.find(l => l.op === 'update')!.payload as Record<string, unknown>
  eq([u.published_at, u.pen_name, u.author_name], ['2026-07-29T00:00:00Z', 'Người kể chuyện', 'Người kể chuyện'], 'update')
})
Deno.test('story-ai: trạng thái lạ bị từ chối', async () => {
  reset(); eq((await call(storyAi, { action: 'admin_update_story', story_id: 's1', status: 'telling' }, 'tok-teacher')).status, 400, 'status')
  eq(state.log.length, 0, 'không ghi')
})
Deno.test('story-ai: review và fix_data đã gỡ — không ghi gì kể cả với Thầy', async () => {
  for (const action of ['review', 'fix_data']) for (const tok of ['tok-owner', 'tok-teacher']) {
    reset({ ...published, status: 'submitted' }); const r = await call(storyAi, { action, storyId: 's1' }, tok)
    eq(r.status, 400, action); eq(state.log.filter(l => l.op !== 'select'), [], `${action} ghi`); eq(outbound, 0, 'AI')
  }
})
Deno.test('story-ai: người kể không kéo được bài đã đăng/đã gỡ/đã gửi về nháp; không sửa bài người khác', async () => {
  for (const status of ['published', 'unpublished', 'submitted', 'pending_publish']) for (const action of ['complete', 'revise', 'write', 'chat']) {
    reset({ ...published, status })
    const r = await call(storyAi, { action, storyId: 's1', rawContent: 'x', instruction: 'x', message: 'x' }, 'tok-owner')
    eq(r.status, 400, `${action}/${status}`); eq(state.log.filter(l => l.op !== 'select'), [], `${action}/${status} ghi`)
  }
  reset({ ...published, status: 'user_review' })
  eq((await call(storyAi, { action: 'complete', storyId: 's1', rawContent: 'x' }, 'tok-student')).status, 403, 'người khác')
})
Deno.test('story-ai: người kể vẫn dùng được luồng kể của mình', async () => {
  reset({ ...published, status: 'user_review' })
  eq((await call(storyAi, { action: 'complete', storyId: 's1', rawContent: 'x' }, 'tok-owner')).status, 200, 'complete')
})
Deno.test('publish-story: không phải Ban biên tập → từ chối, không dữ liệu, không gọi AI tốn phí', async () => {
  for (const body of [{ action: 'publish', story_id: 's1' }, { action: 'generate_image', prompt: 'x', story_id: 's1' }])
    for (const [tok, code] of [[undefined, 401], ['anon-key', 401], ['tok-student', 403], ['tok-owner', 403]] as const) {
      reset(); eq((await call(publish, body, tok)).status, code, `${body.action}/${tok}`); eq(state.log, [], 'dữ liệu'); eq(outbound, 0, 'AI')
    }
})
Deno.test('publish-story: Thầy đăng lại bài cũ giữ nguyên số, đường dẫn, ngày', async () => {
  reset({ ...published, status: 'unpublished', photos: [{ url: 'https://x/a.png' }] })
  const r = await call(publish, { action: 'publish', story_id: 's1', use_existing_photo: true }, 'tok-teacher')
  eq([r.status, r.body.slug, r.body.story_number], [200, 'bai-cu-11', 11], 'định danh')
})
Deno.test('publish-story: bài mới được cấp số và đường dẫn', async () => {
  reset({ ...published, status: 'submitted', story_number: null, slug: null, published_at: null, photos: [{ url: 'https://x/a.png' }] })
  const r = await call(publish, { action: 'publish', story_id: 's1', use_existing_photo: true }, 'tok-teacher')
  eq([r.status, r.body.slug, r.body.story_number], [200, 'bai-cu-1', 1], 'cấp mới')
})
