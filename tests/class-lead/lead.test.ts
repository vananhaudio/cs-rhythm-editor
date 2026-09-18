// Guard sau lỗi Phase 1: UI báo đăng ký thành công ⇒ lead ĐÃ được lưu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildClassLead, saveClassLead, CLASS_LEAD_FIELDS } from "../../src/lib/classLead.ts";

const payload = buildClassLead({ name: "A", email: "a@example.com", className: "Đệm hát căn bản · DH1.KD20", path: "dem_hat", product: "dem_hat_can_ban", plan: "monthly" });

test("payload chỉ gồm đúng các cột đã kiểm với schema (không cần phone)", () => {
  assert.deepEqual(Object.keys(payload).sort(), [...CLASS_LEAD_FIELDS].sort());
  assert.equal(payload.note, "[public-product:dem_hat_can_ban][plan:monthly]");
});

test("INSERT lỗi ⇒ trả lỗi, KHÔNG coi là thành công", async () => {
  const orig = console.error; console.error = () => {};
  try {
    assert.ok(await saveClassLead(async () => ({ error: { message: 'null value in column "phone"' } }), payload));
    assert.ok(await saveClassLead(async () => { throw new Error("network"); }, payload));
  } finally { console.error = orig; }
});

test("INSERT thành công ⇒ null", async () => {
  assert.equal(await saveClassLead(async () => ({ error: null }), payload), null);
});

test("landing: lỗi lưu lead chặn thanh toán (throw trước setShowPay), form bắt lỗi", () => {
  const page = readFileSync(new URL("../../src/ClassLandingPage.tsx", import.meta.url), "utf8");
  const i = page.indexOf("const submitRegistration");
  const body = page.slice(i, page.indexOf("setShowPay(true)", i));
  assert.match(body, /saveClassLead\(/, "phải lưu qua saveClassLead");
  assert.match(body, /if \(err\) throw new Error\(err\)/, "lỗi phải throw trước khi mở thanh toán");
  assert.doesNotMatch(body, /vẫn tiếp tục/, "không được nuốt lỗi INSERT");
  const form = readFileSync(new URL("../../src/components/ClassPublicTracks.tsx", import.meta.url), "utf8");
  assert.match(form, /catch \(x\) \{ setErr\(/, "form phải hiện lỗi khi onSubmit throw");
});
