#!/usr/bin/env node
// ── MusicXML (lead sheet giai điệu) → alphaTex cho Solo Guitar ──
// Dùng khi soạn giáo trình: nhận bản nhạc giai điệu + lời + hợp âm của thầy,
// chọn thế bấm trên cần đàn rồi xuất alphaTex (khuông + TAB) cho LessonScore.
//
//   node scripts/musicxml-to-alphatex.mjs <file.mxl|file.xml> [--transpose -7]
//        [--max-fret 17] [--no-lyrics] [--no-chords] [--bars 1-16]
//        [--chord-sheet <file.txt>]   ← dùng bộ hợp âm do THẦY viết thay cho hợp âm trong XML
//        [--bass]                     ← chèn nốt Bass (gốc hợp âm, dây 4–6, thế I) tại mỗi lần đổi hợp âm
//        [--slide]                    ← đánh dấu trượt ngón ở chỗ ĐỔI VÙNG trên cùng một dây
//        [--slide-at "3,7"]           ← chỉ định thẳng những ô nhịp muốn có trượt ngón
//
// Guitar ghi cao hơn tiếng thật 1 quãng tám (chuẩn ký âm guitar) ⇒ giữ nguyên
// cao độ viết trong MusicXML, chỉ dịch giọng theo --transpose.
import { readFileSync } from 'node:fs'
import { DOMParser } from '@xmldom/xmldom'
import { execFileSync } from 'node:child_process'

const OPEN = [64, 59, 55, 50, 45, 40]          // midi dây buông: [dây 1 … dây 6]
const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const DUR_TEX = { 4: 1, 2: 2, 1: 4, 0.5: 8, 0.25: 16, 0.125: 32 }
const KIND_SUFFIX = {
  major: '', minor: 'm', dominant: '7', 'major-seventh': 'maj7', 'minor-seventh': 'm7',
  diminished: 'dim', augmented: 'aug', 'suspended-fourth': 'sus4', 'suspended-second': 'sus2',
  'half-diminished': 'm7b5', 'minor-sixth': 'm6', 'major-sixth': '6', none: '',
}

const argv = process.argv.slice(2)
const file = argv[0]
const opt = (name, def = null) => {
  const i = argv.indexOf('--' + name)
  return i >= 0 ? argv[i + 1] : def
}
const flag = name => argv.includes('--' + name)
if (!file) { console.error('Thiếu đường dẫn file MusicXML'); process.exit(1) }

const transpose = parseInt(opt('transpose', '0'), 10)
const maxFret = parseInt(opt('max-fret', '17'), 10)
const barRange = opt('bars')

// .mxl = zip → lấy score.xml bên trong
function readXml(p) {
  if (!p.toLowerCase().endsWith('.mxl')) return readFileSync(p, 'utf8')
  const list = execFileSync('unzip', ['-Z1', p]).toString().trim().split('\n')
  const entry = list.find(n => n.endsWith('.xml') && !n.startsWith('META-INF')) ?? 'score.xml'
  return execFileSync('unzip', ['-p', p, entry]).toString()
}

// ── Chord sheet của thầy: "Dài tay em mấy[A7] thuở mắt xanh xao [Dm]" ──
// Luật neo: dấu ngoặc DÍNH ngay sau một chữ ⇒ hợp âm rơi vào chữ đó;
// có dấu cách trước ngoặc ⇒ rơi vào chữ ĐỨNG SAU; hết dòng thì lùi về chữ trước.
// Một chữ đã nhận hợp âm rồi thì hợp âm kế tiếp dời sang nốt sau (vd "sâu[Am] [E]").
const norm = w => w.toLowerCase().replace(/[.,;:!?"'()]/g, '').trim()
function readChordSheet(path) {
  const out = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const re = /\[([^\]\n]+)\]?/g
    let m
    while ((m = re.exec(line)) !== null) {
      const chord = m[1].trim()
      // Bỏ các ngoặc hợp âm khác đi rồi mới lấy chữ trước/sau, nếu không
      // "sâu[Am] [E]" sẽ đọc ra chữ "sâu[Am]".
      const before = line.slice(0, m.index).replace(/\[[^\]]*\]/g, ' ')
      const after = line.slice(m.index + m[0].length).replace(/\[[^\]]*\]/g, ' ')
      const attached = /\S$/.test(before)
      const nextWord = (after.match(/^\s*([^\s\[]+)/) ?? [])[1]
      const prevWord = (before.match(/(\S+)\s*$/) ?? [])[1]
      const word = attached ? prevWord : (nextWord ?? prevWord)
      if (word && chord) out.push({ word: norm(word), chord, afterWord: attached || !nextWord })
    }
  }
  return out
}
const chordSheet = opt('chord-sheet') ? readChordSheet(opt('chord-sheet')) : null

