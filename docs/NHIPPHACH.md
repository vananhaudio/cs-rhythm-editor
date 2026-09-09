# Công cụ Nhịp Phách — `class.vananhaudio.com/nhipphach`

Đọc bản nhạc MusicXML, gắn số phách chính xác theo nhịp, khắc lại bằng Verovio và xuất SVG/PDF/PNG khổ A4. Chỉ **teacher/admin** vào được (guard `app_users.role`, fail-closed).

Engine nhịp và cách chia nằm ở [`docs/MUSICXML-BEATS.md`](MUSICXML-BEATS.md) — tài liệu này chỉ nói phần công cụ: URL, preset và xử lý nhiều bài.

## URL

| | |
|---|---|
| Chính thức | `https://class.vananhaudio.com/nhipphach` |
| Đường cũ, còn chạy | `https://timming.vananhaudio.com/musicxml-beats` |

Hai domain là **cùng một site Netlify**, cùng repo, cùng bundle; phiên đăng nhập dùng chung qua cookie `Domain=.vananhaudio.com`. Route khai ở `NHIPPHACH_PATHS` trong `src/AppRouter.tsx`, phần tử đầu là URL chính thức; dấu `/` cuối được chuẩn hoá trước khi so nên `/nhipphach/` cũng được guard.

## Preset (Giai đoạn 9A)

Lưu **thiết lập trình bày**, không lưu bản nhạc, không đụng Beat Engine.

- 4 preset hệ thống: `Phách cơ bản` · `Chia móc đơn` · `Chia móc kép` · `Tài liệu học sinh`. Không xoá, không đổi tên, không đổi id — nhân bản được thành preset cá nhân.
- Preset cá nhân: lưu, đổi tên, nhân bản, xoá, đặt mặc định. Đổi tên **không** đổi id nên mặc định không mất.
- Mở trang có preset mặc định thì áp ngay; chưa có thì giữ nguyên cấu hình cũ của công cụ.
- **Preset CỐ Ý không mang cách chia 5/8, 7/8.** Cách chia là thuộc tính của bản nhạc; để vào preset là mở đường cho hệ thống tự đoán `2+3` hay `2+2+3`. Có test đọc mã nguồn chặn `byMeter`/`byMeasure` lọt vào file preset.
- `schemaVersion: 1`. Trường lạ bị bỏ qua an toàn, trường thiếu lấy mặc định an toàn; dữ liệu hỏng thì bỏ qua phần hỏng, giữ preset hệ thống, báo nhẹ, công cụ vẫn chạy. Lưu lỗi thì **ném lỗi**, không giả báo thành công.
- Lưu ở `localStorage` sau interface `PresetRepository` (`src/nhipphach/presetRepository.ts`). Không có bảng Supabase per-user nào phù hợp để tái dùng (`app_config` là key/value toàn cục, ghi `service_role`), nên không tạo bảng mới. Mọi phương thức async sẵn để bản server sau này không đổi chữ ký UI.

## Nhiều bài (Giai đoạn 9B)

`src/nhipphach/batch.ts` **chỉ điều phối**. Nó gọi lại đúng pipeline một-bài đã nghiệm thu — cùng `renderer.render()`, cùng `exportScorePDF/exportSVGPages/exportScorePNG`. Có test đọc chính mã nguồn cấm `parseMusicXML`, `musicXMLToBeatMap`, `createAnnotations`, `VerovioToolkit`, `jsPDF`, `svg2pdf`, `resolveGrouping` xuất hiện trong file batch. **Không có Beat Engine thứ hai.**

### Trạng thái từng bài

```
queued · processing · needs-grouping · done · error
```

Một bài lỗi **không** chặn các bài khác. Thứ tự kết quả luôn bằng thứ tự đầu vào dù chạy song song.

### Tên file xuất ra

Giữ basename nguồn; trùng thì đếm tăng dần theo thứ tự đầu vào — `bai.pdf`, `bai-2.pdf`, `bai-3.pdf`. Không UUID; chạy lại cùng danh sách ra cùng kết quả.

### Nhịp lẻ trong mẻ

`needs-grouping` chỉ bật khi **cách đếm đang chọn thật sự cần** cách chia:

| Cách đếm | 5/8 · 7/8 chưa khai cách chia |
|---|---|
| Phách nhỏ | xử lý thẳng — lưới đầy đủ và đúng (`1…5`, `1…7`) |
| Phách lớn | `needs-grouping`, chờ thầy chọn, **không xuất file sai** |

Trong cả hai đường **không có chỗ nào tự đoán**. Thầy chọn cách chia cho từng bài rồi bấm "Xử lý tất cả" lần nữa; cách chia chọn cho bài này không rò sang bài khác.

Tab "Nhiều bài" luôn hiện lựa chọn Phách nhỏ / Phách lớn, kể cả khi chưa mở bản nhạc nào — nếu không thì không có đường nào bật chế độ phách lớn cho cả mẻ.

