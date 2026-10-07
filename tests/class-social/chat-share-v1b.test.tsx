/**
 * Chat V1b (Share nội bộ BMS artifact): model tham chiếu, dựng card từ object gốc, trạng thái không khả dụng,
 * render trong dòng tin, và rào chắn phạm vi (chỉ tham chiếu · không ghi chú · không bảng dm_* trực tiếp · không media/Mira).
 * DB + quyền + seq đồng thời: scripts/test-dm-share-v1-db.sh · UI thật: scripts/e2e-chat-share-v1b.sh.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SHARE_FALLBACK_BODY, chatErrorText, mergeMessages, toMessages, toShareRef, type ChatMessage } from "../../src/class-social/chat/chatModel";
import { UNAVAILABLE_TEXT, bmsCardView, type BmsArtifactCardRow } from "../../src/class-social/chat/shareCards";
import { ShareCardView } from "../../src/class-social/chat/ShareMessageCard";
import MessageList from "../../src/class-social/chat/MessageList";
import { ToolShareBodyView } from "../../src/class-social/toolshare/ToolShareCard";
import { describeToolShare } from "../../src/class-social/toolshare/registry";
void React;

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const code = (f: string) => read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const ART = "a1111111-0000-4000-8000-000000000001";
const row = (o: Partial<BmsArtifactCardRow> = {}): BmsArtifactCardRow => ({
  id: ART, tool: "bms", kind: "song", title: "Có Chàng Trai Viết Lên Cây", video_id: "dQw4w9WgXcQ", bpm: "76.4", ts: "4",
  chords: [{ word_index: 0, name: "C" }, { word_index: 4, name: "G" }, { word_index: 8, name: "C" }], ...o,
});

test("toShareRef: chỉ nhận tool_artifact + uuid hợp lệ (chữ thường hoá); loại lạ/khoá hỏng/null → null", () => {
  assert.deepEqual(toShareRef("tool_artifact", ART.toUpperCase()), { type: "tool_artifact", key: ART });
  for (const [t, k] of [["post", ART], ["tool_artifact", "khong-phai-uuid"], ["tool_artifact", null], [null, ART], [null, null], ["tool_artifact", ""]] as const) {
    assert.equal(toShareRef(t, k), null, `${t}/${k}`);
  }
});

test("toMessages: tin share mang ref; tin text ref = null; ref lạ → null (hiện như text với body cố định, không lỗi)", () => {
  const ms = toMessages([
    { seq: 1, mine: true, body: "Chào", created_at: "2026-10-07T03:00:00Z", ref_type: null, ref_key: null },
    { seq: "2", mine: false, body: SHARE_FALLBACK_BODY, created_at: "2026-10-07T03:01:00Z", ref_type: "tool_artifact", ref_key: ART },
    { seq: 3, mine: false, body: SHARE_FALLBACK_BODY, created_at: "2026-10-07T03:02:00Z", ref_type: "tuong_lai", ref_key: ART },
    { seq: 4, mine: true, body: "V1a cũ không có cột ref", created_at: "2026-10-07T03:03:00Z" },
  ]);
  assert.deepEqual(ms.map(m => m.ref ?? null), [null, { type: "tool_artifact", key: ART }, null, null]);
  assert.equal(ms[2].body, "Đã chia sẻ một nội dung", "ref lạ vẫn có body cố định để hiện");
  assert.equal(mergeMessages(ms.slice(0, 2), ms.slice(1))[1].ref?.key, ART, "gộp theo seq giữ ref");
});

test("bmsCardView: dựng card từ object gốc bằng registry Tool Share (tiêu đề · BPM làm tròn · nhịp · số hợp âm KHÁC NHAU · ảnh YouTube · link luyện · shareRef)", () => {
  const v = bmsCardView(row())!;
  assert.equal(v.headline, "Có Chàng Trai Viết Lên Cây");
  assert.equal(v.detail, "76 BPM · 4/4 · 2 hợp âm");
  assert.equal(v.thumbnail, "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");
  assert.equal(v.action?.href, `/song-builder?artifact=${ART}`);
  assert.deepEqual(v.shareRef, { type: "tool_artifact", key: ART });
});

test("bmsCardView: không phải BMS song / dữ liệu hỏng / null → null (fail-safe, không throw)", () => {
  for (const r of [null, undefined, row({ tool: "nhipphach", kind: "score" }), row({ title: "" }), row({ video_id: "../../x" }), row({ bpm: null }), row({ bpm: "9999" }), row({ ts: "abc" }), row({ id: "xx" })]) {
    assert.equal(bmsCardView(r as never), null);
  }
  assert.doesNotThrow(() => bmsCardView(row({ chords: "lạ" as never })));
  assert.equal(bmsCardView(row({ chords: null }))?.detail, "76 BPM · 4/4");
});

test("ShareCardView: card là MỘT liên kết tới object gốc, không URL thô/JSON/uuid hiển thị", () => {
  const html = renderToStaticMarkup(<ShareCardView view={bmsCardView(row())} />);
  assert.match(html, /<a [^>]*href="\/song-builder\?artifact=a1111111-0000-4000-8000-000000000001"/);
  assert.match(html, /BMS · Dựng bài hát/);
  assert.match(html, /Có Chàng Trai Viết Lên Cây/);
  assert.match(html, /Luyện bài này/);
  const text = html.replace(/<[^>]+>/g, " ");
  assert.equal(/a1111111|https?:|\{|tool_artifact/.test(text), false, "văn bản hiển thị không lộ id/URL/JSON");
});

test("ShareCardView: không khả dụng (null) → 'Nội dung này không còn khả dụng', KHÔNG link; đang tải → khung chờ", () => {
  const gone = renderToStaticMarkup(<ShareCardView view={null} />);
  assert.match(gone, /Nội dung này không còn khả dụng/);
  assert.equal(UNAVAILABLE_TEXT, "Nội dung này không còn khả dụng");
  assert.equal(/<a /.test(gone) || /href=/.test(gone), false, "không có đường dẫn nào");
  const loading = renderToStaticMarkup(<ShareCardView view={undefined} />);
  assert.match(loading, /aria-busy="true"/);
});

test("MessageList: tin share → card (khung chờ khi chưa resolve); tin text → bong bóng như V1a; text trước/sau share nguyên vẹn", () => {
  const ms: ChatMessage[] = [
    { seq: 1, mine: true, body: "trước", at: "2026-10-07T03:00:00Z" },
    { seq: 2, mine: true, body: SHARE_FALLBACK_BODY, at: "2026-10-07T03:00:10Z", ref: { type: "tool_artifact", key: ART } },
    { seq: 3, mine: false, body: "sau", at: "2026-10-07T03:00:20Z" },
  ];
  const html = renderToStaticMarkup(<MessageList messages={ms} pending={[]} hasMore={false} loadingOlder={false} onLoadOlder={() => {}} onRetry={() => {}} onDiscard={() => {}} />);
  assert.equal((html.match(/cs-msg-bubble"/g) ?? []).length, 2, "đúng 2 bong bóng text (trước, sau)");
  assert.equal((html.match(/cs-msg-share/g) ?? []).length, 1, "đúng 1 card share");
  assert.equal(html.includes(SHARE_FALLBACK_BODY), false, "tin share KHÔNG hiện chuỗi fallback (đã là card)");
  assert.match(html, />trước</); assert.match(html, />sau</);
});

test("Feed: ToolShareBodyView chỉ hiện 'Gửi bạn bè' cho BMS (shareRef) và khi có onShareToFriend", () => {
  const bms = bmsCardView(row())!;
  assert.match(renderToStaticMarkup(<ToolShareBodyView view={bms} onShareToFriend={() => {}} />), /Gửi bạn bè/);
  assert.equal(/Gửi bạn bè/.test(renderToStaticMarkup(<ToolShareBodyView view={bms} />)), false, "không callback → không nút");
  const metro = describeToolShare({ v: 1, tool: "metronome", kind: "practice_session", bpm: 80, seconds: 600 });
  assert.equal(/Gửi bạn bè/.test(renderToStaticMarkup(<ToolShareBodyView view={metro} onShareToFriend={() => {}} />)), false, "Metronome chưa share được cho bạn");
});

test("chatErrorText: lỗi share dịu — 22023 theo ngữ cảnh share; 42501 = chưa thể nhắn; không lộ chi tiết", () => {
  assert.equal(chatErrorText({ code: "22023", message: "Nội dung này không thể chia sẻ" }, false, "share"), "Nội dung này không thể chia sẻ nữa.");
  assert.equal(chatErrorText({ code: "42501", message: "Bạn chưa thể nhắn tin cho người này" }, false, "share"), "Bạn chưa thể nhắn tin cho người này.");
  assert.equal(chatErrorText({ code: "54000" }, false, "share"), "Bạn gửi quá nhanh. Hãy chờ một chút rồi gửi tiếp.");
});

// ── Rào chắn phạm vi V1b ────────────────────────────────────────────────────
test("Phạm vi V1b: chỉ THAM CHIẾU (không ghi chú, không snapshot), một RPC share, đọc object chỉ qua tool_artifacts (RLS)", () => {
  const api = code("src/class-social/chat/chatApi.ts");
  assert.match(api, /'dm_share'/);
  assert.match(api, /\{ p_user: userId, p_ref_type: 'tool_artifact', p_ref_key: artifactId \}/, "dm_share chỉ nhận người + loại + khoá (KHÔNG body/ghi chú)");
  const sheet = code("src/class-social/chat/ShareToFriendSheet.tsx");
  assert.equal(/<textarea|placeholder="(Lời nhắn|Ghi chú)|note|caption/i.test(sheet), false, "Share Sheet không có ô ghi chú");
  assert.equal((sheet.match(/<input/g) ?? []).length, 1, "chỉ một ô nhập: tìm bạn bè");
  const files = readdirSync(new URL("../../src/class-social/chat/", import.meta.url)).map(f => `src/class-social/chat/${f}`);
  const readers = files.filter(f => /from\(\s*['"`]tool_artifacts/.test(code(f)));
  assert.deepEqual(readers, ["src/class-social/chat/shareCards.ts"], "chỉ shareCards.ts đọc tool_artifacts (qua RLS, không RPC)");
  const all = files.map(code).join("\n") + code("src/class-social/sections/Chat.tsx");
  assert.equal(/\.from\(\s*['"`]dm_/.test(all), false, "không truy cập thẳng bảng dm_*");
  assert.equal(/\.channel\(|postgres_changes|realtime/i.test(all), false, "không realtime");
  assert.equal(/type="file"|\.upload\(|getUserMedia|MediaRecorder|FileReader|sticker|class-ai|@Mira|sender_kind/i.test(all), false, "không media/Mira");
  assert.equal(/ARTIFACT_CARD_SELECT[^\n]*lyrics/.test(code("src/class-social/chat/shareCards.ts")), false, "card không kéo lời bài hát");
});

test("Entry point V1b: BmsArtifactPage + card BMS trên Feed; quyền do server (không suy luận bạn bè ở client)", () => {
  assert.match(code("src/bms/BmsArtifactPage.tsx"), /ShareToFriendSheet/);
  assert.match(code("src/class-social/toolshare/ToolShareCard.tsx"), /onShareToFriend/);
  assert.equal(/friendship|relationship\s*===/.test(code("src/class-social/chat/ShareToFriendSheet.tsx")), false);
});
