// Timeline hợp âm theo phách trên BÀI THẬT — lời, PDF, MusicXML có bản quyền → NGOÀI git.
// Chạy khi có:
//   MEASURE_TINHCA_DIR  = thư mục có text.txt (lời + hợp âm chuẩn v7), tinh-ca.pdf (sheet nguồn)
//   MEASURE_TINHCA_XML  = score.xml MusicXML của Tình ca (thư viện bản nhạc) — CHỈ làm "đáp án" kiểm tra, không đi vào đường chạy
//   MEASURE_TESSDATA    = thư mục vie.traineddata
//   RHYTHM_CHUYENTAU_DIR = text.txt + anchors.json (bản chuẩn hiện hành của Chuyến tàu hoàng hôn)
// Thiếu biến → SKIP (không tính là PASS gate thật).
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { anchorLines, parseAnchors } from '../../src/thuvien/chordAnchors.ts'
import { analysisLineCounts, analysisTokenLengths } from '../../src/thuvien/measureAnalysis.ts'
import { buildChordTimeline, locateBeat, timelineProblems } from '../../src/thuvien/chordTimeline.ts'
import { runAnalyzerRaw } from './harness.ts'

const tinhCaDir = process.env.MEASURE_TINHCA_DIR
const tinhCaXml = process.env.MEASURE_TINHCA_XML
const tessdata = process.env.MEASURE_TESSDATA
const chuyenTauDir = process.env.RHYTHM_CHUYENTAU_DIR

/** Chuỗi hợp âm của lời chuẩn theo thứ tự đọc — thứ mà timeline KHÔNG được đổi. */
const textChords = (text: string) => anchorLines(text).flatMap(line => line.tokens.flatMap(token => (token.chord ? [token.chord] : [])))

/** Đáp án MusicXML: mỗi ô → thời điểm (phách) của từng nốt có lời 1 / lời 2, số phách của ô, số chỉ nhịp. */
function readOracle(xml: string) {
  const divisions = Number(/<divisions>(\d+)<\/divisions>/.exec(xml)?.[1])
  const meter = { beats: Number(/<beats>(\d+)<\/beats>/.exec(xml)?.[1]), beatType: Number(/<beat-type>(\d+)<\/beat-type>/.exec(xml)?.[1]) }
  const measures = [...xml.matchAll(/<measure\b[\s\S]*?<\/measure>/g)].map(match => {
    let at = 0
    const lyrics: Record<string, number[]> = { 1: [], 2: [] }
    for (const el of match[0].matchAll(/<(note|backup|forward)\b[\s\S]*?<\/\1>/g)) {
      const duration = Number(/<duration>(\d+)<\/duration>/.exec(el[0])?.[1] ?? 0)
      if (el[1] === 'backup') { at -= duration; continue }
      if (el[1] === 'forward') { at += duration; continue }
      if (/<chord\s*\/>/.test(el[0])) continue
      if (!/<rest\b/.test(el[0])) {
        for (const lyric of el[0].matchAll(/<lyric\b[^>]*number="(\d+)"[^>]*>[\s\S]*?<text>([^<]*)<\/text>/g)) if (lyric[2].trim()) lyrics[lyric[1]]?.push(at / divisions)
      }
      at += duration
    }
    return { beats: at / divisions, v1: lyrics[1], v2: lyrics[2] }
  })
  return { meter, measures }
}

