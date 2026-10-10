// Kho MusicXML THẾ THÂN cho trang thử ?db=local — CHỈ dev server, CHỈ trong trình duyệt.
// Lý do: trang thử bỏ qua cổng đăng nhập nên không có phiên; bảng musicxml_library thật (production) từ chối khách (401) và DB tạm
// của Thư viện hợp âm không có kho này. Không có thế thân thì mục MusicXML không thể thử luồng Xem / Nạp mà không chạm production.
// Cách làm: chặn ĐÚNG các lời gọi PostgREST tới `/rest/v1/musicxml_library` (chạy qua chính supabase-js + chính masterLibrary.ts/
// masterCopy.ts của app — không viết lại luồng), trả về từ bộ nhớ; thêm một người dùng thử cho `auth.getUser/getSession`.
// Mọi thứ khác (Auth, các bảng khác) vẫn đi đường thật. Dữ liệu mất khi tải lại trang.
import { supabase } from '../../../src/supabase.ts'
import lyrics from '../../musicxml-renderer/fixtures/lyrics-harmony.musicxml?raw'
import syncopation from '../../musicxml-renderer/fixtures/syncopation.musicxml?raw'
import wholeNote from '../../musicxml-renderer/fixtures/whole-note.musicxml?raw'

type Row = { id: string; title: string; composer: string | null; original_filename: string; musicxml_text: string; content_hash: string; size_bytes: number; created_by: string | null; created_at: string; updated_at: string }

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
const bytes = (text: string) => new TextEncoder().encode(text).byteLength
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export const LOCAL_TEST_USER = { id: '00000000-0000-4000-8000-0000000000aa', email: 'thu-nghiem-local@vananhaudio.test' }

export async function installMusicXmlStandIn() {
  const samples: [string, string, string][] = [
    ['Mẫu thử — lời + hợp âm', 'lyrics-harmony.musicxml', lyrics],
    ['Mẫu thử — nhịp lệch phách', 'syncopation.musicxml', syncopation],
    ['Mẫu thử — nốt tròn', 'whole-note.musicxml', wholeNote],
  ]
  const rows: Row[] = []
  for (const [at, [title, file, xml]] of samples.entries()) {
    const now = new Date(Date.now() - at * 86_400_000).toISOString()
    rows.push({ id: crypto.randomUUID(), title, composer: 'Dữ liệu thử cục bộ', original_filename: file, musicxml_text: xml,
      content_hash: await sha256(xml), size_bytes: bytes(xml), created_by: LOCAL_TEST_USER.id, created_at: now, updated_at: now })
  }

  // Người dùng thử cho các lệnh đọc phiên (importMusicXml gọi auth.getUser; Header gọi auth.getSession).
  const auth = supabase.auth as unknown as Record<string, unknown>
  auth.getUser = async () => ({ data: { user: LOCAL_TEST_USER }, error: null })
  auth.getSession = async () => ({ data: { session: { user: LOCAL_TEST_USER, access_token: 'local-test' } }, error: null })

  const real = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href)
    if (!url.pathname.endsWith('/rest/v1/musicxml_library')) return real(input, init)
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase()
    const headers = new Headers(init?.headers ?? request?.headers)
    const wantsObject = (headers.get('accept') ?? '').includes('vnd.pgrst.object')
    const columns = (url.searchParams.get('select') ?? '*').split(',').map(part => part.trim())
    const project = (row: Row) => (columns.includes('*') ? row : Object.fromEntries(columns.map(column => [column, (row as unknown as Record<string, unknown>)[column]])))
    const filters = [...url.searchParams.entries()].filter(([, value]) => value.startsWith('eq.'))
      .map(([key, value]) => [key, value.slice(3)] as const)
    const matches = (row: Row) => filters.every(([key, value]) => String((row as unknown as Record<string, unknown>)[key]) === value)
    const reply = (found: Row[], status = 200) => {
      if (wantsObject) return found.length === 1 ? json(status, project(found[0])) : json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${found.length} rows` })
      return json(status, found.map(project))
    }

    if (method === 'GET') {
      const found = rows.filter(matches).sort((a, b) => b.created_at.localeCompare(a.created_at))
      const limit = Number(url.searchParams.get('limit'))
      return reply(limit > 0 ? found.slice(0, limit) : found)
    }
    const raw = init?.body ?? (request ? await request.clone().text() : '')
    const body = typeof raw === 'string' && raw ? JSON.parse(raw) : {}
    if (method === 'POST') {
      const now = new Date().toISOString()
      const row: Row = { id: crypto.randomUUID(), composer: null, original_filename: '', musicxml_text: '', content_hash: '', size_bytes: 0, created_by: null, created_at: now, updated_at: now, ...body }
      rows.push(row)
      return reply([row], 201)
    }
    if (method === 'PATCH') {
      const found = rows.filter(matches)
      for (const row of found) Object.assign(row, body)
      return reply(found)
    }
    return json(405, { message: `Thế thân không hỗ trợ ${method}` })
  }
  return rows
}
