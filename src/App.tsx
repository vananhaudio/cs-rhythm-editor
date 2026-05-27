import { useState, useCallback, useRef, useEffect } from 'react';
import './App.css';
import logoSrc from './assets/logo.png'
import { supabase } from './supabase';
import { SongList } from './SongList';
import { PlayerView } from './PlayerView';
import type { RhythmSong, LyricEvent, ChordEvent, PickedItem, SnapMode } from './types';
import {
  createEmptySong, rebuildSong, importFromHopAmViet, parseHopAmViet, parseHopAmVietWithBeatsPerChord,
  importFromJson, downloadJson, formatTime,
  snapTime, beatDuration, barDuration,
  genId, CHORD_SUGGESTIONS, transposeSong, getTransposeLabel,
} from './utils';

// ────────────────────────────────────────────────────────────
// Layout constants
// ────────────────────────────────────────────────────────────
const PADDING = 16;        // px padding trái — display only
const BAR_HEIGHT = 108;    // chiều cao mỗi bar row
const BEAT_NUM_Y = 6;      // y số phách
const CHORD_Y = 50;        // y chord
const LYRIC_Y = 66;        // y lyric — lyric là trung tâm

// ── Time zone ──
function localX(time: number, barStart: number, bd: number, pxPerBeat: number): number {
  return PADDING + ((time - barStart) / bd) * pxPerBeat;
}

function xToTime(
  localPx: number, barStart: number, bd: number,
  timeSig: number, mode: SnapMode, pxPerBeat: number
): number {
  const timeZoneLeft = PADDING;
  const timeZoneRight = PADDING + (timeSig - 1) * pxPerBeat;
  const clampedPx = Math.max(timeZoneLeft, Math.min(timeZoneRight, localPx));
  const rawTime = barStart + ((clampedPx - PADDING) / pxPerBeat) * bd;
  return snapTime(rawTime, 60 / bd, timeSig, mode);
}

