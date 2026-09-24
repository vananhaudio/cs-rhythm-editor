import { parseMusicXML } from '../musicxml-beats/parser.ts'
import { readScoreMetadata } from '../nhipphach/scoreMetadata.ts'

const TABLE = 'musicxml_library'
export const MAX_MUSICXML_BYTES = 5 * 1024 * 1024

export type LibraryItem = {
  id: string
  title: string
  composer: string | null
  created_at: string
}

export function prepareMusicXml(filename: string, xml: string) {
  if (!/\.(xml|musicxml)$/i.test(filename)) throw new Error('Chọn file .musicxml hoặc .xml.')
  const sizeBytes = new TextEncoder().encode(xml).byteLength
  if (sizeBytes < 1 || sizeBytes > MAX_MUSICXML_BYTES) throw new Error('File phải có dung lượng từ 1 byte đến 5 MB.')
  let score: ReturnType<typeof parseMusicXML>
  try { score = parseMusicXML(xml) }
  catch { throw new Error('File không phải MusicXML hợp lệ.') }
  if (!score.parts.length || !score.parts[0].measures.length) throw new Error('Bản nhạc không có ô nhịp.')
  return { xml, filename, sizeBytes, metadata: readScoreMetadata(xml, filename) }
}

async function sha256(xml: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(xml))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function listLibrary(): Promise<LibraryItem[]> {
  const { supabase } = await import('../supabase.ts')
  const { data, error } = await supabase.from(TABLE)
    .select('id,title,composer,created_at').order('created_at', { ascending: false }).limit(1000)
  if (error) throw error
  return data ?? []
}

export async function importMusicXml(input: ReturnType<typeof prepareMusicXml>, title: string, composer: string): Promise<LibraryItem> {
  const cleanTitle = title.trim()
  if (!cleanTitle) throw new Error('Vui lòng nhập Tên bài.')
  const { supabase } = await import('../supabase.ts')
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('Vui lòng đăng nhập lại.')
  const contentHash = await sha256(input.xml)
  const { data: existing, error: lookupError } = await supabase.from(TABLE)
    .select('id,title').eq('content_hash', contentHash).limit(1)
  if (lookupError) throw lookupError
  if (existing?.length) throw new Error(`Bản nhạc này đã có trong thư viện: ${existing[0].title}.`)
  const { data, error } = await supabase.from(TABLE).insert({
    title: cleanTitle,
    composer: composer.trim() || null,
    original_filename: input.filename,
    musicxml_text: input.xml,
    content_hash: contentHash,
    size_bytes: input.sizeBytes,
    created_by: auth.user.id,
  }).select('id,title,composer,created_at').single()
  if (error) throw error
  return data
}
