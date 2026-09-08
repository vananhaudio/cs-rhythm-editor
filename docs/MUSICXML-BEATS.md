# MusicXML Beats — mốc Giai đoạn 1–7

Công cụ giảng dạy "Đọc bản nhạc theo phách": nạp MusicXML → gắn số phách chính xác theo nhịp → khắc lại bằng Verovio → xuất SVG/PDF/PNG khổ A4. Route `/musicxml-beats`.

| GĐ | Nội dung | Test Node | Báo cáo |
|---|---|---|---|
| 1 | Beat Engine: Rational/BigInt, 2/4 · 3/4 · 4/4, pickup, diagnostic | `test:musicxml-beats` | — |
| 2 | Spike renderer Verovio + neo thời gian MEI | `test:musicxml-renderer` | [musicxml-renderer-spike](musicxml-renderer-spike/README.md) |
| 3 | MVP trang công cụ + xuất SVG | `test:musicxml-mvp` | [musicxml-beats-mvp](musicxml-beats-mvp/README.md) |
| 4 | In A4: PDF vector + PNG, font embedding, nhiều trang | `test:musicxml-export` | [musicxml-print](musicxml-print/README.md) |
| 5 | Cấp đếm nhỏ hơn: `1 & 2 &`, `1 e & a` | `test:musicxml-subdivision` | [musicxml-subdivision](musicxml-subdivision/README.md) |
| 6 | Nhịp kép 6/8, hai cách đếm | `test:musicxml-compound` | [musicxml-compound](musicxml-compound/README.md) |
| 7 | Tổng quát 9/8 · 12/8 cùng một code path | `test:musicxml-generalized` | [musicxml-generalized](musicxml-generalized/README.md) |

Tổng nghiệm thu: **865 kiểm tra PASS / 0 FAIL** — 246 test Node, 549 assertion trong trình duyệt, 70 kiểm định artifact độc lập.

## Artifacts KHÔNG nằm trong repo

`docs/musicxml-*/output/` bị `.gitignore` bỏ qua: ~200 MB SVG/PDF/PNG/ZIP nghiệm thu **tái tạo được hoàn toàn** từ mã và fixture trong repo. Không dùng Git LFS — dữ liệu tái tạo được không có lý do nằm trong history. Thứ được commit: mã nguồn, fixture MusicXML, expected JSON, mã test, harness/script tái tạo, và các README này.

Ngoại lệ duy nhất: ảnh chụp UI của Giai đoạn 3 (`musicxml-beats-mvp/output/ui-*.png`) do người chụp tay, không có script sinh — cách tái tạo là mở lại trang và chụp, xem README của giai đoạn đó.

## Tái tạo toàn bộ từ một bản clone sạch

### 1. Test Node — 246 PASS

```bash
npm ci && npm run test:musicxml-beats && npm run test:musicxml-renderer \
  && npm run test:musicxml-mvp && npm run test:musicxml-export \
  && npm run test:musicxml-subdivision && npm run test:musicxml-compound \
  && npm run test:musicxml-generalized
```

Kiểm kiểu và bản dựng production:

```bash
npx tsc -b && npm run build
```

### 2. Bản nhạc mẫu SVG/PDF/PNG — dùng chính công cụ

```bash
npm run dev
```

Mở `http://localhost:5173/musicxml-beats`, bấm **Dùng file mẫu** (hoặc nạp một fixture trong `tests/*/fixtures/`), chọn cách đếm rồi bấm **Xuất SVG** / **Xuất PDF** / **Xuất PNG**. Đây là đường xuất thật mà thầy dùng khi soạn bài.

### 3. Artifacts của Giai đoạn 2 — sinh bằng script

```bash
npm run spike:musicxml-renderer      # ghi docs/musicxml-renderer-spike/output/
```

### 4. Harness trình duyệt — 549 assertion + toàn bộ artifacts

Chạy `npm run dev`, mở lần lượt bốn trang dưới đây, bấm **Chạy**, đợi kết quả `TOTAL … PASS` rồi tải ZIP và giải nén vào đúng thư mục:

| Harness | Assertion | ZIP giải nén vào |
|---|---:|---|
| `/tests/musicxml-export/browser.html` | 87 | `docs/musicxml-print/output/` |
| `/tests/musicxml-subdivision/browser.html` | 81 | `docs/musicxml-subdivision/output/` |
| `/tests/musicxml-compound/browser.html` | 87 | `docs/musicxml-compound/output/` |
| `/tests/musicxml-generalized/browser.html` | 294 | `docs/musicxml-generalized/output/` |

Harness Giai đoạn 7 chạy được không cần bấm tay: thêm `?auto=1&sink=<url>` để tự chạy và POST thẳng ZIP về một cổng nhận file cục bộ.

Các harness này là trang test chạy trên Vite dev, **không phải route production**.

### 5. Kiểm định artifact độc lập — 70 kiểm tra

Cần `pypdf`, `Pillow`, `numpy` và Poppler (`pdftoppm`). Chạy sau khi đã giải nén ZIP ở bước 4:

```bash
python3 tests/musicxml-export/verify-artifacts.py        # 9
python3 tests/musicxml-subdivision/verify-artifacts.py   # 15
python3 tests/musicxml-compound/verify-artifacts.py      # 15
python3 tests/musicxml-generalized/verify-artifacts.py   # 31
```

Các script này đọc PDF/PNG thật đã tải xuống và đối chiếu độc lập với bộ xuất: khổ A4, PDF vector không raster cả trang, font có ToUnicode, nhãn và toạ độ PDF khớp SVG tới 0,001 point, đối chiếu PNG với Poppler, kiểm clipping.

### 6. Stress test — 100 ô 12/8, 1.200 nhãn

Nằm trong hai bước trên, không cần lệnh riêng:

- Phần logic: `npm run test:musicxml-generalized` (test `stress 12/8 pulses: 1.200 labels, no drift, no diagnostics`).
- Phần khắc và in: harness `/tests/musicxml-generalized/browser.html` sinh `stress-12-8-pulses/` (**15 trang A4**), rồi `python3 tests/musicxml-generalized/verify-artifacts.py` xác nhận đủ 1.200 nhãn qua đủ 15 trang, không mất nhãn, không clipping.

Fixture stress nằm sẵn trong repo tại `tests/musicxml-generalized/fixtures/stress-12-8.musicxml`.
