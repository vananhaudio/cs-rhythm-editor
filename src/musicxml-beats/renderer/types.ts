import type { BeatMapDocument } from "../beatMap.ts";
import type { Diagnostic } from "../model.ts";
import type {
  ScoreAnnotation,
  CountingLevel,
  CompoundCountingMode,
} from "../annotations.ts";
import type { GroupingSelection } from "../meterGrouping.ts";
export interface ScoreSettings {
  compoundCountingMode?: CompoundCountingMode;
  /** Cách chia nhịp lẻ do người dùng chọn. Renderer chỉ chuyển tiếp, không tự quyết. */
  grouping?: GroupingSelection;
  countingLevel?: CountingLevel;
  orientation?: "portrait" | "landscape";
  showBeats: boolean;
  color: string;
  sizePt: number;
  distance: number;
}
export const DEFAULT_SCORE_SETTINGS: ScoreSettings = {
  showBeats: true,
  color: "#dc2626",
  sizePt: 7,
  distance: 2,
};
export interface TemporalAnchor extends ScoreAnnotation {
  measureId: string;
  staff: string;
  timestamp: string;
}
export interface ScorePage {
  number: number;
  svg: string;
  width: number;
  height: number;
}
export interface AnnotatedScore {
  pages: ScorePage[];
  diagnostics: Diagnostic[];
  /** Cảnh báo không chặn (ví dụ nhịp lẻ chưa chọn cách chia). Bản nhạc vẫn khắc bình thường. */
  notices: Diagnostic[];
  beatMap: BeatMapDocument;
  anchors: TemporalAnchor[];
  version: string;
  originalMEI: string;
  renderedMEI: string;
}
/** Future PDF/PNG converters consume these SAME SVG pages, never rerender the source. */
export interface ScoreExportSource {
  pages: readonly ScorePage[];
}
