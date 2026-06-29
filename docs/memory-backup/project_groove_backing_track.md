---
name: project_groove_backing_track
description: "Kế hoạch tính năng 'Nền tập quạt' (backing track generator trống+bass) cho Groove Lab — đã có đặc tả, CHƯA code"
metadata: 
  node_type: memory
  type: project
  originSessionId: 617ea51e-3947-431b-9f18-619d6b837510
---

Tính năng SẮP LÀM cho [[project_groove_lab]] (KHÁC [[project_groove_strum_guide]]): **"Nền tập quạt"** — engine TỰ SINH loop **trống + bass** (synth) theo điệu để người chơi quạt hợp âm theo nền. Không có đàn đệm/voicing (người dùng chính là người quạt). Synth tự sinh → không dính bản quyền, an toàn store.

**Đặc tả:** `~/Downloads/BAN-GIAO-groove-lab.md` (do thầy chat với Claude khác, lưu 27/6). V1: 5 điệu Ballad/Disco/Bolero/Slow Rock/Valse + bảng pattern đã chốt + presets vòng hợp âm + chord→bass R/5/8 + UI (chọn điệu/preset/key/tempo, mute+volume từng track, highlight ô đang chạy, Play/Loop, count-in).

**⚠️ VƯỚNG CHÍNH:** đặc tả viết theo **Tone.js (thư viện WEB) — KHÔNG chạy trên React Native**. Phải viết lại lớp engine sang **react-native-audio-api** (Groove Lab đã có sẵn 0.12.2, đủ primitive: OscillatorNode→kick/bass, AudioBufferSourceNode+BiquadFilterNode→noise snare/hi-hat; lookahead scheduler đã có ở `audio/clock.ts` → mở rộng ra step-grid thay Tone.Transport).
- DÙNG NGUYÊN được (copy thẳng): toàn bộ "trí tuệ nhạc" — mô hình Style/Preset, bảng pattern 5 điệu, logic chord→bass, presets. Lưu ý "ĐỪNG HARDCODE 4/4": Slow Rock triplet 12 step, Valse 3/4 6 step.
- Vị trí: là CÔNG CỤ (không phải bài học), tầng SỐNG/áp dụng — màn+route riêng.
- Rủi ro thử sớm: chất lượng synth (noise snare/hi-hat) trên audio-api + loop có gapless không.
- Ước lượng: dữ liệu=nhỏ; engine synth=vừa–lớn; scheduler+loop=vừa; UI=vừa.

**Điều hướng (đã làm 27/6):** Groove Lab chuyển sang BOTTOM TABS theo HỌC–TẬP–SỐNG: `app/(tabs)/` gồm `index.tsx`=**Học** (30 bài cũ, chuyển vào) + `tap.tsx`=**Tập** (mới). "Sống" CHƯA làm. `lesson/[id]`+`settings` vẫn stack đè toàn màn. Tab "Tập" HIỆN chỉ là KHUNG giới thiệu "Nền tập quạt" + 5 điệu + nhãn "Đang hoàn thiện" — CHƯA có engine, chưa kêu. ⚠️ ĐỪNG build/nộp store tới khi Tập có engine thật (tab rỗng dễ bị 2.1).

