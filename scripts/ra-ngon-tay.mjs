// Rà ngón tay trái & trượt ngón trong mọi bản nhạc alphaTex của giáo trình SOLO-01.
//   node scripts/ra-ngon-tay.mjs
// Bắt đúng ba lỗi đã từng lọt ra bản in:
//   1. trượt từ/vào DÂY BUÔNG — không bấm gì thì không có ngón nào để trượt;
//   2. trượt mà ĐỔI NGÓN giữa hai nốt — trượt phải giữ nguyên một ngón trên dây;
//   3. dây buông mà vẫn ghi số ngón, hoặc nốt bấm mà thiếu số ngón.
// Quy đổi alphaTex: lf 2 = ngón 1 … lf 5 = ngón 4  ⇒  ngón Việt = lf - 1.
import { readFileSync } from 'node:fs'

const FILES = ['src/data/solo01/buoi01.ts','src/data/solo01/buoi02.ts','src/data/solo01/buoi03.ts','src/data/solo01/works.ts']
const NOTE = /(\d+)\.([1-6])(\{[^}]*\})?\.(\d+)(\{[^}]*\})?/g

function parseBlocks(src) {
  const out = []
  const re = /const (\w+) = `([\s\S]*?)`\.trim\(\)|export const (\w+) = `([\s\S]*?)`/g
  let m
  while ((m = re.exec(src)) !== null) out.push({ name: m[1] ?? m[3], tex: (m[2] ?? m[4]).replace(/\\\\/g, '\\') })
  return out
}

let loi = 0
for (const f of FILES) {
  for (const { name, tex } of parseBlocks(readFileSync(f, 'utf8'))) {
    // mỗi bè xét riêng
    for (const [vi, voice] of tex.split(/\\voice/).entries()) {
      const notes = []
      const bars = voice.split('|')
      bars.forEach((bar, bi) => {
        let m
        NOTE.lastIndex = 0
        while ((m = NOTE.exec(bar)) !== null) {
          const fx = (m[3] ?? '') + (m[5] ?? '')
          const lf = /lf (\d)/.exec(fx)
          notes.push({
            bar: bi + 1, fret: +m[1], string: +m[2],
            ngon: lf ? +lf[1] - 1 : null, slide: /\bss\b|\bsl\b/.test(fx),
          })
        }
      })
      const nhan = `${name}${vi ? ' (bè ' + (vi + 1) + ')' : ''}`
      notes.forEach((n, i) => {
        const next = notes[i + 1]
        if (n.fret > 0 && n.ngon === null && notes.some(x => x.ngon !== null))
          console.log(`⚠️  ${nhan} ô ${n.bar}: ngăn ${n.fret} dây ${n.string} — THIẾU số ngón`), loi++
        if (n.fret === 0 && n.ngon !== null)
          console.log(`❌ ${nhan} ô ${n.bar}: dây buông mà ghi ngón ${n.ngon}`), loi++
        if (!n.slide) return
        if (n.fret === 0) { console.log(`❌ ${nhan} ô ${n.bar}: TRƯỢT TỪ DÂY BUÔNG (ngăn 0 → ${next?.fret}) — không bấm gì thì trượt bằng cái gì`); loi++; return }
        if (!next) { console.log(`❌ ${nhan} ô ${n.bar}: trượt nhưng không có nốt sau`); loi++; return }
        if (next.string !== n.string) { console.log(`❌ ${nhan} ô ${n.bar}: trượt sang DÂY KHÁC (dây ${n.string} → ${next.string})`); loi++; return }
        if (next.fret === 0) { console.log(`❌ ${nhan} ô ${n.bar}: trượt VÀO dây buông (ngăn ${n.fret} → 0)`); loi++; return }
        if (n.ngon !== next.ngon)
          console.log(`❌ ${nhan} ô ${n.bar}: trượt ngăn ${n.fret}→${next.fret} nhưng ĐỔI NGÓN ${n.ngon}→${next.ngon} (trượt phải cùng một ngón)`), loi++
      })
    }
  }
}
console.log(loi ? `\n→ ${loi} chỗ cần sửa` : '\n→ không thấy lỗi')
