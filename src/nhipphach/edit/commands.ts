/**
 * Lệnh biên tập MusicXML — Giai đoạn Nội dung 3.
 *
 * Mỗi thao tác sửa là MỘT lệnh độc lập, chỉ nói "sửa gì, ở nút nào". Nút được
 * gọi bằng đường dẫn cấu trúc (`SourceNote.path` từ Nội dung 2), KHÔNG BAO GIỜ
 * bằng cao độ cũ hay toạ độ. Lệnh không biết XML là chuỗi; việc vá nằm ở
 * `applyCommand.ts`. Thêm công cụ mới (trường độ, hợp âm, TAB, dấu nối…) là
 * thêm một nhánh vào union này và một handler — không đụng draft/undo/save.
 */
import type { AccidentalChoice } from "./accidentals.ts";
import type { NoteType } from "./durationModel.ts";
import type { HarmonyValue } from "./harmonyModel.ts";
import type { ClipboardItem } from "./clipboard.ts";

export type Step = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export const STEPS: readonly Step[] = ["C", "D", "E", "F", "G", "A", "B"];

export interface Pitch {
  step: Step;
  /** Số nửa cung so với nốt tự nhiên: -2…2. Là cao độ VANG LÊN (`<alter>`),
   *  không phải dấu hoá hiển thị (`<accidental>` — công cụ Dấu hoá lo riêng). */
  alter: number;
  octave: number;
}

export interface ChangePitch {
  type: "ChangePitch";
  /** `/score-partwise/part[i]/measure[j]/*[k]` — đúng như parser đếm. */
  path: string;
  pitch: Pitch;
  /**
   * Dấu hoá HIỂN THỊ đi kèm. Mặc định "auto" = theo luật ký âm (bộ khoá + các
   * dấu đã viết trong ô nhịp). Đổi cao độ mà bỏ mặc `<accidental>` cũ là tạo ra
   * bản nhạc nhìn một đằng vang một nẻo, nên lệnh này luôn quyết cả hai.
   */
  accidental?: AccidentalChoice;
}

/**
 * Đổi CÁCH GHI, giữ nguyên tiếng: G♯4 → A♭4. Không phải dịch giọng, không phải
 * sửa cao độ — cố ý tách thành lệnh riêng để ghi chú phiên bản nói đúng việc.
 */
export interface RespellNote {
  type: "RespellNote";
  path: string;
  pitch: Pitch;
  accidental?: AccidentalChoice;
}

/**
 * Đổi trường độ. Ba trường `<duration>`, `<type>`, `<dot>` luôn được ghi lại
 * cùng nhau theo `divisions` của chính bản nhạc — không sửa mỗi hình nốt rồi để
 * số đo cũ lại.
 */
export interface ChangeDuration {
  type: "ChangeDuration";
  path: string;
  noteType: NoteType;
  dots: number;
}

/**
 * Sửa chữ của MỘT dòng lời. Địa chỉ là (nốt, THỨ TỰ dòng lời trong nốt) chứ
 * không phải thuộc tính `number`: đo được rằng nhiều `<lyric>` trên cùng một nốt
 * có thể cùng thiếu `number`, lúc ấy lấy `number` làm khoá là sửa dòng 2 thành
 * ra đổi dòng 1. Lệnh KHÔNG đụng `<syllabic>` hay `<extend>` — đổi cấu trúc
 * melisma là việc của một lệnh khác.
 */
export interface ChangeLyricText {
  type: "ChangeLyricText";
  path: string;
  /** Thứ tự `<lyric>` trong nốt, 1-based. */
  lyricIndex: number;
  /** Giữ nguyên văn, kể cả Unicode tiếng Việt và khoảng trắng. */
  text: string;
}

/**
 * Sửa một ký hiệu hợp âm. `path` trỏ thẳng `<harmony>` (nó là con của
 * `<measure>` nên đã có sẵn đường dẫn cấu trúc như nốt).
 *
 * Chỉ SỬA, không thêm không bớt: thêm/xoá một `<harmony>` sẽ dời chỉ số con của
 * ô nhịp, tức là dời đường dẫn của mọi nốt sau nó — việc đó cần một lệnh riêng
 * biết cách dời cả bản đồ danh tính.
 */
export interface ChangeHarmony {
  type: "ChangeHarmony";
  path: string;
  value: HarmonyValue;
}

/**
 * Nốt → dấu lặng, GIỮ NGUYÊN chỗ trong dòng thời gian — Giai đoạn 4B.1.
 *
 * Đây không phải "xoá". Xoá thật sẽ bỏ một `<note>` khỏi ô nhịp, làm ô thiếu
 * phách và dời chỉ số con của mọi phần tử đứng sau — tức là dời đường dẫn của
 * cả bản đồ danh tính. Chuyển thành lặng giữ `<duration>`, `<type>`, `<dot>`,
 * `<voice>`, `<staff>` và ĐÚNG vị trí con, nên số con của ô nhịp không đổi một
 * đơn vị nào và nhịp vẫn đủ.
 */
