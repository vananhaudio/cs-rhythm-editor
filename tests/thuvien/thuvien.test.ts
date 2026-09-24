import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parseMusicXML } from '../../src/musicxml-beats/parser.ts'
import { prepareMusicXml } from '../../src/thuvien/masterLibrary.ts'

const realScore = readFileSync(new URL('../musicxml-export/fixtures/short.musicxml', import.meta.url), 'utf8')

test('accepts a real score with notes and suggests a title', () => {
  const prepared = prepareMusicXml('Bai-Mau.musicxml', realScore)
  assert.equal(prepared.metadata.title, 'Bai Mau')
  assert.equal(prepared.metadata.composer, null)
  assert.equal(prepared.sizeBytes, Buffer.byteLength(realScore))
  assert.equal(parseMusicXML(prepared.xml).parts[0].measures[0].events.filter(event => event.kind === 'note').length, 4)
})

test('rejects unsupported files and invalid MusicXML', () => {
  assert.throws(() => prepareMusicXml('score.mxl', realScore), /\.musicxml/)
  assert.throws(() => prepareMusicXml('score.musicxml', '<score-partwise>'), /MusicXML hợp lệ/)
  assert.throws(() => prepareMusicXml('score.musicxml', '<score-partwise/>'), /MusicXML hợp lệ/)
})
