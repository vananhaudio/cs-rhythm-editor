# BÀN GIAO — Engine "Nền tập quạt" (trống + bass synth) để TÁI SỬ DỤNG ở app TVA (web)

> Engine sinh **loop trống + bass** theo điệu để học viên **quạt hợp âm theo nền**. Đã chạy thật trong **Groove Lab** (Expo/React Native, `react-native-audio-api`). Tài liệu này để **port sang web** (React + Web Audio API) nhúng vào **bài giảng** trên TVA.
>
> Nguồn gốc (Groove Lab): `data/backingStyles.ts` + `audio/backingEngine.ts`.

---

## 0. Web vs React Native — CHỈ phải đổi 3 chỗ

`react-native-audio-api` là bản sao Web Audio API. **Toàn bộ logic + synth + scheduler dùng nguyên**, chỉ khác:

| Chỗ | React Native (gốc) | Web (TVA) |
|---|---|---|
| Tạo context | `import { AudioContext } from 'react-native-audio-api'` | `new (window.AudioContext \|\| window.webkitAudioContext)()` |
| iOS audio session | `AudioManager.setAudioSessionOptions/Activity` | **Bỏ hẳn** (web không cần) |
| Resume sau cử chỉ user | `ctx.resume()` | `ctx.resume()` (bắt buộc gọi trong onClick Play) |

Mọi thứ còn lại — `createOscillator/createGain/createBiquadFilter/createBufferSource/createBuffer/createWaveShaper`, `AudioParam.setValueAtTime/linearRampToValueAtTime/exponentialRampToValueAtTime`, `oscillator.detune`, `ctx.currentTime`, `requestAnimationFrame` — **giống hệt** trên web.

> Lưu ý bản quyền: engine **tự sinh tiếng bằng synth**, không phát nhạc thu sẵn → không dính bản quyền, dùng tự do trong bài giảng.

---

## 1. Mô hình dữ liệu

```ts
export type Feel = 'straight' | 'triplet';
export type HH = 0 | 1 | 'o';                 // hi-hat: 0 nghỉ, 1 đóng, 'o' mở
// Bass: R=gốc, 3=bậc 3 (theo trưởng/thứ), 5=quãng 5, 8=octave, null=nghỉ.
// Nốt dẫn chromatic dưới gốc hợp âm KẾ: A/A1=−1 nửa cung, A2=−2, A3=−3 (xếp A3·A2·A1 = câu lead 3 nốt walk lên).
export type BassDegree = 'R' | '3' | '5' | '8' | 'A' | 'A1' | 'A2' | 'A3' | null;

export interface Style {
  id: string; name: string;
  beatsPerBar: 3 | 4;
  feel: Feel;
  stepsPerBar: number;        // 8 (4/4 straight) | 12 (4/4 triplet) | 6 (3/4)
  defaultTempo: number;
  drum: { hh: HH[]; snare: (0 | 1)[]; kick: (0 | 1)[] }; // độ dài = stepsPerBar
  bass: BassDegree[];                                    // độ dài = stepsPerBar
  bassFinal?: BassDegree[]; // pattern riêng cho Ô CUỐI vòng (turnaround / nốt dẫn)
  bassAlt?: BassDegree[];   // biến tấu định kỳ
  altEvery?: number;        // cứ mỗi N ô dùng bassAlt một lần
}

export interface Preset {
  id: string; name: string; styleId: string;
  key: string;              // chỉ để hiển thị/khởi tạo
  tempo?: number; chords: string[]; // 1 hợp âm / 1 ô nhịp
}
```

**Quy ước lưới step (QUAN TRỌNG — đừng hardcode 4/4):** mỗi ô nhịp chia `stepsPerBar` bước đều.
- 4/4 straight → 8 step = `1 & 2 & 3 & 4 &`
- 4/4 triplet (slow rock) → 12 step = `1&&2&&3&&4&&`
- 3/4 → 6 step = `1 & 2 & 3 &`

