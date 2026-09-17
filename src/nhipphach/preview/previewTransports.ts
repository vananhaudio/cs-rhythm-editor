/**
 * 4D.P4 — Hai bộ vẽ xem trước trong trình duyệt: Web Worker (mặc định) và main
 * thread (dự phòng khi Worker không dùng được). Cả hai chạy `xuLyYeuCau`.
 */
import type { createAnnotatedScoreRenderer } from "../../musicxml-beats/renderer/verovioAdapter.ts";
import { xuLyYeuCau } from "./previewCore.ts";
import type { LoaiBoVe, PreviewTransport } from "./previewScheduler.ts";

type Renderer = Awaited<ReturnType<typeof createAnnotatedScoreRenderer>>;

export function taoBoVeTrinhDuyet(layRendererMain: () => Promise<Renderer>) {
  return (
    loai: LoaiBoVe,
    onMessage: (data: unknown) => void,
    onError: (reason: string) => void
  ): PreviewTransport | null => {
    if (loai === "worker") {
      if (typeof Worker === "undefined") return null;
      try {
        // Mẫu import Worker chuẩn của Vite — không viết cứng URL.
        const w = new Worker(new URL("./previewWorker.ts", import.meta.url), {
          type: "module",
        });
        w.onmessage = (e) => onMessage(e.data);
        w.onerror = (e) => {
          e.preventDefault();
          onError("WORKER_ERROR");
        };
        w.onmessageerror = () => onError("MESSAGE_ERROR");
        return { send: (req) => w.postMessage(req), terminate: () => w.terminate() };
      } catch {
        return null;
      }
    }
    // Dự phòng: vẽ ngay trên main thread, vẫn qua cùng một giao thức.
    let daHuy = false;
    return {
      send(req) {
        setTimeout(() => {
          if (daHuy) return;
          layRendererMain().then(
            (r) => {
              if (!daHuy) onMessage(xuLyYeuCau(r, req));
            },
            (e) => {
              if (!daHuy) onError(e instanceof Error ? e.message : "MAIN_RENDERER_ERROR");
            }
          );
        }, 0);
      },
      terminate() {
        daHuy = true;
      },
    };
  };
}
