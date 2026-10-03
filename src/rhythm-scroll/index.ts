// RHYTHM SCROLL — lõi dùng chung (TeamLab, Class/App, công cụ khác).
// TypeScript thuần: không React, DOM, Verovio, musicxml-beats, Supabase hay SDK nào.
export type {
  RhythmScroll,
  RhythmScrollData,
  RhythmScrollIssue,
  RhythmScrollMeter,
  RhythmScrollPosition,
  RhythmScrollProvenance,
  RhythmScrollSegment,
  RhythmScrollSourceType,
  RhythmScrollState,
  RhythmScrollValidation,
} from "./types.ts";
export { validateRhythmScrollData } from "./validate.ts";
export { createRhythmScroll } from "./engine.ts";
export { measuresAtSeconds } from "./time.ts";
