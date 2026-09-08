# Giai đoạn 4 — A4 / SVG / PDF / PNG

Context: thầy cần bản nhạc có số phách để phát cho học viên hoặc in trực tiếp, giữ đúng thời gian âm nhạc từ MusicXML.

## Pipeline và quyết định

MusicXML → exact beat-map (không đổi engine) → MEI `dir/tstamp` (Strategy A) → Verovio **6.3.0-425dd7b** → các trang SVG A4 cố định → PDF / PNG.

- **PDF: jsPDF 4.2.1 + svg2pdf.js 2.8.1**, chạy trên thiết bị, chuyển đường nét SVG sang vector và nhúng font Unicode. Chọn vì dùng lại chính các trang SVG, không cần dịch vụ máy chủ/Chromium in, không rasterize trang. Đã kiểm chứng bằng parser PDF và Poppler, không chỉ bằng header `%PDF`. Tham khảo: https://github.com/yWorks/svg2pdf.js và https://github.com/parallax/jsPDF.
- **PNG: SVG Image → Canvas → PNG**, nền trắng, mỗi trang riêng. 1x = 96 dpi (794 × 1123 dọc); 2x = 192 dpi (1588 × 2246 dọc). Kích thước pixel làm tròn không liên quan đến rational timing.
- **Nhiều trang SVG/PNG:** ZIP (fflate), mỗi file là một trang. Hàm `exportScoreSVG` cũ còn giữ chế độ ghép dọc cho debug/regression; UI dùng `exportSVGPages`, không dùng bản ghép để in.
- A4 dọc 210 × 297 mm; ngang 297 × 210 mm. Verovio scale 50, lề trên/trái/phải 15 mm, dưới 18 mm, không tự cắt khổ theo nội dung. System/lyric/annotation spacing tham gia engraving trước phân trang.
- Khắc phục sai lệch viewport SVG lồng nhau trong svg2pdf bằng đặt kích thước viewport nội bộ tương đương 100% của bản gốc. Không đổi tọa độ nốt/phách.

## Font và SVG độc lập

Ký hiệu nhạc là các glyph path nằm sẵn trong SVG. Chữ dùng **Liberation Serif** (4 kiểu, giấy phép OFL kèm mã), tương thích metric Times. Font được đóng gói base64 trong SVG, không cần CSS React, CDN, font cài trên máy hay tải mạng lúc mở artifact. PDF nhúng font TrueType cùng ToUnicode, tiếng Việt vẫn chọn/copy được. Không đổi nốt để xử lý font.

Font ngoài do MusicXML chỉ định được quy về font serif đã đóng gói cho chữ. Đây là chuẩn hoá kiểu chữ có chủ đích, không phải giữ mọi typeface tuỳ biến của nguồn. Bộ fixture đã kiểm tra tiếng Việt; chưa tuyên bố hỗ trợ đầy đủ CJK/Arabic và mọi ký tự Unicode. Không sửa melisma bằng hack; giới hạn `<extend/>` tiếp tục như README Giai đoạn 3.

SVG được tạo từ output Verovio có lọc script/event/external href, bỏ bounding box debug. Preview dùng chính artifact SVG trong `<img>`. Annotation không resolve, va lyrics/staff, hoặc vượt mép trang sẽ bị ẩn riêng và có diagnostic (`TEMPORAL_ANCHOR_NOT_RESOLVED`, `ANNOTATION_LAYOUT_COLLISION`, `ANNOTATION_PAGE_CLIPPING`).

## File tạo/sửa trong giai đoạn này

- Tạo `src/musicxml-beats/renderer/printExport.ts`: font readiness, PDF vector, PNG/ZIP, SVG từng trang, dimensions/download.
- Tạo `renderer/fontData.ts`, `renderer/fonts-LICENSE.txt`: font offline và giấy phép.
- Sửa `renderer/types.ts`: orientation; `verovioAdapter.ts`: A4/margins/page clipping; `svgExport.ts`: font nhúng và khổ vật lý.
- Sửa `src/pages/MusicXmlBeatsPage.tsx`: A4 dọc/ngang, SVG/PDF/PNG, PNG 1x/2x, trạng thái xuất/lỗi.
- Sửa `package.json`, `package-lock.json`: dependency và lệnh export tests.
- Tạo `tests/musicxml-export/`: 9 fixture, 4 test Node, harness browser, kiểm định artifact Python.
- Tạo thư mục tài liệu/output này. Không sửa 79 test cũ, parser/beat engine, route hay database trong Giai đoạn 4.

