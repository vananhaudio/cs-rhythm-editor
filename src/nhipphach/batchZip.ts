import { zipSync } from "fflate";
import type { BatchItem } from "./batch.ts";

/**
 * Gói các file đã xong thành một ZIP. KHÔNG nối thành một PDF khổng lồ —
 * mỗi bài một file, giữ đúng tên đã tính sẵn.
 */
export async function zipBatch(
  items: readonly BatchItem[],
  zipName = "Tai-lieu-nhip-phach.zip"
): Promise<{ blob: Blob; name: string; count: number }> {
  const files: Record<string, Uint8Array> = {};
  for (const item of items) {
    if (item.status !== "done" || !item.blob) continue;
    files[item.outputName] = new Uint8Array(await item.blob.arrayBuffer());
  }
  const count = Object.keys(files).length;
  if (!count) throw new Error("Chưa có bài nào xử lý xong để đóng gói.");
  return {
    blob: new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], {
      type: "application/zip",
    }),
    name: zipName,
    count,
  };
}
