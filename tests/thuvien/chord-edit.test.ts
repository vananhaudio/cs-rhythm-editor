// Sửa hợp âm theo chữ hát — hàm thuần: vị trí đúng, lời + vạch nhịp bất biến, từ chối khi sẽ làm lệch chữ.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { REST, appendRestToEmptyLine, chordLineCells, insertRest, normalizeChord, nudgeMeasure, remapAnchorsForInsert, remapAnchorsForRemove, removeRest, sameLyricStructure, setChordAtToken } from '../../src/thuvien/chordEdit.ts'
import { buildMeasureDisplay, lyricTokens, parseAnchors, renderAnchors } from '../../src/thuvien/chordAnchors.ts'
import { buildChordTimeline } from '../../src/thuvien/chordTimeline.ts'
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

// ── Vị trí nghỉ "(-)" (M1) ──────────────────────────────────────────────────────────────────────
const ok2 = (result: ReturnType<typeof insertRest>) => { assert.equal(result.ok, true, result.ok ? '' : result.reason); return result.ok ? result : (undefined as never) }
const L = (text: string) => lyricTokens(text).tokens.map(t => `${t.chord ?? ''}|${t.word}`)

test('"(-)" là MỘT token ở parser TS; con số khớp kết quả chord_lyric_token_counts của SQL đã đối chiếu trên DB tạm', () => {
  // Giá trị bên phải = đầu ra thật của public.chord_lyric_token_counts trên Postgres tạm (10/10/2026).
  const cases: [string, number][] = [
    ['[Am]Chiều [E7](-) [Dm]một mình qua phố', 6], ['[Am](-) [Dm](-) [E7](-) [Am](-)', 4], ['(-) [C] Lời', 2],
    ['Lời (-)', 2], ['1. (-) [G] x', 2], ['ĐK: [Am](-) [F](-)', 2], ['(-)', 1], ['[Am]Chiều một mình qua phố', 5],
  ]
  for (const [line, count] of cases) assert.equal(lyricTokens(line).tokens.length, count, line)
  assert.deepEqual(L('[Am]Chiều [E7](-) [Dm]một'), ['Am|Chiều', 'E7|(-)', 'Dm|một'])
  assert.deepEqual(L('[Am](-) [Dm](-) [E7](-) [Am](-)'), ['Am|(-)', 'Dm|(-)', 'E7|(-)', 'Am|(-)'], 'không gộp các vị trí nghỉ liên tiếp')
})

test('chèn nghỉ trước / sau chữ: hợp âm ở lại với chữ cũ, (-) không mang hợp âm; lời thật không đổi', () => {
  const base = '[Am]Chiều một mình qua phố'
  assert.equal(ok2(insertRest(base, 0, 1, 'after')).text, '[Am]Chiều một (-) mình qua phố')
  assert.equal(ok2(insertRest(base, 0, 0, 'before')).text, '(-) [Am]Chiều một mình qua phố', 'nghỉ trước lời; hợp âm vẫn ở trên "Chiều"')
  assert.equal(ok2(insertRest(base, 0, 4, 'after')).text, '[Am]Chiều một mình qua phố (-)', 'nghỉ sau lời')
  const text = ok2(insertRest('Chiều [Dm] một', 0, 1, 'before')).text
  assert.equal(text, 'Chiều (-) [Dm] một')
  assert.deepEqual(L(text), ['|Chiều', '|(-)', 'Dm|một'])
})

