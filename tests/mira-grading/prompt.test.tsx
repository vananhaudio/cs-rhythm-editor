import './dom-setup'
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import React from 'react'
import { render, cleanup, waitFor } from '@testing-library/react'
import CheckpointPromptCard from '../../src/learning-thread/CheckpointPromptCard'
import { pickCheckpointPrompt, promptStateOf } from '../../src/learning-thread/checkpointPrompt'
import ThreadView from '../../src/learning-thread/ThreadView'
import type { LessonSection } from '../../src/lesson/lessonTypes'
import type { ThreadDetail } from '../../src/learning-thread/ltModel'

void React
afterEach(() => cleanup())

const sections = [
  { kind: 'note', title: 'Ghi chú', text: 'x' },
  { kind: 'checkpoint', id: '4.1', title: 'Đệm hát điệu Bolero', prompt: '  Quay video đệm 8 ô nhịp.\nNêu rõ tốc độ.  ' },
  { kind: 'checkpoint', id: '4.2', title: 'Bài không có yêu cầu' },
  { kind: 'checkpoint', id: '4.3', title: 'Yêu cầu trống', prompt: '   ' },
] as unknown as LessonSection[]

const PUB = { status: 'published', sections } as never
const DRAFT = { status: 'draft', sections } as never

test('pickCheckpointPrompt: đúng id → tiêu đề + đề (cắt khoảng trắng đầu/cuối, giữ xuống dòng)', () => {
  assert.deepEqual(pickCheckpointPrompt(sections, '4.1'), { id: '4.1', title: 'Đệm hát điệu Bolero', prompt: 'Quay video đệm 8 ô nhịp.\nNêu rõ tốc độ.' })
})
test('pickCheckpointPrompt: không có yêu cầu / yêu cầu trống → prompt null; id lạ hoặc khối không phải bài trả → null', () => {
  assert.equal(pickCheckpointPrompt(sections, '4.2')?.prompt, null)
  assert.equal(pickCheckpointPrompt(sections, '4.3')?.prompt, null)
  assert.equal(pickCheckpointPrompt(sections, '9.9'), null)
  assert.equal(pickCheckpointPrompt(sections, 'Ghi chú'), null)
})

test('thẻ Đề bài: tải đúng lớp + buổi, hiện tiêu đề và đề', async () => {
  const calls: [string, number][] = []
  const load = async (c: string, n: number) => { calls.push([c, n]); return PUB }
  const v = render(<CheckpointPromptCard classId="class-1" sessionNo={4} checkpointId="4.1" load={load} />)
  assert.ok(v.container.querySelector('[aria-busy="true"]'))
  await waitFor(() => assert.match(v.container.textContent ?? '', /Đệm hát điệu Bolero/))
  assert.match(v.container.textContent ?? '', /Quay video đệm 8 ô nhịp\./)
  assert.match(v.container.textContent ?? '', /Đề bài · 4\.1/)
  assert.deepEqual(calls, [['class-1', 4]])
})
test('thẻ Đề bài: bài không có yêu cầu → báo gọn, không bịa đề', async () => {
  const v = render(<CheckpointPromptCard classId="c" sessionNo={4} checkpointId="4.2" load={async () => PUB} />)
  await waitFor(() => assert.match(v.container.textContent ?? '', /Bài không có yêu cầu/))
  assert.match(v.container.textContent ?? '', /chưa có phần yêu cầu cụ thể/)
})
test('thẻ Đề bài: không đọc được giáo trình / bài trả không tồn tại / lỗi → báo "mở giáo trình", không văng lỗi', async () => {
  for (const load of [async () => null, async () => PUB, async () => { throw new Error('rls') }]) {
    const v = render(<CheckpointPromptCard classId="c" sessionNo={4} checkpointId={load.toString().includes('PUB') ? '7.7' : '4.1'} load={load} />)
    await waitFor(() => assert.match(v.container.textContent ?? '', /mở giáo trình để xem/))
    v.unmount()
  }
})
test('thẻ Đề bài: đổi bài trả → không hiện đề của bài cũ trong lúc tải bài mới', async () => {
  let release: (s: never) => void = () => {}
  const slow = () => new Promise<never>(r => { release = r })
  const v = render(<CheckpointPromptCard classId="c" sessionNo={4} checkpointId="4.1" load={async () => PUB} />)
  await waitFor(() => assert.match(v.container.textContent ?? '', /Bolero/))
  v.rerender(<CheckpointPromptCard classId="c" sessionNo={4} checkpointId="4.2" load={slow} />)
  assert.doesNotMatch(v.container.textContent ?? '', /Bolero/)
  assert.ok(v.container.querySelector('[aria-busy="true"]'))
  release(PUB)
  await waitFor(() => assert.match(v.container.textContent ?? '', /Bài không có yêu cầu/))
})

