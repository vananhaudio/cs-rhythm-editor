// ── SOLO-01 · CHẶNG 2 (Solo Bolero) — bài mẫu xuyên suốt: Con Đường Xưa em Đi ──
// NGUỒN: thư viện MusicXML production (musicxml_library id 6cfffd59-346d-4fe2-a781-6519bff28e2b,
// "Con Đường Xưa em Đi" — Châu Kỳ & Hồ Đình Phương), md5 file a080ffd6b25734d09780ec287bfe50eb.
// Sinh bằng: node scripts/musicxml-to-alphatex.mjs <file> (giọng gốc, KHÔNG dịch giọng, hợp âm lấy từ XML).
// CDX_SRC_BARS = NGUYÊN VĂN từ MusicXML (cao độ gốc), KHÔNG sửa tay. Bản dạy trong Chặng 2 là BẢN PHỐI DẪN XUẤT: nâng cả giai điệu lên MỘT QUÃNG 8 (CDX_BARS, bên dưới). Không nhân đôi asset: đây là bản alphaTex dẫn xuất, file XML vẫn ở thư viện.
// 41 ô · 4/4 · giọng Am (không dấu hoá) · 1 bè guitar (melody) + tên hợp âm. KHÔNG có nốt Bass / hợp âm đầy đủ trong nguồn.
// Cấu trúc suy từ hợp âm + lời (ĐỀ XUẤT, Owner xác nhận): ô 1 vào · ô 2–8 đoạn A1 · ô 9–15 đoạn A2 · ô 16–17 nối ·
// ô 18–25 điệp khúc (nửa 1) · ô 26–33 điệp khúc (nửa 2) · ô 34–41 đoạn kết (hát lại tên bài).
export const CDX_SRC_BARS: string[] = [
  "r.4 2.4.4 3.5.4{tu 3} 0.3.8{tu 3} 2.3.8{tu 3} 2.3.4{tu 3} |",
  "2.3{ch \"Am\"}.4{d} 2.4.8 2.3.8 1.2.4 2.4.8 |",
  "0.4{ch \"Dm\"}.4{d} 2.4.16 0.4.16 3.5.4{tu 3} 2.4.4{tu 3} 2.4.8{tu 3} 2.3.8{tu 3} |",
  "2.4{ch \"Am\"}.1 |",
  "2.4.4 2.4.4 0.5.4{tu 3} 3.5.8{tu 3} 0.4.8{tu 3} 0.4.4{tu 3} |",
  "0.4{ch \"Dm\"}.4{d} 2.4.8 0.4.8 3.5.4 3.4.8 |",
  "2.4{ch \"Am\"}.4{d} 2.4.16 3.4.16 2.4.4{tu 3} 2.3.4{tu 3} 1.2.4{tu 3} |",
  "0.2{ch \"E\"}.1 |",
  "0.2.4 0.2.4 2.4.4{tu 3} 1.3.8{tu 3} 2.3.8{tu 3} 2.3.4{tu 3} |",
  "2.3{ch \"Am\"}.4{d} 2.4.8 2.3.8 1.2.4 2.4.8 |",
  "0.4{ch \"Dm\"}.4{d} 2.4.16 0.4.16 3.5.4{tu 3} 2.4.4{tu 3} 2.4.8{tu 3} 2.3.8{tu 3} |",
  "2.4{ch \"Am\"}.1 |",
  "2.4.4 2.4.4 0.5.4{tu 3} 3.5.8{tu 3} 0.4.8{tu 3} 0.4.4{tu 3} |",
  "0.4{ch \"Dm\"}.4{d} 2.4.8 0.4.8 3.5.4 3.4.8 |",
  "2.4{ch \"E\"}.4{d} 2.4.16 3.4.16 2.4.4{tu 3} 1.3.4{tu 3} 0.2.4{tu 3} |",
  "2.3{ch \"Am\"}.2 2.3{ch \"Dm\"}.2 |",
  "2.3{ch \"Am\"}.4 r.4 r.4 2.3.4 |",
  "2.3{ch \"Am\"}.2 2.3.4{tu 3} 0.1.4{tu 3} 3.2.4{tu 3} |",
  "1.2{ch \"F\"}.2 2.3.4{tu 3} 3.2.4{tu 3} 1.2.4{tu 3} |",
  "0.3{ch \"G\"}.4{d} 0.3.8 0.3.4{tu 3} 2.3.4{tu 3} 1.2.4{tu 3} |",
  "2.4{ch \"C\"}.2 r.4 2.4.4 |",
  "2.4{ch \"Am\"}.2 2.4.4{tu 3} 2.3.4{tu 3} 2.4.4{tu 3} |",
  "0.4{ch \"Dm\"}.2 0.4.4{tu 3} 2.4.4{tu 3} 0.4.4{tu 3} |",
  "3.5{ch \"C\"}.4{d} 3.5.8 3.5.8 3.4.4 2.4.8 |",
  "0.5{ch \"Am\"}.2 r.4 2.3.4 |",
  "2.3{ch \"Am\"}.2 2.3.4{tu 3} 0.1.4{tu 3} 3.2.4{tu 3} |",
  "1.2{ch \"F\"}.2 2.3.4{tu 3} 3.2.4{tu 3} 1.2.4{tu 3} |",
  "0.3{ch \"G\"}.4{d} 0.3.8 0.3.4{tu 3} 2.3.4{tu 3} 1.2.4{tu 3} |",
  "2.4{ch \"C\"}.2 r.4 2.4.4 |",
  "2.4{ch \"Am\"}.2 2.4.4{tu 3} 2.3.4{tu 3} 2.4.4{tu 3} |",
  "0.4{ch \"Dm\"}.2 0.4.4{tu 3} 2.4.4{tu 3} 0.4.4{tu 3} |",
  "3.5{ch \"F\"}.4{d} 3.5.8 2.4.8 2.3.4 1.3.8 |",
  "0.2{ch \"E7\"}.4 r.4 0.2.4 0.2.4 |",
  "2.4.4{tu 3} 1.3.8{tu 3} 2.3.8{tu 3} 2.3.4{tu 3} 2.3{ch \"Am\"}.4{d} 2.4.8 |",
  "2.3.8 1.2.4 2.4.8 0.4{ch \"Dm\"}.4{d} 2.4.16 0.4.16 |",
  "3.5.4{tu 3} 2.4.4{tu 3} 2.4.8{tu 3} 2.3.8{tu 3} 2.4{ch \"Am\"}.2 |",
  "2.4{t}.2 2.4.4 2.4.4 |",
  "0.5.4{tu 3} 3.5.8{tu 3} 0.4.8{tu 3} 0.4.4{tu 3} 0.4{ch \"Dm\"}.4{d} 2.4.8 |",
  "0.4.8 3.5.4 3.4.8 2.4{ch \"E\"}.4{d} 2.4.16 3.4.16 |",
  "2.4.4{tu 3} 1.3.4{tu 3} 0.2.4{tu 3} 2.3{ch \"Am\"}.2 |",
  "2.3.2 r.2"
]


