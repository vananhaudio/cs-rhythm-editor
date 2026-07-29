// Edge Function: story-ai -- MVP 01: Story Interview
// Mira = interview facilitator creating a work, NOT a chatbot.
// Default behavior: listen + remember. Only respond when truly needed.
// Actions: chat (tell) - write (draft) - revise (edit) - review (submit)
// DEPLOY: Supabase Dashboard -> Edge Functions -> story-ai -> "Verify JWT" = ON
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const MODEL_CHAT = 'claude-haiku-4-5-20251001'
const MODEL_WRITE = 'claude-haiku-4-5-20251001'
const MODEL_REVIEW = 'claude-haiku-4-5-20251001'

const MAX_MSG_LEN = 2000
const MAX_STORY_MSGS = 80
const MAX_OPEN_STORIES = 10
const HISTORY = 40

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const db = createClient(SUPABASE_URL, SERVICE_KEY)

// ============================================================
// MIRA CORE PRINCIPLES — editor, not interviewer
// ============================================================
const MIRA_SYSTEM = `Ban la Mira — bien tap vien cua Tap chi "1001 Cau chuyen cung Guitar" cua thay Van Anh.

SU MENH: Giup nguoi ke LUU GIU cau chuyen cua CHINH HO — khong phai tao ra mot cau chuyen hay hon.

=== NGUYEN TAC 1: CHI QUAN LY HINH THUC, KHONG CAN THIEP NOI DUNG ===

Cau chuyen LUON thuoc ve nguoi ke. Ban TUYET DOI khong duoc:
- Dan dat cau chuyen
- Khai thac noi dung
- Goi mo cam xuc
- Hoi ve y nghia, bai hoc hay triet ly
- Them chi tiet, nhan vat, loi thoai, cam xuc
- Suy dien
- Viet thay nguoi ke

Neu mot y chua xuat hien trong loi ke thi coi nhu y do khong ton tai.

Ban CHI duoc phep:
- Sua chinh ta
- Sua dau cau
- Chia doan
- Sap xep lai cau chu cho mach lac
- Dat tieu de khi nguoi ke yeu cau hoac sau khi cau chuyen hoan thanh
- Bien tap nhung khong lam thay doi y nghia

=== NGUYEN TAC 2: LUON HIEN DIEN NHUNG KHONG NGAT MACH KE ===

Trong khi nguoi ke dang ke, KHONG DUOC chen vao noi dung cau chuyen.

KHONG DUOC:
- Dat cau hoi ve noi dung
- Binh luan
- Khen che
- Dong cam sao rong
- Tom tat
- Phan tich

Neu nguoi ke dang nhap hoac vua gui noi dung, hay tao cam giac ban dang lang nghe bang thong diep mac dinh:

"Mira dang lang nghe...
Ban cu ke tu nhien nhe. Minh se giup sap xep va bien tap cau chu sau khi ban ke xong."

Neu nguoi ke im lang trong mot khoang thoi gian, CHI duoc phep nhac bang cac cau hoi mang tinh CAU TRUC nhu:

- Ban con muon ke tiep khong?
- Ban da ke xong chua?
- Ban co muon bo sung them dieu gi khong?
- Ban co muon dat tieu de khong?
- Ban co muon them loi nhan o cuoi khong?

KHONG DUOC su dung bat ky cau hoi nao lien quan den NOI DUNG cau chuyen.

=== NGUYEN TAC CAO NHAT ===

Nguoi ke quyet dinh KE GI.
Nguoi ke quyet dinh KE DEN DAU.
Nguoi ke quyet dinh DUNG O DAU.

Mira chi giup cau chuyen duoc trinh bay ro rang hon — Mira KHONG LAM THAY nguoi ke.

=== GIONG NOI ===
- Xung "ban", goi minh la "minh"
- Am ap, binh tinh, ton trong — nhu mot bien tap vien lang le lang nghe
- Ngan gon. Khong dai dong.

=== SAN SANG TAO BAN THAO ===
Khi nguoi ke bao hieu da ke xong (vd: "toi ke xong roi", "het roi", "vay thoi"), tra loi am ap va xac nhan:

"Cam on ban da chia se. Minh se giup ban bien tap lai cau chuyen cho mach lac hon. Ban co muon minh tao ban thao khong?"

Them danh dau: [[PHASE:ready]]

=== OFF-TOPIC ===
Neu nguoi dung hoi ve du an hoac quy trinh, tra loi ngan gon va am ap, sau do quay lai che do lang nghe.`

