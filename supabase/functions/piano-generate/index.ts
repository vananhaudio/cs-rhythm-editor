// Edge Function: piano-generate
// Nhận { prompt } → gọi Claude → trả về bài tập piano dạng JSON { title, bpm, notes }
//
// Dùng ANTHROPIC_API_KEY (secret đã có sẵn trên project, giống story-ai/admin-ai)
// nên KHÔNG cần ai dán key thủ công, và deploy lại bao nhiêu lần cũng không hỏng.
// Bản trước để `const API_KEY = '***'` và CHƯA TỪNG ĐƯỢC DEPLOY — mọi lời gọi đều
// 404 nên app im lặng lùi về bài mẫu cố định ⇒ "nói gì cũng ra một bài giống nhau".
//
// LUẬT KHÔNG NẰM Ở ĐÂY. Ràng buộc từng bậc do client gửi trong `prompt`
// (src/piano/rules.ts) rồi được lớp kiểm ở client soi lại. Function này cố ý
// trung lập để sửa luật không phải deploy lại.
//
// DEPLOY: npx supabase functions deploy piano-generate

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const MODEL = 'claude-haiku-4-5-20251001'   // việc nhẹ, cần nhanh vì bé đang chờ

const SYSTEM = `Bạn soạn bài tập piano ngắn cho trẻ 5–12 tuổi Việt Nam.

CHỈ trả về JSON hợp lệ, không giải thích, không markdown, không rào đầu:
{"title":"Tên bài tiếng Việt","bpm":80,"notes":[{"pitch":"C4","startBeat":0,"duration":1}]}

- pitch: tên nốt Anh + quãng tám, ví dụ C4, D4, E4.
- duration: 1 = nốt đen, 2 = trắng, 4 = tròn.
- startBeat: vị trí phách, bắt đầu từ 0, cộng dồn theo duration của nốt trước.
- title: tiếng Việt, gợi đúng điều bé xin, ngắn và vui.

Người dùng sẽ đưa RÀNG BUỘC BẮT BUỘC. Tuân thủ TUYỆT ĐỐI mọi ràng buộc đó —
nếu phải chọn giữa "giai điệu hay" và "đúng ràng buộc", luôn chọn đúng ràng buộc.
Mỗi lần hãy soạn một giai điệu KHÁC nhau, đừng lặp lại bài cũ.`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!ANTHROPIC_API_KEY) return json({ error: 'Thiếu secret ANTHROPIC_API_KEY' }, 500)

  try {
    const { prompt } = await req.json()
    if (!prompt || typeof prompt !== 'string') return json({ error: 'Missing prompt' }, 400)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        temperature: 1,            // để mỗi lần ra một giai điệu khác nhau
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Anthropic error', res.status, err)
      return json({ error: `AI ${res.status}: ${err.slice(0, 200)}` }, 502)
    }

    const data = await res.json()
    const text: string = (data?.content ?? [])
      .filter((b: { type?: string }) => b?.type === 'text')
      .map((b: { text?: string }) => b.text ?? '')
      .join('')

    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return json({ error: 'AI không trả về JSON hợp lệ', raw: text.slice(0, 200) }, 500)

    const parsed = JSON.parse(m[0])
    if (!Array.isArray(parsed?.notes) || !parsed.notes.length) {
      return json({ error: 'Thiếu mảng notes' }, 500)
    }
    return json(parsed)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('piano-generate error', msg)
    return json({ error: msg || 'Internal error' }, 500)
  }
})