// ── BẢN PHỐI DẪN XUẤT: nâng giai điệu lên một quãng 8 ──────────────────────────────────────────────
// Luật (Owner): giữ nguyên nhịp điệu, trường độ, cấu trúc; ưu tiên dây 1, dùng dây 2 khi cần.
//   cao độ ≥ Mi4 (64) → dây 1 · Si3…Re♯4 (59–63) → dây 2 · thấp hơn → dây 3 (chỉ xảy ra với La3 ở ô 5, 13, 25, 38 — La3 thấp hơn Si3
//   nên KHÔNG thể ở dây 2; đây là ngoại lệ duy nhất, ghi rõ trong bài).
// Ghi chú dây 2: Đô4 = ngăn 1, Rê4 = ngăn 3. Mi4 nằm ở dây 1 buông (có thể thay bằng dây 2 ngăn 5 nếu muốn giữ tay ở Vị trí V).
const OPEN_PITCH = [0, 64, 59, 55, 50, 45, 40] // cao độ MIDI dây buông, chỉ số = số dây (1 = e cao)
const NOTE_RE = /(\d+)\.(\d)(\{[^}]*\})?\.(\d+)/g

/** Nâng MỘT ô nhịp lên một quãng 8 theo luật trên. */
export const raiseOctaveBar = (bar: string): string =>
  bar.replace(NOTE_RE, (_m, fret: string, str: string, braces: string | undefined, dur: string) => {
    const p = OPEN_PITCH[Number(str)] + Number(fret) + 12
    const [s, f] = p >= 64 ? [1, p - 64] : p >= 59 ? [2, p - 59] : p >= 55 ? [3, p - 55] : [4, p - 50]
    return `${f}.${s}${braces ?? ''}.${dur}`
  })

