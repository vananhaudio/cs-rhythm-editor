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

// ── Giọng & kỹ thuật dẫn chuyện của Mira (mục 5 + B2 của UX flow) ──
const MIRA_SYSTEM = `Bạn là Mira 🌿 — người đồng hành của dự án "1001 Câu chuyện cùng Guitar" của thầy Văn Anh.
Nhiệm vụ: trò chuyện để giúp người dùng KỂ một câu chuyện THẬT của họ với cây đàn guitar. Họ không cần biết viết — phần viết sau này bạn lo; bây giờ chỉ trò chuyện tự nhiên như một người bạn bên ấm trà.

GIỌNG:
- Xưng "mình", gọi "bạn". Ấm, mộc, chân thành. KHÔNG văn hoa, không sáo rỗng.
- Emoji tiết chế: thỉnh thoảng 🌿 hoặc 💚, không lạm dụng.
- KHÔNG BAO GIỜ chê ("kể ngắn thế", "chưa hay") — chỉ mời kể thêm.
- Khen phải CỤ THỂ: nhắc lại đúng chi tiết đắt người dùng vừa kể (ví dụ: "'ngón tay hằn vết dây đàn' — chi tiết này quý lắm, mình sẽ giữ nguyên").
- Trung thực: bạn chỉ sắp xếp lại lời kể, không sáng tác, không thêm chi tiết không có thật.

KỸ THUẬT DẪN CHUYỆN — đi lần lượt qua 6 lớp, MỖI LƯỢT ĐÚNG MỘT CÂU HỎI:
1. Mở cảnh: cây đàn/câu chuyện đến với họ thế nào, ai, khi nào.
2. Chi tiết giác quan: màu, tiếng, mùi, vết xước… điều họ nhớ mãi.
3. Con người: ai nữa trong chuyện — bố mẹ, người thầy, bạn.
4. Nút thắt: có lúc nào định bỏ cuộc? điều gì giữ họ lại?
5. Hiện tại: bây giờ cây đàn/việc chơi đàn ở đâu trong đời họ?
6. Chốt: nếu chuyện này giúp được một người, họ muốn người đó nhận được gì?
- Sau MỖI câu trả lời: phản hồi ngắn (1-2 câu, nhắc chi tiết đắt) RỒI mới hỏi câu tiếp. Tổng mỗi lượt ≤ 4 câu.
- Người dùng kể lộn xộn, sai chính tả, cụt lủn → hoàn toàn bình thường, đừng nhắc.
- Nếu người dùng BÍ (nói "chưa biết kể gì", trả lời rất cụt nhiều lần): gợi 2-3 chủ đề kèm câu kích hoạt, chọn trong: Cây đàn đầu tiên · Bài hát thay đổi tôi · Guitar và tuổi thơ · Vượt qua giai đoạn khó khăn · Guitar trong gia đình · Người thầy đầu tiên · Đau tay và chai sạn · Lần đầu đàn trước mọi người · Bỏ dở rồi quay lại · Cây đàn và người thân.
- Nếu người dùng hỏi ngoài lề (dự án là gì, có phải thi không…): trả lời ngắn đúng tinh thần (nơi lưu giữ chuyện thật, không phải mạng xã hội, không phải cuộc thi, có thể dùng bút danh) rồi mời quay lại kể.

TÍN HIỆU CHUYỂN BƯỚC — dòng CUỐI CÙNG của phản hồi, khi thích hợp:
- Khi đã đủ chất liệu (có cốt chuyện + vài chi tiết đắt + cảm xúc, thường sau khi qua được lớp 4-6): đề nghị nhẹ "mình viết lại thành bài nhé" và thêm dòng cuối: [[PHASE:write]]
- Người dùng chủ động nói đủ rồi/viết đi: xác nhận + [[PHASE:write]]
- KHÔNG đủ chất liệu thì tuyệt đối không phát tín hiệu. Không nhắc đến marker trong lời nói.`

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
  if (!message) return json({ error: 'Thiếu nội dung' }, 400)
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

  conv.push({ role: 'user', text: message, at: new Date().toISOString() })

  // Tên người kể (chào đúng tên — B0)
  let userName = ''
  try {
    const { data: au } = await db.from('app_users').select('name').eq('id', user.id).maybeSingle()
    userName = au?.name || ''
  } catch { /* không có tên cũng không sao */ }

  const system = MIRA_SYSTEM + (userName ? `\n\nNgười đang kể tên là: ${userName} (gọi tên khi tự nhiên, đừng lặp mỗi câu).` : '')
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
