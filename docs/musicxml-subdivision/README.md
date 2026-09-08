# Giai đoạn 5 — Cấp độ đếm phách

Context: cùng bản MusicXML, thầy cần chọn cách đếm phù hợp trình độ học viên, kể cả khi nốt ngân dài, nghỉ, đảo phách hoặc lấy đà. Lưới đếm là annotation theo meter, độc lập với hình nốt.

## Schema và luồng

```ts
type CountingLevel = "beats" | "eighths" | "sixteenths";
type ScoreAnnotation = {
  id: string;
  kind: "beat" | "subbeat";
  partId: string;
  sourceMeasureId: string;
  label: string;
  offset: Rational; // canonical "n/d", quarter-note units, relative to fragment
};
createAnnotations(beatMap, countingLevel);
```

`ScoreSettings.countingLevel` mặc định `beats`; `showBeats: false` là “Không hiện”. Giữ API cũ để toàn bộ 179 kiểm tra trước vẫn nguyên vẹn.

MusicXML → normalized timeline → Beat Engine **không thay đổi** → annotation policy → MEI `dir/tstamp` → Verovio → các trang SVG chung cho preview/PDF/PNG. Không đưa `&`, `e`, `a` vào parser/Beat Engine; không thêm note/voice giả vào MEI; không overlay hoặc chỉnh riêng x sau render.

Lưới đầy đủ dùng BigInt: `beat + slot / slots`, với `slots=2` hoặc `4`. Trừ `pickupOffset` rồi chỉ giữ `0 <= offset < actualDuration`. Không đọc danh sách note, divisions, tie hay time-modification để sinh lưới. Offset tiếp tục là phân số; chỉ đổi sang decimal chính xác khi viết MEI tstamp (phân số không có decimal hữu hạn được chẩn đoán theo cơ chế đã có).

### Pickup khóa bằng expected viết tay

| Fragment 4/4 | Phách | Chia đôi | Chia tư |
|---|---|---|---|
| Quarter, phase 3/1 | `4@0/1` | `4@0/1 &@1/2` | `4@0/1 e@1/4 &@1/2 a@3/4` |
| Eighth, phase 7/2 | không nhãn | `&@0/1` | `&@0/1 a@1/4` |

Không tạo số `4` trước đầu fragment. Expected trong `tests/musicxml-subdivision/expected/grids.json` được viết theo quy tắc, không lấy output engine làm golden. File triplet vẫn có lưới straight eighth/sixteenth của meter; không đếm theo từng triplet note.

## Layout và overlap

Lần kiểm tra đầu phát hiện overlap ở 9 phép kiểm tra trang/cấp: các ô thưa nốt/nghỉ chưa dành đủ chiều ngang cho subdivision. Đã giải quyết bằng tham số engraving Verovio `spacingLinear`, `spacingNonLinear`, `measureMinWidth`, có điều chỉnh theo cỡ chữ. Verovio tự phân dòng/trang và tiếp tục resolve x từ **tstamp**. Không chia đều width bằng code ứng dụng và không gắn nhãn vào note gần nhất. Các cấp có thể khác system/page breaks; **trong cùng một cấp**, preview/SVG/PDF/PNG dùng chung layout.

Tham chiếu engraving: https://book.verovio.org/advanced-topics/layout-options.html và https://book.verovio.org/toolkit-reference/toolkit-options.html. Các giá trị cuối đã được kiểm chứng bằng fixture, không chỉ chọn theo tài liệu.

Bổ sung `ANNOTATION_DENSITY_COLLISION`: so bounding boxes của annotation với nhau. Nếu ô quá chật thì ẩn nhãn của ô bị ảnh hưởng và hiển thị diagnostic, gợi ý giảm cỡ hoặc chọn ngang. Giữ kiểm tra va lyrics/staff và clipping trang từ Giai đoạn 4. Không tuyên bố giải quyết mọi engraving cực đoan ngoài bộ fixture.

Kết quả cuối: **0 overlap, 0 clipping, 0 diagnostic trong các case browser nghiệm thu**. Cỡ 14 pt/distance 8 giữ đầy đủ nhãn của whole note/rest, syncopation và pickup trong test mới. Bản 60 ô có 960 nhãn chia tư → **6 trang A4** ở mặc định 7 pt; kiểm tra đủ từng trang. Đây là đổi bố cục để có chỗ in, không đổi thời gian âm nhạc.

## File thay đổi