/** 41 ô nhịp ĐÃ NÂNG MỘT QUÃNG 8 — bản dạy. */
export const CDX_BARS: string[] = CDX_SRC_BARS.map(raiseOctaveBar)

/** alphaTex cho ô nhịp [from..to] (đếm từ 1, gồm cả hai đầu). */
export const cdxTex = (from: number, to: number): string =>
  "\\ts 4 4\n.\n" + CDX_BARS.slice(from - 1, to).join("\n")


// ── XẾP NGÓN MẶC ĐỊNH ──────────────────────────────────────────────────────────────────────────────
// Vị trí (Position) = số ngăn mà NGÓN 1 đang đứng; trong một vị trí: ngăn p → ngón 1, p+1 → ngón 2, p+2 → ngón 3, p+3 → ngón 4.
// Dây buông không ghi ngón; nốt nối {t} không ghi lại. Đường đi vị trí được chọn ít lần đổi nhất cho cả bài (quy hoạch động):
// mỗi lần đổi vị trí tốn 10 + số ngăn dịch. Melody nằm ở HAI vùng (nốt thấp ngăn 1–4 và nốt cao ngăn 5–8, vài nốt lên ngăn 10–12)
// nên đổi vị trí là việc thường xuyên — đó là nội dung của Buổi 3. Đây là PHƯƠNG ÁN MẶC ĐỊNH, không phải duy nhất.
interface FretNote { bar: number; fret: number }
const fretted = (): FretNote[] => {
  const out: FretNote[] = []
  CDX_BARS.forEach((b, i) => { for (const m of b.matchAll(NOTE_RE)) { if (Number(m[1]) > 0 && m[3] !== '{t}') out.push({ bar: i, fret: Number(m[1]) }) } })
  return out
}
const POSITIONS = [1, 3, 5, 7, 9] // chỉ dùng Vị trí I · III · V · VII · IX (ngón 1 ở ngăn 1, 3, 5, 7, 9)
/** Vị trí tay cho từng nốt có bấm (theo thứ tự xuất hiện trong bài). */
const computePositions = (): number[] => {
  const notes = fretted()
  const INF = 1e9
  const rows: { c: number; prev: number }[][] = []
  notes.forEach((n, i) => {
    rows.push(POSITIONS.map(p => {
      const fin = n.fret - p + 1
      if (fin < 1 || fin > 4) return { c: INF, prev: -1 }
      if (i === 0) return { c: 0, prev: -1 }
      let best = { c: INF, prev: -1 }
      POSITIONS.forEach((q, qi) => {
        const pc = rows[i - 1][qi].c
        if (pc >= INF) return
        const c = pc + (p !== q ? 10 + Math.abs(p - q) : 0) + 0.01 * fin
        if (c < best.c) best = { c, prev: qi }
      })
      return best
    }))
  })
  let bi = 0
  let bc = INF
  rows[rows.length - 1].forEach((x, i) => { if (x.c < bc) { bc = x.c; bi = i } })
  const pos: number[] = []
  for (let i = rows.length - 1; i >= 0; i--) { pos[i] = POSITIONS[bi]; bi = rows[i][bi].prev }
  return pos
}
const POS_OF_NOTE = computePositions()
/** Vị trí tay (số ngăn của ngón 1) dùng cho mỗi ô nhịp 1–41: danh sách theo thứ tự xuất hiện, bỏ lặp liền kề. Ô chỉ có dây buông/nghỉ → []. */
export const CDX_BAR_POSITIONS: number[][] = (() => {
  const notes = fretted()
  const res: number[][] = CDX_BARS.map(() => [])
  notes.forEach((n, i) => { const r = res[n.bar]; if (r[r.length - 1] !== POS_OF_NOTE[i]) r.push(POS_OF_NOTE[i]) })
  return res
})()