`perBeat = stepsPerBar / beatsPerBar`. Bước thứ `s` rơi vào phách `floor(s/perBeat)+1`.

---

## 2. Bảng điệu (đã CHỐT — copy nguyên)

```ts
export const STYLES: Style[] = [
  {
    id: 'ballad', name: 'Ballad', beatsPerBar: 4, feel: 'straight', stepsPerBar: 8, defaultTempo: 70,
    drum: { hh: [1,1,1,1,1,1,1,1], snare: [0,0,1,0,0,0,1,0], kick: [1,0,0,0,1,0,0,0] },
    // 1 & 2 & 3 & 4 & -> R · · R R · · ·  | Ô CUỐI thêm nốt dẫn ở &4
    bass:      ['R', null, null, 'R', 'R', null, null, null],
    bassFinal: ['R', null, null, 'R', 'R', null, null, 'A'],
  },
  {
    id: 'disco', name: 'Disco', beatsPerBar: 4, feel: 'straight', stepsPerBar: 8, defaultTempo: 115,
    drum: { hh: ['o',1,'o',1,'o',1,'o',1], snare: [0,0,1,0,0,0,1,0], kick: [1,0,1,0,1,0,1,0] },
    // octave drive; cứ 4 ô thì 1 ô chèn quãng 5
    bass:    ['R','8','R','8','R','8','R','8'],
    bassAlt: ['R','8','5','8','R','8','5','8'], altEvery: 4,
  },
  {
    id: 'bolero', name: 'Bolero', beatsPerBar: 4, feel: 'straight', stepsPerBar: 8, defaultTempo: 75,
    drum: { hh: [1,1,1,1,1,1,1,1], snare: [0,0,1,0,0,0,1,0], kick: [1,0,0,1,0,0,1,0] },
    // 1 & 2 & 3 & 4 & -> R · · R R · 5 5  (R-R đảo phách &2+ph3; nghỉ &3; 5-5 ph4+&4)
    bass: ['R', null, null, 'R', 'R', null, '5', '5'],
  },
  {
    id: 'slowrock', name: 'Slow Rock', beatsPerBar: 4, feel: 'triplet', stepsPerBar: 12, defaultTempo: 66,
    drum: {
      hh:    [1,1,1,1,1,1,1,1,1,1,1,1],
      snare: [0,0,0,1,0,0,0,0,0,1,0,0],
      kick:  [1,0,0,0,0,0,1,0,0,0,0,0],
    },
    // liên ba. Ô THƯỜNG: R · · · · R R · · R · ·  | Ô CUỐI: ...A3 A2 A1 = câu lead 3 nốt chromatic phủ phách 4
    bass:      ['R', null, null, null, null, 'R', 'R', null, null, 'R',  null, null],
    bassFinal: ['R', null, null, null, null, 'R', 'R', null, null, 'A3', 'A2', 'A1'],
  },
  {
    id: 'valse', name: 'Valse', beatsPerBar: 3, feel: 'straight', stepsPerBar: 6, defaultTempo: 140,
    drum: { hh: [0,0,1,0,1,0], snare: [0,0,1,0,1,0], kick: [1,0,0,0,0,0] },
    // chỉ gốc phách 1; phách 2-3 trống giữ lilt
    bass: ['R', null, null, null, null, null],
  },
];

export const PRESETS: Preset[] = [
  { id: 'pop-1645',   name: 'Pop 1–6–4–5',   styleId: 'ballad', key: 'C',  chords: ['C','Am','F','G'] },
  { id: 'disco-1645', name: 'Disco 1–6–4–5', styleId: 'disco',  key: 'C',  chords: ['C','Am','F','G'] },
  { id: 'canon',      name: 'Canon',          styleId: 'ballad', key: 'C',  chords: ['C','G','Am','Em','F','C','F','G'] },
  { id: 'bolero-am',  name: 'Bolero buồn',    styleId: 'bolero', key: 'Am', chords: ['Am','Dm','E','Am'] },
  { id: 'valse-c',    name: 'Valse',          styleId: 'valse',  key: 'C',  chords: ['C','F','G','C'] },
];
```

