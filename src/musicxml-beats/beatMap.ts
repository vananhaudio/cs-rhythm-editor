import { parseMusicXML } from "./parser.ts";
import { buildBeatMap } from "./beatEngine.ts";
import type { MeasureBeatMap } from "./beatEngine.ts";
import type { GroupingSelection } from "./meterGrouping.ts";
import { dongBangSau, nhoTheoNguon } from "./sourceCache.ts";
export interface BeatMapDocument {
  schemaVersion: 1;
  timeUnit: "quarter-note";
  rationalFormat: "numerator/denominator";
  measures: MeasureBeatMap[];
}
/**
 * 4D.P2: một chuỗi nguồn + một cách chia nhịp → BeatMap tính MỘT lần. Kiểm tra
 * nhịp và bản khắc từng dựng hai lần cùng một bản đồ cho cùng bản nháp. Kết quả
 * đóng băng sâu. Cách chia nhịp là một phần của khoá — khác cách chia là khác bản đồ.
 */
const boNhoTheoCachChia = new Map<string, ReturnType<typeof nhoTheoNguon<BeatMapDocument>>>();
export function musicXMLToBeatMap(
  xml: string,
  selection?: GroupingSelection
): BeatMapDocument {
  const khoa = JSON.stringify(selection ?? null);
  let bo = boNhoTheoCachChia.get(khoa);
  if (!bo) {
    // Chỉ vài cách chia khác nhau trong một phiên; đủ nhiều thì bỏ bớt cái cũ.
    if (boNhoTheoCachChia.size >= 8) boNhoTheoCachChia.delete(boNhoTheoCachChia.keys().next().value as string);
    bo = nhoTheoNguon<BeatMapDocument>(2);
    boNhoTheoCachChia.set(khoa, bo);
  }
  return bo.lay(xml, () => dongBangSau(tinhBeatMap(xml, selection)));
}
function tinhBeatMap(xml: string, selection?: GroupingSelection): BeatMapDocument {
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