const doc = new DOMParser().parseFromString(readXml(file), 'text/xml')
const one = (el, tag) => el.getElementsByTagName(tag)[0] ?? null
const txt = (el, tag) => one(el, tag)?.textContent?.trim() ?? ''
const kids = (el, tag) => Array.from(el.childNodes ?? []).filter(n => n.nodeName === tag)

const part = doc.getElementsByTagName('part')[0]
const measures = Array.from(part.getElementsByTagName('measure'))

let divisions = 1, fifths = 0, beats = 4, beatType = 4

// ── 1. Đọc giai điệu: mỗi ô nhịp → danh sách "beat" (nốt / lặng) ──
const bars = []
for (const m of measures) {
  const attrs = one(m, 'attributes')
  if (attrs) {
    if (txt(attrs, 'divisions')) divisions = +txt(attrs, 'divisions')
    const k = one(attrs, 'key'); if (k) fifths = +txt(k, 'fifths')
    const t = one(attrs, 'time'); if (t) { beats = +txt(t, 'beats'); beatType = +txt(t, 'beat-type') }
  }
  const bar = { items: [], repeatOpen: false, repeatClose: 0 }
  for (const bl of m.getElementsByTagName('barline')) {
    const rep = one(bl, 'repeat')
    if (!rep) continue
    if (rep.getAttribute('direction') === 'forward') bar.repeatOpen = true
    else bar.repeatClose = +(rep.getAttribute('times') || 2)
  }

  let pendingChord = null
  let barPos = 0                      // vị trí trong ô nhịp, tính bằng phách (nốt đen = 1)
  for (const node of Array.from(m.childNodes)) {
    if (node.nodeName === 'harmony') {
      const step = txt(node, 'root-step')
      if (step) {
        const alter = +(txt(node, 'root-alter') || 0)
        // <kind text="m">minor</kind> — thuộc tính text ĐÃ LÀ hậu tố hiển thị, dùng thẳng;
        // không có thì mới tra bảng theo tên kind.
        const kindEl = one(node, 'kind')
        const shown = kindEl?.getAttribute('text')
        const suffix = shown != null && shown !== '' ? shown : (KIND_SUFFIX[txt(node, 'kind') || 'major'] ?? '')
        pendingChord = { pc: (STEP[step] + alter + transpose + 120) % 12, suffix }
      }
      continue
    }
    if (node.nodeName !== 'note') continue
    if (one(node, 'grace')) continue
    const voice = txt(node, 'voice') || '1'
    if (voice !== '1') continue
    const isChordNote = !!one(node, 'chord')          // nốt chồng → giữ nốt trên cùng
    const durDiv = +(txt(node, 'duration') || 0)
    const beatsVal = durDiv / divisions                // 1.0 = nốt đen
    const rest = !!one(node, 'rest')
    const pitchEl = one(node, 'pitch')
    let midi = null
    if (pitchEl) {
      const st = txt(pitchEl, 'step'), oct = +txt(pitchEl, 'octave')
      const alt = +(txt(pitchEl, 'alter') || 0)
      midi = 12 * (oct + 1) + STEP[st] + alt + transpose
    }
    const tm = one(node, 'time-modification')
    const tuplet = tm ? +txt(tm, 'actual-notes') : 1
    const tieStop = Array.from(node.getElementsByTagName('tie')).some(t => t.getAttribute('type') === 'stop')
    // Lấy lời BÈ 1 (file của thầy hay có 2 lời chồng nhau)
    const lyricEls = Array.from(node.getElementsByTagName('lyric'))
    const lyricEl = lyricEls.find(l => (l.getAttribute('number') || '1') === '1') ?? lyricEls[0]
    const lyric = lyricEl ? (one(lyricEl, 'text')?.textContent?.trim() || null) : null

    if (isChordNote) {
      const last = bar.items[bar.items.length - 1]
      if (last && midi != null && (last.midi == null || midi > last.midi)) last.midi = midi
      continue
    }
    bar.items.push({ midi: rest ? null : midi, beats: beatsVal, tuplet, tieStop, lyric,
                     chord: pendingChord, at: barPos })
    barPos += beatsVal
    pendingChord = null
  }
  bars.push(bar)
}

