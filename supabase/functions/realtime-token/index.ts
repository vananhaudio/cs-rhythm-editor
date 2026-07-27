// Edge Function: realtime-token
// Nhận JSON { sdp: "..." } → forward đến OpenAI /v1/realtime/calls → trả về { sdp: "..." }
// DEPLOY: Supabase Dashboard -> Edge Functions -> paste + sửa OPENAI_API_KEY -> Deploy
//         "Verify JWT" = ON

const OPENAI_API_KEY = '***'

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
    const { sdp: sdpOffer } = await req.json()
    if (!sdpOffer || !sdpOffer.includes('v=0')) {
      return json({ error: 'Missing valid SDP offer' }, 400)
    }

    const fd = new FormData()
    fd.set('sdp', sdpOffer)
    fd.set('session', JSON.stringify({
      model: 'gpt-4o-realtime-preview',
      voice: 'ash',
      instructions: 'You are Co Piano, a friendly piano teacher for children aged 5-12. Speak in Vietnamese. Short, warm, encouraging. Never lecture. Max 2 sentences.',
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: { type: 'server_vad' },
    }))

    const res = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: fd,
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('OpenAI error', res.status, err)
      return json({ error: `OpenAI ${res.status}: ${err.slice(0, 150)}` }, 502)
    }

    const answerSdp = await res.text()
    return json({ sdp: answerSdp })
  } catch (e: any) {
    console.error('realtime-token error', e)
    return json({ error: e?.message || 'Internal error' }, 500)
  }
})
