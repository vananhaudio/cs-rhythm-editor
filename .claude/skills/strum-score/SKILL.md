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
