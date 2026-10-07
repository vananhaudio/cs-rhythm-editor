// Nhịp & Phách → Tool Share: thẻ Feed, payload/chuẩn hoá, trang chỉ-xem, không chạm kho master.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describeToolShare } from "../../src/class-social/toolshare/registry";
import { ToolShareBodyView } from "../../src/class-social/toolshare/ToolShareCard";
import { scoreShareBlocker, settingsPayload, sharedScoreFromArtifact, isArtifactId } from "../../src/class-social/toolshare/nhipphachShare";
import { ShareScoreBlock } from "../../src/nhipphach/ShareScoreBlock";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types";

void React;
const ART = "7a1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f";
const share = { v: 1, tool: "nhipphach", kind: "score", artifact_id: ART, title: "Đàn Gà Con", meter: "3/4", counting_level: "eighths", client_key: "k" };
const XML = '<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>Đàn Gà Con</work-title></work><part-list/></score-partwise>';
const ST = { ...DEFAULT_SCORE_SETTINGS, countingLevel: "eighths" as const, grouping: { byMeter: { "7/8": [2, 2, 3] } } };

test("thẻ Feed: Nhịp & Phách · Bản nhạc → tên bài → Nhịp · mức đếm → Xem bản nhạc (không MusicXML)", () => {
  const v = describeToolShare(share)!;
  assert.equal(v.toolLabel, "Nhịp & Phách"); assert.equal(v.kindLabel, "Bản nhạc");
  assert.equal(v.headline, "Đàn Gà Con"); assert.equal(v.detail, "Nhịp 3/4 · Chia đôi"); assert.equal(v.thumbnail, null);
  assert.deepEqual(v.action, { label: "Xem bản nhạc", href: `/nhipphach?artifact=${ART}` });
  assert.equal(describeToolShare({ ...share, meter: null })!.detail, "Chia đôi", "không có nhịp → không bịa");
  assert.equal(describeToolShare({ ...share, meter: "2+3/8" })!.detail, "Nhịp 2+3/8 · Chia đôi");
  const h = renderToStaticMarkup(<ToolShareBodyView view={v} />);
  assert.match(h, /Nhịp &amp; Phách · Bản nhạc[\s\S]*Đàn Gà Con[\s\S]*Nhịp 3\/4 · Chia đôi[\s\S]*>Xem bản nhạc<\/a>/);
  assert.ok(!/score-partwise|client_key|<img/.test(h));
  for (const bad of [{ ...share, artifact_id: "x" }, { ...share, title: "" }, { ...share, meter: "<b>" }, { ...share, counting_level: "toString" }, { ...share, kind: "draft" }]) {
    assert.equal(describeToolShare(bad), null, JSON.stringify(bad));
  }
});

test("chỉ chia sẻ bản đã hiển thị + đang hiện số phách; lý do rõ ràng", () => {
  const s = { title: "Đàn Gà Con", composer: null, xml: XML, settings: ST };
  assert.equal(scoreShareBlocker(s, true), null);
  assert.match(scoreShareBlocker(s, false)!, /hiển thị xong/);
  assert.match(scoreShareBlocker(null, true)!, /hiển thị xong/);
  assert.match(scoreShareBlocker({ ...s, settings: { ...ST, showBeats: false } }, true)!, /số phách/);
  assert.match(scoreShareBlocker({ ...s, xml: "x".repeat(1_048_577) }, true)!, /quá lớn/);
});

test("payload thiết lập: đúng các trường dựng lại bản khắc", () => {
  assert.deepEqual(settingsPayload(ST), { showBeats: true, countingLevel: "eighths", compoundCountingMode: "pulses", orientation: "portrait",
    color: "#dc2626", sizePt: 7, distance: 2, grouping: { byMeter: { "7/8": [2, 2, 3] }, byMeasure: {} } });
});

test("artifact → bản chỉ-xem: đúng MusicXML + thiết lập; sai schema → null", () => {
  const data = { schema: "nhipphach.score", v: 1, title: "Đàn Gà Con", composer: null, meter: "3/4", settings: settingsPayload(ST) };
  const s = sharedScoreFromArtifact(data, XML)!;
  assert.equal(s.xml, XML); assert.equal(s.meter, "3/4"); assert.equal(s.settings.countingLevel, "eighths");
  assert.deepEqual(s.settings.grouping, { byMeter: { "7/8": [2, 2, 3] }, byMeasure: {} });
  for (const [d, c] of [[data, null], [data, ""], [{ ...data, schema: "x" }, XML], [{ ...data, v: 2 }, XML], [{ ...data, settings: { ...data.settings, countingLevel: "x" } }, XML],
    [{ ...data, settings: { ...data.settings, color: "red" } }, XML], [null, XML], [[], XML]] as const) {
    assert.equal(sharedScoreFromArtifact(d, c), null);
  }
  assert.equal(isArtifactId(ART), true); assert.equal(isArtifactId("<x>"), false);
});

test("khối chia sẻ: chưa có bản nhạc → nút tắt + lý do; đã sẵn sàng → mời chia sẻ, nói rõ bản gốc không đổi", () => {
  const none = renderToStaticMarkup(<ShareScoreBlock xml={null} name="" settings={ST} rendered={false} />);
  assert.match(none, /<button[^>]*disabled=""[^>]*>Chia sẻ<\/button>/); assert.match(none, /hiển thị xong/);
  const ready = renderToStaticMarkup(<ShareScoreBlock xml={XML} name="dan-ga-con.musicxml" settings={ST} rendered />);
  assert.ok(!/disabled/.test(ready)); assert.match(ready, /Bản gốc của bạn không đổi/); assert.match(ready, />Chia sẻ<\/button>/); assert.ok(!/Chia sẻ lên cộng đồng/.test(ready), "chỉ MỘT nút Chia sẻ");
});

test("không đường Tool Share nào chạm kho master / kho Nhịp Phách; trang chỉ-xem không lưu/xuất/sửa", () => {
  for (const f of ["src/class-social/toolshare/nhipphachShare.ts", "src/nhipphach/ShareScoreBlock.tsx", "src/nhipphach/SharedScoreView.tsx"]) {
    const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");   // bỏ chú thích
    assert.ok(!/musicxml_library|nhipphach_score|masterCopy|libraryRepository|libraryGateway|ScoreLibrary|\.save\(|exportScore|jsPDF/.test(src), `${f} không chạm kho/xuất file`);
  }
  const view = readFileSync("src/nhipphach/SharedScoreView.tsx", "utf8");
  assert.match(view, /chỉ xem, không sửa bản gốc/); assert.match(view, /<img src=\{u\}/); assert.ok(!/dangerouslySetInnerHTML/.test(view), "SVG hiển thị bằng <img>, không chèn DOM");
  const gate = readFileSync("src/nhipphach/NhipPhachGate.tsx", "utf8");
  assert.ok(gate.indexOf('get("artifact")') < gate.indexOf('can(state, "access")'), "bản chia sẻ mở trước cổng quyền công cụ (không cấp thêm quyền công cụ)");
  const page = readFileSync("src/pages/MusicXmlBeatsPage.tsx", "utf8");
  assert.match(page, /caps\.role !== "guest" && \(\s*<ShareScoreBlock/);
});