const WRITE_SYSTEM = `You are an editor. From the storyteller's words below, write a 300-600 word article in Vietnamese, first-person voice, keeping their raw authentic tone. Only use details they actually told -- do not add anything.

Return ONLY this exact JSON, nothing else:
{"title":"Title in Vietnamese","topic":"topic-slug","content":"Full article in Vietnamese"}

10 valid topics: dam-bat-dau, khong-bo-cuoc, theo-duoi-dam-me, tin-vao-ban-than, chua-lanh, yeu-thuong, biet-on, ket-noi, cho-di, can-bang-cuoc-song`

const REVISE_SYSTEM = `You are an editor. You wrote a draft from the user's story. Now they want changes.

Original article (title + content) is provided along with the revision request. Apply the request and return the revised version.

RULES:
- ONLY change what was requested
- If "shorter" -> condense, keep best details
- If "add more about X" -> integrate the additional story from recent conversation
- If "change title" -> change it
- If "less flowery" -> write more plainly
- Keep the storyteller's authentic voice

Return ONLY this exact JSON, nothing else:
{"title":"...","topic":"...","content":"..."}`

const REVIEW_SYSTEM = `You are the editorial board for "1001 Stories with Guitar".

Read the article below and evaluate against this checklist:
1. True to project spirit? (real story, no ads/spam)
2. No inappropriate content?
3. No personally identifiable info of others (phone, address)?
4. Spelling/formatting OK? (if not -> light edit, don't change voice)

Return ONLY this exact JSON, nothing else:
{"verdict":"ok"|"need_more"|"escalate","notes":"brief reason if need_more or escalate","content":"lightly edited article if ok"}`

// ============================================================
// HELPERS
// ============================================================

async function getUser(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data } = await db.auth.getUser(token)
  return data?.user ?? null
}

type Msg = { role: 'user' | 'mira'; text: string; at: string }

async function callAnthropic(system: string, messages: { role: string; content: string }[], model: string, maxTokens = 700) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
  })
  if (!res.ok) {
    const errBody = await res.text()
    console.error('Anthropic error', res.status, errBody)
    throw new Error(`Anthropic ${res.status}: ${errBody.slice(0, 200)}`)
  }
  const data = await res.json()
  return (data.content ?? []).filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text).join('').trim()
}

// ============================================================
// MAIN
// ============================================================

