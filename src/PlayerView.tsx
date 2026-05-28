import { useState, useEffect, useRef, useCallback } from 'react';
import type { RhythmSong } from './types';
import './PlayerView.css';
import { SongList } from './SongList';

function fmtTime(t: number) {
  const s = Math.max(0, t);
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}

type YtMode = 'focus' | 'mini' | 'full';

export function PlayerView({ song, onClose, onImportSong, extraActions }: {
  song: RhythmSong; onClose: () => void;
  onImportSong?: (song: RhythmSong) => void;
  extraActions?: React.ReactNode;
  onUpdateTitle?: (title: string) => void;
}) {
  const [playMode, setPlayMode] = useState<'metro'|'yt'>('metro');
  const [ytMode, setYtMode] = useState<YtMode>('focus');
  const [ytHovered, setYtHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muteMetronome, setMuteMetronome] = useState(false);
  const [showSongList, setShowSongList] = useState(false);
  const [ytReady, setYtReady] = useState(false);
  const [activeBeatIdx, setActiveBeatIdx] = useState(-1);
  const [containerW, setContainerW] = useState(900);
  const [beatContainerW, setBeatContainerW] = useState(900);
  const [ytOffsetAdj, setYtOffsetAdj] = useState(0);

  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const ytSyncedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const currentTimeRef = useRef(0);
  const muteRef = useRef(false);
  const rafRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const nextBeatRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const beatScrollRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef(1);
  const contentRef = useRef<HTMLDivElement>(null);

  const beatDur = 60 / song.tempo;
  const barDur = beatDur * song.timeSignature;
  const totalDur = song.totalBars * barDur;
  const PPS = 120;
  const hasYT = !!(song as any).youtubeUrl;

  useEffect(() => { muteRef.current = muteMetronome; }, [muteMetronome]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => {
    setIsPlaying(false); isPlayingRef.current = false;
    setCurrentTime(0); currentTimeRef.current = 0;
    setActiveBeatIdx(-1); stopMetronome();
    ytPlayerRef.current?.pauseVideo?.();
    setYtOffsetAdj(0);
  }, [song.title]);

  // Resize observers
  useEffect(() => {
    if (!scrollRef.current) return;
    const ro = new ResizeObserver(e => setContainerW(e[0].contentRect.width));
    ro.observe(scrollRef.current);
    if (scrollRef.current.clientWidth > 0) setContainerW(scrollRef.current.clientWidth);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!beatScrollRef.current) return;
    const ro = new ResizeObserver(e => setBeatContainerW(e[0].contentRect.width));
    ro.observe(beatScrollRef.current);
    if (beatScrollRef.current.clientWidth > 0) setBeatContainerW(beatScrollRef.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  // YouTube setup
  useEffect(() => {
    if (playMode !== 'yt' || !hasYT || ytMode === 'focus') return;
    const ytId = ((song as any).youtubeUrl as string).match(/(?:youtu\.be\/|v=|\/embed\/)([\w-]{11})/)?.[1];
    if (!ytId) return;
    setYtReady(false); ytReadyRef.current = false;
    const setup = () => {
      ytPlayerRef.current?.destroy?.();
      ytPlayerRef.current = new (window as any).YT.Player('yt-player-frame', {
        videoId: ytId,
        playerVars: { autoplay: 0, controls: 1, rel: 0, modestbranding: 1 },
        events: { onReady: () => { ytReadyRef.current = true; setYtReady(true); } }
      });
    };
    if ((window as any).YT?.Player) { setup(); return; }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    (window as any).onYouTubeIframeAPIReady = setup;
    document.head.appendChild(tag);
    return () => { ytPlayerRef.current?.destroy?.(); ytPlayerRef.current = null; ytReadyRef.current = false; };
  }, [playMode, ytMode, hasYT, (song as any).youtubeUrl]);

  const getYtOffset = useCallback(() => {
    const base = (song as any).youtubeOffset
      ?? (song as any).sync?.youtubeOffsetSeconds
      ?? (song as any).youtubeOffsetSeconds
      ?? 0;
    return base + ytOffsetAdj;
  }, [song, ytOffsetAdj]);

  // Metronome
  function scheduleClick(t: number, beat1: boolean) {
    try {
      if (!audioCtxRef.current || muteRef.current) return;
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = beat1 ? 880 : 440;
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (beat1 ? 0.08 : 0.06));
      osc.start(t); osc.stop(t + 0.1);
    } catch {}
  }
  function startMetronome(from: number) {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const bd = beatDur / speedRef.current;
    const beats = Math.floor(from / beatDur);
    nextBeatRef.current = ctx.currentTime + ((beats + 1) * beatDur - from) / speedRef.current;
    let idx = beats + 1;
    stopMetronome();
    schedulerRef.current = setInterval(() => {
      const c = audioCtxRef.current; if (!c) return;
      while (nextBeatRef.current < c.currentTime + 0.05) {
        scheduleClick(nextBeatRef.current + 0.016, (idx % song.timeSignature) === 0);
        nextBeatRef.current += bd; idx++;
      }
    }, 25);
  }
  function stopMetronome() {
    if (schedulerRef.current) { clearInterval(schedulerRef.current); schedulerRef.current = null; }
  }

  // RAF
  useEffect(() => {
    let wall = performance.now(), songT = currentTimeRef.current;
    if (isPlaying) { wall = performance.now(); songT = currentTimeRef.current; }
    const tick = () => {
      if (isPlayingRef.current) {
        const t = Math.min(songT + (performance.now() - wall) / 1000 * speedRef.current, totalDur);
        currentTimeRef.current = t; setCurrentTime(t);
        setActiveBeatIdx(Math.floor(t / beatDur));
        if (t >= totalDur) {
          isPlayingRef.current = false; setIsPlaying(false);
          stopMetronome(); ytPlayerRef.current?.pauseVideo?.();
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, speed, totalDur, beatDur]);

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      if (e.key === 'ArrowLeft') seekTo(Math.max(0, currentTimeRef.current - 5));
      if (e.key === 'ArrowRight') seekTo(Math.min(totalDur, currentTimeRef.current + 5));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [playMode]);

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      isPlayingRef.current = false; setIsPlaying(false); stopMetronome();
      ytSyncedRef.current = false; ytPlayerRef.current?.pauseVideo?.();
    } else {
      isPlayingRef.current = true; setIsPlaying(true);
      if (playMode === 'metro') {
        startMetronome(currentTimeRef.current);
      } else if (ytReadyRef.current) {
        ytPlayerRef.current?.seekTo(getYtOffset() + currentTimeRef.current, true);
        setTimeout(() => ytPlayerRef.current?.playVideo(), 100);
        ytSyncedRef.current = true;
      }
    }
  }, [playMode, speed, getYtOffset]);

  const seekTo = useCallback((t: number) => {
    currentTimeRef.current = t; setCurrentTime(t);
    if (playMode === 'yt' && ytReadyRef.current) {
      ytPlayerRef.current?.seekTo(getYtOffset() + t, true);
    }
  }, [playMode, getYtOffset]);

  const nowX = containerW * 0.3;
  const beatNowX = beatContainerW * 0.3;
  const scrollOff = currentTime * PPS;
  const trackW = totalDur * PPS + containerW;
  const pct = totalDur > 0 ? currentTime / totalDur * 100 : 0;

  // YouTube opacity: focus=không hiện, mini/full=dim khi play, hover=full
  const ytOpacity = ytHovered ? 1 : isPlaying ? 0.4 : 1;

  // YT dimensions
  const ytDims: Record<YtMode, React.CSSProperties> = {
    focus: { display:'none' },
    mini:  { width:280, aspectRatio:'16/9' },
    full:  { width:'min(50vw, 560px)', aspectRatio:'16/9' },
  };

  // Mode button
  const modeBtn = (mode: YtMode, label: string, active: boolean) => (
    <button onClick={() => setYtMode(mode)} style={{
      background: active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
      border: active ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
      borderRadius: 7, color: active ? '#fff' : 'rgba(255,255,255,0.5)',
      fontSize: 11, fontWeight: active ? 700 : 400, padding: '4px 10px', cursor: 'pointer',
      transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>{label}</button>
  );

  return (
    <div className="player-overlay">
      <div className="player-panel" style={{ display:'flex', flexDirection:'column' }}>

        {/* ══ H1 — thông tin + progress ══ */}
        <div style={{ background:'#123524', height:44, display:'flex', alignItems:'center', padding:'0 14px', gap:8, flexShrink:0 }}>
          <div style={{ width:22,height:22,background:'#D89B22',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:10,color:'#fff',flexShrink:0 }}>C#</div>
          <span style={{ fontSize:13,fontWeight:700,color:'#F4F1E8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:160,flex:'0 1 160px' }}>
            {song.title || '—'}
          </span>
          {song.tempo > 0 && <span className="player-meta-chip" style={{flexShrink:0}}>{song.tempo}</span>}
          {song.timeSignature > 0 && <span className="player-meta-chip" style={{flexShrink:0}}>{song.timeSignature}/4</span>}
          <div style={{ flex:1, position:'relative', height:3, background:'rgba(255,255,255,0.1)', borderRadius:2, cursor:'pointer', minWidth:40 }}
            onClick={e => { const r=e.currentTarget.getBoundingClientRect(); seekTo((e.clientX-r.left)/r.width*totalDur); }}>
            <div style={{ height:'100%', width:`${pct}%`, background:'#A7D88A', borderRadius:2, transition:'width 0.05s linear' }}/>
          </div>
          <span style={{ fontSize:10,color:'rgba(255,255,255,0.4)',fontFamily:'monospace',flexShrink:0,whiteSpace:'nowrap' }}>{fmtTime(currentTime)}/{fmtTime(totalDur)}</span>
          {extraActions}
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:5,color:'rgba(255,255,255,0.4)',fontSize:13,padding:'3px 8px',cursor:'pointer',flexShrink:0 }}>✕</button>
        </div>

        {/* ══ H2 — thanh luyện tập ══ */}
        <div style={{ background:'#1B4332', height:52, display:'flex', alignItems:'center', padding:'0 16px', gap:10, flexShrink:0, borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          {/* Chọn bài */}
          <button onClick={() => setShowSongList(true)} style={{ display:'flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,padding:'6px 12px',cursor:'pointer',color:'#fff',fontSize:12,fontWeight:600,whiteSpace:'nowrap',flexShrink:0 }}>
            🎸 {song.title ? <span style={{maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'inline-block'}}>{song.title}</span> : 'Chọn bài'}
          </button>

          <div style={{ width:1,height:30,background:'rgba(255,255,255,0.1)',flexShrink:0 }}/>

          {/* Mode */}
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            {modeBtn('focus', '● Tập trung', ytMode==='focus')}
            {modeBtn('mini', '▣ Mini', ytMode==='mini' && playMode==='yt')}
            {modeBtn('full', '⛶ Full', ytMode==='full' && playMode==='yt')}
          </div>

          {/* YT toggle */}
          <button onClick={() => setPlayMode(v => v==='yt' ? 'metro' : 'yt')}
            style={{ background:playMode==='yt'?'rgba(216,155,34,0.2)':'rgba(255,255,255,0.06)', border:playMode==='yt'?'1px solid #D89B22':'1px solid rgba(255,255,255,0.1)', borderRadius:7, color:playMode==='yt'?'#F5C842':'rgba(255,255,255,0.45)', fontSize:11, padding:'4px 10px', cursor:'pointer', flexShrink:0, transition:'all 0.15s' }}
            title={hasYT ? '' : 'Vào YouTube Sync để đồng bộ trước'}>
            {playMode==='yt' ? '▶ YT ✓' : '▶ YT'}
          </button>
          {!hasYT && <span style={{ fontSize:10, color:'rgba(216,155,34,0.6)' }}>⚠</span>}

          <div style={{ flex:1 }}/>

          {/* Speed */}
          <div style={{ display:'flex',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,overflow:'hidden',flexShrink:0 }}>
            {[0.75,1,1.25].map(s=>(
              <button key={s} onClick={() => setSpeed(s)} style={{ background:speed===s?'rgba(255,255,255,0.18)':'transparent',border:'none',color:speed===s?'#fff':'rgba(255,255,255,0.4)',fontSize:10,padding:'4px 8px',cursor:'pointer',fontFamily:'monospace' }}>
                {s===0.75?'75%':s===1?'100%':'125%'}
              </button>
            ))}
          </div>

          <button onClick={() => { seekTo(0); }} style={{ background:'rgba(255,255,255,0.08)',border:'none',borderRadius:6,color:'rgba(255,255,255,0.6)',fontSize:13,padding:'5px 10px',cursor:'pointer',flexShrink:0 }} title="Về đầu bài">⏮</button>

          {/* Play */}
          <button onClick={togglePlay} disabled={!song.title}
            style={{ width:40,height:40,borderRadius:'50%',background:isPlaying?'rgba(255,255,255,0.15)':(playMode==='yt'?'#D89B22':'#A7D88A'),border:'none',color:isPlaying?'#fff':(playMode==='yt'?'#fff':'#14532D'),fontSize:18,cursor:!song.title?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:!song.title?0.4:1,flexShrink:0,boxShadow:isPlaying?'none':'0 2px 10px rgba(0,0,0,0.3)' }}>
            {isPlaying?'⏸':'▶'}
          </button>

          {/* Metro mute */}
          {playMode === 'metro' && (
            <button onClick={() => setMuteMetronome(v=>!v)} style={{ background:muteMetronome?'rgba(255,80,80,0.2)':'rgba(255,255,255,0.08)',border:'none',borderRadius:6,color:muteMetronome?'#ff8080':'rgba(255,255,255,0.5)',fontSize:12,padding:'5px 8px',cursor:'pointer',flexShrink:0 }}>🎵</button>
          )}

          {/* Tap */}
          <button onClick={() => { window.location.href = '/tap'; }}
            style={{ background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,color:'rgba(255,255,255,0.5)',fontSize:12,padding:'5px 8px',cursor:'pointer',flexShrink:0,whiteSpace:'nowrap' }}>🥁</button>
        </div>

        {/* ══ MAIN CONTENT — lyric full width, YT floating ══ */}
        <div ref={contentRef} style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>

          {/* Beat row — full width */}
          <div className="now-arrow-wrap"><div className="now-arrow" style={{left:'30%'}}/></div>
          <div className="player-scroll-area player-scroll-area--beat" ref={beatScrollRef}>
            <div className="scroll-now-line scroll-now-line--beat" style={{left:beatNowX}}/>
            <div className="player-scroll-track" style={{width:totalDur*PPS+beatContainerW,transform:`translateX(${-scrollOff}px)`}}>
              {Array.from({length:song.totalBars*song.timeSignature},(_,i) => {
                const bib=i%song.timeSignature, bt=i*beatDur, nb=(i+1)*beatDur;
                const w=(nb-bt)*PPS, xBeat=beatNowX+bt*PPS;
                return(
                  <div key={i} className={`tl-beat-cell${bib===0?' tl-beat-cell--bar1':''}${activeBeatIdx===i?' tl-beat-cell--active':''}${activeBeatIdx>i?' tl-beat-cell--past':''}`}
                    style={{left:xBeat,width:w-2,transform:'translateX(-50%)'}}>
                    {bib===0&&<span className="tl-bar-num">M{Math.floor(i/song.timeSignature)+1}</span>}
                    <span className="tl-beat-num">{bib+1}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lyric row — full width luôn */}
          <div className="player-scroll-area player-scroll-area--lyric" ref={scrollRef} style={{flex:1}}>
            <div className="scroll-now-line" style={{left:'30%'}}/>
            <div className="player-scroll-track" style={{width:trackW,transform:`translateX(${-scrollOff}px)`}}>
              {(()=>{
                const sc=[...(song.chords??[])].sort((a,b)=>a.time-b.time);
                return sc.map((c,ci)=>{
                  const cx=nowX+c.time*PPS, nct=ci+1<sc.length?sc[ci+1].time:c.time+barDur*4;
                  const active=currentTimeRef.current>=c.time&&currentTimeRef.current<nct;
                  return(<div key={c.id} className="scroll-lyric-group" style={{left:cx}}><div className={`tl-chord${active?' active':''}`}>{c.name}</div></div>);
                });
              })()}
              {(song.lyrics??[]).map((l,i)=>{
                const lx=nowX+l.time*PPS, nt=(song.lyrics??[])[i+1]?song.lyrics[i+1].time:l.time+beatDur*2;
                const active=currentTimeRef.current>=l.time&&currentTimeRef.current<nt;
                const onBeat=Math.abs(l.time/beatDur-Math.round(l.time/beatDur))<0.05;
                return(
                  <div key={l.id} style={{left:lx,position:'absolute',top:'35%',transform:'translateX(-50%)',pointerEvents:'none',whiteSpace:'nowrap'}}>
                    <div className={`tl-lyric${active?' active':''}${onBeat?'':' tl-lyric--offbeat'}`} style={{color:active?'#10B981':'#E2E8F0',fontSize:active?'22px':'20px',fontWeight:active?800:700}}>{l.text}</div>
                  </div>
                );
              })}
            </div>
            <div className="now-arrow--up" style={{left:'30%',position:'absolute',top:'calc(50% + 18px)',transform:'translateX(-50%)',zIndex:20}}/>
          </div>

          {/* ── YouTube FLOATING mini/full ── */}
          {playMode==='yt' && hasYT && ytMode !== 'focus' && (
            <div
              onMouseEnter={() => setYtHovered(true)}
              onMouseLeave={() => setYtHovered(false)}
              style={{
                position: 'absolute',
                right: 16,
                bottom: 16,
                ...ytDims[ytMode],
                borderRadius: 12,
                overflow: 'hidden',
                opacity: ytOpacity,
                transition: 'opacity 0.3s ease, width 0.3s ease',
                zIndex: 15,
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
              {/* Header bar */}
              <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:2, background:'rgba(0,0,0,0.6)', padding:'4px 8px', display:'flex', alignItems:'center', gap:6, backdropFilter:'blur(4px)' }}>
                <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)', flex:1 }}>
                  YT · {getYtOffset().toFixed(1)}s
                  {!ytReady && ' · kết nối...'}
                </span>
                <button onClick={() => setYtMode(ytMode==='mini'?'full':'mini')} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.5)',fontSize:10,cursor:'pointer',padding:'0 2px' }}>
                  {ytMode==='mini'?'⛶':'▣'}
                </button>
                <button onClick={() => setYtMode('focus')} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.5)',fontSize:12,cursor:'pointer',padding:'0 2px' }}>✕</button>
              </div>
              <div id="yt-player-frame" style={{ width:'100%', height:'100%' }}/>
            </div>
          )}

        </div>{/* end main content */}

        {/* ══ RECORDING ══ */}
        <div style={{ padding:'8px 16px', background:'#F0E8D8', borderTop:'1px solid #D8C8A8', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#8A7A5A' }}>Ghi lại buổi tập</span>
            <span style={{ fontSize:9,background:'#E8DFD0',color:'#8A7A5A',padding:'2px 7px',borderRadius:20 }}>🔒 Lớp Hành Trình</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
            {[['🎙','Ghi âm','Thu buổi chơi'],['📹','Quay video','Quay lại để xem'],['📤','Nộp bài','Gửi thầy chấm']].map(([ic,tt,sub])=>(
              <button key={tt} disabled style={{ background:'#FAF7F0',border:'1px solid #C8B898',borderRadius:8,padding:'7px 6px',display:'flex',flexDirection:'column',alignItems:'center',gap:3,cursor:'not-allowed',opacity:0.55 }}>
                <span style={{fontSize:15}}>{ic}</span>
                <span style={{fontSize:10,color:'#5A4A30',fontWeight:500}}>{tt}</span>
                <span style={{fontSize:9,color:'#8A7A5A'}}>{sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="player-hint">Space = Play/Pause · ← → = ±5s · Esc = Đóng</div>

      </div>

      {showSongList && (
        <SongList
          onSelect={(s: RhythmSong) => {
            if (onImportSong) onImportSong(s);
            setShowSongList(false);
            setIsPlaying(false); isPlayingRef.current = false;
            setCurrentTime(0); currentTimeRef.current = 0;
            setYtOffsetAdj(0);
          }}
          onClose={() => setShowSongList(false)}
          isTeacher={false}
        />
      )}
    </div>
  );
}
