// Edge Function: piano-generate
// Nhận yêu cầu → gọi AI Chat API → trả về bài tập piano dạng JSON notes
// DEPLOY: Supabase -> Edge Functions -> Create "piano-generate" -> paste code này
//         -> sửa API_KEY bên dưới + "Verify JWT" = ON -> Deploy

const API_KEY = '***'          // OpenAI hoặc DeepSeek key
const API_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL    = 'gpt-4o-mini'

const SYSTEM = `You are a piano exercise generator for children aged 5-12.
Given a request, create a simple piano exercise.
Return ONLY valid JSON, no explanation:

{
  "title": "Bài tập tiếng Việt",
  "bpm": 100,
  "notes": [
    {"pitch": "C4", "startBeat": 0, "duration": 1},
    {"pitch": "D4", "startBeat": 1, "duration": 1}
  ]
}

RULES:
- pitch: C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 only (treble clef, easy for kids)
- duration: 1=quarter, 2=half, 4=whole. Use mostly quarters.
- startBeat: beat position starting from 0, incrementing correctly
- Keep total 6-16 notes, very simple patterns
- Title in Vietnamese, friendly for kids
- All JSON field names in English as shown above`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const { prompt } = await req.json()
    if (!prompt) return json({ error: 'Missing prompt' }, 400)

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return json({ error: `AI ${res.status}: ${err.slice(0, 200)}` }, 502)
    }

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''

    // Parse JSON from response
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return json({ error: 'AI không trả về JSON hợp lệ', raw: text.slice(0, 200) }, 500)

    const parsed = JSON.parse(m[0])
    if (!parsed.notes || !Array.isArray(parsed.notes)) {
      return json({ error: 'Thiếu mảng notes' }, 500)
    }

    return json(parsed)
  } catch (e: any) {
    return json({ error: e?.message || 'Internal error' }, 500)
  }
})
