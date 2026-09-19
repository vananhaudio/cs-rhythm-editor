/**
 * NÂNG PHẦN CHIA (auto-upgrade `<divisions>`) — Editor UX.
 *
 * `<divisions>` áp cho CẢ part (mọi bè, mọi khuông) từ chỗ khai báo tới khai
 * báo kế tiếp. Nâng = nhân mọi số đo trong đúng phạm vi ấy; tiếng nhạc giữ
 * nguyên từng tích tắc; không thêm/bớt phần tử nào.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyCommand, nangPhanChia } from "../../src/nhipphach/edit/applyCommand.ts";
import { applyToDraft, createDraft, undo } from "../../src/nhipphach/edit/draftEngine.ts";
import { readNoteFields } from "../../src/nhipphach/edit/noteFields.ts";
import { tagSourceIds } from "../../src/musicxml-beats/sourceTags.ts";
import { musicXMLToBeatMap } from "../../src/musicxml-beats/beatMap.ts";
import { parseMusicXML } from "../../src/musicxml-beats/parser.ts";
import type { MusicXmlEditCommand } from "../../src/nhipphach/edit/commands.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const P = (c: number, m = 1) => `/score-partwise/part[1]/measure[${m}]/*[${c}]`;
const code = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
  return "OK";
};
const N = (step: string, dur: number, type: string, voice: number, extra = "") =>
  `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>${dur}</duration><voice>${voice}</voice><type>${type}</type>${extra}</note>`;
const R = (dur: number, type: string, voice: number) =>
  `<note><rest/><duration>${dur}</duration><voice>${voice}</voice><type>${type}</type></note>`;
const score = (...measures: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>G</part-name></score-part></part-list>
<part id="P1">${measures.map((m, i) => `<measure number="${i + 1}">${m}</measure>`).join("")}</part></score-partwise>`;
const ATTR = (div: number, beats = 4, type = 4) =>
  `<attributes><divisions>${div}</divisions><time><beats>${beats}</beats><beat-type>${type}</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;
const rebalance = (path: string, noteType: string, dots = 0): MusicXmlEditCommand =>
  ({ type: "ChangeDurationAndRebalance", path, noteType, dots }) as MusicXmlEditCommand;

/** Chữ nhạc sau khi CHE mọi số đo — hai bản giống hệt nhau nghĩa là chỉ số đo đổi. */
const cheSoDo = (x: string) => x.replace(/<(divisions|duration|offset)>[^<]*<\/\1>/g, "<$1>#</$1>");
const soDo = (x: string) => [...x.matchAll(/<(divisions|duration|offset)>([^<]*)<\/\1>/g)].map((m) => `${m[1]}=${m[2]}`);

/** Nhịp điệu THẬT (tính bằng nốt đen) — phải giống hệt trước/sau khi chỉ nâng. */
function nhipDieu(xml: string) {
  const bm = musicXMLToBeatMap(xml).measures.map((m) => ({
    actual: m.actualDuration,
    expected: m.expectedDuration,
    pickup: m.pickup,
    pickupOffset: m.pickupOffset,
    beats: m.beatsMap,
    diag: m.diagnostics.map((d) => d.code),
  }));
  const ev = parseMusicXML(xml).parts.flatMap((p) =>
    p.measures.flatMap((m) => m.events.map((e) => `${e.source.path}@${e.onset}+${(e as { duration?: unknown }).duration ?? ""}`))
  );
  return JSON.stringify({ bm, ev });
}

// ── Fixture bắt buộc: divisions=2, bè 1 móc đơn, backup, bè 2 đen/trắng, forward ──
const HAI_BE = score(
  ATTR(2) +
    N("C", 1, "eighth", 1) + N("D", 1, "eighth", 1) + N("E", 1, "eighth", 1) + N("F", 1, "eighth", 1) +
    N("G", 2, "quarter", 1) + N("A", 2, "quarter", 1) +
    `<backup><duration>8</duration></backup>` +
    N("C", 2, "quarter", 2) + `<forward><duration>2</duration><voice>2</voice></forward>` + N("E", 4, "half", 2),
  N("C", 8, "whole", 1)
);

