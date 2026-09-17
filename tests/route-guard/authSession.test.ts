/**
 * Ma trận phiên đăng nhập ↔ quyền công cụ (lỗi mất nháp khi tab lấy lại focus).
 * Bộ theo dõi dùng chung cho ToolRouteGate và useCapabilities.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  quyetDinhSuKienPhien,
  taoBoTheoDoiQuyen,
  type KetQuaHoi,
  type TrangThaiQuyen,
} from "../../src/authCapabilityGate.ts";

const cho = () => new Promise((r) => setTimeout(r, 0));
function moi<T>(opts: { khiKhach?: T } = {}) {
  let uid: string | null = "A";
  let tra: (uid: string | null) => KetQuaHoi<T> = () => ({ ok: false });
  const lich: TrangThaiQuyen<T>[] = [];
  let treo: (() => void) | null = null;
  let giuLai = false;
  const bo = taoBoTheoDoiQuyen<T>({
    docUid: async () => uid,
    hoi: (u) =>
      giuLai
        ? new Promise((res) => { treo = () => res(tra(u)); })
        : Promise.resolve(tra(u)),
    khiKhach: opts.khiKhach,
    dat: (s) => lich.push(s),
  });
  return {
    bo, lich,
    datUid: (u: string | null) => { uid = u; },
    datTra: (f: (u: string | null) => KetQuaHoi<T>) => { tra = f; },
    giuRequest: (v: boolean) => { giuLai = v; },
    thaRequest: () => treo?.(),
    // Đã từng gỡ công cụ (loading/error) kể từ vị trí `tu` chưa?
    daGo: (tu: number) => lich.slice(tu).some((s) => s.phase !== "ready" || s.value === null),
    cuoi: () => lich.at(-1)!,
  };
}

test("quyết định thuần: chỉ đăng xuất hoặc ĐỔI người mới quên quyền", () => {
  for (const ev of ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "INITIAL_SESSION"])
    assert.equal(quyetDinhSuKienPhien(ev, "A", "A"), "GIU", ev);
  assert.equal(quyetDinhSuKienPhien("SIGNED_OUT", "A", "A"), "QUEN");
  assert.equal(quyetDinhSuKienPhien("SIGNED_IN", "B", "A"), "QUEN");
  assert.equal(quyetDinhSuKienPhien("TOKEN_REFRESHED", null, "A"), "QUEN");
  assert.equal(quyetDinhSuKienPhien("SIGNED_IN", "A", undefined), "GIU", "chưa có quyền gì thì không có gì để quên");
});

test("cùng người: SIGNED_IN lặp lại / TOKEN_REFRESHED / focus → công cụ KHÔNG bị gỡ, kể cả khi đang hỏi lại", async () => {
  const m = moi<boolean>();
  m.datTra(() => ({ ok: true, value: true }));
  await m.bo.lamMoi();
  assert.deepEqual(m.cuoi(), { phase: "ready", value: true });
  const tu = m.lich.length;
  m.giuRequest(true); // máy chủ trả lời chậm
  for (const ev of ["SIGNED_IN", "TOKEN_REFRESHED", "SIGNED_IN", "USER_UPDATED"]) {
    m.bo.suKien(ev, "A");
    await cho();
    assert.equal(m.daGo(tu), false, `${ev}: công cụ bị gỡ trong lúc chờ`);
  }
  m.thaRequest();
  await cho();
  assert.equal(m.daGo(tu), false);
  assert.deepEqual(m.cuoi(), { phase: "ready", value: true });
});

test("cùng người mà máy chủ THU HỒI quyền → áp dụng ngay khi câu trả lời về (không giữ quyền mãi)", async () => {
  const m = moi<boolean>();
  m.datTra(() => ({ ok: true, value: true }));
  await m.bo.lamMoi();
  m.datTra(() => ({ ok: true, value: false }));
  m.bo.suKien("SIGNED_IN", "A");
  await cho(); await cho();
  assert.deepEqual(m.cuoi(), { phase: "ready", value: false });
});

test("lỗi mạng tạm thời: giữ quyền tốt gần nhất của ĐÚNG người đó", async () => {
  const m = moi<boolean>();
  m.datTra(() => ({ ok: true, value: true }));
  await m.bo.lamMoi();
  const tu = m.lich.length;
  m.datTra(() => ({ ok: false }));
  m.bo.suKien("TOKEN_REFRESHED", "A");
  await cho(); await cho();
  assert.equal(m.daGo(tu), false);
  assert.deepEqual(m.cuoi(), { phase: "ready", value: true });
});

test("ĐỔI người A → B: quên ngay; lỗi mạng không được cho B dùng quyền của A", async () => {
  const m = moi<boolean>();
  m.datTra(() => ({ ok: true, value: true }));
  await m.bo.lamMoi();
  m.datUid("B");
  m.datTra(() => ({ ok: false }));
  const tu = m.lich.length;
  m.bo.suKien("SIGNED_IN", "B");
  assert.deepEqual(m.lich[tu], { phase: "loading", value: null }, "gỡ công cụ ngay khi đổi người");
  await cho(); await cho();
  assert.deepEqual(m.cuoi(), { phase: "error", value: null });
  assert.ok(!m.lich.slice(tu).some((s) => s.value === true), "B không bao giờ thấy quyền của A");
});

test("ĐĂNG XUẤT: gỡ công cụ ngay và không giữ quyền cũ", async () => {
  const m = moi<boolean>();
  m.datTra(() => ({ ok: true, value: true }));
  await m.bo.lamMoi();
  m.datUid(null);
  m.datTra((u) => (u ? { ok: true, value: true } : { ok: true, value: false }));
  const tu = m.lich.length;
  m.bo.suKien("SIGNED_OUT", null);
  assert.deepEqual(m.lich[tu], { phase: "loading", value: null });
  await cho(); await cho();
  assert.deepEqual(m.cuoi(), { phase: "ready", value: false });
  // Kể cả phiên cũ bị lỗi mạng khi đọc: đăng xuất vẫn gỡ.
  const m2 = moi<boolean>();
  m2.datTra(() => ({ ok: true, value: true }));
  await m2.bo.lamMoi();
  m2.datTra(() => ({ ok: false }));
  m2.datUid(null);
  m2.bo.suKien("SIGNED_OUT", null);
  await cho(); await cho();
  assert.notDeepEqual(m2.cuoi(), { phase: "ready", value: true });
});

test("khách (useCapabilities): chưa đăng nhập nhận ngay giá trị khách, không hỏi máy chủ", async () => {
  let hoi = 0;
  const lich: TrangThaiQuyen<string>[] = [];
  const bo = taoBoTheoDoiQuyen<string>({
    docUid: async () => null,
    hoi: async () => { hoi++; return { ok: true, value: "x" }; },
    khiKhach: "khach",
    dat: (s) => lich.push(s),
  });
  await bo.lamMoi();
  assert.equal(hoi, 0);
  assert.deepEqual(lich.at(-1), { phase: "ready", value: "khach" });
});

test("hai cổng thật đều đi qua bộ theo dõi, nhận đủ (event, session), vẫn đọc phiên cục bộ", () => {
  const boChuThich = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const gate = boChuThich(readFileSync(new URL("../../src/ToolRouteGate.tsx", import.meta.url), "utf8"));
  const hook = boChuThich(readFileSync(new URL("../../src/nhipphach/useCapabilities.ts", import.meta.url), "utf8"));
  for (const [ten, m] of [["ToolRouteGate", gate], ["useCapabilities", hook]] as const) {
    assert.match(m, /taoBoTheoDoiQuyen/, ten);
    assert.match(m, /onAuthStateChange\(\s*\(event,\s*session\)\s*=>\s*bo\.suKien\(event,\s*session\?\.user\?\.id\s*\?\?\s*null\)/, ten);
    assert.match(m, /getSession\(\)/, ten);
    assert.doesNotMatch(m, /getUser\(\)/, ten);
    // Không còn đường "SIGNED_IN ⇒ quên" nào.
    assert.doesNotMatch(m, /SIGNED_IN/, `${ten} không được tự xử lý SIGNED_IN`);
  }
});
