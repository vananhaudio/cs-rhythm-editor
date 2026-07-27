// Edge Function: realtime-token
// Nhận SDP từ browser → forward đến OpenAI /v1/realtime/calls → trả về answer SDP.
// DEPLOY: Supabase Dashboard -> Edge Functions -> Create -> paste code
//         -> "Verify JWT" = ON -> Deploy.
//         Sửa dòng OPENAI_API_KEY bên dưới.

const OPENAI_API_KEY = 'THAY_B…THAY'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SESSION_CONFIG = JSON.stringify({
  type: 'realtime',
  model: 'gpt-realtime-2.1',
  audio: { output: { voice: 'ash' } },
  instructions: `You are Co Piano, a friendly piano teacher for children aged 5-12. Speak in Vietnamese. Short, warm, encouraging. Never lecture. Max 2 sentences.`,
  input_audio_transcription: { model: 'whisper-1' },
  turn_detection: { type: 'server_vad' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const sdpOffer = await req.text()
    if (!sdpOffer || !sdpOffer.includes('v=0')) {
      return new Response(JSON.stringify({ error: 'Missing valid SDP' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const fd = new FormData()
    fd.set('sdp', sdpOffer)
    fd.set('session', SESSION_CONFIG)

    const res = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: fd,
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('OpenAI error', res.status, err)
      return new Response(JSON.stringify({ error: `OpenAI ${res.status}: ${err.slice(0, 100)}` }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const answerSdp = await res.text()
    return new Response(answerSdp, { headers: { ...cors, 'Content-Type': 'application/sdp' } })
  } catch (e: any) {
    console.error('realtime-token error', e)
    return new Response(JSON.stringify({ error: e?.message || 'Internal error' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