- `src/musicxml-beats/annotations.ts`: CountingLevel, grid rational, phase pickup.
- `renderer/types.ts`: optional countingLevel.
- `renderer/temporalAnnotations.ts`: truyền cấp đếm vào annotation policy.
- `renderer/verovioAdapter.ts`: spacing subdivision, kiểm tra annotation–annotation.
- `src/pages/MusicXmlBeatsPage.tsx`: radio Không hiện / Phách / Chia đôi / Chia tư; giữ màu/cỡ/khoảng cách/A4/export.
- `package.json`: thêm `test:musicxml-subdivision`.
- `tests/musicxml-subdivision/`: fixtures/expected/test/harness và kiểm định file.
- Tài liệu và artifacts trong thư mục này. **Không sửa parser, rational, model, Beat Engine, route, PDF/PNG converter hoặc 179 kiểm tra cũ.** Artifacts regression Giai đoạn 4 được tạo lại để xác nhận bằng file thật.

## Test và bằng chứng

**179 cũ PASS:** 58 Beat Engine + 11 Renderer + 10 MVP + 4 export Node + 87 browser + 9 kiểm định artifact.

**151 mới PASS:**
- 55 Node tests: 12 fixture × 3 cấp, expected thủ công, note/divisions/tie independence, phân loại kind, không mutate beat-map, invalid level, underfull, MEI/SVG, pickup eighth, bật/tắt/giữ ngữ nghĩa nốt-lời-hợp âm, font lớn.
- 81 assertion browser trên 13 tổ hợp fixture/cấp: số/nhãn, overlap từng cặp, lyrics, page clipping, nhiều trang.
- 15 artifact tests: 13 bộ SVG/PDF/PNG + Unicode/harmony ở ba cấp + nhiều trang. Tái sử dụng bộ kiểm định Giai đoạn 4 **không sửa test cũ**. PDF vector, A4, font nhúng/ToUnicode; thứ tự nhãn và baseline tọa độ PDF khớp SVG tới 0,001 point; PNG/Poppler so vị trí và vùng nét với dung sai khử răng cưa. Không dùng OCR.

**Tổng 330 PASS, 0 FAIL**. TypeScript và `npm run build` PASS; còn cảnh báo build chunk lớn/import AlphaTab sẵn có của repo.

UI production kiểm tra đổi `4 → 8 → 16` nhãn trên cùng file mẫu và tắt nhãn; PDF chia tư có lời tải trực tiếp từ UI. Preview: http://127.0.0.1:4173/musicxml-beats (local, chưa deploy).

### Chạy lại

```sh
npm run test:musicxml-beats
npm run test:musicxml-renderer
npm run test:musicxml-mvp
npm run test:musicxml-export
npm run test:musicxml-subdivision
npm run build
```

Vite dev: chạy harness cũ `/tests/musicxml-export/browser.html` và harness mới `/tests/musicxml-subdivision/browser.html`. Giải nén ZIP tải về vào output tương ứng, rồi chạy:

```sh
python3 tests/musicxml-export/verify-artifacts.py
python3 tests/musicxml-subdivision/verify-artifacts.py
```

Python cần pypdf/Pillow/numpy, PATH có pdftoppm. Xem `output/browser-results.txt`, `output/artifact-tests.txt`, `output/node-tests.txt` và `output/regression-summary.txt`.

## Artifacts nghiệm thu

- `output/three-levels-whole-note.png`: cùng một whole note 4/4 ở cả ba cấp, ảnh từ SVG xuất độc lập.
- `output/pickup-eighth.png`: lấy đà eighth cả ba cấp; ô tiếp theo bên phải vẫn có lưới đầy đủ.
- `output/ui-sixteenths.png`: UI radio với file có lời/harmony.
- `output/lyrics-harmony-sixteenths/score.pdf`: A4 có hai dòng lời tiếng Việt + hợp âm ở cấp chia tư. SVG và PNG cùng thư mục.
- `output/page-bottom-sixteenths/`: 60 ô, 960 nhãn, 6 trang.

Engraving rộng hơn có thể làm đường lyric extend nhìn rõ hơn; dữ liệu lyrics/extend không đổi, không hack melisma. Vẫn giữ giới hạn font/multipart và các giới hạn MusicXML đã công bố. Không thêm 6/8, swing, triplet syllables, accent, playback, batch. Dừng sau Giai đoạn 5 để thầy nghiệm thu phương pháp đếm.

> `output/` **không nằm trong repo** (`.gitignore`) — là artifacts tái tạo được. Lệnh tái tạo đầy đủ: [`docs/MUSICXML-BEATS.md`](../MUSICXML-BEATS.md).
