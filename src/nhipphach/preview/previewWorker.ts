/**
 * 4D.P4 — Web Worker vẽ xem trước. Chỉ giữ bộ khắc và ảnh chụp trang của nó;
 * không giữ trạng thái sửa nào có thẩm quyền, không lưu, không hoàn tác.
 */
import { createAnnotatedScoreRenderer } from "../../musicxml-beats/renderer/verovioAdapter.ts";
import { xuLyYeuCau } from "./previewCore.ts";
import type { PreviewRequest } from "./previewCore.ts";

let renderer: ReturnType<typeof createAnnotatedScoreRenderer> | null = null;
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<PreviewRequest>) => void) | null;
  postMessage(msg: unknown): void;
};
scope.onmessage = async (e) => {
  const req = e.data;
  try {
    renderer ??= createAnnotatedScoreRenderer();
    const r = await renderer;
    scope.postMessage(xuLyYeuCau(r, req));
  } catch (err) {
    renderer = null;
    scope.postMessage({
      revision: req?.revision ?? -1,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
