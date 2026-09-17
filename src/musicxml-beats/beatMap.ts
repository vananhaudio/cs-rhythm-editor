import { parseMusicXML } from "./parser.ts";
import { buildBeatMap } from "./beatEngine.ts";
import type { MeasureBeatMap } from "./beatEngine.ts";
import type { GroupingSelection } from "./meterGrouping.ts";
export interface BeatMapDocument {
  schemaVersion: 1;
  timeUnit: "quarter-note";
  rationalFormat: "numerator/denominator";
  measures: MeasureBeatMap[];
}
export function musicXMLToBeatMap(
  xml: string,
  selection?: GroupingSelection
): BeatMapDocument {
  return {
    schemaVersion: 1,
    timeUnit: "quarter-note",
    rationalFormat: "numerator/denominator",
    measures: buildBeatMap(parseMusicXML(xml), "simple-and-compound", selection),
  };
}
export function serializeBeatMap(map: BeatMapDocument): string {
  return JSON.stringify(map, null, 2) + "\n";
}
