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

## Bất biến bố cục (Giai đoạn 13)

Cùng một MusicXML, bốn mức đếm — **Không hiện · Phách · Chia đôi · Chia tư** — cho **đúng một bản khắc**. Số trang, số hệ, hoành độ từng nốt, từng vạch nhịp, bề rộng từng ô và cả tung độ các dòng kẻ đều bằng nhau tuyệt đối. Chỉ số lượng nhãn được phép khác.

### Cái đã sai, đo trên file guitar thật (Jingle Bells, khuông nhạc + TAB)

| Mức đếm | Trang — trước | Trang — sau |
|---|---:|---:|
| Không hiện | 1 | 1 |
| Phách | 2 | 1 |
| Chia đôi | **6** | 1 |
| Chia tư | **6** | 1 |

Bề rộng ô nhịp trung bình nhảy từ 3.101 lên **16.221** đơn vị (5,2 lần), số hệ từ 3 lên 16.

Phép đo tách bạch hai nghi phạm: bỏ hết `<dir>` mà giữ nguyên option thì vẫn 6 trang; giữ `<dir>` mà dùng chung một bộ option thì về 2 trang. **Thủ phạm chính là ba tham số engraving bật theo mức đếm** trong `verovioAdapter.ts` (`spacingLinear`, `spacingNonLinear`, `measureMinWidth`) — di sản Giai đoạn 5, dùng để lấy chỗ cho con chữ bằng cách nới rộng chính bản nhạc. Phần còn lại do bản thân `<dir>` có nội dung: chữ có bề rộng, và Verovio nới ô ra để tránh đè.

### Kiến trúc ba lượt

```
Lượt 1 — khắc nhạc nền     : MEI + LƯỚI NEO RỖNG, option KHÔNG phụ thuộc mức đếm
                             anchorLattice.ts  →  verovioAdapter.ts
Lượt 2 — neo thời gian     : tstamp chính xác (Strategy A) → xml:id của neo
                             labelResolution.ts
Lượt 3 — phủ nhãn lên SVG  : thay neo rỗng bằng <text>, không đụng bản khắc
                             labelOverlay.ts
```

- **Lưới neo rỗng** (`anchorLattice.ts`): `<dir>` **không có nội dung**, đặt theo `tstamp`. Verovio vẫn resolve hoành độ cho chúng, nhưng vì không có chữ nào để tránh đè, nó không nới rộng ô nhịp. Lưới là **hợp của mọi mức đếm** nên MEI — và do đó toàn bộ bố cục — không đổi khi thầy chuyển mức.
- **Temporal truth không đổi.** Vẫn `tstamp` tính từ beat-map, vẫn nốt tròn / lặng cả ô / đảo phách / lấy đà resolve đúng. Không chia đều bề rộng ô, không bám nốt gần nhất, không nội suy.
- **Tung độ hàng nhãn** tính từ dòng kẻ cuối cộng khoảng cách thầy chọn, chỉ lùi thêm khi ô nào đó trong hệ có mực chạm xuống — đúng luật Verovio vẫn dùng cho `dir`, nên nhãn vẫn nằm giữa khuông và ký hiệu sắc thái như trước (đo được: 3.716 so với 3.708 của bản cũ). Khoảng cách khuông nhạc ↔ TAB **không đổi một đơn vị nào**.

### Hết chỗ thì chữ nhường, không phải bản nhạc

Bản nhạc đã khắc xong và không được nới ra, nên chỗ cho nhãn là hữu hạn. Theo thứ tự:

1. **Cỡ chữ tự thu** cho vừa khe hẹp nhất — một phép chia trên khoảng cách hai nhãn liền nhau, không phải phép thử. Có báo: *"Nhãn đếm dày nên đã giảm cỡ số xuống …pt"*.
2. **Ẩn chọn lọc** khi đã chạm sàn 4pt: phách chính `1 2 3 4` được đặt trước và giữ nguyên, chỉ nhãn phụ `e & a` mới bị ẩn, và chỉ đúng cái không còn chỗ — không ẩn oan cả ô như luật cũ.
3. Nhãn đè lời hát hoặc vượt mép trang vẫn bị ẩn kèm chẩn đoán như cũ.

Nhãn căn giữa dưới nốt (trước đây căn trái), vừa đúng chỗ hơn vừa đỡ tốn bề ngang.

