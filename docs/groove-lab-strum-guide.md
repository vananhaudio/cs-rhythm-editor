# Strum Guide — "Gảy theo bản thu" (đặc tả để nạp qua Groove Lab)

> Tài liệu thiết kế tính năng **hiển thị cách quạt (strum guide) chạy theo nhạc người dùng tự chèn**.
> Nguồn tham chiếu gốc (web/React): `src/elearn/ChordStrumPlayer.tsx` + `src/elearn/strumSongs.ts` trong dự án cs-rhythm-editor.
> Bản này viết để port sang **Groove Lab (Expo / React Native)**.

---

## 1. Ý tưởng & điểm khác biệt

- App **không phát hành nhạc** — **người dùng tự chèn nhạc của họ** (link YouTube hoặc file audio). → **Không dính bản quyền** (app chỉ là lớp hướng dẫn phủ lên trên).
- Điểm mạnh **không phải bảng hợp âm** (ai cũng có) mà là **HIỂN THỊ CÁCH QUẠT**: dải nốt ↓↑ sáng theo từng phách → dạy *tay phải làm gì*, không chỉ *bấm hợp âm gì*.
- Trình bày **tối giản, như bản nhạc giấy**: hợp âm + nhịp + ô đang sáng. Không lời, không tab rối, không màu mè.

**Một câu định vị:** *Bảng hợp âm cho biết chơi hợp âm gì — Strum Guide cho biết quạt thế nào, trên chính bài hát bạn yêu thích.*

---

## 2. Trải nghiệm người dùng (màn chơi)

Một màn hình duy nhất (không cuộn):
- **Header**: nút quay lại · tên bài · đồng hồ (mm:ss).
- **Khuông nhịp "như sách"**: các ô nhịp xếp **2 ô / hàng**, mỗi ô có:
  - **Tên hợp âm** đặt trên **nốt đầu** của ô (căn trái).
  - **Dải nốt quạt**: mỗi phách 1 nhóm — *chùm 2* (hai nốt móc đơn nối chùm, có ↓ và ↑) hoặc *nốt đen* (một nốt, ↓).
  - **Ô đang chơi**: tên hợp âm + nốt + mũi tên của **phách hiện tại** sáng lên (1 màu accent); các ô/phách khác mờ.
- **Ô lấy đà (pickup)**: không hợp âm — hiện **số đếm 1‑2‑(3/4)** sáng dần theo phách = count‑in trực quan.
- **Ô nghỉ (rest)**: hiện **dấu lặng**, nhãn "Nghỉ".
- **Thanh điều khiển**: ▶ Phát / ⏸ Dừng · ⏮ Về đầu.
- **Tiếng**: phát từ audio người dùng chèn (audio file hoặc YouTube ẩn — chỉ lấy tiếng).
- Hết bài → màn **"Gảy xong một lượt"** (xem mục 8 — xanh hóa).

---

## 3. Mô hình dữ liệu (một bài)

```ts
interface SongBar {
  chord?: string | null   // tên hợp âm hiện ở ô (vd 'C', 'G7', 'Fmaj7', 'A-7', 'GΔ'…). Chữ gì cũng hiện được.
  pickup?: boolean        // ô lấy đà → hiện số đếm 1-2-3, KHÔNG hợp âm, không quạt
  rest?: boolean          // ô nghỉ → hiện dấu lặng, không quạt
}

interface StrumSong {
  title: string
  videoId?: string | null   // YouTube id (lấy tiếng)  — DÙNG 1 trong 2
  audioUrl?: string | null  // HOẶC link audio đã up
  bpm: number               // vd 75
  timeSignature: number     // số phách / ô (3 hoặc 4)
  gridOffset: number        // giây của PHÁCH 1 (downbeat đầu tiên). Thường 0.
  eighths?: boolean         // true = quạt chùm 2 (↓↑ mỗi phách); false = nốt đen (↓ mỗi phách)
  bars: SongBar[]           // 1 phần tử / ô nhịp, theo thứ tự bài
}
```

**Ví dụ — Happy Birthday (3/4, 75bpm, quạt chùm 2):**

```ts
{
  title: 'Happy Birthday — quạt chùm 2',
  audioUrl: '.../Happy Birthday metronome.mp3',
  bpm: 75, timeSignature: 3, gridOffset: 0, eighths: true,
  bars: [
    { pickup: true },             // ô lấy đà → đếm 1-2-3
    { chord: 'C' }, { chord: 'G' }, { chord: 'G' }, { chord: 'C' },
    { chord: 'C' }, { chord: 'Fmaj7' }, { chord: 'G' }, { chord: 'C' },
    { rest: true },               // ô nghỉ cuối
  ],
}
```

