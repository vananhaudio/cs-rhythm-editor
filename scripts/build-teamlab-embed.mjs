// Đóng gói TeamLab (chế độ nhúng) vào dist/teamlab của BẢN NATIVE — chạy sau `vite build --mode native`.
// Nguồn: TEAMLAB_DIR (bản checkout sẵn) hoặc tự clone repo vào .cache/teamlab-embed ở đúng commit trong ios-embed/teamlab.ref.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const REPO = process.env.TEAMLAB_REPO || 'https://github.com/vananhaudio/teamlab-bolt-production.git'
const ref = readFileSync(join(ROOT, 'ios-embed/teamlab.ref'), 'utf8').trim()
if (!/^[0-9a-f]{40}$/.test(ref)) throw new Error('ios-embed/teamlab.ref phải là commit đầy đủ 40 ký tự')
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' })
const out = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8' }).trim()

let dir = process.env.TEAMLAB_DIR ? resolve(process.env.TEAMLAB_DIR) : join(ROOT, '.cache/teamlab-embed')
if (!process.env.TEAMLAB_DIR) {
  if (!existsSync(join(dir, '.git'))) { mkdirSync(dir, { recursive: true }); run('git', ['clone', '--quiet', REPO, dir]) }
  run('git', ['fetch', '--quiet', 'origin'], dir)
  run('git', ['checkout', '--quiet', '--detach', ref], dir)
}
const head = out('git', ['rev-parse', 'HEAD'], dir)
if (head !== ref) throw new Error(`TeamLab ở ${head.slice(0, 7)} nhưng ios-embed/teamlab.ref cần ${ref.slice(0, 7)} — checkout đúng commit hoặc cập nhật ref`)
if (out('git', ['status', '--porcelain', '--untracked-files=no'], dir)) throw new Error('TeamLab có thay đổi chưa commit — không đóng gói bản chưa ghi nhận')

if (!existsSync(join(dir, 'node_modules'))) run('npm', ['ci', '--no-audit', '--no-fund'], dir)
run('npm', ['run', 'build'], dir)

const built = join(dir, 'dist/teamlab')
const dest = join(ROOT, 'dist/teamlab')
if (!existsSync(join(built, 'index.html'))) throw new Error('TeamLab build không có index.html')
rmSync(dest, { recursive: true, force: true })
cpSync(built, dest, { recursive: true, filter: src => !/Ảnh_màn_hình/.test(src) })   // bỏ ảnh chụp màn hình lạc trong public/
// Chốt chặn: bản đóng gói phải CÓ chế độ nhúng; thiếu → app sẽ nạp TeamLab mà không báo ready/exit.
const js = readdirSync(join(dest, 'assets')).filter(f => f.endsWith('.js')).map(f => readFileSync(join(dest, 'assets', f), 'utf8')).join('\n')
if (!js.includes('teamlab-embed') || !js.includes('classapp')) throw new Error('Bản TeamLab đóng gói không có chế độ nhúng (classapp)')
console.log(`TeamLab ${ref.slice(0, 7)} → dist/teamlab (${readdirSync(dest).length} mục)`)
