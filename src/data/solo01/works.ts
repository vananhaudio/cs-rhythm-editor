// ── SOLO-01 · Tác phẩm thực hành — sinh từ MusicXML của thầy ──
// Nguồn: thư viện bản nhạc của thầy (MuseScore) — "Thư viên Musecore/diem-xua.mxl"
// và "thanh-pho-buon-lam-phuong/score.xml".
// Sinh lại bằng:  node scripts/musicxml-to-alphatex.mjs <file> [--transpose N] [--no-chords]
//                 [--zones "0-4:1-6,5-9:1-3,10-17:1-2"] [--shift-cost 2.5]
// KHÔNG sửa tay trong file này — sửa nguồn hoặc tham số rồi chạy lại script.

// Diễm Xưa — Trịnh Công Sơn. Giọng Am, HẠ 1 QUÃNG TÁM (--transpose -12).
// Hợp âm KHÔNG lấy từ XML (bản gốc dùng F#m/Bm7/B7…) mà lấy từ bộ hợp âm dễ của thầy
// ở chords/diem-xua.txt — chỉ 4 thế: Am · A7 · Dm · E, phủ trọn 25 ô nhịp.
// Thế bấm do script xếp THEO VÙNG của bản đồ Buổi 01: gần như cả bài ở Vùng 1
// (ngăn 0–5, dây 1–4), chỉ ô 11–12 lên Vùng 2 rồi về ngay — dây 5–6 để trống
// sẵn cho Bass/hợp âm các buổi sau.
export const WORK_DIEM_XUA = `\\ts 4 4
\\lyrics "Mưa vẫn mưa bay trên tầng tháp cổ Dài tay em mấy thuở mắt xanh xao Nghe lá thu mưa reo mòn gót nhỏ Đường dài hun hút cho mắt thêm sâu Chợt hồn xanh buốt cho mình xót xa Chiều nay còn mưa sao em không lại Nhớ mãi trong cơn đau vùi làm sao có nhau hằn lên nỗi đau Bước chân em xin về mau Mưa vẫn hay mưa cho đời biển động Làm sao em biết bia đã không đau Xin hãy cho mưa qua miền đất rộng Để người phiêu lãng quên mình lãng du Ngày sau sỏi đã cũng cần có nhau"
.
\\ro r.8 0.1.8 1.1.8 0.1.8 0.1.8 1.2.8 2.3.8 1.2.8 |
2.4{ch "Am"}.1 |
r.8 2.3.8 1.2.8 0.1.8 3.1{ch "A7"}.8 3.1.8 5.1.8 0.1.8 |
3.2{ch "Dm"}.1 |
r.8 0.1.8 1.1.8 0.1.8 0.1.8 1.2.8 2.3{ch "Am"}.8 1.2.8 |
2.4{ch "E"}.1 |
r.8 2.4.8 1.3.8 0.2.8 3.2.8 3.2.8 0.1.8 3.2.8 |
\\rc 2 1.2{ch "Am"}.1 |
r.8 2.4{ch "E"}.8 1.3.8 0.2.8 3.2.8 0.2.8 1.3.8 0.2.8 |
2.3{ch "Am"}.1 |
r.4 0.1.8{tu 3} 1.1.8{tu 3} 0.1.8{tu 3} 5.1{ch "A7"}.8 5.1.8 5.1.8 5.1.8 |
6.2{ch "Dm"}.4{d} 5.1.8 5.1.8 5.1.8 5.1.8 5.1.8 |
0.1{ch "Am"}.4 2.3.8{tu 3} 1.2.8{tu 3} 0.1.8{tu 3} 3.2{ch "Dm"}.4 3.2.8{tu 3} 1.1.8{tu 3} 5.1.8{tu 3} |
4.1{ch "E"}.4{d} 0.1.8 3.2.8 1.2.8 0.2.8 2.3.8 |
0.2{ch "E"}.1 |
r.8 0.1.8 1.1.8 0.1.8 0.1.8 1.2.8 2.3.8 1.2.8 |
2.4{ch "Am"}.1 |
r.8 2.3.8 1.2.8 0.1.8 3.1{ch "A7"}.8 3.1.8 5.1.8 0.1.8 |
3.2{ch "Dm"}.1 |
r.8 0.1.8 1.1.8 0.1.8 0.1.8 1.2{ch "Am"}.8 2.3.8 1.2.8 |
2.4{ch "E"}.1 |
r.8 2.4.8 1.3.8 0.2.8 3.2.8 0.2.8 1.3.8 0.2.8 |
2.3{ch "Am"}.1 |
r.8 2.4.8 1.3.8 0.2.8 3.2.8 0.2{ch "E"}.8 1.3.8 0.2.8 |
2.3{ch "Am"}.1`

