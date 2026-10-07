/**
 * BMS Share Lifecycle (local → shared → class): UX một nút "Chia sẻ" + sheet hai lựa chọn, lưu riêng tự động, đăng = promote,
 * không từ kỹ thuật trên UI, người được gửi riêng không forward, gỡ bài riêng. DB: scripts/test-bms-share-lifecycle-db.sh · UI thật: scripts/e2e-bms-share-lifecycle.sh.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ShareSheet from "../../src/share/ShareSheet";
import { artifactRef } from "../../src/share/shareRef";
void React;

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const code = (f: string) => read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const ART = "a1111111-0000-4000-8000-000000000001";
const noop = async () => ({ ok: true as const });
const props = { title: "Có Chàng Trai", ensureTarget: async () => ({ ok: true as const, target: artifactRef(ART) }), publish: noop, onClose: () => {} };

test("sheet Chia sẻ: hai lựa chọn đúng chữ Owner chốt (bài nháp / bài riêng của chủ)", () => {
  const h = renderToStaticMarkup(<ShareSheet {...props} target={null} canPublish={true} />);
  assert.match(h, /aria-label="Chia sẻ"/);
  assert.match(h, /Gửi cho bạn bè/); assert.match(h, /Gửi riêng qua Chat/);
  assert.match(h, /Đăng lên cộng đồng/); assert.match(h, /Chia sẻ để mọi người trong Class cùng xem/);
  const text = h.replace(/<[^>]+>/g, " ");
  assert.equal(/artifact|shared|promote|visibility|\bclass\b(?!\s*cùng)/i.test(text.replace(/trong Class/g, "")), false, "UI không lộ từ kỹ thuật");
});

test("sheet Chia sẻ: chỉ còn MỘT lựa chọn (bài đã đăng / người xem) → vào thẳng chọn bạn, không hiện menu một mục", () => {
  const h = renderToStaticMarkup(<ShareSheet {...props} target={artifactRef(ART)} canPublish={false} />);
  assert.equal(/Đăng lên cộng đồng/.test(h), false, "không có nút đăng");
  assert.equal(/aria-label="Chia sẻ"/.test(h), false, "không hiện menu một mục (đang tải bộ chọn bạn)");
});

test("bmsArtifact: lưu riêng + đăng đi qua đúng 2 RPC mới; không dùng RPC đăng cũ trong luồng mới", () => {
  const api = code("src/bms/bmsArtifact.ts"), common = code("src/share/artifactApi.ts");
  assert.match(api, /saveArtifactForShare\('bms', song\)/);
  assert.match(common, /rpc\('tool_artifact_save_for_share', \{ p_tool: tool, p_payload: payload \}\)/);
  assert.match(common, /rpc\('social_publish_tool_artifact', \{ p_id: artifactId \}\)/);
  assert.equal(/social_share_tool_result/.test(api + common), false, "luồng share không còn gọi RPC đăng cũ (tạo artifact + Feed một bước)");
  assert.match(api, /export const bmsShareApi = \{ save: saveBmsForShare, publish: publishArtifact \}/);
  assert.equal(/shareBmsSong/.test(api), false);
});

test("SongBuilder: MỘT nút 'Chia sẻ'; không còn nút 'Chia sẻ lên cộng đồng' riêng; lưu riêng chỉ khi chọn", () => {
  const sb = code("src/SongBuilderPage.tsx");
  assert.match(sb, />Chia sẻ<\/Btn>/);
  assert.equal(/Chia sẻ lên cộng đồng/.test(sb), false, "không còn nút đăng riêng");
  assert.equal(/Gửi bạn bè/.test(sb), false, "không còn nút gửi riêng");
  assert.match(sb, /<ShareSheet /);
  // lưu riêng nằm trong ensureArtifact (chỉ chạy khi người dùng chọn một lựa chọn), không chạy khi mở màn
  assert.match(sb, /ensureTarget=\{async \(\) => \{ const r = await bmsShare\.save\(buildDraft\(\)\)/);
});

test("Trang xem bài: một nút 'Chia sẻ'; người được gửi riêng KHÔNG chia sẻ tiếp; chủ bài gỡ bài riêng không xoá Chat", () => {
  const p = code("src/bms/BmsArtifactPage.tsx");
  assert.match(p, /useArtifactLifecycle\(/, "vòng đời dùng hook chung");
  const hook = code("src/share/useArtifactLifecycle.ts");
  assert.match(hook, /canShare: isMine \|\| !isPrivate/, "người nhận bài riêng không forward");
  assert.match(hook, /canPublish: isMine && isPrivate/, "chỉ chủ bài, bài còn riêng mới thấy 'Đăng lên cộng đồng'");
  assert.equal(/>Gửi bạn bè</.test(p), false, "không còn nút Gửi bạn bè riêng");
  assert.match(hook, /Tin nhắn trong Chat vẫn còn/);
  assert.match(p, /Bài được gửi riêng cho bạn/);
});

test("loadBmsArtifact trả visibility (class|shared) — chỉ phân biệt hai giá trị", () => {
  const api = code("src/bms/bmsArtifact.ts");
  assert.match(api, /select\('id,owner_id,tool,kind,data,visibility'\)/);
  assert.match(api, /visibility: data\.visibility === 'shared' \? 'shared' : 'class'/);
});

test("Phạm vi: không đụng Nhịp & Phách / Mira / realtime trong thay đổi lifecycle", () => {
  for (const f of ["src/share/ShareSheet.tsx", "src/bms/BmsArtifactPage.tsx", "src/bms/bmsArtifact.ts"]) {
    assert.equal(/Mira|realtime|\.channel\(/i.test(code(f)), false, f);
  }
});

test("Gỡ khỏi cộng đồng ≠ xoá: RPC riêng, trả private|deleted; bài riêng 'Gỡ bài' mới là xoá", () => {
  const api = code("src/bms/bmsArtifact.ts");
  const common = code("src/share/artifactApi.ts"), hook = code("src/share/useArtifactLifecycle.ts"), p = code("src/bms/BmsArtifactPage.tsx");
  assert.match(common, /rpc\('social_unpublish_tool_artifact', \{ p_id: artifactId \}\)/);
  assert.match(common, /data !== 'private' && data !== 'deleted'/, "chỉ nhận hai kết quả hợp lệ");
  assert.match(hook, /isPrivate \? 'Gỡ bài' : 'Gỡ khỏi cộng đồng'/);
  // bài đã đăng → unpublish (không xoá mặc định); bài riêng → xoá chủ động
  assert.match(hook, /if \(isPrivate\) \{\s*if \(await deleteArtifact\(artifactId\)\)/);
  assert.match(hook, /const r = await unpublishArtifact\(artifactId\)/);
  assert.match(hook, /if \(r\.result === 'deleted'\) \{ onGone\(\); return \}/, "chưa từng gửi → đã xoá → trang báo không còn");
  assert.match(hook, /setVisOverride\('shared'\)/, "đã gửi → bài còn, chuyển sang riêng tư tại chỗ");
  assert.match(hook, /họ vẫn mở được/, "xác nhận nói rõ người đã nhận vẫn mở được");
  assert.match(p, /removeLabel/);
  assert.equal(/Gỡ chia sẻ/.test(p + hook), false, "không còn nhãn mơ hồ 'Gỡ chia sẻ'");
});
