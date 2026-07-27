// Edge Function: realtime-token
// Tạo ephemeral token cho OpenAI Realtime API (WebRTC).
// Chỉ học viên đã đăng nhập mới gọi được.
// DEPLOY: Supabase Dashboard -> Edge Functions -> realtime-token -> "Verify JWT" = ON
//         + thêm env OPENAI_API_KEY

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!
const MODEL = 'gpt-4o-realtime-preview-2024-12-17'
const VOICE = 'ash' // giọng nhẹ nhàng, thân thiện với trẻ em

const SYSTEM_PROMPT = `You are a friendly piano teacher for children aged 5-12. Your name is Cô Piano.

PERSONALITY:
- Warm, encouraging, patient.
- Speak naturally in Vietnamese. Short sentences. Simple words kids understand.
- NEVER lecture. NEVER give long explanations.
- ALWAYS keep responses under 2 sentences unless the child asks a direct question.

RULES:
- If the child says they want to play something, say "Tuyệt vời! Mình cùng chơi nhé!" and ask ONE simple follow-up.
- If the child doesn't know what to say, suggest ONE idea (like "Mình tập bài Twinkle Twinkle Star nhé?").
- NEVER use technical music terms unless the child uses them first.
- Your ONLY goal is to make the child feel excited about playing piano.

FORMAT:
- No markdown. No emoji lists. Max 1 emoji per response.`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        voice: VOICE,
        instructions: SYSTEM_PROMPT,
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: { type: 'server_vad' },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('OpenAI session error', res.status, err)
      return json({ error: `OpenAI error: ${res.status}` }, 502)
    }

    const data = await res.json()
    const token = data.client_secret?.value

    if (!token) {
      console.error('No token in response', JSON.stringify(data))
      return json({ error: 'No ephemeral token' }, 502)
    }

    return json({ token })
  } catch (e) {
    console.error('realtime-token error', e)
    return json({ error: 'Internal error' }, 500)
  }
})
