/**
 * 4D.P4 — Một yêu cầu vẽ xem trước → một kết quả. Dùng chung cho Web Worker và
 * cho đường dự phòng trên main thread, để hai nơi không bao giờ vẽ khác nhau.
 *
 * Yêu cầu chỉ mang dữ liệu thuần: số hiệu bản nháp, XML nháp hiện tại, thiết lập
 * vẽ, và (tuỳ chọn) lệnh vừa làm ra bản nháp đó — làm gợi ý cho phân loại P3.
 * Không mang ngăn xếp lệnh, không mang DraftEngine, không mang trạng thái React.
 * Nguồn sự thật vẫn là XML nháp ở main thread; ở đây chỉ là bộ vẽ dùng một lần.
 */
import type { MusicXmlEditCommand } from "../edit/commands.ts";
import { keHoachXemTruoc } from "../editor/previewPlan.ts";
import type { AnnotatedScore, ScoreSettings } from "../../musicxml-beats/renderer/types.ts";
import type { Rational } from "../../musicxml-beats/rational.ts";
import { parseMusicXML } from "../../musicxml-beats/parser.ts";
import type { createAnnotatedScoreRenderer } from "../../musicxml-beats/renderer/verovioAdapter.ts";

export interface PreviewRequest {
  revision: number;
  xml: string;
  settings: ScoreSettings;
  /** Lệnh vừa tạo ra `xml` — chỉ là gợi ý; bộ phân loại tự so với bản đang xem. */
  cmd: MusicXmlEditCommand | null;
}
export type PreviewResponse =
  | {
      revision: number;
      ok: true;
      score: AnnotatedScore;
      path: "partial" | "full";
      renderMs: number;
      /**
       * 4D.P5B: thời điểm bắt đầu của từng sự kiện (theo đường dẫn nguồn) CỦA
       * ĐÚNG bản vừa khắc — cho ô "Phách". Tính ở đây để main thread khỏi đọc
       * lại cả bài, và để ô Phách luôn cùng phiên bản với bản khắc đang hiện.
       */
      onsets: Map<string, Rational>;
    }
  | { revision: number; ok: false; error: string };

type Renderer = Awaited<ReturnType<typeof createAnnotatedScoreRenderer>>;

/** Onset của một bản; đọc bài dùng bộ đệm theo chuỗi nguồn (chung với BeatMap). */
export const demOnset = { tinh: 0 };
const onsetTheoRenderer = new WeakMap<Renderer, { xml: string; onsets: Map<string, Rational> }>();
function layOnset(renderer: Renderer, xml: string, ghep: boolean): Map<string, Rational> {
  const cu = onsetTheoRenderer.get(renderer);
  // Ghép trang chỉ xảy ra khi bản mới khác bản trước ĐÚNG ở dây/phím một nốt TAB —
  // thời điểm các sự kiện không đổi, nên onset của bản trước vẫn đúng.
  if (ghep && cu) {
    onsetTheoRenderer.set(renderer, { xml, onsets: cu.onsets });
    return cu.onsets;
  }
  if (cu && cu.xml === xml) return cu.onsets;
  demOnset.tinh++;
  const m = new Map<string, Rational>();
  for (const p of parseMusicXML(xml).parts)
    for (const ms of p.measures) for (const ev of ms.events) m.set(ev.source.path, ev.onset);
  onsetTheoRenderer.set(renderer, { xml, onsets: m });
  return m;
}

export function xuLyYeuCau(renderer: Renderer, req: PreviewRequest): PreviewResponse {
  try {
    const a = performance.now();
    const plan = keHoachXemTruoc(req.cmd, renderer.previewXml(), req.xml);
    const truoc = renderer.stats().previewPartial;
    const score = renderer.renderPreview(
      req.xml,
      req.settings,
      plan.kind === "partial" ? { sourceId: plan.sourceId } : null
    );
    const ghep = renderer.stats().previewPartial > truoc;
    return {
      revision: req.revision,
      ok: true,
      score,
      path: ghep ? "partial" : "full",
      renderMs: performance.now() - a,
      onsets: layOnset(renderer, req.xml, ghep),
    };
  } catch (e) {
    // Lỗi thì bỏ ảnh chụp: lần sau vẽ đầy đủ, không ghép lên nền có thể đã hỏng.
    renderer.clearPreview();
    return { revision: req.revision, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Kết quả nhận về có đúng hình dạng không — kết quả dị dạng coi như lỗi. */
export function ketQuaHopLe(x: unknown): x is PreviewResponse {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  if (typeof r.revision !== "number") return false;
  if (r.ok === false) return typeof r.error === "string";
  const s = r.score as Record<string, unknown> | undefined;
  return (
    r.ok === true &&
    !!s &&
    Array.isArray(s.pages) &&
    s.pages.length > 0 &&
    (s.pages as { svg?: unknown }[]).every((p) => typeof p?.svg === "string") &&
    s.noteIndex instanceof Map &&
    r.onsets instanceof Map
  );
}
