// ── HÀNH TRÌNH 2027 · BUỔI 06 — Tài liệu ôn tập 7 ngày ──
// Soạn trực tiếp (chưa có file Word), cùng khuôn Buổi 05: 7 ngày + tự kiểm tra + đáp án.
// Có file Word thì chạy lại scripts/ht2027-docx-to-lesson.py để thay file này.
import type { LessonDoc } from '../../lesson/lessonTypes'

export const HT2027_BUOI06: LessonDoc = {
  "meta": {
    "programCode": "HT2027",
    "programName": "HÀNH TRÌNH 2027",
    "sessionNo": 6,
    "title": "Hợp âm đảo và đường bass",
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
          "text": "Lộ trình 7 ngày: nốt bass – ba cách đứng – đường bass – nối mượt – bass đứng yên – giọng thứ – một bài thật"
        },
        {
          "b": "callout",
          "label": "KẾT QUẢ CUỐI TUẦN",
          "text": "Bạn đọc và chơi được hợp âm đảo (C/E, G/B…), biết đặt một đường bass đi mượt dưới vòng hòa âm quen thuộc và giải thích được vì sao đổi nốt bass lại đổi cả cảm giác của câu."
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
              "Hiểu nốt bass + ba cách đứng của một hợp âm"
            ],
            [
              "Ngày 3–4",
              "25–30 phút",
              "Đường bass đi theo bậc + đảo để nối mượt"
            ],
            [
              "Ngày 5–6",
              "25–35 phút",
              "Bass đứng yên + đường bass trong giọng thứ"
            ],
            [
              "Ngày 7",
              "30–40 phút",
              "Một bài thật có đường bass + video 60–90 giây"
            ]
          ]
        },
        {
          "b": "callout",
          "label": "QUY ƯỚC HỌC NHÓM",
          "text": "Bass là thứ tai thường nghe sau cùng nhưng cảm nhận trước tiên. Hãy đăng bản thu có bass và bản không có, để mọi người cùng nghe sự khác biệt. Đến buổi thực hành, thầy sẽ giải đáp thêm."
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
              "Nốt thấp nhất quyết định",
              "Đọc ký hiệu X/Y và chỉ ra nốt bass"
            ],
            [
              "2",
              "Ba cách đứng",
              "Chơi C, C/E, C/G và nghe khác nhau thế nào"
            ],
            [
              "3",
              "Đường bass đi theo bậc",
              "Chơi vòng với bass đi xuống và đi lên"
            ],
            [
              "4",
              "Đảo để nối mượt",
              "Tìm hợp âm đảo nối giữa hai hợp âm cách xa"
            ],
            [
              "5",
              "Bass đứng yên",
              "Nghe một nốt bass giữ qua nhiều hợp âm"
            ],
            [
              "6",
              "Giọng thứ",
              "Đường bass A–G–F–E dưới giọng Am"
            ],
            [
              "7",
              "Một bài thật",
              "Nộp vòng gốc + đường bass + lý do chọn"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Kiểm tra đầu tuần — không tra tài liệu"
        },
        {
          "b": "write",
          "label": "1. C – Am7 và C6 gồm những nốt nào? Khác nhau ở đâu khi chơi?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "2. Hợp âm C gồm những nốt nào? Nốt nào đang ở thấp nhất khi bạn bấm C quen thuộc?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "3. Khi nghe một bài hát, tai bạn thường bắt giai điệu hay bass trước? Vì sao?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "MỤC TIÊU CỦA TUẦN",
          "text": "Không phải thuộc thêm hàng chục thế bấm. Chỉ cần hiểu: cùng một hợp âm, nốt thấp nhất đổi thì câu nhạc có một đường đi khác."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 1",
      "title": "Nốt thấp nhất quyết định",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Hiểu rằng nốt bass (nốt thấp nhất) là thứ cho tai biết hợp âm đang đứng ở đâu, và đọc được ký hiệu hợp âm có gạch chéo."
        },
        {
          "b": "h",
          "text": "1. Đọc ký hiệu X/Y"
        },
        {
          "b": "table",
          "rows": [
            [
              "Ký hiệu",
              "Đọc là",
              "Hợp âm",
              "Nốt bass"
            ],
            [
              "C",
              "C",
              "C – E – G",
              "C (nốt gốc)"
            ],
            [
              "C/E",
              "C bass E",
              "C – E – G",
              "E"
            ],
            [
              "C/G",
              "C bass G",
              "C – E – G",
              "G"
            ],
            [
              "G/B",
              "G bass B",
              "G – B – D",
              "B"
            ],
            [
              "Am/G",
              "Am bass G",
              "A – C – E",
              "G"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Phần bên trái dấu gạch là hợp âm, phần bên phải là nốt bass. Hợp âm giữ nguyên các nốt của nó; chỉ có nốt thấp nhất thay đổi."
        },
        {
          "b": "h",
          "text": "2. Hai điều cần phân biệt"
        },
        {
          "b": "ul",
          "items": [
            "Hợp âm đảo (C/E, G/B): nốt bass vẫn thuộc hợp âm đó.",
            "Am7/C và C6 cùng bốn nốt (A, C, E, G): đây là chuyện cùng nốt, khác bass — như đã gặp ở Buổi 5."
          ]
        },
        {
          "b": "h",
          "text": "Bài làm"
        },
        {
          "b": "write",
          "label": "Viết ba nốt của G và chỉ ra nốt bass của G/B:",
          "lines": 1
        },
        {
          "b": "write",
          "label": "D/F♯ nghĩa là gì? Hợp âm là gì, nốt bass là gì?",
          "lines": 1
        },
        {
          "b": "callout",
          "label": "NHỚ TỪ BUỔI 5",
          "text": "Am7 và C6 gồm cùng nốt nhưng nghe khác vì nốt bass. Tuần này bạn sẽ nghe và chơi chính điều đó."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 2",
      "title": "Ba cách đứng của một hợp âm",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Chơi cùng một hợp âm với ba nốt bass khác nhau và mô tả cảm giác."
        },
        {
          "b": "h",
          "text": "1. Ba thế của C"
        },
        {
          "b": "table",
          "rows": [
            [
              "Hợp âm",
              "Nốt bass",
              "Một cách bấm thường dùng",
              "Cảm giác thường gặp"
            ],
            [
              "C",
              "C",
              "x–3–2–0–1–0",
              "Đứng vững, ổn định"
            ],
            [
              "C/E",
              "E",
              "0–3–2–0–1–0",
              "Nhẹ hơn, muốn đi tiếp"
            ],
            [
              "C/G",
              "G",
              "3–3–2–0–1–0",
              "Treo, thường dẫn đến G"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Các số là phím bấm từ dây 6 xuống dây 1; x là không đánh dây đó. Ba thế này chỉ khác nhau ở dây bass."
        },
        {
          "b": "h",
          "text": "2. Những đảo phổ biến cần biết"
        },
        {
          "b": "ul",
          "items": [
            "G/B: x–2–0–0–0–3 — bass B là nốt dẫn lên C.",
            "D/F♯: 2–0–0–2–3–2 — bass F♯ là nốt dẫn lên G.",
            "Am/G: 3–0–2–2–1–0 — bass G đi tiếp xuống F."
          ]
        },
        {
          "b": "h",
          "text": "Thử ngay"
        },
        {
          "b": "ol",
          "items": [
            "Chơi C – C/E – C/G – C, mỗi thế 4 phách, chỉ gảy bass trước rồi mới rải cả hợp âm.",
            "Ghi lại: thế nào nghe chắc nhất, thế nào nghe nhẹ nhất, thế nào nghe muốn đi tiếp?"
          ]
        },
        {
          "b": "write",
          "label": "Mô tả cảm giác của C/E bằng một từ và một câu:",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "ĐĂNG LÊN NHÓM",
          "text": "Đăng bản thu C – C/E – C/G – C. Hỏi nhóm: “Đảo nào nghe muốn đi tiếp nhất? Vì sao?”"
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 3",
      "title": "Đường bass đi theo bậc",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Nghe bass như một giai điệu riêng: đi từng bậc xuống hoặc lên thay vì nhảy từ gốc này sang gốc kia."
        },
        {
          "b": "h",
          "text": "1. Hai đường bass kinh điển trong giọng C"
        },
        {
          "b": "table",
          "rows": [
            [
              "Hướng",
              "Vòng hợp âm",
              "Nốt bass"
            ],
            [
              "Đi xuống",
              "C – G/B – Am – Am/G – F",
              "C – B – A – G – F"
            ],
            [
              "Đi lên",
              "C – C/E – F – G",
              "C – E – F – G"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Ở vòng đi xuống, bass là cả một thang âm hạ dần; hợp âm bên trên chỉ đổi theo để giữ đúng nốt bass. Ở vòng đi lên, bass leo từng bậc về phía G."
        },
        {
          "b": "h",
          "text": "2. So sánh"
        },
        {
          "b": "table",
          "rows": [
            [
              "Bản gốc",
              "Bản có đường bass",
              "Điều cần nghe"
            ],
            [
              "C – G – Am – F",
              "C – G/B – Am – F",
              "Bass B nối C và Am mượt hơn như thế nào?"
            ],
            [
              "C – F – G",
              "C – C/E – F – G",
              "Đoạn đi lên có tạo động lực không?"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Bài làm"
        },
        {
          "b": "write",
          "label": "Chơi C – G/B – Am – Am/G – F. Bass đi qua những nốt nào? Bạn cảm nhận gì ở cuối vòng?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "Viết lại vòng C – F – G – C sao cho bass đi theo bậc (gợi ý: dùng C/E):",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "LỖI DỄ MẮC",
          "text": "Chơi bass bằng ngón cái quá mạnh khiến bass lấn át giai điệu. Đường bass cần nghe rõ nhưng nhẹ hơn tiếng hát."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 4",
      "title": "Đảo để nối mượt",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Tìm hợp âm đảo làm cầu nối khi bass phải nhảy xa giữa hai hợp âm."
        },
        {
          "b": "h",
          "text": "1. Khi nào cần cầu nối"
        },
        {
          "b": "table",
          "rows": [
            [
              "Nối",
              "Bass gốc",
              "Khoảng cách",
              "Cầu nối đề xuất"
            ],
            [
              "C → Am",
              "C → A",
              "3 nửa cung xuống",
              "G/B (bass B nằm giữa)"
            ],
            [
              "C → F",
              "C → F",
              "Nhảy 4 quãng",
              "C/E (bass E đi lên F)"
            ],
            [
              "G → C (giọng G)",
              "G → C",
              "Nhảy 4 quãng",
              "G/B (bass B đi lên C)"
            ],
            [
              "G → Em (giọng G)",
              "G → E",
              "Nhảy 3",
              "D/F♯ (bass F♯)"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Quy tắc đơn giản: tìm một nốt bass nằm giữa hai nốt bass cần nối, rồi chọn hợp âm đảo có bass đó."
        },
        {
          "b": "h",
          "text": "2. Kiểm tra bằng tai"
        },
        {
          "b": "ul",
          "items": [
            "Chơi vòng không có cầu nối, rồi chơi vòng có cầu nối.",
            "Nghe chỗ bass nối: nó có làm câu nhạc “trôi” hơn không?",
            "Nếu nghe lạ, thử bỏ cầu nối đó đi; không phải chỗ nào cũng cần."
          ]
        },
        {
          "b": "h",
          "text": "Bài làm"
        },
        {
          "b": "write",
          "label": "Vòng G – Em – C – D. Chỗ nào bass nhảy xa? Cầu nối nào phù hợp?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "Thêm một hợp âm đảo vào vòng C – Am – F – G. Bạn chọn chỗ nào? Bass đi qua nốt nào?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "MỘT NỐT BASS, MỘT LÝ DO",
          "text": "Đừng thêm đảo cho đẹp. Mỗi hợp âm đảo trong vòng phải có một lý do bạn nói ra được: nối hai bass xa nhau, tạo hướng đi lên hay xuống, hoặc dẫn vào nốt bass kế."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 5",
      "title": "Bass đứng yên",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Nghe một nốt bass được giữ nguyên qua nhiều hợp âm: tạo cảm giác neo, treo, hoặc căng trước khi về."
        },
        {
          "b": "h",
          "text": "1. Hai cách dùng"
        },
        {
          "b": "table",
          "rows": [
            [
              "Kiểu",
              "Ví dụ",
              "Cảm giác"
            ],
            [
              "Neo",
              "C – F/C – C",
              "Bass giữ C; hợp âm đổi bên trên, câu vẫn đứng yên một chỗ"
            ],
            [
              "Chuẩn bị về",
              "C/G – G7 – C",
              "Bass giữ G rồi mới xuống C, tạo lực về rõ"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Ở C/G – G7 – C, hai hợp âm đầu cùng có bass G. Chính nốt bass lặp lại này làm tai chờ đợi nốt C ở hợp âm cuối."
        },
        {
          "b": "h",
          "text": "2. Thử ngay"
        },
        {
          "b": "ol",
          "items": [
            "Chơi C – F/C – C chậm, giữ bass C ở cả ba hợp âm.",
            "Chơi F – C/G – G7 – C. Nghe hai hợp âm giữa chung bass G.",
            "Ghi lại: đâu là chỗ bass giữ khiến bạn thấy chờ đợi?"
          ]
        },
        {
          "b": "write",
          "label": "Mô tả cảm giác của bass giữ nguyên bằng một câu:",
          "lines": 2
        },
        {
          "b": "write",
          "label": "Với vòng F – C/G – G7 – C, bass đi qua những nốt nào?",
          "lines": 1
        },
        {
          "b": "callout",
          "label": "ĐĂNG BẢN THU NGẮN",
          "text": "Thu hai bản: C – F – G7 – C với bass thường và với bass giữ G ở chỗ C/G. Hỏi nhóm: bản nào làm việc về C có “trọng lượng” hơn?"
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 6",
      "title": "Đường bass trong giọng thứ",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Dùng đường bass đi xuống trong giọng thứ, và nhận ra vì sao lực về của bậc V vẫn phải giữ."
        },
        {
          "b": "h",
          "text": "1. Đường bass A – G – F – E"
        },
        {
          "b": "table",
          "rows": [
            [
              "Bậc",
              "i",
              "VII",
              "VI",
              "V"
            ],
            [
              "Giọng Am",
              "Am",
              "G",
              "F",
              "E"
            ],
            [
              "Nốt bass",
              "A",
              "G",
              "F",
              "E"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Bass đi xuống từng bước từ A đến E rồi nghỉ ở E — nốt át của giọng Am — để chuẩn bị về Am. Rất nhiều bài hát đệm giọng thứ đều dựa trên đường này."
        },
        {
          "b": "h",
          "text": "2. Biến thể có hợp âm đảo"
        },
        {
          "b": "table",
          "rows": [
            [
              "Biến thể",
              "Vòng",
              "Nốt bass"
            ],
            [
              "Gốc",
              "Am – G – F – E",
              "A – G – F – E"
            ],
            [
              "Đảo ở Am",
              "Am – Am/G – F – E",
              "A – G – F – E (hợp âm Am giữ lại)"
            ],
            [
              "Dùng E7",
              "Am – G – F – E7",
              "A – G – F – E"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Bài làm"
        },
        {
          "b": "write",
          "label": "Chơi Am – G – F – E – Am và ghi cảm giác ở mỗi bước đi xuống:",
          "lines": 2
        },
        {
          "b": "write",
          "label": "Dịch đường bass này sang giọng Em: bậc nào, hợp âm nào, nốt bass nào?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "PHÂN TÍCH PHẢI QUAY LẠI TIẾNG ĐÀN",
          "text": "Đường bass A – G – F – E nghe thế nào nếu bạn bỏ E đi và về thẳng Am? Hãy thử, rồi thêm E vào. Bạn cảm nhận gì ở chỗ bass dừng ở E?"
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 7",
      "title": "Một bài thật, một đường bass",
      "blocks": [
        {
          "b": "callout",
          "label": "NHIỆM VỤ CUỐI TUẦN",
          "text": "Chọn 8–16 ô nhịp của một bài quen. Thiết kế một đường bass đi mượt, thêm ít nhất 2 hợp âm đảo có lý do, rồi chơi và thu lại."
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
              "Nốt bass của vòng gốc",
              "____________________________________________"
            ],
            [
              "Chỗ bass nhảy xa",
              "____________________________________________"
            ],
            [
              "Hợp âm đảo thêm vào (chỗ nào, vì sao)",
              "____________________________________________"
            ],
            [
              "Đường bass mới",
              "____________________________________________"
            ],
            [
              "Nghe khác gì so với bản gốc?",
              "____________________________________________"
            ],
            [
              "Chỗ còn chưa chắc",
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
            "Nói giọng và vòng gốc.",
            "Chơi vòng gốc một lần với bass thường.",
            "Chơi lại với đường bass đã thiết kế, nói rõ đâu là hợp âm đảo.",
            "Nói một câu: “Tôi thêm đảo ở đây vì…”."
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
            "Nghe bài của ít nhất hai bạn: chỉ ra một chỗ bass đi mượt và một chỗ bass có thể bị lấn giai điệu.",
            "Nếu hai bạn chọn đường bass khác nhau cho cùng một bài, cùng chơi cả hai và ghi lại điều nghe được."
          ]
        },
        {
          "b": "callout",
          "label": "MANG CÂU HỎI ĐẾN LỚP",
          "text": "Chỗ nào bạn muốn bass đi xuống nhưng bấm không với tới? Chỗ nào thêm đảo mà nghe lạ? Đó chính là ví dụ tốt nhất để thầy giải đáp trong buổi Zoom."
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
          "text": "A. Đọc và hiểu"
        },
        {
          "b": "write",
          "label": "1. C/E gồm những nốt nào? Nốt bass là gì?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "2. Am/G và Am có gì giống, gì khác?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "3. Vì sao Am7 và C6 cùng nốt mà nghe khác?",
          "lines": 1
        },
        {
          "b": "h",
          "text": "B. Thiết kế đường bass"
        },
        {
          "b": "write",
          "label": "4. Viết đường bass đi xuống từ C đến F dưới vòng C – ? – Am – ? – F:",
          "lines": 2
        },
        {
          "b": "write",
          "label": "5. Nối C → F bằng một hợp âm đảo. Hợp âm nào, nốt bass là gì?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "6. Trong giọng Am, đường bass đi xuống kinh điển gồm những nốt nào?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "7. Khi nào KHÔNG nên thêm hợp âm đảo?",
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
              "Đọc ký hiệu X/Y",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Chơi C, C/E, C/G và phân biệt bằng tai",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Thiết kế đường bass đi theo bậc",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Chọn hợp âm đảo làm cầu nối",
              "☐",
              "☐",
              "☐"
            ],
            [
              "Giải thích lý do của từng nốt bass",
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
            "Câu 1: C – E – G; nốt bass là E.",
            "Câu 2: Cùng ba nốt A – C – E; khác ở bass (G thay cho A). Am/G nghe thấp xuống và muốn đi tiếp đến F.",
            "Câu 3: Cùng bốn nốt A, C, E, G; khác nốt thấp nhất. Bass A cho tai nghe Am7 (vi), bass C cho tai nghe C6 (I).",
            "Câu 4: C – G/B – Am – Am/G – F, bass C – B – A – G – F.",
            "Câu 5: C/E, nốt bass E (E đi lên F).",
            "Câu 6: A – G – F – E.",
            "Câu 7: Khi nốt bass thêm vào làm giai điệu bị lấn hoặc mất rõ; khi đảo không có lý do về đường đi của bass; khi đã quá nhiều đảo liên tiếp khiến câu mất điểm tựa."
          ]
        },
        {
          "b": "h",
          "text": "Mẫu trình bày một đường bass"
        },
        {
          "b": "table",
          "rows": [
            [
              "Bước",
              "Mẫu: C – Am – F – G"
            ],
            [
              "Bass gốc",
              "C – A – F – G"
            ],
            [
              "Chỗ nhảy xa",
              "C → A (nhảy xuống 3 nửa cung)"
            ],
            [
              "Cầu nối",
              "G/B (bass B nằm giữa C và A)"
            ],
            [
              "Đường bass mới",
              "C – B – A – F – G"
            ],
            [
              "Vòng đã thiết kế",
              "C – G/B – Am – F – G"
            ],
            [
              "Nghe",
              "Bass trôi xuống từng bậc, câu nhạc êm hơn trước khi đến F"
            ]
          ]
        },
        {
          "b": "h",
          "text": "Năm câu hỏi trước khi đặt một nốt bass"
        },
        {
          "b": "ul",
          "items": [
            "Nốt bass hiện tại và nốt bass kế tiếp cách nhau bao xa?",
            "Có nốt nào nằm giữa mà một hợp âm đảo cho được?",
            "Nốt bass mới có lấn giai điệu không?",
            "Đây là chỗ cần điểm tựa hay chỗ cần đi tiếp?",
            "Tôi nói được lý do của nốt bass này bằng một câu không?"
          ]
        },
        {
          "b": "callout",
          "label": "CHUẨN BỊ CHO BUỔI 7",
          "text": "Bạn đã có ba công cụ: số bậc và chức năng (Buổi 2–4), thay thế hợp âm (Buổi 5), đường bass (Buổi 6). Buổi 7 sẽ ghép cả ba để phối lại hòa âm cho một bài hát từ đầu đến cuối."
        }
      ]
    }
  ]
}
