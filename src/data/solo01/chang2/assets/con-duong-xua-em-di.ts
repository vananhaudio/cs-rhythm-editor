// ── ASSET BẢN NHẠC CHUẨN · "Con Đường Xưa em Đi" · SOLO01 Chặng 2 ───────────────────────────────────────────────
// MỘT NGUỒN DUY NHẤT cho mọi bản đầy đủ và trích đoạn trong 8 buổi (9–16). KHÔNG sửa tay ở nơi khác; muốn đổi → tăng version, cập nhật
// file này, chạy test (tests/class-social/solo01-chang2.test.ts) rồi dựng lại các buổi từ nguồn.
// Phiên bản: v5 — Owner nghiệm thu 17/11/2026 (PDF: Con-Duong-Xua-Em-Di_ban-giai-dieu-thuc-hanh_v5-co-loi.pdf; v4 = chưa lời).
// Nguồn gốc: MusicXML thư viện production (id 6cfffd59-346d-4fe2-a781-6519bff28e2b, md5 a080ffd6b25734d09780ec287bfe50eb), đã HIỆU ĐÍNH
// theo bản ảnh tham chiếu sheet_266 (E→D ô 3·11·35; dựng lại ô 33–41; thêm 6 Tie; 15 Slur; ô 16 một nốt tròn; Sol♮ ở ô 39).
// Cao độ ở dạng NGUYÊN BẢN (chưa nâng quãng 8). Bản dạy = nâng đúng 12 bán cung + cặp Slur cùng dây (works.ts).
// Quy ước alphaTex: {t} = Tie ở NỐT ĐÍCH (cùng cao độ, không gảy lại) · {slur sN} = cung luyến Slur, hai nốt khác cao độ, id duy nhất.
export const CDX_ASSET_VERSION = "v5-2026-11-17"
/** PDF A4 chuẩn (3 trang) — MỘT tệp dùng chung mọi buổi; bucket public `lessons` của Class. */
export const CDX_PDF_URL = "https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/lessons/solo01/chang2/con-duong-xua-em-di_v5-co-loi.pdf"
export const CDX_PDF_SHA256 = "489a51a0c3fbc3e466afb649d34781b0ef65f4380d681aba3b15dd8b116f2e4c"
/** SHA-256 của 41 ô bản dạy (đã nâng 8ve, nối bằng \n) — test so khớp để chặn sửa lệch nguồn. */
export const CDX_ASSET_DERIVED_SHA256 = "6703b8fd1f89d45ee63c954b46c142ca962f0ff094309e1e67447d4e4f2b7df2"