test("phạm vi: divisions áp cho CẢ part — bè 2, backup, forward đều ×2 dù chỉ sửa bè 1", () => {
  const ra = applyCommand(HAI_BE, rebalance(P(2), "16th"));
  assert.match(ra.xml, /<divisions>4<\/divisions>/, "2 → 4, hệ số nhỏ nhất");
  const f = readNoteFields(ra.xml, P(2))!;
  assert.equal(f.noteType, "16th");
  // Bè 2 và backup/forward: số ×2, hình nốt giữ nguyên.
  assert.match(ra.xml, /<backup><duration>16<\/duration><\/backup>/);
  assert.match(ra.xml, /<forward><duration>4<\/duration><voice>2<\/voice><\/forward>/);
  assert.match(ra.xml, /<duration>4<\/duration><voice>2<\/voice><type>quarter<\/type>/);
  assert.match(ra.xml, /<duration>8<\/duration><voice>2<\/voice><type>half<\/type>/);
  assert.match(ra.xml, /<measure number="2"><note><pitch><step>C<\/step><octave>4<\/octave><\/pitch><duration>16<\/duration>/);
  // Chỉ bước nâng: nhịp điệu thật y hệt.
  assert.equal(nhipDieu(nangPhanChia(HAI_BE, P(2), 2).xml), nhipDieu(HAI_BE));
});

test("phạm vi: chỉ đoạn của khai báo đang hiệu lực — đoạn divisions=6 phía sau không đụng", () => {
  const X = score(
    ATTR(2) + N("C", 2, "quarter", 1) + N("D", 2, "quarter", 1) + N("E", 2, "quarter", 1) + N("F", 2, "quarter", 1),
    N("G", 8, "whole", 1),
    `<attributes><divisions>6</divisions></attributes>` + N("A", 6, "quarter", 1) + R(18, "half", 1).replace("<type>half</type>", "<type>half</type><dot/>"),
    N("B", 24, "whole", 1)
  );
  const nang = nangPhanChia(X, P(2), 2);
  const [truoc, sau] = [X, nang.xml].map((x) => x.slice(x.indexOf('<measure number="3">')));
  assert.equal(sau, truoc, "từ khai báo divisions=6 trở đi giữ nguyên từng byte");
  assert.match(nang.xml, /<divisions>4<\/divisions>/);
  assert.match(nang.xml, /<measure number="2"><note><pitch><step>G<\/step><octave>4<\/octave><\/pitch><duration>16</);
  assert.equal(nhipDieu(nang.xml), nhipDieu(X));
  // Sửa nốt TRONG đoạn divisions=6 thì chỉ đoạn ấy được nâng.
  const n2 = nangPhanChia(X, P(2, 3), 2);
  assert.equal(n2.xml.slice(0, n2.xml.indexOf('<measure number="3">')), X.slice(0, X.indexOf('<measure number="3">')));
  assert.match(n2.xml, /<divisions>12<\/divisions>/);
});

test("phạm vi: khai báo đổi GIỮA ô nhịp (fixture divisions-change) — tách đúng tại khai báo", () => {
  const X = read("../musicxml-beats/fixtures/divisions-change.musicxml");
  // Nốt đầu thuộc đoạn divisions=1; ba nốt sau thuộc đoạn divisions=24.
  const a = nangPhanChia(X, P(2), 2);
  assert.deepEqual(soDo(a.xml).slice(0, 2), ["divisions=2", "duration=2"]);
  assert.deepEqual(soDo(a.xml).slice(2), soDo(X).slice(2));
  const b = nangPhanChia(X, P(4), 2);
  assert.deepEqual(soDo(b.xml).slice(0, 2), soDo(X).slice(0, 2));
  assert.deepEqual(soDo(b.xml).slice(2), soDo(X).slice(2).map((s) => s.replace(/=(\d+)/, (_m, n) => `=${Number(n) * 2}`)));
  for (const r of [a, b]) assert.equal(nhipDieu(r.xml), nhipDieu(X));
});

