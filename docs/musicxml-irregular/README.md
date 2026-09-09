# Giai đoạn 8 — Nhịp lẻ: 5/8 và 7/8

Context: 5 móc đơn có thể là **2+3** hoặc **3+2** — hai bản nhạc khác nhau, cùng số nốt. Vì vậy đây là bước khác bản chất với 6/8–9/8–12/8: cách chia **không suy được từ tử số**, phải do nguồn khai báo hoặc thầy chọn.

## 1. Mô hình grouping

Vẫn đúng một cấu trúc chung, không thêm khái niệm mới cho renderer:

```
{ unit: Rational, groups: number[] }      unit = 1/2 nốt đen (một móc đơn)
```

| Nhịp | Cách chia | Mốc phách lớn (đơn vị nốt đen) |
|---|---|---|
| 5/8 | 2+3 | `0`, `1` |
| 5/8 | 3+2 | `0`, `3/2` |
| 7/8 | 2+2+3 | `0`, `1`, `2` |
| 7/8 | 2+3+2 | `0`, `1`, `5/2` |
| 7/8 | 3+2+2 | `0`, `3/2`, `5/2` |

Mốc sinh bằng **cộng dồn theo nhóm** (`groupStartsOf`), toàn bộ bằng Rational/BigInt, không float, không chia đều bề rộng ô, không bám nốt.

`meterGrouping.ts` giữ registry cố ý: 5 → `[[2,3],[3,2]]`, 7 → `[[2,2,3],[2,3,2],[3,2,2]]`. Phần kiểm bất biến (`isValidPartition`) đã tổng quát cho additive meter tuỳ ý — mọi nhóm nguyên dương, tổng đúng bằng số phách — nhưng registry giữ phạm vi đúng Giai đoạn 8.

## 2. Lấy cách chia từ MusicXML

`<time><beats>2+3</beats><beat-type>8</beat-type></time>` — dạng additive chuẩn của MusicXML. Parser đọc **nguyên văn** thành `Meter.additive = [2,3]`, không diễn giải thêm. Việc cách chia đó có được hỗ trợ hay không do `meterGrouping` quyết, nên nhịp cộng ngoài phạm vi (ví dụ `2+2` với mẫu số 4) vẫn ra `UNSUPPORTED_METER` y như trước.

## 3. Thứ tự ưu tiên và người dùng đè

```
1. người dùng đè riêng cho một ô nhịp   → source "user"
2. cách chia ghi rõ trong MusicXML       → source "musicxml"
3. mặc định người dùng chọn theo mã nhịp → source "user"
4. không có gì                            → source "unresolved"
```

Không có bước thứ năm. **Không suy từ beam, nốt, dấu nhấn, dấu lặng, hợp âm hay số lượng nốt.** Beat-map ghi thẳng nguồn để soi được:

```json
{ "groups": [2,3], "groupingSource": "musicxml" }
{ "groups": [3,2], "groupingSource": "user" }
{ "groups": null,  "groupingSource": "unresolved" }
```

Cách chia người dùng đưa vào mà không hợp lệ thì **bị bỏ và báo** (`INVALID_GROUPING`), không im lặng dùng bừa.

Mô hình dữ liệu là **theo từng ô nhịp**: `GroupingSelection = { byMeter, byMeasure }`. `byMeasure` khoá theo `measureId` nên một bài có thể mỗi ô một cách chia. UI hiện dùng mặc định theo mã nhịp, nhưng không có biến toàn cục nào phải viết lại sau này.

## 4. Khi chưa chọn cách chia

Ô **không** bị coi là lỗi:

- `diagnostics` rỗng — bản nhạc vẫn khắc bình thường;
- **phách nhỏ chạy đầy đủ** (`1 2 3 4 5`);
- **phách lớn không hiện nhãn nào** — không đoán bừa;
- `notices` (cảnh báo KHÔNG chặn, tách hẳn khỏi `diagnostics`) mang mã `IRREGULAR_GROUPING_REQUIRED` với thông điệp *“5/8 requires an explicit grouping such as 2+3 or 3+2 for large-beat counting.”*

Tách `notices` khỏi `diagnostics` là quyết định có chủ ý: `diagnostics` chặn cả ô (annotation bỏ qua ô đó), mà ở đây phách nhỏ phải vẫn dùng được.

## 5. Beam không quyết được gì

Mạnh hơn một phép thử hành vi: **mô hình chuẩn hoá không có trường beam nào** — `TimedEvent` không mang beam, và `model.ts`, `meterGrouping.ts`, `beatEngine.ts`, `annotations.ts` không nhắc tới beam trong mã (test kiểm chính mã nguồn sau khi bỏ chú thích). Không tồn tại đường nào để beam ảnh hưởng cách chia.

