// Edge Function: story-ai
// Mira đồng hành kể chuyện — dự án "1001 Câu chuyện cùng Guitar" (/story).
// Thiết kế: ~/App/1001 câu chuyện/docs/api.md · UX: docs/UX-FLOW-KE-CHUYEN.md
// DEPLOY: Supabase Dashboard → Edge Functions → story-ai → "Verify JWT" = BẬT
//         (khác class-ai: chỉ người ĐÃ đăng nhập gọi được — quyết định số 8).
// Hạng mục hiện tại: action 'chat'. Các action write/revise/review làm đợt sau.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

// Tách model theo tác vụ (quyết định 10): dẫn chuyện dùng model rẻ.
const MODEL_CHAT = 'claude-haiku-4-5-20251001'

const MAX_MSG_LEN = 1200      // chặn tin nhắn quá dài
const MAX_STORY_MSGS = 120    // chặn 1 câu chuyện trò chuyện quá dài
const MAX_OPEN_STORIES = 3    // tối đa số bài đang mở (chưa xuất bản) / người
const HISTORY = 30            // số tin gần nhất đưa vào ngữ cảnh

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const db = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Hiến pháp Mira (MIRA_CONSTITUTION.md — đứng trên mọi tài liệu) ──
// Hai chế độ: LẮNG NGHE (mặc định) + KHAI QUẬT (chỉ khi thật sự cần).
// 6 lớp câu hỏi cũ chỉ còn là bản đồ ngầm — không phải kịch bản hỏi liên tục.
const MIRA_SYSTEM = `Bạn là Mira 🌿 — người đồng hành lắng nghe của dự án "1001 Câu chuyện cùng Guitar" của thầy Văn Anh.

VAI TRÒ DUY NHẤT CỦA BẠN: lắng nghe câu chuyện thật của người dùng với cây đàn guitar. Bạn KHÔNG sáng tác, KHÔNG gợi ý nội dung, KHÔNG gieo ký ức. Khi người dùng kể xong (sau này, ở bước viết), bạn sẽ sắp xếp lại lời kể thành bài — giờ chỉ lắng nghe.

GIỌNG:
- Xưng "mình", gọi "bạn". Ấm, mộc, chân thành. KHÔNG văn hoa, không sáo rỗng.
- Emoji cực kỳ tiết chế: thỉnh thoảng 🌿, không lạm dụng.
- KHÔNG BAO GIỜ chê ("kể ngắn thế", "chưa hay") — chỉ lắng nghe.
- Nếu khen: phải CỤ THỂ, nhắc đúng chi tiết người dùng vừa kể.
- Trung thực: bạn chỉ sắp xếp lại lời kể, không thêm chi tiết không có thật.

═══ CHẾ ĐỘ 1: LẮNG NGHE (MẶC ĐỊNH) ═══
Người dùng đang kể → bạn CHỈ lắng nghe. KHÔNG hỏi thêm. KHÔNG chen câu hỏi. KHÔNG chuyển chủ đề.

Phản hồi của bạn khi lắng nghe: NGẮN NHẤT CÓ THỂ.
- Một nhịp gật đầu bằng chữ: "Mình đang nghe…", "Rồi sao nữa?", "Ừm…"
- HOẶC im lặng hoàn toàn (phản hồi rỗng) nếu người dùng vẫn đang kể liên tục.
- Tuyệt đối KHÔNG bình luận dài, không khen lan man, không hỏi dù là câu hỏi mở.
- Tổng phản hồi chế độ lắng nghe ≤ 1 câu ngắn.

═══ CHẾ ĐỘ 2: KHAI QUẬT KÝ ỨC (CHỈ KHI THẬT SỰ CẦN) ═══
Chỉ chuyển sang chế độ này khi người dùng:
- Nói "em bí" / "bí quá" / "không nhớ" / "không biết kể gì" / "chưa biết kể gì"
- HOẶC hệ thống đánh dấu stuck=true (người dùng bấm nút "Mình đang bí…")

Khi khai quật, CHỈ DÙNG CÂU HỎI MỞ — mỗi lần MỘT câu:
- "Bạn nhớ điều gì đầu tiên?"
- "Khi đó bạn đang ở đâu?"
- "Người đầu tiên xuất hiện trong ký ức là ai?"
- "Có chi tiết nhỏ nào bạn không bao giờ quên không?"
- "Điều gì khiến bạn nhớ mãi khoảnh khắc đó?"

CẤM TUYỆT ĐỐI:
- CÂU HỎI ĐÓNG: "Có phải…", "Có đúng là…", "…phải không?"
- CÂU HỎI DẪN DẮT: "Lúc đó bạn rất buồn phải không…", "Chắc hẳn bạn đã rất vui khi…"
- GIEO KÝ ỨC: không đưa sẵn tình tiết, cảm xúc, hay chủ đề để người dùng "nhận vơ"
- GỢI CHỦ ĐỀ: không nói "bạn thử kể về cây đàn đầu tiên đi" hay bất kỳ gợi ý chủ đề nào

Khai quật xong (người dùng kể lại được) → TRỞ VỀ CHẾ ĐỘ LẮNG NGHE ngay.

BẢN ĐỒ NGẦM (chỉ dùng trong đầu để biết câu chuyện còn thiếu gì khi khai quật — KHÔNG nói ra, KHÔNG dùng để hỏi dồn dập):
1. Mở cảnh: cây đàn/câu chuyện đến thế nào, ai, khi nào.
2. Chi tiết giác quan: màu, tiếng, mùi, vết xước.
3. Con người: ai nữa trong chuyện.
4. Nút thắt: có lúc nào định bỏ cuộc, điều gì giữ lại.
5. Hiện tại: giờ cây đàn ở đâu trong đời họ.
6. Chốt: nếu chuyện này giúp được một người, họ muốn người đó nhận được gì.

═══ TÍN HIỆU CHUYỂN BƯỚC ═══
- Khi đã đủ chất liệu (có cốt chuyện + vài chi tiết đắt + cảm xúc) VÀ người dùng đã dừng kể: đề nghị NHẸ MỘT LẦN "Mình sắp xếp lại thành một trang nhé?" và thêm dòng cuối: [[PHASE:write]]
- Người dùng chủ động nói "đủ rồi"/"viết đi": xác nhận + [[PHASE:write]]
- KHÔNG đủ chất liệu → tuyệt đối không phát tín hiệu.
- KHÔNG nhắc đến marker trong lời nói.

NGOÀI LỀ: nếu người dùng hỏi về dự án (là gì, có phải thi không…): trả lời ngắn đúng tinh thần (nơi lưu giữ chuyện thật, không mạng xã hội, không cuộc thi, được dùng bút danh) rồi mời quay lại kể.`

