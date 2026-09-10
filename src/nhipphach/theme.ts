/**
 * Ngôn ngữ thiết kế của Class, dùng lại nguyên vẹn cho công cụ Nhịp Phách.
 *
 * Bộ biến dưới đây KHÔNG phải màu tôi tự chọn: nó chép đúng khối token đang
 * chạy trên `class.vananhaudio.com/class` (`.tva-class` trong
 * `src/ClassLandingPage.tsx`) — cùng tên biến, cùng giá trị. Đổi màu thương
 * hiệu thì sửa ở đó rồi đồng bộ sang đây, đừng chỉnh riêng một bên.
 *
 * Hai biến `--np-danger*` là phần THÊM: `.tva-class` không khai báo màu lỗi
 * (trang bán hàng không có trạng thái lỗi). Giá trị lấy từ tông đỏ mà các màn
 * học viên đang dùng (`StudentOnboarding`: `#B91C1C` / `#FEE2E2`).
 *
 * Vì sao dùng `<style>` có phạm vi thay vì inline style như phần còn lại của
 * dự án: giai đoạn này cần media query, `:hover` và `:focus-visible` — inline
 * style không làm được. Đây cũng đúng khuôn các trang Class khác
 * (`ClassLandingPage`, `ClassJourney2027`, `ClassTiaNot`… đều dùng `<style>`
 * kèm một class gốc).
 */
export const NP_SCOPE = "tva-np";