test('đề bài CHỈ lấy từ bản đã xuất bản: published → hiện đề', async () => {
  assert.equal(promptStateOf(PUB, '4.1').status, 'ready')
})
test('bản nháp KHÔNG thành đề chính thức: báo chưa xuất bản, không lộ nội dung nháp', async () => {
  assert.deepEqual(promptStateOf(DRAFT, '4.1'), { status: 'unpublished' })
  assert.deepEqual(promptStateOf({ status: 'archived', sections } as never, '4.1'), { status: 'unpublished' })
  const v = render(<CheckpointPromptCard classId="c" sessionNo={4} checkpointId="4.1" load={async () => DRAFT} />)
  await waitFor(() => assert.match(v.container.textContent ?? '', /chưa xuất bản/))
  assert.doesNotMatch(v.container.textContent ?? '', /Quay video đệm|Bolero/)
  assert.match(v.container.textContent ?? '', /Mira cũng chưa thấy đề/)
})
test('không có dữ liệu giáo trình → missing (không bịa); bản xuất bản nhưng thiếu bài trả → missing', () => {
  assert.deepEqual(promptStateOf(null, '4.1'), { status: 'missing' })
  assert.deepEqual(promptStateOf(PUB, '9.9'), { status: 'missing' })
})

const thread = {
  id: 't1', lessonId: null, checkpoint: null, visibility: 'private', status: 'waiting_teacher', passedAt: null, passedBy: null, createdAt: '', lastEventAt: null,
  archived: false, isHidden: false, isMine: false, canRespond: true, events: [],
  learner: { userId: null, name: 'An', avatarUrl: null },
  identity: { lesson: { id: null, title: 'Bài', orderIndex: null, lessonType: null }, module: { name: null, level: null }, course: { code: null, name: null, subject: null, level: null }, klass: null, capturedAt: null },
} as unknown as ThreadDetail
test('ThreadView: aside nằm giữa phần đầu và dòng thời gian; không truyền aside → không đổi', () => {
  const a = render(<ThreadView thread={thread} aside={<p id="aside">ĐỀ</p>} />)
  const kids = [...(a.container.querySelector('.lt-page')?.children ?? [])]
  assert.equal(kids.length, 3)
  assert.equal(kids[1].id, 'aside')
  a.unmount()
  assert.equal(render(<ThreadView thread={thread} />).container.querySelector('.lt-page')?.children.length, 2)
})

test('ThreadPage: thẻ Đề bài chỉ cho Thầy + có classId; nút Mở giáo trình không còn bị ẩn với Thầy', () => {
  const src = fs.readFileSync('src/learning-thread/ThreadPage.tsx', 'utf8')
  assert.match(src, /aside=\{isTeacher && cp\?\.classId \? <CheckpointPromptCard classId=\{cp\.classId\} sessionNo=\{cp\.sessionNo\} checkpointId=\{cp\.checkpointId\} \/> : undefined\}/)
  assert.match(src, /cp\?\.classId && \(onOpenSession \|\| onOpenClass\) && \(\s*\n\s*<div className="lt-actions">/)
  assert.doesNotMatch(src, /t\.isMine \|\| !isTeacher/)
  assert.match(src, /<TeacherComposer threadId=\{t\.id\}/)   // ô phản hồi giữ nguyên
})