Fixture `five-beam-looks-2-3` có beam gom đúng kiểu 2+3 nhưng nguồn không khai báo → engine vẫn báo `IRREGULAR_GROUPING_REQUIRED`.

## 6. Pickup — bằng chứng cách chia đổi vị trí thật

5/8, ô lấy đà **2 móc đơn cuối** (phase `3/2`):

| Cách chia | Phách nhỏ | Phách lớn trong ô lấy đà |
|---|---|---|
| 2+3 | `4`, `5` | **không có** — `3/2` không phải mốc nhóm |
| 3+2 | `4`, `5` | **`2` tại offset 0** — `3/2` đúng là mốc nhóm |

Cùng số nốt, cùng ô lấy đà; chỉ cách chia khác nhau mà kết quả khác nhau. Ô lấy đà 1 móc đơn (phase `2`) cho `5` ở phách nhỏ và không có phách lớn ở cả hai cách chia.

7/8, ô lấy đà **4 móc đơn** (phase `3/2`) — chọn cố ý để phân biệt **cả ba**:

| Cách chia | Phách lớn trong ô lấy đà |
|---|---|
| 2+2+3 | `3` tại `1/2` |
| 2+3+2 | `3` tại `1` |
| 3+2+2 | `2` tại `0`, `3` tại `1` |

Expected viết thủ công từ đặc tả bằng số hữu tỉ, không lấy từ output.

## 7. Đổi cách chia và đổi nhịp

- `grouping-change`: hai ô 7/8 liền nhau, ô 1 là `2+2+3`, ô 2 là `3+2+2`. Mỗi ô giữ cách chia của chính nó, không rò state.
- `mixed-meter`: `4/4 → 5/8(2+3) → 6/8 → 7/8(2+2+3) → 3/4 → 5/8(3+2) → 12/8 → 7/8(3+2+2)` — **49 nhãn** phách nhỏ, **23 nhãn** phách lớn.

## 8. Renderer

Không có logic nhịp lẻ trong `temporalAnnotations.ts`, `verovioAdapter.ts`, `svgExport.ts` — test đọc chính mã nguồn ba file và cấm cả tên hàm giải cách chia lẫn literal tên nhịp. Cách chia được giải **trước** renderer; renderer chỉ nhận `label`, `offset`, `measure`, `staff`, `kind`.

Cách chia nằm trong khoá cache của renderer, nên đổi cách chia là bản khắc đổi theo, không giữ bản cũ.

## 9. Stress

`stress-seven`: 100 ô 7/8 luân phiên `2+2+3 → 2+3+2 → 3+2+2`. Phách nhỏ **700 nhãn**, phách lớn **300 nhãn / 5 trang A4**. Từng ô đúng cách chia của chính nó, không carry từ ô trước, offset khớp tuyệt đối bằng Rational, id duy nhất, không mất nhãn, không clipping, không overlap, không diagnostic.

## 10. Kết quả

| Nhóm | Cũ PASS | Mới PASS | FAIL |
|---|---:|---:|---:|
| Node | 256 (246 MusicXML + 10 route-guard) | 65 | 0 |
| Assertion trình duyệt | 549 | 460 | 0 |
| Kiểm định artifact độc lập | 70 | 52 | 0 |
| **Tổng** | **875** | **577** | **0** |

**1.452 kiểm tra PASS. `tsc -b` và `npm run build` PASS.**

### Kiểm ngược bằng đột biến

| Đột biến | FAIL |
|---|---:|
| đổi 2+3 thành 3+2 (đảo nhóm) | 23 |
| bỏ pickup phase | 19 |
| tự đoán cách chia khi nguồn không khai báo | 9 |
| mang cách chia ô trước sang ô sau | 2 |
| bỏ một mốc nhóm | 26 |

Riêng “cho beam quyết định grouping” không đột biến được: engine không có dữ liệu beam để mà dùng — đã khoá bằng test đọc mã nguồn.

## 11. Test cũ phải chỉnh — hai chỗ, đều là đổi tiền đề

1. `tests/musicxml-compound/compound.test.ts`: vòng `[5, 7]` → `[10, 11]`.
2. `tests/musicxml-generalized/generalized.test.ts`: vòng `[5, 7, 10, 15]` → `[10, 11, 15]`.

Cả hai khẳng định “nhịp này không được hỗ trợ” với chính 5/8 và 7/8 — đúng thứ Giai đoạn 8 lật, giống hệt tình huống 9/8–12/8 ở Giai đoạn 7. Ý định của test (**chia hết không tự bật gì cả**) được giữ nguyên bằng cách chuyển sang các nhịp vẫn cố ý nằm ngoài phạm vi. Không nới lỏng, không xoá assertion.

