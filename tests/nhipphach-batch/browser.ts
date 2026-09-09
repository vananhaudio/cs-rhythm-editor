import { runBatch, batchProgress } from "../../src/nhipphach/batch";
import type { BatchFile, BatchProcessor } from "../../src/nhipphach/batch";
import { zipBatch } from "../../src/nhipphach/batchZip";
import { SYSTEM_PRESETS, applyPreset } from "../../src/nhipphach/presets";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types";
import { exportScorePDF, loadScoreFonts } from "../../src/musicxml-beats/renderer/printExport";
import { unzipSync } from "fflate";
const results = document.querySelector("#results")!;
async function run() {
  const logs: string[] = [];
  let pass = 0, fail = 0;
  const check = (ok: boolean, m: string) => {
    ok ? pass++ : fail++;
    logs.push(`${ok ? "PASS" : "FAIL"} ${m}`);
    results.textContent = logs.join("\n");
  };
  const renderer = await createAnnotatedScoreRenderer();
  await loadScoreFonts();
  const proc: BatchProcessor = {
    async render(xml, s) { return renderer.render(xml, s); },
    async toBlob(score) { return exportScorePDF(score); },
  };
  const get = (d: string, n: string) =>
    fetch(`/tests/${d}/fixtures/${n}.musicxml`).then((r) => r.text());
  try {
    const lyrics = await get("musicxml-subdivision", "lyrics-harmony");
    const seven = await get("musicxml-irregular", "seven-plain");
    const settings = applyPreset(SYSTEM_PRESETS[3], { ...DEFAULT_SCORE_SETTINGS });
    // ── hiệu năng 1 / 10 / 50, đo cả tác vụ chặn dài nhất ──
    for (const [n, conc] of [[1, 2], [10, 2], [50, 1], [50, 2]] as const) {
      const files: BatchFile[] = Array.from({ length: n }, (_, i) => ({
        name: `bai-${String(i + 1).padStart(2, "0")}.musicxml`,
        xml: lyrics,
      }));
      let chanDaiNhat = 0, moc = performance.now(), nhipCapNhat = 0;
      const tick = () => {
        chanDaiNhat = Math.max(chanDaiNhat, performance.now() - moc);
        moc = performance.now();
      };
      const timer = setInterval(tick, 0);
      const t0 = performance.now();
      const items = await runBatch(files, proc, {
        settings,
        format: "pdf",
        concurrency: conc,
        onUpdate: () => nhipCapNhat++,
      });
      const ms = Math.round(performance.now() - t0);
      clearInterval(timer);
      const p = batchProgress(items);
      check(p.xong === n && p.loi === 0, `${n} file · song song ${conc}: ${p.xong}/${n} xong trong ${ms} ms (${Math.round(ms / n)} ms/bài)`);
      check(
        items.map((i) => i.fileName).join() === files.map((f) => f.name).join(),
        `${n} file: giữ đúng thứ tự`
      );
      // ĐO, không đặt ngưỡng tự nghĩ. Điều kiện thật là UI vẫn nhận được lượt:
      // tiến độ phải chảy đều trong lúc chạy, không im tới tận lúc xong.
      logs.push(`  ĐO ${n} file · song song ${conc}: chặn dài nhất ${Math.round(chanDaiNhat)} ms`);
      check(nhipCapNhat >= n, `${n} file · song song ${conc}: tiến độ cập nhật ${nhipCapNhat} lần trong lúc chạy`);
      if (n === 10 && conc === 2) {
        const zip = await zipBatch(items);
        const entries = Object.keys(unzipSync(new Uint8Array(await zip.blob.arrayBuffer())));
        check(entries.length === 10, `ZIP đủ ${entries.length}/10 file`);
        check(
          entries.sort().join() === files.map((f) => f.name.replace(".musicxml", ".pdf")).sort().join(),
          "ZIP giữ đúng tên gốc"
        );
        const pdf = new TextDecoder("latin1").decode(new Uint8Array(await items[0].blob!.arrayBuffer()));
        const mb = pdf.match(/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
        const mm = mb ? [+mb[3] / 72 * 25.4, +mb[4] / 72 * 25.4] : [0, 0];
        check(Math.abs(mm[0] - 210) < 0.5 && Math.abs(mm[1] - 297) < 0.5, `PDF A4 ${Math.round(mm[0])}×${Math.round(mm[1])} mm`);
        check(!/\/Subtype\s*\/Image/.test(pdf), "PDF vector, không raster");
        check(pdf.includes("FontFile2") && pdf.includes("ToUnicode"), "font nhúng + ToUnicode");
        check(pdf.includes("%PDF"), "PDF hợp lệ");
      }
    }
    // ── trùng tên ──
    const dup = await runBatch(
      [
        { name: "bai.musicxml", xml: lyrics },
        { name: "bai.xml", xml: lyrics },
        { name: "bai.musicxml", xml: lyrics },
      ],
      proc,
      { settings, format: "pdf" }
    );
    check(
      dup.map((i) => i.outputName).join() === "bai.pdf,bai-2.pdf,bai-3.pdf",
      `trùng tên → ${dup.map((i) => i.outputName).join(", ")}`
    );
    // ── một file lỗi giữa mẻ ──
    const mixed = await runBatch(
      [
        { name: "tot.musicxml", xml: lyrics },
        { name: "hong.musicxml", xml: "<hỏng>" },
        { name: "tot-2.musicxml", xml: lyrics },
      ],
      proc,
      { settings, format: "pdf" }
    );
    check(
      mixed.map((i) => i.status).join() === "done,error,done",
      "một file lỗi không chặn các file khác"
    );
    // ── 7/8 chưa khai cách chia ──
    const need = await runBatch([{ name: "bay-tam.musicxml", xml: seven }], proc, {
      settings: { ...settings, compoundCountingMode: "compound" },
      format: "pdf",
    });
    check(need[0].status === "needs-grouping" && !need[0].blob, "7/8 unresolved → cần chọn cách chia, không xuất file sai");
    const resumed = await runBatch([{ name: "bay-tam.musicxml", xml: seven }], proc, {
      settings: { ...settings, compoundCountingMode: "compound" },
      format: "pdf",
      groupingByItem: { "item-1": { byMeter: { "7/8": [3, 2, 2] } } },
    });
    check(resumed[0].status === "done" && !!resumed[0].blob, "chọn cách chia rồi chạy lại thì xong");
  } catch (e) {
    check(false, String(e));
  } finally {
    renderer.destroy();
  }
  logs.push(`TOTAL ${pass} PASS, ${fail} FAIL`);
  results.textContent = logs.join("\n");
  (window as unknown as Record<string, unknown>).__BATCH__ = { pass, fail, text: results.textContent };
}
document.querySelector("#run")!.addEventListener("click", run);
if (new URLSearchParams(location.search).has("auto")) run();