### Tinh thần bass từng điệu (để hiểu khi chỉnh)
| Điệu | Bass | Tinh thần |
|---|---|---|
| Ballad | R · · R R · · · (+lead cuối vòng) | Thoáng, có hơi thở, cuối câu có hướng đi |
| Disco | R–8 octave, mỗi 4 ô chèn R–8–5–8 | Octave drive, tạo nhún |
| Bolero | R · · R R · 5 5 | Mộc, mềm, rõ nền; R-R đảo phách |
| Slow Rock | gốc chắc; ô cuối walk chromatic 3 nốt | Chắc nặng, không chạy; turnaround blues |
| Valse | chỉ gốc phách 1 | Phách 1 rõ, giữ lilt |

> **Chromatic vs Diatonic:** nốt dẫn dùng **chromatic** (nửa cung) — hợp blues/slow rock và **chạy đúng với MỌI vòng hợp âm** mà không cần biết tông. Nếu muốn "ngọt/trong tông" cho ballad-folk thì làm diatonic (cần xác định scale từ `key`).

---

## 3. Hợp âm → tần số nốt bass (copy nguyên)

```ts
const PC: Record<string, number> = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
type Quality = 'maj' | 'min' | 'dim' | 'aug';

export function chordRootPitchClass(chord: string): number | null {
  if (!chord) return null;
  let pc = PC[chord[0].toUpperCase()];
  if (pc === undefined) return null;
  const next = chord[1];
  if (next === '#') pc = (pc + 1) % 12;
  else if (next === 'b') pc = (pc + 11) % 12;
  return pc;
}

export function chordQuality(chord: string): Quality {
  const rest = chord.replace(/^[A-Ga-g][#b]?/, '');
  if (/^(dim|°|o)/i.test(rest) || /b5/.test(rest)) return 'dim';
  if (/^(aug|\+)/i.test(rest) || /#5/.test(rest)) return 'aug';
  if (/^(m(?!aj)|min|-)/i.test(rest)) return 'min';
  return 'maj';
}
const thirdSemis = (q: Quality) => (q === 'min' || q === 'dim' ? 3 : 4);
const fifthSemis = (q: Quality) => (q === 'dim' ? 6 : q === 'aug' ? 8 : 7);

// Gốc đặt ở octave 2 (C2 = MIDI 36). 'A*' cần truyền nextChord.
export function bassFreq(chord: string, degree: Exclude<BassDegree, null>, nextChord?: string): number | null {
  const pc = chordRootPitchClass(chord);
  if (pc === null) return null;
  const rootMidi = 36 + pc;
  let midi: number;
  if (degree === 'R') midi = rootMidi;
  else if (degree === '8') midi = rootMidi + 12;
  else if (degree === '3') midi = rootMidi + thirdSemis(chordQuality(chord));
  else if (degree === '5') midi = rootMidi + fifthSemis(chordQuality(chord));
  else { // 'A'/'A1'/'A2'/'A3' — chromatic dưới gốc hợp âm kế
    const npc = nextChord ? chordRootPitchClass(nextChord) : null;
    if (npc === null) return null;
    const off = degree === 'A3' ? 3 : degree === 'A2' ? 2 : 1;
    let am = 36 + npc - off;
    if (am < 33) am += 12;
    midi = am;
  }
  return midiToFreq(midi);
}
```

---

## 4. Engine — synth voices + scheduler (bản WEB)

> Đây là `backingEngine.ts` đã **sửa cho web**: bỏ `AudioManager`, đổi tạo context. Voices + scheduler giữ nguyên.