Ngoài ra một comment mới của tôi vô tình chứa chuỗi `6/8` làm test “không có code path riêng” đỏ; tôi sửa **comment**, không sửa test.

## 12. Giới hạn đã biết (KNOWN LIMITATION) — Verovio + additive meter & whole-measure rest

Ô **chỉ chứa lặng-cả-ô** (`<rest measure="yes">`) **và** nhịp ghi dạng cộng (`@meter.count="2+3"`): Verovio không giải được `tstamp`, mọi nhãn dồn về một chỗ. Chốt an toàn sẵn có phát hiện và **ẩn nhãn kèm báo lỗi**, thay vì đặt nhãn sai thời điểm — đúng nguyên tắc “thà báo còn hơn đặt sai”.

Đây là giới hạn của bộ khắc, không phải của beat-map: lưới vẫn đúng, và đã kiểm bằng test. Không phải chuyện 5/8: `6/8` viết `3+3` hỏng y hệt, còn `5/8` viết `5` thì chạy tốt. Cách dùng được ngay: để nhịp ở dạng thường và chọn cách chia trong app (fixture `five-plain-whole-rest`, `seven-plain-whole-rest` chứng minh, có trong bộ artifact).

**Quyết định đã chốt (2026-09-09): giữ nguyên fail-safe, không làm gì thêm.** Cụ thể:

- **KHÔNG** tự đổi số chỉ nhịp in ra từ `2+3/8` thành `5/8`;
- **KHÔNG** sửa MusicXML nguồn;
- khi additive meter + lặng-cả-ô làm temporal anchor không đáng tin, giữ đúng hành vi hiện tại: **không hiện nhãn sai, và báo diagnostic**;
- **KHÔNG** mở workaround bằng text overlay hay số chỉ nhịp giả.

Đây là giới hạn được ghi nhận và chấp nhận, không phải việc còn dở. Hành vi này đã được khoá bằng test Node (`GIỚI HẠN VEROVIO: ô chỉ có lặng-cả-ô + nhịp ghi dạng cộng thì ẩn nhãn, có báo`) nên nếu sau này nó âm thầm đổi thì test sẽ đỏ.

## 13. Chưa làm

5/4 · 7/4 · 8/8 additive · additive tuỳ ý như 3+2+3 · 10/8 · 11/8 · swing · triplet syllables · playback · metronome · batch · database. Giữ nguyên các giới hạn cũ: multipart, melisma, chưa chứng nhận mọi WebView di động.

## 14. File tạo/sửa

**Sửa:** `src/musicxml-beats/model.ts` (`Meter.additive`), `parser.ts` (đọc `<beats>2+3</beats>`), `meterGrouping.ts` (registry nhịp lẻ, `isValidPartition`, `resolveGrouping`, `groupStartsOf`, `pulseMeter`), `beatEngine.ts` (giải cách chia, `groupingSource`/`groups`/`notices` — chỉ thêm trường ở nhịp lẻ nên beat-map của các giai đoạn cũ giữ nguyên từng byte), `beatMap.ts` + `annotations.ts` (một đường chung cho nhịp kép và nhịp lẻ), `renderer/types.ts` + `renderer/verovioAdapter.ts` (chuyển tiếp lựa chọn, khoá cache, trả `notices`), `src/pages/MusicXmlBeatsPage.tsx` (UI chọn cách chia).

**Tạo:** `tests/musicxml-irregular/` — 32 fixture, expected viết tay, 65 test Node, harness trình duyệt, verifier artifact, tsconfig; script `test:musicxml-irregular`; báo cáo và artifacts trong `docs/musicxml-irregular/`.

**Không sửa:** `rational.ts`, `renderer/temporalAnnotations.ts`, `renderer/svgExport.ts`, `renderer/printExport.ts`, guard production, `.gitignore`.

## 15. Tái tạo

```bash
npm run test:musicxml-irregular && npx tsc -b && npm run build
```

Harness: `npm run dev` rồi mở `/tests/musicxml-irregular/browser.html` (thêm `?auto=1&sink=<url>` để tự chạy), giải nén ZIP vào `docs/musicxml-irregular/output`, sau đó `python3 tests/musicxml-irregular/verify-artifacts.py`. Xem thêm [`docs/MUSICXML-BEATS.md`](../MUSICXML-BEATS.md).

> `output/` **không nằm trong repo** (`.gitignore`) — là artifacts tái tạo được.
