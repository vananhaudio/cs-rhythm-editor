// Sửa hợp âm theo chữ hát — hàm thuần: vị trí đúng, lời + vạch nhịp bất biến, từ chối khi sẽ làm lệch chữ.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chordLineCells, normalizeChord, setChordAtToken } from '../../src/thuvien/chordEdit.ts'
import { buildMeasureDisplay, lyricTokens, parseAnchors, renderAnchors } from '../../src/thuvien/chordAnchors.ts'
import { canonicalChordText, listChords } from '../../src/thuvien/chordText.ts'

// Dữ liệu mẫu cho bài "Khói thuốc đợi chờ" (lời mẫu tự soạn để thử, KHÔNG phải lời thật): có nhãn, dấu tiếng Việt,
// nhiều hợp âm một dòng, hợp âm đầu/cuối dòng, hợp âm giữa chữ, dòng trống.
const SAMPLE = [
  '1. [Am] Khói thuốc đợi [Dm] chờ',
  'Ai [E7] về trong [Am] chiều',
  '',
  'ĐK: [C] Đêm nay [G] nhớ ai',
  'ti[Am]ễn nhau [E7] đi [Am]',
  '[F] Đầu dòng có hợp âm',
].join('\n')

const ok = (result: ReturnType<typeof setChordAtToken>) => {
  assert.equal(result.ok, true, result.ok ? '' : result.reason)
  return result.ok ? result.text : ''
}
const wordsOf = (text: string) => canonicalChordText(text).split('\n').map(line => { const view = lyricTokens(line); return [view.label, view.tokens.map(t => t.word)] })

test('cells: đúng chữ, đúng hợp âm, nhãn tách riêng, khớp lyricTokens', () => {
  for (const line of canonicalChordText(SAMPLE).split('\n')) {
    const cells = chordLineCells(line)
    const view = lyricTokens(line)
    assert.deepEqual(cells.filter(cell => cell.kind === 'label').map(cell => (cell as { text: string }).text), view.label ? [view.label] : [])
    const words = cells.filter(cell => cell.kind === 'word') as { token: number; word: string; chord: string | null }[]
    // lyricTokens có thể thêm một "chữ rỗng" mang hợp âm cuối dòng; ô 'word' chỉ có chữ thật.
    const real = view.tokens.filter(token => token.word !== '')
    assert.deepEqual(words.map(cell => cell.word), real.map(token => token.word), line)
    assert.deepEqual(words.map(cell => cell.chord), real.map(token => token.chord), line)
    assert.deepEqual(words.map(cell => cell.token), real.map((_, at) => at), line)
  }
})

test('cells: hợp âm cuối dòng và hợp âm bị che hiện ra dạng ô chỉ-hợp-âm; ti[Am]ễn dính liền', () => {
  const trailing = chordLineCells('ti[Am]ễn nhau [E7] đi [Am]')
  assert.deepEqual(trailing.map(cell => cell.kind), ['word', 'word', 'word', 'word', 'chord'])
  assert.deepEqual(trailing[1], { kind: 'word', token: 1, word: 'ễn', chord: 'Am', joined: true })
  assert.deepEqual(trailing[4], { kind: 'chord', chord: 'Am', token: 4 })
  const hidden = chordLineCells('[Am][E7] hết')
  assert.deepEqual(hidden, [{ kind: 'chord', chord: 'Am', token: null }, { kind: 'word', token: 0, word: 'hết', chord: 'E7', joined: false }])
})

const lineOf = (text: string, at: number) => canonicalChordText(text).split('\n')[at]
const otherLinesSame = (before: string, after: string, line: number) => {
  const a = canonicalChordText(before).split('\n')
  const b = canonicalChordText(after).split('\n')
  assert.equal(a.length, b.length)
  a.forEach((value, at) => { if (at !== line) assert.equal(b[at], value, `dòng ${at + 1} phải giữ nguyên từng byte`) })
}

