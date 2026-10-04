// Kho file nguồn của trang thử ?db=local — gọi cầu cục bộ (tests/thuvien-db/local-bridge.ts), nơi mô phỏng Storage API
// trên Postgres tạm có policy + trigger N1 thật. CHỈ dùng ở dev server.
import type { ChordSourceStore } from '../../../src/thuvien/chordSources.ts'

export function createBridgeSourceStore(base: string, as: string): ChordSourceStore {
  const post = async (path: string, body: BodyInit, headers: Record<string, string> = { 'content-type': 'application/json' }) => {
    const reply = await fetch(`${base}${path}`, { method: 'POST', headers: { 'x-chord-as': as, ...headers }, body })
    const data = await reply.json().catch(() => ({})) as Record<string, string>
    if (!reply.ok) throw new Error(data.error || `Cầu DB tạm trả ${reply.status}`)
    return data
  }
  return {
    async ownerId() { return (await post('/whoami', '{}')).id },
    async upload(path, file, mime) { await post('/storage/upload', file, { 'x-chord-path': path, 'x-chord-mime': mime, 'content-type': 'application/octet-stream' }) },
    async remove(path) { await post('/storage/remove', JSON.stringify({ path })) },
    async copy(from, to) { await post('/storage/copy', JSON.stringify({ from, to })) },
    async viewUrl(path) { return (await post('/storage/sign', JSON.stringify({ path }))).url },
  }
}
