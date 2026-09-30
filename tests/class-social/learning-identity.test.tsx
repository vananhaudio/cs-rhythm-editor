// Learning Identity V1 — helper DUY NHẤT: nhãn chương trình, gộp trùng, trạng thái, bậc, thứ tự, giới hạn cạnh tên.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildIdentities, nameBadges, programKeyOfClass, programOf, type MembershipRow } from "../../src/class-social/identity/learningIdentity";
import { IdentitySectionView, NameBadgesView } from "../../src/class-social/identity/IdentityBadges";

void React;
const row = (o: MembershipRow): MembershipRow => ({ status: "active", ...o });

test("nhãn CHƯƠNG TRÌNH từ mã (không mã lớp, không hard-code từng lớp)", () => {
  const L = (o: MembershipRow) => programOf(o).label;
  assert.equal(L({ class_code: "DH2.KD0826", course_code: "DH2", course_name: "Khởi Đầu Đam Mê – Đệm Hát Trình Độ 2" }), "Đệm hát 2");
  assert.equal(L({ class_code: "DH1.KD17", course_code: "DH1" }), "Đệm hát 1");
  assert.equal(L({ class_code: "DHNC01.TH01", program_code: "DHNC01", course_code: "DHNC" }), "Đệm hát nâng cao");
  assert.equal(L({ class_code: "TN2.GL15", course_code: "TN2" }), "Tỉa nốt 2");
  assert.equal(L({ class_code: "SOLO01.TH01", program_code: "SOLO01", course_code: "SOLO" }), "Solo Guitar");
  assert.equal(L({ class_code: "CB1.T3", course_code: "CB1" }), "Guitar căn bản 1");
  assert.equal(L({ class_code: "HT2027.TH01", program_code: "HT2027", course_code: "DH2" }), "Hành trình 2027", "chương trình đặc biệt thắng khoá chính");
  assert.equal(L({ class_code: "HT2028.TH02" }), "Hành trình 2028", "giữ năm");
  assert.equal(L({ class_code: "DH2.KD21", course_code: null }), "Đệm hát 2", "không có khoá → tiền tố mã lớp");
  assert.equal(programOf({ class_code: "HT2027.TH01" }).tier, "special");
  // Không nhận ra: tên thân thiện, không "?", không mã
  assert.equal(L({ class_code: "XYZ.01", class_name: "Ukulele vui — 12 buổi", course_name: "Khoá Ukulele cho người mới bắt đầu học" }), "Ukulele vui");
  assert.equal(L({ class_code: "ABC", course_name: "Piano 1" }), "Piano 1");
  assert.notEqual(L({}), "?");
});

test("trạng thái: đang học / sắp học / đã tốt nghiệp; huỷ-gộp-nháp bỏ; 2 cohort cùng chương trình = MỘT nhãn", () => {
  const ids = buildIdentities([
    row({ class_code: "DH2.KD0826", course_code: "DH2", class_name: "Đệm hát căn bản — KD0826" }),
    row({ class_code: "DH2.KD1516", course_code: "DH2", class_name: "Đệm hát căn bản — KD1516" }),
    row({ class_code: "HT2027.TH01", program_code: "HT2027", class_name: "Hành trình 2027 — 40 buổi thực hành" }),
    row({ class_code: "SOLO01.TH02", course_code: "SOLO", status: "upcoming" }),
    row({ class_code: "DH1.KD17", course_code: "DH1", status: "completed" }),
    row({ class_code: "TN1.GL10", course_code: "TN1", status: "completed" }),
    row({ class_code: "DH1.KD20", course_code: "DH1", status: "cancelled" }),
    row({ class_code: "X.M", course_code: "TN3", status: "merged" }),
    row({ class_code: "DH2.OLD", course_code: "DH2", status: "completed" }),   // học lại DH2: không lặp ở Đã tốt nghiệp
  ]);
  assert.deepEqual(ids.current.map(i => i.label), ["Hành trình 2027", "Đệm hát 2"], "Hành trình trước, rồi bậc cao hơn");
  assert.deepEqual(ids.upcoming.map(i => i.label), ["Solo Guitar"]);
  assert.deepEqual(ids.graduated.map(i => i.label), ["Đệm hát 1", "Tỉa nốt 1"]);
  assert.match(ids.current[1].title, /KD0826/); assert.match(ids.current[1].title, /KD1516/);
  assert.deepEqual(buildIdentities([]), { current: [], upcoming: [], graduated: [] });
  assert.deepEqual(buildIdentities(null), { current: [], upcoming: [], graduated: [] });
});