test('nhiều vị trí nghỉ liên tiếp + đặt/đổi/xoá hợp âm trên (-) bằng công cụ hợp âm hiện có', () => {
  let text = 'Chiều một'
  text = ok2(insertRest(text, 0, 0, 'after')).text            // Chiều (-) một
  text = ok2(insertRest(text, 0, 1, 'after')).text            // Chiều (-) (-) một
  text = ok2(insertRest(text, 0, 2, 'after')).text            // Chiều (-) (-) (-) một
  assert.equal(text, 'Chiều (-) (-) (-) một')
  assert.deepEqual(L(text), ['|Chiều', '|(-)', '|(-)', '|(-)', '|một'], 'ba vị trí nghỉ = ba token riêng')
  const a = setChordAtToken(text, 0, 2, 'E7'); assert.equal(a.ok && a.text, 'Chiều (-) [E7] (-) (-) một')
  const b = setChordAtToken((a as { text: string }).text, 0, 2, 'F'); assert.equal(b.ok && b.text, 'Chiều (-) [F] (-) (-) một')
  const c = setChordAtToken((b as { text: string }).text, 0, 2, null); assert.equal(c.ok && c.text, 'Chiều (-) (-) (-) một')
  assert.deepEqual(chordLineCells('Chiều (-) [E7] (-)').map(cell => cell.kind === 'word' ? `${cell.chord ?? ''}|${cell.word}` : cell.kind), ['|Chiều', '|(-)', 'E7|(-)'])
})

test('xoá vị trí nghỉ: bỏ (-) cùng hợp âm trên nó, giữ nguyên lời; không xoá được chữ thường', () => {
  assert.equal((removeRest('[Am]Chiều [E7](-) [Dm]một', 0, 1) as { text: string }).text, '[Am]Chiều [Dm]một')
  assert.equal((removeRest('Lời (-)', 0, 1) as { text: string }).text, 'Lời')
  assert.equal((removeRest('(-)', 0, 0) as { text: string }).text, '')
  assert.equal((removeRest('Chiều (-) (-) một', 0, 1) as { text: string }).text, 'Chiều (-) một', 'chỉ xoá đúng một vị trí')
  assert.equal(removeRest('Chiều (-) một', 0, 0).ok, false, 'không xoá chữ hát thật')
  assert.equal(removeRest('Chiều (-) một', 0, 7).ok, false)
})

test('nghỉ trong đoạn không có lời: dòng trống / dòng chỉ có nhãn', () => {
  const text = 'Chiều một\n\nDạo:\n[Am] lời'
  const blank = ok2(appendRestToEmptyLine(text, 1))
  assert.equal(blank.text.split('\n')[1], '(-)')
  const label = ok2(appendRestToEmptyLine(blank.text, 2))
  assert.equal(label.text.split('\n')[2], 'Dạo: (-)')
  assert.deepEqual(lyricTokens('Dạo: (-)').label, 'Dạo:', 'nhãn vẫn là nhãn, (-) là token đầu')
  assert.equal(appendRestToEmptyLine(text, 0).ok, false, 'dòng đã có chữ thì không dùng đường này')
})

test('chèn/xoá nghỉ không đổi dòng khác, không đổi lời; chèn rồi xoá trả đúng văn bản cũ', () => {
  const lines = canonicalChordText(SAMPLE).split('\n')
  let tried = 0
  lines.forEach((line, at) => {
    chordLineCells(line).forEach(cell => {
      if (cell.kind !== 'word') return
      for (const side of ['before', 'after'] as const) {
        const result = insertRest(SAMPLE, at, cell.token, side)
        if (!result.ok) continue
        tried += 1
        otherLinesSame(SAMPLE, result.text, at)
        const without = lyricTokens(canonicalChordText(result.text).split('\n')[at]).tokens.filter((_, i) => i !== result.at).map(t => t.word)
        assert.deepEqual(without, lyricTokens(line).tokens.map(t => t.word), 'lời thật giữ nguyên, thêm đúng một (-)')
        const back = removeRest(result.text, at, result.at)
        assert.equal(back.ok && back.text, canonicalChordText(SAMPLE), `${side} dòng ${at + 1} chữ ${cell.token}`)
      }
    })
  })
  assert.ok(tried > 30, `đã thử ${tried}`)
})

