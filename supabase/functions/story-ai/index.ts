// Edge Function: story-ai -- MVP 01: Story Interview
// Mira = interview facilitator creating a work, NOT a chatbot.
// Default behavior: listen + remember. Only respond when truly needed.
// Actions: chat (tell) - write (draft) - revise (edit) - review (submit)
// DEPLOY: Supabase Dashboard -> Edge Functions -> story-ai -> "Verify JWT" = ON
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const MODEL_CHAT = 'claude-haiku-4-5'
const MODEL_WRITE = 'claude-haiku-4-5'
const MODEL_REVIEW = 'claude-haiku-4-5'

const MAX_MSG_LEN = 2000
const MAX_STORY_MSGS = 80
const MAX_OPEN_STORIES = 3
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
// SYSTEM PROMPT -- MVP 01 (ASCII only -- Supabase Dashboard corrupts UTF-8)
// ============================================================
const MIRA_SYSTEM = `You are Mira -- an interviewer for the project "1001 Stories with Guitar" by teacher Van Anh.

YOUR ROLE: You are NOT a chatbot. You are an interviewer -- your job is to listen, remember, and recognize when a story has enough material to become a work.

YOUR TASKS (in priority order):
1. LISTEN -- remember every detail the user tells
2. RECOGNIZE -- when the story has enough material (clear narrative + specific details + real emotion)
3. ASK -- ONLY when truly missing an important detail needed to understand the story
4. DRAFT -- later, you will arrange the story into a complete article (in the write action, not now)

VOICE:
- Address the user as "ban" (you), call yourself "minh" (me). Warm, genuine, no fluff.
- NEVER say: "I'm listening...", "Thank you...", "I remember...", "That's great...", "So touching..."
- NO empty praise. NO excessive encouragement. NO explaining. NO lecturing.
- When you need to ask: one short, direct, open-ended question.
- NO emojis -- almost never use them.

=== DEFAULT BEHAVIOR: SILENCE ===
User sends a message -> you remember it. Most of the time, you say NOTHING.
- NO response after every message
- NO "nodding in text"
- NO "I'm listening"
- Silence is the default and correct behavior

=== WHEN TO SPEAK ===
Only speak in ONE of these cases:

A. MISSING IMPORTANT DETAIL -- the story has a gap that prevents understanding.
   -> Ask ONE short, open question.
   -> Add marker: [[PHASE:asking]]
   Example: "Who gave you that guitar?" [[PHASE:asking]]

B. ENOUGH MATERIAL -- you judge the story has: clear narrative + specific details + real emotion.
   -> Say ONE short sentence indicating readiness.
   -> Add marker: [[PHASE:ready]]
   Example: "I've understood your story and am ready to write the first draft." [[PHASE:ready]]

C. OFF-TOPIC -- user asks about the project, process, etc.
   -> Answer briefly, in the right spirit, then return to listening.

=== FORBIDDEN ===
- NO inventing details
- NO suggesting content ("Try telling about...")
- NO planting emotions ("You must have been very sad...")
- NO closed questions ("Was it...?", "...right?")
- NO judging whether the story is good or bad
- NO excessive praise, NO excessive encouragement
- NO long responses -- max 2 sentences per response`

const WRITE_SYSTEM = `You are an editor. From the storyteller's words below, write a 300-600 word article in Vietnamese, first-person voice, keeping their raw authentic tone. Only use details they actually told -- do not add anything.

Return ONLY this exact JSON, nothing else:
{"title":"Title in Vietnamese","topic":"topic-slug","content":"Full article in Vietnamese"}

10 valid topics: cay-dan-dau-tien, bai-hat-thay-doi-toi, guitar-va-tuoi-tho, vuot-qua-kho-khan, guitar-trong-gia-dinh, nguoi-thay-dau-tien, dau-tay-va-chai-san, lan-dau-dan-truoc-moi-nguoi, bo-do-roi-quay-lai, cay-dan-va-nguoi-than`

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

  const user = await getUser(req)
  if (!user) return json({ error: 'Login required' }, 401)

  let body: { action?: string; storyId?: string; message?: string; instruction?: string; stuck?: boolean }
  try { body = await req.json() } catch { return json({ error: 'Invalid body' }, 400) }

  const action = body.action || 'chat'

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
        return json({ reply: 'You have some unfinished stories. Go to "My Stories" to continue.', phase: 'telling', storyId: null })
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

    let system = MIRA_SYSTEM
    if (stuck) {
      system += '\n\nUser just pressed "stuck" button -- they don\'t know what to tell next. Ask ONE short open question to help them remember. [[PHASE:asking]]'
    }

    const aiMessages = conv.slice(-HISTORY).map((m) => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: m.text,
    }))

    let reply = ''
    let phase: 'telling' | 'asking' | 'ready_for_draft' = 'telling'

    try {
      const rawReply = await callAnthropic(system, aiMessages, MODEL_CHAT, 500)
      reply = rawReply

      if (/\[\[PHASE:ready\]\]/i.test(reply)) {
        phase = 'ready_for_draft'
        reply = reply.replace(/\[\[PHASE:ready\]\]/gi, '').trim()
      } else if (/\[\[PHASE:asking\]\]/i.test(reply)) {
        phase = 'asking'
        reply = reply.replace(/\[\[PHASE:asking\]\]/gi, '').trim()
      }

      if (!reply) phase = 'telling'
    } catch (e) {
      console.error('chat error', e)
      reply = ''
      phase = 'telling'
    }

    conv.push({ role: 'mira', text: reply || '(silent -- listening)', at: new Date().toISOString() })
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
    if (!['telling', 'collecting_photos'].includes(story.status)) {
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

  return json({ error: `Unknown action: ${action}` }, 400)
  } catch (e) {
    console.error('story-ai FATAL', e)
    return json({ error: 'Internal error: ' + (e instanceof Error ? e.message : String(e)) }, 500)
  }
})
