# Giai đoạn 7 — Nhịp kép tổng quát: 9/8 và 12/8

Context: cùng một bản 6/8, 9/8 hay 12/8, thầy cần dạy theo từng móc đơn hoặc theo phách lớn chấm dôi. Không viết ba bộ logic riêng, không suy cách đếm từ note onset hay beam.

## 1. Model nhịp kép tổng quát

Một quy tắc sinh ra mọi nhịp kép đang bật: **n móc đơn gom thành từng nhóm 3**.

```
6/8  → groups [3,3]        9/8  → [3,3,3]        12/8 → [3,3,3,3]
unit = 1/2 (quarter-note unit, tức mỗi móc đơn)
```

`meterGrouping.ts` giữ registry cố ý `COMPOUND_BEATS = [6, 9, 12]`; nhóm được **tính** bằng `Array(beats / 3).fill(3)`, không viết tay ba mảng. Số phách lớn = `beats / 3` → 2 · 3 · 4. Registry là chỗ duy nhất được nhắc tên nhịp; 5/8, 7/8, additive và irregular grouping KHÔNG tự bật theo tính chia hết, beam hay note.

`SUPPORTED_SIMPLE` / `SUPPORTED_COMPOUND` export từ cùng file — diagnostic của `beatEngine.ts` và chữ trong UI đọc từ đó, không có bản sao nào ghi cứng danh sách nhịp.

## 2. Hai cách đếm

| Nhịp | Phách nhỏ (pulse) | Phách lớn (compound) — offset quarter-unit |
|---|---|---|
| 6/8 | 1…6 | `1@0, 2@3/2` |
| 9/8 | 1…9 | `1@0, 2@3/2, 3@3` |
| 12/8 | 1…12 | `1@0, 2@3/2, 3@3, 4@9/2` |

Pulse ở `k/2` với `k = 0…beats-1`. Mọi offset là Rational/BigInt, không có số thực.

## 3. Xác nhận 6/8 KHÔNG còn code path riêng

`annotations.ts`, `beatEngine.ts`, `beatMap.ts`, `renderer/temporalAnnotations.ts`, `renderer/verovioAdapter.ts` **không chứa** literal `6/8`/`9/8`/`12/8` hay nhánh `beats === 6`. Test `"6/8 has no dedicated code path"` đọc chính mã nguồn 5 file đó và assert điều này, nên nhánh riêng lọt vào sau này sẽ FAIL ngay.

Renderer chuyển offset sang MEI bằng `tstamp = 1 + offset / (4 / beatType)` — công thức chung theo mẫu số của **chính ô nhịp đó**, nên 12/8 pulse ra tstamp 1…12 và 12/8 compound ra 1, 4, 7, 10.

## 4. Không lấy nhãn theo note

Whole-measure rest, nốt ngân dài, syncopation, tuplet, hai bè đều sinh đủ lưới đếm. `sustained-12-8` là **một nốt tròn chấm dôi phủ trọn ô 12/8** — vẫn ra `1 2 3 4` ở phách lớn và `1…12` ở phách nhỏ.

## 5. Pickup

Offset tính từ đầu fragment; phase giữ nguyên theo ô đầy đủ.

| Pickup | Pulse | Compound |
|---|---|---|
| 9/8, một móc đơn cuối (phase 4) | `9@0` | không nhãn |
| 12/8, hai móc đơn cuối (phase 5) | `11@0, 12@1/2` | không nhãn |

Phách lớn chỉ hiện khi điểm bắt đầu của nó thật sự nằm trong fragment. Không tự tạo phách lớn mới ở đầu ô lấy đà.

## 6. Đổi nhịp

Fixture `4/4 → 6/8 → 9/8 → 3/4 → 12/8 → 6/8`: **40 nhãn** ở pulse, **18 nhãn** ở compound. Mỗi ô dùng meter của chính nó; không rò state giữa các ô (test so từng ô với lưới viết tay riêng). Nhóm lựa chọn nhịp đơn và nhóm nhịp kép độc lập nhau.

## 7. UI tự mô tả

Không còn chữ chỉ dành cho 6/8. Nhãn sinh từ meter thật trong bản nhạc:

- một loại nhịp kép → `Nhịp 9/8` · `Theo 9 phách nhỏ: 1 2 3 4 5 6 7 8 9` · `Theo 3 phách lớn: 1 2 3`
- 12/8 → `Theo 12 phách nhỏ: 1 … 12` · `Theo 4 phách lớn: 1 2 3 4`
- nhiều loại trong một bản → `Nhịp kép (6/8, 9/8, 12/8)` · `Theo phách nhỏ (mỗi móc đơn)` · `Theo phách lớn (mỗi nốt đen chấm dôi)`

## 8. Layout mật độ cao

12/8 pulse là trường hợp dày nhất (12 nhãn/ô). Harness kiểm trên **từng trang**: không cặp nhãn nào chồng nhau, không đè lyric, không đè harmony, mọi nhãn nằm trong biên trang. Spacing vẫn dựa trên sự hiện diện của subbeat, không có nhánh riêng cho 12/8. Không dịch nhãn khỏi thời điểm âm nhạc: khi hết chỗ thì ra diagnostic, và bộ fixture nghiệm thu không sinh diagnostic nào.

## 9. Stress test

