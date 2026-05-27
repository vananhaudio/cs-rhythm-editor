import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

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
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
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
  bg:        '#1C2E22',
  bgCard:    '#243828',
  bgInput:   '#1A2C20',
  border:    '#2E4A34',
  header:    '#14532D',
  gold:      '#C99700',
  green:     '#8DC470',
  text:      '#F0E8D8',
  textMuted: '#9DB89A',
  textDim:   '#5A7A5A',
  red:       '#E05555',
  cyan:      '#4ECDC4',
  rose:      '#E05580',
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
// Main Page
// ─────────────────────────────────────────────
const MOCK_JSON: TimingJSON = {
  title: 'Demo Song', tempo: 80, duration: 60,
  lyrics: [
    { id: 'l1', time: 0, text: 'Thành' }, { id: 'l2', time: 0.5, text: 'phố' },
    { id: 'l3', time: 1.0, text: 'nào' },  { id: 'l4', time: 2.0, text: 'đó' },
    { id: 'l5', time: 3.0, text: 'rất' },  { id: 'l6', time: 3.5, text: 'xa' },
  ],
  chords: [
    { id: 'c1', time: 0, name: 'Am' }, { id: 'c2', time: 2, name: 'C' }, { id: 'c3', time: 4, name: 'G' },
  ],
};