/**
 * Như cdxTex nhưng ghi ngón tay trái theo vị trí tay ở trên. alphaTex: lf 2 = ngón 1 … lf 5 = ngón 4 (lf 1 là ngón cái).
 */
export const cdxFingered = (from: number, to: number): string => {
  let idx = 0
  for (let b = 0; b < from - 1; b++) idx += [...CDX_BARS[b].matchAll(NOTE_RE)].filter(m => Number(m[1]) > 0 && m[3] !== '{t}').length
  const add = (bar: string) => bar.replace(NOTE_RE, (m, fret: string, str: string, braces: string | undefined, dur: string) => {
    if (Number(fret) < 1 || braces === '{t}') return m
    const lf = `lf ${Number(fret) - POS_OF_NOTE[idx++] + 2}`
    const b = braces ? braces.replace(/^\{/, `{${lf} `) : `{${lf}}`
    return `${fret}.${str}${b}.${dur}`
  })
  return "\\ts 4 4\n.\n" + CDX_BARS.slice(from - 1, to).map(add).join("\n")
}

/** Cả bài, có lời. */
export const WORK_CDX_FULL = "\\ts 4 4\n" + "\\lyrics \"Con đường xưa _ em đi Vàng lên mái tóc thề ngõ _ hồn dâng tái _ tê _ Anh làm thơ _ vu quy khách qua đường lắng nghe Chuyện _ tình ta đã ghi _ Những mùa trăng _ vu quy Vì mưa gió không về Chiến _ trường anh bước _ đi. _ Có nàng hoen _ đôi mi Ngóng theo đường vắng hoe Hỏi _ còn ai cố tri _ _ Em ơi! nhìn gió lên khơi lòng cố trông vời một người xa cuối trời Nơi đây phiên gác canh dài e ấp đôi lời mình còn nhớ thương hoài Em ơi! Màu áo phong sương mình ước huy hoàng được bàn tay chính nàng Dâng hoa dâng hết ân tình Tính đến bao giờ hỏi đường xưa mà nhớ Con đường xưa em _ _ đi Thời gian có quên gì Đá _ mòn kia vẫn _ ghi _ _ Ghi một đêm _ trăng thanh quán bên đường vắng tanh chỉ _ còn em với anh. _\"" + "\n.\n" + CDX_BARS.join("\n")

// ── BASS VÀ THẾ HỢP ÂM CHO BẢN PHỐI QUÃNG 8 CAO (ĐỀ XUẤT CỦA GIÁO ÁN — chờ Owner xác nhận) ──────────────────────
// Ba tầng, ba vùng dây: Bass ở DÂY 6–5 · hợp âm ở DÂY 4–3–2 (khu vực ngăn 3–8, sát vị trí tay của melody) · melody ở DÂY 1 (dây 2 khi nốt thấp).
// Mọi cao độ đã kiểm bằng máy (cao độ thật từng dây, nốt thuộc hợp âm, độ giãn ≤ 4 ngăn, mỗi nốt một ngón). Nguồn MusicXML KHÔNG có Bass/hợp âm đầy đủ.
export interface ChordShape {
  /** ký hiệu sáu ký tự, thứ tự dây 6 → 1; x = không chơi */
  code: string
  /** nốt cho alphaTex, ngăn.dây, ghép trong ngoặc tròn */
  tex: string
  /** tên nốt từ thấp lên cao */
  notes: string[]
  /** phân loại đúng: Triad (đủ Root–3rd–5th) hay Partial Voicing / Dyad (thiếu nốt) */
  kind: string
}
/** Thế 3 nốt trên dây 4–3–2. Chỉ gọi là Triad khi đủ Root–3rd–5th; E7 và các thế hai nốt là thế thiếu nốt. */
export const TRIAD: Record<string, ChordShape> = {
  Am: { code: 'xx755x', tex: '7.4 5.3 5.2', notes: ['La', 'Đô', 'Mi'], kind: 'Triad · Root Position' },
  Dm: { code: 'xx776x', tex: '7.4 7.3 6.2', notes: ['La', 'Rê', 'Fa'], kind: 'Triad · 2nd Inversion' },
  E: { code: 'xx645x', tex: '6.4 4.3 5.2', notes: ['Sol♯', 'Si', 'Mi'], kind: 'Triad · 1st Inversion' },
  E7: { code: 'xx675x', tex: '6.4 7.3 5.2', notes: ['Sol♯', 'Rê', 'Mi'], kind: 'Partial Voicing · 3rd–7th–Root, thiếu 5th (không phải Triad)' },
  F: { code: 'xx756x', tex: '7.4 5.3 6.2', notes: ['La', 'Đô', 'Fa'], kind: 'Triad · 1st Inversion' },
  G: { code: 'xx543x', tex: '5.4 4.3 3.2', notes: ['Sol', 'Si', 'Rê'], kind: 'Triad · Root Position' },
  C: { code: 'xx555x', tex: '5.4 5.3 5.2', notes: ['Sol', 'Đô', 'Mi'], kind: 'Triad · 2nd Inversion' },
}
/** Thế 2 nốt trên dây 4–3 (dùng khi melody thấp hoặc cần chừa dây 2). Đây là Dyad — KHÔNG phải hợp âm đầy đủ; tên hợp âm do Bass quyết định. */
export const DYAD: Record<string, ChordShape> = {
  Am: { code: 'xx75xx', tex: '7.4 5.3', notes: ['La', 'Đô'], kind: 'Dyad · Root + 3rd' },
  Dm: { code: 'xx32xx', tex: '3.4 2.3', notes: ['Fa', 'La'], kind: 'Dyad · 3rd + 5th' },
  E: { code: 'xx64xx', tex: '6.4 4.3', notes: ['Sol♯', 'Si'], kind: 'Dyad · 3rd + 5th' },
  E7: { code: 'xx67xx', tex: '6.4 7.3', notes: ['Sol♯', 'Rê'], kind: 'Dyad · 3rd + 7th' },
  F: { code: 'xx32xx', tex: '3.4 2.3', notes: ['Fa', 'La'], kind: 'Dyad · Root + 3rd' },
  G: { code: 'xx54xx', tex: '5.4 4.3', notes: ['Sol', 'Si'], kind: 'Dyad · Root + 3rd' },
  C: { code: 'xx25xx', tex: '2.4 5.3', notes: ['Mi', 'Đô'], kind: 'Dyad · 3rd + Root (giãn ngón 1–4)' },
}
/** Bass trên dây 6–5: nốt gốc và nốt đổi (quãng 5). Dm dùng Rê dây 5 ngăn 5 để NHƯỜNG dây 4 cho hợp âm. */
export const BASS: Record<string, { root: string; fifth: string }> = {
  Am: { root: '0.5', fifth: '0.6' },
  Dm: { root: '5.5', fifth: '0.5' },
  E: { root: '0.6', fifth: '2.5' },
  E7: { root: '0.6', fifth: '2.5' },
  F: { root: '1.6', fifth: '3.5' },
  G: { root: '3.6', fifth: '5.5' },
  C: { root: '3.5', fifth: '3.6' },
}
