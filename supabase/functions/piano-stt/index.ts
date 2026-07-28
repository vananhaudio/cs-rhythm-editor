// Edge Function: piano-stt
// Nhận audio (multipart form, field "audio") → Whisper → trả về { text }
// Đây là TẦNG 2 của mic trong Piano Journey: WKWebView (app iOS/Android) KHÔNG có
// Web Speech API, nên phải thu âm rồi nhờ server nghe. Giữ được server.url ⇒
// deploy web là app tự cập nhật, KHÔNG cần build lại Xcode.
//
// DEPLOY: Supabase -> Edge Functions -> Create "piano-stt" -> paste code này
//         -> Settings -> Secrets: thêm OPENAI_API_KEY  (hoặc sửa fallback bên dưới)
//         -> "Verify JWT" = ON -> Deploy

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '***'
const API_URL = 'https://api.openai.com/v1/audio/transcriptions'
const MODEL   = 'whisper-1'

const MAX_BYTES = 20 * 1024 * 1024   // 20MB — thu tối đa 20s nên dư sức

// Mồi từ vựng cho Whisper: trẻ Việt 5–12 tuổi nói về bài muốn tập.
// Giúp nhận đúng "Đô Rê Mi", "khủng long"… thay vì đoán sai thành từ khác.
const HINT = 'Bé nói về bài hát muốn tập đàn piano: con mèo, con chó, khủng long, ' +
             'cái cây, bông hoa, ông trăng, bài thiếu nhi, Đô Rê Mi Fa Sol La Si, ' +
             'con muốn bài về, tập bài, nhanh hơn, chậm thôi.'

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

  try {
    const form = await req.formData()
    const audio = form.get('audio')
    if (!(audio instanceof File)) return json({ error: 'Missing audio file' }, 400)
    if (audio.size === 0)         return json({ error: 'Empty audio' }, 400)
    if (audio.size > MAX_BYTES)   return json({ error: 'Audio too large' }, 413)

    const fd = new FormData()
    fd.append('file', audio, audio.name || 'speech.webm')
    fd.append('model', MODEL)
    fd.append('language', 'vi')
    fd.append('prompt', HINT)
    fd.append('temperature', '0')

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: fd,
    })

    if (!res.ok) {
      const err = await res.text()
      return json({ error: `STT ${res.status}: ${err.slice(0, 200)}` }, 502)
    }

    const data = await res.json()
    const text = (data?.text || '').trim()

    // Whisper hay "ảo giác" ra câu quen tai khi đầu vào chỉ là tiếng ồn.
    const noise = /^(cảm ơn|xin cảm ơn|hết rồi|\.|,|…)*$/i.test(text)
    return json({ text: noise ? '' : text })
  } catch (e: any) {
    return json({ error: e?.message || 'Internal error' }, 500)
  }
})
