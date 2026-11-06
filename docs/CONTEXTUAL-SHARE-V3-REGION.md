# Contextual Share V3.1 — "Khoanh để hỏi" (PROTOTYPE hoàn thiện để nghiệm thu, chưa phát hành)

> Trạng thái: **prototype trên nhánh `feat/contextual-share-v3-region`**, chạy trên staging cô lập + DB tạm. Chưa merge, chưa migrate production.
> V3.1 (commit sau `0c0be78e`): khoanh ĐÚNG phần được bao (không lấy cả lá/cả bản nhạc), stale theo từng phần tử, Feed dựng nguyên cảnh, tự cuộn khi kéo sát mép, vẽ lại theo sự kiện bố cục.
> Mục tiêu Owner: học viên nhìn thấy vùng nào trên giáo trình cũng khoanh được (chữ, bản nhạc, bảng, danh sách, hình, hỗn hợp), hỏi và chia sẻ — như dùng bút khoanh trên giấy.

## 1. Kiến trúc đề xuất

**Một loại neo dùng chung** `anchor_kind = 'region'` thay vì thêm neo riêng cho từng loại nội dung. Tái dùng `share_notes`, Composer, Feed, Chat, cổng truy cập V1/V2 (`share_note_visible → share_note_score_ok → share_note_session_open → RLS`).

```
khung chữ nhật (người kéo)  ──probe DOM──▶  PHẦN theo khối giáo trình  ──server──▶  share_notes.region (jsonb)
   toạ độ client, tạm thời                   {sec, leaves[], scores[], box‰}          + fp + sha (server tự tính)
```

Mỗi **phần** (một khối giáo trình mà khung bao được ít nhất một phần tử):

| Trường | Ý nghĩa | Nguồn |
|---|---|---|
| `sec` | chỉ số khối (gợi ý) | client |
| `leaves` | `[{p, r:[[từ,đến),…]}]`: đường dẫn **lá văn bản** (cùng hệ V2, `data-tp`) + các **đoạn chữ theo ĐIỂM MÃ** mà khung thực sự bao | client → server kiểm lá tồn tại, đoạn nằm trong lá, tăng dần, ≤ 1000 điểm mã, biên không cắt cụm ký tự |
| `scores` | bản nhạc + **dải ô** (1-based) mà khung bao ≥ 50% diện tích ô (cùng hệ V1.3, từ `boundsLookup` alphaTab) | client → server kiểm đường dẫn ra alphaTex |
| `box` | khung theo ‰ hộp khối — **chỉ dùng khi phần không có phần tử gốc** (sơ đồ, hình, khoảng trống) | client |
| `fp` | băm (loại + tiêu đề) khối | **server** |
| `leaves[].r[].s / .c` | băm đoạn chữ / băm ngữ cảnh ≤ 32 điểm mã hai phía (cùng hàm V2) | **server** |
| `scores[].x` | băm alphaTex của bản nhạc | **server** |
| `sha` | băm TOÀN KHỐI — **chỉ cho phần không có phần tử gốc** (hình) | **server** |

Không có pixel làm neo, không ảnh chụp, không bản sao nội dung, không nhân đôi asset. Client **không gửi** băm; server không trả băm.

## 2. Cách neo vào tài liệu gốc (và vì sao không phải toạ độ màn hình)

* **Khung kéo = công cụ nhập**, không phải thứ lưu (điểm kéo giữ theo toạ độ TRANG nên cuộn giữa chừng không làm lệch). Thả chuột → `buildParts()` đổi khung thành **tập phần tử tài liệu**:
  * chữ: đo hộp từng điểm mã (Range) → **từ** nào có ≥ 50% ký tự với tâm nằm trong khung thì lấy cả từ; từ liên tiếp nối thành một đoạn; khung bao trọn lá ⇒ cả lá. Khoanh nửa đoạn ⇒ chỉ nửa đoạn; khoanh nửa phải của vài dòng ⇒ nhiều mảnh rời; khoanh một hàng bảng ⇒ chỉ các ô của hàng đó;
  * nhạc: chỉ các ô có ≥ 50% diện tích nằm trong khung ⇒ vài ô, không cả bản nhạc;
  * khối không có phần tử gốc: hộp ‰.
