# Contextual Share V2 — Chia sẻ vùng văn bản giáo trình (KHẢO SÁT + THIẾT KẾ)

> Trạng thái: **thiết kế đã được Owner duyệt hướng D (commit `88adba66`); bản này đã bổ sung điều chỉnh A–D (xem §14–§17).** Chưa mã tính năng · chưa migration · chưa merge · chưa deploy.
> **Chưa viết mã tính năng · chưa migration · chưa merge · chưa deploy.** Chờ Owner và ChatGPT đánh giá thiết kế.
> Nền tảng: `docs/CONTEXTUAL-SHARE-V1.md` (Khung nhìn + Vùng chú ý; Source Reference · Focus Anchor · Context Window · Access Guard).

## 1. Hiện trạng kỹ thuật (bằng chứng từ mã nguồn)

| # | Phát hiện | Bằng chứng |
|---|---|---|
| E1 | Giáo trình = `class_lesson_content.blocks` (jsonb, **mảng** `LessonSection`). Văn bản nằm rải ở nhiều loại khối: `study` (chuỗi `StudyBlock`: `h` `p` `ul` `ol` `table` `callout` `write`), `note.text`, `objectives.items[]`, `recap.steps[].items[]`, `assignment.items[].text`, `checklist.items[]`, `lead` của `score/layers/fretboard/flow`, `guidance[]`, `pieces[].note`… | `src/lesson/lessonTypes.ts:48-64, 162-170`; `LessonDocument.tsx:43-240` |
| E2 | **Không khối nào có id bất biến**, trừ `checkpoint.id` (`'4.1'`). Định danh hiện chỉ là chỉ số mảng + đường dẫn. | `lessonTypes.ts:134-142`; `docs/GIAO-TRINH-CHUAN.md:71-73` |
| E3 | **Chỉ số khối có thể dịch chuyển** khi Thầy chèn khối. Thẻ "Ôn nhanh" đã phải chọn khoá `md5(added_at\|title)` "không dựa chỉ số khối". Neo ô nhịp V1 (chỉ số + sha) hiểu chuyện này là `stale`. | `docs/LESSON-CLIP-CARD-V1.md:22-23` |
| E4 | Renderer chung: `renderSection` + `renderStudyBlock` (mọi văn bản đi qua React, chuỗi nguyên bản, không HTML thô, không chuẩn hoá khoảng trắng). Ô bảng `___` hiển thị rỗng. Danh sách `ul/ol` dùng `key={t}` (trùng chuỗi → trùng key). | `LessonDocument.tsx:306-331` |
| E5 | `ContextSectionView` đã dựng **đúng khối gốc** bằng `renderSection` + CSS giáo trình; `ctx.key` hiện chỉ biết khoá nhạc. `studyContext()` (tiêu đề mục gần nhất + khối + khối phụ thuộc liền sau) **đã có sẵn và có test**, chưa nối. | `LessonDocument.tsx:25-45, 399-407`; `src/share/contextShare.ts:60-72` |
| E6 | `share_notes` chỉ chứa **tham chiếu**: `section_idx`, `score_path` (CHECK chỉ cho `['tex']` hoặc `['layers'\|'pieces', k, 'tex']`), `tex_sha` (server tính), `bar_from/bar_to` (CHECK 1..1024), `note`. Cả bốn cột neo đều `NOT NULL`. Bảng đóng (`revoke all`), chỉ RPC `security definer`. | `db/share_note_v1_setup.sql:33-56` |
| E7 | Hàm đọc nội dung `share_note_tex` đã là **tổng quát**: `(blocks -> section) #>> path` với `path text[]` — đọc được bất kỳ lá chuỗi nào, kể cả phần tử mảng (`'{blocks,3,text}'`). Hạn chế nằm ở CHECK và `share_note_create`, không ở cách đọc. | `share_note_v1_setup.sql:68-74` |
| E8 | Cổng quyền tách khỏi loại neo: `share_note_visible` → `share_note_score_ok` → `share_note_session_open(p_note)` → RLS người xem. Tất cả chỉ nhìn `session_id`/`note id`, **không nhìn loại neo**. `dm_share`, `social_share_share_note`, `share_note_delete`, `share_note_card` cũng chỉ dựa vào các cổng này. | `share_note_v1_setup.sql:77-100, 169-246`; `share_note_session_open_v1_setup.sql` |
| E9 | Liên kết sâu `?note=<uuid>` → `openShareNote` → `focus {score, bars}` qua `ScoreShareSlot` → `ScoreShareLayer` vẽ vùng tô và cuộn **một lần**. | `ClassSessionPage.tsx:69-80`; `scoreShareSlot.ts`; `ScoreShareLayer.tsx` |
| E10 | Phía gửi hiện chỉ có "Khoanh để hỏi" cho bản nhạc (lớp phủ trên alphaTab). **Chưa có cách chọn văn bản.** Composer nhận `score` + `bars`. | `ScoreShareLayer.tsx`; `ShareNoteComposer.tsx` |
| E11 | Feed: `ShareNotePost` + `shareNotePreviewStore` (`share_note_open` → `share_note_session_open` → đọc giáo trình bằng RLS → `section`). Thứ tự cổng đã cố định, hàng đợi 1 yêu cầu, cache theo `uid`. Phần dựng alphaTab (`requestRenderSlot`, tối đa 2) **chỉ cần cho nhạc**. | `shareNotePreviewStore.ts:48-93` |
| E12 | Payload Feed `tool_share` (jsonb) chỉ mang tham chiếu + lời nhắn + buổi + dải ô; **không có nội dung giáo trình**. `registry.ts` và `refCards.ts` đòi `bar_from/bar_to` là số → thẻ không phân tích được nếu thiếu. | `share_note_v1_setup.sql:215-217`; `registry.ts:136-142`; `refCards.ts:75-82` |

## 2. Cách chọn văn bản tự nhiên (desktop và cảm ứng)

- **Dùng chọn văn bản của trình duyệt** (`Selection`/`Range`), không tự xây bộ chọn. Desktop: kéo chuột / nhấp đúp / nhấp ba. Cảm ứng: nhấn giữ + kéo tay cầm hệ thống. iOS/WKWebView bắn `selectionchange` ổn định; không cần `contenteditable`.
- **Thanh hành động cố định đáy màn hình** khi có vùng chọn hợp lệ ("Hỏi / Chia sẻ"), **không dùng bong bóng nổi cạnh vùng chọn**: trên iOS menu hệ thống (Sao chép, Tra cứu…) nằm ngay trên vùng chọn và sẽ đè bong bóng của ta. Thanh đáy cùng ngôn ngữ với thanh "Khoanh để hỏi" của bản nhạc.
- **Lối tắt cảm ứng:** nhấn **một lần** vào một đoạn đủ dài khi đang bật "Khoanh để hỏi" = chọn nguyên đoạn (giống "chạm một ô nhịp"). Không cần nhấn giữ.
- **Phạm vi chọn hợp lệ** (MVP): nằm trọn trong **một lá văn bản** (một đoạn `p`, một mục `ul/ol`, một ô bảng, một `callout`, một `note`…), 1–500 ký tự. **Chọn vắt qua nhiều lá → KHÔNG tự co, KHÔNG tạo ghi chú**: thanh đáy chuyển sang trạng thái cảnh báo và nút "Hỏi / Chia sẻ" bị khoá (chi tiết §14).
- **Làm sạch biên:** co biên vào ranh giới từ/ký tự hiển thị (`Intl.Segmenter`), cắt khoảng trắng đầu/cuối; không bao giờ cắt giữa tổ hợp dấu tiếng Việt.
- Vùng ngoài lá hợp lệ (nút, tiêu đề khung, bản nhạc, link tải, ô `___`) bị bỏ qua.

