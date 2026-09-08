# Giai đoạn 6 — Đếm nhịp 6/8

Context: cùng một bản nhạc 6/8, thầy cần dạy theo sáu pulse móc đơn hoặc hai phách lớn, giữ nguyên notation, lời và hợp âm khi in. Không suy cách đếm từ note onset hoặc beam.

## Model và API

MusicXML giữ meter `{ beats: 6, beatType: 8 }`. `meterGrouping.ts` trả `{ type: "compound", unit: "1/2", groups: [3, 3] }` (unit thực tế là Rational/BigInt). Registry chỉ bật 6/8; cấu trúc nhóm tái sử dụng được khi mở rộng sau này.

- `CompoundCountingMode = "pulses" | "compound"`, độc lập với `CountingLevel` của nhịp đơn.
- Pulse: `1@0, 2@1/2, 3@1, 4@3/2, 5@2, 6@5/2`.
- Phách lớn: `1@0, 2@3/2`. Beat-map nền lưu hai phách cấu trúc; annotation tạo lưới pulse khi được chọn.
- Annotation giữ `kind: "beat" | "subbeat"`, offset Rational; pulse 1 và 4 là đầu nhóm.
- Facade `musicXMLToBeatMap()` bật profile `simple-and-compound`. API thấp `buildBeatMap()` và `measureBeatMap()` giữ default profile `simple` để tương thích hợp đồng trước đây (bao gồm diagnostic 6/8 chưa hỗ trợ). Caller trực tiếp muốn 6/8 truyền profile `simple-and-compound`. Không sửa expected/test cũ.