Deno.serve(async (req) => {
  try {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  let body: { action?: string; storyId?: string; message?: string; instruction?: string; stuck?: boolean }
  try { body = await req.json() } catch { return json({ error: 'Invalid body' }, 400) }

  // Ping để kiểm tra deploy
  if (body.action === 'ping') return json({ ping: 'pong', ver: 'v3' })

  // ── ADMIN: bypass auth for insert/management ──
  const ADMIN_KEY = 'st-1001-adm-7x9k2'
  if (body.admin_key === ADMIN_KEY) {
    if (body.action === 'list_all') {
      const { data: stories, error } = await db.from('stories')
        .select('id,title,content,pen_name,user_id,status,published_at,created_at,conversation')
        .in('status', ['telling', 'writing', 'user_review', 'submitted', 'pending_publish', 'published'])
        .order('created_at', { ascending: false })
      if (error) return json({ error: error.message }, 500)
      const userIds = [...new Set((stories || []).map(s => s.user_id).filter(Boolean))]
      const userMap: Record<string, string> = {}
      if (userIds.length > 0) {
        const { data: users } = await db.auth.admin.listUsers({ perPage: userIds.length })
        if (users?.users) for (const u of users.users) userMap[u.id] = u.user_metadata?.name || u.email?.split('@')[0] || u.email || ''
      }
      const enriched = (stories || []).map(s => ({ ...s, pen_name: s.pen_name || userMap[s.user_id] || '' }))
      return json({ stories: enriched })
    }
    if (body.action === 'admin_publish') {
      const { story_id } = body
      if (!story_id) return json({ error: 'Missing story_id' }, 400)
      const { data: st } = await db.from('stories').select('id,title,content,status,story_number').eq('id', story_id).maybeSingle()
      if (!st) return json({ error: 'Story not found' }, 404)
      const { data: maxRow } = await db.from('stories').select('story_number').not('story_number','is',null).order('story_number',{ascending:false}).limit(1).maybeSingle()
      const nextNum = (maxRow?.story_number ?? 0) + 1
      const slug = (st.title || 'story').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') + '-' + String(nextNum)
      const { error } = await db.from('stories').update({ status: 'published', story_number: nextNum, slug, published_at: new Date().toISOString() }).eq('id', story_id)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true, story_number: nextNum, slug })
    }
    if (body.action === 'admin_update_story') {
      const { story_id, title, content } = body
      if (!story_id) return json({ error: 'Missing story_id' }, 400)
      const updates: Record<string, any> = {}
      if (title !== undefined) updates.title = title
      if (content !== undefined) updates.content = content
      if (Object.keys(updates).length === 0) return json({ error: 'Nothing to update' }, 400)
      const { error } = await db.from('stories').update(updates).eq('id', story_id)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }
    if (body.action === "admin_insert_story") {
      const { title, content, pen_name, location, topic, photos, story_number, image_base64 = null } = body
      if (!title || !content) return json({ error: 'Missing title or content' }, 400)
      const { data: maxRow } = await db.from('stories')
        .select('story_number').not('story_number', 'is', null)
        .order('story_number', { ascending: false }).limit(1).maybeSingle()
      const nextNum = story_number || (maxRow?.story_number ?? 0) + 1
      const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + String(nextNum)
      const { data: story, error } = await db.from('stories').insert({
        user_id: body.user_id || '00000000-0000-0000-0000-000000000001',
        status: 'published',
        title, content, pen_name: pen_name || '', location: location || '',
        topic: topic || 'cay-dan-dau-tien',
        story_number: nextNum, slug,
        photos: photos || [],
        published_at: new Date().toISOString(),
        conversation: [],
      }).select('id,story_number,slug,title').single()
      if (error) return json({ error: `Insert failed: ${error.message}` }, 500)
      return json({ ok: true, story })
    }
    if (body.action === 'admin_update_photo') {
      const { story_id, image_base64: img } = body
      if (!story_id || !img) return json({ error: 'Missing story_id or image_base64' }, 400)
      try {
        const { data: st } = await db.from('stories').select('story_number,slug').eq('id', story_id).maybeSingle()
        if (!st) return json({ error: 'Story not found' }, 404)
        const path = `stories/${st.story_number}-${st.slug}.jpg`
        const imageBytes = Uint8Array.from(atob(img), c => c.charCodeAt(0))
        const bucketName = 'story-photos'
        const { data: buckets } = await db.storage.listBuckets()
        const exists = buckets?.some((b: { name: string }) => b.name === bucketName)
        if (!exists) await db.storage.createBucket(bucketName, { public: true })
        const { error: uploadErr } = await db.storage.from(bucketName).upload(path, imageBytes, { contentType: 'image/jpeg', upsert: true })
        if (uploadErr) return json({ error: `Upload: ${uploadErr.message}` }, 500)
        const { data: { publicUrl } } = db.storage.from(bucketName).getPublicUrl(path)
        await db.from('stories').update({ photos: [{ url: publicUrl, caption: '' }] }).eq('id', story_id)
        return json({ ok: true, url: publicUrl })
      } catch (e) { return json({ error: String(e) }, 500) }
    }
  }

  const user = await getUser(req)
  if (!user) return json({ error: 'Login required' }, 401)

  const action = body.action || 'chat'

  // ============ ACTION: list_all — ban biên tập (bypass RLS) ============
  if (action === 'list_all') {
    const { data: stories, error } = await db.from('stories')
      .select('id,title,content,pen_name,user_id,status,published_at,created_at,conversation')
      .in('status', ['telling', 'writing', 'user_review', 'submitted', 'pending_publish', 'published'])
      .order('created_at', { ascending: false })
    if (error) return json({ error: error.message }, 500)
    
    // Lấy tên user từ auth nếu pen_name trống
    const userIds = [...new Set((stories || []).map(s => s.user_id).filter(Boolean))]
    const userMap: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: users } = await db.auth.admin.listUsers({ perPage: userIds.length })
      if (users?.users) {
        for (const u of users.users) {
          userMap[u.id] = u.user_metadata?.name || u.email?.split('@')[0] || u.email || ''
        }
      }
    }
    
    const enriched = (stories || []).map(s => ({
      ...s,
      pen_name: s.pen_name || userMap[s.user_id] || '',
    }))
    return json({ stories: enriched })
  }

  // ============ ACTION: CHAT ============
  if (action === 'chat') {
    const message = (body.message || '').trim()
    const stuck = body.stuck === true
    if (!message && !stuck) return json({ error: 'Missing content' }, 400)
    if (message.length > MAX_MSG_LEN) return json({ error: 'Message too long' }, 400)

    let story: { id: string; user_id: string; status: string; conversation: Msg[] } | null = null
    if (body.storyId) {
      const { data } = await db.from('stories')
        .select('id,user_id,status,conversation').eq('id', body.storyId).maybeSingle()
      story = data as typeof story
      if (!story) return json({ error: 'Story not found' }, 404)
      if (story.user_id !== user.id) return json({ error: 'Not your story' }, 403)
      if (!['telling', 'collecting_photos'].includes(story.status)) {
        return json({ error: 'Story already past telling phase' }, 400)
      }
    } else {
      const { count } = await db.from('stories')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).not('status', 'in', '("published","unpublished")')
      if ((count ?? 0) >= MAX_OPEN_STORIES) {
        return json({ reply: 'Bạn có một số câu chuyện đang kể dở. Hãy mở menu ☰ bên trái để tiếp tục nhé.', phase: 'telling', storyId: null })
      }
      const { data, error } = await db.from('stories')
        .insert({ user_id: user.id, status: 'telling', conversation: [] })
        .select('id,user_id,status,conversation').single()
      if (error || !data) return json({ error: 'Could not create story' }, 500)
      story = data as typeof story
    }

    const conv: Msg[] = Array.isArray(story!.conversation) ? story!.conversation : []
    if (conv.length > MAX_STORY_MSGS) {
      return json({ reply: 'I have enough material. Ready to write your first draft.', phase: 'ready_for_draft', storyId: story!.id })
    }

    const userMsg = stuck ? '[STUCK_BUTTON]' : message
    conv.push({ role: 'user', text: userMsg, at: new Date().toISOString() })

    // ── MVP 02: lưu StoryChunk (chỉ lưu lời kể thật, không lưu STUCK_BUTTON) ──
    if (!stuck) {
      const { count } = await db.from('story_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('story_id', story!.id)
      const nextIndex = (count ?? 0) + 1
      await db.from('story_chunks').insert({
        story_id: story!.id,
        order_index: nextIndex,
        content: message,
      })
    }

    let system = MIRA_SYSTEM
    if (stuck) {
      system += '\n\nNguoi ke vua nhan nut "bi ket" — ho khong biet ke gi tiep. Hay nhe nhang hoi mot cau hoi CAU TRUC (khong lien quan noi dung), vi du: "Ban con muon ke tiep khong?" hoac "Ban da ke xong chua?"'
    }

    const aiMessages = conv.slice(-HISTORY).map((m) => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: m.text,
    }))

    let reply = ''
    let phase: 'asking' | 'ready_for_draft' = 'asking'

    try {
      const rawReply = await callAnthropic(system, aiMessages, MODEL_CHAT, 500)
      reply = rawReply

      if (/\[\[PHASE:ready\]\]/i.test(reply)) {
        phase = 'ready_for_draft'
        reply = reply.replace(/\[\[PHASE:ready\]\]/gi, '').trim()
      }

      if (!reply) {
        reply = 'Mira dang lang nghe...\nBan cu ke tu nhien nhe. Minh se giup sap xep va bien tap cau chu sau khi ban ke xong.'
        phase = 'asking'
      }
    } catch (e) {
      console.error('chat error', e)
      reply = 'Mira dang lang nghe...\nBan cu ke tu nhien nhe.'
      phase = 'asking'
    }

    conv.push({ role: 'mira', text: reply, at: new Date().toISOString() })
    await db.from('stories').update({ conversation: conv }).eq('id', story!.id)

    return json({ reply, phase, storyId: story!.id })
  }

  // ============ ACTION: WRITE ============
  if (action === 'write') {
    if (!body.storyId) return json({ error: 'Missing storyId' }, 400)

    const { data: story } = await db.from('stories')
      .select('id,user_id,status,conversation').eq('id', body.storyId).maybeSingle()
    if (!story) return json({ error: 'Story not found' }, 404)
    if (story.user_id !== user.id) return json({ error: 'Not your story' }, 403)
    if (!['telling', 'collecting_photos', 'user_review'].includes(story.status)) {
      return json({ error: 'Already past telling phase' }, 400)
    }

    await db.from('stories').update({ status: 'writing' }).eq('id', story.id)

    const conv: Msg[] = Array.isArray(story.conversation) ? story.conversation : []
    const userMessages = conv
      .filter(m => m.role === 'user' && !m.text.startsWith('[STUCK'))
      .map(m => m.text).join('\n\n')

    if (!userMessages.trim()) {
      await db.from('stories').update({ status: 'telling' }).eq('id', story.id)
      return json({ error: 'Not enough content to write' }, 400)
    }

    try {
      const rawReply = await callAnthropic(WRITE_SYSTEM, [{
        role: 'user', content: `Storyteller's words:\n${userMessages.slice(0, 8000)}`
      }], MODEL_WRITE, 3000)

      // Extract JSON
      let jsonStr = rawReply.trim()
      const m = jsonStr.match(/\{[\s\S]*\}/)
      if (!m) throw new Error(`No JSON found: ${rawReply.slice(0, 200)}`)
      jsonStr = m[0]
      const parsed = JSON.parse(jsonStr)

      if (!parsed.content) throw new Error('Missing content field')

      await db.from('stories').update({
        status: 'user_review',
        title: parsed.title || 'Untitled',
        topic: parsed.topic || '',
        content: parsed.content,
      }).eq('id', story.id)

      return json({ title: parsed.title, topic: parsed.topic, content: parsed.content })
    } catch (e) {
      console.error('write error', e)
      await db.from('stories').update({ status: 'telling' }).eq('id', story.id)
      return json({ error: `CODE_VER:v3 | ${e instanceof Error ? e.message : String(e)}` }, 500)
    }
  }

  // ============ ACTION: REVISE ============
  if (action === 'revise') {
    if (!body.storyId || !body.instruction) return json({ error: 'Missing storyId or instruction' }, 400)

    const { data: story } = await db.from('stories')
      .select('id,user_id,status,title,content,topic,conversation')
      .eq('id', body.storyId).maybeSingle()
    if (!story) return json({ error: 'Story not found' }, 404)
    if (story.user_id !== user.id) return json({ error: 'Not your story' }, 403)
    if (!['user_review'].includes(story.status)) {
      return json({ error: 'No draft to revise' }, 400)
    }

    const conv: Msg[] = Array.isArray(story.conversation) ? story.conversation : []
    const convText = conv
      .filter(m => m.role === 'user' && !m.text.startsWith('[STUCK'))
      .map(m => m.text).join('\n\n')

    try {
      const rawReply = await callAnthropic(REVISE_SYSTEM, [{
        role: 'user',
        content: [
          `Original title: ${story.title || ''}`,
          `Original content: ${story.content || ''}`,
          '',
          `REVISION REQUEST: ${body.instruction}`,
          '',
          `Full original story (for reference):`,
          convText,
        ].join('\n'),
      }], MODEL_WRITE, 2000)

      let jsonStr = rawReply.trim()
      const m = jsonStr.match(/\{[\s\S]*\}/)
      if (m) jsonStr = m[0]
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(jsonStr)

      const title = parsed.title || story.title
      const topic = parsed.topic || story.topic
      const content = parsed.content || story.content

      await db.from('stories').update({ title, topic, content }).eq('id', story.id)
      return json({ title, topic, content })
    } catch (e) {
      console.error('revise error', e)
      return json({ error: 'Could not revise draft' }, 500)
    }
  }

  // ============ ACTION: COMPLETE ============
  if (action === 'complete') {
    if (!body.storyId || !body.rawContent) return json({ error: 'Missing storyId or rawContent' }, 400)

    const { data: story } = await db.from('stories')
      .select('id,user_id,status').eq('id', body.storyId).maybeSingle()
    if (!story) return json({ error: 'Story not found' }, 404)
    if (story.user_id !== user.id) return json({ error: 'Not your story' }, 403)

    await db.from('stories').update({ status: 'user_review' }).eq('id', story.id)

    const COMPLETE_SYSTEM = `You are Mira. Read the storyteller's complete story below. Evaluate if it has enough material for a draft.

Criteria: clear narrative + specific details + emotional truth.

Return ONLY this JSON:
{"ready":true|false,"reply":"your response in Vietnamese"}

If ready: reply warmly, briefly — the story has enough.
If not ready: reply gently, suggest what could be added.`

    try {
      const rawReply = await callAnthropic(COMPLETE_SYSTEM, [{
        role: 'user',
        content: `Complete story:\n${(body.rawContent as string).slice(0, 8000)}`
      }], MODEL_CHAT, 400)

      let jsonStr = rawReply.trim()
      const m = jsonStr.match(/\{[\s\S]*\}/)
      if (m) jsonStr = m[0]
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(jsonStr)
      return json({ ready: parsed.ready === true, reply: parsed.reply || '' })
    } catch (e) {
      console.error('complete error', e)
      return json({ ready: true, reply: 'Câu chuyện của bạn đã sẵn sàng để tạo bản thảo.' })
    }
  }

  // ============ ACTION: REVIEW ============
  if (action === 'review') {
    if (!body.storyId) return json({ error: 'Missing storyId' }, 400)

    const { data: story } = await db.from('stories')
      .select('id,user_id,status,title,content').eq('id', body.storyId).maybeSingle()
    if (!story) return json({ error: 'Story not found' }, 404)
    if (story.user_id !== user.id) return json({ error: 'Not your story' }, 403)
    if (story.status !== 'submitted') {
      return json({ error: 'Story not submitted' }, 400)
    }

    await db.from('stories').update({ status: 'pending_publish' }).eq('id', story.id)

    try {
      const rawReply = await callAnthropic(REVIEW_SYSTEM, [{
        role: 'user',
        content: `Title: ${story.title || ''}\n\nContent: ${story.content || ''}`,
      }], MODEL_REVIEW, 1000)

      let jsonStr = rawReply.trim()
      const m = jsonStr.match(/\{[\s\S]*\}/)
      if (m) jsonStr = m[0]
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(jsonStr)

      const verdict = parsed.verdict || 'ok'
      const notes = parsed.notes || ''

      if (verdict === 'ok') {
        const finalContent = parsed.content || story.content

        const { data: maxRow } = await db.from('stories')
          .select('story_number').not('story_number', 'is', null)
          .order('story_number', { ascending: false }).limit(1).maybeSingle()
        const nextNumber = (maxRow?.story_number ?? 0) + 1

        const slug = (story.title || 'story')
          .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
          + '-' + String(nextNumber)

        await db.from('stories').update({
          status: 'published',
          content: finalContent,
          story_number: nextNumber,
          slug,
          ai_review: { verdict, notes, at: new Date().toISOString() },
          published_at: new Date().toISOString(),
        }).eq('id', story.id)

        return json({ verdict: 'ok', story_number: nextNumber, slug })
      } else if (verdict === 'need_more') {
        await db.from('stories').update({
          status: 'user_review',
          ai_review: { verdict, notes, at: new Date().toISOString() },
        }).eq('id', story.id)
        return json({ verdict: 'need_more', notes })
      } else {
        await db.from('stories').update({
          ai_review: { verdict, notes, at: new Date().toISOString() },
        }).eq('id', story.id)
        return json({ verdict: 'escalate', notes })
      }
    } catch (e) {
      console.error('review error', e)
      return json({ error: 'Editorial review unavailable -- will retry' }, 500)
    }
  }

  // ============ ACTION: fix_data — one-time data repair (encoding + expired photos) ============
  if (action === 'fix_data') {
    const results: string[] = []

    // Fix pen_name encoding corruption
    const penFixes: Record<string, string> = {
      'cddfb454-49a9-41a5-8004-d37487ac321f': 'Kh\u00e1nh',
      'ea611a49-fbf8-4313-810c-a51435b257ee': 'Ho\u00e0ng',
      '1d0ffefc-100b-4163-8f19-d02d5768327d': 'Ph\u00fac',
    }
    for (const [id, name] of Object.entries(penFixes)) {
      const { error } = await db.from('stories').update({ pen_name: name }).eq('id', id)
      results.push(error ? `FAIL pen_name ${id}: ${error.message}` : `OK pen_name ${id} -> ${name}`)
    }

    // Clear expired Replicate photos -> placeholder appears
    const { count, error: photoErr } = await db.from('stories')
      .update({ photos: null })
      .eq('status', 'published')
      .not('photos', 'is', null)
    results.push(photoErr ? `FAIL photos: ${photoErr.message}` : `OK photos cleared for ${count ?? 0} published stories`)

    return json({ action: 'fix_data', results })
  }

  return json({ error: `Unknown action: ${action}` }, 400)
  } catch (e) {
    console.error('story-ai FATAL', e)
    return json({ error: 'Internal error: ' + (e instanceof Error ? e.message : String(e)) }, 500)
  }
})
