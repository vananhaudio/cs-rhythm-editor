import {
  meterGrouping,
  allowedPartitions,
  isIrregularMeter,
  meterCode,
  partitionCode,
  SUPPORTED_COMPOUND,
  SUPPORTED_IRREGULAR,
  SUPPORTED_SIMPLE,
} from "../musicxml-beats/meterGrouping";
import {
  downloadBlob,
  exportScorePDF,
  exportScorePNG,
  exportSVGPages,
} from "../musicxml-beats/renderer/printExport";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createAnnotatedScoreRenderer } from "../musicxml-beats/renderer/verovioAdapter";
import { DEFAULT_SCORE_SETTINGS } from "../musicxml-beats/renderer/types";
import type {
  AnnotatedScore,
  ScoreSettings,
} from "../musicxml-beats/renderer/types";
import { downloadText } from "../musicxml-beats/renderer/svgExport";
import {
  SYSTEM_PRESETS,
  applyPreset,
  isSystemPreset,
  presetFromSettings,
  MAX_PRESET_NAME,
} from "../nhipphach/presets";
import type { NhipPhachPreset } from "../nhipphach/presets";
import { LocalPresetRepository } from "../nhipphach/presetRepository";
import {
  runBatch,
  batchProgress,
  EXTENSION,
} from "../nhipphach/batch";
import type {
  BatchFile,
  BatchFormat,
  BatchItem,
  BatchProcessor,
} from "../nhipphach/batch";
import { zipBatch } from "../nhipphach/batchZip";
import type { PresetRepository } from "../nhipphach/presetRepository";

