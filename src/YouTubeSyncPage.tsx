import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface LyricEvent  { id: string; time: number; text: string }
interface ChordEvent  { id: string; time: number; name: string }
interface SyncMeta    { source: 'youtube'; youtubeUrl: string; youtubeOffsetSeconds: number }
interface TimingJSON {
  title: string; artist?: string; tone?: string; tempo?: number;
  timeSignature?: number; totalBars?: number; duration?: number;
  lyrics: LyricEvent[]; chords: ChordEvent[]; sync?: SyncMeta;
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
function buildEmbedUrl(id: string): string {
  const p = new URLSearchParams({ enablejsapi:'1', controls:'1', rel:'0', modestbranding:'1' });
  return `https://www.youtube.com/embed/${id}?${p}`;
}
function formatTime(s: number): string {
  return `${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,'0')}`;
}
function postToPlayer(iframe: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event:'command', func, args }), '*');
}

// ─────────────────────────────────────────────
// Theme — Calm Music Learning Workspace
// ─────────────────────────────────────────────
const T = {
  // Backgrounds
  bg:          '#F5F1E8',   // paper — 60%
  bgCard:      '#FBF8F2',   // card surface
  bgInput:     '#F0E7D8',   // input / chip
  bgGoldSoft:  '#F3E3B5',   // active highlight

  // Deep green — 20%
  headerBg:    '#123524',
  green:       '#1B4332',   // primary button
  greenSoft:   '#2D5A45',   // hover

  // Wood — 10%
  wood:        '#8A5A32',
  woodLight:   '#B07A45',

  // Gold — 5%
  gold:        '#C6A15B',
  goldStrong:  '#D89B22',

  // Text & border — 5%
  text:        '#1F2933',
  textSub:     '#5F6B62',
  border:      '#E5DED2',
  borderMid:   '#D4C9B8',

  // Status
  red:         '#C0392B',
  cyan:        '#1B7A6E',
};

