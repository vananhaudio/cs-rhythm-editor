import type { RhythmScrollAnchoredData } from '../anchored.ts'

// ══════════════════════════════════════════════════════════════════════════
// "Chuyến Tàu Hoàng Hôn" — BỘ NEO VẠCH NHỊP THẬT, chỉ dùng cho trang thử local.
//
//   REAL_SHEET_ANCHORS = YES          48 ô nhịp + nhịp lấy đà "Chiều", trích từ 2 ảnh sheet in năm 1962
//                                     (13 khuông, 49 vạch nhịp; đã đối chiếu bằng mắt và bằng đối xứng lời 1/lời 2).
//   VISION_PRODUCTION_VERIFIED = NO   Trích bằng POC thủ công (CV + đọc lời), CHƯA qua pipeline production nào.
//
// • Lời + hợp âm: bản chuẩn Owner cung cấp. Nhãn "1." / "ĐK:" / "2." tách ra REAL_LABELS để không thành chữ.
// • `token` đếm chữ trong dòng SAU KHI bỏ [hợp âm]; neo cuối { line: 17, token: 10 } = hết dòng (ô ngân cuối bài).
// • Chưa xử lý dấu quay lại (segno): bài chạy thẳng một lượt như in trên sheet.
// • File chỉ được nạp bởi trang proof ở chế độ DEV — không vào bundle production, không phải dữ liệu canonical.
// ══════════════════════════════════════════════════════════════════════════

export const REAL_TITLE = 'Chuyến Tàu Hoàng Hôn'
/** Bolero chậm — tốc độ thực dụng để vừa đệm vừa hát thử. */
export const REAL_DEFAULT_BPM = 66

export const REAL_TEXT = [
  'Chiều [Am] nao, tiễn nhau [E7] đi khi bóng ngả xế [Am] tàn',
  'Hoàng [Dm] hôn đến đâu [G] đây màu tím dâng trong hồn [C] ta',
  'Muốn không gian đừng [Dm] trôi, níu đôi chân thời [F7] gian',
  'Ngừng trôi cho giây [A7] phút chia ly này kéo [Dm] dài',
  'Trước khi phân [F7] kỳ, ước sao cho [E7] tàu đừng [Am] đi',
  'Xe lăn êm [F7] êm lúc ga [G] chiều sắp lên [C] đèn',
  'Mưa thu bay [E7] bay vắt ngang trời ướt vai [Am] mềm',
  '[G] Hoàng hôn dần [C] buông',
  'Mà ai còn [F7] đứng im trong chiều sương [E7] xuống',
  'Tâm tư cô [F7] đơn trách con [G] tàu nỡ sao [C] đành',
  'Đem yêu thương [E7] đi đến nơi nao cách đôi [Am] tình',
  '[G] Đường bao nhịp [C] nối',
  'Tình trăm nghìn [F7] mối trông theo [E7] một bóng [Am] người',
  'Tà [Am] dương khuất trong [E7] sương là mỗi lần ngóng [Am] chờ',
  'Nhìn [Dm] theo phía chân [G] mây đợi chuyến xe xưa về [C] chưa',
  'Nếu hay chăng người [Dm] ơi, chốn xa xôi chàng [F7] trai',
  'Còn đem yêu thương [A7] rắc lên muôn vạn oán [Dm] hờn',
  'Nếu mai đây [F7] về cũng trên chuyến [E7] tàu hoàng [Am] hôn.',
].join('\n')

/** Nhãn đoạn, chỉ để trình bày: dòng → nhãn. */
export const REAL_LABELS: Record<number, string> = { 0: '1', 5: 'ĐK', 13: '2' }

export const REAL_DATA: RhythmScrollAnchoredData = {
  version: 2,
  prototype: true,
  songId: 'proto:chuyen-tau-hoang-hon',
  lyricsHash: 'proto-not-hashed',
  meter: { beats: 4, beatType: 4 },
  pickup: { line: 0, token: 0 },
  measures: [
    { line: 0, token: 1 }, { line: 0, token: 4 }, { line: 0, token: 9 }, { line: 1, token: 0 }, { line: 1, token: 1 }, { line: 1, token: 5 },
    { line: 1, token: 10 }, { line: 2, token: 0 }, { line: 2, token: 1 }, { line: 2, token: 6 }, { line: 3, token: 1 }, { line: 3, token: 7 },
    { line: 4, token: 0 }, { line: 4, token: 4 }, { line: 4, token: 9 }, { line: 5, token: 0 }, { line: 5, token: 3 }, { line: 5, token: 9 },
    { line: 6, token: 3 }, { line: 6, token: 9 }, { line: 7, token: 3 }, { line: 8, token: 3 }, { line: 8, token: 8 }, { line: 9, token: 0 },
    { line: 9, token: 3 }, { line: 9, token: 9 }, { line: 10, token: 3 }, { line: 10, token: 9 }, { line: 11, token: 3 }, { line: 12, token: 3 },
    { line: 12, token: 8 }, { line: 13, token: 0 }, { line: 13, token: 1 }, { line: 13, token: 4 }, { line: 13, token: 9 }, { line: 14, token: 0 },
    { line: 14, token: 1 }, { line: 14, token: 5 }, { line: 14, token: 10 }, { line: 15, token: 0 }, { line: 15, token: 1 }, { line: 15, token: 6 },
    { line: 16, token: 1 }, { line: 16, token: 7 }, { line: 17, token: 0 }, { line: 17, token: 4 }, { line: 17, token: 9 }, { line: 17, token: 10 },
  ],
  provenance: {
    sourceType: 'image',
    sourceHash: 'proto-not-hashed',
    generator: 'POC measure-anchor extraction 2026-10-03 (REAL_SHEET_ANCHORS; VISION_PRODUCTION_VERIFIED = NO)',
    generatedAt: '2026-10-03T00:00:00.000Z',
  },
}
