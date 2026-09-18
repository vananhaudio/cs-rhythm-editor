// BÓC NỘI DUNG TRANG TUYỂN SINH CHO MIRA
//
// Vì sao cần: nội dung mà khách thấy khi bấm "Tôi muốn vừa đàn vừa hát" nằm
// TRONG MÃ NGUỒN React (component ClassDemHat…), không nằm trong cơ sở dữ liệu.
// Mira đọc Supabase nên vĩnh viễn không thấy — trừ khi ta bóc ra như thế này.
//
// Cách làm: render THẬT các component bằng react-dom/server rồi lấy phần chữ.
// Nhờ vậy nội dung luôn khớp với cái khách nhìn thấy, không phải chép tay.
//
// Chạy:  npm run mira:content
// Kết quả: mira-content.json ở gốc repo → copy sang mira-live/lib/class-content.json
//
// ⚠️ Sửa nội dung trang tuyển sinh xong thì phải chạy lại, không Mira nói theo bản cũ.

import { build } from "vite";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const TMP = resolve(ROOT, ".mira-build");

// Gom những thứ cần bóc vào một đầu vào tạm, rồi để Vite dịch TSX giúp.
const ENTRY = `
export { DOORS, STARTERS, CHAT_FAQ, MODALS, PRODUCTS, MIRA_CLASSES } from "./src/class-content";
export { FAQS } from "./src/classFaq";
`;

// HTML → chữ. Giữ xuống dòng ở chỗ ngắt khối để bài đọc còn ra hình hài.
function toText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(resolve(ROOT, ".mira-entry.tsx"), ENTRY);

  await build({
    root: ROOT,
    logLevel: "error",
    build: {
      ssr: resolve(ROOT, ".mira-entry.tsx"),
      outDir: TMP,
      emptyOutDir: true,
      rollupOptions: { external: ["react", "react-dom", "react/jsx-runtime"] },
    },
  });

  const m = await import(resolve(TMP, ".mira-entry.js"));
  // 09/2026: KHÔNG bóc chữ từ các modal Đệm hát / Tỉa nốt / Nâng cao nữa — chúng mô tả lộ trình nội bộ.
  // Mira chỉ giới thiệu các lớp đang tuyển (tên + dành cho ai) và bộ hỏi đáp public.
  const classes = m.MIRA_CLASSES.map((k) => `Lớp ${m.PRODUCTS[k].title}: ${m.PRODUCTS[k].desc}`);
  const faqPublic = m.FAQS.map((f) => `Hỏi: ${f.q}\nĐáp: ${f.a.map((b) => (typeof b === "string" ? b : Array.isArray(b) ? b.join("; ") : "")).filter(Boolean).join(" ")}`);
  const doors = m.DOORS.map(
    (d) => `Cửa vào "${d.dq}" → ${d.badge}. ${d.desc}`,
  );
  const starters = m.STARTERS.map((s) => `"${s.t}": ${s.d} (nút: ${s.cta})`);
  const faq = Object.entries(m.CHAT_FAQ).map(([q, a]) => `Hỏi: ${q}\nĐáp: ${toText(a)}`);
  const modals = Object.entries(m.MODALS).map(([k, v]) => `[${k}] ${toText(v)}`);

  const out = {
    generatedFrom: "cs-rhythm-editor · scripts/mira-content.mjs",
    classes,
    doors,
    starters,
    faqPublic,
    faq,
    modals,
  };

  writeFileSync(resolve(ROOT, "mira-content.json"), JSON.stringify(out, null, 2));
  rmSync(resolve(ROOT, ".mira-entry.tsx"), { force: true });
  rmSync(TMP, { recursive: true, force: true });

  console.log(
    `Đã bóc: ${classes.length} lớp · ${doors.length} cửa vào · ${starters.length} thẻ bắt đầu · ${faq.length}+${faqPublic.length} hỏi đáp · ` +
      `${modals.length} hộp nội dung → mira-content.json`,
  );
}

main().catch((e) => {
  console.error("Bóc nội dung hỏng:", e);
  process.exit(1);
});
