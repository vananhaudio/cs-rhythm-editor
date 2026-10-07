// Đóng gói worker production thành MỘT thư mục release: server.mjs (worker + tokenizer TS của app, bundle bằng esbuild)
// + measure_analyzer.py + RELEASE.json. Không bundle gì của browser/UI. Ra: build/measure-analyzer/<version>-<commit>/
import { execFileSync } from 'node:child_process'
import { copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { build } from 'esbuild'

const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim()
const dirty = execFileSync('git', ['status', '--porcelain']).toString().trim() !== ''
const version = '0.2.0'
const out = `build/measure-analyzer/${version}-${commit}${dirty ? '-dirty' : ''}`
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
await build({ entryPoints: ['services/measure-analyzer/server.ts'], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: `${out}/server.mjs`, legalComments: 'none', logLevel: 'warning' })
copyFileSync('tools/measure-analyzer/measure_analyzer.py', `${out}/measure_analyzer.py`)
copyFileSync('tools/measure-analyzer/staff_window.py', `${out}/staff_window.py`)
copyFileSync('tools/measure-analyzer/broken_bar.py', `${out}/broken_bar.py`)
copyFileSync('tools/measure-analyzer/ocr_align.py', `${out}/ocr_align.py`)   // ghép OCR ↔ lời chuẩn (analyzer import cạnh nó)
// Gói engine extraction (Python thuần, không __pycache__) — worker chạy nó bằng MA_EXTRACT_DIR=<release>/chord-extract
cpSync('tools/chord-extract/chord_extract', `${out}/chord-extract/chord_extract`, { recursive: true, filter: src => !src.includes('__pycache__') })
writeFileSync(`${out}/RELEASE.json`, JSON.stringify({ name: 'measure-analyzer', version, commit, dirty, builtAt: new Date().toISOString() }, null, 2) + '\n')
console.log(out)