export interface MakeRest {
  type: "MakeRest";
  path: string;
}

/**
 * Dấu lặng → nốt có cao độ, cũng giữ nguyên trường độ và chỗ ngồi — 4B.1.
 *
 * Cặp đối xứng của `MakeRest`. Cùng một luật: không thêm không bớt con của ô
 * nhịp, chỉ đổi ruột của đúng một `<note>`.
 */
export interface ReplaceRestWithNote {
  type: "ReplaceRestWithNote";
  path: string;
  pitch: Pitch;
  /** Như `ChangePitch`: dấu hoá hiển thị do luật ký âm 3B quyết, không tự đoán. */
  accidental?: AccidentalChoice;
}

/**
 * Đổi trường độ VÀ cân lại ô nhịp — Giai đoạn 4B.2.
 *
 * Khác `ChangeDuration` ở chỗ nó là một GIAO DỊCH: đổi hình nốt của nốt đích và
 * đồng thời tạo / ăn / cắt nhỏ dấu lặng để tổng thời gian của ô nhịp không đổi
 * một li. `ChangeDuration` cũ giữ nguyên nghĩa (chỉ đổi đúng nốt ấy, để lại ô
 * thiếu hoặc thừa phách) — panel thủ công vẫn cần nó.
 *
 * Phạm vi an toàn, cố ý hẹp:
 *   · NGẮN LẠI → sinh dấu lặng ngay sau, cùng bè, cùng khuông, cùng ô nhịp.
 *   · DÀI RA   → chỉ ăn vào dấu lặng đứng liền sau; gặp nốt thật thì DỪNG.
 * Không bao giờ đẩy, xoá hay viết đè một nốt có cao độ.
 */
export interface ChangeDurationAndRebalance {
  type: "ChangeDurationAndRebalance";
  path: string;
  noteType: NoteType;
  dots: number;
}

/**
 * Nhập một nốt VÀO CHỖ LẶNG, đúng trường độ đang cầm — Giai đoạn 4B.3.
 *
 * Đây là giao dịch nhập nốt thật sự: dấu lặng đích trở thành nốt có cao độ với
 * trường độ yêu cầu, và phần thời gian dôi ra (hoặc thiếu) được cân lại y hệt
 * `ChangeDurationAndRebalance` — cùng một bộ phân rã dấu lặng, cùng một lưới
 * phách, cùng một luật "chỉ ăn vào dấu lặng, không bao giờ đụng nốt thật".
 *
 * Ba trường hợp, một lệnh:
 *   · bằng đúng   → chỉ đổi ruột dấu lặng thành nốt (không đụng số con ô nhịp)
 *   · ngắn hơn    → nốt + dấu lặng bù phía sau
 *   · dài hơn     → ăn vào chuỗi dấu lặng liền sau; gặp nốt thật thì DỪNG
 *
 * Danh tính nốt sinh một lần khi tạo lệnh, giữ nguyên khi phát lại.
 */
export interface InsertNoteIntoRest {
  type: "InsertNoteIntoRest";
  /** Dấu lặng đích. Như mọi lệnh khác: toạ độ đã giải ra tại lúc ghi lệnh. */
  path: string;
  pitch: Pitch;
  noteType: NoteType;
  dots: number;
  /** Dấu hoá hiển thị do luật ký âm 3B quyết. */
  accidental?: AccidentalChoice;
}

/**
 * Dán một đoạn vào chuỗi dấu lặng — Giai đoạn 4C.
 *
 * MỘT lệnh, nên MỘT ô trong ngăn xếp: thầy bấm Ctrl+Z một lần là cả đoạn vừa
 * dán biến đi, không phải gỡ từng nốt. Bên trong nó chạy lần lượt đúng những
 * lệnh đã có — `InsertNoteIntoRest` (4B.3) cho từng nốt và
 * `ChangeDurationAndRebalance` (4B.2) cho từng dấu lặng — nên không có bộ máy
 * thời gian, bộ phân rã dấu lặng hay lược đồ danh tính nào mới.
 *
 * Hỏng ở bất kỳ bước nào thì KHÔNG một byte nào được ghi: cả chuỗi chạy trên
 * bản nháp tạm, chỉ khi xong hết mới trả về.
 */
export interface PasteSequence {
  type: "PasteSequence";
  /** Dấu lặng đầu tiên của vùng đích. Các sự kiện sau đi tiếp theo thứ tự tài liệu. */
  path: string;
  items: readonly ClipboardItem[];
}

