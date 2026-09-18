// ── HÀNH TRÌNH 2027 · BUỔI 02 — Tài liệu ôn tập 7 ngày ──
// Sinh từ file Word của Thầy (On-tap-7-ngay-Buoi-2-Chuc-nang-cua-hop-am.docx); nguồn gốc là file Word,
// sửa nội dung thì sửa Word rồi chạy lại scripts/ht2027-docx-to-lesson.py.
import type { LessonDoc } from '../../lesson/lessonTypes'

export const HT2027_BUOI02: LessonDoc = {
  "meta": {
    "programCode": "HT2027",
    "programName": "HÀNH TRÌNH 2027",
    "sessionNo": 2,
    "title": "Chức năng của hợp âm",
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
          "text": "Lộ trình 7 ngày: nghe nơi nghỉ – đường đi – lực căng – điểm trở về"
        },
        {
          "b": "callout",
          "label": "KẾT QUẢ CUỐI TUẦN",
          "text": "Em không chỉ gọi đúng tên hợp âm mà còn giải thích được hợp âm đang tạo cảm giác nghỉ, mở đường, gây căng hay đưa câu nhạc trở về."
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
              "Hiểu khái niệm; nhận ra nhóm Chủ"
            ],
            [
              "Ngày 3–4",
              "25–30 phút",
              "Nghe nhóm Hạ át và Át"
            ],
            [
              "Ngày 5–6",
              "25–35 phút",
              "Chơi hướng chức năng; thử thay thế hợp âm"
            ],
            [
              "Ngày 7",
              "30–40 phút",
              "Video 60–90 giây + câu hỏi mang đến lớp"
            ]
          ]
        },
        {
          "b": "callout",
          "label": "QUY ƯỚC HỌC NHÓM",
          "text": "Chưa làm được hoặc chưa hiểu cũng không sao. Hãy đăng câu hỏi, bản thu hoặc cách nghĩ của mình lên nhóm; hỏi nhau và tranh luận trước. Càng nhiều góc nhìn càng tốt. Đến buổi thực hành, thầy sẽ giải đáp thêm."
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
              "Chức năng là gì?",
              "Phân biệt tên hợp âm và vai trò trong giọng"
            ],
            [
              "2",
              "Nhóm Chủ (Tonic)",
              "Nghe I là nhà; so sánh I, vi, iii"
            ],
            [
              "3",
              "Nhóm Hạ át (Predominant)",
              "Nghe IV, ii mở đường và chuẩn bị"
            ],
            [
              "4",
              "Nhóm Át (Dominant)",
              "Nghe V, V7, vii° tạo lực về I"
            ],
            [
              "5",
              "Hướng đi chức năng",
              "Chơi T → PD → D → T; so sánh kết"
            ],
            [
              "6",
              "Thay thế cùng chức năng",
              "Thử đổi hợp âm nhưng giữ hướng đi"
            ],
            [
              "7",
              "Tổng hợp",
              "Thu bài, tự kiểm tra, thảo luận nhóm"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Kiểm tra đầu tuần — không tra tài liệu"
        },
        {
          "b": "write",
          "label": "1. Trong giọng C, hợp âm G thường muốn đi đâu? Vì sao?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "2. C và Am đều có thể tạo cảm giác khá ổn định. Chúng có giống hệt nhau không?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "3. Viết ba từ mô tả cảm giác của C – F – G – C:",
          "lines": 1
        },
        {
          "b": "callout",
          "label": "GIỮ NGUYÊN CÂU TRẢ LỜI",
          "text": "Ngày 7 em sẽ trả lời lại. Mục tiêu không phải dùng từ thật hàn lâm mà là nghe rõ hơn và giải thích mạch lạc hơn."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 1",
      "title": "Hợp âm đang làm gì?",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Hiểu: tên hợp âm cho biết cấu tạo; chức năng cho biết vai trò của nó trong một giọng và trong ngữ cảnh đang nghe."
        },
        {
          "b": "h",
          "text": "1. Một hợp âm, nhiều vai trò"
        },
        {
          "b": "table",
          "rows": [
            [
              "Hợp âm C xuất hiện trong",
              "Bậc",
              "Vai trò thường gặp"
            ],
            [
              "Giọng C trưởng",
              "I",
              "Chủ: điểm tựa, điểm về"
            ],
            [
              "Giọng G trưởng",
              "IV",
              "Hạ át: mở ra, rời điểm tựa"
            ],
            [
              "Giọng F trưởng",
              "V",
              "Át: tạo lực muốn về F"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Kết luận: chức năng không nằm cố định trong tên hợp âm. Nó phụ thuộc vào giọng và các hợp âm đứng trước – sau."
        },
        {
          "b": "h",
          "text": "2. Ba nhóm chức năng cốt lõi"
        },
        {
          "b": "table",
          "rows": [
            [
              "Nhóm",
              "Ký hiệu",
              "Cảm giác chính",
              "Trong C trưởng"
            ],
            [
              "Chủ",
              "T",
              "Ổn định, nghỉ, về nhà",
              "C; gần nhóm: Am, Em"
            ],
            [
              "Hạ át / chuẩn bị",
              "PD",
              "Rời nhà, mở ra, chuẩn bị lực căng",
              "F, Dm"
            ],
            [
              "Át",
              "D",
              "Căng, chưa xong, hướng mạnh về I",
              "G, G7, Bdim"
            ]
          ]
        },
        {
          "b": "h",
          "text": "3. Bài đàn và bài viết"
        },
        {
          "b": "ul",
          "items": [
            "Chơi riêng C, F, G; giữ mỗi hợp âm 4 phách và mô tả bằng một từ.",
            "Chơi C – F – G – C ba lần. Lần cuối nhắm mắt và chỉ nghe hướng đi."
          ]
        },
        {
          "b": "write",
          "label": "Từ của em cho C / F / G:",
          "lines": 1
        },
        {
          "b": "callout",
          "label": "ĐĂNG LÊN NHÓM",
          "text": "Viết: “Em đang nghe hợp âm ___ có cảm giác ___, mọi người có nghe giống vậy không?” Không cần chờ chắc chắn mới đăng."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 2",
      "title": "Nhóm Chủ: nơi đứng và nơi trở về",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Nghe I là điểm nghỉ mạnh nhất; hiểu vi và iii có thể chia sẻ màu ổn định nhưng không thay I trong mọi trường hợp."
        },
        {
          "b": "h",
          "text": "1. Mức độ ổn định"
        },
        {
          "b": "table",
          "rows": [
            [
              "Bậc",
              "Trong C",
              "Vai trò nghe",
              "Lưu ý"
            ],
            [
              "I",
              "C",
              "Chủ rõ nhất; kết câu trọn vẹn",
              "Điểm quy chiếu của giọng"
            ],
            [
              "vi",
              "Am",
              "Ổn định mềm, màu buồn hơn",
              "Có thể thay I giữa câu; V→vi là kết tránh"
            ],
            [
              "iii",
              "Em",
              "Mơ hồ, nhẹ; thường kéo dài vùng Chủ",
              "Phụ thuộc ngữ cảnh, không nên gắn nhãn cứng"
            ]
          ]
        },
        {
          "b": "h",
          "text": "2. Thí nghiệm A/B"
        },
        {
          "b": "ul",
          "items": [
            "Chơi F – G – C. Dừng 4 phách ở C và ghi cảm giác.",
            "Chơi F – G – Am. Dừng 4 phách ở Am và ghi điều khác biệt.",
            "Chơi C – Em – Am – C thật chậm; nghe ba sắc thái trong vùng tương đối ổn định."
          ]
        },
        {
          "b": "write",
          "label": "Về C khiến em cảm thấy:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "Về Am khiến em cảm thấy:",
          "lines": 1
        },
        {
          "b": "h",
          "text": "3. Câu hỏi tư duy"
        },
        {
          "b": "write",
          "label": "Nếu vi cùng nhóm Chủ, vì sao G – Am vẫn chưa “về nhà” trọn như G – C?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "ĐIỀU CẦN NHỚ",
          "text": "Cùng nhóm chức năng nghĩa là có nét vai trò gần nhau, không có nghĩa là hai hợp âm giống hệt hoặc luôn đổi chỗ được."
        },
        {
          "b": "callout",
          "label": "GỢI Ý THẢO LUẬN",
          "text": "Một bạn chơi F–G–C, một bạn chơi F–G–Am. Mỗi người chỉ mô tả điều mình nghe; sau đó tranh luận xem “ổn định” và “kết thúc” có phải một việc hay không."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 3",
      "title": "Nhóm Hạ át: mở đường",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Nghe IV và ii như bước rời khỏi vùng Chủ, thường chuẩn bị cho nhóm Át."
        },
        {
          "b": "table",
          "rows": [
            [
              "Bậc",
              "Trong C",
              "Nốt chung / liên hệ",
              "Cảm giác thường gặp"
            ],
            [
              "IV",
              "F",
              "F–A–C; có C chung với I",
              "Mở rộng, nâng câu nhạc lên"
            ],
            [
              "ii",
              "Dm",
              "D–F–A; có F–A chung với IV",
              "Mềm hơn; dẫn tự nhiên đến V"
            ]
          ]
        },
        {
          "b": "h",
          "text": "1. Chơi ba mẫu ngắn"
        },
        {
          "b": "ul",
          "items": [
            "C – F – C: nghe động tác rời rồi quay lại.",
            "C – Dm – G – C: nghe Dm chuẩn bị cho G.",
            "C – F – G – C: so màu F với Dm, không vội phán hợp âm nào “đúng hơn”."
          ]
        },
        {
          "b": "h",
          "text": "2. Phiếu quan sát"
        },
        {
          "b": "table",
          "rows": [
            [
              "Mẫu",
              "Hợp âm mở đường",
              "Mức muốn đi tiếp (1–5)",
              "Từ mô tả"
            ],
            [
              "C – F – C",
              "F",
              "___",
              "____________"
            ],
            [
              "C – Dm – G – C",
              "Dm",
              "___",
              "____________"
            ],
            [
              "C – F – G – C",
              "F",
              "___",
              "____________"
            ]
          ]
        },
        {
          "b": "h",
          "text": "3. Tự giải thích"
        },
        {
          "b": "write",
          "label": "Theo em, IV và ii giống nhau ở điểm nào nhưng khác màu ra sao?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "ĐĂNG BẢN THU NGẮN",
          "text": "Thu hai mẫu C–Dm–G–C và C–F–G–C. Hỏi nhóm: “Mẫu nào làm mọi người cảm thấy bước vào G tự nhiên hơn? Vì sao?”"
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 4",
      "title": "Nhóm Át: lực căng muốn trở về",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Nghe V, V7 và vii° hướng về I; nhận ra nốt dẫn và lực giải quyết trong G7 → C."
        },
        {
          "b": "h",
          "text": "1. Vì sao G7 muốn về C?"
        },
        {
          "b": "table",
          "rows": [
            [
              "Trong G7",
              "Xu hướng khi về C",
              "Điều tai thường cảm nhận"
            ],
            [
              "B",
              "Đi lên C",
              "Nốt dẫn kéo về chủ âm"
            ],
            [
              "F",
              "Đi xuống E",
              "Một nửa của quãng nghịch F–B được giải quyết"
            ],
            [
              "G",
              "Có thể ở lại G",
              "Nốt chung giữ sự liền mạch"
            ]
          ]
        },
        {
          "b": "h",
          "text": "2. Nghe từ ít căng đến nhiều căng"
        },
        {
          "b": "ul",
          "items": [
            "Chơi G rồi C; sau đó G7 rồi C. Mỗi hợp âm giữ 2 ô nhịp.",
            "Chơi Bdim rồi C thật chậm. Nếu thế bấm khó, chơi ba nốt B–D–F riêng lẻ rồi về C–E–G.",
            "Chơi C – F – G7 và dừng 4 phách, rồi mới về C. Quan sát sự chờ đợi."
          ]
        },
        {
          "b": "write",
          "label": "G khác G7 ở cảm giác:",
          "lines": 2
        },
        {
          "b": "h",
          "text": "3. Nói bằng lời của mình"
        },
        {
          "b": "p",
          "text": "“Hợp âm Át có chức năng…”"
        },
        {
          "b": "write",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "LƯU Ý",
          "text": "Không phải cứ thấy hợp âm trưởng là Át. G chỉ là V trong giọng C; trong giọng G, chính G lại là I."
        },
        {
          "b": "callout",
          "label": "CÂU HỎI LÊN NHÓM",
          "text": "Vì sao có người thích giữ G7 lâu để tăng căng, còn người khác lại thấy khó chịu? Hãy đăng hai bản thu nhanh và mời mọi người chọn."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 5",
      "title": "Hướng đi T → PD → D → T",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Cảm nhận một hành trình chức năng hoàn chỉnh mà chưa cần phân tích cả bài hát: đứng – đi – căng – về."
        },
        {
          "b": "table",
          "rows": [
            [
              "Chức năng",
              "Bậc mẫu",
              "Trong C",
              "Động tác nghe"
            ],
            [
              "T",
              "I",
              "C",
              "Đứng / bắt đầu"
            ],
            [
              "PD",
              "IV hoặc ii",
              "F hoặc Dm",
              "Mở / chuẩn bị"
            ],
            [
              "D",
              "V hoặc V7",
              "G hoặc G7",
              "Căng / đòi tiếp"
            ],
            [
              "T",
              "I",
              "C",
              "Giải quyết / trở về"
            ]
          ]
        },
        {
          "b": "h",
          "text": "1. Hai con đường cùng đích"
        },
        {
          "b": "ul",
          "items": [
            "Mẫu A: C – F – G7 – C.",
            "Mẫu B: C – Dm – G7 – C.",
            "Chơi mỗi mẫu 3 lần, tốc độ 60–70 bpm, mỗi hợp âm 4 phách."
          ]
        },
        {
          "b": "h",
          "text": "2. Ba kiểu kết để so sánh"
        },
        {
          "b": "table",
          "rows": [
            [
              "Cách đi",
              "Tên thường dùng",
              "Cảm giác"
            ],
            [
              "G hoặc G7 → C",
              "Kết Át – Chủ",
              "Mạnh, rõ, khép lại"
            ],
            [
              "F → C",
              "Kết Hạ át – Chủ",
              "Mềm, ấm, “amen”"
            ],
            [
              "G hoặc G7 → Am",
              "Kết tránh",
              "Kỳ vọng bị chuyển hướng; chưa nghỉ trọn"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Kiểu kết em nghe rõ nhất là… vì…"
        },
        {
          "b": "write",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "THẢO LUẬN KHÔNG CẦN ĐỒNG THUẬN",
          "text": "Mỗi người có thể dùng từ khác nhau. Hãy hỏi tiếp: “Bạn nghe chi tiết nào khiến bạn chọn từ đó?” Càng tranh luận dựa trên tiếng đàn càng tốt."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 6",
      "title": "Thay thế hợp âm cùng chức năng",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Thử thay một hợp âm bằng hợp âm gần chức năng, đồng thời nghe xem màu sắc và mức ổn định đã thay đổi thế nào."
        },
        {
          "b": "table",
          "rows": [
            [
              "Nhóm",
              "Lựa chọn chính",
              "Lựa chọn gần chức năng",
              "Cảnh báo"
            ],
            [
              "Chủ",
              "I",
              "vi; đôi khi iii",
              "Không thay được trong mọi giai điệu hoặc điểm kết"
            ],
            [
              "Hạ át",
              "IV",
              "ii",
              "ii thường đẩy đến V mượt hơn"
            ],
            [
              "Át",
              "V / V7",
              "vii°",
              "Thế bấm và bè giai điệu có thể làm kết quả khác"
            ]
          ]
        },
        {
          "b": "h",
          "text": "1. Thí nghiệm thay một mắt xích"
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
              "C – F – G – C",
              "C – Dm – G – C",
              "Màu của vùng chuẩn bị"
            ],
            [
              "C – F – G – C",
              "Am – F – G – C",
              "Điểm xuất phát có còn chắc?"
            ],
            [
              "C – F – G – C",
              "C – F – Bdim – C",
              "Lực căng trước khi về"
            ]
          ]
        },
        {
          "b": "h",
          "text": "2. Luật thử nghiệm"
        },
        {
          "b": "ul",
          "items": [
            "Giữ cùng tiết tấu, tốc độ và thế bấm gần nhất có thể.",
            "Mỗi lần chỉ thay một hợp âm để biết điều gì tạo ra khác biệt.",
            "Kiểm tra nốt giai điệu: nếu xung đột khó chịu, không ép thay chỉ vì “cùng nhóm”."
          ]
        },
        {
          "b": "write",
          "label": "Phiên bản em thích nhất và lý do:",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "BÀI ĐĂNG NHÓM",
          "text": "Đăng hai phiên bản không ghi tên. Mời mọi người đoán bản nào dùng IV, bản nào dùng ii; sau đó cùng giải thích bằng tai, không chỉ bằng công thức."
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
          "text": "Chơi, nghe, nói và đặt câu hỏi. Chưa hiểu hết vẫn hoàn toàn bình thường; điều quan trọng là em mang tới lớp một vấn đề thật đã được thử trên đàn."
        },
        {
          "b": "h",
          "text": "1. Bài thực hành 60–90 giây"
        },
        {
          "b": "ul",
          "items": [
            "Chọn giọng C hoặc G trưởng. Giới thiệu ngắn: “Em đang ở giọng…”",
            "Chơi một vòng theo hướng T → PD → D → T ít nhất hai lần.",
            "Thay một hợp âm bằng hợp âm gần chức năng và chơi lại.",
            "Nói điều em nghe thấy khác nhau; nêu một chỗ còn chưa chắc."
          ]
        },
        {
          "b": "h",
          "text": "2. Phiếu chuẩn bị"
        },
        {
          "b": "table",
          "rows": [
            [
              "Mục",
              "Em chọn / em viết"
            ],
            [
              "Giọng",
              "____________________________"
            ],
            [
              "Vòng gốc",
              "____________________________"
            ],
            [
              "Chức năng",
              "T → ____ → ____ → T"
            ],
            [
              "Vòng thay",
              "____________________________"
            ],
            [
              "Khác biệt em nghe",
              "____________________________________________"
            ],
            [
              "Câu hỏi cho nhóm / thầy",
              "____________________________________________"
            ]
          ]
        },
        {
          "b": "h",
          "text": "3. Trước khi đến buổi thực hành"
        },
        {
          "b": "ul",
          "items": [
            "Đăng video hoặc audio lên nhóm trước buổi học.",
            "Bình luận có nội dung cho ít nhất hai bài của bạn: điều em nghe + một câu hỏi.",
            "Đọc các tranh luận; thử lại trên đàn trước khi đồng ý hoặc phản biện.",
            "Ghi lại câu hỏi chưa được giải quyết để thầy làm rõ trong buổi thực hành."
          ]
        },
        {
          "b": "callout",
          "label": "TINH THẦN CỦA NHÓM",
          "text": "Không hiểu cũng không sao. Đừng im lặng vì sợ sai: câu hỏi thật và tranh luận có tiếng đàn minh họa sẽ giúp cả nhóm học nhanh hơn."
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
          "text": "A. Nhận biết"
        },
        {
          "b": "write",
          "label": "1. Trong giọng C trưởng, xếp C, Dm, Em, F, G/G7, Am, Bdim vào T – PD – D:",
          "lines": 3
        },
        {
          "b": "write",
          "label": "2. Vì sao cùng hợp âm C nhưng có thể là I, IV hoặc V?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "3. Hai nốt nào trong G7 tạo lực giải quyết rõ về C? Chúng đi về đâu?",
          "lines": 2
        },
        {
          "b": "h",
          "text": "B. Ứng dụng"
        },
        {
          "b": "write",
          "label": "4. Viết một mẫu T → PD → D → T trong giọng G trưởng:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "5. Đổi hợp âm PD trong mẫu trên nhưng giữ chức năng:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "6. So sánh G7 → C với G7 → Am bằng hai câu ngắn:",
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
              "Gọi đúng ba nhóm chức năng",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Nghe được V/V7 muốn về I",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Chơi được T–PD–D–T",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Thử thay hợp âm và mô tả khác biệt",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Đặt được câu hỏi cụ thể cho nhóm",
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
      "title": "Đáp án gợi ý và bảng tra nhanh",
      "blocks": [
        {
          "b": "h",
          "text": "Đáp án bài tự kiểm tra"
        },
        {
          "b": "ul",
          "items": [
            "Câu 1: T: C; gần nhóm có Am và Em (iii phụ thuộc ngữ cảnh). PD: F, Dm. D: G/G7, Bdim.",
            "Câu 2: Vì chức năng phụ thuộc giọng và ngữ cảnh: C là I trong C trưởng, IV trong G trưởng, V trong F trưởng.",
            "Câu 3: B thường đi lên C; F thường đi xuống E.",
            "Câu 4: Ví dụ G – C – D7 – G, tương ứng T – PD – D – T.",
            "Câu 5: Có thể đổi C thành Am: G – Am – D7 – G; hãy nghe màu và kiểm tra giai điệu.",
            "Câu 6: G7 → C giải quyết mạnh về I; G7 → Am chuyển hướng sang vi, tạo kết tránh và chưa nghỉ trọn."
          ]
        },
        {
          "b": "h",
          "text": "Bảng chức năng trong ba giọng trưởng"
        },
        {
          "b": "table",
          "rows": [
            [
              "Giọng",
              "T — Chủ",
              "PD — Hạ át",
              "D — Át"
            ],
            [
              "C trưởng",
              "C; gần: Am, Em",
              "F, Dm",
              "G/G7, Bdim"
            ],
            [
              "G trưởng",
              "G; gần: Em, Bm",
              "C, Am",
              "D/D7, F♯dim"
            ],
            [
              "D trưởng",
              "D; gần: Bm, F♯m",
              "G, Em",
              "A/A7, C♯dim"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Ghi chú về giọng thứ"
        },
        {
          "b": "p",
          "text": "Trong A thứ: Am là i (Chủ), Dm hoặc Bdim có thể làm vùng chuẩn bị, E/E7 là Át mạnh và thường trở về Am. Hãy xem đây là phần mở rộng; tuần này ưu tiên nghe thật rõ chức năng trong giọng trưởng."
        },
        {
          "b": "callout",
          "label": "BA CÂU MANG ĐẾN LỚP",
          "text": "1) Em nghe chỗ nào chưa rõ chức năng?  2) Phép thay nào khiến giai điệu bị vướng?  3) Em và bạn trong nhóm đang bất đồng ở ví dụ nào? Thầy sẽ dùng chính các câu hỏi này để giải đáp và thực hành thêm."
        }
      ]
    }
  ]
}