### ZIP

Mỗi bài một file, **không** nối thành một PDF khổng lồ:

```
Tai-lieu-nhip-phach.zip
├── bai.pdf
├── bai-2.pdf
└── khac.pdf
```

Bài lỗi và bài đang chờ chọn cách chia không có mặt trong ZIP.

### Hiệu năng đã đo (PDF, trong trình duyệt)

| | Thời gian | ms/bài | Tác vụ chặn dài nhất |
|---|---:|---:|---:|
| 1 file · song song 2 | 695 ms | 695 | 189 ms |
| 10 file · song song 2 | 3.492 ms | 349 | 832 ms |
| 50 file · song song 1 | 17.753 ms | 355 | 1.209 ms |
| 50 file · song song 2 | **10.809 ms** | 216 | 1.385 ms |

Song song mặc định **2**, trần cứng **4**. **Chưa dùng Web Worker** — đo trước rồi mới quyết, và số liệu cho thấy chưa cần.

Giữa hai bài có một nhịp **nhường lượt cho trình duyệt vẽ lại** (`setTimeout(…, 0)`). Không có nó thì cả vòng lặp chạy trong microtask: React gộp mọi cập nhật, trình duyệt không vẽ lần nào, và thầy thấy bộ đếm đứng im ở `0 / 50` rồi nhảy phắt sang `50 / 50`. Có nó thì bộ đếm bước đều — đo thật trên trang: `0 → 2 → 4 → 6 → 8 → 10`.

## Preset theo tài khoản (Giai đoạn 10A)

Preset cá nhân đi theo tài khoản teacher/admin, không phụ thuộc máy hay trình duyệt.

```
nhipphach_presets(user_id, id)  ← khoá chính GHÉP
nhipphach_prefs(user_id)        ← preset mặc định, kèm nguồn system|custom
```

- **RLS:** `user_id = auth.uid() AND public.is_teacher()` cho cả bốn thao tác; `anon` không có policy nào. Chặn nằm ở **database**, không phải ở bộ lọc phía client.
- **Khoá chính ghép** vì id do client sinh: hai thầy có thể trùng id, và không truy vấn nào chạm được dòng của người khác chỉ bằng `id`. Mọi update/delete ghim `user_id` trước, rồi `id`, rồi `updated_at`.
- **Ghi chồng:** last-write-wins **có phát hiện stale** — sai `updated_at` thì trả `PRESET_CONFLICT`, không đè âm thầm. Không CRDT, không realtime.
- **Preset hệ thống** không bao giờ xuống DB; mặc định trỏ tới chúng được lưu ở `nhipphach_prefs` với `source = 'system'`.
- **Bộ nhớ đệm gắn với tài khoản:** `nhipphach:presets:<uid>`. Người khác đăng nhập trên cùng máy không đọc được đệm của người trước, kể cả khi mất mạng. Khoá cũ `nhipphach-presets-v1` của Giai đoạn 9A chỉ còn là **nguồn dữ liệu cũ**, được đúng một tài khoản nhận (`nhipphach:legacyClaimedBy`), không dùng làm fallback chung.
- **Mất mạng:** đọc lùi về đệm và nói rõ "Đang dùng bản lưu trên máy"; ghi thì **báo lỗi**, không giả báo thành công. Công cụ vẫn preview, xuất SVG/PDF và chạy batch bình thường.
- **`ToolRouteGate`:** quyền đã cấp gắn với `auth.uid()`. Lỗi mạng tạm thời giữ nguyên quyền tốt gần nhất (nếu không, một lần poll hỏng là mất cả bản nhạc đang mở và mẻ đang chạy); nhưng đăng xuất, đổi tài khoản, hay một câu trả lời **hợp lệ** là "không cho" đều thu hồi ngay.

### Giới hạn đã biết

> **Production Supabase schema is not fully reproducible from `supabase/migrations` yet.**
> `supabase start` chỉ dựng được một phần: nhiều bảng của production (`app_users`, các RPC như `my_learning_state`, `my_tool_route_access`) được tạo tay và không nằm trong repo. Muốn test local phải tự dựng các phụ thuộc đó. Chuẩn hoá toàn bộ DB thành migration đầy đủ là việc của một mốc khác.
>
> Vì lý do đó `supabase/config.toml` **không được commit** — giữ nó trong repo sẽ tạo cảm giác sai rằng `supabase start` dựng được schema production.

## Chạy test

```bash
npm run test:nhipphach-presets && npm run test:nhipphach-batch && npm run test:route-guard
```

Harness trình duyệt (cần `npm run dev`): `/tests/nhipphach-batch/browser.html?auto=1` — chạy 1/10/50 file với PDF thật, kiểm ZIP, A4 vector, trùng tên, file lỗi, nhịp lẻ và resume.

## Chưa làm

Web Worker · gộp PDF · lưu batch trên server · chia sẻ link · học viên truy cập · thư mục đệ quy · additive meter tuỳ ý.