/** 41 ô, cao độ nguyên bản (Am), đã hiệu đính. */
export const CDX_ASSET_BARS: string[] = [
  "r.4 2.4.4 3.5.4{tu 3} 0.3{slur s1}.8{tu 3} 2.3{slur s1}.8{tu 3} 2.3.4{tu 3} |",
  "2.3{ch \"Am\"}.4{d} 2.4.8 2.3.8 1.2.4 2.4.8 |",
  "0.4{ch \"Dm\"}.4{d} 2.4{slur s2}.16 0.4{slur s2}.16 3.5.4{tu 3} 0.4.4{tu 3} 2.4{slur s3}.8{tu 3} 2.3{slur s3}.8{tu 3} |",
  "2.4{ch \"Am\"}.1 |",
  "2.4{t}.4 2.4.4 0.5.4{tu 3} 3.5{slur s4}.8{tu 3} 0.4{slur s4}.8{tu 3} 0.4.4{tu 3} |",
  "0.4{ch \"Dm\"}.4{d} 2.4.8 0.4.8 3.5.4 3.4.8 |",
  "2.4{ch \"Am\"}.4{d} 2.4{slur s5}.16 3.4{slur s5}.16 2.4.4{tu 3} 2.3.4{tu 3} 1.2.4{tu 3} |",
  "0.2{ch \"E\"}.1 |",
  "0.2{t}.4 0.2.4 2.4.4{tu 3} 1.3{slur s6}.8{tu 3} 2.3{slur s6}.8{tu 3} 2.3.4{tu 3} |",
  "2.3{ch \"Am\"}.4{d} 2.4.8 2.3.8 1.2.4 2.4.8 |",
  "0.4{ch \"Dm\"}.4{d} 2.4{slur s7}.16 0.4{slur s7}.16 3.5.4{tu 3} 0.4.4{tu 3} 2.4{slur s8}.8{tu 3} 2.3{slur s8}.8{tu 3} |",
  "2.4{ch \"Am\"}.1 |",
  "2.4{t}.4 2.4.4 0.5.4{tu 3} 3.5{slur s9}.8{tu 3} 0.4{slur s9}.8{tu 3} 0.4.4{tu 3} |",
  "0.4{ch \"Dm\"}.4{d} 2.4.8 0.4.8 3.5.4 3.4.8 |",
  "2.4{ch \"E\"}.4{d} 2.4{slur s10}.16 3.4{slur s10}.16 2.4.4{tu 3} 1.3.4{tu 3} 0.2.4{tu 3} |",
  "2.3{ch \"Am\"}.1 |",
  "2.3{t ch \"Am\"}.4 r.4 r.4 2.3.4 |",
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
  "0.2{ch \"E7\"}.4 0.2.4 2.4.4{tu 3} 1.3{slur s11}.8{tu 3} 2.3{slur s11}.8{tu 3} 2.3.4{tu 3} |",
  "2.3{ch \"Am\"}.4{d} 2.4.8 2.3.8 1.2.4 2.4.8 |",
  "0.4{ch \"Dm\"}.4{d} 2.4{slur s12}.16 0.4{slur s12}.16 3.5.4{tu 3} 0.4.4{tu 3} 2.4{slur s13}.8{tu 3} 2.3{slur s13}.8{tu 3} |",
  "2.4{ch \"Am\"}.1 |",
  "2.4{t}.4 2.4.4 0.5.4{tu 3} 3.5{slur s14}.8{tu 3} 0.4{slur s14}.8{tu 3} 0.4.4{tu 3} |",
  "0.4{ch \"Dm\"}.4{d} 2.4.8 0.4.8 3.5.4 3.4.8 |",
  "2.4{ch \"E\"}.4{d} 2.4{slur s15}.16 3.4{slur s15}.16 2.4.4{tu 3} 0.3.4{tu 3} 0.2.4{tu 3} |",
  "2.3{ch \"Am\"}.1 |",
  "2.3{t}.4 r.4 r.2"
]

/** Lời ca theo ô (âm tiết theo thứ tự nốt; nốt đích Tie, nốt thứ hai của Slur và nốt nghỉ không có âm tiết mới). Ô 41 không lời. */
export const CDX_ASSET_LYRICS: string[] = [
  "Con đường xưa em",
  "đi vàng lên mái tóc",
  "thề ngõ hồn dâng tái",
  "tê",
  "Anh làm thơ Vu",
  "qui khách qua đường lắng",
  "nghe chuyện tình ta đã",
  "ghi",
  "Nhưng mùa trăng Vu",
  "qui vì mưa gió không",
  "về chiến trường anh bước",
  "đi",
  "Có nàng hoen đôi",
  "mi ngóng theo đường vẳng",
  "hoe hỏi còn ai cố",
  "tri",
  "Em",
  "ơi nhìn gió lên",
  "khơi lòng có trông",
  "vời một người xa cuối",
  "trời Nơi",
  "đây phiên gác canh",
  "dài e ấp đôi",
  "lời mình còn nhớ thương",
  "hoài Em",
  "ơi màu áo phong",
  "sương mình ước huy",
  "hoàng được bàn tay chính",
  "nàng Dâng",
  "hoa dâng hết ân",
  "tình tình đến bao",
  "giờ hỏi đường xưa mà",
  "nhớ Con đường xưa em",
  "đi thời gian có quên",
  "gì đá mòn kia vẫn",
  "ghi",
  "Ghi một đêm trăng",
  "thanh quán bên đường vắng",
  "tanh chỉ còn em với",
  "anh",
  ""
]
