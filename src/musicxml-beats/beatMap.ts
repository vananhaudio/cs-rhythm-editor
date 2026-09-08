import { parseMusicXML } from "./parser.ts";
import { buildBeatMap } from "./beatEngine.ts";
import type { MeasureBeatMap } from "./beatEngine.ts";
export interface BeatMapDocument {
  schemaVersion: 1;
  timeUnit: "quarter-note";
  rationalFormat: "numerator/denominator";
  measures: MeasureBeatMap[];
}
export function musicXMLToBeatMap(xml: string): BeatMapDocument {
  return {
    schemaVersion: 1,
    timeUnit: "quarter-note",
    rationalFormat: "numerator/denominator",
    measures: buildBeatMap(parseMusicXML(xml), "simple-and-compound"),
  };
}
export function serializeBeatMap(map: BeatMapDocument): string {
  return JSON.stringify(map, null, 2) + "\n";
}
