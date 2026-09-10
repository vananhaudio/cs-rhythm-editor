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

## Lịch sử xử lý gần đây (Giai đoạn 10B.1)

Mỗi lần **xuất thật** một bài, hoặc **chạy xong** một mẻ, công cụ ghi lại một dòng lịch sử. Không ghi lúc mở file, xem trước hay đổi màu.

```
nhipphach_jobs(user_id, id)                 ← khoá chính GHÉP
nhipphach_job_items(user_id, job_id, item_id)
  └── FK (user_id, job_id) ON DELETE CASCADE
```

### Chỉ metadata

Trong hai bảng này **không có** MusicXML, lời bài hát, SVG, byte PDF/PNG/ZIP, base64 hay Blob URL. Chỉ có: tên file nguồn, tên file ra, trạng thái, mã lỗi, **đếm** mã nhịp (`{"7/8": 12}`), số trang, số nhãn, thời lượng.

`error_message` bị gột trước khi lưu và DB tự chặn ở **500 ký tự** (`check (length(...) <= 500)`). Gột không chỉ bóc thẻ mà **cắt từ dấu `<` đầu tiên trở đi**: chữ nằm *giữa* hai thẻ cũng là nội dung bản nhạc — tên nốt, lời hát. Lỗi parser thật (`unclosed xml tag(s): <lyric><text>Quê hương…`) vì thế chỉ còn phần mã lỗi.

### Ảnh chụp thiết lập, không phải con trỏ tới preset

`settings_snapshot` là bản chụp **tại thời điểm đó**: màu, cỡ chữ, khoảng cách, mức đếm, hướng giấy, định dạng xuất. Preset chỉ được lưu **tên** (`preset_name`) như chữ chết — xoá preset đi thì "Dùng lại thiết lập" vẫn chạy đúng.

Ảnh chụp **cố ý không mang `grouping`**. Cách chia nhịp lẻ của bài cũ nằm ở `grouping_snapshot` của từng item — một sự kiện quá khứ để đọc lại, **không bao giờ** thành mặc định cho bản nhạc mới. Mở một bài 7/8 chưa khai cách chia sau khi "Dùng lại thiết lập" của mẻ từng dùng `2+2+3`, công cụ vẫn hỏi thầy chọn. Đó chính là điều Giai đoạn 8 cấm tự đoán.

### Ghi trong MỘT giao dịch

Ghi job rồi ghi item bằng **hai** request riêng có một khe hở thật: hỏng ở giữa để lại một job **rỗng** — thầy thấy "6 bài" mà mở ra không có bài nào. Cả hai đi qua một function Postgres:

```
nhipphach_create_history(job_json, items_json)
  → INSERT nhipphach_jobs
  → bulk INSERT nhipphach_job_items
  → cùng một giao dịch
```

**`SECURITY INVOKER`**, cố ý — RLS của chính người gọi vẫn có hiệu lực. Không dùng `SECURITY DEFINER`: làm thế là tự tay mở một cửa sau đi vòng qua policy. `anon` bị `revoke execute`, `authenticated` được `grant`.

`user_id` lấy từ **`auth.uid()`**, không bao giờ từ payload. Client gửi kèm `user_id` của người khác thì trường đó đơn giản là không được đọc tới — dòng vẫn nằm dưới tài khoản đang đăng nhập.

Đã thử thật: item thứ 4 mang `error_message` vượt 500 ký tự, và một lần khác item thứ 5 mang `status` ngoài danh sách → RPC lỗi, **`jobs = 0`, `items = 0`**. Chạy lại payload hợp lệ ngay sau đó → `jobs = 1`, `items = 6`, đúng thứ tự `item-1…item-6`.

### Một cú bấm, một lần chạy

