import test from 'node:test'
import assert from 'node:assert/strict'
import { claimAutoReload, clearDraft, DRAFT_TTL_MS, importWithRetry, isChunkLoadError, peekDraft, RELOAD_GUARD_MS, stashDraft } from '../../src/lib/chunkRecovery.ts'

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } }

test('nhận diện lỗi tải chunk của Chrome / Firefox / Safari / Vite, không nuốt lỗi khác', () => {
  assert.ok(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://class.vananhaudio.com/assets/ShareNoteComposer-DsEy1nP8.js')))
  assert.ok(isChunkLoadError(new TypeError('error loading dynamically imported module: https://x/a.js')))
  assert.ok(isChunkLoadError(new TypeError('Importing a module script failed.')))
  assert.ok(isChunkLoadError(new Error('Unable to preload CSS for /assets/a.css')))
  assert.ok(!isChunkLoadError(new Error('Cannot read properties of undefined')))
  assert.ok(!isChunkLoadError(null)); assert.ok(!isChunkLoadError(undefined))
})

test('bản nháp: giữ nguyên vùng khoanh + câu hỏi, hết hạn sau 15 phút, hỏng thì bỏ', () => {
  const s = mem(); const draft = { ask: { score: { section: 2, path: [1] }, bars: { from: 3, to: 6 } }, text: 'Ô này em bấm chưa tròn tiếng' }
  assert.equal(stashDraft('k', draft, s, 1000), true)
  assert.deepEqual(peekDraft('k', s, 2000), draft)
  assert.deepEqual(peekDraft('k', s, 2000), draft, 'peek không xoá')
  assert.equal(peekDraft('k', s, 1000 + DRAFT_TTL_MS + 1), null, 'quá hạn')
  assert.equal(peekDraft('k', s, 2000), null, 'đã dọn khi quá hạn')
  s.setItem('tva-recover:bad', '{not json'); assert.equal(peekDraft('bad', s), null)
  stashDraft('k2', 1, s); clearDraft('k2', s); assert.equal(peekDraft('k2', s), null)
  assert.equal(stashDraft('k', 1, null), false, 'không có storage: không ném lỗi')
  assert.equal(peekDraft('k', null), null)
})

test('chốt chống vòng lặp: tự tải lại tối đa 1 lần / 60 giây; không storage thì không tự tải lại', () => {
  const s = mem()
  assert.equal(claimAutoReload(s, 10_000), true)
  assert.equal(claimAutoReload(s, 10_000 + 5_000), false)
  assert.equal(claimAutoReload(s, 10_000 + RELOAD_GUARD_MS - 1), false)
  assert.equal(claimAutoReload(s, 10_000 + RELOAD_GUARD_MS), true)
  assert.equal(claimAutoReload(null), false)
})

test('importWithRetry: thử lại 1 lần khi lỗi chunk, không thử lại lỗi khác', async () => {
  let n = 0
  const r = await importWithRetry(async () => { if (++n === 1) throw new TypeError('Failed to fetch dynamically imported module: x'); return 'ok' }, 1)
  assert.equal(r, 'ok'); assert.equal(n, 2)
  let m = 0
  await assert.rejects(importWithRetry(async () => { m++; throw new Error('boom') }, 1), /boom/); assert.equal(m, 1)
  let k = 0
  await assert.rejects(importWithRetry(async () => { k++; throw new TypeError('Failed to fetch dynamically imported module: y') }, 1), /Failed to fetch/); assert.equal(k, 2, 'chunk đã bị xoá: lỗi sau 2 lần, để ranh giới xử lý')
})
