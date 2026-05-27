import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface LyricEvent { id: string; time: number; text: string }
interface ChordEvent { id: string; time: number; name: string }
interface SyncMeta   { source: 'youtube'; youtubeUrl: string; youtubeOffsetSeconds: number }
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
function fmt(s: number): string {
  return `${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,'0')}`;
}
function postCmd(iframe: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event:'command', func, args }), '*');
}

// ─────────────────────────────────────────────
// Design tokens — Calm Music Learning Workspace
// ─────────────────────────────────────────────
const C = {
  // Paper
  pageBg:     '#F5F1E8',
  surface:    '#FBF8F2',
  surface2:   '#F0E7D8',
  goldSoft:   '#F3E3B5',
  // Green
  header:     '#123524',
  green:      '#1B4332',
  greenSoft:  '#2D5A45',
  greenTint:  '#EEF5F0',
  // Wood
  wood:       '#8A5A32',
  woodLight:  '#B07A45',
  // Gold
  gold:       '#C6A15B',
  goldStrong: '#D89B22',
  // Text
  text:       '#1F2933',
  textSub:    '#5F6B62',
  textDim:    '#9BA89C',
  border:     '#E5DED2',
  borderMid:  '#D4C9B8',
  // Status
  red:        '#B83A2F',
  teal:       '#1B7A6E',
};

// ─────────────────────────────────────────────
// Tiny reusable styles
// ─────────────────────────────────────────────
const zoneLabel = (color = C.textDim): React.CSSProperties => ({
  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', color, marginBottom: 12,
});
const pill = (active: boolean): React.CSSProperties => ({
  border: active ? `1.5px solid ${C.goldStrong}` : `1px solid ${C.border}`,
  borderLeft: active ? `3px solid ${C.goldStrong}` : undefined,
  borderRadius: 7, padding: '4px 11px', cursor: 'pointer', fontSize: 12,
  fontWeight: active ? 600 : 400, background: active ? C.goldSoft : C.surface2,
  color: active ? C.text : C.textSub, transition: 'all 0.1s',
  whiteSpace: 'nowrap',
});
const input: React.CSSProperties = {
  flex: 1, background: C.surface2, border: `1px solid ${C.border}`,
  borderRadius: 8, padding: '9px 13px', fontSize: 13, color: C.text,
  fontFamily: 'inherit', outline: 'none',
};
const btn = (bg: string, fg = '#fff'): React.CSSProperties => ({
  background: bg, border: 'none', borderRadius: 8, color: fg,
  fontSize: 13, fontWeight: 600, padding: '10px 20px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 6, transition: 'opacity 0.15s, transform 0.1s', whiteSpace: 'nowrap',
});
const ghost: React.CSSProperties = {
  background: 'transparent', border: `1px solid ${C.borderMid}`,
  borderRadius: 8, color: C.textSub, fontSize: 12, fontWeight: 500,
  padding: '7px 13px', cursor: 'pointer', display: 'flex',
  alignItems: 'center', gap: 5,
};
const divLine: React.CSSProperties = { height: 1, background: C.border, margin: '4px 0' };