```ts
import { Style, bassFreq } from './backingStyles';

export type Mutes = { drums: boolean; bass: boolean; click: boolean };
export type EngineCallbacks = {
  getStyle: () => Style; getChords: () => string[]; getTempo: () => number; getMutes: () => Mutes;
};

const LOOKAHEAD_MS = 25, SCHEDULE_AHEAD = 0.12, LEAD_IN = 0.15;

export class BackingEngine {
  private ctx: AudioContext | null = null;
  private cb: EngineCallbacks;
  private timer: any = null;
  private playing = false;
  private nextStepTime = 0; private stepIdx = 0; private barIdx = 0; private startTime = 0;
  private stepsPerBar = 8; private barsTotal = 1;
  private noise: AudioBuffer | null = null;
  private satCurve: Float32Array | null = null;
  private master!: GainNode; private drumBus!: GainNode; private bassBus!: GainNode; private clickBus!: GainNode;

  constructor(cb: EngineCallbacks) { this.cb = cb; }

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return this.ctx;
  }

  private ensureGraph() {
    const ctx = this.getCtx();
    if (this.master) return;
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
    this.drumBus = ctx.createGain(); this.drumBus.connect(this.master);
    this.bassBus = ctx.createGain(); this.bassBus.connect(this.master);
    this.clickBus = ctx.createGain(); this.clickBus.gain.value = 0.6; this.clickBus.connect(this.master);
    const len = Math.floor(ctx.sampleRate * 1);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const N = 1024, drive = 1.8, c = new Float32Array(N), k = Math.tanh(drive);
    for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1; c[i] = Math.tanh(x * drive) / k; }
    this.satCurve = c;
  }

  async start() {
    if (this.playing) return;
    const ctx = this.getCtx(); this.ensureGraph();
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch {} } // PHẢI gọi trong cử chỉ user
    const style = this.cb.getStyle();
    this.stepsPerBar = style.stepsPerBar;
    this.barsTotal = Math.max(1, this.cb.getChords().length);
    this.playing = true; this.stepIdx = 0; this.barIdx = 0; this.applyMutes();
    this.nextStepTime = ctx.currentTime + LEAD_IN; this.startTime = this.nextStepTime;
    this.scheduler();
    this.timer = setInterval(() => this.scheduler(), LOOKAHEAD_MS);
  }
  stop() { this.playing = false; if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  dispose() { this.stop(); try { this.ctx?.close(); } catch {} this.ctx = null; (this as any).master = null; }

  private applyMutes() {
    const m = this.cb.getMutes();
    if (this.drumBus) this.drumBus.gain.value = m.drums ? 0 : 1;
    if (this.bassBus) this.bassBus.gain.value = m.bass ? 0 : 1;
    if (this.clickBus) this.clickBus.gain.value = m.click ? 0 : 0.6;
  }

  // Vị trí ô nhịp đang chạy — UI đọc mỗi frame (requestAnimationFrame) để highlight.
  getBarIndex(): number {
    if (!this.playing || !this.ctx) return -1;
    const elapsed = this.ctx.currentTime - this.startTime;
    if (elapsed < 0) return -1;
    const totalSteps = Math.floor(elapsed / this.stepDur(this.cb.getStyle()));
    return Math.floor(totalSteps / this.stepsPerBar) % this.barsTotal;
  }
  private stepDur(style: Style): number {
    return (style.beatsPerBar * (60 / this.cb.getTempo())) / style.stepsPerBar;
  }

  private scheduler() {
    if (!this.playing || !this.ctx) return;
    const ctx = this.ctx, style = this.cb.getStyle(), chords = this.cb.getChords();
    this.applyMutes();
    while (this.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const s = this.stepIdx, t = this.nextStepTime;
      const hh = style.drum.hh[s];
      if (hh !== 0) this.hihat(t, hh === 'o');
      if (style.drum.snare[s]) this.snare(t);
      if (style.drum.kick[s]) this.kick(t);
      // chọn pattern bass theo ô: ô cuối vòng / biến tấu định kỳ / mặc định
      const isLast = this.barIdx === chords.length - 1;
      const useAlt = style.bassAlt && style.altEvery && this.barIdx % style.altEvery === style.altEvery - 1;
      const pat = isLast && style.bassFinal ? style.bassFinal : useAlt ? style.bassAlt! : style.bass;
      const deg = pat[s];
      if (deg) {
        const cur = chords[this.barIdx] ?? chords[0];
        const nxt = chords[(this.barIdx + 1) % chords.length] ?? cur;
        const f = bassFreq(cur, deg, nxt);
        if (f) this.bassNote(t, f);
      }
      const perBeat = style.stepsPerBar / style.beatsPerBar;
      if (s % perBeat === 0) this.click(t, s === 0);
      this.nextStepTime += this.stepDur(style);
      if (++this.stepIdx >= style.stepsPerBar) { this.stepIdx = 0; this.barIdx = (this.barIdx + 1) % Math.max(1, chords.length); }
    }
  }

  // ── VOICES (Web Audio API thuần — chạy y hệt trên web) ──
  private kick(t: number, peak = 1.0) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(this.drumBus); o.start(t); o.stop(t + 0.2);
  }
  private snare(t: number) {
    const ctx = this.ctx!, src = ctx.createBufferSource(); src.buffer = this.noise;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400; hp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.6, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    src.connect(hp).connect(g).connect(this.drumBus); src.start(t, 0, 0.16); src.stop(t + 0.16);
  }
  private hihat(t: number, open: boolean) {
    const ctx = this.ctx!, src = ctx.createBufferSource(); src.buffer = this.noise;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000; hp.Q.value = 0.7;
    const g = ctx.createGain(), dec = open ? 0.18 : 0.035;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.28, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + dec);
    src.connect(hp).connect(g).connect(this.drumBus); src.start(t, 0, dec + 0.02); src.stop(t + dec + 0.02);
  }
  // Bass: sub sine sạch + 2 saw detune ±7c (unison dày) qua lowpass có filter-env, lớp hài âm qua bão hoà tanh; ADSR.
  private bassNote(t: number, freq: number) {
    const ctx = this.ctx!;
    const sub = ctx.createOscillator(), sawA = ctx.createOscillator(), sawB = ctx.createOscillator();
    const subG = ctx.createGain(), sawG = ctx.createGain();
    const lp = ctx.createBiquadFilter(), drive = ctx.createWaveShaper(), amp = ctx.createGain();
    sub.type = 'sine'; sawA.type = 'sawtooth'; sawB.type = 'sawtooth';
    sub.frequency.setValueAtTime(freq, t);
    sawA.frequency.setValueAtTime(freq, t); sawA.detune.setValueAtTime(7, t);
    sawB.frequency.setValueAtTime(freq, t); sawB.detune.setValueAtTime(-7, t);
    subG.gain.value = 0.9; sawG.gain.value = 0.16;
    lp.type = 'lowpass'; lp.Q.value = 1.1;
    lp.frequency.setValueAtTime(Math.min(1800, freq * 6), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(150, freq * 2.2), t + 0.18);
    if (this.satCurve) { drive.curve = this.satCurve; drive.oversample = '2x'; }
    const peak = 0.62, sustain = 0.42;
    amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(peak, t + 0.014);
    amp.gain.exponentialRampToValueAtTime(sustain, t + 0.16);
    amp.gain.setValueAtTime(sustain, t + 0.30); amp.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    sub.connect(subG).connect(amp);
    sawA.connect(sawG); sawB.connect(sawG); sawG.connect(lp).connect(drive).connect(amp);
    amp.connect(this.bassBus);
    sub.start(t); sawA.start(t); sawB.start(t);
    sub.stop(t + 0.57); sawA.stop(t + 0.57); sawB.stop(t + 0.57);
  }
  private click(t: number, accent: boolean) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(accent ? 1600 : 1100, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(accent ? 0.5 : 0.32, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.03);
    o.connect(g).connect(this.clickBus); o.start(t); o.stop(t + 0.04);
  }
}
```

