# /me Visual System V1 — final polish (03/10/2026)

Một ngữ pháp thị giác cho toàn bộ `/me`, tham chiếu ngữ pháp sản phẩm mạng xã hội (KHÔNG copy pixel/thương hiệu).
Không đổi kiến trúc, business logic, DB. Nối tiếp `docs/ME-UX-SYSTEM-V1.md` và `docs/CLASS-UX-V3.md`.

## Màu
- ~90% trung tính. **Tím = thương hiệu/tương tác** (menu đang chọn, tab đang chọn, focus, link/hành động chính) — như xanh của mạng xã hội.
  Tím KHÔNG mang nghĩa tiến độ / đạt / hiện tại / VIP / trạng thái.
- Xanh `--cs-ok` = Đạt · ấm `--cs-warn` = Cần làm lại · còn lại trung tính. Không UI cầu vồng.
- Tối đa **một** nút tím chính (`.cs-btn-primary`) trong một viewport (E2E quét).

## Chiều sâu
canvas `--cs-bg` → bề mặt `--cs-surface` → bề mặt tập trung (panel "Bài trả của tôi", dòng đang chọn). Bóng tối thiểu
`--cs-shadow`; viền mảnh. Bố cục vẫn đọc được ở thang xám.

## Token (`.cs-root`, khối "/ME VISUAL SYSTEM V1" cuối `classSocial.css`)
- Khoảng cách `--cs-s1…s7` = 4 / 8 / 12 / 16 / 24 / 32 / 48.
- Bo góc `--cs-r-sm` 8 (dòng, menu) · `--cs-r-md` 12 (khối lồng) · `--cs-r-lg` 14 (card).
- Bề rộng theo loại trang:

| Loại | Token | px | Class |
|---|---|---|---|
| Feed (Home, Lớp của tôi, Công cụ) | `--cs-w-feed` | 680 | `.cs-col` |
| Cuộc trao đổi / Hàng đợi | `--cs-w-thread` | 720 | `.cs-col.lt-page` |
| Trang cá nhân | `--cs-w-profile` | 760 | `.cs-profile-page` |
| Không gian lớp | `--cs-w-space` | 880 | `.cs-classspace` |
| Bạn bè (danh bạ) | `--cs-w-dir` | 880 | `.cs-friends-page` |
| Trang lớp (master-detail) | `--cs-w-class` | 1160 | `.cs-classv3.is-wide` |

Trang Buổi (LessonDocument) ngoài phạm vi.

## Chữ
PAGE TITLE (24–28/800) · SECTION TITLE (15/700, chữ thường — bỏ ALL CAPS ở tiêu đề mục và nhóm menu) ·
OBJECT TITLE (16–17/700) · BODY 15 · SECONDARY 13.5–14 `--cs-muted` · METADATA 12.5–13 `--cs-faint`.

## Icon
Một thư viện: **Lucide**. Emoji làm icon UI được map sang Lucide qua `src/class-social/UiIcon.tsx`
(gợi ý chia sẻ ở ô đăng, loại thẻ Trả/Hỏi bài, ghi chú bài giảng, mốc Hành trình). Dữ liệu model vẫn giữ emoji;
emoji trong NỘI DUNG (vd. bài "🎸 Đang tập: …") giữ nguyên. Nav 20px · inline 16px.

## Avatar
32 (gọn: topbar, bình luận, dòng hoạt động, sự kiện thread) · 40 (feed) · 48 (nổi bật: đầu cuộc trao đổi) · lớn hơn ở trang cá nhân.

## Theo màn
- **Sidebar**: hàng 44px, icon 20px thẳng cột, nhóm cách 16px, nền chọn tím rất nhạt; mục khoá = ổ khoá trung tính + chữ phụ.
- **Home**: cột feed hẹp; ô chia sẻ gọn; gợi ý dùng icon Lucide; tab Dành cho bạn / Lớp / Bạn bè = hàng tab, tím ở tab đang chọn.
- **Danh sách lớp**: tên / lịch / kẻ mảnh / hover nhẹ; không "Vào lớp", không chevron.
- **Trang lớp V3**: tiêu đề Chặng hai cấp ("Chặng 1" / "Tên · 8 buổi"); buổi khoá = ổ khoá + chữ nhạt, trình đọc màn hình
  "Chưa mở", KHÔNG lặp "Hoàn thành Buổi 01 để mở" trong danh sách (lý do nói ở panel + Trang Buổi); panel "Bài trả của tôi"
  là bề mặt trắng nổi, dòng đang chọn cùng bề mặt (không tím); copy gọn "Buổi 01 · Tên", "✓ 1/3 Đạt", "1.1 · Tên   Đạt";
  cánh cửa = một đích bấm "Không gian lớp →" + "Bài trả · Hỏi bài · Trao đổi · Thành viên".
- **Không gian lớp**: người trước — avatar · **tên** việc · bài · trạng thái · lúc nào.
- **Cuộc trao đổi**: bong bóng Thầy trung tính (không tím); xanh = Đạt.

## Kiểm
`npm run test:class-social`, `test:route-guard`, tsc, build; E2E `scripts/e2e-class-canonical.sh` có vòng quét
320/390/768/1280/1440/1600 (Home · Lớp của tôi · Trang lớp · Không gian lớp · Bạn bè): không tràn ngang, ≤ 1 nút tím chính
trong viewport, trang lớp/Không gian lớp ≥ 860px trên desktop, dòng hoạt động có avatar.