// ─────────────────────────────────────────────
// Mock
// ─────────────────────────────────────────────
const MOCK: TimingJSON = {
  title: 'Demo Song', tempo: 80, duration: 60,
  lyrics: [
    {id:'l1',time:0,text:'Thành'},{id:'l2',time:0.5,text:'phố'},
    {id:'l3',time:1.0,text:'nào'}, {id:'l4',time:2.0,text:'đó'},
    {id:'l5',time:3.0,text:'rất'}, {id:'l6',time:3.5,text:'xa'},
  ],
  chords: [{id:'c1',time:0,name:'Am'},{id:'c2',time:2,name:'C'},{id:'c3',time:4,name:'G'}],
};

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function YouTubeSyncPage() {
  const [youtubeUrl, setYoutubeUrl]   = useState('');
  const [videoId, setVideoId]         = useState<string|null>(null);
  const [urlError, setUrlError]       = useState('');
  const [jsonData, setJsonData]       = useState<TimingJSON|null>(null);
  const [jsonFileName, setJsonFileName] = useState('');
  const [jsonParseError, setJsonParseError] = useState('');
  const [jt, setJt]                   = useState(0);   // jsonCurrentTime
  const [isPlaying, setIsPlaying]     = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [ytTime, setYtTime]           = useState(0);
  const [exportOk, setExportOk]       = useState(false);
  const [barNum, setBarNum]           = useState(1);
  const [barResult, setBarResult]     = useState<{bar:number;yt:number;jt:number}|null>(null);
  const [tapBpm, setTapBpm]           = useState<number|null>(null);
  const [tapCount, setTapCount]       = useState(0);
  const [tapScale, setTapScale]       = useState<number|null>(null);

  const iframeRef   = useRef<HTMLIFrameElement|null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval>|null>(null);
  const isPlayRef   = useRef(false);
  const offsetRef   = useRef(0);   // set by BarSync only — not exposed in UI
  const durRef      = useRef(60);
  const ytRef       = useRef(0);
  const activeBarRef= useRef<HTMLButtonElement|null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const tapTORef    = useRef<ReturnType<typeof setTimeout>|null>(null);

  const getDur = (d: TimingJSON) => {
    const all = [...d.lyrics.map(l=>l.time), ...d.chords.map(c=>c.time)];
    return all.length>0 ? Math.max(...all)+5 : 60;
  };

  useEffect(() => { if (jsonData) durRef.current = jsonData.duration ?? getDur(jsonData); }, [jsonData]);

  const startTimer = useCallback((from: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const t0 = performance.now();
    timerRef.current = setInterval(() => {
      const cur = from + (performance.now()-t0)/1000;
      if (cur >= durRef.current) {
        setJt(durRef.current); setIsPlaying(false); isPlayRef.current = false;
        postCmd(iframeRef.current,'pauseVideo');
        clearInterval(timerRef.current!); timerRef.current = null; return;
      }
      setJt(cur);
    }, 50);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // YT postMessage
  useEffect(() => {
    const h = (ev: MessageEvent) => {
      if (!ev.origin.includes('youtube')) return;
      let d: Record<string,unknown>;
      try { d = typeof ev.data==='string' ? JSON.parse(ev.data) : ev.data; } catch { return; }
      if (d.event==='onReady') setPlayerReady(true);
      if (d.event==='infoDelivery') {
        const info = d.info as Record<string,unknown>;
        if (typeof info?.currentTime==='number') { ytRef.current=info.currentTime; setYtTime(info.currentTime); }
      }
    };
    window.addEventListener('message',h);
    return () => window.removeEventListener('message',h);
  },[]);

  // Auto scroll active bar
  useEffect(() => {
    if (!activeBarRef.current || !isPlaying) return;
    const el = activeBarRef.current;
    el.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});
    el.classList.remove('ba'); void el.offsetWidth; el.classList.add('ba');
  }, [isPlaying, Math.floor(jt*2)]);

  // Bar lyric grid
  const barGrid = useMemo(() => {
    if (!jsonData?.tempo) return null;
    const bpb = jsonData.timeSignature??4;
    const spb = 60/jsonData.tempo;
    const dur = jsonData.duration ?? getDur(jsonData);
    const total = jsonData.totalBars ?? Math.ceil(dur/(bpb*spb));
    const tol = spb*0.5;
    return Array.from({length:total},(_,i)=>{
      const idx = i+1;
      const t1 = i*bpb*spb;
      const match = jsonData.lyrics.find(l=>Math.abs(l.time-t1)<=tol);
      return {idx, t1, lyric: match??null};
    });
  },[jsonData]);

  // Handlers
  const loadVideo = () => {
    setUrlError('');
    const id = extractVideoId(youtubeUrl.trim());
    if (!id) { setUrlError('URL YouTube không hợp lệ'); return; }
    setVideoId(id); setPlayerReady(false); setIsPlaying(false);
    isPlayRef.current=false; setJt(0); ytRef.current=0; stopTimer();
  };

  const uploadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setJsonParseError('');
    const r = new FileReader();
    r.onload = ev => {
      try {
        const d = JSON.parse(ev.target?.result as string);
        setJsonData(d); setJsonFileName(file.name);
        if (d.sync?.youtubeOffsetSeconds!=null) offsetRef.current = d.sync.youtubeOffsetSeconds;
      } catch { setJsonParseError('File JSON không hợp lệ'); }
    };
    r.readAsText(file); e.target.value='';
  };

  const play = () => {
    if (!playerReady||!jsonData) return;
    postCmd(iframeRef.current,'seekTo',[jt+offsetRef.current,true]);
    postCmd(iframeRef.current,'playVideo');
    setIsPlaying(true); isPlayRef.current=true; startTimer(jt);
  };

  const pause = () => {
    postCmd(iframeRef.current,'pauseVideo');
    setIsPlaying(false); isPlayRef.current=false; stopTimer();
  };

  const seek = (v: number) => {
    setJt(v);
    postCmd(iframeRef.current,'seekTo',[v+offsetRef.current,true]);
    if (isPlayRef.current) startTimer(v);
  };

  const seekClick = (t: number) => {
    setJt(t); postCmd(iframeRef.current,'seekTo',[t+offsetRef.current,true]);
    if (isPlayRef.current) startTimer(t);
  };

  const getBarT = useCallback((n:number) => {
    if (!jsonData?.tempo) return null;
    return (n-1)*(jsonData.timeSignature??4)*(60/jsonData.tempo);
  },[jsonData]);

  const markBar = useCallback(() => {
    if (!playerReady) return;
    const yt = ytRef.current;
    const bt = getBarT(barNum);
    if (bt===null) return;
    offsetRef.current = Math.round((yt-bt)*1000)/1000;
    setBarResult({bar:barNum, yt, jt:bt});
  },[playerReady,barNum,getBarT]);

  const tap = useCallback(() => {
    const now = performance.now();
    if (tapTimesRef.current.length>0 && now-tapTimesRef.current.at(-1)!>3000) tapTimesRef.current=[];
    tapTimesRef.current.push(now);
    const t = tapTimesRef.current;
    setTapCount(t.length);
    if (t.length>=2) {
      const avg = t.slice(1).map((v,i)=>v-t[i]).reduce((a,b)=>a+b,0)/(t.length-1);
      const bpm = Math.round(60000/avg);
      setTapBpm(bpm);
      if (jsonData?.tempo) setTapScale(Math.round((jsonData.tempo/bpm)*10000)/10000);
    }
    if (tapTORef.current) clearTimeout(tapTORef.current);
    tapTORef.current = setTimeout(()=>{tapTimesRef.current=[];setTapCount(0);setTapBpm(null);setTapScale(null);},3000);
  },[jsonData]);

  const applyScale = () => {
    if (!jsonData||tapScale===null||tapBpm===null) return;
    const r=tapScale;
    setJsonData({...jsonData,tempo:tapBpm,
      lyrics:jsonData.lyrics.map(l=>({...l,time:+(l.time*r).toFixed(4)})),
      chords:jsonData.chords.map(c=>({...c,time:+(c.time*r).toFixed(4)})),
      duration:jsonData.duration?+(jsonData.duration*r).toFixed(4):undefined,
    });
    setJt(p=>+(p*r).toFixed(4));
    tapTimesRef.current=[];setTapCount(0);setTapBpm(null);setTapScale(null);
  };

  const exportJson = () => {
    if (!jsonData) return;
    const out = {...jsonData};
    const blob = new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'),{href:url,download:`${jsonFileName.replace('.json','')||'timing'}_synced.json`}).click();
    URL.revokeObjectURL(url);
    setExportOk(true); setTimeout(()=>setExportOk(false),2500);
  };

  const dur        = jsonData ? (jsonData.duration ?? getDur(jsonData)) : 60;
  const pct        = dur>0 ? (jt/dur)*100 : 0;
  const activeChord= jsonData?.chords.filter(c=>c.time<=jt).at(-1);
  const curLyric   = jsonData?.lyrics.filter(l=>l.time<=jt).at(-1);
  const activeLyrics=jsonData?.lyrics.filter(l=>l.time<=jt&&l.time>jt-2)??[];

  // ─────────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',background:C.pageBg,color:C.text,fontFamily:"'Inter','Segoe UI',sans-serif"}}>

      {/* ══ HEADER ══ */}
      <header style={{background:C.header,height:50,display:'flex',alignItems:'center',padding:'0 24px',gap:16,boxShadow:'0 2px 8px rgba(0,0,0,0.22)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:26,height:26,background:C.goldStrong,borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12,color:'#fff'}}>C#</div>
          <div style={{width:1,height:18,background:'rgba(255,255,255,0.12)'}}/>
          <span style={{fontSize:12,color:'rgba(255,255,255,0.65)'}}>Thầy Văn Anh</span>
        </div>
        <div style={{flex:1,textAlign:'center'}}>
          <span style={{fontSize:13,fontWeight:600,color:'#fff'}}>YouTube Sync</span>
          <span style={{marginLeft:10,fontSize:11,color:'rgba(255,255,255,0.4)'}}>music synchronization workspace</span>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>{window.location.href='/editor';}} style={{...ghost,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',color:'rgba(255,255,255,0.7)',fontSize:12}}>← Editor</button>
          <button onClick={()=>{window.location.href='/player';}} style={{background:C.goldStrong,border:'none',borderRadius:7,color:'#fff',fontSize:12,fontWeight:600,padding:'5px 14px',cursor:'pointer'}}>Player →</button>
        </div>
      </header>

      <div style={{maxWidth:1100,margin:'0 auto',padding:'28px 24px 60px'}}>

        {/* ══ A. DATA INPUT ZONE ══ */}
        <section style={{marginBottom:36}}>
          <div style={zoneLabel()}>① Nạp dữ liệu</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:24,alignItems:'start'}}>

            {/* Left: controls */}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {/* URL row */}
              <div style={{display:'flex',gap:8}}>
                <input style={input} value={youtubeUrl}
                  onChange={e=>{setYoutubeUrl(e.target.value);setUrlError('');}}
                  onKeyDown={e=>e.key==='Enter'&&loadVideo()}
                  placeholder="YouTube URL — https://www.youtube.com/watch?v=..." />
                <button style={{...btn(C.red),padding:'9px 18px'}} onClick={loadVideo}>Load</button>
              </div>
              {urlError && <div style={{fontSize:12,color:C.red}}>⚠ {urlError}</div>}

              {/* JSON row */}
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <label style={{flex:1,cursor:'pointer'}}>
                  <div style={{...input,display:'flex',alignItems:'center',gap:8,color:jsonFileName?C.text:C.textDim,cursor:'pointer'}}>
                    <span>⬆</span>
                    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {jsonFileName||'Upload timing JSON...'}
                    </span>
                  </div>
                  <input type="file" accept=".json" onChange={uploadJson} style={{display:'none'}}/>
                </label>
                <button style={ghost} onClick={()=>{setJsonData(MOCK);setJsonFileName('demo_song.json');setJsonParseError('');}}>Demo</button>
              </div>
              {jsonParseError && <div style={{fontSize:12,color:C.red}}>⚠ {jsonParseError}</div>}

              {/* Metadata tags */}
              {jsonData && (
                <div style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.text,marginRight:4}}>{jsonData.title||'Untitled'}</span>
                  {[`${jsonData.lyrics.length} lyrics`,`${jsonData.chords.length} chords`,fmt(dur),jsonData.tempo?`${jsonData.tempo} BPM`:null]
                    .filter(Boolean).map((t,i)=>(
                    <span key={i} style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:5,padding:'3px 9px',fontSize:11,color:C.textSub}}>{t}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Right: small video reference */}
            <div>
              <div style={{fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:C.textDim,marginBottom:8}}>Tham chiếu video</div>
              <div style={{borderRadius:10,overflow:'hidden',background:'#111',border:`1px solid ${C.border}`}}>
                <div style={{paddingTop:'56.25%',position:'relative'}}>
                  {!videoId?(
                    <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:6,color:'#555'}}>
                      <div style={{fontSize:24,opacity:0.4}}>▶</div>
                      <span style={{fontSize:11}}>Load URL</span>
                    </div>
                  ):(
                    <iframe ref={iframeRef} src={buildEmbedUrl(videoId)}
                      style={{position:'absolute',inset:0,width:'100%',height:'100%',border:'none'}}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen title="YouTube"
                      onLoad={()=>setTimeout(()=>iframeRef.current?.contentWindow?.postMessage(JSON.stringify({event:'listening'}),'*'),1000)}
                    />
                  )}
                  {videoId&&!playerReady&&(
                    <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                      <div style={{background:'rgba(0,0,0,0.7)',borderRadius:16,padding:'5px 12px',fontSize:11,color:'#ccc',display:'flex',alignItems:'center',gap:6}}>
                        <span style={{width:10,height:10,borderRadius:'50%',border:'2px solid #555',borderTopColor:'#fff',display:'inline-block',animation:'spin 0.8s linear infinite'}}/>
                        Kết nối...
                      </div>
                    </div>
                  )}
                </div>
                {videoId&&playerReady&&(
                  <div style={{padding:'5px 10px',background:C.surface,display:'flex',justifyContent:'space-between',fontSize:10,color:C.textDim,borderTop:`1px solid ${C.border}`}}>
                    <span style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{width:5,height:5,borderRadius:'50%',background:'#3A7D44',display:'inline-block',animation:'pulse 1s ease-in-out infinite'}}/>
                      Đã kết nối
                    </span>
                    <span style={{fontFamily:'monospace'}}>YT {fmt(ytTime)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ══ B. PREVIEW ZONE — HERO ══ */}
        {jsonData && (
          <section style={{marginBottom:40}}>
            <div style={zoneLabel()}>② Nội dung bài</div>

            {/* Bar lyric grid — full width */}
            {barGrid ? (
              <div style={{marginBottom:28}}>
                <div style={{overflowX:'auto',paddingBottom:8}}>
                  <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(barGrid.length,16)},1fr)`,gap:5,minWidth:600}}>
                    {barGrid.map(({idx,t1,lyric})=>{
                      const isAct = jt>=t1 && (idx===barGrid.length || jt<barGrid[idx].t1);
                      const isPast= jt>=t1 && !isAct;
                      return (
                        <button key={idx} ref={isAct?activeBarRef:null}
                          title={`Nhịp ${idx} — ${t1.toFixed(2)}s`}
                          onClick={()=>seekClick(t1)}
                          style={{
                            display:'flex',flexDirection:'column',alignItems:'center',
                            padding:'8px 4px',borderRadius:8,cursor:'pointer',
                            border: isAct?`1.5px solid ${C.goldStrong}`:`1px solid ${C.border}`,
                            background: isAct?C.goldSoft : isPast?'rgba(0,0,0,0.02)':C.surface,
                            color: isAct?C.text : isPast?C.borderMid:C.textSub,
                            fontWeight: isAct?700:400,
                            boxShadow: isAct?`0 0 0 3px ${C.goldStrong}20`:'none',
                            transform: isAct?'scale(1.05)':'scale(1)',
                            transition:'all 0.12s',
                          }}
                        >
                          <span style={{fontSize:13,lineHeight:1.3,textAlign:'center',wordBreak:'break-all'}}>
                            {lyric?lyric.text:<span style={{opacity:0.2}}>·</span>}
                          </span>
                          <span style={{fontSize:9,marginTop:3,color:isAct?C.goldStrong:C.borderMid,fontFamily:'monospace'}}>{idx}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:24}}>
                {jsonData.lyrics.map(l=>{
                  const isAct=curLyric?.id===l.id;
                  return (
                    <button key={l.id} onClick={()=>seekClick(l.time)} style={pill(isAct)}>{l.text}</button>
                  );
                })}
              </div>
            )}

            {/* Current state — large display */}
            <div style={{
              display:'grid',gridTemplateColumns:'1fr auto',gap:24,
              alignItems:'center',padding:'24px 28px',
              background:C.surface,borderRadius:14,
              border:`1px solid ${C.border}`,
            }}>
              {/* Current word */}
              <div>
                <div style={{fontSize:11,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:C.textDim,marginBottom:8}}>Đang hát</div>
                <div style={{fontSize:36,fontWeight:700,color:C.text,letterSpacing:3,minHeight:48,lineHeight:1.1}}>
                  {curLyric ? activeLyrics.map(l=>l.text).join(' ') : <span style={{color:C.border,fontWeight:300}}>—</span>}
                </div>
              </div>
              {/* Current chord */}
              <div style={{textAlign:'center',padding:'12px 24px',background:activeChord?C.goldSoft:'transparent',borderRadius:10,border:activeChord?`1.5px solid ${C.goldStrong}`:`1px solid ${C.border}`,minWidth:100}}>
                <div style={{fontSize:11,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:C.textDim,marginBottom:4}}>Hợp âm</div>
                <div style={{fontSize:40,fontWeight:800,fontFamily:'monospace',color:activeChord?C.green:C.border,letterSpacing:2,lineHeight:1}}>
                  {activeChord?.name??'—'}
                </div>
              </div>
            </div>

            {/* Chord strip */}
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:14}}>
              {jsonData.chords.map(c=>{
                const isAct=activeChord?.id===c.id;
                const isPast=activeChord&&jsonData.chords.indexOf(c)<jsonData.chords.indexOf(activeChord);
                return (
                  <button key={c.id} onClick={()=>seekClick(c.time)} style={{
                    ...pill(isAct),
                    fontFamily:'monospace',fontSize:14,fontWeight:700,
                    color: isAct?C.text : isPast?C.borderMid:C.textSub,
                  }}>
                    {c.name}
                    <span style={{fontSize:9,fontWeight:400,marginLeft:4,opacity:0.5}}>{fmt(c.time)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ══ D. TIMELINE ZONE ══ */}
        <section style={{
          background:C.surface,border:`1px solid ${C.border}`,
          borderRadius:16,padding:'24px 28px',marginBottom:32,
          boxShadow:'0 2px 8px rgba(31,41,51,0.06)',
        }}>
          <div style={zoneLabel()}>③ Timeline</div>

          {/* Time counter */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:12}}>
            <span style={{fontFamily:'monospace',fontSize:32,fontWeight:700,color:C.green,lineHeight:1}}>{fmt(jt)}</span>
            <span style={{fontFamily:'monospace',fontSize:13,color:C.textDim}}>{fmt(dur)}</span>
          </div>

          {/* Progress track — DAW style */}
          <div style={{position:'relative',marginBottom:20}}>
            <div style={{height:12,background:C.surface2,borderRadius:6,border:`1px solid ${C.border}`,overflow:'visible',position:'relative'}}>
              {/* Fill */}
              <div style={{position:'absolute',top:0,left:0,height:'100%',width:`${pct}%`,background:C.green,borderRadius:6,transition:'width 0.05s linear'}}/>
              {/* Playhead */}
              <div style={{
                position:'absolute',top:'50%',left:`${pct}%`,
                transform:'translate(-50%,-50%)',
                width:16,height:16,borderRadius:'50%',
                background:C.green,border:`2.5px solid ${C.surface}`,
                boxShadow:`0 0 0 2px ${C.green}`,
                transition:'left 0.05s linear',
                pointerEvents:'none',
              }}/>
            </div>
            <input type="range" min={0} max={dur} step={0.1} value={jt}
              onChange={e=>seek(parseFloat(e.target.value))}
              style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0,cursor:'pointer'}}/>
          </div>

          {/* Controls */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12}}>
            <button onClick={()=>seek(Math.max(0,jt-10))} style={{...ghost,padding:'8px 14px',fontSize:12}}>◀ 10s</button>
            <button
              onClick={isPlaying?pause:play}
              disabled={!playerReady||!jsonData}
              style={{
                ...btn(isPlaying?C.woodLight:C.green),
                padding:'12px 36px',fontSize:15,fontWeight:700,
                opacity:(!playerReady||!jsonData)?0.4:1,
                boxShadow: isPlaying?'none':`0 2px 10px ${C.green}44`,
              }}>
              {isPlaying?'⏸  Pause':'▶  Play'}
            </button>
            <button onClick={()=>seek(Math.min(dur,jt+10))} style={{...ghost,padding:'8px 14px',fontSize:12}}>10s ▶</button>
          </div>
        </section>

        {/* ══ C. SYNC WORKSPACE ══ */}
        <section style={{marginBottom:36}}>
          <div style={zoneLabel()}>④ Đồng bộ</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden',background:C.surface,boxShadow:'0 1px 4px rgba(31,41,51,0.05)'}}>

            {/* Bar Sync */}
            <div style={{padding:'24px',borderRight:`1px solid ${C.border}`}}>
              <div style={{fontSize:12,fontWeight:600,color:C.green,marginBottom:4,display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:16}}>♩</span> Mark Beat Sync
              </div>
              <p style={{fontSize:12,color:C.textSub,lineHeight:1.7,margin:'0 0 16px'}}>
                Play video đến đúng phách 1 của nhịp muốn sync → bấm Mark.
              </p>

              {!jsonData?.tempo ? (
                <div style={{fontSize:12,color:'#92722A',background:'#FDF5E0',border:'1px solid #EED88A',borderRadius:7,padding:'8px 12px'}}>
                  ⚠ Cần JSON có trường <code style={{fontSize:11}}>tempo</code>
                </div>
              ) : (
                <>
                  {/* Bar number */}
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                    <button style={{...ghost,padding:'6px 12px'}} onClick={()=>setBarNum(b=>Math.max(1,b-1))}>−</button>
                    <div style={{flex:1,textAlign:'center'}}>
                      <div style={{fontSize:42,fontWeight:700,fontFamily:'monospace',color:C.green,lineHeight:1}}>{barNum}</div>
                      <div style={{fontSize:10,color:C.textDim}}>nhịp</div>
                    </div>
                    <button style={{...ghost,padding:'6px 12px'}} onClick={()=>setBarNum(b=>b+1)}>+</button>
                  </div>

                  {/* Quick pick */}
                  <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:12}}>
                    {[1,2,3,4,5,8,9,13,17].map(n=>(
                      <button key={n} onClick={()=>setBarNum(n)} style={{
                        ...ghost,padding:'4px 10px',fontSize:12,fontFamily:'monospace',
                        color:barNum===n?C.green:C.textSub,
                        borderColor:barNum===n?C.green:C.border,
                        background:barNum===n?C.greenTint:'transparent',
                      }}>{n}</button>
                    ))}
                  </div>

                  <div style={{fontSize:10,color:C.textDim,fontFamily:'monospace',marginBottom:12,textAlign:'right'}}>
                    beat 1 = {getBarT(barNum)?.toFixed(3)}s
                  </div>

                  <button onPointerDown={markBar} disabled={!playerReady}
                    style={{...btn(C.teal),width:'100%',padding:'13px',fontSize:14,opacity:playerReady?1:0.4,userSelect:'none'}}>
                    ♩ Mark — Phách 1, Nhịp {barNum}
                  </button>

                  {barResult && (
                    <div style={{marginTop:14,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',fontSize:11,fontFamily:'monospace',display:'flex',flexDirection:'column',gap:5}}>
                      <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.textSub}}>Nhịp đã mark</span><span style={{color:C.text,fontWeight:600}}>#{barResult.bar}</span></div>
                      <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.textSub}}>YT lúc mark</span><span style={{color:C.red,fontWeight:600}}>{barResult.yt.toFixed(3)}s</span></div>
                      <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.textSub}}>JSON beat 1</span><span style={{color:C.green,fontWeight:600}}>{barResult.jt.toFixed(3)}s</span></div>
                      <div style={divLine}/>
                      <div style={{display:'flex',justifyContent:'space-between'}}>
                        <span style={{color:C.textSub}}>Đã đồng bộ</span>
                        <span style={{color:C.goldStrong,fontWeight:700}}>✓</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Tap Tempo */}
            <div style={{padding:'24px'}}>
              <div style={{fontSize:12,fontWeight:600,color:C.wood,marginBottom:4,display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:16}}>🥁</span> Tap Tempo Calibration
              </div>
              <p style={{fontSize:12,color:C.textSub,lineHeight:1.7,margin:'0 0 16px'}}>
                Tap theo nhịp video để phát hiện nếu BPM lệch, sau đó apply scale.
              </p>

              {/* Manual BPM input */}
              <div style={{display:'flex',gap:8,marginBottom:14}}>
                <input type="number" min={20} max={300} step={0.1}
                  placeholder="Nhập BPM YouTube..."
                  style={{...input,fontFamily:'monospace'}}
                  onChange={e=>{
                    const v=parseFloat(e.target.value);
                    if(!isNaN(v)&&v>0){setTapBpm(Math.round(v));if(jsonData?.tempo)setTapScale(Math.round((jsonData.tempo/v)*10000)/10000);}
                    else{setTapBpm(null);setTapScale(null);}
                  }}/>
                <span style={{fontSize:12,color:C.textDim,alignSelf:'center',whiteSpace:'nowrap'}}>BPM</span>
              </div>

              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                <div style={{flex:1,height:1,background:C.border}}/><span style={{fontSize:11,color:C.textDim}}>hoặc</span><div style={{flex:1,height:1,background:C.border}}/>
              </div>

              {/* Tap area */}
              <div style={{display:'flex',gap:12,marginBottom:14}}>
                <button onPointerDown={tap} style={{
                  flex:1,border:`2px dashed ${tapCount>0?C.wood:C.border}`,
                  borderRadius:12,background:tapCount>0?'#FAF0E4':C.surface2,
                  cursor:'pointer',padding:'16px 0',display:'flex',flexDirection:'column',
                  alignItems:'center',gap:4,userSelect:'none',transition:'all 0.1s',
                }}>
                  <span style={{fontSize:24}}>🥁</span>
                  <span style={{fontSize:12,color:C.textSub,fontWeight:600}}>TAP</span>
                  {tapCount>0&&<span style={{fontSize:10,color:C.wood}}>{tapCount} taps</span>}
                </button>
                <div style={{flex:1,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,padding:'12px 8px'}}>
                  <div style={{fontSize:34,fontWeight:700,fontFamily:'monospace',color:tapBpm?C.wood:C.border,lineHeight:1}}>{tapBpm??'--'}</div>
                  <div style={{fontSize:11,color:C.textDim}}>BPM detected</div>
                  {jsonData?.tempo&&<div style={{fontSize:10,color:C.textDim}}>JSON: <span style={{fontFamily:'monospace',color:C.text,fontWeight:600}}>{jsonData.tempo}</span></div>}
                </div>
              </div>

              {tapBpm&&jsonData?.tempo&&tapScale!==null&&(
                <div style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:11,fontFamily:'monospace',display:'flex',flexDirection:'column',gap:5}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.textSub}}>JSON tempo</span><span style={{color:C.text,fontWeight:600}}>{jsonData.tempo} BPM</span></div>
                  <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.textSub}}>Tap BPM</span><span style={{color:C.wood,fontWeight:600}}>{tapBpm} BPM</span></div>
                  <div style={divLine}/>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{color:C.textSub}}>Scale ratio</span>
                    <span style={{color:tapScale>1?'#C47A22':tapScale<1?C.teal:C.green,fontWeight:700}}>×{tapScale.toFixed(4)}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{color:C.textSub}}>Sai lệch</span>
                    <span style={{color:C.goldStrong,fontWeight:600}}>{tapBpm>jsonData.tempo?'+':''}{((tapBpm/jsonData.tempo-1)*100).toFixed(1)}%</span>
                  </div>
                </div>
              )}

              <div style={{display:'flex',gap:8}}>
                <button onClick={applyScale} disabled={!tapScale||!jsonData?.tempo}
                  style={{...btn(C.wood),flex:1,opacity:(!tapScale||!jsonData?.tempo)?0.4:1}}>
                  Apply Scale to JSON
                </button>
                <button onClick={()=>{tapTimesRef.current=[];setTapCount(0);setTapBpm(null);setTapScale(null);if(tapTORef.current)clearTimeout(tapTORef.current);}}
                  disabled={tapCount===0} style={{...ghost,opacity:tapCount===0?0.4:1}}>↺</button>
              </div>
            </div>
          </div>
        </section>

        {/* ══ E. EXPORT ZONE ══ */}
        <section style={{textAlign:'center',paddingTop:8}}>
          <div style={zoneLabel()}>⑤ Xuất bản</div>
          <div style={{maxWidth:440,margin:'0 auto',display:'flex',flexDirection:'column',gap:12,alignItems:'center'}}>
            <p style={{fontSize:13,color:C.textSub,margin:0,lineHeight:1.7}}>
              {jsonData
                ? `Sẵn sàng xuất — ${jsonData.title||'Bài hát'} · ${jsonData.lyrics.length} lyrics · ${jsonData.chords.length} chords`
                : 'Upload JSON để bắt đầu workflow'}
            </p>
            <button onClick={exportJson} disabled={!jsonData}
              style={{
                ...btn(exportOk?'#2A6B3A':C.goldStrong),
                padding:'14px 48px',fontSize:15,fontWeight:700,
                opacity:!jsonData?0.4:1,
                boxShadow: jsonData&&!exportOk?`0 3px 12px ${C.goldStrong}44`:'none',
              }}>
              {exportOk?'✓ Đã xuất thành công!':'💾  Export JSON'}
            </button>
            {!jsonData && (
              <p style={{fontSize:11,color:C.textDim,margin:0}}>← Upload file JSON ở bước ①</p>
            )}
          </div>
        </section>

      </div>{/* /body */}

      <style>{`
        @keyframes spin  {to{transform:rotate(360deg)}}
        @keyframes pulse {0%,100%{opacity:1}50%{opacity:0.45}}
        @keyframes ba    {0%,100%{box-shadow:none}40%{box-shadow:0 0 12px rgba(198,161,91,0.6)}}
        .ba { animation: ba 0.35s ease-out; }
        button:active:not(:disabled){transform:scale(0.97)}
      `}</style>
    </div>
  );
}
