// Nội dung Owner duyệt 06/11/2026; đồng bộ gói phát hành riêng tư solo01-buoi06-tra-bai.
// Đáp án chỉ lưu server, không đưa vào tài liệu này.
import type { LessonDoc } from "../../lesson/lessonTypes"

export const SOLO01_BUOI06: LessonDoc = {
  "meta": {
    "programCode": "SOLO01",
    "programName": "SOLO GUITAR CĂN BẢN",
    "sessionNo": 6,
    "title": "Melody + Bass cùng lúc",
    "stageLabel": "Chặng 1 · Từ giai điệu đến Solo Guitar",
    "backHref": "/solo01"
  },
  "sections": [
    {
      "kind": "recap",
      "title": "Từ Buổi 05 sang Buổi 06",
      "steps": [
        {
          "label": "Buổi 05 đã có",
          "items": [
            "Bạn tự chọn bass theo hợp âm.",
            "Bạn nối hai nốt bằng ba cách: gảy lại · trượt · luyến."
          ]
        },
        {
          "label": "Buổi 06 thêm",
          "items": [
            "Lớp lót — lớp thứ ba, đặt vào giữa giai điệu và bass."
          ]
        }
      ],
      "message": "Vẫn Diễm Xưa. Hôm nay ghép đủ ba lớp: giai điệu, bass, rồi lót."
    },
    {
      "kind": "objectives",
      "title": "Cuối buổi, bạn làm được",
      "items": [
        "Nói đúng ba lớp và thứ tự quan trọng: giai điệu › bass › lót.",
        "Giữ nguyên cách xếp ngón của buổi trước; chỉ bấm những nốt thật cần.",
        "Đặt lót vào chỗ giai điệu ngân dài từ một phách trở lên.",
        "⭐ QUAN TRỌNG NHẤT — Giai điệu và bass phải vững; lót có thì tốt, không có cũng không sao."
      ]
    },
    {
      "kind": "note",
      "title": "Nhịp 1 · Ba lớp và thứ tự ưu tiên",
      "text": "Nhìn bản nhạc như một bức tranh nhiều lớp: tách từng lớp ra thì dễ thấy. Kết thúc nhịp: Bài trả 6.1 (trắc nghiệm)."
    },
    {
      "kind": "recap",
      "title": "Phần 1 — Ba lớp",
      "steps": [
        {
          "label": "Giai điệu",
          "items": [
            "Là bông hoa — phải rõ nhất.",
            "Không thể bỏ."
          ]
        },
        {
          "label": "Bass",
          "items": [
            "Là cột bê tông — giữ nhịp, giữ khung.",
            "Cũng không thể bỏ."
          ]
        },
        {
          "label": "Lớp lót",
          "items": [
            "Là hàng rào thưa — nhẹ, đều, không lấn giai điệu.",
            "Có thì tốt, không có không sao."
          ]
        }
      ],
      "message": "Nếu tay chưa kịp, hy sinh phần lót trước; giữ giai điệu và bass."
    },
    {
      "kind": "checkpoint",
      "id": "6.1",
      "title": "Bài trả 6.1 — Ba lớp",
      "required": true,
      "accepts": [
        "quiz"
      ],
      "quiz": {
        "mode": "single",
        "question": "Khi tay chưa kịp chơi đủ ba lớp, nên bỏ bớt lớp nào trước?",
        "options": [
          {
            "id": "a",
            "text": "Giai điệu"
          },
          {
            "id": "b",
            "text": "Bass"
          },
          {
            "id": "c",
            "text": "Lớp lót"
          },
          {
            "id": "d",
            "text": "Lớp nào cũng được"
          }
        ],
        "hint": "Giai điệu và bass là phần không được mất; phần phụ hy sinh trước."
      }
    },
    {
      "kind": "note",
      "title": "Nhịp 2 · Học lót trên Diễm Xưa",
      "text": "Chỉ học một việc: thêm lót vào chỗ nốt giai điệu ngân dài. Giữ nguyên thế tay trái như Buổi 05 — hợp âm chỉ được thêm vào, không làm đổi cách xếp ngón. Chỉ bấm nốt cần, lót đánh nhẹ. Kết thúc nhịp: Bài trả 6.2 (trắc nghiệm)."
    },
    {
      "kind": "score",
      "subtitle": "Bài tập 01",
      "title": "Diễm Xưa ô 1–4 — tìm chỗ đặt lót",
      "lead": "Bản này chỉ có giai điệu và tên hợp âm. Bass bạn đã chọn ở Buổi 05; hôm nay thêm lót.",
      "tempo": "Tempo: ♩ = 60",
      "tex": "\\ts 4 4\n\\lyrics \"Mưa vẫn mưa bay trên tầng tháp cổ Dài tay em mấy thuở mắt xanh xao\"\n.\nr.8 0.1.8 1.1.8 0.1.8 0.1.8 1.2.8 2.3.8 1.2.8 |\n2.4{ch \"Am\"}.1 |\nr.8 2.3.8 1.2.8 0.1.8 3.1{ch \"A7\"}.8 3.1.8 5.1.8 0.1.8 |\n3.2{ch \"Dm\"}.1",
      "marks": [
        {
          "at": "Ô 2",
          "text": "nốt dài cả ô — chỗ đặt lót"
        },
        {
          "at": "Ô 4",
          "text": "nốt dài cả ô — chỗ đặt lót"
        }
      ],
      "guidance": [
        "Chỉ đặt lót ở nốt giai điệu ngân từ một phách trở lên; nốt ngắn thì để trống.",
        "Lót chọn nốt nằm trong hợp âm đang đàn, đánh nhẹ hơn giai điệu.",
        "Đàn chậm trước; nghe giai điệu vẫn rõ nhất mới thêm tốc độ."
      ]
    },
    {
      "kind": "checkpoint",
      "id": "6.2",
      "title": "Bài trả 6.2 — Đặt lót",
      "required": true,
      "accepts": [
        "quiz"
      ],
      "quiz": {
        "mode": "single",
        "question": "Nên đặt lớp lót vào lúc nào?",
        "options": [
          {
            "id": "a",
            "text": "Cùng lúc với mọi nốt giai điệu"
          },
          {
            "id": "b",
            "text": "Khi nốt giai điệu đang ngân từ khoảng một phách trở lên"
          },
          {
            "id": "c",
            "text": "Thay cho bass"
          },
          {
            "id": "d",
            "text": "Chỉ ở nốt cuối bài"
          }
        ],
        "hint": "Lót là phần nhỏ, chen vào chỗ giai điệu đang ngân, không tranh chỗ với giai điệu."
      }
    },
    {
      "kind": "note",
      "title": "Nhịp 3 · Vận dụng vào Thành Phố Buồn",
      "text": "Đây là phần vận dụng, khuyến khích nhưng không bắt buộc. Bạn lặp lại đúng cách vừa làm ở Diễm Xưa: giữ giai điệu và bass, rồi lót ở chỗ nốt ngân dài. Ở buổi này chỉ làm câu đầu, chỗ hợp âm Am ở đầu câu (\"Thành phố nào…\"). Chưa cần ghép hoàn hảo — ghép được là đủ. Kết thúc nhịp: Bài trả 6.3 (video + chữ)."
    },
    {
      "kind": "assignment",
      "items": [
        {
          "label": "Bài 1.",
          "text": "Diễm Xưa ô 1–4: đàn giai điệu và bass vững trước, rồi thêm lót ở các nốt ngân dài."
        },
        {
          "label": "Bài 2.",
          "text": "Nghe lại: giai điệu có rõ nhất không? lót có đủ nhẹ không?"
        },
        {
          "label": "Bài 3 (vận dụng, không bắt buộc).",
          "text": "Thành Phố Buồn câu đầu: thử lót ở chỗ hợp âm Am đầu câu."
        }
      ],
      "message": "Giai điệu và bass trước, lót sau. Nếu phải bỏ, bỏ lót."
    },
    {
      "kind": "checkpoint",
      "id": "6.3",
      "title": "Bài trả 6.3 — Lót hai bài",
      "prompt": "Chơi Diễm Xưa ô 1–4 có đủ giai điệu, bass và lót ở ít nhất một chỗ nốt ngân dài. Không cần hoàn hảo. Nếu muốn, chơi thêm câu đầu Thành Phố Buồn (không bắt buộc, không ảnh hưởng kết quả Đạt). Sau đó viết ngắn: ‘Tôi đặt lót ở chỗ này vì…’. Nộp: dán link video và vài dòng chữ.",
      "required": true,
      "accepts": [
        "video_link",
        "text"
      ]
    },
    {
      "kind": "checklist",
      "items": [
        "Tôi nói được ba lớp và lớp nào bỏ trước.",
        "Tôi giữ nguyên cách xếp ngón của buổi trước.",
        "Tôi đặt lót ở chỗ nốt giai điệu ngân dài.",
        "Giai điệu vẫn là lớp rõ nhất khi tôi thêm lót.",
        "⭐ Tôi nói được vì sao mình đặt lót ở chỗ đó."
      ]
    },
    {
      "kind": "studentNotes",
      "title": "Tôi đặt lót ở chỗ này vì…",
      "lines": 6
    }
  ]
}
