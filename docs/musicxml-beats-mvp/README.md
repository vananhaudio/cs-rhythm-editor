# Annotated Score MVP — Giai đoạn 3

Context: đưa MusicXML có sẵn vào công cụ, thêm số phách đúng thời gian để thầy
chuẩn bị bản nhạc giảng dạy; preview và xuất SVG dùng chung một nguồn.

## Mở công cụ

Route `/musicxml-beats`, lazy load trong AppRouter. Không cần đăng nhập cho công cụ
xử lý file cục bộ này; không thêm menu admin hoặc registry DB.

```sh
npm run dev
# http://127.0.0.1:5173/musicxml-beats
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
# http://127.0.0.1:4173/musicxml-beats
```

Chọn `.xml`/`.musicxml` (tối đa 5MB), hoặc Dùng file mẫu. Chỉnh checkbox số phách,
màu, cỡ chữ 5–14pt và khoảng cách 0–8. Xuất SVG hoặc tải beat-map JSON.
SVG nhiều trang được ghép dọc thành một file, mỗi trang giữ tỷ lệ và namespace ID
riêng để tránh trùng glyph references. Không phải batch processing.

## Module

- `src/musicxml-beats/annotations.ts`: annotation có `kind: beat | subbeat`;
  hiện chỉ sinh integer beats từ beat-map, bỏ các measure có diagnostic.
- `renderer/types.ts`: settings, trang SVG, kết quả và `ScoreExportSource`.
- `renderer/temporalAnnotations.ts`: map annotation vào MEI `dir@tstamp`;
  giữ nguyên nốt/lời/harmony. Pickup dùng offset trong phần thực của measure.
- `renderer/verovioAdapter.ts`: Verovio 6.3.0, cache import, render nhiều trang,
  kiểm tra anchor và layout; không gọi Strategy B.
- `renderer/svgExport.ts`: SVG tự chứa glyph, dọn metadata bounding boxes,
  xuất chính SVG preview; pipeline PDF/PNG tương lai nhận cùng `ScoreExportSource`.
- `renderer/spikeRenderer.ts` + `renderer/annotations.ts` + `svgMapping.ts`:
  chỉ phục vụ regression spike cũ; tách khỏi đường production.
- `src/pages/MusicXmlBeatsPage.tsx`: UI inline styles, xử lý file cục bộ,
  diagnostic, preview, thiết lập và tải file.
- `public/musicxml-beats/sample.musicxml`: fixture mẫu theo phạm vi được duyệt,
  không phải nội dung khóa học trong DB.

## Layout

Dùng `staffDef@dir.dist` để Verovio bố trí khoảng cách cùng lyrics. Không dùng `vo`
đẩy chữ sau bố trí: thử nghiệm cho thấy cách đó có thể đè vào lyrics.
Cho phép staff/system giãn theo settings. Không chỉnh tọa độ thời gian vì thẩm mỹ.

SVG content bounding boxes được dùng trước khi dọn file để kiểm tra số đè vào
lyrics/staff; nếu va chạm thì ẩn số và báo `ANNOTATION_LAYOUT_COLLISION`.
Nếu thiếu anchor hoặc timestamp không biểu diễn chính xác trong MEI thì báo
`TEMPORAL_ANCHOR_NOT_RESOLVED`, không lấy vị trí nốt gần nhất hoặc chia đều ô.

Preview dùng ảnh SVG, không chèn MusicXML nguồn vào HTML. Export và preview cùng
nội dung, không tái tính phách theo DOM hoặc pixel. Nút export khóa khi đang render
để tránh tải bản cũ dưới thiết lập mới.

## Diagnostic và giới hạn MVP

- Underfull chưa xác nhận pickup: `UNDERFULL_MEASURE_UNCLASSIFIED`, giữ ô nhạc và
  bỏ số riêng ô đó. Các ô đúng tiếp tục có annotation.
- MVP annotation cho một part, có thể nhiều staff và nhiều trang. Nhiều part vẫn
  render notation nhưng báo `MULTIPART_ANNOTATION_NOT_SUPPORTED`, không đoán mapping.
