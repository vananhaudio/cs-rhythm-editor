/**
 * KHUÔNG TAB — Giai đoạn 4D.
 *
 * ═══ AUDIT (đo trên file thật, không đoán) ═══
 * Chín file có `<fret>`: ba bài trong thư viện của thầy, hai bài tải về, bốn
 * fixture. Năm file thật (MuseScore 3.6.2 ×4, Guitar Pro 8.1.5 ×1) cho cùng
 * một bức tranh:
 *
 *   · MỘT part, HAI khuông: khuông 1 khoá Sol, khuông 2 khoá TAB.
 *   · Cách lên dây nằm TRONG file: `<staff-details number="2">` +
 *     `<staff-tuning>`. Cả năm đều là E2 A2 D3 G3 B3 E4, nhưng đó là dữ liệu
 *     của bài, không phải mặc định của công cụ.
 *   · Capo: không file nào ghi.
 *   · 689 / 689 nốt TAB mang CẢ `<pitch>` lẫn `<string>`+`<fret>`.
 *   · Dây 1 là dây CAO nhất: `string S` ↔ dòng `(số dòng + 1 − S)`, và
 *     `dây buông + phím = cao độ` đúng cho 689 / 689 nốt, lệch 0.
 *   · Không một thuộc tính nào trên `<note>` nối nốt khuông nhạc với nốt TAB.
 *
 * ═══ GHÉP CẶP KHUÔNG NHẠC ↔ TAB: KHÔNG CÓ ═══
 * Nốt khuông nhạc và nốt TAB là HAI `<note>` riêng, cách nhau bằng
 * `<backup>`. Trong một bài thật, 41 / 41 ô có thứ tự cao độ hai khuông trùng
 * nhau — nhưng đó là thói quen của phần mềm xuất, không phải cấu trúc MusicXML
 * bảo đảm. Ghép "nốt thứ k với nốt thứ k" hay "cùng cao độ, cùng thời điểm" là
 * đúng loại suy đoán bị cấm. Nên công cụ CHỈ sửa đúng nốt TAB được chọn, và
 * nói rõ là nốt khuông nhạc không được tự sửa theo.
 *
 * ═══ alphaTab: KHÔNG DÙNG LẠI MÃ ═══
 * alphaTab 1.8.3 đánh số dây NGƯỢC chiều — "1 is the lowest string" trong
 * `Note.string`. Dùng thẳng là đảo dây im lặng. Còn phép cao độ của nó
 * (`realValue = stringTuning + fret`) chỉ chạy trên cả mô hình `Staff`/`Track`,
 * tức là biến alphaTab thành mô hình soạn thảo — việc bị cấm. Thứ có giá trị
 * là TỪ VỰNG (dây, phím, lên dây), mà MusicXML đã cho sẵn. Công cụ dùng lại
 * `tuningOf` của 3B — hàm đã chạy production, đọc đúng quy ước MusicXML.
 */

/** Trần của Ô NHẬP, không phải giới hạn của cây đàn — MusicXML không ghi số phím. */
export const PHIM_TOI_DA_UI = 24;

/**
 * Cách lên dây của một khuông: số dây → cao độ dây buông (MIDI).
 * `null` = bài không ghi, và khi ấy KHÔNG phép tính cao độ ↔ phím nào được chạy.
 */
export type LenDay = ReadonlyMap<number, number>;

export type LyDoTab =
  | "TAB_TUNING_NOT_RESOLVED"
  | "TAB_STRING_INVALID"
  | "TAB_FRET_INVALID"
  | "TAB_FRET_OUT_OF_RANGE";

export interface KetQuaTab {
  ok: true;
  string: number;
  fret: number;
  /** Cao độ vang lên (MIDI) = dây buông + phím. */
  midi: number;
}
export interface LoiTab {
  ok: false;
  code: LyDoTab;
  message: string;
}

const loi = (code: LyDoTab, message: string): LoiTab => ({ ok: false, code, message });

/** Dây có trong cách lên dây của bài không. */
export const coDay = (lenDay: LenDay | null, day: number) =>
  !!lenDay && Number.isInteger(day) && lenDay.has(day);

/**
 * Kiểm một vị trí (dây, phím) và tính cao độ của nó.
 * Mọi đường ghi TAB đều đi qua đây, nên bất biến "buông + phím = cao độ" không
 * bao giờ bị phá.
 */
export function viTri(lenDay: LenDay | null, day: number, phim: number): KetQuaTab | LoiTab {
  if (!lenDay || !lenDay.size)
    return loi(
      "TAB_TUNING_NOT_RESOLVED",
      "Bài này không ghi cách lên dây cho khuông TAB — chưa tính được phím và cao độ."
    );
  if (!Number.isInteger(day) || day < 1)
    return loi("TAB_STRING_INVALID", "Số dây không hợp lệ.");
  const buong = lenDay.get(day);
  if (buong === undefined)
    return loi(
      "TAB_TUNING_NOT_RESOLVED",
      `Bài không ghi cách lên dây cho dây ${day} — chưa tính được cao độ trên dây ấy.`
    );
  if (!Number.isInteger(phim) || phim < 0)
    return loi("TAB_FRET_INVALID", "Số phím phải là số nguyên từ 0 trở lên.");
  if (phim > PHIM_TOI_DA_UI)
    return loi(
      "TAB_FRET_OUT_OF_RANGE",
      `Ô nhập chỉ nhận tới phím ${PHIM_TOI_DA_UI}.`
    );
  return { ok: true, string: day, fret: phim, midi: buong + phim };
}

/**
 * Chuyển sang dây khác mà GIỮ NGUYÊN cao độ. Trả lỗi khi dây ấy không với tới
 * được cao độ này (phải bấm phím âm) hoặc bài không ghi dây ấy.
 */
export function doiDayGiuCaoDo(
  lenDay: LenDay | null,
  midi: number,
  dayMoi: number
): KetQuaTab | LoiTab {
  if (!lenDay || !lenDay.size) return viTri(lenDay, dayMoi, 0);
  const buong = lenDay.get(dayMoi);
  if (buong === undefined) return viTri(lenDay, dayMoi, 0);
  const phim = midi - buong;
  if (phim < 0)
    return loi(
      "TAB_FRET_INVALID",
      `Dây ${dayMoi} không chơi được nốt này — nốt thấp hơn dây buông.`
    );
  return viTri(lenDay, dayMoi, phim);
}
