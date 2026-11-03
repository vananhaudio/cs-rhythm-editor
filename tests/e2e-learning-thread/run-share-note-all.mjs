// Chạy E2E Share Note trên Chrome (puppeteer) rồi WebKit (Playwright) cùng một stack local.
import { spawnSync } from 'node:child_process'
const here = new URL('.', import.meta.url).pathname
for (const f of ['run-share-note.mjs', 'run-share-note-webkit.mjs']) {
  const r = spawnSync(process.execPath, [here + f], { stdio: 'inherit', env: process.env })
  if (r.status !== 0) process.exit(r.status ?? 1)
}