Bản **Trình độ 1** = y hệt, chỉ đổi `eighths: false` (quạt nốt đen).

---

## 4. Đồng bộ theo nhạc (đồng hồ)

Tempo bản thu coi như **đều** (nếu là bản metronome / xuất từ Guitar Pro thì đều tuyệt đối).

```
beatDur  = 60 / bpm           // giây mỗi phách
barDur   = timeSignature * beatDur
t        = thời gian hiện tại của nhạc (audio.currentTime, hoặc YouTube currentTime)
elapsed  = t - gridOffset
barIdx     = floor(elapsed / barDur)              // ô đang chơi
beatInBar  = floor(elapsed / beatDur) - barIdx*N  // phách trong ô (0..N-1)
```

- Một ô `i` đang sáng ⟺ `đang phát && barIdx === i`. **Mỗi thời điểm chỉ một ô sáng.**
- Phách `j` trong ô đó sáng ⟺ `beatInBar === j`.
- Cập nhật mỗi frame (web: `requestAnimationFrame`; RN: `requestAnimationFrame` hoặc `setInterval ~16ms`).
- **Lấy tiếng**:
  - *Audio file*: `<audio>` (web) / `expo-av` Audio.Sound (RN). Clock = `currentTime`/`getStatusAsync().positionMillis`.
  - *YouTube*: nhúng iframe ẩn 1px (web) / `react-native-youtube-iframe` (RN), đọc `getCurrentTime()`. Giữ iframe sống để có tiếng; ẩn hình.

---

## 5. Hiển thị "như sách" — chi tiết vẽ nốt

Mỗi ô = `timeSignature` phách. Mỗi phách vẽ bằng **SVG** (web: svg; RN: `react-native-svg`).

**Nốt chùm 2 (eighths=true)** — cặp nốt móc đơn nối chùm:
- 2 thân nốt (stem) đứng, nối nhau bằng **dấu chùm** (beam) ngang ở đỉnh.
- 2 đầu nốt **slash** (gạch chéo dày ~4.6px) ở chân thân.
- Dưới mỗi nốt: mũi tên **↓** (nốt 1, quạt xuống) · **↑** (nốt 2, quạt lên).
- Tỉ lệ đẹp (tham khảo viewBox 44×60, thân cao ~25, đầu nốt dài ~13):

```
beam:  rect x13 y4 w20 h4
stem1: line (14.5,6)→(14.5,31)   head1: line (5,40)→(15.5,29) w4.6 round
stem2: line (32.5,6)→(32.5,31)   head2: line (23,40)→(33.5,29) w4.6 round
↓ ở ~x9.5  ·  ↑ ở ~x28  (y~57)
```

**Nốt đen (eighths=false)** — một nốt / phách:
- 1 thân + 1 đầu slash, **không beam**. Dưới: **↓**.

**Quy tắc trình bày (BẮT BUỘC — triết lý):**
- Nốt **dàn ĐỀU** trong ô (các phách cách đều) → thể hiện trường độ bằng nhau.
- **2 ô / hàng** để nốt to, không tràn màn.
- Vạch nhịp (barline) đậm giữa các ô.
- Màu: 1 accent duy nhất (vd tím `#4338CA`) cho ô/phách đang chơi; còn lại xám nhạt (`#C0C6D2`). **Hạn chế màu mè.**

---

## 6. Count-in — ô lấy đà hiện số đếm

- Ô `{ pickup: true }`: thay vùng nốt bằng lưới `timeSignature` ô chứa số **1..N**.
- Số ở **phách hiện tại** (khi `barIdx===` ô lấy đà): to hơn + màu accent + phóng nhẹ; số khác mờ.
- Tác dụng: count‑in trực quan ngay trên khuông — học sinh đếm "1‑2‑3" rồi vào đúng ô hợp âm đầu, không bị bất ngờ.
- Nhãn ô để "Lấy đà".

---

## 7. Ô nghỉ — dấu lặng

- Ô `{ rest: true }`: hiện **dấu lặng** (web dùng font nhạc Bravura, ký tự lặng tròn `U+E4E3`; RN có thể dùng ảnh/SVG dấu lặng), nhãn "Nghỉ". Không quạt.

---

## 8. Xanh hóa — luyện nhiều lượt

Mỗi lần **gảy hết một lượt** (nhạc hết) = **1 phiên luyện**:
- Hiện màn "Gảy xong một lượt!" với **thanh 3 bước** (1→2→3) đổi màu **đỏ → vàng → xanh**.
- **3 lượt = xanh hóa** 🟢 (đạt mức "vững").
- Ghi nhận phiên vào hệ tiến độ kỹ năng (web dùng RPC `record_skill_session`).
- Nút **"Gảy thêm một lượt →"** (lặp lại) + "Dừng tại đây".

