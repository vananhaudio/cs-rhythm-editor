import { useState, useEffect, useRef, useCallback } from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface LyricEvent  { id: string; time: number; text: string }
interface ChordEvent  { id: string; time: number; name: string }
interface SyncMeta    { source: 'youtube'; youtubeUrl: string; youtubeOffsetSeconds: number }

interface TimingJSON {
  title: string;
  artist?: string;
  tone?: string;
  tempo?: number;
  timeSignature?: number;
  totalBars?: number;
  duration?: number;
  lyrics: LyricEvent[];
  chords: ChordEvent[];
  sync?: SyncMeta;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function buildEmbedUrl(videoId: string): string {
  const p = new URLSearchParams({ enablejsapi: '1', controls: '1', rel: '0', modestbranding: '1' });
  return `https://www.youtube.com/embed/${videoId}?${p.toString()}`;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, '0')}`;
}

function postToPlayer(iframe: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
}

// ─────────────────────────────────────────────
// Theme tokens (Warm Organic Forest)
// ─────────────────────────────────────────────
const T = {
  bg:         '#1C2E22',
  bgCard:     '#243828',
  bgInput:    '#1A2C20',
  border:     '#2E4A34',
  header:     '#14532D',
  gold:       '#C99700',
  goldLight:  '#F5C842',
  green:      '#8DC470',
  text:       '#F0E8D8',
  textMuted:  '#9DB89A',
  textDim:    '#5A7A5A',
  red:        '#E05555',
  cyan:       '#4ECDC4',
  rose:       '#E05580',
  amber:      '#C99700',
};

const card: React.CSSProperties = {
  background: T.bgCard,
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: T.textMuted,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: T.bgInput,
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 13,
  color: T.text,
  fontFamily: 'inherit',
  outline: 'none',
};

const btnPrimary = (color: string): React.CSSProperties => ({
  background: color,
  border: 'none',
  borderRadius: 10,
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  padding: '10px 18px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
});

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  color: T.textMuted,
  fontSize: 13,
  fontWeight: 500,
  padding: '8px 14px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
};

// ─────────────────────────────────────────────
// Panels
// ─────────────────────────────────────────────

/** Panel 1: YouTube Player */
function YouTubePlayerPanel({
  youtubeUrl, setYoutubeUrl,
  videoId, setVideoId,
  playerReady, setPlayerReady,
  ytCurrentTime,
  iframeRef,
}: {
  youtubeUrl: string; setYoutubeUrl: (v: string) => void;
  videoId: string | null; setVideoId: (v: string | null) => void;
  playerReady: boolean; setPlayerReady: (v: boolean) => void;
  ytCurrentTime: number;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  const [urlError, setUrlError] = useState('');

  const handleLoad = () => {
    setUrlError('');
    const id = extractVideoId(youtubeUrl.trim());
    if (!id) { setUrlError('URL không hợp lệ'); return; }
    setVideoId(id);
    setPlayerReady(false);
  };

  return (
    <div style={card}>
      <div style={labelStyle}>▶ Video YouTube</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={inputStyle}
          value={youtubeUrl}
          onChange={e => { setYoutubeUrl(e.target.value); setUrlError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleLoad()}
          placeholder="https://www.youtube.com/watch?v=..."
        />
        <button style={btnPrimary(T.red)} onClick={handleLoad}>Load</button>
      </div>
      {urlError && <div style={{ color: T.red, fontSize: 12 }}>⚠ {urlError}</div>}

      {/* Player */}
      <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', position: 'relative' }}>
        <div style={{ paddingTop: '56.25%', position: 'relative' }}>
          {!videoId ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: T.textDim, gap: 8 }}>
              <div style={{ fontSize: 40 }}>▶</div>
              <span style={{ fontSize: 13 }}>Nhập URL và bấm Load</span>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={buildEmbedUrl(videoId)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube player"
              onLoad={() => {
                setTimeout(() => {
                  iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*');
                }, 1000);
              }}
            />
          )}
          {videoId && !playerReady && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ background: 'rgba(0,0,0,0.7)', borderRadius: 20, padding: '6px 14px', fontSize: 12, color: '#ccc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #666', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                Đang kết nối...
              </div>
            </div>
          )}
        </div>
        {videoId && playerReady && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: T.bgCard, fontSize: 11, color: T.textMuted }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.green, display: 'inline-block' }} />
              Đã kết nối
            </span>
            <span style={{ fontFamily: 'monospace' }}>YT: {formatTime(ytCurrentTime)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Panel 2: JSON Import */
function JsonImportPanel({
  jsonData, setJsonData, jsonFileName, setJsonFileName,
  offset, setOffset,
}: {
  jsonData: TimingJSON | null; setJsonData: (v: TimingJSON | null) => void;
  jsonFileName: string; setJsonFileName: (v: string) => void;
  offset: number; setOffset: (v: number) => void;
}) {
  const [error, setError] = useState('');
  const DEMO: TimingJSON = {
    title: 'Demo Song', tempo: 80, duration: 60,
    lyrics: [
      { id: 'l1', time: 0, text: 'Thành' }, { id: 'l2', time: 0.5, text: 'phố' },
      { id: 'l3', time: 1.0, text: 'nào' },  { id: 'l4', time: 2.0, text: 'đó' },
    ],
    chords: [{ id: 'c1', time: 0, name: 'Am' }, { id: 'c2', time: 2, name: 'C' }],
  };

  const getJsonDuration = (d: TimingJSON) => {
    const all = [...d.lyrics.map(l => l.time), ...d.chords.map(c => c.time)];
    return all.length > 0 ? Math.max(...all) + 5 : 60;
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        setJsonData(data);
        setJsonFileName(file.name);
        if (data.sync?.youtubeOffsetSeconds !== undefined) setOffset(data.sync.youtubeOffsetSeconds);
      } catch { setError('File JSON không hợp lệ'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div style={card}>
      <div style={labelStyle}>📄 Timing JSON</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <label style={{ flex: 1, cursor: 'pointer' }}>
          <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 8, color: jsonFileName ? T.text : T.textDim }}>
            ⬆ {jsonFileName || 'Upload file JSON...'}
          </div>
          <input type="file" accept=".json" onChange={handleUpload} style={{ display: 'none' }} />
        </label>
        <button style={btnGhost} onClick={() => { setJsonData(DEMO); setJsonFileName('demo_song.json'); setError(''); }}>
          Demo
        </button>
      </div>
      {error && <div style={{ color: T.red, fontSize: 12 }}>⚠ {error}</div>}
      {jsonData && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            jsonData.title || 'Untitled',
            `${jsonData.lyrics.length} lyrics`,
            `${jsonData.chords.length} chords`,
            formatTime(jsonData.duration ?? getJsonDuration(jsonData)),
            jsonData.tempo ? `${jsonData.tempo} BPM` : null,
          ].filter(Boolean).map((tag, i) => (
            <span key={i} style={{ background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 6, padding: '3px 10px', fontSize: 11, color: i === 0 ? T.text : T.textMuted }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Panel 3: Offset Căn Chỉnh */
function OffsetPanel({
  offset, setOffset, playerReady, ytCurrentTime,
}: {
  offset: number; setOffset: (v: number) => void;
  playerReady: boolean; ytCurrentTime: number;
}) {
  const adjust = (d: number) => setOffset(Math.round((offset + d) * 1000) / 1000);

  return (
    <div style={card}>
      <div style={labelStyle}>⏱ Offset Căn Chỉnh</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, fontWeight: 700, fontFamily: 'monospace', color: T.gold }}>
          {offset >= 0 ? '+' : ''}{offset.toFixed(3)}s
        </div>
        <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>
          youtubeTime = jsonTime + offset
        </div>
      </div>

      {/* Nút điều chỉnh nhanh */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {([-1, -0.1, 0.1, 1] as const).map(d => (
          <button key={d} onClick={() => adjust(d)} style={{
            ...btnGhost,
            color: d < 0 ? '#F87171' : T.green,
            borderColor: d < 0 ? '#7F1D1D' : '#1A4A2A',
            fontFamily: 'monospace',
            fontWeight: 700,
          }}>
            {d > 0 ? '+' : ''}{d}s
          </button>
        ))}
      </div>

      {/* Nhập thẳng */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>Nhập:</span>
        <input
          type="number" step="0.1" value={offset}
          onChange={e => setOffset(parseFloat(e.target.value) || 0)}
          style={{ ...inputStyle, fontFamily: 'monospace', color: T.gold, textAlign: 'center' }}
        />
        <button style={btnGhost} onClick={() => setOffset(0)} title="Reset">↺</button>
      </div>

      {/* Set current YT time làm mốc 0 */}
      <button
        onClick={() => setOffset(Math.round(ytCurrentTime * 1000) / 1000)}
        disabled={!playerReady}
        style={{ ...btnPrimary('#2A5A3A'), opacity: playerReady ? 1 : 0.4, justifyContent: 'center' }}
      >
        ▶ Set vị trí YouTube hiện tại làm mốc 0
      </button>
      {playerReady && (
        <div style={{ textAlign: 'center', fontSize: 11, color: T.textDim, fontFamily: 'monospace' }}>
          YT hiện tại: {formatTime(ytCurrentTime)}
        </div>
      )}
    </div>
  );
}

/** Panel 4: Bar Sync */
function BarSyncPanel({
  jsonData, playerReady, ytCurrentTime, offset, setOffset,
}: {
  jsonData: TimingJSON | null; playerReady: boolean;
  ytCurrentTime: number; offset: number; setOffset: (v: number) => void;
}) {
  const [barNum, setBarNum] = useState(1);
  const [result, setResult] = useState<{ bar: number; ytTime: number; jsonTime: number; offset: number } | null>(null);

  const getBar1JsonTime = (n: number) => {
    if (!jsonData?.tempo) return null;
    const bpb = jsonData.timeSignature ?? 4;
    const spb = 60 / jsonData.tempo;
    return (n - 1) * bpb * spb;
  };

  const handleMark = () => {
    const jt = getBar1JsonTime(barNum);
    if (jt === null) return;
    const newOffset = Math.round((ytCurrentTime - jt) * 1000) / 1000;
    setOffset(newOffset);
    setResult({ bar: barNum, ytTime: ytCurrentTime, jsonTime: jt, offset: newOffset });
  };

  if (!jsonData?.tempo) return (
    <div style={card}>
      <div style={labelStyle}>♩ Đồng bộ từ nhịp bất kỳ</div>
      <div style={{ fontSize: 12, color: '#CA8A04', display: 'flex', alignItems: 'center', gap: 6 }}>
        ⚠ Cần JSON có trường <code style={{ background: T.bgInput, padding: '1px 5px', borderRadius: 4 }}>tempo</code> để dùng tính năng này.
      </div>
    </div>
  );

  return (
    <div style={card}>
      <div style={labelStyle}>♩ Đồng bộ từ nhịp bất kỳ</div>
      <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>
        Play video đến đúng phách 1 của nhịp muốn đồng bộ → bấm <strong style={{ color: T.text }}>Mark</strong>.
      </div>

      {/* Chọn nhịp */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button style={btnGhost} onClick={() => setBarNum(b => Math.max(1, b - 1))}>−</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'monospace', color: T.cyan }}>
            {barNum}
          </div>
          <div style={{ fontSize: 10, color: T.textDim }}>nhịp</div>
        </div>
        <button style={btnGhost} onClick={() => setBarNum(b => b + 1)}>+</button>
      </div>

      {/* Quick pick */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {[1,2,3,4,5,8,9,13,17].map(n => (
          <button key={n} onClick={() => setBarNum(n)} style={{
            ...btnGhost,
            color: barNum === n ? T.cyan : T.textMuted,
            borderColor: barNum === n ? T.cyan : T.border,
            padding: '5px 10px',
            fontSize: 12,
            fontFamily: 'monospace',
          }}>
            {n}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: T.textDim, textAlign: 'right', fontFamily: 'monospace' }}>
        JSON beat 1 = {getBar1JsonTime(barNum)?.toFixed(3)}s
      </div>

      <button
        onPointerDown={handleMark}
        disabled={!playerReady}
        style={{ ...btnPrimary(T.cyan.replace('#4ECDC4', '#0E8A82')), justifyContent: 'center', padding: '13px', fontSize: 14, background: '#0E7A72', opacity: playerReady ? 1 : 0.4, userSelect: 'none' }}
      >
        Mark — Phách 1, Nhịp {barNum}
      </button>

      {result && (
        <div style={{ background: T.bgInput, borderRadius: 10, padding: 12, fontSize: 11, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[
            ['Nhịp đã mark', `#${result.bar}`, T.text],
            ['YT lúc mark', `${result.ytTime.toFixed(3)}s`, '#F87171'],
            ['JSON beat 1', `${result.jsonTime.toFixed(3)}s`, T.green],
          ].map(([k, v, c]) => (
            <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', color: T.textMuted }}>
              <span>{k}</span><span style={{ color: c as string }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: T.textMuted, borderTop: `1px solid ${T.border}`, paddingTop: 5, marginTop: 3 }}>
            <span>Offset đã set</span>
            <span style={{ color: T.gold, fontWeight: 700 }}>{result.offset >= 0 ? '+' : ''}{result.offset.toFixed(3)}s</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Panel 5: Tap Tempo */
function TapTempoPanel({ jsonData, setJsonData }: {
  jsonData: TimingJSON | null;
  setJsonData: (v: TimingJSON | null) => void;
}) {
  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const [scalePreview, setScalePreview] = useState<number | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computeFromBpm = (bpm: number) => {
    setTapBpm(Math.round(bpm));
    if (jsonData?.tempo) setScalePreview(Math.round((jsonData.tempo / bpm) * 10000) / 10000);
  };

  const handleTap = useCallback(() => {
    const now = performance.now();
    if (tapTimesRef.current.length > 0 && now - tapTimesRef.current[tapTimesRef.current.length - 1] > 3000) {
      tapTimesRef.current = [];
    }
    tapTimesRef.current.push(now);
    setTapCount(tapTimesRef.current.length);
    if (tapTimesRef.current.length >= 2) {
      const intervals = tapTimesRef.current.slice(1).map((v, i) => v - tapTimesRef.current[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      computeFromBpm(60000 / avg);
    }
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => {
      tapTimesRef.current = []; setTapCount(0); setTapBpm(null); setScalePreview(null);
    }, 3000);
  }, [jsonData]);

  const handleApply = () => {
    if (!jsonData || scalePreview === null || tapBpm === null) return;
    const r = scalePreview;
    setJsonData({
      ...jsonData,
      tempo: tapBpm,
      lyrics: jsonData.lyrics.map(l => ({ ...l, time: +(l.time * r).toFixed(4) })),
      chords: jsonData.chords.map(c => ({ ...c, time: +(c.time * r).toFixed(4) })),
      duration: jsonData.duration ? +(jsonData.duration * r).toFixed(4) : undefined,
    });
    tapTimesRef.current = []; setTapCount(0); setTapBpm(null); setScalePreview(null);
  };

  const handleReset = () => {
    tapTimesRef.current = []; setTapCount(0); setTapBpm(null); setScalePreview(null);
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
  };

  return (
    <div style={card}>
      <div style={labelStyle}>🥁 Tap Tempo Calibration</div>

      {/* Manual BPM input */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="number" min={20} max={300} step={0.1}
          placeholder="Nhập BPM YouTube..."
          style={{ ...inputStyle, fontFamily: 'monospace', color: T.rose }}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v > 0) computeFromBpm(v);
            else { setTapBpm(null); setScalePreview(null); }
          }}
        />
        <span style={{ fontSize: 12, color: T.textDim }}>BPM</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 1, background: T.border }} />
        <span style={{ fontSize: 11, color: T.textDim }}>hoặc tap</span>
        <div style={{ flex: 1, height: 1, background: T.border }} />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        {/* Tap button */}
        <button
          onPointerDown={handleTap}
          style={{
            flex: 1, border: `2px dashed ${tapCount > 0 ? T.rose : T.border}`,
            borderRadius: 16, background: tapCount > 0 ? 'rgba(224,85,128,0.1)' : T.bgInput,
            cursor: 'pointer', padding: '20px 0',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            userSelect: 'none', transition: 'all 0.1s',
          }}
        >
          <span style={{ fontSize: 28 }}>🥁</span>
          <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>TAP</span>
          {tapCount > 0 && <span style={{ fontSize: 10, color: T.textDim }}>{tapCount} taps</span>}
        </button>
        {/* BPM display */}
        <div style={{ flex: 1, background: T.bgInput, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '16px 8px' }}>
          <div style={{ fontSize: 40, fontWeight: 700, fontFamily: 'monospace', color: tapBpm ? T.rose : T.textDim }}>
            {tapBpm ?? '--'}
          </div>
          <div style={{ fontSize: 11, color: T.textDim }}>BPM YouTube</div>
          {jsonData?.tempo && (
            <div style={{ fontSize: 11, color: T.textDim }}>
              JSON gốc: <span style={{ color: T.textMuted, fontFamily: 'monospace' }}>{jsonData.tempo}</span>
            </div>
          )}
        </div>
      </div>

      {/* Scale preview */}
      {tapBpm && jsonData?.tempo && scalePreview !== null && (
        <div style={{ background: T.bgInput, borderRadius: 10, padding: 12, fontSize: 11, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[
            ['Tempo JSON gốc', `${jsonData.tempo} BPM`, T.text],
            ['Tempo tap', `${tapBpm} BPM`, T.rose],
          ].map(([k, v, c]) => (
            <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', color: T.textMuted }}>
              <span>{k}</span><span style={{ color: c as string }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: T.textMuted, borderTop: `1px solid ${T.border}`, paddingTop: 5, marginTop: 3 }}>
            <span>Scale ratio</span>
            <span style={{ color: scalePreview > 1 ? '#F97316' : scalePreview < 1 ? '#38BDF8' : T.green, fontWeight: 700 }}>
              ×{scalePreview.toFixed(4)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: T.textMuted }}>
            <span>Sai lệch</span>
            <span style={{ color: T.gold }}>{tapBpm > jsonData.tempo ? '+' : ''}{((tapBpm / jsonData.tempo - 1) * 100).toFixed(1)}%</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleApply} disabled={!scalePreview || !jsonData?.tempo}
          style={{ ...btnPrimary(T.rose.replace('#E05580','#A03060')), flex: 1, justifyContent: 'center', background: '#8A2050', opacity: (!scalePreview || !jsonData?.tempo) ? 0.4 : 1 }}>
          Apply Scale to JSON
        </button>
        <button onClick={handleReset} disabled={tapCount === 0}
          style={{ ...btnGhost, opacity: tapCount === 0 ? 0.4 : 1 }}>↺</button>
      </div>
    </div>
  );
}

/** Panel 6: App Timeline + Export */
function TimelinePanel({
  jsonData, jsonCurrentTime, setJsonCurrentTime,
  offset, isPlaying, playerReady,
  iframeRef, youtubeUrl, jsonFileName,
}: {
  jsonData: TimingJSON | null; jsonCurrentTime: number; setJsonCurrentTime: (v: number) => void;
  offset: number; isPlaying: boolean; playerReady: boolean;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  youtubeUrl: string; jsonFileName: string;
}) {
  const [exportOk, setExportOk] = useState(false);

  const getJsonDuration = (d: TimingJSON) => {
    const all = [...d.lyrics.map(l => l.time), ...d.chords.map(c => c.time)];
    return all.length > 0 ? Math.max(...all) + 5 : 60;
  };

  const duration = jsonData ? (jsonData.duration ?? getJsonDuration(jsonData)) : 60;

  const handlePlaySync = () => {
    if (!playerReady || !jsonData) return;
    postToPlayer(iframeRef.current, 'seekTo', [jsonCurrentTime + offset, true]);
    setTimeout(() => postToPlayer(iframeRef.current, 'playVideo'), 300);
  };

  const handlePause = () => postToPlayer(iframeRef.current, 'pauseVideo');

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const jt = parseFloat(e.target.value);
    setJsonCurrentTime(jt);
    postToPlayer(iframeRef.current, 'seekTo', [jt + offset, true]);
    if (isPlaying) setTimeout(() => postToPlayer(iframeRef.current, 'playVideo'), 300);
  };

  const handleExport = () => {
    if (!jsonData) return;
    const output = { ...jsonData, sync: { source: 'youtube' as const, youtubeUrl, youtubeOffsetSeconds: offset } };
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${jsonFileName.replace('.json', '') || 'timing'}_synced.json`; a.click();
    URL.revokeObjectURL(url);
    setExportOk(true); setTimeout(() => setExportOk(false), 2500);
  };

  return (
    <div style={card}>
      <div style={labelStyle}>♪ App Timeline</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: T.green }}>{formatTime(jsonCurrentTime)}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: T.textDim }}>{formatTime(duration)}</span>
      </div>
      <input type="range" min={0} max={duration} step={0.1} value={jsonCurrentTime}
        onChange={handleSeek} style={{ width: '100%', accentColor: T.green }} />

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={isPlaying ? handlePause : handlePlaySync}
          disabled={!playerReady || !jsonData}
          style={{ ...btnPrimary(isPlaying ? '#374151' : '#2A5A3A'), flex: 1, justifyContent: 'center', opacity: (!playerReady || !jsonData) ? 0.4 : 1 }}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play Sync'}
        </button>
      </div>

      {/* Debug info */}
      <div style={{ background: T.bgInput, borderRadius: 10, padding: 12, fontSize: 11, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          ['JSON time', `${jsonCurrentTime.toFixed(2)}s`, T.text],
          ['Offset', `${offset >= 0 ? '+' : ''}${offset.toFixed(3)}s`, T.gold],
          ['YouTube time', `${(jsonCurrentTime + offset).toFixed(2)}s`, '#F87171'],
        ].map(([k, v, c]) => (
          <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', color: T.textMuted }}>
            <span>{k}</span><span style={{ color: c as string }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Export */}
      <button onClick={handleExport} disabled={!jsonData}
        style={{ ...btnPrimary(exportOk ? '#1A5A3A' : '#1A4A8A'), justifyContent: 'center', opacity: !jsonData ? 0.4 : 1 }}>
        {exportOk ? '✓ Đã xuất!' : '💾 Export JSON với offset'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
const SYNC_INTERVAL = 200;

export default function YouTubeSyncPage() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [jsonData, setJsonData] = useState<TimingJSON | null>(null);
  const [jsonFileName, setJsonFileName] = useState('');
  const [offset, setOffset] = useState(0);
  const [jsonCurrentTime, setJsonCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [ytCurrentTime, setYtCurrentTime] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPlayingRef = useRef(false);
  const offsetRef = useRef(0);
  const ytTimeRef = useRef(0);
  const jsonDurationRef = useRef(60);

  useEffect(() => { offsetRef.current = offset; }, [offset]);

  useEffect(() => {
    if (jsonData) {
      const all = [...jsonData.lyrics.map(l => l.time), ...jsonData.chords.map(c => c.time)];
      jsonDurationRef.current = jsonData.duration ?? (all.length > 0 ? Math.max(...all) + 5 : 60);
    }
  }, [jsonData]);

  const pollYTTime = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*');
  }, []);

  const stopSyncLoop = () => {
    if (syncIntervalRef.current) { clearInterval(syncIntervalRef.current); syncIntervalRef.current = null; }
  };

  const startSyncLoop = useCallback(() => {
    stopSyncLoop();
    syncIntervalRef.current = setInterval(() => {
      if (!isPlayingRef.current) return;
      pollYTTime();
      const jt = ytTimeRef.current - offsetRef.current;
      if (jt >= jsonDurationRef.current) {
        postToPlayer(iframeRef.current, 'pauseVideo');
        setIsPlaying(false); isPlayingRef.current = false;
        setJsonCurrentTime(jsonDurationRef.current); stopSyncLoop(); return;
      }
      setJsonCurrentTime(Math.max(0, jt));
    }, SYNC_INTERVAL);
  }, [pollYTTime]);

  // Listen postMessage from YT iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!event.origin.includes('youtube')) return;
      let data: Record<string, unknown>;
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }

      if (data.event === 'onReady') setPlayerReady(true);
      if (data.event === 'onStateChange') {
        const state = data.info as number;
        if (state === 1) { setIsPlaying(true); isPlayingRef.current = true; startSyncLoop(); }
        else if ([0, 2, -1].includes(state)) { setIsPlaying(false); isPlayingRef.current = false; stopSyncLoop(); }
      }
      if (data.event === 'infoDelivery') {
        const info = data.info as Record<string, unknown>;
        if (typeof info?.currentTime === 'number') {
          ytTimeRef.current = info.currentTime; setYtCurrentTime(info.currentTime);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [startSyncLoop]);

  const activeChord = jsonData?.chords.filter(c => c.time <= jsonCurrentTime).at(-1);
  const currentLyric = jsonData?.lyrics.filter(l => l.time <= jsonCurrentTime).at(-1);

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: 'Inter, sans-serif' }}>
      {/* Topbar */}
      <header style={{ background: T.header, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => { window.location.href = '/editor'; }}
          style={{ ...btnGhost, borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
          ← Editor
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>YouTube Sync Tool</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Căn chỉnh timing JSON với video YouTube</div>
        </div>
        <button onClick={() => { window.location.href = '/player'; }}
          style={{ ...btnGhost, borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
          Player →
        </button>
      </header>

      {/* Body */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* LEFT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <YouTubePlayerPanel
              youtubeUrl={youtubeUrl} setYoutubeUrl={setYoutubeUrl}
              videoId={videoId} setVideoId={v => { setVideoId(v); setJsonCurrentTime(0); ytTimeRef.current = 0; stopSyncLoop(); }}
              playerReady={playerReady} setPlayerReady={setPlayerReady}
              ytCurrentTime={ytCurrentTime} iframeRef={iframeRef}
            />
            <JsonImportPanel
              jsonData={jsonData} setJsonData={setJsonData}
              jsonFileName={jsonFileName} setJsonFileName={setJsonFileName}
              offset={offset} setOffset={setOffset}
            />
            <TimelinePanel
              jsonData={jsonData} jsonCurrentTime={jsonCurrentTime} setJsonCurrentTime={setJsonCurrentTime}
              offset={offset} isPlaying={isPlaying} playerReady={playerReady}
              iframeRef={iframeRef} youtubeUrl={youtubeUrl} jsonFileName={jsonFileName}
            />
          </div>

          {/* RIGHT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <OffsetPanel offset={offset} setOffset={setOffset} playerReady={playerReady} ytCurrentTime={ytCurrentTime} />
            <BarSyncPanel jsonData={jsonData} playerReady={playerReady} ytCurrentTime={ytCurrentTime} offset={offset} setOffset={setOffset} />
            <TapTempoPanel jsonData={jsonData} setJsonData={setJsonData} />
          </div>
        </div>

        {/* Lyrics / Chords Preview */}
        {jsonData && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
            {/* Lyrics */}
            <div style={card}>
              <div style={labelStyle}>📝 Lyrics Preview</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
                {jsonData.lyrics.map(l => {
                  const isActive = currentLyric?.id === l.id;
                  return (
                    <button key={l.id} onClick={() => {
                      setJsonCurrentTime(l.time);
                      postToPlayer(iframeRef.current, 'seekTo', [l.time + offset, true]);
                    }} style={{
                      border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      background: isActive ? T.green : T.bgInput,
                      color: isActive ? '#fff' : l.time < jsonCurrentTime - 2 ? T.textDim : T.textMuted,
                      transform: isActive ? 'scale(1.05)' : 'scale(1)',
                      transition: 'all 0.1s',
                    }}>
                      {l.text}
                    </button>
                  );
                })}
              </div>
              {currentLyric && (
                <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 600, color: T.green, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                  {currentLyric.text}
                </div>
              )}
            </div>

            {/* Chords */}
            <div style={card}>
              <div style={labelStyle}>♪ Chord Preview</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
                {jsonData.chords.map(c => {
                  const isActive = activeChord?.id === c.id;
                  return (
                    <button key={c.id} onClick={() => {
                      setJsonCurrentTime(c.time);
                      postToPlayer(iframeRef.current, 'seekTo', [c.time + offset, true]);
                    }} style={{
                      border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 14, fontWeight: 700,
                      background: isActive ? T.gold : T.bgInput,
                      color: isActive ? '#fff' : T.textMuted,
                      transform: isActive ? 'scale(1.05)' : 'scale(1)',
                      transition: 'all 0.1s',
                    }}>
                      {c.name}
                    </button>
                  );
                })}
              </div>
              {activeChord && (
                <div style={{ textAlign: 'center', borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                  <span style={{ fontSize: 36, fontWeight: 700, fontFamily: 'monospace', color: T.gold }}>{activeChord.name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hướng dẫn */}
        <div style={{ ...card, marginTop: 20, background: 'rgba(255,255,255,0.02)', fontSize: 12, color: T.textDim, lineHeight: 1.8 }}>
          <strong style={{ color: T.textMuted }}>Hướng dẫn:</strong>
          {['Nhập URL YouTube → Load', 'Upload JSON hoặc dùng Demo', 'Play video đến vị trí bắt đầu bài → Set current YouTube time as JSON start', 'Chỉnh offset bằng +/− hoặc dùng Bar Sync để mark nhịp bất kỳ', 'Bấm Play Sync để kiểm tra → Export khi xong'].map((s, i) => (
            <div key={i}>{i + 1}. {s}</div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        button:active { transform: scale(0.97); }
      `}</style>
    </div>
  );
}
