# Ghi công phần mềm bên thứ ba

Tệp này liệt kê **mã nguồn hoặc dữ liệu của người khác** được chép vào kho này,
kèm giấy phép của họ. Thư viện cài qua `npm` không nằm ở đây — giấy phép của
chúng đi cùng gói trong `node_modules`.

---

## Smoosic — quy ước phím tắt

**Dùng ở:** `src/nhipphach/editor/keymap.ts`

Cấu trúc bảng phím (mỗi dòng gồm phím + ba cờ phụ + tên hành động) và phần lớn
các phím **điều hướng** được lấy theo hai file của Smoosic:

- `src/ui/keyBindings/default/trackerKeys.ts`
- `src/ui/keyBindings/default/editorKeys.ts`

Nhịp Phách **không** phụ thuộc gói Smoosic: không có dòng `import` nào, không có
byte nào của Smoosic trong bundle. Chỉ mượn quy ước để thầy không phải học một
hệ phím mới. Một số phím cố ý lệch Smoosic để bám MuseScore 4 (`↑↓` = nửa cung,
`3–7` = hình nốt, `.` = chấm dôi) — xem chú thích trong `keymap.ts`.

> MIT License
>
> Copyright (c) 2021 Aaron David Newman
> Copyright (c) 2024 Smoosic
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

Nguồn: <https://github.com/Smoosic/Smoosic>

### Những thứ CỐ Ý KHÔNG lấy từ Smoosic

Ghi lại để lần sau không ai phải audit lại:

| Không lấy | Lý do |
|---|---|
| `SmoScore` (`src/smo/data`) | Nhịp Phách không có model bản nhạc; nguồn sự thật là chuỗi MusicXML |
| `smoToXml` round-trip | Viết lại cả file → phá vá-giữ-byte, phá danh tính `path`, phá lịch sử phiên bản, và **mất `<string>`/`<fret>`** của TAB |
| `tracker.ts` | Chọn nốt bằng giao hộp bao (hình học) — trái bất biến "không heuristic" |
| `undo.ts` | Hoàn tác bằng ảnh chụp JSON; ta dựng lại từ bản gốc + ngăn xếp lệnh |
| `render/` + `vexflow_smoosic` | Ta giữ Verovio, bất biến bố cục và lưới neo phách |

---

## MuseScore — chỉ tham khảo hành vi

Các phím `↑↓` (nửa cung), `Ctrl+↑↓` (quãng tám), `3–7` (hình nốt), `.` (chấm
dôi), `Ctrl+Z` / `Ctrl+Shift+Z` theo quy ước mặc định của MuseScore Studio 4.

**Không có dòng mã nguồn nào của MuseScore trong kho này.** MuseScore là GPL-3.0;
ta chỉ học cách bấm phím, không chép mã.