/**
 * Bật / tắt MỘT vòng luyến (slur) từ nốt `path` tới nốt `denPath` — Editor UX.
 *
 * Luyến KHÁC dấu nối (tie): luyến là cách diễn tấu (legato) nối các cao độ khác
 * nhau, dấu nối cộng trường độ của hai nốt cùng cao độ. Hai lệnh riêng, không
 * bao giờ dùng chung.
 *
 * Chưa có vòng luyến nào đúng từ `path` tới `denPath` → thêm `<slur type="start">`
 * vào nốt đầu và `<slur type="stop">` vào nốt cuối (cùng `number`). Đã có đúng
 * vòng đó → bỏ cả hai. Phạm vi an toàn: cùng part, cùng khuông, cùng bè; hai đầu
 * là nốt có cao độ, không phải nốt hợp âm; trong vùng không có vòng luyến nào
 * khác chạm vào (lồng / chéo nhau chưa hỗ trợ).
 */
export interface ToggleSlur {
  type: "ToggleSlur";
  /** Nốt đầu vòng luyến. */
  path: string;
  /** Nốt cuối vòng luyến (đứng SAU `path` theo thứ tự bài). */
  denPath: string;
}

/**
 * Xoá cả một vùng nốt = chuyển từng nốt thành lặng, trong MỘT lệnh — Editor UX.
 * Một lần hoàn tác trả lại cả vùng. Cùng luật với `MakeRest` cho từng nốt; hỏng
 * một nốt là cả lệnh bị từ chối, không có nửa vời.
 */
export interface MakeRestSequence {
  type: "MakeRestSequence";
  /** Nốt đầu vùng (để lệnh có địa chỉ như mọi lệnh khác). */
  path: string;
  /** Mọi sự kiện trong vùng, theo thứ tự bài; dấu lặng sẵn có được bỏ qua. */
  paths: readonly string[];
}

export type MusicXmlEditCommand =
  | ToggleSlur
  | MakeRestSequence
  | ChangePitch
  | RespellNote
  | ChangeDuration
  | ChangeLyricText
  | ChangeHarmony
  | MakeRest
  | ReplaceRestWithNote
  | ChangeDurationAndRebalance
  | InsertNoteIntoRest
  | PasteSequence;

/** Nhóm công cụ (mục 2 của spec) — để panel biết lệnh thuộc nhóm nào. */
export const COMMAND_GROUP: Record<
  MusicXmlEditCommand["type"],
  "note" | "lyric" | "harmony"
> = {
  ChangePitch: "note",
  RespellNote: "note",
  ChangeDuration: "note",
  ChangeLyricText: "lyric",
  ChangeHarmony: "harmony",
  MakeRest: "note",
  ReplaceRestWithNote: "note",
  ChangeDurationAndRebalance: "note",
  InsertNoteIntoRest: "note",
  PasteSequence: "note",
  ToggleSlur: "note",
  MakeRestSequence: "note",
};

export const CHANGE_NOTE_MAX = 300;

/** Ghi chú phiên bản tự sinh: "Sửa cao độ 2 nốt · sửa trường độ 1 nốt". Thầy sửa lại được trước khi lưu. */
const MO_TA: Record<MusicXmlEditCommand["type"], (n: number) => string> = {
  ChangePitch: (n) => `sửa cao độ ${n} nốt`,
  RespellNote: (n) => `đổi cách ghi ${n} nốt`,
  ChangeDuration: (n) => `sửa trường độ ${n} nốt`,
  ChangeLyricText: (n) => `sửa lời ${n} chỗ`,
  ChangeHarmony: (n) => `sửa hợp âm ${n} chỗ`,
  MakeRest: (n) => `chuyển ${n} nốt thành lặng`,
  ReplaceRestWithNote: (n) => `nhập ${n} nốt vào chỗ lặng`,
  ChangeDurationAndRebalance: (n) => `sửa trường độ ${n} nốt (cân lại ô nhịp)`,
  InsertNoteIntoRest: (n) => `nhập ${n} nốt (cân lại chỗ lặng)`,
  PasteSequence: (n) => `dán ${n} đoạn nhạc`,
  ToggleSlur: (n) => `sửa luyến ${n} chỗ`,
  MakeRestSequence: (n) => `xoá ${n} vùng nốt`,
};
const KHOA = (c: MusicXmlEditCommand) =>
  c.type === "ChangeLyricText" ? `${c.path}#${c.lyricIndex}` : c.path;

export function describeCommands(commands: readonly MusicXmlEditCommand[]): string {
  const dem = new Map<MusicXmlEditCommand["type"], Set<string>>();
  for (const c of commands) {
    const s = dem.get(c.type) ?? new Set<string>();
    s.add(KHOA(c));
    dem.set(c.type, s);
  }
  const phan = (Object.keys(MO_TA) as MusicXmlEditCommand["type"][])
    .filter((t) => dem.get(t)?.size)
    .map((t) => MO_TA[t](dem.get(t)!.size));
  if (!phan.length) return "";
  return (phan[0][0].toUpperCase() + phan[0].slice(1) + (phan.length > 1 ? " · " + phan.slice(1).join(" · ") : "")).slice(
    0,
    CHANGE_NOTE_MAX
  );
}