// ── 2. Xếp nốt THEO VÙNG của bản đồ (Vùng 1 / 2 / 3) ──
// Không chọn thế bấm theo từng nốt rời rạc: tìm chuỗi VÙNG rẻ nhất cho cả bài
// (Viterbi) để tay trái đứng yên trong một vùng càng lâu càng tốt, chỉ chuyển
// vùng khi thật sự cần. Trong một vùng thì ưu tiên dây 1–3 — dây 4–6 để dành
// cho Bass/hợp âm sẽ thêm ở các buổi sau.
const ZONES = (opt('zones', '0-4:1-6,5-9:1-3,10-17:1-2')).split(',').map((z, i) => {
  const [frets, strings] = z.split(':')
  const [f0, f1] = frets.split('-').map(Number)
  const [s0, s1] = strings.split('-').map(Number)
  return { no: i + 1, f0, f1, s0, s1 }
})
const SHIFT_COST = parseFloat(opt('shift-cost', '2.5'))   // giá của một lần chuyển vùng

// Vị trí rẻ nhất của một nốt TRONG một vùng (null nếu vùng không chơi được nốt đó)
// Cho phép DUỖI NGÓN 1 ngăn ra ngoài vùng (ngón 4 với tới) với một chút giá —
// rẻ hơn hẳn việc đổi cả thế tay chỉ vì một nốt lẻ.
const STRETCH = 1.2
function posInZone(midi, z) {
  let best = null
  for (let s = z.s0; s <= z.s1; s++) {
    const fret = midi - OPEN[s - 1]
    if (fret < z.f0 || fret > z.f1 + 1) continue
    const stretch = fret > z.f1 ? STRETCH : 0
    const cost = 0.6 * Math.max(0, s - 3) + 0.05 * fret + stretch   // ưu tiên dây 1–3, ngăn thấp
    if (!best || cost < best.cost) best = { string: s, fret, cost, zone: z.no }
  }
  return best
}
function posAnywhere(midi) {                                 // nốt ngoài mọi vùng
  let best = null
  for (let s = 1; s <= 6; s++) {
    const fret = midi - OPEN[s - 1]
    if (fret < 0 || fret > maxFret) continue
    const cost = 0.6 * Math.max(0, s - 3) + 0.05 * fret
    if (!best || cost < best.cost) best = { string: s, fret, cost, zone: 0 }
  }
  return best
}

const melody = []                                            // chỉ nốt thật, theo thứ tự
for (let bi = 0; bi < bars.length; bi++)
  for (const it of bars[bi].items) if (it.midi != null) melody.push({ it, bar: bi })

// Viterbi: trạng thái = vùng
const INF = 1e9
let prev = ZONES.map(() => 0)
const back = []
for (const m of melody) {
  const local = ZONES.map(z => posInZone(m.it.midi, z))
  const cur = [], bk = []
  for (let j = 0; j < ZONES.length; j++) {
    let bestCost = INF, bestFrom = 0
    for (let i = 0; i < ZONES.length; i++) {
      const c = prev[i] + (i === j ? 0 : SHIFT_COST)
      if (c < bestCost) { bestCost = c; bestFrom = i }
    }
    cur.push(local[j] ? bestCost + local[j].cost : INF)
    bk.push(bestFrom)
  }
  if (cur.every(c => c >= INF)) { for (let j = 0; j < cur.length; j++) cur[j] = prev[j] + 6 }  // nốt ngoài vùng
  prev = cur; back.push(bk)
}
let state = prev.indexOf(Math.min(...prev))
const path = new Array(melody.length)
for (let i = melody.length - 1; i >= 0; i--) { path[i] = state; state = back[i][state] }
for (let i = 0; i < melody.length; i++) {
  const z = ZONES[path[i]]
  melody[i].it.pos = posInZone(melody[i].it.midi, z) ?? posAnywhere(melody[i].it.midi)
}

