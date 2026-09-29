import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  groupOutline, lessonTitle, parseSections, planStagesFromTemplate, stageDates, stageOf, toLessonDoc,
  type SessionRow, type StageRow,
} from '../../src/classLearning/outline.ts'

const stage = (id: number, no: number, from: number, to: number): StageRow => ({
  id, class_id: 'c1', stage_no: no, public_title: `Chặng ${no}`, summary: null, from_session: from, to_session: to,
  starts_on: null, ends_on: null,
})
const lesson = (n: number, extra: Partial<SessionRow> = {}): SessionRow => ({
  id: `s${n}`, session_number: n, event_type: 'lesson', status: 'scheduled',
  start_at: new Date(Date.UTC(2026, 8, 17 + 7 * (n - 1), 12)).toISOString(), end_at: null,
  title: `Buổi ${n} · Bài ${n}`, stage_id: null, ...extra,
})
const brk = (id: string): SessionRow => ({ ...lesson(0), id, session_number: null, event_type: 'break', title: 'Nghỉ giữa chặng' })

test('lessonTitle bỏ tiền tố "Buổi N ·" và có dự phòng', () => {
  assert.equal(lessonTitle({ title: 'Buổi 3 · Xếp ngón', session_number: 3 }), 'Xếp ngón')
  assert.equal(lessonTitle({ title: null, session_number: 7 }), 'Buổi 7')
  assert.equal(lessonTitle({ title: 'Buổi 12', session_number: 12 }), 'Buổi 12')
})

test('stage_id do Admin gắn thắng khoảng buổi; không có thì theo khoảng', () => {
  const stages = [stage(10, 1, 1, 8), stage(20, 2, 9, 16)]
  assert.equal(stageOf(lesson(3), stages)?.id, 10)
  assert.equal(stageOf(lesson(3, { stage_id: 20 }), stages)?.id, 20)
  assert.equal(stageOf(lesson(30), stages), null)
})

test('groupOutline: chỉ buổi lesson, theo thứ tự chặng, buổi lạc cuối cùng, gắn trạng thái giáo trình', () => {
  const stages = [stage(20, 2, 9, 16), stage(10, 1, 1, 8)]
  const sessions = [lesson(9), brk('b1'), lesson(1), lesson(2), lesson(25)]
  const out = groupOutline(stages, sessions, [{ session_id: 's1', status: 'published' }, { session_id: 's2', status: 'draft' }])
  assert.deepEqual(out.map(g => g.stage?.stage_no ?? null), [1, 2, null])
  assert.deepEqual(out[0].lessons.map(l => [l.no, l.content]), [[1, 'published'], [2, 'draft']])
  assert.deepEqual(out[1].lessons.map(l => l.no), [9])
  assert.deepEqual(out[2].lessons.map(l => l.no), [25])
})

test('parseSections: chấp nhận mảng object có kind (kể cả kind mới), từ chối dạng sai', () => {
  assert.equal(parseSections([{ kind: 'note', text: 'x' }, { kind: 'video_v2', url: 'y' }]).ok, true)
  assert.equal(parseSections({ kind: 'note' }).ok, false)
  assert.equal(parseSections([{ text: 'thiếu kind' }]).ok, false)
  assert.equal(parseSections([null]).ok, false)
})

test('planStagesFromTemplate: idempotent — không đụng lớp đã có chặng', () => {
  const tpl = [{ no: 2, title: 'B' }, { no: 1, title: 'A', summary: 'mục tiêu' }]
  assert.deepEqual(planStagesFromTemplate([], tpl, 8), [
    { stage_no: 1, public_title: 'A', summary: 'mục tiêu', from_session: 1, to_session: 8 },
    { stage_no: 2, public_title: 'B', summary: null, from_session: 9, to_session: 16 },
  ])
  assert.deepEqual(planStagesFromTemplate([stage(1, 1, 1, 8)], tpl, 8), [])
})

test('stageDates theo giờ VN, chỉ buổi lesson trong khoảng', () => {
  const s = [lesson(1), lesson(2), lesson(9), brk('b')]
  assert.deepEqual(stageDates(s, 1, 8), { starts_on: '2026-09-17', ends_on: '2026-09-24' })
  assert.deepEqual(stageDates(s, 17, 24), { starts_on: null, ends_on: null })
})

test('toLessonDoc dựng meta từ lớp/chặng/buổi', () => {
  const doc = toLessonDoc({ code: 'SOLO01.TH01', name: 'Solo Guitar Căn Bản' }, stage(10, 1, 1, 8), lesson(1), [{ kind: 'note', text: 'x' }])
  assert.equal(doc.meta.sessionNo, 1)
  assert.equal(doc.meta.title, 'Bài 1')
  assert.equal(doc.meta.stageLabel, 'Chặng 1 · Chặng 1')
  assert.equal(doc.sections.length, 1)
})
