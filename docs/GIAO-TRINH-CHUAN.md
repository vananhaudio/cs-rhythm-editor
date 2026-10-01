# Giáo trình chuẩn — SOLO01 là Golden Reference

> Đọc file này TRƯỚC khi soạn / sửa bất kỳ buổi giáo trình lớp nào (SOLO01 Buổi 06+, lớp mới).
> Mục tiêu: các buổi soạn sau, qua nhiều tuần, nhiều phiên Claude, vẫn đúng một mạch với SOLO01.
> Claude chỉ **bổ sung nội dung**, không sáng tạo lại giao diện.

## 1. Nguyên tắc

1. **SOLO01 Buổi 01–05 là chuẩn.** Đã dạy thật, đã xuất bản. Buổi mới thì chép khung của buổi gần nhất (hiện là `src/data/solo01/buoi05.ts`) rồi thay nội dung.
2. **Visual do `LessonDocument` quyết định** (`src/lesson/LessonDocument.tsx`, CSS `.lsn-*`):
   - Bảng màu: nền `#F7F5FC`, tím `#4338CA`, mật ong `#A85F0E`.
   - Font Be Vietnam Pro, card bo góc 16, khung giấy tối đa 900px.
   - Mobile ≤640px, in A4 / Lưu PDF.
   - **Không** CSS riêng cho từng buổi. **Không** component mới khi loại khối sẵn có làm được. **Không** "SOLO01 V2".
3. **Thêm loại khối mới = thêm CAPABILITY** (renderer + bản app mới), không phải nội dung. App native cũ sẽ hiện "cần phiên bản app mới hơn" cho loại nó chưa biết. Phải được Owner duyệt.
4. **Nguồn:**
   - **DB là nguồn runtime** cho việc học trong `/me` và App: `class_lesson_content.blocks` của từng buổi lớp.
   - **File TS** `src/data/solo01/buoiNN.ts` là nguồn soạn và route công khai `/solo01/buoi-NN` (khoá mềm theo ngày, giữ nguyên).
   - Đưa vào DB: Admin → Lớp học → Chặng & Giáo trình → buổi → **Nhập bài có sẵn** → Lưu nháp → **Xuất bản**.
   - Hai nguồn phải cùng thứ tự khối. Sửa một bên thì sửa bên kia.

## 2. Loại khối (`LessonSection`, `src/lesson/lessonTypes.ts`)

| kind | Dùng cho |
|---|---|
| `objectives` | "Sau buổi này học viên làm được" — viền tím trái |
| `recap` | Ôn lại: buổi trước có gì, buổi này chồng thêm gì — viền mật ong |
| `layers` | Cùng một đoạn nhạc qua nhiều tầng (nhìn ra tiến bộ) |
| `note` | Ghi chú ngắn nền mật ong |
| `fretboard` | Sơ đồ cần đàn (vùng + nốt) |
| `score` | Bản nhạc alphaTex (khuông + TAB), tempo, gạch đầu dòng hướng dẫn, mốc chuyển vùng |
| `repertoire` | Tác phẩm (alphaTex sinh từ MusicXML bằng `scripts/musicxml-to-alphatex.mjs` → `works.ts`, KHÔNG sửa tay) |
| `assignment` | Bài tập về nhà (Bài 1., Bài 2. …) — để in |
| `checklist` | Checklist cuối bài |
| `studentNotes` | Ô ghi chú / câu hỏi cho thầy |
| `study` | Tài liệu văn bản tự do (kiểu Hành trình 2027) |
| `checkpoint` | **Bài trả** — xem mục 4 |

## 3. Mạch một buổi (rút từ SOLO01 thật)

```
(recap)  →  objectives  →  Phần học: note / fretboard / score / layers / recap … (theo nội dung)
         →  repertoire  →  assignment  →  checklist  →  studentNotes
```

Thứ tự khối thật trên production (01/10/2026):

- B01: objectives › fretboard › note › score ×3 › repertoire › assignment › checklist › studentNotes
- B02: objectives › note › fretboard › score ×3 › repertoire › assignment › checklist › studentNotes
- B03: recap › objectives › layers › score ×3 › note › repertoire › assignment › checklist › studentNotes
- B04: recap › objectives › note › recap › score › layers › note › layers › note › fretboard › score › repertoire › assignment › checklist › studentNotes
- B05: recap › objectives › recap › fretboard › score › note › score › layers › repertoire › assignment › checklist › studentNotes

Luật máy kiểm (`src/lesson/curriculumStandard.ts`, test `tests/class-social/curriculum-standard.test.ts`):

- Chỉ dùng loại khối ở mục 2.
- `objectives` nằm trong 3 khối đầu.
- Đuôi buổi luôn là `assignment → checklist → studentNotes`.
- Bài trả đặt TRONG mạch học (trước `checklist`). id bắt đầu bằng số buổi (`5.1` ở Buổi 5) và không trùng trong buổi.

## 4. Bài trả (checkpoint) — trả bài NGAY trong giáo trình

```json
{ "kind": "checkpoint", "id": "4.1", "title": "Xếp ngón một câu Thành Phố Buồn",
  "prompt": "Gửi video câu đã xếp ngón + 1 câu: Tôi chọn cách này vì…",
  "required": true, "accepts": ["text", "video_link"] }
```