const button: CSSProperties = {
  border: "1px solid #d4d4d8",
  background: "#fff",
  borderRadius: 10,
  padding: "11px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  minHeight: 44,
};
const control: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  fontSize: 13,
  color: "#52525b",
  minWidth: 130,
  flex: "1 1 140px",
};
export default function MusicXmlBeatsPage() {
  const [source, setSource] = useState<{ xml: string; name: string } | null>(
    null
  );
  const [settings, setSettings] = useState<ScoreSettings>(
    DEFAULT_SCORE_SETTINGS
  );
  const [exporting, setExporting] = useState(false);
  // ── Preset: chỉ thiết lập trình bày, không giữ bản nhạc, không giữ cách chia ──
  const presets = useRef<PresetRepository>(new LocalPresetRepository());
  const [presetList, setPresetList] = useState<NhipPhachPreset[]>([
    ...SYSTEM_PRESETS,
  ]);
  const [presetId, setPresetId] = useState<string>("");
  const [defaultPresetId, setDefaultPresetId] = useState<string | null>(null);
  const [presetNote, setPresetNote] = useState("");
  const [managing, setManaging] = useState(false);
  // ── Chế độ nhiều bài. Dùng LẠI đúng pipeline một bài, không có engine thứ hai ──
  const [tab, setTab] = useState<"one" | "many">("one");
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchFormat, setBatchFormat] = useState<BatchFormat>("pdf");
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchNote, setBatchNote] = useState("");
  const [batchGrouping, setBatchGrouping] = useState<Record<string, ScoreSettings["grouping"]>>({});
  const batchAbort = useRef<{ aborted: boolean }>({ aborted: false });
  const batchInput = useRef<HTMLInputElement>(null);
  const [pngScale, setPngScale] = useState<1 | 2>(2);
  const [score, setScore] = useState<AnnotatedScore | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const renderer = useRef<ReturnType<
    typeof createAnnotatedScoreRenderer
  > | null>(null);
  const fileInput = useRef<HTMLInputElement>(null),
    fileRequest = useRef(0);
  useEffect(
    () => () => {
      const current = renderer.current;
      renderer.current = null;
      current?.then((r) => r.destroy()).catch(() => {});
    },
    []
  );
  // Nạp preset khi mở trang. Có preset mặc định thì áp; KHÔNG có thì giữ nguyên
  // cấu hình cũ của công cụ, để thầy đang quen không thấy kết quả khác đi.
  useEffect(() => {
    let cancelled = false;
    presets.current
      .load()
      .then((store) => {
        if (cancelled) return;
        setPresetList(store.presets);
        setDefaultPresetId(store.defaultId);
        if (store.recovered)
          setPresetNote("Có preset lưu bị hỏng, đã bỏ qua. Công cụ vẫn dùng bình thường.");
        const preferred = store.presets.find((p) => p.id === store.defaultId);
        if (preferred) {
          setPresetId(preferred.id);
          setSettings((current) => applyPreset(preferred, current));
        }
      })
      .catch(() => {
        if (!cancelled)
          setPresetNote("Không đọc được preset đã lưu. Đang dùng cấu hình mặc định.");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  // Processor của batch = ĐÚNG pipeline một bài: cùng renderer, cùng bộ xuất.
  const batchProcessor: BatchProcessor = {
    async render(xml, s) {
      renderer.current ??= createAnnotatedScoreRenderer().catch((e) => {
        renderer.current = null;
        throw e;
      });
      return (await renderer.current).render(xml, s);
    },
    async toBlob(scoreOut, format) {
      if (format === "pdf") return exportScorePDF(scoreOut);
      if (format === "svg") return (await exportSVGPages(scoreOut)).blob;
      return (await exportScorePNG(scoreOut, pngScale)).blob;
    },
  };
  async function readBatchFiles(list: FileList | null) {
    if (!list?.length) return;
    const wanted = [...list].filter((f) => /\.(xml|musicxml)$/i.test(f.name));
    const bo = list.length - wanted.length;
    const files: BatchFile[] = [];
    for (const f of wanted) files.push({ name: f.name, xml: await f.text() });
    setBatchFiles(files);
    setBatchItems([]);
    setBatchGrouping({});
    setBatchNote(bo ? `Đã bỏ qua ${bo} file không phải .xml/.musicxml.` : "");
  }
  async function runBatchNow() {
    if (!batchFiles.length || batchRunning) return;
    setBatchRunning(true);
    setBatchNote("");
    batchAbort.current = { aborted: false };
    try {
      const items = await runBatch(batchFiles, batchProcessor, {
        settings,
        format: batchFormat,
        groupingByItem: batchGrouping,
        concurrency: 2,
        signal: batchAbort.current,
        onUpdate: (items) => setBatchItems([...items]),
      });
      setBatchItems(items);
      const p = batchProgress(items);
      setBatchNote(
        `Xong ${p.xong}/${p.tong}` +
          (p.canChon ? ` · ${p.canChon} bài cần chọn cách chia` : "") +
          (p.loi ? ` · ${p.loi} bài lỗi` : "")
      );
    } finally {
      setBatchRunning(false);
    }
  }
  async function downloadZip() {
    try {
      const out = await zipBatch(batchItems);
      downloadBlob(out.blob, out.name);
      setBatchNote(`Đã đóng gói ${out.count} bài vào ${out.name}.`);
    } catch (e) {
      setBatchNote(e instanceof Error ? e.message : "Không đóng gói được.");
    }
  }
  const pickBatchGrouping = (item: BatchItem, meter: string, groups: readonly number[]) =>
    setBatchGrouping((g) => ({
      ...g,
      [item.id]: {
        ...g[item.id],
        byMeter: { ...(g[item.id]?.byMeter ?? {}), [meter]: groups },
      },
    }));
  const refreshPresets = async (note = "") => {
    const store = await presets.current.load();
    setPresetList(store.presets);
    setDefaultPresetId(store.defaultId);
    setPresetNote(note);
  };
  const choosePreset = (id: string) => {
    setPresetId(id);
    setPresetNote("");
    const preset = presetList.find((p) => p.id === id);
    if (!preset) return;
    setBusy(!!source);
    setSettings((current) => applyPreset(preset, current));
    if (preset.exportFormat === "png" || preset.exportFormat === "pdf") return;
  };
  const currentPreset = presetList.find((p) => p.id === presetId) ?? null;
  async function guard(action: () => Promise<string>) {
    try {
      setPresetNote(await action());
    } catch (e) {
      // Lưu hỏng thì KHÔNG báo thành công giả; cấu hình trên UI giữ nguyên.
      setPresetNote(e instanceof Error ? e.message : "Không lưu được preset.");
    }
  }
  const saveAsPreset = () =>
    guard(async () => {
      const name = window.prompt("Tên preset:", "Preset của tôi")?.trim();
      if (!name) return "";
      const preset = presetFromSettings(name, settings);
      await presets.current.save(preset);
      await refreshPresets();
      setPresetId(preset.id);
      return `Đã lưu preset “${preset.name}”.`;
    });
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    setBusy(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        renderer.current ??= createAnnotatedScoreRenderer().catch((e) => {
          renderer.current = null;
          throw e;
        });
        const r = await renderer.current;
        if (cancelled) return;
        const rendered = r.render(source.xml, settings);
        if (!cancelled) {
          setScore(rendered);
          setBusy(false);
        }
      } catch (e) {
        if (!cancelled) {
          setScore(null);
          setError(e instanceof Error ? e.message : "Không đọc được bản nhạc.");
          setBusy(false);
        }
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, settings]);
  const update = (value: Partial<ScoreSettings>) => {
    setBusy(!!source);
    setSettings((s) => ({ ...s, ...value }));
  };
  async function readFile(file?: File) {
    if (!file) return;
    const request = ++fileRequest.current;
    setScore(null);
    setSource(null);
    setBusy(false);
    setError("");
    if (!/\.(xml|musicxml)$/i.test(file.name)) {
      setError("Hãy chọn file .xml hoặc .musicxml.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("MVP nhận file tối đa 5 MB.");
      return;
    }
    try {
      const xml = await file.text();
      if (request === fileRequest.current) setSource({ xml, name: file.name });
    } catch {
      if (request === fileRequest.current)
        setError("Không đọc được file đã chọn.");
    }
  }
  async function sample() {
    const request = ++fileRequest.current;
    setScore(null);
    setSource(null);
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/musicxml-beats/sample.musicxml");
      if (!response.ok) throw new Error("Không tải được file mẫu.");
      const xml = await response.text();
      if (request === fileRequest.current)
        setSource({ xml, name: "bai-mau.musicxml" });
    } catch (e) {
      if (request === fileRequest.current) {
        setError(String(e));
        setBusy(false);
      }
    }
  }
  async function exportPrint(format: "pdf" | "png" | "svg") {
    if (!score || busy || exporting) return;
    setExporting(true);
    setError("");
    try {
      if (format === "pdf")
        downloadBlob(await exportScorePDF(score), `${name}.pdf`);
      else if (format === "svg") {
        const output = await exportSVGPages(score);
        downloadBlob(output.blob, `${name}-svg.${output.extension}`);
      } else {
        const output = await exportScorePNG(score, pngScale);
        downloadBlob(output.blob, `${name}-${pngScale}x.${output.extension}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xuất được bản nhạc.");
    } finally {
      setExporting(false);
    }
  }
  // Describe the compound group from the meters actually in the score; never hard-code one meter.
  const compoundMeters = [
    ...new Map(
      (score?.beatMap.measures ?? [])
        .filter((m) => m.meter && meterGrouping(m.meter)?.type === "compound")
        .map((m) => [`${m.meter!.beats}/${m.meter!.beatType}`, m.meter!])
    ),
  ];
  const hasCompound = compoundMeters.length > 0;
  // ── Nhịp lẻ: cách chia KHÔNG suy được từ tử số nên người dùng phải chọn ──
  const irregularMeters = [
    ...new Map(
      (score?.beatMap.measures ?? [])
        .filter((m) => isIrregularMeter(m.meter))
        .map((m) => [meterCode(m.meter!), m.meter!])
    ),
  ];
  const fromSource = new Map(
    (score?.beatMap.measures ?? [])
      .filter((m) => m.groupingSource === "musicxml" && m.groups)
      .map((m) => [meterCode(m.meter!), partitionCode(m.groups!)])
  );
  const pickGrouping = (code: string, groups: readonly number[] | null) =>
    update({
      grouping: {
        ...settings.grouping,
        byMeter: Object.fromEntries(
          Object.entries({
            ...(settings.grouping?.byMeter ?? {}),
            [code]: groups,
          }).filter(([, v]) => !!v)
        ) as Record<string, readonly number[]>,
      },
    });
  const only = compoundMeters.length === 1 ? compoundMeters[0][1] : null;
  const series = (n: number) =>
    Array.from({ length: n }, (_, i) => i + 1).join(" ");
  const countingMeters = [...compoundMeters, ...irregularMeters];
  const soloCounting = countingMeters.length === 1 ? countingMeters[0][1] : null;
  const compoundLegend = soloCounting
    ? `Nhịp ${meterCode(soloCounting)}`
    : `Nhịp kép và nhịp lẻ (${countingMeters.map(([k]) => k).join(", ")})`;
  const pulseLabel = soloCounting
    ? `Theo ${soloCounting.beats} phách nhỏ: ${series(soloCounting.beats)}`
    : "Theo phách nhỏ (mỗi móc đơn)";
  const largeCount = soloCounting
    ? isIrregularMeter(soloCounting)
      ? (settings.grouping?.byMeter?.[meterCode(soloCounting)] ??
          (score?.beatMap.measures.find(
            (m) => m.meter && meterCode(m.meter) === meterCode(soloCounting)
          )?.groups ?? null))?.length ?? null
      : soloCounting.beats / 3
    : null;
  const beatLabel = largeCount
    ? `Theo ${largeCount} phách lớn: ${series(largeCount)}`
    : "Theo phách lớn (theo cách chia nhịp)";
  const hasSimple =
    !score ||
    score.beatMap.measures.some(
      (m) => meterGrouping(m.meter)?.type === "simple"
    );
  const name = (source?.name || "ban-nhac").replace(/\.(xml|musicxml)$/i, "");
  return (
    <main
      style={{
        minHeight: "100dvh",
        textAlign: "left",
        background: "#f4f4f5",
        color: "#18181b",
        fontFamily: "Arial, sans-serif",
        padding: "clamp(16px, 4vw, 40px)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <a
          href="/start"
          style={{ color: "#52525b", fontSize: 13, textDecoration: "none" }}
        >
          ← Về trang chính
        </a>
        <header style={{ margin: "24px 0" }}>
          <div
            style={{
              color: "#4338ca",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.2,
              marginBottom: 10,
            }}
          >
            THẦY VĂN ANH · CÔNG CỤ GIẢNG DẠY
          </div>
          <h1
            style={{
              fontSize: "clamp(26px, 4vw, 38px)",
              margin: "0 0 12px",
              letterSpacing: -1,
            }}
          >
            Đọc nhịp – phách
          </h1>
          <p style={{ color: "#52525b", lineHeight: 1.6, margin: 0 }}>
            Đưa bản nhạc vào, thêm số phách và lưu lại để giảng dạy.
          </p>
        </header>
        <section
          style={{
            background: "white",
            border: "1px solid #e4e4e7",
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              ref={fileInput}
              aria-label="Chọn file MusicXML"
              type="file"
              accept=".xml,.musicxml"
              style={{ display: "none" }}
              onChange={(e) => {
                void readFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {(["one", "many"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  ...button,
                  background: tab === t ? "#4338ca" : "#fff",
                  color: tab === t ? "#fff" : "#18181b",
                  borderColor: tab === t ? "#4338ca" : "#d4d4d8",
                }}
              >
                {t === "one" ? "Một bài" : "Nhiều bài"}
              </button>
            ))}
            <span style={{ width: 12 }} />
            <button
              style={{
                ...button,
                background: "#4338ca",
                color: "white",
                borderColor: "#4338ca",
              }}
              onClick={() => fileInput.current?.click()}
            >
              Chọn MusicXML
            </button>
            <button style={button} onClick={() => void sample()}>
              Dùng file mẫu
            </button>
            {tab === "many" && (
              <>
                <input
                  ref={batchInput}
                  type="file"
                  accept=".xml,.musicxml,text/xml,application/xml"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => void readBatchFiles(e.target.files)}
                />
                <button
                  style={{ ...button, borderColor: "#4338ca", color: "#4338ca" }}
                  onClick={() => batchInput.current?.click()}
                >
                  Chọn nhiều file
                </button>
              </>
            )}
            <span
              style={{
                fontSize: 13,
                color: "#71717a",
                overflowWrap: "anywhere",
              }}
            >
              {source?.name || ".xml / .musicxml · tối đa 5 MB"}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              marginTop: 18,
              paddingTop: 16,
              borderTop: "1px solid #e4e4e7",
            }}
          >
            <label style={{ fontWeight: 600, fontSize: 14 }} htmlFor="preset">
              Preset
            </label>
            <select
              id="preset"
              value={presetId}
              onChange={(e) => choosePreset(e.target.value)}
              style={{ ...button, fontWeight: 500, minWidth: 190 }}
            >
              <option value="">Cấu hình hiện tại</option>
              {presetList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.id === defaultPresetId ? " ★" : ""}
                </option>
              ))}
            </select>
            <button style={button} onClick={() => void saveAsPreset()}>
              Lưu thành preset
            </button>
            <button style={button} onClick={() => setManaging((v) => !v)}>
              {managing ? "Đóng quản lý" : "Quản lý"}
            </button>
            {presetNote && (
              <span style={{ fontSize: 12, color: "#b45309" }}>{presetNote}</span>
            )}
          </div>
          {tab === "many" && (
            <div
              style={{
                marginTop: 18,
                paddingTop: 16,
                borderTop: "1px solid #e4e4e7",
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void readBatchFiles(e.dataTransfer.files);
              }}
            >
              <div
                style={{
                  border: "2px dashed #d4d4d8",
                  borderRadius: 12,
                  padding: "18px 16px",
                  textAlign: "center",
                  color: "#71717a",
                  fontSize: 14,
                }}
              >
                Thả file MusicXML vào đây
                <div style={{ fontWeight: 600, color: "#18181b", marginTop: 6 }}>
                  {batchFiles.length
                    ? `${batchFiles.length} file đã chọn`
                    : "Chưa chọn file nào"}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  alignItems: "center",
                  marginTop: 14,
                }}
              >
                <label style={{ fontSize: 14, fontWeight: 600 }}>Định dạng</label>
                <select
                  value={batchFormat}
                  onChange={(e) => setBatchFormat(e.target.value as BatchFormat)}
                  style={{ ...button, fontWeight: 500 }}
                >
                  <option value="pdf">PDF</option>
                  <option value="svg">SVG</option>
                  <option value="png">PNG</option>
                </select>
                <button
                  style={{
                    ...button,
                    background: "#4338ca",
                    color: "#fff",
                    borderColor: "#4338ca",
                  }}
                  disabled={!batchFiles.length || batchRunning}
                  onClick={() => void runBatchNow()}
                >
                  {batchRunning ? "Đang xử lý…" : "Xử lý tất cả"}
                </button>
                {batchRunning && (
                  <button
                    style={button}
                    onClick={() => {
                      batchAbort.current.aborted = true;
                    }}
                  >
                    Dừng
                  </button>
                )}
                {!!batchItems.length && (
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {batchProgress(batchItems).xong} / {batchItems.length}
                  </span>
                )}
                <button
                  style={button}
                  disabled={!batchItems.some((i) => i.status === "done")}
                  onClick={() => void downloadZip()}
                >
                  Xuất ZIP
                </button>
                {batchNote && (
                  <span style={{ fontSize: 12, color: "#b45309" }}>{batchNote}</span>
                )}
              </div>
              {!!batchItems.length && (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "14px 0 0",
                    fontSize: 13,
                    maxHeight: 320,
                    overflowY: "auto",
                  }}
                >
                  {batchItems.map((item) => (
                    <li
                      key={item.id}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                        alignItems: "center",
                        padding: "7px 0",
                        borderBottom: "1px solid #f4f4f5",
                      }}
                    >
                      <span style={{ minWidth: 230, overflowWrap: "anywhere" }}>
                        {item.fileName}
                      </span>
                      <span
                        style={{
                          color:
                            item.status === "done"
                              ? "#16a34a"
                              : item.status === "error"
                              ? "#b91c1c"
                              : item.status === "needs-grouping"
                              ? "#b45309"
                              : "#71717a",
                        }}
                      >
                        {item.status === "done"
                          ? `✓ Hoàn tất · ${item.outputName}`
                          : item.status === "error"
                          ? `✕ ${item.error ?? "Lỗi"}`
                          : item.status === "needs-grouping"
                          ? `⚠ Cần chọn cách chia ${item.needs?.map((n) => n.meter).join(", ")}`
                          : item.status === "processing"
                          ? "… đang xử lý"
                          : "· chờ"}
                      </span>
                      {item.status === "needs-grouping" &&
                        item.needs?.map((need) =>
                          need.options.map((groups) => (
                            <button
                              key={`${item.id}-${need.meter}-${groups.join("+")}`}
                              style={{ ...button, padding: "5px 10px", minHeight: 32 }}
                              onClick={() => pickBatchGrouping(item, need.meter, groups)}
                            >
                              {groups.join(" + ")}
                              {batchGrouping[item.id]?.byMeter?.[need.meter]?.join("+") ===
                              groups.join("+")
                                ? " ✓"
                                : ""}
                            </button>
                          ))
                        )}
                    </li>
                  ))}
                </ul>
              )}
              {batchItems.some((i) => i.status === "needs-grouping") && (
                <p style={{ fontSize: 12, color: "#71717a", marginTop: 10 }}>
                  Chọn cách chia cho từng bài ở trên rồi bấm “Xử lý tất cả” lần nữa.
                  Công cụ không tự đoán cách chia.
                </p>
              )}
            </div>
          )}
          {managing && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
                marginTop: 12,
                fontSize: 13,
              }}
            >
              <span style={{ color: "#71717a" }}>
                {currentPreset
                  ? `“${currentPreset.name}”${currentPreset.system ? " · preset hệ thống" : ""}`
                  : "Chưa chọn preset nào"}
              </span>
              <button
                style={button}
                disabled={!currentPreset}
                onClick={() =>
                  void guard(async () => {
                    const copy = await presets.current.duplicate(presetId);
                    await refreshPresets();
                    setPresetId(copy.id);
                    return `Đã nhân bản thành “${copy.name}”.`;
                  })
                }
              >
                Nhân bản
              </button>
              <button
                style={button}
                disabled={!currentPreset || currentPreset.system}
                onClick={() =>
                  void guard(async () => {
                    const next = window
                      .prompt("Tên mới:", currentPreset?.name ?? "")
                      ?.trim();
                    if (!next) return "";
                    await presets.current.rename(presetId, next.slice(0, MAX_PRESET_NAME));
                    await refreshPresets();
                    return `Đã đổi tên thành “${next}”.`;
                  })
                }
              >
                Đổi tên
              </button>
              <button
                style={button}
                disabled={!currentPreset}
                onClick={() =>
                  void guard(async () => {
                    const next = defaultPresetId === presetId ? null : presetId;
                    await presets.current.setDefault(next);
                    await refreshPresets();
                    return next
                      ? "Đã đặt làm preset mặc định."
                      : "Đã bỏ preset mặc định.";
                  })
                }
              >
                {defaultPresetId === presetId ? "Bỏ mặc định" : "Đặt làm mặc định"}
              </button>
              <button
                style={{ ...button, color: "#b91c1c" }}
                disabled={!currentPreset || isSystemPreset(presetId)}
                onClick={() =>
                  void guard(async () => {
                    const gone = currentPreset?.name ?? "";
                    await presets.current.remove(presetId);
                    await refreshPresets();
                    setPresetId("");
                    return `Đã xoá preset “${gone}”.`;
                  })
                }
              >
                Xoá
              </button>
              <span style={{ color: "#a1a1aa" }}>
                Preset hệ thống không xoá và không đổi tên được — hãy nhân bản.
              </span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 24,
              alignItems: "center",
              marginTop: 22,
              paddingTop: 20,
              borderTop: "1px solid #f0f0f2",
            }}
          >
            {hasSimple && (
              <fieldset
                style={{
                  border: 0,
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <legend
                  style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}
                >
                  Hiển thị nhịp
                </legend>
                {(
                  [
                    ["off", "Không hiện"],
                    ["beats", "1 2 3 4"],
                    ["eighths", "1 & 2 & 3 & 4 &"],
                    ["sixteenths", "1 e & a"],
                  ] as const
                ).map(([level, label]) => (
                  <label
                    key={level}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      minHeight: 44,
                      fontSize: 14,
                    }}
                  >
                    <input
                      type="radio"
                      name="counting-level"
                      value={level}
                      checked={
                        level === "off"
                          ? !settings.showBeats
                          : settings.showBeats &&
                            (settings.countingLevel || "beats") === level
                      }
                      onChange={() =>
                        update(
                          level === "off"
                            ? { showBeats: false }
                            : { showBeats: true, countingLevel: level }
                        )
                      }
                      style={{ accentColor: "#4338ca" }}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            )}
            {irregularMeters.map(([code, meter]) => {
              const chosen = settings.grouping?.byMeter?.[code];
              const source = fromSource.get(code);
              const active = chosen ? partitionCode(chosen) : source ?? null;
              return (
                <fieldset
                  key={code}
                  style={{
                    border: 0,
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    gap: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <legend
                    style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}
                  >
                    Cách chia nhịp {code}
                  </legend>
                  {(allowedPartitions(meter) ?? []).map((groups) => {
                    const key = partitionCode(groups);
                    return (
                      <label
                        key={key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          minHeight: 44,
                          fontSize: 14,
                        }}
                      >
                        <input
                          type="radio"
                          name={`grouping-${code}`}
                          checked={active === key}
                          onChange={() => pickGrouping(code, groups)}
                          style={{ accentColor: "#4338ca" }}
                        />
                        {groups.join(" + ")}
                        {source === key && !chosen && (
                          <span style={{ fontSize: 12, color: "#16a34a" }}>
                            · theo bản nhạc
                          </span>
                        )}
                      </label>
                    );
                  })}
                  {chosen && source && partitionCode(chosen) !== source && (
                    <span style={{ fontSize: 12, color: "#b45309" }}>
                      Đang đè cách chia {source} ghi trong bản nhạc.{" "}
                      <button
                        type="button"
                        onClick={() => pickGrouping(code, null)}
                        style={{
                          border: 0,
                          background: "none",
                          padding: 0,
                          color: "#4338ca",
                          textDecoration: "underline",
                          cursor: "pointer",
                          font: "inherit",
                        }}
                      >
                        Dùng lại bản nhạc
                      </button>
                    </span>
                  )}
                  {!active && (
                    <span style={{ fontSize: 12, color: "#b45309" }}>
                      Bản nhạc không ghi cách chia. Phách nhỏ dùng được ngay;
                      chọn một cách chia để đếm phách lớn.
                    </span>
                  )}
                </fieldset>
              );
            })}
            {/* Ở chế độ nhiều bài chưa có bản nhạc nào để suy ra nhịp, nhưng mẻ file
                vẫn có thể chứa nhịp kép/lẻ — nên luôn cho chọn cách đếm ở đó. */}
            {(hasCompound || irregularMeters.length > 0 || tab === "many") && (
              <fieldset
                style={{
                  border: 0,
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <legend
                  style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}
                >
                  {compoundLegend}
                </legend>
                {(
                  [
                    ["off", "Không hiện"],
                    ["pulses", pulseLabel],
                    ["compound", beatLabel],
                  ] as const
                ).map(([mode, label]) => (
                  <label
                    key={mode}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      minHeight: 44,
                      fontSize: 14,
                    }}
                  >
                    <input
                      type="radio"
                      name="compound-counting"
                      checked={
                        mode === "off"
                          ? !settings.showBeats
                          : settings.showBeats &&
                            (settings.compoundCountingMode || "pulses") === mode
                      }
                      onChange={() =>
                        update(
                          mode === "off"
                            ? { showBeats: false }
                            : { showBeats: true, compoundCountingMode: mode }
                        )
                      }
                      style={{ accentColor: "#4338ca" }}
                    />
                    {label}
                  </label>
                ))}
                {hasSimple && (
                  <span style={{ fontSize: 12, color: "#71717a" }}>
                    Bản đổi nhịp: mỗi ô dùng nhóm đếm tương ứng. “Không hiện”
                    tắt toàn bản.
                  </span>
                )}
              </fieldset>
            )}
            <label style={control}>
              Màu số phách
              <input
                aria-label="Màu số phách"
                type="color"
                value={settings.color}
                onChange={(e) => update({ color: e.target.value })}
                style={{
                  width: 64,
                  height: 36,
                  border: "1px solid #d4d4d8",
                  borderRadius: 6,
                  background: "white",
                }}
              />
            </label>
            <label style={control}>
              Cỡ chữ · {settings.sizePt} pt
              <input
                aria-label="Cỡ chữ"
                type="range"
                min={5}
                max={14}
                step={1}
                value={settings.sizePt}
                onChange={(e) => update({ sizePt: Number(e.target.value) })}
                style={{ accentColor: "#4338ca", width: "100%" }}
              />
            </label>
            <label style={control}>
              Khoảng cách dưới khuông · {settings.distance}
              <input
                aria-label="Khoảng cách dưới khuông"
                type="range"
                min={0}
                max={8}
                step={1}
                value={settings.distance}
                onChange={(e) => update({ distance: Number(e.target.value) })}
                style={{ accentColor: "#4338ca", width: "100%" }}
              />
            </label>
          </div>
        </section>
        {error && (
          <div
            role="alert"
            style={{
              padding: 16,
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 12,
              marginBottom: 16,
              overflowWrap: "anywhere",
            }}
          >
            {error}
          </div>
        )}
        {score && score.diagnostics.length > 0 && (
          <aside
            aria-label="Chẩn đoán bản nhạc"
            style={{
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: 12,
              padding: 18,
              marginBottom: 18,
            }}
          >
            <strong>Có {score.diagnostics.length} điểm cần kiểm tra</strong>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>
              Ô chưa xác định đúng sẽ không gắn số phách. Phần bản nhạc còn lại
              vẫn hiển thị.
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                maxHeight: 220,
                overflow: "auto",
              }}
            >
              {score.diagnostics.map((d, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 13,
                    marginTop: 10,
                    overflowWrap: "anywhere",
                  }}
                >
                  <strong>{d.code}</strong> · {d.sourceId}
                  <br />
                  {d.message}
                </li>
              ))}
            </ul>
          </aside>
        )}
        <section
          aria-label="Xem trước bản nhạc"
          style={{
            border: "1px solid #e4e4e7",
            borderRadius: 16,
            overflow: "hidden",
            background: "white",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e4e4e7",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <strong>Xuất bản nhạc · A4</strong>
              <label style={{ marginLeft: 12, fontSize: 13 }}>
                Hướng{" "}
                <select
                  aria-label="Hướng giấy"
                  value={settings.orientation || "portrait"}
                  onChange={(e) =>
                    update({
                      orientation: e.target.value as "portrait" | "landscape",
                    })
                  }
                  style={{ padding: 8 }}
                >
                  <option value="portrait">Dọc</option>
                  <option value="landscape">Ngang</option>
                </select>
              </label>
              <span style={{ fontSize: 12, marginLeft: 12 }}>
                Lề mặc định · 15 mm (dưới 18 mm)
              </span>
              <span
                role="status"
                style={{ fontSize: 13, color: "#71717a", marginLeft: 12 }}
              >
                {busy
                  ? "Đang khắc bản nhạc…"
                  : score
                  ? `${score.pages.length} trang · ${score.anchors.length} nhãn đếm`
                  : "Sẵn sàng"}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                style={{
                  ...button,
                  color: "#52525b",
                  opacity: !score || busy ? 0.5 : 1,
                }}
                disabled={!score || busy || exporting}
                onClick={() =>
                  score &&
                  downloadText(
                    JSON.stringify(score.beatMap, null, 2),
                    `${name}.beat-map.json`,
                    "application/json"
                  )
                }
              >
                Tải beat-map JSON
              </button>
              <button
                style={{
                  ...button,
                  background: "#18181b",
                  color: "white",
                  opacity: !score || busy ? 0.5 : 1,
                }}
                disabled={!score || busy || exporting}
                onClick={() => void exportPrint("svg")}
              >
                Xuất SVG
              </button>
              <button
                style={button}
                disabled={!score || busy || exporting}
                onClick={() => void exportPrint("pdf")}
              >
                Xuất PDF
              </button>
              <select
                aria-label="Độ phân giải PNG"
                value={pngScale}
                onChange={(e) => setPngScale(Number(e.target.value) as 1 | 2)}
                style={{ ...button }}
              >
                <option value={1}>PNG 1x</option>
                <option value={2}>PNG 2x</option>
              </select>
              <button
                style={button}
                disabled={!score || busy || exporting}
                onClick={() => void exportPrint("png")}
              >
                Xuất PNG
              </button>
              {exporting && <span role="status">Đang xuất bản nhạc…</span>}
            </div>
          </div>
          <div
            aria-busy={busy}
            style={{
              padding: 16,
              minHeight: 300,
              maxHeight: "75vh",
              overflow: "auto",
              background: score ? "#eaeaee" : "white",
              opacity: busy ? 0.55 : 1,
            }}
          >
            {score ? (
              score.pages.map((p) => (
                <figure
                  key={p.number}
                  style={{
                    margin: "0 auto 20px",
                    background: "white",
                    maxWidth: Math.min(940, Math.max(560, p.width * 2)),
                    minWidth: 560,
                    boxShadow: "0 2px 8px #0000000d",
                  }}
                >
                  <img
                    alt={`Trang ${p.number} bản nhạc${
                      settings.showBeats ? " có số phách" : ""
                    }`}
                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                      p.svg
                    )}`}
                    style={{ display: "block", width: "100%", height: "auto" }}
                  />
                  <figcaption
                    style={{
                      padding: 12,
                      textAlign: "center",
                      fontSize: 12,
                      color: "#71717a",
                    }}
                  >
                    Trang {p.number}
                  </figcaption>
                </figure>
              ))
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "75px 16px",
                  color: "#71717a",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 16 }}>𝄞</div>
                <p>Chọn bản nhạc để bắt đầu.</p>
                <p style={{ fontSize: 13 }}>
                  Hỗ trợ {SUPPORTED_SIMPLE.join(", ")}, nhịp kép{" "}
                  {SUPPORTED_COMPOUND.join(", ")} và nhịp lẻ{" "}
                  {SUPPORTED_IRREGULAR.join(", ")}.
                </p>
              </div>
            )}
          </div>
        </section>
        <p style={{ fontSize: 12, color: "#71717a", lineHeight: 1.7 }}>
          File được xử lý trên thiết bị. SVG giữ đường nét khi phóng to và là
          bản nguồn chung cho PDF vector và PNG. PNG 1x: 96 dpi; 2x: 192 dpi.
          Nhiều trang PNG được đóng ZIP.
        </p>
      </div>
    </main>
  );
}
