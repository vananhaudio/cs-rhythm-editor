// Edge Function: story-ai — MVP 01: Story Interview
// Mira = người phỏng vấn tạo tác phẩm, KHÔNG phải chatbot.
// Hành vi mặc định: lắng nghe + ghi nhớ. Chỉ phản hồi khi thật sự cần.
// Actions: chat (kể) · write (sinh bản thảo) · revise (sửa bản thảo) · review (gửi biên tập)
// DEPLOY: Supabase Dashboard → Edge Functions → story-ai → "Verify JWT" = BẬT
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

// Models — tách theo tác vụ
const MODEL_CHAT = 'claude-haiku-4-5'
const MODEL_WRITE = 'claude-haiku-4-5'  // TODO: đổi sang sonnet khi verify được model name chính xác
const MODEL_REVIEW = 'claude-haiku-4-5'

// Giới hạn
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

// ═══════════════════════════════════════════
// SYSTEM PROMPT — MVP 01
// ═══════════════════════════════════════════
const MIRA_SYSTEM = `Bạn là Mira — người phỏng vấn của dự án "1001 Câu chuyện cùng Guitar".

VAI TRÒ: Bạn KHÔNG phải chatbot. Bạn là người phỏng vấn — công việc của bạn là lắng nghe, ghi nhớ, và nhận ra khi nào câu chuyện đã đủ để tạo thành một tác phẩm.

NHIỆM VỤ CỦA BẠN (theo thứ tự ưu tiên):
1. LẮNG NGHE — ghi nhớ mọi chi tiết người dùng kể
2. GHI NHẬN — khi nào câu chuyện đã đủ chất liệu (có cốt truyện rõ ràng + chi tiết cụ thể + cảm xúc thật)
3. HỎI THÊM — CHỈ khi thật sự thiếu một chi tiết quan trọng để hiểu được câu chuyện
4. TẠO BẢN THẢO — sắp xếp lại lời kể thành bài hoàn chỉnh (ở action write, không phải lúc này)

GIỌNG:
- Xưng "mình", gọi "bạn". Mộc, chân thành, không văn hoa.
- KHÔNG BAO GIỜ nói: "Mình đang nghe…", "Cảm ơn bạn…", "Mình nhớ rồi…", "Hay quá…", "Cảm động quá…"
- KHÔNG khen sáo rỗng. KHÔNG khuyến khích quá mức. KHÔNG giải thích. KHÔNG giáo dục.
- Khi cần hỏi: một câu hỏi ngắn, trực tiếp, không dẫn dắt.
- Emoji cực kỳ tiết chế — gần như không dùng.

═══ HÀNH VI MẶC ĐỊNH: IM LẶNG ═══
Người dùng gửi lời kể → bạn ghi nhớ. Đa số trường hợp bạn KHÔNG CẦN NÓI GÌ.
- KHÔNG phản hồi sau mỗi tin
- KHÔNG "gật đầu bằng chữ"
- KHÔNG "mình đang nghe"
- Im lặng là hành vi mặc định và đúng đắn nhất

═══ KHI NÀO MỚI NÓI ═══
Bạn CHỈ nói khi thuộc MỘT trong các trường hợp sau:

A. THIẾU CHI TIẾT QUAN TRỌNG — câu chuyện có một lỗ hổng khiến người đọc không hiểu được.
   → Hỏi MỘT câu ngắn, mở, không dẫn dắt.
   → Sau câu hỏi, thêm dấu hiệu: [[PHASE:asking]]
   Ví dụ: "Người tặng bạn cây đàn đó là ai vậy?" [[PHASE:asking]]

B. ĐÃ ĐỦ CHẤT LIỆU — bạn đánh giá câu chuyện đã có: cốt truyện rõ + chi tiết cụ thể + cảm xúc.
   → Nói MỘT câu ngắn báo đã sẵn sàng.
   → Thêm dấu hiệu: [[PHASE:ready]]
   Ví dụ: "Mình đã hiểu câu chuyện của bạn và sẵn sàng viết bản thảo đầu tiên." [[PHASE:ready]]

C. NGOÀI LỀ — người dùng hỏi về dự án, quy trình…
   → Trả lời ngắn, đúng tinh thần, rồi quay lại lắng nghe.

═══ ĐIỀU CẤM LÀM ═══
- KHÔNG sáng tác thêm tình tiết
- KHÔNG gợi ý nội dung ("Bạn thử kể về…")
- KHÔNG gieo cảm xúc ("Chắc lúc đó bạn rất buồn…")
- KHÔNG câu hỏi đóng ("Có phải…", "…phải không?")
- KHÔNG đánh giá câu chuyện hay hay dở
- KHÔNG khen quá mức, KHÔNG động viên quá mức
- KHÔNG nói dài — mỗi lần nói tối đa 2 câu`

