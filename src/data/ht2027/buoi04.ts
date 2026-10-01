// ── HÀNH TRÌNH 2027 · BUỔI 04 — Tài liệu ôn tập 7 ngày ──
// Soạn trực tiếp (chưa có file Word), cùng khuôn Buổi 03: 7 ngày + tự kiểm tra + đáp án.
// Có file Word thì chạy lại scripts/ht2027-docx-to-lesson.py để thay file này.
import type { LessonDoc } from '../../lesson/lessonTypes'

export const HT2027_BUOI04: LessonDoc = {
  "meta": {
    "programCode": "HT2027",
    "programName": "HÀNH TRÌNH 2027",
    "sessionNo": 4,
    "title": "Dịch chuyển vòng hòa âm",
    "stageLabel": "Chặng 1 · Làm chủ bộ hợp âm, vòng hòa âm và màu sắc hòa âm · Tài liệu ôn tập 7 ngày",
    "backHref": "/hanhtrinh2027"
  },
  "sections": [
    {
      "kind": "study",
      "tag": "Trước khi bắt đầu",
      "title": "Tổng quan tuần ôn",
      "blocks": [
        {
          "b": "p",
          "text": "Lộ trình 7 ngày: giữ số bậc – đổi tên – đổi giọng – chọn giọng hợp người hát"
        },
        {
          "b": "callout",
          "label": "KẾT QUẢ CUỐI TUẦN",
          "text": "Bạn dịch được một vòng hòa âm sang giọng khác mà không cần tra bảng từng hợp âm: đọc vòng thành số bậc, chọn giọng mới, đọc lại tên — và biết khi nào nên đổi giọng, khi nào chỉ cần kẹp capo."
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
              "Nguyên tắc giữ số bậc + bộ hợp âm 6 giọng thông dụng"
            ],
            [
              "Ngày 3–4",
              "25–30 phút",
              "Dịch vòng có hợp âm 7 / ngoài giọng + đếm nửa cung, capo"
            ],
            [
              "Ngày 5–6",
              "25–35 phút",
              "Chọn giọng theo người hát + dịch vòng giọng thứ"
            ],
            [
              "Ngày 7",
              "30–40 phút",
              "Dịch một bài thật sang 2 giọng + video 60–90 giây"
            ]
          ]
        },
        {
          "b": "callout",
          "label": "QUY ƯỚC HỌC NHÓM",
          "text": "Dịch sai một hợp âm cũng không sao. Hãy đăng cả vòng gốc, số bậc và vòng đã dịch lên nhóm để mọi người soát từng bước — sai ở bước nào thì sửa đúng bước đó. Đến buổi thực hành, thầy sẽ giải đáp thêm."
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
              "Dịch giọng là giữ số bậc",
              "Hiểu vì sao vòng đổi tên mà không đổi cảm giác"
            ],
            [
              "2",
              "Bộ hợp âm 6 giọng",
              "Đọc nhanh I–vii° trong C, G, D, A, E, F"
            ],
            [
              "3",
              "Hợp âm 7 và hợp âm ngoài giọng",
              "Giữ nguyên tính chất và vai trò khi dịch"
            ],
            [
              "4",
              "Đếm nửa cung và capo",
              "Phân biệt hình bấm với âm thanh thật"
            ],
            [
              "5",
              "Chọn giọng hợp người hát",
              "Thử tông, nâng – hạ giọng có lý do"
            ],
            [
              "6",
              "Dịch vòng giọng thứ",
              "i – iv – V7 – i trong Am, Em, Dm"
            ],
            [
              "7",
              "Một bài thật",
              "Nộp vòng gốc + 2 bản dịch + câu hỏi mang đến lớp"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Kiểm tra đầu tuần — không tra tài liệu"
        },
        {
          "b": "write",
          "label": "1. Vòng C – G – Am – F trong giọng C trưởng có số bậc là gì?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "2. Vòng G – D – Em – C trong giọng G trưởng có số bậc là gì? So với câu 1, bạn thấy gì?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "3. Nếu chơi C – G – Am – F rồi chơi G – D – Em – C, tai bạn nghe chúng giống hay khác nhau? Giống ở đâu, khác ở đâu?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "MỤC TIÊU DỊCH GIỌNG",
          "text": "Không phải học thuộc thêm hàng chục vòng hợp âm. Một vòng đã hiểu bằng số bậc là một vòng bạn mang theo được sang mọi giọng."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 1",
      "title": "Dịch giọng là giữ số bậc",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Hiểu rằng khi dịch giọng, thứ được giữ lại là cấu trúc số bậc và chức năng; thứ thay đổi chỉ là tên hợp âm và độ cao."
        },
        {
          "b": "h",
          "text": "Cùng một câu chuyện, kể ở độ cao khác"
        },
        {
          "b": "table",
          "rows": [
            [
              "Số bậc",
              "I",
              "vi",
              "ii",
              "V7",
              "I"
            ],
            [
              "Giọng C",
              "C",
              "Am",
              "Dm",
              "G7",
              "C"
            ],
            [
              "Giọng G",
              "G",
              "Em",
              "Am",
              "D7",
              "G"
            ],
            [
              "Giọng D",
              "D",
              "Bm",
              "Em",
              "A7",
              "D"
            ],
            [
              "Chức năng",
              "T",
              "T gần",
              "PD",
              "D",
              "T"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Ba hàng tên hợp âm khác nhau hoàn toàn, nhưng hàng số bậc và hàng chức năng không đổi. Đó là lý do tai bạn nghe ra “cùng một vòng”, chỉ cao hơn hoặc thấp hơn."
        },
        {
          "b": "h",
          "text": "Quy trình 3 bước"
        },
        {
          "b": "ol",
          "items": [
            "Đọc vòng gốc thành số bậc (việc đã làm ở Buổi 3).",
            "Chọn giọng mới và viết bộ hợp âm của giọng đó.",
            "Đọc lại từng số bậc thành tên hợp âm trong giọng mới."
          ]
        },
        {
          "b": "h",
          "text": "Bài làm"
        },
        {
          "b": "write",
          "label": "Dịch C – Am – F – G (giọng C) sang giọng G. Ghi cả số bậc:",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "NHỚ TỪ BUỔI 3",
          "text": "Phải xác định giọng trước khi ghi số bậc. Đọc sai giọng ở bước 1 thì bản dịch sai toàn bộ, dù từng bước sau làm đúng."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 2",
      "title": "Bộ hợp âm của 6 giọng thông dụng trên guitar",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Đọc nhanh hợp âm của từng bậc trong các giọng guitar hay gặp, để dịch vòng mà không phải dò từng nốt."
        },
        {
          "b": "table",
          "rows": [
            [
              "Giọng",
              "I",
              "ii",
              "iii",
              "IV",
              "V",
              "vi",
              "vii°"
            ],
            [
              "C",
              "C",
              "Dm",
              "Em",
              "F",
              "G",
              "Am",
              "Bdim"
            ],
            [
              "G",
              "G",
              "Am",
              "Bm",
              "C",
              "D",
              "Em",
              "F♯dim"
            ],
            [
              "D",
              "D",
              "Em",
              "F♯m",
              "G",
              "A",
              "Bm",
              "C♯dim"
            ],
            [
              "A",
              "A",
              "Bm",
              "C♯m",
              "D",
              "E",
              "F♯m",
              "G♯dim"
            ],
            [
              "E",
              "E",
              "F♯m",
              "G♯m",
              "A",
              "B",
              "C♯m",
              "D♯dim"
            ],
            [
              "F",
              "F",
              "Gm",
              "Am",
              "B♭",
              "C",
              "Dm",
              "Edim"
            ]
          ]
        },
        {
          "b": "h",
          "text": "1. Đọc bảng theo cột"
        },
        {
          "b": "ul",
          "items": [
            "Cột I, IV, V luôn là hợp âm trưởng; cột ii, iii, vi luôn là hợp âm thứ; cột vii° là hợp âm giảm.",
            "Nhìn theo cột để thấy: “bậc V của giọng D là A”, “bậc vi của giọng A là F♯m”.",
            "Mỗi giọng ở bảng này cũng chính là bộ hợp âm bạn đã tự xây ở Buổi 1."
          ]
        },
        {
          "b": "h",
          "text": "2. Phiếu thực hành — đọc không nhìn bảng"
        },
        {
          "b": "table",
          "rows": [
            [
              "Câu hỏi",
              "Trả lời"
            ],
            [
              "Bậc IV của giọng D",
              "________________________"
            ],
            [
              "Bậc vi của giọng E",
              "________________________"
            ],
            [
              "Bậc ii của giọng A",
              "________________________"
            ],
            [
              "Bậc V của giọng F",
              "________________________"
            ],
            [
              "Bậc iii của giọng G",
              "________________________"
            ]
          ]
        },
        {
          "b": "callout",
          "label": "ĐĂNG LÊN NHÓM",
          "text": "Ra cho nhau một câu đố dạng “bậc __ của giọng __”. Người trả lời phải nói thêm hợp âm đó trưởng hay thứ, và vì sao."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 3",
      "title": "Dịch hợp âm 7 và hợp âm ngoài giọng",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Khi dịch, giữ nguyên TÍNH CHẤT hợp âm (trưởng, thứ, 7, giảm) và VAI TRÒ của nó, kể cả với hợp âm không nằm trong bộ hợp âm."
        },
        {
          "b": "h",
          "text": "1. Hợp âm 7 đi theo bậc của nó"
        },
        {
          "b": "table",
          "rows": [
            [
              "Số bậc",
              "I",
              "IV",
              "V7",
              "I"
            ],
            [
              "Giọng C",
              "C",
              "F",
              "G7",
              "C"
            ],
            [
              "Giọng A",
              "A",
              "D",
              "E7",
              "A"
            ],
            [
              "Giọng E",
              "E",
              "A",
              "B7",
              "E"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Chữ “7” không tự mất đi khi đổi giọng. G7 trong giọng C là V7, nên trong giọng A nó phải là E7 — không phải E, cũng không phải Em."
        },
        {
          "b": "h",
          "text": "2. Hợp âm ngoài giọng giữ nguyên hướng đi"
        },
        {
          "b": "table",
          "rows": [
            [
              "Vai trò",
              "I",
              "V7/ii",
              "ii",
              "V7",
              "I"
            ],
            [
              "Giọng C",
              "C",
              "A7",
              "Dm",
              "G7",
              "C"
            ],
            [
              "Giọng G",
              "G",
              "E7",
              "Am",
              "D7",
              "G"
            ],
            [
              "Giọng D",
              "D",
              "B7",
              "Em",
              "A7",
              "D"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Ở Buổi 3, A7 trong giọng C được khoanh là hợp âm “đẩy đến Dm”. Khi dịch, ta không tìm “A7 của giọng G” mà tìm hợp âm đẩy đến ii của giọng G — đó là E7 đẩy đến Am."
        },
        {
          "b": "h",
          "text": "Thử thêm"
        },
        {
          "b": "write",
          "label": "Dịch C – D7 – G7 – C sang giọng G. D7 ở giọng C đang đẩy đến đâu? Ở giọng G, hợp âm nào làm việc đó?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "Dịch C – Fm – C sang giọng D:",
          "lines": 1
        },
        {
          "b": "callout",
          "label": "LỖI DỄ MẮC",
          "text": "Gặp hợp âm lạ thì “làm tròn” thành hợp âm trong giọng mới cho dễ bấm. Làm vậy là đổi luôn màu sắc của vòng. Hãy dịch đúng tính chất trước, đơn giản hóa sau — và chỉ khi bạn chủ động chọn như vậy."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 4",
      "title": "Đếm nửa cung và dùng capo",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Dịch nhanh bằng khoảng cách, và phân biệt rõ HÌNH BẤM (tay trái bấm gì) với ÂM THANH THẬT (người nghe nghe giọng gì)."
        },
        {
          "b": "h",
          "text": "1. Mười hai nửa cung"
        },
        {
          "b": "p",
          "text": "C – C♯/D♭ – D – D♯/E♭ – E – F – F♯/G♭ – G – G♯/A♭ – A – A♯/B♭ – B – (C)"
        },
        {
          "b": "p",
          "text": "Mỗi phím đàn là một nửa cung. Từ C lên D là 2 nửa cung, nên dịch một vòng từ giọng C lên giọng D là nâng mọi hợp âm lên 2 nửa cung: C → D, Am → Bm, F → G, G7 → A7."
        },
        {
          "b": "h",
          "text": "2. Capo: giữ hình bấm, đổi âm thanh"
        },
        {
          "b": "table",
          "rows": [
            [
              "Hình bấm",
              "Capo",
              "Âm thanh thật"
            ],
            [
              "G",
              "Phím 2",
              "A"
            ],
            [
              "C",
              "Phím 2",
              "D"
            ],
            [
              "D",
              "Phím 2",
              "E"
            ],
            [
              "C",
              "Phím 3",
              "E♭"
            ],
            [
              "Am",
              "Phím 2",
              "Bm"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Capo phím 2 nâng mọi thứ lên 2 nửa cung. Bạn vẫn bấm vòng G – D – Em – C quen tay, nhưng người nghe nghe A – E – F♯m – D."
        },
        {
          "b": "h",
          "text": "Bài làm"
        },
        {
          "b": "write",
          "label": "Người hát cần giọng A. Bạn chỉ quen hình bấm giọng G. Kẹp capo phím mấy?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "Hình bấm C – Am – F – G, capo phím 3. Người nghe nghe những hợp âm nào?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "NGUYÊN TẮC",
          "text": "Khi trao đổi với người hát hoặc bạn chơi cùng, luôn nói ÂM THANH THẬT. Nói “mình đánh hình G capo 2” thì đủ cho người cầm đàn; người hát cần nghe “giọng A”."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 5",
      "title": "Chọn giọng hợp với người hát",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Đổi giọng có lý do: để câu cao nhất hát được thoải mái, câu thấp nhất vẫn còn tiếng — không đổi giọng chỉ vì dễ bấm."
        },
        {
          "b": "h",
          "text": "Quy trình thử tông"
        },
        {
          "b": "table",
          "rows": [
            [
              "Bước",
              "Hành động",
              "Câu hỏi"
            ],
            [
              "1",
              "Tìm câu cao nhất và câu thấp nhất của bài",
              "Hai câu này nằm ở đâu trong bài?"
            ],
            [
              "2",
              "Hát thử hai câu đó ở giọng gốc",
              "Câu cao có bị gồng? Câu thấp có bị mất tiếng?"
            ],
            [
              "3",
              "Nâng hoặc hạ từng 1–2 nửa cung",
              "Ở mức nào cả hai câu cùng thoải mái?"
            ],
            [
              "4",
              "Chọn cách chơi giọng mới",
              "Dịch hợp âm hay dùng hình cũ + capo?"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Đọc nhanh"
        },
        {
          "b": "ul",
          "items": [
            "Câu cao bị gồng → hạ giọng (dịch xuống).",
            "Câu thấp bị mất tiếng, hát không rõ → nâng giọng (dịch lên).",
            "Cả hai đầu đều khó → tầm giọng của bài rộng hơn tầm giọng người hát; chọn mức ưu tiên câu cao trào, hoặc mang câu hỏi đến lớp."
          ]
        },
        {
          "b": "h",
          "text": "Thử thêm"
        },
        {
          "b": "write",
          "label": "Bài ở giọng C, câu cao trào hơi căng. Bạn thử hạ 2 nửa cung. Giọng mới là giọng gì? Viết lại vòng C – Am – F – G:",
          "lines": 2
        },
        {
          "b": "write",
          "label": "Nếu giọng mới khó bấm, bạn dùng hình bấm nào + capo phím mấy để ra đúng giọng đó?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "CHƯA CHẮC KHÔNG SAO",
          "text": "Tai và giọng của mỗi người khác nhau. Bạn không cần tìm ra “giọng đúng” ngay; chỉ cần ghi lại đã thử những mức nào và nghe thấy gì ở từng mức."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 6",
      "title": "Dịch vòng giọng thứ",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Áp dụng đúng quy trình số bậc cho giọng thứ — nơi bậc V thường được đổi thành hợp âm trưởng để có lực về."
        },
        {
          "b": "h",
          "text": "1. Bộ hợp âm thường dùng của giọng thứ"
        },
        {
          "b": "table",
          "rows": [
            [
              "Giọng",
              "i",
              "iv",
              "V / V7",
              "VI",
              "VII"
            ],
            [
              "Am",
              "Am",
              "Dm",
              "E / E7",
              "F",
              "G"
            ],
            [
              "Em",
              "Em",
              "Am",
              "B / B7",
              "C",
              "D"
            ],
            [
              "Dm",
              "Dm",
              "Gm",
              "A / A7",
              "B♭",
              "C"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Trong giọng thứ, bậc v vốn là hợp âm thứ (Em trong giọng Am). Trong nhạc ta hay đệm, bậc này thường được đổi thành trưởng (E, E7) để tạo lực căng rõ trước khi về i. Khi dịch, giữ nguyên lựa chọn đó."
        },
        {
          "b": "h",
          "text": "2. Dịch một vòng"
        },
        {
          "b": "table",
          "rows": [
            [
              "Số bậc",
              "i",
              "iv",
              "V7",
              "i"
            ],
            [
              "Giọng Am",
              "Am",
              "Dm",
              "E7",
              "Am"
            ],
            [
              "Giọng Em",
              "Em",
              "Am",
              "B7",
              "Em"
            ],
            [
              "Giọng Dm",
              "Dm",
              "Gm",
              "A7",
              "Dm"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Bài làm"
        },
        {
          "b": "write",
          "label": "Dịch Am – F – G – Am sang giọng Em, ghi cả số bậc:",
          "lines": 2
        },
        {
          "b": "write",
          "label": "Dịch Am – Dm – G – C – E7 – Am sang giọng Dm:",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "PHÂN TÍCH PHẢI QUAY LẠI TIẾNG ĐÀN",
          "text": "Chơi cả vòng gốc và vòng đã dịch. Nếu hai vòng không nghe ra “cùng một câu chuyện”, hãy soát lại từng hợp âm — thường là một hợp âm 7 hoặc bậc V bị dịch sai tính chất."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 7",
      "title": "Dịch một bài thật",
      "blocks": [
        {
          "b": "callout",
          "label": "NHIỆM VỤ CUỐI TUẦN",
          "text": "Chọn 8–16 ô nhịp của một bài quen. Dịch sang 2 giọng khác nhau và chọn ra giọng hợp nhất với người hát — có thể là chính bạn."
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
              "Tên bài / đoạn",
              "____________________________________________"
            ],
            [
              "Giọng gốc + bằng chứng",
              "____________________________________________"
            ],
            [
              "Vòng hợp âm gốc",
              "____________________________________________"
            ],
            [
              "Số bậc",
              "____________________________________________"
            ],
            [
              "Bản dịch giọng 1",
              "____________________________________________"
            ],
            [
              "Bản dịch giọng 2",
              "____________________________________________"
            ],
            [
              "Giọng chọn + lý do",
              "____________________________________________"
            ],
            [
              "Cách chơi (dịch hay capo)",
              "____________________________________________"
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
            "Nói giọng gốc và số bậc của vòng chính.",
            "Chơi đoạn nhạc ở giọng gốc một lần.",
            "Chơi lại ở giọng đã chọn — nói rõ đang dịch hay dùng capo phím mấy.",
            "Nói một câu: “Tôi chọn giọng này vì…”."
          ]
        },
        {
          "b": "h",
          "text": "3. Trước khi đến buổi thực hành"
        },
        {
          "b": "ul",
          "items": [
            "Đăng phiếu nộp bài và video/audio lên nhóm.",
            "Soát bản dịch của ít nhất hai bạn: chỉ ra một hợp âm dịch đúng tính chất và một chỗ cần kiểm tra lại.",
            "Nếu hai người chọn giọng khác nhau cho cùng một bài, cả hai hát thử và ghi lại điều nghe được."
          ]
        },
        {
          "b": "callout",
          "label": "MANG CÂU HỎI ĐẾN LỚP",
          "text": "Những chỗ còn lúng túng — hợp âm ngoài giọng, giọng thứ, chọn giọng cho giọng nam/nữ — chính là ví dụ tốt nhất để thầy giải đáp và thực hành trong buổi Zoom."
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
          "text": "A. Dịch theo số bậc"
        },
        {
          "b": "write",
          "label": "1. Dịch G – D – Em – C (giọng G) sang giọng C:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "2. Dịch C – Am – F – G7 (giọng C) sang giọng D:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "3. Dịch Am – Dm – E7 – Am (giọng Am) sang giọng Em:",
          "lines": 1
        },
        {
          "b": "h",
          "text": "B. Capo và chọn giọng"
        },
        {
          "b": "write",
          "label": "4. Hình bấm C, capo phím 2. Người nghe nghe giọng gì?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "5. Người hát cần giọng A, bạn quen hình giọng G. Capo phím mấy?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "6. Bài ở giọng C quá cao với người hát. Hạ 3 nửa cung thì được giọng gì?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "7. Trong giọng C có A7 – Dm. Dịch sang giọng G thành gì? Vai trò của hợp âm 7 đó có đổi không?",
          "lines": 2
        },
        {
          "b": "h",
          "text": "C. Tự đánh giá"
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
              "Đọc vòng thành số bậc trước khi dịch",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Đọc nhanh bộ hợp âm 6 giọng thông dụng",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Giữ đúng tính chất hợp âm 7 / ngoài giọng",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Phân biệt hình bấm và âm thanh thật khi dùng capo",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Chọn giọng có lý do cho người hát",
              "☐",
              "☐",
              "☐"
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
            "Câu 1: I – V – vi – IV → C – G – Am – F.",
            "Câu 2: I – vi – IV – V7 → D – Bm – G – A7.",
            "Câu 3: i – iv – V7 – i → Em – Am – B7 – Em.",
            "Câu 4: Giọng D (nâng 2 nửa cung).",
            "Câu 5: Capo phím 2 (G lên A là 2 nửa cung).",
            "Câu 6: Giọng A (C → B → B♭ → A).",
            "Câu 7: E7 – Am. Vai trò không đổi: vẫn là V7/ii, đẩy mạnh đến bậc ii của giọng mới."
          ]
        },
        {
          "b": "h",
          "text": "Mẫu trình bày một bản dịch"
        },
        {
          "b": "table",
          "rows": [
            [
              "Bước",
              "Mẫu: C – Am – Dm – G7 – C sang giọng A"
            ],
            [
              "Giọng gốc",
              "C trưởng: G7→C khép câu, C là điểm nghỉ"
            ],
            [
              "Số bậc",
              "I – vi – ii – V7 – I"
            ],
            [
              "Bộ hợp âm giọng A",
              "A – Bm – C♯m – D – E – F♯m – G♯dim"
            ],
            [
              "Bản dịch",
              "A – F♯m – Bm – E7 – A"
            ],
            [
              "Cách chơi khác",
              "Hình G – Em – Am – D7 – G, capo phím 2"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Năm câu hỏi trước khi dịch"
        },
        {
          "b": "ul",
          "items": [
            "Vòng gốc đang ở giọng nào, và bằng chứng là gì?",
            "Số bậc của từng hợp âm là gì?",
            "Có hợp âm 7, hợp âm giảm hoặc hợp âm ngoài giọng nào cần giữ đúng tính chất?",
            "Vì sao chọn giọng mới này — vì người hát, vì màu âm hay vì dễ chơi?",
            "Chơi giọng mới bằng hình bấm mới hay bằng capo?"
          ]
        },
        {
          "b": "callout",
          "label": "CHUẨN BỊ CHO BUỔI 5",
          "text": "Khi đã nhìn vòng bằng số bậc và chức năng, bạn sẽ thấy nhiều hợp âm có thể đứng thay chỗ cho nhau mà câu chuyện vẫn giữ hướng. Buổi 5 sẽ đi vào thay thế hợp âm."
        }
      ]
    }
  ]
}