## 3. Các phương án neo văn bản

Tiêu chí: không phụ thuộc toạ độ/DOM; sống sót khi giáo trình bị chèn/sửa; không sửa giáo trình đã xuất bản; ít code.

| Phương án | Cách làm | Ưu | Nhược |
|---|---|---|---|
| **A. Chỉ số + đường dẫn + offset** (như ô nhịp V1) | `(section_idx, path, start, end)` + sha đoạn chọn | Rất đơn giản; đối xứng V1 | Chèn khối trước đó là hỏng (E3). Dễ `stale` oan |
| **B. Trích dẫn (W3C TextQuote)** | Lưu đoạn chọn + tiền tố + hậu tố; tìm lại bằng khớp chuỗi | Bền khi dịch chuyển | **Nhân đôi nội dung giáo trình** vào bảng; giữ cả nội dung đã bị Thầy gỡ |
| **C. Id khối bất biến** | Ghi `id` vào mọi khối/lá rồi neo theo id | Bền nhất, lâu dài | **Phải sửa giáo trình đã xuất bản** + công cụ soạn + quy ước bất biến; ngoài phạm vi; nặng |
| **D. (ĐỀ XUẤT) Vị trí gợi ý + dấu vân tay băm, tự tìm lại trong phạm vi hẹp** | Lưu `(section_idx, path, start, end)` làm **gợi ý** + **chỉ băm**: `sha256(đoạn chọn)`, băm tiền tố/hậu tố ≤ 32 ký tự, băm nhận dạng khối (`kind` + tiêu đề). Mở: kiểm đúng vị trí → nếu lệch, tìm lại **trong cùng khối**, rồi tìm khối cùng nhận dạng; kết quả duy nhất mới dùng, còn lại `stale` | Không lưu văn bản; không đụng giáo trình; sống sót chèn khối, thêm/bớt đoạn, đổi thứ tự; fail-closed | Tính trong SQL (xem §5); sửa chính câu được chọn vẫn `stale` (đúng) |

**Đề xuất: D.** Nó là cách ô nhịp V1 đang làm (băm làm "dấu vân tay", server tính) cộng thêm bước **tìm lại hẹp**. Id bất biến (C) vẫn là đích dài hạn; D tương thích với C (sau này thêm `block_id` vào neo thì D chỉ còn là phương án dự phòng).

## 4. Phương án kiến trúc đề xuất

**Một hệ thống, một loại tham chiếu.** Neo văn bản là **loại neo thứ hai của `share_notes`**, không phải hệ chia sẻ mới. Dùng chung: bảng, `share_note_visible`, `share_note_score_ok`, `share_note_session_open`, `dm_share`, `social_share_share_note`, `share_note_delete`, link `?note=`, `ShareNotePost`, `shareNotePreviewStore`, `ContextSectionView`, thẻ Chat, hàng đợi Feed, nhãn "Mở trong giáo trình".

Mô hình V1 (A–G) giữ nguyên, chỉ thay phần riêng của loại neo:

| | Ô nhịp (V1.3) | Văn bản (V2) |
|---|---|---|
| A Source Ref | buổi + khối + đường dẫn nhạc | buổi + khối + đường dẫn lá văn bản |
| B Focus Anchor | dải ô + `tex_sha` | khoảng ký tự + băm đoạn chọn (+ băm tiền/hậu tố, nhận dạng khối) |
| C Context Window | khối + ≤2 ô quanh | **tiểu mục**: tiêu đề `h` gần nhất phía trên → trước tiêu đề kế (tối đa 12 khối); mặc định gọn = tiêu đề + khối chứa lá + khối phụ thuộc liền sau (`studyContext`, đã có) |
| D Renderer | `ContextSectionView` + `LessonScore` trích đoạn | `ContextSectionView` + **`<mark>`** quanh khoảng ký tự; **không có alphaTab** (nhẹ hơn nhạc) |
| F Access Guard | `open` → `session_open` → RLS | **y hệt** |
| G Navigation | `?note=` → tô + cuộn một lần | `?note=` → `<mark>` + cuộn một lần |

