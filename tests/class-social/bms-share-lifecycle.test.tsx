/**
 * BMS Share Lifecycle (local → shared → class): UX một nút "Chia sẻ" + sheet hai lựa chọn, lưu riêng tự động, đăng = promote,
 * không từ kỹ thuật trên UI, người được gửi riêng không forward, gỡ bài riêng. DB: scripts/test-bms-share-lifecycle-db.sh · UI thật: scripts/e2e-bms-share-lifecycle.sh.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BmsShareSheet from "../../src/bms/BmsShareSheet";
void React;

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const code = (f: string) => read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const ART = "a1111111-0000-4000-8000-000000000001";
const noop = async () => ({ ok: true as const });
const props = { title: "Có Chàng Trai", ensureArtifact: async () => ({ ok: true as const, artifactId: ART }), publish: noop, onClose: () => {} };

test("sheet Chia sẻ: hai lựa chọn đúng chữ Owner chốt (bài nháp / bài riêng của chủ)", () => {
  const h = renderToStaticMarkup(<BmsShareSheet {...props} artifactId={null} canPublish={true} />);
  assert.match(h, /aria-label="Chia sẻ"/);
  assert.match(h, /Gửi cho bạn bè/); assert.match(h, /Gửi riêng qua Chat/);
  assert.match(h, /Đăng lên cộng đồng/); assert.match(h, /Chia sẻ để mọi người trong Class cùng xem/);
  const text = h.replace(/<[^>]+>/g, " ");
  assert.equal(/artifact|shared|promote|visibility|\bclass\b(?!\s*cùng)/i.test(text.replace(/trong Class/g, "")), false, "UI không lộ từ kỹ thuật");
});

test("sheet Chia sẻ: chỉ còn MỘT lựa chọn (bài đã đăng / người xem) → vào thẳng chọn bạn, không hiện menu một mục", () => {
  const h = renderToStaticMarkup(<BmsShareSheet {...props} artifactId={ART} canPublish={false} />);
  assert.equal(/Đăng lên cộng đồng/.test(h), false, "không có nút đăng");
  assert.equal(/aria-label="Chia sẻ"/.test(h), false, "không hiện menu một mục (đang tải bộ chọn bạn)");
});

test("bmsArtifact: lưu riêng + đăng đi qua đúng 2 RPC mới; không dùng RPC đăng cũ trong luồng mới", () => {
  const api = code("src/bms/bmsArtifact.ts");
  assert.match(api, /rpc\('bms_save_for_share', \{ p_song: song \}\)/);
  assert.match(api, /rpc\('social_publish_tool_artifact', \{ p_id: artifactId \}\)/);
  assert.equal(/social_share_tool_result/.test(api), false, "luồng BMS không còn gọi RPC đăng cũ (tạo artifact + Feed một bước)");
  assert.match(api, /export const bmsShareApi = \{ save: saveBmsForShare, publish: publishBmsArtifact \}/);
  assert.equal(/shareBmsSong/.test(api), false);
});

test("SongBuilder: MỘT nút 'Chia sẻ'; không còn nút 'Chia sẻ lên cộng đồng' riêng; lưu riêng chỉ khi chọn", () => {
  const sb = code("src/SongBuilderPage.tsx");
  assert.match(sb, />Chia sẻ<\/Btn>/);
  assert.equal(/Chia sẻ lên cộng đồng/.test(sb), false, "không còn nút đăng riêng");
  assert.equal(/Gửi bạn bè/.test(sb), false, "không còn nút gửi riêng");
  assert.match(sb, /BmsShareSheet/);
  // lưu riêng nằm trong ensureArtifact (chỉ chạy khi người dùng chọn một lựa chọn), không chạy khi mở màn
  assert.match(sb, /ensureArtifact=\{async \(\) => \{ const r = await bmsShare\.save\(buildDraft\(\)\)/);
});

test("Trang xem bài: một nút 'Chia sẻ'; người được gửi riêng KHÔNG chia sẻ tiếp; chủ bài gỡ bài riêng không xoá Chat", () => {
  const p = code("src/bms/BmsArtifactPage.tsx");
  assert.match(p, /const canShare = state\.isMine \|\| !isPrivate/, "người nhận bài riêng không forward");
  assert.match(p, /canPublish=\{state\.isMine && isPrivate\}/, "chỉ chủ bài, bài còn riêng mới thấy 'Đăng lên cộng đồng'");
  assert.equal(/>Gửi bạn bè</.test(p), false, "không còn nút Gửi bạn bè riêng");
  assert.match(p, /Tin nhắn trong Chat vẫn còn/);
  assert.match(p, /Bài được gửi riêng cho bạn/);
});

test("loadBmsArtifact trả visibility (class|shared) — chỉ phân biệt hai giá trị", () => {
  const api = code("src/bms/bmsArtifact.ts");
  assert.match(api, /select\('id,owner_id,tool,kind,data,visibility'\)/);
  assert.match(api, /visibility: data\.visibility === 'shared' \? 'shared' : 'class'/);
});

test("Phạm vi: không đụng Nhịp & Phách / Mira / realtime trong thay đổi lifecycle", () => {
  for (const f of ["src/bms/BmsShareSheet.tsx", "src/bms/BmsArtifactPage.tsx", "src/bms/bmsArtifact.ts"]) {
    assert.equal(/nhipphach|Mira|realtime|\.channel\(/i.test(code(f)), false, f);
  }
});

test("Gỡ khỏi cộng đồng ≠ xoá: RPC riêng, trả private|deleted; bài riêng 'Gỡ bài' mới là xoá", () => {
  const api = code("src/bms/bmsArtifact.ts");
  assert.match(api, /rpc\('social_unpublish_tool_artifact', \{ p_id: artifactId \}\)/);
  assert.match(api, /data !== 'private' && data !== 'deleted'/, "chỉ nhận hai kết quả hợp lệ");
  const p = code("src/bms/BmsArtifactPage.tsx");
  assert.match(p, /'Gỡ khỏi cộng đồng'/);
  assert.match(p, /isPrivate \? 'Gỡ bài' : 'Gỡ khỏi cộng đồng'/);
  // bài đã đăng → unpublish (không xoá mặc định); bài riêng → xoá chủ động
  assert.match(p, /if \(isPriv\) \{\s*if \(await deleteBmsArtifact\(artifactId\)\)/);
  assert.match(p, /const r = await unpublishBmsArtifact\(artifactId\)/);
  assert.match(p, /if \(r\.result === 'deleted'\) \{ setState\(\{ status: 'missing' \}\)/, "chưa từng gửi → đã xoá → trang báo không còn");
  assert.match(p, /setVisOverride\('shared'\)/, "đã gửi → bài còn, chuyển sang riêng tư tại chỗ");
  assert.match(p, /họ vẫn mở được/, "xác nhận nói rõ người đã nhận vẫn mở được");
  assert.equal(/Gỡ chia sẻ/.test(p), false, "không còn nhãn mơ hồ 'Gỡ chia sẻ'");
});