// ─────────────────────────────────────────────
// Shared style primitives
// ─────────────────────────────────────────────
const card: React.CSSProperties = {
  background: T.bgCard,
  border: `1px solid ${T.border}`,
  borderRadius: 14,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  boxShadow: '0 1px 4px rgba(31,41,51,0.06)',
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: T.textSub,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const inputBase: React.CSSProperties = {
  flex: 1,
  background: T.bgInput,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '9px 13px',
  fontSize: 13,
  color: T.text,
  fontFamily: 'inherit',
  outline: 'none',
};

const btnPrimary = (bg = T.green): React.CSSProperties => ({
  background: bg,
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  padding: '10px 18px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
  transition: 'background 0.15s',
});

const btnOutline: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${T.borderMid}`,
  borderRadius: 8,
  color: T.textSub,
  fontSize: 13,
  fontWeight: 500,
  padding: '8px 14px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
  transition: 'border-color 0.15s, color 0.15s',
};

const divider: React.CSSProperties = {
  height: 1,
  background: T.border,
  margin: '2px 0',
};

const infoRow = (val_color = T.green): React.CSSProperties => ({ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textSub, fontFamily: 'monospace' });

// ─────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────
const MOCK_JSON: TimingJSON = {
  title: 'Demo Song', tempo: 80, duration: 60,
  lyrics: [
    { id:'l1', time:0, text:'Thành' }, { id:'l2', time:0.5, text:'phố' },
    { id:'l3', time:1.0, text:'nào' }, { id:'l4', time:2.0, text:'đó' },
    { id:'l5', time:3.0, text:'rất' }, { id:'l6', time:3.5, text:'xa' },
  ],
  chords: [{ id:'c1', time:0, name:'Am' }, { id:'c2', time:2, name:'C' }, { id:'c3', time:4, name:'G' }],
};

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function YouTubeSyncPage() {
  const [youtubeUrl, setYoutubeUrl]       = useState('');
  const [videoId, setVideoId]             = useState<string | null>(null);
  const [urlError, setUrlError]           = useState('');
  const [jsonData, setJsonData]           = useState<TimingJSON | null>(null);
  const [jsonFileName, setJsonFileName]   = useState('');
  const [jsonParseError, setJsonParseError] = useState('');
  const [jsonCurrentTime, setJsonCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [playerReady, setPlayerReady]     = useState(false);
  const [ytCurrentTime, setYtCurrentTime] = useState(0);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Offset: state cho UI + ref cho callbacks
  const [offset, setOffsetState] = useState(0);
  const offsetRef = useRef(0);
  const setOffset = (v: number) => { offsetRef.current = v; setOffsetState(v); };

  // Bar sync
  const [barSyncBar, setBarSyncBar] = useState(1);
  const [barSyncResult, setBarSyncResult] = useState<{bar:number;ytTime:number;jsonTime:number;offset:number}|null>(null);

  // Tap tempo
  const [tapBpm, setTapBpm]             = useState<number|null>(null);
  const [tapCount, setTapCount]         = useState(0);
  const [tapScalePreview, setTapScalePreview] = useState<number|null>(null);
  const tapTimesRef   = useRef<number[]>([]);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const iframeRef    = useRef<HTMLIFrameElement|null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval>|null>(null);
  const isPlayingRef = useRef(false);
  const jsonDurationRef = useRef(60);
  const ytTimeRef    = useRef(0);
  const activeBarRef = useRef<HTMLButtonElement|null>(null);

  const getJsonDuration = (d: TimingJSON) => {
    const all = [...d.lyrics.map(l=>l.time), ...d.chords.map(c=>c.time)];
    return all.length > 0 ? Math.max(...all) + 5 : 60;
  };

  useEffect(() => {
    if (jsonData) jsonDurationRef.current = jsonData.duration ?? getJsonDuration(jsonData);
  }, [jsonData]);

  const startLocalTimer = useCallback((startFrom: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const startWall = performance.now();
    timerRef.current = setInterval(() => {
      const jt = startFrom + (performance.now() - startWall) / 1000;
      const dur = jsonDurationRef.current;
      if (jt >= dur) {
        setJsonCurrentTime(dur); setIsPlaying(false); isPlayingRef.current = false;
        postToPlayer(iframeRef.current, 'pauseVideo');
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        return;
      }
      setJsonCurrentTime(jt);
    }, 50);
  }, []);

  const stopLocalTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!event.origin.includes('youtube')) return;
      let data: Record<string,unknown>;
      try { data = typeof event.data==='string' ? JSON.parse(event.data) : event.data; } catch { return; }
      if (data.event === 'onReady') setPlayerReady(true);
      if (data.event === 'infoDelivery') {
        const info = data.info as Record<string,unknown>;
        if (typeof info?.currentTime === 'number') { ytTimeRef.current = info.currentTime; setYtCurrentTime(info.currentTime); }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (!activeBarRef.current || !isPlaying) return;
    const el = activeBarRef.current;
    el.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'nearest' });
    el.classList.remove('beat-active');
    void el.offsetWidth;
    el.classList.add('beat-active');
  }, [isPlaying, Math.floor(jsonCurrentTime * 2)]);

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
    setVideoId(id); setPlayerReady(false); setIsPlaying(false);
    isPlayingRef.current = false; setJsonCurrentTime(0); ytTimeRef.current = 0; stopLocalTimer();
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setJsonParseError('');
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        setJsonData(data); setJsonFileName(file.name);
        if (data.sync?.youtubeOffsetSeconds !== undefined) setOffset(data.sync.youtubeOffsetSeconds);
      } catch { setJsonParseError('File JSON không hợp lệ'); }
    };
    reader.readAsText(file); e.target.value = '';
  };

  const handlePlay = () => {
    if (!playerReady || !jsonData) return;
    postToPlayer(iframeRef.current, 'seekTo', [jsonCurrentTime + offsetRef.current, true]);
    postToPlayer(iframeRef.current, 'playVideo');
    setIsPlaying(true); isPlayingRef.current = true; startLocalTimer(jsonCurrentTime);
  };

  const handlePause = () => {
    postToPlayer(iframeRef.current, 'pauseVideo');
    setIsPlaying(false); isPlayingRef.current = false; stopLocalTimer();
  };

  const handleSeekTimeline = (e: React.ChangeEvent<HTMLInputElement>) => {
    const jt = parseFloat(e.target.value);
    setJsonCurrentTime(jt);
    postToPlayer(iframeRef.current, 'seekTo', [jt + offsetRef.current, true]);
    if (isPlayingRef.current) startLocalTimer(jt);
  };

  const getBar1JsonTime = useCallback((n: number) => {
    if (!jsonData?.tempo) return null;
    return (n-1) * (jsonData.timeSignature ?? 4) * (60/jsonData.tempo);
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
    if (tapTimesRef.current.length > 0 && now - tapTimesRef.current.at(-1)! > 3000) tapTimesRef.current = [];
    tapTimesRef.current.push(now);
    const t = tapTimesRef.current;
    setTapCount(t.length);
    if (t.length >= 2) {
      const avg = t.slice(1).map((v,i)=>v-t[i]).reduce((a,b)=>a+b,0) / (t.length-1);
      const bpm = Math.round(60000/avg);
      setTapBpm(bpm);
      if (jsonData?.tempo) setTapScalePreview(Math.round((jsonData.tempo/bpm)*10000)/10000);
      else setTapScalePreview(null);
    }
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => {
      tapTimesRef.current=[]; setTapCount(0); setTapBpm(null); setTapScalePreview(null);
    }, 3000);
  }, [jsonData]);

  const handleApplyTempoScale = () => {
    if (!jsonData || tapScalePreview===null || tapBpm===null) return;
    const r = tapScalePreview;
    setJsonData({ ...jsonData, tempo: tapBpm,
      lyrics: jsonData.lyrics.map(l=>({...l, time:+(l.time*r).toFixed(4)})),
      chords: jsonData.chords.map(c=>({...c, time:+(c.time*r).toFixed(4)})),
      duration: jsonData.duration ? +(jsonData.duration*r).toFixed(4) : undefined,
    });
    setJsonCurrentTime(p => +(p*r).toFixed(4));
    tapTimesRef.current=[]; setTapCount(0); setTapBpm(null); setTapScalePreview(null);
  };

  const handleResetTap = () => {
    tapTimesRef.current=[]; setTapCount(0); setTapBpm(null); setTapScalePreview(null);
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
  };

  const handleExport = () => {
    if (!jsonData) return;
    const out = { ...jsonData, sync:{ source:'youtube' as const, youtubeUrl, youtubeOffsetSeconds: offsetRef.current } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(out,null,2)], {type:'application/json'}));
    Object.assign(document.createElement('a'), { href:url, download:`${jsonFileName.replace('.json','')||'timing'}_synced.json` }).click();
    URL.revokeObjectURL(url);
    setExportSuccess(true); setTimeout(()=>setExportSuccess(false), 2500);
  };

  const duration     = jsonData ? (jsonData.duration ?? getJsonDuration(jsonData)) : 60;
  const activeChord  = jsonData?.chords.filter(c=>c.time<=jsonCurrentTime).at(-1);
  const currentLyric = jsonData?.lyrics.filter(l=>l.time<=jsonCurrentTime).at(-1);
  const activeLyrics = jsonData?.lyrics.filter(l=>l.time<=jsonCurrentTime && l.time>jsonCurrentTime-2) ?? [];
  const progressPct  = duration > 0 ? (jsonCurrentTime / duration) * 100 : 0;

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:T.bg, color:T.text, fontFamily:"'Inter', 'Segoe UI', sans-serif" }}>

      {/* ── Header ── */}
      <header style={{ background:T.headerBg, padding:'0 24px', display:'flex', alignItems:'center', height:52, gap:16, boxShadow:'0 2px 8px rgba(0,0,0,0.25)' }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:28, height:28, background:T.goldStrong, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, color:'#fff', letterSpacing:'-0.5px' }}>C#</div>
          <div style={{ width:1, height:20, background:'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize:13, color:'rgba(255,255,255,0.8)', fontWeight:400 }}>Thầy Văn Anh</span>
        </div>

        {/* Title */}
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          <span style={{ fontSize:14, fontWeight:600, color:'#fff' }}>YouTube Sync</span>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.08)', borderRadius:4, padding:'2px 8px' }}>Căn chỉnh timing</span>
        </div>

        {/* Nav */}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>{ window.location.href='/editor'; }} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:7, color:'rgba(255,255,255,0.75)', fontSize:12, padding:'5px 12px', cursor:'pointer' }}>
            ← Editor
          </button>
          <button onClick={()=>{ window.location.href='/player'; }} style={{ background:T.goldStrong, border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:600, padding:'5px 12px', cursor:'pointer' }}>
            Player →
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ maxWidth:1120, margin:'0 auto', padding:'24px 20px 40px', display:'flex', flexDirection:'column', gap:20 }}>

        {/* ── Preview Row (hiện khi có JSON) ── */}
        {jsonData && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

            {/* Lyrics */}
            <div style={card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={sectionLabel}>Lyrics Preview</span>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  {jsonData.tempo && <span style={{ fontSize:10, color:T.textSub, fontFamily:'monospace' }}>{jsonData.tempo} BPM</span>}
                  {isPlaying && (
                    <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:T.green, fontWeight:500 }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:T.green, display:'inline-block', animation:'pulse 1s ease-in-out infinite' }} />
                      Đang phát
                    </span>
                  )}
                </div>
              </div>

              {barLyricGrid ? (
                <>
                  <div style={{ overflowY:'auto', maxHeight:180 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(46px,1fr))', gap:4 }}>
                      {barLyricGrid.map(({ barIndex, beat1Time, lyric }) => {
                        const isActive = jsonCurrentTime >= beat1Time &&
                          (barIndex === barLyricGrid.length || jsonCurrentTime < barLyricGrid[barIndex].beat1Time);
                        const isPast = jsonCurrentTime >= beat1Time && !isActive;
                        return (
                          <button key={barIndex} ref={isActive ? activeBarRef : null}
                            title={`Nhịp ${barIndex} — ${beat1Time.toFixed(2)}s`}
                            onClick={() => {
                              setJsonCurrentTime(beat1Time);
                              postToPlayer(iframeRef.current,'seekTo',[beat1Time+offsetRef.current,true]);
                              if (isPlayingRef.current) startLocalTimer(beat1Time);
                            }}
                            style={{
                              display:'flex', flexDirection:'column', alignItems:'center',
                              padding:'6px 3px', borderRadius:7, cursor:'pointer', fontSize:12,
                              border: isActive ? `1.5px solid ${T.goldStrong}` : `1px solid ${T.border}`,
                              background: isActive ? T.bgGoldSoft : isPast ? 'rgba(0,0,0,0.03)' : T.bgInput,
                              color: isActive ? T.text : isPast ? T.borderMid : T.textSub,
                              fontWeight: isActive ? 700 : 400,
                              transform: isActive ? 'scale(1.06)' : 'scale(1)',
                              transition: 'all 0.12s',
                              boxShadow: isActive ? `0 0 0 2px ${T.goldStrong}22` : 'none',
                            }}
                          >
                            <span style={{ lineHeight:1.3, textAlign:'center', wordBreak:'break-all' }}>
                              {lyric ? lyric.text : <span style={{ opacity:0.3 }}>—</span>}
                            </span>
                            <span style={{ fontSize:9, marginTop:2, color: isActive ? T.goldStrong : T.borderMid }}>{barIndex}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ ...divider }} />
                  <div style={{ textAlign:'center', fontSize:22, fontWeight:700, color:T.text, minHeight:32, letterSpacing:2 }}>
                    {currentLyric?.text ?? <span style={{ color:T.border }}>—</span>}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, maxHeight:150, overflowY:'auto' }}>
                    {jsonData.lyrics.map(l => {
                      const isActive = currentLyric?.id === l.id;
                      const isPast = l.time < jsonCurrentTime - 2;
                      return (
                        <button key={l.id} onClick={() => {
                          setJsonCurrentTime(l.time);
                          postToPlayer(iframeRef.current,'seekTo',[l.time+offsetRef.current,true]);
                          if (isPlayingRef.current) startLocalTimer(l.time);
                        }} style={{
                          border: isActive ? `1.5px solid ${T.goldStrong}` : `1px solid ${T.border}`,
                          borderLeft: isActive ? `3px solid ${T.goldStrong}` : `1px solid ${T.border}`,
                          borderRadius:7, padding:'4px 10px', cursor:'pointer', fontSize:13, fontWeight: isActive ? 600 : 400,
                          background: isActive ? T.bgGoldSoft : isPast ? 'rgba(0,0,0,0.03)' : T.bgInput,
                          color: isActive ? T.text : isPast ? T.borderMid : T.textSub,
                          transition:'all 0.1s',
                        }}>
                          {l.text}
                        </button>
                      );
                    })}
                  </div>
                  {currentLyric && <div style={{ textAlign:'center', fontSize:20, fontWeight:700, color:T.text, borderTop:`1px solid ${T.border}`, paddingTop:10, letterSpacing:2 }}>
                    {activeLyrics.map(l=>l.text).join(' ')}
                  </div>}
                </>
              )}
            </div>

            {/* Chords */}
            <div style={card}>
              <span style={sectionLabel}>Chord Preview</span>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, maxHeight:160, overflowY:'auto' }}>
                {jsonData.chords.map(c => {
                  const isActive = activeChord?.id === c.id;
                  const isPast = activeChord && jsonData.chords.indexOf(c) < jsonData.chords.indexOf(activeChord);
                  return (
                    <button key={c.id} onClick={() => {
                      setJsonCurrentTime(c.time);
                      postToPlayer(iframeRef.current,'seekTo',[c.time+offsetRef.current,true]);
                      if (isPlayingRef.current) startLocalTimer(c.time);
                    }} style={{
                      borderRadius:8, padding:'6px 14px', cursor:'pointer',
                      fontFamily:'monospace', fontSize:15, fontWeight:700,
                      border: isActive ? `1.5px solid ${T.goldStrong}` : `1px solid ${T.border}`,
                      borderLeft: isActive ? `3px solid ${T.goldStrong}` : `1px solid ${T.border}`,
                      background: isActive ? T.bgGoldSoft : isPast ? 'rgba(0,0,0,0.03)' : T.bgInput,
                      color: isActive ? T.text : isPast ? T.borderMid : T.textSub,
                      transition:'all 0.12s',
                    }}>
                      {c.name}
                      <span style={{ fontSize:9, fontWeight:400, marginLeft:5, color:T.borderMid }}>{formatTime(c.time)}</span>
                    </button>
                  );
                })}
              </div>
              {activeChord && (
                <div style={{ ...divider }} />
              )}
              {activeChord && (
                <div style={{ textAlign:'center', padding:'8px 0' }}>
                  <span style={{ fontSize:42, fontWeight:800, fontFamily:'monospace', color:T.green, letterSpacing:2 }}>
                    {activeChord.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Main 2-col ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

          {/* ── LEFT ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* YouTube Player */}
            <div style={card}>
              <span style={sectionLabel}>Video YouTube</span>
              <div style={{ display:'flex', gap:8 }}>
                <input style={inputBase} value={youtubeUrl}
                  onChange={e => { setYoutubeUrl(e.target.value); setUrlError(''); }}
                  onKeyDown={e => e.key==='Enter' && handleLoadVideo()}
                  placeholder="https://www.youtube.com/watch?v=..." />
                <button style={{ ...btnPrimary(T.red), padding:'9px 16px' }} onClick={handleLoadVideo}>Load</button>
              </div>
              {urlError && <div style={{ color:T.red, fontSize:12, display:'flex', alignItems:'center', gap:5 }}>⚠ {urlError}</div>}

              <div style={{ borderRadius:10, overflow:'hidden', background:'#111', border:`1px solid ${T.border}` }}>
                <div style={{ paddingTop:'56.25%', position:'relative' }}>
                  {!videoId ? (
                    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, color:'#666' }}>
                      <div style={{ fontSize:36, opacity:0.4 }}>▶</div>
                      <span style={{ fontSize:13 }}>Nhập URL và bấm Load</span>
                    </div>
                  ) : (
                    <iframe ref={iframeRef} src={buildEmbedUrl(videoId)}
                      style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen title="YouTube player"
                      onLoad={() => setTimeout(()=>{ iframeRef.current?.contentWindow?.postMessage(JSON.stringify({event:'listening'}),'*'); },1000)}
                    />
                  )}
                  {videoId && !playerReady && (
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                      <div style={{ background:'rgba(0,0,0,0.7)', borderRadius:20, padding:'6px 16px', fontSize:12, color:'#ccc', display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ width:12, height:12, borderRadius:'50%', border:'2px solid #555', borderTopColor:'#fff', display:'inline-block', animation:'spin 0.8s linear infinite' }} />
                        Đang kết nối...
                      </div>
                    </div>
                  )}
                </div>
                {videoId && playerReady && (
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'7px 12px', background:T.bgCard, fontSize:11, color:T.textSub, borderTop:`1px solid ${T.border}` }}>
                    <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:'#3A7D44', display:'inline-block', animation:'pulse 1s ease-in-out infinite' }} />
                      Đã kết nối
                    </span>
                    <span style={{ fontFamily:'monospace', color:T.textSub }}>YT: {formatTime(ytCurrentTime)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* JSON Import */}
            <div style={card}>
              <span style={sectionLabel}>Timing JSON</span>
              <div style={{ display:'flex', gap:8 }}>
                <label style={{ flex:1, cursor:'pointer' }}>
                  <div style={{ ...inputBase, display:'flex', alignItems:'center', gap:8, color: jsonFileName ? T.text : T.textSub, cursor:'pointer' }}>
                    <span style={{ fontSize:14 }}>⬆</span>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {jsonFileName || 'Upload file JSON...'}
                    </span>
                  </div>
                  <input type="file" accept=".json" onChange={handleJsonUpload} style={{ display:'none' }} />
                </label>
                <button style={btnOutline} onClick={() => { setJsonData(MOCK_JSON); setJsonFileName('demo_song.json'); setJsonParseError(''); }}>
                  Demo
                </button>
              </div>
              {jsonParseError && <div style={{ color:T.red, fontSize:12 }}>⚠ {jsonParseError}</div>}
              {jsonData && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                  {[jsonData.title||'Untitled', `${jsonData.lyrics.length} lyrics`, `${jsonData.chords.length} chords`, formatTime(duration), jsonData.tempo?`${jsonData.tempo} BPM`:null].filter(Boolean).map((tag,i)=>(
                    <span key={i} style={{ background:T.bgInput, border:`1px solid ${T.border}`, borderRadius:5, padding:'3px 9px', fontSize:11, color: i===0 ? T.text : T.textSub, fontWeight: i===0?600:400 }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Timeline + Playback */}
            <div style={card}>
              <span style={sectionLabel}>Timeline</span>

              {/* Time display */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                <span style={{ fontFamily:'monospace', fontSize:26, fontWeight:700, color:T.green, lineHeight:1 }}>{formatTime(jsonCurrentTime)}</span>
                <span style={{ fontFamily:'monospace', fontSize:12, color:T.textSub }}>{formatTime(duration)}</span>
              </div>

              {/* Progress bar with playhead */}
              <div style={{ position:'relative' }}>
                <div style={{ height:6, background:T.bgInput, borderRadius:3, border:`1px solid ${T.border}`, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${progressPct}%`, background:T.green, borderRadius:3, transition:'width 0.05s linear' }} />
                </div>
                <input type="range" min={0} max={duration} step={0.1} value={jsonCurrentTime}
                  onChange={handleSeekTimeline}
                  style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0, cursor:'pointer' }} />
              </div>

              <button onClick={isPlaying ? handlePause : handlePlay}
                disabled={!playerReady || !jsonData}
                style={{ ...btnPrimary(isPlaying ? T.woodLight : T.green), padding:'12px', fontSize:14,
                  opacity:(!playerReady||!jsonData)?0.45:1 }}>
                {isPlaying ? '⏸  Pause' : '▶  Play'}
              </button>

              {/* Debug info box */}
              <div style={{ background:T.bgInput, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 14px', display:'flex', flexDirection:'column', gap:5 }}>
                {[['JSON time', `${jsonCurrentTime.toFixed(2)}s`, T.green],
                  ['Offset', `${offset>=0?'+':''}${offset.toFixed(3)}s`, T.goldStrong],
                  ['YouTube time', `${(jsonCurrentTime+offset).toFixed(2)}s`, T.textSub]
                ].map(([k,v,c])=>(
                  <div key={k as string} style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontFamily:'monospace' }}>
                    <span style={{ color:T.textSub }}>{k}</span>
                    <span style={{ color:c as string, fontWeight:600 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Export */}
              <button onClick={handleExport} disabled={!jsonData}
                style={{ ...btnPrimary(exportSuccess ? '#2A6B3A' : T.goldStrong), opacity:!jsonData?0.45:1 }}>
                {exportSuccess ? '✓ Đã xuất thành công!' : '💾  Export JSON với offset'}
              </button>
            </div>
          </div>

          {/* ── RIGHT ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Offset Panel */}
            <div style={card}>
              <span style={sectionLabel}>Offset Căn Chỉnh</span>

              <div style={{ textAlign:'center', padding:'8px 0' }}>
                <div style={{ fontSize:38, fontWeight:700, fontFamily:'monospace', color:T.green, letterSpacing:1 }}>
                  {offset>=0?'+':''}{offset.toFixed(3)}<span style={{ fontSize:20, fontWeight:400, color:T.textSub }}>s</span>
                </div>
                <div style={{ fontSize:11, color:T.textSub, marginTop:4 }}>youtubeTime = jsonTime + offset</div>
              </div>

              {/* Quick adjust */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
                {([-1,-0.1,0.1,1] as const).map(d=>(
                  <button key={d} onClick={()=>setOffset(Math.round((offset+d)*1000)/1000)} style={{
                    background: d<0 ? '#FFF0EE' : '#EEF5F0',
                    border: `1px solid ${d<0 ? '#F0C0B8' : T.border}`,
                    borderRadius:7, padding:'8px 0', cursor:'pointer', fontSize:12,
                    color: d<0 ? T.red : T.green, fontFamily:'monospace', fontWeight:700,
                    transition:'all 0.12s',
                  }}>
                    {d>0?'+':''}{d}s
                  </button>
                ))}
              </div>

              {/* Manual input */}
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:11, color:T.textSub, whiteSpace:'nowrap' }}>Nhập trực tiếp:</span>
                <input type="number" step="0.1" value={offset}
                  onChange={e=>setOffset(parseFloat(e.target.value)||0)}
                  style={{ ...inputBase, fontFamily:'monospace', color:T.green, textAlign:'center' }} />
                <button style={btnOutline} onClick={()=>setOffset(0)} title="Reset">↺</button>
              </div>

              {/* Set from YT */}
              <button onClick={()=>setOffset(Math.round(ytTimeRef.current*1000)/1000)}
                disabled={!playerReady}
                style={{ ...btnPrimary(), opacity:playerReady?1:0.45, fontSize:12 }}>
                Set vị trí YouTube hiện tại làm mốc 0
              </button>
              {playerReady && (
                <div style={{ textAlign:'center', fontSize:11, color:T.textSub, fontFamily:'monospace' }}>
                  YT hiện tại: {formatTime(ytCurrentTime)}
                </div>
              )}
            </div>

            {/* Bar Sync */}
            <div style={card}>
              <span style={sectionLabel}>Đồng bộ phách mạnh</span>
              {!jsonData?.tempo ? (
                <div style={{ fontSize:12, color:'#92722A', background:'#FDF5E0', border:'1px solid #EED88A', borderRadius:7, padding:'8px 12px', display:'flex', alignItems:'center', gap:6 }}>
                  ⚠ Cần JSON có trường <code style={{ background:'#FBF8F2', padding:'1px 5px', borderRadius:4, fontSize:11 }}>tempo</code>
                </div>
              ) : (
                <>
                  <p style={{ fontSize:12, color:T.textSub, lineHeight:1.7, margin:0 }}>
                    Play video đến đúng phách 1 của nhịp muốn đồng bộ → bấm <strong style={{ color:T.text }}>Mark</strong>.
                  </p>

                  {/* Bar selector */}
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <button style={btnOutline} onClick={()=>setBarSyncBar(b=>Math.max(1,b-1))}>−</button>
                    <div style={{ flex:1, textAlign:'center' }}>
                      <div style={{ fontSize:34, fontWeight:700, fontFamily:'monospace', color:T.green }}>{barSyncBar}</div>
                      <div style={{ fontSize:10, color:T.textSub }}>nhịp</div>
                    </div>
                    <button style={btnOutline} onClick={()=>setBarSyncBar(b=>b+1)}>+</button>
                  </div>

                  {/* Quick pick */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {[1,2,3,4,5,8,9,13,17].map(n=>(
                      <button key={n} onClick={()=>setBarSyncBar(n)} style={{
                        ...btnOutline,
                        padding:'4px 10px', fontSize:12, fontFamily:'monospace',
                        color: barSyncBar===n ? T.green : T.textSub,
                        borderColor: barSyncBar===n ? T.green : T.border,
                        background: barSyncBar===n ? '#EEF5F0' : 'transparent',
                      }}>{n}</button>
                    ))}
                  </div>
                  <div style={{ fontSize:11, color:T.textSub, textAlign:'right', fontFamily:'monospace' }}>
                    JSON beat 1 = {getBar1JsonTime(barSyncBar)?.toFixed(3)}s
                  </div>

                  <button onPointerDown={handleBarSyncMark} disabled={!playerReady}
                    style={{ ...btnPrimary(T.cyan), padding:'13px', fontSize:14, opacity:playerReady?1:0.45, userSelect:'none' }}>
                    ♩ Mark — Phách 1, Nhịp {barSyncBar}
                  </button>

                  {barSyncResult && (
                    <div style={{ background:T.bgInput, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 14px', display:'flex', flexDirection:'column', gap:5 }}>
                      {[['Nhịp đã mark',`#${barSyncResult.bar}`,T.text],
                        ['YT lúc mark',`${barSyncResult.ytTime.toFixed(3)}s`,T.red],
                        ['JSON beat 1',`${barSyncResult.jsonTime.toFixed(3)}s`,T.green]].map(([k,v,c])=>(
                        <div key={k as string} style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontFamily:'monospace' }}>
                          <span style={{ color:T.textSub }}>{k}</span><span style={{ color:c as string, fontWeight:600 }}>{v}</span>
                        </div>
                      ))}
                      <div style={{ ...divider }} />
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontFamily:'monospace' }}>
                        <span style={{ color:T.textSub }}>Offset đã set</span>
                        <span style={{ color:T.goldStrong, fontWeight:700 }}>{barSyncResult.offset>=0?'+':''}{barSyncResult.offset.toFixed(3)}s</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Tap Tempo */}
            <div style={card}>
              <span style={sectionLabel}>Tap Tempo Calibration</span>

              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input type="number" min={20} max={300} step={0.1} placeholder="Nhập BPM YouTube..."
                  style={{ ...inputBase, fontFamily:'monospace' }}
                  onChange={e=>{
                    const v=parseFloat(e.target.value);
                    if(!isNaN(v)&&v>0){ setTapBpm(Math.round(v)); if(jsonData?.tempo) setTapScalePreview(Math.round((jsonData.tempo/v)*10000)/10000); }
                    else { setTapBpm(null); setTapScalePreview(null); }
                  }} />
                <span style={{ fontSize:12, color:T.textSub }}>BPM</span>
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ flex:1, height:1, background:T.border }} />
                <span style={{ fontSize:11, color:T.textSub }}>hoặc tap</span>
                <div style={{ flex:1, height:1, background:T.border }} />
              </div>

              <div style={{ display:'flex', gap:12 }}>
                {/* Tap button */}
                <button onPointerDown={handleTap} style={{
                  flex:1, border:`2px dashed ${tapCount>0 ? T.wood : T.border}`,
                  borderRadius:12, background: tapCount>0 ? '#FAF0E4' : T.bgInput,
                  cursor:'pointer', padding:'18px 0',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                  userSelect:'none', transition:'all 0.1s',
                }}>
                  <span style={{ fontSize:26 }}>🥁</span>
                  <span style={{ fontSize:12, color:T.textSub, fontWeight:600 }}>TAP</span>
                  {tapCount>0 && <span style={{ fontSize:10, color:T.wood }}>{tapCount} taps</span>}
                </button>
                {/* BPM display */}
                <div style={{ flex:1, background:T.bgInput, border:`1px solid ${T.border}`, borderRadius:12, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, padding:'14px 8px' }}>
                  <div style={{ fontSize:38, fontWeight:700, fontFamily:'monospace', color: tapBpm ? T.wood : T.border }}>{tapBpm??'--'}</div>
                  <div style={{ fontSize:11, color:T.textSub }}>BPM YouTube</div>
                  {jsonData?.tempo && <div style={{ fontSize:11, color:T.textSub }}>JSON: <span style={{ fontFamily:'monospace', color:T.text }}>{jsonData.tempo}</span></div>}
                </div>
              </div>

              {tapBpm && jsonData?.tempo && tapScalePreview!==null && (
                <div style={{ background:T.bgInput, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 14px', display:'flex', flexDirection:'column', gap:5 }}>
                  {[['Tempo JSON gốc',`${jsonData.tempo} BPM`,T.text],['Tempo tap',`${tapBpm} BPM`,T.wood]].map(([k,v,c])=>(
                    <div key={k as string} style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontFamily:'monospace' }}>
                      <span style={{ color:T.textSub }}>{k}</span><span style={{ color:c as string, fontWeight:600 }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ ...divider }} />
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontFamily:'monospace' }}>
                    <span style={{ color:T.textSub }}>Scale ratio</span>
                    <span style={{ color: tapScalePreview>1?'#C47A22':tapScalePreview<1?T.cyan:T.green, fontWeight:700 }}>×{tapScalePreview.toFixed(4)}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontFamily:'monospace' }}>
                    <span style={{ color:T.textSub }}>Sai lệch</span>
                    <span style={{ color:T.goldStrong }}>{tapBpm>jsonData.tempo?'+':''}{((tapBpm/jsonData.tempo-1)*100).toFixed(1)}%</span>
                  </div>
                </div>
              )}

              <div style={{ display:'flex', gap:8 }}>
                <button onClick={handleApplyTempoScale} disabled={!tapScalePreview||!jsonData?.tempo}
                  style={{ ...btnPrimary(T.wood), flex:1, opacity:(!tapScalePreview||!jsonData?.tempo)?0.45:1 }}>
                  Apply Scale to JSON
                </button>
                <button onClick={handleResetTap} disabled={tapCount===0}
                  style={{ ...btnOutline, opacity:tapCount===0?0.45:1 }}>↺</button>
              </div>
              <p style={{ fontSize:11, color:T.textSub, margin:0, lineHeight:1.6 }}>
                Nhấn TAP theo nhịp khi nghe video. Sau 3s không tap sẽ tự reset.
              </p>
            </div>
          </div>
        </div>

        {/* Hướng dẫn */}
        <div style={{ ...card, background:'transparent', boxShadow:'none', border:`1px solid ${T.border}` }}>
          <span style={sectionLabel}>Hướng dẫn sử dụng</span>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px 20px' }}>
            {['Nhập URL YouTube → Load', 'Upload JSON hoặc dùng Demo', 'Dùng Tap Tempo nếu BPM lệch', 'Play video đến phách 1 → Mark', 'Bấm Play — ô nhịp sáng theo lyric', 'Export khi căn chỉnh xong'].map((s,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12, color:T.textSub }}>
                <span style={{ minWidth:18, height:18, borderRadius:'50%', background:T.bgInput, border:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:T.textSub, fontWeight:700, flexShrink:0, marginTop:1 }}>{i+1}</span>
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes beatFlash { 0%,100%{box-shadow:none} 30%{box-shadow:0 0 10px rgba(198,161,91,0.55)} }
        .beat-active { animation: beatFlash 0.3s ease-out; }
        input[type=range]::-webkit-slider-thumb { appearance:none; width:14px; height:14px; border-radius:50%; background:${T.green}; cursor:pointer; }
        input[type=range]::-webkit-slider-runnable-track { height:6px; border-radius:3px; }
        button:active { opacity:0.85; transform:scale(0.98); }
      `}</style>
    </div>
  );
}
