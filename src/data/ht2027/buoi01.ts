// ── HÀNH TRÌNH 2027 · BUỔI 01 — Tài liệu ôn tập 7 ngày ──
// Sinh từ file Word của Thầy (B1 - On-tap-7-ngay-Xay-dung-bo-hop-am-trong-mot-giong.docx); nguồn gốc là file Word,
// sửa nội dung thì sửa Word rồi chạy lại scripts/ht2027-docx-to-lesson.py.
import type { LessonDoc } from '../../lesson/lessonTypes'

export const HT2027_BUOI01: LessonDoc = {
  "meta": {
    "programCode": "HT2027",
    "programName": "HÀNH TRÌNH 2027",
    "sessionNo": 1,
    "title": "Xây dựng bộ hợp âm trong một giọng",
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
          "text": "Lộ trình tự học 7 ngày: hiểu – viết – nghe – chơi – ứng dụng"
        },
        {
          "b": "callout",
          "label": "KẾT QUẢ CUỐI TUẦN",
          "text": "Bạn tự xây được bộ hợp âm của một giọng trưởng và một giọng thứ; nhận ra các bậc I, IV, V, vi; tạo và chơi được vòng hòa thanh; phân tích sơ bộ một bài hát quen."
        },
        {
          "b": "h",
          "text": "Cách sử dụng tài liệu"
        },
        {
          "b": "table",
          "rows": [
            [
              "Mỗi ngày",
              "Thời lượng",
              "Việc cần làm"
            ],
            [
              "Ngày 1–2",
              "20–25 phút",
              "Ôn âm giai và tự tạo hợp âm ba"
            ],
            [
              "Ngày 3–4",
              "25–30 phút",
              "Xây bộ hợp âm và nghe chức năng"
            ],
            [
              "Ngày 5–6",
              "25–35 phút",
              "Tạo vòng, phân tích bài, làm quen giọng thứ"
            ],
            [
              "Ngày 7",
              "30–40 phút",
              "Tổng hợp, quay bài và tự kiểm tra"
            ]
          ]
        },
        {
          "b": "callout",
          "label": "NGUYÊN TẮC",
          "text": "Mỗi ngày phải có tiếng đàn. Đọc lý thuyết mà không chơi và không nghe thì chưa được tính là đã ôn."
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
              "Sản phẩm trong ngày"
            ],
            [
              "1",
              "Một giọng được tạo nên như thế nào?",
              "Viết đúng âm giai C, G, D trưởng"
            ],
            [
              "2",
              "Từ âm giai tạo hợp âm ba",
              "Tự chồng âm đủ 7 bậc của C trưởng"
            ],
            [
              "3",
              "Công thức bộ hợp âm trưởng",
              "Tự xây bộ hợp âm G và D trưởng"
            ],
            [
              "4",
              "Vai trò và cảm giác hòa thanh",
              "Nghe, chơi I–IV–V–I và I–V–vi–IV"
            ],
            [
              "5",
              "Từ bộ hợp âm đến bài hát",
              "Phân tích một bài quen theo số bậc"
            ],
            [
              "6",
              "Bộ hợp âm trong giọng thứ",
              "Xây Am; hiểu vì sao E/E7 thường thay Em"
            ],
            [
              "7",
              "Tổng hợp và nộp bài",
              "Một phiếu hoàn chỉnh + video 60–90 giây"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Bài kiểm tra đầu tuần"
        },
        {
          "b": "p",
          "text": "Không tra bảng, hãy thử làm nhanh. Sai không sao; mục đích là biết mình đang thiếu chỗ nào."
        },
        {
          "b": "write",
          "label": "1. Viết 7 nốt của âm giai G trưởng:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "2. Kể tên các hợp âm I, IV, V, vi trong giọng C trưởng:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "3. Theo bạn, vì sao hợp âm G thường muốn trở về C trong giọng C trưởng?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "GIỮ LẠI CÂU TRẢ LỜI",
          "text": "Ngày 7 bạn sẽ làm lại ba câu này và tự nhìn thấy mình đã tiến bộ ở đâu."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 1",
      "title": "Nền móng: viết đúng âm giai",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU HÔM NAY",
          "text": "Hiểu rằng bộ hợp âm không xuất hiện từ trí nhớ rời rạc; nó được sinh ra từ các nốt của âm giai."
        },
        {
          "b": "h",
          "text": "1. Công thức âm giai trưởng"
        },
        {
          "b": "p",
          "text": "Khoảng cách giữa các bậc của âm giai trưởng:"
        },
        {
          "b": "p",
          "text": "Cung – Cung – Nửa cung – Cung – Cung – Cung – Nửa cung"
        },
        {
          "b": "table",
          "rows": [
            [
              "Giọng",
              "Âm giai",
              "Dấu hóa cần chú ý"
            ],
            [
              "C trưởng",
              "C – D – E – F – G – A – B",
              "Không có"
            ],
            [
              "G trưởng",
              "G – A – B – C – D – E – F♯",
              "F♯"
            ],
            [
              "D trưởng",
              "D – E – F♯ – G – A – B – C♯",
              "F♯, C♯"
            ]
          ]
        },
        {
          "b": "h",
          "text": "2. Thực hành trên đàn"
        },
        {
          "b": "ul",
          "items": [
            "Chơi âm giai C trưởng đi lên và đi xuống thật chậm.",
            "Chơi âm giai G trưởng; dừng ở F♯ và đọc tên nốt thành tiếng.",
            "Chơi âm giai D trưởng; chú ý cả F♯ và C♯."
          ]
        },
        {
          "b": "h",
          "text": "3. Bài viết không nhìn bảng"
        },
        {
          "b": "write",
          "label": "C trưởng:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "G trưởng:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "D trưởng:",
          "lines": 1
        },
        {
          "b": "h",
          "text": "4. Tự kiểm tra"
        },
        {
          "b": "ul",
          "items": [
            "Tôi không lặp tên chữ cái và không bỏ sót bậc.",
            "Tôi viết đúng dấu thăng/giáng.",
            "Tôi vừa đọc tên nốt vừa chơi trên đàn."
          ]
        },
        {
          "b": "callout",
          "label": "LỖI DỄ MẮC",
          "text": "Viết G – A – B – C – D – E – G♭ là sai cách gọi. Trong giọng G trưởng, bậc VII phải mang tên F♯ để bảy bậc dùng đủ bảy tên nốt."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 2",
      "title": "Từ âm giai đến hợp âm ba",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU HÔM NAY",
          "text": "Biết tự lấy ba nốt cách bậc để tạo hợp âm trên từng bậc của âm giai."
        },
        {
          "b": "h",
          "text": "1. Quy tắc chồng âm"
        },
        {
          "b": "p",
          "text": "Bắt đầu tại một bậc, lấy một nốt – bỏ một nốt – lấy một nốt – bỏ một nốt – lấy một nốt. Khi đi quá nốt cuối, tiếp tục vòng lại từ đầu âm giai."
        },
        {
          "b": "table",
          "rows": [
            [
              "Bậc",
              "Nốt gốc",
              "Ba nốt hợp âm",
              "Tên hợp âm"
            ],
            [
              "I",
              "C",
              "C – E – G",
              "C"
            ],
            [
              "ii",
              "D",
              "D – F – A",
              "Dm"
            ],
            [
              "iii",
              "E",
              "E – G – B",
              "Em"
            ],
            [
              "IV",
              "F",
              "F – A – C",
              "F"
            ],
            [
              "V",
              "G",
              "G – B – D",
              "G"
            ],
            [
              "vi",
              "A",
              "A – C – E",
              "Am"
            ],
            [
              "vii°",
              "B",
              "B – D – F",
              "Bdim"
            ]
          ]
        },
        {
          "b": "h",
          "text": "2. Vì sao hợp âm trưởng hoặc thứ?"
        },
        {
          "b": "p",
          "text": "Tính chất của hợp âm do khoảng cách từ nốt gốc đến nốt thứ ba và nốt thứ năm quyết định. Trong giai đoạn này, bạn chưa cần tính từng cung; hãy quan sát và ghi nhớ quy luật chung của giọng trưởng ở Ngày 3."
        },
        {
          "b": "h",
          "text": "3. Tự làm lại giọng C"
        },
        {
          "b": "table",
          "rows": [
            [
              "Bậc",
              "Ba nốt tôi chọn",
              "Tên hợp âm"
            ],
            [
              "I",
              "________________",
              "________"
            ],
            [
              "ii",
              "________________",
              "________"
            ],
            [
              "iii",
              "________________",
              "________"
            ],
            [
              "IV",
              "________________",
              "________"
            ],
            [
              "V",
              "________________",
              "________"
            ],
            [
              "vi",
              "________________",
              "________"
            ],
            [
              "vii°",
              "________________",
              "________"
            ]
          ]
        },
        {
          "b": "h",
          "text": "4. Trên đàn"
        },
        {
          "b": "p",
          "text": "Chơi lần lượt C – Dm – Em – F – G – Am. Với Bdim, chỉ cần nghe hoặc bấm chậm; chưa yêu cầu chuyển nhanh."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 3",
      "title": "Công thức bộ hợp âm giọng trưởng",
      "blocks": [
        {
          "b": "callout",
          "label": "CÔNG THỨC PHẢI THUỘC",
          "text": "I – ii – iii – IV – V – vi – vii°  =  Trưởng – thứ – thứ – Trưởng – Trưởng – thứ – giảm."
        },
        {
          "b": "h",
          "text": "1. Cách xây bộ hợp âm trong 3 bước"
        },
        {
          "b": "ol",
          "items": [
            "Viết đủ và đúng 7 nốt của âm giai.",
            "Đặt số bậc I đến vii lên từng nốt.",
            "Gắn tính chất: 1–4–5 trưởng; 2–3–6 thứ; 7 giảm."
          ]
        },
        {
          "b": "h",
          "text": "2. Làm mẫu giọng G trưởng"
        },
        {
          "b": "table",
          "rows": [
            [
              "Bậc",
              "I",
              "ii",
              "iii",
              "IV",
              "V",
              "vi",
              "vii°"
            ],
            [
              "Nốt gốc",
              "G",
              "A",
              "B",
              "C",
              "D",
              "E",
              "F♯"
            ],
            [
              "Hợp âm",
              "G",
              "Am",
              "Bm",
              "C",
              "D",
              "Em",
              "F♯dim"
            ]
          ]
        },
        {
          "b": "h",
          "text": "3. Đến lượt bạn: giọng D trưởng"
        },
        {
          "b": "table",
          "rows": [
            [
              "Bậc",
              "I",
              "ii",
              "iii",
              "IV",
              "V",
              "vi",
              "vii°"
            ],
            [
              "Nốt gốc",
              "___",
              "___",
              "___",
              "___",
              "___",
              "___",
              "___"
            ],
            [
              "Hợp âm",
              "___",
              "___",
              "___",
              "___",
              "___",
              "___",
              "___"
            ]
          ]
        },
        {
          "b": "h",
          "text": "4. Luyện nói trước khi chơi"
        },
        {
          "b": "p",
          "text": "Đọc theo mẫu: “Trong giọng G trưởng, bậc I là G trưởng; bậc IV là C trưởng; bậc V là D trưởng; bậc vi là E thứ.” Sau đó làm tương tự với giọng D."
        },
        {
          "b": "write",
          "label": "Tôi còn nhầm ở bậc:",
          "lines": 1
        },
        {
          "b": "callout",
          "label": "DẤU HIỆU ĐÃ HIỂU",
          "text": "Bạn không cần thuộc từng bảng riêng. Chỉ cần biết âm giai và công thức, bạn có thể dựng lại bộ hợp âm bất cứ lúc nào."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 4",
      "title": "Nghe vai trò của hợp âm",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU HÔM NAY",
          "text": "Không chỉ biết hợp âm nào thuộc giọng, mà bắt đầu nghe được mỗi hợp âm đang làm gì trong dòng hòa thanh."
        },
        {
          "b": "table",
          "rows": [
            [
              "Nhóm chức năng",
              "Bậc thường gặp",
              "Cảm giác nghe",
              "Thử ở C"
            ],
            [
              "Chủ",
              "I, vi, iii",
              "Ổn định; nghỉ; trở về",
              "C, Am, Em"
            ],
            [
              "Hạ át",
              "IV, ii",
              "Mở ra; rời điểm nghỉ",
              "F, Dm"
            ],
            [
              "Át",
              "V, vii°",
              "Căng; đòi trở về I",
              "G, Bdim"
            ]
          ]
        },
        {
          "b": "h",
          "text": "1. Thí nghiệm nghe"
        },
        {
          "b": "ul",
          "items": [
            "Chơi C thật chậm và dừng: ghi nhận cảm giác ổn định.",
            "Chơi C – F và dừng ở F: nghe cảm giác câu nhạc đã mở ra.",
            "Chơi C – G và dừng ở G: đợi 3 giây, xem tai có chờ C xuất hiện không.",
            "Chơi C – F – G – C: chú ý cảm giác đi – căng – về."
          ]
        },
        {
          "b": "h",
          "text": "2. Hai vòng phải chơi"
        },
        {
          "b": "table",
          "rows": [
            [
              "Vòng theo bậc",
              "Trong C",
              "Trong G",
              "Nghe và ghi lại"
            ],
            [
              "I – IV – V – I",
              "C – F – G – C",
              "G – C – D – G",
              "Đi – căng – về"
            ],
            [
              "I – V – vi – IV",
              "C – G – Am – F",
              "G – D – Em – C",
              "Liên tục, quen thuộc"
            ]
          ]
        },
        {
          "b": "h",
          "text": "3. Nhật ký nghe"
        },
        {
          "b": "write",
          "label": "Khi dừng ở V, tôi cảm thấy:",
          "lines": 2
        },
        {
          "b": "write",
          "label": "Khi trở về I, tôi cảm thấy:",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "KHÔNG CÓ ĐÁP ÁN VĂN CHƯƠNG",
          "text": "Bạn có thể dùng từ rất đời thường: treo, căng, chưa xong, về nhà, nhẹ ra… Điều quan trọng là bạn thực sự nghe."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 5",
      "title": "Từ bộ hợp âm đến một bài hát",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU HÔM NAY",
          "text": "Biết đổi tên hợp âm thành số bậc để nhìn thấy cấu trúc chung, thay vì ghi nhớ từng bài như những mảnh rời."
        },
        {
          "b": "h",
          "text": "1. Đổi hợp âm thành bậc"
        },
        {
          "b": "table",
          "rows": [
            [
              "Giọng",
              "Hợp âm thực tế",
              "Viết theo bậc"
            ],
            [
              "C",
              "C – G – Am – F",
              "I – V – vi – IV"
            ],
            [
              "G",
              "G – D – Em – C",
              "I – V – vi – IV"
            ],
            [
              "D",
              "D – A – Bm – G",
              "I – V – vi – IV"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Ba vòng trên có cao độ và thế bấm khác nhau nhưng cùng một quan hệ hòa thanh."
        },
        {
          "b": "h",
          "text": "2. Phân tích một bài quen của bạn"
        },
        {
          "b": "write",
          "label": "Tên bài:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "Giọng của bài:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "Các hợp âm trong một đoạn:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "Đổi sang số bậc:",
          "lines": 1
        },
        {
          "b": "h",
          "text": "3. Kiểm tra hợp âm ngoài giọng"
        },
        {
          "b": "p",
          "text": "Nếu gặp một hợp âm không thuộc bộ hợp âm, đừng vội kết luận bài đã đổi giọng. Hợp âm ngoài giọng có thể là hợp âm át phụ, hợp âm vay mượn, biến đổi màu sắc hoặc chỉ xuất hiện thoáng qua. Hôm nay chỉ cần khoanh lại và mang đến hỏi Thầy."
        },
        {
          "b": "write",
          "label": "Hợp âm ngoài giọng tôi phát hiện (nếu có):",
          "lines": 1
        },
        {
          "b": "h",
          "text": "4. Thử dịch vòng"
        },
        {
          "b": "p",
          "text": "Lấy vòng của bài và chuyển sang một giọng khác bằng số bậc. Chơi chậm, mỗi hợp âm 4 phách."
        },
        {
          "b": "write",
          "label": "Giọng mới và vòng mới:",
          "lines": 1
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 6",
      "title": "Bộ hợp âm trong giọng thứ",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU HÔM NAY",
          "text": "Xây được bộ hợp âm thứ tự nhiên và hiểu một ngoại lệ thực hành rất quan trọng: bậc V thường được làm thành hợp âm trưởng hoặc hợp âm 7."
        },
        {
          "b": "h",
          "text": "1. Công thức giọng thứ tự nhiên"
        },
        {
          "b": "p",
          "text": "i – ii° – III – iv – v – VI – VII"
        },
        {
          "b": "p",
          "text": "thứ – giảm – Trưởng – thứ – thứ – Trưởng – Trưởng"
        },
        {
          "b": "table",
          "rows": [
            [
              "Bậc",
              "i",
              "ii°",
              "III",
              "iv",
              "v",
              "VI",
              "VII"
            ],
            [
              "A thứ tự nhiên",
              "Am",
              "Bdim",
              "C",
              "Dm",
              "Em",
              "F",
              "G"
            ]
          ]
        },
        {
          "b": "h",
          "text": "2. Vì sao trong Am thường gặp E hoặc E7?"
        },
        {
          "b": "p",
          "text": "Âm giai A thứ tự nhiên có nốt G nên hợp âm bậc v là Em. Trong thực hành hòa thanh, người ta thường nâng G lên G♯ để tạo nốt cảm âm hút mạnh về A. Khi đó:"
        },
        {
          "b": "table",
          "rows": [
            [
              "Thay đổi",
              "Các nốt",
              "Hợp âm",
              "Hiệu quả"
            ],
            [
              "G → G♯",
              "E – G♯ – B",
              "E trưởng",
              "Bậc V hút mạnh về Am"
            ],
            [
              "Thêm D",
              "E – G♯ – B – D",
              "E7",
              "Căng hơn, càng muốn về Am"
            ]
          ]
        },
        {
          "b": "callout",
          "label": "ĐIỂM CẦN HIỂU",
          "text": "E hoặc E7 trong giọng Am không phải lỗi. Đó là cách dùng âm giai thứ hòa thanh để làm rõ hướng V → i."
        },
        {
          "b": "h",
          "text": "3. Thực hành"
        },
        {
          "b": "ul",
          "items": [
            "Chơi Am – Dm – Em – Am; nghe bậc v thứ.",
            "Chơi Am – Dm – E7 – Am; so sánh lực hút về Am."
          ]
        },
        {
          "b": "write",
          "label": "Tôi nghe thấy khác nhau như sau:",
          "lines": 2
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 7",
      "title": "Tổng hợp và chuẩn bị đến lớp",
      "blocks": [
        {
          "b": "callout",
          "label": "NHIỆM VỤ CUỐI TUẦN",
          "text": "Hoàn thành một hồ sơ ngắn cho một giọng trưởng do bạn tự chọn, sau đó quay video 60–90 giây chứng minh bạn hiểu và chơi được."
        },
        {
          "b": "h",
          "text": "Phần A — Phiếu xây bộ hợp âm"
        },
        {
          "b": "write",
          "label": "Giọng trưởng tôi chọn:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "Âm giai:",
          "lines": 1
        },
        {
          "b": "table",
          "rows": [
            [
              "Bậc",
              "I",
              "ii",
              "iii",
              "IV",
              "V",
              "vi",
              "vii°"
            ],
            [
              "Nốt gốc",
              "___",
              "___",
              "___",
              "___",
              "___",
              "___",
              "___"
            ],
            [
              "Hợp âm",
              "___",
              "___",
              "___",
              "___",
              "___",
              "___",
              "___"
            ]
          ]
        },
        {
          "b": "write",
          "label": "Vòng hợp âm 4 ô nhịp:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "Viết vòng đó bằng số bậc:",
          "lines": 1
        },
        {
          "b": "h",
          "text": "Phần B — Video 60–90 giây"
        },
        {
          "b": "ul",
          "items": [
            "Nói tên giọng và đọc 7 nốt của âm giai.",
            "Nói tên I, IV, V, vi.",
            "Chơi I – IV – V – I, mỗi hợp âm 4 phách.",
            "Chơi vòng 4 hợp âm do bạn chọn, giữ nhịp liên tục."
          ]
        },
        {
          "b": "h",
          "text": "Phần C — Tự chấm"
        },
        {
          "b": "table",
          "rows": [
            [
              "Tiêu chí",
              "Chưa chắc",
              "Làm được chậm",
              "Làm được chắc"
            ],
            [
              "Viết đúng âm giai",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Xây đủ 7 hợp âm",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Nhận ra I–IV–V–vi",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Chơi đúng hợp âm",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Giữ nhịp liên tục",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Nghe V muốn về I",
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
      "title": "Bài kiểm tra cuối tuần",
      "blocks": [
        {
          "b": "p",
          "text": "Làm không nhìn bảng. Sau đó mới mở đáp án ở cuối tài liệu."
        },
        {
          "b": "h",
          "text": "Phần 1 — Kiến thức"
        },
        {
          "b": "write",
          "label": "1. Viết công thức tính chất 7 hợp âm trong một giọng trưởng:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "2. Viết âm giai A trưởng:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "3. Xây bộ hợp âm A trưởng:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "4. Trong giọng D trưởng, ii – V – I là những hợp âm nào?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "5. Trong giọng Am, vì sao E7 thường được dùng thay Em?",
          "lines": 2
        },
        {
          "b": "h",
          "text": "Phần 2 — Ứng dụng"
        },
        {
          "b": "write",
          "label": "6. Đổi vòng G – D – Em – C sang số bậc:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "7. Chuyển vòng trên sang giọng D:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "8. Viết một vòng có hướng chức năng: Chủ → Hạ át → Át → Chủ:",
          "lines": 1
        },
        {
          "b": "h",
          "text": "Phần 3 — Nghe và chơi"
        },
        {
          "b": "ul",
          "items": [
            "Chơi I – V rồi dừng: tai có muốn nghe I không?",
            "Chơi cùng một vòng ở hai giọng khác nhau: thế bấm, quãng giọng và màu nghe thay đổi thế nào?"
          ]
        },
        {
          "b": "write",
          "label": "Nhận xét của tôi:",
          "lines": 3
        }
      ]
    },
    {
      "kind": "study",
      "title": "Bảng tham khảo bộ hợp âm giọng trưởng",
      "blocks": [
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
            ],
            [
              "B♭",
              "B♭",
              "Cm",
              "Dm",
              "E♭",
              "F",
              "Gm",
              "Adim"
            ],
            [
              "E♭",
              "E♭",
              "Fm",
              "Gm",
              "A♭",
              "B♭",
              "Cm",
              "Ddim"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Bốn bậc ưu tiên trong giai đoạn đầu"
        },
        {
          "b": "table",
          "rows": [
            [
              "Bậc",
              "Tên gọi",
              "Vai trò thực hành"
            ],
            [
              "I",
              "Chủ",
              "Xác lập giọng; nơi trở về"
            ],
            [
              "IV",
              "Hạ át",
              "Mở chuyển động"
            ],
            [
              "V",
              "Át",
              "Tạo lực hút về I"
            ],
            [
              "vi",
              "Thứ tương đối",
              "Màu thứ quen thuộc trong giọng trưởng"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Công thức bỏ túi"
        },
        {
          "b": "callout",
          "label": "GIỌNG TRƯỞNG",
          "text": "1–4–5 trưởng • 2–3–6 thứ • 7 giảm."
        },
        {
          "b": "callout",
          "label": "GIỌNG THỨ TỰ NHIÊN",
          "text": "1–4–5 thứ • 3–6–7 trưởng • 2 giảm. Trong thực hành, V hoặc V7 trưởng thường thay v để hút mạnh về i."
        },
        {
          "b": "h",
          "text": "Ba câu tự hỏi khi phân tích bài"
        },
        {
          "b": "ul",
          "items": [
            "Giọng hiện tại là gì và âm giai gồm những nốt nào?",
            "Mỗi hợp âm đang là bậc mấy?",
            "Có hợp âm ngoài giọng không; nếu có, nó dẫn đến đâu và tạo màu gì?"
          ]
        }
      ]
    },
    {
      "kind": "study",
      "title": "Đáp án và gợi ý tự sửa",
      "blocks": [
        {
          "b": "h",
          "text": "Bài kiểm tra đầu tuần"
        },
        {
          "b": "p",
          "text": "1. G – A – B – C – D – E – F♯.  2. C, F, G, Am.  3. G là bậc V; nốt B trong hợp âm G có xu hướng đi lên C, còn F (nếu dùng G7) có xu hướng đi xuống E, tạo lực hút về hợp âm C."
        },
        {
          "b": "h",
          "text": "Bài kiểm tra cuối tuần"
        },
        {
          "b": "table",
          "rows": [
            [
              "Câu",
              "Đáp án ngắn"
            ],
            [
              "1",
              "Trưởng – thứ – thứ – Trưởng – Trưởng – thứ – giảm."
            ],
            [
              "2",
              "A – B – C♯ – D – E – F♯ – G♯."
            ],
            [
              "3",
              "A – Bm – C♯m – D – E – F♯m – G♯dim."
            ],
            [
              "4",
              "Em – A – D."
            ],
            [
              "5",
              "Nâng G thành G♯ tạo E hoặc E7; nốt G♯ hút về A, làm rõ V → i."
            ],
            [
              "6",
              "I – V – vi – IV."
            ],
            [
              "7",
              "D – A – Bm – G."
            ],
            [
              "8",
              "Ví dụ ở C: C – F – G – C; ở G: G – C – D – G."
            ]
          ]
        },
        {
          "b": "h",
          "text": "Cách tự sửa bài"
        },
        {
          "b": "ul",
          "items": [
            "Sai tên hợp âm: quay lại kiểm tra âm giai và dấu hóa trước.",
            "Đúng tên nhưng không hiểu: viết ba nốt cấu tạo của từng hợp âm.",
            "Chơi bị ngắt: giảm tempo, mỗi hợp âm 4 phách, ưu tiên đều nhịp.",
            "Không nghe được chức năng: lặp V – I và IV – V – I, để mỗi hợp âm ngân đủ lâu."
          ]
        },
        {
          "b": "callout",
          "label": "MANG ĐẾN BUỔI THỰC HÀNH",
          "text": "Guitar đã lên dây • Phiếu Ngày 7 đã hoàn thành • Video 60–90 giây • Một bài hát đã đổi sang số bậc • Hai câu hỏi thật sự còn vướng."
        }
      ]
    }
  ]
}
