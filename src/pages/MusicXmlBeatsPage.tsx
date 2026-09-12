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
import { memo, useEffect, useMemo, useRef, useState } from "react";
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
  openPresetRepository,
  stateFromStore,
  SYNC_LABEL,
} from "../nhipphach/presetGateway";
import type { SyncState } from "../nhipphach/presetGateway";
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
import {
  buildSingleJob,
  buildBatchJob,
  applyJobSettings,
  collectItemMeta,
} from "../nhipphach/jobs";
import type { JobRecord } from "../nhipphach/jobs";
import { giuLuot, traLuot } from "../nhipphach/motLuot";

/**
 * Một trang SVG thật trong DOM (chế độ chọn nốt). Memo theo CHUỖI svg: chọn nốt
 * chỉ đổi class trên phần tử đang có, React không dựng lại cây SVG — bản 14
 * trang cũng tô sáng tức thì. Chuỗi đã qua cleanSVG (không script/handler).
 */
const SvgPage = memo(function SvgPage({
  svg,
  width,
  height,
}: {
  svg: string;
  width: number;
  height: number;
}) {
  return (
    <div
      className="np-svg"
      style={{ aspectRatio: `${width} / ${height}` }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});
import { openScoreLibrary } from "../nhipphach/libraryGateway";
import type { ScoreLibrary } from "../nhipphach/libraryRepository";
import { ScoreLibraryPanel } from "../nhipphach/ScoreLibraryPanel";
import type { LibraryOpenEvent } from "../nhipphach/ScoreLibraryPanel";
import { readScoreMetadata, readPrimaryMeter } from "../nhipphach/scoreMetadata";
import { resolveNoteElement, describeNote } from "../nhipphach/noteSelection";
import type { SourceNote } from "../musicxml-beats/sourceTags";
import { parseMusicXML } from "../musicxml-beats/parser";
import type { CSSProperties } from "react";
import { NP_CSS, NP_SCOPE } from "../nhipphach/theme";
import { can, NO_CAPS, type CapState } from "../nhipphach/capabilities";
import type { NhipPhachJobRepository, JobSummary, JobDetail } from "../nhipphach/jobRepository";
import type { PresetRepository } from "../nhipphach/presetRepository";

/** `beats/pulses` là chữ máy. Lịch sử phải nói bằng thứ tiếng thầy dùng trên màn hình. */
function cachDem(ma: string) {
  const [muc, kep] = ma.split("/");
  const mucViet: Record<string, string> = {
    off: "Không hiện",
    beats: "1 2 3 4",
    eighths: "1 & 2 & 3 & 4 &",
    sixteenths: "1 e & a",
  };
  const kepViet: Record<string, string> = {
    pulses: "phách nhỏ",
    compound: "phách lớn",
  };
  return [mucViet[muc] ?? muc, kepViet[kep] ?? kep].filter(Boolean).join(" · ");
}

/** "Hôm nay 18:30" cho job trong ngày, ngày tháng cho job cũ hơn. */
function khiNao(iso: string) {
  const d = new Date(iso);
  const gio = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const homNay = new Date().toDateString() === d.toDateString();
  return homNay ? `Hôm nay ${gio}` : `${d.toLocaleDateString("vi-VN")} ${gio}`;
}
/**
 * Mức giao diện. CHỈ là chuyện trình bày: không vào preset, không vào lịch sử,
 * không đụng tới thiết lập nhạc nên đổi qua lại không bao giờ làm khác file xuất ra.
 */
const KHOA_MUC = "nhipphach:giao-dien";
function mucDaLuu(): boolean {
  try {
    return localStorage.getItem(KHOA_MUC) === "nang-cao";
  } catch {
    // Trình duyệt chặn localStorage thì cứ mở ở mức Cơ bản, không phải lỗi.
    return false;
  }
}
function nhoMuc(nangCao: boolean) {
  try {
    localStorage.setItem(KHOA_MUC, nangCao ? "nang-cao" : "co-ban");
  } catch {
    /* không nhớ được thì thôi */
  }
}

/**
 * `rong` = vừa chiều rộng khung · `khung` = trọn một trang trong khung ·
 * `tay` = mức phóng thầy tự chỉnh.
 */
type CheXem = "rong" | "khung" | "tay";
const ZOOM_MIN = 50;
const ZOOM_MAX = 300;
const ZOOM_BUOC = 25;

/** Một dòng thông báo: loại quyết định màu và biểu tượng. */
type Note = { kind: "ok" | "info" | "warn" | "error"; text: string } | null;
const NOTE_ICON: Record<"ok" | "info" | "warn" | "error", string> = {
  ok: "✓",
  info: "ℹ",
  warn: "⚠",
  error: "✕",
};

export default function MusicXmlBeatsPage({
  caps = NO_CAPS,
}: {
  /** Quyền tính năng, do cổng phía ngoài đọc từ máy chủ rồi truyền xuống. */
  caps?: CapState;
}) {
  const [source, setSource] = useState<{ xml: string; name: string } | null>(
    null
  );
  const [settings, setSettings] = useState<ScoreSettings>(
    DEFAULT_SCORE_SETTINGS
  );
  const [exporting, setExporting] = useState(false);
  const [keoVao, setKeoVao] = useState(false);
  // ── Chọn nốt (Giai đoạn Nội dung 2) — chỉ là selection, KHÔNG ghi gì ─────
  const [chonNot, setChonNot] = useState(false);
  const [notChon, setNotChon] = useState<
    | { kind: "note"; note: SourceNote }
    | { kind: "unresolved"; svgId: string }
    | null
  >(null);
  const prevBody = useRef<HTMLDivElement>(null);
  // ── Thư viện bài hát ────────────────────────────────────────────────────
  const thuVien = useRef<ScoreLibrary | null>(null);
  const [coThuVien, setCoThuVien] = useState(false);
  const [moThuVien, setMoThuVien] = useState(false);
  const [dangLuuBai, setDangLuuBai] = useState(false);
  const [thuVienNote, setThuVienNote] = useState("");
  /** Đã có bản nhạc giống hệt trong kho: hỏi rõ, không tự quyết thay thầy. */
  const [trungLap, setTrungLap] = useState<{
    scoreId: string;
    title: string;
    versionNumber: number;
  } | null>(null);
  /**
   * Bản nhạc đang mở đến từ thư viện nào. `null` nghĩa là file cục bộ chưa lưu.
   * Mở một phiên bản cũ KHÔNG biến nó thành bản hiện hành — cờ `laHienHanh`
   * giữ đúng sự thật đó để giao diện không nói dối.
   */
  const [baiTrongKho, setBaiTrongKho] = useState<{
    scoreId: string;
    versionNumber: number;
    laHienHanh: boolean;
  } | null>(null);
  /**
   * Cách xem bản nhạc. CHỈ ảnh hưởng màn hình — file xuất ra luôn là A4 thật,
   * dựng từ cùng một SVG, không dính gì tới mức phóng đang xem.
   */
  const [xem, setXem] = useState<{ che: CheXem; pct: number }>({
    che: "rong",
    pct: 100,
  });
  const [thuGon, setThuGon] = useState(false);
  // Người mở trang lần đầu luôn thấy mức Cơ bản; thầy dùng quen thì máy nhớ hộ.
  const [muonNangCao, setMuonNangCao] = useState(mucDaLuu);
  // Không có quyền `advanced` thì không có mức Nâng cao, dù máy có nhớ gì đi nữa.
  const choNangCao = can(caps, "advanced");
  const nangCao = muonNangCao && choNangCao;
  const choBatch = can(caps, "batch");
  const choPreset = can(caps, "presets");
  const choHistory = can(caps, "history");
  const choThuVien = can(caps, "library.read");
  const choLuuThuVien = can(caps, "library.save");
  const choQuanLyThuVien = can(caps, "library.manage");
  // Chọn nốt là chức năng biên tập: chỉ ở mức Nâng cao và chỉ khi Admin cấp quyền.
  const choChonNot = nangCao && can(caps, "score.edit");
  const choXuat = {
    pdf: can(caps, "export.pdf"),
    png: can(caps, "export.png"),
    svg: can(caps, "export.svg"),
    beatmap: can(caps, "export.beatmap"),
  } as const;
  // Chế độ nhiều bài dùng chung quyền xuất với chế độ một bài: mẻ KHÔNG phải
  // một cửa hậu để lấy định dạng bị tắt. Thiếu dòng này thì học viên bị tắt SVG
  // vẫn chọn SVG trong ô Định dạng rồi tải ZIP đầy .svg — đã xảy ra thật.
  const DINH_DANG_ME: readonly { id: BatchFormat; ten: string }[] = [
    { id: "pdf", ten: "PDF" },
    { id: "svg", ten: "SVG" },
    { id: "png", ten: "PNG" },
  ];
  const dinhDangChoPhep = DINH_DANG_ME.filter((d) => choXuat[d.id]);
  const choDinhDangMe = (f: BatchFormat) => choXuat[f];
  // Chốt đồng bộ: xem src/nhipphach/motLuot.ts.
  const dangXuat = useRef(false);
  // ── Preset: chỉ thiết lập trình bày, không giữ bản nhạc, không giữ cách chia ──
  const presets = useRef<PresetRepository>(new LocalPresetRepository());
  const [presetList, setPresetList] = useState<NhipPhachPreset[]>([
    ...SYSTEM_PRESETS,
  ]);
  const [presetId, setPresetId] = useState<string>("");
  const [defaultPresetId, setDefaultPresetId] = useState<string | null>(null);
  /**
   * Thông báo mang theo LOẠI, không chỉ chữ: cùng một dòng chữ mà lúc là việc
   * tốt lúc là việc hỏng thì không được vẽ giống nhau (mục 15 của đặc tả).
   */
  const [presetNote, setPresetNote] = useState<Note>(null);
  const [managing, setManaging] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("local");
  // ── Lịch sử xử lý. CHỈ metadata; ghi hỏng KHÔNG được làm hỏng việc xuất file ──
  const jobsRepo = useRef<NhipPhachJobRepository | null>(null);
  const [recent, setRecent] = useState<JobSummary[]>([]);
  const [openJob, setOpenJob] = useState<JobDetail | null>(null);
  const [historyNote, setHistoryNote] = useState<Note>(null);
  // ── Chế độ nhiều bài. Dùng LẠI đúng pipeline một bài, không có engine thứ hai ──
  const [tab, setTab] = useState<"one" | "many">("one");
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchFormat, setBatchFormat] = useState<BatchFormat>("pdf");
  // Định dạng ĐANG CÓ HIỆU LỰC. Nếu cái đang chọn vừa bị Admin tắt thì lùi về
  // cái còn được phép, để ô chọn và việc chạy không nói hai chuyện khác nhau.
  const dinhDangMe: BatchFormat = choDinhDangMe(batchFormat)
    ? batchFormat
    : dinhDangChoPhep[0]?.id ?? batchFormat;
  const [batchRunning, setBatchRunning] = useState(false);
  const dangChayMe = useRef(false);
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
  // Mở kho bài hát khi người dùng có quyền đọc. Không quyền thì không mở kết nối.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const lib = await openScoreLibrary({ read: choThuVien });
      if (cancelled) return;
      thuVien.current = lib;
      setCoThuVien(lib !== null);
    })();
    return () => {
      cancelled = true;
    };
  }, [choThuVien]);

  /** Lưu bản nhạc đang mở thành một phiên bản mới trong kho. */
  async function luuVaoThuVien(boQuaTrung = false) {
    const lib = thuVien.current;
    if (!lib || !source || dangLuuBai) return;
    setDangLuuBai(true);
    setThuVienNote("");
    setTrungLap(null);
    try {
      // Nạp lại đúng file cũ thì nói thẳng và HỎI, không lặng lẽ tạo bài trùng
      // mà cũng không tự ý từ chối: lưu thành bài mới là quyền của thầy.
      if (!baiTrongKho && !boQuaTrung) {
        const trung = await lib.findDuplicate(source.xml);
        if (trung) {
          setTrungLap(trung);
          return;
        }
      }
      const meta = readScoreMetadata(source.xml, source.name);
      const ketQua = await lib.save({
        scoreId: baiTrongKho?.scoreId,
        title: meta.title,
        composer: meta.composer,
        lyricist: meta.lyricist,
        sourceFilename: source.name,
        primaryMeter: readPrimaryMeter(source.xml),
        pageCount: score?.pages.length ?? null,
        xml: source.xml,
      });
      setBaiTrongKho({
        scoreId: ketQua.scoreId,
        versionNumber: ketQua.versionNumber,
        laHienHanh: true,
      });
      setThuVienNote(
        ketQua.createdScore
          ? `Đã lưu “${meta.title}” vào thư viện.`
          : `Đã lưu phiên bản v${ketQua.versionNumber}.`
      );
    } catch (e) {
      setThuVienNote(e instanceof Error ? e.message : "Chưa lưu được vào thư viện.");
    } finally {
      setDangLuuBai(false);
    }
  }

  /** Thời điểm bắt đầu của từng nốt nguồn, lấy từ chính parser — để hiện "Phách". */
  const onsetTheoPath = useMemo(() => {
    const m = new Map<string, Parameters<typeof describeNote>[2]>();
    if (!source) return m;
    try {
      for (const p of parseMusicXML(source.xml).parts)
        for (const ms of p.measures)
          for (const ev of ms.events) m.set(ev.source.path, ev.onset);
    } catch {
      /* nguồn hỏng thì panel chỉ thiếu ô Phách */
    }
    return m;
  }, [source]);

  /**
   * Click trên bản nhạc → nốt nguồn, qua ID mà Verovio đã giữ nguyên. Không có
   * toạ độ nào ở đây; toạ độ chỉ để vẽ. Không khắc lại, không ghi gì.
   */
  function onClickBanNhac(e: React.MouseEvent<HTMLDivElement>) {
    if (!chonNot || !score) return;
    const r = resolveNoteElement(e.target as unknown as Parameters<typeof resolveNoteElement>[0], score.noteIndex);
    if (r.kind === "note") setNotChon({ kind: "note", note: r.note });
    else if (r.kind === "unresolved") setNotChon({ kind: "unresolved", svgId: r.svgId });
    else setNotChon(null);
  }
  // Tô sáng là lớp trình bày: chỉ thêm/bớt class trên SVG đang hiện.
  useEffect(() => {
    const root = prevBody.current;
    if (!root) return;
    for (const el of Array.from(root.querySelectorAll(".np-note-selected")))
      el.classList.remove("np-note-selected");
    if (chonNot && notChon?.kind === "note")
      for (const el of Array.from(root.querySelectorAll(`[id="${notChon.note.svgId}"]`)))
        el.classList.add("np-note-selected");
  }, [chonNot, notChon, score]);
  // Đổi bản nhạc là bỏ chọn.
  useEffect(() => {
    setNotChon(null);
  }, [source]);

  /** Mở bài đã có trong kho theo id, dùng khi phát hiện trùng nội dung. */
  async function moBaiDaCo(scoreId: string, title: string) {
    const lib = thuVien.current;
    if (!lib) return;
    setTrungLap(null);
    setDangLuuBai(true);
    try {
      const ds = await lib.versions(scoreId);
      const hienHanh = ds[0];
      if (!hienHanh) throw new Error("Bài này chưa có phiên bản nào.");
      moTuThuVien({
        xml: await lib.readVersion(hienHanh),
        name: title,
        scoreId,
        versionId: hienHanh.id,
        versionNumber: hienHanh.versionNumber,
        isCurrent: true,
      });
    } catch (e) {
      setThuVienNote(e instanceof Error ? e.message : "Không mở được bài đã có.");
    } finally {
      setDangLuuBai(false);
    }
  }

  /** Mở một bài từ kho: đưa MusicXML về đúng pipeline đang chạy. */
  function moTuThuVien(event: LibraryOpenEvent) {
    ++fileRequest.current;
    setScore(null);
    setError("");
    setThuVienNote("");
    setSource({ xml: event.xml, name: `${event.name}.musicxml` });
    setBaiTrongKho({
      scoreId: event.scoreId,
      versionNumber: event.versionNumber,
      laHienHanh: event.isCurrent,
    });
    setXem({ che: "rong", pct: 100 });
    setMoThuVien(false);
  }

  // Nạp preset khi mở trang. Có preset mặc định thì áp; KHÔNG có thì giữ nguyên
  // cấu hình cũ của công cụ, để thầy đang quen không thấy kết quả khác đi.
  useEffect(() => {
    let cancelled = false;
    // Đã đăng nhập thì preset đi theo TÀI KHOẢN; chưa thì dùng kho trên máy như cũ.
    // Trang không gọi Supabase trực tiếp — mọi thứ qua PresetRepository.
    (async () => {
      const gate = await openPresetRepository({ presets: choPreset, history: choHistory });
      if (cancelled) return;
      presets.current = gate.repo;
      jobsRepo.current = gate.jobs;
      setSyncState(gate.state);
      void refreshHistory();
      if (gate.note) setPresetNote({ kind: "warn", text: gate.note });
      try {
        const store = await presets.current.load();
        if (cancelled) return;
        setPresetList(store.presets);
        setDefaultPresetId(store.defaultId);
        setSyncState(gate.state === "failed" ? "failed" : stateFromStore(store));
        if (store.recovered && !gate.note)
          setPresetNote({
            kind: "warn",
            text: "Có preset lưu bị hỏng, đã bỏ qua. Công cụ vẫn dùng bình thường.",
          });
        const preferred = store.presets.find((p) => p.id === store.defaultId);
        if (preferred) {
          setPresetId(preferred.id);
          setSettings((current) => applyPreset(preferred, current));
        }
      } catch {
        if (!cancelled) {
          setSyncState("failed");
          setPresetNote({
            kind: "error",
            text: "Không đọc được preset đã lưu. Đang dùng cấu hình mặc định.",
          });
        }
      }
    })();
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
    // Chỉ số liệu, không giữ bản nhạc: mã nhịp, cách chia đã dùng, số trang, số nhãn.
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
    if (!can(caps, "batch")) return;
    if (!choDinhDangMe(dinhDangMe)) return;
    if (!batchFiles.length || batchRunning) return;
    if (!giuLuot(dangChayMe)) return;
    setBatchRunning(true);
    setBatchNote("");
    batchAbort.current = { aborted: false };
    const batDau = Date.now();
    // Số liệu từng bài, thu trong lúc chạy. KHÔNG giữ bản nhạc, chỉ đếm.
    const { proc, meta } = collectItemMeta(batchProcessor);
    let xongMe: BatchItem[] | null = null;
    try {
      const items = await runBatch(batchFiles, proc, {
        settings,
        format: dinhDangMe,
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
      xongMe = items;
    } finally {
      traLuot(dangChayMe);
      setBatchRunning(false);
    }
    // Ghi lịch sử MỘT LẦN sau khi mẻ kết thúc — một job, một insert gộp item.
    // Nằm ngoài vòng chạy mẻ: hỏng lịch sử không đụng tới kết quả và nút Tải ZIP.
    if (xongMe)
      void ghiLichSu(() =>
        buildBatchJob({
          items: xongMe!,
          meta,
          settings,
          format: dinhDangMe,
          presetId: presetId || null,
          presetName: currentPreset?.name ?? null,
          startedAt: batDau,
          finishedAt: Date.now(),
        })
      );
  }
  function taiBeatMap() {
    if (!can(caps, "export.beatmap") || !score) return;
    downloadText(
      JSON.stringify(score.beatMap, null, 2),
      `${name}.beat-map.json`,
      "application/json"
    );
  }
  async function downloadZip() {
    if (!can(caps, "batch")) return;
    if (!choDinhDangMe(dinhDangMe)) return;
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
  /** Lịch sử là việc phụ: hỏng thì báo nhẹ, không bao giờ ném ra ngoài. */
  async function refreshHistory() {
    if (!can(caps, "history") || !jobsRepo.current) return;
    try {
      setRecent(await jobsRepo.current.listRecent(5));
    } catch {
      setHistoryNote({ kind: "warn", text: "Chưa tải được lịch sử." });
    }
  }
  async function ghiLichSu(build: () => JobRecord) {
    if (!can(caps, "history") || !jobsRepo.current) return;
    try {
      await jobsRepo.current.create(build());
      setHistoryNote(null);
      await refreshHistory();
    } catch {
      // File đã tải xong rồi. Lịch sử hỏng thì nói thật, nhưng KHÔNG được
      // biến nó thành "xuất thất bại".
      setHistoryNote({
        kind: "warn",
        text: "Đã xuất file, nhưng chưa lưu được lịch sử.",
      });
    }
  }
  const refreshPresets = async (note: Note = null) => {
    const store = await presets.current.load();
    setPresetList(store.presets);
    setDefaultPresetId(store.defaultId);
    setSyncState(stateFromStore(store));
    setPresetNote(note);
  };
  const choosePreset = (id: string) => {
    setPresetId(id);
    setPresetNote(null);
    const preset = presetList.find((p) => p.id === id);
    if (!preset) return;
    setBusy(!!source);
    setSettings((current) => applyPreset(preset, current));
    if (preset.exportFormat === "png" || preset.exportFormat === "pdf") return;
  };
  const currentPreset = presetList.find((p) => p.id === presetId) ?? null;
  async function guard(action: () => Promise<string>) {
    if (!can(caps, "presets")) return;
    try {
      const text = await action();
      setPresetNote(text ? { kind: "ok", text } : null);
    } catch (e) {
      // Lưu hỏng thì KHÔNG báo thành công giả; cấu hình trên UI giữ nguyên.
      setSyncState("failed");
      setPresetNote({
        kind: "error",
        text: e instanceof Error ? e.message : "Không lưu được preset.",
      });
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
      if (request === fileRequest.current) {
        setBaiTrongKho(null);
        setThuVienNote("");
        setSource({ xml, name: file.name });
        setXem({ che: "rong", pct: 100 });
      }
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
      if (request === fileRequest.current) {
        setBaiTrongKho(null);
        setThuVienNote("");
        setSource({ xml, name: "bai-mau.musicxml" });
        setXem({ che: "rong", pct: 100 });
      }
    } catch (e) {
      if (request === fileRequest.current) {
        setError(String(e));
        setBusy(false);
      }
    }
  }
  async function exportPrint(format: "pdf" | "png" | "svg") {
    // Chặn LẠI ở đây, không chỉ ẩn nút: state cũ, một cú đua render hay một
    // lệnh gọi từ console đều không được vượt qua quyền.
    if (!can(caps, `export.${format}` as const)) return;
    if (!score || busy || exporting) return;
    if (!giuLuot(dangXuat)) return;
    setExporting(true);
    setError("");
    const batDau = Date.now();
    let daXuat = false;
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
      daXuat = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xuất được bản nhạc.");
    } finally {
      traLuot(dangXuat);
      setExporting(false);
    }
    // Ghi lịch sử NẰM NGOÀI khối bảo vệ lỗi xuất, và chỉ chạy khi file đã thật
    // sự tải xong. Hỏng ở đây không được đụng tới `error` của việc xuất.
    if (daXuat)
      void ghiLichSu(() =>
        buildSingleJob({
          sourceName: source?.name ?? `${name}.musicxml`,
          score,
          settings,
          format,
          presetId: presetId || null,
          presetName: currentPreset?.name ?? null,
          startedAt: batDau,
          finishedAt: Date.now(),
        })
      );
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
    ? `Cách đếm nhịp ${meterCode(soloCounting)}`
    : countingMeters.length
    ? `Cách đếm nhịp kép và nhịp lẻ (${countingMeters.map(([k]) => k).join(", ")})`
    : "Cách đếm nhịp kép và nhịp lẻ";
  // Tên trên màn hình phải là tiếng thầy dùng khi dạy, chi tiết kỹ thuật lùi
  // xuống dòng chú thích nhỏ.
  const pulseHint = soloCounting
    ? `${soloCounting.beats} phách · ${series(soloCounting.beats)}`
    : "mỗi móc đơn";
  const largeCount = soloCounting
    ? isIrregularMeter(soloCounting)
      ? (settings.grouping?.byMeter?.[meterCode(soloCounting)] ??
          (score?.beatMap.measures.find(
            (m) => m.meter && meterCode(m.meter) === meterCode(soloCounting)
          )?.groups ?? null))?.length ?? null
      : soloCounting.beats / 3
    : null;
  const beatHint = largeCount
    ? `${largeCount} phách · ${series(largeCount)}`
    : "theo cách chia nhịp";
  const hasSimple =
    !score ||
    score.beatMap.measures.some(
      (m) => meterGrouping(m.meter)?.type === "simple"
    );
  const name = (source?.name || "ban-nhac").replace(/\.(xml|musicxml)$/i, "");
  const p = batchProgress(batchItems);
  const dangCanChon = batchItems.filter((i) => i.status === "needs-grouping");
  const trangThaiXuat = busy
    ? "Đang khắc bản nhạc…"
    : score
    ? `${score.pages.length} trang · ${score.anchors.length} nhãn đếm`
    : "Chưa có bản nhạc";

  /** Khu thả file — dùng chung cho một bài và nhiều bài. */
  const khuThaFile = (
    <div
      className={`np-drop${keoVao ? " over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setKeoVao(true);
      }}
      onDragLeave={() => setKeoVao(false)}
      onDrop={(e) => {
        e.preventDefault();
        setKeoVao(false);
        if (tab === "many") void readBatchFiles(e.dataTransfer.files);
        else void readFile(e.dataTransfer.files?.[0]);
      }}
    >
      {tab === "one" && source ? (
        <div className="np-picked">
          <span className="np-tick" aria-hidden="true">
            ✓
          </span>
          <span>{source.name}</span>
        </div>
      ) : tab === "many" && batchFiles.length ? (
        <div className="np-picked">
          <span className="np-tick" aria-hidden="true">
            ✓
          </span>
          <span>{batchFiles.length} bài đã chọn</span>
        </div>
      ) : (
        <div className="np-drop-t">Thả file MusicXML vào đây</div>
      )}
      <div className="np-row" style={{ justifyContent: "center", marginTop: 12 }}>
        {tab === "one" ? (
          <>
            <button
              className="np-btn np-btn-primary"
              onClick={() => fileInput.current?.click()}
            >
              {source ? "Chọn file khác" : "Chọn file"}
            </button>
            <button className="np-btn np-btn-quiet" onClick={() => void sample()}>
              Dùng file mẫu
            </button>
            {coThuVien && (
              <button
                className="np-btn np-btn-quiet"
                onClick={() => setMoThuVien(true)}
              >
                Thư viện bài hát
              </button>
            )}
          </>
        ) : (
          <button
            className="np-btn np-btn-primary"
            onClick={() => batchInput.current?.click()}
          >
            {batchFiles.length ? "Chọn lại" : "Chọn nhiều file"}
          </button>
        )}
      </div>
      {tab === "one" && source && coThuVien && (
        <div
          className="np-row"
          style={{ justifyContent: "center", marginTop: 8, gap: 8 }}
        >
          {baiTrongKho ? (
            <>
              <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                {baiTrongKho.laHienHanh
                  ? `Đã lưu · v${baiTrongKho.versionNumber}`
                  : `Đang xem bản cũ · v${baiTrongKho.versionNumber}`}
              </span>
              {choLuuThuVien && (
                <button
                  className="np-btn np-btn-quiet"
                  disabled={dangLuuBai}
                  onClick={() => void luuVaoThuVien()}
                >
                  {dangLuuBai ? "Đang lưu…" : "Lưu phiên bản mới"}
                </button>
              )}
            </>
          ) : (
            choLuuThuVien && (
              <button
                className="np-btn np-btn-quiet"
                disabled={dangLuuBai}
                onClick={() => void luuVaoThuVien()}
              >
                {dangLuuBai ? "Đang lưu…" : "Lưu vào thư viện"}
              </button>
            )
          )}
        </div>
      )}
      {trungLap && (
        <div
          style={{
            margin: "10px auto 0",
            maxWidth: 420,
            padding: "10px 12px",
            border: "1px solid var(--line)",
            borderRadius: 10,
            background: "var(--surface)",
            textAlign: "left",
          }}
        >
          <div style={{ fontSize: 13.5, marginBottom: 8 }}>
            Bản nhạc này đã có trong thư viện:{" "}
            <strong>{trungLap.title}</strong> (v{trungLap.versionNumber}).
          </div>
          <div className="np-row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button
              className="np-btn np-btn-primary"
              disabled={dangLuuBai}
              onClick={() => void moBaiDaCo(trungLap.scoreId, trungLap.title)}
            >
              Mở bài đã có
            </button>
            <button
              className="np-btn np-btn-quiet"
              disabled={dangLuuBai}
              onClick={() => void luuVaoThuVien(true)}
            >
              Vẫn lưu thành bài mới
            </button>
            <button className="np-btn np-btn-quiet" onClick={() => setTrungLap(null)}>
              Huỷ
            </button>
          </div>
        </div>
      )}
      {thuVienNote && (
        <div
          className="np-drop-s"
          style={{
            color: thuVienNote.startsWith("Đã lưu")
              ? "var(--online-ink)"
              : "var(--honey-ink)",
          }}
        >
          {thuVienNote}
        </div>
      )}
      <div className="np-drop-s">Hỗ trợ .xml và .musicxml · tối đa 5 MB mỗi file</div>
    </div>
  );

  return (
    <main
      className={`${NP_SCOPE}${score || batchItems.length ? " np-has" : ""}`}
    >
      <style>{NP_CSS}</style>
      <div className="np-wrap">
        <div className="np-top">
          <a className="np-brand" href="/">
            <img className="np-mark" src="/logo-green.svg" alt="" />
            <span>Thầy Văn Anh Guitar</span>
          </a>
          <a className="np-back" href="/">
            ← Trang chính
          </a>
        </div>

        <header className="np-head">
          <div className="np-eyebrow">Công cụ giảng dạy</div>
          <h1>Đọc nhịp – phách</h1>
          <p className="np-lead">Tạo bản nhạc có đánh dấu phách.</p>
        </header>

        {/* Chọn một bài hay nhiều bài là việc của người đã quen tay —
            mức Cơ bản chỉ có một luồng duy nhất. */}
        {nangCao && choBatch && dinhDangChoPhep.length > 0 && (
          <div className="np-seg" role="tablist" aria-label="Chế độ xử lý">
            {(["one", "many"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
              >
                {t === "one" ? "Một bài" : "Nhiều bài"}
              </button>
            ))}
          </div>
        )}

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
        <input
          ref={batchInput}
          aria-label="Chọn nhiều file MusicXML"
          type="file"
          accept=".xml,.musicxml,text/xml,application/xml"
          multiple
          style={{ display: "none" }}
          onChange={(e) => void readBatchFiles(e.target.files)}
        />

        <div
          className={`np-grid${score || batchItems.length ? " np-loaded" : ""}${
            thuGon && score ? " np-focus" : ""
          }`}
        >
          {/* ── Cột trái: nguồn → mẫu → thiết lập → xuất ────────────────── */}
          <div className="np-col">
            <section className="np-card np-o-source" aria-label="Bản nhạc">
              <h2>{nangCao ? "Bản nhạc" : "1. Chọn bản nhạc"}</h2>
              {khuThaFile}
            </section>

            {nangCao && choPreset && (
            <section className="np-card np-o-preset" aria-label="Mẫu trình bày">
              <h2>Mẫu trình bày</h2>
              <select
                id="preset"
                aria-label="Mẫu trình bày"
                className="np-select"
                value={presetId}
                onChange={(e) => choosePreset(e.target.value)}
              >
                <option value="">Cấu hình hiện tại</option>
                {presetList.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name}
                    {pr.id === defaultPresetId ? " ★" : ""}
                  </option>
                ))}
              </select>
              <div className="np-row" style={{ marginTop: 10 }}>
                <button className="np-btn sm" onClick={() => void saveAsPreset()}>
                  Lưu mới
                </button>
                <button
                  className="np-btn sm np-btn-quiet"
                  aria-expanded={managing}
                  onClick={() => setManaging((v) => !v)}
                >
                  {managing ? "Đóng" : "Quản lý ⋯"}
                </button>
                <span
                  className={`np-sync ${
                    syncState === "synced"
                      ? "ok"
                      : syncState === "failed"
                      ? "bad"
                      : "wait"
                  }`}
                  style={{ marginLeft: "auto" }}
                >
                  {SYNC_LABEL[syncState]}
                </span>
              </div>
              {managing && (
                <div style={{ marginTop: 12 }}>
                  <div className="np-muted" style={{ marginBottom: 8 }}>
                    {currentPreset
                      ? `“${currentPreset.name}”${
                          currentPreset.system ? " · mẫu hệ thống" : ""
                        }`
                      : "Chưa chọn mẫu nào"}
                  </div>
                  <div className="np-row">
                    <button
                      className="np-btn sm np-btn-quiet"
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
                      className="np-btn sm np-btn-quiet"
                      disabled={!currentPreset || currentPreset.system}
                      onClick={() =>
                        void guard(async () => {
                          const next = window
                            .prompt("Tên mới:", currentPreset?.name ?? "")
                            ?.trim();
                          if (!next) return "";
                          await presets.current.rename(
                            presetId,
                            next.slice(0, MAX_PRESET_NAME)
                          );
                          await refreshPresets();
                          return `Đã đổi tên thành “${next}”.`;
                        })
                      }
                    >
                      Đổi tên
                    </button>
                    <button
                      className="np-btn sm np-btn-quiet"
                      disabled={!currentPreset}
                      onClick={() =>
                        void guard(async () => {
                          const next =
                            defaultPresetId === presetId ? null : presetId;
                          await presets.current.setDefault(next);
                          await refreshPresets();
                          return next
                            ? "Đã đặt làm mẫu mặc định."
                            : "Đã bỏ mẫu mặc định.";
                        })
                      }
                    >
                      {defaultPresetId === presetId
                        ? "Bỏ mặc định"
                        : "Đặt mặc định"}
                    </button>
                    <button
                      className="np-btn sm np-btn-danger"
                      disabled={!currentPreset || isSystemPreset(presetId)}
                      onClick={() =>
                        void guard(async () => {
                          const gone = currentPreset?.name ?? "";
                          await presets.current.remove(presetId);
                          await refreshPresets();
                          setPresetId("");
                          return `Đã xoá mẫu “${gone}”.`;
                        })
                      }
                    >
                      Xoá
                    </button>
                  </div>
                  <p className="np-muted" style={{ margin: "10px 0 0" }}>
                    Mẫu hệ thống không xoá và không đổi tên được — hãy nhân bản.
                  </p>
                </div>
              )}
              {presetNote && (
                <div
                  role={presetNote.kind === "error" ? "alert" : "status"}
                  className={`np-note np-note-${presetNote.kind}`}
                  style={{ marginTop: 12 }}
                >
                  <span className="np-ico" aria-hidden="true">
                    {NOTE_ICON[presetNote.kind]}
                  </span>
                  <span>{presetNote.text}</span>
                </div>
              )}
            </section>
            )}

            {/* Cách đọc là việc nhạc, KHÔNG phải thiết lập nâng cao — luôn hiện. */}
            <section className="np-card np-o-settings" aria-label="Cách đọc">
              <h2>{nangCao ? "Cách đọc" : "2. Cách đọc"}</h2>

              {hasSimple && (
                <fieldset className="np-set" style={{ marginBottom: 16 }}>
                  <legend>Cách đếm nhịp đơn</legend>
                  <div className="np-opts">
                    {(
                      [
                        ["off", "Không hiện", ""],
                        ["beats", "Phách", "1 2 3 4"],
                        ["eighths", "Chia đôi", "1 & 2 & 3 & 4 &"],
                        ["sixteenths", "Chia tư", "1 e & a"],
                      ] as const
                    ).map(([level, label, hint]) => (
                      <label className="np-opt" key={level}>
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
                        />
                        <span>{label}</span>
                        {hint && <span className="np-opt-hint">{hint}</span>}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {(hasCompound || irregularMeters.length > 0 || tab === "many") && (
                <fieldset className="np-set" style={{ marginBottom: 14 }}>
                  <legend>{compoundLegend}</legend>
                  <div className="np-opts">
                    {(
                      [
                        ["off", "Không hiện", ""],
                        ["pulses", "Phách nhỏ", pulseHint],
                        ["compound", "Phách lớn", beatHint],
                      ] as const
                    ).map(([mode, label, hint]) => (
                      <label className="np-opt" key={mode}>
                        <input
                          type="radio"
                          name="compound-counting"
                          checked={
                            mode === "off"
                              ? !settings.showBeats
                              : settings.showBeats &&
                                (settings.compoundCountingMode || "pulses") ===
                                  mode
                          }
                          onChange={() =>
                            update(
                              mode === "off"
                                ? { showBeats: false }
                                : { showBeats: true, compoundCountingMode: mode }
                            )
                          }
                        />
                        <span>{label}</span>
                        {hint && <span className="np-opt-hint">{hint}</span>}
                      </label>
                    ))}
                  </div>
                  {hasSimple && (
                    <p className="np-muted" style={{ margin: "8px 0 0" }}>
                      Bản đổi nhịp: mỗi ô dùng nhóm đếm tương ứng. “Không hiện”
                      tắt toàn bản.
                    </p>
                  )}
                </fieldset>
              )}

              {/*
                Đếm phách nhỏ thì cách chia KHÔNG ảnh hưởng gì tới lưới số, nên
                hỏi lúc đó là hỏi thừa (mục 7). Chỉ hiện khi thầy đang đếm phách
                lớn — lúc đó thiếu cách chia là mất số phách — hoặc khi thầy đã
                mở mức nâng cao và muốn đặt sẵn.
              */}
              {(nangCao ||
                (settings.showBeats &&
                  (settings.compoundCountingMode || "pulses") === "compound")) &&
                irregularMeters.map(([code, meter]) => {
                const chosen = settings.grouping?.byMeter?.[code];
                const tuBanNhac = fromSource.get(code);
                const active = chosen ? partitionCode(chosen) : tuBanNhac ?? null;
                return (
                  <fieldset className="np-set" key={code} style={{ marginBottom: 14 }}>
                    <legend>Chọn cách chia nhịp {code}</legend>
                    <div className="np-opts">
                      {(allowedPartitions(meter) ?? []).map((groups) => {
                        const key = partitionCode(groups);
                        return (
                          <label className="np-opt" key={key}>
                            <input
                              type="radio"
                              name={`grouping-${code}`}
                              checked={active === key}
                              onChange={() => pickGrouping(code, groups)}
                            />
                            <span>{groups.join(" + ")}</span>
                            {tuBanNhac === key && !chosen && (
                              <span
                                className="np-opt-hint"
                                style={{ color: "var(--online-ink)" }}
                              >
                                theo bản nhạc
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {!active && (
                      <div className="np-note np-note-warn" style={{ marginTop: 8 }}>
                        <span className="np-ico" aria-hidden="true">
                          ⚠
                        </span>
                        <span>
                          <b>Bản nhạc {code} chưa ghi cách chia.</b> Phách nhỏ
                          dùng được ngay; chọn một cách chia để đếm phách lớn.
                        </span>
                      </div>
                    )}
                    {chosen && tuBanNhac && partitionCode(chosen) !== tuBanNhac && (
                      <div className="np-note np-note-info" style={{ marginTop: 8 }}>
                        <span className="np-ico" aria-hidden="true">
                          ℹ
                        </span>
                        <span>
                          Đang đè cách chia {tuBanNhac} ghi trong bản nhạc.{" "}
                          <button
                            type="button"
                            className="np-link"
                            onClick={() => pickGrouping(code, null)}
                          >
                            Dùng lại bản nhạc
                          </button>
                        </span>
                      </div>
                    )}
                  </fieldset>
                );
              })}

            </section>

            {nangCao && (
            <section className="np-card np-o-look" aria-label="Trình bày">
              <h2>Trình bày</h2>
              <label className="np-field np-field-row">
                <span>Màu số phách</span>
                <input
                  aria-label="Màu số phách"
                  type="color"
                  value={settings.color}
                  onChange={(e) => update({ color: e.target.value })}
                />
              </label>
              <div className="np-row" style={{ gap: 14, marginTop: 12 }}>
                <label className="np-field">
                  <span>Cỡ số · {settings.sizePt} pt</span>
                  <input
                    aria-label="Cỡ số phách"
                    type="range"
                    min={5}
                    max={14}
                    step={1}
                    value={settings.sizePt}
                    onChange={(e) => update({ sizePt: Number(e.target.value) })}
                  />
                </label>
                <label className="np-field">
                  <span>Khoảng cách · {settings.distance}</span>
                  <input
                    aria-label="Khoảng cách dưới khuông"
                    type="range"
                    min={0}
                    max={8}
                    step={1}
                    value={settings.distance}
                    onChange={(e) => update({ distance: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div className="np-sub">Trang giấy</div>
              <label className="np-field">
                <span>Khổ A4 · hướng giấy</span>
                <select
                  aria-label="Hướng giấy"
                  className="np-select"
                  value={settings.orientation || "portrait"}
                  onChange={(e) =>
                    update({
                      orientation: e.target.value as "portrait" | "landscape",
                    })
                  }
                >
                  <option value="portrait">A4 dọc</option>
                  <option value="landscape">A4 ngang</option>
                </select>
              </label>
              <p className="np-muted" style={{ margin: "8px 0 0" }}>
                Lề 15 mm, riêng lề dưới 18 mm.
              </p>
            </section>
            )}

            <section className="np-card np-o-export" aria-label="Xuất tài liệu">
              <h2>{nangCao ? "Xuất tài liệu" : "3. Xuất tài liệu"}</h2>
              {tab === "one" ? (
                <>
                  {choXuat.pdf && (
                    <button
                      className="np-btn np-btn-primary np-btn-wide"
                      disabled={!score || busy || exporting}
                      onClick={() => void exportPrint("pdf")}
                    >
                      Xuất PDF
                    </button>
                  )}
                  {/* Không có PDF thì PNG lên làm nút chính — đừng giả định
                      PDF lúc nào cũng có mặt. */}
                  {!choXuat.pdf && choXuat.png && (
                    <button
                      className="np-btn np-btn-primary np-btn-wide"
                      disabled={!score || busy || exporting}
                      onClick={() => void exportPrint("png")}
                    >
                      Xuất PNG
                    </button>
                  )}
                  {!choXuat.pdf && !choXuat.png && choXuat.svg && (
                    <button
                      className="np-btn np-btn-primary np-btn-wide"
                      disabled={!score || busy || exporting}
                      onClick={() => void exportPrint("svg")}
                    >
                      Xuất SVG
                    </button>
                  )}
                  {/* PDF là thứ thầy in ra dạy. PNG, SVG, beat-map là việc của
                      người cần đưa file sang chỗ khác — để ở mức nâng cao. */}
                  {nangCao && (
                    <>
                      {(choXuat.png || choXuat.svg) && (
                        <div className="np-row" style={{ marginTop: 10 }}>
                          {choXuat.pdf && choXuat.png && (
                            <>
                              <button
                                className="np-btn sm np-btn-quiet"
                                disabled={!score || busy || exporting}
                                onClick={() => void exportPrint("png")}
                              >
                                Xuất PNG
                              </button>
                              <select
                                aria-label="Độ phân giải PNG"
                                className="np-select"
                                style={{
                                  width: "auto",
                                  minHeight: 34,
                                  padding: "6px 10px",
                                  fontSize: 13,
                                }}
                                value={pngScale}
                                onChange={(e) =>
                                  setPngScale(Number(e.target.value) as 1 | 2)
                                }
                              >
                                <option value={1}>1x</option>
                                <option value={2}>2x</option>
                              </select>
                            </>
                          )}
                          {choXuat.svg && (choXuat.pdf || choXuat.png) && (
                            <button
                              className="np-btn sm np-btn-quiet"
                              disabled={!score || busy || exporting}
                              onClick={() => void exportPrint("svg")}
                            >
                              Xuất SVG
                            </button>
                          )}
                        </div>
                      )}
                      {choXuat.beatmap && (
                        <div className="np-row" style={{ marginTop: 12 }}>
                          <button
                            type="button"
                            className="np-link"
                            disabled={!score || busy || exporting}
                            onClick={() => taiBeatMap()}
                          >
                            Tải beat-map JSON
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  <div className="np-row" style={{ marginTop: 12 }}>
                    <span role="status" className="np-muted">
                      {exporting ? "Đang xuất…" : trangThaiXuat}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <label className="np-field" style={{ marginBottom: 10 }}>
                    <span>Định dạng</span>
                    <select
                      aria-label="Định dạng xuất"
                      className="np-select"
                      value={dinhDangMe}
                      onChange={(e) =>
                        setBatchFormat(e.target.value as BatchFormat)
                      }
                    >
                      {dinhDangChoPhep.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.ten}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="np-btn np-btn-primary np-btn-wide"
                    disabled={!batchFiles.length || batchRunning}
                    onClick={() => void runBatchNow()}
                  >
                    {batchRunning ? "Đang xử lý…" : "Xử lý tất cả"}
                  </button>
                  {batchRunning && (
                    <>
                      <div
                        className="np-bar"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={p.tong}
                        aria-valuenow={p.xong + p.loi + p.canChon}
                      >
                        <i
                          style={{
                            width: `${
                              p.tong
                                ? Math.round(
                                    ((p.xong + p.loi + p.canChon) / p.tong) * 100
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <div className="np-row" style={{ marginTop: 10 }}>
                        <span role="status" className="np-muted">
                          Đang xử lý {p.xong + p.loi + p.canChon} / {p.tong}
                        </span>
                        <button
                          className="np-btn sm np-btn-quiet"
                          style={{ marginLeft: "auto" }}
                          onClick={() => {
                            batchAbort.current.aborted = true;
                          }}
                        >
                          Dừng
                        </button>
                      </div>
                    </>
                  )}
                  <button
                    className="np-btn np-btn-wide"
                    style={{ marginTop: 10 }}
                    disabled={!batchItems.some((i) => i.status === "done")}
                    onClick={() => void downloadZip()}
                  >
                    Xuất ZIP
                  </button>
                </>
              )}
            </section>

            {/* Không có quyền `advanced` thì KHÔNG bày nút này: bấm vào cũng
                không mở được gì, mà lời mô tả lại hứa PNG/SVG/mẫu trình bày/
                nhiều bài — hứa rồi không làm còn tệ hơn là không hứa. */}
            {choNangCao && (
            <div className="np-o-more">
              <button
                type="button"
                className="np-more"
                aria-expanded={nangCao}
                onClick={() => {
                  const bat = !nangCao;
                  // Tắt mức nâng cao thì quay về luồng một bài; mẻ đang có
                  // vẫn nằm nguyên trong state, bật lại là thấy y như cũ.
                  if (!bat) setTab("one");
                  setMuonNangCao(bat);
                  nhoMuc(bat);
                }}
              >
                <span className="np-more-caret" aria-hidden="true">
                  {nangCao ? "▴" : "▾"}
                </span>
                {nangCao ? "Ẩn thiết lập nâng cao" : "Thiết lập nâng cao"}
              </button>
              {!nangCao && (
                <p className="np-muted" style={{ margin: "6px 0 0" }}>
                  Màu và cỡ số phách, khổ giấy, xuất PNG/SVG, mẫu trình bày,
                  xử lý nhiều bài.
                </p>
              )}
            </div>
            )}
          </div>

          {/* ── Cột phải: xem trước hoặc danh sách mẻ ───────────────────── */}
          <div className="np-col">
            {error && (
              <div role="alert" className="np-note np-note-error np-o-note">
                <span className="np-ico" aria-hidden="true">
                  ✕
                </span>
                <span>{error}</span>
              </div>
            )}
            {historyNote && (
              <div
                role="status"
                className={`np-note np-note-${historyNote.kind} np-o-note`}
              >
                <span className="np-ico" aria-hidden="true">
                  {NOTE_ICON[historyNote.kind]}
                </span>
                <span>{historyNote.text}</span>
              </div>
            )}

            {tab === "many" && !!batchNote && (
              <div role="status" className="np-note np-note-info np-o-note">
                <span className="np-ico" aria-hidden="true">
                  ℹ
                </span>
                <span>{batchNote}</span>
              </div>
            )}
            {tab === "many" ? (
              <section className="np-prev np-o-list" aria-label="Danh sách bài">
                <div className="np-prev-bar">
                  <h2>Danh sách bài</h2>
                  <span role="status" className="np-muted">
                    {batchItems.length
                      ? `✓ ${p.xong}${p.canChon ? ` · ⚠ ${p.canChon}` : ""}${
                          p.loi ? ` · ✕ ${p.loi}` : ""
                        } / ${p.tong}`
                      : `${batchFiles.length} bài đã chọn`}
                  </span>
                </div>
                <div style={{ padding: 18 }}>
                  {batchItems.length ? (
                    <>
                      <ul className="np-list">
                        {batchItems.map((item) => (
                          <li key={item.id}>
                            <div className="np-item-top">
                              <span className="np-name">{item.fileName}</span>
                              {item.status === "done" ? (
                                <span className="np-state done">
                                  <span aria-hidden="true">✓</span> Hoàn tất{" "}
                                  <span className="np-out">{item.outputName}</span>
                                </span>
                              ) : item.status === "error" ? (
                                <span className="np-state err">
                                  <span aria-hidden="true">✕</span> File lỗi
                                </span>
                              ) : item.status === "needs-grouping" ? (
                                <span className="np-state warn">
                                  <span aria-hidden="true">⚠</span> Chọn cách chia{" "}
                                  {item.needs?.map((n) => n.meter).join(", ")}
                                </span>
                              ) : item.status === "processing" ? (
                                <span className="np-state idle">
                                  <span aria-hidden="true">◔</span> Đang xử lý
                                </span>
                              ) : (
                                <span className="np-state idle">
                                  <span aria-hidden="true">○</span> Đang chờ
                                </span>
                              )}
                            </div>
                            {item.status === "error" && item.error && (
                              <p className="np-muted" style={{ margin: "6px 0 0" }}>
                                {item.error}
                              </p>
                            )}
                            {item.status === "needs-grouping" &&
                              item.needs?.map((need) => (
                                <div
                                  className="np-chips"
                                  key={`${item.id}-${need.meter}`}
                                  style={{ marginTop: 8 }}
                                >
                                  {need.options.map((groups) => {
                                    const dangChon =
                                      batchGrouping[item.id]?.byMeter?.[
                                        need.meter
                                      ]?.join("+") === groups.join("+");
                                    return (
                                      <button
                                        key={`${item.id}-${need.meter}-${groups.join("+")}`}
                                        className={`np-btn sm${
                                          dangChon ? " np-btn-primary" : ""
                                        }`}
                                        aria-pressed={dangChon}
                                        onClick={() =>
                                          pickBatchGrouping(
                                            item,
                                            need.meter,
                                            groups
                                          )
                                        }
                                      >
                                        {groups.join(" + ")}
                                        {dangChon ? " ✓" : ""}
                                      </button>
                                    );
                                  })}
                                </div>
                              ))}
                          </li>
                        ))}
                      </ul>
                      {!!dangCanChon.length && (
                        <div className="np-note np-note-warn" style={{ marginTop: 14 }}>
                          <span className="np-ico" aria-hidden="true">
                            ⚠
                          </span>
                          <span>
                            <b>
                              {dangCanChon.length} bài cần chọn cách chia nhịp.
                            </b>{" "}
                            Chọn ngay cạnh từng bài rồi bấm “Xử lý tất cả” lần
                            nữa. Công cụ không tự đoán cách chia.
                          </span>
                        </div>
                      )}
                    </>
                  ) : batchFiles.length ? (
                    <ul className="np-list">
                      {batchFiles.map((f) => (
                        <li key={f.name}>
                          <div className="np-item-top">
                            <span className="np-name">{f.name}</span>
                            <span className="np-state idle">
                              <span aria-hidden="true">○</span> Đang chờ
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="np-empty">
                      <div className="np-glyph" aria-hidden="true">
                        𝄞
                      </div>
                      <p style={{ margin: 0 }}>Chọn nhiều bản nhạc để bắt đầu.</p>
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <section className="np-prev np-o-preview" aria-label="Xem trước bản nhạc">
                <div className="np-prev-bar">
                  <div className="np-prev-tit">
                    <h2>Xem trước</h2>
                    <span role="status" className="np-muted">
                      {trangThaiXuat}
                    </span>
                  </div>
                  {!!score && (
                    <div className="np-zoom" role="group" aria-label="Mức phóng bản nhạc">
                      <span className="np-zstep">
                      <button
                        type="button"
                        className="np-zbtn"
                        aria-label="Thu nhỏ"
                        disabled={xem.che !== "khung" && xem.pct <= ZOOM_MIN}
                        onClick={() =>
                          setXem((v) => ({
                            che: "tay",
                            pct: Math.max(ZOOM_MIN, v.pct - ZOOM_BUOC),
                          }))
                        }
                      >
                        −
                      </button>
                      <span className="np-zval" role="status">
                        {xem.che === "khung" ? "Vừa khung" : `${xem.pct}%`}
                      </span>
                      <button
                        type="button"
                        className="np-zbtn"
                        aria-label="Phóng to"
                        disabled={xem.che !== "khung" && xem.pct >= ZOOM_MAX}
                        onClick={() =>
                          setXem((v) => ({
                            che: "tay",
                            pct: Math.min(ZOOM_MAX, v.pct + ZOOM_BUOC),
                          }))
                        }
                      >
                        +
                      </button>
                      </span>
                      <button
                        type="button"
                        className="np-zbtn np-zwide"
                        aria-pressed={xem.che === "khung"}
                        onClick={() => setXem({ che: "khung", pct: 100 })}
                      >
                        Vừa khung
                      </button>
                      <button
                        type="button"
                        className="np-zbtn np-zwide"
                        aria-pressed={xem.che === "rong"}
                        onClick={() => setXem({ che: "rong", pct: 100 })}
                      >
                        Vừa chiều rộng
                      </button>
                      <button
                        type="button"
                        className="np-zbtn np-zwide np-zfocus"
                        aria-pressed={thuGon}
                        onClick={() => setThuGon((v) => !v)}
                      >
                        {thuGon ? "Hiện thiết lập" : "Thu gọn thiết lập"}
                      </button>
                      {choChonNot && (
                        <button
                          type="button"
                          className="np-zbtn np-zwide"
                          aria-pressed={chonNot}
                          onClick={() => {
                            setChonNot((v) => !v);
                            setNotChon(null);
                          }}
                        >
                          {chonNot ? "Thoát chọn nốt" : "Chọn nốt"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {choChonNot && chonNot && (
                  <div
                    className="np-note-panel"
                    role="status"
                    aria-label="Nốt đang chọn"
                  >
                    {notChon?.kind === "note" ? (
                      (() => {
                        const d = describeNote(
                          notChon.note,
                          score!.beatMap,
                          onsetTheoPath.get(notChon.note.path) ?? null
                        );
                        return (
                          <>
                            <strong>Nốt đang chọn</strong>
                            <span>Ô nhịp: {d.measure}</span>
                            <span>Phách: {d.beat}</span>
                            <span>Cao độ: {d.pitch}</span>
                            <span>Trường độ: {d.duration}</span>
                            <span>Bè: {d.voice}</span>
                            <span>Khuông: {d.staff}</span>
                            {d.tab && <span>TAB: {d.tab}</span>}
                          </>
                        );
                      })()
                    ) : notChon?.kind === "unresolved" ? (
                      <span>
                        Nốt này chưa gắn được với bản nhạc nguồn nên không chọn được — xem chi tiết ở khối chẩn đoán.
                      </span>
                    ) : (
                      <span className="np-muted">Bấm vào một nốt trên bản nhạc để xem nó là nốt nào trong MusicXML.</span>
                    )}
                  </div>
                )}
                <div
                  ref={prevBody}
                  onClick={onClickBanNhac}
                  className={`np-prev-body${
                    xem.che === "khung" ? " np-fit-page" : ""
                  }${chonNot ? " np-select-mode" : ""}`}
                  aria-busy={busy}
                  style={
                    {
                      background: score ? "var(--np-paper)" : "var(--surface)",
                      opacity: busy ? 0.55 : 1,
                      padding: score ? 20 : 0,
                      "--np-zoom": xem.che === "rong" ? 100 : xem.pct,
                    } as CSSProperties
                  }
                >
                  {score ? (
                    score.pages.map((pg) => (
                      <figure className="np-page" key={pg.number}>
                        {chonNot ? (
                          // SVG thật trong DOM để click tới được từng <g id> nốt.
                          <SvgPage svg={pg.svg} width={pg.width} height={pg.height} />
                        ) : (
                        <img
                          alt={`Trang ${pg.number} bản nhạc${
                            settings.showBeats ? " có số phách" : ""
                          }`}
                          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                            pg.svg
                          )}`}
                          style={{ aspectRatio: `${pg.width} / ${pg.height}` }}
                        />
                        )}
                        <figcaption>Trang {pg.number}</figcaption>
                      </figure>
                    ))
                  ) : (
                    <div className="np-empty">
                      <div className="np-glyph" aria-hidden="true">
                        𝄞
                      </div>
                      <p style={{ margin: 0 }}>Chọn bản nhạc để bắt đầu.</p>
                      <p className="np-muted" style={{ margin: "8px 0 0" }}>
                        Hỗ trợ {SUPPORTED_SIMPLE.join(", ")}, nhịp kép{" "}
                        {SUPPORTED_COMPOUND.join(", ")} và nhịp lẻ{" "}
                        {SUPPORTED_IRREGULAR.join(", ")}.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {score && score.diagnostics.length > 0 && !nangCao && (
              <div className="np-note np-note-warn np-o-diag">
                <span className="np-ico" aria-hidden="true">
                  ⚠
                </span>
                <span>
                  Có một phần của bản nhạc chưa đánh dấu được chính xác. Phần
                  còn lại vẫn hiện đầy đủ.
                </span>
              </div>
            )}
            {score && score.diagnostics.length > 0 && nangCao && (
              <details className="np-card np-o-diag" style={{ padding: "14px 18px" }}>
                <summary
                  style={{
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 14,
                    color: "var(--honey-ink)",
                  }}
                >
                  ⚠ Có {score.diagnostics.length} điểm cần kiểm tra
                </summary>
                <p className="np-muted" style={{ margin: "10px 0" }}>
                  Ô chưa xác định đúng sẽ không gắn số phách. Phần bản nhạc còn
                  lại vẫn hiển thị.
                </p>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    maxHeight: 220,
                    overflow: "auto",
                    fontSize: 12.5,
                    color: "var(--ink-soft)",
                  }}
                >
                  {score.diagnostics.map((d, i) => (
                    <li key={i} style={{ marginTop: 8, overflowWrap: "anywhere" }}>
                      <b>{d.code}</b> · {d.sourceId}
                      <br />
                      {d.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>

        {/* ── Gần đây ──────────────────────────────────────────────────── */}
        {choHistory && !!jobsRepo.current && !!recent.length && (
          <section className="np-recent" aria-label="Lịch sử xử lý gần đây">
            <h2>Gần đây</h2>
            <ul className="np-list">
              {recent.map((job) => (
                <li key={job.id}>
                  <div className="np-job">
                    <span className="np-when">{khiNao(job.createdAt)}</span>
                    <span className="np-what">
                      {job.totalItems} bài · {job.exportFormat.toUpperCase()}
                    </span>
                    {job.presetName && (
                      <span className="np-preset">{job.presetName}</span>
                    )}
                    <span
                      className={`np-state ${
                        job.errorItems
                          ? "err"
                          : job.needsGroupingItems
                          ? "warn"
                          : "done"
                      }`}
                    >
                      {job.errorItems || job.needsGroupingItems
                        ? [
                            `✓ ${job.doneItems}`,
                            job.needsGroupingItems
                              ? `⚠ ${job.needsGroupingItems} cần chọn cách chia`
                              : "",
                            job.errorItems ? `✕ ${job.errorItems} lỗi` : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : `✓ ${job.doneItems}/${job.totalItems}`}
                    </span>
                    <span className="np-job-acts">
                      <button
                        type="button"
                        className="np-link"
                        aria-expanded={openJob?.id === job.id}
                        onClick={() =>
                          void (async () => {
                            try {
                              setOpenJob(
                                openJob?.id === job.id
                                  ? null
                                  : await jobsRepo.current!.getJob(job.id)
                              );
                            } catch {
                              setHistoryNote({ kind: "warn", text: "Chưa mở được chi tiết." });
                            }
                          })()
                        }
                      >
                        {openJob?.id === job.id ? "Đóng" : "Xem chi tiết"}
                      </button>
                      {nangCao && (
                      <button
                        type="button"
                        className="np-link"
                        onClick={() => {
                          setBusy(!!source);
                          setSettings((cur) =>
                            applyJobSettings(job.settingsSnapshot, cur)
                          );
                          setPresetId("");
                          setHistoryNote({
                            kind: "ok",
                            text: "Đã dùng lại thiết lập của lần xử lý đó.",
                          });
                        }}
                      >
                        Dùng lại thiết lập
                      </button>
                      )}
                      {nangCao && (
                      <button
                        type="button"
                        className="np-link danger"
                        aria-label={`Xoá lịch sử ${khiNao(job.createdAt)}`}
                        onClick={() =>
                          void (async () => {
                            try {
                              await jobsRepo.current!.remove(job.id);
                              if (openJob?.id === job.id) setOpenJob(null);
                              await refreshHistory();
                            } catch {
                              setHistoryNote({ kind: "warn", text: "Chưa xoá được mục này." });
                            }
                          })()
                        }
                      >
                        Xoá
                      </button>
                      )}
                    </span>
                  </div>
                  {openJob?.id === job.id && (
                    <div className="np-detail">
                      <div className="np-meta">
                        {cachDem(job.countingMode)} ·{" "}
                        {job.orientation === "portrait" ? "A4 dọc" : "A4 ngang"}{" "}
                        · {job.settingsSnapshot.sizePt} pt · khoảng cách{" "}
                        {job.settingsSnapshot.distance} ·{" "}
                        {Math.round(job.durationMs / 100) / 10}s
                        {job.presetName ? ` · mẫu ${job.presetName}` : ""}
                      </div>
                      <ul className="np-list">
                        {openJob.items.map((item) => (
                          <li key={item.itemId} style={{ padding: "6px 0" }}>
                            <div className="np-item-top">
                              <span className="np-name">{item.sourceName}</span>
                              <span
                                className={`np-state ${
                                  item.status === "done"
                                    ? "done"
                                    : item.status === "error"
                                    ? "err"
                                    : "warn"
                                }`}
                              >
                                {item.status === "done"
                                  ? `✓ ${item.outputName ?? ""}`
                                  : item.status === "error"
                                  ? `✕ ${item.errorMessage ?? "Lỗi"}`
                                  : "⚠ Cần chọn cách chia"}
                              </span>
                              {item.groupingSnapshot &&
                                Object.entries(item.groupingSnapshot).map(
                                  ([m, g]) => (
                                    <span className="np-muted" key={m}>
                                      {m} · {(g as number[]).join("+")}
                                    </span>
                                  )
                                )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="np-foot">
          File được xử lý trên thiết bị. SVG giữ đường nét khi phóng to và là
          bản nguồn chung cho PDF vector và PNG. PNG 1x: 96 dpi; 2x: 192 dpi.
          Nhiều trang PNG được đóng ZIP.
        </p>
      </div>
      {moThuVien && thuVien.current && (
        <ScoreLibraryPanel
          library={thuVien.current}
          canManage={choQuanLyThuVien}
          onOpen={moTuThuVien}
          onClose={() => setMoThuVien(false)}
        />
      )}
    </main>
  );

}
