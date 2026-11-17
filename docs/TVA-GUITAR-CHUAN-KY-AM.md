# TVA Guitar — Chuẩn ký âm giáo trình (v1, 17/11/2026)
Mẫu tham chiếu: "Con Đường Xưa Em Đi" v4 (đã nghiệm thu) và v5 (có lời). Áp dụng cho bản nhạc MỚI; không sửa hàng loạt giáo trình cũ khi chưa có lệnh.
## 8 nguyên tắc
1. Cao độ, trường độ đúng nguồn đã xác nhận (đối chiếu ảnh/bản gốc theo giai điệu + lời, không theo số ô).
2. Đủ dấu hóa, Tie, Slur, nhóm ba, ký hiệu cần thiết. Tie = cùng cao độ, nốt đích không gảy lại. Slur = khác cao độ, chỉ là cung luyến, KHÔNG tự đổi thành Hammer-on/Pull-off.
3. TAB khớp khuông tuyệt đối (cùng cao độ; kiểm tự động).
4. Dây/ngăn phù hợp kỹ thuật thực tế; ưu tiên dây 1 khi nâng quãng 8.
5. Mỗi cặp Slur phải CÙNG DÂY (kiểm tự động); nếu lệch dây thì dời nốt đầu sang dây của nốt sau. Slur trên TAB được vẽ bổ sung (AlphaTab chỉ vẽ trên khuông). Tie trên TAB: nốt đích "(số)".
6. Lời ca căn đúng nốt; một âm tiết trên Slur đặt ở nốt đầu; nốt đích Tie không chữ; chữ không chồng nhau (tự dãn). Không đoán chữ ảnh không rõ.
7. A4: khuông + TAB, lời giữa khuông và TAB, mỗi cặp Tie ở trong cùng một hàng (hàng bắt đầu ở nốt đích Tie làm AlphaTab lỗi), số ô nhịp, hợp âm làm nhãn.
8. MỘT nguồn: PDF/giáo trình sinh từ nguồn, không sửa tay độc lập.
## Nguồn & quy trình (mẫu: `nguon-hieu-dinh/`)
`bars_goc.json` (gốc, bất biến) → `hieu_dinh.py` (sửa + Tie + Slur + nâng 8ve + cùng dây) → `bars.json`; `loi_ca.json` (lời); `build.mjs` → `score.html` → Chrome headless `--print-to-pdf` (A4). `kiem_tra.py` kiểm nốt/nhịp/Tie.
## Danh mục kiểm trước khi nghiệm thu
Số nốt/ô và đủ phách (nhóm ba ×2/3) · cao độ so với nguồn · số Tie đúng, không Tie thừa · mọi Slur khác cao độ, liền nhau, cùng dây · nâng 8ve đúng +12 · lời: số âm tiết = số nốt cần lời · xem tận mắt từng trang (chồng chữ, cung chạm chữ).
## Việc chuẩn hóa sau này (chưa làm)
Đưa các bước này vào công cụ dùng chung cho Chặng 2 khi Owner duyệt (kèm repo-guard); chưa chạm Class/giáo trình hiện có.
