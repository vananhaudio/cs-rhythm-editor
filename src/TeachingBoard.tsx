import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { Theme } from '../App';

type Tool = 'pen' | 'eraser' | 'text' | 'line' | 'rect' | 'circle';

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: Tool;
}

interface TextItem {
  id: string;
  // cssX/cssY: position in container px (for layout)
  // These are also used for canvas draw — canvas == container size so 1:1
  cssX: number;
  cssY: number;
  text: string;
  color: string;
  size: number;
}

interface ActiveText {
  cssX: number;
  cssY: number;
}

const PALETTE = [
  '#1a1a1a', '#ffffff', '#e53e3e', '#3182ce', '#38a169',
  '#d69e2e', '#9b2c2c', '#2b6cb0', '#276749', '#b7791f',
  '#f6e05e', '#fc8181', '#90cdf4', '#9ae6b4',
];

const LIGHT_PALETTE = [
  '#1a1a1a', '#444444', '#e53e3e', '#2b6cb0', '#276749',
  '#b7791f', '#c53030', '#1a365d', '#1c4532', '#744210',
  '#d69e2e', '#fc8181', '#63b3ed', '#68d391',
];

// Line height multiplier used consistently for canvas draw and textarea sizing
const LINE_HEIGHT = 1.3;

export default function TeachingBoard({ theme }: { theme: Theme }) {
  const isDark = theme === 'dark';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(isDark ? '#ffffff' : '#1a1a1a');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [undoStack, setUndoStack] = useState<{ strokes: Stroke[]; texts: TextItem[] }[]>([]);
  const [fontSize, setFontSize] = useState(24);
  const [activeText, setActiveText] = useState<ActiveText | null>(null);

  // Refs to avoid stale closures in raw canvas event handlers
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const strokeWidthRef = useRef(strokeWidth);
  const fontSizeRef = useRef(fontSize);
  const isDarkRef = useRef(isDark);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { fontSizeRef.current = fontSize; }, [fontSize]);
  useEffect(() => { isDarkRef.current = isDark; }, [isDark]);

  const strokesRef = useRef(strokes);
  const textsRef = useRef(texts);
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);
  useEffect(() => { textsRef.current = texts; }, [texts]);

  const isDrawing = useRef(false);
  const currentPoints = useRef<{ x: number; y: number }[]>([]);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const palette = isDark ? PALETTE : LIGHT_PALETTE;

  useEffect(() => { setColor(isDark ? '#ffffff' : '#1a1a1a'); }, [isDark]);

  const bg = isDark ? '#1c1c24' : '#ffffff';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
  const panelBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
  const labelColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  const btnBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const btnText = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';

  const redrawFromState = useCallback((strokeList: Stroke[], textList: TextItem[]) => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bgColor = isDarkRef.current ? '#1c1c24' : '#ffffff';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const s of strokeList) {
      if (s.points.length < 2) continue;
      ctx.save();
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = s.tool === 'eraser' ? bgColor : s.color;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      if (s.tool === 'line') {
        ctx.lineTo(s.points[s.points.length - 1].x, s.points[s.points.length - 1].y);
      } else if (s.tool === 'rect') {
        const p1 = s.points[s.points.length - 1];
        ctx.rect(s.points[0].x, s.points[0].y, p1.x - s.points[0].x, p1.y - s.points[0].y);
      } else if (s.tool === 'circle') {
        const p1 = s.points[s.points.length - 1];
        const rx = Math.abs(p1.x - s.points[0].x) / 2;
        const ry = Math.abs(p1.y - s.points[0].y) / 2;
        ctx.ellipse((s.points[0].x + p1.x) / 2, (s.points[0].y + p1.y) / 2, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
      } else {
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    for (const t of textList) {
      const lines = t.text.split('\n');
      ctx.save();
      ctx.font = `${t.size}px system-ui, sans-serif`;
      ctx.fillStyle = t.color;
      // cssY is top of textarea; fillText baseline = top + size
      lines.forEach((line, i) => {
        ctx.fillText(line, t.cssX, t.cssY + t.size + i * t.size * LINE_HEIGHT);
      });
      ctx.restore();
    }
  }, []);

  useEffect(() => { redrawFromState(strokes, texts); }, [strokes, texts, redrawFromState, isDark]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!container || !canvas || !overlay) return;
    const sync = () => {
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      if (w === 0 || h === 0) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        overlay.width = w; overlay.height = h;
        redrawFromState(strokesRef.current, textsRef.current);
      }
    };
    sync();
    const obs = new ResizeObserver(sync);
    obs.observe(container);
    return () => obs.disconnect();
  }, [redrawFromState]);

  // Auto-resize textarea height as user types
  const autoResizeTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  };

  // Focus textarea when activeText is set — use rAF to avoid immediate blur from canvas
  useEffect(() => {
    if (activeText) {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.value = '';
      ta.style.height = `${fontSizeRef.current * LINE_HEIGHT}px`;
      // Two rAF frames: let React finish painting + browser settle focus
      requestAnimationFrame(() => requestAnimationFrame(() => { ta.focus(); }));
    }
  }, [activeText]);

  const commitActiveText = useCallback(() => {
    const ta = textareaRef.current;
    const text = ta?.value.trim() ?? '';
    setActiveText(null);
    if (!text || !activeText) return;
    setUndoStack(prev => [...prev.slice(-30), { strokes: strokesRef.current, texts: textsRef.current }]);
    setTexts(prev => [...prev, {
      id: Date.now().toString(),
      cssX: activeText.cssX,
      cssY: activeText.cssY,
      text,
      color: colorRef.current,
      size: fontSizeRef.current,
    }]);
  }, [activeText]);

  // Get position relative to container div (not canvas element)
  const getContainerPos = (e: React.MouseEvent): { cssX: number; cssY: number } => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { cssX: e.clientX - rect.left, cssY: e.clientY - rect.top };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (toolRef.current === 'text') {
      // Commit any open text first, then open new editor at click position
      commitActiveText();
      const pos = getContainerPos(e);
      // Use setTimeout 0 so commitActiveText state update settles before opening new
      setTimeout(() => setActiveText(pos), 0);
      return;
    }
    if (activeText) { commitActiveText(); return; }
    isDrawing.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.currentTarget.width / rect.width;
    const sy = e.currentTarget.height / rect.height;
    const pos = { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
    startPos.current = pos;
    currentPoints.current = [pos];
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.currentTarget.width / rect.width;
    const sy = e.currentTarget.height / rect.height;
    const pos = { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
    currentPoints.current.push(pos);

    const t = toolRef.current;
    const c = colorRef.current;
    const w = strokeWidthRef.current;
    const bgColor = isDarkRef.current ? '#1c1c24' : '#ffffff';

    if (t === 'pen' || t === 'eraser') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const pts = currentPoints.current;
      if (pts.length < 2) return;
      ctx.save();
      ctx.strokeStyle = t === 'eraser' ? bgColor : c;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
      ctx.restore();
    } else {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.save();
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      const p0 = startPos.current!;
      ctx.beginPath();
      if (t === 'line') {
        ctx.moveTo(p0.x, p0.y); ctx.lineTo(pos.x, pos.y);
      } else if (t === 'rect') {
        ctx.rect(p0.x, p0.y, pos.x - p0.x, pos.y - p0.y);
      } else if (t === 'circle') {
        const rx = Math.abs(pos.x - p0.x) / 2;
        const ry = Math.abs(pos.y - p0.y) / 2;
        ctx.ellipse((p0.x + pos.x) / 2, (p0.y + pos.y) / 2, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.restore();
    }
  };

  const commitStroke = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const overlay = overlayRef.current;
    if (overlay) overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
    const pts = currentPoints.current;
    if (pts.length >= 2) {
      setUndoStack(prev => [...prev.slice(-30), { strokes: strokesRef.current, texts: textsRef.current }]);
      setStrokes(prev => [...prev, { points: [...pts], color: colorRef.current, width: strokeWidthRef.current, tool: toolRef.current }]);
    }
    currentPoints.current = [];
    startPos.current = null;
  };

  const undo = () => {
    if (!undoStack.length) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setStrokes(last.strokes);
    setTexts(last.texts);
  };

  const clearAll = () => {
    setUndoStack(prev => [...prev.slice(-30), { strokes: [...strokes], texts: [...texts] }]);
    setStrokes([]);
    setTexts([]);
  };

  const toolDefs: { id: Tool; label: string; icon: React.ReactNode }[] = [
    { id: 'pen', label: 'Bút vẽ', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg> },
    { id: 'line', label: 'Đường thẳng', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="4" y1="20" x2="20" y2="4"/></svg> },
    { id: 'rect', label: 'Hình chữ nhật', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
    { id: 'circle', label: 'Elip', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="12" rx="10" ry="7"/></svg> },
    { id: 'text', label: 'Chữ — click vào bảng rồi gõ', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> },
    { id: 'eraser', label: 'Tẩy', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16l13-13 7 7-3 3"/><line x1="6" y1="14" x2="14" y2="6"/></svg> },
  ];

  return (
    <div style={{
      background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.025)',
      border: `1px solid ${borderColor}`,
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '5px 10px',
        borderBottom: `1px solid ${borderColor}`, background: panelBg,
        gap: 6, flexShrink: 0, overflowX: 'auto',
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: labelColor, whiteSpace: 'nowrap', marginRight: 2 }}>Thầy Văn Anh Guitar</span>

        <div style={{ display: 'flex', gap: 2, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderRadius: 8, padding: 2, border: `1px solid ${btnBorder}`, flexShrink: 0 }}>
          {toolDefs.map(td => (
            <button key={td.id} title={td.label} onClick={() => setTool(td.id)}
              style={{
                width: 24, height: 24, borderRadius: 5, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: tool === td.id ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)') : 'transparent',
                color: tool === td.id ? (isDark ? '#fff' : '#111') : btnText,
                transition: 'all 0.15s',
                outline: tool === td.id ? `1.5px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}` : 'none',
              }}
            >{td.icon}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 2, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderRadius: 8, padding: 2, border: `1px solid ${btnBorder}`, flexShrink: 0 }}>
          {[2, 4, 8, 14].map(w => (
            <button key={w} title={`Nét ${w}px`} onClick={() => setStrokeWidth(w)}
              style={{
                width: 24, height: 24, borderRadius: 5, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: strokeWidth === w ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)') : 'transparent',
                outline: strokeWidth === w ? `1.5px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}` : 'none',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ width: Math.min(w + 1, 14), height: Math.min(w + 1, 14), borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' }} />
            </button>
          ))}
        </div>

        {tool === 'text' && (
          <select value={fontSize} onChange={e => setFontSize(Number(e.target.value))}
            style={{
              height: 26, padding: '0 6px', borderRadius: 6, fontSize: 11,
              border: `1px solid ${btnBorder}`,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)',
              cursor: 'pointer', outline: 'none', flexShrink: 0,
            }}
          >
            {[16, 20, 24, 30, 36, 48, 64].map(s => <option key={s} value={s}>{s}px</option>)}
          </select>
        )}

        <div style={{ width: 1, height: 20, background: borderColor, flexShrink: 0 }} />

        <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
          {palette.map(c => (
            <button key={c} title={c} onClick={() => setColor(c)}
              style={{
                width: 16, height: 16, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: c,
                outline: color === c ? `2px solid ${isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'}` : `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                outlineOffset: color === c ? 2 : 0,
                transition: 'outline-offset 0.1s', flexShrink: 0,
              }}
            />
          ))}
          <input type="color" value={color} onChange={e => setColor(e.target.value)} title="Màu tùy chỉnh"
            style={{ width: 16, height: 16, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0, background: 'transparent', flexShrink: 0 }}
          />
        </div>

        <div style={{ width: 1, height: 20, background: borderColor, flexShrink: 0 }} />

        <button onClick={undo} disabled={!undoStack.length} title="Hoàn tác"
          style={{
            height: 26, padding: '0 8px', borderRadius: 6, border: `1px solid ${btnBorder}`,
            background: 'transparent', cursor: undoStack.length ? 'pointer' : 'default',
            color: undoStack.length ? btnText : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'),
            fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
          Hoàn tác
        </button>
        <button onClick={clearAll} title="Xóa bảng"
          style={{
            height: 26, padding: '0 8px', borderRadius: 6, border: '1px solid rgba(229,62,62,0.35)',
            background: 'transparent', cursor: 'pointer', color: '#e53e3e', fontSize: 11, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Xóa bảng
        </button>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} style={{ position: 'relative', width: '100%', height: 900, background: bg }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} preserveAspectRatio="none">
          {[18, 27, 36, 45, 54, 68, 77, 86, 95].map((pct, i) => (
            <line key={i} x1="0" y1={`${pct}%`} x2="100%" y2={`${pct}%`}
              stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'} strokeWidth="1" />
          ))}
        </svg>

        {/* Drawing canvas */}
        <canvas
          ref={canvasRef}
          tabIndex={-1}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1,
            cursor: tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair',
            // Hide behind click-capture overlay when text editor is open
            pointerEvents: activeText ? 'none' : 'auto',
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={commitStroke}
          onMouseLeave={commitStroke}
        />

        {/* Shape preview overlay */}
        <canvas
          ref={overlayRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}
        />

        {/* When text editor is open: full-area click-capture div to commit on click-outside */}
        {activeText && (
          <div
            style={{ position: 'absolute', inset: 0, zIndex: 8, cursor: 'text' }}
            onMouseDown={e => {
              // Only commit if clicking outside the textarea itself
              if (e.target !== textareaRef.current) commitActiveText();
            }}
          />
        )}

        {/* Textarea — transparent, sits directly on canvas at click position */}
        {activeText && (
          <textarea
            ref={textareaRef}
            rows={1}
            onInput={autoResizeTextarea}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Escape') { e.preventDefault(); setActiveText(null); }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitActiveText(); }
            }}
            style={{
              position: 'absolute',
              left: activeText.cssX,
              top: activeText.cssY,
              zIndex: 10,
              fontSize: fontSize,
              lineHeight: LINE_HEIGHT,
              fontFamily: 'system-ui, sans-serif',
              color: color,
              caretColor: color,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              overflow: 'hidden',
              padding: 0,
              margin: 0,
              width: `calc(100% - ${activeText.cssX}px - 8px)`,
              borderBottom: `2px solid ${color}`,
              boxSizing: 'border-box',
              wordBreak: 'break-word',
            }}
          />
        )}

      </div>
    </div>
  );
}
