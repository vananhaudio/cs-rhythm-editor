# Thiết kế Engine Flow — gộp Elearn vào Flow

> Tài liệu thiết kế (chưa code). Sinh từ workflow đa-agent (6 trụ cột → tổng hợp → phản biện đọc code thật).
> Ngày: 2026-06-19.

---

# PHẦN A — BẢN THIẾT KẾ TỔNG HỢP

## 1. TẦM NHÌN

Một engine bài học duy nhất biến mỗi bài thành **vòng lặp hành-động → phản hồi → sửa** với nhịp vài giây/màn, neo vào **đàn thật** (gảy/bấm/lên dây) chứ không phải đọc-cuộn-bấm-tiếp. Học viên lướt qua những màn nhỏ gọn (mỗi màn 1 việc ≤30s), nhận phản hồi tức thì 3 lớp (âm + màu + rung), được app **chờ làm đúng** mới đi tiếp (có lối thoát danh dự vì app chưa nghe được tay đàn), luôn có **người thầy hiện diện** ở đầu/cuối bài. Elearn "tan" hẳn vào Flow: NeckPick/Listen8/ToolLaunch/Check/NoteChart trở thành **slide type tương tác**, dùng chung token, kiểu phản hồi đúng/sai, trục điểm 40→70→100.

## 2. BỘ LOẠI SLIDE (GĐ1 = ✅)

Một field `interactive` (jsonb) duy nhất cho mọi config tương tác. GIỮ `slides` jsonb, KHÔNG `ALTER TABLE`. Field mới đều optional: `gate?, hintText?, remedialSlideId?, skillTag?, isCheckpoint?, interactive?`.

| id | tên | logic | trường dữ liệu | GĐ1 |
|---|---|---|---|---|
| text | Văn bản ngắn | NHAN/NGAM | content ≤280 | ✅ |
| image | Ảnh + caption | NHAN | mediaUrl, content | ✅ |
| video | Video thầy demo | NHAN | mediaUrl | ✅ |
| callout | Mẹo / lời thầy | DAN/NGAM | content, variant(tip/warn/teacher), avatar | ✅ |
| quiz | Trắc nghiệm ≤4 | NGHI | content, options[], correctAnswer | ✅ |
| true_false | Đúng/Sai | NGHI | content, correctAnswer | ✅ |
| input | Tự trả lời ngắn | NGHI/NGAM | content | ✅ |
| guitar_neck | Chạm đúng 1 dây | LAM | {target:1..6} | ✅ |
| guitar_strum | Gảy đủ dãy đúng thứ tự | LAM | {sequence:number[]} | ✅ |
| guitar_ear | Nghe → đoán dây | LAM | {pool?, rounds?:5, passScore?:3} | ✅ |
| guitar_tool | Mở Tuner/Tempo/Board | LAM/DAN | {tool, label?, sub?} | ✅ |
| note_chart | Bảng nốt C–B ↔ Đô–Si | NHAN | {highlight?} | ✅ |
| checklist | Tự đánh giá ≤5 mục | NGAM | {items[], requireAll?} | ✅ |
| self_report | "Đã tập / đã gửi bài" | NGAM/THUONG | {action} | ✅ |
| reward / summary / action | Thưởng / tổng kết / dẫn | THUONG/DAN | — | ✅ |
| image_hotspot, reorder, chord_diagram, rhythm_tap, audio_listen, play_along(tap) | mở rộng | — | — | GĐ2 |
| play_along(mic) | Chấm bằng micro | LAM | inputMode:'mic' | GĐ3 |

## 3. LOGIC TUYẾN BÀI

Trục `logic` quyết định HÀNH VI, không chỉ màu. Khung chuẩn: `DẪN → NHẬN → NGHĨ → LÀM → NGẪM → THƯỞNG → DẪN`.

