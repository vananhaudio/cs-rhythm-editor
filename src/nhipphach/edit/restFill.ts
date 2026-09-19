import type { Rational } from "../../musicxml-beats/rational.ts";
import { ZERO, add, compare, rational, sub } from "../../musicxml-beats/rational.ts";
import { NOTE_TYPES, QUARTERS } from "./durationModel.ts";
import type { NoteType } from "./durationModel.ts";

/**
 * Lấp một KHOẢNG TRỐNG bằng dấu lặng — Giai đoạn 4B.2.
 *
 * Đây là nơi duy nhất quyết định "chỗ trống này viết thành mấy dấu lặng, hình
 * gì". Thuần, không DOM, không XML, không số thực — mọi phép tính đi bằng
 * `Rational` (BigInt) của chính engine đếm phách. Không có engine thời gian thứ
 * hai trong dự án này.
 *
 * ═══ QUY ƯỚC PHÂN RÃ (khảo sát trước, không tự nghĩ) ═══
 * Ký âm chuẩn — và MuseScore 4 làm đúng vậy — KHÔNG cho dấu lặng che mất phách:
 * một dấu lặng không được bắc qua ranh giới phách, trừ những trường hợp quy ước
 * riêng (lặng cả ô). Smoosic cũng cắt theo phách trước khi chọn hình nốt.
 *
 * Nên thuật toán có đúng hai bước, và cả hai đều tất định:
 *
 *   1. CẮT theo mốc phách thật của ô nhịp (lấy từ `groupStarts` của engine đếm
 *      phách — cùng cái lưới mà số phách đang vẽ ra, nên 6/8 ra 2 nhóm, 5/8 ra
 *      2+3 hay 3+2 đúng như nguồn khai báo).
 *   2. Trong mỗi đoạn: nếu đoạn dài ĐÚNG BẰNG một hình nốt (kể cả chấm dôi) thì
 *      một dấu lặng; nếu không thì tham lam lấy hình lớn nhất còn vừa, KHÔNG
 *      chấm dôi. Chấm dôi chỉ dùng khi nó khớp trọn đoạn — đó là ranh giới giữa
 *      "đọc được" và "tự bịa ra cách ghi".
 *
 * Không sinh chùm nghịch phách (tuplet) ở 4B.2. Khoảng nào không ghi được bằng
 * tập hình nốt đang hỗ trợ thì lệnh KHÔNG chạy — nói thẳng, không làm tròn.
 */
export interface RestPiece {
  noteType: NoteType;
  dots: number;
  /** Độ dài tính bằng nốt đen, để nơi gọi đổi ra `<duration>`. */
  quarters: Rational;
}

export class RestFillError extends Error {
  readonly code: string;
  constructor(message: string, code = "RHYTHM_REBALANCE_NOT_REPRESENTABLE") {
    super(message);
    this.code = code;
  }
}

const q = (n: number, d: number): Rational => rational(n, d);

/** Hình nốt + chấm dôi, xếp từ DÀI tới NGẮN. Thứ tự này là một phần của quy ước. */
const HINH: { noteType: NoteType; dots: number; quarters: Rational }[] = (() => {
  const ra: { noteType: NoteType; dots: number; quarters: Rational }[] = [];
  for (const t of NOTE_TYPES)
    for (const dots of [0, 1, 2]) {
      // QUARTERS là số thập phân nhị phân chính xác (4, 2, 1, 0.5, 0.25) nên đổi
      // sang phân số đúng tuyệt đối: nhân 4 rồi chia 4, không mất chữ số nào.
      const base = q(QUARTERS[t] * 4, 4);
      const nhan = dots === 0 ? q(1, 1) : dots === 1 ? q(3, 2) : q(7, 4);
      const [bn, bd] = base.split("/").map(BigInt);
      const [nn, nd] = nhan.split("/").map(BigInt);
      ra.push({ noteType: t, dots, quarters: rational(bn * nn, bd * nd) });
    }
  return ra.sort((a, b) => compare(b.quarters, a.quarters));
})();

const DUNG_BANG = (x: Rational) => HINH.find((h) => compare(h.quarters, x) === 0);
const KHONG_CHAM = HINH.filter((h) => h.dots === 0);

/**
 * Cắt khoảng `[batDau, ketThuc)` tại mọi mốc phách nằm HẲN bên trong nó.
 * Mốc tính từ đầu ô nhịp; khoảng cũng vậy.
 */
export function catTheoPhach(
  batDau: Rational,
  ketThuc: Rational,
  mocPhach: readonly Rational[]
): [Rational, Rational][] {
  const moc = mocPhach
    .filter((m) => compare(m, batDau) > 0 && compare(m, ketThuc) < 0)
    .sort(compare);
  const doan: [Rational, Rational][] = [];
  let t = batDau;
  for (const m of moc) {
    doan.push([t, m]);
    t = m;
  }
  doan.push([t, ketThuc]);
  return doan;
}

/** Một đoạn KHÔNG bắc qua phách → dãy dấu lặng, dài trước ngắn sau. */
function lapMotDoan(dai: Rational): RestPiece[] {
  if (compare(dai, ZERO) <= 0) return [];
  const tron = DUNG_BANG(dai);
  if (tron) return [{ ...tron }];
  const ra: RestPiece[] = [];
  let con = dai;
  while (compare(con, ZERO) > 0) {
    const h = KHONG_CHAM.find((x) => compare(x.quarters, con) <= 0);
    if (!h)
      // Nợ RHYTHM-REST-GRANULARITY: dấu lặng nhỏ nhất đang hỗ trợ là móc kép.
      // KHÔNG phải chuyện phần chia — nâng `<divisions>` không gỡ được.
      throw new RestFillError(
        "Khoảng trống còn lại nhỏ hơn trường độ dấu lặng hiện đang hỗ trợ.",
        "RHYTHM_REST_GRANULARITY"
      );
    ra.push({ ...h });
    con = sub(con, h.quarters);
  }
  return ra;
}

/**
 * Khoảng trống `[batDau, ketThuc)` trong một ô nhịp → dãy dấu lặng đọc được.
 * `mocPhach` là mốc đầu mỗi nhóm phách của CHÍNH ô ấy, tính từ đầu ô.
 */
export function lapKhoangTrong(
  batDau: Rational,
  ketThuc: Rational,
  mocPhach: readonly Rational[]
): RestPiece[] {
  if (compare(ketThuc, batDau) <= 0) return [];
  const ra: RestPiece[] = [];
  for (const [a, b] of catTheoPhach(batDau, ketThuc, mocPhach))
    ra.push(...lapMotDoan(sub(b, a)));
  // Sổ kép của chính module này: tổng phải bằng đúng khoảng đã yêu cầu.
  const tong = ra.reduce<Rational>((s, p) => add(s, p.quarters), ZERO);
  if (compare(tong, sub(ketThuc, batDau)) !== 0)
    throw new RestFillError("Phân rã dấu lặng không khớp khoảng trống.");
  return ra;
}

/** Độ dài một hình nốt tính bằng nốt đen, dạng phân số đúng tuyệt đối. */
export function quartersOf(noteType: NoteType, dots: number): Rational {
  const h = HINH.find((x) => x.noteType === noteType && x.dots === dots);
  if (!h) throw new RestFillError(`Không có hình nốt ${noteType} với ${dots} chấm.`);
  return h.quarters;
}
