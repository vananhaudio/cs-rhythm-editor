// ── HÀNH TRÌNH 2027 · BUỔI 09 — BẢN THẢO v2 (29/10/2026, Claude soạn, CHỜ THẦY DUYỆT) ──
// Chưa nằm trong repo. Khi Thầy duyệt: chép thành src/data/ht2027/buoi09.ts, gắn doc '/hanhtrinh2027/buoi-09'
// cho lesson đầu Chặng 2 trong ht2027Program.ts và đăng ký trong Ht2027LessonPage.
// Khuôn: Buổi 01–08 (ôn tập 7 ngày + kiểm tra đầu tuần + bài tự kiểm tra + đáp án).
// NGUỒN KHÁI NIỆM “KHUÔN HÌNH” (đã truy nguyên, KHÔNG tự đặt định nghĩa mới):
//   • HỢP ÂM:  Lớp Guitar Online/Hành trình2026/Bộ hợp âm trong giọng.docx — “Khuôn hình: tưởng tượng sự di chuyển bộ hợp âm
//              bằng hình học; nhìn là thấy vị trí hợp âm trên cần đàn; không cần suy nghĩ từng nốt”.
//   • GIAI ĐIỆU: Movies/Bộ video Khởi đầu đam mê/Nội dung chính buổi 1 lớp GL1.docx — “Âm giai & Khuôn hình (Pattern) = mẫu thế tay trên cần đàn;
//              làm quen 2 Pattern đầu thay vì cả 5; đổi tông bằng cách di chuyển vị trí thế tay của Pattern; ốp giai điệu vào Khuôn hình đã học”.
//              Ảnh minh hoạ của Thầy: Movies/Bộ video Khởi đầu đam mê/Bm dorian Patern 1.png (Bm Dorian, hộp 3 nốt/dây).
//   Hai khái niệm KHÁC nhau → bản thảo không trộn.
// [30/10] ĐÃ TÌM THẤY sơ đồ khuôn hình SỐ 4 của Thầy (~/App/khuôn hình.jpg) + lời giảng trong transcript ⇒ xem đầu HT2027-buoi10.ban-thao.ts. Khuôn số 1: vẫn chưa có sơ đồ.
// Buổi 09 vẫn KHÔNG vẽ Pattern (để dành Buổi 10); chỉ dựng nền đã xác minh:
//    âm chủ · vị trí nốt (kiểm bằng tính toán) · dải 7 nốt trên MỘT dây (công thức Buổi 1) · số bậc.
//    Câu chữ “Các Pattern cụ thể sẽ được giới thiệu ở buổi thực hành” là đề xuất — Thầy xác nhận.
import type { LessonDoc } from '../../lesson/lessonTypes'

