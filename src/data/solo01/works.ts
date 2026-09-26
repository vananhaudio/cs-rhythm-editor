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

// ── Diễm Xưa — BẢN BUỔI 03: Melody + Bass + Slide ──
// CÙNG nguồn, CÙNG giai điệu, CÙNG bè bass của Buổi 02; chỉ chồng thêm một lớp:
// hai cú trượt ở ô 3 và ô 7 (--slide-at "3,7").
// Chọn tay chứ không để máy tự rải: trong bài chỉ có 5 chỗ mà hai nốt liền nhau
// cùng nằm trên một dây và CẢ HAI ĐỀU BẤM — trượt từ/vào dây buông là vô nghĩa.
export const WORK_DIEM_XUA_B3 = `\\ts 4 4
\\lyrics "Mưa vẫn mưa bay trên tầng tháp cổ Dài tay em mấy thuở mắt xanh xao Nghe lá thu mưa reo mòn gót nhỏ Đường dài hun hút cho mắt thêm sâu Chợt hồn xanh buốt cho mình xót xa Chiều nay còn mưa sao em không lại Nhớ mãi trong cơn đau vùi làm sao có nhau hằn lên nỗi đau Bước chân em xin về mau Mưa vẫn hay mưa cho đời biển động Làm sao em biết bia đã không đau Xin hãy cho mưa qua miền đất rộng Để người phiêu lãng quên mình lãng du Ngày sau sỏi đã cũng cần có nhau"
.
\\ro r.8 0.1.8 1.1.8 0.1.8 0.1.8 1.2.8 2.3.8 1.2.8 |
2.4.1 |
r.8 2.3.8 1.2.8 0.1.8 3.1.8 3.1{ss}.8 5.1.8 0.1.8 |
3.2.1 |
r.8 0.1.8 1.1.8 0.1.8 0.1.8 1.2.8 2.3.8 1.2.8 |
2.4.1 |
r.8 2.4.8 1.3.8 0.2.8 3.2.8 3.2.8 0.1.8 3.2{ss}.8 |
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

// ── Ba cấp độ của CÙNG hai ô nhịp (ô 3–4 của Diễm Xưa) ──
// Dùng cho khối "chồng lớp": học viên nhìn thấy chính đoạn mình đang chơi lớn lên
// qua từng buổi. Cả ba đều sinh từ một nguồn, chỉ khác tham số.
// BỎ LỜI (--no-lyrics): ô nhịp này có 8 nốt móc đơn, mỗi nốt một âm tiết — trong
// khung so sánh hẹp thì chữ chồng lên nhau. Ở đây chỉ cần so NỐT.
export const DX_LOP1_MELODY = `\\ts 4 4
.
r.8 2.3.8 1.2.8 0.1.8 3.1{ch "A7"}.8 3.1.8 5.1.8 0.1.8 |
3.2{ch "Dm"}.1`

export const DX_LOP2_BASS = `\\ts 4 4
.
r.8 2.3.8 1.2.8 0.1.8 3.1.8 3.1.8 5.1.8 0.1.8 |
3.2.1
\\voice
0.5{ch "Am" rf 1}.2 0.5{ch "A7" rf 1}.2 |
0.4{ch "Dm" rf 1}.1`

export const DX_LOP3_SLIDE = `\\ts 4 4
.
r.8 2.3.8 1.2.8 0.1.8 3.1.8 3.1{ss}.8 5.1.8 0.1.8 |
3.2.1
\\voice
0.5{ch "Am" rf 1}.2 0.5{ch "A7" rf 1}.2 |
0.4{ch "Dm" rf 1}.1`

// ── Diễm Xưa ô 1–8 — bản Buổi 05: melody + tên hợp âm, CHƯA có bass ──
// Bass để trống có chủ ý: học viên nhìn tên hợp âm rồi tự chọn nốt bass và tự điền.
// Thầy chỉ luyến sẵn một chỗ ở ô 3 (dây 1, ngăn 3 → 5) làm mẫu (--hammer-at 3).
export const WORK_DIEM_XUA_B5 = `\\ts 4 4
\\lyrics "Mưa vẫn mưa bay trên tầng tháp cổ Dài tay em mấy thuở mắt xanh xao Nghe lá thu mưa reo mòn gót nhỏ Đường dài hun hút cho mắt thêm sâu"
.
\\ro r.8 0.1.8 1.1.8 0.1.8 0.1.8 1.2.8 2.3.8 1.2.8 |
2.4{ch "Am"}.1 |
r.8 2.3.8 1.2.8 0.1.8 3.1{ch "A7"}.8 3.1{h}.8 5.1.8 0.1.8 |
3.2{ch "Dm"}.1 |
r.8 0.1.8 1.1.8 0.1.8 0.1.8 1.2.8 2.3{ch "Am"}.8 1.2.8 |
2.4{ch "E"}.1 |
r.8 2.4.8 1.3.8 0.2.8 3.2.8 3.2.8 0.1.8 3.2.8 |
\\rc 2 1.2{ch "Am"}.1`
