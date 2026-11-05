# Contextual Share V2 — Chia sẻ vùng văn bản giáo trình (KHẢO SÁT + THIẾT KẾ)

> Trạng thái: **chỉ khảo sát và thiết kế.** Nhánh `feat/contextual-share-v2` (từ main `060715fc`, V1.3 đã nghiệm thu ĐẠT).
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
- **Phạm vi chọn hợp lệ** (MVP): nằm trọn trong **một lá văn bản** (một đoạn `p`, một mục `ul/ol`, một ô bảng, một `callout`, một `note`…), 1–500 ký tự. Chọn vắt qua nhiều lá → tự **co về lá đầu** và nói rõ ("Đang chọn trong một đoạn. Hãy chọn từng đoạn một."). Không đoán, không ghép.
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
**Danh sách trắng tên trường** (chống lộ trường nhạy cảm): `blocks`, `items`, `steps`, `rows`, `text`, `label`, `lead`, `note`, `title`, `guidance`, `what`, `message`, `prompt`. **Cấm** `url`, `href`, `tex`, `assets`, `quiz`, `id`. (Link video, tệp tải về, đáp án không bao giờ chia sẻ được.)

RPC mới (hàm V1 giữ nguyên để hoàn tác sạch và để bundle cũ — kể cả app iOS đóng gói — không vỡ):
- `share_text_create(p_session, p_section, p_path, p_from, p_to, p_note, p_client_key) → uuid` — cùng khuôn `share_note_create`: kiểm đăng nhập/lớp, quyền (`share_note_score_ok`), lá tồn tại và là chuỗi, đoạn chọn ≤500 ký tự và không rỗng sau khi bỏ khoảng trắng, giới hạn tần suất (cùng bộ đếm 10/phút), idempotent theo `(author, client_key)`. **Server tự cắt đoạn chọn từ jsonb rồi tự tính** `text_sha`, `ctx_sha`, `block_fp`.
- `share_note_open_v2(p_id) → (status, kind, note, author…, session_no, section_idx, path, bar_from, bar_to, text_path, char_from, char_to, …)`:
  `status ∈ ok | moved | stale | no_access` (0 hàng = không khả dụng). `moved` = đã **tìm lại** ở vị trí khác; trả vị trí đã giải quyết.
  Thuật toán `resolve_text` (đều trong **một khối**, tìm bằng `position()` có sẵn):
  1. Đúng vị trí gợi ý: băm `substr(lá, from+1, len)` khớp → `ok`.
  2. Cùng khối: duyệt các lá trong danh sách trắng của khối (giới hạn ≤ 300 lá × ≤ 4000 ký tự); mỗi lá dò vị trí xuất hiện của đoạn có độ dài `len` đối chiếu băm; còn nhiều ứng viên thì lọc bằng `ctx_sha`.
  3. Không thấy trong khối đúng chỉ số: tìm khối có `block_fp` trùng, **duy nhất**, rồi lặp bước 2.
  4. Đúng **một** kết quả → `moved`; 0 hoặc >1 → `stale`. Không đoán.
  Chi phí chỉ phát sinh khi lệch; trường hợp thường gặp là bước 1 (một lần băm).
- `share_note_card` / `social_share_share_note`: bổ sung cột `anchor_kind` vào kết quả/payload. Payload Feed vẫn **không có nội dung giáo trình**: `{…, "anchor":"text"}` thay `bar_from/bar_to`.
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
| Bundle cũ (kể cả app iOS đóng gói) gặp ghi chú `text` | `share_note_open` (v1) trên hàng `text` trả `stale` (đường dẫn nhạc NULL) → bundle cũ báo "đã cập nhật", không lỗi. `share_note_card` v1 phải **lọc `anchor_kind='bars'`** để thẻ Chat cũ không gặp `bar_from=null` |
| Offset sai do Unicode/khoảng trắng | Offset theo điểm mã ở **cả hai phía**; `Intl.Segmenter` để co biên; test tiếng Việt dựng sẵn và tổ hợp (NFC/NFD), emoji ngoài BMP |
| Chọn lệch lá / vắt nhiều lá | Co về lá đầu + thông báo; test chọn vắt khối |
| Tìm lại chậm trong SQL | Chặn ≤300 lá × 4000 ký tự trong một khối; chỉ chạy khi lệch; đo thời gian trên dữ liệu thật (đọc-chỉ) trước khi mở |
| Tô nhầm khi `moved` mơ hồ | Chỉ nhận **đúng một** ứng viên, nếu không `stale` |
| Thẻ Feed dài/nặng | Nhánh văn bản không alphaTab; mặc định gọn; chiều cao đo trong E2E (mục tiêu < thẻ nhạc gọn 741px iPhone) |
| Cuộn nhảy khi mở rộng | Giữ test "không nhảy cuộn" của V1.3 |

**Kiểm thử đề xuất** (tái dùng `scripts/e2e-share-note.sh` + fixture: thêm khối `study` có `h/p/ul/ol/table/callout`, `note`, `objectives`, dấu tiếng Việt tổ hợp, đoạn trùng lặp):
- Thuần (Node): offset code point, co biên, `resolve_text` (ok/moved/stale/mơ hồ), danh sách trắng, `studyContext`.
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