// Thành Phố Buồn — Lam Phương. Gốc Sol trưởng/Em ⇒ dịch -7 nửa cung về Am:
// giai điệu rơi vào ngăn 0–5 ⇒ Vùng 1 + chạm Vùng 2. File gốc không có hợp âm thật
// (chỉ một ghi chú tiết tấu) nên sinh với --no-chords; lời cũng bỏ (--no-lyrics) vì
// nhịp chùm ba quá dày, chữ chồng lên nhau khi khắc.
export const WORK_THANH_PHO_BUON = `\\ts 4 4
.
r.8{tu 3} 2.3.8{tu 3} 0.1.8{tu 3} |
\\ro 2.3.4 2.3{t}.8{tu 3} 0.1.8{tu 3} 3.2.8{tu 3} 1.2.4 1.2{t}.8{tu 3} 0.3.8{tu 3} 2.3.8{tu 3} |
2.4.4 2.4.8{tu 3} 3.2.8{tu 3} 1.2.8{tu 3} 2.3.4 r.8{tu 3} 0.1.8{tu 3} 3.1.8{tu 3} |
0.1.4 0.1.8{tu 3} 3.1.8{tu 3} 5.1.8{tu 3} 2.3.8{d} 3.2.16 0.1.8{tu 3} 2.3.8{tu 3} 3.2.8{tu 3} |
3.2.4 1.2.8{tu 3} 0.1.8{tu 3} 3.2.16{tu 3} 1.2.16{tu 3} 2.3.4 2.3{t}.8{tu 3} 0.3.8{tu 3} 0.2.8{tu 3} |
0.2.4 0.2.8{tu 3} 3.2.8{tu 3} 0.2.16{tu 3} 2.3.16{tu 3} 2.4.4 r.8{tu 3} 3.2.8{tu 3} 0.2.8{tu 3} |
2.4.4 0.4.8{tu 3} 2.4.8{tu 3} 2.3.8{tu 3} 0.2.4 r.8{tu 3} 3.2.8{tu 3} 0.2.8{tu 3} |
2.4.4 r.8{tu 3} 0.2.8{tu 3} 2.3.8{tu 3} 0.3.4 0.2.8{tu 3} 3.2.8{tu 3} 0.3.8{tu 3} |
\\rc 2 2.3.2 r.4 r.8{tu 3} 2.3.8{tu 3} 0.1.8{tu 3} |
2.3.2 r.4 r.8{tu 3} 0.1.8{tu 3} 0.1.8{tu 3} |
5.1.4 5.1{t}.8{tu 3} 0.1.8{tu 3} 5.1.8{tu 3} 3.1.4 3.1{t}.8{tu 3} 5.1.8{tu 3} 3.1.8{tu 3} |
5.1.4{d} 0.1.8 0.1.4 r.8{tu 3} 2.3.8{tu 3} 2.3.8{tu 3} |
0.1.4 0.1{t}.8{tu 3} 3.1.8{tu 3} 0.1.8{tu 3} 3.2.4 3.2{t}.8{tu 3} 1.2.8{tu 3} 2.3.8{tu 3} |
1.2.4{d} 2.3.8 2.3.4 r.8 2.3.8 |
0.3.4 0.2.8{tu 3} 3.2.8{tu 3} 0.2.8{tu 3} 2.4.4 r.8 2.3.8 |
0.3.4 0.2.8{tu 3} 3.2.8{tu 3} 0.2.8{tu 3} 2.3.4 r.8 2.3.8 |
0.3.4 0.2.8{tu 3} 3.2.8{tu 3} 0.2.8{tu 3} 2.4.4{d} 0.3.8 |
2.3.2 r.4 r.8{tu 3} 2.3.8{tu 3} 0.1.8{tu 3} |
2.3.4 2.3{t}.8{tu 3} 0.1.8{tu 3} 3.2.8{tu 3} 1.2.4 1.2{t}.8{tu 3} 0.3.8{tu 3} 2.3.8{tu 3} |
2.4.4 2.4.8{tu 3} 3.2.8{tu 3} 1.2.8{tu 3} 2.3.4 r.8{tu 3} 0.1.8{tu 3} 3.1.8{tu 3} |
0.1.4 0.1.8{tu 3} 3.1.8{tu 3} 5.1.8{tu 3} 2.3.8{d} 3.2.16 0.1.8{tu 3} 2.3.8{tu 3} 3.2.8{tu 3} |
3.2.4 1.2.8{tu 3} 0.1.8{tu 3} 3.2.16{tu 3} 1.2.16{tu 3} 2.3.4 2.3{t}.8{tu 3} 0.3.8{tu 3} 0.2.8{tu 3} |
0.2.4 0.2.8{tu 3} 3.2.8{tu 3} 0.2.16{tu 3} 2.3.16{tu 3} 2.4.4 r.8{tu 3} 3.2.8{tu 3} 0.2.8{tu 3} |
2.4.4 0.4.8{tu 3} 2.4.8{tu 3} 2.3.8{tu 3} 0.2.4 r.8{tu 3} 3.2.8{tu 3} 0.2.8{tu 3} |
2.4.4 r.8{tu 3} 0.2.8{tu 3} 2.3.8{tu 3} 0.3.4 0.2.8{tu 3} 3.2.8{tu 3} 0.3.8{tu 3} |
2.3.2{d} r.4`