export default function YouTubeSyncPage() {
  const [youtubeUrl, setYoutubeUrl]     = useState('');
  const [videoId, setVideoId]           = useState<string | null>(null);
  const [urlError, setUrlError]         = useState('');
  const [jsonData, setJsonData]         = useState<TimingJSON | null>(null);
  const [jsonFileName, setJsonFileName] = useState('');
  const [jsonParseError, setJsonParseError] = useState('');
  const [jsonCurrentTime, setJsonCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [playerReady, setPlayerReady]   = useState(false);
  const [ytCurrentTime, setYtCurrentTime] = useState(0);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Offset: giữ cả state (hiển thị UI) lẫn ref (dùng trong callback)
  const [offset, setOffsetState]        = useState(0);
  const offsetRef                       = useRef(0);
  const setOffset = (v: number) => { offsetRef.current = v; setOffsetState(v); };

  // Bar sync
  const [barSyncBar, setBarSyncBar]     = useState(1);
  const [barSyncResult, setBarSyncResult] = useState<{ bar: number; ytTime: number; jsonTime: number; offset: number } | null>(null);

  // Tap tempo
  const [tapBpm, setTapBpm]             = useState<number | null>(null);
  const [tapCount, setTapCount]         = useState(0);
  const [tapScalePreview, setTapScalePreview] = useState<number | null>(null);
  const tapTimesRef   = useRef<number[]>([]);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const iframeRef     = useRef<HTMLIFrameElement | null>(null);
  // ── MỚI: timer dùng performance.now() ── (thay cho poll YT interval cũ)
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPlayingRef  = useRef(false);
  const jsonDurationRef = useRef(60);
  const ytTimeRef     = useRef(0);
  // Ref để scroll đến bar đang active
  const activeBarRef  = useRef<HTMLButtonElement | null>(null);

  const getJsonDuration = (d: TimingJSON) => {
    const all = [...d.lyrics.map(l => l.time), ...d.chords.map(c => c.time)];
    return all.length > 0 ? Math.max(...all) + 5 : 60;
  };

  useEffect(() => {
    if (jsonData) jsonDurationRef.current = jsonData.duration ?? getJsonDuration(jsonData);
  }, [jsonData]);

  // ── MỚI: startLocalTimer dùng performance.now() — mượt hơn poll YT ──
  const startLocalTimer = useCallback((startFrom: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const startWall = performance.now();
    timerRef.current = setInterval(() => {
      const elapsed = (performance.now() - startWall) / 1000;
      const jt = startFrom + elapsed;
      const dur = jsonDurationRef.current;
      if (jt >= dur) {
        setJsonCurrentTime(dur);
        setIsPlaying(false);
        isPlayingRef.current = false;
        postToPlayer(iframeRef.current, 'pauseVideo');
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        return;
      }
      setJsonCurrentTime(jt);
    }, 50); // 50ms = 20fps, mượt hơn 200ms cũ
  }, []);

  const stopLocalTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Listen postMessage từ YT iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!event.origin.includes('youtube')) return;
      let data: Record<string, unknown>;
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }

      if (data.event === 'onReady') setPlayerReady(true);

      // ── MỚI: không dùng onStateChange để control timer (dùng manual play/pause) ──
      if (data.event === 'infoDelivery') {
        const info = data.info as Record<string, unknown>;
        if (typeof info?.currentTime === 'number') {
          ytTimeRef.current = info.currentTime;
          setYtCurrentTime(info.currentTime);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ── MỚI: auto-scroll + flash animation khi phát ──
  useEffect(() => {
    if (!activeBarRef.current || !isPlaying) return;
    const el = activeBarRef.current;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    el.classList.remove('beat-active');
    void el.offsetWidth; // reflow để reset animation
    el.classList.add('beat-active');
  }, [isPlaying, Math.floor(jsonCurrentTime * 2)]);

  // ── MỚI: barLyricGrid — grid ô nhịp với lyric align theo beat ──
  const barLyricGrid = useMemo(() => {
    if (!jsonData?.tempo) return null;
    const bpb = jsonData.timeSignature ?? 4;
    const spb = 60 / jsonData.tempo;
    const totalDur = jsonData.duration ?? getJsonDuration(jsonData);
    const totalBars = jsonData.totalBars ?? Math.ceil(totalDur / (bpb * spb));
    const tolerance = spb * 0.5;
    return Array.from({ length: totalBars }, (_, i) => {
      const barIndex = i + 1;
      const beat1Time = i * bpb * spb;
      const match = jsonData.lyrics.find(l => Math.abs(l.time - beat1Time) <= tolerance);
      return { barIndex, beat1Time, lyric: match ?? null };
    });
  }, [jsonData]);

  // ── Handlers ──
  const handleLoadVideo = () => {
    setUrlError('');
    const id = extractVideoId(youtubeUrl.trim());
    if (!id) { setUrlError('URL YouTube không hợp lệ'); return; }
    setVideoId(id);
    setPlayerReady(false);
    setIsPlaying(false);
    isPlayingRef.current = false;
    setJsonCurrentTime(0);
    ytTimeRef.current = 0;
    stopLocalTimer();
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setJsonParseError('');
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        setJsonData(data);
        setJsonFileName(file.name);
        if (data.sync?.youtubeOffsetSeconds !== undefined) setOffset(data.sync.youtubeOffsetSeconds);
      } catch { setJsonParseError('File JSON không hợp lệ'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── MỚI: handlePlay trực tiếp (không chờ onStateChange) ──
  const handlePlay = () => {
    if (!playerReady || !jsonData) return;
    postToPlayer(iframeRef.current, 'seekTo', [jsonCurrentTime + offsetRef.current, true]);
    postToPlayer(iframeRef.current, 'playVideo');
    setIsPlaying(true);
    isPlayingRef.current = true;
    startLocalTimer(jsonCurrentTime);
  };

  const handlePause = () => {
    postToPlayer(iframeRef.current, 'pauseVideo');
    setIsPlaying(false);
    isPlayingRef.current = false;
    stopLocalTimer();
  };

  // ── MỚI: seek dùng startLocalTimer thay vì sync loop ──
  const handleSeekTimeline = (e: React.ChangeEvent<HTMLInputElement>) => {
    const jt = parseFloat(e.target.value);
    setJsonCurrentTime(jt);
    postToPlayer(iframeRef.current, 'seekTo', [jt + offsetRef.current, true]);
    if (isPlayingRef.current) startLocalTimer(jt);
  };

  const getBar1JsonTime = useCallback((barNumber: number) => {
    if (!jsonData?.tempo) return null;
    const bpb = jsonData.timeSignature ?? 4;
    const spb = 60 / jsonData.tempo;
    return (barNumber - 1) * bpb * spb;
  }, [jsonData]);

  const handleBarSyncMark = useCallback(() => {
    if (!playerReady) return;
    const ytTime = ytTimeRef.current;
    const jsonTime = getBar1JsonTime(barSyncBar);
    if (jsonTime === null) return;
    const newOffset = Math.round((ytTime - jsonTime) * 1000) / 1000;
    setOffset(newOffset);
    setBarSyncResult({ bar: barSyncBar, ytTime, jsonTime, offset: newOffset });
  }, [playerReady, barSyncBar, getBar1JsonTime]);

  const handleTap = useCallback(() => {
    const now = performance.now();
    if (tapTimesRef.current.length > 0 && now - tapTimesRef.current[tapTimesRef.current.length - 1] > 3000)
      tapTimesRef.current = [];
    tapTimesRef.current.push(now);
    const t = tapTimesRef.current;
    setTapCount(t.length);
    if (t.length >= 2) {
      const intervals = t.slice(1).map((v, i) => v - t[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avg);
      setTapBpm(bpm);
      if (jsonData?.tempo) setTapScalePreview(Math.round((jsonData.tempo / bpm) * 10000) / 10000);
      else setTapScalePreview(null);
    }
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => {
      tapTimesRef.current = []; setTapCount(0); setTapBpm(null); setTapScalePreview(null);
    }, 3000);
  }, [jsonData]);

  const handleApplyTempoScale = () => {
    if (!jsonData || tapScalePreview === null || tapBpm === null) return;
    const r = tapScalePreview;
    setJsonData({
      ...jsonData,
      tempo: tapBpm,
      lyrics: jsonData.lyrics.map(l => ({ ...l, time: +(l.time * r).toFixed(4) })),
      chords: jsonData.chords.map(c => ({ ...c, time: +(c.time * r).toFixed(4) })),
      duration: jsonData.duration ? +(jsonData.duration * r).toFixed(4) : undefined,
    });
    setJsonCurrentTime(prev => +(prev * r).toFixed(4));
    tapTimesRef.current = []; setTapCount(0); setTapBpm(null); setTapScalePreview(null);
  };

  const handleResetTap = () => {
    tapTimesRef.current = []; setTapCount(0); setTapBpm(null); setTapScalePreview(null);
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
  };

  const handleExport = () => {
    if (!jsonData) return;
    const output = { ...jsonData, sync: { source: 'youtube' as const, youtubeUrl, youtubeOffsetSeconds: offsetRef.current } };
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${jsonFileName.replace('.json', '') || 'timing'}_synced.json`; a.click();
    URL.revokeObjectURL(url);
    setExportSuccess(true); setTimeout(() => setExportSuccess(false), 2500);
  };

  const duration     = jsonData ? (jsonData.duration ?? getJsonDuration(jsonData)) : 60;
  const activeChord  = jsonData?.chords.filter(c => c.time <= jsonCurrentTime).at(-1);
  const currentLyric = jsonData?.lyrics.filter(l => l.time <= jsonCurrentTime).at(-1);
  const activeLyrics = jsonData?.lyrics.filter(l => l.time <= jsonCurrentTime && l.time > jsonCurrentTime - 2) ?? [];

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
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── ROW 1: Preview (hiện khi có JSON) ── */}
        {jsonData && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Lyrics Preview — dùng barLyricGrid nếu có tempo */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={labelStyle}>📝 Lyrics Preview</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {jsonData.tempo && <span style={{ fontSize: 10, color: T.textDim, fontFamily: 'monospace' }}>{jsonData.tempo} BPM</span>}
                  {isPlaying && <span style={{ fontSize: 11, color: T.green, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.green, display: 'inline-block' }} />
                    Đang phát
                  </span>}
                </div>
              </div>

              {barLyricGrid ? (
                <>
                  <div style={{ overflowY: 'auto', maxHeight: 200, paddingRight: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(3rem, 1fr))', gap: 4 }}>
                      {barLyricGrid.map(({ barIndex, beat1Time, lyric }) => {
                        const isActive = jsonCurrentTime >= beat1Time &&
                          (barIndex === barLyricGrid.length || jsonCurrentTime < barLyricGrid[barIndex].beat1Time);
                        const isPast = jsonCurrentTime >= beat1Time && !isActive;
                        return (
                          <button
                            key={barIndex}
                            ref={isActive ? activeBarRef : null}
                            title={`Nhịp ${barIndex} — ${beat1Time.toFixed(2)}s`}
                            onClick={() => {
                              setJsonCurrentTime(beat1Time);
                              postToPlayer(iframeRef.current, 'seekTo', [beat1Time + offsetRef.current, true]);
                              if (isPlayingRef.current) startLocalTimer(beat1Time);
                            }}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center',
                              padding: '6px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                              border: isActive ? `1px solid ${T.green}` : `1px solid ${T.border}`,
                              background: isActive ? 'rgba(141,196,112,0.2)' : isPast ? 'rgba(255,255,255,0.03)' : T.bgInput,
                              color: isActive ? T.green : isPast ? T.textDim : T.textMuted,
                              transform: isActive ? 'scale(1.08)' : 'scale(1)',
                              transition: 'all 0.1s',
                              fontWeight: isActive ? 700 : 400,
                            }}
                          >
                            <span style={{ lineHeight: 1.3, textAlign: 'center', wordBreak: 'break-all' }}>
                              {lyric ? lyric.text : '—'}
                            </span>
                            <span style={{ fontSize: 9, marginTop: 2, opacity: 0.5 }}>{barIndex}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', borderTop: `1px solid ${T.border}`, paddingTop: 10, fontSize: 20, fontWeight: 700, color: T.green, minHeight: 36 }}>
                    {currentLyric?.text ?? ''}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                    {jsonData.lyrics.map(l => {
                      const isActive = currentLyric?.id === l.id;
                      const isPast = l.time < jsonCurrentTime - 2;
                      return (
                        <button key={l.id} onClick={() => {
                          setJsonCurrentTime(l.time);
                          postToPlayer(iframeRef.current, 'seekTo', [l.time + offsetRef.current, true]);
                          if (isPlayingRef.current) startLocalTimer(l.time);
                        }} style={{
                          border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                          background: isActive ? T.green : T.bgInput,
                          color: isActive ? '#fff' : isPast ? T.textDim : T.textMuted,
                          transform: isActive ? 'scale(1.05)' : 'scale(1)', transition: 'all 0.1s',
                        }}>
                          {l.text}
                        </button>
                      );
                    })}
                  </div>
                  {currentLyric && (
                    <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 600, color: T.green, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                      {activeLyrics.map(l => l.text).join(' ')}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Chord Preview */}
            <div style={card}>
              <div style={labelStyle}>♪ Chord Preview</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                {jsonData.chords.map(c => {
                  const isActive = activeChord?.id === c.id;
                  const isPast = activeChord && jsonData.chords.indexOf(c) < jsonData.chords.indexOf(activeChord);
                  return (
                    <button key={c.id} onClick={() => {
                      setJsonCurrentTime(c.time);
                      postToPlayer(iframeRef.current, 'seekTo', [c.time + offsetRef.current, true]);
                      if (isPlayingRef.current) startLocalTimer(c.time);
                    }} style={{
                      border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
                      fontFamily: 'monospace', fontSize: 14, fontWeight: 700,
                      background: isActive ? T.gold : T.bgInput,
                      color: isActive ? '#fff' : isPast ? T.textDim : T.textMuted,
                      transform: isActive ? 'scale(1.05)' : 'scale(1)', transition: 'all 0.1s',
                    }}>
                      {c.name}
                      <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 4, opacity: 0.6 }}>{formatTime(c.time)}</span>
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

        {/* ── ROW 2: Main 2-col ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* LEFT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* YouTube Player */}
            <div style={card}>
              <div style={labelStyle}>▶ Video YouTube</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={inputStyle} value={youtubeUrl}
                  onChange={e => { setYoutubeUrl(e.target.value); setUrlError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleLoadVideo()}
                  placeholder="https://www.youtube.com/watch?v=..." />
                <button style={btnPrimary(T.red)} onClick={handleLoadVideo}>Load</button>
              </div>
              {urlError && <div style={{ color: T.red, fontSize: 12 }}>⚠ {urlError}</div>}
              <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000' }}>
                <div style={{ paddingTop: '56.25%', position: 'relative' }}>
                  {!videoId ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: T.textDim, gap: 8 }}>
                      <div style={{ fontSize: 40 }}>▶</div>
                      <span style={{ fontSize: 13 }}>Nhập URL và bấm Load</span>
                    </div>
                  ) : (
                    <iframe ref={iframeRef} src={buildEmbedUrl(videoId)}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen title="YouTube player"
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

            {/* JSON Import */}
            <div style={card}>
              <div style={labelStyle}>📄 Timing JSON</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ flex: 1, cursor: 'pointer' }}>
                  <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 8, color: jsonFileName ? T.text : T.textDim }}>
                    ⬆ {jsonFileName || 'Upload file JSON...'}
                  </div>
                  <input type="file" accept=".json" onChange={handleJsonUpload} style={{ display: 'none' }} />
                </label>
                <button style={btnGhost} onClick={() => { setJsonData(MOCK_JSON); setJsonFileName('demo_song.json'); setJsonParseError(''); }}>
                  Demo
                </button>
              </div>
              {jsonParseError && <div style={{ color: T.red, fontSize: 12 }}>⚠ {jsonParseError}</div>}
              {jsonData && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[jsonData.title || 'Untitled', `${jsonData.lyrics.length} lyrics`, `${jsonData.chords.length} chords`,
                    formatTime(duration), jsonData.tempo ? `${jsonData.tempo} BPM` : null].filter(Boolean).map((tag, i) => (
                    <span key={i} style={{ background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 6, padding: '3px 10px', fontSize: 11, color: i === 0 ? T.text : T.textMuted }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Timeline + Play/Pause */}
            <div style={card}>
              <div style={labelStyle}>♪ Timeline</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: T.green }}>{formatTime(jsonCurrentTime)}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: T.textDim }}>{formatTime(duration)}</span>
              </div>
              <input type="range" min={0} max={duration} step={0.1} value={jsonCurrentTime}
                onChange={handleSeekTimeline} style={{ width: '100%', accentColor: T.green }} />
              <button
                onClick={isPlaying ? handlePause : handlePlay}
                disabled={!playerReady || !jsonData}
                style={{ ...btnPrimary(isPlaying ? '#374151' : '#2A5A3A'), justifyContent: 'center', padding: '13px', fontSize: 14, opacity: (!playerReady || !jsonData) ? 0.4 : 1 }}
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>

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
                style={{ ...btnPrimary(exportSuccess ? '#1A5A3A' : '#1A4A8A'), justifyContent: 'center', opacity: !jsonData ? 0.4 : 1 }}>
                {exportSuccess ? '✓ Đã xuất!' : '💾 Export JSON với offset'}
              </button>
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Offset Panel */}
            <div style={card}>
              <div style={labelStyle}>⏱ Offset Căn Chỉnh</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, fontWeight: 700, fontFamily: 'monospace', color: T.gold }}>
                  {offset >= 0 ? '+' : ''}{offset.toFixed(3)}s
                </div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>youtubeTime = jsonTime + offset</div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {([-1, -0.1, 0.1, 1] as const).map(d => (
                  <button key={d} onClick={() => setOffset(Math.round((offset + d) * 1000) / 1000)} style={{
                    ...btnGhost,
                    color: d < 0 ? '#F87171' : T.green,
                    borderColor: d < 0 ? '#7F1D1D' : '#1A4A2A',
                    fontFamily: 'monospace', fontWeight: 700,
                  }}>
                    {d > 0 ? '+' : ''}{d}s
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>Nhập:</span>
                <input type="number" step="0.1" value={offset}
                  onChange={e => setOffset(parseFloat(e.target.value) || 0)}
                  style={{ ...inputStyle, fontFamily: 'monospace', color: T.gold, textAlign: 'center' }} />
                <button style={btnGhost} onClick={() => setOffset(0)}>↺</button>
              </div>
              <button
                onClick={() => setOffset(Math.round(ytTimeRef.current * 1000) / 1000)}
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

            {/* Bar Sync */}
            <div style={card}>
              <div style={labelStyle}>♩ Đồng bộ phách mạnh</div>
              {!jsonData?.tempo ? (
                <div style={{ fontSize: 12, color: '#CA8A04', display: 'flex', alignItems: 'center', gap: 6 }}>
                  ⚠ Cần JSON có trường <code style={{ background: T.bgInput, padding: '1px 5px', borderRadius: 4 }}>tempo</code>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>
                    Play video đến phách 1 của nhịp muốn đồng bộ → bấm <strong style={{ color: T.text }}>Mark</strong>.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button style={btnGhost} onClick={() => setBarSyncBar(b => Math.max(1, b - 1))}>−</button>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'monospace', color: T.cyan }}>{barSyncBar}</div>
                      <div style={{ fontSize: 10, color: T.textDim }}>nhịp</div>
                    </div>
                    <button style={btnGhost} onClick={() => setBarSyncBar(b => b + 1)}>+</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[1,2,3,4,5,8,9,13,17].map(n => (
                      <button key={n} onClick={() => setBarSyncBar(n)} style={{
                        ...btnGhost,
                        color: barSyncBar === n ? T.cyan : T.textMuted,
                        borderColor: barSyncBar === n ? T.cyan : T.border,
                        padding: '5px 10px', fontSize: 12, fontFamily: 'monospace',
                      }}>{n}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: T.textDim, textAlign: 'right', fontFamily: 'monospace' }}>
                    JSON beat 1 = {getBar1JsonTime(barSyncBar)?.toFixed(3)}s
                  </div>
                  <button onPointerDown={handleBarSyncMark} disabled={!playerReady}
                    style={{ ...btnPrimary('#0E7A72'), justifyContent: 'center', padding: '13px', fontSize: 14, opacity: playerReady ? 1 : 0.4, userSelect: 'none' }}>
                    Mark — Phách 1, Nhịp {barSyncBar}
                  </button>
                  {barSyncResult && (
                    <div style={{ background: T.bgInput, borderRadius: 10, padding: 12, fontSize: 11, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {[['Nhịp đã mark', `#${barSyncResult.bar}`, T.text], ['YT lúc mark', `${barSyncResult.ytTime.toFixed(3)}s`, '#F87171'], ['JSON beat 1', `${barSyncResult.jsonTime.toFixed(3)}s`, T.green]].map(([k,v,c]) => (
                        <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', color: T.textMuted }}>
                          <span>{k}</span><span style={{ color: c as string }}>{v}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: T.textMuted, borderTop: `1px solid ${T.border}`, paddingTop: 5, marginTop: 3 }}>
                        <span>Offset đã set</span>
                        <span style={{ color: T.gold, fontWeight: 700 }}>{barSyncResult.offset >= 0 ? '+' : ''}{barSyncResult.offset.toFixed(3)}s</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Tap Tempo */}
            <div style={card}>
              <div style={labelStyle}>🥁 Tap Tempo Calibration</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" min={20} max={300} step={0.1} placeholder="Nhập BPM YouTube..."
                  style={{ ...inputStyle, fontFamily: 'monospace', color: T.rose }}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > 0) {
                      setTapBpm(Math.round(v));
                      if (jsonData?.tempo) setTapScalePreview(Math.round((jsonData.tempo / v) * 10000) / 10000);
                    } else { setTapBpm(null); setTapScalePreview(null); }
                  }} />
                <span style={{ fontSize: 12, color: T.textDim }}>BPM</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 1, background: T.border }} />
                <span style={{ fontSize: 11, color: T.textDim }}>hoặc tap</span>
                <div style={{ flex: 1, height: 1, background: T.border }} />
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                <button onPointerDown={handleTap} style={{
                  flex: 1, border: `2px dashed ${tapCount > 0 ? T.rose : T.border}`,
                  borderRadius: 16, background: tapCount > 0 ? 'rgba(224,85,128,0.1)' : T.bgInput,
                  cursor: 'pointer', padding: '20px 0', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 4, userSelect: 'none', transition: 'all 0.1s',
                }}>
                  <span style={{ fontSize: 28 }}>🥁</span>
                  <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>TAP</span>
                  {tapCount > 0 && <span style={{ fontSize: 10, color: T.textDim }}>{tapCount} taps</span>}
                </button>
                <div style={{ flex: 1, background: T.bgInput, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '16px 8px' }}>
                  <div style={{ fontSize: 40, fontWeight: 700, fontFamily: 'monospace', color: tapBpm ? T.rose : T.textDim }}>{tapBpm ?? '--'}</div>
                  <div style={{ fontSize: 11, color: T.textDim }}>BPM YouTube</div>
                  {jsonData?.tempo && <div style={{ fontSize: 11, color: T.textDim }}>JSON: <span style={{ color: T.textMuted, fontFamily: 'monospace' }}>{jsonData.tempo}</span></div>}
                </div>
              </div>
              {tapBpm && jsonData?.tempo && tapScalePreview !== null && (
                <div style={{ background: T.bgInput, borderRadius: 10, padding: 12, fontSize: 11, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[['Tempo JSON gốc', `${jsonData.tempo} BPM`, T.text], ['Tempo tap', `${tapBpm} BPM`, T.rose]].map(([k,v,c]) => (
                    <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', color: T.textMuted }}>
                      <span>{k}</span><span style={{ color: c as string }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: T.textMuted, borderTop: `1px solid ${T.border}`, paddingTop: 5, marginTop: 3 }}>
                    <span>Scale ratio</span>
                    <span style={{ color: tapScalePreview > 1 ? '#F97316' : tapScalePreview < 1 ? '#38BDF8' : T.green, fontWeight: 700 }}>×{tapScalePreview.toFixed(4)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: T.textMuted }}>
                    <span>Sai lệch</span>
                    <span style={{ color: T.gold }}>{tapBpm > jsonData.tempo ? '+' : ''}{((tapBpm / jsonData.tempo - 1) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleApplyTempoScale} disabled={!tapScalePreview || !jsonData?.tempo}
                  style={{ ...btnPrimary('#8A2050'), flex: 1, justifyContent: 'center', opacity: (!tapScalePreview || !jsonData?.tempo) ? 0.4 : 1 }}>
                  Apply Scale to JSON
                </button>
                <button onClick={handleResetTap} disabled={tapCount === 0}
                  style={{ ...btnGhost, opacity: tapCount === 0 ? 0.4 : 1 }}>↺</button>
              </div>
            </div>
          </div>
        </div>

        {/* Hướng dẫn */}
        <div style={{ ...card, background: 'rgba(255,255,255,0.02)', fontSize: 12, color: T.textDim, lineHeight: 1.9 }}>
          <strong style={{ color: T.textMuted }}>Hướng dẫn:</strong>
          {['Nhập URL YouTube → Load', 'Upload JSON hoặc dùng Demo', 'Dùng Tap Tempo nếu BPM video khác JSON', 'Play video đến phách 1 của nhịp muốn đồng bộ → Mark', 'Bấm Play — ô nhịp sáng theo lyric', 'Export khi xong'].map((s, i) => (
            <div key={i}>{i + 1}. {s}</div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes beatFlash { 0%,100% { box-shadow: none; } 30% { box-shadow: 0 0 10px rgba(141,196,112,0.7); } }
        .beat-active { animation: beatFlash 0.3s ease-out; }
        button:active { transform: scale(0.97); }
      `}</style>
    </div>
  );
}