// ═══════════════════════════════════════════
// PROMPT VIẾT BẢN THẢO
// ═══════════════════════════════════════════
const WRITE_PROMPT = `Bạn là Mira — người biên tập của dự án "1001 Câu chuyện cùng Guitar".

Nhiệm vụ: Từ cuộc trò chuyện phía trên (người dùng kể + bạn ghi nhận), hãy sắp xếp lại thành một bài viết hoàn chỉnh.

NGUYÊN TẮC:
- Ngôi thứ nhất — giọng của chính người kể
- CHỈ dùng chi tiết có thật trong lời kể — KHÔNG thêm thắt, không bịa
- Giữ nguyên giọng mộc mạc của người kể (họ nói sao giữ vậy, chỉ sắp xếp lại)
- 300–600 chữ
- Có tiêu đề hấp dẫn nhưng trung thực
- Gắn 1 chủ đề phù hợp nhất trong 10 chủ đề: cay-dan-dau-tien, bai-hat-thay-doi-toi, guitar-va-tuoi-tho, vuot-qua-kho-khan, guitar-trong-gia-dinh, nguoi-thay-dau-tien, dau-tay-va-chai-san, lan-dau-dan-truoc-moi-nguoi, bo-do-roi-quay-lai, cay-dan-va-nguoi-than

Trả về CHỈ một JSON object (không markdown, không giải thích):
{"title": "...", "topic": "...", "content": "..."}`

// ═══════════════════════════════════════════
// PROMPT SỬA BẢN THẢO
// ═══════════════════════════════════════════
const REVISE_PROMPT = `Bạn là Mira — người biên tập. Bạn đã viết một bản thảo từ lời kể của người dùng. Bây giờ họ yêu cầu sửa.

Bài gốc (title, content) được cung cấp kèm yêu cầu sửa. Hãy áp dụng yêu cầu đó và trả về bản đã sửa.

NGUYÊN TẮC:
- CHỈ sửa những gì được yêu cầu
- Nếu yêu cầu "ngắn lại" → rút gọn, giữ chi tiết đắt nhất
- Nếu yêu cầu "kể thêm đoạn X" → đoạn X đã được kể thêm trong hội thoại gần nhất, hãy tích hợp vào
- Nếu yêu cầu "đổi tiêu đề" → đổi
- Nếu yêu cầu "bớt văn hoa" → viết mộc hơn
- Giữ nguyên giọng người kể

Trả về CHỈ một JSON object (không markdown):
{"title": "...", "topic": "...", "content": "..."}`