**Lời thông báo phải ĐỘNG VIÊN** (tránh khiến học sinh tưởng bị sai — KHÔNG dùng chữ "Đỏ/cần luyện thêm"):
- Lượt 1: *"Khởi đầu tốt — gảy thêm cho quen tay 👍"*
- Lượt 2: *"Tiến bộ rõ — thêm 1 lượt nữa là thật vững 💪"*
- Lượt 3+: *"Quá vững! Bạn làm chủ phần này rồi 🎸"*

---

## 9. Triết lý thiết kế (giữ xuyên suốt)

- **Đơn giản, hiệu quả, hạn chế màu mè không cần thiết.**
- **Nốt nhạc là trọng tâm** — vẽ to/đều/đẹp; mọi thứ khác lùi làm nền.
- Nốt móc đơn **cách đều** (trường độ bằng nhau).
- Hợp âm đặt **trên nốt đầu** của ô nhịp.
- Bố cục **như bản nhạc giấy, không cuộn**, quán xuyến cả bài trong một màn.
- Thông báo luôn **động viên**, hướng tiến bộ.

---

## 10. Luồng "NGƯỜI DÙNG TỰ CHÈN NHẠC" (cốt lõi sản phẩm)

Đây là phần biến công cụ thành thứ tự‑phục‑vụ, không đối thủ nào có. Mục tiêu: người dùng tạo "bài gảy theo" từ **nhạc của chính họ** trong vài bước:

1. **Chọn nguồn nhạc**: dán link YouTube **hoặc** chọn file audio trên máy.
2. **Nhập tempo + nhịp**: gõ `bpm` + chọn `timeSignature` (3 hay 4). *Hoặc* cho tap theo nhạc để app tự ước lượng tempo + `gridOffset` (bắt mốc phách 1).
3. **Đánh dấu hợp âm**: phát nhạc, mỗi lần đổi hợp âm thì **tap tên hợp âm** → app ghi mốc, tự gom thành các ô (`bars`). (Đây là "công cụ đánh dấu" — lõi giống Beat My Songs.)
4. **Chọn kiểu quạt**: nốt đen / chùm 2 / (sau này: các điệu khác).
5. App **dựng `StrumSong`** từ dữ liệu trên → vào thẳng màn chơi (mục 2).

Người dùng lưu lại bài của họ (cục bộ trên máy họ → tránh bản quyền; muốn chia sẻ thì là chuyện riêng của họ).

---

## 11. Mở rộng tương lai

- **2 hợp âm / ô nhịp** (jazz/đổi nhanh): cho `SongBar.chord2?` rơi ở nửa ô.
- **Ô lặp `%`** (simile): `SongBar.repeat?: true` → vẽ ký hiệu `%`, chơi y ô trước.
- **Chế độ "bảng hợp âm thuần"**: ẩn dải quạt ↓↑ (cho comping/solo tự do kiểu backing‑track jazz). Cờ `showStrum?: false`.
- **Điệu khác**: thay mẫu quạt mỗi ô (Ballad, Boléro, Disco…) bằng một "pattern" gồm chuỗi cú đánh/phách. Mô hình hóa: mỗi phách là một trong { down, up, rest, hold }.
- **Chọn tốc độ chậm để tập** (nếu nhạc có sẵn nhiều tempo, hoặc dùng pitch‑preserving slow‑down).

---

## 12. Ghi chú kỹ thuật cho Groove Lab (Expo / React Native)

- **Vẽ nốt**: `react-native-svg` (Svg, Rect, Line, Text). Logic giống hệt bản web.
- **Audio**: `expo-av` (Audio.Sound) cho file; `react-native-youtube-iframe` cho YouTube (ẩn player, lấy `getCurrentTime`).
- **Đồng hồ**: `requestAnimationFrame` cập nhật `t`; tính `barIdx`/`beatInBar` như mục 4.
- **Dấu lặng / ký hiệu nhạc**: nhúng font Bravura (SMuFL) hoặc vẽ SVG riêng.
- **Không cuộn**: layout cố định, ô co theo màn (Flexbox). 2 ô/hàng.
- **Hiệu năng**: chỉ cần re-render khi `barIdx`/`beatInBar` đổi (memo hóa các ô không sáng).

---

*Tài liệu này mô tả tính năng đã chạy thực tế trên web (cs-rhythm-editor, route `/hbd` và `/hbd-td1`). Dùng làm chuẩn để dựng lại trong Groove Lab.*