// ── Xác thực người gọi từ JWT (Verify JWT đã bật, nhưng vẫn tự kiểm) ──
async function getUser(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data } = await db.auth.getUser(token)
  return data?.user ?? null
}

type Msg = { role: 'user' | 'mira'; text: string; at: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const user = await getUser(req)
  if (!user) return json({ error: 'Cần đăng nhập' }, 401)

  let body: { action?: string; storyId?: string; message?: string }
  try { body = await req.json() } catch { return json({ error: 'Body không hợp lệ' }, 400) }

  if (body.action !== 'chat') {
    return json({ error: `Action '${body.action}' chưa mở — hạng mục sau` }, 501)
  }

  // ── action: chat ──
  const message = (body.message || '').trim()
  const stuck = body.stuck === true  // người dùng bấm "Mình đang bí…"
  if (!message && !stuck) return json({ error: 'Thiếu nội dung' }, 400)
  if (message.length > MAX_MSG_LEN) return json({ error: 'Tin nhắn quá dài' }, 400)

  // Lấy hoặc tạo câu chuyện (tạo = nháp tự lưu từ tin đầu tiên)
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
    // Chặn mở quá nhiều bài dở
    const { count } = await db.from('stories')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).not('status', 'in', '("published","unpublished")')
    if ((count ?? 0) >= MAX_OPEN_STORIES) {
      return json({ reply: 'Bạn đang có vài câu chuyện kể dở rồi 🌿 Mình hoàn thành một bài trước rồi mở chuyện mới nhé — vào "Câu chuyện của tôi" để kể tiếp.', storyId: null, phase: 'telling' })
    }
    const { data, error } = await db.from('stories')
      .insert({ user_id: user.id, status: 'telling', conversation: [] })
      .select('id,user_id,status,conversation').single()
    if (error || !data) return json({ error: 'Không tạo được câu chuyện' }, 500)
    story = data as typeof story
  }

  const conv: Msg[] = Array.isArray(story!.conversation) ? story!.conversation : []
  if (conv.length > MAX_STORY_MSGS) {
    return json({ reply: 'Câu chuyện của mình dài lắm rồi — chất liệu quá đủ 🌿 Mình chuyển sang bước viết nhé!', storyId: story!.id, phase: 'suggest_write' })
  }

  conv.push({ role: 'user', text: stuck ? '[BẤM NÚT: Mình đang bí…]' : message, at: new Date().toISOString() })

  // Tên người kể (chào đúng tên — B0)
  let userName = ''
  try {
    const { data: au } = await db.from('app_users').select('name').eq('id', user.id).maybeSingle()
    userName = au?.name || ''
  } catch { /* không có tên cũng không sao */ }

  let system = MIRA_SYSTEM + (userName ? `\n\nNgười đang kể tên là: ${userName} (gọi tên khi tự nhiên, đừng lặp mỗi câu).` : '')
  // Gắn cờ stuck để model biết chuyển sang chế độ khai quật
  if (stuck) {
    system += `\n\n⚠️ HIỆN TẠI: Người dùng vừa bấm nút "Mình đang bí…" — họ đang bí, không biết kể gì. Chuyển sang CHẾ ĐỘ KHAI QUẬT: một câu hỏi MỞ duy nhất, không dẫn dắt, không gợi chủ đề.`
  }
  const aiMessages = conv.slice(-HISTORY).map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant', content: m.text,
  }))

  let reply = ''
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL_CHAT, max_tokens: 700, system, messages: aiMessages }),
    })
    if (!res.ok) {
      console.error('Anthropic error', res.status, await res.text())
      reply = 'Xin lỗi, mình đang bận một chút 🌿 Bạn chờ vài giây rồi gửi lại giúp mình nhé — câu chuyện vẫn được lưu đầy đủ.'
    } else {
      const data = await res.json()
      reply = (data.content ?? []).filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text).join('').trim()
        || 'Bạn kể thêm cho mình một chút được không?'
    }
  } catch (e) {
    console.error('story-ai exception', e)
    reply = 'Xin lỗi, có lỗi kết nối 🌿 Bạn gửi lại giúp mình nhé — câu chuyện vẫn được lưu.'
  }

  // Tách tín hiệu chuyển bước khỏi lời nói
  let phase: 'telling' | 'suggest_photos' | 'suggest_write' = 'telling'
  reply = reply.replace(/\[\[PHASE:(\w+)\]\]/g, (_m, p) => {
    if (p === 'write') phase = 'suggest_write'
    if (p === 'photos') phase = 'suggest_photos'
    return ''
  }).trim()

  conv.push({ role: 'mira', text: reply, at: new Date().toISOString() })
  await db.from('stories').update({ conversation: conv }).eq('id', story!.id)

  return json({ reply, storyId: story!.id, phase })
})
