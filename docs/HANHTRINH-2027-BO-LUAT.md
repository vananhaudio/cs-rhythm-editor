# BỘ LUẬT HÀNH TRÌNH 2027 (bản chính thức)

> Luật gốc cho hệ mở khoá, mã hoá & hiển thị của Hành trình 2027. **Quản lý theo MÃ, không theo tên.** Mọi tính năng (app, CRM, phân quyền, mở khoá, báo cáo, AI) phải hiểu theo mã. Do thầy Trần Văn Anh soạn (2026-07-01). Bản này thay thế bản tóm tắt trước.

## 1. Nguyên tắc gốc
**Mã là dữ liệu gốc. Tên là nhãn hiển thị.** Tên khoá có thể đổi theo truyền thông, nhưng **mã năng lực** và **mã lớp** phải ổn định lâu dài.

## 2. Bản đồ hành trình
Cửa vào bắt buộc: khoá miễn phí **"Khởi Đầu Đam Mê — Nhập Môn"**. Xong Nhập môn mới mở 3 nhánh.
3 nhánh ngang hàng: **Đệm hát · Tỉa nốt · Nhạc lý**.
```
NHẬP MÔN
  ↓
ĐỆM HÁT:  DH1 → DH2 → DH3
TỈA NỐT:  TN1 → TN2 → TN3
NHẠC LÝ:  NL1 → NL2 → NL3
  ↓
ĐỆM HÁT NÂNG CAO (DHNC)
  ↓
SOLO GUITAR (SOLO)
```

## 3. Mã năng lực (không dấu)
| Nhánh | Tên năng lực | Mã |
|---|---|---|
| Nhập môn | Nhập môn | **NM** |
| Đệm hát | Đệm hát 1/2/3 | **DH1 / DH2 / DH3** |
| Đệm hát | Đệm hát nâng cao | **DHNC** |
| Tỉa nốt | Tỉa nốt 1/2/3 | **TN1 / TN2 / TN3** |
| Nhạc lý | Nhạc lý 1/2/3 | **NL1 / NL2 / NL3** |
| Solo | Solo Guitar | **SOLO** |

## 4. Luật mở khoá
Sau Nhập môn → mở **DH1, TN1, NL1**.
| Muốn mở | Điều kiện (hoàn thành) |
|---|---|
| DH1 / TN1 / NL1 | NM |
| DH2 | DH1 + NL1 |
| DH3 | DH2 + NL2 |
| TN2 | TN1 + NL1 |
| TN3 | TN2 + NL2 |
| NL2 | NL1 |
| NL3 | NL2 |
| **DHNC** | DH1+DH2+DH3 + TN1+TN2+TN3 + NL1+NL2 (cửa tổng hợp) |
| **SOLO** | DHNC |

## 5. Luật hoàn thành khoá
Khoá hoàn thành khi **học sinh xem hết nội dung khoá học**. Dùng để mở khoá tiếp theo.

## 6. Luật vượt cấp
Thầy + AI đánh giá đầu vào → chủ động thêm học sinh vào **khoá đầu tiên phù hợp** (vd đủ năng lực vào DH2 → mở DH2). Các khoá phía trước chưa học → đánh dấu **"Thiếu nền tảng"**: khoá **mờ · chỉ lộ mục lục · cảnh báo đỏ · khuyến khích mua học bổ sung**. KHÔNG ép thời hạn, KHÔNG bắt học bù mới được học tiếp — chỉ **nhắc** học sinh biết đang thiếu nền nào.

## 7. Tên thương mại (mã năng lực → tên hiển thị)
| Mã | Tên thương mại |
|---|---|
| NM | Khởi Đầu Đam Mê — Nhập Môn |
| DH1 | Khởi Đầu Đam Mê — Đệm Hát Cơ Bản |
| DH2 | Khởi Đầu Đam Mê — Đệm Hát Trình Độ 2 |
| DH3 | Bứt Phá Đam Mê — Đệm Hát Trình Độ 3 |
| DHNC | Đệm Hát Nâng Cao |
| TN1 | Tỉa Nốt 1 — Guitar Căn Bản |
| TN2 | Tỉa Nốt 2 — Tỉa Nốt Guitar Phương Pháp Thị Tấu |
| TN3 | Tỉa Nốt 3 — Tỉa Nốt Guitar Trên Nền Karaoke Phương Pháp Cảm Âm |
| SOLO | Solo Guitar |
| NL1 | Chìa Khoá Nhạc Lý Cơ Bản |
| NL2 | Chìa Khoá Nhạc Lý 2 |
| NL3 | Hoà Âm — Cảm Âm |

## 8. Luật mã lớp
Công thức: **`[Mã năng lực].[Mã dạng lớp][Số khóa 2 chữ số]`** — vd `DH1.KD16`, `DH2.KD15`, `DH3.BP01`, `TN1.GL06`.
Mã dạng lớp: DH1/DH2 = **KD** · DH3 = **BP** · TN1/TN2/TN3 = **GL**.
Số khóa: 2 chữ số (Khóa 1→01, Khóa 16→16).
Chưa cần mã lớp: Nhập môn, Nhạc lý (chỉ dùng mã năng lực); DHNC & Solo bàn sau.

## 9. Hiển thị theo môi trường
- **App học sinh:** Logo mã năng lực + Tên năng lực + Tên thương mại. VD `[DH1] · Đệm hát 1 · Khởi Đầu Đam Mê — Đệm Hát Cơ Bản`. KHÔNG hiện: số khóa, mã lớp, tên lớp đầy đủ.
- **Website tuyển sinh / lịch / Zalo:** `[Tên thương mại] — Khóa [số] | [Mã lớp]`. VD `Khởi Đầu Đam Mê — Đệm Hát Cơ Bản — Khóa 16 | DH1.KD16`.
- **Admin / AI / CRM:** ưu tiên mã lớp / mã năng lực (DH1.KD16, NL1). AI phải hiểu: `DH1.KD16` thuộc năng lực `DH1`; `DH1` là điều kiện mở `DH2`; tên chỉ là nhãn.

## 10. Hiển thị website phân tầng (giữ nguyên — đang tốt)
```
Tiêu đề lớn = Nhóm khóa / trình độ
Tiêu đề nhỏ = Tên lớp cụ thể
```
VD: **KHÓA ĐỆM HÁT TRÌNH ĐỘ 2** → *Khởi Đầu Đam Mê — Đệm Hát Trình Độ 2 — Khóa 15 | DH2.KD15 · Thứ 6 — 19:00 — 17/07/2026*.

## 11. Tư tưởng cuối cùng
Học sinh nhìn thấy hành trình rõ ràng. App dẫn đường theo năng lực. AI & hệ thống quản lý bằng **mã**. Tên thương mại phục vụ truyền thông. Mã lớp phục vụ vận hành. Hành trình 2027 = **bản đồ phát triển năng lực guitar**, có luật mở khoá, đặc cách đầu vào, cảnh báo thiếu nền, và hệ mã đủ rõ để AI quản lý lâu dài.
