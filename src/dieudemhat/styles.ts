// ── ĐIỆU ĐỆM HÁT — style (nhận diện Class: cream, indigo, Be Vietnam Pro) ──
export const C = {
  bg: '#F7F5FC', paper: '#FFFFFF', ink: '#1D1930', inkSoft: '#3E3952', inkFaint: '#6A6580',
  indigo: '#4338CA', indigoTint: '#EDEBFB', line: '#E4E0F0', honey: '#A85F0E', honeyTint: '#FBF3E6',
}

export const DIEUDEMHAT_CSS = `
.ddh,.ddh-app{color:${C.ink};font-family:'Be Vietnam Pro',system-ui,sans-serif;font-size:16px;line-height:1.6;text-align:left;}
.ddh{max-width:720px;margin:0 auto;padding:0 16px 40px;}
.ddh h1,.ddh h2,.ddh h3,.ddh-app h2,.ddh-app h3{color:${C.ink};font-family:inherit;letter-spacing:0;margin:0;}
.ddh code,.ddh-app code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;background:${C.bg};color:${C.ink};border-radius:6px;padding:2px 7px;white-space:normal;overflow-wrap:anywhere;}
.ddh-hero{padding:28px 0 8px;}
.ddh-hero h1{margin:6px 0;font-size:34px;line-height:1.15;font-weight:800;}
.ddh-eyebrow{margin:0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${C.indigo};}
.ddh-lead{margin:6px 0 0;color:${C.inkSoft};}
.ddh-small{margin:6px 0 0;font-size:14px;color:${C.inkFaint};}
.ddh-kicker{margin:0 0 4px;font-size:13px;font-weight:700;color:${C.honey};}
.ddh-meter{font-size:13px;font-weight:700;color:${C.indigo};background:${C.indigoTint};border-radius:999px;padding:2px 10px;}
.ddh-list{margin:10px 0 0;padding-left:20px;}
.ddh-list li{margin:4px 0;}

/* ── nội dung bước ── */
.ddh-title{font-size:32px;font-weight:800;line-height:1.15;margin:4px 0 0 !important;}
.ddh-h2{font-size:22px;font-weight:800;margin:0 0 10px !important;}
.ddh-quick-k{margin-top:16px;color:${C.inkFaint};}
.ddh-quick,.ddh-mini{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:6px;}
.ddh-quick li,.ddh-mini li{display:grid;grid-template-columns:92px 1fr;gap:8px;align-items:baseline;padding:8px 12px;background:${C.bg};border-radius:10px;}
.ddh-quick b,.ddh-mini b{color:${C.indigo};}
.ddh-pattern-h{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:10px;}
.ddh-pattern-h h3{font-size:22px;font-weight:800;line-height:1.25;}
.ddh-option{font-size:12px;font-weight:700;color:#fff;background:${C.honey};border-radius:999px;padding:2px 10px;}
.ddh-tempo{font-size:14px;color:${C.inkFaint};}
.ddh-sym{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin:12px 0 0;}
.ddh-sym-k{font-size:13px;font-weight:700;color:${C.inkFaint};}
.ddh-howto{margin:12px 0 0;font-weight:600;font-size:17px;}
.ddh-sym-main{margin:4px 0 0;}
.ddh-sym-main code{display:block;font-size:18px;padding:14px;text-align:center;border-radius:12px;background:#fff;border:1px solid ${C.line};}
.ddh-more{margin:14px 0 0;border-top:1px solid ${C.line};padding-top:8px;}
.ddh-more summary{cursor:pointer;font-size:14px;font-weight:700;color:${C.indigo};list-style:none;}
.ddh-more summary::-webkit-details-marker{display:none;}
.ddh-more summary::before{content:'+ ';}
.ddh-more[open] summary::before{content:'− ';}
.ddh-choice{margin:12px 0 0;font-weight:600;color:${C.inkSoft};}

/* ── ô nhịp StrumScore ── */
.ddh-bar{background:#fff;border:1px solid ${C.line};border-radius:14px;padding:10px 10px 6px;}
.ddh-bar-nums{display:grid;padding:0 4px;margin-bottom:2px;}
.ddh-bar-nums span{text-align:center;font-size:12px;font-weight:700;color:${C.inkFaint};}
.ddh-bar-row{display:flex;align-items:stretch;}
.ddh-bar-line{width:2px;background:${C.ink};border-radius:1px;}
.ddh-bar-line.end{width:4px;box-shadow:-5px 0 0 -3px ${C.ink};}
.ddh-bar-beats{flex:1;display:grid;align-items:center;justify-items:center;padding:4px 2px;min-width:0;}

/* ── điểm thực hành: App = một màn nhiệm vụ ── */
.ddh-practice{text-align:center;padding:28px 16px;background:${C.honeyTint};border-radius:18px;}
.ddh-practice-icon{font-size:40px;line-height:1;}
.ddh-practice-k{margin:10px 0 0;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.honey};}
.ddh-practice-task{margin:12px auto 0;max-width:420px;font-size:20px;font-weight:800;line-height:1.4;}
.ddh-practice-cue{margin:14px auto 0;max-width:420px;color:${C.inkSoft};}
.ddh-practice-cue::before{content:'✓ ';color:${C.honey};font-weight:800;}
/* ── điểm thực hành: Sách = box nhỏ ── */
.ddh-practice-box{border-left:4px solid ${C.honey};background:${C.honeyTint};border-radius:0 10px 10px 0;padding:10px 14px;}
.ddh-practice-box p{margin:0;}
.ddh-practice-box-k{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${C.honey};}
.ddh-practice-box-task{margin-top:2px !important;font-weight:700;}
.ddh-practice-box-cue{margin-top:2px !important;font-size:14px;color:${C.inkSoft};}
.ddh-practice-box-cue::before{content:'✓ ';color:${C.honey};font-weight:800;}

/* ── ghép cả bài ── */
.ddh-flow{display:flex;flex-direction:column;}
.ddh-flow-arrow{text-align:center;color:${C.indigo};font-weight:800;line-height:1.4;}
.ddh-flow-box{display:grid;grid-template-columns:92px 1fr;gap:8px;padding:9px 14px;border:2px solid ${C.indigo};border-radius:12px;background:#fff;}
.ddh-flow-box b{color:${C.indigo};text-transform:uppercase;font-size:13px;letter-spacing:.04em;padding-top:2px;}
.ddh-reuse{margin:12px 0 0;padding:10px 14px;background:${C.indigoTint};border-radius:12px;}
.ddh-task{padding:16px;border-radius:14px;background:${C.honeyTint};border-left:4px solid ${C.honey};font-weight:600;font-size:17px;}
.ddh-method{text-align:center;font-weight:800;color:${C.indigo};margin:22px 0 0;}

/* ── APP: từng bước một màn (quy tắc FlowPlayer) ── */
.ddh-app{height:100dvh;display:flex;flex-direction:column;background:${C.bg};}
.ddh-app-top{flex:none;display:flex;align-items:center;gap:12px;padding:12px 16px 8px;background:${C.paper};}
.ddh-app-back{flex:none;width:36px;height:36px;border-radius:10px;background:${C.indigoTint};color:${C.indigo};display:flex;align-items:center;justify-content:center;font-size:20px;text-decoration:none;}
.ddh-app-name{flex:1;min-width:0;font-weight:800;font-size:16px;line-height:1.25;}
.ddh-app-name span{display:block;font-weight:600;font-size:13px;color:${C.inkFaint};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ddh-app-count{flex:none;font-size:13px;font-weight:700;color:${C.inkFaint};}
.ddh-app-progress{flex:none;height:4px;background:${C.line};}
.ddh-app-progress div{height:100%;background:${C.indigo};transition:width .2s;}
.ddh-app-body{flex:1;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:16px;max-width:560px;width:100%;margin:0 auto;box-sizing:border-box;}
.ddh-app-nav{flex:none;display:flex;gap:10px;padding:12px 16px calc(env(safe-area-inset-bottom,0px) + 14px);background:${C.paper};border-top:1px solid ${C.line};}
.ddh-app-nav button{flex:1;padding:14px;border:none;border-radius:14px;background:${C.indigo};color:#fff;font:inherit;font-weight:800;font-size:16px;cursor:pointer;}
.ddh-app-nav button.ghost{flex:0 0 34%;background:${C.paper};color:${C.inkSoft};border:1px solid ${C.line};}
.ddh-app-nav button:disabled{opacity:.35;cursor:default;}

/* ── SÁCH: trang nối tiếp, nhiều khoảng trắng ── */
.ddh-book{padding-top:12px;}
.ddh-book-sec{background:${C.paper};border:1px solid ${C.line};border-radius:18px;padding:24px 18px;margin:18px 0;}
.ddh-book-practice{background:transparent;border:none;padding:0;margin:-8px 0 24px;}
.ddh-book-step{margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${C.indigo};}

/* ── trang chọn điệu ── */
.ddh-index{display:grid;gap:12px;margin-top:18px;}
.ddh-index-card{display:block;text-decoration:none;color:inherit;background:${C.paper};border:1px solid ${C.line};border-radius:16px;padding:16px;}
.ddh-index-card:hover{border-color:${C.indigo};}
.ddh-index-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.ddh-index-name{font-size:22px;font-weight:800;}
.ddh-index-go{display:inline-block;margin-top:10px;font-weight:700;color:${C.indigo};}

@media (min-width:720px){.ddh-hero h1{font-size:42px;}.ddh-index{grid-template-columns:repeat(3,1fr);}.ddh-book-sec{padding:28px 32px;}}
@media print{
  .ddh-book-sec{border:none;border-radius:0;padding:0;margin:0 0 28px;}
  .ddh-book-pattern,.ddh-book-assemble,.ddh-book-exercise{break-before:page;}
  .ddh-book-practice{margin:-12px 0 28px;break-before:avoid;}
  .ddh-practice-box{border-left-color:#666;background:none;border:1px solid #999;border-left:4px solid #666;}
  .ddh-pattern,.ddh-bar{break-inside:avoid;}
}
`