test('GOLD Tình ca: sheet thật → 80 ô → timeline 160 phách 2/4; hợp âm khớp onset thật của MusicXML', { skip: (!tinhCaDir || !tinhCaXml || !tessdata) && 'thiếu MEASURE_TINHCA_DIR / MEASURE_TINHCA_XML / MEASURE_TESSDATA' }, async () => {
  const text = readFileSync(join(tinhCaDir!, 'text.txt'), 'utf8')
  const raw = await runAnalyzerRaw({ sources: [{ path: join(tinhCaDir!, 'tinh-ca.pdf'), mime: 'application/pdf' }], lineTokenCounts: analysisLineCounts(text), lineTokenLengths: analysisTokenLengths(text),
    lineWords: anchorLines(text).map(line => line.tokens.map(token => token.word)), ocr: { tessdataDir: tessdata } }) as { ok: boolean; anchors: unknown }
  assert.equal(raw.ok, true, 'đọc được sheet thật')
  const anchors = parseAnchors(raw.anchors, text)
  assert.ok(anchors, 'anchors khớp lời chuẩn')
  const oracle = readOracle(readFileSync(tinhCaXml!, 'utf8'))

  // Sheet (MusicXML) là bằng chứng của số phách: 2/4, 40 ô đầy đủ, KHÔNG nhịp lấy đà.
  assert.deepEqual(oracle.meter, { beats: 2, beatType: 4 })
  assert.equal(oracle.measures.length, 40)
  assert.ok(oracle.measures.every(m => m.beats === 2), 'mọi ô của sheet đúng 2 phách (không lấy đà)')

  const timeline = buildChordTimeline(text, anchors!, oracle.meter)
  assert.deepEqual(timelineProblems(timeline), [])
  assert.equal(timeline.pickupBeats, 0)
  assert.equal(timeline.measures.length, 80, '40 ô lời 1 + 40 ô lời 2')
  assert.equal(timeline.totalBeats, 160, '80 ô × 2 phách — khớp cấu trúc ô nhịp của sheet, hai lượt hát')
  assert.equal(timeline.totalBeats, oracle.measures.reduce((sum, m) => sum + m.beats, 0) * 2)
  // Giữ nguyên chuỗi hợp âm của Hợp Âm Việt.
  assert.deepEqual(timeline.events.map(e => e.chord), textChords(text))
  // Mỗi ô bắt đầu đúng ở bội số 2: không trôi.
  assert.ok(timeline.measures.every((m, i) => m.startBeat === i * 2))
  // Mỗi lần đổi hợp âm ở một mốc phách nguyên xác định.
  assert.ok(timeline.events.every(e => Number.isInteger(e.startBeat) && e.beats >= 1))

  // Đối chiếu từng hợp âm GIỮA ô với onset thật của nốt mang chữ đó (khi sheet và lời chuẩn cùng số chữ trong ô).
  let checked = 0
  const unchecked: number[] = []
  for (const measure of timeline.measures) {
    const onsets = oracle.measures[measure.index % 40][measure.index < 40 ? 'v1' : 'v2']
    for (const change of measure.changes) {
      if (onsets.length !== measure.tokenCount) { unchecked.push(measure.index); continue }
      const onset = onsets[change.ordinal]
      assert.ok(Math.floor(onset) === change.beat || Math.round(onset) === change.beat, `ô ${measure.index + 1}: ${change.chord} đặt ở phách ${change.beat}, nốt thật ở ${onset}`)
      checked += 1
    }
  }
  assert.ok(checked >= 50, `đối chiếu ≥ 50 hợp âm với sheet (thực tế ${checked})`)
  // Ô nào chưa đối chiếu được thì phải còn nằm trong danh sách "chưa xác minh" HOẶC có hợp âm ở chữ đầu ô.
  for (const index of new Set(unchecked)) {
    const measure = timeline.measures[index]
    assert.ok(measure.verified || timeline.unverifiedMeasures.includes(index))
  }

  // Ball + cuộn lời + hợp âm cùng một timeline: duyệt cả bài, vị trí đơn điệu, hợp âm đang vang luôn khớp sự kiện.
  let last = -Infinity
  for (let beat = 0; beat < timeline.totalBeats; beat += 0.125) {
    const at = locateBeat(timeline, beat)
    assert.ok(at.measurePosition >= last)
    last = at.measurePosition
    assert.equal(Math.floor(at.measurePosition), at.measureIndex)
    const event = timeline.events[at.chordIndex]
    assert.ok(event.startBeat <= beat && beat < event.startBeat + event.beats)
  }
})

test('Chuyến tàu hoàng hôn (bản chuẩn hiện hành, 4/4 + lấy đà): timeline bảo toàn cấu trúc nhịp và chuỗi hợp âm', { skip: (!chuyenTauDir || !existsSync(join(chuyenTauDir, 'text.txt'))) && 'thiếu RHYTHM_CHUYENTAU_DIR' }, () => {
  const text = readFileSync(join(chuyenTauDir!, 'text.txt'), 'utf8')
  const anchors = parseAnchors(JSON.parse(readFileSync(join(chuyenTauDir!, 'anchors.json'), 'utf8')), text)
  assert.ok(anchors)
  const timeline = buildChordTimeline(text, anchors!, { beats: 4, beatType: 4 })
  assert.deepEqual(timelineProblems(timeline), [])
  assert.equal(timeline.measures.length, 49, 'lấy đà + 48 ô')
  assert.equal(timeline.measures[0].isPickup, true)
  assert.equal(timeline.totalBeats, timeline.pickupBeats + 48 * 4)
  assert.deepEqual(timeline.events.map(e => e.chord), textChords(text))
  assert.ok(timeline.measures.slice(1).every((m, i) => m.startBeat === timeline.pickupBeats + i * 4), 'không trôi nhịp')
  assert.ok(timeline.warnings.some(w => w.code === 'pickup_inferred'), 'số phách lấy đà là suy luận và được báo')
})