test('đồng bộ vạch nhịp khi chèn nghỉ: chỉ dịch vạch cùng dòng ở phía sau; vạch ngay khe chèn được báo (atGap)', () => {
  const anchors = { measures: [{ line: 0, token: 0 }, { line: 0, token: 2 }, { line: 1, token: 0 }, { line: 1, token: 2 }, { line: null, token: null }] }
  // chèn SAU chữ 0 của dòng 0 (nghỉ mới ở token 1): vạch ở token 2 → 3; dòng 1 không đổi; ô không lời không đổi
  const a = remapAnchorsForInsert(anchors, 0, 1, 'after')
  assert.deepEqual(a.anchors.measures, [{ line: 0, token: 0 }, { line: 0, token: 3 }, { line: 1, token: 0 }, { line: 1, token: 2 }, { line: null, token: null }])
  assert.deepEqual(a.atGap, [], 'không có vạch ngay khe chèn')
  // chèn TRƯỚC chữ 2 (token mới = 2), đang có vạch đúng ở 2: vạch ở lại trước (-) và được báo
  const b = remapAnchorsForInsert(anchors, 0, 2, 'before')
  assert.deepEqual(b.anchors.measures[1], { line: 0, token: 2 })
  assert.deepEqual(b.atGap, [1])
  // chèn SAU chữ 1 (token mới = 2), vạch tại 2 dời ra sau (-) và được báo
  const c = remapAnchorsForInsert(anchors, 0, 2, 'after')
  assert.deepEqual(c.anchors.measures[1], { line: 0, token: 3 })
  assert.deepEqual(c.atGap, [1])
  // nhịp lấy đà cùng dòng cũng được dịch
  const p = remapAnchorsForInsert({ pickup: { line: 0, token: 3 }, measures: [{ line: 0, token: 4 }] }, 0, 1, 'after')
  assert.deepEqual(p.anchors.pickup, { line: 0, token: 4 })
})

test('đồng bộ vạch nhịp khi xoá nghỉ; ô chỉ có (-) bị gộp thành ô ngân thì được báo (merged)', () => {
  const anchors = { measures: [{ line: 0, token: 0 }, { line: 0, token: 2 }, { line: 0, token: 3 }, { line: 1, token: 0 }] }
  const r = remapAnchorsForRemove(anchors, 0, 2)    // xoá token 2
  assert.deepEqual(r.anchors.measures, [{ line: 0, token: 0 }, { line: 0, token: 2 }, { line: 0, token: 2 }, { line: 1, token: 0 }])
  assert.deepEqual(r.merged, [2], 'ô 3 trùng vị trí ô 2 → thành ô ngân, phải xem lại')
  const clean = remapAnchorsForRemove({ measures: [{ line: 0, token: 0 }, { line: 0, token: 4 }] }, 0, 1)
  assert.deepEqual(clean.anchors.measures, [{ line: 0, token: 0 }, { line: 0, token: 3 }])
  assert.deepEqual(clean.merged, [])
})

test('BẤT BIẾN vạch nhịp: sau chèn/xoá nghỉ, mỗi vạch vẫn đứng trước đúng chữ cũ (trừ vạch ngay khe chèn đã được báo)', () => {
  const text = 'Chiều [Am] một mình\nQua [Dm] phố [E7] vắng tanh em ơi'
  const tokens = (t: string) => canonicalChordText(t).split('\n').map(line => lyricTokens(line).tokens.map(x => x.word))
  const anchors = { measures: [{ line: 0, token: 0 }, { line: 0, token: 2 }, { line: 1, token: 0 }, { line: 1, token: 3 }, { line: 1, token: 5 }] }
  assert.ok(parseAnchors(anchors, text))
  const before = tokens(text)
  for (const line of [0, 1]) for (let token = 0; token < before[line].length; token += 1) for (const side of ['before', 'after'] as const) {
    const edit = insertRest(text, line, token, side)
    if (!edit.ok) continue
    const remap = remapAnchorsForInsert(anchors, edit.line, edit.at, side)
    assert.ok(parseAnchors(remap.anchors, edit.text), 'vạch hợp lệ theo lời mới')
    const after = tokens(edit.text)
    anchors.measures.forEach((anchor, index) => {
      const mapped = remap.anchors.measures[index]
      if (remap.atGap.includes(index)) return
      assert.equal(after[mapped.line!][mapped.token!] ?? '(cuối dòng)', before[anchor.line!][anchor.token!] ?? '(cuối dòng)', `ô ${index + 1}`)
    })
    // xoá lại → vạch về đúng như ban đầu
    const removed = removeRest(edit.text, edit.line, edit.at)
    assert.equal(removed.ok, true)
    const back = remapAnchorsForRemove(remap.anchors, edit.line, edit.at)
    if (remap.atGap.length === 0) assert.deepEqual(back.anchors, anchors, `chèn rồi xoá (${line},${token},${side})`)
  }
})

