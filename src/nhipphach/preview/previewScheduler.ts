/**
 * 4D.P4 — Lập lịch vẽ xem trước ngoài main thread.
 *
 * BẤT BIẾN SỐ 1: chỉ kết quả của số hiệu MỚI NHẤT được hiện. Kết quả cũ về muộn
 * (hay về lệch thứ tự) bị bỏ, không bao giờ đè lên bản mới hơn.
 *
 * Gộp yêu cầu: bộ vẽ bận thì chỉ giữ yêu cầu MỚI NHẤT đang chờ; các bản giữa bị
 * bỏ qua khi VẼ — lệnh sửa thì không mất gì, chúng nằm trong DraftEngine.
 *
 * Hỏng hóc (sập, quá giờ, lỗi WASM, kết quả dị dạng) → huỷ bộ vẽ, tạo bộ mới, vẽ
 * đầy đủ bản mới nhất. Hỏng liên tiếp → chuyển hẳn sang vẽ trên main thread.
 * Không có gì ở đây có thẩm quyền về bản nhạc: mất nó thì chỉ mất ảnh xem trước.
 */
import { ketQuaHopLe } from "./previewCore.ts";
import type { PreviewRequest, PreviewResponse } from "./previewCore.ts";

export interface PreviewTransport {
  send(req: PreviewRequest): void;
  terminate(): void;
}
export type LoaiBoVe = "worker" | "main";
export interface PreviewSchedulerDeps {
  /** Tạo bộ vẽ; `null` = loại này không dùng được ở môi trường hiện tại. */
  taoBoVe(
    loai: LoaiBoVe,
    onMessage: (data: unknown) => void,
    onError: (reason: string) => void
  ): PreviewTransport | null;
  /** Kết quả của ĐÚNG số hiệu mới nhất. */
  hien(res: Extract<PreviewResponse, { ok: true }>): void;
  /** Bản mới nhất không vẽ được (sau khi đã thử lại). */
  baoLoi(message: string, revision: number): void;
  hen?: (fn: () => void, ms: number) => unknown;
  huyHen?: (h: unknown) => void;
  /** Quá thời gian này mà chưa có kết quả → coi như bộ vẽ treo. */
  thoiGianCho?: number;
}

const HONG_LIEN_TIEP_TOI_DA = 2;

export class PreviewScheduler {
  private latest = 0;
  private inFlight: PreviewRequest | null = null;
  private pending: PreviewRequest | null = null;
  private boVe: PreviewTransport | null = null;
  private loai: LoaiBoVe = "worker";
  private hongLienTiep = 0;
  private hetGio: unknown = null;
  private daThuLai = new Set<number>();
  readonly stats = {
    sent: 0,
    committed: 0,
    dropped: 0,
    coalesced: 0,
    restarts: 0,
    fallbackMain: false,
  };
  private readonly deps: PreviewSchedulerDeps;
  constructor(deps: PreviewSchedulerDeps) {
    this.deps = deps;
  }

  get dangBan() {
    return this.inFlight !== null;
  }
  get soHieuMoiNhat() {
    return this.latest;
  }
  get loaiBoVe() {
    return this.loai;
  }

  request(req: PreviewRequest) {
    if (req.revision <= this.latest) throw new Error("Số hiệu bản nháp phải tăng dần.");
    this.latest = req.revision;
    if (this.inFlight) {
      if (this.pending) this.stats.coalesced++;
      this.pending = req;
      return;
    }
    this.gui(req);
  }

  destroy() {
    this.huyHetGio();
    this.boVe?.terminate();
    this.boVe = null;
    this.inFlight = this.pending = null;
  }

  private gui(req: PreviewRequest) {
    if (!this.boVe) {
      this.boVe = this.tao(this.loai);
      if (!this.boVe && this.loai === "worker") {
        this.chuyenSangMain();
        this.boVe = this.tao("main");
      }
      if (!this.boVe) {
        this.deps.baoLoi("Không có bộ vẽ xem trước.", req.revision);
        return;
      }
    }
    this.inFlight = req;
    this.stats.sent++;
    const hen = this.deps.hen ?? ((fn, ms) => setTimeout(fn, ms));
    this.hetGio = hen(() => this.hong("TIMEOUT"), this.deps.thoiGianCho ?? 60_000);
    this.boVe.send(req);
  }

  /** Mỗi bộ vẽ chỉ được nói về chính nó: thư và lỗi của bộ đã huỷ bị bỏ qua. */
  private tao(loai: LoaiBoVe): PreviewTransport | null {
    const t: PreviewTransport | null = this.deps.taoBoVe(
      loai,
      (d) => this.nhan(d, t),
      (why) => {
        if (t === this.boVe) this.hong(why);
      }
    );
    return t;
  }

  private huyHetGio() {
    if (this.hetGio !== null) (this.deps.huyHen ?? ((h) => clearTimeout(h as never)))(this.hetGio);
    this.hetGio = null;
  }

  private nhan(data: unknown, tu: PreviewTransport | null) {
    // Thư của một bộ vẽ đã bị huỷ: bỏ.
    if (tu !== this.boVe) return;
    if (!ketQuaHopLe(data)) return this.hong("MALFORMED_RESULT");
    if (!this.inFlight || data.revision !== this.inFlight.revision) return;
    this.huyHetGio();
    const req = this.inFlight;
    this.inFlight = null;
    this.hongLienTiep = 0;
    if (data.revision === this.latest) {
      if (data.ok) {
        this.stats.committed++;
        this.daThuLai.delete(data.revision);
        this.deps.hien(data);
      } else if (!this.daThuLai.has(data.revision)) {
        // Lỗi vẽ: thử lại MỘT lần trên bộ vẽ mới, vẽ đầy đủ.
        this.daThuLai.add(data.revision);
        this.khoiDongLai();
        if (!this.pending) this.pending = { ...req, cmd: null };
      } else {
        this.daThuLai.delete(data.revision);
        this.deps.baoLoi(data.error, data.revision);
      }
    } else {
      this.stats.dropped++;
    }
    this.tiep();
  }

  private tiep() {
    const p = this.pending;
    this.pending = null;
    if (p) this.gui(p);
  }

  private khoiDongLai() {
    this.boVe?.terminate();
    this.boVe = null;
    this.stats.restarts++;
  }

  private chuyenSangMain() {
    this.loai = "main";
    this.stats.fallbackMain = true;
  }

  private hong(_why: string) {
    this.huyHetGio();
    this.khoiDongLai();
    this.hongLienTiep++;
    if (this.loai === "worker" && this.hongLienTiep > HONG_LIEN_TIEP_TOI_DA) this.chuyenSangMain();
    // Bản mới nhất vẽ lại ĐẦY ĐỦ trên bộ vẽ mới (bộ mới không có ảnh chụp nào).
    const req = this.pending ?? this.inFlight;
    this.inFlight = null;
    this.pending = null;
    if (req && this.hongLienTiep > HONG_LIEN_TIEP_TOI_DA + 2) {
      this.deps.baoLoi("Bộ vẽ xem trước hỏng liên tục.", req.revision);
      return;
    }
    if (req) this.gui({ ...req, cmd: null });
  }
}
