// ── HÀNH TRÌNH 2027 · BUỔI 10 — BẢN THẢO (30/10/2026, Claude soạn, CHỜ THẦY DUYỆT) ──
// Chưa nằm trong repo. Khi Thầy duyệt: chép thành src/data/ht2027/buoi10.ts, gắn doc '/hanhtrinh2027/buoi-10'
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

export const HT2027_BUOI10: LessonDoc = {
  "meta": {
    "programCode": "HT2027",
    "programName": "HÀNH TRÌNH 2027",
    "sessionNo": 10,
    "title": "Khuôn hình trong giọng trưởng",
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
          "text": "Lộ trình 7 ngày: khuôn hình là gì – đọc khuôn số 4 – giọng trưởng trong khuôn – bê khuôn sang giọng khác – số bậc trong khuôn – ốp một câu hát vào khuôn – nộp bài"
        },
        {
          "b": "callout",
          "label": "KẾT QUẢ CUỐI TUẦN",
          "text": "Bạn đọc được khuôn hình số 4 (hình 4 ngăn × 6 dây), chỉ ra nhà của giọng trưởng trong hình ấy, chạy bảy nốt lên và xuống theo số bậc, và ốp được một câu hát quen vào khuôn ở hai giọng khác nhau."
        },
        {
          "b": "callout",
          "label": "KHUÔN HÌNH LÀ GÌ — THEO LỜI THẦY",
          "text": "Nhặt các nốt của một âm giai rồi xếp lên cần đàn thì thành một khuôn hình. Có rất nhiều cách xếp; cách vừa với bốn ngón tay của ta là khuôn hình số 4. Mỗi giọng có năm khuôn hình, ta chỉ học hai — số 4 và số 1 — vì hai khuôn là mức vừa đủ và tối thiểu để phủ hết cần đàn. Học một lần, dùng cho mọi giọng: muốn đổi giọng chỉ việc dời khuôn, tên nốt đổi nhưng số bậc và cự ly ngón tay được giữ nguyên."
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
              "Hiểu khuôn hình + đọc khuôn số 4"
            ],
            [
              "Ngày 3–4",
              "25–30 phút",
              "Nhà của giọng trưởng trong khuôn + bê khuôn sang giọng khác"
            ],
            [
              "Ngày 5–6",
              "25–35 phút",
              "Số bậc trong khuôn + ốp một câu hát vào khuôn"
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
          "text": "Chưa chắc chấm nào là nhà cũng không sao. Hãy đăng ảnh hình bạn vẽ và cách bạn nghĩ lên nhóm để mọi người cùng thử trên đàn. Đến buổi thực hành, thầy sẽ giải đáp thêm."
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
              "Khuôn hình là gì",
              "Tự giải thích bằng lời của bạn: vì sao có khuôn, vì sao chỉ học hai"
            ],
            [
              "2",
              "Đọc khuôn số 4",
              "Vẽ lại hình 4 ngăn × 6 dây từ bảng, đánh dấu chấm cam và chấm vàng"
            ],
            [
              "3",
              "Nhà của giọng trưởng",
              "Chạy bảy nốt Rê trưởng lên và xuống từ chấm vàng"
            ],
            [
              "4",
              "Bê khuôn sang giọng khác",
              "Tìm chấm vàng ở thế tay IV, V, VII và đàn lại bảy nốt"
            ],
            [
              "5",
              "Số bậc trong khuôn",
              "Ghi số bậc lên từng chấm của hình"
            ],
            [
              "6",
              "Ốp câu hát vào khuôn",
              "Một câu quen, hai giọng, cùng một dãy số"
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
          "text": "Kiểm tra đầu tuần — không tra tài liệu (nối từ Buổi 9)"
        },
        {
          "b": "write",
          "label": "1. Âm chủ của một bài là nốt nào, và bạn nghe ra nó bằng cách nào?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "2. Công thức bảy nốt của một giọng trưởng trên một dây tính theo ngăn là gì?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "3. Vì sao đổi giọng chỉ là dời hình đi? Hãy giải thích bằng lời của bạn.",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "MỤC TIÊU CỦA TUẦN",
          "text": "Ở Buổi 9 bạn dựng bảy nốt trên MỘT dây. Tuần này bạn xếp cả bảy nốt lên NHIỀU dây thành một hình vừa tay: đó là khuôn hình."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 1",
      "title": "Khuôn hình là gì",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Hiểu vì sao có khuôn hình và vì sao chỉ cần học hai khuôn."
        },
        {
          "b": "h",
          "text": "1. Từ âm giai đến khuôn"
        },
        {
          "b": "p",
          "text": "Âm giai là nguyên liệu của bản nhạc: một bài ở giọng nào thì chỉ dùng bảy nốt của giọng đó, đảo đi đảo lại. Ta tập theo bộ bảy nốt ấy để hình dung được, nhớ được và nghe được. Nhưng bảy nốt rải khắp cần đàn thì khó chơi; nên ta nhặt chúng và gom vào một vị trí thuận tay. Cái hình gom lại ấy là khuôn hình."
        },
        {
          "b": "h",
          "text": "2. Hình như chiếc mặt nạ"
        },
        {
          "b": "p",
          "text": "Hình dung một tấm nhựa hình chữ nhật có đục lỗ đúng chỗ mỗi nốt của giọng. Đặt tấm nhựa lên cần đàn, ta chỉ việc bấm vào các lỗ. Muốn đổi giọng, ta nhấc cả tấm nhựa dời sang chỗ khác, không phải dựng lại âm giai từ đầu."
        },
        {
          "b": "h",
          "text": "3. Vì sao chỉ học hai khuôn"
        },
        {
          "b": "ul",
          "items": [
            "Mỗi giọng có thể xếp thành năm khuôn hình phủ hết cần đàn.",
            "Học cả năm khuôn thì quỹ thời gian bị chia nhỏ, tay khó thành phản xạ. Hai khuôn là mức vừa đủ và tối thiểu để phủ hết cần đàn.",
            "Hai khuôn ấy là khuôn số 4 và khuôn số 1. Số 4 dễ nhất: có 4 ngón, 4 ngăn, hợp bàn tay. Khuôn số 4 là khuôn mà nốt chủ âm nằm trên dây 5; khuôn số 1 thì nốt chủ âm nằm trên dây 6."
          ]
        },
        {
          "b": "write",
          "label": "Bằng lời của bạn: khuôn hình là gì, vì sao chỉ học hai khuôn?",
          "lines": 3
        },
        {
          "b": "callout",
          "label": "LƯU Ý",
          "text": "Con số 1, 4 chỉ là tên gọi theo mốc giọng La trưởng; đừng tìm ý nghĩa nào khác trong con số. Tuần này ta tập trung khuôn số 4."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 2",
      "title": "Đọc khuôn hình số 4",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Đọc được hình số 4: chấm nào ở dây nào, ngăn nào, ngón nào."
        },
        {
          "b": "h",
          "text": "1. Thế tay và ngón"
        },
        {
          "b": "p",
          "text": "Thế tay là vị trí ngón trỏ, ghi bằng chữ số La Mã: ngón trỏ đặt ở ngăn 2 thì ta đang chơi ở thế tay II. Trong khuôn số 4, bốn ngón phủ bốn ngăn liền nhau: ngón 1 ở ngăn đầu của thế tay, ngón 2 kế đó, ngón 3 rồi ngón 4."
        },
        {
          "b": "h",
          "text": "2. Hình số 4 ở thế tay II (Si thứ // Rê trưởng)"
        },
        {
          "b": "table",
          "rows": [
            [
              "Dây",
              "Ngăn (thế tay II)",
              "Ngón (theo hình của Thầy)",
              "Nốt (Si thứ / Rê trưởng)"
            ],
            [
              "Dây 1",
              "2 · 3 · 5",
              "1 · 2 · 4",
              "Fa♯ · Sol · La"
            ],
            [
              "Dây 2",
              "2 · 3 · 5",
              "1 · 2 · 4",
              "Đô♯ · Rê · Mi"
            ],
            [
              "Dây 3",
              "2 · 4",
              "1 · 3",
              "La · Si"
            ],
            [
              "Dây 4",
              "2 · 4 · 5",
              "1 · 3 · 4",
              "Mi · Fa♯ · Sol"
            ],
            [
              "Dây 5",
              "2 · 4 · 5",
              "1 · 3 · 4",
              "Si (chấm cam) · Đô♯ · Rê (chấm vàng)"
            ],
            [
              "Dây 6",
              "2 · 3 · 5",
              "1 · 2 · 4",
              "Fa♯ · Sol · La"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Trong hình của Thầy, chấm cam đánh dấu nốt Si (dây 5 ngăn 2) và chấm vàng đánh dấu nốt Rê (dây 5 ngăn 5): hai chủ âm của cặp Si thứ // Rê trưởng. Chủ âm là “nhà”, như ở Buổi 9. Hai giọng này dùng CÙNG một hình — Thầy gọi là một cặp. Nhìn bảng: mọi dây đều bắt đầu ở ngăn 2, và dây 3 chỉ có hai chấm."
        },
        {
          "b": "h",
          "text": "3. Thực hành"
        },
        {
          "b": "ol",
          "items": [
            "Đặt ngón trỏ ở ngăn 2. Chơi lần lượt từng dây, đọc to các ngăn bạn bấm.",
            "Chơi hết hình từ dây 6 lên dây 1, mỗi dây đi lên theo thứ tự ngăn.",
            "Khép mắt và bấm: tay bạn nhớ hình chưa?"
          ]
        },
        {
          "b": "write",
          "label": "Vẽ lại hình 4 ngăn × 6 dây từ bảng; tô cam chấm Si và tô vàng chấm Rê:",
          "lines": 4
        },
        {
          "b": "callout",
          "label": "MẸO KIỂM TRA",
          "text": "Nhìn bảng: ba dây 1, 2, 6 cùng ngăn 2 · 3 · 5; hai dây 4, 5 cùng ngăn 2 · 4 · 5; chỉ dây 3 là 2 · 4. Hình bạn vẽ phải khớp ba nhóm này."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 3",
      "title": "Nhà của giọng trưởng trong khuôn",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Chạy bảy nốt của giọng trưởng trong khuôn, bắt đầu từ chấm vàng."
        },
        {
          "b": "h",
          "text": "1. Bắt đầu từ chấm vàng"
        },
        {
          "b": "p",
          "text": "Chấm vàng (Rê, dây 5 ngăn 5) là bậc 1 của giọng Rê trưởng. Từ đó ta lên bậc 2, 3, 4… theo đúng các chấm của hình."
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
              "Rê",
              "Mi",
              "Fa♯",
              "Sol",
              "La",
              "Si",
              "Đô♯",
              "Rê"
            ],
            [
              "Dây · ngăn",
              "dây 5 · 5",
              "dây 4 · 2",
              "dây 4 · 4",
              "dây 4 · 5",
              "dây 3 · 2",
              "dây 3 · 4",
              "dây 2 · 2",
              "dây 2 · 3"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Hình còn chấm ở dưới nhà (dây 6 và dây 5): dây 5 ngăn 4 (Đô♯) là bậc 7 phía dưới, dây 5 ngăn 2 (Si) là bậc 6 phía dưới, dây 6 các ngăn 5 · 3 · 2 là bậc 5 · 4 · 3 phía dưới. Phía trên nhà, hình còn các chấm ở dây 2 ngăn 5 (bậc 2 cao) và dây 1 ngăn 2 · 3 · 5 (bậc 3 · 4 · 5 cao)."
        },
        {
          "b": "h",
          "text": "2. Thực hành"
        },
        {
          "b": "ul",
          "items": [
            "Chạy từ bậc 1 lên bậc 8 rồi xuống lại, thật chậm, đọc tên nốt thành tiếng.",
            "Dừng ở bậc 1, 3, 5: ba nốt này nghe như hợp âm chủ (Buổi 1 của Chặng 1).",
            "Chạy xuống dưới nhà: từ bậc 1 xuống bậc 7, 6, 5 phía dưới."
          ]
        },
        {
          "b": "write",
          "label": "Nốt nào trong hình nghe “yên” nhất, nốt nào nghe “căng” nhất? Vì sao theo bạn?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "GHI NHỚ",
          "text": "Bảy nốt của giọng trưởng không còn nằm trên một dây thẳng mà đã xếp thành một hình. Hình ấy chính là khuôn số 4."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 4",
      "title": "Bê khuôn sang giọng khác",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Dời cùng một hình sang thế tay khác và nhận ra nhà mới ở đâu."
        },
        {
          "b": "h",
          "text": "1. Dời hình, nhà dời theo"
        },
        {
          "b": "p",
          "text": "Muốn đổi giọng, ta không dựng lại bảy nốt mà dời cả hình. Chấm vàng luôn nằm ở dây 5, cách ngón trỏ ba ngăn (ngăn của thế tay + 3). Dời hình đi đâu thì nhà trưởng đi theo đó."
        },
        {
          "b": "table",
          "rows": [
            [
              "Thế tay",
              "Giọng trưởng (chấm vàng)",
              "Vị trí chấm vàng",
              "Cặp thứ (chấm cam)"
            ],
            [
              "II",
              "Rê trưởng",
              "dây 5 ngăn 5",
              "Si thứ"
            ],
            [
              "III",
              "Mi♭ trưởng",
              "dây 5 ngăn 6",
              "Đô thứ"
            ],
            [
              "IV",
              "Mi trưởng",
              "dây 5 ngăn 7",
              "Đô♯ thứ"
            ],
            [
              "V",
              "Fa trưởng",
              "dây 5 ngăn 8",
              "Rê thứ"
            ],
            [
              "VII",
              "Sol trưởng",
              "dây 5 ngăn 10",
              "Mi thứ"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Năm giọng ở bảng chính là năm giọng Thầy ghi dưới hình số 4 (Bm // D · Cm // E♭ · C♯m // E · Dm // F · Em // G). Ta không phải nhớ tên các nốt, chỉ cần nhớ hình và chấm vàng ở đâu."
        },
        {
          "b": "h",
          "text": "2. Thực hành"
        },
        {
          "b": "ol",
          "items": [
            "Đặt ngón trỏ ở ngăn 5 (thế tay V). Tìm chấm vàng và đàn bảy nốt đi lên từ đó.",
            "Làm tương tự ở thế tay VII (Sol trưởng).",
            "So sánh với Ngày 3: tay bạn có cảm giác như cùng một hình không? Tai bạn nghe cùng một dãy không?"
          ]
        },
        {
          "b": "write",
          "label": "Tên nốt đã đổi, còn hai thứ nào được giữ nguyên khi bạn dời khuôn?",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "GHI NHỚ",
          "text": "Khi dời khuôn thì tên nốt đổi, nhưng tai nghe và cự ly ngón tay được giữ nguyên. Vì vậy ta gọi nốt bằng số bậc, không gọi bằng tên."
        }
      ]
    },
    {
      "kind": "study",
      "tag": "Ngày 5",
      "title": "Số bậc trong khuôn",
      "blocks": [
        {
          "b": "callout",
          "label": "MỤC TIÊU",
          "text": "Biết mỗi chấm trong hình là bậc mấy của giọng trưởng."
        },
        {
          "b": "h",
          "text": "1. Điền số bậc vào hình"
        },
        {
          "b": "p",
          "text": "Với chấm vàng là bậc 1, các chấm của hình ở thế tay II mang số bậc như sau (đọc theo giọng Rê trưởng):"
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
              "2 → bậc 3 · 3 → bậc 4 · 5 → bậc 5"
            ],
            [
              "Dây 2",
              "2 → bậc 7 · 3 → bậc 1 · 5 → bậc 2"
            ],
            [
              "Dây 3",
              "2 → bậc 5 · 4 → bậc 6"
            ],
            [
              "Dây 4",
              "2 → bậc 2 · 4 → bậc 3 · 5 → bậc 4"
            ],
            [
              "Dây 5",
              "2 → bậc 6 · 4 → bậc 7 · 5 → bậc 1 (nhà)"
            ],
            [
              "Dây 6",
              "2 → bậc 3 · 3 → bậc 4 · 5 → bậc 5"
            ]
          ]
        },
        {
          "b": "p",
          "text": "Bậc 1 có hai chỗ trong hình: dây 5 ngăn 5 và dây 2 ngăn 3 (cao hơn một quãng tám). Khi chơi, ta chọn chỗ nào vừa tầm giọng của bài."
        },
        {
          "b": "h",
          "text": "2. Đọc câu nhạc bằng số bậc"
        },
        {
          "b": "p",
          "text": "Một câu hát viết bằng số bậc, ví dụ 3 – 3 – 2 – 1, dùng được ở mọi giọng: ở Rê trưởng là Fa♯ – Fa♯ – Mi – Rê; sang thế tay IV (Mi trưởng) cùng dãy số ấy là Sol♯ – Sol♯ – Fa♯ – Mi."
        },
        {
          "b": "write",
          "label": "Điền số bậc cho từng chấm trên hình bạn vẽ ở Ngày 2:",
          "lines": 3
        },
        {
          "b": "write",
          "label": "Viết dãy số bậc của một câu hát quen (4–8 nốt) và các chấm của nó trong hình:",
          "lines": 3
        },
        {
          "b": "callout",
          "label": "NHẮC LẠI TỪ BUỔI 9",
          "text": "Số bậc đã giúp bạn đọc một câu hát ở bất kỳ giọng nào. Hôm nay số bậc có thêm một nơi để bám vào: các chấm của khuôn hình."
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
          "text": "Đưa một câu hát quen vào khuôn hình, ở hai giọng khác nhau."
        },
        {
          "b": "h",
          "text": "1. Cách làm"
        },
        {
          "b": "ol",
          "items": [
            "Chọn một câu hát ngắn (4–8 nốt) của một bài ở giọng trưởng. Tìm âm chủ bằng tai (Buổi 9).",
            "Viết câu bằng số bậc.",
            "Đặt khuôn số 4 sao cho chấm vàng trùng âm chủ của bài. Đàn câu theo số bậc.",
            "Dời khuôn sang giọng khác (ví dụ lên thế tay V), đàn lại cùng dãy số."
          ]
        },
        {
          "b": "table",
          "rows": [
            [
              "So sánh",
              "Giọng 1",
              "Giọng 2"
            ],
            [
              "Thế tay",
              "___",
              "___"
            ],
            [
              "Chấm vàng ở đâu",
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
          "label": "Điều bạn nhận ra sau khi chơi cùng một câu ở hai giọng (hai câu):",
          "lines": 2
        },
        {
          "b": "callout",
          "label": "CẢNH BÁO",
          "text": "Đừng nhớ vị trí từng nốt. Hãy nhớ hình và nhớ chấm vàng ở đâu. Nếu câu nhạc đi ra ngoài hình, đó là dấu hiệu cần nối sang khuôn khác — ta sẽ làm ở Buổi 12."
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
          "text": "Nộp phiếu khuôn hình, kèm một câu hát viết bằng số bậc và video 60–90 giây chơi câu đó ở hai giọng."
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
              "Tên bài và giọng",
              "___"
            ],
            [
              "Âm chủ bạn nghe ra",
              "___"
            ],
            [
              "Thế tay thứ nhất · chấm vàng ở đâu",
              "___"
            ],
            [
              "Thế tay thứ hai · chấm vàng ở đâu",
              "___"
            ],
            [
              "Câu hát (số bậc)",
              "___"
            ],
            [
              "Điều tôi nghe và thấy khi dời khuôn",
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
            "Nói tên bài, giọng và âm chủ.",
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
            "Nghe bài của ít nhất hai bạn: chỉ ra một chỗ ốp câu vào khuôn rất gọn, và một chỗ nên thử lại.",
            "Ghi một câu hỏi về khuôn hình hoặc số bậc để thầy giải đáp."
          ]
        },
        {
          "b": "callout",
          "label": "MANG CÂU HỎI ĐẾN LỚP",
          "text": "Câu nào bạn ốp xong vẫn thấy “lạ”? Chỗ nào tay bạn bị vướng khi dời khuôn? Đó là ví dụ tốt nhất cho buổi thực hành."
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
          "text": "A. Khuôn hình"
        },
        {
          "b": "write",
          "label": "1. Khuôn hình là gì? Vì sao Thầy chỉ dạy hai khuôn?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "2. Khuôn số 4 có chủ âm nằm trên dây nào?",
          "lines": 1
        },
        {
          "b": "h",
          "text": "B. Đọc hình"
        },
        {
          "b": "write",
          "label": "3. Ở thế tay II, dây 3 có mấy chấm và ở những ngăn nào?",
          "lines": 1
        },
        {
          "b": "write",
          "label": "4. Chấm vàng ở thế tay V nằm ở dây nào, ngăn nào? Đó là giọng trưởng nào?",
          "lines": 2
        },
        {
          "b": "h",
          "text": "C. Số bậc"
        },
        {
          "b": "write",
          "label": "5. Ở thế tay II, dây 4 ngăn 4 là bậc mấy của Rê trưởng? Nốt đó tên là gì?",
          "lines": 2
        },
        {
          "b": "write",
          "label": "6. Câu 3 – 3 – 2 – 1 ở Rê trưởng là những nốt nào?",
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
              "Vẽ lại hình số 4 không nhìn bảng",
              "",
              "",
              ""
            ],
            [
              "Tìm chấm vàng ở một thế tay bất kỳ",
              "",
              "",
              ""
            ],
            [
              "Chạy bảy nốt trong khuôn",
              "",
              "",
              ""
            ],
            [
              "Ốp một câu hát vào khuôn",
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
            "Câu 1: Khuôn hình là cách xếp các nốt của âm giai lên cần đàn thành một hình vừa với bốn ngón tay; chỉ học hai khuôn (số 4 và số 1) vì đó là mức vừa đủ và tối thiểu để phủ hết cần đàn, và dành thời gian đó để biến hình thành phản xạ.",
            "Câu 2: Dây 5.",
            "Câu 3: Hai chấm — ngăn 2 và ngăn 4.",
            "Câu 4: Dây 5, ngăn 8 — Fa trưởng.",
            "Câu 5: Bậc 3; nốt Fa♯.",
            "Câu 6: Fa♯ – Fa♯ – Mi – Rê."
          ]
        },
        {
          "b": "h",
          "text": "Năm câu hỏi trước khi nộp"
        },
        {
          "b": "ul",
          "items": [
            "Tôi đã tìm âm chủ bằng tai trước khi đặt khuôn chưa?",
            "Chấm vàng của tôi có trùng âm chủ không?",
            "Số bậc của câu có đúng khi tôi dời khuôn không?",
            "Video của tôi nói được âm chủ, số bậc và hai thế tay không?",
            "Tôi đã ghi một câu hỏi cho buổi thực hành chưa?"
          ]
        },
        {
          "b": "callout",
          "label": "CHUẨN BỊ CHO BUỔI 11",
          "text": "Buổi 11 là khuôn hình trong giọng thứ. Giữ lại hình số 4 của tuần này: tuần sau ta đọc lại đúng hình ấy, nhưng đặt nhà ở chấm cam."
        }
      ]
    }
  ]
}