* **Vẽ lại = tra lại đúng chữ/ô** trong DOM hiện tại (`drawParts()`): đoạn chữ → `Range.getClientRects()` theo điểm mã; ô nhịp → `rectsForBars` theo lần khắc hiện hành của alphaTab. Chữ xuống dòng, đổi font, đổi bề rộng, zoom, xoay máy đều tự đi theo chữ.
* **Cập nhật theo sự kiện, không hỏi định kỳ**: `ResizeObserver` (trang + từng khối), `MutationObserver`, `fonts.loadingdone`, `resize/orientationchange`, và sự kiện "alphaTab khắc xong" (`notifyLayoutChange`). Gộp về một lần/khung hình.
* **Người soạn thấy đúng thứ người nhận sẽ thấy**: sau khi thả, vùng được vẽ lại từ chính neo bằng cùng bộ vẽ (`RegionHighlight`).
* **Feed**: dựng nguyên cảnh bằng chính renderer giáo trình (`ContextSectionView`) — khối gốc, đoạn chữ tô cam đúng từng đoạn (`<mark>`), bản nhạc chỉ trích đoạn đúng dải ô, phần hình có khung nét đứt. Mặc định gọn (≤ 3 khối, ≤ 1 bản nhạc sống, cửa sổ study quanh phần được khoanh); "Xem đầy đủ" hiện cả tiểu mục / mọi khối / mọi bản nhạc. Nút "Mở trong giáo trình" giữ nguyên.
* **Phần gần đúng được đánh dấu**: phần chỉ có hộp ‰ vẽ bằng **sọc + viền nét đứt** và ghi "gần đúng". Không giả vờ neo chính xác.
* **Giáo trình đổi** (fail-closed, server) — chỉ so cái ĐƯỢC KHOANH:
  * đoạn chữ: đúng vị trí (băm đoạn khớp) ⇒ ok; lệch ⇒ thử cùng độ dời của đoạn trước trong lá ⇒ rồi `share_text_resolve` của V2 (duy nhất, hoặc duy nhất theo ngữ cảnh) ⇒ moved; mơ hồ ⇒ stale. Tối đa 6 lần tìm đắt cho cả vùng;
  * bản nhạc: băm alphaTex phải còn khớp (hoặc duy nhất ở khối khác cùng loại+tiêu đề);
  * sửa câu/khối KHÁC, đổi tiêu đề khối, thêm câu trước/sau đoạn được khoanh ⇒ **không stale**;
  * sửa chính đoạn được khoanh / bản nhạc được khoanh / xoá khối ⇒ `stale` cho cả vùng: chỉ trả câu hỏi, **không toạ độ**, client không tô gì.

## 3. Quyền & chống lộ

* Cùng cổng V1/V2. `no_access`/`stale` chỉ trả metadata câu hỏi. Người ngoài lớp: không có khối, không có vùng tô (E2E 11).
* `share_region_create` kiểm từng lá/bản nhạc tồn tại trong giáo trình **hiện hành đã xuất bản** và người tạo có quyền giáo trình; giới hạn 12 phần, 40 lá/phần, 6 bản nhạc/phần, 64 ô; hộp ‰ hợp lệ; trùng khối bị chặn; 10 note/phút.
* Hàm nội bộ (`share_region_build/resolve/sha`) không ai gọi được; `anon` không gọi được hàm nào; bảng vẫn đóng.
* Payload Feed `anchor:'region'` không chứa nội dung giáo trình, không `bar_from/bar_to`.
* Chỉ khi trang Buổi cấp `ScoreShareSlot.onAskRegion` mới bọc `[data-sec]` và dựng lớp khoanh ⇒ trang công khai / bản in / Admin **không đổi**.

