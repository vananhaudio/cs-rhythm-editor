---
name: project_guitarboard_alphatab
description: Editor khuông nhạc/TAB ở /guitarboard đã chuyển từ canvas tự vẽ sang AlphaTab render
metadata: 
  node_type: memory
  type: project
  originSessionId: 67b5e259-e2a0-4319-a246-c315e280af16
---

Trang `/guitarboard` (GuitarBoard.tsx) trước đây vẽ khuông nhạc + TAB bằng canvas tay (`ScoreTabViewer.tsx`) — gặp lỗi định vị khoá Sol (glyph Unicode `𝄞` lệch theo font từng máy).

**Quyết định (2026-06-15):** dùng AlphaTab (`@coderline/alphatab`, đã có sẵn trong repo) làm engine render thay canvas. Component mới: `src/components/ScoreTabViewerAlpha.tsx` (cùng Props interface với ScoreTabViewer cũ; GuitarBoard import trỏ sang file này). Giữ **nguyên logic gõ phím** của editor cũ (commitNote, +/-/.//, reflow, carry-forward, nhập từ cần đàn).

**Why:** AlphaTab dùng font nhạc Bravura (SMuFL) → khuông/khoá/nốt/đuôi/móc/chấm/liên-3 luôn chuẩn & đồng nhất mọi máy; re-render chỉ ~5ms; hết hẳn việc vẽ tay.

**How to apply / gotchas:**
- `notesToAlphaTex.ts`: chuyển `notes[]` → chuỗi alphaTex. Dây ta 0=Mi trầm…5=Mi cao ⇒ alphaTab dây = `6 - ourString`. Trường độ: tròn=1,trắng=2,đen=4,móc đơn=8,móc đôi=16; chấm `{d}`, liên 3 `{tu 3}`.
- Toạ độ overlay (con trỏ/selection/playback) đọc từ `api.renderer.boundsLookup` (KHÔNG có `.at-note-head` trong bản này). `StaveProfile.ScoreTab` tách **2 staff** (khuông + TAB) → mỗi nốt có 2 beat box, phải GỘP lại thành 1 box cao toàn phần. Beat ↔ notes[] map 1-1 theo thứ tự.
- `LayoutMode.Horizontal` (không Page) hợp editor (1 dòng cuộn ngang) và bỏ footer canh giữa.
- Dòng "rendered by alphaTab" hardcode trong thư viện → ẩn bằng **MutationObserver** trên container, set display:none cho `text` chứa "alphaTab" (postRenderFinished chạy TRƯỚC khi text được append nên query 1 lần không đủ).
- Font Bravura đã copy sang `public/font/` (cần cho production; `settings.core.fontDirectory='/font/'`). Nếu font CHƯA nạp (vd preview dev port lạ) → khuông render nhưng glyph VÔ HÌNH (trông như trống). Kiểm `document.fonts` thấy `Bravura:unloaded`.
- **GOTCHA hiệu ứng alphaTex (đã gây lỗi thật):** *note-effect* (dấu nối `t`, hammer/pull `h`) PHẢI gắn vào nốt GIỮA string và duration: `3.3{t}.4`. Đặt sau trường độ (`3.3.4 {t}` hay `3.3.4{h}`) → **lỗi parse → CẢ khuông render trống**. *Beat-effect* (chấm `d`, liên3 `tu 3`) thì đặt SAU trường độ: `3.3.4 {d}`. `-` KHÔNG phải tie (là accidental ForceNone). Verify nhanh bằng Node: `new AlphaTexImporter().initFromString(tex, new Settings()).readScore()` rồi xem `note.isTieDestination`/`isHammerPullOrigin`.
- `ScoreTabViewer.tsx` (canvas cũ) vẫn còn trên disk, không dùng nữa — có thể xoá sau khi bản AlphaTab ổn định.

**Đã LIVE (đẩy main nhiều đợt 2026-07-02):** bộ công cụ ký âm (chọn giọng/hoá biểu `\ks`, dấu nối, luyến hammer-on/pull-off, ô nhịp lặp `\ro`/`\rc`), nạp file GP/MusicXML, 2 chế độ hiển thị (cần đàn to ↔ khuông to, đảo bằng CSS `order`, cần đàn phụ scale ~0.61), công cụ gập xuống dưới khuông, play từ vị trí con trỏ. Cần đàn CĐ1 scale ~0.92 căn giữa.

**Còn cần xử lý:** dark theme (đang render nền sáng cố định), test kỹ trên iPad; mở rộng hiệu ứng (staccato/accent/vibrato/palm-mute/bend), chỉnh số lần lặp (hiện cố định ×2).
