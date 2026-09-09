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
            Đọc bản nhạc theo phách
          </h1>
          <p style={{ color: "#52525b", lineHeight: 1.6, margin: 0 }}>
            Đưa bản MusicXML vào, thêm số phách và lưu bản nhạc để giảng dạy.
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
            {(hasCompound || irregularMeters.length > 0) && (
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