**Bảng GATE** (thay `canProceed`):
- NHẬN → soft (mở slide là qua)
- NGHĨ → hard (đúng mới qua; sai → feedback + chọn lại)
- LÀM → **hard-mềm** (đạt mục tiêu mới qua; sai → highlight + thử lại; sau N lần sai → nút "Mình đã thử trên đàn → tiếp")
- NGẪM → soft (có thao tác là qua)
- THƯỞNG/DẪN → auto/soft

**Xử lý sai 3 tầng:** hint tại chỗ → hint đậm + reveal nhẹ → CoachLayer (GĐ2). NGẪM/NHẬN không có "sai".

**Gating bài kế = MỀM:** bài N+1 mở khi bài N đạt 40đ (hoàn thành), không đòi 70/100.

## 4. PLAYER & UX

- **KHÔNG CUỘN:** mỗi slide 1 màn. Nội dung dài → tách slide, không nhồi.
- **Phản hồi 3 lớp** qua 1 helper `feedback(ok)`: ÂM (tái dùng `audio.ts`), MÀU (xanh đúng/cam sai), RUNG (Haptics).
- **Đồ nghề tại chỗ:** `guitar_tool` mở overlay `openTool()` đã có, đóng về đúng slide.
- Thanh tiến độ mảnh; mỗi slide đúng = micro-reward (tick+tiếng+rung), KHÔNG XP lẻ/confetti mỗi màn.
- **Tổ chức code:** tách `guitarRenderers.tsx` (6 renderer emit `onPass/onWrong/onOpenTool`) + `guitarConst.ts` (Hz/STR/màu). Widget LÀM EMIT sự kiện cho engine thay vì tự kết thúc.

## 5. SOẠN BÀI (ADMIN) — "Flow Studio" [GĐ2]

3 cột: Palette theo LOGIC + Preset · danh sách slide kéo-thả + form theo type · Preview SỐNG (FlowPlayer thật). Mẫu cả bài ("Bài kỹ năng tay-đàn"). Sửa 2 lỗi UX: **đáp án quiz = dropdown** (không gõ tay), **chọn dây = bấm hình 6 dây**. Validation + Lưu nháp/Xuất bản.

## 6. DỮ LIỆU & MIGRATION

GIỮ slides jsonb + field optional. KHÔNG cột mới. Hz ở `guitarConst.ts` (không DB); DB chỉ lưu **số dây 1-6**. Tương thích ngược: type cũ đi nhánh cũ.

**Migration 11 bài** (script idempotent, không runtime fallback): đọc `data.ts` ⊕ đè `elearn_lessons` → map num→lesson_id (**in ra duyệt trước khi ghi**) → `buildSlides()` (goal→NHẬN, steps→NGHĨ, prompt+thao→LÀM; listen8→2 slide strum+ear) → upsert flow theo lesson_id → set lesson_type='flow'. KHÔNG drop elearn_lessons tới khi verify.

**Điểm hành trình:** FlowPlayer tự ghi `practiced_lesson` (70đ) khi hoàn tất slide LÀM thật. Màn Done giữ nút "Đã gửi bài" (100đ).

## 7. TIẾN ĐỘ & ĐỘNG LỰC

Điểm là HỆ QUẢ của chơi đàn, KHÔNG đẻ trục điểm thứ hai — cắm vào 40/70/100 + XP đang chạy. Sao mỗi bài (từ accuracy), skill mastery, streak freeze — **đa số để GĐ2**. KHÔNG: tim/mạng, linh vật, confetti mỗi slide, leaderboard màn chính.

## 8. LỘ TRÌNH

- **GĐ1 (MVP gộp):** guitarConst + guitarRenderers (6 renderer) · FlowPlayer 6 case + gate hard-mềm + feedback 3 lớp + tự ghi practiced_lesson · field slide mới + VALID_TYPE · script migrate 11 bài (duyệt map trước).
- **GĐ2 (Pro):** Flow Studio 3 cột + preview sống · CoachLayer + remedial · type mới (chord/rhythm/hotspot...) · sao/mastery/streak.
- **GĐ3 (Khó):** mic/pitch detection → app "nghe được tay đàn" thật.

---