- 6/8, composite meters và meter riêng staff vẫn là giới hạn của engine Giai đoạn 1.
- Pickup có timestamp phân số không hữu hạn trong MEI (ví dụ 4/3) được báo unresolved,
  không làm tròn phân số thành số thập phân gần đúng.
- XML sai cú pháp hoặc thiếu duration/divisions làm parser dừng: UI báo lỗi, không
  xuất bản nhạc có số suy đoán. Đây không phải một MusicXML XSD validator đầy đủ.
- Xử lý WASM hiện trên main thread; file rất lớn có thể mất thời gian.
- Chưa có kiểm chứng mọi kỹ thuật notation của mọi trình xuất MusicXML.

## Melisma — known limitation / needs investigation

Fixture riêng: `tests/musicxml-mvp/fixtures/melisma.musicxml` có một âm tiết **La**
kéo qua ba nốt, với extend start/continue/stop, rồi âm tiết **la** ở ô tiếp theo.

Đã render và xem hình:
- [Baseline](output/melisma-baseline.svg): thấy “La” + đường kéo ngang, rồi “la”.
- [Annotated](output/melisma-annotated.svg): cùng lời và đường kéo; hàng số đỏ nằm
  phía trên lời, không đè nhau. 8 phách được resolve.
- MEI giữ `syl con="u"`; test kiểm tra nốt/lời/harmony giống nhau khi bật/tắt số.

Không sửa lyrics hoặc dùng hack kéo lời. Kết quả mới chỉ xác nhận fixture này.
Ca lời dài trên một nốt của spike Giai đoạn 2 và các extender qua dòng/trang vẫn là
**known limitation / needs investigation**, chưa cam kết mọi melisma đều đúng.

## Kiểm tra

```sh
npm run test:musicxml-beats       # 58 tests
npm run test:musicxml-renderer    # 11 tests — spike gốc
npm run test:musicxml-mvp         # 10 tests
npm run build                   # tsc -b + Vite
```

Test mới bao gồm toggle bảo toàn notation, SVG đúng labels/màu, pickup, bỏ ô lỗi,
settings, 90 ô nhiều trang/360 labels với unique IDs, melisma, hai staff, timestamp
không hữu hạn và validation settings. Có kiểm tra UI trên bản build qua trình duyệt.

## Bước sau

- Giai đoạn 4: PDF/PNG từ các trang SVG hiện có, font embedding, DPI, lề/A4/in nhiều trang.
- Subdivision modes ở chính sách annotation (`kind: subbeat`), không nhét tính phách
  vào renderer. Chưa sinh `&`, `e`, `a` trong MVP.
- Mở rộng regression melisma/notation và mapping nhiều part trước mở rộng cam kết.

## Bằng chứng nghiệm thu UI

- [Desktop](output/ui-desktop.png), [mobile 390px](output/ui-mobile.png).
- [Diagnostic ô thiếu nhịp](output/ui-diagnostic.png): ô đầu không có số, ô sau vẫn đủ 4 phách.
- [SVG tải từ nút Xuất SVG](output/sample-export.svg): đã đọc lại file tải xuống và xác nhận labels 1–4.
- Đã thử chọn file qua file picker thật trên bản build, checkbox tắt/bật và slider cỡ chữ.
- Mobile không tràn chiều ngang trang; bản nhạc trong vùng preview cuộn riêng để giữ khả năng đọc.

## Tái tạo

- Test: `npm run test:musicxml-mvp`.
- Trang công cụ: `npm run dev` rồi mở `http://localhost:5173/musicxml-beats`.
- Ảnh chụp UI trong `output/` là **chụp tay**, không có script sinh và không được commit
  (xem `.gitignore`). Cách tái tạo: mở trang ở trên, nạp fixture trong `tests/*/fixtures/`,
  chụp ở desktop và ở bề rộng 390px; ảnh diagnostic dùng một ô nhịp thiếu phách.
- Toàn cảnh mốc 1–7 và lệnh tái tạo đầy đủ: [`docs/MUSICXML-BEATS.md`](../MUSICXML-BEATS.md).