## Kết quả kiểm định

- **58 Beat Engine + 11 Renderer + 10 MVP = 79/79 PASS**, không sửa các test cũ.
- **4/4 export Node tests PASS**: portrait/landscape, dimensions PNG, font/Unicode/khổ SVG, ZIP SVG nhiều trang.
- **87/87 kiểm tra browser PASS** trên 9 fixture: render, font nhúng, labels, PNG dimensions/red pixels, page bounds, PDF tạo thành công.
- **9/9 kiểm định artifact PASS**: PDF A4, đúng số trang, zero raster images trong PDF, font nhúng/ToUnicode, tiếng Việt/harmony, từng nhãn và tọa độ phách PDF khớp SVG tới 0,001 point; đối chiếu PNG/Poppler và clipping toàn nội dung.
- Tổng **179 kiểm tra PASS, 0 FAIL** (83 test Node + 87 assertion browser + 9 test artifact). `npx tsc -b` và `npm run build` PASS. Build còn cảnh báo chunk lớn/AlphaTab import đã có trong dự án.
- `long-a4`: **100 ô, 400 phách, 3 trang A4**, 0 diagnostic.
- `page-bottom`: **60 ô, 240 phách, 2 trang A4**, 0 diagnostic; đã xem ảnh render cả hai trang. Stress thêm size 14 / distance 8 ở cả hai hướng: 240 phách, 3 trang, 0 diagnostic.

Ảnh raster có khác biệt nhỏ do khử răng cưa và minimum stroke của Poppler; không có thay đổi temporal placement. Test hình dùng dung sai pixel riêng, còn vị trí PDF kiểm tra trực tiếp text transformation matrix, không suy ra từ ảnh.

## Chạy lại

```sh
npm run test:musicxml-beats
npm run test:musicxml-renderer
npm run test:musicxml-mvp
npm run test:musicxml-export
npm run build
```

Chạy Vite (`npm run dev`), mở `/tests/musicxml-export/browser.html`, bấm “Chạy kiểm tra và tải artifacts”. Giải nén `musicxml-print-acceptance.zip` vào thư mục `docs/musicxml-print/output`, sau đó:

```sh
python3 tests/musicxml-export/verify-artifacts.py
```

Python cần `pypdf`, `Pillow`, `numpy`; PATH cần `pdftoppm`. Harness browser là công cụ test của Vite dev, không route production. Kiểm định Python đọc các file tải thực sự từ trình duyệt, không mock converter.

## Artifacts và giới hạn

`output/ui-sample.svg`, `output/ui-sample.pdf`, `output/ui-sample.png`: tải thực tế bằng ba nút của UI production; PNG 2x. Đã kiểm tra nút PNG nhiều trang tải ZIP gồm `trang-001.png` và `trang-002.png`.

`output/lyrics-harmony/`: mẫu đầy đủ SVG/PDF/PNG và PNG 2x. `output/page-bottom/`: bản hai trang. `output/long-a4/`: bản ba trang. `output/preview-a4.png`: UI. `browser-results.txt` và `artifact-tests.txt`: log kiểm định.

Chưa chứng nhận trên mọi trình duyệt/mobile WebView; đã nghiệm thu bằng trình duyệt desktop và Poppler độc lập. Font đầy đủ làm SVG khoảng 2 MB/trang; ZIP nén giảm kích thước. File rất dài có thể tốn RAM vì xuất trên thiết bị. Chưa có preset typography, chỉnh lề tự do hoặc PDF/A. Phạm vi meter và multipart giữ nguyên Giai đoạn 3. Không thêm subdivision/6/8/MXL/batch/audio. Dừng để thầy nghiệm thu A4 trước giai đoạn tiếp theo.

> `output/` **không nằm trong repo** (`.gitignore`) — là artifacts tái tạo được. Lệnh tái tạo đầy đủ: [`docs/MUSICXML-BEATS.md`](../MUSICXML-BEATS.md).
