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
    }
  | { revision: number; ok: false; error: string };

type Renderer = Awaited<ReturnType<typeof createAnnotatedScoreRenderer>>;

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
    return {
      revision: req.revision,
      ok: true,
      score,
      path: renderer.stats().previewPartial > truoc ? "partial" : "full",
      renderMs: performance.now() - a,
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
    s.noteIndex instanceof Map
  );
}
