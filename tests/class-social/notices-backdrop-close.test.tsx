// C1.5 — Trang Thông báo (độc lập, không popup): bấm nền ngoài danh sách → quay lại; bấm trong danh sách/nút/liên kết → không đóng.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isNoticesBackdropClick } from "../../src/class-social/sections/noticesBackdrop";

const code = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
// Giả lập Element tối thiểu: closest(selector) khớp theo tập lớp/thẻ của tổ tiên
const el = (matches: string[]) => ({ closest: (sel: string) => (sel.split(",").some(s => matches.includes(s.trim())) ? {} : null) }) as unknown as Element;

test("nền trống trong vùng chính, ngoài danh sách → đóng", () => {
  assert.equal(isNoticesBackdropClick(el([".cs-main"])), true);
});
test("bấm trong danh sách thông báo (cuộn/chọn/nội dung) → KHÔNG đóng", () => {
  assert.equal(isNoticesBackdropClick(el([".cs-main", ".cs-notices"])), false);
});
test("nút / liên kết / ô nhập / hộp thoại ngoài danh sách → KHÔNG đóng", () => {
  for (const t of ["a", "button", "input", "textarea", "select", "label", '[role="dialog"]', '[role="button"]'])
    assert.equal(isNoticesBackdropClick(el([".cs-main", t])), false, t);
});
test("ngoài vùng chính (thanh trên, sidebar) và null → KHÔNG đóng (tự xử lý riêng)", () => {
  assert.equal(isNoticesBackdropClick(el([])), false);
  assert.equal(isNoticesBackdropClick(null), false);
});

test("Web: đóng = Quay lại cùng cơ chế nút Back (HOME làm fallback); chuông đang mở → bấm lại đóng", () => {
  const page = code("src/class-social/ClassSocialPage.tsx");
  assert.match(page, /<Notices .*onClose=\{\(\) => onBack\(HOME\)\}/);
  assert.match(page, /view\.kind === 'notices' \? \(\) => onBack\(HOME\) : onOpenNotices/);
});
test("Web: đóng không gọi đánh dấu đã đọc / không đổi dữ liệu", () => {
  const n = code("src/class-social/sections/Notices.tsx");
  assert.match(n, /onClick = \(e: MouseEvent\)/);
  assert.doesNotMatch(n, /markRead|mark_read|markAll/i);
  assert.match(n, /getSelection/);   // bôi đen chữ không đóng
  assert.match(n, /removeEventListener\('click'/);
});
test("Mobile: chuông khi đang ở Thông báo → quay lại (không chồng thêm màn); nền không phải vùng đóng", () => {
  const m = code("src/class-mobile/MobileShell.tsx");
  assert.match(m, /view\.kind === 'notices' \|\| view\.kind === 'chatSystem' \? backToOr\(HOME_VIEW\) : go\(\{ kind: 'notices' \}\)/);
  assert.doesNotMatch(code("src/class-mobile/NoticesPage.tsx"), /addEventListener/);
});
