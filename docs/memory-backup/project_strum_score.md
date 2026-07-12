---
name: project_strum_score
description: "Tên chính thức \"Strum Score\" — bản nhạc dành cho người quạt (màn gảy-theo-bản-thu)"
metadata: 
  node_type: memory
  type: project
  originSessionId: c93c73ef-05d5-45d2-87f9-c67f31261321
---

Tên CHÍNH THỨC của tính năng "gảy theo bản thu": **Strum Score** (thầy chốt). Bản chất: **một dạng BẢN NHẠC thật sự dành cho người QUẠT** (rhythm) — có khuông, nhịp, ô, trường độ (nốt móc đơn cách đều), hợp âm; chỉ khác là dành cho tay phải/quạt thay vì cho giai điệu. Có tính âm nhạc hẳn hoi, không phải "bảng/chart".

**Why:** Gọi đúng bản chất + đúng hướng phát triển lâu dài (một hệ ký âm cho strumming, không chỉ là công cụ tạm).

**How to apply (từ khoá khi trao đổi):**
- **"Strum Score"** = màn này (web: `src/elearn/ChordStrumPlayer.tsx`, route `/hbd`, `/hbd-td1`; data `strumSongs.ts`).
- "ô lấy đà" = ô đầu đếm 1-2-3 (count-in, xem [[project_countin_pattern]]).
- "dải quạt" = hàng nốt ↓↑ (chùm 2 / nốt đen).
- "ô đang sáng" = ô/phách đang chơi.
- "xanh hóa" = màn xong-lượt đỏ/vàng/xanh.

Đặc tả đầy đủ để port (Groove Lab/Expo): `docs/groove-lab-strum-guide.md`. Liên quan: [[project_groove_strum_guide]], [[feedback_simple_effective_design]] (nốt là trọng tâm, hạn chế màu mè).

## RÀ SOÁT 2026-07-02 (hiện trạng + khoảng trống)
**Kiến trúc:**
- `ChordStrumPlayer.tsx` (~419d): màn chơi. 3 nguồn tiếng — **nền synth** (`backing`) / **mp3** (`audioUrl`) / **YouTube ẩn** (`videoId`, iframe lấy tiếng). Sáng theo ô/phách, đếm vào, tự cuộn, **ghi âm trộn** mic+nhạc (lưu LOCAL, không upload), màn "xong lượt" xanh hóa (RPC `record_skill_session`, cần studentId+lessonId — LessonViewerPage truyền đủ). Font glyph nốt trắng/lặng = **Bravura** (đã nhúng index.html).
- `strumPatterns.ts`: 9 kiểu quạt (đen/chùm2/liên3/móc kép × 4/4,3/4,2/4). `resolvePattern(N, eighths, patternId)`.
- `strumSongs.ts`: 5 bài **HARDCODE** (HBD chùm2/đen có lấy đà; Jingle chùm2/đen có melody + ô kết oneStrum; Ballad). Route thử `/hbd /hbd-td1 /jinglebell /strum-backing /strum-test`.
- `StrumConfigEditor.tsx` (admin, `lesson_type='strum'`): `parseStrumConfig`/`configToSong`, lưu JSON ở `content`. Dùng lại ở MobileStudentPortal + LessonViewerPage.
- `SongBar { chord?, pickup?, rest?, oneStrum? }`; `StrumSong { …, patternId, backing?, melody?, loop? }`.

**KHOẢNG TRỐNG (ưu tiên):**
1. **Trình soạn của thầy chỉ làm bản RÚT GỌN**: `configToSong` chỉ hỗ trợ nền synth + vòng hợp âm ĐỀU một kiểu quạt. KHÔNG tạo được: ô lấy đà/nghỉ/kết (oneStrum), melody, nguồn mp3/YouTube, kiểu quạt khác nhau từng ô. → Bài "xịn" (HBD/Jingle) phải hardcode. **Đây là việc đáng làm nhất.**
2. Đường YouTube ẩn còn trong code (rủi ro Apple ~5.2.3) nhưng editor không mở ra → hiện an toàn, đừng bật trong app iOS.
3. 1 patternId/bài (không đổi tiết tấu giữa đoạn). Mic gain ghi âm cố định 1.6.