export const HT2027_BUOI09: LessonDoc = {
  "meta": {
    "programCode": "HT2027",
    "programName": "HÀNH TRÌNH 2027",
    "sessionNo": 9,
    "title": "Âm chủ và cấu trúc khuôn hình",
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
          "text": "Lộ trình 7 ngày: âm chủ là nhà – tìm nhà bằng tai – tìm nhà trên cần đàn – dải âm giai quanh âm chủ – đọc giai điệu bằng số bậc – chơi một câu ở hai nơi – nộp bài"
        },
        {
          "b": "callout",
          "label": "KẾT QUẢ CUỐI TUẦN",
          "text": "Bạn tìm được âm chủ của một bài quen bằng tai, chỉ ra nó ở nhiều chỗ trên cần đàn, dựng được dải bảy nốt của giọng quanh âm chủ, và đọc một câu giai điệu bằng số bậc thay vì chỉ bằng tên nốt. Đây là bước đầu để khỏi phụ thuộc vào tab hay một vị trí cố định."
        },
        {
          "b": "callout",
          "label": "HAI NGHĨA CỦA “KHUÔN HÌNH”",
          "text": "Với hợp âm, khuôn hình là tưởng tượng sự di chuyển của bộ hợp âm bằng hình học: nhìn là thấy vị trí hợp âm trên cần đàn, không cần nghĩ từng nốt. Với giai điệu, khuôn hình (Pattern) là mẫu thế tay của âm giai trên cần đàn; ta học vài Pattern trước, đổi tông bằng cách dời thế tay của Pattern, rồi ốp giai điệu vào khuôn hình đã học. Tuần này bạn chuẩn bị nền cho nghĩa thứ hai: âm chủ, dải bảy nốt và số bậc. Các Pattern cụ thể sẽ được giới thiệu ở buổi thực hành."
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
              "Tìm âm chủ bằng tai + tìm âm chủ trên cần đàn"
            ],
            [
              "Ngày 3–4",
              "25–30 phút",
              "Dải bảy nốt quanh âm chủ + đổi âm chủ, hình giữ nguyên"
            ],
            [
              "Ngày 5–6",
              "25–35 phút",
              "Đọc giai điệu bằng số bậc + chơi một câu ở hai nơi"
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
          "text": "Chưa tìm ra âm chủ cũng không sao. Hãy đăng câu bạn đang phân vân và cách bạn nghĩ lên nhóm để mọi người cùng nghe – hỏi – thử lại trên đàn. Đến buổi thực hành, thầy sẽ giải đáp thêm."
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
              "Âm chủ là nhà",
              "Tìm âm chủ của ba bài quen bằng tai"
            ],
            [
              "2",
              "Âm chủ trên cần đàn",
              "Điền bảng vị trí nốt C trên sáu dây"
            ],
            [
              "3",
              "Dải bảy nốt quanh âm chủ",
              "Chơi và đọc tên bảy nốt của C trưởng trên dây 5"
            ],
            [
              "4",
              "Đổi âm chủ, hình giữ nguyên",
              "Dựng giọng G và D bằng cùng một hình"
            ],
            [
              "5",
              "Đọc giai điệu bằng số bậc",
              "Ghi số bậc cho một câu bạn đã tỉa được"
            ],
            [
              "6",
              "Một câu, hai nơi",
              "Chơi cùng một câu ở hai vị trí và nghe sự khác nhau"
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
          "text": "Kiểm tra đầu tuần — không tra tài liệu"
        },
        {
          "b": "write",
          "label": "1. Viết công thức khoảng cách giữa các bậc của âm giai trưởng (Buổi 1):",
          "lines": 2
        },
        {
          "b": "write",
          "label": "2. Trong giọng C trưởng, hợp âm nào là “nhà”? Vì sao?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "3. Theo bạn, “âm chủ” và “hợp âm chủ” giống và khác nhau ở điểm nào?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "MỤC TIÊU CỦA CHẶNG 2",
          "text": "Chặng 1 bạn nhìn bài hát từ phía hòa âm. Chặng 2 bạn nhìn nó từ phía giai điệu: nốt nào là nhà, nốt nào đang đi xa, và chúng nằm ở đâu trên cần đàn."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 1",
      "title": "Âm chủ là nhà",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Nghe ra nốt “về nhà” của một bài, trước khi tìm nó trên đàn."
        },
        {
          "b": "h",
          "text": "1. Nghe để tìm nhà"
        },
        {
          "b": "p",
          "text": "Ở Chặng 1 bạn đã gọi hợp âm chủ là “nhà” (T). Với giai điệu cũng vậy: nốt mà câu hát dừng lại và bạn thấy bài đã hết là âm chủ của giọng. Từ âm chủ ta dựng được cả giọng."
        },
        {
          "b": "h",
          "text": "2. Ba cách thử"
        },
        {
          "b": "ol",
          "items": [
            "Hát hết bài rồi dừng thật tự nhiên: nốt cuối bạn hát là ứng viên.",
            "Hát khẽ một nốt rồi đàn từng nốt trên dây 1 để tìm nốt trùng với giọng hát.",
            "Thử nốt đó với hợp âm chủ của bài (Buổi 3): hai thứ có “ở nhà” cùng nhau không?"
          ]
        },
        {
          "b": "write",
          "label": "Ba bài quen, và nốt bạn nghĩ là âm chủ của mỗi bài:",
          "lines": 3
        },
        {
          "b": "callout",
          "label": "LƯU Ý",
          "text": "Nghe sai âm chủ thì mọi thứ phía sau lệch theo. Chưa chắc thì đánh dấu “chưa chắc” và đem lên nhóm — đó là cách học, không phải thiếu sót."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 2",
      "title": "Âm chủ trên cần đàn",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Thấy cùng một nốt xuất hiện ở nhiều chỗ trên cần đàn, và nhận ra nó không chỉ có một vị trí."
        },
        {
          "b": "h",
          "text": "1. Cùng tên nốt, nhiều vị trí"
        },
        {
          "b": "p",
          "text": "Đàn lên dây chuẩn, các dây buông là E – A – D – G – B – E (dây 6 đến dây 1). Cùng một nốt có thể nằm trên nhiều dây khác nhau. Nốt C (Đô) — âm chủ của giọng C trưởng — nằm ở các vị trí sau:"
        },
        {
          "b": "table",
          "rows": [
            [
              "Dây",
              "Ngăn của nốt C"
            ],
            [
              "Dây 6",
              "ngăn 8"
            ],
            [
              "Dây 5",
              "ngăn 3"
            ],
            [
              "Dây 4",
              "ngăn 10"
            ],
            [
              "Dây 3",
              "ngăn 5"
            ],
            [
              "Dây 2",
              "ngăn 1"
            ],
            [
              "Dây 1",
              "ngăn 8"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Chơi lần lượt từng vị trí, nghe cùng một tên nốt ở các độ cao khác nhau. Dây 5 ngăn 3 là chỗ thuận tay nhất để bắt đầu, nên ta dùng nó cho ngày kế tiếp."
        },
        {
          "b": "h",
          "text": "2. Tự tìm"
        },
        {
          "b": "write",
          "label": "Điền bảng cho nốt G (âm chủ của G trưởng): dây 6 ngăn ___, dây 5 ngăn ___, dây 4 ngăn ___, dây 3 ngăn ___, dây 2 ngăn ___, dây 1 ngăn ___:",
          "lines": 3
        },
        {
          "b": "callout",
          "label": "MẸO KIỂM TRA",
          "text": "Nốt ở ngăn 5 của một dây trùng với nốt buông của dây liền sau nó (dây 6 → 5, 5 → 4, 4 → 3, 2 → 1); riêng dây 3 sang dây 2 thì là ngăn 4. Dùng mẹo này để tự kiểm lại bảng của bạn."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 3",
      "title": "Dải bảy nốt quanh âm chủ",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Dựng bảy nốt của giọng trên một dây, lấy âm chủ làm điểm xuất phát."
        },
        {
          "b": "h",
          "text": "1. Công thức trên một dây"
        },
        {
          "b": "p",
          "text": "Âm giai trưởng theo khoảng cách ngăn trên một dây: từ âm chủ đi lên 0 – 2 – 4 – 5 – 7 – 9 – 11 ngăn (tương ứng Cung – Cung – Nửa cung – Cung – Cung – Cung – Nửa cung ở Buổi 1)."
        },
        {
          "b": "table",
          "rows": [
            [
              "Bậc",
              "I",
              "II",
              "III",
              "IV",
              "V",
              "VI",
              "VII"
            ],
            [
              "Cách ngăn so với âm chủ",
              "0",
              "+2",
              "+4",
              "+5",
              "+7",
              "+9",
              "+11"
            ],
            [
              "Ngăn trên dây 5 (âm chủ C ở ngăn 3)",
              "3",
              "5",
              "7",
              "8",
              "10",
              "12",
              "14"
            ],
            [
              "Tên nốt",
              "C",
              "D",
              "E",
              "F",
              "G",
              "A",
              "B"
            ]
          ]
        },
        {
          "b": "h",
          "text": "2. Thực hành"
        },
        {
          "b": "ul",
          "items": [
            "Chơi bảy nốt đi lên rồi đi xuống thật chậm, đọc tên nốt thành tiếng.",
            "Dừng ở bậc I, bậc III, bậc V: nghe ba nốt này tạo nên hợp âm chủ (Buổi 1).",
            "Chơi lại nhưng khép mắt: nghe nốt cuối của dải “muốn về” nốt nào."
          ]
        },
        {
          "b": "write",
          "label": "Nốt nào trong dải nghe “căng” nhất, nốt nào nghe “yên” nhất? Vì sao theo bạn?",
          "lines": 2
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 4",
      "title": "Đổi âm chủ, hình giữ nguyên",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Hiểu rằng công thức không đổi; đổi âm chủ chỉ là dời cả hình đi nơi khác."
        },
        {
          "b": "h",
          "text": "1. Cùng một hình, dời đi"
        },
        {
          "b": "p",
          "text": "Công thức 0 – 2 – 4 – 5 – 7 – 9 – 11 áp dụng cho mọi âm chủ. Muốn dựng giọng G trưởng, ta bắt đầu từ nốt G rồi đếm cùng những khoảng ấy."
        },
        {
          "b": "table",
          "rows": [
            [
              "Giọng",
              "Âm chủ",
              "Vị trí âm chủ (dây 6)",
              "Các ngăn của bảy nốt",
              "Dấu hóa"
            ],
            [
              "C trưởng",
              "C",
              "ngăn 8",
              "8 – 10 – 12 – 13 – 15 – 17 – 19",
              "Không có"
            ],
            [
              "G trưởng",
              "G",
              "ngăn 3",
              "3 – 5 – 7 – 8 – 10 – 12 – 14",
              "F♯"
            ],
            [
              "D trưởng",
              "D",
              "ngăn 10",
              "10 – 12 – 14 – 15 – 17 – 19 – 21",
              "F♯, C♯"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Nhìn bảng: hàng nào cũng có cùng khoảng cách giữa các ngăn. Hình không đổi; chỉ điểm bắt đầu đổi."
        },
        {
          "b": "h",
          "text": "2. Thực hành"
        },
        {
          "b": "ul",
          "items": [
            "Dựng G trưởng trên dây 6 (ngăn 3 đến 14), đọc tên nốt. Dừng ở F♯ và nghe nó “muốn” về G.",
            "Dựng D trưởng trên dây 5 (âm chủ D ở ngăn 5): các ngăn 5 – 7 – 9 – 10 – 12 – 14 – 16.",
            "So sánh: bạn chỉ phải nhớ MỘT hình hay ba hình khác nhau?"
          ]
        },
        {
          "b": "write",
          "label": "Viết bằng lời của bạn: vì sao đổi giọng lại chỉ là dời hình đi?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "GHI NHỚ",
          "text": "Bạn học một hình, dùng cho mọi giọng. Điều cần nhớ không phải “nốt nào ở ngăn nào” mà là “âm chủ ở đâu, rồi đếm theo công thức”."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 5",
      "title": "Đọc giai điệu bằng số bậc",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Nhìn một câu giai điệu và nói được mỗi nốt đứng ở bậc nào của giọng."
        },
        {
          "b": "h",
          "text": "1. Từ tên nốt đến số bậc"
        },
        {
          "b": "p",
          "text": "Ở Chặng 1 bạn đổi tên hợp âm thành số bậc (I, IV, V, vi…). Với giai điệu, ta dùng số bậc của nốt: 1, 2, 3, 4, 5, 6, 7, tính từ âm chủ. Nhờ vậy cùng một câu hát ở giọng C hay giọng G vẫn có cùng dãy số."
        },
        {
          "b": "table",
          "rows": [
            [
              "Giọng C trưởng",
              "C",
              "D",
              "E",
              "F",
              "G",
              "A",
              "B"
            ],
            [
              "Số bậc",
              "1",
              "2",
              "3",
              "4",
              "5",
              "6",
              "7"
            ]
          ]
        },
        {
          "b": "h",
          "text": "2. Làm với câu của bạn"
        },
        {
          "b": "ol",
          "items": [
            "Chọn một câu ngắn (4–8 nốt) của bài bạn đã tỉa được trên đàn.",
            "Xác định giọng và âm chủ của bài (Ngày 1).",
            "Viết tên từng nốt, rồi viết số bậc bên dưới.",
            "Hát lại câu bằng số bậc: “3 – 3 – 2 – 1…”."
          ]
        },
        {
          "b": "write",
          "label": "Câu giai điệu của bạn (tên nốt rồi số bậc):",
          "lines": 3
        },
        {
          "b": "callout",
          "label": "NHẮC LẠI TỪ CHẶNG 1",
          "text": "Cũng như hợp âm có chức năng, nốt trong giai điệu có “vai”: có nốt yên, có nốt căng. Chưa cần gắn nhãn; chỉ cần nghe nốt nào muốn về nhà."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 6",
      "title": "Một câu, hai nơi",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Chơi cùng một câu ở hai vị trí khác nhau và nghe điều gì giống, điều gì khác."
        },
        {
          "b": "h",
          "text": "1. Cách làm"
        },
        {
          "b": "ol",
          "items": [
            "Lấy câu ở Ngày 5. Chơi ở vị trí quen nhất của bạn.",
            "Tìm âm chủ ở một dây khác (Ngày 2). Dựng lại câu từ đó, giữ nguyên số bậc.",
            "Chơi cả hai lần. Ghi lại: nghe có gì khác? Tay có gì khác?"
          ]
        },
        {
          "b": "table",
          "rows": [
            [
              "So sánh",
              "Vị trí 1",
              "Vị trí 2"
            ],
            [
              "Dây và ngăn của âm chủ",
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
            ],
            [
              "Cảm giác của câu",
              "___",
              "___"
            ]
          ]
        },
        {
          "b": "write",
          "label": "Kết luận của bạn sau khi chơi hai nơi (hai câu):",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "CẢNH BÁO",
          "text": "Đừng đoán vị trí thứ hai bằng cách nhớ tab. Hãy tìm âm chủ trước rồi dựng câu từ số bậc. Nếu câu đi quá xa cần đàn, bạn tìm lại âm chủ ở dây khác, không cố nhớ ngăn."
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
          "text": "Nộp phiếu âm chủ của một bài, kèm câu giai điệu viết bằng số bậc và video 60–90 giây chơi câu đó ở hai nơi."
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
              "Tên bài",
              "___"
            ],
            [
              "Âm chủ và giọng",
              "___"
            ],
            [
              "Âm chủ nằm ở những chỗ nào trên cần đàn (ít nhất hai dây)",
              "___"
            ],
            [
              "Câu giai điệu (tên nốt)",
              "___"
            ],
            [
              "Câu giai điệu (số bậc)",
              "___"
            ],
            [
              "Điều tôi nghe được khi chơi hai nơi",
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
            "Nói tên bài, giọng và âm chủ bạn tìm được.",
            "Chơi câu ở vị trí 1, nói số bậc đi kèm.",
            "Chơi câu ở vị trí 2.",
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
            "Nghe bài của ít nhất hai bạn: chỉ ra một chỗ tìm âm chủ rất rõ, và một chỗ nên nghe lại.",
            "Ghi một câu hỏi về âm chủ hoặc cách đọc số bậc để thầy giải đáp."
          ]
        },
        {
          "b": "callout",
          "label": "MANG CÂU HỎI ĐẾN LỚP",
          "text": "Bài nào bạn nghe mãi mà chưa chắc âm chủ? Câu nào đọc số bậc xong vẫn thấy “lạ”? Đó là những ví dụ tốt nhất cho buổi thực hành."
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
          "text": "A. Âm chủ và vị trí"
        },
        {
          "b": "write",
          "label": "1. Nốt C xuất hiện ở dây 5 ngăn nào? Ở dây 2 ngăn nào?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "2. Âm chủ của một bài là nốt nào, theo cách nghe bạn đã dùng ở Ngày 1?",
          "lines": 2
        },
        {
          "b": "h",
          "text": "B. Dải âm giai"
        },
        {
          "b": "write",
          "label": "3. Viết các ngăn của bảy nốt D trưởng trên dây 5, biết âm chủ D ở ngăn 5:",
          "lines": 2
        },
        {
          "b": "write",
          "label": "4. Vì sao đổi giọng chỉ là dời hình đi?",
          "lines": 2
        },
        {
          "b": "h",
          "text": "C. Số bậc"
        },
        {
          "b": "write",
          "label": "5. Trong giọng G trưởng, nốt B và nốt D là bậc mấy?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "6. Một câu viết 3 – 3 – 2 – 1 trong giọng C là những nốt nào? Trong giọng G thì sao?",
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
              "Nghe ra âm chủ của một bài",
              "",
              "",
              ""
            ],
            [
              "Tìm âm chủ ở nhiều dây",
              "",
              "",
              ""
            ],
            [
              "Dựng bảy nốt quanh âm chủ",
              "",
              "",
              ""
            ],
            [
              "Đọc một câu bằng số bậc",
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
            "Bài Ngày 2 (nốt G): dây 6 ngăn 3 · dây 5 ngăn 10 · dây 4 ngăn 5 · dây 3 buông (ngăn 0) · dây 2 ngăn 8 · dây 1 ngăn 3.",
            "Câu 1: Dây 5 ngăn 3; dây 2 ngăn 1.",
            "Câu 2: Nốt mà câu hát dừng lại và nghe như đã hết; có thể kiểm bằng cách thử với hợp âm chủ của bài.",
            "Câu 3: D trưởng trên dây 5: 5 – 7 – 9 – 10 – 12 – 14 – 16 (D E F♯ G A B C♯).",
            "Câu 4: Công thức khoảng cách giữa các ngăn không đổi, chỉ điểm bắt đầu (âm chủ) đổi.",
            "Câu 5: Trong G trưởng, B là bậc 3, D là bậc 5.",
            "Câu 6: Giọng C: E – E – D – C. Giọng G: B – B – A – G."
          ]
        },
        {
          "b": "h",
          "text": "Năm câu hỏi trước khi nộp"
        },
        {
          "b": "ul",
          "items": [
            "Tôi đã nghe âm chủ trước khi tìm nó trên đàn chưa?",
            "Tôi đã thử ít nhất hai vị trí của âm chủ chưa?",
            "Số bậc của câu có đúng khi tôi đổi giọng không?",
            "Video của tôi nói được âm chủ, số bậc và hai vị trí không?",
            "Tôi đã ghi một câu hỏi cho buổi thực hành chưa?"
          ]
        },
        {
          "b": "callout",
          "label": "CHUẨN BỊ CHO BUỔI 10",
          "text": "Buổi 10 là khuôn hình trong giọng trưởng. Hãy giữ lại bảng âm chủ và dải bảy nốt của tuần này để làm nền."
        }
      ]
    }
  ]
}
