/**
 * Class UGC Safety V1 (Apple 1.2) — logic thuần + chốt chặn cấu trúc phía client.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  REPORT_REASONS, REPORT_KINDS, validateReport, cleanNote, mapUgcError, safetyErrorText, parseUgcStatus, gateState,
  SAFETY_PLACEMENTS, SAFE_READ_REPLACEMENTS, UGC_BLOCKED_TEXT, USER_BLOCKED_TEXT, ACCOUNT_SUSPENDED_TEXT,
  SUPPORT_ZALO_URL, SUPPORT_EMAIL, PRIVACY_URL, isResolveAction, messageReportKind, COMMUNITY_RULES, NOTE_MAX,
} from "../../src/class-safety/model.ts";

test("ánh xạ lỗi UGC server → tiếng Việt", () => {
  assert.equal(mapUgcError({ message: "ugc_blocked" }), "Nội dung chưa phù hợp với quy tắc cộng đồng");
  assert.equal(mapUgcError({ message: "ERROR: ugc_blocked: nội dung", code: "P0001" }), UGC_BLOCKED_TEXT);
  assert.equal(mapUgcError({ message: "x", details: "user_blocked" }), USER_BLOCKED_TEXT);
  assert.equal(mapUgcError({ message: "account_suspended" }), ACCOUNT_SUSPENDED_TEXT);
  assert.equal(mapUgcError({ message: "duplicate key" }), null);
  assert.equal(mapUgcError(null), null);
});

test("safetyErrorText: mạng, hết phiên, RPC chưa có, mặc định — không bao giờ rỗng", () => {
  assert.match(safetyErrorText({ message: "Failed to fetch" }), /kết nối mạng/);
  assert.match(safetyErrorText({ message: "x" }, true), /kết nối mạng/);
  assert.match(safetyErrorText({ status: 401 }), /đăng nhập/);
  assert.match(safetyErrorText({ code: "PGRST202", message: "not found" }), /cập nhật/);
  assert.equal(safetyErrorText({ message: "ugc_blocked" }), UGC_BLOCKED_TEXT);
  assert.ok(safetyErrorText(undefined).length > 0);
});

test("lý do báo cáo hợp lệ khớp CHECK của hợp đồng", () => {
  assert.deepEqual(REPORT_REASONS.map(r => r.key).sort(), ["harassment", "hate", "inappropriate", "other", "sexual", "spam", "violence"]);
  assert.deepEqual([...REPORT_KINDS].sort(), ["band_message", "comment", "dm_message", "post", "profile", "thread"]);
  assert.equal(validateReport({ kind: "post", targetId: "abc", reason: "spam" }), null);
  assert.ok(validateReport({ kind: "post", targetId: "abc", reason: "" }));
  assert.ok(validateReport({ kind: "post", targetId: "abc", reason: "bogus" }));
  assert.ok(validateReport({ kind: "nope", targetId: "abc", reason: "spam" }));
  assert.ok(validateReport({ kind: "post", targetId: "  ", reason: "spam" }));
  assert.ok(validateReport({ kind: "post", targetId: "a", reason: "spam", note: "x".repeat(NOTE_MAX + 1) }));
  assert.equal(cleanNote("   "), null);
  assert.equal(cleanNote(" hi "), "hi");
  assert.equal(cleanNote("x".repeat(900))?.length, NOTE_MAX);
  assert.equal(messageReportKind(true), "band_message");
  assert.equal(messageReportKind(false), "dm_message");
});

test("cổng quy tắc: đã chấp nhận / chưa / lỗi mạng (không khoá vĩnh viễn, không coi lỗi là đồng ý)", () => {
  assert.equal(gateState({ ok: true, status: { acceptedVersion: 1, requiredVersion: 1 } }), "ok");
  assert.equal(gateState({ ok: true, status: { acceptedVersion: 2, requiredVersion: 1 } }), "ok");
  assert.equal(gateState({ ok: true, status: { acceptedVersion: 0, requiredVersion: 1 } }), "needs-accept");
  assert.equal(gateState({ ok: false }), "error");
  assert.deepEqual(parseUgcStatus([{ accepted_version: null, required_version: 1 }]), { acceptedVersion: 0, requiredVersion: 1 });
  assert.deepEqual(parseUgcStatus({ accepted_version: "1", required_version: "2" }), { acceptedVersion: 1, requiredVersion: 2 });
  assert.equal(parseUgcStatus([]), null);
  assert.equal(parseUgcStatus(null), null);
  assert.equal(parseUgcStatus([{ required_version: "x" }]), null);
});

test("quy tắc cộng đồng + liên hệ chính thức", () => {
  assert.equal(SUPPORT_ZALO_URL, "https://zalo.me/vananhguitarist");
  assert.equal(SUPPORT_EMAIL, "vananhaudio@gmail.com");
  assert.equal(PRIVACY_URL, "https://timming.vananhaudio.com/tvaprivacy");
  assert.ok(COMMUNITY_RULES.some(r => /xem xét báo cáo/.test(r.title)));
  // Không cam kết thời hạn xử lý báo cáo (Owner 2026-10-26)
  assert.ok(!COMMUNITY_RULES.some(r => /24 giờ/.test(r.title + r.body)));
  assert.ok(isResolveAction("hide_and_block") && !isResolveAction("delete"));
});

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
}

test("điểm đặt Báo cáo/Chặn: mỗi file dùng class-safety", () => {
  assert.ok(SAFETY_PLACEMENTS.length >= 5);
  for (const p of SAFETY_PLACEMENTS) {
    assert.match(read(p.file), /class-safety\//, p.file);
  }
  assert.match(read("src/class-social/chat/ConversationView.tsx"), /SafetyMenu/);   // DM: menu ở header
  assert.match(read("src/class-mobile/AccountPage.tsx"), /BlockedUsersPage/);
  assert.match(read("src/class-mobile/AccountPage.tsx"), /SupportRow/);
  assert.match(read("src/class-mobile/ClassMobilePage.tsx"), /CommunityRulesGate/);
  assert.match(read("src/class-mobile/MoreSheet.tsx"), /story\/reports\?tab=class/);
  assert.match(read("src/story/ReportsPage.tsx"), /listClassReports/);
});

test("client KHÔNG còn gọi hàm đọc gốc — chỉ bản _safe", () => {
  const files = walk(join(root, "src"));
  for (const [orig, safe] of Object.entries(SAFE_READ_REPLACEMENTS)) {
    const re = new RegExp(`['"\`]${orig}['"\`]`);
    const hits = files.filter(f => !f.includes("class-safety") && re.test(readFileSync(f, "utf8")));
    assert.deepEqual(hits, [], `${orig} còn được gọi trực tiếp`);
    assert.ok(files.some(f => readFileSync(f, "utf8").includes(`'${safe}'`)), `${safe} chưa được dùng`);
  }
});

test("PostCard: chỉ chủ bài mới có Xóa bài; người khác có SafetyMenu", () => {
  const s = read("src/class-social/sections/PostCard.tsx");
  assert.match(s, /post\.isMine/);
  assert.match(s, /Xóa bài/);
  assert.match(s, /SafetyMenu/);
});