**Hướng đề xuất (chờ thầy chốt):** A. Nâng editor tạo bài đầy đủ (lấy đà/nghỉ/kết + melody + mp3 upload Supabase); B. Soạn per-bar (hợp âm + kiểu quạt riêng từng ô); C. Chỉ dọn/gia cố (guard YouTube, dọn route thử).

## PIVOT 2026-07-02 — CÔNG CỤ HỌC SINH TỰ SOẠN (đang làm)
Thầy chốt hướng MỚI (không phải A/B/C cũ ở trên): **học sinh tự soạn bài tập Strum Score** trên điện thoại, lưu tài khoản, rồi luyện gảy theo. Quyết định thầy đã chốt: **điện thoại là chính · lưu Supabase · mục đích luyện gảy theo · định dạng lời = ngoặc vuông [C] (Hợp Âm Việt) · MỘT ô nhiều hợp âm OK**.

Luồng: **Bước 1 = vạch nhịp** (dán lời-hợp âm [C] + xem ảnh sheet qua LINK ẢNH để canh nhịp, bấm khe giữa từ cắm/xoá vạch → chia ô + đánh số + tóm tắt hợp âm/ô). Bước 2 = gán kiểu quạt/nền/tempo → chơi được.

**Đã LÀM & PUSH (commit ff0e98b, live):**
- Route `/strum-builder` (teacher-only; DEV bypass `!import.meta.env.DEV` để verify — production vẫn chặn HS tới khi làm lối vào).
- `src/StrumWorkshop.tsx` = màn "Strum Score của tôi" (list tạo/mở/xoá). `src/StrumBuilder.tsx` = trình vạch nhịp mobile-first (nhận 1 draft, tự lưu DB autosave 1.2s + lưu khi thoát, ô tên bài, trạng thái lưu). `src/strumDrafts.ts` = data layer.
- Bảng `student_strum_drafts` (id, owner_id=auth.uid, title, sheet_url, meter, raw_lyric, cuts jsonb, + pattern_id/style_id/tempo NULL cho Bước 2). RLS theo-hàng: HS CRUD của mình + `is_teacher()` đọc hết; đã thêm vào `self_managed[]` của `rls_setup.sql`. File `db/student_strum_drafts.sql` (thầy ĐÃ chạy).
- parseChordLine bóc `[C]`, tokenize theo TỪ, vạch = Set chỉ số từ; bar 1 mở đầu cố định.
- **Tìm ảnh sheet (commit 01b06d3):** ô "Sheet tham chiếu" có code gọi Custom Search JSON API (`src/googleImageSearch.ts`, env `VITE_GOOGLE_CSE_KEY/CX` ở Netlify). Chưa cấu hình → tự lùi về nút "Google Ảnh ↗" + 🔗 dán link. Google chặn iframe google.com/search nên không nhúng trực tiếp được.
- **⛔ KẾT LUẬN 2026-07-02 (ĐỪNG THỬ LẠI):** Custom Search JSON API **ĐÃ ĐÓNG với khách hàng mới** — thầy + tôi đã thử ĐỦ MỌI CÁCH (cx `35dc10d3ccf47407c` OK, Enable API đúng project, key App-restriction None, API-restriction đúng, GẮN CẢ BILLING free-trial, tắt/bật API) trên 2 project (`youtube-catalog-tool`, `liquid-champion-404501`/My Maps `652212034689`) + 3 khoá → LUÔN 403 "This project does not have the access to Custom Search JSON API". Nguồn: support.google.com thread 411852630, discuss.google.dev 347093. **GIẢI PHÁP CHỐT (commit 67b25d5, thầy XÁC NHẬN CHẠY trên live 2026-07-02): CSE Element widget (cse.js)** — widget có 2 tab: **Image** (ảnh sheet hiện trong app) + **Web** (dẫn thẳng trang Hợp Âm Việt → thầy copy lời-hợp âm `[Am]` dán vào ô lời, đúng format parser). Một ô tìm phục vụ cả 2 nguyên liệu đầu vào. — vẫn free/không key/không billing, hiện lưới ảnh Google NGAY TRONG ô sheet: `loadCseElement()` trong `googleImageSearch.ts` (parsetags explicit → `element.render({tag:'searchresults-only', gname:'sheetcse', attributes:{enableImageSearch,defaultToImageSearch}})` → `execute(q + ' sheet hợp âm guitar')`). **BẤM-ẢNH-LÀ-VÀO-Ô (commit ee0e8f2):** render với `imageSearchLayout:'popup'` → bấm ảnh mở popup inline chứa `img.gs-imagePreview` = **URL ảnh GỐC** (không phải thumbnail encrypted-tbn) → `grabPreview()` (interval 200ms×12) chộp src → setSheetUrl + đóng kết quả. Đây là cách DUY NHẤT lấy URL gốc (DOM kết quả chỉ có thumbnail + link trang nguồn, href ảnh rỗng). 🔗 dán tay vẫn là đường phụ.
**FIX ảnh vỡ do hotlink (commit 1a8dcd2):** một số trang nguồn (vd `hopamviet.vn`) chặn tải ảnh nếu request kèm Referer từ domain khác (curl xác nhận: có Referer ngoài → 403, không Referer → 200) → trình duyệt tự gắn Referer khi tải `<img>` từ app mình → ảnh vỡ. Sửa: `<img referrerPolicy="no-referrer">` cho ảnh sheet. Có `onError`→`sheetBroken` báo rõ nếu trang khác chặn kiểu khác (bot/IP), gợi ý tìm ảnh khác hoặc mở tab Web.
**Gợi ý lấy link từ 1 trang web (commit 0f20cf5):** thầy phản hồi "khó khi ảnh nằm trong 1 website" (không phải file ảnh riêng) → thêm hint dưới ô 🔗 dán link: bấm giữ (ĐT) / chuột phải (máy tính) → "Sao chép địa chỉ hình ảnh" → dán.
**Tab Web mở CÙNG tab (commit 9c8c0a5, đã sửa 2 lần):** Google CSE ép `target=_blank` mọi link kết quả Web (`newWindow:false` KHÔNG có tác dụng). Lần 1 (65a13eb) chỉ `preventDefault()` → KHÔNG đủ vì widget tự gọi `window.open()` bằng JS riêng trên thẻ `<a>`, không phụ thuộc hành vi mặc định trình duyệt. Lần 2 (9c8c0a5) thêm `stopPropagation()` + `stopImmediatePropagation()` ở capture (ancestor, chạy trước khi event lan tới `<a>` của Google) → **xác nhận qua preview: window.open 0 lần gọi** sau khi thêm. Bài học: `preventDefault()` chỉ chặn hành vi mặc định trình duyệt, KHÔNG chặn JS riêng của thư viện bên thứ 3 gắn trên cùng phần tử — phải `stopPropagation` để chặn event tới tay họ. Thầy XÁC NHẬN trên live 2026-07-03: bấm kết quả Web → "mở thay luôn tab trang của mình" — đúng thiết kế. Quay lại app = bấm nút Back trình duyệt (bài tự lưu, không mất).