test("hệ số NHỎ NHẤT, số nguyên chính xác: 1→2→4; 3→6 (không nhảy 12)", () => {
  let d = createDraft(score(ATTR(1) + N("C", 1, "quarter", 1) + R(1, "quarter", 1) + R(1, "quarter", 1) + R(1, "quarter", 1)));
  d = applyToDraft(d, rebalance(P(2), "eighth"));
  assert.match(d.xml, /<divisions>2<\/divisions>/);
  d = applyToDraft(d, rebalance(P(2), "16th"));
  assert.match(d.xml, /<divisions>4<\/divisions>/);
  const BA = score(ATTR(3) + N("C", 3, "quarter", 1) + R(3, "quarter", 1) + R(3, "quarter", 1) + R(3, "quarter", 1));
  assert.match(applyCommand(BA, rebalance(P(2), "eighth")).xml, /<divisions>6<\/divisions>/);
  // <offset> thập phân nhân chính xác, không float.
  const OFF = score(ATTR(2) + `<direction><direction-type><words>x</words></direction-type><offset>0.5</offset></direction>` + N("C", 8, "whole", 1));
  assert.match(nangPhanChia(OFF, P(3), 3).xml, /<offset>1.5<\/offset>/);
  assert.match(nangPhanChia(OFF, P(3), 2).xml, /<offset>1<\/offset>/);
});

test("nguyên khối: nâng + đổi trường độ = MỘT lệnh; hoàn tác một lần về đúng từng byte", () => {
  let d = createDraft(HAI_BE);
  d = applyToDraft(d, rebalance(P(2), "16th"));
  assert.equal(d.cursor, 1);
  assert.equal(d.commands.length, 1);
  d = undo(d);
  assert.equal(d.xml, HAI_BE);
});

test("nguyên khối: bước hai hỏng thì bước nâng cũng không để lại dấu vết", () => {
  // Móc đơn → móc kép chấm để lại khoảng trống 1/32 < móc kép: nâng không gỡ được.
  const d0 = createDraft(HAI_BE);
  assert.equal(code(() => applyToDraft(d0, rebalance(P(2), "16th", 1))), "RHYTHM_REST_GRANULARITY");
  try {
    applyToDraft(d0, rebalance(P(2), "16th", 1));
  } catch (e) {
    assert.equal((e as Error).message, "Khoảng trống còn lại nhỏ hơn trường độ dấu lặng hiện đang hỗ trợ.");
    assert.doesNotMatch((e as Error).message, /chia|divisions/i, "không gọi nó là lỗi phần chia");
  }
  assert.equal(d0.xml, HAI_BE);
  assert.equal(d0.commands.length, 0);
  // Lỗi không phải chuyện phần chia thì KHÔNG thử nâng.
  const TIE = score(ATTR(2) + N("C", 4, "half", 1, "<tie type=\"start\"/>") + N("C", 4, "half", 1, "<tie type=\"stop\"/>"));
  assert.equal(code(() => applyCommand(TIE, rebalance(P(2), "16th"))), "EDIT_REBALANCE_TIED");
});

test("danh tính: chỉ nâng thì đường dẫn, id, cấu trúc giữ nguyên", () => {
  const nang = nangPhanChia(HAI_BE, P(2), 2);
  assert.deepEqual(nang.structural, []);
  const ids = (x: string) => tagSourceIds(x).notes.map((n) => `${n.svgId}|${n.path}|${n.voice}|${n.staff}`);
  assert.deepEqual(ids(nang.xml), ids(HAI_BE));
  // Lệnh ghép: cấu trúc đổi đúng bằng lệnh cân lại khi KHÔNG cần nâng (cùng bài, đã chia đủ).
  const DU = HAI_BE.replace(/<(divisions|duration)>(\d+)</g, (_m, t, n) => `<${t}>${Number(n) * 2}<`);
  const coNang = applyCommand(HAI_BE, rebalance(P(2), "16th"));
  const khongNang = applyCommand(DU, rebalance(P(2), "16th"));
  assert.deepEqual(coNang.structural, khongNang.structural);
  assert.equal(coNang.xml, khongNang.xml, "nâng rồi sửa = sửa trên bản đã chia sẵn");
});