test('thêm hợp âm vào chữ chưa có: chèn "[X] " ngay trước chữ, không đụng gì khác', () => {
  let text = ok(setChordAtToken(SAMPLE, 1, 2, 'G'))
  assert.equal(lineOf(text, 1), 'Ai [E7] về [G] trong [Am] chiều')
  otherLinesSame(SAMPLE, text, 1)
  text = ok(setChordAtToken(SAMPLE, 1, 0, 'G'))
  assert.equal(lineOf(text, 1), '[G] Ai [E7] về trong [Am] chiều', 'đầu dòng')
  text = ok(setChordAtToken(SAMPLE, 0, 1, 'D'))
  assert.equal(lineOf(text, 0), '1. [Am] Khói [D] thuốc đợi [Dm] chờ', 'sau nhãn 1. vẫn là chữ hát thứ 2')
  text = ok(setChordAtToken(SAMPLE, 4, 2, 'G'))
  assert.equal(lineOf(text, 4), 'ti[Am]ễn [G] nhau [E7] đi [Am]')
})

test('đổi hợp âm: giữ nguyên chỗ và khoảng trắng; hợp âm giữa chữ, cuối dòng, nhãn ĐK', () => {
  assert.equal(lineOf(ok(setChordAtToken(SAMPLE, 1, 1, 'B7')), 1), 'Ai [B7] về trong [Am] chiều')
  assert.equal(lineOf(ok(setChordAtToken(SAMPLE, 1, 3, 'F#m7b5')), 1), 'Ai [E7] về trong [F#m7b5] chiều', 'cuối dòng (chữ cuối)')
  assert.equal(lineOf(ok(setChordAtToken(SAMPLE, 3, 0, 'C7')), 3), 'ĐK: [C7] Đêm nay [G] nhớ ai', 'nhãn ĐK: không tính là chữ')
  assert.equal(lineOf(ok(setChordAtToken(SAMPLE, 4, 1, 'A')), 4), 'ti[A]ễn nhau [E7] đi [Am]', 'hợp âm giữa chữ')
  assert.equal(lineOf(ok(setChordAtToken(SAMPLE, 5, 0, ' C/G ')), 5), '[C/G] Đầu dòng có hợp âm', 'cắt khoảng trắng; hợp âm đầu dòng')
  const same = setChordAtToken(SAMPLE, 1, 1, 'E7')
  assert.deepEqual(same.ok && same.changed, false, 'đặt đúng hợp âm đang có = không đổi gì')
})

test('xoá hợp âm: bỏ ngoặc + một khoảng trắng phân cách', () => {
  assert.equal(lineOf(ok(setChordAtToken(SAMPLE, 1, 1, null)), 1), 'Ai về trong [Am] chiều')
  assert.equal(lineOf(ok(setChordAtToken(SAMPLE, 1, 3, null)), 1), 'Ai [E7] về trong chiều')
  assert.equal(lineOf(ok(setChordAtToken(SAMPLE, 5, 0, null)), 5), 'Đầu dòng có hợp âm', 'hợp âm đầu dòng')
  assert.equal(lineOf(ok(setChordAtToken(SAMPLE, 0, 0, null)), 0), '1. Khói thuốc đợi [Dm] chờ', 'sau nhãn')
  const none = setChordAtToken(SAMPLE, 1, 0, null)
  assert.deepEqual(none.ok && none.changed, false, 'xoá chỗ chưa có hợp âm = không đổi gì')
})

test('thêm rồi xoá trả đúng văn bản ban đầu', () => {
  const lines = canonicalChordText(SAMPLE).split('\n')
  lines.forEach((line, at) => {
    chordLineCells(line).forEach(cell => {
      if (cell.kind !== 'word' || cell.chord !== null || cell.joined) return
      const added = ok(setChordAtToken(SAMPLE, at, cell.token, 'G'))
      assert.equal(ok(setChordAtToken(added, at, cell.token, null)), canonicalChordText(SAMPLE), `dòng ${at + 1} chữ ${cell.token}`)
    })
  })
})

