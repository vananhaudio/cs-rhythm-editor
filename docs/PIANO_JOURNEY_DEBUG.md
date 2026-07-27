# Piano Journey — Báo cáo kỹ thuật tích hợp OpenAI Realtime API (WebRTC)

## Mục tiêu
Tích hợp hội thoại giọng nói hai chiều vào Piano Journey (React app) dùng OpenAI Realtime API qua WebRTC.

## Kiến trúc

```
Browser (React)                    Supabase Edge Function              OpenAI
─────────────                      ─────────────────────               ──────
RTCPeerConnection ──SDP offer──►  realtime-token (Deno)  ──FormData─►  POST /v1/realtime/calls
                   ◄──SDP answer─  (proxy)               ◄──SDP───────
                        │
                   audio track (mic) ──────────────────────────────►  AI xử lý
                   ◄───────────────────────────────────────────────  audio track (speaker)
                   data channel "oai-events" ◄═══════════════════►  events (VAD, transcript...)
```

## Code hiện tại

### 1. Edge Function (`supabase/functions/realtime-token/index.ts`)
```typescript
// Deploy trên Supabase, Verify JWT = ON
// Nhận JSON { sdp: "..." } từ frontend
// Forward đến OpenAI /v1/realtime/calls
// Trả về JSON { sdp: "..." }

const OPENAI_API_KEY = 'sk-...'  // ← ĐÃ THAY KEY THẬT

const fd = new FormData()
fd.set('sdp', sdpOffer)
fd.set('session', JSON.stringify({
  model: 'gpt-4o-realtime-preview',
  voice: 'ash',
  instructions: 'You are Co Piano...',
  input_audio_transcription: { model: 'whisper-1' },
  turn_detection: { type: 'server_vad' },
}))

const res = await fetch('https://api.openai.com/v1/realtime/calls', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
  body: fd,
})
```

### 2. Frontend (`src/PianoJourney.tsx`)
```typescript
// 1. Auth qua Supabase
const { data: { session } } = await supabase.auth.getSession()

// 2. Tạo RTCPeerConnection
const pc = new RTCPeerConnection()
pc.ontrack = (e) => { audio.srcObject = e.streams[0] }  // AI → loa

// 3. Micro
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
pc.addTrack(stream.getAudioTracks()[0], stream)

// 4. Data channel
const dc = pc.createDataChannel('oai-events')
dc.onmessage = (e) => { /* xử lý sự kiện VAD, transcript... */ }

// 5. SDP
const offer = await pc.createOffer()
await pc.setLocalDescription(offer)

// 6. Gửi SDP qua Edge Function
const sdpRes = await fetch(`${SUPABASE_URL}/functions/v1/realtime-token`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ sdp: offer.sdp }),
})

// 7. Nhận answer
const { sdp: answerSdp } = await sdpRes.json()
await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
```

## Lịch sử lỗi và fix

| Lần | Lỗi | Nguyên nhân | Fix |
|-----|-----|-------------|-----|
| 1 | `OpenAI 404` | Model `gpt-realtime-2.1` không khả dụng | Đổi sang `gpt-4o-realtime-preview` |
| 2 | `ByteString error` | Browser từ chối header `Content-Type: application/sdp` | Chuyển sang gửi JSON `{ sdp: "..." }` |
| 3 | `OpenAI 401` | API key sai hoặc không có quyền | Đã thay key mới |
| 4 | **HIỆN TẠI** | Sau khi thay key vẫn lỗi | ??? |

## Các giả thuyết cần kiểm tra

### A. API key không có quyền Realtime API
- Realtime API yêu cầu **billing tier khác** so với Chat API
- Cần kiểm tra: vào https://platform.openai.com/account/limits
- Tìm mục "gpt-4o-realtime-preview" — nếu không có, key chưa được cấp quyền

### B. Endpoint `/v1/realtime/calls` không đúng
- Docs mới nhất dùng unified interface
- Tham khảo: https://platform.openai.com/docs/guides/realtime-webrtc
- Có thể endpoint đúng là khác (vd: cần thêm header `OpenAI-Beta: realtime=v1`)

### C. Model name không đúng
- Thử các model: `gpt-4o-realtime-preview`, `gpt-4o-mini-realtime-preview`, `gpt-4o-realtime-preview-2024-12-17`

### D. Edge function chưa được deploy lại
- Sau mỗi lần sửa code edge function, phải bấm "Deploy" lại trên Supabase Dashboard
- Nếu dùng code cũ (với endpoint `/v1/realtime/sessions`) → 404

### E. CORS hoặc Supabase function config
- "Verify JWT = ON" yêu cầu user đã đăng nhập → OK (log cho thấy đã login)
- Cần `apikey` header khi gọi Supabase function?

## Cách debug nhanh

1. **Test Edge Function riêng** (không qua frontend):
   ```bash
   curl -X POST "https://wojmdilyflffvdtpovmq.supabase.co/functions/v1/realtime-token" \
     -H "Authorization: Bearer <SUPABASE_ACCESS_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"sdp":"v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n"}'
   ```
   → Xem response là 200 (OK, trả về SDP) hay lỗi gì

2. **Kiểm tra API key trực tiếp với OpenAI**:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer sk-..."
   ```
   → Xem có model `gpt-4o-realtime-preview` trong danh sách không

3. **Xem log Edge Function** trên Supabase Dashboard → Edge Functions → realtime-token → Logs

## URL tham khảo
- OpenAI Realtime WebRTC docs: https://platform.openai.com/docs/guides/realtime-webrtc
- API Reference: https://platform.openai.com/docs/api-reference/realtime
- Supabase project: wojmdilyflffvdtpovmq.supabase.co
- Frontend: timming.vananhaudio.com/piano-journey