// Diễm Xưa — BẢN CÓ BASS (Buổi 02). Bass là một BÈ RIÊNG (\\voice) nên đuôi nốt quay
// xuống, và bè bass có nốt ở phách 1 kể cả khi giai điệu đang là dấu lặng.
// Hợp âm được NẮN về phách mạnh (phách 1 hoặc 3), không rơi vào phách 2/4 theo lời;
// tên hợp âm chỉ ghi ở chỗ nó đổi. Nốt gốc đều là dây buông: E (dây 6) · A (dây 5)
// · D (dây 4) — ngón cái p.
export const WORK_DIEM_XUA_BASS = `\\ts 4 4
\\lyrics "Mưa vẫn mưa bay trên tầng tháp cổ Dài tay em mấy thuở mắt xanh xao Nghe lá thu mưa reo mòn gót nhỏ Đường dài hun hút cho mắt thêm sâu Chợt hồn xanh buốt cho mình xót xa Chiều nay còn mưa sao em không lại Nhớ mãi trong cơn đau vùi làm sao có nhau hằn lên nỗi đau Bước chân em xin về mau Mưa vẫn hay mưa cho đời biển động Làm sao em biết bia đã không đau Xin hãy cho mưa qua miền đất rộng Để người phiêu lãng quên mình lãng du Ngày sau sỏi đã cũng cần có nhau"
.
\\ro r.8 0.1.8 1.1.8 0.1.8 0.1.8 1.2.8 2.3.8 1.2.8 |
2.4.1 |
r.8 2.3.8 1.2.8 0.1.8 3.1.8 3.1.8 5.1.8 0.1.8 |
3.2.1 |
r.8 0.1.8 1.1.8 0.1.8 0.1.8 1.2.8 2.3.8 1.2.8 |
2.4.1 |
r.8 2.4.8 1.3.8 0.2.8 3.2.8 3.2.8 0.1.8 3.2.8 |
\\rc 2 1.2.1 |
r.8 2.4.8 1.3.8 0.2.8 3.2.8 0.2.8 1.3.8 0.2.8 |
2.3.1 |
r.4 0.1.8{tu 3} 1.1.8{tu 3} 0.1.8{tu 3} 5.1.8 5.1.8 5.1.8 5.1.8 |
6.2.4{d} 5.1.8 5.1.8 5.1.8 5.1.8 5.1.8 |
0.1.4 2.3.8{tu 3} 1.2.8{tu 3} 0.1.8{tu 3} 3.2.4 3.2.8{tu 3} 1.1.8{tu 3} 5.1.8{tu 3} |
4.1.4{d} 0.1.8 3.2.8 1.2.8 0.2.8 2.3.8 |
0.2.1 |
r.8 0.1.8 1.1.8 0.1.8 0.1.8 1.2.8 2.3.8 1.2.8 |
2.4.1 |
r.8 2.3.8 1.2.8 0.1.8 3.1.8 3.1.8 5.1.8 0.1.8 |
3.2.1 |
r.8 0.1.8 1.1.8 0.1.8 0.1.8 1.2.8 2.3.8 1.2.8 |
2.4.1 |
r.8 2.4.8 1.3.8 0.2.8 3.2.8 0.2.8 1.3.8 0.2.8 |
2.3.1 |
r.8 2.4.8 1.3.8 0.2.8 3.2.8 0.2.8 1.3.8 0.2.8 |
2.3.1
\\voice
0.5{ch "Am" rf 1}.1 |
0.5{rf 1}.1 |
0.5{rf 1}.2 0.5{ch "A7" rf 1}.2 |
0.4{ch "Dm" rf 1}.1 |
0.4{rf 1}.2 0.5{ch "Am" rf 1}.2 |
0.6{ch "E" rf 1}.1 |
0.6{rf 1}.1 |
0.5{ch "Am" rf 1}.1 |
0.6{ch "E" rf 1}.1 |
0.5{ch "Am" rf 1}.1 |
0.5{rf 1}.2 0.5{ch "A7" rf 1}.2 |
0.4{ch "Dm" rf 1}.1 |
0.5{ch "Am" rf 1}.2 0.4{ch "Dm" rf 1}.2 |
0.6{ch "E" rf 1}.1 |
0.6{rf 1}.1 |
0.6{rf 1}.1 |
0.5{ch "Am" rf 1}.1 |
0.5{rf 1}.2 0.5{ch "A7" rf 1}.2 |
0.4{ch "Dm" rf 1}.1 |
0.4{rf 1}.2 0.5{ch "Am" rf 1}.2 |
0.6{ch "E" rf 1}.1 |
0.6{rf 1}.1 |
0.5{ch "Am" rf 1}.1 |
0.5{rf 1}.2 0.6{ch "E" rf 1}.2 |
0.5{ch "Am" rf 1}.1`