`stress-12-8`: 100 ô 12/8. Pulse mode → **15 trang A4, 1.200 nhãn**, mỗi ô lặp đúng 12 offset `0, 1/2, … 11/2` không lệch (Rational so khớp tuyệt đối, không phải xấp xỉ), 1.200 id duy nhất, không mất nhãn, không clipping, không diagnostic. Compound mode → 400 nhãn.

## 10. File tạo/sửa

- Sửa `src/musicxml-beats/meterGrouping.ts` (quy tắc chung + registry + export danh sách hỗ trợ), `beatEngine.ts` (diagnostic đọc từ registry), `src/pages/MusicXmlBeatsPage.tsx` (UI tự mô tả).
- **Không sửa** `annotations.ts`, `parser.ts`, `rational.ts`, `beatMap.ts` và toàn bộ renderer — chúng đã tổng quát sẵn từ Giai đoạn 6.
- Tạo `tests/musicxml-generalized/`: 19 fixture, expected viết tay, test Node, harness trình duyệt, verifier artifact, tsconfig. Thêm script `test:musicxml-generalized`.
- Tạo báo cáo và artifacts trong `docs/musicxml-generalized/`.
- Sửa **một** test cũ: `tests/musicxml-compound/compound.test.ts` vòng lặp `[5, 7, 9, 12]` → `[5, 7]`. Tiền đề của nó ("9/8 và 12/8 không được hỗ trợ") chính là thứ Giai đoạn 7 lật; 5/8 và 7/8 vẫn được khoá như cũ, và phần dương của 9/8–12/8 nằm trong bộ mới.

## 11. Kết quả

| Nhóm | Cũ PASS | Mới PASS | FAIL |
|---|---:|---:|---:|
| Node | 183 (58+11+10+4+55+45) | 63 | 0 |
| Assertion trình duyệt | 255 (87+81+87) | 294 | 0 |
| Kiểm định artifact độc lập | 39 (9+15+15) | 31 | 0 |
| **Tổng** | **477** | **388** | **0** |

**865 kiểm tra PASS. TypeScript và production build PASS.** Toàn bộ 477 kiểm tra cũ được **chạy lại thật** sau khi tổng quát hoá (xem `output/regression-summary.txt`), không phải chép lại con số cũ.

Bộ mới đã được kiểm ngược bằng đột biến mã nguồn: bỏ 12/8 khỏi registry → 35 FAIL; nhóm theo 2 thay vì 3 → 47 FAIL; bỏ trừ pickup phase → 6 FAIL. Bộ test có "cắn", không PASS rỗng.

## 12. Ghi chú về thước đo artifact

12/8 pulse là giai đoạn đầu tiên có **nhãn hai chữ số**. Poppler khắc "11"/"12" thành hai vệt cách nhau ~5 px trong khi bản raster từ SVG giữ liền, nên bộ đếm vệt-đỏ viết ở Giai đoạn 4 đếm 14 chỗ trong khi chỉ có 12 nhãn. Đây là giới hạn của thước đo, không phải lỗi bản khắc: vị trí và nhãn trong PDF vẫn khớp SVG tới 0,001 point qua phép đối chiếu content-stream. `tests/musicxml-generalized/verify-artifacts.py` gộp các vệt của cùng một nhãn (transitive, dx ≤ 14 px, dy ≤ 10 px — khoảng cách giữa hai nhãn khác nhau là 21–54 px) trước khi so; **file dùng chung của Giai đoạn 4 không bị sửa**, các giai đoạn cũ giữ nguyên hành vi đã duyệt.

## 13. Chưa làm

5/8 · 7/8 · additive meter · irregular grouping · âm tiết kiểu "1 la li" · swing · metronome/playback · batch. Giữ nguyên các giới hạn cũ: multipart, melisma cần điều tra, chưa chứng nhận mọi WebView di động (bản rất dài vẫn có trần RAM khi xuất trên thiết bị).

## 14. Chạy lại

```
npm run test:musicxml-beats && npm run test:musicxml-renderer && npm run test:musicxml-mvp \
  && npm run test:musicxml-export && npm run test:musicxml-subdivision \
  && npm run test:musicxml-compound && npm run test:musicxml-generalized && npm run build
```

Với Vite dev: mở `/tests/musicxml-generalized/browser.html`, bấm chạy rồi tải ZIP, giải nén vào `docs/musicxml-generalized/output`, sau đó `python3 tests/musicxml-generalized/verify-artifacts.py` (cần pypdf, Pillow, numpy, Poppler). Thêm `?auto=1&sink=<url>` để tự chạy và POST thẳng ZIP về một cổng nhận file, khỏi bấm tay. Harness không phải route production.

`output/` chứa `shot-9-8-two-modes.png`, `shot-12-8-two-modes.png`, `shot-pickup.png`, `shot-mixed-meter.png`, `shot-stress-12-8.png`; các thư mục `{fixture}-{mode}` chứa SVG/PDF/PNG và manifest; `node-tests.txt`, `browser-results.txt`, `artifact-tests.txt`, `regression-summary.txt` lưu kết quả.

> `output/` **không nằm trong repo** (`.gitignore`) — là artifacts tái tạo được. Lệnh tái tạo đầy đủ: [`docs/MUSICXML-BEATS.md`](../MUSICXML-BEATS.md).