**Một ca an toàn đáng nhớ:** nếu Verovio trả **cùng một hoành độ cho nhiều thời điểm khác nhau** trong một ô (ô `mRest` với nhịp ghi dạng cộng `2+3`), thì giữ lại nhãn nào cũng là đặt sai chỗ. Cả ô bị bỏ nhãn kèm `TEMPORAL_ANCHOR_NOT_RESOLVED`.

### Ranh giới ba tầng được khoá bằng test đọc mã nguồn

Bất biến toạ độ chứng minh hôm nay đúng; `architecture.test.ts` chặn ngày mai. Nó đọc thẳng mã nguồn và cấm:

| Tầng | Điều bị cấm |
|---|---|
| `anchorLattice.ts` | mọi dấu vết của lựa chọn hiển thị — `countingLevel`, tên mức đếm viết thẳng, `showBeats`, `color`, `sizePt`, và **neo mang chữ** |
| `labelOverlay.ts` | Verovio, `toolkit`, `loadData`/`renderToSVG`, Beat Engine, tự dựng lại lưới |
| `verovioAdapter.ts` | `spacingLinear`/`spacingNonLinear`/`measureMinWidth`, `hasSubbeats`, `countingLevel` trong option khắc nhạc |
| khoá cache bản khắc | chỉ được chứa thứ thật sự đổi bản nhạc (cách chia, khổ giấy) — không `countingLevel`/`color`/`sizePt` |

Vì lưới phải là **hợp** của mọi mức, danh sách mức đếm nay nằm ở `COUNTING_LEVELS` trong `annotations.ts` — cạnh chính định nghĩa kiểu. Lưới lặp qua hằng đó nên không phải viết tên mức nào; thêm mức mới là lưới tự bao gồm.

Mỗi luật tự thử ngược: nó phải bắt được một đột biến thật của chính nó, nên một luật hỏng cũng lộ ra thay vì âm thầm cho qua. Ngoài ra `renderer.stats()` đếm số lần khắc nhạc thật — đổi mức đếm, màu, cỡ chữ giữ nguyên **1 lần khắc**; đổi khổ giấy hoặc cách chia nhịp lẻ mới khắc lại.

### Vì sao bản khắc nền được dùng lại

Bản khắc nền chỉ phụ thuộc bản nhạc, cách chia nhịp lẻ và khổ giấy. Đổi mức đếm, màu hay cỡ chữ **chỉ vẽ lại lớp phủ** — không gọi Verovio lần nào. Trước đây mỗi lần đổi mức là một lần khắc lại toàn bộ.

## Thư viện bài hát (Giai đoạn Nội dung 1)

Bản nhạc đang mở → **Lưu vào thư viện** → xuất hiện trong *Thư viện bài hát* → mở lại bất cứ lúc nào. Chưa có editor: giai đoạn này chỉ lưu, tìm, mở và giữ phiên bản.

```
STORAGE   bucket nhipphach-scores  (RIÊNG TƯ — bucket private đầu tiên của repo)
          <score_id>/<thời điểm>-<12 ký tự sha256>.musicxml
DATABASE  nhipphach_scores          một bài: tên, tác giả, con trỏ current_version_id
          nhipphach_score_versions  mỗi phiên bản: storage_path, sha256, size, parent
```

Không có XML trong database — không cột text chứa bản nhạc, không base64 trong jsonb. Tải về đi qua `storage.download()` mang JWT; **không có `getPublicUrl`**, không ai đoán được đường dẫn để lấy bản nhạc mình không có quyền đọc.

### Bản gốc bất biến

`v1` là file thầy nạp lần đầu và không bao giờ bị ghi đè. Mọi sửa đổi về sau là phiên bản **mới**: `v1 → v2 → v3`, `current_version_id` chỉ **tiến**. Mở một phiên bản cũ chỉ để xem/xuất — nó không trở thành bản hiện hành; muốn "khôi phục" thì tạo phiên bản mới từ nội dung cũ.

Điều này chặn ở **database**, không chỉ ở mã: trigger `nhipphach_versions_immutable` từ chối `UPDATE`/`DELETE` trên bảng phiên bản, kể cả khi chạy bằng superuser. Hệ quả đã kiểm chứng: **xoá cứng một bài đã có phiên bản cũng bị chặn** (cascade đi qua trigger). Đúng ý mục 15 — giai đoạn này xoá là `archived_at`, không purge; policy `nhipphach_scores_delete` (`library.manage`) chỉ có tác dụng với bài chưa có phiên bản nào.

### Lưu là MỘT giao dịch, hỏng ở đâu cũng không để lại rác

