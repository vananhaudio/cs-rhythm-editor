# MusicXML Renderer + Beat Annotation Spike — Giai đoạn 2

Bản nghiệm thu hình ảnh: [review.svg](output/review.svg).

## Trạng thái

- Verovio npm **6.3.0**, engine **6.3.0-425dd7b**, WebAssembly/ESM.
- Gate đầu vào: Giai đoạn 1 **58/58 PASS**, `npx tsc -b` PASS trước khi cài Verovio.
- Renderer tách trong `src/musicxml-beats/renderer/`; không sửa parser/rational/beat engine.
- Đây là POC offline, một part/một staff/một trang. Chưa có UI, route hoặc export PDF/PNG.
- Năm fixture riêng trong `tests/musicxml-renderer/fixtures/`, dựa trên fixture Giai đoạn 1,
  bổ sung khóa Sol tường minh. Case lặng dùng `<rest measure="yes"/>` thật.
  Các file nguồn được lưu kèm output; renderer nhận nguyên file nguồn đó.

## A — timestamp trước engraving (đề xuất)

MusicXML nguồn → Verovio import đầy đủ sang MEI → thêm `dir` tại `tstamp`
đọc từ beat-map → Verovio render SVG. Không dựng lại nốt từ normalized model.

- `tstamp = offset quarter-note trong phần thực của measure + 1` với meter /4.
- Pickup quarter: nhãn **4**, nhưng `tstamp="1"` trong ô ngắn, không phải tstamp 4.
- Annotation không có `startid`, không liên kết tới nốt gần nhất.
- Verovio tự tính x từ musical timestamp theo layout engraving.
- `vgrp="987"` gom hàng số; chữ đỏ, đậm, 7pt, dưới khuông, giữ vùng lyrics.
- Tọa độ xuất trong `*.report.json` là SVG user units bên trong `page-margin`,
  trước transform/page scaling. Mỗi anchor giữ ID measure nguồn và ID MEI.
- Code không chia đều chiều rộng measure. Test đảo phách kiểm tra x phách 2–4
  nằm giữa các đầu nốt, và khoảng cách giữa các phách không đồng đều.

## B — SVG trước, overlay từ timemap/layout

Render nguyên bản → `renderToTimemap({includeRests:true})` → tìm **đúng qstamp**
của phách → lấy origin của glyph đã được Verovio layout → chèn text overlay.

Không có exact onset thì trả `NO_EXACT_TIMEMAP_ONSET`. Dấu lặng cả ô nằm giữa
ô về mặt hình học, không phải mốc thời gian; trả `NO_TEMPORAL_LAYOUT_ORIGIN`.
Không nội suy từ chiều rộng measure, không dùng nốt đang ngân làm mốc giả.

| Fixture | A resolve | B resolve | Phách B không resolve |
|---|---:|---:|---|
| Whole note | 4/4 | 1/4 | 2, 3, 4 |
| Whole-measure rest | 4/4 | 0/4 | 1, 2, 3, 4 |
| Syncopation | 4/4 | 1/4 | 2, 3, 4 |
| Pickup + ô tiếp theo | 5/5 | 2/5 | Ô tiếp theo: 2, 3, 4 |
| Lyrics + harmony | 4/4 | 2/4 | 3, 4 |
| **Tổng** | **21/21** | **6/21** | **15** |

A không có phách unresolved. B thiếu dữ liệu vị trí ở các thời điểm không có event
bắt đầu; không đủ làm hướng production độc lập theo cách thử này. Chưa cần hybrid.

## Kiểm tra giữ notation

Mỗi case lưu baseline SVG/MEI, annotated SVG/MEI, source MusicXML, beat-map và report.
So sánh MEI trước/sau annotation: không đổi các nhóm note/rest/mRest/chord/tie/slur/
tuplet/verse/syl/harm/clef/meterSig/keySig/beam/artic có trong fixture. Không có warning
import/annotation từ Verovio trong năm ca.

Đã xem hình cả năm SVG, kiểm tra nốt tròn, rest cả ô, nốt đảo phách, ô lấy đà,
chấm dôi, khóa Sol, số chỉ nhịp; hai dòng lời **Thầy Văn Anh / Âm nhạc** và
hợp âm **C** phía trên vẫn có. Harmony giữ `tstamp="2"`, tương ứng offset nguồn.
Test còn đối chiếu lyrics trực tiếp từ MusicXML với MEI/SVG.

Giới hạn quan trọng: so sánh baseline→annotation không tự chứng minh importer giữ
mọi đặc tính MusicXML. `<extend/>` của lời được giữ thành `syl con="u"`, nhưng
fixture chứa chuỗi lời dài trên một nốt không có nét kéo lời nhìn thấy rõ trong cả
baseline và A. Vì vậy **chưa nghiệm thu hình ảnh melisma**; không khẳng định mọi
notation của MusicXML đã được bảo toàn trên tất cả file. Layout/vị trí lyrics có
thể giãn để nhường hàng số; nội dung và thời điểm âm nhạc không đổi trong các ca thử.

## Đề xuất cho production

Dùng A với adapter Verovio có version cố định, kiểm tra diagnostic/identity trước
render, giữ MusicXML nguyên bản và xuất anchor map sau render cho debug. Chỉ mở rộng
sang nhiều staff/trang và file thật sau nghiệm thu hình ảnh. Cần thêm bộ kiểm thử
bảo toàn notation rộng hơn trước khi cam kết hỗ trợ MusicXML tổng quát.

## Chạy lại

```sh
npm run test:musicxml-beats
npm run test:musicxml-renderer
npm run spike:musicxml-renderer
npx tsc -b
```

- Giai đoạn 1: 58 tests, giữ nguyên bộ test.
- Spike: 11 tests, gồm 5 ca A, rest thật, tọa độ đảo phách, pickup, giữ lời/harmony,
  B không tự tạo mốc, và từ chối beat-map có diagnostic.
- `spike:musicxml-renderer` tạo lại SVG/MEI/JSON trong `output/` và tờ review SVG.

Tài liệu API đã đối chiếu:
- https://book.verovio.org/installing-or-building-from-sources/javascript-and-webassembly.html
- https://book.verovio.org/toolkit-reference/toolkit-methods.html
- https://github.com/rism-digital/verovio/discussions/3313

> `output/` **không nằm trong repo** (`.gitignore`) — là artifacts tái tạo được. Lệnh tái tạo đầy đủ: [`docs/MUSICXML-BEATS.md`](../MUSICXML-BEATS.md).
