# /me HIG Polish V1 (11/10/2026)

Trau chuốt nhẹ theo Apple HIG, CHỈ trình bày (CSS). Không đổi header, tiêu đề nhóm sidebar, badge danh tính, chức năng, API/DB/route.
Toàn bộ nằm trong khối "/ME HIG POLISH V1" ở CUỐI `src/class-social/classSocial.css` — gỡ nguyên khối là về trạng thái cũ.

1. **Composer mobile (≤559px)**: 4 gợi ý một hàng (icon trên nhãn 12px, ô ≥56px cao), kẻ hairline phía trên; nhãn xuống dòng thay vì bị cắt. Chip thứ 5 "Link video" (chỉ khi ô đang mở) xuống hàng dưới. Placeholder ô nhập một dòng; ô nhập min-height 44.
2. **Bottom sheet menu**: grip 36×5 `#c7c7cc`; "Menu" cách nhóm đầu 12px và thẳng cột với tiêu đề nhóm; backdrop `rgba(0,0,0,.4)` trung tính.
3. **Vùng chạm 44×44** bằng `::after` (không đổi kích thước/bố cục): nút icon, ⋯ bài/bình luận, gửi bình luận, nút nhỏ, chip, avatar ở bài/bình luận. "Trả bài bằng link video" chỉ mở xuống dưới/sang bên để không đè hàng chip; `row-gap` ô chia sẻ 12px để hai nút xuống dòng không chồng nhau.
4. **Xám/đường kẻ**: bong bóng + ô nhập bình luận `#f2f1f6` (pha tím) → `--cs-fill #f0f2f5`; đường kẻ nhóm sidebar/sheet, trên bình luận, trên hàng gợi ý dùng `--cs-hairline-*` (0.5px `rgba(60,60,67,.24)` trên màn 2x, 1px `#d9dbe0` còn lại).

Không làm (ngoài phạm vi): header mobile, tiêu đề nhóm sidebar, mật độ badge, sheet quan hệ ở Bạn bè (backdrop còn pha tím).
Test: `npm run test:class-social`, `test:route-guard`, `test:og`, tsc, build, `scripts/e2e-class-canonical.sh`.

## Hoàn thiện (11/10, sau nghiệm thu thiết kế)
- Placeholder ô chia sẻ ở Home: "Chia sẻ về âm nhạc…" (vừa một dòng tại 320px: 153px ≤ 178px khả dụng). Wall composer (trang cá nhân) giữ nguyên.
- Composer đang mở ≤559px: dòng "Bạn bè và Thầy xem được" riêng; "Để sau" + "Đăng" cùng một hàng, căn phải, cách nhau 8px, vùng chạm 44px không chồng (kiểm 320/360/375/390/414).