test('nudge vạch: dịch trong dòng, sang mép dòng kế, không dịch ô không lời / ra khỏi bài', () => {
  const counts = [3, 0, 2]
  const m = [{ line: 0, token: 1 }, { line: 0, token: 3 }, { line: 2, token: 0 }, { line: null, token: null }]
  assert.deepEqual(nudgeMeasure(m, 0, 1, counts)![0], { line: 0, token: 2 })
  assert.deepEqual(nudgeMeasure(m, 0, -1, counts)![0], { line: 0, token: 0 })
  assert.deepEqual(nudgeMeasure(m, 1, 1, counts)![1], { line: 2, token: 0 }, 'qua dòng trống sang dòng có chữ kế')
  assert.deepEqual(nudgeMeasure(m, 2, -1, counts)![2], { line: 0, token: 3 })
  assert.equal(nudgeMeasure(m, 3, 1, counts), null)
  assert.equal(nudgeMeasure([{ line: 0, token: 0 }], 0, -1, [3]), null)
  assert.deepEqual(m[0], { line: 0, token: 1 }, 'không đổi mảng gốc')
})

test('sameLyricStructure: chỉ khác hợp âm/khoảng trắng → true; đổi/thêm/bớt chữ → false', () => {
  assert.equal(sameLyricStructure('Chiều [Am] một', 'Chiều một [E7]'.replace(' [E7]', '')), true)
  assert.equal(sameLyricStructure('Chiều [Am] một', '[C] Chiều một'), true)
  assert.equal(sameLyricStructure('Chiều một', 'Chiều (-) một'), false)
  assert.equal(sameLyricStructure('Chiều một', 'Chiều hai'), false)
})

test('Rhythm Scroll: timeline nhận đủ hợp âm tại các vị trí nghỉ, đúng phách theo ô', () => {
  // 4/4; ô 1 = "[Am]Chiều [E7](-) [Dm]một"; ô 2 = bốn nghỉ mang bốn hợp âm; ô 3 = (-) không hợp âm giữ hợp âm trước
  const text = '[Am]Chiều [E7](-) [Dm]một mình\n[Am](-) [Dm](-) [E7](-) [Am](-)\n(-)'
  const anchors = { measures: [{ line: 0, token: 0 }, { line: 1, token: 0 }, { line: 2, token: 0 }] }
  assert.ok(parseAnchors(anchors, text))
  const timeline = buildChordTimeline(text, anchors, { beats: 4, beatType: 4 })
  assert.deepEqual(timeline.events.map(e => [e.chord, e.startBeat, e.line, e.token]),
    [['Am', 0, 0, 0], ['E7', 1, 0, 1], ['Dm', 2, 0, 2], ['Am', 4, 1, 0], ['Dm', 5, 1, 1], ['E7', 6, 1, 2], ['Am', 7, 1, 3]],
    'ô 1 có 4 token (Chiều, (-), một, mình) → hợp âm đổi ở phách 0/1/2; ô 2 bốn nghỉ → phách 4/5/6/7; ô 3 chỉ có (-) không hợp âm nên không sinh sự kiện mới')
  assert.equal(timeline.totalBeats, 12)
})
