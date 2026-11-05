# Universal Contextual Share — Chia sẻ nguyên cảnh giáo trình (V1: lát cắt "ô nhịp trong khối hỗn hợp")

> Nguyên lý: **Khung nhìn + Vùng chú ý.** Không chia sẻ một mẩu bị tách khỏi bối cảnh; chia sẻ một khung giáo trình GỐC, trong đó vùng người gửi muốn nói được đánh dấu.
> Trạng thái: **V1.3** — nhánh `feat/contextual-share-v1` (commit nghiệm thu `4e6eea4d`), **không đổi DB**. Dựa trên Share Note V1 + Feed Preview V1/V1.1 (đang LIVE).

## 1. Khảo sát hệ thống hiện hành (đọc mã + schema thật)

| Thành phần | Thực tế |
|---|---|
| Giáo trình | `class_lesson_content.blocks` (jsonb) = mảng `LessonSection` (`src/lesson/lessonTypes.ts`): `score`, `repertoire` (nhiều `pieces`), `layers`, `study` (khối con `h/p/ul/ol/table/callout`), `fretboard`, `video`, `checkpoint`… Định danh bền = **chỉ số khối + đường dẫn tới chuỗi nhạc** (`['tex']`, `['pieces',k,'tex']`, `['layers',k,'tex']`). |
| Renderer | `LessonDocument.renderSection` dựng MỌI khối; `LessonScore` (alphaTab) dựng nhạc; CSS `lsn-*` nằm trong `LessonDocument`. |
| Tham chiếu chia sẻ | `share_notes` (`session_id, section_idx, score_path, tex_sha, bar_from, bar_to, note`): **neo = ô nhịp**, dấu vân tay `sha256` của chuỗi nhạc do SERVER tính. Không lưu nội dung nhạc. |
| Quyền | `share_note_open` (ok / stale / no_access) → `share_note_session_open` (chỉ đọc, khoá buổi) → đọc giáo trình qua RLS của người xem (lớp thứ hai). |
| Kênh | Chat (`dm_messages.ref_type='share_note'`), Feed (`class_posts.tool_share`), Band Chat dùng chung `ref_type` — **một** bảng tham chiếu. |
| Preview | Feed V1.1: `ShareNotePost` + `shareNotePreviewStore` (hàng đợi 1 yêu cầu, cache theo người xem, tối đa 2 alphaTab sống, lazy theo `IntersectionObserver`). |

**Kết luận tái sử dụng:** server đã có đủ Source Reference + Focus Anchor + Access Guard + stale. Thiếu duy nhất là **Context Renderer**: V1.1 chỉ dựng trích đoạn nhạc, không dựng phần giáo trình quanh nó. ⇒ lát cắt này là **FE-only, không migration**.

## 2. Mô hình (A–G) và nơi nó nằm

```
 Người gửi (trang Buổi)                Server                         Người nhận (Feed / Chat)
 khoanh ô  ──share_note_create──►  share_notes (neo + sha)  ──share_note_open──►  ok|stale|no_access
                                      (A) Source Ref  (B) Focus Anchor              │ (F) Access Guard
                                                                                    ▼  + share_note_session_open (khoá buổi)
                                                          class_lesson_content (RLS người xem)
                                                                                    │ sections[section_idx]
                                                                                    ▼
                         (C) Context Window = quy tắc xác định  ──►  (D) ContextSectionView (renderer GỐC)
                                                                      + LessonScore excerpt (ô ngữ cảnh + vùng tô)
                                                                                    │ bấm
                                                                                    ▼
                                                              (G) /sessions/N?note=<id> → cuộn + tô đúng vùng chọn
```

| | Thành phần | Cài đặt |
|---|---|---|
| A | Source Reference | `SourceRef` (`src/share/contextShare.ts`): buổi + khối + đường dẫn; phiên bản = `tex_sha` ở server. Không DOM path. |
| B | Focus Anchor | `FocusAnchor` (union: `bars` · `text` · `region` (toạ độ chuẩn hoá) · `cells` · `blocks`). **Chỉ `bars` có hạ tầng lưu** (`share_notes`). Còn lại là hợp đồng; `resolveFocus` trả `unsupported` — không báo là hỗ trợ. |
| C | Context Window | KHÔNG lưu; tính lại mỗi lần từ giáo trình hiện hành. Ba phạm vi tách riêng: (1) khung người gửi thấy — không lưu; (2) ngữ cảnh hệ thống tính = **khối chứa** + ≤2 ô quanh vùng khoanh; (3) thực tế vẽ = theo khổ thiết bị (`planExcerpt`: 2 dòng, vùng khoanh luôn ưu tiên). |
| D | Context Renderer | `ContextSectionView` (export từ `LessonDocument`): gọi CHÍNH `renderSection` + CSS giáo trình, chỉ thay LessonScore của đúng bản nhạc bằng trích đoạn. Không renderer thứ hai, không ảnh chụp, không AI. |
| E | Context Share | Dùng nguyên `share_notes` + Chat/Feed hiện có; Chat/Band Chat dùng được cùng `ContextSectionView` ở bước nối sau (xem §8). |
| F | Access Guard | Giữ nguyên thứ tự cũ: `share_note_open` → `share_note_session_open` → RLS. `section` chỉ được lấy SAU khi cả hai pass; không có trong cache khi `no_access / stale / locked`. |
| G | Source Navigation | Giữ nguyên Share Note V1: `?note=` → server xác nhận còn khớp sha → tô đúng dải đã khoanh (không mở rộng thành vùng ngữ cảnh). |