**BUG PHÁT SINH + ĐÃ SỬA (commit bcefdcb):** sau khi chặn tab-Web, thầy báo "bấm ẢNH cũng bị nhảy trang" (khác lời phàn nàn trước, đã hỏi rõ mới ra đúng ý). Nguyên nhân: popup xem ảnh to có 1 lớp link ẨN `a.gs-previewLink` (trong `.gs-imagePreviewArea`, thuộc `gsc-imageResult-popup` — prefix "gsc-" KHÁC "gs-imageResult" tôi đang canh) nằm NGOÀI vùng chặn cũ → lọt xuống nhánh xử lý tab-Web, bị nhảy trang. Sửa 2 lớp: (1) ảnh nhỏ trong LƯỚI (`.gs-imageResult`/`a.gs-image`) → KHÔNG chặn gì (chặn ở đây từng làm popup không mở được — tự phát hiện regression giữa chừng, sửa lại); (2) mọi phần tử khác trong vùng ảnh (`[class*="image"]`, bắt luôn link ẩn) → chặn triệt để (preventDefault+stopPropagation+stopImmediatePropagation) rồi mới grabPreview(). Đã verify 3 kịch bản qua preview (window.open=0 lần + ảnh vẫn vào ô sheet bình thường + tab Web vẫn OK).