// ═══════════════════════════════════════════
// PROMPT BIÊN TẬP (REVIEW)
// ═══════════════════════════════════════════
const REVIEW_PROMPT = `Bạn là ban biên tập của dự án "1001 Câu chuyện cùng Guitar".

Nhiệm vụ: đọc bài viết dưới đây và đánh giá theo checklist:

1. Đúng tinh thần dự án? (câu chuyện thật, không quảng cáo/spam)
2. Không có nội dung không phù hợp?
3. Không lộ thông tin nhạy cảm của người khác (SĐT, địa chỉ cụ thể…)?
4. Chính tả/ngắt đoạn ổn? (nếu không → sửa nhẹ, không đổi giọng)

Trả về CHỈ một JSON object (không markdown):
{"verdict": "ok" | "need_more" | "escalate", "notes": "lý do ngắn nếu need_more hoặc escalate", "content": "bài đã sửa nhẹ nếu ok"}`

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

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

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const user = await getUser(req)
  if (!user) return json({ error: 'Cần đăng nhập' }, 401)

  let body: { action?: string; storyId?: string; message?: string; instruction?: string }
  try { body = await req.json() } catch { return json({ error: 'Body không hợp lệ' }, 400) }

  const action = body.action || 'chat'

  // ═══════════ ACTION: CHAT ═══════════
  if (action === 'chat') {
    const message = (body.message || '').trim()
    const stuck = (body as { stuck?: boolean }).stuck === true
    if (!message && !stuck) return json({ error: 'Thiếu nội dung' }, 400)
    if (message.length > MAX_MSG_LEN) return json({ error: 'Tin nhắn quá dài' }, 400)

    // Lấy hoặc tạo story
    let story: { id: string; user_id: string; status: string; conversation: Msg[] } | null = null
    if (body.storyId) {
      const { data } = await db.from('stories')
        .select('id,user_id,status,conversation').eq('id', body.storyId).maybeSingle()
      story = data as typeof story
      if (!story) return json({ error: 'Không tìm thấy câu chuyện' }, 404)
      if (story.user_id !== user.id) return json({ error: 'Không phải bài của bạn' }, 403)
      if (!['telling', 'collecting_photos'].includes(story.status)) {
        return json({ error: 'Bài này đã qua bước kể' }, 400)
      }
    } else {
      const { count } = await db.from('stories')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).not('status', 'in', '("published","unpublished")')
      if ((count ?? 0) >= MAX_OPEN_STORIES) {
        return json({ reply: 'Bạn đang có vài câu chuyện kể dở. Vào "Câu chuyện của tôi" để kể tiếp nhé.', phase: 'telling', storyId: null })
      }
      const { data, error } = await db.from('stories')
        .insert({ user_id: user.id, status: 'telling', conversation: [] })
        .select('id,user_id,status,conversation').single()
      if (error || !data) return json({ error: 'Không tạo được câu chuyện' }, 500)
      story = data as typeof story
    }

    const conv: Msg[] = Array.isArray(story!.conversation) ? story!.conversation : []
    if (conv.length > MAX_STORY_MSGS) {
      // Đủ chất liệu → gợi ý chuyển bước
      return json({ reply: 'Mình đã hiểu câu chuyện của bạn và sẵn sàng viết bản thảo đầu tiên.', phase: 'ready_for_draft', storyId: story!.id })
    }

    const userMsg = stuck ? '[BẤM NÚT: Mình đang bí…]' : message
    conv.push({ role: 'user', text: userMsg, at: new Date().toISOString() })

    // System prompt
    let system = MIRA_SYSTEM
    if (stuck) {
      system += `\n\n⚠️ Người dùng vừa báo "bí" — họ không biết kể gì tiếp. Hãy hỏi MỘT câu hỏi mở, ngắn để giúp họ nhớ ra điều gì đó. [[PHASE:asking]]`
    }

    // Build messages for Anthropic
    const aiMessages = conv.slice(-HISTORY).map((m) => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: m.text,
    }))

    let reply = ''
    let phase: 'telling' | 'asking' | 'ready_for_draft' = 'telling'

    try {
      const rawReply = await callAnthropic(system, aiMessages, MODEL_CHAT, 500)
      reply = rawReply

      // Parse phase markers
      if (/\[\[PHASE:ready\]\]/i.test(reply)) {
        phase = 'ready_for_draft'
        reply = reply.replace(/\[\[PHASE:ready\]\]/gi, '').trim()
      } else if (/\[\[PHASE:asking\]\]/i.test(reply)) {
        phase = 'asking'
        reply = reply.replace(/\[\[PHASE:asking\]\]/gi, '').trim()
      }

      // Nếu reply rỗng hoặc chỉ có whitespace → Mira đang lắng nghe
      if (!reply) {
        phase = 'telling'
      }
    } catch (e) {
      console.error('story-ai chat exception', e)
      reply = ''
      phase = 'telling'
    }

    conv.push({ role: 'mira', text: reply || '(im lặng — đang lắng nghe)', at: new Date().toISOString() })
    await db.from('stories').update({ conversation: conv }).eq('id', story!.id)

    return json({ reply, phase, storyId: story!.id })
  }

  // ═══════════ ACTION: WRITE ═══════════
  if (action === 'write') {
    if (!body.storyId) return json({ error: 'Thiếu storyId' }, 400)

    const { data: story } = await db.from('stories')
      .select('id,user_id,status,conversation').eq('id', body.storyId).maybeSingle()
    if (!story) return json({ error: 'Không tìm thấy câu chuyện' }, 404)
    if (story.user_id !== user.id) return json({ error: 'Không phải bài của bạn' }, 403)
    if (!['telling', 'collecting_photos'].includes(story.status)) {
      return json({ error: 'Bài này đã qua bước kể' }, 400)
    }

    await db.from('stories').update({ status: 'writing' }).eq('id', story.id)

    const conv: Msg[] = Array.isArray(story.conversation) ? story.conversation : []
    const convText = conv
      .filter(m => m.role === 'user' && !m.text.startsWith('[BẤM NÚT:'))
      .map(m => `Người kể: ${m.text}`).join('\n\n')

    if (!convText.trim()) {
      await db.from('stories').update({ status: 'telling' }).eq('id', story.id)
      return json({ error: 'Chưa có đủ nội dung để viết' }, 400)
    }

    // Simple prompt — yêu cầu JSON rõ ràng
    const writeSystem = `Bạn là người biên tập. Từ lời kể, hãy viết thành bài 300-600 chữ, ngôi thứ nhất.
Trả về CHÍNH XÁC JSON này, không thêm gì khác:
{"title":"Tiêu đề","topic":"chu-de","content":"Nội dung bài"}
10 chủ đề: cay-dan-dau-tien, bai-hat-thay-doi-toi, guitar-va-tuoi-tho, vuot-qua-kho-khan, guitar-trong-gia-dinh, nguoi-thay-dau-tien, dau-tay-va-chai-san, lan-dau-dan-truoc-moi-nguoi, bo-do-roi-quay-lai, cay-dan-va-nguoi-than.`

    try {
      const rawReply = await callAnthropic(writeSystem, [{
        role: 'user', content: `Lời kể:\n${convText.slice(0, 8000)}`
      }], MODEL_WRITE, 3000)

      console.error('WRITE RAW:', rawReply.slice(0, 500))

      // Trích JSON
      let jsonStr = rawReply.trim()
      const m = jsonStr.match(/\{[\s\S]*\}/)
      if (!m) throw new Error(`Không tìm thấy JSON trong response: ${rawReply.slice(0, 200)}`)
      jsonStr = m[0]
      const parsed = JSON.parse(jsonStr)

      if (!parsed.content) throw new Error('Thiếu content')

      await db.from('stories').update({
        status: 'user_review',
        title: parsed.title || 'Không có tiêu đề',
        topic: parsed.topic || '',
        content: parsed.content,
      }).eq('id', story.id)

      return json({ title: parsed.title, topic: parsed.topic, content: parsed.content })
    } catch (e) {
      console.error('story-ai write error', e)
      await db.from('stories').update({ status: 'telling' }).eq('id', story.id)
      return json({ error: `CODE_VER:20260727-2141 | ${e instanceof Error ? e.message : String(e)}` }, 500)
    }
  }

  // ═══════════ ACTION: REVISE ═══════════
  if (action === 'revise') {
    if (!body.storyId || !body.instruction) return json({ error: 'Thiếu storyId hoặc instruction' }, 400)

    const { data: story } = await db.from('stories')
      .select('id,user_id,status,title,content,topic,conversation')
      .eq('id', body.storyId).maybeSingle()
    if (!story) return json({ error: 'Không tìm thấy câu chuyện' }, 404)
    if (story.user_id !== user.id) return json({ error: 'Không phải bài của bạn' }, 403)
    if (!['user_review'].includes(story.status)) {
      return json({ error: 'Bài này chưa có bản thảo để sửa' }, 400)
    }

    const conv: Msg[] = Array.isArray(story.conversation) ? story.conversation : []
    const convText = conv
      .filter(m => m.role === 'user' && !m.text.startsWith('[BẤM NÚT:'))
      .map(m => `Người kể: ${m.text}`).join('\n\n')

    try {
      const rawReply = await callAnthropic(
        REVISE_PROMPT,
        [{
          role: 'user',
          content: [
            `Bài gốc — Tiêu đề: ${story.title || ''}`,
            `Nội dung: ${story.content || ''}`,
            '',
            `YÊU CẦU SỬA: ${body.instruction}`,
            '',
            `Toàn bộ lời kể gốc (để tham khảo nếu cần thêm chi tiết):`,
            convText,
          ].join('\n'),
        }],
        MODEL_WRITE,
        2000,
      )

      let jsonStr = rawReply
      const m = rawReply.match(/\{[\s\S]*\}/)
      if (m) jsonStr = m[0]
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(jsonStr)

      const title = parsed.title || story.title
      const topic = parsed.topic || story.topic
      const content = parsed.content || story.content

      await db.from('stories').update({ title, topic, content }).eq('id', story.id)

      return json({ title, topic, content })
    } catch (e) {
      console.error('story-ai revise error', e)
      return json({ error: 'Không thể sửa bản thảo — thử lại nhé' }, 500)
    }
  }

  // ═══════════ ACTION: REVIEW ═══════════
  if (action === 'review') {
    if (!body.storyId) return json({ error: 'Thiếu storyId' }, 400)

    const { data: story } = await db.from('stories')
      .select('id,user_id,status,title,content').eq('id', body.storyId).maybeSingle()
    if (!story) return json({ error: 'Không tìm thấy câu chuyện' }, 404)
    if (story.user_id !== user.id) return json({ error: 'Không phải bài của bạn' }, 403)
    if (story.status !== 'submitted') {
      return json({ error: 'Bài chưa được gửi biên tập' }, 400)
    }

    await db.from('stories').update({ status: 'pending_publish' }).eq('id', story.id)

    try {
      const rawReply = await callAnthropic(
        REVIEW_PROMPT,
        [{
          role: 'user',
          content: `Tiêu đề: ${story.title || ''}\n\nNội dung: ${story.content || ''}`,
        }],
        MODEL_REVIEW,
        1000,
      )

      let jsonStr = rawReply
      const m = rawReply.match(/\{[\s\S]*\}/)
      if (m) jsonStr = m[0]
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(jsonStr)

      const verdict = parsed.verdict || 'ok'
      const notes = parsed.notes || ''

      if (verdict === 'ok') {
        // Tự động xuất bản
        const finalContent = parsed.content || story.content

        // Lấy story_number tiếp theo
        const { data: maxRow } = await db.from('stories')
          .select('story_number').not('story_number', 'is', null)
          .order('story_number', { ascending: false }).limit(1).maybeSingle()
        const nextNumber = (maxRow?.story_number ?? 0) + 1

        // Tạo slug
        const slug = (story.title || 'cau-chuyen')
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
        // Trả về cho người dùng sửa
        await db.from('stories').update({
          status: 'user_review',
          ai_review: { verdict, notes, at: new Date().toISOString() },
        }).eq('id', story.id)
        return json({ verdict: 'need_more', notes })
      } else {
        // escalate — giữ pending_publish, chờ thầy
        await db.from('stories').update({
          ai_review: { verdict, notes, at: new Date().toISOString() },
        }).eq('id', story.id)
        return json({ verdict: 'escalate', notes })
      }
    } catch (e) {
      console.error('story-ai review error', e)
      // Giữ pending_publish để retry
      return json({ error: 'Biên tập đang bận — sẽ thử lại sau' }, 500)
    }
  }

  return json({ error: `Action '${action}' không tồn tại` }, 400)
})
