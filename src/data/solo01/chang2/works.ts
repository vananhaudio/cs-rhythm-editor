// ── SOLO-01 · CHẶNG 2 (Solo Bolero) — bài mẫu xuyên suốt: Con Đường Xưa em Đi ──
// NGUỒN: thư viện MusicXML production (musicxml_library id 6cfffd59-346d-4fe2-a781-6519bff28e2b,
// "Con Đường Xưa em Đi" — Châu Kỳ & Hồ Đình Phương), md5 file a080ffd6b25734d09780ec287bfe50eb.
// Sinh bằng: node scripts/musicxml-to-alphatex.mjs <file> (giọng gốc, KHÔNG dịch giọng, hợp âm lấy từ XML).
// KHÔNG sửa tay CDX_BARS — sửa nguồn rồi sinh lại. Không nhân đôi asset: đây là bản alphaTex dẫn xuất, file XML vẫn ở thư viện.
// 41 ô · 4/4 · giọng Am (không dấu hoá) · 1 bè guitar (melody) + tên hợp âm. KHÔNG có nốt Bass / hợp âm đầy đủ trong nguồn.
// Cấu trúc suy từ hợp âm + lời (ĐỀ XUẤT, Owner xác nhận): ô 1 vào · ô 2–8 đoạn A1 · ô 9–15 đoạn A2 · ô 16–17 nối ·
// ô 18–25 điệp khúc (nửa 1) · ô 26–33 điệp khúc (nửa 2) · ô 34–41 đoạn kết (hát lại tên bài).
export const CDX_BARS: string[] = [
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

/** alphaTex cho ô nhịp [from..to] (đếm từ 1, gồm cả hai đầu). */
export const cdxTex = (from: number, to: number): string =>
  "\\ts 4 4\n.\n" + CDX_BARS.slice(from - 1, to).join("\n")

/** Cả bài, có lời. */
export const WORK_CDX_FULL = "\\ts 4 4\n" + "\\lyrics \"Con đường xưa _ em đi Vàng lên mái tóc thề ngõ _ hồn dâng tái _ tê _ Anh làm thơ _ vu quy khách qua đường lắng nghe Chuyện _ tình ta đã ghi _ Những mùa trăng _ vu quy Vì mưa gió không về Chiến _ trường anh bước _ đi. _ Có nàng hoen _ đôi mi Ngóng theo đường vắng hoe Hỏi _ còn ai cố tri _ _ Em ơi! nhìn gió lên khơi lòng cố trông vời một người xa cuối trời Nơi đây phiên gác canh dài e ấp đôi lời mình còn nhớ thương hoài Em ơi! Màu áo phong sương mình ước huy hoàng được bàn tay chính nàng Dâng hoa dâng hết ân tình Tính đến bao giờ hỏi đường xưa mà nhớ Con đường xưa em _ _ đi Thời gian có quên gì Đá _ mòn kia vẫn _ ghi _ _ Ghi một đêm _ trăng thanh quán bên đường vắng tanh chỉ _ còn em với anh. _\"" + "\n.\n" + CDX_BARS.join("\n")

/**
 * Như cdxTex nhưng ghi ngón tay trái theo QUY TẮC MỘT NGĂN – MỘT NGÓN (Vị trí I): ngăn 1 → ngón 1, ngăn 2 → ngón 2, ngăn 3 → ngón 3.
 * Đúng cho TOÀN BỘ giai điệu vì nguồn không có nốt nào cao hơn ngăn 3 (đã kiểm: max fret = 3). Dây buông không ghi ngón.
 * alphaTex: lf 2 = ngón 1 … lf 5 = ngón 4 (lf 1 là ngón cái). ĐÂY LÀ PHƯƠNG ÁN MẶC ĐỊNH, không phải phương án duy nhất.
 */
export const cdxFingered = (from: number, to: number): string => {
  const add = (bar: string) => bar.replace(/(\d+)\.(\d)(\{[^}]*\})?\.(\d+)/g, (m, fret: string, str: string, braces: string | undefined, dur: string) => {
    const f = Number(fret)
    if (f < 1 || f > 3 || braces === '{t}') return m
    const lf = `lf ${f + 1}`
    const b = braces ? braces.replace(/^\{/, `{${lf} `) : `{${lf}}`
    return `${fret}.${str}${b}.${dur}`
  })
  return "\\ts 4 4\n.\n" + CDX_BARS.slice(from - 1, to).map(add).join("\n")
}
