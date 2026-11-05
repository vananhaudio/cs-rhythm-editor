// Contextual Share V2: (1) migration + test DB → (2) HỒI QUY toàn bộ kịch bản V1.3 (Chrome + WebKit) trên DB ĐÃ migrate → (3) kịch bản V2 văn bản (Chrome + WebKit).
// E2E_TEXT_ONLY=1: bỏ bước (2) (lặp nhanh khi phát triển).
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
const here = new URL('.', import.meta.url).pathname
const v1 = process.env.E2E_TEXT_ONLY ? [] : ['run-share-note-feed.mjs', 'run-share-note-feed-webkit.mjs', 'run-share-note.mjs', 'run-share-note-webkit.mjs']
const v2 = ['run-share-text.mjs', 'run-share-text-webkit.mjs'].filter(f => existsSync(here + f))
for (const f of ['run-share-text-db.mjs', ...v1, ...v2]) {
  const r = spawnSync(process.execPath, [here + f], { stdio: 'inherit', env: process.env })
  if (r.status !== 0) { console.log('FAIL: ' + f); process.exit(r.status ?? 1) }
}
