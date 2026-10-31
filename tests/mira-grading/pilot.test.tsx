import './dom-setup'
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, cleanup, waitFor, act } from '@testing-library/react'
import PilotDock from '../../src/mira-grading/PilotDock'
import type { MiraGradingApi } from '../../src/mira-grading/api'

void React
const ORIGIN = 'https://m.example'; const CFG = { url: ORIGIN + '/grading', origin: ORIGIN }
const A = '11111111-1111-4111-8111-111111111111'
afterEach(() => cleanup())
const mk = (pilot: () => Promise<boolean>) => {
  const log: string[] = []
  const api: MiraGradingApi = {
    ticket: async (id) => { log.push('ticket:' + id); return { ok: true, value: { ticket: 'a'.repeat(64), expiresAt: 'T' } } },
    end: async (id) => { log.push('end:' + id) },
    pilotEnabled: async () => { log.push('pilot'); return pilot() },
  }
  return { api, log }
}

test('KHÔNG phải thầy (enabled=false): không hỏi pilot, không xin vé, DOM y hệt khi chưa có tính năng', async () => {
  const { api, log } = mk(async () => true)
  const r = render(<PilotDock enabled={false} cfg={CFG} api={api} threadId={A}><p>Màn chấm</p></PilotDock>)
  await act(async () => { await new Promise(res => setTimeout(res, 30)) })
  assert.equal(r.container.innerHTML, '<p>Màn chấm</p>'); assert.deepEqual(log, [])
})
test('chưa cấu hình URL Mira (cfg=null): không hỏi pilot, không iframe', async () => {
  const { api, log } = mk(async () => true)
  const r = render(<PilotDock enabled cfg={null} api={api} threadId={A}><p>Màn chấm</p></PilotDock>)
  await act(async () => { await new Promise(res => setTimeout(res, 30)) })
  assert.equal(r.container.innerHTML, '<p>Màn chấm</p>'); assert.deepEqual(log, [])
})
test('thầy NGOÀI pilot: chỉ hỏi pilot_enabled (không xin vé), không iframe, không nút Mira, DOM y hệt bản cũ', async () => {
  const { api, log } = mk(async () => false)
  const r = render(<PilotDock enabled cfg={CFG} api={api} threadId={A}><p>Màn chấm</p></PilotDock>)
  await waitFor(() => assert.deepEqual(log, ['pilot']))
  await act(async () => { await new Promise(res => setTimeout(res, 30)) })
  assert.equal(r.container.innerHTML, '<p>Màn chấm</p>'); assert.deepEqual(log, ['pilot'])
})
test('đang chờ trả lời pilot_enabled: vẫn chỉ render màn chấm (không nháy khung rồi ẩn)', async () => {
  let release: (v: boolean) => void = () => {}
  const { api } = mk(() => new Promise<boolean>(res => { release = res }))
  const r = render(<PilotDock enabled cfg={CFG} api={api} threadId={A}><p>Màn chấm</p></PilotDock>)
  assert.equal(r.container.innerHTML, '<p>Màn chấm</p>')
  await act(async () => { release(false) })
  assert.equal(r.container.innerHTML, '<p>Màn chấm</p>')
})
test('lỗi mạng / hàm chưa có khi hỏi pilot: ẩn (an toàn), không ném', async () => {
  const { api } = mk(async () => { throw new Error('mạng') })
  const safe: MiraGradingApi = { ...api, pilotEnabled: async () => { try { return await api.pilotEnabled() } catch { return false } } }
  const r = render(<PilotDock enabled cfg={CFG} api={safe} threadId={A}><p>Màn chấm</p></PilotDock>)
  await act(async () => { await new Promise(res => setTimeout(res, 30)) })
  assert.equal(r.container.innerHTML, '<p>Màn chấm</p>')
})
test('thầy TRONG pilot: hiện khung Mira (iframe có sandbox) bên cạnh màn chấm', async () => {
  const { api } = mk(async () => true)
  const r = render(<PilotDock enabled cfg={CFG} api={api} threadId={A}><p>Màn chấm</p></PilotDock>)
  await waitFor(() => assert.ok(r.container.querySelector('iframe')))
  assert.equal(r.container.querySelector('iframe')!.getAttribute('sandbox'), 'allow-scripts allow-same-origin')
  assert.equal(r.container.querySelector('.mira-dock-main')!.textContent, 'Màn chấm')
})