Renderer nhận annotation cuối cùng, không có nhánh hard-code 6/8. Chuyển offset quarter-unit sang MEI bằng `tstamp = 1 + offset / (4 / beatType)`, dùng Rational. Vì vậy phách lớn thứ hai offset `3/2` có tstamp `4`; sáu pulse có tstamp `1..6`. Đây là đơn vị theo mẫu số meter, theo [MEI timestamp specification](https://music-encoding.org/guidelines/v4/content/introduction.html). Không chia đều chiều rộng measure, không gắn vào note gần nhất.

## Pickup và đổi nhịp

Expected trong `tests/musicxml-compound/expected/grids.json` viết thủ công. Offset dưới đây tính từ đầu fragment:

| Pickup | Pulse | Compound |
|---|---|---|
| Một eighth, phase 5/2 | `6@0` | Không có nhãn |
| Ba eighth, phase 3/2 | `4@0, 5@1/2, 6@1` | `2@0` |

Không tự chèn phách lớn ở ngoài fragment. Metadata pickup và diagnostic underfull giữ nguyên quy tắc trước đây.

Fixture `4/4 → 6/8 → 3/4 → 6/8` có 19 nhãn ở pulse mode, 11 ở compound mode khi nhịp đơn đếm integer beats. UI hiển thị hai nhóm lựa chọn độc lập khi bản có cả nhịp đơn và 6/8; tắt annotation áp dụng toàn bản. Mặc định 6/8 dùng pulse, không phụ thuộc beam.

## File tạo/sửa

- Tạo `src/musicxml-beats/meterGrouping.ts`.
- Sửa `beatEngine.ts`, `beatMap.ts`, `annotations.ts`; parser/rational không thay đổi.
- Sửa renderer `types.ts`, `temporalAnnotations.ts`, `verovioAdapter.ts`: setting mode, đổi đơn vị tstamp, spacing dựa trên sự hiện diện của subbeat.
- Sửa `src/pages/MusicXmlBeatsPage.tsx`; thêm script test trong `package.json`.
- Tạo `tests/musicxml-compound/`: 16 fixture, expected độc lập, Node tests, browser harness, artifact verifier và tsconfig.
- Tạo báo cáo, ảnh và artifacts trong `docs/musicxml-compound/`. Không sửa route, converter PDF/PNG hoặc dependency.

## Kết quả kiểm tra

| Nhóm | Cũ PASS | Mới PASS | FAIL |
|---|---:|---:|---:|
| Node | 138 (58 + 11 + 10 + 4 + 55) | 45 | 0 |
| Browser assertions | 168 (87 + 81) | 87 | 0 |
| Artifact độc lập | 24 (9 + 15) | 15 | 0 |
| Tổng | **330** | **147** | **0** |

**477 kiểm tra PASS; TypeScript và production build PASS.** Đây là tổng test Node, assertion browser và kiểm định artifact, không gọi tất cả là unit test. Cảnh báo bundle lớn/AlphaTab import hiện hữu không làm build thất bại.

Fixture bao gồm sustained dotted half, whole rest, hai dotted quarter, sáu eighth, syncopation, triplet, duplet, hai voice, hai cách beam, hai pickup, hai dòng lời/harmony, đổi nhịp và bản dài. Invariants khóa note/voice/divisions independence. Test engraving độc lập so sánh anchor với vị trí glyph của sáu eighth được Verovio khắc; việc đối chiếu này chỉ nằm trong test.

Browser kiểm overlap nhãn, lyrics, bounds, thứ tự nhãn, export. Artifact verifier đọc PDF/PNG tải thật: A4, PDF vector không raster cả trang, font/ToUnicode, nhãn và tọa độ PDF khớp SVG tới 0,001 point; đối chiếu PNG với Poppler và clipping. Không phát hiện overlap/clipping hoặc diagnostic trong bộ nghiệm thu. Khác biệt raster nhỏ do khử răng cưa không đổi musical placement.

`long-lyrics` có 60 ô: pulse **5 trang A4 / 360 nhãn**; compound **2 trang A4 / 120 nhãn**. Layout giữa hai mode được Verovio dàn lại theo mật độ chữ; trong cùng mode preview/SVG/PDF/PNG dùng cùng layout. Tiếng Việt và hợp âm giữ nguyên.

## Tái chạy và artifacts

Chạy các script `test:musicxml-beats`, `test:musicxml-renderer`, `test:musicxml-mvp`, `test:musicxml-export`, `test:musicxml-subdivision`, `test:musicxml-compound`, rồi `npm run build`.

Với Vite dev, mở `/tests/musicxml-compound/browser.html`, chạy và tải ZIP; giải nén vào `docs/musicxml-compound/output`, sau đó chạy `python3 tests/musicxml-compound/verify-artifacts.py` (cần pypdf, Pillow, numpy, Poppler). Chạy lại hai harness/verify-artifacts của export và subdivision để kiểm đủ 330 cũ. Harness không phải route production.

`output/` chứa `two-modes.png`, `pickup-one.png`, `lyrics-harmony.png`, `meter-change.png`, `ui-six-eight.png`; các thư mục `{fixture}-{mode}` chứa SVG/PDF/PNG và manifest. `node-tests.txt`, `browser-results.txt`, `artifact-tests.txt` lưu kết quả mới; `regression-summary.txt` ghi các kết quả cũ.

## Giới hạn

Chỉ thêm 6/8; chưa bật 9/8, 12/8, additive meter hoặc syllable `1 la li`. Giữ giới hạn multipart và melisma cần điều tra của các giai đoạn trước. Không sửa lyrics bằng layout hack. Diagnostic underfull/anchor/collision vẫn được giữ để không hiển thị số sai; kết quả sạch của fixture không bảo đảm mọi MusicXML đều resolve. Chưa chứng nhận mọi mobile WebView; xử lý/xuất trên thiết bị vẫn có giới hạn RAM với bản rất dài. Dừng tại Giai đoạn 6 để nghiệm thu.

> `output/` **không nằm trong repo** (`.gitignore`) — là artifacts tái tạo được. Lệnh tái tạo đầy đủ: [`docs/MUSICXML-BEATS.md`](../MUSICXML-BEATS.md).