test("tương đương nhịp điệu: 4/4 · 3/4 · 6/8 · 5/8 · 7/8 · lấy đà · nhiều bè · đổi divisions", () => {
  const FX: [string, string][] = [
    ["4/4", "../musicxml-beats/fixtures/simple-4-4.musicxml"],
    ["3/4", "../musicxml-beats/fixtures/simple-3-4.musicxml"],
    ["6/8", "../musicxml-compound/fixtures/simple-6-8.musicxml"],
    ["5/8 · 7/8 · lời · hợp âm", "fixtures/lyric-harmony.musicxml"],
    ["lấy đà", "../musicxml-beats/fixtures/pickup-quarter.musicxml"],
    ["hai bè backup", "../musicxml-beats/fixtures/two-voices-backup.musicxml"],
    ["forward + hoa mỹ", "../musicxml-beats/fixtures/forward-grace.musicxml"],
    ["thiếu phách", "../musicxml-beats/fixtures/underfull.musicxml"],
    ["thừa phách", "../musicxml-beats/fixtures/overfull.musicxml"],
    ["TAB + hai bè", "fixtures/note-editing.musicxml"],
  ];
  for (const [ten, f] of FX) {
    const X = read(f);
    const not = tagSourceIds(X).notes[0];
    for (const k of [2, 3]) {
      const ra = nangPhanChia(X, not.path, k);
      assert.equal(nhipDieu(ra.xml), nhipDieu(X), `${ten} ×${k}`);
      // Phạm vi byte: ngoài số đo, không một ký tự nào đổi (pitch, lời, hợp âm, TAB, dấu hoá, định dạng).
      assert.equal(cheSoDo(ra.xml), cheSoDo(X), `${ten} ×${k}: chỉ số đo được đổi`);
      assert.ok(ra.changed);
    }
  }
});

test("không nhân nhầm: fret, string, octave, voice, staff, MIDI, số ô nhịp giữ nguyên", () => {
  const X = read("fixtures/note-editing.musicxml");
  const ra = nangPhanChia(X, tagSourceIds(X).notes[0].path, 4);
  for (const ten of ["fret", "string", "octave", "voice", "staff", "midi-program", "midi-channel"]) {
    const lay = (x: string) => [...x.matchAll(new RegExp(`<${ten}>([^<]*)</${ten}>`, "g"))].map((m) => m[1]);
    assert.deepEqual(lay(ra.xml), lay(X), ten);
  }
  const so = (x: string) => [...x.matchAll(/<measure number="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(so(ra.xml), so(X));
});

test("cùng một đường: phím -/=, nút hình nốt (SET_DURATION) và Inspector (ChangeDuration) đều tự nâng", () => {
  const THO = score(ATTR(1) + N("C", 1, "quarter", 1) + R(1, "quarter", 1) + R(1, "quarter", 1) + R(1, "quarter", 1));
  // Phím `=` và nút móc đơn đều ra ChangeDurationAndRebalance → cùng applyCommand.
  const phim = applyCommand(THO, rebalance(P(2), "eighth"));
  const inspector = applyCommand(THO, { type: "ChangeDuration", path: P(2), noteType: "eighth", dots: 0 } as MusicXmlEditCommand);
  for (const r of [phim, inspector]) {
    assert.match(r.xml, /<divisions>2<\/divisions>/);
    assert.equal(readNoteFields(r.xml, P(2))!.noteType, "eighth");
  }
  // Lên lại: móc kép → móc đơn → đen (không cần nâng thêm).
  let d = createDraft(THO);
  for (const t of ["eighth", "16th", "eighth", "quarter"]) d = applyToDraft(d, rebalance(P(2), t));
  assert.equal(readNoteFields(d.xml, P(2))!.noteType, "quarter");
  assert.match(d.xml, /<divisions>4<\/divisions>/);
  for (let i = 0; i < 4; i++) d = undo(d);
  assert.equal(d.xml, THO);
});