## 4. Mức sẵn sàng

| Hạng mục | Mức |
|---|---|
| Lõi thuần `src/share/regionAnchor.ts` + `regionContext.ts` (16 + 3 unit test) | **đạt mức production** (logic); chưa review UX |
| Lớp khoanh `RegionLayer.tsx` (kéo chuột/cảm ứng/bút, "Cuộn", tự cuộn sát mép, Esc, "Khoanh lại", Huỷ, thanh công cụ tránh vùng khoanh) | **prototype hoàn thiện** — cần thử iPhone thật |
| Vẽ vùng `RegionHighlight` (theo sự kiện bố cục) | **prototype hoàn thiện** |
| Feed dựng nguyên cảnh (`ShareNotePost` + `RegionContextView`) | **prototype hoàn thiện** — cần Owner duyệt bố cục gọn/đầy đủ |
| DB `db/drafts/share_region_v3_setup.sql` (+ rollback, test SQL R0–R20, S1–S9) | **dự thảo — CHƯA chạy production**; cần preflight/postflight/gate md5 như V2 |

## 5. Loại nội dung đã khoanh thử (E2E, dữ liệu giả)

Nửa đoạn văn (nửa dòng đầu) · nửa phải của hai dòng · nhiều đoạn · tiêu đề + đoạn + danh sách · **một phần bảng** (một hàng, một ô) · **vài ô nhịp** (ô 1–2 trên 26 ô) · **chữ + một phần bản nhạc** · **chữ + sơ đồ cần đàn (hình) + chữ**. Không có khối "ảnh" trong schema giáo trình hiện tại; sơ đồ cần đàn (SVG do renderer vẽ) đại diện cho phần không có lá/ô.

## 6. Hạn chế kỹ thuật còn lại

1. **Làm tròn theo từ**: biên đoạn chữ khớp ranh giới từ (từ có ≥ 50% ký tự trong khung thì lấy cả từ). Không khoanh được nửa từ — chủ ý.
2. **Ô nhịp**: ô nào có ≥ 50% diện tích trong khung thì lấy cả ô; dải ô là liên tục theo thứ tự đọc (khoanh ô 3 dòng trên và ô 2 dòng dưới ⇒ lấy cả dải giữa).
3. **Hình/sơ đồ chỉ neo gần đúng** (‰ của hộp khối). Sửa khối hình ⇒ stale (so cả khối). Khi renderer đổi kích thước sơ đồ, vùng giữ tỉ lệ nhưng không bám từng nét.
4. **Bản nhạc bị sửa bất kỳ ⇒ stale** (băm alphaTex cả bản; chưa phân biệt ô bị sửa với ô khác).
5. **Giới hạn kích cỡ**: ≤ 12 khối, ≤ 40 lá/khối, ≤ 12 mảnh/lá, ≤ 60 đoạn/vùng, ≤ 64 ô; khung quá nhiều mảnh rời báo "khoanh gọn lại".
6. **Chưa có thao tác bàn phím** cho khoanh (V2 vẫn chọn chữ bằng bàn phím được).
7. **App iOS đóng gói cũ**: ghi chú region hiển thị "không còn khả dụng"; thẻ Feed region rơi về thẻ nhẹ/ẩn; không lỗi.
8. **Chưa thử iPhone/Safari thật**: cảm ứng qua giả lập Chrome và PointerEvent tổng hợp trên WebKit; tự cuộn khi kéo ngón tay chưa đo trên thiết bị thật.
9. **Mất ngữ cảnh khi stale ở Feed**: chỉ hiện câu hỏi + thông báo "đã được cập nhật" (không dựng khối cũ — đúng ý fail-closed).
10. Feed region hiện **một bài = một vùng**; vùng 12 khối chỉ hiện 3 khối ở chế độ gọn.

## 7. Cần migration không?

