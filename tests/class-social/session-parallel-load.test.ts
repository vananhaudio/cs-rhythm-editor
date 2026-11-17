/** loadSession: 3 truy vấn độc lập chạy SONG SONG, kết quả y hệt bản tuần tự cũ, lỗi/đổi tài khoản không sai trạng thái. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadSessionWith, type SessionDeps, type StudentRow, type AppUserRow } from "../../src/class-social/loadSessionCore";

const stuRow: StudentRow = { id: "s1", full_name: "Nguyen Minh Anh", display_name: null, email: "m@x.vn", avatar_url: "a.png", level: "L2", enrolled_at: "2026-01-01", ht_member: true };
const deferred = <T,>() => { let resolve!: (v: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } };
const user = { id: "u1", email: "u@x.vn", user_metadata: { full_name: " Thầy A " } };

/** Bản tuần tự CŨ (tham chiếu) — cùng thứ tự: app_users → cover → edu_students. */
async function sequentialReference(d: SessionDeps) {
  const u = await d.getUser(); if (!u?.id) return { status: "signed-out" };
  const appUser = await d.fetchAppUser(u.id);
  const isTeacher = appUser?.role === "teacher" || appUser?.role === "admin"; const isAdmin = appUser?.role === "admin";
  const coverUrl = await d.fetchCover(u.id);
  const stu = await d.fetchStudent(u.id);
  if (stu) return { status: "ready", me: { role: "student", userId: u.id, studentId: stu.id, name: "Nguyen Minh Anh", email: stu.email ?? u.email ?? null, avatarUrl: stu.avatar_url, level: stu.level, enrolledAt: stu.enrolled_at, htMember: !!stu.ht_member, isTeacher, isAdmin, coverUrl } };
  if (isTeacher) return { status: "ready", me: { role: "teacher", userId: u.id, studentId: null, name: "Thầy A", email: u.email ?? null, avatarUrl: appUser?.avatar_url ?? null, level: null, enrolledAt: null, htMember: false, isTeacher: true, isAdmin, coverUrl } };
  return { status: "no-profile", userId: u.id, email: u.email ?? null };
}
const mk = (appUser: AppUserRow | null, cover: string | null, stu: StudentRow | null): SessionDeps => ({
  getUser: async () => user, fetchAppUser: async () => appUser, fetchCover: async () => cover, fetchStudent: async () => stu,
});

test("ba truy vấn được khởi chạy cùng lúc, trước khi truy vấn nào xong", async () => {
  const a = deferred<AppUserRow | null>(), c = deferred<string | null>(), s = deferred<StudentRow | null>();
  const started: string[] = [];
  const p = loadSessionWith({
    getUser: async () => user,
    fetchAppUser: () => { started.push("app_users"); return a.promise },
    fetchCover: () => { started.push("profile_media"); return c.promise },
    fetchStudent: () => { started.push("edu_students"); return s.promise },
  });
  await new Promise(r => setTimeout(r, 10))
  assert.deepEqual([...started].sort(), ["app_users", "edu_students", "profile_media"], "cả ba đã bắt đầu khi chưa cái nào trả về");
  s.resolve(stuRow); c.resolve("c.png"); a.resolve({ role: null, avatar_url: null });   // trả về ngược thứ tự
  const r = await p;
  assert.equal(r.status, "ready");
});

for (const [name, app, stu] of [
  ["học sinh", { role: "student", avatar_url: null }, stuRow],
  ["học sinh + admin", { role: "admin", avatar_url: "x" }, stuRow],
  ["thầy không hồ sơ học sinh", { role: "teacher", avatar_url: "t.png" }, null],
  ["không có hồ sơ", { role: null, avatar_url: null }, null],
  ["app_users trống", null, null],
] as [string, AppUserRow | null, StudentRow | null][]) {
  test(`kết quả giống bản tuần tự cũ — ${name}`, async () => {
    const d = mk(app, "cover.png", stu);
    assert.deepEqual(await loadSessionWith(d), await sequentialReference(d));
  });
}

test("không có phiên → signed-out và KHÔNG gọi truy vấn nào", async () => {
  let calls = 0; const f = async () => { calls++; return null };
  assert.deepEqual(await loadSessionWith({ getUser: async () => null, fetchAppUser: f, fetchCover: f, fetchStudent: f }), { status: "signed-out" });
  assert.equal(calls, 0);
});

test("một truy vấn lỗi → cả lần nạp thất bại (nơi gọi đưa về signed-out), như khi tuần tự", async () => {
  const d = { ...mk(null, null, null), fetchStudent: async () => { throw new Error("boom") } };
  await assert.rejects(loadSessionWith(d), /boom/);
});

test("đổi tài khoản giữa chừng: mỗi lần nạp chỉ dùng user.id của chính nó, kết quả không lẫn", async () => {
  const slow = deferred<StudentRow | null>();
  const mkFor = (id: string, stu: Promise<StudentRow | null>): SessionDeps => ({
    getUser: async () => ({ id, email: `${id}@x.vn` }), fetchAppUser: async () => null, fetchCover: async () => null, fetchStudent: () => stu,
  });
  const old = loadSessionWith(mkFor("old", slow.promise));
  const fresh = await loadSessionWith(mkFor("new", Promise.resolve({ ...stuRow, id: "sNew" })));
  slow.resolve({ ...stuRow, id: "sOld" });
  const o = await old;
  assert.equal(fresh.status === "ready" && fresh.me.userId, "new");
  assert.equal(o.status === "ready" && o.me.userId, "old");
});

test("hook vẫn giữ chốt chặn kết quả cũ (seq/alive) và SIGNED_OUT tăng seq", () => {
  const src = readFileSync(new URL("../../src/class-social/useClassSession.ts", import.meta.url), "utf8");
  assert.match(src, /if \(!alive \|\| mine !== seq\) return/);
  assert.match(src, /event === 'SIGNED_OUT'\) \{[\s\S]*?seq\+\+/);
  assert.match(src, /loadSessionWith\(\{/);
});
