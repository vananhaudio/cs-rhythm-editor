import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { JSDOM } from 'jsdom'
import type { UpdateDeps } from '../../src/app-update/check'
import { SNOOZE_MS } from '../../src/app-update/policy'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://localhost/' })
let visibility = 'visible'
Object.defineProperty(dom.window.document, 'visibilityState', { configurable: true, get: () => visibility })
for (const k of ['window', 'document', 'localStorage', 'HTMLElement', 'Node', 'MutationObserver'] as const) {
  Object.defineProperty(globalThis, k, { configurable: true, value: k === 'window' ? dom.window : dom.window[k] })
}
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
void React

const { render, cleanup, fireEvent, act } = await import('@testing-library/react')
const { default: AppUpdateGate, SNOOZE_KEY } = await import('../../src/app-update/AppUpdateGate')

let policy: unknown, store = { available: true, version: '1.8.0' }, clock = 1_000_000_000, opened = 0, checks = 0, down = false
const deps: UpdateDeps = {
  getInfo: async () => ({ platform: 'ios', version: '1.7.0', build: 34 }),
  fetchPolicy: async () => { checks++; if (down) throw new Error('503'); return policy },
  checkStore: async () => store,
}
const tick = () => act(async () => { await new Promise(r => setTimeout(r, 5)) })
const resume = async (afterMs: number) => {
  clock += afterMs
  await act(async () => { dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange')) })
  await tick()
}
const mount = async () => {
  const r = render(<AppUpdateGate deps={deps} openStore={async () => { opened++ }} now={() => clock} />, { container: document.body.appendChild(document.createElement('div')) })
  await tick()
  return r
}
const button = (name: string) => [...document.querySelectorAll('button')].find(b => b.textContent === name)
const reset = () => { cleanup(); localStorage.clear(); document.body.innerHTML = ''; down = false; visibility = 'visible'; opened = 0; checks = 0; policy = { latestVersion: '1.8.0', force: false, notes: 'Sửa lỗi' }; store = { available: true, version: '1.8.0' } }

test('mở app → báo tiếng Việt; Cập nhật ngay gọi mở kho', async () => {
  reset(); await mount()
  assert.match(document.body.textContent!, /Đã có phiên bản mới.*TVA Guitar 1\.8\.0.*Sửa lỗi/s)
  await act(async () => { fireEvent.click(button('Cập nhật ngay')!) })
  assert.equal(opened, 1)
})
test('Để sau → im trong 24 giờ kể cả mở lại app, hết hạn thì nhắc lại', async () => {
  reset(); const r = await mount()
  await act(async () => { fireEvent.click(button('Để sau')!) })
  assert.equal(document.querySelector('[role=alertdialog]'), null)
  assert.equal(JSON.parse(localStorage.getItem(SNOOZE_KEY)!).until, clock + SNOOZE_MS)
  await resume(SNOOZE_MS - 1000)
  assert.equal(document.querySelector('[role=alertdialog]'), null)
  r.unmount(); await mount()
  assert.equal(document.querySelector('[role=alertdialog]'), null, 'mở lại app')
  await resume(61_000)
  assert.ok(document.querySelector('[role=alertdialog]'))
})
test('quay lại app mới thấy bản vừa phát hành; đổi qua lại liên tục không hỏi dồn', async () => {
  reset(); store = { available: true, version: '1.7.0' }; await mount()
  assert.equal(document.querySelector('[role=alertdialog]'), null)
  store = { available: true, version: '1.8.0' }
  await resume(5_000); assert.equal(checks, 1)
  await resume(60_000); assert.ok(button('Cập nhật ngay'))
  visibility = 'hidden'; await resume(120_000); assert.equal(checks, 2, 'đi ra nền thì không kiểm')
})
test('bắt buộc: không có Để sau; Owner tắt → quay lại app là mở khoá ngay', async () => {
  reset(); policy = { latestVersion: '1.8.0', minVersion: '1.8.0', force: true }
  localStorage.setItem(SNOOZE_KEY, JSON.stringify({ target: '1.8.0', until: clock + SNOOZE_MS }))
  await mount()
  assert.match(document.body.textContent!, /Cần cập nhật ứng dụng/)
  assert.equal(button('Để sau'), undefined)
  policy = null; await resume(1_000)
  assert.equal(document.querySelector('[role=alertdialog]'), null)
})
test('máy chủ lỗi → không hiện gì; đang khoá mà máy chủ lỗi → mở cho học tiếp', async () => {
  reset(); down = true; await mount()
  assert.equal(document.querySelector('[role=alertdialog]'), null)
  reset(); policy = { latestVersion: '1.8.0', minVersion: '1.8.0', force: true }; await mount()
  assert.ok(document.querySelector('.is-force'))
  down = true; await resume(1_000)
  assert.equal(document.querySelector('[role=alertdialog]'), null)
})
test.after(() => { cleanup() })