// ────────────────────────────────────────────────────────────
// ImportModal — 3 bước: nhập → cài đặt → preview
// ────────────────────────────────────────────────────────────
function ImportModal({ onImport, onClose }: {
  onImport: (t: string, timeSig: number, chordsPerBar: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [step, setStep] = useState<'input' | 'settings' | 'preview'>('input');
  const [selectedTimeSig, setSelectedTimeSig] = useState<2|3|4|6>(4);
  const [chordsPerBar, setChordsPerBar] = useState<1|2>(1);

  const beatsPerChordPreview = Math.max(1, Math.floor(selectedTimeSig / chordsPerBar));
  const tokens = step === 'preview' ? parseHopAmVietWithBeatsPerChord(text, selectedTimeSig, beatsPerChordPreview) : [];
  const chordToks = tokens.filter(t => t.kind === 'chord');
  const lyricToks = tokens.filter(t => t.kind === 'lyric');
  const maxBar = tokens.length > 0 ? Math.floor(Math.max(...tokens.map(t => t.beatOffset)) / selectedTimeSig) + 1 : 0;
  const barPreviews = Array.from({ length: Math.min(maxBar, 8) }, (_, bi) => {
    const bs = bi * selectedTimeSig;
    return {
      bi,
      chord: tokens.find(t => t.kind === 'chord' && t.beatOffset >= bs && t.beatOffset < bs + selectedTimeSig),
      words: tokens.filter(t => t.kind === 'lyric' && t.beatOffset >= bs && t.beatOffset < bs + selectedTimeSig),
    };
  });

  const timeSigOptions: Array<{ value: 2|3|4|6; label: string; desc: string }> = [
    { value: 2, label: '2/4', desc: 'Nhịp march' },
    { value: 3, label: '3/4', desc: 'Nhịp valse' },
    { value: 4, label: '4/4', desc: 'Phổ biến nhất' },
    { value: 6, label: '6/8', desc: 'Nhịp 6' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 580 }} onClick={e => e.stopPropagation()}>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
          {(['Nhập lời', 'Cài đặt', 'Xem trước'] as const).map((s, i) => (
            <div key={i} style={{
              fontSize: 10, fontWeight: 500, padding: '2px 10px', borderRadius: 10,
              background: ['input', 'settings', 'preview'].indexOf(step) === i ? 'var(--brand)' : 'var(--border)',
              color: ['input', 'settings', 'preview'].indexOf(step) === i ? '#fff' : 'var(--text-4)',
              transition: 'all 0.12s',
            }}>{i + 1}. {s}</div>
          ))}
        </div>

        <div className="modal-title">
          {step === 'input' ? 'Import từ HợpÂmViệt' : step === 'settings' ? 'Cài đặt nhịp' : 'Xem trước kết quả'}
        </div>

        {step === 'input' && (
          <>
            <p style={{ color: 'var(--text-3)', fontSize: 12 }}>
              Dán text dạng <code style={{ color: 'var(--chord-red)', background: 'var(--chord-bg)', padding: '1px 4px', borderRadius: 3 }}>[Am]Gọi nàng [F]trên vai</code>
            </p>
            <textarea className="modal-textarea"
              placeholder={"[Am]Gọi nàng trên vai [F]ai yêu ai\n[C]Mùa đông [G]về rồi..."}
              value={text} onChange={e => setText(e.target.value)} autoFocus />
            <div className="modal-actions">
              <button className="btn" onClick={onClose}>Huỷ</button>
              <button className="btn primary" disabled={!text.trim()} onClick={() => setStep('settings')}>Tiếp theo →</button>
            </div>
          </>
        )}

        {step === 'settings' && (
          <>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Loại nhịp</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {timeSigOptions.map(opt => (
                  <button key={opt.value} onClick={() => setSelectedTimeSig(opt.value)} style={{
                    border: `2px solid ${selectedTimeSig === opt.value ? 'var(--brand)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '10px 8px',
                    background: selectedTimeSig === opt.value ? 'var(--brand-light)' : '#fff',
                    cursor: 'pointer', textAlign: 'center', transition: 'all 0.12s',
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: selectedTimeSig === opt.value ? 'var(--brand)' : 'var(--text)', lineHeight: 1 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 4 }}>{opt.desc}</div>
                    {opt.value === 4 && <div style={{ fontSize: 9, color: 'var(--brand)', marginTop: 2, fontWeight: 500 }}>Mặc định</div>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Số hợp âm mỗi ô nhịp</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {([1, 2] as const).map(n => (
                  <button key={n} onClick={() => setChordsPerBar(n)} style={{
                    border: `2px solid ${chordsPerBar === n ? 'var(--brand)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '12px 16px',
                    background: chordsPerBar === n ? 'var(--brand-light)' : '#fff',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: chordsPerBar === n ? 'var(--brand)' : 'var(--text)' }}>
                      {n === 1 ? '1 hợp âm / ô nhịp' : '2 hợp âm / ô nhịp'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)' }}>
                      {n === 1 ? 'Mỗi chord chiếm 1 bar — phổ biến nhất' : '2 chord trong 1 bar — nhịp chuyển nhanh'}
                    </div>
                    {n === 1 && <div style={{ fontSize: 9, color: 'var(--brand)', fontWeight: 500 }}>Mặc định</div>}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setStep('input')}>← Sửa lời</button>
              <button className="btn" onClick={onClose}>Huỷ</button>
              <button className="btn primary" onClick={() => setStep('preview')}>Xem trước →</button>
            </div>
          </>
        )}

        {step === 'preview' && (
          <>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-3)', alignItems: 'center' }}>
              <span>🎵 <strong style={{ color: 'var(--chord-red)' }}>{chordToks.length}</strong> hợp âm</span>
              <span>📝 <strong>{lyricToks.length}</strong> từ lời</span>
              <span>📦 <strong>{maxBar}</strong> ô nhịp</span>
              <span style={{ marginLeft: 'auto', background: 'var(--brand-light)', color: 'var(--brand)', padding: '2px 8px', borderRadius: 4, fontWeight: 500, fontSize: 10 }}>
                {selectedTimeSig}/4 · {chordsPerBar} chord/bar
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {barPreviews.map(({ bi, chord, words }) => (
                <div key={bi} style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${selectedTimeSig},1fr)`, borderBottom: '1px solid var(--border)', padding: '2px 6px', background: 'var(--surface-2)' }}>
                    {Array.from({ length: selectedTimeSig }, (_, b) => (
                      <span key={b} style={{ fontSize: 9, fontWeight: 700, color: b === 0 ? 'var(--beat-strong)' : 'var(--text-4)' }}>{b + 1}</span>
                    ))}
                  </div>
                  <div style={{ padding: '4px 8px 0', minHeight: 24 }}>
                    {chord ? <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--chord-red)' }}>{chord.text}</span> : <span style={{ color: 'var(--text-4)', fontSize: 11 }}>—</span>}
                    <span style={{ float: 'right', fontSize: 9, color: 'var(--text-4)' }}>M{bi + 1}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${selectedTimeSig},1fr)`, padding: '2px 4px 6px', minHeight: 24 }}>
                    {Array.from({ length: selectedTimeSig }, (_, b) => (
                      <div key={b} style={{ borderRight: b < selectedTimeSig - 1 ? '1px solid var(--border)' : 'none', padding: '0 2px', fontSize: 11, color: 'var(--text-2)' }}>
                        {words.filter(w => w.beatOffset === bi * selectedTimeSig + b).map(w => w.text).join(' ')}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setStep('settings')}>← Cài đặt</button>
              <button className="btn" onClick={onClose}>Huỷ</button>
              <button className="btn primary" onClick={() => { alert('chordsPerBar=' + chordsPerBar + ' timeSig=' + selectedTimeSig); onImport(text, selectedTimeSig, chordsPerBar); onClose(); }}>
                ✓ Xác nhận Import
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
// ────────────────────────────────────────────────────────────
// AddEventModal
// ────────────────────────────────────────────────────────────
function AddEventModal({ time, onConfirm, onClose }: {
  time: number;
  onConfirm: (text: string, kind: 'lyric' | 'chord') => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'lyric' | 'chord'>('lyric');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const submit = () => { if (text.trim()) { onConfirm(text.trim(), kind); onClose(); } };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 380, gap: 12 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Thêm tại {formatTime(time)}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['lyric', 'chord'] as const).map(k => (
            <button key={k} className={`btn ${kind === k ? 'primary' : ''}`} onClick={() => setKind(k)}>
              {k === 'lyric' ? '📝 Lời' : '♪ Hợp âm'}
            </button>
          ))}
        </div>
        {kind === 'chord' ? (
          <div>
            <input ref={ref} className="modal-textarea" style={{ minHeight: 'unset', padding: '8px 12px', fontSize: 14 }}
              placeholder="Am, C, G7..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {CHORD_SUGGESTIONS.map(c => <button key={c} className="btn sm" onClick={() => setText(c)}>{c}</button>)}
            </div>
          </div>
        ) : (
          <input ref={ref} className="modal-textarea" style={{ minHeight: 'unset', padding: '8px 12px', fontSize: 14 }}
            placeholder="Nhập từ / lời..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Huỷ</button>
          <button className="btn primary" disabled={!text.trim()} onClick={submit}>Thêm</button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Draggable Chip
// ────────────────────────────────────────────────────────────
function Chip({ ev, kind, label, x, y, snapMode, barStart, bd, timeSig, barDur, pxPerBeat,
  onTimeChange, onDelete, onEditLabel, onDragMove }: {
  ev: { id: string; time: number };
  kind: 'chord' | 'lyric';
  label: string;
  x: number; y: number;
  snapMode: SnapMode;
  barStart: number; bd: number; timeSig: number; barDur: number; pxPerBeat: number;
  onTimeChange: (id: string, kind: 'chord' | 'lyric', newTime: number) => void;
  onDelete: (id: string, kind: 'chord' | 'lyric') => void;
  onEditLabel: (id: string, kind: 'chord' | 'lyric', newText: string) => void;
  onDragMove?: (time: number | null) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(label);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) { setEditText(label); editRef.current?.focus(); editRef.current?.select(); } }, [editing, label]);

  const submitEdit = () => {
    if (editText.trim()) onEditLabel(ev.id, kind, editText.trim());
    setEditing(false);
  };
  const [dragX, setDragX] = useState(x);
  const [tooltip, setTooltip] = useState('');
  const startRef = useRef<{ mouseX: number; chipX: number }>({ mouseX: 0, chipX: 0 });

  // Chỉ sync dragX từ prop khi không đang drag
  useEffect(() => { if (!dragging) setDragX(x); }, [x, dragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editing) return;
    // Không drag nếu click vào nút xóa
    if ((e.target as HTMLElement).classList.contains('chip-del')) return;
    e.stopPropagation();
    e.preventDefault();
    startRef.current = { mouseX: e.clientX, chipX: x };
    setDragX(x);
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - startRef.current.mouseX;
      const newLocalX = startRef.current.chipX + dx;
      setDragX(newLocalX);
      // Tính time preview
      const timeZoneLeft = pxPerBeat; // padding = pxPerBeat
      const timeZoneRight = pxPerBeat + (timeSig - 1) * pxPerBeat + pxPerBeat * 0.99;
      const clampedPx = Math.max(timeZoneLeft, Math.min(timeZoneRight, newLocalX));
      const rawTime = barStart + ((clampedPx - pxPerBeat) / pxPerBeat) * bd;
      const snapped = (() => {
        const s = snapTime(rawTime, 60 / bd, timeSig, snapMode);
        // Nếu snap đúng vào biên bar (phách 1 nhịp sau) thì lùi lại 1 subdivision
        const barEnd = barStart + barDur;
        if (Math.abs(s - barEnd) < 0.001) return barEnd - 0.001;
        return Math.min(s, barEnd - 0.001);
      })();
      setTooltip(formatTime(snapped));
      onDragMove?.(snapped);
    };
    const onUp = (e: MouseEvent) => {
      setDragging(false);
      const dx = e.clientX - startRef.current.mouseX;
      const newLocalX = startRef.current.chipX + dx;
      const tzL = pxPerBeat;
      const tzR = pxPerBeat + (timeSig - 1) * pxPerBeat + pxPerBeat * 0.99;
      const clPx = Math.max(tzL, Math.min(tzR, newLocalX));
      const rawT = barStart + ((clPx - pxPerBeat) / pxPerBeat) * bd;
      const snapped2 = (() => {
        const s = snapTime(rawT, 60 / bd, timeSig, snapMode);
        const barEnd = barStart + barDur;
        if (Math.abs(s - barEnd) < 0.001) return barEnd - 0.001;
        return Math.min(s, barEnd - 0.001);
      })();
      onTimeChange(ev.id, kind, snapped2);
      onDragMove?.(null);
      setTooltip('');
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, barStart, bd, timeSig, snapMode, kind, ev.id, pxPerBeat, onTimeChange]);

  const currentX = dragging ? dragX : x;

  return (
    <div
      style={{
        position: 'absolute',
        left: currentX,
        top: y,
        width: 0,
        overflow: 'visible',
        display: 'flex',
        justifyContent: 'center',
        zIndex: dragging ? 20 : 10,
        pointerEvents: 'auto',
      }}
    >
      <div
        className={`tl-chip tl-${kind} ${dragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onDoubleClick={e => { e.stopPropagation(); setEditing(true); }}
        title={dragging ? tooltip : `${label} @ ${formatTime(ev.time)}`}
      >
        {editing ? (
          <input
            ref={editRef}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onBlur={submitEdit}
            onKeyDown={e => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') setEditing(false); }}
            onMouseDown={e => e.stopPropagation()}
            style={{ width: Math.max(40, editText.length * 9) + 'px', border: 'none', outline: 'none', background: 'transparent', font: 'inherit', color: 'inherit', padding: 0 }}
          />
        ) : label}
        {!dragging && !editing && (
          <span className="chip-del" onClick={e => { e.stopPropagation(); onDelete(ev.id, kind); }}>✕</span>
        )}
      </div>
      {dragging && tooltip && (
        <div className="chip-tooltip">{tooltip}</div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// BarRow
// ────────────────────────────────────────────────────────────
// Định nghĩa các mốc snap trong 1 beat
interface SnapGuide {
  time: number;
  label: string;
  priority: 'beat' | 'half' | 'quarter' | 'triplet' | 'triplet2';
}

function getSnapGuides(barStart: number, bd: number, timeSig: number): SnapGuide[] {
  const guides: SnapGuide[] = [];
  const barEnd = barStart + timeSig * bd - 0.001;
  const add = (time: number, label: string, priority: SnapGuide['priority']) => {
    if (time <= barEnd) guides.push({ time, label, priority });
  };
  for (let b = 0; b < timeSig; b++) {
    const bt = barStart + b * bd;
    add(bt,               `Beat ${b + 1}`, 'beat');
    add(bt + bd * 0.5,   '♪ 1/2',         'half');
    add(bt + bd * 0.25,  '♬ 1/4',         'quarter');
    add(bt + bd * 0.75,  '♬ 3/4',         'quarter');
    add(bt + bd * (1/3), '∤ 1/3',         'triplet');
    add(bt + bd * (2/3), '∤ 2/3',         'triplet2');
  }
  return guides;
}

const SNAP_THRESHOLD_PX: Record<string, number> = {
  beat: 16, half: 12, quarter: 8, triplet: 8, triplet2: 8,
};

const GUIDE_COLORS: Record<string, string> = {
  beat:     '#14532D',
  half:     '#EA580C',
  quarter:  '#CA8A04',
  triplet:  '#7C3AED',
  triplet2: '#9333EA',
};

const GUIDE_WIDTHS: Record<string, number> = {
  beat: 2, half: 1.5, quarter: 1, triplet: 1, triplet2: 1,
};

function BarRow({ barIndex, song, snapMode, pxPerBeat, onTimeChange, onDelete, onEditLabel, onAdd, onInsertBar, onDeleteBar }: {
  barIndex: number;
  song: RhythmSong;
  snapMode: SnapMode;
  pxPerBeat: number;
  onTimeChange: (id: string, kind: 'chord' | 'lyric', newTime: number) => void;
  onDelete: (id: string, kind: 'chord' | 'lyric') => void;
  onEditLabel: (id: string, kind: 'chord' | 'lyric', newText: string) => void;
  onAdd: (time: number) => void;
  onInsertBar: (barIndex: number) => void;
  onDeleteBar: (barIndex: number) => void;
}) {
  const bd = beatDuration(song.tempo);
  const barDur = barDuration(song.tempo, song.timeSignature);
  const barStart = (barIndex - 1) * barDur;
  const barEnd = barStart + barDur;

  const EPS = 1e-6;
  // Event nằm đúng tại barEnd thuộc bar tiếp theo (phách 1 bar mới)
  const barChords = song.chords.filter(c => c.time >= barStart - EPS && c.time < barEnd - EPS);
  const barLyrics = song.lyrics.filter(l => l.time >= barStart - EPS && l.time < barEnd - EPS);

  // Snap guides
  const snapGuides = getSnapGuides(barStart, bd, song.timeSignature);
  // Padding = pxPerBeat để khoảng trước phách 1 = khoảng sau phách cuối
  const barPadding = pxPerBeat;
  const lx = (t: number) => barPadding + ((t - barStart) / bd) * pxPerBeat;
  const [dragTime, setDragTime] = useState<number | null>(null);

  // Tìm guide gần dragTime nhất (trong threshold)
  const activeGuide = dragTime !== null ? (() => {
    let closest: SnapGuide | null = null;
    let minDist = Infinity;
    const _lx = (t: number) => barPadding + ((t - barStart) / bd) * pxPerBeat;
    for (const g of snapGuides) {
      const px = Math.abs(_lx(g.time) - _lx(dragTime));
      const threshold = SNAP_THRESHOLD_PX[g.priority];
      if (px < threshold && px < minDist) { minDist = px; closest = g; }
    }
    return closest;
  })() : null;

  const rowRef = useRef<HTMLDivElement>(null);

  const handleDblClick = (e: React.MouseEvent) => {
    const rect = rowRef.current!.getBoundingClientRect();
    const localPx = e.clientX - rect.left;
    const barPad = pxPerBeat;
    const relPx = localPx - barPad;
    const rawTime = barStart + Math.max(0, Math.min(relPx / pxPerBeat, song.timeSignature - 0.01)) * bd;
    const t = snapTime(rawTime, 60/bd, song.timeSignature, snapMode);
    onAdd(t);
  };

  return (
    <div
      ref={rowRef}
      className="bar-row"
      style={{ height: BAR_HEIGHT, position: 'relative', flex: 1 }}
      onDoubleClick={handleDblClick}
    >
      {/* ── Nhãn bar + action buttons ── */}
      <div className="bar-label-top">M{barIndex}</div>
      <div className="bar-actions">
        <button className="bar-action-btn insert" title="Chèn ô nhịp sau" onClick={e => { e.stopPropagation(); onInsertBar(barIndex); }}>+</button>
        <button className="bar-action-btn delete" title="Xoá ô nhịp này" onClick={e => { e.stopPropagation(); onDeleteBar(barIndex); }}>−</button>
      </div>

      {/* ── Vùng nội dung — full width ── */}
      <div style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>

        {/* Padding trái — display only */}
        <div className="bar-padding left" style={{ width: PADDING }} />

        {/* TIME ZONE: từ beat 1 đến beat cuối */}
        {/* Đường kẻ dọc cho mỗi beat + số phách */}
        {Array.from({ length: song.timeSignature }, (_, b) => {
          const beatTime = barStart + b * bd;
          const px = barPadding + b * pxPerBeat; // tính từ left của content area
          const isStrong = b === 0;
          return (
            <div key={b} style={{
              position: 'absolute', left: px, top: 0,
              width: 0, height: BAR_HEIGHT,
              overflow: 'visible',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              pointerEvents: 'none', zIndex: 1,
            }}>
              {/* Đường kẻ dọc */}
              <div style={{
                position: 'absolute', top: 0,
                width: isStrong ? 1.5 : 1,
                height: '100%',
                background: isStrong ? '#D1D5DB' : '#E5E7EB',
                transform: 'translateX(-50%)',
              }} />
              {/* Số phách */}
              <div className={`beat-num-label ${isStrong ? 'strong' : ''}`}
                style={{ marginTop: BEAT_NUM_Y, transform: 'translateX(-50%)', position: 'relative' }}>
                {b + 1}
              </div>
            </div>
          );
        })}

        {/* ── Snap guide lines — hiện khi đang kéo ── */}
        {dragTime !== null && snapGuides.map((g, i) => {
          const px = lx(g.time);
          const isActive = activeGuide?.time === g.time;
          const distPx = Math.abs(lx(g.time) - lx(dragTime));
          const threshold = SNAP_THRESHOLD_PX[g.priority];
          if (distPx > threshold * 3) return null; // chỉ hiện khi gần
          const opacity = isActive ? 1 : Math.max(0.15, 1 - distPx / (threshold * 3));
          return (
            <div key={i} style={{
              position: 'absolute', left: px, top: 0,
              width: 0, height: BAR_HEIGHT,
              overflow: 'visible', pointerEvents: 'none', zIndex: 8,
            }}>
              <div style={{
                position: 'absolute', top: 0,
                width: GUIDE_WIDTHS[g.priority],
                height: '100%',
                background: GUIDE_COLORS[g.priority],
                transform: 'translateX(-50%)',
                opacity,
                transition: 'opacity 0.05s',
              }} />
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: CHORD_Y - 18,
                  transform: 'translateX(-50%)',
                  background: GUIDE_COLORS[g.priority],
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  padding: '1px 5px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                  zIndex: 9,
                }}>
                  {g.label}
                </div>
              )}
            </div>
          );
        })}



        {/* ── Chord chips ── */}
        {barChords.map(ev => (
          <Chip
            key={ev.id}
            ev={ev}
            kind="chord"
            label={ev.name}
            x={lx(ev.time)}
            y={CHORD_Y}
            snapMode={snapMode}
            barStart={barStart}
            bd={bd}
            timeSig={song.timeSignature}
            barDur={barDur}
            pxPerBeat={pxPerBeat}
            onTimeChange={onTimeChange}
            onDelete={onDelete}
            onEditLabel={onEditLabel}
            onDragMove={setDragTime}
          />
        ))}

        {/* ── Lyric chips ── */}
        {barLyrics.map(ev => (
          <Chip
            key={ev.id}
            ev={ev}
            kind="lyric"
            label={ev.text}
            x={lx(ev.time)}
            y={LYRIC_Y}
            snapMode={snapMode}
            barStart={barStart}
            bd={bd}
            timeSig={song.timeSignature}
            barDur={barDur}
            pxPerBeat={pxPerBeat}
            onTimeChange={onTimeChange}
            onDelete={onDelete}
            onEditLabel={onEditLabel}
            onDragMove={setDragTime}
          />
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// App
// ────────────────────────────────────────────────────────────
export default function App() {
  const [song, setSong] = useState<RhythmSong>(() => {
    try {
      const raw = localStorage.getItem('csre-player-song');
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return createEmptySong({ totalBars: 16 });
  });
  const [snapMode, setSnapMode] = useState<SnapMode>('beat');
  const [barsPerRow, setBarsPerRow] = useState(4);
  const [isDirty, setIsDirty] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSongList, setShowSongList] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false)
  const [lyricSize, setLyricSize] = useState(17);
  const [transposeSteps, setTransposeSteps] = useState(0);
  const [ytEditorTime, setYtEditorTime] = useState<number>(0);
  const [showYtEditor, setShowYtEditor] = useState(false);
  const [ytCurrentTime, setYtCurrentTime] = useState<number>(0);
  const [ytInput1, setYtInput1] = useState('');
  const [ytInput2, setYtInput2] = useState('');
  const ytTestStartRef = useRef<number>(0);
  const ytTimerBaseRef = useRef<number>(0);
  const [ytMark1, setYtMark1] = useState<{t: number; bar: number} | null>(null);
  const [ytMark2, setYtMark2] = useState<{t: number; bar: number} | null>(null);
  const [ytMark1Bar, setYtMark1Bar] = useState(1);
  const [ytMark2Bar, setYtMark2Bar] = useState(2);
  const ytEditorRef = useRef<any>(null);
  const ytEditorReadyRef = useRef(false);

  const [addTarget, setAddTarget] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.style.setProperty("--lyric-size", lyricSize + "px")
    document.documentElement.style.setProperty("--chord-size", lyricSize + "px")
  }, [lyricSize])

  // ── Undo / Redo ──
  const MAX_HISTORY = 50;
  const historyRef = useRef<RhythmSong[]>([]);
  const futureRef = useRef<RhythmSong[]>([]);

  const pushHistory = useCallback((prev: RhythmSong) => {
    historyRef.current = [...historyRef.current.slice(-MAX_HISTORY + 1), prev];
    futureRef.current = [];
  }, []);

  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setSong(current => {
      futureRef.current = [current, ...futureRef.current.slice(0, MAX_HISTORY - 1)];
      return prev;
    });
    setIsDirty(true);
  }, []);

  const handleRedo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    setSong(current => {
      historyRef.current = [...historyRef.current.slice(-MAX_HISTORY + 1), current];
      return next;
    });
    setIsDirty(true);
  }, []);
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorWidth, setEditorWidth] = useState(800);

  // Tính pxPerBeat dựa trên width thực — fit ngang màn hình
  // availableWidth = editorWidth - PADDING (trái)
  // totalBeats = barsPerRow * timeSignature
  // Bar width = PADDING_trái + timeSig*pxPerBeat
  // Phách 4 tự có khoảng sau = 1 beat → cân bằng tự nhiên
  const pxPerBeat = Math.floor(
    (editorWidth - PADDING) / (barsPerRow * (song.timeSignature + 1))
  );

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setEditorWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddTarget(null);
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handleUndo, handleRedo]);

  // setSong wrapper tự động push history + lưu localStorage
  const setSongH = useCallback((updater: (prev: RhythmSong) => RhythmSong) => {
    setSong(prev => {
      pushHistory(prev);
      const next = updater(prev);
      try { localStorage.setItem('csre-player-song', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [pushHistory]);

  const updateField = useCallback(<K extends keyof RhythmSong>(key: K, value: RhythmSong[K]) => {
    setSongH(prev => {
      const next = { ...prev, [key]: value, updatedAt: new Date().toISOString() };
      if (key === 'tempo') {
        // Rescale toàn bộ timing lyrics/chords theo tỷ lệ tempo mới/cũ
        const oldTempo = prev.tempo;
        const newTempo = value as number;
        if (oldTempo > 0 && newTempo > 0 && oldTempo !== newTempo) {
          const ratio = oldTempo / newTempo;
          next.lyrics = prev.lyrics.map(l => ({ ...l, time: parseFloat((l.time * ratio).toFixed(6)) }));
          next.chords = prev.chords.map(c => ({ ...c, time: parseFloat((c.time * ratio).toFixed(6)) }));
        }
        return rebuildSong(next);
      }
      if (['timeSignature', 'totalBars'].includes(key as string)) return rebuildSong(next);
      return next;
    });
    setIsDirty(true);
  }, [setSongH]);

  // ── Drag để đổi time ──
  const handleTimeChange = useCallback((id: string, kind: 'chord' | 'lyric', newTime: number) => {
    setSongH(prev => ({
      ...prev,
      chords: kind === 'chord' ? prev.chords.map(c => c.id === id ? { ...c, time: newTime } : c) : prev.chords,
      lyrics: kind === 'lyric' ? prev.lyrics.map(l => l.id === id ? { ...l, time: newTime } : l) : prev.lyrics,
      updatedAt: new Date().toISOString(),
    }));
    setIsDirty(true);
  }, []);

  const handleEditLabel = useCallback((id: string, kind: 'chord' | 'lyric', newText: string) => {
    setSongH(prev => ({
      ...prev,
      chords: kind === 'chord' ? prev.chords.map(c => c.id === id ? { ...c, name: newText } : c) : prev.chords,
      lyrics: kind === 'lyric' ? prev.lyrics.map(l => l.id === id ? { ...l, text: newText } : l) : prev.lyrics,
      updatedAt: new Date().toISOString(),
    }));
    setIsDirty(true);
  }, []);

  const handleDelete = useCallback((id: string, kind: 'chord' | 'lyric') => {
    setSongH(prev => ({
      ...prev,
      chords: kind === 'chord' ? prev.chords.filter(c => c.id !== id) : prev.chords,
      lyrics: kind === 'lyric' ? prev.lyrics.filter(l => l.id !== id) : prev.lyrics,
      updatedAt: new Date().toISOString(),
    }));
    setIsDirty(true);
  }, []);

  const handleAdd = useCallback((time: number) => { setAddTarget(time); }, []);

  const confirmAdd = useCallback((text: string, kind: 'lyric' | 'chord') => {
    if (addTarget === null) return;
    setSongH(prev => {
      if (kind === 'chord') {
        return { ...prev, chords: [...prev.chords, { id: genId(), name: text, time: addTarget }], updatedAt: new Date().toISOString() };
      } else {
        return { ...prev, lyrics: [...prev.lyrics, { id: genId(), text, time: addTarget }], updatedAt: new Date().toISOString() };
      }
    });
    setIsDirty(true);
    setAddTarget(null);
  }, [addTarget]);

  const handleImport = useCallback((text: string, importTimeSig: number, chordsPerBar: number) => {
    setSongH(prev => {
      // Cập nhật timeSig theo lựa chọn import
      const newTimeSig = importTimeSig as 2|3|4|6;
      const updatedSong = newTimeSig !== prev.timeSignature
        ? rebuildSong({ ...prev, timeSignature: newTimeSig })
        : prev;
      // Parse với chordsPerBar: nếu 2 chords/bar thì ghép 2 chord vào 1 bar
      const { lyrics, chords } = importFromHopAmViet(text, { ...updatedSong, timeSignature: newTimeSig }, chordsPerBar);
      return { ...updatedSong, lyrics, chords, timeSignature: newTimeSig, updatedAt: new Date().toISOString() };
    });
    setIsDirty(true);
  }, []);

  const handleExport = useCallback(() => {
    const origTempo = song.originalTempo ?? song.tempo;
    const ratio = origTempo / song.tempo;
    const exportSong = {
      ...song,
      originalTempo: song.tempo,
      lyrics: song.lyrics.map(l => ({ ...l, time: +(l.time * ratio).toFixed(10) })),
      chords: song.chords.map(c => ({ ...c, time: +(c.time * ratio).toFixed(10) })),
    };
    downloadJson(exportSong);
    setIsDirty(false);
  }, [song]);

  const handleUpload = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Vui lòng đăng nhập để upload bài!'); return; }
    if (!song.title) { alert('Vui lòng đặt tên bài trước khi upload!'); return; }

    const origTempo = song.originalTempo ?? song.tempo
    const ratio = origTempo / song.tempo
    const exportSong = {
      ...song,
      originalTempo: song.tempo,
      lyrics: song.lyrics.map(l => ({ ...l, time: +(l.time * ratio).toFixed(10) })),
      chords: song.chords.map(c => ({ ...c, time: +(c.time * ratio).toFixed(10) })),
    }

    const { error } = await supabase.from('timming_songs').upsert({
      title: song.title,
      artist: song.artist || '',
      tone: song.tone || '',
      tempo: song.tempo,
      time_signature: song.timeSignature,
      created_by: user.id,
      song_data: exportSong,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'title,created_by' })

    if (error) { alert('Upload thất bại: ' + error.message); return; }
    alert('✅ Upload thành công: ' + song.title)
  }, [song])

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try { const imported = importFromJson(ev.target?.result as string); const importedWithOrig = { ...imported, originalTempo: imported.tempo }; pushHistory(song); setSong(() => { try { localStorage.setItem('csre-player-song', JSON.stringify(importedWithOrig)); } catch { /* ignore */ } return importedWithOrig; }); setIsDirty(false); }
      catch { alert('File không hợp lệ'); }
    };
    reader.readAsText(file); e.target.value = '';
  }, []);

  const handleClear = useCallback(() => {
    if (!confirm('Xoá toàn bộ lyrics và chords?')) return;
    setSongH(prev => ({ ...prev, lyrics: [], chords: [], updatedAt: new Date().toISOString() }));
    setIsDirty(true);
  }, []);

  // Chèn ô nhịp sau barIndex (1-indexed)
  const handleInsertBar = useCallback((barIndex: number) => {
    setSongH(prev => {
      const bd = barDuration(prev.tempo, prev.timeSignature);
      const insertAt = barIndex * bd; // thời điểm chèn
      // Dịch chuyển tất cả events sau insertAt sang phải 1 bar
      const newChords = prev.chords.map(c =>
        c.time >= insertAt ? { ...c, time: c.time + bd } : c
      );
      const newLyrics = prev.lyrics.map(l =>
        l.time >= insertAt ? { ...l, time: l.time + bd } : l
      );
      return { ...prev, chords: newChords, lyrics: newLyrics, totalBars: prev.totalBars + 1, updatedAt: new Date().toISOString() };
    });
    setIsDirty(true);
  }, []);

  // Xoá ô nhịp barIndex (1-indexed)
  const handleDeleteBar = useCallback((barIndex: number) => {
    setSongH(prev => {
      if (prev.totalBars <= 1) return prev;
      const bd = barDuration(prev.tempo, prev.timeSignature);
      const barStart = (barIndex - 1) * bd;
      const barEnd = barStart + bd;
      // Xoá events trong bar, dịch chuyển events sau bar sang trái
      const newChords = prev.chords
        .filter(c => c.time < barStart || c.time >= barEnd)
        .map(c => c.time >= barEnd ? { ...c, time: c.time - bd } : c);
      const newLyrics = prev.lyrics
        .filter(l => l.time < barStart || l.time >= barEnd)
        .map(l => l.time >= barEnd ? { ...l, time: l.time - bd } : l);
      return { ...prev, chords: newChords, lyrics: newLyrics, totalBars: prev.totalBars - 1, updatedAt: new Date().toISOString() };
    });
    setIsDirty(true);
  }, []);

  const totalTime = song.totalBars * barDuration(song.tempo, song.timeSignature);

  // Build grid rows
  const rows = Array.from({ length: Math.ceil(song.totalBars / barsPerRow) }, (_, ri) =>
    Array.from({ length: barsPerRow }, (_, ci) => ri * barsPerRow + ci + 1).filter(b => b <= song.totalBars)
  );


  return (
    <div className="app">
      {/* ── Topbar hàng 1 ── */}
      <header className="topbar topbar-1">
        <div className="topbar-logo">
          <img src={logoSrc} alt="C# Rhythm" className="logo-img" />
          <div className="logo-divider" />
          <div className="logo-brand">
            <span className="logo-brand-name">Thầy Văn Anh</span>
            <span className="logo-brand-sub">Guitar</span>
          </div>
        </div>
        <div className="topbar-title">
          <input value={song.title} placeholder="Tên bài hát..." onChange={e => updateField('title', e.target.value)} />
          <span className="topbar-sep">—</span>
          <input value={song.artist} placeholder="Ca sĩ..." onChange={e => updateField('artist', e.target.value)} style={{ width: 130 }} />
        </div>
        <div className="topbar-controls">
          <button className="btn" onClick={handleUndo} title="Undo (Cmd+Z)" disabled={historyRef.current.length === 0} style={{ fontSize: 14 }}>↩</button>
          <button className="btn" onClick={handleRedo} title="Redo (Cmd+Y)" disabled={futureRef.current.length === 0} style={{ fontSize: 14 }}>↪</button>
          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />
          <button className="btn primary" onClick={() => { window.location.href = "/player" }}>▶ Player</button>
          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />
          <button className="btn" onClick={() => setShowImport(true)}>⬆ Import</button>
          <button className="btn" onClick={() => fileInputRef.current?.click()}>📂 Mở</button>
          <button className="btn primary" onClick={handleExport}>💾 Lưu</button>
          <button className="btn" onClick={handleUpload} title="Upload lên Cloud">☁️ Upload</button>
          <button className="btn" onClick={() => setShowSongList(true)} title="Chọn bài từ Cloud">☁️ Chọn bài</button>
          <button className="btn" onClick={() => { window.location.href = "/gp-editor" }} title="Import từ Guitar Pro">🎸 GP Import</button>

          <div style={{ display:"flex", alignItems:"center", gap:4, padding:"0 6px", borderLeft:"1px solid rgba(255,255,255,0.15)", marginLeft:2 }}>
            <span style={{ fontSize:10, color:"rgba(255,255,255,0.5)" }}>Aa</span>
            <button className="btn sm" onClick={() => setLyricSize(s => Math.max(11, s - 1))} title="Chữ nhỏ lại">-</button>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.8)", fontFamily:"monospace", minWidth:22, textAlign:"center" }}>{lyricSize}</span>
            <button className="btn sm" onClick={() => setLyricSize(s => Math.min(28, s + 1))} title="Chữ to lên">+</button>
            <button className="btn sm" onClick={() => setLyricSize(17)} title="Mặc định" style={{ fontSize:10, opacity:0.7 }}>↺</button>
          </div>
          <button className="btn" onClick={() => { window.location.href = '/youtube-sync'; }}>🎵 Sync</button>
          <button className="btn danger" onClick={handleClear} title="Xoá lyrics & chords">🗑</button>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileImport} />
          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />
          <button className="btn" onClick={() => supabase.auth.signOut()} title="Đăng xuất">⎋ Thoát</button>
        </div>
      </header>

      {/* ── Topbar hàng 2: settings ── */}
      <div className="topbar-2">
        <div className="tb2-group">
          <label className="tb2-label">GIỌNG</label>
          <input className="tb2-input" value={song.tone} onChange={e => updateField('tone', e.target.value)} style={{ width: 40 }} />
          <button className="btn sm" onClick={() => { setSong(transposeSong(song, -1)); setTransposeSteps(s => s - 1); }} title="Giảm 1 semitone" style={{ marginLeft:4 }}>b</button>
          <span style={{ fontSize:11, color:"var(--text-3)", fontFamily:"monospace", minWidth:28, textAlign:"center" }}>{getTransposeLabel(transposeSteps)}</span>
          <button className="btn sm" onClick={() => { setSong(transposeSong(song, 1)); setTransposeSteps(s => s + 1); }} title="Tăng 1 semitone">#</button>
          <button className="btn sm" onClick={() => { setSong(transposeSong(song, -transposeSteps)); setTransposeSteps(0); }} title="Về gốc" style={{ fontSize:10, opacity:0.7 }}>↺</button>
        </div>
        <div className="tb2-sep" />
        <div className="tb2-group">
          <label className="tb2-label">BPM</label>
          <input className="tb2-input" type="number" min={40} max={240} value={song.tempo} onChange={e => updateField('tempo', Number(e.target.value))} style={{ width: 52 }} />
        </div>
        <div className="tb2-sep" />
        <div className="tb2-group">
          <label className="tb2-label">NHỊP</label>
          <select className="tb2-input" value={song.timeSignature} onChange={e => updateField('timeSignature', Number(e.target.value) as 2|3|4|6)}>
            <option value={2}>2/4</option><option value={3}>3/4</option>
            <option value={4}>4/4</option><option value={6}>6/8</option>
          </select>
        </div>
        <div className="tb2-sep" />
        <div className="tb2-group">
          <label className="tb2-label">Ô NHỊP</label>
          <input className="tb2-input" type="number" min={4} max={128} step={4} value={song.totalBars} onChange={e => updateField('totalBars', Number(e.target.value))} style={{ width: 52 }} />
        </div>
        <div className="tb2-sep" />
        <div className="toggle-group">
          {[2, 4].map(n => (
            <button key={n} className={`toggle-btn ${barsPerRow === n ? 'active' : ''}`} onClick={() => setBarsPerRow(n)}>{n} nhịp/hàng</button>
          ))}
        </div>
        <div className="tb2-sep" />
        <div className="toggle-group">
          {(['beat', 'subbeat', 'free'] as SnapMode[]).map(m => (
            <button key={m} className={`toggle-btn ${snapMode === m ? 'active' : ''}`} onClick={() => setSnapMode(m)}>
              {m === 'beat' ? 'Beat' : m === 'subbeat' ? '½' : 'Free'}
            </button>
          ))}
        </div>
        <div className="tb2-sep" />
        <span className="tb2-info">phách <strong>{(60 / song.tempo).toFixed(2)}s</strong></span>
        <span className="tb2-info">ô nhịp <strong>{(60 / song.tempo * song.timeSignature).toFixed(2)}s</strong></span>
        <span className="tb2-info">tổng <strong>{formatTime(totalTime)}</strong></span>
      </div>

      {/* ── Grid — full width ── */}
      <div className="main">
        <section className="editor" ref={editorRef}>
          <div className="editor-grid-wrapper">
            <div className="timeline-container">
              {rows.map((row, ri) => (
                <div key={ri} className="bar-grid-row" style={{ "--bars-per-row": barsPerRow } as React.CSSProperties}>
                  {row.map(barIdx => (
                    <BarRow
                      key={barIdx}
                      barIndex={barIdx}
                      song={song}
                      snapMode={snapMode}
                      pxPerBeat={pxPerBeat}
                      onTimeChange={handleTimeChange}
                      onDelete={handleDelete}
                      onEditLabel={handleEditLabel}
                      onAdd={handleAdd}
                      onInsertBar={handleInsertBar}
                      onDeleteBar={handleDeleteBar}
                    />
                  ))}
                  {row.length < barsPerRow && Array.from({ length: barsPerRow - row.length }).map((_, i) => (
                    <div key={i} style={{ flex: 1 }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className="statusbar">
        {isDirty && <div className="dirty-dot" />}
        <span className="stat">Bài: <span className="val">{song.title || '—'}</span></span>
        <span className="stat">Chords: <span className="val">{song.chords.length}</span></span>
        <span className="stat">Lyrics: <span className="val">{song.lyrics.length}</span></span>
        <span className="stat">Thời gian: <span className="val">{formatTime(totalTime)}</span></span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'monospace', fontSize: 11 }}>BPM:{song.tempo} · {song.timeSignature}/4 · {song.totalBars} bars · snap:{snapMode}</span>
      </footer>

      {showImport && <ImportModal key={Date.now()} onImport={handleImport} onClose={() => setShowImport(false)} />}
      {addTarget !== null && <AddEventModal time={addTarget} onConfirm={confirmAdd} onClose={() => setAddTarget(null)} />}


      {showSongList && (
        <SongList
          onSelect={s => {
            pushHistory(song)
            setSong(() => {
              try { localStorage.setItem('csre-player-song', JSON.stringify(s)) } catch {}
              return s
            })
            setIsDirty(false)
            setShowSongList(false)
          }}
          onClose={() => setShowSongList(false)}
          isTeacher={true}
        />
      )}
      {showPlayer && <PlayerView song={song} onClose={() => setShowPlayer(false)} onUpdateTitle={(t) => { updateField('title', t); try { const s = {...song, title: t}; localStorage.setItem('csre-player-song', JSON.stringify(s)); } catch {} }} />}
    </div>
  );

}