test("cạnh tên: CHỈ đang học, ưu tiên Hành trình → cao hơn, +N; loại chương trình của chính lớp đang xem", () => {
  const ids = buildIdentities([
    row({ course_code: "DH1" }), row({ course_code: "TN2" }), row({ course_code: "SOLO" }),
    row({ program_code: "HT2027" }), row({ course_code: "DHNC" }), row({ course_code: "CB1", status: "completed" }),
  ]);
  const b = nameBadges(ids, 2);
  assert.deepEqual(b.shown.map(i => i.label), ["Hành trình 2027", "Đệm hát nâng cao"]);
  assert.equal(b.more.length, 3);
  assert.equal(nameBadges(ids, 1, "ht-2027").shown[0].label, "Đệm hát nâng cao");
  const h = renderToStaticMarkup(<NameBadgesView ids={ids} max={2} />);
  assert.match(h, /◆<\/span>Hành trình 2027/); assert.match(h, />\+3</);
  assert.equal(/Guitar căn bản/.test(h), false, "đã tốt nghiệp không lên cạnh tên");
  assert.equal(/DH1|KD|\.T3/.test(h.replace(/title="[^"]*"/g, "")), false, "không mã lớp/khoá trong nội dung nhãn");
  assert.equal(renderToStaticMarkup(<NameBadgesView ids={buildIdentities([])} />), "", "không có → không render");
  assert.equal(programKeyOfClass({ code: "DH2.KD18", name: "Đệm hát căn bản — KD18", programCode: null, course: { code: "DH2", name: null } }), "dh-2");
});

test("trang cá nhân: Đang học · Sắp học · Đã tốt nghiệp — nhiều nhãn wrap, không khối khi trống", () => {
  const many = buildIdentities([
    ...["DH1", "DH2", "TN1", "TN2", "SOLO"].map(c => row({ course_code: c })),
    ...["CB1", "CB2", "TN3", "DHNC"].map(c => row({ course_code: c, status: "completed" })), row({ program_code: "HT2026", status: "completed" }),
  ]);
  const h = renderToStaticMarkup(<IdentitySectionView ids={many} />);
  assert.match(h, /Danh tính học tập/); assert.match(h, /Đang học/); assert.match(h, /Đã tốt nghiệp/);
  assert.equal(/Sắp học/.test(h), false, "không có nhóm → không tiêu đề nhóm");
  assert.equal((h.match(/class="cs-lid /g) || []).length, 10);
  assert.match(h, /cs-lid is-special is-graduated[^>]*>.*Hành trình 2026/);
  assert.equal(renderToStaticMarkup(<IdentitySectionView ids={buildIdentities([])} />), "");
});

test("kiến trúc: MỘT helper + MỘT renderer; nạp theo lô (không N+1); danh tính lịch sử của thread không bị thay", () => {
  const store = readFileSync("src/class-social/identity/identityStore.ts", "utf8");
  assert.match(store, /rpc\('social_learning_identities', \{ p_users: chunk \}\)/);
  assert.match(store, /setTimeout\(\(\) => void flush\(\), 0\)/, "gom user_id cùng nhịp");
  for (const f of ["src/class-social/sections/PostCard.tsx", "src/learning-thread/LearningThreadCard.tsx", "src/class-social/sections/comments/CommentItem.tsx",
                   "src/class-social/sections/Friends.tsx", "src/class-social/classes/ClassParts.tsx"]) {
    const s = readFileSync(f, "utf8");
    assert.match(s, /<IdentityBadges userId=/, f);
    assert.equal(/Đệm hát \d|Hành trình 20|programOf\(/.test(s), false, `${f} không tự đặt tên nhãn`);
  }
  const card = readFileSync("src/learning-thread/LearningThreadCard.tsx", "utf8");
  assert.match(card, /identityLine\(card\.identity\)/, "thẻ vẫn giữ danh tính LỊCH SỬ của bài");
  assert.match(readFileSync("src/learning-thread/ThreadPage.tsx", "utf8"), /showIdentity \/>/);
  assert.equal(/showIdentity/.test(readFileSync("src/learning-thread/LearningThreadSheet.tsx", "utf8")), false, "App học không hiện nhãn Social");
});
