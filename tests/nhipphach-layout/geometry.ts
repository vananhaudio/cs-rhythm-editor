/** Đọc hình học khắc nhạc từ SVG Verovio — chỉ nốt/vạch nhịp/khuông, KHÔNG đọc nhãn phách. */
export interface PageGeometry {
  systems: number;
  measures: { id: string; x: number; width: number }[];
  notes: { id: string; x: number; y: number }[];
  barlines: number[];
  staffWidths: number[];
  /** Tung độ dòng kẻ của từng khuông — bắt mọi xê dịch dọc, kể cả khoảng cách tới TAB. */
  staffYs: number[];
}
export interface ScoreGeometry {
  pages: PageGeometry[];
  pageCount: number;
  systemCount: number;
}

/** Duyệt cây <g> bằng con trỏ, đủ để lấy phạm vi của từng measure. */
function spans(svg: string, cls: string): { id: string; from: number; to: number }[] {
  const out: { id: string; from: number; to: number }[] = [];
  const re = new RegExp(`<g\\b[^>]*class="${cls}"[^>]*>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    const id = /id="([^"]+)"/.exec(m[0])?.[1] ?? "";
    // Tìm </g> khớp theo độ sâu.
    let depth = 1, i = m.index + m[0].length;
    while (depth > 0) {
      const open = svg.indexOf("<g", i), close = svg.indexOf("</g>", i);
      if (close < 0) break;
      if (open >= 0 && open < close) {
        const tag = /^<g\b[^>]*?(\/?)>/.exec(svg.slice(open, svg.indexOf(">", open) + 1));
        if (!tag?.[1]) depth++;
        i = svg.indexOf(">", open) + 1;
      } else { depth--; i = close + 4; }
    }
    out.push({ id, from: m.index, to: i });
  }
  return out;
}

export function pageGeometry(svg: string): PageGeometry {
  const measures = spans(svg, "measure");
  const notes: { id: string; x: number; y: number }[] = [];
  const barlines: number[] = [];
  const staffWidths: number[] = [];
  for (const ms of measures) {
    const body = svg.slice(ms.from, ms.to);
    for (const n of spans(body, "note")) {
      const head = /<use[^>]*transform="translate\((-?[\d.]+),\s*(-?[\d.]+)\)/.exec(
        body.slice(n.from, n.to)
      );
      if (head) notes.push({ id: n.id, x: +head[1], y: +head[2] });
    }
    for (const b of spans(body, "barLine")) {
      const p = /<path d="M(-?[\d.]+)\s/.exec(body.slice(b.from, b.to));
      if (p) barlines.push(+p[1]);
    }
    for (const s of spans(body, "staff")) {
      const line = /<path d="M(-?[\d.]+)\s+-?[\d.]+\s+L(-?[\d.]+)\s/.exec(
        body.slice(s.from, s.to)
      );
      if (line) staffWidths.push(+line[2] - +line[1]);
    }
  }
  const staffYs: number[] = [];
  for (const ms of measures) {
    const body = svg.slice(ms.from, ms.to);
    for (const s of spans(body, "staff"))
      for (const line of body
        .slice(s.from, s.to)
        .matchAll(/<path d="M(-?[\d.]+)\s+(-?[\d.]+)\s+L(-?[\d.]+)\s+(-?[\d.]+)"/g))
        if (line[2] === line[4]) staffYs.push(+line[2]);
  }
  const boxes = measures.map((ms) => {
    const body = svg.slice(ms.from, ms.to);
    const xs: number[] = [];
    for (const s of spans(body, "staff")) {
      const line = /<path d="M(-?[\d.]+)\s+-?[\d.]+\s+L(-?[\d.]+)\s/.exec(
        body.slice(s.from, s.to)
      );
      if (line) xs.push(+line[1], +line[2]);
    }
    const x = xs.length ? Math.min(...xs) : NaN;
    return { id: ms.id, x, width: xs.length ? Math.max(...xs) - x : NaN };
  });
  return {
    systems: spans(svg, "system").length,
    measures: boxes,
    notes,
    barlines,
    staffWidths,
    staffYs,
  };
}

export function scoreGeometry(pages: { svg: string }[]): ScoreGeometry {
  const g = pages.map((p) => pageGeometry(p.svg));
  return {
    pages: g,
    pageCount: g.length,
    systemCount: g.reduce((s, p) => s + p.systems, 0),
  };
}