`disabled` của React chỉ có hiệu lực **sau** lần vẽ kế tiếp. Ba cú bấm dính nhau nằm gọn trong một nhịp nên cả ba cùng lọt vào hàm. Đo trên trang thật, bỏ chốt đi: **3 lần tải file và 3 job lịch sử** cho một lần thầy định bấm. Có chốt đồng bộ (`src/nhipphach/motLuot.ts`, `giuLuot`/`traLuot` trong `finally`): **1 lần tải, 1 job**. Mẻ nhiều bài cũng vậy — bấm ba lần "Xử lý tất cả" chỉ ra một job 3 item.

### Lịch sử là việc phụ

Hỏng lịch sử **không bao giờ** được biến thành hỏng xuất file. Ghi nằm ngoài khối bảo vệ lỗi xuất, gọi kiểu bắn-và-quên, và có `try/catch` riêng chỉ chạm `historyNote`. Đã thử thật bằng cách chặn policy INSERT trên `nhipphach_jobs`: PDF vẫn tải về, ZIP vẫn đóng gói, không có báo lỗi xuất — chỉ hiện một dòng *"Đã xuất file, nhưng chưa lưu được lịch sử."*

### Số liệu phải về đúng bài

Ở song song 2, thứ tự **hoàn thành** khác thứ tự đầu vào. Vì thế `BatchProcessor.render` nhận thêm `itemId` và `collectItemMeta()` khoá số liệu theo id đó. Đếm tay theo lượt gọi là gắn số liệu của bài này sang bài khác — đã có test chạy 6 bài với bài chẵn cố tình chậm hơn để khoá lại điều này.

### RLS

`user_id = auth.uid() AND public.is_teacher()` cho cả bốn thao tác, trên **cả hai** bảng; `anon` không có policy nào. Migration xoá **mọi** policy đang có trên hai bảng trước khi tạo policy hẹp — nếu không, policy rộng cũ do `rls_setup.sql` để lại sẽ OR với policy mới và mở toang dữ liệu. Hai bảng nằm trong mảng `self_managed` của `db/rls_setup.sql`; bỏ chúng ra rồi chạy lại script là mất sạch policy hẹp (đã thử: còn đúng một `rls_authenticated_all`).

### Hiệu năng (Supabase local, đã làm nóng)

| Việc | Trung vị (2 lần đo) |
|---|---:|
| Ghi lịch sử mẻ 10 bài | 8 – 19 ms |
| Ghi lịch sử mẻ 50 bài | 7 – 32 ms |
| Đọc "Gần đây" 5 job | 3 – 14 ms |
| Mở chi tiết một job 50 item | 6 – 55 ms |

Khoảng rộng vì máy đang bận khác nhau giữa hai lần chạy; con số lớn hơn là mốc an toàn để đọc. Đáng chú ý: mẻ 50 bài **không** tốn gấp 5 lần mẻ 10 bài — vì toàn bộ item đi trong một insert gộp.

Đo lại: `node --experimental-strip-types tests/nhipphach-history/perf.ts`.

Một job = **một** insert cho job + **một** insert gộp cho toàn bộ item, không N request. So với mẻ 50 file mất 10.809 ms, lịch sử thêm khoảng **0,3 %**.

## Chạy test

```bash
npm run test:nhipphach-presets && npm run test:nhipphach-batch && npm run test:route-guard
```

`test:nhipphach-cloud` và `test:nhipphach-history` cần Supabase local đang chạy và ba tài khoản `teacher-a@` / `teacher-b@` / `student-c@test.local`.

Harness trình duyệt (cần `npm run dev`): `/tests/nhipphach-batch/browser.html?auto=1` — chạy 1/10/50 file với PDF thật, kiểm ZIP, A4 vector, trùng tên, file lỗi, nhịp lẻ và resume.

## Chưa làm

Web Worker · gộp PDF · lưu batch trên server · phân trang lịch sử quá 50 job · "Xoá toàn bộ lịch sử" trên giao diện · chia sẻ link · học viên truy cập · thư mục đệ quy · additive meter tuỳ ý.