**Có** (dự thảo, chỉ cộng thêm): cột `share_notes.region jsonb`, nới CHECK theo loại neo, 4 hàm nội bộ (`share_region_sha/leaf_txt/build/resolve`) + `share_region_create` / `share_region_open` / `social_share_share_region`. **Không sửa** hàm V1/V2 (md5 giữ nguyên — test), không đụng `class_lesson_content`. Rollback `db/drafts/share_region_v3_rollback.sql` xoá hàng/bài Feed `region` rồi trả schema về V2.

## 8. Lộ trình lên production

1. Owner dùng staging và nghiệm thu UX (khoanh, Feed gọn/đầy đủ).
2. Khảo sát chỉ-đọc production (số khối/lá/ô mỗi buổi; tần suất sửa giáo trình) để đặt giới hạn.
3. Chuyển `db/drafts/*` → `db/`, thêm preflight/postflight (md5 10 hàm V1 + hàm V2, dấu vân tay `bars`/`text`), dry-run, migrate qua `prod-db.py` — như V2.
4. (đã làm ở V3.1: Feed nguyên cảnh, tự cuộn, vẽ lại theo sự kiện) — còn lại: đo thiết bị thật.
5. Thử iPhone/Safari thật + hồi quy V1.3/V2/Chat/Mira.
6. Phát hành theo thứ tự V2: DB trước, FE sau; rollback FE trước, DB sau.

## V3.2 — hoàn thiện trải nghiệm khoanh trực quan (07/11)

**Không đổi DB / không cần migration bổ sung** (hộp ‰ vẫn là 4 số nguyên 0–1000; chỉ đổi *mốc* tính ‰ cho phần hình, xem dưới).

1. **Phần hình/sơ đồ neo theo PHẦN TỬ HÌNH, không theo cả khối.** `src/lesson/regionVisual.ts#findVisual` (SVG `role=img`, `img`, `canvas`, `video` ≥ 48×32, ngoài vùng bản nhạc). Người khoanh và người nhận dùng cùng quy tắc: phần chỉ-gần-đúng (không có chữ, không có ô nhịp) có ‰ trên chính hình đó; khối không có hình ⇒ ‰ trên cả khối. Sơ đồ là SVG co giãn theo viewBox nên đổi bề rộng 1280 → 390 hay chú thích xuống dòng không làm lệch (kiểm bằng hình học thật: sai số < 1,5% cạnh sơ đồ). Khung chỉ chạm mép hình (< 15% diện tích khung nằm trên hình) thì không đưa phần hình vào. Giới hạn: nếu khối có cả chữ được khoanh lẫn phần hình thì chỉ chữ được neo (phần hình của khối đó không vẽ).
2. **Lớp tô nhẹ**: bỏ hẳn sọc chéo. Chữ: nền cam 12% + gạch chân 1,5px. Khung vẽ: nền ≤ 9%, viền ≤ 2px. Gần đúng: viền nét đứt 1,5px + nhãn "gần đúng". Ô nhạc trong Feed (vùng khoanh): nền 5% + viền 1,5px (V1/V2 giữ nguyên).
3. **Feed xem gọn cho phần hình**: cắt dải dọc quanh hộp (± 56px, tối thiểu 120px), nút "Xem đầy đủ" mở cả khối và thu gọn lại. Thẻ sơ đồ 390px: ~419px (gọn) ↔ ~627px (đầy đủ).
4. **Tự cuộn có chủ ý**: chỉ cuộn khi con trỏ đã rời vùng mép một lần, hoặc giữ yên sát mép ≥ 450ms. Bắt đầu kéo ở y=30 không còn cuộn bất ngờ (đây là điểm UX thật, không chỉ lỗi test WebKit).
5. **Chat**: chia sẻ giáo trình vẫn chỉ đi qua Feed (V1/V2/V3 không có đường vào Chat); không có gì để cải thiện lại trong phạm vi này.
