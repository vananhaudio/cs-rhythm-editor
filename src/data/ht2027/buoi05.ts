// ── HÀNH TRÌNH 2027 · BUỔI 05 — Tài liệu ôn tập 7 ngày ──
// Soạn trực tiếp (chưa có file Word), cùng khuôn Buổi 04: 7 ngày + tự kiểm tra + đáp án.
// Có file Word thì chạy lại scripts/ht2027-docx-to-lesson.py để thay file này.
import type { LessonDoc } from '../../lesson/lessonTypes'

export const HT2027_BUOI05: LessonDoc = {
  "meta": {
    "programCode": "HT2027",
    "programName": "HÀNH TRÌNH 2027",
    "sessionNo": 5,
    "title": "Thay thế hợp âm",
    "stageLabel": "Chặng 1 · Làm chủ bộ hợp âm, vòng hòa âm và màu sắc hòa âm · Tài liệu ôn tập 7 ngày",
    "backHref": "/hanhtrinh2027"
  },
  "sections": [
    {
      "kind": "study",
      "title": "Tổng quan tuần ôn",
      "blocks": [
        {
          "b": "p",
          "text": "Lộ trình 7 ngày: cùng chức năng – chung nốt – thêm màu – kiểm giai điệu – chọn chỗ thay"
        },
        {
          "b": "callout",
          "label": "KẾT QUẢ CUỐI TUẦN",
          "text": "Bạn thay được một hợp âm trong vòng quen thuộc bằng hợp âm khác mà câu chuyện vẫn giữ hướng, giải thích được vì sao thay như vậy, và biết khi nào KHÔNG nên thay."
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
              "Thay thế cùng chức năng + tìm ứng viên bằng nốt chung"
            ],
            [
              "Ngày 3–4",
              "25–30 phút",
              "Thêm màu bằng hợp âm 7 / add9 + thay thế trong giọng thứ"
            ],
            [
              "Ngày 5–6",
              "25–35 phút",
              "Kiểm nốt giai điệu + chọn chỗ thay trong câu"
            ],
            [
              "Ngày 7",
              "30–40 phút",
              "Một bài thật với 2 phương án thay + video 60–90 giây"
            ]
          ]
        },
        {
          "b": "callout",
          "label": "QUY ƯỚC HỌC NHÓM",
          "text": "Thay thế là chỗ tai mỗi người nghe một khác. Đừng đăng đáp án, hãy đăng hai bản thu không ghi tên và hỏi nhóm nghe ra khác nhau ở đâu. Đến buổi thực hành, thầy sẽ giải đáp thêm."
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
              "Thay thế là đổi màu, giữ việc",
              "Nói được hợp âm nào thay được cho hợp âm nào, trong nhóm nào"
            ],
            [
              "2",
              "Nốt chung",
              "Tìm ứng viên thay thế bằng cách so nốt"
            ],
            [
              "3",
              "Thêm màu",
              "Chơi I, IV, V với maj7, add9, 7 mà không đổi chức năng"
            ],
            [
              "4",
              "Giọng thứ",
              "Thay thế trong Am: i, iv, V7"
            ],
            [
              "5",
              "Kiểm nốt giai điệu",
              "Phát hiện phép thay làm vướng giai điệu"
            ],
            [
              "6",
              "Chọn chỗ thay",
              "Giữ điểm khép, thay ở giữa câu hoặc lần lặp"
            ],
            [
              "7",
              "Một bài thật",
              "Nộp 2 phương án thay + lý do chọn"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Kiểm tra đầu tuần — không tra tài liệu"
        },
        {
          "b": "write",
          "label": "1. Trong giọng C, nhóm Hạ át gồm những hợp âm nào? Nhóm Át?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "2. Chơi C – F – G – C rồi C – Dm – G – C. Hai vòng khác nhau ở đâu, giống nhau ở đâu?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "3. Theo bạn, “thay hợp âm” khác “đổi giọng” ở điểm nào?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "MỤC TIÊU THAY THẾ",
          "text": "Không phải thuộc một bảng hợp âm thay thế. Khi bạn biết hợp âm đang làm việc gì, bạn tự tìm được người làm thay — và tự nghe ra người đó có hợp hay không."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 1",
      "title": "Thay thế là đổi màu, giữ việc",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Hiểu rằng thay hợp âm là đổi MÀU SẮC nhưng giữ VIỆC mà hợp âm đó đang làm trong câu nhạc."
        },
        {
          "b": "h",
          "text": "Ba nhóm, mỗi nhóm có ứng viên"
        },
        {
          "b": "table",
          "rows": [
            [
              "Nhóm",
              "Giọng C",
              "Giọng G",
              "Giọng D"
            ],
            [
              "Chủ",
              "C ↔ Am (Em)",
              "G ↔ Em (Bm)",
              "D ↔ Bm (F♯m)"
            ],
            [
              "Hạ át",
              "F ↔ Dm",
              "C ↔ Am",
              "G ↔ Em"
            ],
            [
              "Át",
              "G / G7 ↔ Bdim",
              "D / D7 ↔ F♯dim",
              "A / A7 ↔ C♯dim"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Bảng này không phải luật cứng. Nó chỉ cho biết: ở chỗ nào, ứng viên nào có cùng vai trò. Phần còn lại là việc của tai bạn."
        },
        {
          "b": "h",
          "text": "Thử ngay"
        },
        {
          "b": "ol",
          "items": [
            "Chơi C – F – G – C, mỗi hợp âm 4 phách.",
            "Chơi C – Dm – G – C. Chỉ thay F bằng Dm.",
            "Chơi Am – F – G – C. Chỉ thay C đầu vòng bằng Am.",
            "Ghi lại: bản nào nghe mềm hơn, bản nào nghe sáng hơn, bản nào giữ cảm giác “đi về nhà” rõ nhất?"
          ]
        },
        {
          "b": "h",
          "text": "Bài làm"
        },
        {
          "b": "write",
          "label": "Trong giọng G, vòng G – C – D7 – G. Thay C bằng hợp âm cùng nhóm Hạ át:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "Trong giọng D, vòng D – G – A7 – D. Thay G bằng hợp âm cùng nhóm Hạ át. Vòng mới là gì?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "NHỚ TỪ BUỔI 2",
          "text": "Cùng nhóm chức năng nghĩa là có vai trò gần nhau, không có nghĩa là hai hợp âm giống hệt hoặc luôn đổi chỗ được."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 2",
      "title": "Nốt chung: cách tìm ứng viên",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Tự tìm ứng viên thay thế bằng cách so nốt, thay vì tra bảng."
        },
        {
          "b": "h",
          "text": "1. Hai hợp âm chung nốt thì gần nhau"
        },
        {
          "b": "table",
          "rows": [
            [
              "Hợp âm gốc",
              "Ứng viên",
              "Nốt của hai hợp âm",
              "Nốt chung"
            ],
            [
              "C (C–E–G)",
              "Am (A–C–E)",
              "C E G / A C E",
              "C, E"
            ],
            [
              "C (C–E–G)",
              "Em (E–G–B)",
              "C E G / E G B",
              "E, G"
            ],
            [
              "F (F–A–C)",
              "Dm (D–F–A)",
              "F A C / D F A",
              "F, A"
            ],
            [
              "G7 (G–B–D–F)",
              "Bdim (B–D–F)",
              "G B D F / B D F",
              "B, D, F"
            ]
          ]
        },
        {
          "b": "h",
          "text": "2. Đọc bảng"
        },
        {
          "b": "ul",
          "items": [
            "Chung 2 nốt: ứng viên thay thế, thử bằng tai.",
            "Bdim chính là G7 bỏ nốt gốc G: chung cả 3 nốt, nên rất gần — và cũng nên nghe khác nhau chủ yếu ở bass.",
            "Em chung 2 nốt với C, nhưng vị trí iii rất “lưng chừng”; nhiều khi nó nghe như kéo dài vùng Chủ chứ không thay hẳn I."
          ]
        },
        {
          "b": "h",
          "text": "3. Phiếu thực hành — tự tìm nốt chung"
        },
        {
          "b": "table",
          "rows": [
            [
              "Cặp hợp âm",
              "Nốt chung"
            ],
            [
              "G (G–B–D) và Em (E–G–B)",
              "________________________"
            ],
            [
              "Am (A–C–E) và F (F–A–C)",
              "________________________"
            ],
            [
              "D (D–F♯–A) và Bm (B–D–F♯)",
              "________________________"
            ],
            [
              "Dm (D–F–A) và Bdim (B–D–F)",
              "________________________"
            ]
          ]
        },
        {
          "b": "callout",
          "label": "ĐĂNG LÊN NHÓM",
          "text": "Chọn một cặp chung nốt, chơi lần lượt từng hợp âm trong cùng một vòng và đăng hai bản thu. Hỏi nhóm: “Nốt chung có giúp hai hợp âm nghe gần nhau hơn không?”"
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 3",
      "title": "Thêm màu mà không đổi việc",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Phân biệt THAY hợp âm (đổi hợp âm khác) với THÊM MÀU (giữ hợp âm, thêm nốt)."
        },
        {
          "b": "h",
          "text": "1. Cùng một chức năng, nhiều lớp màu"
        },
        {
          "b": "table",
          "rows": [
            [
              "Bậc",
              "Hợp âm gốc",
              "Thêm màu",
              "Nốt thêm"
            ],
            [
              "I",
              "C",
              "Cmaj7 · Cadd9",
              "B · D"
            ],
            [
              "IV",
              "F",
              "Fmaj7",
              "E"
            ],
            [
              "ii",
              "Dm",
              "Dm7",
              "C"
            ],
            [
              "vi",
              "Am",
              "Am7",
              "G"
            ],
            [
              "V",
              "G",
              "G7",
              "F"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Hợp âm vẫn đứng ở chỗ cũ và làm việc cũ. Nốt thêm chỉ làm cho nó mềm hơn, ấm hơn hoặc căng hơn."
        },
        {
          "b": "h",
          "text": "2. Một phát hiện thú vị"
        },
        {
          "b": "ul",
          "items": [
            "Am7 gồm A – C – E – G, cũng là bốn nốt của C6 (C – E – G – A).",
            "Dm7 gồm D – F – A – C, cũng là bốn nốt của F6 (F – A – C – D).",
            "Cùng bốn nốt nhưng nghe khác vì nốt bass khác nhau — bass quyết định hợp âm được nghe là vi hay là I. Buổi 6 sẽ đi sâu chỗ này."
          ]
        },
        {
          "b": "h",
          "text": "Bài làm"
        },
        {
          "b": "write",
          "label": "Chơi C – Am – F – G, sau đó C – Am7 – Fmaj7 – G7. Bạn nghe vòng nào “người lớn” hơn? Chức năng có đổi không?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "Thay chỉ một hợp âm bằng bản thêm màu của nó. Hợp âm nào thêm màu nghe hợp nhất? Vì sao?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "LỖI DỄ MẮC",
          "text": "Thêm maj7 vào mọi hợp âm khiến vòng nghe nhòe và mất điểm tựa. Một vòng hay thường chỉ thêm màu ở một hoặc hai chỗ, còn lại giữ nguyên để có điểm so sánh."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 4",
      "title": "Thay thế trong giọng thứ",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Dùng nguyên tắc nhóm chức năng + nốt chung trong giọng thứ."
        },
        {
          "b": "h",
          "text": "1. Ứng viên trong giọng Am"
        },
        {
          "b": "table",
          "rows": [
            [
              "Bậc",
              "Hợp âm gốc",
              "Ứng viên",
              "Nốt chung"
            ],
            [
              "i",
              "Am (A–C–E)",
              "C (C–E–G) · F (F–A–C)",
              "C, E · A, C"
            ],
            [
              "iv",
              "Dm (D–F–A)",
              "F (F–A–C) · Bdim (B–D–F)",
              "F, A · D, F"
            ],
            [
              "V7",
              "E7 (E–G♯–B–D)",
              "G♯dim (G♯–B–D)",
              "G♯, B, D"
            ]
          ]
        },
        {
          "b": "ul",
          "items": [
            "F và C đều có thể thay Am, nhưng đổi màu rất khác: F đậm chất vi buồn, C chuyển sang sắc sáng của giọng song hành.",
            "G (bậc VII) đứng gần E7 trên cần đàn nhưng KHÔNG thay được E7: G không có nốt G♯ — chính là nốt dẫn về Am."
          ]
        },
        {
          "b": "h",
          "text": "2. Thử trên một vòng"
        },
        {
          "b": "table",
          "rows": [
            [
              "Bản gốc",
              "Bản thay",
              "Điều cần nghe"
            ],
            [
              "Am – Dm – E7 – Am",
              "Am – F – E7 – Am",
              "Hạ át đậm hơn, mềm hơn"
            ],
            [
              "Am – Dm – E7 – Am",
              "Am – Dm – G♯dim – Am",
              "Lực về Am thay đổi như thế nào?"
            ],
            [
              "Am – Dm – E7 – Am",
              "C – Dm – E7 – Am",
              "Điểm xuất phát có còn là Am không?"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Bài làm"
        },
        {
          "b": "write",
          "label": "Vòng Em – Am – B7 – Em (giọng Em). Tìm một ứng viên cho Am có chung hai nốt:",
          "lines": 2
        },
        {
          "b": "write",
          "label": "Chơi Am – Dm – E7 – Am và Am – F – E7 – Am. Ghi điều nghe được:",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "NHẮC LẠI TỪ BUỔI 4",
          "text": "Bậc V trong giọng thứ thường được đổi thành trưởng (E, E7) để có lực về. Khi thay thế, đừng làm mất nốt dẫn này."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 5",
      "title": "Kiểm nốt giai điệu trước khi thay",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Phát hiện phép thay làm vướng giai điệu: thay hợp âm phải nhìn vào nốt giai điệu đang đứng trên nó."
        },
        {
          "b": "h",
          "text": "1. Một câu hỏi duy nhất"
        },
        {
          "b": "p",
          "text": "Nốt giai điệu đang nằm trên hợp âm này có thuộc hợp âm mới không? Nếu không, nó sẽ sát một nốt của hợp âm mới và nghe vướng — có khi đó là màu đẹp, có khi là lạc."
        },
        {
          "b": "table",
          "rows": [
            [
              "Nốt giai điệu",
              "Hợp âm gốc",
              "Thay bằng",
              "Hợp âm mới có nốt đó?",
              "Nghe"
            ],
            [
              "E",
              "C",
              "Am",
              "Có (A–C–E)",
              "Hòa hợp"
            ],
            [
              "G",
              "C",
              "Am",
              "Không",
              "G sát A: vướng nhẹ"
            ],
            [
              "F",
              "F",
              "Dm",
              "Có (D–F–A)",
              "Hòa hợp"
            ],
            [
              "C",
              "F",
              "Dm",
              "Không",
              "C sát D: vướng"
            ],
            [
              "D",
              "G7",
              "Bdim",
              "Có (B–D–F)",
              "Hòa hợp"
            ],
            [
              "G",
              "G7",
              "Bdim",
              "Không",
              "G sát F: vướng, lại mất nốt gốc"
            ]
          ]
        },
        {
          "b": "h",
          "text": "2. Vướng có thật sự xấu?"
        },
        {
          "b": "ul",
          "items": [
            "Nốt giai điệu ngắn, đi qua thì thường bỏ qua được.",
            "Nốt giai điệu dài, rơi vào phách mạnh thì phải kiểm kỹ.",
            "Có khi “vướng” chính là màu mà bạn muốn — nhưng phải là lựa chọn có chủ đích, không phải ngẫu nhiên."
          ]
        },
        {
          "b": "h",
          "text": "Bài làm"
        },
        {
          "b": "write",
          "label": "Chọn một câu hát quen trong giọng C. Ghi nốt giai điệu rơi vào mỗi hợp âm của câu đó:",
          "lines": 2
        },
        {
          "b": "write",
          "label": "Thử thay MỘT hợp âm bằng ứng viên. Nốt giai điệu có thuộc hợp âm mới không? Bạn nghe thế nào?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "BÀI ĐĂNG NHÓM",
          "text": "Đăng một chỗ thay thế “nghe vướng” và một chỗ “nghe lạ nhưng hay”. Hỏi nhóm: theo bạn, khác biệt nằm ở đâu — ở nốt giai điệu, ở phách, hay ở bass?"
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 6",
      "title": "Chọn chỗ thay trong câu",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Quyết định THAY Ở ĐÂU: có những chỗ hợp âm nên giữ nguyên để câu nhạc còn điểm tựa."
        },
        {
          "b": "h",
          "text": "1. Ba chỗ nên cân nhắc"
        },
        {
          "b": "table",
          "rows": [
            [
              "Vị trí",
              "Vai trò",
              "Cách xử lý"
            ],
            [
              "Hợp âm kết câu (V → I)",
              "Khép câu, điểm nghỉ",
              "Giữ nguyên; thay nếu muốn câu chưa khép (V → vi)"
            ],
            [
              "Hợp âm giữa câu",
              "Đi đường, chuẩn bị",
              "Thay dễ nhất: thử ii ↔ IV, I ↔ vi"
            ],
            [
              "Lần lặp lại của vòng",
              "Giữ quen thuộc, thêm mới",
              "Lần 1 giữ gốc, lần 2 thay một chỗ"
            ]
          ]
        },
        {
          "b": "h",
          "text": "2. Nguyên tắc một chỗ mỗi lần"
        },
        {
          "b": "ul",
          "items": [
            "Mỗi lần chỉ thay một hợp âm để biết chính xác điều gì làm tai bạn thấy khác.",
            "Nếu thay hai chỗ, hãy chơi từng chỗ riêng rồi mới chơi cùng nhau.",
            "Một vòng 4 hợp âm thay cả 4 thì không còn là vòng cũ — nó là một vòng mới."
          ]
        },
        {
          "b": "h",
          "text": "3. Mở rộng tuỳ chọn (không bắt buộc)"
        },
        {
          "b": "p",
          "text": "G7 gồm G – B – D – F, trong đó B và F tạo lực căng. D♭7 (D♭ – F – A♭ – C♭, với C♭ chính là B) chia sẻ hai nốt B và F với G7. Vì vậy D♭7 có thể đứng thay G7 trước C, với bass đi xuống nửa cung từ D♭ về C. Nghe thử khi đã chắc phần trên; nếu chưa, bỏ qua cũng không sao."
        },
        {
          "b": "h",
          "text": "Bài làm"
        },
        {
          "b": "write",
          "label": "Vòng C – Am – F – G (chơi 2 lần). Lần 2, bạn thay hợp âm nào? Vì sao chọn chỗ đó?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "Câu kết của bài bạn đang tập là hợp âm gì? Bạn có thay không? Nếu thay thì sẽ nghe câu thế nào?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "CÂU HỎI TRƯỚC KHI THAY",
          "text": "Hợp âm này đang làm việc gì? Tôi muốn giữ việc đó hay muốn đổi? Nếu đổi, tôi đổi vì tai nghe ra điều gì?"
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 7",
      "title": "Một bài thật, hai phương án thay",
      "blocks": [
        {
          "b": "callout",
          "label": "NHIỆM VỤ CUỐI TUẦN",
          "text": "Chọn 8–16 ô nhịp của một bài quen. Tìm 2 phương án thay thế khác nhau và chọn ra phương án bạn muốn dùng — kèm lý do."
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
              "Giọng + vòng hợp âm gốc",
              "____________________________________________"
            ],
            [
              "Chức năng từng hợp âm",
              "____________________________________________"
            ],
            [
              "Phương án thay 1 (chỗ nào, bằng gì)",
              "____________________________________________"
            ],
            [
              "Phương án thay 2 (chỗ nào, bằng gì)",
              "____________________________________________"
            ],
            [
              "Nốt chung / lý do thay",
              "____________________________________________"
            ],
            [
              "Nốt giai điệu có vướng không?",
              "____________________________________________"
            ],
            [
              "Phương án chọn + vì sao",
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
            "Nói giọng, vòng gốc và chức năng từng hợp âm.",
            "Chơi vòng gốc một lần.",
            "Chơi phương án thay 1, rồi phương án thay 2 — nói rõ mỗi lần chỉ thay hợp âm nào.",
            "Nói một câu: “Tôi chọn phương án này vì…”."
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
            "Nghe bài của ít nhất hai bạn: chỉ ra một phép thay giữ đúng việc và một chỗ giai điệu có thể bị vướng.",
            "Nếu hai bạn thay khác nhau ở cùng một chỗ, cùng chơi cả hai và ghi lại điều nghe được."
          ]
        },
        {
          "b": "callout",
          "label": "MANG CÂU HỎI ĐẾN LỚP",
          "text": "Chỗ thay nào nghe hay mà bạn chưa giải thích được vì sao? Chỗ nào bạn thay đúng công thức nhưng nghe vẫn lạ? Đó chính là ví dụ tốt nhất để thầy giải đáp trong buổi Zoom."
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
          "text": "A. Tìm ứng viên"
        },
        {
          "b": "write",
          "label": "1. Trong giọng C, thay F trong C – F – G – C bằng hợp âm cùng nhóm Hạ át:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "2. Hợp âm nào chung hai nốt với C và có thể thay I giữa câu?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "3. Thay G7 bằng hợp âm có ba nốt. Nốt chung là gì?",
          "lines": 1
        },
        {
          "b": "h",
          "text": "B. Thêm màu và giai điệu"
        },
        {
          "b": "write",
          "label": "4. Cmaj7 gồm những nốt nào?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "5. Am7 gồm bốn nốt giống hợp âm nào?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "6. Nốt giai điệu là C đang nằm trên F. Thay F bằng Dm được không? Vì sao?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "7. Trong giọng Am, thay Dm bằng hợp âm nào? Chung nốt nào?",
          "lines": 1
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
              "Tìm ứng viên cùng chức năng",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Tìm ứng viên bằng nốt chung",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Phân biệt thay hợp âm với thêm màu",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Kiểm nốt giai điệu trước khi thay",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Quyết định chỗ thay trong câu",
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
            "Câu 1: Dm (C – Dm – G – C).",
            "Câu 2: Am (chung C, E); Em (chung E, G) cũng được nhưng lưng chừng hơn.",
            "Câu 3: Bdim (B – D – F), chung B, D, F với G7.",
            "Câu 4: C – E – G – B.",
            "Câu 5: C6 (C – E – G – A).",
            "Câu 6: Không nên, hoặc phải cân nhắc: Dm = D – F – A không có C, C sát D nên nghe vướng — nhất là khi nốt dài hoặc ở phách mạnh.",
            "Câu 7: F (chung F, A) hoặc Bdim (chung D, F)."
          ]
        },
        {
          "b": "h",
          "text": "Mẫu trình bày một phép thay"
        },
        {
          "b": "table",
          "rows": [
            [
              "Bước",
              "Mẫu: C – Am – F – G, lần 2 thay F"
            ],
            [
              "Giọng và chức năng",
              "C trưởng: C (T) – Am (T gần) – F (PD) – G (D)"
            ],
            [
              "Chỗ thay",
              "F là Hạ át giữa câu — thay được"
            ],
            [
              "Ứng viên",
              "Dm (chung F, A)"
            ],
            [
              "Kiểm giai điệu",
              "Nốt giai điệu trên F là A → có trong Dm: hòa hợp"
            ],
            [
              "Bản thay",
              "C – Am – Dm – G"
            ],
            [
              "Nghe",
              "Hạ át mềm hơn, đẩy đến G mượt hơn"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Năm câu hỏi trước khi thay một hợp âm"
        },
        {
          "b": "ul",
          "items": [
            "Hợp âm này đang làm việc gì (nhóm nào, trong giọng nào)?",
            "Ứng viên nào cùng nhóm hoặc chung nốt?",
            "Nốt giai điệu nằm trên nó có thuộc hợp âm mới không?",
            "Đây có phải chỗ khép câu hay điểm tựa cần giữ?",
            "Tôi muốn nghe điều gì mới — mềm hơn, sáng hơn, buồn hơn, hay chưa khép?"
          ]
        },
        {
          "b": "callout",
          "label": "CHUẨN BỊ CHO BUỔI 6",
          "text": "Bạn đã thấy Am7 và C6 cùng nốt nhưng khác chức năng nhờ bass. Buổi 6 sẽ đi vào hợp âm đảo và đường bass: cùng một hợp âm, đổi nốt thấp nhất, câu nhạc đã có một đường đi khác."
        }
      ]
    }
  ]
}
