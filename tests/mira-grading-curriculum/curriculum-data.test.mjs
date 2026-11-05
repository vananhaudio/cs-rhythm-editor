// Hàm thuần SQL mira_grading_curriculum_data: rút đúng phần giáo trình Mira cần, không rò quiz/ký hiệu nhạc, có `present` để báo thiếu trung thực.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const PSQL = process.env.PSQL, TMP = process.env.TMP_DIR;
const template = JSON.parse(readFileSync(process.env.TEMPLATE_BLOCKS, "utf8"));
const EXPORT_DIR = process.env.MIRA_CURRICULUM_EXPORT_DIR;

function rpc(blocks, cp, title = "Buổi thử") {
  const f = `${TMP}/q-${Math.random().toString(36).slice(2)}.sql`;
  writeFileSync(f, `select public.mira_grading_curriculum_data($j$${JSON.stringify(blocks)}$j$::jsonb, ${cp === null ? "null" : `'${cp}'`}, '${title}', '2026-11-01T00:00:00Z');`);
  const r = spawnSync(PSQL, ["-At", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8", maxBuffer: 1 << 26 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim());
}
const dots = (d, name) => d.fretboard.flatMap((f) => f.dots).filter((x) => x.name === name).map((x) => [x.string, x.fret]);
const leaked = (d) => JSON.stringify(d);

for (const [label, src] of [["mẫu trong repo", (n) => template[n].blocks], ["hàng published TH01 (export)", (n) => JSON.parse(readFileSync(`${EXPORT_DIR}/th01-s${n}.json`, "utf8")).blocks]]) {
  const skip = label.startsWith("hàng") && !(EXPORT_DIR && existsSync(`${EXPORT_DIR}/th01-s1.json`));

  test(`Buổi 1 · bài 1.1 — đề + bản đồ + hướng dẫn (${label})`, { skip }, () => {
    const d = rpc(src(1), "1.1");
    assert.equal(d.v, 2);
    assert.equal(d.checkpoint.id, "1.1");
    assert.match(d.checkpoint.prompt, /cùng cao độ/);        // đề đã sửa 01/11/2026
    assert.deepEqual(d.checkpoint.accepts, ["text"]);
    assert.equal(d.checkpoint.required, true);
    assert.ok(d.objectives.length >= 4 && d.notes.length >= 4);
    // bản đồ: có đủ dữ liệu để đối chiếu "đồng âm" (C ở dây 3 ngăn 5 và dây 2 ngăn 1)
    const c = dots(d, "C");
    assert.ok(c.some(([s, f]) => s === 3 && f === 5) && c.some(([s, f]) => s === 2 && f === 1), JSON.stringify(c));
    assert.ok(d.fretboard[0].dots.every((x) => typeof x.string === "number" && typeof x.fret === "number"));
    // lời dặn của buổi
    const asg = d.guide.find((g) => g.kind === "assignment");
    assert.match(asg.message, /không phải 5 bài phải nộp/);
    assert.ok(asg.items.length >= 4);
    assert.ok(d.guide.some((g) => g.kind === "checklist" && g.items.length >= 5));
    // không rò ký hiệu nhạc / quiz
    assert.doesNotMatch(leaked(d), /\\ts |"tex"|"quiz"/);
    assert.ok(d.present.score >= 1 && d.present.checkpoint === 3);
    assert.ok(leaked(d).length < 25000, `payload ${leaked(d).length}`);
  });

  test(`Buổi 4 · bài 4.3 — cách chấm, 4 câu hỏi, hai cách chọn (${label})`, { skip }, () => {
    const d = rpc(src(4), "4.3");
    assert.equal(d.checkpoint.id, "4.3");
    assert.deepEqual(d.checkpoint.accepts, ["video_link", "text"]);
    const asg = d.guide.find((g) => g.kind === "assignment");
    assert.match(asg.message, /Thầy không chấm bạn có xếp giống Thầy hay không/);
    const recaps = d.guide.filter((g) => g.kind === "recap");
    assert.ok(recaps.some((r) => r.steps.length === 4 && /4 câu hỏi/.test(r.title)));
    assert.ok(d.guide.some((g) => g.kind === "layers" && g.layers.length === 2));
    const rep = d.guide.find((g) => g.kind === "repertoire");
    assert.ok(rep.pieces[0].guidance.length >= 8 && rep.pieces[0].marks.length >= 1);
    assert.doesNotMatch(leaked(d), /\\ts |\\lyrics|"tex"|"quiz"/);
    assert.ok(leaked(d).length < 25000, `payload ${leaked(d).length}`);
  });
}

test("bài trắc nghiệm (4.1): không trả quiz/đáp án, chỉ nói loại bài", () => {
  const d = rpc(template[4].blocks, "4.1");
  assert.equal(d.checkpoint.id, "4.1");
  assert.deepEqual(d.checkpoint.accepts, ["quiz"]);
  assert.equal(d.checkpoint.prompt, undefined);
  assert.equal(d.checkpoint.quiz, undefined);
  assert.doesNotMatch(leaked(d), /options|Tìm cách giống ngón Thầy nhất|"mode":"single"/);
});

test("biên: mã bài trả không có / khối rỗng / không phải mảng / khối lạ", () => {
  const none = rpc(template[1].blocks, "9.9");
  assert.equal(none.checkpoint, undefined);
  assert.ok(none.notes.length > 0);                       // vẫn có phần còn lại, nhưng Mira biết KHÔNG có đề
  const empty = rpc([], "1.1");
  assert.deepEqual([empty.objectives, empty.notes, empty.guide, empty.fretboard], [[], [], [], []]);
  const odd = rpc({ not: "array" }, "1.1"); assert.deepEqual(odd.guide, []);
  const weird = rpc([{ kind: "assignment", items: "x", message: 5 }, { kind: "fretboard", dots: [1, { name: "" }] }, "str", null, { kind: "recap", steps: [{ items: { a: 1 } }] }, { kind: "tuyetMat", n: 1 }], "1.1");
  assert.equal(weird.guide.length, 2);                    // assignment + recap, không nổ
  assert.deepEqual(weird.fretboard[0].dots, []);
  assert.equal(weird.present.tuyetMat, 1);                // khối lạ chỉ hiện ở `present` (để báo thiếu), không lọt nội dung
});

test("giới hạn kích thước: nhiều khối vẫn bị chặn", () => {
  const big = Array.from({ length: 80 }, (_, i) => ({ kind: "note", title: "T".repeat(500), text: "x".repeat(5000) + i }))
    .concat(Array.from({ length: 50 }, () => ({ kind: "assignment", message: "m".repeat(5000), items: Array.from({ length: 40 }, () => ({ label: "L", text: "t".repeat(2000) })) })));
  const d = rpc(big, "1.1");
  assert.equal(d.notes.length, 8);
  assert.ok(d.notes.every((n) => n.text.length <= 800 && n.title.length <= 200));
  assert.ok(d.guide.length <= 12 && d.guide.every((g) => g.items.length <= 10 && g.message.length <= 800));
  // trần lý thuyết của SQL (12 khối × ~5KB); Mira còn tự khống chế ngân sách ký tự khi định dạng (xem tests/grading-curriculum.test.mjs)
  assert.ok(leaked(d).length < 90000, `payload ${leaked(d).length}`);
});

test("hàm phụ không mở cho anon/authenticated", () => {
  const f = `${TMP}/acl.sql`;
  writeFileSync(f, `select count(*) from pg_proc p, (values ('public'),('anon'),('authenticated')) v(r) where p.proname in ('mira_gc_s','mira_gc_strs','mira_grading_curriculum_data') and has_function_privilege(v.r, p.oid, 'execute');`);
  const r = spawnSync(PSQL, ["-At", "-f", f], { encoding: "utf8" });
  assert.equal(r.stdout.trim(), "0", r.stderr);
});