---

## 5. Kiến trúc & nguyên lý (để hiểu, không phải để copy)

- **"Hai đồng hồ" (lookahead scheduler):** JS `setInterval` 25ms KHÔNG phát tiếng — chỉ *lên lịch* các step rơi vào cửa sổ 120ms tới (`SCHEDULE_AHEAD`) bằng `osc.start(t)` với `t` là thời điểm audio chính xác. Tiếng phát mượt trên audio thread, không giật dù JS bận. (Pattern "A Tale of Two Clocks".)
- **Loop mượt:** không có "điểm nối" — scheduler cứ tăng `nextStepTime`, hết `stepsPerBar` thì `barIdx` quay vòng `% chords.length`. Không dừng/khởi động lại.
- **Highlight khớp tiếng:** UI gọi `getBarIndex()` mỗi `requestAnimationFrame`, tính từ `ctx.currentTime` (cùng đồng hồ với tiếng) → ô sáng luôn đúng nhịp nghe.
- **Đổi tempo khi đang chạy:** đọc `getTempo()` live mỗi step → mượt, KHÔNG cần restart. Đổi **điệu** (khác stepsPerBar) thì UI nên `stop()` rồi `start()`.
- **3 bus mute riêng:** `drumBus / bassBus / clickBus → master(0.9) → destination`. Mute = set gain 0.
- **Bass chuyên nghiệp:** sub sine giữ đáy SẠCH (không qua bão hoà) + 2 saw detune ±7 cent (unison dày) qua lowpass có filter-envelope (pluck→ấm) + bão hoà tanh CHỈ lên lớp hài âm + ADSR mềm (không click).

