import type { Pitch, Step } from "../edit/commands.ts";
import { STEP_SEMITONE } from "../edit/pitchModel.ts";

/**
 * Trạng thái NHẬP NỐT — Giai đoạn 4B.1.
 *
 * Đây là "công cụ đang cầm trên tay", KHÔNG phải một bản sao của bản nhạc. Nó
 * chỉ trả lời đúng một câu: gõ chữ `C` lúc này thì ra Đô mấy.
 *
 * Cấm tuyệt đối: ô nhịp, danh sách nốt, mô hình thời gian, cây bản nhạc. Nguồn
 * sự thật duy nhất vẫn là MusicXML; thêm một mô hình thứ hai là mở đường cho
 * hai bên nói hai đằng.
 *
 * ═══ QUÃNG TÁM LẤY Ở ĐÂU ═══
 * Đã khảo sát trước khi viết, không tự nghĩ ra:
 *
 *   MuseScore 4 — trong chế độ nhập nốt, gõ một chữ cái đặt nốt vào quãng tám
 *     GẦN NHẤT so với nốt vừa nhập trước đó (tài liệu chính thức: "the note is
 *     placed closest to the previous note", tức trong vòng một quãng bốn).
 *   Smoosic — phím chữ cái đổi bậc của nốt ĐANG CHỌN và giữ nguyên quãng tám
 *     của chính nốt ấy; không có khái niệm quãng tám nhập.
 *   Guitar Pro — nhập theo dây/phím đàn, không có phím chữ cái, không dùng được
 *     làm quy ước ở đây.
 *
 * Chỗ ta đứng khác cả hai: caret đang ở một DẤU LẶNG, mà dấu lặng thì không có
 * quãng tám để giữ. Nên lấy đúng quy ước MuseScore — gần nhất so với cao độ
 * tham chiếu — và cao độ tham chiếu là thứ editor ĐÃ BIẾT ĐÍCH DANH: nốt vừa
 * nhập, hoặc nốt có cao độ mà caret vừa đi qua. Không hình học, không "nốt gần
 * nhất trên màn hình", không dò theo thời gian.
 *
 * Khi chưa có tham chiếu nào (mở bài lên, bấm ngay vào một dấu lặng) thì dùng
 * `QUANG_TAM_MAC_DINH` — nói thẳng ra một con số thay vì đoán.
 */
export const QUANG_TAM_MAC_DINH = 4;

export interface NoteEntryState {
  /** Quãng tám dùng khi CHƯA có cao độ tham chiếu nào. */
  entryOctave: number;
  /** Cao độ tham chiếu: nốt vừa nhập hoặc vừa đi qua. `null` = chưa có. */
  thamChieu: Pitch | null;
}

export const NHAP_BAN_DAU: NoteEntryState = {
  entryOctave: QUANG_TAM_MAC_DINH,
  thamChieu: null,
};

/** Bậc diatonic tuyệt đối: C4 = 4×7 + 0. Dùng để đo "gần" theo mặt chữ. */
const BAC_DIATONIC = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 } as const;
const bac = (step: Step, octave: number) => octave * 7 + BAC_DIATONIC[step];

/**
 * Gõ chữ `step` lúc này thì ra cao độ nào.
 *
 * Chọn quãng tám sao cho khoảng cách MẶT CHỮ tới cao độ tham chiếu là nhỏ nhất
 * — tức là không bao giờ quá một quãng bốn, đúng quy ước MuseScore. Không có
 * trường hợp hoà: bảy bậc một quãng tám là số lẻ, nên hai phía luôn khác nhau.
 *
 * `alter` luôn là 0: gõ `C` là ra Đô tự nhiên. Muốn thăng giáng thì dùng ♭ ♮ ♯
 * hoặc ↑↓ sau đó — 4B.1 không đoán hộ dấu hoá theo bộ khoá.
 */
export function capDoNhap(state: NoteEntryState, step: Step): Pitch {
  const t = state.thamChieu;
  if (!t) return { step, alter: 0, octave: state.entryOctave };
  const moc = bac(t.step, t.octave);
  let tot = { step, alter: 0, octave: t.octave };
  let gan = Infinity;
  for (const o of [t.octave - 1, t.octave, t.octave + 1]) {
    if (o < 0 || o > 9) continue;
    const d = Math.abs(bac(step, o) - moc);
    if (d < gan) {
      gan = d;
      tot = { step, alter: 0, octave: o };
    }
  }
  return tot;
}

/** Ghi nhớ cao độ vừa gặp — nốt vừa nhập, hoặc nốt caret vừa dừng lại trên đó. */
export const ghiNhoThamChieu = (state: NoteEntryState, pitch: Pitch): NoteEntryState =>
  state.thamChieu &&
  state.thamChieu.step === pitch.step &&
  state.thamChieu.octave === pitch.octave &&
  state.thamChieu.alter === pitch.alter
    ? state
    : { ...state, thamChieu: pitch, entryOctave: pitch.octave };

/** Chỉ để test đọc được: cao độ vang lên của một `Pitch`. */
export const nuaCung = (p: Pitch) => (p.octave + 1) * 12 + STEP_SEMITONE[p.step] + p.alter;