```
upload object  →  nhipphach_save_version (SECURITY INVOKER, một giao dịch)
                  ├─ tạo bài nếu chưa có (id do client sinh để biết trước thư mục)
                  ├─ chèn phiên bản, version_number = max + 1, parent = bản trước
                  └─ dời current_version_id
              →  DB hỏng? xoá đúng object vừa tải
```

Thứ tự cố ý: một object mồ côi chỉ tốn chỗ, còn một dòng database trỏ vào file không tồn tại thì làm hỏng cả bài. Storage mở đúng **một** khe `DELETE`: chính chủ, và **chỉ object chưa được ghi thành phiên bản** — đã thành phiên bản thì không ai xoá được, kể cả người tải lên. Đã dựng lỗi thật cả hai chiều (ghi chú >300 ký tự làm `CHECK` từ chối; file 11 MB làm Storage từ chối): không phiên bản mới, con trỏ không đổi, không object thừa, phiên bản cũ nguyên.

### Trùng lặp: hỏi, không tự quyết

SHA-256 (Web Crypto, không thêm thư viện) tính trên byte thật. Nạp lại đúng file cũ dù tên khác → *"Bản nhạc này đã có trong thư viện: … (v1)"* với **Mở bài đã có** / **Vẫn lưu thành bài mới** / Huỷ. Lưu thành bài mới là quyền của thầy — hai bài có thể cùng hash.

### Quyền

Ba capability đi đúng khuôn Giai đoạn 12, chỉnh ở Admin → Nhịp phách, policy gọi `nhipphach_can()` — không `is_teacher()` rải trong policy:

| | `library.read` | `library.save` | `library.manage` |
|---|---|---|---|
| Học viên | ✓ (kho chung, đọc tất cả) | – | – |
| Giáo viên | ✓ | ✓ | ✓ |

Học viên thấy *Thư viện bài hát*, mở được bài, không thấy nút lưu; RLS và Storage policy chặn thật ở máy chủ, giao diện chỉ phản ánh. Muốn mai này cho học viên tự lưu chỉ cần bật cờ — RLS đã theo capability. Hai bảng nằm trong `self_managed` của `db/rls_setup.sql`; chạy lại script đó không làm mất policy hẹp (đã thử).

### Metadata

`work-title` → `movement-title` → tên file. `creator type="composer"/"lyricist"` (`poet` đỡ cho lyricist). Không đoán, không AI. Đổi tên trong thư viện **không** sửa `<work-title>` trong file. Đọc bằng `@xmldom/xmldom` — cùng bộ đọc ở trình duyệt, WKWebView và test Node.

### Kiểm chứng

`test:nhipphach-library` (18, đọc mã nguồn và SQL: bất biến, không XML trong DB, bucket private, thứ tự upload→DB, dọn rác, dò trùng có hỏi, không import Verovio/Beat Engine) và `test:nhipphach-library-db` (18, Supabase local với JWT thật ba vai: thầy/học viên/khách; nguyên tử hai chiều; path isolation; trùng lặp; tìm kiếm có dấu). Mười đột biến tương ứng đều làm test đỏ.

## Chạy test

```bash
npm run test:nhipphach-layout && npm run test:nhipphach-presets \
  && npm run test:nhipphach-batch && npm run test:route-guard
```

`test:nhipphach-layout` là phép kiểm quan trọng nhất: nó dựng 12 bản nhạc (nốt tròn, lặng cả ô, đảo phách, chấm dôi, dấu nối, chùm ba, lấy đà, lời + hợp âm, 6/8, 5/8, 7/8, guitar + TAB) ở cả bốn mức và đối chiếu từng toạ độ.

`test:nhipphach-cloud`, `test:nhipphach-history` và `test:nhipphach-library-db` cần Supabase local đang chạy và ba tài khoản `teacher-a@` / `teacher-b@` / `student-c@test.local`.

Harness trình duyệt (cần `npm run dev`): `/tests/nhipphach-batch/browser.html?auto=1` — chạy 1/10/50 file với PDF thật, kiểm ZIP, A4 vector, trùng tên, file lỗi, nhịp lẻ và resume.

## Chưa làm

Nghiệm thu trên file thật 14 trang · 656 nhãn của thầy (chưa có file trong repo) · Web Worker · gộp PDF · lưu batch trên server · phân trang lịch sử quá 50 job · "Xoá toàn bộ lịch sử" trên giao diện · chia sẻ link · học viên truy cập · thư mục đệ quy · additive meter tuỳ ý.
