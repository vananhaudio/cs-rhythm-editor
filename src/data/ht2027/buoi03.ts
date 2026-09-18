// ── HÀNH TRÌNH 2027 · BUỔI 03 — Tài liệu ôn tập 7 ngày ──
// Sinh từ file Word của Thầy (On-tap-7-ngay-Buoi-3-Phan-tich-vong-hoa-am.docx); nguồn gốc là file Word,
// sửa nội dung thì sửa Word rồi chạy lại scripts/ht2027-docx-to-lesson.py.
import type { LessonDoc } from '../../lesson/lessonTypes'

export const HT2027_BUOI03: LessonDoc = {
  "meta": {
    "programCode": "HT2027",
    "programName": "HÀNH TRÌNH 2027",
    "sessionNo": 3,
    "title": "Phân tích vòng hòa âm",
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
          "text": "Lộ trình 7 ngày: gọi tên – đọc hướng – chia câu – nghe điểm kết"
        },
        {
          "b": "callout",
          "label": "KẾT QUẢ CUỐI TUẦN",
          "text": "Em phân tích được một vòng hòa âm theo 4 lớp: giọng, số bậc, chức năng và hướng chuyển động; nhận ra điểm căng, điểm nghỉ, kiểu kết và chỗ cần đặt câu hỏi."
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
              "Quy trình 4 bước + đổi hợp âm thành số bậc"
            ],
            [
              "Ngày 3–4",
              "25–30 phút",
              "Chia câu chức năng + nhận diện kiểu kết"
            ],
            [
              "Ngày 5–6",
              "25–35 phút",
              "Đọc hợp âm ngoài giọng + phân tích đoạn 8 ô nhịp"
            ],
            [
              "Ngày 7",
              "30–40 phút",
              "Bản phân tích một bài + video 60–90 giây"
            ]
          ]
        },
        {
          "b": "callout",
          "label": "QUY ƯỚC HỌC NHÓM",
          "text": "Chưa phân tích được cũng không sao. Hãy khoanh đúng chỗ mình vướng, đăng vòng hợp âm và cách nghĩ lên nhóm để mọi người hỏi – phản biện – thử lại trên đàn. Đến buổi thực hành, thầy sẽ giải đáp thêm."
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
              "Bốn lớp phân tích",
              "Giọng → bậc → chức năng → hướng đi"
            ],
            [
              "2",
              "Từ tên hợp âm đến số bậc",
              "Ghi đúng Roman numeral cho vòng trong C/G"
            ],
            [
              "3",
              "Đọc câu chuyện chức năng",
              "Tìm điểm đứng, mở, căng và trở về"
            ],
            [
              "4",
              "Điểm kết như dấu câu",
              "Phân biệt kết trọn, nửa, mềm và tránh"
            ],
            [
              "5",
              "Hợp âm ngoài giọng",
              "Khoanh – nghe – tìm đích, chưa vội gắn nhãn"
            ],
            [
              "6",
              "Đoạn 8 ô nhịp",
              "Phân tích cấu trúc và nhịp hòa âm"
            ],
            [
              "7",
              "Một bài thật",
              "Nộp bản phân tích + câu hỏi mang đến lớp"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Kiểm tra đầu tuần — không tra tài liệu"
        },
        {
          "b": "write",
          "label": "1. Đổi C – Am – F – G thành số bậc trong giọng C trưởng:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "2. Trong vòng C – Dm – G7 – C, hợp âm nào là PD và hợp âm nào là D?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "3. Nếu một câu dừng ở G7 trong giọng C, em cảm thấy câu đã hết chưa? Vì sao?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "MỤC TIÊU PHÂN TÍCH",
          "text": "Không phải dán thật nhiều nhãn. Phân tích tốt phải giúp em nghe rõ hơn, nhớ vòng nhanh hơn và biết vì sao câu nhạc muốn đi tiếp hoặc dừng lại."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 1",
      "title": "Quy trình phân tích 4 lớp",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Không nhìn vòng hợp âm như một chuỗi tên rời rạc; luôn đọc từ bối cảnh lớn đến chuyển động nhỏ."
        },
        {
          "b": "table",
          "rows": [
            [
              "Lớp",
              "Câu hỏi",
              "Sản phẩm"
            ],
            [
              "1. Giọng",
              "“Nhà” của đoạn nhạc là hợp âm nào?",
              "Tên giọng và dấu hóa"
            ],
            [
              "2. Số bậc",
              "Mỗi hợp âm đứng ở bậc nào?",
              "I, ii, iii, IV, V, vi, vii°"
            ],
            [
              "3. Chức năng",
              "Đang ở vùng T, S/PD hay D?",
              "Điểm nghỉ – mở – căng"
            ],
            [
              "4. Hướng đi",
              "Câu đang đi, quay về hay đánh lạc hướng?",
              "Mũi tên + lời mô tả"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Làm mẫu: C – Am – Dm – G7 – C"
        },
        {
          "b": "table",
          "rows": [
            [
              "Hợp âm",
              "C",
              "Am",
              "Dm",
              "G7",
              "C"
            ],
            [
              "Bậc",
              "I",
              "vi",
              "ii",
              "V7",
              "I"
            ],
            [
              "Chức năng",
              "T",
              "T gần",
              "PD",
              "D",
              "T"
            ],
            [
              "Cảm giác",
              "Đứng",
              "Nới vùng Chủ",
              "Mở đường",
              "Căng",
              "Về"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Cách đọc thành lời: “Câu bắt đầu ở Chủ, nới sang vi, rời vùng Chủ bằng ii, tạo căng ở V7 rồi trở về I.”"
        },
        {
          "b": "h",
          "text": "Bài làm"
        },
        {
          "b": "write",
          "label": "Phân tích F – G – Em – Am trong giọng C theo bốn lớp:",
          "lines": 3
        },
        {
          "b": "callout",
          "label": "NHỚ TỪ BUỔI 2",
          "text": "S là tên vùng/màu Hạ át; PD là nhiệm vụ chuẩn bị cho D. Khi IV hoặc ii đứng trước V, chúng vừa mang màu S vừa đang làm PD."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 2",
      "title": "Đổi tên hợp âm thành số bậc",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Dùng số bậc để nhìn ra cấu trúc, thay vì bị mắc kẹt trong tên hợp âm cụ thể."
        },
        {
          "b": "h",
          "text": "1. Ba bước không được đảo"
        },
        {
          "b": "ol",
          "items": [
            "Xác định giọng trước.",
            "Viết bộ hợp âm của giọng.",
            "Đối chiếu từng hợp âm và ghi số bậc đúng tính chất."
          ]
        },
        {
          "b": "table",
          "rows": [
            [
              "Vòng hợp âm",
              "Giọng",
              "Phân tích số bậc"
            ],
            [
              "C – G – Am – F",
              "C trưởng",
              "I – V – vi – IV"
            ],
            [
              "G – D – Em – C",
              "G trưởng",
              "I – V – vi – IV"
            ],
            [
              "Dm – G – C – Am",
              "C trưởng",
              "ii – V – I – vi"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Hai vòng đầu có tên hợp âm khác nhau nhưng chung một cấu trúc I–V–vi–IV. Buổi này chỉ nhận ra cấu trúc; Buổi 4 mới dùng nó để dịch chuyển vòng sang giọng khác."
        },
        {
          "b": "h",
          "text": "2. Phiếu thực hành"
        },
        {
          "b": "table",
          "rows": [
            [
              "Vòng",
              "Giọng",
              "Số bậc của em"
            ],
            [
              "Am – F – C – G",
              "C trưởng",
              "________________________"
            ],
            [
              "G – Am – D – G",
              "G trưởng",
              "________________________"
            ],
            [
              "Em – C – D – G",
              "G trưởng",
              "________________________"
            ],
            [
              "F – G – C – C",
              "C trưởng",
              "________________________"
            ]
          ]
        },
        {
          "b": "h",
          "text": "3. Kiểm tra bằng tai"
        },
        {
          "b": "ul",
          "items": [
            "Chơi vòng, dừng ở hợp âm em cho là I. Nếu cảm giác chưa về, kiểm tra lại giả định về giọng.",
            "Không quyết định giọng chỉ vì hợp âm đầu tiên; hãy nghe điểm nghỉ và quan sát toàn đoạn."
          ]
        },
        {
          "b": "callout",
          "label": "ĐĂNG LÊN NHÓM",
          "text": "Đưa một vòng có thể khiến mọi người nhầm giọng. Mỗi người nêu bằng chứng: điểm kết, hợp âm xuất hiện nhiều, nốt giai điệu hoặc lực V→I."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 3",
      "title": "Đọc câu chuyện chức năng",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Gom nhiều hợp âm thành các vùng chức năng và đọc được hướng chuyển động của câu."
        },
        {
          "b": "table",
          "rows": [
            [
              "Dấu hiệu",
              "Cách hiểu",
              "Ví dụ trong C"
            ],
            [
              "T kéo dài",
              "Nhiều hợp âm nhưng cảm giác vẫn quanh điểm tựa",
              "C – Em – Am"
            ],
            [
              "PD mở đường",
              "Rời vùng Chủ và chuẩn bị lực căng",
              "F hoặc Dm trước G/G7"
            ],
            [
              "D kéo dài",
              "Giữ hoặc tăng kỳ vọng trước khi về",
              "G – G7"
            ],
            [
              "T trở lại",
              "Lực căng được giải quyết",
              "G7 – C"
            ]
          ]
        },
        {
          "b": "h",
          "text": "1. Gạch ngoặc theo vùng"
        },
        {
          "b": "p",
          "text": "Vòng: C – Em – Am | Dm – F | G – G7 | C"
        },
        {
          "b": "p",
          "text": "Cách gom: [T kéo dài] | [PD] | [D kéo dài] | [T]. Đây là “bản đồ lớn”; số bậc cho biết chi tiết bên trong."
        },
        {
          "b": "h",
          "text": "2. Ba vòng để đọc thành lời"
        },
        {
          "b": "write",
          "label": "A. C – Am – F – G – C:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "B. C – Em – Dm – G7 – C:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "C. C – F – C – G7 – C:",
          "lines": 1
        },
        {
          "b": "callout",
          "label": "ĐỪNG ÉP MỌI HỢP ÂM PHẢI TIẾN",
          "text": "Một hợp âm có thể kéo dài vùng hiện tại, quay lại vùng cũ hoặc chỉ tạo màu. Phân tích là theo dõi chuyển động thật, không phải ép mọi vòng thành một công thức."
        },
        {
          "b": "callout",
          "label": "THẢO LUẬN",
          "text": "Chọn vòng C. Hỏi nhóm: F đầu tiên là PD hay chỉ là S đi thẳng về T? Hãy dùng hợp âm phía sau để bảo vệ cách phân tích."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 4",
      "title": "Điểm kết là dấu câu",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Nhận ra nơi câu nhạc đóng, tạm nghỉ, mở tiếp hoặc chuyển hướng."
        },
        {
          "b": "table",
          "rows": [
            [
              "Chuyển động",
              "Tên gọi",
              "Giống dấu câu",
              "Cảm giác"
            ],
            [
              "V/V7 → I",
              "Kết Át – Chủ",
              "Dấu chấm",
              "Khép mạnh, rõ giọng"
            ],
            [
              "IV → I",
              "Kết Hạ át – Chủ",
              "Dấu chấm mềm",
              "Ấm, dịu, khép nhẹ"
            ],
            [
              "… → V",
              "Nửa kết",
              "Dấu phẩy / hỏi",
              "Dừng nhưng còn chờ tiếp"
            ],
            [
              "V/V7 → vi",
              "Kết tránh",
              "Dấu ba chấm",
              "Đích bị chuyển hướng"
            ]
          ]
        },
        {
          "b": "h",
          "text": "1. Nghe cùng một phần đầu"
        },
        {
          "b": "ul",
          "items": [
            "C – F – G7 – C: kết trọn.",
            "C – F – G7: nửa kết nếu câu dừng ở G7.",
            "C – F – G7 – Am: kết tránh.",
            "C – F – C: kết mềm kiểu Hạ át – Chủ."
          ]
        },
        {
          "b": "h",
          "text": "2. Đánh dấu trên vòng"
        },
        {
          "b": "write",
          "label": "Mẫu nào giống dấu chấm nhất? Vì sao?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "Mẫu nào khiến em muốn nghe thêm ngay lập tức?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "NGUYÊN TẮC",
          "text": "Kiểu kết không chỉ do hai tên hợp âm. Vị trí trong câu, phách mạnh, độ dài, giai điệu và cách diễn tấu đều ảnh hưởng cảm giác kết."
        },
        {
          "b": "callout",
          "label": "BÀI ĐĂNG NHÓM",
          "text": "Thu bốn kiểu kết, đảo thứ tự và không ghi tên. Mời mọi người nhận diện bằng tai rồi mới mở đáp án."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 5",
      "title": "Gặp hợp âm ngoài giọng",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Không hoảng khi một hợp âm không nằm trong bộ hợp âm: khoanh lại, nghe hướng đi và tìm bằng chứng."
        },
        {
          "b": "h",
          "text": "Quy trình xử lý"
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
              "Khoanh hợp âm lạ",
              "Nó khác bộ hợp âm ở nốt nào?"
            ],
            [
              "2",
              "Nhìn hợp âm kế tiếp",
              "Nó đang đẩy mạnh đến đích nào?"
            ],
            [
              "3",
              "Nghe A/B",
              "Bỏ hoặc thay hợp âm lạ thì lực đi thay đổi ra sao?"
            ],
            [
              "4",
              "Đặt nhãn tạm",
              "Át phụ, vay mượn hay chỉ là màu? Chưa chắc thì để dấu hỏi"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Ví dụ: C – A7 – Dm – G7 – C"
        },
        {
          "b": "table",
          "rows": [
            [
              "Hợp âm",
              "C",
              "A7",
              "Dm",
              "G7",
              "C"
            ],
            [
              "Quan sát",
              "I",
              "Ngoài giọng",
              "ii",
              "V7",
              "I"
            ],
            [
              "Vai trò",
              "T",
              "Đẩy đến Dm",
              "PD",
              "D",
              "T"
            ]
          ]
        },
        {
          "b": "p",
          "text": "A7 chứa C♯, không thuộc C trưởng. Vì A7 đi mạnh đến Dm, ta có thể gọi nó là V7/ii — Át phụ của ii. Điều quan trọng trước tiên là nghe được “A7 đang đẩy đến Dm”."
        },
        {
          "b": "h",
          "text": "Thử thêm"
        },
        {
          "b": "write",
          "label": "Trong C – D7 – G7 – C, D7 đang đẩy đến đâu? Nhãn tạm của em:",
          "lines": 2
        },
        {
          "b": "write",
          "label": "Trong C – Fm – C, Fm làm thay đổi màu gì? Nếu chưa biết tên, hãy mô tả bằng tai:",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "CHƯA HIỂU KHÔNG SAO",
          "text": "Đây là vùng mở rộng. Em không cần gọi đúng mọi tên chuyên môn trước buổi học; chỉ cần khoanh đúng chỗ lạ và nêu được điều mình nghe."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 6",
      "title": "Phân tích một đoạn 8 ô nhịp",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Kết hợp số bậc, chức năng, nhịp hòa âm và kiểu kết trong một đoạn hoàn chỉnh."
        },
        {
          "b": "p",
          "text": "Đoạn mẫu trong C trưởng — mỗi ô một hợp âm:"
        },
        {
          "b": "table",
          "rows": [
            [
              "Ô nhịp",
              "1",
              "2",
              "3",
              "4"
            ],
            [
              "Hợp âm",
              "C",
              "Am",
              "Dm",
              "G7"
            ],
            [
              "Bậc / chức năng",
              "___ / ___",
              "___ / ___",
              "___ / ___",
              "___ / ___"
            ]
          ]
        },
        {
          "b": "table",
          "rows": [
            [
              "Ô nhịp",
              "5",
              "6",
              "7",
              "8"
            ],
            [
              "Hợp âm",
              "C",
              "F",
              "G7",
              "C"
            ],
            [
              "Bậc / chức năng",
              "___ / ___",
              "___ / ___",
              "___ / ___",
              "___ / ___"
            ]
          ]
        },
        {
          "b": "h",
          "text": "1. Nhịp hòa âm"
        },
        {
          "b": "p",
          "text": "Nhịp hòa âm là tốc độ thay đổi hợp âm. Ở mẫu trên: một hợp âm mỗi ô nhịp. Nếu hai hợp âm cùng nằm trong một ô, nhịp hòa âm đã nhanh hơn dù tempo không đổi."
        },
        {
          "b": "write",
          "label": "Điểm nhịp hòa âm tăng tốc có thể tạo cảm giác gì?",
          "lines": 2
        },
        {
          "b": "h",
          "text": "2. Chia câu"
        },
        {
          "b": "ul",
          "items": [
            "Khoanh ô 1–4 thành câu A; ô 5–8 thành câu B.",
            "Đánh dấu nơi có D→T và ghi kiểu kết.",
            "Đọc thành lời toàn đoạn, tối đa ba câu ngắn."
          ]
        },
        {
          "b": "write",
          "label": "Câu chuyện hòa âm của đoạn:",
          "lines": 3
        },
        {
          "b": "callout",
          "label": "PHÂN TÍCH PHẢI QUAY LẠI TIẾNG ĐÀN",
          "text": "Chơi lại sau khi ghi. Nếu chưa nghe thấy điều mình viết, hãy sửa phân tích hoặc đánh dấu để hỏi nhóm."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 7",
      "title": "Phân tích một bài thật",
      "blocks": [
        {
          "b": "callout",
          "label": "NHIỆM VỤ CUỐI TUẦN",
          "text": "Chọn 8–16 ô nhịp của một bài quen. Tạo một bản phân tích đủ rõ để người khác có thể đọc, chơi lại và phản biện."
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
              "Em điền"
            ],
            [
              "Tên bài / đoạn",
              "____________________________________________"
            ],
            [
              "Giọng dự đoán",
              "____________________________________________"
            ],
            [
              "Vòng hợp âm",
              "____________________________________________"
            ],
            [
              "Số bậc",
              "____________________________________________"
            ],
            [
              "Các vùng chức năng",
              "____________________________________________"
            ],
            [
              "Điểm kết",
              "____________________________________________"
            ],
            [
              "Hợp âm ngoài giọng / dấu hỏi",
              "____________________________________________"
            ],
            [
              "Điều em nghe",
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
            "Nói tên giọng và bằng chứng khiến em chọn giọng đó.",
            "Chơi đoạn nhạc một lần, đúng nhịp và giữ rõ điểm đổi hợp âm.",
            "Đọc số bậc và chức năng của một câu quan trọng.",
            "Chỉ ra điểm kết hoặc hợp âm làm em chưa chắc."
          ]
        },
        {
          "b": "h",
          "text": "3. Trước khi đến buổi thực hành"
        },
        {
          "b": "ul",
          "items": [
            "Đăng bản phân tích và video/audio lên nhóm.",
            "Phản hồi ít nhất hai bài: một điều hợp lý + một câu hỏi cần bằng chứng.",
            "Nếu bất đồng về giọng hoặc chức năng, cả hai bên chơi thử và ghi lại điều nghe được."
          ]
        },
        {
          "b": "callout",
          "label": "MANG BẤT ĐỒNG ĐẾN LỚP",
          "text": "Không cần nhóm phải thống nhất hết. Những trường hợp còn tranh luận chính là ví dụ tốt nhất để thầy giải đáp và thực hành trong buổi Zoom."
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
          "text": "A. Phân tích nền tảng"
        },
        {
          "b": "write",
          "label": "1. Phân tích C – Em – F – G7 – C theo số bậc:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "2. Gom vòng trên thành các vùng T – PD – D – T:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "3. Vì sao không nên xác định giọng chỉ từ hợp âm đầu tiên?",
          "lines": 2
        },
        {
          "b": "h",
          "text": "B. Đọc chuyển động"
        },
        {
          "b": "write",
          "label": "4. C – F – G7 dừng ở G7 thuộc kiểu kết nào? Cảm giác ra sao?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "5. C – F – G7 – Am khác C – F – G7 – C ở điểm nào?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "6. Trong C – D7 – G7 – C, hợp âm ngoài giọng là gì và nó hướng đến đâu?",
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
              "Xác định giọng bằng nhiều bằng chứng",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Đổi tên hợp âm thành số bậc",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Gom được các vùng chức năng",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Nhận ra điểm kết và hướng đi",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Khoanh được chỗ lạ để đặt câu hỏi",
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
      "title": "Đáp án gợi ý và mẫu phân tích",
      "blocks": [
        {
          "b": "h",
          "text": "Đáp án bài tự kiểm tra"
        },
        {
          "b": "ul",
          "items": [
            "Câu 1: I – iii – IV – V7 – I.",
            "Câu 2: C–Em thuộc vùng T kéo dài; F là PD trong hướng đi đến G7; G7 là D; C cuối là T.",
            "Câu 3: Hợp âm đầu có thể không phải I. Cần nghe điểm nghỉ, xem điểm kết, toàn bộ tập hợp hợp âm, giai điệu và lực V→I.",
            "Câu 4: Nửa kết; câu tạm dừng ở D và vẫn chờ được tiếp tục.",
            "Câu 5: G7→C giải quyết về I; G7→Am chuyển sang vi, tạo kết tránh và chưa khép trọn.",
            "Câu 6: D7 là hợp âm ngoài giọng C; nó hướng mạnh đến G7, có thể gọi là V7/V."
          ]
        },
        {
          "b": "h",
          "text": "Mẫu trình bày một vòng"
        },
        {
          "b": "table",
          "rows": [
            [
              "Lớp",
              "Mẫu: C – Am – Dm – G7 – C"
            ],
            [
              "Giọng",
              "C trưởng: có kết G7→C và C là điểm nghỉ"
            ],
            [
              "Số bậc",
              "I – vi – ii – V7 – I"
            ],
            [
              "Chức năng",
              "T kéo dài → PD → D → T"
            ],
            [
              "Điểm kết",
              "V7→I: kết Át – Chủ"
            ],
            [
              "Lời kể",
              "Từ vùng Chủ, câu mở đường, tăng căng rồi trở về"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Năm câu hỏi phân tích chuẩn"
        },
        {
          "b": "ul",
          "items": [
            "Đoạn này đang ở giọng nào, và bằng chứng là gì?",
            "Các hợp âm tương ứng bậc nào?",
            "Đâu là vùng Chủ, vùng mở đường và vùng Át?",
            "Câu hòa âm kết ở đâu và kết theo cách nào?",
            "Có hợp âm nào ngoài giọng hoặc cách giải thích nào còn tranh luận?"
          ]
        },
        {
          "b": "callout",
          "label": "CHUẨN BỊ CHO BUỔI 4",
          "text": "Khi đã nhìn vòng bằng số bậc, em không còn bị phụ thuộc vào tên hợp âm. Buổi 4 sẽ dùng chính cấu trúc số bậc này để dịch chuyển vòng hòa âm sang giọng khác."
        }
      ]
    }
  ]
}