// Gán hợp âm của chord sheet lên nốt: dò tuần tự theo lời, mỗi neo chỉ được tìm
// trong CỬA SỔ vài âm tiết kế tiếp — neo của lời 2 (đoạn hát lại) không khớp lời 1
// thì tự bỏ qua thay vì kéo lệch cả bài.
const SHEET_WINDOW = 16
if (chordSheet) {
  // Xoá hợp âm của XML trên MỌI item (kể cả dấu lặng — chúng cũng mang hợp âm)
  for (const bar of bars) for (const it of bar.items) it.chord = null
  let cursor = 0, lastPlaced = -1, lastWord = null
  const report = []
  for (const a of chordSheet) {
    let hit = -1
    for (let i = cursor; i < Math.min(melody.length, cursor + SHEET_WINDOW); i++) {
      if (norm(melody[i].it.lyric || '') === a.word) { hit = i; break }
    }
    // Hợp âm thứ hai neo vào CÙNG một chữ (vd "sâu[Am] [E]") → rơi vào nốt kế tiếp.
    if (hit < 0 && a.word === lastWord && lastPlaced >= 0) hit = lastPlaced + 1
    if (hit < 0 || hit >= melody.length) { report.push(`  (bỏ) ${a.chord} @${a.word}`); continue }
    let at = hit
    while (at < melody.length && melody[at].it.sheetChord) at++      // chữ đã có hợp âm → nốt kế
    melody[at].it.sheetChord = a.chord
    report.push(`  ô ${melody[at].bar + 1}: ${a.chord} @${a.word}`)
    lastPlaced = at; lastWord = a.word
    cursor = hit + 1
  }
  process.stderr.write('[i] hợp âm từ chord sheet:\n' + report.join('\n') + '\n')
}

// Trượt ngón ở chỗ đổi vùng: chỉ đánh dấu khi hai nốt liền nhau nằm TRÊN CÙNG MỘT
// DÂY (trượt chỉ có nghĩa khi ngón đi dọc dây) và thật sự đổi vùng.
// Điều kiện BẮT BUỘC của một cú trượt: hai nốt liền nhau, CÙNG MỘT DÂY, và CẢ HAI
// ĐỀU BẤM. Dây buông thì không có ngón nào trên dây để mà trượt — đánh dấu trượt
// từ/vào ngăn 0 là sai kỹ thuật.
const slidable = (a, b) => a && b && a.string === b.string && a.fret > 0 && b.fret > 0 &&
  Math.abs(a.fret - b.fret) >= 2
const slideBars = opt('slide-at') ? new Set(opt('slide-at').split(',').map(n => parseInt(n, 10))) : null
if (flag('slide') || slideBars) {
  const done = new Set()
  for (let i = 0; i + 1 < melody.length; i++) {
    const a = melody[i].it.pos, b = melody[i + 1].it.pos
    if (!slidable(a, b)) continue
    const bar = melody[i].bar + 1
    if (slideBars) {
      if (!slideBars.has(bar) || done.has(bar)) continue   // mỗi ô nhịp chỉ một cú trượt
      done.add(bar)
    } else if (a.zone === b.zone) continue                 // tự động: chỉ ở chỗ đổi vùng
    melody[i].it.slide = true
  }
}

// Báo cáo: dùng những vùng nào, chuyển vùng ở ô nhịp nào
const zoneReport = []
let lastZone = null
for (const m of melody) {
  const z = m.it.pos?.zone ?? 0
  if (z !== lastZone) { zoneReport.push({ bar: m.bar + 1, zone: z }); lastZone = z }
}