test('từ chối: xoá sẽ dính chữ hoặc biến chữ thành nhãn; hợp âm sai; chữ/dòng không có', () => {
  const glue = setChordAtToken(SAMPLE, 4, 1, null)
  assert.equal(glue.ok, false, 'xoá [Am] trong ti[Am]ễn làm "ti"+"ễn" dính thành một chữ')
  const label = setChordAtToken('[Am] ĐK: lời bài hát', 0, 0, null)
  assert.equal(label.ok, false, 'bỏ [Am] làm "ĐK:" thành nhãn → lệch số chữ')
  assert.equal(setChordAtToken(SAMPLE, 1, 0, 'A[m]').ok, false)
  assert.equal(setChordAtToken(SAMPLE, 1, 0, 'x'.repeat(17)).ok, false)
  assert.equal(setChordAtToken(SAMPLE, 1, 0, '').ok, false, 'tên rỗng không phải xoá — xoá là null')
  assert.equal(setChordAtToken(SAMPLE, 1, 9, 'G').ok, false)
  assert.equal(setChordAtToken(SAMPLE, 2, 0, 'G').ok, false, 'dòng trống không có chữ')
  assert.equal(setChordAtToken(SAMPLE, 99, 0, 'G').ok, false)
  assert.equal(normalizeChord('  Am7 '), 'Am7')
  assert.equal(normalizeChord('   '), null)
})

test('chuẩn hoá: CRLF, khoảng trắng cuối dòng, dòng trống đầu — số dòng theo lời chuẩn hoá như vạch nhịp', () => {
  const raw = '\r\n\r\n1. [Am] Khói thuốc   \r\nAi về\r\n'
  const text = ok(setChordAtToken(raw, 1, 1, 'G'))
  assert.equal(text, '1. [Am] Khói thuốc\nAi [G] về')
})

test('BẤT BIẾN: sửa hợp âm ở mọi chữ không đổi lời, số chữ, vạch nhịp, các dòng khác', () => {
  const anchors = { pickup: { line: 0, token: 0 }, measures: [{ line: 0, token: 0 }, { line: 0, token: 2 }, { line: 1, token: 0 }, { line: 1, token: 2 }, { line: 3, token: 0 }, { line: 4, token: 0 }, { line: 4, token: 2 }, { line: 4, token: 4 }, { line: 5, token: 0 }] }
  assert.ok(parseAnchors(anchors, SAMPLE), 'bộ vạch mẫu hợp lệ với lời mẫu')
  const bare = (text: string) => renderAnchors(text, parseAnchors(anchors, text)!).map(row => ({ bars: row.bars, label: row.label, text: row.text.replace(/\[[^\]]*\]\s?/g, '').replace(/\s+/g, ' ').trim() }))
  const baseline = bare(SAMPLE)
  let applied = 0
  canonicalChordText(SAMPLE).split('\n').forEach((line, at) => {
    chordLineCells(line).forEach(cell => {
      if (cell.kind !== 'word') return
      for (const chord of ['G', 'F#m7b5', 'C/G', null]) {
        const result = setChordAtToken(SAMPLE, at, cell.token, chord)
        if (!result.ok) continue
        applied += 1
        assert.deepEqual(wordsOf(result.text), wordsOf(SAMPLE), `lời đổi ở dòng ${at + 1} chữ ${cell.token}`)
        otherLinesSame(SAMPLE, result.text, at)
        assert.ok(parseAnchors(anchors, result.text), 'vạch nhịp vẫn hợp lệ theo lời mới')
        assert.deepEqual(bare(result.text), baseline, 'vạch nhịp vẫn đứng trước đúng chữ cũ')
        assert.deepEqual(buildMeasureDisplay(result.text, anchors)?.length, buildMeasureDisplay(SAMPLE, anchors).length)
        if (chord) assert.ok(listChords(result.text).includes(chord))
      }
    })
  })
  assert.ok(applied > 40, `đã thử ${applied} lần sửa`)
})
