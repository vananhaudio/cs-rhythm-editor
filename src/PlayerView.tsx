import { useState, useEffect, useRef, useCallback } from 'react';
import type { RhythmSong } from './types';
import './PlayerView.css';
import { SongList } from './SongList';

function fmtTime(t: number) {
  const s = Math.max(0, t);
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}

type YtMode = 'focus' | 'mini' | 'full';

// ── Design tokens ──
const P = {
  paper:   '#ECE6D9',
  paperSurface: '#E4DDCF',
  paperDark: '#D9D1C1',
  green:   '#14532D',
  greenHover: 'rgba(20,83,45,0.10)',
  greenBtn: 'rgba(20,83,45,0.05)',
  greenBorder: '1px solid rgba(20,83,45,0.10)',
  dark:    '#091812',
  darkDeep:'#071410',
  gold:    '#C99700',
  text:    '#2A2A1E',
  textMuted: '#7A7060',
  textDim: '#A09880',
};

const btn = (active = false): React.CSSProperties => ({
  background: active ? P.green : P.greenBtn,
  border: active ? 'none' : P.greenBorder,
  borderRadius: 8,
  color: active ? '#fff' : P.text,
  fontSize: 12, fontWeight: active ? 600 : 400,
  padding: '6px 14px', cursor: 'pointer',
  transition: 'all 0.15s', whiteSpace: 'nowrap',
});

