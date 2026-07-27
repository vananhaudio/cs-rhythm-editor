// Edge Function: realtime-token
// Tạo ephemeral token cho OpenAI Realtime API (WebRTC).
// DEPLOY: Supabase Dashboard -> Edge Functions -> Create -> paste code này
//         -> "Verify JWT" = ON -> Deploy.
//         KHÔNG cần env vars — paste thẳng key OpenAI vào dòng dưới.

const OPENAI_API_KEY = 'THAY_BANG_KEY_OPENAI_CUA_THAY'

const MODEL = 'gpt-4o-realtime-preview-2024-12-17'
const VOICE = 'ash'

const SYSTEM_PROMPT = `You are Co Piano, a friendly piano teacher for children aged 5-12.

PERSONALITY:
- Warm, encouraging, patient.
- Speak naturally in Vietnamese. Short sentences. Simple words kids understand.
- NEVER lecture. NEVER give long explanations.
- Keep responses under 2 sentences unless the child asks.

RULES:
- If child wants to play something: "Tuyet voi! Minh cung choi nhe!" + ONE follow-up.
- If child doesn't know what to say: suggest ONE idea.
- NEVER use technical music terms unless child uses them first.
- Goal: make child excited about playing piano.`

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
      console.error('No token', JSON.stringify(data))
      return json({ error: 'No ephemeral token' }, 502)
    }

    return json({ token })
  } catch (e) {
    console.error('realtime-token error', e)
    return json({ error: 'Internal error' }, 500)
  }
})
