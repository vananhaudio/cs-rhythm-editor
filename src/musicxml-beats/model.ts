import type { Rational } from "./rational.ts";
export interface SourceIdentity {
  id: string;
  xmlId: string | null;
  path: string;
  xml: string;
}
export interface Diagnostic {
  code: string;
  sourceId: string;
  message: string;
}
export interface Meter {
  beats: number;
  beatType: number;
  /**
   * Cách chia ghi RÕ trong nguồn (MusicXML `<beats>2+3</beats>`), giữ nguyên thứ tự.
   * null = nguồn không nói gì. KHÔNG BAO GIỜ được suy ra từ beam hay nốt.
   */
  additive?: readonly number[] | null;
}
export interface TimedEvent {
  source: SourceIdentity;
  kind: "note" | "rest" | "harmony" | "forward" | "backup";
  onset: Rational;
  duration: Rational;
  voice: string;
  staff: string;
  chord: boolean;
  grace: boolean;
  dots: number;
  noteType: string | null;
  pitch: { step: string; alter: string; octave: string } | null;
  ties: string[];
  tied: string[];
  timeModification: {
    actualNotes: string;
    normalNotes: string;
    normalType: string | null;
    normalDots: number;
  } | null;
  lyrics: {
    number: string | null;
    name: string | null;
    text: string[];
    syllabic: string[];
    xml: string;
  }[];
}
export interface NormalizedMeasure {
  source: SourceIdentity;
  number: string;
  index: number;
  implicit: boolean;
  meter: Meter | null;
  actualDuration: Rational;
  events: TimedEvent[];
  diagnostics: Diagnostic[];
}
export interface NormalizedPart {
  id: string;
  source: SourceIdentity;
  measures: NormalizedMeasure[];
}
export interface NormalizedScore {
  sourceXml: string;
  parts: NormalizedPart[];
  diagnostics: Diagnostic[];
}
