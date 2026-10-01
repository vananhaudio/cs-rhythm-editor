# Class Social — Nhịp & Phách Artifact Share V1

Người dùng mở một bản nhạc trong **Nhịp & Phách** → bản khắc có số phách hiện xong → bấm nút phụ
**"Chia sẻ lên cộng đồng"** → Feed có thẻ **Nhịp & Phách · Bản nhạc** → người khác bấm **"Xem bản nhạc"** →
`/nhipphach?artifact=<id>` dựng lại **đúng bản đã đánh số phách** ở chế độ chỉ xem.

## Audit — kiến trúc hiện tại (01/10/2026)

- **Nguồn bản nhạc:**
  - file người dùng chọn hoặc "Dùng file mẫu" (chỉ trong trình duyệt);
  - kho Nhịp Phách (`nhipphach_scores` + `nhipphach_score_versions`, bucket private, phiên bản bất biến; học sinh chỉ `library.read`);
  - kho master `musicxml_library`, được **copy** sang kho Nhịp Phách qua `masterCopy.ts`. Đường copy này cần `library.save`, chỉ thầy có.
- **Thành quả** = MusicXML đang hiển thị (`nhap?.xml ?? source.xml`) + `ScoreSettings`: mức đếm, cách đếm nhịp kép, cách chia nhịp lẻ, màu, cỡ, khoảng cách, hướng giấy.
  - Bản khắc (SVG) và file xuất (PDF/PNG) đều là sản phẩm **dẫn xuất** từ hai thứ trên qua cùng bộ khắc. Phần xử lý chạy trên máy, không lưu.
- **Quyền production cho học sinh:** `access`, `advanced`, `export.pdf`, `export.png`, `library.read`. Không có `library.save` và không có `score.edit`.
  - Vì học sinh không lưu được vào kho, artifact không thể chỉ trỏ tới một phiên bản trong kho, nên **phải giữ chính MusicXML**.
- MusicXML trên production (01/10): lớn nhất 277 KB; p95 khoảng 256 KB.

## Mô hình

Dùng lại nền BMS Artifact V1, không có bảng hay bucket mới, không có `nhipphach_posts`.

- **`tool_artifacts`** nhận loại `('nhipphach', 'score')`, thêm cột:
  - `content` (MusicXML, ≤ 1 MB) và `content_sha256` (server tự tính);
  - `data` (`schema 'nhipphach.score' v1`): tên bài, tác giả, nhịp, thiết lập đã chuẩn hoá.
  - Ràng buộc: `content` có khi và chỉ khi `tool = 'nhipphach'`.
- **Server kiểm** (`nhipphach_musicxml_check`, `nhipphach_settings_normalize`):
  - MusicXML: kích thước, không có `<!ENTITY`, well-formed, gốc là `score-partwise`. Nhịp đầu tiên đọc bằng `xpath`, không lấy từ client.
  - Thiết lập: phải `showBeats = true`, mức/cách đếm thuộc danh sách, màu `#rrggbb`, cỡ chữ 4–20, khoảng cách 0–10, cách chia nhịp lẻ là số 1–9. Trường lạ bị bỏ.
- **Feed** dùng `social_share_tool_result('nhipphach', …)`: tạo artifact + đúng MỘT bài `tool_share`.
  - `tool_share` chỉ có `artifact_id`, tên bài, nhịp, mức đếm. **Không có MusicXML.**
- **RLS:** giữ nguyên như BMS. Chủ bài và thành viên Class đọc; không ai sửa; chỉ chủ bài gỡ (`social_delete_tool_artifact`); anon không có quyền gì.
- **Kho master:** RPC và mã chia sẻ **không nhắc tới** `musicxml_library`, `nhipphach_scores`, `nhipphach_score_versions`. Test DB, unit và E2E đều khoá điều này. Không có đường Tool Share nào ghi ngược vào kho.

## Giao diện

- **Nút chia sẻ:** trong thẻ "Xuất tài liệu" (một bài), nút phụ dưới "Xuất PDF".
  - Chỉ hiện khi đã đăng nhập (vai trò khác khách).
  - Chỉ bật khi bản khắc đã hiện xong và đang hiện số phách.
  - Bản đang hiển thị đổi thì coi như chưa chia sẻ, dùng khoá mới. Bấm đúp vẫn chỉ ra một bài.
  - Chia sẻ xong: "Đã chia sẻ lên cộng đồng · Xem trên Trang chủ · Mở / gỡ bản đã chia sẻ".
- **Thẻ Feed:** "Nhịp & Phách · Bản nhạc" → tên bài → "Nhịp 3/4 · Chia đôi" → nút "Xem bản nhạc".
  - Không có ảnh xem trước: dựng bản khắc cần Verovio (wasm, nặng), không hợp với Feed, và V1 không lưu snapshot SVG.
  - CTA là "Xem bản nhạc" vì công cụ hiện chưa có chế độ luyện.
- **Trang chỉ xem** (`SharedScoreView`): mở **trước** cổng quyền công cụ. Quyền đọc do RLS của artifact quyết; trang không cấp thêm quyền công cụ nào.
  - Dựng lại bằng chính bộ khắc của công cụ; hiển thị bằng `<img>` từ SVG, nên SVG không chạy script.
  - Không có lưu, xuất, sửa hay thư viện.
  - Người xem thấy "Bản chia sẻ · chỉ xem, không sửa bản gốc". Chủ bài thấy "Bản của bạn" và nút "Gỡ chia sẻ" (bấm 2 bước).
  - Id lạ, bản đã gỡ, hoặc không có quyền → "Bản nhạc này không còn được chia sẻ…". Chưa đăng nhập → "Đăng nhập Class để xem bản nhạc này."
- V1 chưa có "Tạo bản của tôi" hay chỉnh sửa từ bản chia sẻ.

## Phát hành

1. `prod-db.py query db/social_bms_artifact_v1_preflight.sql` (preflight dùng chung).
2. `dryrun` / `migrate db/social_nhipphach_artifact_v1_setup.sql`. Có cổng kiểm: md5 RPC BMS và `tool_artifacts` tồn tại.
3. `query db/social_nhipphach_artifact_v1_postflight.sql`.
4. Deploy frontend.

Rollback: `db/social_nhipphach_artifact_v1_rollback.sql`. RPC trở về bản BMS. Nếu chưa có bản nào thì gỡ cột và hàm; nếu đã có thì giữ dữ liệu.

## Kiểm thử

- DB: `db/tests/social_nhipphach_artifact_v1_test.sql`.
  - Nguyên byte và sha256; chuẩn hoá thiết lập.
  - XML hỏng, sai gốc, có ENTITY, > 1 MB.
  - Quyền: owner, B, Thầy, ngoài Class, anon. Bấm đúp; gỡ.
  - Hồi quy Metronome và BMS; RPC không chạm kho master.
- Unit: `tests/class-social/nhipphach-share.test.tsx`.
- E2E Chrome: dựng bản không gửi gì lên server → chia sẻ (bấm đúp) → Feed có danh tính → B xem bản dựng lại có số phách, tải lại vẫn đúng → id lạ / khách → A gỡ. Chạy ở 390px.