Vụ tìm-kiếm-trong-app coi như HOÀN TẤT (ảnh bấm-là-chọn không rời app + lời/hợp âm qua tab Web cùng-tab, Back để quay lại).

## PIVOT 2— "tự động chui vào trang lấy ảnh" KHÔNG khả thi, đổi sang 2 cách (2026-07-03)
Thầy muốn hơn nữa: khi tab Web không ra ảnh ở tab Image, muốn app **tự chui vào trang lục ảnh** (như bấm-ảnh-là-chọn). Đã LÀM THỬ: Edge Function `fetch-page-images` (server-side fetch HTML, regex bóc `<img>`, pattern giống `admin-ai`/`class-ai` — xem git log commit đã xoá để tham khảo code nếu cần làm lại). **KẾT LUẬN: KHÔNG khả thi** — `curl` xác nhận **Hợp Âm Việt chặn robot bằng Cloudflare** (mọi trang HTML → 403 "Just a moment..."; CHỈ file ảnh trực tiếp `.jpg` mới tải được). Real trình duyệt của học sinh thì KHÔNG bị chặn (JS giải thử thách vô hình) — đây là lý do mở link CÙNG TAB vẫn ăn nhưng server-side fetch thì không. **ĐỪNG THỬ LẠI hướng auto-scrape HTML cho hopamviet.vn.**

**Đã chốt 2 cách thay thế (commit aacfc27):**
1. Mở kết quả Web CÙNG TAB (giữ nguyên, đã xác nhận chạy) + gợi ý giữ ngón tay → "Sao chép địa chỉ hình ảnh" → dán qua 🔗 (đã có từ PIVOT 1).
2. **MỚI — nút "📤 Tải ảnh lên"**: chụp màn hình bản nhạc → upload thẳng lên Supabase Storage bucket **`strum-sheets`** (`db/strum_sheets_bucket.sql`, public read + authenticated write, path `<owner_id>/<draft.id>-<timestamp>.<ext>`, giới hạn 20MB, jpg/png/webp/gif) → set làm `sheet_url`. Lỗi dịch thân thiện (thiếu bucket/ảnh lớn/sai định dạng). ⚠️ **CẦN THẦY CHẠY SQL** `db/strum_sheets_bucket.sql` thì nút mới hoạt động (đã verify qua preview: request đúng, lỗi "Bucket not found" hiện đúng UI, chỉ chờ bucket thật). 2 biến VITE_ đã xoá khỏi Netlify. Bài học phụ: khoá restriction "Websites" KHÔNG dùng được với JSON API (lỗi "method blocked"); khoá VA API 1 (`…HyWHms`, project My Maps) phục vụ YouTube Data API v3 — đã tick thêm Custom Search (vô hại).

