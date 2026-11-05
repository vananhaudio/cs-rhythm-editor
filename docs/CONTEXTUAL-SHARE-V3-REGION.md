# Contextual Share V3 — "Khoanh vùng hỗn hợp" (PROTOTYPE, chưa phát hành)

> Trạng thái: **prototype trên nhánh `feat/contextual-share-v3-region`**, chạy trên staging cô lập + DB tạm. Chưa merge, chưa migrate production.
> Mục tiêu Owner: học viên nhìn thấy vùng nào trên giáo trình cũng khoanh được (chữ, bản nhạc, bảng, danh sách, hình, hỗn hợp), hỏi và chia sẻ — như dùng bút khoanh trên giấy.

## 1. Kiến trúc đề xuất

**Một loại neo dùng chung** `anchor_kind = 'region'` thay vì thêm neo riêng cho từng loại nội dung. Tái dùng `share_notes`, Composer, Feed, Chat, cổng truy cập V1/V2 (`share_note_visible → share_note_score_ok → share_note_session_open → RLS`).

```
khung chữ nhật (người kéo)  ──probe DOM──▶  PHẦN theo khối giáo trình  ──server──▶  share_notes.region (jsonb)
   toạ độ client, tạm thời                   {sec, leaves[], scores[], box‰}          + fp + sha (server tự tính)
```

Mỗi **phần** (một khối giáo trình bị khung chạm tới):

| Trường | Ý nghĩa | Nguồn |
|---|---|---|
| `sec` | chỉ số khối (gợi ý) | client |
| `leaves` | đường dẫn các **lá văn bản** bị chạm ≥ 25% diện tích dòng chữ (cùng hệ lá với V2: `data-tp`) | client → server kiểm tồn tại |
| `scores` | bản nhạc + **dải ô** (1-based) bị chạm ≥ 25% diện tích ô (cùng hệ V1.3, từ `boundsLookup` alphaTab) | client → server kiểm đường dẫn |
| `box` | khung theo ‰ hộp khối — **chỉ dùng khi phần không có phần tử gốc** (sơ đồ, hình, khoảng trống) | client |
| `fp` | băm (loại + tiêu đề) khối | **server** |
| `sha` | băm TOÀN KHỐI lúc khoanh (`sha256(jsonb::text)`) | **server** |

Không có pixel làm neo, không ảnh chụp, không bản sao nội dung, không nhân đôi asset. Client **không gửi** băm; server không trả băm.

## 2. Cách neo vào tài liệu gốc (và vì sao không phải toạ độ màn hình)

* **Khung kéo = công cụ nhập**, không phải thứ lưu. Thả chuột → `buildParts()` tra DOM, đổi khung thành **tập phần tử tài liệu** (lá / ô nhịp / khối).
* **Vẽ lại = tra lại đúng phần tử** trong DOM hiện tại (`drawParts()`): lá → các hình chữ nhật dòng chữ hiện hành; ô nhịp → `rectsForBars` theo lần khắc hiện hành của alphaTab. Chữ xuống dòng, đổi font, đổi bề rộng, zoom, xoay máy đều tự đi theo phần tử; viền cam bao quanh các phần tử của từng khối.
* **Người soạn thấy đúng thứ người nhận sẽ thấy**: sau khi thả, vùng được vẽ lại từ chính neo bằng cùng bộ vẽ (`RegionHighlight`), không phải từ khung kéo.
* **Phần gần đúng được đánh dấu**: phần chỉ có hộp ‰ (hình, sơ đồ, khoảng trống) vẽ bằng **sọc + viền nét đứt** và ghi "gần đúng" trong tóm tắt. Không giả vờ neo chính xác.
* **Giáo trình đổi** (fail-closed, server): mỗi phần phải còn **nguyên văn** (cùng `sha`) ở đúng chỉ số, hoặc duy nhất ở chỉ số khác (`moved`). Bất kỳ phần nào sai/mơ hồ ⇒ `stale` cho cả vùng: chỉ trả câu hỏi, **không toạ độ**, client không tô gì.

## 3. Quyền & chống lộ

* Cùng cổng V1/V2. `no_access`/`stale` chỉ trả metadata câu hỏi. Người ngoài lớp: không có khối, không có vùng tô (E2E 11).
* `share_region_create` kiểm từng lá/bản nhạc tồn tại trong giáo trình **hiện hành đã xuất bản** và người tạo có quyền giáo trình; giới hạn 12 phần, 40 lá/phần, 6 bản nhạc/phần, 64 ô; hộp ‰ hợp lệ; trùng khối bị chặn; 10 note/phút.
* Hàm nội bộ (`share_region_build/resolve/sha`) không ai gọi được; `anon` không gọi được hàm nào; bảng vẫn đóng.
* Payload Feed `anchor:'region'` không chứa nội dung giáo trình, không `bar_from/bar_to`.
* Chỉ khi trang Buổi cấp `ScoreShareSlot.onAskRegion` mới bọc `[data-sec]` và dựng lớp khoanh ⇒ trang công khai / bản in / Admin **không đổi**.