- **Vị trí:** đặt ngay sau phần học mà nó kiểm tra: Nội dung → **Bài trả 4.1** → nội dung tiếp. Không dồn hết xuống cuối trang.
- **`id`:** ổn định MÃI MÃI trong chương trình + buổi. Dạng `<buổi>.<thứ tự>`, khớp `^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$`, không trùng trong buổi.
  - Đổi id = học viên mất liên kết với bài đã trả.
  - Sửa tiêu đề / yêu cầu thì được, đổi id thì không.
- **`required`:** mặc định `true`. Đủ mọi bài trả bắt buộc ĐẠT → buổi hoàn thành → buổi kế mở. `false` = bài làm thêm.
- **`accepts`:** mặc định `["text","video_link"]`. V1 chỉ chạy `text` và `video_link`. Các loại `image` / `audio` / `quiz` / `interaction` đã có trong schema để dành, nhưng chưa nhận bài (hiện "sẽ mở khi có công cụ"). Không giả chức năng.
- **Video** chủ yếu cho bài chốt cần nghe / nhìn chơi thật. Kiểm nhận thức thì ưu tiên `text`.
- **Hiển thị:**
  - `/me`: nút TRẢ BÀI + trạng thái tại chỗ.
  - Trang công khai, in / PDF, Admin xem trước: hiện tĩnh (không nút).
- **Không bảng định nghĩa riêng:** server đọc đúng `blocks` này (`cl_session_checkpoints`) để kiểm bài nộp và tính hoàn thành buổi.
- Buổi đã xuất bản mà **không có bài trả bắt buộc nào** thì không tự hoàn thành. Học viên sẽ dừng ở buổi đó, nên **buổi nào cũng cần ≥ 1 bài trả bắt buộc**.
- Màn học "Lớp của tôi" bật khi lớp có giáo trình đọc được (HAS_CURRICULUM). Chưa có checkpoint = chế độ giáo trình: xem sơ đồ + giáo án, mọi buổi đã xuất bản mở, không nút trả bài, không tiến độ. Có ≥ 1 checkpoint (HAS_CHECKPOINTS) thì bật thêm trả bài + mở khoá theo buổi.

## 4b. NHỊP HỌC — cấu trúc sư phạm, KHÔNG phải model riêng

HÀNH TRÌNH → LỚP → BUỔI/TUẦN → **NHỊP HỌC** → BÀI TRẢ.

Một buổi có **N nhịp**, mỗi nhịp là: HỌC/ĐỌC → THỰC HÀNH → TRẢ BÀI → sang nhịp tiếp.
- Số nhịp **không cố định** (2, 3, 4… tuỳ giáo án).
- Điểm ngắt nhịp do **Owner quyết khi soạn**. Claude không tự chia nhịp cho giáo án có sẵn.

Biểu diễn: **nhịp hình thành bởi VỊ TRÍ khối `checkpoint` trong `LessonSection[]`**. Không có bảng, type hay model "nhịp" riêng:

```
[recap] [objectives]
[note] [score] [layers]          ← Nhịp 1: học + thực hành
[checkpoint 3.1]                 ← kết thúc Nhịp 1
[fretboard] [score]              ← Nhịp 2
[checkpoint 3.2]                 ← kết thúc Nhịp 2
[repertoire] [assignment] [checklist] [studentNotes]   ← đuôi buổi chuẩn SOLO01
```

- Renderer (`LessonDocument`) và Trang Buổi hiển thị đúng thứ tự này: bài trả nằm NGAY sau phần học của nhịp, không gom xuống cuối buổi.
- Chỉ tạo model riêng khi có nhu cầu kỹ thuật thật (ví dụ khoá từng nhịp). Hiện mở khoá vẫn theo **buổi**.
- Khung "Trả bài · Xem trước" cuối giáo án (chỉ giáo viên thấy, khi buổi chưa có bài trả) chỉ là **trạng thái review giao diện**, KHÔNG phải cấu trúc giáo trình.

## 5. Thêm Buổi 06, 07 … (quy trình)

1. Chép `src/data/solo01/buoi05.ts` → `buoi06.ts`, đổi `SOLO01_BUOI06`, `sessionNo: 6`, nội dung mới. Giữ đúng mạch ở mục 3, thêm bài trả `6.1`, `6.2` … trong mạch.
2. Đăng ký ở 3 chỗ:
   - `src/lesson/Solo01LessonPage.tsx` (`LESSONS`)
   - `src/data/solo01Program.ts` (`doc`, `unlockAt`)
   - `src/classLearning/programTemplates.ts`
3. `npm run test:class-social`: bộ kiểm chuẩn phải PASS.
4. Admin → buổi 06 → Nhập bài có sẵn → Xem trước → **Xuất bản**. Admin chặn Xuất bản nếu bài trả sai id / trùng / thiếu tiêu đề.
5. Học viên đã xong Buổi 05 sẽ tự thấy Buổi 06 mở khi vào lớp (mở lười, tính 7 ngày từ lúc mở). Tiến độ cũ không bị đổi.

Sửa giáo trình buổi đã dạy (thêm / bớt bài trả) **không** viết lại lịch sử: buổi đã hoàn thành vẫn hoàn thành, `opened_at` không đổi.

## 6. Mobile & in

- Học viên học chủ yếu trên điện thoại. Mọi khối đã responsive (bản nhạc 2 ô / hàng khi hẹp, sơ đồ cần đàn cuộn ngang + "Xem lớn").
- "⬇ Lưu PDF" giữ nguyên. Phần tương tác của bài trả có `no-print`.
- Xưng hô: không cài cứng "em / bạn / anh / chị" vào cấu trúc mới. Nội dung giáo trình hiện tại giữ nguyên giọng của Thầy.