### Quy tắc ngữ cảnh (xác định, kiểm chứng được)
1. Vùng chú ý luôn nguyên vẹn (ưu tiên số 1); ≤ 4 ô vẽ, dài hơn thì "hiện N ô đầu".
2. **Tôn trọng ranh giới khối:** khung = cả khối chứa bản nhạc (tiêu đề, nhãn, mô tả `lead`, danh sách "Dự kiến", tên tác phẩm/tác giả/ghi chú, nhịp độ) → rồi đến trích đoạn. Với `repertoire`/`layers` chỉ kéo đúng tác phẩm/tầng được chia sẻ (không kéo tác phẩm khác, không kéo tệp tải về `assets`).
3. **Hai chế độ, cùng renderer, cùng thứ tự gốc (V1.3):**
   - *Mặc định gọn* (`planExcerptFocus`): nhãn, tiêu đề, mô tả `lead` (rút gọn 2 dòng bằng `line-clamp`, nguyên văn vẫn đủ trong DOM), tên tác phẩm/tác giả/ghi chú, nhịp độ + **chỉ các dòng nhạc chứa vùng khoanh**. Ô ngữ cảnh chỉ lấp chỗ trống trong chính các dòng đó, không thêm dòng. Vùng khoanh trải hai dòng thì giữ đủ hai dòng. Không bao giờ cắt khuông, nốt, TAB hay lời; không đặt chiều cao cứng.
   - *"Xem đầy đủ"* (mở ngay trong thẻ, nút đổi thành *"Thu gọn"*): thêm ngữ cảnh nhạc kiểu V1.1 (≤2 ô mỗi phía, tối đa 2 dòng), mô tả hiện hết, danh sách "Dự kiến", chú thích `marks`, `guidance`, ghi chú `note` của tầng, trạng thái chờ giáo viên — đúng thứ tự như trang giáo trình. Bản nhạc được khắc lại **trên cùng một renderer alphaTab** (không renderer mới), vùng khoanh không đổi, không nhảy cuộn. "Xem đầy đủ" không cấp thêm quyền xem.
   - Nút "Xem đầy đủ" chỉ hiện khi thật sự có gì để thêm (phần sư phạm bị ẩn, mô tả bị rút gọn, hoặc ô ngữ cảnh chưa vẽ). Tệp tải về (`assets`) không đưa vào khung ở cả hai chế độ.
   - Đường về nguồn = nút **"Mở trong giáo trình"** (cùng hàng với "Xem đầy đủ", mỗi nút cao ≥44px). Nhãn này dùng thống nhất cho cả Feed và Chat.
   - Giao diện: viền ngoài khung trung tính 1px (`--cs-border`); **chỉ vùng khoanh** mang màu cam (nền nhạt + viền 2px) làm điểm nhấn thị giác. Cỡ chữ/khoảng đệm khung được thu gọn trong Feed (`.cs-sn-preview .lsn-ctx`). Chiều cao thẻ (iPhone 390px, mẫu thử): V1 1164px → V1.2 1039px → **V1.3 741px** mặc định, ≈1247px khi "Xem đầy đủ".
4. Ngữ cảnh ô nhạc: ≤ 2 ô mỗi phía, thiếu chỗ thì giảm ngữ cảnh trước khi cắt vùng khoanh (V1.1, không đổi).
5. Văn bản (hợp đồng, có test, **chưa nối vào Feed**): `studyContext` = tiêu đề mục gần nhất phía trên + khối được chọn + khối phụ thuộc liền sau (list/callout sau đoạn văn).

## 3. Phiên bản & toàn vẹn (fail closed)

| Tình huống | Hành vi |
|---|---|
| Giáo trình không đổi | khung + trích đoạn + vùng tô |
| Sửa tiêu đề / mô tả / ghi chú (nhạc không đổi) | neo vẫn chắc (sha nhạc khớp) → khung hiện bản **hiện hành** (đúng "nhìn lại giáo trình gốc") |
| Sửa nhạc / dời chỉ số tác phẩm / xoá | sha lệch hoặc đường dẫn mất → `stale`: giữ câu hỏi, **không** khung, **không** nhạc, **không** tô — không đoán |
| Mất quyền / lớp khác / buổi khoá | câu hỏi + thông báo; 0 yêu cầu đọc giáo trình; không văn bản giáo trình trong DOM/HTML |