// ── Lý Cây Bông (dân ca Nam Bộ) — tác phẩm Buổi 03 ──
// Nguồn: "Thư viên Musecore/ly-cay-bong-dan-ca-mien-nam-a.zip" (bản đàn bầu của thầy).
// Dân ca nên không vướng bản quyền. Nhịp 2/4, giọng Đô, 32 ô.
// Cùng một giai điệu dựng ở HAI QUÃNG TÁM để học viên nghe ra khác biệt cao độ:

// Bản THẤP — hạ một quãng tám (--transpose -12): trọn vẹn trong Vùng 1 (ngăn 0–3).
export const WORK_LY_CAY_BONG_THAP = `\\ts 2 4
\\lyrics "Bông i\` xanh bông i\` i trắng rồi lại vàng bông Ơ ơ rường _ ơ _ bông lê cho bằng bông lựu _ Ơ ơ rường _ ơ _ là đố í a _ đố nàng _ bông rồi lại _ mấy _ bông _ Là đố í a _ đố nàng _ bông rồi lại _ mấy _ bông _"
.
r.2 |
2.3.4 0.3.4 |
2.3.2 |
2.3.4 0.3.8 2.3.8 |
1.2.4 2.4.4 |
0.3.4 2.4.4 |
0.3.2 |
2.3.8 0.3.8 2.4.8 0.3.8 |
2.3.2 |
2.3{t}.4 2.3.4 |
2.3.4 0.3.4 |
3.5.4 0.3.4 |
2.4.4 0.3.4 |
2.3.8 0.3.8 2.4.8 0.3.8 |
2.3.2 |
2.3{t}.4 3.2.4 |
0.1.4 3.1.4 |
0.1.8 3.2.8 1.2.4 |
2.3.2 |
2.3.2 |
1.2.4 0.3.4 |
2.3.8 1.2.8 3.2.8 0.1.8 |
3.2.2 |
3.2{t}.4 3.2.4 |
0.1.4 3.1.4 |
0.1.8 3.2.8 1.2.4 |
2.3.2 |
2.3.2 |
1.2.4 0.3.4 |
2.3.8 1.2.8 3.2.8 0.1.8 |
3.2.2 |
3.2{t}.2`

// Bản CAO — giữ nguyên quãng tám: rơi vào Vùng 2 và Vùng 3 (ngăn 5–15), và chỗ đổi
// vùng trên cùng một dây được đánh dấu TRƯỢT NGÓN (--slide) — đúng kỹ thuật Buổi 03.
export const WORK_LY_CAY_BONG_CAO = `\\ts 2 4
.
r.2 |
5.1.4 8.2.4 |
5.1.2 |
5.1.4 8.2.8 5.1.8 |
8.1.4 5.2.4 |
8.2.4 5.2.4 |
8.2.2 |
5.1.8 8.2.8 5.2.8 8.2.8 |
5.1.2 |
5.1{t}.4 5.1.4 |
5.1.4 8.2.4 |
5.3.4 8.2.4 |
5.2.4 8.2.4 |
5.1.8 8.2.8 5.2.8 8.2.8 |
5.1.2 |
5.1{t ss}.4 10.1.4 |
12.1.4 15.1.4 |
12.1.8 10.1{ss}.8 8.1.4 |
5.1.2 |
5.1.2 |
8.1.4 8.2.4 |
5.1.8 8.1{ss}.8 10.1.8 12.1.8 |
10.1.2 |
10.1{t}.4 10.1.4 |
12.1.4 15.1.4 |
12.1.8 10.1{ss}.8 8.1.4 |
5.1.2 |
5.1.2 |
8.1.4 8.2.4 |
5.1.8 8.1{ss}.8 10.1.8 12.1.8 |
10.1.2 |
10.1{t}.2`
