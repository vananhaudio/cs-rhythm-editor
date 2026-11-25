// LESSON_HOLD_V2 — buổi Thầy khoá: người học luôn thấy khoá (kể cả đã có tiến độ / lớp 'open'); Thầy vẫn xem được và thấy nhãn.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { currentSessionNo, lockedHint, sessionBadge, sessionPhase, toClassLearningState } from '../../src/classLearning/progress'
import TeacherLockBar from '../../src/class-social/classes/TeacherLockBar'

const raw = (role: 'learner' | 'teacher', policy = 'sequential') => ({
  enabled: true, program_code: 'SOLO01', class_name: 'Lớp', role, unlock_policy: policy,
  sessions: [
    { session_id: 'a', session_no: 8, title: 'Tám', published: true, held: false, opened_at: '2026-11-01T00:00:00Z', completed_at: null, start_at: '2026-11-12T12:00:00Z', checkpoints: [] },
    { session_id: 'b', session_no: 9, title: 'Chín', published: true, held: true, opened_at: '2026-11-21T00:00:00Z', completed_at: null, start_at: '2026-11-26T12:00:00Z', checkpoints: [] },
  ],
})
const state = (role: 'learner' | 'teacher', policy?: string) => {
  const s = toClassLearningState(raw(role, policy), 'c'); assert.ok(s.enabled); return s
}

test('người học: buổi khoá luôn locked, kể cả khi còn opened_at và kể cả lớp open', () => {
  for (const policy of ['sequential', 'open'] as const) {
    const st = state('learner', policy), b9 = st.sessions[1]
    assert.equal(sessionPhase(b9, 'learner', 'checkpoint', policy), 'locked')
    assert.equal(sessionBadge(b9, 'learner', new Date(), 7, 'checkpoint', policy), '🔒')
    assert.equal(lockedHint(st.sessions, b9), 'Buổi này sẽ mở khi Thầy mở khoá')
  }
  assert.equal(currentSessionNo(state('learner', 'open'), new Date('2026-11-27T00:00:00Z')), 8)
})

test('Thầy: xem được buổi khoá, có nhãn đang khoá', () => {
  const b9 = state('teacher').sessions[1]
  assert.equal(sessionPhase(b9, 'teacher'), 'open')
  assert.equal(sessionBadge(b9, 'teacher', new Date(), 7), '🔒 Đang khoá')
})

test('server cũ không trả held → coi như không khoá', () => {
  const o = raw('learner'); for (const s of o.sessions) delete (s as { held?: boolean }).held
  const st = toClassLearningState(o, 'c'); assert.ok(st.enabled)
  assert.equal(sessionPhase(st.sessions[1], 'learner'), 'open')
})

test('thanh khoá: nêu trạng thái, chưa bấm thì chưa gọi gì; trang buổi chỉ cắm cho Thầy', () => {
  let calls = 0
  const html = renderToStaticMarkup(<TeacherLockBar s={{ no: 9, held: true, published: true }} onSet={async () => { calls++; return { ok: true } }} onDone={() => {}} />)
  assert.match(html, /Buổi 09 đang khoá/); assert.match(html, /Mở khoá cho lớp/); assert.equal(calls, 0)
  const page = readFileSync('src/class-social/classes/ClassSessionPage.tsx', 'utf8')
  assert.match(page, /learn\.role === 'teacher' && learn\.mode === 'checkpoint' && \(\s*<TeacherLockBar/)
})

test('buổi mở đầu chặng: nhận cờ từ server; Thầy được nói đúng là cả lớp vào ngay', () => {
  const o = raw('learner'); (o.sessions[1] as { stage_start?: boolean }).stage_start = true
  const st = toClassLearningState(o, 'c'); assert.ok(st.enabled)
  assert.equal(st.sessions[1].stageStart, true); assert.equal(st.sessions[0].stageStart, false)
  const bar = (stageStart: boolean, held: boolean) => renderToStaticMarkup(<TeacherLockBar s={{ no: 9, held, published: true, stageStart }} onSet={async () => ({ ok: true })} onDone={() => {}} />)
  assert.match(bar(true, false), /Cả lớp vào học được/)
  assert.match(bar(false, false), /khi tới lượt/)
  const src = readFileSync('src/class-social/classes/TeacherLockBar.tsx', 'utf8')
  assert.match(src, /s\.stageStart\s*\? 'Mở cho cả lớp\?[^']*không cần hoàn thành chặng trước/)
})

test('không hardcode số buổi: luật mở đầu chặng nằm ở cấu trúc class_stages', () => {
  const sql = readFileSync('db/stage_open_v1_setup.sql', 'utf8').replace(/--.*$/gm, '')
  assert.match(sql, /class_stages/)
  assert.doesNotMatch(sql, /session_number\s*(=|in\s*\()\s*(9|17)\b/)
})
