// Test Data API cho Bạn bè + Tường — gọi PostgREST cục bộ bằng JWT thật của A/B/C và anon.
// Chạy bởi scripts/test-friends-wall-db.sh SAU khi test SQL (trạng thái: A–B là bạn, B từ chối C, C chưa có bạn).
import { createHmac } from 'node:crypto'

const API = process.env.API
const SECRET = process.env.SECRET
const U = {
  A: 'aaaaaaaa-0000-4000-8000-00000000000a',
  B: 'bbbbbbbb-0000-4000-8000-00000000000b',
  C: 'cccccccc-0000-4000-8000-00000000000c',
}
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = sub => {
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 600 })
  return `${head}.${body}.${createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`
}

async function call(who, method, path, body) {
  const headers = { 'content-type': 'application/json' }
  if (who) headers.authorization = `Bearer ${jwt(U[who])}`
  const r = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* lỗi dạng text */ }
  return { status: r.status, json, text }
}

let fail = 0
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}: API ${msg}`); if (!cond) fail++ }
const noPii = (res, except = '') => !/(@test\.local|090000000\d)/.test(res.text.replace(except, ''))

for (let i = 0; i < 50; i++) {   // chờ PostgREST sẵn sàng
  try { if ((await fetch(API + '/')).status < 500) break } catch { /* chưa lên */ }
  await new Promise(r => setTimeout(r, 200))
}

const cEdu = await call('C', 'GET', '/edu_students?select=user_id,email,phone')
ok(cEdu.status === 200 && cEdu.json.length === 1 && cEdu.json[0].user_id === U.C, 'C chỉ đọc được hồ sơ edu_students của chính mình')
ok(!/a@test\.local|b@test\.local|0900000001|0900000002/.test(cEdu.text), 'T14 C không lấy được email/SĐT của A/B qua REST')

const cWallA = await call('C', 'POST', '/rpc/get_user_wall', { p_user: U.A })
ok(cWallA.status === 200 && Array.isArray(cWallA.json) && cWallA.json.length === 0, 'T8 C gọi get_user_wall(A) → rỗng')
const bWallA = await call('B', 'POST', '/rpc/get_user_wall', { p_user: U.A })
ok(bWallA.status === 200 && bWallA.json.some(p => p.type === 'status'), 'T6/T7 B (bạn) gọi get_user_wall(A) → có bài tường')
ok(noPii(bWallA), 'T14 get_user_wall không chứa email/SĐT')

const cPosts = await call('C', 'GET', '/class_posts?audience=eq.friends&select=author_user_id,body')
ok(cPosts.status === 200 && cPosts.json.every(p => p.author_user_id === U.C), 'T8 C đọc thẳng /class_posts chỉ thấy bài tường của mình')

const cFs = await call('C', 'GET', '/friendships')
ok(cFs.status === 401 || cFs.status === 403, `C không đọc thẳng /friendships (HTTP ${cFs.status})`)
const cFsIns = await call('C', 'POST', '/friendships', { requester_id: U.C, addressee_id: U.A, status: 'accepted' })
ok(cFsIns.status === 401 || cFsIns.status === 403, `C không tự ghi quan hệ "accepted" qua /friendships (HTTP ${cFsIns.status})`)

const anonWall = await call(null, 'POST', '/rpc/get_user_wall', { p_user: U.A })
ok(anonWall.status === 401 || anonWall.status === 403, `T13 khách gọi get_user_wall bị từ chối (HTTP ${anonWall.status})`)
const anonEdu = await call(null, 'GET', '/edu_students')
ok(anonEdu.status === 401 || anonEdu.status === 403, `T13 khách không đọc /edu_students (HTTP ${anonEdu.status})`)

const aProf = await call('A', 'POST', '/rpc/get_user_profile', { p_user: U.C })
const keys = aProf.json?.[0] ? Object.keys(aProf.json[0]).sort().join(',') : ''
ok(keys === 'avatar_url,can_view_wall,cover_url,name,relationship,role,user_id', `T14 hồ sơ công khai chỉ có các trường tối thiểu (${keys})`)
ok(noPii(aProf), 'T14 get_user_profile không chứa email/SĐT')

for (const [who, fn] of [['A', 'my_friends'], ['B', 'incoming_friend_requests'], ['A', 'friendship_status']]) {
  const r = await call(who, 'POST', `/rpc/${fn}`, fn === 'friendship_status' ? { p_user: U.B } : {})
  ok(r.status === 200 && noPii(r), `T14 ${fn} không chứa email/SĐT`)
}
const feed = await call('C', 'POST', '/rpc/class_feed', {})
ok(feed.status === 200 && feed.json.every(p => p.type !== 'status') && noPii(feed), 'feed Cộng đồng không có bài tường, không email/SĐT')

console.log(fail ? `API: ${fail} FAIL` : 'API: ALL PASS')
process.exit(fail ? 1 : 0)