---

## 6. Nhúng vào BÀI GIẢNG trên TVA — gợi ý

1. Component `BackingPlayer` giữ state: `styleId, chords, tempo, mutes`; tạo `engineRef = new BackingEngine({ getStyle, getChords, getTempo, getMutes })` (đọc live qua ref).
2. Nút Play: `engine.start()` + bắt đầu vòng `requestAnimationFrame` set `curBar = engine.getBarIndex()`. **Phải gọi trong onClick** (Web Audio cần cử chỉ user để resume).
3. Hiển thị: hàng ô hợp âm, ô `i === curBar` thì sáng (1 màu accent).
4. Một **bài giảng** = chỉ cần truyền `{ styleId, chords, tempo }` (giống `Preset`). Thầy soạn vòng hợp âm cho từng bài → học viên bấm Chạy nền quạt theo.
5. Tái dùng được trong khoá Elearn (`src/elearn/`): thêm 1 lesson-type kiểu `backing` render component này với data từ DB.

### Tiêu chí "xong"
- [ ] 5 điệu đúng số chỉ nhịp + cảm giác (Slow Rock triplet 12 step, Valse 3/4 6 step — không ép về 4/4).
- [ ] Bass đúng pattern + đúng nốt gốc/3/5/8 + nốt dẫn theo hợp âm kế.
- [ ] Loop không khựng; đổi tempo/preset/điệu cập nhật đúng; highlight khớp tiếng; mute từng track chạy.

---

## 7. Để dành nâng cấp (v2)
- Trống/bass dùng **sample thật** (one-shot qua `AudioBufferSourceNode`/Sampler) thay synth — bước nhảy chất lượng lớn nhất; kiến trúc lập lịch GIỮ NGUYÊN, chỉ thay nguồn tiếng.
- **Volume slider** từng track (hiện mới mute on/off).
- **Count-in** 1 ô click trước khi vào loop.
- Lead **diatonic** cho ballad/folk (cần xác định scale từ `key`).
- Thêm điệu (Rhumba, Fox, Slow…), fill cuối vòng, bass walking đầy đủ.

*Hết. Phần "trí tuệ nhạc" (mục 2–3) đã chốt và verify đúng nhạc lý; engine (mục 4) là Web Audio API thuần nên chạy trực tiếp trên web TVA.*
