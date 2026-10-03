import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createRhythmScroll, measuresAtSeconds, validateRhythmScrollData } from '../../src/rhythm-scroll/index.ts'
import type { RhythmScrollData } from '../../src/rhythm-scroll/index.ts'
import { CHUYEN_TAU_HOANG_HON_FIXTURE } from './fixtures/chuyen-tau-hoang-hon.ts'

const provenance = { sourceType: 'manual', sourceHash: 'h', generator: 'test', generatedAt: '2026-10-03T00:00:00Z' } as const
const song = (segments: RhythmScrollData['segments'], meter = { beats: 4, beatType: 4 }): RhythmScrollData => ({
  version: 1, songId: 'song-1', lyricsHash: 'lyrics-1', meter,
  totalMeasures: segments.reduce((sum, segment) => sum + segment.measureCount, 0),
  segments, provenance,
})
const SIMPLE = song([{ line: 0, measureCount: 4 }, { line: 1, measureCount: 4 }, { line: 2, measureCount: 4 }])
const close = (actual: number, expected: number, label?: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label ?? ''} ${actual} ≠ ${expected}`)
const paths = (input: unknown) => {
  const result = validateRhythmScrollData(input)
  return result.ok ? [] : result.issues.map(issue => issue.path)
}

// ── A. 4/4 đơn giản ──
test('A: 3 đoạn × 4 ô — đầu, giữa, cuối từng đoạn', () => {
  const scroll = createRhythmScroll(SIMPLE)
  assert.equal(scroll.totalMeasures, 12)
  assert.deepEqual(scroll.locate(0), { state: 'active', measureIndex: 0, measureProgress: 0, segmentIndex: 0, segmentProgress: 0, scrollProgress: 0 })
  assert.deepEqual(scroll.locate(2), { state: 'active', measureIndex: 2, measureProgress: 0, segmentIndex: 0, segmentProgress: 0.5, scrollProgress: 2 / 12 })
  const lateFirst = scroll.locate(3.75)
  assert.equal(lateFirst.segmentIndex, 0)
  assert.equal(lateFirst.measureIndex, 3)
  close(lateFirst.measureProgress, 0.75)
  close(lateFirst.segmentProgress, 3.75 / 4)
  assert.deepEqual(scroll.locate(4), { state: 'active', measureIndex: 4, measureProgress: 0, segmentIndex: 1, segmentProgress: 0, scrollProgress: 4 / 12 })
  const middle = scroll.locate(6.5)
  assert.deepEqual([middle.segmentIndex, middle.measureIndex, middle.measureProgress, middle.segmentProgress], [1, 6, 0.5, 0.625])
  const nearEnd = scroll.locate(11.999)
  assert.deepEqual([nearEnd.state, nearEnd.segmentIndex, nearEnd.measureIndex], ['active', 2, 11])
})

test('A: ví dụ trong đặc tả — 4.25 là 25% ô thứ 5', () => {
  const at = createRhythmScroll(SIMPLE).locate(4.25)
  assert.deepEqual([at.measureIndex, at.measureProgress], [4, 0.25])
})

test('A: scrollProgress liên tục, không giảm, không nhảy ở ranh giới đoạn', () => {
  const scroll = createRhythmScroll(SIMPLE)
  let previous = scroll.locate(-1)
  for (let step = 0; step <= 1300; step++) {
    const at = scroll.locate(step / 100)
    assert.ok(at.scrollProgress >= previous.scrollProgress, `giảm ở ${step / 100}`)
    assert.ok(at.scrollProgress - previous.scrollProgress <= 0.01 / 12 + 1e-12, `nhảy ở ${step / 100}`)
    for (const value of [at.measureProgress, at.segmentProgress, at.scrollProgress]) assert.ok(value >= 0 && value <= 1)
    assert.ok(at.segmentIndex >= previous.segmentIndex)
    previous = at
  }
})

// ── B. Dạo đầu ──
test('B: đoạn dạo (line = null) rồi chuyển đúng sang đoạn lời', () => {
  const data = song([{ line: null, measureCount: 2, label: 'Dạo' }, { line: 0, measureCount: 4 }, { line: 1, measureCount: 4 }])
  const scroll = createRhythmScroll(data)
  const segmentAt = (position: number) => data.segments[scroll.locate(position).segmentIndex]
  assert.equal(segmentAt(0).line, null)
  assert.equal(segmentAt(1.99).line, null)
  assert.equal(segmentAt(2).line, 0)
  assert.equal(scroll.locate(2).segmentProgress, 0)
  assert.equal(segmentAt(6).line, 1)
})

// ── C. Giây → ô nhịp ──
test('C: measuresAtSeconds — 4/4, 3/4 và 6/8 theo quy ước TeamLab', () => {
  assert.equal(measuresAtSeconds(4, 60, { beats: 4, beatType: 4 }), 1)
  assert.equal(measuresAtSeconds(3, 60, { beats: 3, beatType: 4 }), 1)
  assert.equal(measuresAtSeconds(10, 120, { beats: 4, beatType: 4 }), 5)
  // 6/8: BPM đếm theo móc đơn → BPM 60 thì một ô dài 6 giây; BPM 120 thì 3 giây.
  assert.equal(measuresAtSeconds(6, 60, { beats: 6, beatType: 8 }), 1)
  assert.equal(measuresAtSeconds(3, 120, { beats: 6, beatType: 8 }), 1)
  // Khớp công thức thước cũ của TeamRoom: SECONDS_PER_MEASURE = (60 / tempo) * beatsPerMeasure.
  for (const [tempo, beats] of [[72, 6], [90, 4], [100, 3], [64, 2]]) {
    close(measuresAtSeconds(((60 / tempo) * beats) * 7, tempo, { beats, beatType: beats === 6 ? 8 : 4 }), 7)
  }
  assert.equal(measuresAtSeconds(0, 90, { beats: 4, beatType: 4 }), 0)
  assert.equal(measuresAtSeconds(-2, 60, { beats: 4, beatType: 4 }), -0.5)
})

test('C: measuresAtSeconds từ chối NaN, Infinity, BPM ≤ 0 và nhịp sai', () => {
  const meter = { beats: 4, beatType: 4 }
  for (const seconds of [NaN, Infinity, -Infinity]) assert.throws(() => measuresAtSeconds(seconds, 60, meter), RangeError)
  for (const bpm of [0, -60, NaN, Infinity]) assert.throws(() => measuresAtSeconds(1, bpm, meter), RangeError)
  for (const bad of [{ beats: 0, beatType: 4 }, { beats: 4, beatType: 3 }, { beats: 2.5, beatType: 4 }, { beats: 4, beatType: 0 }]) {
    assert.throws(() => measuresAtSeconds(1, 60, bad), RangeError)
  }
})

test('C: giây → ô → locate đi trọn một đường', () => {
  const scroll = createRhythmScroll(SIMPLE)
  const at = scroll.locate(measuresAtSeconds(18, 60, SIMPLE.meter))
  assert.deepEqual([at.measureIndex, at.measureProgress, at.segmentIndex], [4, 0.5, 1])
})

// ── D. Biên ──
test('D: trước bài, đầu bài, giữa bài, đúng cuối bài, quá cuối bài', () => {
  const scroll = createRhythmScroll(SIMPLE)
  const before = { state: 'before', measureIndex: 0, measureProgress: 0, segmentIndex: 0, segmentProgress: 0, scrollProgress: 0 }
  const ended = { state: 'ended', measureIndex: 11, measureProgress: 1, segmentIndex: 2, segmentProgress: 1, scrollProgress: 1 }
  assert.deepEqual(scroll.locate(-0.001), before)
  assert.deepEqual(scroll.locate(-Infinity), before)
  assert.equal(scroll.locate(0).state, 'active')
  assert.equal(scroll.locate(6).state, 'active')
  assert.deepEqual(scroll.locate(12), ended)
  assert.deepEqual(scroll.locate(12.5), ended)
  assert.deepEqual(scroll.locate(Infinity), ended)
  assert.throws(() => scroll.locate(NaN), RangeError)
})

test('D: engine không đổi khi dữ liệu gốc bị sửa sau lúc dựng', () => {
  const data = structuredClone(SIMPLE)
  const scroll = createRhythmScroll(data)
  data.segments[0].measureCount = 99
  assert.equal(scroll.locate(4).segmentIndex, 1)
})

// ── E. Validation ──
test('E: dữ liệu hợp lệ PASS', () => {
  const result = validateRhythmScrollData(SIMPLE)
  assert.equal(result.ok, true)
  assert.equal(validateRhythmScrollData(song([{ line: 0, lineCount: 2, measureCount: 8, label: 'ĐK', confidence: 1 }], { beats: 6, beatType: 8 })).ok, true)
  assert.equal(validateRhythmScrollData({ ...SIMPLE, provenance: { ...provenance, sourceType: 'pdf', reviewedAt: '2026-10-04T08:00:00Z' } }).ok, true)
  // Điều kiện biên của dữ liệu thật: qua JSON vẫn hợp lệ.
  assert.equal(validateRhythmScrollData(JSON.parse(JSON.stringify(SIMPLE))).ok, true)
})

test('E: từng loại lỗi chỉ đúng trường sai', () => {
  const withSegment = (segment: object) => ({ ...SIMPLE, totalMeasures: 4, segments: [segment] })
  assert.deepEqual(paths({ ...SIMPLE, totalMeasures: 11 }), ['totalMeasures'])
  assert.deepEqual(paths(withSegment({ line: 0, measureCount: 0 })), ['segments[0].measureCount'])
  assert.deepEqual(paths(withSegment({ line: 0, measureCount: 1.5 })), ['segments[0].measureCount'])
  assert.deepEqual(paths(withSegment({ line: 0, measureCount: 4, confidence: 1.2 })), ['segments[0].confidence'])
  assert.deepEqual(paths(withSegment({ line: 0, measureCount: 4, confidence: -0.1 })), ['segments[0].confidence'])
  assert.deepEqual(paths(withSegment({ line: -1, measureCount: 4 })), ['segments[0].line'])
  assert.deepEqual(paths(withSegment({ measureCount: 4 })), ['segments[0].line'])
  assert.deepEqual(paths(withSegment({ line: 0, lineCount: 0, measureCount: 4 })), ['segments[0].lineCount'])
  assert.deepEqual(paths(withSegment({ line: null, lineCount: 2, measureCount: 4 })), ['segments[0].lineCount'])
  assert.deepEqual(paths({ ...SIMPLE, meter: { beats: 0, beatType: 4 } }), ['meter'])
  assert.deepEqual(paths({ ...SIMPLE, meter: { beats: 4, beatType: 3 } }), ['meter'])
  assert.deepEqual(paths({ ...SIMPLE, meter: undefined }), ['meter'])
  assert.deepEqual(paths({ ...SIMPLE, version: 2 }), ['version'])
  assert.deepEqual(paths({ ...SIMPLE, songId: '  ' }), ['songId'])
  assert.deepEqual(paths({ ...SIMPLE, lyricsHash: '' }), ['lyricsHash'])
  assert.deepEqual(paths({ ...SIMPLE, segments: [] }), ['segments'])
  assert.deepEqual(paths({ ...SIMPLE, provenance: { ...provenance, sourceType: 'ocr' } }), ['provenance.sourceType'])
  assert.deepEqual(paths({ ...SIMPLE, provenance: { ...provenance, generatedAt: 'hôm qua' } }), ['provenance.generatedAt'])
  assert.deepEqual(paths({ ...SIMPLE, provenance: { ...provenance, reviewedAt: '' } }), ['provenance.reviewedAt'])
  assert.deepEqual(paths({ ...SIMPLE, provenance: null }), ['provenance'])
  assert.deepEqual(paths(null), [''])
  assert.deepEqual(paths([]), [''])
})

test('E: gom mọi lỗi một lượt; createRhythmScroll từ chối dữ liệu sai', () => {
  const broken = { ...SIMPLE, version: 3, meter: { beats: 4, beatType: 5 }, segments: [{ line: 0, measureCount: 0 }] }
  assert.deepEqual(paths(broken), ['version', 'meter', 'segments[0].measureCount'])
  assert.throws(() => createRhythmScroll(broken), /segments\[0\]\.measureCount/)
  assert.throws(() => createRhythmScroll({ ...SIMPLE, totalMeasures: 13 }), RangeError)
})

// ── Fixture bài thật (số ô giả định) ──
test('fixture Chuyến Tàu Hoàng Hôn: dạo, nhiều dòng lời, điệp khúc lặp, đoạn 4 và 8 ô', () => {
  const data = CHUYEN_TAU_HOANG_HON_FIXTURE
  assert.equal(validateRhythmScrollData(data).ok, true)
  const scroll = createRhythmScroll(data)
  const segmentAt = (position: number) => data.segments[scroll.locate(position).segmentIndex]
  assert.equal(segmentAt(0).label, 'Dạo')
  assert.equal(segmentAt(4).line, 0)
  assert.equal(segmentAt(20).label, 'ĐK')
  assert.equal(scroll.locate(24).segmentProgress, 0.5)
  assert.equal(segmentAt(36).label, 'Gian tấu')
  assert.deepEqual([segmentAt(40).line, segmentAt(47.9).line], [4, 4])
  assert.equal(segmentAt(48).label, 'Kết')
  assert.equal(scroll.locate(52).state, 'ended')
})

// ── Kiến trúc: lõi không được kéo theo UI, engine ký âm hay hạ tầng ──
test('lõi chỉ import file trong chính src/rhythm-scroll và không đụng API trình duyệt/đồng hồ', () => {
  const directory = new URL('../../src/rhythm-scroll/', import.meta.url)
  const files = readdirSync(directory).filter(name => name.endsWith('.ts'))
  assert.deepEqual(files.sort(), ['engine.ts', 'index.ts', 'time.ts', 'types.ts', 'validate.ts'])
  for (const name of files) {
    const source = readFileSync(new URL(name, directory), 'utf8')
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(match => match[1])
    for (const target of imports) assert.match(target, /^\.\/[a-z]+\.ts$/, `${name} import ${target}`)
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    assert.doesNotMatch(code, /\b(window|document|navigator|localStorage|requestAnimationFrame|setTimeout|setInterval|performance|fetch|import\()/, name)
  }
})
