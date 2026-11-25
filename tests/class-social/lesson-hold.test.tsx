// LESSON_HOLD_V2 — buổi Thầy khoá: người học luôn thấy khoá (kể cả đã có tiến độ / lớp 'open'); Thầy vẫn xem được và thấy nhãn.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { currentSessionNo, lockedHint, sessionBadge, sessionPhase, toClassLearningState } from '../../src/classLearning/progress'
import TeacherLockBar from '../../src/class-social/classes/TeacherLockBar'
import NewStageEntry from '../../src/class-social/classes/NewStageEntry'
import ClassMap from '../../src/class-social/classes/ClassMap'

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

// Thầy mở đầu chặng mới trong khi người học còn dở Buổi 4
const lagging = (o: { opened?: boolean; done9?: boolean; flag?: boolean; role?: 'learner' | 'teacher' } = {}) => {
  const { opened = true, done9 = false, flag = true, role = 'learner' } = o
  const row = (no: number, stage: number, extra: object = {}) => ({ session_id: 's' + no, session_no: no, title: 'Bài ' + no, stage_no: stage,
    stage_title: 'Tên chặng ' + stage, published: true, held: false, stage_start: false, opened_at: null, completed_at: null, checkpoints: [], start_at: null, ...extra })
  const at = '2026-11-01T00:00:00Z'
  const st = toClassLearningState({ enabled: true, program_code: 'SOLO01', class_name: 'Lớp', role, unlock_policy: 'sequential', sessions: [
    row(3, 1, { opened_at: at, completed_at: at }), row(4, 1, { opened_at: at }), row(5, 1),
    row(9, 2, { stage_start: flag, held: !opened, opened_at: opened ? at : null, completed_at: done9 ? at : null }),
    row(10, 2, done9 ? { opened_at: at } : {}),
  ] }, 'c')
  assert.ok(st.enabled); return st
}

test('Thầy mở đầu chặng mới → học viên được dẫn vào chặng mới dù chặng cũ còn dở; tiến độ cũ giữ nguyên', () => {
  const st = lagging()
  assert.equal(currentSessionNo(st), 9)
  assert.equal(sessionPhase(st.sessions[1], 'learner'), 'open')          // Buổi 4 vẫn vào làm tiếp được
  assert.equal(sessionPhase(st.sessions[0], 'learner'), 'done')
  assert.equal(currentSessionNo(lagging({ done9: true })), 10)           // trong chặng mới đi theo tiến độ, không bật về Buổi 4
})

test('chưa mở / lớp không thuộc quy tắc (không có cờ stage_start) → chọn buổi hiện tại như cũ', () => {
  assert.equal(currentSessionNo(lagging({ opened: false })), 4)
  assert.equal(currentSessionNo(lagging({ flag: false })), 4)
})

test('lối vào chặng mới: hiện khi đã mở và chưa xong buổi mở đầu; Thầy và trường hợp khác không thấy', () => {
  const html = (o?: Parameters<typeof lagging>[0]) => renderToStaticMarkup(<NewStageEntry state={lagging(o)} onOpenSession={() => {}} />)
  assert.match(html(), /Chặng 2 đã mở/); assert.match(html(), /Vào Buổi 09/); assert.match(html(), /Tiến độ chặng trước vẫn được giữ/)
  for (const o of [{ opened: false }, { flag: false }, { done9: true }, { role: 'teacher' as const }]) assert.equal(html(o), '')
})

test('mục lục bung chặng mới, gập chặng cũ', () => {
  const st = lagging()
  const html = renderToStaticMarkup(<ClassMap state={st} current={currentSessionNo(st)} onOpenSession={() => {}} onOpenThread={() => {}} />)
  assert.match(html, /id="buoi-09"/); assert.doesNotMatch(html, /id="buoi-04"/)
  assert.match(readFileSync('src/class-social/classes/ClassMap.tsx', 'utf8'), /setOpen\(new Set\(\[currentKey\]\)\)/)
})

test('phạm vi: chỉ chương trình được khai báo; mới duyệt SOLO01', () => {
  const sql = readFileSync('db/stage_open_scope_v2_setup.sql', 'utf8').replace(/--.*$/gm, '')
  assert.match(sql, /stage_open_program sp where sp\.program_code = c\.program_code/)
  assert.deepEqual([...sql.matchAll(/values \('([A-Z0-9_]+)'/g)].map(m => m[1]), ['SOLO01'])
})
