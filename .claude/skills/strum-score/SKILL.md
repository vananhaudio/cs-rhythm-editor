---
name: strum-score
description: Tạo / nhúng một bài "Strum Score" (bản nhạc cho người quạt — màn gảy theo nền) vào bài giảng LMS. Dùng khi thầy nói "tạo strum score", "làm bài quạt theo", "gảy theo bản thu", hoặc gắn ChordStrumPlayer vào một khoá/bài.
---

# Skill: Nhúng Strum Score vào bài giảng

**Strum Score** = một BẢN NHẠC thật dành cho tay phải/người QUẠT (có khuông, nhịp, ô, trường độ, hợp âm) — không phải "bảng/chart". Màn chơi: `src/elearn/ChordStrumPlayer.tsx`.

## Khi nào dùng skill này
Thầy muốn tạo một bài để học viên **quạt theo nền** (synth / mp3), hoặc gắn màn đó vào một khoá.

## Quy ước BẮT BUỘC của thầy (đừng bỏ)
1. **Ô lấy đà (count-in):** ô đầu KHÔNG hợp âm — hiện số đếm phách `1-2-(3/4)` to, dàn đều, **sáng dần theo phách**. Data: `{ pickup: true }` trong `SongBar`. Không vẽ nốt, không đàn ở ô này. (Áp cho MỌI bài gảy-theo.)
2. **Ô kết / nốt trắng:** ô cuối thường là một cú quạt duy nhất — `{ oneStrum: true }`. **Đầu nốt trắng vẽ HÌNH THOI** (diamond) để khỏi nhầm nốt đen.
3. **Ô "Out":** ô nhịp cuối là ô Out → trống/bass chỉ đánh **một cú nhấn** (kick+crash+bass) rồi im, không chạy tiếp.
4. **Nốt là trọng tâm** — to/đều/đẹp; hạn chế màu mè (triết lý thiết kế của thầy).
5. **Bài KHÔNG loop** → hết bài dừng hẳn, không chơi đi chơi lại.

## Mô hình dữ liệu
- `SongBar { chord?, pickup?, rest?, oneStrum? }` — một ô nhịp.
- `StrumSong { bars, patternId, timeSignature, backing?, melody?, loop?, audioUrl?, videoId? }`.
- 3 nguồn tiếng: **nền synth** (`backing`) · **mp3** (`audioUrl`, cần crossOrigin) · YouTube ẩn (`videoId` — RỦI RO Apple 5.2.3, ĐỪNG bật trong app iOS).
- Kiểu quạt: `strumPatterns.ts` (9 kiểu: đen/chùm2/liên3/móc kép × 4/4,3/4,2/4), `resolvePattern(N, eighths, patternId)`.
- Font glyph nốt trắng/lặng = **Bravura** (đã nhúng ở index.html).

## Hình tiết tấu (nền tảng mới, 2026-07-04) — `RhythmFigure` trong `strumPatterns.ts`
Đơn vị nhỏ nhất = **1 hình tiết tấu trong ĐÚNG 1 PHÁCH** (`RhythmFigure { id, name, strokes: FigureStroke[] }`), mỗi cú quạt mang `frac` (tỉ lệ trường độ trong phách, cộng lại = 1) — nên biểu diễn được cả hình CHIA ĐỀU lẫn hình CHIA LỆCH. Một `StrumPattern` (kiểu quạt/`patternId`) hiện = 1 hình lặp lại cho CẢ Ô NHỊP; đây là nền để sau này Fill In/Fill Out/Transition trộn nhiều hình khác nhau trong cùng 1 ô (CHƯA làm).

**Bộ cơ bản đã chốt (hướng quạt do thầy quyết, đừng tự đổi):**
| id | Tên | Cú quạt (frac) | Có số "3"? |
|---|---|---|---|
| `den` | Đen | D (1) | không |
| `chum2` | Chùm 2 | D-U (.5/.5) | không |
| `donkepkep` | Chùm 3 — Đơn kép kép | D-D-U (.5/.25/.25) | **không** (không phải liên ba, chia lệch 2:1:1) |
| `lien3` | Chùm 3 — Liên ba | D-D-D (1/3 đều) | **có** (chia đều mới có ngoặc 3) |
| `mockep` | Chùm 4 — Móc kép | D-U-D-U (.25 đều) | không |

`BeatGroup` (component vẽ trong `ChordStrumPlayer.tsx`) định vị từng cú theo `frac` (không còn cách đều theo index) — hình lệch như `donkepkep` sẽ giãn cách khác hình đều. Chỉ hiện ngoặc "3" khi `M===3 && mọi frac≈1/3` (phân biệt liên ba thật với "đơn kép kép" cũng 3 cú nhưng KHÔNG phải triplet).

⚠️ Đổi từ bản cũ: `lien3` trước đây là D-U-D (chia đều nhưng SAI hướng) → nay sửa thành D-D-D theo đúng quy ước thầy chốt. Nếu bài cũ dùng `patternId:'lien3'` sẽ đổi hướng hiển thị theo bản mới này.

## 2 cách đưa một bài vào hệ thống
**A. Bài "xịn" (melody, lấy đà, ô kết, đổi nguồn tiếng)** → hiện phải HARDCODE trong `src/elearn/strumSongs.ts` (mẫu: `HBD_CHUM2`, Jingle). Thêm route thử trong AppRouter nếu cần xem nhanh (`/hbd`, `/jinglebell`…).
**B. Bài gắn vào KHOÁ qua admin** → lesson `lesson_type='strum'`, config JSON lưu ở cột `content` (`StrumConfigEditor.tsx`: `parseStrumConfig`/`configToSong`). ⚠️ `configToSong` HIỆN chỉ làm bản rút gọn (nền synth + vòng hợp âm đều một kiểu quạt) — KHÔNG tạo được lấy đà/nghỉ/kết/melody/mp3. Bài cần các thứ đó → dùng cách A.
- `StrumConfig { styleId, tempo, patternId, timeSignature, chords[] }`.

## Ghi âm (nếu bài bật)
Trộn mic + nhạc trong CÙNG AudioContext, lưu **LOCAL, không upload**. getUserMedia tắt EC/NS/AGC; mic gain ~1.6, backing ~0.7. Thông báo "đeo tai nghe" để nổi bật (đỏ) cùng dòng "Ghi âm". Cần `studentId`+`lessonId` để xanh-hoá kỹ năng (RPC `record_skill_session`) — LessonViewerPage/MobileStudentPortal truyền đủ.

## Quy trình làm (checklist)
1. Chốt với thầy: nguồn tiếng (synth/mp3), nhịp, kiểu quạt, có lấy đà/ô kết không, có ghi âm không.
2. Dựng `StrumSong` (cách A) hoặc config `strum` lesson (cách B) theo đúng 5 quy ước trên.
3. Nếu seed DB: ghi vào `edu_course_lessons` (đúng khoá/chương), `lesson_type='strum'`, config ở `content`.
4. `npm run build` (tsc -b BẮT BUỘC) → sửa lỗi type.
5. Commit tiếng Việt + push `main` (Netlify tự deploy). Không verify localhost được nếu là màn cần audio thật → nhờ thầy nghiệm thu.

## Liên quan
Bộ nhớ: `project_strum_score`, `project_countin_pattern`, `project_strum_recording`. Công cụ học sinh tự soạn: `StrumWorkshop.tsx` + `StrumBuilder.tsx` (route `/strum-builder`).
