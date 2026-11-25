import test from 'node:test'
import assert from 'node:assert/strict'
import { SNOOZE_MS, behindPolicy, compareVersions, decide, isSnoozed, parseSnooze, toPolicy, type Installed, type Policy } from '../../src/app-update/policy.ts'
import { checkForUpdate } from '../../src/app-update/check.ts'
import { formError, forceConfirmText, saveArgs, toForm, type PolicyRow } from '../../src/admin/appUpdateModel.ts'

const ios: Installed = { platform: 'ios', version: '1.7.0', build: 34 }
const droid: Installed = { platform: 'android', version: '1.7.0', build: 18 }
const pol = (o: Partial<Policy> = {}): Policy => ({ latestVersion: '1.8.0', latestBuild: 19, minVersion: null, minBuild: null, force: false, notes: null, ...o })

test('so phiên bản theo số', () => {
  assert.equal(compareVersions('1.10.0', '1.9.0'), 1)
  assert.equal(compareVersions('1.7', '1.7.0'), 0)
  assert.equal(compareVersions('1.6.9', '1.7.0'), -1)
  for (const bad of ['', 'abc', '1.7-beta', null, undefined]) assert.equal(compareVersions(bad, '1.0.0'), null)
})
test('chính sách tắt / thiếu / rác → không báo', () => {
  for (const raw of [null, undefined, 'x', {}, { latestVersion: 7 }]) {
    assert.equal(decide(ios, toPolicy(raw), { available: true, version: '9.0.0' }).kind, 'none')
  }
})
test('iOS: kho CHƯA phát hành bản mới → im, dù Owner đã khai', () => {
  assert.equal(decide(ios, pol(), { available: true, version: '1.7.0' }).kind, 'none')
  assert.equal(decide(ios, pol(), { available: false, version: '1.8.0' }).kind, 'none', 'máy không đủ iOS tối thiểu')
  assert.equal(decide(ios, pol(), null).kind, 'none')
})
test('iOS: kho đã có → báo thường; đích không vượt kho cũng không vượt Owner', () => {
  const a = decide(ios, pol(), { available: true, version: '1.8.0' })
  assert.deepEqual([a.kind, a.kind !== 'none' && a.target], ['soft', '1.8.0'])
  const b = decide(ios, pol({ latestVersion: '1.9.0' }), { available: true, version: '1.8.0' })
  assert.equal(b.kind !== 'none' && b.target, '1.8.0')
  const c = decide(ios, pol({ latestVersion: '1.8.0' }), { available: true, version: '1.9.0' })
  assert.equal(c.kind !== 'none' && c.target, '1.8.0')
})
test('đã ở bản mới nhất / mới hơn (TestFlight) → im', () => {
  assert.equal(behindPolicy({ ...ios, version: '1.8.0' }, pol()), false)
  assert.equal(behindPolicy({ ...droid, build: 25 }, pol()), false)
})
test('iOS bắt buộc: chỉ khi dưới tối thiểu VÀ kho có bản đạt tối thiểu', () => {
  const p = pol({ force: true, minVersion: '1.8.0', latestVersion: '1.9.0' })
  assert.equal(decide(ios, p, { available: true, version: '1.8.0' }).kind, 'force')
  assert.equal(decide(ios, p, { available: true, version: '1.7.5' }).kind, 'soft', 'kho chưa có bản đạt tối thiểu → không khoá chết')
  assert.equal(decide({ ...ios, version: '1.8.0' }, p, { available: true, version: '1.9.0' }).kind, 'soft')
  assert.equal(decide(ios, { ...p, force: false }, { available: true, version: '1.9.0' }).kind, 'soft', 'chưa bật bắt buộc')
})
test('Android: theo versionCode Play phát cho máy', () => {
  assert.equal(decide(droid, pol(), { available: false }).kind, 'none')
  assert.equal(decide(droid, pol(), { available: true, build: 18 }).kind, 'none')
  const a = decide(droid, pol(), { available: true, build: 19 })
  assert.deepEqual(a, { kind: 'soft', target: '19', version: '1.8.0', notes: null })
  const b = decide(droid, pol({ latestBuild: 21 }), { available: true, build: 19 })
  assert.equal(b.kind !== 'none' && b.version, null, 'không đoán tên phiên bản')
  assert.equal(decide(droid, pol({ force: true, minBuild: 19 }), { available: true, build: 19 }).kind, 'force')
  assert.equal(decide(droid, pol({ force: true, minBuild: 20, latestBuild: 20 }), { available: true, build: 19 }).kind, 'soft')
})
test('Để sau: im đúng 24 giờ, bản mới hơn thì báo lại, bắt buộc không hoãn được', () => {
  const d = decide(ios, pol(), { available: true, version: '1.8.0' })
  const t = 1_000_000_000
  const s = { target: '1.8.0', until: t + SNOOZE_MS }
  assert.equal(isSnoozed(d, s, t + SNOOZE_MS - 1), true)
  assert.equal(isSnoozed(d, s, t + SNOOZE_MS), false)
  assert.equal(isSnoozed(d, { ...s, target: '1.7.5' }, t), false)
  assert.equal(isSnoozed(d, s, t - 10 * SNOOZE_MS), false, 'vặn đồng hồ lùi')
  assert.equal(isSnoozed({ kind: 'force', target: '1.8.0', version: '1.8.0', notes: null }, s, t), false)
  assert.equal(parseSnooze('rác'), null); assert.equal(parseSnooze(null), null)
})
test('một lượt kiểm: lỗi / treo ở bất kỳ bước nào → không báo', async () => {
  const ok = { getInfo: async () => ios, fetchPolicy: async () => pol(), checkStore: async () => ({ available: true, version: '1.8.0' }) }
  assert.equal((await checkForUpdate(ok)).kind, 'soft')
  const boom = async (): Promise<never> => { throw new Error('500') }
  for (const key of ['getInfo', 'fetchPolicy', 'checkStore'] as const) {
    assert.equal((await checkForUpdate({ ...ok, [key]: boom })).kind, 'none', key)
    assert.equal((await checkForUpdate({ ...ok, [key]: () => new Promise<never>(() => {}) }, 20)).kind, 'none', key + ' treo')
  }
})
test('không có gì mới theo chính sách → không gọi kho', async () => {
  let calls = 0
  await checkForUpdate({ getInfo: async () => ios, fetchPolicy: async () => null, checkStore: async () => { calls++; return { available: true } } })
  assert.equal(calls, 0)
})
test('biểu mẫu quản trị', () => {
  const row: PolicyRow = { platform: 'android', enabled: false, latest_version: null, latest_build: null, min_version: null, min_build: null, force_enabled: false, notes: null, updated_at: 'x' }
  const f = toForm(row)
  assert.equal(formError('android', f), null)
  assert.ok(formError('android', { ...f, enabled: true, latestVersion: '1.7.0' }))
  assert.ok(formError('ios', { ...f, force: true }))
  assert.ok(formError('ios', { ...f, enabled: true, latestVersion: '1.9.0', minVersion: '1.10.0' }))
  const on = { ...f, enabled: true, latestVersion: '1.7.0', latestBuild: '18', minBuild: '17', force: true }
  assert.equal(formError('android', on), null)
  assert.match(forceConfirmText(row, on) ?? '', /BẮT BUỘC/)
  assert.equal(forceConfirmText({ ...row, force_enabled: true, min_build: 17 }, on), null)
  assert.equal(saveArgs(row, on).p_latest_build, 18)
  assert.equal(saveArgs({ ...row, platform: 'ios' }, on).p_latest_build, null)
})