export function PlayerView({ song, onClose, onImportSong, extraActions }: {
  song: RhythmSong; onClose: () => void;
  onImportSong?: (song: RhythmSong) => void;
  extraActions?: React.ReactNode;
  onUpdateTitle?: (title: string) => void;
}) {
  const [playMode, setPlayMode] = useState<'metro'|'yt'>('metro');
  const [ytMode, setYtMode]     = useState<YtMode>('focus');
  const [ytHovered, setYtHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed]       = useState(1);
  const [muteMetronome, setMuteMetronome] = useState(false);
  const [showSongList, setShowSongList]   = useState(false);
  const [ytReady, setYtReady]   = useState(false);
  const [activeBeatIdx, setActiveBeatIdx] = useState(-1);
  const [containerW, setContainerW]       = useState(900);
  const [beatContainerW, setBeatContainerW] = useState(900);
  const [ytOffsetAdj, setYtOffsetAdj] = useState(0);

  const ytPlayerRef  = useRef<any>(null);
  const ytReadyRef   = useRef(false);
  const ytSyncedRef  = useRef(false);
  const isPlayingRef = useRef(false);
  const currentTimeRef = useRef(0);
  const muteRef      = useRef(false);
  const rafRef       = useRef<number>(0);
  const audioCtxRef  = useRef<AudioContext|null>(null);
  const schedulerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const nextBeatRef  = useRef(0);
  const scrollRef    = useRef<HTMLDivElement>(null);
  const beatScrollRef = useRef<HTMLDivElement>(null);
  const speedRef     = useRef(1);

  const beatDur  = 60 / song.tempo;
  const barDur   = beatDur * song.timeSignature;
  const totalDur = song.totalBars * barDur;
  const PPS      = 120;
  const hasYT    = !!(song as any).youtubeUrl;

  useEffect(() => { muteRef.current = muteMetronome; }, [muteMetronome]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    setIsPlaying(false); isPlayingRef.current = false;
    setCurrentTime(0);  currentTimeRef.current = 0;
    setActiveBeatIdx(-1); stopMetronome();
    ytPlayerRef.current?.pauseVideo?.();
    setYtOffsetAdj(0);
  }, [song.title]);

  // Resize
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

  // YouTube
  useEffect(() => {
    if (playMode !== 'yt' || !hasYT || ytMode === 'focus') return;
    const ytId = ((song as any).youtubeUrl as string).match(/(?:youtu\.be\/|v=|\/embed\/)([\w-]{11})/)?.[1];
    if (!ytId) return;
    setYtReady(false); ytReadyRef.current = false;
    const setup = () => {
      ytPlayerRef.current?.destroy?.();
      ytPlayerRef.current = new (window as any).YT.Player('yt-player-frame', {
        videoId: ytId,
        playerVars: { autoplay:0, controls:1, rel:0, modestbranding:1 },
        events: {
          onReady: () => { ytReadyRef.current = true; setYtReady(true); },
          onStateChange: (e: any) => {
            if (e.data === 1 && !isPlayingRef.current) ytPlayerRef.current?.pauseVideo();
          }
        }
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
      ?? (song as any).youtubeOffsetSeconds ?? 0;
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
    nextBeatRef.current = ctx.currentTime + ((beats+1)*beatDur - from) / speedRef.current;
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
        const t = Math.min(songT + (performance.now()-wall)/1000*speedRef.current, totalDur);
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
      if (t.tagName==='INPUT' || t.tagName==='TEXTAREA') return;
      if (e.key==='Escape') onClose();
      if (e.key===' ') { e.preventDefault(); togglePlay(); }
      if (e.key==='ArrowLeft') seekTo(Math.max(0, currentTimeRef.current-5));
      if (e.key==='ArrowRight') seekTo(Math.min(totalDur, currentTimeRef.current+5));
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
      if (playMode==='metro') startMetronome(currentTimeRef.current);
      else if (ytReadyRef.current) {
        ytPlayerRef.current?.seekTo(getYtOffset()+currentTimeRef.current, true);
        setTimeout(() => ytPlayerRef.current?.playVideo(), 100);
        ytSyncedRef.current = true;
      }
    }
  }, [playMode, speed, getYtOffset]);

  const seekTo = useCallback((t: number) => {
    currentTimeRef.current = t; setCurrentTime(t);
    if (playMode==='yt' && ytReadyRef.current)
      ytPlayerRef.current?.seekTo(getYtOffset()+t, true);
  }, [playMode, getYtOffset]);

  const nowX      = containerW * 0.3;
  const beatNowX  = beatContainerW * 0.3;
  const scrollOff = currentTime * PPS;
  const trackW    = totalDur * PPS + containerW;
  const pct       = totalDur > 0 ? currentTime/totalDur*100 : 0;
  const ytOpacity = ytHovered ? 1 : isPlaying ? 0.45 : 1;
  const ytDims: Record<YtMode, React.CSSProperties> = {
    focus: { display:'none' },
    mini:  { width: 300, aspectRatio:'16/9' },
    full:  { width: 'min(50vw,540px)', aspectRatio:'16/9' },
  };

  return (
    <div style={{ display:'flex', height:'100vh', background:'linear-gradient(to bottom, rgba(20,83,45,0.045) 0px, rgba(20,83,45,0.018) 80px, transparent 140px) #ECE6D9', fontFamily:"'Inter','Segoe UI',sans-serif", overflow:'hidden' }}>

      {/* ══ MAIN COLUMN — no sidebar ══ */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* ── TOP BAR ── */}
        <div style={{ background:P.paper, borderBottom:`1px solid rgba(20,83,45,0.08)`, boxShadow:'0 8px 24px rgba(0,0,0,0.025)', padding:'0 24px', height:56, display:'flex', alignItems:'center', gap:16, flexShrink:0, position:'relative', zIndex:2 }}>
          {/* Logo + Brand */}
          <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            <img src="/logo.png" alt="Văn Anh" style={{ height:32, width:'auto', objectFit:'contain' }}/>
            <span style={{ fontSize:13, fontWeight:600, color:P.text, whiteSpace:'nowrap', letterSpacing:'-0.01em' }}>Thầy Văn Anh Guitar</span>
          </div>
          <div style={{ width:1, height:20, background:P.paperDark, flexShrink:0 }}/>
          {/* Progress — visual spine */}
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ flex:1, height:4, background:'rgba(20,83,45,0.08)', borderRadius:999, cursor:'pointer', position:'relative' }}
              onClick={e => { const r=e.currentTarget.getBoundingClientRect(); seekTo((e.clientX-r.left)/r.width*totalDur); }}>
              <div style={{ height:'100%', width:`${pct}%`, background:'#14532D', borderRadius:999, transition:'width 0.05s linear' }}/>
            </div>
            <span style={{ fontSize:11, color:P.textMuted, fontFamily:'monospace', flexShrink:0, whiteSpace:'nowrap' }}>{fmtTime(currentTime)} / {fmtTime(totalDur)}</span>
          </div>
          {extraActions && false /* Tạm ẩn — sẽ thay bằng nút Trang chủ */}
        </div>

        {/* ── CONTROL BAR ── */}
        <div style={{ background:P.paperSurface, borderBottom:`1px solid rgba(20,83,45,0.07)`, padding:'0 24px', height:56, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          {/* Chọn bài — hiện info sau khi chọn */}
          <button onClick={() => setShowSongList(true)} style={{ ...btn(), display:'flex', alignItems:'center', gap:8, padding:'6px 14px', flexShrink:0 }}>
            🎸
            {song.title ? (
              <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:600, color:P.text }}>{song.title}</span>
                {song.tempo>0 && <span style={{ fontSize:11, color:P.textMuted, fontWeight:400 }}>{song.tempo} BPM</span>}
                {song.timeSignature>0 && <span style={{ fontSize:11, color:P.textMuted, fontWeight:400 }}>{song.timeSignature}/4</span>}
              </span>
            ) : (
              <span style={{ color:P.textMuted }}>Chọn bài</span>
            )}
          </button>

          <div style={{ width:1, height:24, background:P.paperDark, flexShrink:0 }}/>

          {/* Chế độ luyện tập — đẩy sang phải */}
          <div style={{ flex:1 }}/>
          <div style={{ display:'flex', alignItems:'center', gap:10, border:`1.5px solid rgba(7,26,22,0.35)`, borderRadius:10, padding:'6px 14px', background:'rgba(7,26,22,0.04)', flexShrink:0 }}>
            <span style={{ fontSize:13, fontWeight:700, color:P.text, whiteSpace:'nowrap', letterSpacing:'-0.01em' }}>CHẾ ĐỘ TẬP LUYỆN</span>
            <div style={{ width:1, height:20, background:'rgba(7,26,22,0.15)' }}/>
            <button onClick={() => setPlayMode('metro')} style={{ ...btn(playMode==='metro'), borderRadius:7 }}>🎵 Tập với máy đập nhịp</button>
            <button onClick={() => { if(hasYT){ setPlayMode('yt'); if(ytMode==='focus') setYtMode('mini'); } }}
              disabled={!hasYT} title={!hasYT?'Vào YouTube Sync để đồng bộ trước':''}
              style={{ ...btn(playMode==='yt'), borderRadius:7, opacity:!hasYT?0.4:1 }}>▶ YouTube</button>
            <button onClick={() => { window.location.href='/tap'; }} style={{ ...btn(false), borderRadius:7 }}>🥁 Học Tap Nhịp</button>
            {playMode==='yt' && (<>
              <div style={{ width:1, height:20, background:'rgba(7,26,22,0.15)' }}/>
              {([['focus','● Ẩn'],['mini','▣ Mini'],['full','⛶ To']] as [YtMode,string][]).map(([m,lbl]) => (
                <button key={m} onClick={() => setYtMode(m)} style={{ ...btn(ytMode===m), padding:'4px 10px', fontSize:11, borderRadius:7 }}>{lbl}</button>
              ))}
            </>)}
          </div>

          {/* Speed */}
          <div style={{ display:'flex', border:P.greenBorder, borderRadius:8, overflow:'hidden' }}>
            {[0.75,1,1.25].map(s => (
              <button key={s} onClick={() => setSpeed(s)} style={{ ...btn(speed===s), borderRadius:0, border:'none', borderRight: s!==1.25 ? P.greenBorder : 'none', fontSize:11, fontFamily:'monospace' }}>
                {s===0.75?'75%':s===1?'100%':'125%'}
              </button>
            ))}
          </div>

          {/* Metro mute */}
          {playMode==='metro' && (
            <button onClick={() => setMuteMetronome(v=>!v)} style={{ ...btn(muteMetronome), width:34, height:34, padding:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, borderRadius:'50%' }}
              title={muteMetronome?'Bật metronome':'Tắt metronome'}>🎵</button>
          )}

          {/* ⏮ */}
          <button onClick={() => seekTo(0)} style={{ ...btn(), width:34, height:34, padding:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }} title="Về đầu">⏮</button>

          {/* ▶ PLAY — heart of the brand */}
          <button onClick={togglePlay} disabled={!song.title} style={{
            width:44, height:44, borderRadius:'50%',
            background: isPlaying ? 'rgba(20,83,45,0.15)' : P.green,
            border: isPlaying ? `1px solid rgba(20,83,45,0.3)` : 'none',
            color: isPlaying ? P.green : '#fff',
            fontSize:18, cursor: !song.title?'not-allowed':'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            opacity: !song.title ? 0.4 : 1, flexShrink:0,
            boxShadow: isPlaying ? 'none' : `0 0 20px rgba(20,83,45,0.15), 0 2px 8px rgba(0,0,0,0.15)`,
            transition:'all 0.2s',
          }}>{isPlaying?'⏸':'▶'}</button>

          {/* Tap nhịp đã chuyển vào Chế độ luyện tập */}
        </div>

        {/* ── PRACTICE AREA ── */}
        <div style={{ flex:1, padding:'12px 20px 0', overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div style={{
            flex:1, borderRadius:24, overflow:'hidden',
            background:'linear-gradient(to bottom, #071A16 0%, #081E19 35%, #061713 100%)',
            border:'1px solid rgba(255,255,255,0.06)',
            boxShadow:'0 4px 18px rgba(0,0,0,0.08), inset 0 1px rgba(255,255,255,0.03)',
            display:'flex', flexDirection:'column', position:'relative',
          }}>

            {/* Beat row */}
            <div className="now-arrow-wrap" style={{ background:'#071410' }}><div className="now-arrow" style={{left:'30%'}}/></div>
            <div className="player-scroll-area player-scroll-area--beat" ref={beatScrollRef} style={{ background:'#071410' }}>
              <div className="scroll-now-line scroll-now-line--beat" style={{left:beatNowX}}/>
              <div className="player-scroll-track" style={{width:totalDur*PPS+beatContainerW,transform:`translateX(${-scrollOff}px)`}}>
                {Array.from({length:song.totalBars*song.timeSignature},(_,i)=>{
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

            {/* Lyric row — full width, flex:1 */}
            <div className="player-scroll-area player-scroll-area--lyric" ref={scrollRef} style={{ flex:1, background:P.dark }}>
              <div className="scroll-now-line" style={{left:'30%'}}/>
              <div className="player-scroll-track" style={{width:trackW,transform:`translateX(${-scrollOff}px)`}}>
                {(()=>{
                  const sc=[...(song.chords??[])].sort((a,b)=>a.time-b.time);
                  return sc.map((c,ci)=>{
                    const cx=nowX+c.time*PPS, nct=ci+1<sc.length?sc[ci+1].time:c.time+barDur*4;
                    const active=currentTimeRef.current>=c.time&&currentTimeRef.current<nct;
                    return(<div key={c.id} className="scroll-lyric-group" style={{left:cx}}>
                      <div className={`tl-chord${active?' active':''}`} style={{ opacity:active?0.9:0.55, fontSize:active?15:13, color:P.gold }}>{c.name}</div>
                    </div>);
                  });
                })()}
                {(song.lyrics??[]).map((l,i)=>{
                  const lx=nowX+l.time*PPS, nt=(song.lyrics??[])[i+1]?song.lyrics[i+1].time:l.time+beatDur*2;
                  const active=currentTimeRef.current>=l.time&&currentTimeRef.current<nt;
                  const past=currentTimeRef.current>=nt;
                  const onBeat=Math.abs(l.time/beatDur-Math.round(l.time/beatDur))<0.05;
                  const lyricColor = active ? '#EAFBF2' : past ? 'rgba(234,251,242,0.25)' : 'rgba(234,251,242,0.55)';
                  const lyricShadow = active ? '0 0 6px rgba(20,83,45,0.16)' : 'none';
                  return(
                    <div key={l.id} style={{left:lx,position:'absolute',top:'35%',transform:'translateX(-50%)',pointerEvents:'none',whiteSpace:'nowrap'}}>
                      <div className={`tl-lyric${active?' active':''}${onBeat?'':' tl-lyric--offbeat'}`}
                        style={{color:lyricColor,fontSize:active?'22px':'20px',fontWeight:active?700:500,
                          textShadow:lyricShadow,letterSpacing:'0.03em',transition:'color 0.12s,text-shadow 0.15s'}}>
                        {l.text}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="now-arrow--up" style={{left:'30%',position:'absolute',top:'calc(50% + 18px)',transform:'translateX(-50%)',zIndex:20}}/>
            </div>


            {playMode==='yt' && hasYT && ytMode!=='focus' && (
              <div onMouseEnter={() => setYtHovered(true)} onMouseLeave={() => setYtHovered(false)}
                style={{ position:'absolute', right:16, bottom:16, ...ytDims[ytMode],
                  borderRadius:12, overflow:'hidden',
                  opacity:ytOpacity, transition:'opacity 0.3s ease',
                  zIndex:15,
                  boxShadow:'0 4px 20px rgba(0,0,0,0.5)',
                  border:'1px solid rgba(255,255,255,0.06)',
                  filter:'saturate(0.72) contrast(0.92) brightness(0.92)',
                }}>
                <div style={{ position:'absolute',top:0,left:0,right:0,zIndex:2,background:'rgba(0,0,0,0.55)',padding:'4px 8px',display:'flex',alignItems:'center',gap:6 }}>
                  <span style={{fontSize:9,color:'rgba(255,255,255,0.4)',flex:1}}>YT · {getYtOffset().toFixed(1)}s{!ytReady?' · kết nối...':''}</span>
                  <button onClick={() => setYtMode(ytMode==='mini'?'full':'mini')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:10,cursor:'pointer'}}>{ytMode==='mini'?'⛶':'▣'}</button>
                  <button onClick={() => setYtMode('focus')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:12,cursor:'pointer'}}>✕</button>
                </div>
                {/* Glass overlay */}
                <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.08)',pointerEvents:'none',zIndex:1 }}/>
                <div id="yt-player-frame" style={{width:'100%',height:'100%'}}/>
              </div>
            )}

          </div>
        </div>

        {/* ── LỚP HÀNH TRÌNH — upsell section ── */}
        <div style={{ padding:'14px 20px', background:P.paper, borderTop:`1px solid rgba(20,83,45,0.06)`, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:P.text, letterSpacing:'-0.01em' }}>Ghi lại buổi tập</div>
              <div style={{ fontSize:11, color:P.textMuted, marginTop:1 }}>Dành cho học sinh <strong style={{ color:P.green }}>Lớp Hành Trình</strong></div>
            </div>
            <div style={{ background:'rgba(20,83,45,0.08)', border:`1px solid rgba(20,83,45,0.15)`, borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:600, color:P.green, whiteSpace:'nowrap' }}>
              🌿 Lớp Hành Trình
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {[
              ['🎙','Ghi âm','Thu lại buổi chơi để nghe lại'],
              ['📹','Quay video','Xem lại kỹ thuật của mình'],
              ['📤','Nộp bài','Gửi thầy chấm và nhận phản hồi'],
            ].map(([ic,tt,sub])=>(
              <div key={tt} style={{
                background: P.paperSurface,
                border: `1px solid rgba(20,83,45,0.1)`,
                borderRadius:12, padding:'14px 16px',
                display:'flex', alignItems:'flex-start', gap:12,
                opacity:0.7, position:'relative', overflow:'hidden',
              }}>
                {/* Lock overlay */}
                <div style={{ position:'absolute', top:10, right:12, fontSize:12 }}>🔒</div>
                <span style={{ fontSize:22, flexShrink:0, lineHeight:1 }}>{ic}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:P.text }}>{tt}</div>
                  <div style={{ fontSize:11, color:P.textMuted, marginTop:2, lineHeight:1.5 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hint */}
        <div style={{ padding:'6px 24px 8px', background:P.paper, borderTop:`1px solid ${P.paperDark}`, fontSize:10, color:P.textDim, letterSpacing:'0.04em', display:'flex', gap:16 }}>
          <span>Space = Play/Pause</span><span>·</span>
          <span>← → = ±5s</span><span>·</span>
          <span>Esc = Dừng</span>
        </div>

      </div>{/* end main column */}

      {showSongList && (
        <SongList
          onSelect={(s: RhythmSong) => {
            if (onImportSong) onImportSong(s);
            setShowSongList(false);
            setIsPlaying(false); isPlayingRef.current=false;
            setCurrentTime(0); currentTimeRef.current=0;
            setYtOffsetAdj(0);
          }}
          onClose={() => setShowSongList(false)}
          isTeacher={false}
        />
      )}
    </div>
  );
}
