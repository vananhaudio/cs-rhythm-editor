import test from 'node:test'
import assert from 'node:assert/strict'
import { Student360Error, createStudent360Api, toStudent360Error, type RpcFn } from '../../src/student360/api'

function fake(result: { data?: unknown; error?: { message?: string; code?: string } | null } = { data: {} }) {
  const calls: { name: string; args: Record<string, unknown> }[] = []
  const rpc: RpcFn = async (name, args) => { calls.push({ name, args }); return { data: result.data ?? null, error: result.error ?? null } }
  return { calls, api: createStudent360Api(rpc) }
}

test('mỗi thao tác gọi đúng RPC với đúng tham số — không có tham số danh tính tự do ngoài p_user (server kiểm quyền)', async () => {
  const { api, calls } = fake()
  await api.get('U', true)
  await api.add({ userId: 'U', category: 'goal', content: 'c', origin: 'inferred', sourceKind: 'teacher' })
  await api.edit('F', 'n'); await api.setVerification('F', 'teacher_verified'); await api.setVisibility('F', 'student_and_teacher')
  await api.revoke('F', null); await api.history('F')
  assert.deepEqual(calls, [
    { name: 'student_360_get', args: { p_user: 'U', p_include_revoked: true } },
    { name: 'student_360_add_fact', args: { p_user: 'U', p_category: 'goal', p_content: 'c', p_origin: 'inferred', p_source_kind: 'teacher' } },
    { name: 'student_360_edit_fact', args: { p_fact: 'F', p_content: 'n' } },
    { name: 'student_360_set_verification', args: { p_fact: 'F', p_level: 'teacher_verified' } },
    { name: 'student_360_set_visibility', args: { p_fact: 'F', p_visibility: 'student_and_teacher' } },
    { name: 'student_360_revoke_fact', args: { p_fact: 'F', p_reason: null } },
    { name: 'student_360_fact_history', args: { p_fact: 'F' } },
  ])
})

test('không có thao tác xoá cứng và không gọi bảng trực tiếp', () => {
  const { api } = fake()
  assert.deepEqual(Object.keys(api).sort(), ['add', 'edit', 'get', 'history', 'revoke', 'setVerification', 'setVisibility'])
})

test('lỗi server được dịch sang tiếng Việt, không lộ thông điệp kỹ thuật', async () => {
  for (const [msg, code] of [['forbidden', 'forbidden'], ['revoked', 'revoked'], ['not_found', 'not_found'], ['content_required', 'content_required'],
    ['too_many_facts', 'too_many_facts'], ['new row violates check constraint "student_360_facts_content_check"', 'invalid'], ['connection reset', 'unknown']]) {
    const { api } = fake({ error: { message: msg } })
    await assert.rejects(api.edit('F', 'x'), (e: unknown) => e instanceof Student360Error && e.code === code && !e.message.includes(msg))
  }
  assert.equal(toStudent360Error({ code: '42501' }).code, 'forbidden')
})

test('RPC ném ngoại lệ (mất mạng) → Student360Error "unknown", không văng lỗi thô', async () => {
  const api = createStudent360Api(async () => { throw new Error('Failed to fetch') })
  await assert.rejects(api.get('U', false), (e: unknown) => e instanceof Student360Error && e.code === 'unknown')
})
