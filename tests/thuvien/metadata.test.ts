import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchesQuery, metadataPatch } from '../../src/thuvien/masterLibrary.ts'

const items = [
  { title: 'Diễm xưa', composer: 'Trịnh Công Sơn' },
  { title: 'Hà Nội mùa thu', composer: 'Vũ Thanh' },
  { title: 'Đường xưa', composer: null },
  { title: 'Ở trọ', composer: 'Trịnh Công Sơn' },
]
const find = (q: string) => items.filter(item => matchesQuery(item, q)).map(item => item.title)

test('title: có dấu, không dấu, hoa/thường', () => {
  for (const q of ['Diễm xưa', 'diem xua', 'DIEM XUA', 'DIỄM XƯA', '  diem   xua ', 'diễm'])
    assert.deepEqual(find(q), ['Diễm xưa'], q)
  assert.deepEqual(find('duong'), ['Đường xưa'])
  assert.deepEqual(find('xua'), ['Diễm xưa', 'Đường xưa'])
})

test('composer: có dấu, không dấu, hoa/thường', () => {
  for (const q of ['Trịnh Công Sơn', 'trinh cong son', 'TRINH CONG SON', 'trịnh'])
    assert.deepEqual(find(q), ['Diễm xưa', 'Ở trọ'], q)
})

test('decomposed (NFD) input from some keyboards still matches', () => {
  assert.deepEqual(find('Diễm xưa'.normalize('NFD')), ['Diễm xưa'])
})

test('empty query shows everything; nonsense shows nothing', () => {
  assert.equal(find('').length, items.length)
  assert.equal(find('   ').length, items.length)
  assert.deepEqual(find('xyzkhongco'), [])
})

test('metadata patch never touches the score or its hash', () => {
  const patch = metadataPatch('  Diễm xưa  ', '  Trịnh Công Sơn ')
  assert.deepEqual(Object.keys(patch).sort(), ['composer', 'title', 'updated_at'])
  assert.equal(patch.title, 'Diễm xưa')
  assert.equal(patch.composer, 'Trịnh Công Sơn')
  assert.equal(metadataPatch('A', '   ').composer, null)
  assert.throws(() => metadataPatch('   ', 'x'), /Tên bài/)
})
