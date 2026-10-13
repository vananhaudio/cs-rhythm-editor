import assert from 'node:assert/strict'
import test from 'node:test'
import { insertRow } from '../../src/thuvien/masterLibrary.ts'

const base = { title: 'Bài', composer: ' TG ', filename: 'a.musicxml', xml: '<x/>', contentHash: 'h', sizeBytes: 4, userId: 'u1' }

test('MusicXML INSERT: không chọn Band → payload y như bản cũ (không có band_id)', () => {
  assert.deepEqual(Object.keys(insertRow(base)).sort(), ['composer', 'content_hash', 'created_by', 'musicxml_text', 'original_filename', 'size_bytes', 'title'])
  assert.deepEqual(Object.keys(insertRow({ ...base, bandId: null })).includes('band_id'), false)
})

test('MusicXML INSERT: chọn Band → có band_id; created_by luôn là người gọi; nội dung không đổi', () => {
  const row = insertRow({ ...base, bandId: 'band-a' })
  assert.equal(row.band_id, 'band-a')
  assert.equal(row.created_by, 'u1')
  assert.equal(row.musicxml_text, '<x/>')
  assert.equal(row.composer, 'TG')
})