**LÀM TỐT VẠCH NHỊP (đợt trau chuốt, thầy chốt "cứ làm tốt giai đoạn vạch nhịp đã"):**
- ✅ Thu gọn ô sheet (nút ▸/▾, commit 117dfc1) — bài chưa có ảnh tự thu gọn, vùng lời chiếm gần trọn màn.
- ✅ Vạch bám theo TỪ khi sửa lời (`remapCuts` LCS, commit 16727a0) — thêm/bớt/xoá chữ không làm vạch trượt.
- ✅ Chế độ **Toàn màn hình** (commit abf29d1): nút "⛶ Toàn màn hình" (hiện khi có lời + không đang sửa) → màn sạch riêng biệt (early-return trước JSX chính, SAU khi mọi hook đã gọi xong — an toàn Rules of Hooks), chữ to hẳn (lời 30px/hợp âm 20px/số ô 14px so với màn soạn), không vướng toolbar/khung tìm sheet. Đóng bằng nút ✕, dữ liệu không đổi (đã autosave từ trước, không cần nút lưu riêng).
- ✅ Bỏ vạch mờ trong Toàn màn hình (commit 5c482e1) — chỉ hiện vạch tại đúng đầu ô nhịp (`FullBoundary` bỏ hẳn nhánh inactive), không còn vạch xám giữa các từ trong cùng ô → thoáng hơn.
- ✅ Nhóm từ theo Ô NHỊP trong Toàn màn hình (commit 9e5f906) — trước wrap theo TỪNG CHỮ nên 1 ô dài bị tách rời qua 2 dòng khi màn hẹp; giờ gom các từ liên tiếp cùng ô thành 1 khối flex, luôn xuống dòng NGUYÊN CỤM. Xử lý đúng ca ô nhịp trải qua 2 dòng lời gốc (không lặp vạch/số ở dòng sau — check `barStart = g[0].gi===0||cuts.has(g[0].gi)` theo từng group). Trước khi code đã dùng mcp__visualize dựng mockup so sánh 2 cách ngắt dòng cho thầy duyệt hướng — thầy ưng ngay, không cần vòng chỉnh.
- ✅ Chảy liên tục như đoạn văn (commit cd874cd) — thầy phản hồi "cứ đầu câu là xuống hàng, tách nhiều quá": trước mỗi DÒNG DÁN GỐC (mỗi Enter khi copy từ HAV) tự thành 1 hàng riêng (marginBottom cứng), dù không có ngắt ý thật. Sửa: gom TOÀN BÀI thành 1 flex-wrap liên tục (bỏ vòng lặp theo `lines`, chỉ còn 1 vòng theo `tokens` toàn cục), chỉ chèn khoảng cách ĐOẠN VĂN (`flexBasis:'100%'` spacer) tại nơi lời gốc có DÒNG TRỐNG thật (so sánh `g[0].line > prevLine+1` giữa 2 group ô nhịp liên tiếp). ⚠️ Bài học debug: nếu 1 ô nhịp trải dài xuyên qua đúng dòng trống (hiếm — cut không đặt ngay ranh giới verse), spacer sẽ KHÔNG hiện ở đó (ô liền khối nuốt mất ranh giới) — chấp nhận được vì nhất quán với luật "ô nhịp không tách", và thực tế verse mới luôn tự nhiên bắt đầu ô mới nên cut thường tự rơi đúng chỗ.
- ✅ "Bài hát của tôi" + bỏ tìm kiếm (commit 418bcad, 2026-07-04): thầy chốt "chưa có, cần tạo mới" cho khái niệm "bài hát của tôi" → thêm cột `status` ('draft'|'done') trên `student_strum_drafts` (`db/strum_drafts_status.sql`). StrumWorkshop tách 2 khu: **"🎵 Bài hát của tôi"** (done, nút "Tập" → mở thẳng Toàn màn hình qua prop `openDone`) + **"✎ Đang soạn"** (draft, nút "Mở" như cũ). StrumBuilder: nút "⛶ Toàn màn hình" đổi thành **"✓ Hoàn tất"** (bấm lần đầu → set status='done' + mở full-view; nếu đã done → đổi nhãn "⛶ Xem toàn màn hình"); full-view thêm nút "✎ Sửa lại" (quay về soạn) cạnh "✕ Đóng". ĐỒNG THỜI thầy bảo "bỏ luôn cả việc tìm kiếm" → XOÁ HẲN Google CSE widget (doSearch/grabPreview/onClickCapture xử lý ảnh+tab Web) + xoá file `googleImageSearch.ts` — giờ CHỈ còn 🔗 dán link + 📤 tải ảnh lên (2 cách chốt ở PIVOT 2). Dọn hàng nút sheet gọn còn ▸/label/🔗/📤/zoom, bỏ ô tìm + nút "Ảnh đã dán" mơ hồ, rút gọn gợi ý dán link còn 1 dòng.
- ✅ Hướng dẫn chèn sheet rõ ràng (commit 2fc4336): thầy phản hồi "cần hướng dẫn rõ chỗ này" — trước `sheetOpen` mặc định THU GỌN khi chưa có ảnh (theo `!!draft.sheet_url`) nên học sinh KHÔNG THẤY được hướng dẫn/ô dán link (giấu sau icon 🔗 phải bấm mới hiện). Sửa: `sheetOpen` mặc định LUÔN true. Khi chưa có ảnh → khối hướng dẫn to rõ giữa màn: tiêu đề "Chèn link bản nhạc để tham chiếu" + ô dán link LUÔN HIỆN (không giấu nữa) + "— hoặc —" + nút to "📤 Tải ảnh sheet nhạc lên". Icon 🔗/📤 nhỏ trong toolbar giờ chỉ để ĐỔI ảnh khi đã có sẵn. Bug phụ đã sửa: `alignItems:center` làm nội dung dài bị cắt mất phần ĐẦU khi tràn khung — đổi `flex-start`.
- ✅ Chặn cuộn ngang trên điện thoại (commit 9e55824) — hệ quả của việc "ô nhịp không tách" (9e5f906): khối chữ trong 1 ô có thể rộng hơn màn hình → trôi ngang. Sửa 3 lớp: `overflowX:hidden` ở div gốc+khung nội dung fullView; `flexShrink:0 + maxWidth:'100%'` trên khối ô nhịp (chỉ 1 trong 2 KHÔNG đủ — thiếu flexShrink:0 thì maxWidth gây co sớm bất thường do flexbox tính min-content dựa trên flexWrap lồng bên trong; thiếu maxWidth thì flexShrink:0 giữ nguyên kích thước tự nhiên nhưng bị cắt chữ khi vượt màn hình do overflow:hidden ở cha); `flexWrap:wrap + minWidth:0` trên khối từ bên trong ô = lưới an toàn tự xuống dòng NỘI BỘ khi ô quá nhiều từ (vạch vẫn kéo dài xuyên suốt, không tách rời).
- ⬜ Chạm chính xác hơn trên điện thoại (khe to + phản hồi chạm) — còn lại trong màn SOẠN (không phải Toàn màn hình).

