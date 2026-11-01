/**
 * Bài trả 1.1 (SOLO01, Buổi 1): ví dụ trong đề phải là HAI nốt ĐỒNG ÂM (cùng tên, cùng cao độ), và nằm trên bản đồ C–Am của chính buổi.
 * Đề cũ dùng dây 5 ngăn 3 (C3) với dây 2 ngăn 1 (C4) — khác quãng tám — nên bị sửa (Owner 01/11/2026).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { SOLO01_BUOI01 } from "../../src/data/solo01/buoi01";

const OPEN = [0, 64, 59, 55, 50, 45, 40]; // chỉ số = số dây (1..6): E4 B3 G3 D3 A2 E2 (MIDI)
const blocks = SOLO01_BUOI01.sections as unknown as Array<Record<string, unknown>>;
const cp = blocks.find((b) => b.kind === "checkpoint" && b.id === "1.1") as { prompt: string; title: string; accepts: string[]; required: boolean };
const dots = (blocks.find((b) => b.kind === "fretboard") as { dots: Array<{ name: string; string: number; fret: number }> }).dots;
const midi = (s: number, f: number) => OPEN[s] + f;

test("1.1: đề nói rõ đồng âm và quãng tám", () => {
  assert.match(cp.prompt, /đồng âm/);
  assert.match(cp.prompt, /cùng cao độ/);
  assert.match(cp.prompt, /quãng tám/);
  assert.equal(cp.title, "Bài trả 1.1 — Tìm nốt trên cần đàn");
  assert.deepEqual(cp.accepts, ["text"]);
  assert.equal(cp.required, true);
});

test("1.1: ví dụ trong đề là hai vị trí khác nhau, cùng cao độ, và có trên bản đồ", () => {
  const ex = cp.prompt.split("\n").find((l) => l.startsWith("Ví dụ"))!;
  const pos = [...ex.matchAll(/dây (\d) ngăn (\d+)/g)].map((m) => ({ s: Number(m[1]), f: Number(m[2]) }));
  assert.equal(pos.length, 2);
  assert.notDeepEqual(pos[0], pos[1]);
  assert.equal(midi(pos[0].s, pos[0].f), midi(pos[1].s, pos[1].f), "hai vị trí phải cùng cao độ");
  assert.match(ex, /C4/);
  assert.equal(midi(pos[0].s, pos[0].f), 60); // C4
  for (const p of pos) assert.ok(dots.some((d) => d.name === "C" && d.string === p.s && d.fret === p.f), `dây ${p.s} ngăn ${p.f} phải có trên bản đồ`);
});