## 4. Đã làm được (prototype) và mức sẵn sàng

| Hạng mục | Mức |
|---|---|
| Lõi thuần `src/share/regionAnchor.ts` (khung → phần → vẽ), 10 unit test | **đạt mức production** (logic), chưa review UX |
| Lớp khoanh `RegionLayer.tsx` (kéo chuột/cảm ứng/bút, "Cuộn", Esc, "Khoanh lại", Huỷ) | **prototype** |
| Vẽ vùng `RegionHighlight` (portal, vòng 250 ms) | **prototype** — nên thay vòng 250 ms bằng ResizeObserver + sự kiện khắc xong của alphaTab |
| DB `db/drafts/share_region_v3_setup.sql` (+ rollback, 31 test PASS) | **dự thảo — CHƯA chạy production**; cần preflight/postflight/gate md5 như V2 |
| Composer, ClassSessionPage (tô + cuộn), thẻ Feed/Chat nhẹ | **prototype** |
| Xem trước nguyên cảnh ngay trong Feed (như thẻ V2) | **chưa làm** — Feed chỉ có thẻ nhẹ + "Mở vùng khoanh"; nguyên cảnh + vùng khoanh xem ở trang Buổi |

## 5. Loại nội dung đã khoanh thử (E2E, dữ liệu giả)

Một đoạn chữ · nhiều đoạn · tiêu đề + đoạn + danh sách · bảng (ô `___` bỏ qua) · vùng bản nhạc (dải ô) · **chữ + nhạc** · **chữ + sơ đồ cần đàn (hình) + chữ**. Không có khối "ảnh" trong schema giáo trình hiện tại; sơ đồ cần đàn (SVG do renderer vẽ) đại diện cho phần không có lá/ô.

## 6. Hạn chế kỹ thuật còn lại

1. **Vùng phải nằm gọn trong một khung nhìn** lúc thả. Chưa có tự cuộn khi kéo sát mép; giáo trình dài phải thu nhỏ (zoom out) hoặc khoanh từng đoạn.
2. **Snap theo phần tử**: lá nào bị chạm ≥ 25% thì lấy trọn lá (không cắt giữa câu như V2). Viền hiển thị là viền quanh phần tử, không đúng từng pixel khung kéo.
3. **Hình/sơ đồ chỉ neo gần đúng** (‰ của hộp khối). Khi renderer đổi kích thước sơ đồ, vùng giữ tỉ lệ nhưng không bám từng nét.
4. **Quá khắt khe có chủ đích**: sửa BẤT KỲ chữ nào trong khối được khoanh (kể cả chữ ngoài vùng) ⇒ `stale` cho cả vùng. Cải tiến: băm theo từng lá/bản nhạc thay vì cả khối (cần khảo sát thêm tỉ lệ sửa giáo trình).
5. **Bản nhạc đang khắc**: nếu alphaTab chưa khắc xong, vùng nhạc chưa vẽ (không đoán); khi xong tự vẽ.
6. **Chỉ chuột/chạm/bút**, chưa có thao tác bàn phím cho khoanh (V2 vẫn chọn chữ bằng bàn phím được).
7. **App iOS đóng gói cũ**: ghi chú region hiển thị "không còn khả dụng"; thẻ Feed region rơi về thẻ nhẹ/ẩn; không lỗi.
8. **Chưa thử iPhone/Safari thật**: cảm ứng chỉ qua giả lập Chrome (touch events) và PointerEvent tổng hợp trên WebKit.
9. `sha` dựa trên `jsonb::text`; ổn định trong một phiên bản PostgreSQL, nên gate bằng test khi nâng PG.

## 7. Cần migration không?

**Có** (dự thảo, chỉ cộng thêm): cột `share_notes.region jsonb`, nới CHECK theo loại neo, 3 hàm nội bộ + `share_region_create` / `share_region_open` / `social_share_share_region`. **Không sửa** hàm V1/V2 (md5 giữ nguyên — test), không đụng `class_lesson_content`. Rollback `db/drafts/share_region_v3_rollback.sql` xoá hàng/bài Feed `region` rồi trả schema về V2.

## 8. Lộ trình lên production

1. Owner dùng staging, chốt UX (nút, snap, viền, tên nút) và quyết định #4 (độ khắt khe) / Feed preview.
2. Khảo sát chỉ-đọc production (số khối/lá/ô mỗi buổi; tần suất sửa giáo trình) để đặt giới hạn.
3. Chuyển `db/drafts/*` → `db/`, thêm preflight/postflight (md5 10 hàm V1 + hàm V2, dấu vân tay `bars`/`text`), dry-run, migrate qua `prod-db.py` — như V2.
4. Xem trước nguyên cảnh trong Feed (nhiều khối), thay vòng vẽ 250 ms, tự cuộn khi kéo sát mép.
5. Thử iPhone/Safari thật + hồi quy V1.3/V2/Chat/Mira.
6. Phát hành theo thứ tự V2: DB trước, FE sau; rollback FE trước, DB sau.
