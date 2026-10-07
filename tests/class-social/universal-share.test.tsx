/**
 * Class Universal Share V1: tham chiếu theo loại, resolver card theo loại (artifact BMS/Nhịp & Phách · lớp · buổi học), vòng đời artifact dùng chung,
 * Nhịp & Phách dùng lại UX "Chia sẻ", lớp/buổi học chỉ-DM, và rào chắn phạm vi. DB: scripts/test-universal-share-db.sh · UI thật: scripts/e2e-universal-share.sh.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SHARE_REF_TYPES, artifactRef, refId, toShareRef } from "../../src/share/shareRef";
import { REF_RESOLVERS, UNAVAILABLE_TEXT, artifactCardView, classCardView, sessionCardView } from "../../src/share/refCards";
import { ShareCardView } from "../../src/class-social/chat/ShareMessageCard";
import ShareSheet from "../../src/share/ShareSheet";
import { toMessages } from "../../src/class-social/chat/chatModel";
import { describeToolShare } from "../../src/class-social/toolshare/registry";
void React;

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const code = (f: string) => read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const ID = "a1111111-0000-4000-8000-000000000001", CLASS = "b0000000-0000-4000-8000-0000000000c1", SES = "51000000-0000-4000-8000-000000000001";

test("toShareRef: ba loại hợp lệ (tool_artifact | class | class_session); loại lạ/khoá hỏng → null; chữ thường hoá", () => {
  assert.deepEqual([...SHARE_REF_TYPES], ["tool_artifact", "class", "class_session"]);
  for (const t of SHARE_REF_TYPES) assert.deepEqual(toShareRef(t, CLASS.toUpperCase()), { type: t, key: CLASS });
  for (const [t, k] of [["profile", CLASS], ["class", "x"], ["class_session", null], [null, CLASS], ["", ""], ["__proto__", CLASS]] as const) assert.equal(toShareRef(t, k), null, `${t}/${k}`);
  assert.equal(refId(artifactRef(ID.toUpperCase())), `tool_artifact:${ID}`);
});

test("toMessages: tin lớp / buổi học mang ref; loại lạ → text fallback (không lỗi)", () => {
  const ms = toMessages([
    { seq: 1, mine: true, body: "Đã chia sẻ một nội dung", created_at: "2026-10-08T01:00:00Z", ref_type: "class", ref_key: CLASS },
    { seq: 2, mine: true, body: "Đã chia sẻ một nội dung", created_at: "2026-10-08T01:01:00Z", ref_type: "class_session", ref_key: SES },
    { seq: 3, mine: true, body: "Đã chia sẻ một nội dung", created_at: "2026-10-08T01:02:00Z", ref_type: "tuong_lai", ref_key: SES },
  ]);
  assert.deepEqual(ms.map(m => m.ref?.type ?? null), ["class", "class_session", null]);
});

test("artifactCardView: Nhịp & Phách → card (tên · nhịp · mức đếm · link xem · shareRef); BMS giữ nguyên; tool/kind lạ → null", () => {
  const np = artifactCardView({ id: ID, tool: "nhipphach", kind: "score", title: "Đàn Gà Con", meter: "3/4", level: "eighths" })!;
  assert.equal(np.headline, "Đàn Gà Con"); assert.equal(np.detail, "Nhịp 3/4 · Chia đôi");
  assert.equal(np.action?.href, `/nhipphach?artifact=${ID}`); assert.deepEqual(np.shareRef, artifactRef(ID));
  assert.equal(artifactCardView({ id: ID, tool: "bms", kind: "song", title: "x", video_id: "dQw4w9WgXcQ", bpm: "76.4", ts: "4", chords: [] })?.action?.href, `/song-builder?artifact=${ID}`);
  for (const r of [null, { id: ID, tool: "x", kind: "y", title: "z" }, { id: ID, tool: "nhipphach", kind: "score", title: "", meter: "3/4", level: "eighths" },
    { id: ID, tool: "nhipphach", kind: "score", title: "t", meter: "<x>", level: "eighths" }, { id: ID, tool: "nhipphach", kind: "score", title: "t", meter: null, level: "lạ" }]) {
    assert.equal(artifactCardView(r as never), null);
  }
});

test("classCardView / sessionCardView: tên lớp + số buổi + link canonical; không phải lesson / hỏng → null", () => {
  const c = classCardView({ id: CLASS, name: "Đệm hát căn bản — KD18", code: "DH2.KD18" })!;
  assert.equal(c.headline, "Đệm hát căn bản — KD18"); assert.equal(c.detail, "DH2.KD18"); assert.equal(c.action?.href, `/me/classes/${CLASS}`); assert.equal(c.toolLabel, "Lớp học");
  const s = sessionCardView({ id: SES, class_id: CLASS, session_number: 3, title: "Nhịp valse", event_type: "lesson" }, "Đệm hát căn bản — KD18")!;
  assert.equal(s.headline, "Nhịp valse"); assert.equal(s.detail, "Buổi 3"); assert.equal(s.kindLabel, "Đệm hát căn bản — KD18"); assert.equal(s.action?.href, `/me/classes/${CLASS}/sessions/3`);
  assert.equal(sessionCardView({ id: SES, class_id: CLASS, session_number: 2, title: "", event_type: "lesson" }, null)?.headline, "Buổi 2");
  assert.equal(sessionCardView({ id: SES, class_id: CLASS, session_number: 2, title: "Nghỉ lễ", event_type: "break" }, "x"), null, "buổi nghỉ không chia sẻ được");
  assert.equal(sessionCardView({ id: SES, class_id: CLASS, session_number: "abc", title: "t", event_type: "lesson" }, "x"), null);
  assert.equal(classCardView({ id: CLASS, name: "  " }), null); assert.equal(classCardView(null), null);
});

test("ShareCardView: card lớp/buổi là MỘT liên kết; không lộ id/JSON; không khả dụng → không link", () => {
  const html = renderToStaticMarkup(<ShareCardView view={classCardView({ id: CLASS, name: "KD18" })} />);
  assert.match(html, /<a [^>]*href="\/me\/classes\/b0000000/); assert.match(html, /Lớp học · Lớp/); assert.match(html, /Mở lớp/);
  assert.equal(/b0000000|\{|tool_artifact/.test(html.replace(/<[^>]+>/g, " ")), false);
  const gone = renderToStaticMarkup(<ShareCardView view={null} />);
  assert.match(gone, new RegExp(UNAVAILABLE_TEXT)); assert.equal(/href=/.test(gone), false);
});

test("resolver theo loại: đủ ba loại; chỉ SELECT qua RLS của object; không kéo nội dung nặng", () => {
  assert.deepEqual(Object.keys(REF_RESOLVERS).sort(), [...SHARE_REF_TYPES].sort());
  const rc = code("src/share/refCards.ts");
  assert.equal(/\.rpc\(|\.insert\(|\.update\(|\.upsert\(/.test(rc), false, "resolver chỉ đọc");
  assert.match(rc, /fetchRows<ArtifactCardRow>\('tool_artifacts'/); assert.match(rc, /fetchRows<ClassCardRow>\('class_schedule'/); assert.match(rc, /fetchRows<SessionCardRow>\('class_sessions'/);
  assert.equal(/ARTIFACT_CARD_SELECT = '[^']*(lyrics|content)/.test(rc), false);
  assert.match(rc, /for \(let i = 0; i < ids\.length; i \+= 50\)/, "gom lô, không truy vấn từng tin");
  assert.match(rc, /byType\.set\(r\.type/, "nhóm theo loại: MỘT truy vấn mỗi loại mỗi nhịp");
  assert.match(rc, /throw new Error/, "lỗi mạng ném ra → KHÔNG coi là 'đã xoá'");
});

test("ShareSheet theo khả năng: chỉ DM (lớp/buổi học) → vào thẳng chọn bạn; có đăng cộng đồng → menu hai lựa chọn", () => {
  const base = { title: "KD18", ensureTarget: async () => ({ ok: true as const, target: { type: "class" as const, key: CLASS } }), onClose: () => {} };
  const dmOnly = renderToStaticMarkup(<ShareSheet {...base} target={{ type: "class", key: CLASS }} canPublish={false} />);
  assert.equal(/aria-label="Chia sẻ"/.test(dmOnly) || /Đăng lên cộng đồng/.test(dmOnly), false, "không menu, không đăng cộng đồng");
  const noPublishFn = renderToStaticMarkup(<ShareSheet {...base} target={null} canPublish={true} />);
  assert.equal(/Đăng lên cộng đồng/.test(noPublishFn), false, "canPublish nhưng object không có publish → không hiện lựa chọn");
  assert.match(noPublishFn, /Gửi cho bạn bè/);
  const both = renderToStaticMarkup(<ShareSheet {...base} target={null} canPublish={true} publish={async () => ({ ok: true as const })} />);
  assert.match(both, /Gửi cho bạn bè/); assert.match(both, /Đăng lên cộng đồng/);
  assert.equal(/artifact|shared|promote|visibility/i.test(both.replace(/<[^>]+>/g, " ")), false, "không từ kỹ thuật");
});

test("vòng đời artifact dùng CHUNG: BMS và Nhịp & Phách cùng một hook + một API; không copy logic", () => {
  const hook = code("src/share/useArtifactLifecycle.ts"), api = code("src/share/artifactApi.ts");
  for (const f of ["src/bms/BmsArtifactPage.tsx", "src/nhipphach/SharedScoreView.tsx"]) {
    const src = code(f);
    assert.match(src, /useArtifactLifecycle\(/, f);
    assert.equal(/unpublishArtifact|deleteArtifact|social_unpublish_tool_artifact|social_delete_tool_artifact/.test(src), false, `${f} không tự gọi RPC gỡ/xoá — đi qua hook chung`);
  }
  assert.match(hook, /unpublishArtifact\(artifactId\)/); assert.match(hook, /deleteArtifact\(artifactId\)/);
  assert.match(api, /tool_artifact_save_for_share/); assert.match(api, /social_publish_tool_artifact/); assert.match(api, /social_unpublish_tool_artifact/);
});

test("Nhịp & Phách: MỘT nút 'Chia sẻ' (lưu riêng tự động); trang xem có Chia sẻ; người được gửi riêng không forward; không RPC đăng cũ", () => {
  const blk = code("src/nhipphach/ShareScoreBlock.tsx"), view = code("src/nhipphach/SharedScoreView.tsx"), api = code("src/class-social/toolshare/nhipphachShare.ts");
  assert.match(blk, />\s*Chia sẻ\s*<\/button>/); assert.equal(/Chia sẻ lên cộng đồng/.test(blk), false);
  assert.match(blk, /ensureTarget=\{async \(\) => \{ const r = await saveNhipPhachForShare\(target\)/);
  assert.match(api, /saveArtifactForShare\("nhipphach"/); assert.equal(/social_share_tool_result|shareNhipPhachScore/.test(api), false);
  assert.match(view, /life\.canShare/); assert.match(view, /canPublish=\{life\.canPublish\}/); assert.match(view, /Bản được gửi riêng cho bạn/);
  assert.match(view, /"Bản nhạc gốc của bạn không đổi\."/);
  assert.equal(/Gỡ chia sẻ/.test(view + blk), false);
});

test("Lớp học & Buổi học: chỉ DM tham chiếu (không tạo artifact, không đăng cộng đồng); nút Chia sẻ ở trang lớp/buổi", () => {
  for (const f of ["src/class-social/classes/ClassPage.tsx", "src/class-social/classes/ClassSessionPage.tsx"]) {
    const src = code(f);
    assert.match(src, /<ShareButton /, f);
    assert.equal(/tool_artifact|saveArtifactForShare|publishArtifact/.test(src), false, `${f}: không tạo/đăng artifact`);
  }
  const btn = code("src/share/ShareButton.tsx");
  assert.match(btn, /canPublish=\{false\}/, "chỉ gửi bạn, không đăng cộng đồng");
  assert.equal(/publish=/.test(btn), false);
  assert.match(code("src/class-social/classes/ClassPage.tsx"), /\{member && <ShareButton target=\{\{ type: 'class'/, "chỉ thành viên/Thầy thấy nút (server kiểm lại)");
  assert.match(code("src/class-social/classes/ClassSessionPage.tsx"), /type: 'class_session', key: s\.sessionId\.toLowerCase\(\)/);
});

test("registry: card Feed của Nhịp & Phách có shareRef (nút Chia sẻ → chọn thẳng bạn); Metronome thì không", () => {
  const np = describeToolShare({ v: 1, tool: "nhipphach", kind: "score", artifact_id: ID, title: "Đàn Gà Con", meter: "3/4", counting_level: "eighths" })!;
  assert.deepEqual(np.shareRef, artifactRef(ID));
  assert.equal(describeToolShare({ v: 1, tool: "metronome", kind: "practice_session", bpm: 80, seconds: 600 })?.shareRef ?? null, null);
});

test("Phạm vi: không Mira / realtime / upload trong lớp share; không đổi quyền object", () => {
  for (const f of ["src/share/shareRef.ts", "src/share/artifactApi.ts", "src/share/refCards.ts", "src/share/ShareSheet.tsx", "src/share/ShareToFriendSheet.tsx", "src/share/useArtifactLifecycle.ts"]) {
    assert.equal(/Mira|realtime|\.channel\(|type="file"|\.upload\(|getUserMedia/i.test(code(f)), false, f);
  }
});
