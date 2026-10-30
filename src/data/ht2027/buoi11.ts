// ── HÀNH TRÌNH 2027 · BUỔI 11 — BẢN THẢO (30/10/2026, Claude soạn, CHỜ THẦY DUYỆT) ──
// Chưa nằm trong repo. Khi Thầy duyệt: chép thành src/data/ht2027/buoi11.ts, gắn doc '/hanhtrinh2027/buoi-11'
// cho lesson tương ứng của Chặng 2 trong ht2027Program.ts và đăng ký trong Ht2027LessonPage.
// Khuôn: Buổi 01–09 (ôn tập 7 ngày + kiểm tra đầu tuần + bài tự kiểm tra + đáp án).
//
// ── NGUỒN (đã truy nguyên 30/10/2026; KHÔNG tự đặt định nghĩa) ──
//  1. ẢNH CỦA THẦY (3 tệp, cùng một hình số 4):
//       ~/App/khuôn hình.jpg — “Áp dụng khuôn hình số 4 · Ngăn khởi đầu 2”: chấm ở ngăn 2·3·5 (dây 1, 2, 6) · 2·4 (dây 3) · 2·4·5 (dây 4, 5);
//         chấm CAM dây 5 ngăn 2, chấm VÀNG dây 5 ngăn 5; chuỗi tông: Bm//D → Cm//Eb → C#m//E → Dm//F → Em//G.
//       ~/Pictures/01_Anh_theo_nam/2026/Khuôn hình 1 và 4.png — Bm//D: khuôn SỐ 4 (khung xanh, ngăn 2–5) cạnh khuôn SỐ 1 (khung đỏ, ngăn 6–10), ghi tên nốt tiếng Việt.
//       ~/Movies/Bộ video guitar lead/Khuôn hình số 4 (new).png — “Suggested Finger Pattern”: SỐ NGÓN 1·2·4 | 1·2·4 | 1·3 | 1·3·4 | 1·3·4 | 1·2·4
//         (dây 1→6); chấm đỏ = Rê. ⇒ cột “Ngón” trong bảng KHỚP hình của Thầy (không phải gợi ý riêng của bản thảo).
//     ĐÃ KIỂM BẰNG TÍNH TOÁN (kiem-tra-khuon-hinh-so-4.py, verify-b10-b11.py): mọi chấm đều thuộc Si thứ = Rê trưởng; cam = Si, vàng = Rê.
//     Hình số 1 (ngăn 6–10) cùng ảnh “1 và 4” — CHƯA đưa vào Buổi 10/11; dùng cho Buổi 12 “Kết nối các khuôn hình”.
//     (Ảnh “5 khuôn hình Am.png” là tư liệu của bên thứ ba © Play Guitar Podcast 2018 — chỉ dùng để đối chiếu hình dạng, KHÔNG đưa vào bài.)
//  2. LỜI THẦY GIẢNG (transcript trong kho tri thức, kho.db): GL8 Buổi 2 (video 7n6RTjZlusU: nguyên liệu, chiếc mặt nạ, bê khuôn, bảo toàn tai và cự ly ngón),
//     GL6 Buổi 4 (1Qzsaafj76w: khuôn số 4 và số 1, mốc La trưởng, “cặp Si thứ – Rê trưởng, hai khuôn hình”),
//     GL4 Buổi 2 (KrLnmG9XP1E: thế tay = vị trí ngón trỏ, số La Mã; khuôn số 4 chủ âm dây 5, số 1 chủ âm dây 6; năm khuôn, học hai),
//     GL7 Buổi 4 (WK5tANDxvic: “bê khuôn lên, tên nốt đổi”; nốt kết để tìm tông; ngăn đầu = La thứ và Đô trưởng).
//  3. Bảng ngăn/số bậc: SUY RA bằng tính toán từ (1), không phải tài liệu riêng của Thầy. Ý nghĩa “chấm cam/vàng = hai chủ âm của cặp” là cách đọc ảnh
//     (cam trùng Si của Bm, vàng trùng Rê của D); Thầy chưa viết giải thích bằng lời trong tài liệu tìm được — Thầy xác nhận.
// ── CHƯA CÓ NGUỒN / CẦN THẦY ──
//  · KHUÔN SỐ 1: CÓ sơ đồ (ảnh “1 và 4”) nhưng Buổi này chỉ dạy số 4; số 1 để Buổi 12.
//  · “Kết nối các khuôn hình” là Buổi 12 (mới có đề cương).
//  · Cách đặt thuật ngữ trong bản này (“chấm cam/chấm vàng”, “nhà”) theo ảnh của Thầy và Buổi 1–9; Thầy xem lại.
//  · Chưa biết học viên HT2027 đã học khuôn số 4 ở lớp Tỉa nốt hay chưa ⇒ tuần này dạy từ đầu ở mức tối thiểu.
//  · Mức giọng thứ: chỉ thứ tự nhiên (đúng bảy nốt của cặp trưởng); không đụng thứ hoà âm/giai điệu vì chưa có nguồn.
// CHƯA LÀM: kiểm tay thật, xem trước Admin, nghe thử.
import type { LessonDoc } from '../../lesson/lessonTypes'