**CÒN LÀM:**
- **GĐ C (Bước 2 → chơi được):** gán điệu nền + kiểu quạt + tempo → chuyển các ô đã vạch thành StrumSong → mở ChordStrumPlayer luyện. ⚠️ ĐIỂM KHÓ: player hiện 1 hợp âm/ô nhưng data cho phép **ô nhiều hợp âm** → phải chia cú quạt trong ô cho từng hợp âm (bàn cách trước khi code).
- **GĐ D:** lối vào cho học sinh trong MobileStudentPortal ("Strum Score của tôi") + mở route cho HS (bỏ teacher-only).
- Cân nhắc gỡ DEV-bypass khi xong.

## HÌNH TIẾT TẤU — nền tảng mới cho Fill In/Fill Out/Transition (commit ebe28e7, 2026-07-04)
Thầy muốn thêm khả năng chọn Fill In/Fill Out/Transition cho Strum Score → xác định cần làm "bộ tiết tấu cơ bản" trước. Đã rà soát: `strumPatterns.ts` (kiểu quạt tay, mechanical) và `backingStyles.ts` (6 điệu thật: Ballad/Disco/Bolero/Slow Rock/Valse/Polka, có sẵn `bassFinal`/`bassAlt`/`altEvery` nhưng CHƯA có Fill/Transition) là **2 hệ tách biệt, không trùng lặp**; `src/groove/` (Groove Lab port) dùng chung engine/style nhưng cũng chưa có Fill. `StrumSong.bars` là mảng phẳng, KHÔNG có khái niệm section/verse-chorus.

"Hình tiết tấu" (RhythmFigure) = đơn vị 1 PHÁCH, mỗi cú quạt mang `frac` (tỉ lệ trường độ) → biểu diễn được cả hình chia lệch (không chỉ chia đều như trước). Bộ cơ bản thầy chốt: Đen (D), Chùm 2 (D-U), Chùm 3-Đơn kép kép (D-D-U, lệch 2:1:1, KHÔNG có ngoặc 3), Chùm 3-Liên ba (D-D-D, đều, CÓ ngoặc 3), Chùm 4-Móc kép (D-U-D-U). Sửa luôn lỗi cũ: "liên ba" trước là D-U-D (sai), nay đúng D-D-D.

**Đây MỚI LÀ nền tảng — Fill In/Fill Out/Transition (mix nhiều hình khác nhau trong 1 ô, hoặc gắn vào backingStyles cho trống/bass) CHƯA làm**, chờ thầy tiếp tục chỉ đạo bước kế. Xem thêm [[project_khuong_nhac_skill]] cho quy trình verify-bằng-preview đã dùng lặp lại trong phiên này.