**ĐÃ CODE (27/6):** engine + UI xong cho cả 5 điệu.
- `data/backingStyles.ts`: 5 STYLES + PRESETS + parse hợp âm→bass (R/5/8), đọc beatsPerBar+feel.
- `audio/backingEngine.ts`: synth thuần react-native-audio-api (kick=osc pitch-env, snare/hihat=noise buffer+highpass biquad, bass=triangle, click) + scheduler lookahead step-grid + loop + bus mute Trống/Bass/Click. Lưu ý: type noise/bus để `any` (type AudioBuffer của lib khác global).
- `app/(tabs)/tap.tsx`: UI chọn điệu + vòng hợp âm có highlight ô đang chạy (rAF đọc getBarIndex) + tempo± + mute + Chạy nền/Dừng.
- VERIFY web: tsc sạch, render đẹp, engine chạy + highlight khớp clock, không lỗi console. CHƯA nghe được tiếng (preview headless) → PHẢI test sound trên máy thật/TestFlight.
- NÂNG BASS (27/6): (a) chất tiếng = sub sine sạch + 2 saw detune ±7c + tanh saturation + ADSR (thầy duyệt OK); (b) CÔNG THỨC NỐT (thầy CHỐT bảng tinh thần từng điệu, mộc hơn — không "bay"): Ballad=gốc phách 1&3 thoáng + nốt dẫn CHỈ ở ô cuối vòng; Disco=R–8 octave drive, mỗi 4 ô chèn R–8–5–8; Bolero=R–R–5–5 mộc (bỏ nốt 3); Slow Rock=gốc đứng từng phách (chắc nặng, không chạy); Valse=chỉ gốc phách 1 (giữ lilt). Cơ chế: Style.bassFinal (ô cuối vòng) + bassAlt+altEvery (biến tấu định kỳ); bassFreq đọc chordQuality (maj/min/dim/aug) cho bậc 3 & quãng 5; 'A'=nốt dẫn chromatic dưới gốc hợp âm kế (engine truyền nextChord). Đã verify nốt đúng nhạc lý.
- CÔNG THỨC BASS THẦY CHỐT (lưới đếm, đã verify+duyệt): Ballad = R · · R R · · ·  (gốc ph1; R-R đảo phách &2+ph3; sau thoáng; ô cuối vòng thêm Lead ở &4). Bolero = R · · R R · 5 5 (gốc ph1; R-R đảo phách &2+ph3, nghỉ &3; 5-5 ph4+&4). Slow Rock (liên ba 12 step): ô thường = R · · · · R R · · R · · (gốc chắc, không chạy); ô CUỐI vòng (bassFinal) = ...A3 A2 A1 = câu LEAD 3 nốt CHROMATIC walk lên gốc, phủ phách 4 (4&&). Thầy chốt: lead CHỈ ô cuối (mỗi ô bị "dày") + chromatic (hợp blues/slow rock hơn diatonic; diatonic để dành ballad/folk). Đã thêm bậc lead A1/A2/A3 (=−1/−2/−3 nửa cung dưới gốc kế). Disco = R-8 octave, mỗi 4 ô chèn R-8-5-8 (bassAlt). Valse = chỉ gốc ph1.
- CÒN LẠI/tinh chỉnh: nghe chất synth + loop gapless trên device; chưa có count-in (đặc tả nói nên có); chưa có volume slider từng track (mới có mute on/off); chưa có chọn key riêng (preset đã gồm key).
- ⚠️ Vẫn ĐỪNG đẩy công khai App Store/Play tới khi thầy duyệt tiếng (tab Tập giờ đã chạy được nên build TestFlight test nội bộ thì OK). Groove Lab v1.0 đã lên App Store + đang đẩy CH Play (xem [[project_groove_lab]]).

**TÁI SỬ DỤNG cho LMS web (29/6):** thầy đã viết bản BÀN GIAO engine sang **Web Audio thuần** tại `docs/groove-backing-track-engine.md` trong repo cs-rhythm-editor (port TỪ react-native-audio-api SANG web — KHÔNG còn dùng Tone.js; chỉ đổi 3 chỗ: tạo context, bỏ AudioManager iOS, ctx.resume trong onClick). Toàn bộ trí tuệ nhạc (5 điệu step-grid, chord→bass, bassFinal/bassAlt) + voices synth + lookahead scheduler chạy thẳng trên web. Yêu cầu thầy: CHỈ nghiên cứu nhặt tinh hoa cho soạn bài giảng, CHƯA code bên này. **Tinh hoa đáng nhặt:** (1) mô hình step-grid + 5 điệu → mở rộng [[project_strum_score]] ra điệu thật (Ballad/Bolero/Slow Rock/Valse/Disco); (2) backing engine synth = lesson-type "nền tập quạt" soạn chỉ cần {chords, điệu, tempo}, KHỎI cần file thu/đánh dấu mốc, sạch bản quyền; (3) chord parsing root/quality; (4) scheduler 2 đồng hồ. Hướng đẹp: ghép Strum Score (notation) + Backing engine (nền synth) = bài luyện hoàn chỉnh không cần thu âm.