export const HT2027_BUOI11: LessonDoc = {
  "meta": {
    "programCode": "HT2027",
    "programName": "HÀNH TRÌNH 2027",
    "sessionNo": 11,
    "title": "Khuôn hình trong giọng thứ",
    "stageLabel": "Chặng 2 · Làm chủ khuôn hình và phát triển giai điệu trên cần đàn · Tài liệu ôn tập 7 ngày",
    "backHref": "/hanhtrinh2027"
  },
  "sections": [
    {
      "kind": "study",
      "title": "Tổng quan tuần ôn",
      "blocks": [
        {
          "b": "p",
          "text": "Lộ trình 7 ngày: giọng thứ nghe ra sao – nhà của giọng thứ trong khuôn – cặp trưởng/thứ dùng chung hình – bê khuôn sang giọng thứ khác – số bậc trong giọng thứ – ốp một câu hát buồn vào khuôn – nộp bài"
        },
        {
          "b": "callout",
          "label": "KẾT QUẢ CUỐI TUẦN",
          "text": "Bạn chỉ ra được nhà của giọng thứ trong khuôn số 4 (chấm cam), chạy bảy nốt lên và xuống theo số bậc thứ, phân biệt được một bài là trưởng hay thứ bằng tai, và ốp một câu hát ở giọng thứ vào khuôn."
        },
        {
          "b": "callout",
          "label": "CÙNG MỘT HÌNH, HAI NHÀ",
          "text": "Ở Buổi 10 nhà của giọng trưởng là chấm vàng. Tuần này ta nhìn lại đúng hình ấy nhưng đặt nhà ở chấm cam, ba ngăn thấp hơn chấm vàng trên cùng dây 5: ta có giọng thứ. Thầy gọi hai giọng này là một cặp — Si thứ và Rê trưởng là một cặp, có hai khuôn hình."
        },
        {
          "b": "h",
          "text": "Cách học trong 7 ngày"
        },
        {
          "b": "table",
          "rows": [
            [
              "Mỗi ngày",
              "Thời lượng",
              "Sản phẩm"
            ],
            [
              "Ngày 1–2",
              "20–25 phút",
              "Nghe trưởng và thứ + nhà của giọng thứ trong khuôn"
            ],
            [
              "Ngày 3–4",
              "25–30 phút",
              "Cặp trưởng/thứ + bê khuôn sang giọng thứ khác"
            ],
            [
              "Ngày 5–6",
              "25–35 phút",
              "Số bậc trong giọng thứ + ốp một câu hát"
            ],
            [
              "Ngày 7",
              "30–40 phút",
              "Phiếu nộp + video 60–90 giây"
            ]
          ]
        },
        {
          "b": "callout",
          "label": "QUY ƯỚC HỌC NHÓM",
          "text": "Chưa chắc một bài là trưởng hay thứ cũng không sao. Hãy đăng bài bạn đang phân vân lên nhóm để mọi người cùng nghe và đoán nốt kết."
        }
      ]
    },
    {
      "kind": "study",
      "title": "Bản đồ của cả tuần",
      "blocks": [
        {
          "b": "table",
          "rows": [
            [
              "Ngày",
              "Trọng tâm",
              "Việc cần hoàn thành"
            ],
            [
              "1",
              "Nghe trưởng và thứ",
              "Phân loại ba bài quen: trưởng hay thứ"
            ],
            [
              "2",
              "Nhà của giọng thứ",
              "Chạy bảy nốt Si thứ lên và xuống từ chấm cam"
            ],
            [
              "3",
              "Cặp trưởng/thứ",
              "Chỉ ra chấm cam và chấm vàng cách nhau ba ngăn, cùng dây 5"
            ],
            [
              "4",
              "Bê khuôn sang giọng thứ khác",
              "Tìm chấm cam ở thế tay III, IV, V, VII"
            ],
            [
              "5",
              "Số bậc trong giọng thứ",
              "Điền số bậc thứ lên hình"
            ],
            [
              "6",
              "Ốp câu hát vào khuôn",
              "Một câu ở giọng thứ, hai thế tay"
            ],
            [
              "7",
              "Nộp bài",
              "Phiếu nộp + video + câu hỏi cho buổi thực hành"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Kiểm tra đầu tuần — không tra tài liệu (nối từ Buổi 10)"
        },
        {
          "b": "write",
          "label": "1. Khuôn số 4 có chủ âm trên dây nào? Chấm vàng ở thế tay II là nốt gì?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "2. Khi dời khuôn thì cái gì đổi và cái gì được giữ nguyên?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "3. Số bậc của chấm ở dây 4 ngăn 4 (thế tay II, đọc theo Rê trưởng) là mấy?",
          "lines": 1
        },
        {
          "b": "callout",
          "label": "MỤC TIÊU CỦA TUẦN",
          "text": "Bạn đã có một hình. Tuần này bạn học nhìn lại chính hình ấy từ một ngôi nhà khác — giọng thứ — và nghe được sự khác nhau."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 1",
      "title": "Nghe trưởng và thứ",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Nghe ra một bài thuộc giọng trưởng hay giọng thứ trước khi tìm nốt trên đàn."
        },
        {
          "b": "h",
          "text": "1. Hai cảm giác"
        },
        {
          "b": "p",
          "text": "Giọng trưởng thường cho cảm giác vui tươi; giọng thứ cho cảm giác buồn. Khi mới học, chỉ cần nhận ra hai cảm giác ấy đã là tốt rồi; đừng vội nói thuật ngữ."
        },
        {
          "b": "h",
          "text": "2. Dùng nốt kết để kiểm"
        },
        {
          "b": "p",
          "text": "Tìm tông của một bài, ta dựa vào nốt cuối cùng của bài hát: đó là âm chủ. Nếu đàn nốt ấy làm nhà rồi chạy bảy nốt mà nghe “vui” là trưởng, “buồn” là thứ."
        },
        {
          "b": "ol",
          "items": [
            "Chọn ba bài quen. Hát hết bài rồi dừng thật tự nhiên.",
            "Tìm nốt cuối trên đàn; ghi lại.",
            "Chạy bảy nốt từ nốt đó, trưởng hay thứ? Ghi cảm nhận bằng lời của bạn."
          ]
        },
        {
          "b": "write",
          "label": "Ba bài, nốt kết và cảm giác (trưởng/thứ):",
          "lines": 3
        },
        {
          "b": "callout",
          "label": "LƯU Ý",
          "text": "Nghe sai thì mọi thứ phía sau lệch theo. Chưa chắc thì đánh dấu “chưa chắc” và đem lên nhóm."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 2",
      "title": "Nhà của giọng thứ trong khuôn",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Chạy bảy nốt của giọng thứ trong khuôn số 4, bắt đầu từ chấm cam."
        },
        {
          "b": "h",
          "text": "1. Bắt đầu từ chấm cam"
        },
        {
          "b": "p",
          "text": "Ở thế tay II, chấm cam là Si (dây 5 ngăn 2): bậc 1 của Si thứ. Hình vẫn là hình ở Buổi 10; chỉ khác là ta lấy chấm cam làm nhà."
        },
        {
          "b": "table",
          "rows": [
            [
              "Bậc",
              "1",
              "2",
              "3",
              "4",
              "5",
              "6",
              "7",
              "8"
            ],
            [
              "Nốt",
              "Si",
              "Đô♯",
              "Rê",
              "Mi",
              "Fa♯",
              "Sol",
              "La",
              "Si"
            ],
            [
              "Dây · ngăn",
              "dây 5 · 2",
              "dây 5 · 4",
              "dây 5 · 5",
              "dây 4 · 2",
              "dây 4 · 4",
              "dây 4 · 5",
              "dây 3 · 2",
              "dây 3 · 4"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Khác với giọng trưởng: nhà nằm sát phía thấp của hình, nên phần lớn hình nằm phía TRÊN nhà. Hình còn các chấm phía trên: dây 2 ngăn 2 · 3 · 5 (bậc 2 · 3 · 4 cao) và dây 1 ngăn 2 · 3 · 5 (bậc 5 · 6 · 7 cao); và phía dưới nhà: dây 6 ngăn 2 · 3 · 5 (bậc 5 · 6 · 7 thấp)."
        },
        {
          "b": "h",
          "text": "2. Thực hành"
        },
        {
          "b": "ul",
          "items": [
            "Chạy từ bậc 1 lên bậc 8 rồi xuống lại, chậm, đọc tên nốt.",
            "Dừng ở bậc 1, 3, 5: nghe ba nốt này tạo nên hợp âm thứ.",
            "Chạy xuống dưới nhà: bậc 7, 6, 5 thấp trên dây 6."
          ]
        },
        {
          "b": "write",
          "label": "Nốt nào nghe “buồn” nhất trong dải này? Vì sao theo bạn?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "GHI NHỚ",
          "text": "Cùng một hình; nhà đặt ở chấm cam thì ta có giọng thứ."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 3",
      "title": "Cặp trưởng và thứ dùng chung hình",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Thấy rằng chấm cam và chấm vàng cùng thuộc một hình và cách nhau ba ngăn."
        },
        {
          "b": "h",
          "text": "1. Hai nhà, một hình"
        },
        {
          "b": "table",
          "rows": [
            [
              "",
              "Giọng thứ",
              "Giọng trưởng"
            ],
            [
              "Chấm nhà (thế tay II)",
              "Cam: Si · dây 5 ngăn 2",
              "Vàng: Rê · dây 5 ngăn 5"
            ],
            [
              "Bảy nốt",
              "Si Đô♯ Rê Mi Fa♯ Sol La",
              "Rê Mi Fa♯ Sol La Si Đô♯"
            ],
            [
              "Cảm giác",
              "Buồn",
              "Vui tươi"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Hai giọng dùng cùng bảy nốt và cùng một hình; chỉ khác nốt nào là nhà. Ba ngăn là khoảng cách giữa hai nhà trên dây 5, ở mọi thế tay."
        },
        {
          "b": "h",
          "text": "2. Thực hành"
        },
        {
          "b": "ol",
          "items": [
            "Chạy hình ở thế tay II, kết ở chấm cam: nghe “thứ”.",
            "Chạy đúng các nốt ấy, kết ở chấm vàng: nghe “trưởng”.",
            "Chỉ ra trong hình nốt nào là bậc 3 của giọng thứ (Rê). Nốt ấy là bậc mấy của giọng trưởng?"
          ]
        },
        {
          "b": "write",
          "label": "Cùng một hình, vì sao chỉ đổi nhà mà cảm giác đổi?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "GHI NHỚ",
          "text": "Một hình, hai nhà. Đó là lý do ta học ít khuôn mà dùng được nhiều giọng."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 4",
      "title": "Bê khuôn sang giọng thứ khác",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Dời hình sang thế tay khác và tìm nhà thứ mới."
        },
        {
          "b": "h",
          "text": "1. Chấm cam dời theo ngón trỏ"
        },
        {
          "b": "p",
          "text": "Chấm cam luôn nằm ở dây 5, ngay dưới ngón trỏ (cùng ngăn với thế tay). Dời hình đi đâu thì nhà thứ đi theo đó."
        },
        {
          "b": "table",
          "rows": [
            [
              "Thế tay",
              "Giọng thứ (chấm cam)",
              "Vị trí chấm cam",
              "Cặp trưởng (chấm vàng)"
            ],
            [
              "II",
              "Si thứ",
              "dây 5 ngăn 2",
              "Rê trưởng"
            ],
            [
              "III",
              "Đô thứ",
              "dây 5 ngăn 3",
              "Mi♭ trưởng"
            ],
            [
              "IV",
              "Đô♯ thứ",
              "dây 5 ngăn 4",
              "Mi trưởng"
            ],
            [
              "V",
              "Rê thứ",
              "dây 5 ngăn 5",
              "Fa trưởng"
            ],
            [
              "VII",
              "Mi thứ",
              "dây 5 ngăn 7",
              "Sol trưởng"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Thầy cũng nói: nếu bê hình về ngăn đầu tiên thì đó chính là La thứ và Đô trưởng (các dây buông nằm ngay trong hình). Nhạc Việt phần lớn ở La thứ nên đây là chỗ ta sẽ gặp nhiều nhất."
        },
        {
          "b": "h",
          "text": "2. Thực hành"
        },
        {
          "b": "ol",
          "items": [
            "Đặt ngón trỏ ở ngăn 5 (thế tay V): chấm cam là Rê. Chạy bảy nốt Rê thứ.",
            "Làm tương tự ở thế tay VII (Mi thứ).",
            "Mỗi lần dời, hãy tìm chấm vàng cùng hình: bạn đang đứng ở nhà thứ hay nhà trưởng?"
          ]
        },
        {
          "b": "write",
          "label": "Khi dời hình, vị trí chấm cam so với ngón trỏ thay đổi hay không? Vì sao?",
          "lines": 2
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 5",
      "title": "Số bậc trong giọng thứ",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Biết mỗi chấm trong hình là bậc mấy của giọng thứ, tính từ chấm cam."
        },
        {
          "b": "h",
          "text": "1. Điền số bậc thứ vào hình"
        },
        {
          "b": "table",
          "rows": [
            [
              "Dây",
              "Ngăn · bậc"
            ],
            [
              "Dây 1",
              "2 → bậc 5 · 3 → bậc 6 · 5 → bậc 7"
            ],
            [
              "Dây 2",
              "2 → bậc 2 · 3 → bậc 3 · 5 → bậc 4"
            ],
            [
              "Dây 3",
              "2 → bậc 7 · 4 → bậc 1"
            ],
            [
              "Dây 4",
              "2 → bậc 4 · 4 → bậc 5 · 5 → bậc 6"
            ],
            [
              "Dây 5",
              "2 → bậc 1 (nhà) · 4 → bậc 2 · 5 → bậc 3"
            ],
            [
              "Dây 6",
              "2 → bậc 5 · 3 → bậc 6 · 5 → bậc 7"
            ]
          ]
        },
        {
          "b": "h",
          "text": "2. Đọc câu nhạc bằng số bậc thứ"
        },
        {
          "b": "p",
          "text": "Câu 3 – 2 – 1 trong giọng Si thứ là Rê – Đô♯ – Si; ở Rê thứ (thế tay V) cùng dãy số ấy là Fa – Mi – Rê. Số bậc không đổi khi dời khuôn."
        },
        {
          "b": "write",
          "label": "Điền số bậc thứ cho từng chấm trên hình bạn vẽ:",
          "lines": 3
        },
        {
          "b": "write",
          "label": "So với bảng số bậc của Buổi 10: một chấm có thể mang hai số bậc khác nhau không? Ví dụ chấm dây 5 ngăn 5:",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "NHẮC LẠI TỪ BUỔI 10",
          "text": "Số bậc phụ thuộc vào nhà bạn chọn. Cùng một chấm là bậc 1 nếu nhà ở đó, và là bậc khác nếu nhà ở chỗ khác."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 6",
      "title": "Ốp một câu hát vào khuôn",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Đưa một câu hát ở giọng thứ vào khuôn, ở hai thế tay."
        },
        {
          "b": "h",
          "text": "1. Cách làm"
        },
        {
          "b": "ol",
          "items": [
            "Chọn một câu hát ngắn (4–8 nốt) của bài ở giọng thứ. Tìm nốt kết bằng tai (Ngày 1).",
            "Viết câu bằng số bậc thứ.",
            "Đặt khuôn số 4 sao cho chấm cam trùng nốt kết. Đàn câu theo số bậc.",
            "Dời khuôn sang thế tay khác, đàn lại cùng dãy số."
          ]
        },
        {
          "b": "table",
          "rows": [
            [
              "So sánh",
              "Thế tay 1",
              "Thế tay 2"
            ],
            [
              "Thế tay",
              "___",
              "___"
            ],
            [
              "Chấm cam ở đâu",
              "___",
              "___"
            ],
            [
              "Độ cao nghe ra",
              "___",
              "___"
            ],
            [
              "Ngón tay thuận hơn ở đâu",
              "___",
              "___"
            ]
          ]
        },
        {
          "b": "write",
          "label": "Điều bạn nhận ra khi ốp một câu hát buồn vào khuôn (hai câu):",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "CẢNH BÁO",
          "text": "Chưa chắc nhà ở chấm nào thì quay lại nghe nốt kết. Đừng đoán theo thế tay."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 7",
      "title": "Nộp bài và mang câu hỏi đến lớp",
      "blocks": [
        {
          "b": "callout",
          "label": "NHIỆM VỤ CUỐI TUẦN",
          "text": "Nộp phiếu khuôn hình giọng thứ, kèm một câu hát viết bằng số bậc thứ và video 60–90 giây chơi câu đó ở hai thế tay."
        },
        {
          "b": "h",
          "text": "1. Phiếu nộp bài"
        },
        {
          "b": "table",
          "rows": [
            [
              "Mục",
              "Bạn điền"
            ],
            [
              "Tên bài và giọng thứ",
              "___"
            ],
            [
              "Nốt kết bạn nghe ra",
              "___"
            ],
            [
              "Thế tay thứ nhất · chấm cam ở đâu",
              "___"
            ],
            [
              "Thế tay thứ hai · chấm cam ở đâu",
              "___"
            ],
            [
              "Câu hát (số bậc thứ)",
              "___"
            ],
            [
              "Điều tôi nghe và thấy khi đổi nhà từ trưởng sang thứ",
              "___"
            ],
            [
              "Chỗ tôi còn phân vân",
              "___"
            ]
          ]
        },
        {
          "b": "h",
          "text": "2. Video 60–90 giây"
        },
        {
          "b": "ul",
          "items": [
            "Nói tên bài, giọng thứ và nốt kết.",
            "Chơi câu ở thế tay thứ nhất, nói số bậc đi kèm.",
            "Dời sang thế tay thứ hai, chơi lại.",
            "Nói một câu: “Điều tôi mới nhìn ra là…”."
          ]
        },
        {
          "b": "h",
          "text": "3. Trước khi đến buổi thực hành"
        },
        {
          "b": "ul",
          "items": [
            "Đăng phiếu và video lên nhóm.",
            "Nghe bài của ít nhất hai bạn: chỉ ra một chỗ rất rõ là giọng thứ, và một chỗ nên nghe lại nốt kết.",
            "Ghi một câu hỏi về giọng thứ hoặc cặp trưởng/thứ để thầy giải đáp."
          ]
        },
        {
          "b": "callout",
          "label": "MANG CÂU HỎI ĐẾN LỚP",
          "text": "Bài nào bạn chưa chắc là trưởng hay thứ? Đó là ví dụ tốt nhất cho buổi thực hành."
        }
      ]
    },
    {
      "kind": "study",
      "title": "Bài tự kiểm tra cuối tuần",
      "blocks": [
        {
          "b": "p",
          "text": "Làm không tra đáp án. Sau đó đối chiếu trang cuối và đánh dấu câu cần hỏi thêm."
        },
        {
          "b": "h",
          "text": "A. Nghe và nhà"
        },
        {
          "b": "write",
          "label": "1. Làm sao biết một bài là giọng trưởng hay giọng thứ?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "2. Chấm cam ở thế tay V là nốt gì? Đó là giọng thứ nào?",
          "lines": 2
        },
        {
          "b": "h",
          "text": "B. Cặp trưởng/thứ"
        },
        {
          "b": "write",
          "label": "3. Chấm cam và chấm vàng cách nhau mấy ngăn trên dây 5?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "4. Si thứ và Rê trưởng khác nhau ở đâu và giống nhau ở đâu?",
          "lines": 2
        },
        {
          "b": "h",
          "text": "C. Số bậc"
        },
        {
          "b": "write",
          "label": "5. Ở thế tay II, dây 3 ngăn 4 là bậc mấy của Si thứ? Nốt đó tên là gì?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "6. Câu 3 – 2 – 1 ở Si thứ là những nốt nào?",
          "lines": 2
        },
        {
          "b": "h",
          "text": "D. Tự đánh giá"
        },
        {
          "b": "table",
          "rows": [
            [
              "Năng lực",
              "Chưa",
              "Đang làm được",
              "Đã chắc"
            ],
            [
              "Nghe ra trưởng hay thứ",
              "",
              "",
              ""
            ],
            [
              "Tìm chấm cam ở một thế tay bất kỳ",
              "",
              "",
              ""
            ],
            [
              "Chạy bảy nốt thứ trong khuôn",
              "",
              "",
              ""
            ],
            [
              "Ốp một câu thứ vào khuôn",
              "",
              "",
              ""
            ]
          ]
        }
      ]
    },
    {
      "kind": "study",
      "title": "Đáp án gợi ý và mẫu trình bày",
      "blocks": [
        {
          "b": "h",
          "text": "Đáp án bài tự kiểm tra"
        },
        {
          "b": "ul",
          "items": [
            "Câu 1: Nghe nốt cuối cùng của bài (âm chủ), rồi chạy bảy nốt từ đó: nghe vui tươi là trưởng, nghe buồn là thứ.",
            "Câu 2: Rê; giọng Rê thứ.",
            "Câu 3: Ba ngăn.",
            "Câu 4: Giống: dùng cùng bảy nốt, cùng một hình. Khác: nốt nhà — Si (thứ) hay Rê (trưởng) — và cảm giác nghe ra.",
            "Câu 5: Bậc 1; nốt Si.",
            "Câu 6: Rê – Đô♯ – Si.",
            "Ngày 5 (chấm dây 5 ngăn 5): bậc 3 nếu nhà là Si thứ, bậc 1 nếu nhà là Rê trưởng (cùng một chấm)."
          ]
        },
        {
          "b": "h",
          "text": "Năm câu hỏi trước khi nộp"
        },
        {
          "b": "ul",
          "items": [
            "Tôi đã tìm nốt kết bằng tai trước khi đặt khuôn chưa?",
            "Chấm cam của tôi có trùng nốt kết không?",
            "Số bậc thứ của câu có đúng khi tôi dời khuôn không?",
            "Video của tôi nói được nốt kết, số bậc và hai thế tay không?",
            "Tôi đã ghi một câu hỏi cho buổi thực hành chưa?"
          ]
        },
        {
          "b": "callout",
          "label": "CHUẨN BỊ CHO BUỔI 12",
          "text": "Buổi 12 là kết nối các khuôn hình. Hãy chắc rằng bạn chạy được khuôn số 4 ở ít nhất hai thế tay và đọc được số bậc ở cả giọng trưởng lẫn giọng thứ."
        }
      ]
    }
  ]
}
