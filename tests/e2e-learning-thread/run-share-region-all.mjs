// Contextual Share V3 (dự thảo): (1) migration + test DB → (2) kịch bản trình duyệt khoanh vùng (Chrome, rồi WebKit nếu có). E2E_REGION_ONLY=1 mặc định (V1.3/V2 đã có runner riêng).
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
const here = new URL('.', import.meta.url).pathname
const all = (process.env.E2E_REGION_DB_ONLY ? ['run-share-region-db.mjs'] : process.env.E2E_REGION_CHROME_ONLY ? ['run-share-region-db.mjs', 'run-share-region.mjs'] : ['run-share-region-db.mjs', 'run-share-region.mjs', 'run-share-region-webkit.mjs']).filter(f => existsSync(here + f))
for (const f of all) {
  const env = f === all.at(-1) ? process.env : { ...process.env, E2E_HOLD: '' }
  const r = spawnSync(process.execPath, [here + f], { stdio: 'inherit', env })
  if (r.status !== 0) { console.log('FAIL: ' + f); process.exit(r.status ?? 1) }
}
