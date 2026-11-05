// Contextual Share V2: (1) migration + test DB → (2) HỒI QUY toàn bộ kịch bản V1.3 (Chrome + WebKit) trên DB ĐÃ migrate → (3) kịch bản V2 văn bản.
import { spawnSync } from 'node:child_process'
const here = new URL('.', import.meta.url).pathname
const only = process.env.E2E_TEXT_ONLY
const steps = ['run-share-text-db.mjs', ...(only ? [] : ['run-share-note-feed.mjs', 'run-share-note-feed-webkit.mjs', 'run-share-note.mjs', 'run-share-note-webkit.mjs']), ...(process.env.E2E_TEXT_SCRIPTS ?? '').split(',').filter(Boolean)]
for (const f of steps) {
  const r = spawnSync(process.execPath, [here + f], { stdio: 'inherit', env: process.env })
  if (r.status !== 0) { console.log('FAIL: ' + f); process.exit(r.status ?? 1) }
}