export const NP_CSS = `
.${NP_SCOPE}{
  --bg:#F2EEE7; --surface:#FFFFFF;
  --ink:#211C32; --ink-soft:#5A5470; --ink-faint:#8A8499;
  --indigo:#4338CA; --indigo-dark:#352BA3; --indigo-tint:#EEEBFB;
  --honey:#C9711E; --honey-tint:#FBF1E4;
  --line:#E4DED4; --online:#16A34A;
  --np-danger:#B91C1C; --np-danger-tint:#FDECEC;
  /* Ba màu CHỮ đậm hơn bản gốc của Class. Lý do: --honey (3,6:1), --online
     (3,3:1) và --ink-faint (3,6:1) đặt trên nền trắng không đạt 4,5:1 của
     WCAG AA cho cỡ chữ nhỏ. Nền, viền, chấm trang trí vẫn dùng màu gốc; chỉ
     riêng phần chữ đọc-để-hiểu mới dùng ba biến này. */
  --honey-ink:#8A4A12; --online-ink:#12813B; --ink-hint:#5A5470;
  /* Nền “mặt bàn” sau tờ A4. Đậm hơn --bg hẳn một bậc: tờ giấy trắng phải
     tách khỏi nền chứ không chìm vào một khoảng trắng chung. */
  --np-paper:#E1DACD;
  font-family:'Be Vietnam Pro',system-ui,sans-serif;
  background:var(--bg); color:var(--ink);
  line-height:1.55; font-size:16px; min-height:100dvh;
  text-align:left; color-scheme:light;
  padding:0 0 56px; box-sizing:border-box;
}
.${NP_SCOPE} *{box-sizing:border-box;}
.${NP_SCOPE} .np-wrap{max-width:1080px;margin:0 auto;padding:0 20px;}

/* ── Đầu trang ───────────────────────────────────────────────────────────── */
.${NP_SCOPE} .np-top{display:flex;align-items:center;justify-content:space-between;gap:14px;padding-top:14px;flex-wrap:wrap;}
.${NP_SCOPE} .np-brand{display:inline-flex;align-items:center;gap:10px;font-weight:800;font-size:15.5px;color:var(--ink);text-decoration:none;min-height:40px;}
.${NP_SCOPE} .np-mark{width:34px;height:34px;border-radius:9px;object-fit:contain;display:block;}
.${NP_SCOPE} .np-back{display:inline-flex;align-items:center;min-height:40px;padding:8px 0;color:var(--ink-soft);font-size:13.5px;text-decoration:none;}
.${NP_SCOPE} .np-back:hover{color:var(--indigo);}
.${NP_SCOPE} .np-head{margin:18px 0 20px;}
.${NP_SCOPE} .np-eyebrow{font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--honey-ink);margin-bottom:8px;}
.${NP_SCOPE} h1{font-size:32px;font-weight:800;line-height:1.15;letter-spacing:-.6px;margin:0;color:var(--ink);}
.${NP_SCOPE} .np-lead{color:var(--ink-soft);font-size:16px;margin:8px 0 0;max-width:620px;}

/* ── Chuyển chế độ ───────────────────────────────────────────────────────── */
.${NP_SCOPE} .np-seg{display:inline-flex;gap:4px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:4px;margin-bottom:20px;}
.${NP_SCOPE} .np-seg button{border:none;background:none;font:inherit;font-size:14.5px;font-weight:700;color:var(--ink-soft);padding:9px 20px;border-radius:999px;cursor:pointer;min-height:40px;transition:background .15s,color .15s;}
.${NP_SCOPE} .np-seg button:hover{color:var(--indigo);}
.${NP_SCOPE} .np-seg button[aria-selected="true"]{background:var(--indigo);color:#fff;}

/* ── Bố cục ──────────────────────────────────────────────────────────────── */
.${NP_SCOPE} .np-grid{display:grid;grid-template-columns:340px minmax(0,1fr);gap:20px;align-items:start;}
/* Đã có bản nhạc thì đổi sang dáng bàn làm việc: thanh bên hẹp lại, khung
   nhìn nới rộng ra. Thanh bên KHÔNG rộng thêm — chỉ bản nhạc rộng thêm. */
.${NP_SCOPE}.np-has .np-wrap{max-width:1400px;}
.${NP_SCOPE} .np-loaded{grid-template-columns:304px minmax(0,1fr);gap:18px;}
.${NP_SCOPE} .np-loaded .np-card{padding:16px;}
.${NP_SCOPE} .np-loaded .np-col{gap:12px;}
.${NP_SCOPE} .np-focus{grid-template-columns:minmax(0,1fr);}
.${NP_SCOPE} .np-focus .np-col:first-child{display:none;}
@media(min-width:1024px){
  .${NP_SCOPE} .np-loaded .np-zfocus{display:inline-flex;align-items:center;}
}
.${NP_SCOPE} .np-col{display:flex;flex-direction:column;gap:16px;min-width:0;}


/* ── Thẻ ─────────────────────────────────────────────────────────────────── */
.${NP_SCOPE} .np-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px;}
.${NP_SCOPE} .np-card > h2{font-size:15.5px;font-weight:700;margin:0 0 14px;color:var(--ink);letter-spacing:-.2px;}
.${NP_SCOPE} .np-sub{font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-hint);margin:18px 0 10px;}
.${NP_SCOPE} .np-sub:first-of-type{margin-top:0;}
.${NP_SCOPE} .np-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;}

/* ── Nút ─────────────────────────────────────────────────────────────────── */
.${NP_SCOPE} .np-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:inherit;font-weight:600;font-size:14.5px;border-radius:12px;padding:12px 18px;min-height:44px;cursor:pointer;border:1.5px solid #D3CEE8;background:var(--surface);color:var(--indigo);transition:background .15s,border-color .15s,color .15s;}
.${NP_SCOPE} .np-btn:hover:not(:disabled){background:var(--indigo-tint);}
.${NP_SCOPE} .np-btn-primary{background:var(--indigo);border-color:var(--indigo);color:#fff;}
.${NP_SCOPE} .np-btn-primary:hover:not(:disabled){background:var(--indigo-dark);border-color:var(--indigo-dark);}
.${NP_SCOPE} .np-btn-quiet{border-color:var(--line);color:var(--ink-soft);}
.${NP_SCOPE} .np-btn-quiet:hover:not(:disabled){background:#FAF8F4;color:var(--ink);}
.${NP_SCOPE} .np-btn-danger{border-color:#EED3D3;color:var(--np-danger);}
.${NP_SCOPE} .np-btn-danger:hover:not(:disabled){background:var(--np-danger-tint);}
.${NP_SCOPE} .np-btn.sm{font-size:13px;padding:7px 12px;min-height:34px;border-radius:9px;}
.${NP_SCOPE} .np-btn:disabled{opacity:.45;cursor:not-allowed;}
.${NP_SCOPE} .np-btn-wide{width:100%;}

/* ── Ô nhập ──────────────────────────────────────────────────────────────── */
.${NP_SCOPE} select.np-select{font-family:inherit;font-size:14.5px;font-weight:600;color:var(--ink);background:var(--surface);border:1.5px solid var(--line);border-radius:12px;padding:11px 14px;min-height:44px;cursor:pointer;width:100%;}
.${NP_SCOPE} select.np-select:hover{border-color:#D3CEE8;}
.${NP_SCOPE} .np-field{display:flex;flex-direction:column;gap:7px;font-size:13px;color:var(--ink-soft);flex:1 1 150px;min-width:0;}
.${NP_SCOPE} .np-field > span{font-weight:600;}
.${NP_SCOPE} .np-field-row{flex-direction:row;align-items:center;justify-content:space-between;gap:12px;}
.${NP_SCOPE} .np-field-row input[type=color]{width:72px;flex:0 0 72px;}
.${NP_SCOPE} input[type=range]{accent-color:var(--indigo);width:100%;height:24px;}
.${NP_SCOPE} input[type=color]{width:100%;height:40px;border:1.5px solid var(--line);border-radius:10px;background:var(--surface);cursor:pointer;padding:3px;}
.${NP_SCOPE} input[type=radio]{accent-color:var(--indigo);width:18px;height:18px;flex-shrink:0;}
.${NP_SCOPE} :focus-visible{outline:2.5px solid var(--indigo);outline-offset:2px;border-radius:6px;}

/* ── Nhóm lựa chọn ───────────────────────────────────────────────────────── */
.${NP_SCOPE} fieldset.np-set{border:0;padding:0;margin:0;min-width:0;}
.${NP_SCOPE} fieldset.np-set legend{display:block;width:100%;font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-hint);padding:0;margin-bottom:8px;}
.${NP_SCOPE} .np-opts{display:flex;flex-direction:column;gap:2px;}
.${NP_SCOPE} .np-opt{display:flex;align-items:center;gap:10px;min-height:42px;font-size:14.5px;color:var(--ink);cursor:pointer;padding:2px 2px;border-radius:9px;}
.${NP_SCOPE} .np-opt:hover{background:#FAF8F4;}
.${NP_SCOPE} .np-opt .np-opt-hint{font-size:12.5px;color:var(--ink-hint);font-weight:500;}
.${NP_SCOPE} .np-chips{display:flex;flex-wrap:wrap;gap:8px;}

/* ── Khu thả file ────────────────────────────────────────────────────────── */
.${NP_SCOPE} .np-drop{border:2px dashed #CFC9DA;border-radius:14px;background:#FBFAF7;padding:22px 16px;text-align:center;transition:border-color .15s,background .15s;}
.${NP_SCOPE} .np-drop.over{border-color:var(--indigo);background:var(--indigo-tint);}
.${NP_SCOPE} .np-drop-t{font-size:14.5px;font-weight:600;color:var(--ink);}
.${NP_SCOPE} .np-drop-s{font-size:12.5px;color:var(--ink-hint);margin-top:8px;}
.${NP_SCOPE} .np-picked{display:flex;align-items:center;gap:9px;font-size:14.5px;font-weight:600;color:var(--ink);overflow-wrap:anywhere;text-align:left;}
.${NP_SCOPE} .np-picked .np-tick{color:var(--online-ink);flex-shrink:0;}

/* ── Thông báo ───────────────────────────────────────────────────────────── */
.${NP_SCOPE} .np-note{display:flex;gap:10px;align-items:flex-start;border-radius:12px;padding:12px 14px;font-size:13.5px;line-height:1.5;overflow-wrap:anywhere;}
.${NP_SCOPE} .np-note b{font-weight:700;}
.${NP_SCOPE} .np-note-info{background:var(--indigo-tint);color:#31285F;}
.${NP_SCOPE} .np-note-warn{background:var(--honey-tint);color:#7A4310;}
.${NP_SCOPE} .np-note-error{background:var(--np-danger-tint);color:#8A1C1C;}
.${NP_SCOPE} .np-note-ok{background:#F0FAF2;color:#146132;}
.${NP_SCOPE} .np-note .np-ico{flex-shrink:0;font-size:14px;line-height:1.5;}
.${NP_SCOPE} .np-muted{font-size:12.5px;color:var(--ink-hint);}
.${NP_SCOPE} .np-sync{font-size:12.5px;font-weight:600;}
.${NP_SCOPE} .np-sync.ok{color:var(--online-ink);}
.${NP_SCOPE} .np-sync.bad{color:var(--np-danger);}
.${NP_SCOPE} .np-sync.wait{color:var(--ink-hint);}

/* ── Mở mức nâng cao ─────────────────────────────────────────────────────── */
.${NP_SCOPE} .np-more{display:inline-flex;align-items:center;gap:8px;font-family:inherit;font-size:14px;font-weight:600;color:var(--indigo);background:none;border:0;padding:10px 0;min-height:44px;cursor:pointer;}
.${NP_SCOPE} .np-more:hover{color:var(--indigo-dark);}
.${NP_SCOPE} .np-more-caret{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;background:var(--indigo-tint);font-size:10px;line-height:1;}

/* ── Xem trước ───────────────────────────────────────────────────────────── */
.${NP_SCOPE} .np-prev{background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden;}
.${NP_SCOPE} .np-loaded .np-prev{border-color:#D5CCBE;box-shadow:0 2px 10px -6px rgba(33,28,50,.22);}
.${NP_SCOPE} .np-prev-bar{display:flex;justify-content:space-between;align-items:center;gap:10px 16px;flex-wrap:wrap;padding:9px 14px;border-bottom:1px solid var(--line);}
.${NP_SCOPE} .np-prev-tit{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;min-width:0;}
.${NP_SCOPE} .np-prev-bar h2{font-size:14.5px;font-weight:700;margin:0;white-space:nowrap;}

/* Thanh phóng — nhỏ, xám, không tranh chỗ với bản nhạc. */
.${NP_SCOPE} .np-zoom{display:flex;align-items:center;gap:4px;flex-wrap:wrap;}
.${NP_SCOPE} .np-zstep{display:inline-flex;align-items:center;gap:4px;}
.${NP_SCOPE} .np-zbtn{font-family:inherit;font-size:12.5px;font-weight:600;color:var(--ink-soft);background:var(--surface);border:1px solid var(--line);border-radius:8px;min-height:30px;min-width:30px;padding:0 8px;cursor:pointer;line-height:1;}
.${NP_SCOPE} .np-zbtn:hover:not(:disabled){background:#FAF8F4;color:var(--ink);border-color:#D3CEE8;}
.${NP_SCOPE} .np-zbtn[aria-pressed="true"]{background:var(--indigo-tint);border-color:#C7BFEA;color:var(--indigo);}
.${NP_SCOPE} .np-zbtn:disabled{opacity:.4;cursor:not-allowed;}
.${NP_SCOPE} .np-zval{font-size:12.5px;font-weight:700;color:var(--ink);min-width:64px;text-align:center;font-variant-numeric:tabular-nums;}
.${NP_SCOPE} .np-zfocus{display:none;}

.${NP_SCOPE} .np-prev-body{padding:20px;background:var(--np-paper);max-height:78vh;overflow:auto;--np-zoom:100;}
.${NP_SCOPE} .np-page{margin:0 auto 18px;background:#fff;width:calc(var(--np-zoom) * 1%);max-width:none;border:1px solid #D3CBBD;border-radius:2px;box-shadow:0 14px 32px -14px rgba(33,28,50,.5),0 2px 6px -2px rgba(33,28,50,.18);}
.${NP_SCOPE} .np-page img{display:block;width:100%;height:auto;}
/* Vừa khung: cao vừa đúng khung nhìn, bề ngang tự theo tỉ lệ trang. */
.${NP_SCOPE} .np-fit-page .np-page{width:fit-content;max-width:100%;}
.${NP_SCOPE} .np-fit-page .np-page img{width:auto;height:calc(78vh - 132px);max-width:100%;}
.${NP_SCOPE} .np-page figcaption{padding:8px;text-align:center;font-size:11.5px;color:var(--ink-hint);border-top:1px solid #EFEAE1;}
.${NP_SCOPE} .np-empty{text-align:center;padding:52px 20px;color:var(--ink-soft);}
.${NP_SCOPE} .np-empty .np-glyph{font-size:38px;color:var(--ink-faint);margin-bottom:10px;}

/* ── Danh sách mẻ ────────────────────────────────────────────────────────── */
.${NP_SCOPE} .np-list{list-style:none;padding:0;margin:0;}
.${NP_SCOPE} .np-list li{padding:12px 0;border-top:1px solid #F1EDE6;}
.${NP_SCOPE} .np-list li:first-child{border-top:0;}
.${NP_SCOPE} .np-item-top{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:baseline;}
.${NP_SCOPE} .np-name{font-size:14px;font-weight:600;overflow-wrap:anywhere;flex:1 1 190px;min-width:0;}
.${NP_SCOPE} .np-state{font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;}
.${NP_SCOPE} .np-state.done{color:var(--online-ink);}
.${NP_SCOPE} .np-state.err{color:var(--np-danger);}
.${NP_SCOPE} .np-state.warn{color:var(--honey-ink);}
.${NP_SCOPE} .np-state.idle{color:var(--ink-hint);}
.${NP_SCOPE} .np-state .np-out{font-weight:500;color:var(--ink-hint);}

/* ── Thanh tiến độ ───────────────────────────────────────────────────────── */
.${NP_SCOPE} .np-bar{height:6px;border-radius:999px;background:#EDE9E1;overflow:hidden;margin-top:10px;}
.${NP_SCOPE} .np-bar > i{display:block;height:100%;background:var(--indigo);border-radius:999px;transition:width .25s ease;}

/* ── Gần đây ─────────────────────────────────────────────────────────────── */
.${NP_SCOPE} .np-recent{margin-top:26px;}
.${NP_SCOPE} .np-recent > h2{font-size:15.5px;font-weight:700;margin:0 0 4px;}
.${NP_SCOPE} .np-job{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:baseline;}
.${NP_SCOPE} .np-job .np-when{font-size:13px;color:var(--ink-hint);font-variant-numeric:tabular-nums;}
.${NP_SCOPE} .np-job .np-what{font-size:14px;font-weight:700;}
.${NP_SCOPE} .np-job .np-preset{font-size:13px;color:var(--ink-soft);}
.${NP_SCOPE} .np-job-acts{display:flex;gap:8px;margin-left:auto;flex-wrap:wrap;}
.${NP_SCOPE} .np-link{border:0;background:none;padding:7px 0;min-height:36px;font:inherit;font-size:13px;font-weight:600;color:var(--indigo);cursor:pointer;text-decoration:underline;text-underline-offset:3px;}
.${NP_SCOPE} .np-link:hover{color:var(--indigo-dark);}
.${NP_SCOPE} .np-link.danger{color:var(--ink-hint);text-decoration:none;}
.${NP_SCOPE} .np-link.danger:hover{color:var(--np-danger);}
.${NP_SCOPE} .np-detail{margin-top:10px;padding:12px 14px;background:#FBFAF7;border-radius:12px;}
.${NP_SCOPE} .np-detail .np-meta{font-size:12.5px;color:var(--ink-soft);margin-bottom:8px;}
.${NP_SCOPE} .np-foot{font-size:12.5px;color:var(--ink-hint);line-height:1.7;margin-top:26px;}

/* Một cột: thứ tự đọc phải là nguồn → mẫu → thiết lập → xem trước → xuất,
   nên hai cột "tan ra" thành các thẻ rời rồi xếp lại bằng order. */
@media(max-width:1023px){
  .${NP_SCOPE} .np-grid{display:flex;flex-direction:column;gap:16px;align-items:stretch;}
  .${NP_SCOPE} .np-col{display:contents;}
  .${NP_SCOPE} h1{font-size:26px;}
  .${NP_SCOPE} .np-o-note{order:5;}
  .${NP_SCOPE} .np-o-source{order:10;}
  .${NP_SCOPE} .np-o-list{order:15;}
  .${NP_SCOPE} .np-o-preset{order:20;}
  .${NP_SCOPE} .np-o-settings{order:30;}
  .${NP_SCOPE} .np-o-preview{order:40;}
  .${NP_SCOPE} .np-o-export{order:50;}
  .${NP_SCOPE} .np-o-diag{order:60;}
  .${NP_SCOPE} .np-o-look{order:35;}
  .${NP_SCOPE} .np-o-more{order:70;}
  .${NP_SCOPE} .np-prev-body{max-height:62vh;}
  .${NP_SCOPE} .np-fit-page .np-page img{height:calc(62vh - 118px);}
  .${NP_SCOPE} .np-loaded{grid-template-columns:1fr;}
  .${NP_SCOPE} .np-focus{grid-template-columns:1fr;}
  .${NP_SCOPE} .np-focus .np-col:first-child{display:contents;}
  .${NP_SCOPE} .np-prev-bar{padding:10px 12px;}
  /* Hẹp thì xuống hai hàng cho ra dáng có chủ ý: hàng trên là mức phóng,
     hàng dưới là hai kiểu xem chia đôi đều nhau. */
  .${NP_SCOPE} .np-zoom{width:100%;gap:6px;}
  .${NP_SCOPE} .np-zstep{flex:1 1 100%;}
  .${NP_SCOPE} .np-zstep .np-zval{flex:1;}
  .${NP_SCOPE} .np-zwide{flex:1 1 0;min-width:0;}
  .${NP_SCOPE} .np-zbtn{font-size:12.5px;padding:0 8px;min-height:34px;}
}
`;