# PHẦN B — PHẢN BIỆN (agent đọc code thật)

## Lỗ hổng chính

**A1 [NGHIÊM TRỌNG] FlowPlayer hiện CUỘN** (FlowPlayer.tsx:316 `overflowY:'auto'`), ElearnLessonView cuộn nặng hơn. → 1 widget LÀM = 1 slide CHỈ có widget; steps thành slide riêng. buildSlides LUÔN tách, không "tách nếu dài".

**A2 Tiếng đàn chồng nốt:** `playTone` tạo oscillator mới không cắt nốt cũ → gảy nhanh 6 dây nghe như organ rẻ. → thêm cắt nốt + transient "chạm".

**A3 [Định khung lại] GĐ1-2 KHÔNG thể "đã tay như Yousician"** vì thiếu mic. → định khung trung thực: GĐ1-2 = "Duolingo cho guitar lý thuyết + định vị cần đàn", Yousician thật ở GĐ3.

**B1 [BẪY] flows có unique trên lesson_id không?** Nếu không, chạy script 2 lần → 2 flow/bài → FlowPlayer `.maybeSingle()` (:71) **throw**. → SELECT-rồi-UPDATE theo id, hoặc thêm unique index trước.

**B3 [BẪY off-by-one] số dây:** code trộn số dây nhạc lý (1-6) và index mảng (0-5). → chốt 1 quy ước: **lưu số dây 1-6 trong DB**, renderer tự map.

**C2 [BẪY mất dữ liệu im lặng] FlowManager:188 auto-fix type lạ → 'text'.** Nếu chạy lúc LƯU → flow guitar bị âm thầm biến thành text. → thêm type mới vào VALID_TYPE TRƯỚC khi tạo flow guitar.

**C3 [BẪY cộng đôi] practiced_lesson** ghi ở cả Portal:726-742 (elearn) lẫn FlowPlayer (mới). → gỡ đúng 1 đường khi migrate.

**E2 Người thầy biến mất khi gộp:** ElearnLessonView có "Ghi chú thầy VA" (:428), FlowPlayer không. → `callout variant='teacher'` BẮT BUỘC trong mẫu bài.

**E1/E4 Vòng lặp thành thạo chưa đóng (thiếu mic):** định khung slide LÀM = "self-check có hướng dẫn" (app phát mẫu → bạn bắt chước trên đàn → tự xác nhận), trung thực hơn giả vờ "app chấm đàn". Cuối bài cho nghe lại chuỗi 6 dây vừa gảy = bằng chứng tiến bộ.

## Cắt khỏi GĐ1 (chống over-engineer)
- Hệ **sao/accuracy/mastery/radar** → GĐ2 (8/11 bài là checklist/tool, không đo được accuracy).
- **skillTag tính toán/hiển thị, checkpoint, timer 45s, attemptsBeforeSoftPass cấu hình** → cắt/đơn giản hoá.
- **Kéo lên GĐ1:** dropdown đáp án quiz (bug thật đang có).
- GĐ1 giữ: widget LÀM cho qua khi đạt + nút "đã thử trên đàn" sau ~2 lần sai; reveal nhẹ dây đúng tại widget.

## TOP 5 QUYẾT ĐỊNH THẦY CHỐT TRƯỚC KHI CODE
1. **Quy ước số dây trong DB:** số nhạc lý 1-6 (khuyến nghị) hay index 0-5? — không đảo ngược.
2. **Hệ sao/accuracy ở GĐ1?** — khuyến nghị KHÔNG (cắt ~30% khối lượng GĐ1).
3. **Đường ghi practiced_lesson DUY NHẤT:** FlowPlayer (khuyến nghị) — gỡ ở Portal, tránh cộng đôi.
4. **Slide LÀM GĐ1:** self-check trung thực (khuyến nghị) hay giả vờ "app chấm đàn"?
5. **Ship 1 bài mẫu duyệt trước** (khuyến nghị: bài 4 "Tên 6 dây") hay migrate cả 11 bài luôn?
