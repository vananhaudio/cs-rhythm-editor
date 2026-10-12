/** "Band của tôi" — mô hình thuần: Band = Team TeamLab (projects), không phải bảng `bands` của Tuyển thành viên. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { actionFor, bandHomeHref, toMyBands } from "../../src/class-social/mybands/myBandsModel";

const A = "a1111111-0000-4000-8000-000000000001", B = "a2222222-0000-4000-8000-000000000002";
const src = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8");

test("toMyBands: ghép thành viên ⨝ Team, sắp theo tên, bỏ trùng / Team không đọc được / id lạ", () => {
  const members = [{ project_id: B }, { project_id: A }, { project_id: A }, { project_id: "x" }, { project_id: "c3333333-0000-4000-8000-000000000003" }];
  const projects = [{ id: A, name: "Mộc Du Ca" }, { id: B, name: "Lá Mùa Thu" }];
  assert.deepEqual(toMyBands(members, projects), [{ id: B, name: "Lá Mùa Thu" }, { id: A, name: "Mộc Du Ca" }]);
  assert.deepEqual(toMyBands(null, null), []);
});

test("actionFor: 0 → hộp thoại; 1 → thẳng Band Home; ≥2 → chọn (không tự chọn)", () => {
  assert.deepEqual(actionFor([]), { kind: "none" });
  assert.deepEqual(actionFor([{ id: A, name: "X" }]), { kind: "go", href: `/teamlab/#/project/${A}` });
  const two = [{ id: A, name: "X" }, { id: B, name: "Y" }];
  assert.deepEqual(actionFor(two), { kind: "choose", bands: two });
});

test("bandHomeHref: deep link hash cũ của TeamLab (cùng cơ chế đăng nhập); nguồn dữ liệu là teamlab_project_members, không phải bảng bands", () => {
  assert.equal(bandHomeHref(A), `/teamlab/#/project/${A}`);
  const api = src("class-social/mybands/myBandsApi.ts");
  assert.match(api, /from\('teamlab_project_members'\)[\s\S]*\.eq\('user_id', userId\)/);
  assert.doesNotMatch(api.replace(/\/\/.*$/gm, ""), /from\('bands'\)|band_applications|\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
});

test("lỗi truy vấn không bị coi là 'chưa có Band'", () => {
  const api = src("class-social/mybands/myBandsApi.ts");
  assert.match(api, /if \(m\.error\) return \{ ok: false/);
  assert.match(api, /if \(p\.error\) return \{ ok: false/);
  assert.match(api, /catch \{\s*return \{ ok: false/);
});