// ── Bass theo hợp âm: nốt gốc trên dây trầm, trong thế I (ngăn 0–3) ──
// Dùng cho các buổi đã học "Melody + Bass": mỗi lần ĐỔI hợp âm thì ngón cái p
// chơi nốt gốc cùng lúc với nốt giai điệu.
function bassFor(chordName) {
  const m = /^([A-G])([#b]?)/.exec(chordName)
  if (!m) return null
  const pc = (STEP[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 120) % 12
  let best = null
  for (const str of [6, 5, 4]) {
    for (let fret = 0; fret <= 3; fret++) {
      if ((OPEN[str - 1] + fret) % 12 !== pc) continue
      const cost = fret + (str === 4 ? 0.5 : 0)     // ưu tiên dây buông, dây trầm hơn
      if (!best || cost < best.cost) best = { string: str, fret, cost }
    }
  }
  return best
}

// ── Bè BASS riêng (--bass) ──────────────────────────────────────────────────
// Nhạc lý: hợp âm đổi ở PHÁCH MẠNH (phách 1, hoặc phách 3 của nhịp 4/4), không
// rơi vào phách 2/4 chỉ vì âm tiết của lời nằm ở đó. Nên vị trí hợp âm được NẮN
// về phách mạnh gần nhất.
// Khắc nhạc: bass là một BÈ RIÊNG (\voice) — alphaTab tự quay đuôi nốt xuống, và
// bè bass có nốt ở phách 1 kể cả khi giai điệu đang là dấu lặng.
const STRONG = beats >= 4 ? [0, Math.floor(beats / 2)] : [0]     // 4/4 → phách 1 và 3

function buildBassVoice() {
  // gom hợp âm theo ô nhịp, đã nắn về phách mạnh
  const perBar = bars.map(() => new Map())                       // bar → Map(phách → tên hợp âm)
  for (let bi = 0; bi < bars.length; bi++) {
    for (const it of bars[bi].items) {
      if (!it.sheetChord) continue
      let slot = STRONG.reduce((a, b) => (Math.abs(b - it.at) < Math.abs(a - it.at) ? b : a), STRONG[0])
      if (perBar[bi].has(slot)) {                                // phách đó đã có hợp âm khác
        const free = STRONG.find(x => !perBar[bi].has(x))
        if (free === undefined) continue                         // ô đã đủ hợp âm → bỏ
        slot = free
      }
      perBar[bi].set(slot, it.sheetChord)
    }
  }

  const out = []
  // --bars cắt đoạn nào thì bè bass cắt đúng đoạn ấy, nếu không hai bè lệch số ô nhịp.
  const [bb0, bb1] = barRange ? barRange.split('-').map(n => parseInt(n, 10)) : [1, bars.length]
  // Hợp âm đầu tiên của bài thường được neo vào giữa câu hát (vd "…tháp cổ[Am]"),
  // nhưng người đệm đã chơi nó từ ô nhịp đầu ⇒ lấy nó làm hợp âm mở đầu để bè bass
  // có nốt ngay từ phách 1, kể cả khi giai điệu bắt đầu bằng dấu lặng.
  let current = null
  for (const m of perBar) { const first = [...m.values()][0]; if (first) { current = first; break } }
  let shownNone = true                      // hợp âm đầu bài thì luôn phải ghi tên
  for (let bi = 0; bi < bars.length; bi++) {
    const inRange = bi >= bb0 - 1 && bi <= bb1 - 1
    const slots = [...perBar[bi].entries()].sort((a, b) => a[0] - b[0])
    if (!inRange) {                       // ngoài đoạn: chỉ cập nhật hợp âm đang hiệu lực
      const last = [...perBar[bi].values()].pop()
      if (last) current = last
      continue
    }
    if (!current && slots.length === 0) { out.push(`r.${DUR_TEX[beats >= 4 ? 4 : 2] ?? 1}`); continue }

    // mỗi đoạn kéo dài từ phách này tới phách có hợp âm tiếp theo (hoặc hết ô nhịp)
    const marks = slots.length ? slots : [[0, current]]
    if (marks[0][0] > 0) marks.unshift([0, current])              // đầu ô vẫn giữ hợp âm cũ
    const toks = []
    for (let k = 0; k < marks.length; k++) {
      const [from, name] = marks[k]
      const to = k + 1 < marks.length ? marks[k + 1][0] : beats
      const lenBeats = to - from
      if (!name) { toks.push(`r.${DUR_TEX[lenBeats] ?? 4}`); continue }
      const changed = name !== current      // chỉ ghi TÊN hợp âm ở chỗ nó đổi
      current = name
      const pos = bassFor(name)
      const dur = DUR_TEX[lenBeats] ?? 4
      const fx = ['rf 1']                   // rf 1 = ngón cái p
      if (changed || shownNone) { fx.unshift(`ch "${name}"`); shownNone = false }
      toks.push(pos ? `${pos.fret}.${pos.string}{${fx.join(' ')}}.${dur}` : `r.${dur}`)
    }
    out.push(toks.join(' '))
  }
  return out
}

// ── 3. Xuất alphaTex ──
function durToken(b, tuplet) {
  const real = tuplet > 1 ? b * tuplet / (tuplet === 3 ? 2 : tuplet) : b   // liên 3: 3 nốt trong 2
  for (const base of [4, 2, 1, 0.5, 0.25, 0.125]) {
    if (Math.abs(real - base) < 0.01) return { dur: DUR_TEX[base], dotted: false }
    if (Math.abs(real - base * 1.5) < 0.01) return { dur: DUR_TEX[base], dotted: true }
  }
  let bestBase = 1, bd = Infinity
  for (const base of [4, 2, 1, 0.5, 0.25, 0.125]) { const d = Math.abs(real - base); if (d < bd) { bd = d; bestBase = base } }
  return { dur: DUR_TEX[bestBase], dotted: false }
}

const lyricWords = []
let carryChord = null
const out = []
const [b0, b1] = barRange ? barRange.split('-').map(n => parseInt(n, 10)) : [1, bars.length]

for (let i = b0 - 1; i < Math.min(b1, bars.length); i++) {
  const bar = bars[i]
  const toks = []
  if (bar.repeatOpen) toks.push('\\ro')
  if (bar.repeatClose) toks.push(`\\rc ${bar.repeatClose}`)
  for (const it of bar.items) {
    const { dur, dotted } = durToken(it.beats, it.tuplet)
    const fx = []
    if (dotted) fx.push('d')
    if (it.tuplet > 1) fx.push(`tu ${it.tuplet}`)
    // Hợp âm là HIỆU ỨNG CỦA NỐT: `12.1{ch "E7"}.8`. alphaTex KHÔNG nhận `\\ch` đứng riêng,
    // và cũng không gắn được hợp âm lên dấu lặng ⇒ dồn sang nốt thật kế tiếp.
    // Có bè bass riêng thì hợp âm nằm ở bè đó, bè giai điệu để trống cho sạch.
    if (it.sheetChord && !flag('bass')) carryChord = { text: it.sheetChord }
    else if (it.chord && !flag('no-chords') && !flag('bass')) carryChord = it.chord
    let body
    if (it.midi == null) {
      body = `r.${dur}`   // alphaTab BỎ QUA dấu lặng khi rải lời ⇒ không đẩy âm tiết nào
    } else {
      const pos = it.pos
      if (!pos) { body = `r.${dur}` } else {
        const nfx = []
        if (it.tieStop) nfx.push('t')
        if (it.slide) nfx.push('ss')          // ss = trượt ngón đổi thế
        if (carryChord) {
          const name = carryChord.text ?? `${noteName(carryChord.pc)}${carryChord.suffix}`
          nfx.push(`ch "${name}"`)
          carryChord = null
        }
        body = `${pos.fret}.${pos.string}${nfx.length ? `{${nfx.join(' ')}}` : ''}.${dur}`
      }
      // Nốt KHÔNG có âm tiết (dấu nối, luyến, melisma) phải sinh một ô lời RỖNG,
      // nếu không alphaTab sẽ dồn âm tiết kế tiếp lên nốt này ⇒ lệch lời cả bài.
      // Token đúng là "_" (alphaTab cắt dấu _ ở cuối chunk ⇒ chunk rỗng, không in gì).
      // ĐỪNG dùng "-": alphaTab IN NGUYÊN dấu gạch ngang xuống dưới nốt.
      if (!flag('no-lyrics')) lyricWords.push((it.lyric || '').replace(/["\s]+/g, '') || '_')
    }
    if (fx.length) body += `{${fx.join(' ')}}`
    toks.push(body)
  }
  out.push(toks.join(' '))
}

function noteName(pc) {
  return ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][pc]
}

const keyFifths = fifths   // giọng do file gốc khai báo; sau khi dịch giọng thì tự khai ở data
const header = [
  `\\ts ${beats} ${beatType}`,
]
if (!flag('no-lyrics')) header.push(`\\lyrics "${lyricWords.join(' ').trim()}"`)
header.push('.')

const melodyTex = header.join('\n') + '\n' + out.join(' |\n')
const bassTex = flag('bass') ? '\n\\voice\n' + buildBassVoice().join(' |\n') : ''
process.stdout.write(melodyTex + bassTex + '\n')
process.stderr.write(`\n[i] ${bars.length} ô nhịp · fifths gốc ${keyFifths} · dịch ${transpose} nửa cung\n`)
process.stderr.write('[i] vùng: ' + zoneReport.map(r => `ô ${r.bar}→V${r.zone || '?'}`).join('  ') + '\n')
const usedFrets = melody.map(m => m.it.pos?.fret).filter(f => f != null)
const usedStrings = [...new Set(melody.map(m => m.it.pos?.string))].sort()
process.stderr.write(`[i] ngăn ${Math.min(...usedFrets)}–${Math.max(...usedFrets)} · dây ${usedStrings.join(',')}\n`)