**Phân biệt nội dung chọn và ngữ cảnh** (yêu cầu #5):
- Nội dung được chọn = chỉ đoạn ký tự trong neo; hiển thị bằng `<mark class="lsn-text-hl">` (nền cam nhạt + gạch chân cam, cùng màu `--cs-accent` với vùng khoanh V1.3).
- Ngữ cảnh = phần còn lại của khung, **không tô**, viền ngoài trung tính. Hai thứ không bao giờ dùng chung kiểu hiển thị.

**Nội dung chọn dài** (≤500 ký tự) **không bao giờ bị cắt hay rút gọn** trong khung, kể cả ở chế độ gọn; chỉ phần ngữ cảnh mới rút.

## 5. Luồng thao tác

**Người gửi** (trang Buổi `/me`):
1. Đọc giáo trình, bôi đen câu/đoạn (hoặc nhấn một đoạn khi bật "Khoanh để hỏi").
2. Thanh đáy hiện trích ngắn: *“…câu đã chọn…” · [Hỏi / Chia sẻ] [Bỏ chọn]*.
3. Composer (đã có) hiển thị trích + ô lời nhắn 1–500 ký tự; chọn Feed hoặc Chat. `clientKey` giữ idempotent.
4. Server dựng neo từ tham số rời (client **không** gửi băm) và kiểm lại quyền + buổi + lá còn tồn tại.

**Người nhận** (Feed/Chat): thẻ y V1.3 — câu hỏi, nguồn, khung gốc, vùng chọn tô cam, "Xem đầy đủ/Thu gọn", "Mở trong giáo trình". Bấm → trang Buổi cuộn tới `<mark>`, hiện "Đã tô đoạn được hỏi".
- Gọn (mặc định): tiêu đề mục + lá chứa vùng chọn (+ khối phụ thuộc). Mở rộng: cả tiểu mục (tối đa 12 khối), cùng thứ tự gốc.
- `no_access` / `locked` / `stale`: giữ câu hỏi, **không** văn bản giáo trình trong DOM, đúng thông báo của V1.

## 6. Dữ liệu và API dự kiến

### 6.1 Có cần migration không? — **Có, một migration cộng thêm (additive), nhỏ.**

Giải thích vì sao không thể tránh, đã thử các lối không cần migration:
1. **Nhét vào cột sẵn có** (`score_path`, `bar_from/bar_to`): bị CHECK chặn (E6) và sẽ là ghi đè ngữ nghĩa — hàm V1 sẽ đọc `blocks[i].tex` của một khối nhạc và ra kết quả sai. Loại.
2. **Chỉ dùng jsonb `class_posts.tool_share`** (không bảng): mọi tính toán băm/kiểm tra neo vẫn phải ở RPC **mới** (= migration hàm); tin Chat không có chỗ lưu; không có `stale`/quyền theo neo. Loại.
3. **Neo trong URL, không lưu**: không có thẻ Feed/Chat, không `stale`, người nhận có thể sửa tham số. Loại.
4. **Neo bằng id khối bất biến**: phải sửa giáo trình đã xuất bản — trái nguyên tắc. Loại.

Vì vậy cần: nới `share_notes` + RPC mới. **Không đụng `class_lesson_content`, không đổi giáo trình, không sao chép nội dung.**

### 6.2 Phác thảo (chưa phải mã)

`share_notes` — thêm cột, nới ràng buộc:
```
anchor_kind   text not null default 'bars'  check (anchor_kind in ('bars','text'))
text_path     text[]      -- đường dẫn tới lá chuỗi trong khối, vd {blocks,3,text} · {items,2} · {text}
char_from     integer     -- offset theo ĐIỂM MÃ (code point), 0-based; gợi ý vị trí
char_to       integer
text_sha      text        -- sha256(đoạn chọn)
ctx_sha       text        -- sha256(tiền tố ≤32 ký tự || '\u0001' || hậu tố ≤32 ký tự)
block_fp      text        -- sha256(kind || '\u0001' || tiêu đề khối)  (nhận dạng khối)
-- score_path, tex_sha, bar_from, bar_to: DROP NOT NULL
-- CHECK: anchor_kind='bars' ⇒ 4 cột nhạc NOT NULL, cột văn bản NULL;  anchor_kind='text' ⇒ ngược lại
-- CHECK text_path: phần tử ∈ {tên trường trong DANH SÁCH TRẮNG} ∪ {^[0-9]{1,3}$}, độ dài ≤ 6
--       char_to > char_from, char_to - char_from ≤ 500
```
**Danh sách trắng lá văn bản: cứng theo loại khối, xem §15.1** (chỉ 6 loại khối MVP; `lead`, `guidance`, `label`, `url`, `href`, `tex`, `assets`, `quiz`, `id` đều bị loại). Link video, tệp tải về, đáp án không bao giờ chia sẻ được.

RPC mới (hàm V1 giữ nguyên để hoàn tác sạch và để bundle cũ — kể cả app iOS đóng gói — không vỡ):
- `share_text_create(p_session, p_section, p_path, p_from, p_to, p_note, p_client_key) → uuid` — cùng khuôn `share_note_create`: kiểm đăng nhập/lớp, quyền (`share_note_score_ok`), lá tồn tại và là chuỗi, đoạn chọn ≤500 ký tự và không rỗng sau khi bỏ khoảng trắng, giới hạn tần suất (cùng bộ đếm 10/phút), idempotent theo `(author, client_key)`. **Server tự cắt đoạn chọn từ jsonb rồi tự tính** `text_sha`, `ctx_sha`, `block_fp`.
- `share_note_open_v2(p_id) → (status, kind, note, author…, session_no, section_idx, path, bar_from, bar_to, text_path, char_from, char_to, text_sha, …)` (bảng trạng thái chính xác ở §15.7):
  `status ∈ ok | moved | stale | no_access` (0 hàng = không khả dụng). `moved` = đã **tìm lại** ở vị trí khác; trả vị trí đã giải quyết.
  Thuật toán tìm lại: **xem đặc tả đầy đủ ở §15** (thay thế phác thảo ban đầu).
- `share_note_card_v2` và `social_share_share_text`: bản mới song song (kết quả/payload thêm `anchor_kind`); **hàm V1 `share_note_card` và `social_share_share_note` giữ nguyên** (§17). Payload Feed vẫn **không có nội dung giáo trình**: `{…, "anchor":"text"}` thay `bar_from/bar_to`.
- Không đổi: `share_note_visible`, `share_note_score_ok`, `share_note_session_open`, `dm_share`, `share_note_delete`, ràng buộc `dm_messages_ref_valid_check` (vẫn `ref_type='share_note'`).

### 6.3 Frontend
- `shareNoteApi.ts`: kiểu `ShareNoteOpen` thành union theo `kind`; `parseShareNoteOpen` chấp nhận `kind` + trường văn bản (dữ liệu lạ → `unavailable`).
- `contextShare.ts`: `FocusAnchor` đã có `{type:'text', section, block, start, end}` (hợp đồng V1) — đổi thành đường dẫn tổng quát; `resolveFocus` hỗ trợ `text`. `studyContext` dùng nguyên.
- `LessonDocument.tsx`: lá văn bản qua **một hàm dùng chung** `renderLeaf(text, path, ctx)`: tạo `data-tp="<chỉ số>:<đường dẫn>"` và, nếu là lá được tô, chia `[trước][<mark>][sau]`. Chỉ thay chỗ in chuỗi thuần (E4); `renderSection` giữ nguyên cấu trúc. Sửa `key={t}` thành `key={index}` ở danh sách để chuỗi trùng không đè nhau.
- Phía gửi: lớp nghe `selectionchange` trong vùng `.lsn-paper` của trang Buổi: `Range → lá gần nhất có data-tp → offset theo TreeWalker` (đổi sang code point). Thanh đáy + Composer nhận `{anchor}`.
- Phía nhận: `ShareNotePost` rẽ nhánh theo `kind`; nhánh văn bản **không** xin khe alphaTab (`requestRenderSlot`), nên còn nhẹ hơn thẻ nhạc.
- Trang Buổi: `ScoreShareContext.focus` thành union `bars | text`; lá được tô cuộn tới một lần.

## 7. Xử lý khi giáo trình đổi

| Tình huống | Kết quả |
|---|---|
| Không đổi | `ok`, tô đúng đoạn |
| Chèn/xoá/đổi thứ tự khối hay đoạn khác; đoạn chọn còn nguyên | `moved` → tô ở vị trí mới, ghi chú "Giáo trình đã được sắp lại; đoạn này vẫn còn" |
| Sửa phần chữ **xung quanh** đoạn chọn trong cùng lá | `ok`/`moved` (băm đoạn chọn vẫn khớp), ngữ cảnh hiện bản **hiện hành**; `ctx_sha` chỉ dùng để phân xử khi có nhiều ứng viên |
| Sửa chính đoạn được chọn, xoá lá, đoạn trùng lặp không phân xử được | `stale`: giữ câu hỏi, **không** khung, **không** tô, nút "Mở trong giáo trình" vẫn mở buổi (không `?note`-tô) |
| Mất quyền / lớp khác / buổi khoá | y V1: câu hỏi + thông báo, không văn bản giáo trình |
| Lá thuộc trường ngoài danh sách trắng | từ chối khi tạo |

Giới hạn thật: chỉnh *đúng* câu đã chọn dù chỉ một dấu → `stale` (đúng nguyên tắc "không đoán"). Hai đoạn **giống hệt** nhau trong cùng khối mà tiền/hậu tố cũng giống → `stale` khi vị trí gợi ý hỏng.

## 8. Phân quyền, bản sao, bảo mật (yêu cầu #8)
- Không bản sao nội dung: bảng chỉ có băm + toạ độ; không lưu đoạn chọn, tiền tố, hậu tố.
- Không ảnh chụp: khung dựng từ `section` đọc bằng RLS của **người xem**, sau hai cổng server (`open_v2` ok/moved + `session_open`).
- Thứ tự cổng không đổi; `section` chỉ vào cache sau khi qua cổng (cache khoá theo `uid`).
- Mọi chuỗi đi qua React; `<mark>` do ta dựng từ offset đã kiểm số học, không `dangerouslySetInnerHTML`.
- Offset do server xác nhận (`moved` trả vị trí đã giải quyết); client vẫn kiểm `start<end≤length` trước khi tô, sai thì không tô (phòng thủ lớp hai, như `rangeFits`).
- Danh sách trắng trường chặn link video/tệp tải/đáp án.
- Không đổi `class_lesson_content`.

## 9. Mở rộng sau này (không làm ở lát cắt này)
- **Hình:** neo `anchor_kind='region'` (toạ độ chuẩn hoá 0..1 + băm tài sản); **bảng:** ô `(hàng, cột)` + tiêu đề hàng/cột — đã là một lá văn bản nên thực tế *ô bảng đã chia sẻ được ở V2*; hình/vùng là loại mới.
- **Nhiều đoạn liên tiếp:** `anchor_kind='blocks'` (khoảng lá).
- **Id khối bất biến** (phương án C): thêm `block_id` vào neo khi giáo trình có id; D tự lùi về làm dự phòng.
- Cột `anchor_kind` là điểm mở rộng duy nhất; thẻ/khung/quyền không phải làm lại.

## 10. Rủi ro và kiểm thử

| Rủi ro | Giảm thiểu |
|---|---|
| Migration chạm bảng **đang LIVE** | Chỉ cộng cột + nới NOT NULL + CHECK theo loại; hàm V1 giữ nguyên; có `preflight/postflight/rollback.sql`; dùng `prod-db.py` sau khi Owner duyệt riêng. Rollback phải xoá hàng `text` trước. Dữ liệu `bars` hiện có không đổi |
| Bundle cũ (kể cả app iOS đóng gói) gặp ghi chú `text` | Hàm V1 không sửa; hành vi từng bề mặt ở ma trận §17 (Feed: thẻ nhẹ · Chat: "không còn khả dụng" · link: báo stale) |
| Offset sai do Unicode/khoảng trắng | Offset theo điểm mã ở **cả hai phía**; `Intl.Segmenter` để co biên; test tiếng Việt dựng sẵn và tổ hợp (NFC/NFD), emoji ngoài BMP |
| Chọn lệch lá / vắt nhiều lá | Chặn, báo rõ, yêu cầu chọn lại (§14); không tạo ghi chú |
| Tìm lại chậm trong SQL | Chặn ≤300 lá × 4000 ký tự trong một khối; chỉ chạy khi lệch; đo thời gian trên dữ liệu thật (đọc-chỉ) trước khi mở |
| Tô nhầm khi `moved` mơ hồ | Chỉ nhận **đúng một** ứng viên, nếu không `stale` |
| Thẻ Feed dài/nặng | Nhánh văn bản không alphaTab; mặc định gọn; chiều cao đo trong E2E (mục tiêu < thẻ nhạc gọn 741px iPhone) |
| Cuộn nhảy khi mở rộng | Giữ test "không nhảy cuộn" của V1.3 |

**Kiểm thử đề xuất** (tái dùng `scripts/e2e-share-note.sh` + fixture: thêm khối `study` có `h/p/ul/ol/table/callout`, `note`, `objectives`, dấu tiếng Việt tổ hợp, đoạn trùng lặp):
- Thuần (Node): **đã có spec chạy được** `tests/class-social/text-anchor-spec.test.ts` (15 test, xem §18); khi cài đặt thật, SQL và FE phải cho cùng kết quả với spec.
- DB tạm (PG17 như `test-lesson-clip-card-db.sh`): `share_text_create` (quyền, trùng khoá, giới hạn, lá không tồn tại, trường cấm), `share_note_open_v2` mọi nhánh, hồi quy ô nhịp (hàng `bars` vẫn `ok/stale`), `card` lọc loại.
- E2E Chrome + WebKit, desktop + iPhone 390px: chọn một câu / một đoạn / ô bảng / mục danh sách; gửi Feed + Chat; mở đúng chỗ + `<mark>`; mở rộng/thu gọn không nhảy cuộn; no_access, locked, stale, moved; nhiều bài (không thêm renderer); không tràn ngang; chọn vắt lá; hồi quy toàn bộ V1.3.
- Sau deploy: smoke production không tài khoản giả (như đợt V1.3) + Owner thử bằng tài khoản thật.

## 11. Phạm vi nhỏ nhất mang lại giá trị thực tế (MVP đề xuất)

**Làm:**
1. Neo văn bản trong **một lá**, 1–500 ký tự, ở các khối `study` (mọi loại lá: `p` `h` `ul` `ol` `callout` ô `table`), `note`, `objectives`, `recap`, `assignment`, `checklist`.
2. Chọn bằng bôi đen (desktop + cảm ứng) + nhấn-một-đoạn; thanh đáy "Hỏi / Chia sẻ"; Composer hiện trích.
3. Chia sẻ lên **Feed và Chat** bằng chung `share_notes` (`anchor_kind='text'`); thẻ Feed với khung gọn/mở rộng, `<mark>`, các nút V1.3.
4. `ok` / `moved` (tìm lại trong khối, duy nhất) / `stale`; `?note=` mở đúng chỗ.
5. **Hạng mục UI (Owner bổ sung, cùng đợt, không deploy riêng): làm đẹp cụm nút thẻ chia sẻ Feed** — thiết kế ở §12.

**Không làm (ghi rõ chưa hỗ trợ):** hình, vùng ảnh, bảng theo khối, chọn vắt nhiều lá, `lead` của khối nhạc/`guidance`/`pieces[].note` (có thể mở ngay khi cần vì cùng cơ chế lá, nhưng để MVP nhỏ), Chat/Band Chat dựng khung (vẫn thẻ tham chiếu như V1.3), id khối bất biến, sửa giáo trình.

**Chia nhịp triển khai gợi ý** (một đợt deploy, ba cổng nội bộ): (a) DB + test DB cục bộ → (b) FE chọn/tô/khung/thẻ + E2E → (c) cụm nút + nghiệm thu staging cô lập → Owner duyệt → migration production qua `prod-db.py` → deploy → smoke.

## 12. Hạng mục UI đi cùng: cụm nút thẻ chia sẻ Feed

Hiện (V1.3): hai nút `flex:1` cùng hàng, `gap:8px`, "Mở trong giáo trình" (`cs-btn-soft`) sát "Thu gọn". Thiết kế:
- **Bố cục:** hàng `.cs-sn-actions` có `padding-top:12px`, `gap:12px`, `align-items:center`; thao tác phụ ở **trái**, thao tác chính ở **phải** (iOS: hành động chính ở cạnh phải/dưới).
- **"Xem đầy đủ" / "Thu gọn" (phụ):** nút văn bản (`ghost`): không nền, không viền, chữ màu `--cs-link` 15px/600, kèm chevron `ChevronDown`/`ChevronUp` (lucide) xoay theo trạng thái; vùng bấm `min-height:44px`, `min-width:44px`, đệm ngang 4px **không co** (`flex:0 0 auto`) → không bao giờ bị ép chữ.
- **"Mở trong giáo trình" (chính):** nút nền đặc `--cs-primary` (#4338CA), chữ trắng 15px/600, `border-radius:12px`, `min-height:44px`, đệm ngang 16px, biểu tượng `BookOpen` (hoặc `ArrowUpRight`) trước chữ, `flex:1 1 auto` để chiếm phần còn lại; `white-space:nowrap` với `text-overflow:ellipsis` dự phòng khi 320px.
- **Khi chỉ có nút chính** (không có "Xem đầy đủ"): nút chính chiếm trọn chiều ngang tối đa 280px, canh phải (desktop) / full-width (iPhone).
- **Trạng thái:** focus-visible vòng 2px `--cs-primary` cách 2px; `:active` mờ 0.88; `aria-expanded` giữ; `aria-label` "Mở trong giáo trình: …" giữ.
- **Giữ nguyên:** `href`, phân quyền, tham chiếu, `data-testid`. Chỉ CSS + markup `.cs-sn-actions` trong `ShareNotePost.tsx`.
- **Kiểm:** iPhone 390 và 320, desktop 1280; thu gọn + mở rộng; vùng bấm ≥ 44px đo bằng E2E (đã có phép đo hàng nút ở bước 10g); ảnh trước/sau.
- **Cập nhật E2E:** bước 10g đang kiểm "hai nút cùng một hàng, mỗi nút ≥ 44px" — giữ; thay phép kiểm viền/độ nổi bật nếu cần.

## 13. Câu hỏi cần Owner/ChatGPT quyết trước khi cho phép triển khai
1. Chấp nhận **một migration cộng thêm** cho `share_notes` (§6.1–6.2) thay vì bảng riêng `share_text_*`? (Đề xuất: mở rộng `share_notes` — một hệ thống, theo nguyên tắc kiến trúc.)
2. Chấp nhận **chỉ băm, không lưu trích dẫn**, và hệ quả: sửa đúng câu được chọn → `stale`? (Đề xuất: có.)
3. Phạm vi lá cho MVP: nhóm `study` + `note` + `objectives` + `recap` + `assignment` + `checklist` có đủ? Có muốn thêm `lead`/`guidance` ngay?
4. Giữ **chọn một lá**, vắt nhiều lá để lát cắt sau?
5. Chat/Band Chat chưa dựng khung văn bản (như V1.3), có chấp nhận?
6. Cụm nút §12: biểu tượng `BookOpen` hay `ArrowUpRight` cho nút chính?

---

# PHẦN BỔ SUNG SAU KHI OWNER DUYỆT HƯỚNG D

## 13b. Quyết định đã chốt (Owner, sau commit 88adba66)
1. Mở rộng `share_notes` bằng migration cộng thêm, tương thích ngược. 2. Chỉ lưu băm + thông tin định vị. 3. MVP: `study`, `note`, `objectives`, `recap`, `assignment`, `checklist` (`lead`/`guidance` để sau). 4. Chỉ chọn trong **một lá**. 5. Chat/Band Chat vẫn thẻ tham chiếu. 6. Nút "Mở trong giáo trình" dùng biểu tượng **BookOpen**; cụm nút làm cùng đợt V2 (§12 giữ nguyên, chọn BookOpen).
Điều chỉnh bắt buộc A–D xử lý ở các mục sau.

## 14. (A) Chọn vượt phạm vi: chặn, không co, không tạo ghi chú sai ý định
Mọi trạng thái do client quyết trước khi có thể gửi; server **lặp lại** các kiểm tra (không tin client).

| Vùng chọn của người dùng | Hành vi |
|---|---|
| Trong một lá hợp lệ, 1–500 ký tự | Thanh đáy: trích ngắn + [Hỏi / Chia sẻ] [Bỏ chọn] |
| Vắt qua ≥ 2 lá (hai đoạn, hai mục danh sách, hai ô bảng…) | Thanh đáy **cảnh báo** (`role="status"`): "Bạn đang chọn nhiều đoạn. Hãy chọn trong một đoạn." — nút "Hỏi / Chia sẻ" **ẩn/khoá**; vùng chọn của người dùng **giữ nguyên** (không tự thu nhỏ). Chỉ có "Bỏ chọn" |
| Có phần nằm ngoài lá hợp lệ (tiêu đề khung, bản nhạc, nút, link tải, ô `___`, lá thuộc khối ngoài MVP như `lead`/`guidance`) | Cảnh báo: "Phần này chưa chia sẻ được. Hãy chọn trong nội dung văn bản." — khoá |
| > 500 ký tự | Cảnh báo "Đoạn chọn dài quá 500 ký tự. Hãy chọn ngắn hơn." — khoá |
| Chỉ khoảng trắng / rỗng | Không hiện thanh |
| Chọn bắt đầu/kết thúc giữa cụm ký tự | Client co biên ra ranh giới grapheme **trong cùng một lá** (không đổi ý định: chỉ làm tròn tới ký tự trọn); server chặn nếu vẫn cắt giữa cụm (§16) |

Chỉ **biên giữa các ký tự trọn** mới được tự làm tròn; **không bao giờ** làm tròn qua ranh giới lá. Kết quả: không thể tạo ghi chú khác với thứ người dùng đã bôi đen.
Nút "Chạm một đoạn" (chế độ Khoanh để hỏi) luôn chọn **đúng một lá nguyên vẹn** nên không rơi vào các nhánh trên (nếu lá > 500 ký tự: cảnh báo, người dùng bôi đen đoạn con).
Server (`share_text_create`): đường dẫn lá không nằm trong tập lá của loại khối (§15.1) → từ chối bằng **một thông báo chung** (`22023`, như V1).

## 15. (B) Đặc tả nhận dạng và tìm lại (đã có mô hình chạy được, §18)

### 15.1 Lá hợp lệ (danh sách trắng cứng theo loại khối)
| kind | Đường dẫn lá (trong khối) |
|---|---|
| `study` | `blocks[j].text` với `b ∈ {h,p,callout}` · `blocks[j].items[k]` với `b ∈ {ul,ol}` · `blocks[j].rows[r][c]` với `b = table` |
| `note` | `text` |
| `objectives`, `checklist` | `items[k]` |
| `recap` | `steps[i].items[k]` |
| `assignment` | `items[k].text` |
Loại bỏ: chuỗi rỗng, ô `___` (`^_{2,}$` sau `trim`), mọi trường khác (`url`, `href`, `tex`, `label`, `lead`, `guidance`, `assets`, `quiz`, `id`…). Thứ tự = thứ tự hiển thị. Một bộ liệt kê duy nhất, cài ở SQL và ở FE; test chung đối chiếu hai bộ cho cùng danh sách đường dẫn trên cùng fixture.

### 15.2 Dữ liệu lưu (chỉ băm + định vị)
`section_idx` (gợi ý), `text_path` (lá), `char_from`/`char_to` (điểm mã, 0-based, nửa mở `[from,to)`), `text_sha`, `ctx_sha`, `block_fp`. Đoạn chọn, tiền tố, hậu tố **không được lưu**.

### 15.3 Cách tính `block_fp`
```
block_fp = hex( sha256( utf8( 'tsa1' ␟ kind ␟ title ) ) )      -- ␟ = U+001F
  kind  = section.kind        title = section.title nếu là chuỗi, ngược lại ''
```
Không chuẩn hoá Unicode, không cắt khoảng trắng, không phân biệt-hoa-thường-hoá. `'tsa1'` là phiên bản thuật toán (đổi cách tính ⇒ đổi tiền tố, hàng cũ vẫn tính theo phiên bản cũ qua cột `fp_ver` nếu cần). Chỉ dùng để **tìm lại khối khi chỉ số đã dịch**, không dùng để chứng minh quyền hay tính đúng đắn của đoạn chọn (đoạn chữ mới là nhận dạng).
`ctx_sha = hex(sha256(utf8( tiền_tố ␟ hậu_tố )))`, tiền/hậu tố ≤ 32 điểm mã **trong cùng lá** (không vượt biên lá). Chỉ dùng để phân xử khi có ≥ 2 ứng viên.

### 15.4 Hai khối giống nhau
- Khối **không tiêu đề** (vd `note`, `objectives`) có `block_fp` chỉ theo `kind` → nhiều khối cùng fp là bình thường; bước 3 giới hạn ≤ 8 khối cùng fp, quá thì `stale`.
- Hai khối **giống hệt** (cùng kind, tiêu đề, chữ): nếu vị trí gốc còn đúng thì `ok` (bước 1 chạy trước, không bị bản sao làm nhiễu). Sau khi dịch chuyển, hai ứng viên không phân xử được ⇒ `stale`. Thứ tự xuất hiện ("khối thứ n trong các khối trùng") **bị loại** vì không đáng tin khi Thầy chèn/xoá bản sao.

### 15.5 Quy trình (thứ tự cố định, dừng ở bước đầu cho kết quả)
Tiền điều kiện: người gọi đã qua `share_note_visible` và `share_note_score_ok` (§15.8).
1. **Đúng vị trí:** lá tại `(section_idx, text_path)` tồn tại và `sha(substr(lá, from+1, to−from)) = text_sha` và biên hợp lệ ⇒ **`ok`**. (Không đòi `block_fp` khớp: nhận dạng là chính đoạn chữ.)
2. **Cùng chỉ số khối, mọi lá hợp lệ:** quét mọi cửa sổ có độ dài `L = to−from`; ứng viên = cửa sổ có băm khớp và biên hợp lệ. Đúng 1 ứng viên ⇒ **`moved`**. ≥ 2 ⇒ lọc bằng `ctx_sha`: còn đúng 1 ⇒ `moved`; ngược lại ⇒ **`stale`** (dừng, **không** sang khối khác). 0 ứng viên ⇒ sang bước 3.
3. **Khối khác cùng `block_fp`:** gom các khối (≠ khối gợi ý) có `block_fp` bằng nhau. 0 khối hoặc > 8 khối ⇒ `stale`. Quét như bước 2 trên tất cả các khối này rồi hợp lại: đúng 1 ứng viên (hoặc đúng 1 sau lọc `ctx_sha`) ⇒ `moved`, ngược lại ⇒ `stale`.
4. Mọi nhánh khác (lỗi dữ liệu, kiểu không phải chuỗi, ngân sách vượt) ⇒ `stale`.

### 15.6 "Kết quả duy nhất" nghĩa là gì
Duy nhất = **đúng một** vị trí `(khối, lá, offset)` thoả: băm đoạn chọn khớp **và** biên hợp lệ (§16.4) **và** (nếu ≥ 2 trước đó) `ctx_sha` khớp. Hai cửa sổ chồng lấn trong cùng lá (vd đoạn tự lặp "aaa") được tính là hai ứng viên khác nhau. Không bao giờ chọn "cái gần nhất", "cái đầu tiên", hay "cái cùng chỉ số".

### 15.7 Bảng trạng thái trả về (`share_note_open_v2`)
| Điều kiện (kiểm theo thứ tự) | Trả về | Ghi chú |
|---|---|---|
| Không đăng nhập · ghi chú không tồn tại · đã xoá · người gọi không THẤY câu hỏi (`share_note_visible` sai) | **0 hàng** | Không phân biệt lý do — y V1 |
| Thấy câu hỏi nhưng không mở được giáo trình (`share_note_score_ok` sai: ngoài lớp/không quyền/buổi chưa xuất bản) | `no_access` | Chỉ trả: `note`, tác giả, `is_author`, lớp, số buổi, `created_at` (đã có trong thẻ Feed). **Không** trả `section_idx`, đường dẫn, offset, băm, số lượng, thời gian tìm |
| Qua cổng quyền, tìm lại bước 1 | `ok` | Trả `section_idx`, `text_path`, `char_from`, `char_to`, `text_sha` |
| Qua cổng quyền, tìm lại bước 2/3 thành công | `moved` | Như `ok` nhưng toạ độ đã giải quyết |
| Qua cổng quyền, không tìm lại được hoặc mơ hồ hoặc vượt ngân sách | `stale` | Chỉ `note` + metadata như `no_access`. Không nêu lý do (mơ hồ / đã sửa / đã xoá) |
Khoá buổi: **không** nằm trong RPC này (như V1) mà ở `share_note_session_open(p_note)`; client chỉ tải giáo trình khi `open_v2 ∈ {ok,moved}` **và** `session_open = true`. Thứ tự cổng không đổi.

### 15.8 Fail-closed và giới hạn hiệu năng
- **Ngân sách:** tối đa **60.000 cửa sổ băm** cho một lần tìm lại (cộng dồn bước 2 + 3); tối đa 300 lá/khối; mỗi lá xét ≤ 4.000 điểm mã đầu (lá dài hơn: không quét phần sau, và ghi chú tạo mới bị từ chối nếu vùng chọn nằm sau mốc đó); tối đa 8 khối ở bước 3. Hết ngân sách ⇒ `stale` (không "tạm chấp nhận").
- **Đo thực** trên PostgreSQL 17.11 (cụm tạm, không production): 51.692 cửa sổ băm (200 lá × ~290 ký tự tiếng Việt, đoạn 40 ký tự) ≈ **74 ms**. Trần 60.000 ⇒ trường hợp xấu nhất ~ 90 ms, và **chỉ** khi bước 1 thất bại (trường hợp thường là 1 lần băm). Các hàm `STABLE`, không ghi dữ liệu.
- **Đường nóng:** thẻ Feed gọi `open_v2` một lần mỗi thẻ (hàng đợi 1 yêu cầu + cache TTL 2 phút theo `uid`, đã có ở V1.1) ⇒ không tăng số yêu cầu. Cache lưu kết quả `ok/moved/stale`, không lưu nội dung.
- **Không đoán:** mọi nhánh không chắc chắn kết thúc ở `stale`; không "gần đúng", không tô khi chưa khẳng định.
- **Lộ thông tin:** (1) RPC chạy tìm lại **chỉ sau** hai cổng quyền, nên người ngoài quyền không kích hoạt được việc quét và không đo được thời gian; (2) phản hồi `stale/no_access` đồng nhất, không đếm ứng viên; (3) `create` dùng **một** thông báo lỗi chung cho: buổi không tồn tại / không quyền / khối không tồn tại / lá không hợp lệ / đoạn rỗng (y V1); (4) bảng không lưu chữ nên dò bảng không lộ nội dung giáo trình; (5) `moved` trả vị trí trong nội dung mà người gọi **đã được phép đọc** qua RLS.
- **Kiểm chứng phía client:** `ok/moved` kèm `text_sha`; client băm `SubtleCrypto` của `cpSlice(lá, from, to)` (UTF-8) và **chỉ tô khi trùng** — bảo hiểm cuối cùng nếu JS và PG bất đồng. Không có `crypto.subtle` (ngữ cảnh không an toàn) ⇒ vẫn tô nếu kiểm tra số học (§16.5) đạt, ghi nhận trong log DEV.

## 16. (C) Chỉ số ký tự nhất quán JavaScript ↔ PostgreSQL ↔ Unicode tiếng Việt

### 16.1 Đơn vị duy nhất = ĐIỂM MÃ (code point), 0-based, nửa mở `[from,to)`
- PostgreSQL (CSDL UTF8): `char_length`, `substr`, `position`, `left/right` đếm **điểm mã** ✔. **Cấm** dùng `octet_length`, `length(bytea)`, hoặc so sánh theo byte. Migration có cổng: `pg_encoding_to_char(encoding) = 'UTF8'`.
- JavaScript, DOM `Range`, `String.length/slice/substring`, `Intl.Segmenter`: đơn vị **UTF-16** ✘. Mọi toạ độ neo đi qua 4 hàm duy nhất (`cpLen`, `cpSlice`, `cpToUtf16`, `utf16ToCp`); lint/test cấm dùng `.length/.slice` trên toạ độ neo. Range rơi giữa cặp thay thế ⇒ từ chối.
- Băm: `sha256` trên **bytes UTF-8** của đoạn chọn, **chỉ tính ở server** (`convert_to(..., 'UTF8')`); client chỉ băm để *kiểm tra lại* bằng cùng quy tắc.

### 16.2 Đã kiểm chứng bằng PostgreSQL thật
`tests/class-social/fixtures/text-anchor-pg-vectors.json` (do PostgreSQL 17.11 UTF8 sinh, cụm tạm): `length`, `substr`, `sha256`, `position` trên: ASCII · tiếng Việt NFC · tiếng Việt NFD · emoji ngoài BMP (🎸 😀) · ZWJ gia đình (👨‍👩‍👧‍👦) · skin-tone + cờ (👍🏽 🇻🇳) · CRLF + tab · ký hiệu nhạc (♯ ♭ 𝄞). Test JS đối chiếu **khớp 100%**; và xác nhận 4/8 mẫu có `UTF-16 ≠ điểm mã` (bẫy thật đã được chặn).

### 16.3 Chuẩn hoá: KHÔNG chuẩn hoá ở bất cứ đâu
Băm theo đúng chuỗi lưu trong jsonb. Nếu Thầy lưu lại cùng câu nhưng khác dạng NFC/NFD thì băm khác ⇒ `stale` (an toàn, ghi rõ là giới hạn). Lý do: chuẩn hoá thay đổi số điểm mã ⇒ lệch toạ độ giữa JS và PG và làm vùng tô trượt.
`jsonb` của PostgreSQL từ chối `\u0000` và cặp thay thế lẻ ⇒ chuỗi giáo trình luôn là dãy điểm mã hợp lệ. CRLF/tab được giữ nguyên (đếm là 1 điểm mã mỗi ký tự, DOM giữ nguyên trong text node).

### 16.4 Biên không cắt giữa cụm ký tự (tiếng Việt tổ hợp, emoji)
- **Client:** `Intl.Segmenter('vi', {granularity:'grapheme'})` co biên ra ranh giới grapheme (Safari ≥ 14.1; app iOS tối thiểu iOS 15 ✔). Thiếu `Intl.Segmenter` ⇒ dùng quy tắc dự phòng của server (dưới) và nếu vẫn cắt giữa cụm ⇒ cảnh báo, không gửi.
- **Server (lớp hai):** từ chối khi ký tự **đầu** vùng chọn, hoặc ký tự **ngay sau** vùng chọn, thuộc `[U+0300–036F, U+1AB0–1AFF, U+1DC0–1DFF, U+20D0–20FF, U+FE00–FE0F, U+FE20–FE2F, U+200D, U+1F3FB–1F3FF]`, hoặc ký tự **cuối** vùng chọn là ZWJ (U+200D). Phủ: dấu tổ hợp tiếng Việt dạng NFD, biến thể, ZWJ, skin-tone. Cờ (hai ký tự chỉ-báo-vùng) không kiểm được bằng dải đơn giản ⇒ dựa vào client; hiển thị còn có (16.5).
- Đã có test thuần cho cả hai lớp (tiếng Việt NFD "ữ" = u + ◌̛ + ◌̃, ZWJ gia đình).

### 16.5 Vùng tô không lệch (hiển thị)
1. Server trả `char_from/char_to` (điểm mã) + `text_sha`.
2. Client kiểm: `0 ≤ from < to ≤ cpLen(lá)` và `to − from ≤ 500`; `cpSlice` rồi băm khớp `text_sha`; sai ⇒ **không tô** (coi như `stale` về mặt hiển thị).
3. Đổi điểm mã → UTF-16 (`cpToUtf16`), rồi mở rộng **ra ngoài** cho tới ranh giới grapheme (chỉ để hiển thị; không đổi dữ liệu) trước khi chia `[trước][<mark>][sau]` — tránh dấu tổ hợp bị tách khỏi chữ gốc trên màn hình.
4. Lá phải được render **đúng chuỗi nguồn** (React in nguyên, không `trim`, không thay `___` ở lá hợp lệ); lá có `<mark>` chia ba text node, tổng nối lại bằng chuỗi nguồn (test hồi quy).
5. Phía gửi: `Range` → offset UTF-16 trong chuỗi nguồn của lá (bằng TreeWalker cộng dồn qua các text node) → `utf16ToCp` → làm tròn grapheme → tính độ dài; mọi bước dùng đúng 4 hàm trên.

## 17. (D) Ma trận tương thích ngược

Nguyên tắc: **không sửa hàm V1** (`share_note_create/open/card/session_open`, `dm_share`, `social_share_share_note`, `share_note_delete` giữ nguyên bản đang LIVE); thêm hàm mới `share_text_create`, `share_note_open_v2`, `share_note_card_v2`, `social_share_share_text`. Hàng `bars` giữ nguyên giá trị; cột mới có mặc định; cột nhạc nới `NULL` nhưng `CHECK` theo `anchor_kind`. Bài Feed văn bản có payload `{"anchor":"text", …}` **không có** `bar_from/bar_to`.

| Máy khách | Ghi chú **ô nhịp (V1)** | Ghi chú **văn bản (V2)** |
|---|---|---|
| **Web mới** (V2) | Gọi `open_v2` / `card_v2`: kết quả y hệt V1 (`anchor_kind='bars'`, cùng trạng thái ok/stale/no_access). Mọi test V1.3 vẫn chạy. Khung/nhạc/nút không đổi | Đầy đủ: chọn, chia sẻ, khung, tô, `?note=` |
| **Web cũ** (tab mở sẵn, bundle đã cache) | Không đổi: hàm V1 còn nguyên, hàng `bars` còn nguyên cột ⇒ hoạt động như hôm nay | **Feed:** `describe()` thấy thiếu `bar_from/bar_to` ⇒ trả `null` ⇒ thẻ "nhẹ", không lỗi (hành vi đã có sẵn, xem `registry.ts`). **Chat:** `share_note_card` V1 trả `bar_from = null` ⇒ `Number(null)=0 < 1` ⇒ thẻ không hợp lệ ⇒ "không còn khả dụng". **Mở link `?note=`:** `share_note_open` V1 trên hàng văn bản ⇒ đường dẫn nhạc `NULL` ⇒ `stale` ⇒ báo "bản nhạc đã được cập nhật" (**lời lẽ chưa chuẩn nhưng vô hại**, không lộ nội dung). Tạo ghi chú văn bản: không thể (bundle cũ không có giao diện) |
| **App iOS đóng gói cũ** (bundled, không tự cập nhật; CLAUDE.md "KIẾN TRÚC BUNDLED") | Như web cũ: hoạt động bình thường vì hàm V1 nguyên vẹn | Như web cũ: thẻ Feed nhẹ, thẻ Chat "không còn khả dụng", link `?note=` báo stale. **Không cần buộc cập nhật.** Người dùng thấy đầy đủ khi cập nhật bản app có V2 (đợt build native riêng, do Owner quyết) hoặc mở trên web |
| **Rollback** (gỡ V2) | Nguyên vẹn (hàng `bars` không bị đổi) | Phải xoá hàng `anchor_kind='text'` (và bài Feed `anchor:"text"`) **trước** khi khôi phục `NOT NULL`; thứ tự trong `rollback.sql`. FE rollback: bản cũ hiển thị thẻ nhẹ cho bài văn bản còn lại |

Điểm kiểm bắt buộc trong E2E/DB test: (1) hồi quy toàn bộ V1.3 trên hàng `bars` bằng **hàm V1** và bằng **hàm v2**, cùng kết quả; (2) bundle V1.3 (build từ `main 060715fc`) chạy trên DB đã migrate: Feed + Chat + `?note=` với một ghi chú `bars` và một ghi chú `text`; (3) `NOT NULL` → `NULL` không làm hàm V1 trả sai (các hàm V1 chỉ đọc cột nhạc của hàng `bars`); (4) `dm_share('share_note')` gửi được ghi chú văn bản vào Chat (kiểm tra theo `share_note_score_ok`, không đổi `dm_messages_ref_valid_check`).

## 18. Spec chạy được (không phải mã tính năng)
- `tests/class-social/text-anchor-spec.test.ts` — 15 test, chạy trong `npm run test:class-social`: chỉ số điểm mã khớp PostgreSQL; đổi UTF-16↔điểm mã; biên grapheme/ZWJ/NFD; `block_fp`; tập lá hợp lệ; `buildAnchor` (từ chối vùng lệ); `ok`/`moved`/`stale`; hai khối giống hệt; đoạn lặp + `ctx_sha`; ngân sách; NFC/NFD; tiếng Việt tổ hợp + emoji.
- `tests/class-social/fixtures/text-anchor-pg-vectors.json` — vector do PostgreSQL 17.11 sinh (cụm tạm).
- Các hàm tham chiếu nằm **trong file test**, không trong `src/`; khi triển khai, SQL và FE phải cho cùng kết quả với chúng.

## 19. Rủi ro còn lại (sau điều chỉnh)
1. **Cờ và chuỗi regional-indicator** không kiểm được bằng dải ký tự phía server; dựa vào client (`Intl.Segmenter`) + hiển thị làm tròn grapheme. Rủi ro thấp (nội dung giáo trình hầu như không có).
2. **Sửa đúng câu đã chọn, đổi NFC↔NFD, hoặc đổi tiêu đề khối + dịch chỉ số cùng lúc** ⇒ `stale` (đúng thiết kế; có thể khiến người dùng thấy "stale" sau khi Thầy chỉnh giáo trình). Giải pháp dài hạn = id khối bất biến.
3. **Hai khối/hai lá giống hệt** sau khi dịch chuyển ⇒ `stale`; đoạn chọn ngắn (vd 1–2 từ) dễ trùng ⇒ `stale` thường hơn. Cân nhắc đặt tối thiểu 8 điểm mã không phải khoảng trắng? (đề xuất: **tối thiểu 4**, cảnh báo "Đoạn chọn quá ngắn"; Owner chốt).
4. **Chi phí SQL khi tìm lại**: đã đo ~74 ms/52k cửa sổ và chặn ở 60k; cần đo lại trên dữ liệu giáo trình **thật** (đọc-chỉ, sau khi Owner cho phép) trước khi bật.
5. **Bundle cũ báo "bản nhạc đã được cập nhật" cho ghi chú văn bản** (lời lẽ sai nhưng vô hại). Có thể xử lý bằng sửa nhỏ `share_note_open` V1 (trả 0 hàng cho `anchor_kind <> 'bars'`) nếu Owner muốn lời lẽ trung tính hơn — đánh đổi: đụng một hàm V1 đang LIVE. Đề xuất: **không sửa**.
6. **Migration chạm bảng LIVE** (nới `NOT NULL`, thêm `CHECK`): cần `preflight`/`postflight`/`rollback.sql`, chạy qua `prod-db.py` sau duyệt riêng; khoá ngắn, bảng nhỏ.
7. **`Intl.Segmenter` / `SubtleCrypto`** vắng mặt trên trình duyệt rất cũ: đã có đường lùi (cảnh báo/không gửi; tô theo kiểm tra số học).
8. **Tối thiểu/tối đa độ dài** và cấu hình ngân sách (60k cửa sổ, 300 lá, 4.000 điểm mã/lá, 8 khối) là tham số thiết kế — Owner/ChatGPT có thể chỉnh trước khi cài.

