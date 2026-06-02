import { useMemo } from 'react';
import type { NoteData, WordData, MappingData, ProjectMetadata, ChordData } from '../xmlTypes';
import { PPQ, ticksToSeconds } from '../xmlTypes';
import { Music, Clock, BarChart2, AlertCircle } from 'lucide-react';

interface LyricsPreviewProps {
  metadata: ProjectMetadata;
  notes: NoteData[];
  words: WordData[];
  chords: ChordData[];
  mappings: MappingData[];
  selectedWordId: string | null;
  onSelectWord: (id: string) => void;
}

// Group words into lines by bar
function groupByBar(words: WordData[]): Array<{ bar: number; words: WordData[] }> {
  const barMap = new Map<number, WordData[]>();
  for (const w of words) {
    const bar = w.bar || 0;
    if (!barMap.has(bar)) barMap.set(bar, []);
    barMap.get(bar)!.push(w);
  }
  return Array.from(barMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bar, ws]) => ({ bar, ws: ws.sort((a, b) => a.time - b.time) }))
    .map(({ bar, ws }) => ({ bar, words: ws }));
}

// Format ticks as M:SS.s (using tempo for conversion)
function formatTicks(ticks: number, tempo: number): string {
  const s = ticksToSeconds(ticks, tempo);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toFixed(2).padStart(5, '0')}`;
}

// Confidence color class
function confidenceDot(conf: number): string {
  if (conf >= 0.9) return 'bg-emerald-500';
  if (conf >= 0.7) return 'bg-amber-400';
  return 'bg-red-400';
}

export default function LyricsPreview({
  metadata,
  notes,
  words,
  chords,
  mappings,
  selectedWordId,
  onSelectWord,
}: LyricsPreviewProps) {
  const { tempo, timeSignature } = metadata;
  const ticksPerBeat = PPQ;
  const ticksPerBar = PPQ * timeSignature;

  const mapped = words.filter(w => w.linkedNotes.length > 0);
  const unmapped = words.filter(w => w.linkedNotes.length === 0);
  const coveragePercent = words.length > 0 ? Math.round((mapped.length / words.length) * 100) : 0;

  const barGroups = useMemo(() => groupByBar(mapped), [mapped]);

  const maxTick = useMemo(() => {
    if (notes.length === 0) return 0;
    return Math.max(...notes.map(n => n.startTime + n.duration));
  }, [notes]);

  const maxTimeSec = ticksToSeconds(maxTick, tempo);

  const avgConfidence = useMemo(() => {
    if (mapped.length === 0) return 0;
    return mapped.reduce((s, w) => s + w.confidence, 0) / mapped.length;
  }, [mapped]);

  // Build map: wordId → chord name
  const wordToChord = useMemo(() => {
    const map = new Map<string, string>();
    if (chords.length === 0 || mapped.length === 0) return map;
    const sortedChords = [...chords].filter(c => c.time > 0 || c.bar > 0).sort((a, b) => a.time - b.time);
    const sortedWords = [...mapped].sort((a, b) => a.time - b.time);
    for (const chord of sortedChords) {
      let best: WordData | null = null;
      let bestDiff = Infinity;
      for (const w of sortedWords) {
        const diff = w.time - chord.time;
        if (diff >= -1 && diff < bestDiff) {
          bestDiff = diff;
          best = w;
        }
      }
      if (best && !map.has(best.id)) map.set(best.id, chord.name);
    }
    return map;
  }, [chords, mapped]);

  if (words.length === 0 || mapped.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-[#f8f9f7]">
        <div className="text-center max-w-xs">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <Music size={28} className="text-stone-300" />
          </div>
          <h3 className="text-sm font-semibold text-stone-500 mb-1">No result to preview</h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            Import a file with lyrics, or use Auto Match after importing notes and lyrics.
          </p>
        </div>
      </div>
    );
  }

  // Format duration in seconds
  function fmtSec(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toFixed(2).padStart(5, '0')}`;
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f9f7] overflow-hidden">
      {/* ── Stats header ── */}
      <div className="flex-shrink-0 bg-white border-b border-stone-200 px-5 py-3 flex items-center gap-6">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-stone-400 uppercase tracking-widest font-medium mb-0.5">Preview</p>
          <h2 className="text-sm font-bold text-stone-800 truncate">
            {metadata.title || 'Untitled'}{metadata.artist ? ` — ${metadata.artist}` : ''}
          </h2>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <StatPill
            icon={<BarChart2 size={12} />}
            label="Coverage"
            value={`${coveragePercent}%`}
            color={coveragePercent === 100 ? 'emerald' : coveragePercent >= 80 ? 'amber' : 'red'}
          />
          <StatPill
            icon={<Clock size={12} />}
            label="Duration"
            value={fmtSec(maxTimeSec)}
            color="stone"
          />
          <StatPill
            icon={<Music size={12} />}
            label="Bars"
            value={String(metadata.totalBars || barGroups.length)}
            color="stone"
          />
          <StatPill
            label="Confidence"
            value={`${(avgConfidence * 100).toFixed(0)}%`}
            color={avgConfidence >= 0.9 ? 'emerald' : avgConfidence >= 0.7 ? 'amber' : 'red'}
          />
        </div>
      </div>

      {/* ── Main preview area ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-1">
        {barGroups.map(({ bar, words: bWords }) => (
          <BarLine
            key={bar}
            bar={bar}
            words={bWords}
            wordToChord={wordToChord}
            selectedWordId={selectedWordId}
            onSelectWord={onSelectWord}
            maxTick={maxTick}
            ticksPerBar={ticksPerBar}
            ticksPerBeat={ticksPerBeat}
            tempo={tempo}
          />
        ))}

        {/* Unmapped words */}
        {unmapped.length > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-100">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={13} className="text-red-500" />
              <span className="text-xs font-semibold text-red-700">
                {unmapped.length} word{unmapped.length > 1 ? 's' : ''} without timing
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unmapped.map(w => (
                <button
                  key={w.id}
                  onClick={() => onSelectWord(w.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                    w.id === selectedWordId
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                  }`}
                >
                  {w.text}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Beat ruler / progress bar ── */}
      <TimeRuler
        words={mapped}
        maxTick={maxTick}
        tempo={tempo}
        selectedWordId={selectedWordId}
        onSelectWord={onSelectWord}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────── */
/* Sub-components                                   */
/* ──────────────────────────────────────────────── */

function StatPill({
  icon,
  label,
  value,
  color,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  color: 'emerald' | 'amber' | 'red' | 'stone';
}) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    stone: 'bg-stone-50 text-stone-600 border-stone-200',
  };
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${colors[color]}`}>
      {icon}
      <span className="text-[10px] opacity-70">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function BarLine({
  bar,
  words,
  wordToChord,
  selectedWordId,
  onSelectWord,
  maxTick,
  ticksPerBar,
  ticksPerBeat,
  tempo,
}: {
  bar: number;
  words: WordData[];
  wordToChord: Map<string, string>;
  selectedWordId: string | null;
  onSelectWord: (id: string) => void;
  maxTick: number;
  ticksPerBar: number;
  ticksPerBeat: number;
  tempo: number;
}) {
  const barStartTick = words[0]?.time ?? 0;
  const barStartSec = ticksToSeconds(barStartTick, tempo);

  // beats per bar = ticksPerBar / ticksPerBeat
  const beatsPerBar = Math.round(ticksPerBar / ticksPerBeat);

  function fmtSec(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toFixed(2).padStart(5, '0')}`;
  }

  return (
    <div className="group flex items-start gap-3 py-2 px-3 rounded-xl hover:bg-white hover:shadow-sm transition-all">
      {/* Bar number + time */}
      <div className="flex-shrink-0 w-14 text-right pt-0.5">
        <div className="text-[11px] font-bold text-stone-400 group-hover:text-stone-500">
          Bar {bar}
        </div>
        <div className="text-[10px] text-stone-300 tabular-nums">
          {fmtSec(barStartSec)}
        </div>
      </div>

      {/* Beat grid + words */}
      <div className="flex-1 min-w-0">
        {/* Beat ticks */}
        <div className="flex gap-px mb-1.5 h-1">
          {Array.from({ length: beatsPerBar }, (_, i) => {
            const beatTick = barStartTick + i * ticksPerBeat;
            const hasBeatWord = words.some(w => Math.abs(w.time - beatTick) < ticksPerBeat * 0.5);
            return (
              <div
                key={i}
                className={`flex-1 rounded-full ${hasBeatWord ? 'bg-green-400' : 'bg-stone-200'}`}
              />
            );
          })}
        </div>

        {/* Words row */}
        <div className="flex flex-wrap gap-x-2 gap-y-1.5 items-end">
          {words.map(word => {
            const isSelected = word.id === selectedWordId;
            const beatInBar = Math.round((word.time - barStartTick) / ticksPerBeat) + 1;
            const chordName = wordToChord.get(word.id);

            return (
              <button
                key={word.id}
                onClick={() => onSelectWord(word.id)}
                title={`Beat ${beatInBar} · ${word.time} stit · ${(word.confidence * 100).toFixed(0)}% conf`}
                className="relative flex flex-col items-center gap-0.5 group/word"
              >
                {/* Chord label above word */}
                <span
                  className={[
                    'text-[11px] font-bold leading-none mb-0.5 min-h-[14px]',
                    chordName ? 'text-blue-600' : 'opacity-0 select-none',
                  ].join(' ')}
                >
                  {chordName ?? 'X'}
                </span>

                {/* Word chip */}
                <span
                  className={[
                    'px-3 py-1 rounded-lg text-sm font-medium transition-all leading-tight',
                    isSelected
                      ? 'bg-green-800 text-white shadow-md ring-2 ring-green-400 ring-offset-1'
                      : word.isSlurGroup
                      ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                      : 'bg-stone-100 text-stone-800 hover:bg-stone-200',
                  ].join(' ')}
                >
                  {word.text}
                </span>

                {/* Timing label (shown on hover or selected) */}
                <span
                  className={[
                    'text-[9px] tabular-nums transition-opacity',
                    isSelected ? 'text-green-700 opacity-100' : 'text-stone-400 opacity-0 group-hover/word:opacity-100',
                  ].join(' ')}
                >
                  {word.time} stit
                </span>

                {/* Confidence dot */}
                <span
                  className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${confidenceDot(word.confidence)}`}
                  title={`Confidence: ${(word.confidence * 100).toFixed(0)}%`}
                />

                {/* Slur arc indicator */}
                {word.isSlurGroup && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] text-amber-500 font-bold leading-none">
                    ⌢
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Duration bar */}
        <div className="mt-2 h-0.5 rounded-full bg-stone-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full"
            style={{ width: `${Math.min((ticksPerBar / Math.max(maxTick, 1)) * 100 * (bar), 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function TimeRuler({
  words,
  maxTick,
  tempo,
  selectedWordId,
  onSelectWord,
}: {
  words: WordData[];
  maxTick: number;
  tempo: number;
  selectedWordId: string | null;
  onSelectWord: (id: string) => void;
}) {
  if (maxTick === 0) return null;

  function fmtSec(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toFixed(2).padStart(5, '0')}`;
  }

  return (
    <div className="flex-shrink-0 bg-white border-t border-stone-200 px-5 py-3">
      <div className="relative h-8 bg-stone-50 rounded-lg overflow-hidden border border-stone-200">
        {/* Word markers */}
        {words.map(w => {
          const left = (w.time / maxTick) * 100;
          const widthPct = Math.max((w.duration / maxTick) * 100, 0.3);
          const isSelected = w.id === selectedWordId;

          return (
            <button
              key={w.id}
              onClick={() => onSelectWord(w.id)}
              title={w.text}
              style={{ left: `${left}%`, width: `${widthPct}%` }}
              className={[
                'absolute top-1 bottom-1 rounded-sm transition-all cursor-pointer',
                isSelected
                  ? 'bg-green-700 z-10 shadow-sm'
                  : 'bg-green-400/70 hover:bg-green-600/80',
              ].join(' ')}
            />
          );
        })}

        {/* Selected word label */}
        {selectedWordId && (() => {
          const w = words.find(w => w.id === selectedWordId);
          if (!w) return null;
          const left = (w.time / maxTick) * 100;
          return (
            <div
              className="absolute bottom-full mb-1 -translate-x-1/2 pointer-events-none z-20"
              style={{ left: `${left}%` }}
            >
              <div className="bg-green-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
                {w.text} · {w.time} stit
              </div>
            </div>
          );
        })()}

        {/* Time markers (in seconds) */}
        {Array.from({ length: 5 }, (_, i) => {
          const tick = (maxTick / 4) * i;
          const sec = ticksToSeconds(tick, tempo);
          return (
            <div
              key={i}
              className="absolute top-0 bottom-0 flex flex-col justify-end pointer-events-none"
              style={{ left: `${(tick / maxTick) * 100}%` }}
            >
              <span className="text-[8px] text-stone-400 tabular-nums pl-0.5">{fmtSec(sec)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