Giới hạn đã biết: `sha` chỉ phủ chuỗi nhạc. Nếu Thầy **đổi chỗ hai tác phẩm có chuỗi nhạc giống hệt nhau** thì không phân biệt được (không có nội dung khác để so). Muốn chặt hơn cần neo ngữ nghĩa (id khối bất biến) — xem §8.

## 4. Hiệu năng
Không thêm yêu cầu mạng nào so với V1.1 (khối `section` nằm sẵn trong `sections` đã tải). Vẫn ≤ 2 alphaTab sống; khung giáo trình là DOM văn bản nhẹ, chỉ dựng khi thẻ có khe render. CSS `lsn-*` nhúng theo thẻ sống (≤ 2).

## 5. Bảo mật
Không migration / RPC mới. Văn bản giáo trình đi qua React (không HTML thô). Không đưa nội dung giáo trình vào metadata công khai, OG hay cache dùng chung (cache vẫn khoá theo `uid`). Không service-role trên client.

## 6. Đã làm trong lát cắt này
`src/share/contextShare.ts` (lõi thuần) · `ContextSectionView` + chế độ `ctx` của `renderSection` · `shareNotePreviewStore` mang thêm `section` · `ShareNotePost` dựng khung · test thuần (`tests/class-social/contextual-share.test.tsx`) · E2E bước 10 (`run-share-note-feed.mjs`) trên khối hỗn hợp "Tác phẩm" đúng dạng Owner nêu.

## 7. Chưa làm (không báo là hỗ trợ)
**Giới hạn hỗ trợ hiện tại: chỉ neo ô nhịp.** Văn bản, hình, bảng và ô bài tập **chưa hỗ trợ** (cần cột neo mới hoặc bảng `share_anchors` — migration, chờ Owner; lát cắt 2). Chưa có chọn vùng văn bản & hình ở phía người gửi. Chat / Band Chat chỉ có thẻ tham chiếu (cùng nhãn "Mở trong giáo trình"), chưa dựng khung.

## 8. Lộ trình
1. **Neo ngữ nghĩa bất biến:** `share_anchors(kind, section_id, selector jsonb, content_sha)` + id khối bất biến trong blocks (hiện chỉ chỉ số mảng).
2. **Văn bản:** chọn bằng selection tự nhiên → `{block, start, end}` theo `studyContext`.
3. **Hình / bảng:** vùng chuẩn hoá 0..1; ô bảng kèm tiêu đề hàng/cột.
4. **Chat / Band Chat:** thẻ tham chiếu mở rộng dùng lại `ContextSectionView` (không thêm cơ chế lưu).
5. ~~"Xem thêm ngữ cảnh"~~ → đã làm ở V1.3 dưới tên **"Xem đầy đủ" / "Thu gọn"**.

## 9. Kế hoạch lát cắt 2 (chưa triển khai — chờ Owner duyệt thiết kế)
Nền: V1.3 đã nghiệm thu ĐẠT trên production (main `060715fc`). Lát cắt 2 = **chia sẻ vùng văn bản giáo trình**. Thứ tự: (1) khảo sát + thiết kế (neo văn bản, id khối bất biến, mô hình lưu) → Owner duyệt → (2) mới migration / mã. Chưa migration, chưa đổi production khi chưa duyệt.

**Hạng mục UI đi cùng đợt (Owner bổ sung, cùng một lượt deploy, không deploy riêng): làm đẹp cụm nút thao tác trên thẻ chia sẻ Feed**
Hiện "Mở trong giáo trình" nằm sát "Thu gọn", chữ chưa cân đối. Yêu cầu:
1. Bố cục hai nút có khoảng cách rõ ràng, không chồng lấn.
2. "Xem đầy đủ" / "Thu gọn" = thao tác phụ, kiểu nút nhẹ.
3. "Mở trong giáo trình" = thao tác điều hướng chính, dễ nhận biết; có thể dùng biểu tượng mở tài liệu hoặc mũi tên.
4. Vùng bấm ≥ 44px.
5. Đẹp trên iPhone 390px và desktop; chữ không bị ép hoặc tràn.
6. Hợp iOS HIG Light và giao diện Class hiện hành.
7. Giữ nguyên logic điều hướng, phân quyền, tham chiếu giáo trình.
8. Kiểm cả trạng thái thu gọn và mở rộng.
Phạm vi: chỉ CSS + markup `.cs-sn-actions` trong `ShareNotePost.tsx`; không migration, không đổi kiến trúc. Nghiệm thu bằng ảnh trước/sau (iPhone 390 + desktop, cả hai trạng thái).

