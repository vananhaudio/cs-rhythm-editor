import { useState, useEffect, useRef, useCallback } from 'react';
import type { RhythmSong } from './types';
import './PlayerView.css';
import { SongList } from './SongList';

function fmtTime(t: number) {
  const s = Math.max(0, t);
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}

type Step = 'pick-song' | 'pick-mode' | 'playing';
type PlayMode = 'metro' | 'yt';

export function PlayerView({ song, onClose, onImportSong, extraActions }: {
  song: RhythmSong; onClose: () => void;
  onImportSong?: (song: RhythmSong) => void;
  extraActions?: React.ReactNode;
  onUpdateTitle?: (title: string) => void;
}) {
  const [step, setStep] = useState<Step>(song.title ? 'pick-mode' : 'pick-song');
  const [playMode, setPlayMode] = useState<PlayMode>('metro');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muteMetronome, setMuteMetronome] = useState(false);
  const [showSongList, setShowSongList] = useState(false);
  const [ytReady, setYtReady] = useState(false);
  const [activeBeatIdx, setActiveBeatIdx] = useState(-1);
  const [containerW, setContainerW] = useState(900);
  const [beatContainerW, setBeatContainerW] = useState(900);
  const [fullscreen, setFullscreen] = useState(false);

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

  const beatDur = 60 / song.tempo;
  const barDur = beatDur * song.timeSignature;
  const totalDur = song.totalBars * barDur;
  const PPS = 120;

  useEffect(() => { muteRef.current = muteMetronome; }, [muteMetronome]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // Reset on song change
  useEffect(() => {
    setStep(song.title ? 'pick-mode' : 'pick-song');
    setIsPlaying(false); isPlayingRef.current = false;
    setCurrentTime(0); currentTimeRef.current = 0;
    setActiveBeatIdx(-1);
    stopMetronome();
    ytPlayerRef.current?.pauseVideo?.();
  }, [song.title]);

  // Resize
  useEffect(() => {
    if (!scrollRef.current) return;
    const ro = new ResizeObserver(e => setContainerW(e[0].contentRect.width));
    ro.observe(scrollRef.current);
    if (scrollRef.current.clientWidth > 0) setContainerW(scrollRef.current.clientWidth);
    return () => ro.disconnect();
  }, [step]);

  useEffect(() => {
    if (!beatScrollRef.current) return;
    const ro = new ResizeObserver(e => setBeatContainerW(e[0].contentRect.width));
    ro.observe(beatScrollRef.current);
    if (beatScrollRef.current.clientWidth > 0) setBeatContainerW(beatScrollRef.current.clientWidth);
    return () => ro.disconnect();
  }, [step]);

  // YouTube setup
  useEffect(() => {
    if (step !== 'playing' || playMode !== 'yt' || !(song as any).youtubeUrl) return;
    const ytId = ((song as any).youtubeUrl as string).match(/(?:youtu\.be\/|v=|\/embed\/)([\w-]{11})/)?.[1];
    if (!ytId) return;
    setYtReady(false); ytReadyRef.current = false;

    const setup = () => {
      if (ytPlayerRef.current) { ytPlayerRef.current.destroy?.(); ytPlayerRef.current = null; }
      ytPlayerRef.current = new (window as any).YT.Player('yt-player-frame', {
        videoId: ytId,
        playerVars: { autoplay: 0, controls: 1, rel: 0 },
        events: {
          onReady: () => { ytReadyRef.current = true; setYtReady(true); },
        }
      });
    };

    if ((window as any).YT?.Player) { setup(); return; }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    (window as any).onYouTubeIframeAPIReady = setup;
    document.head.appendChild(tag);
    return () => { ytPlayerRef.current?.destroy?.(); ytPlayerRef.current = null; ytReadyRef.current = false; };
  }, [step, playMode, (song as any).youtubeUrl]);

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
        currentTimeRef.current = t;
        setCurrentTime(t);
        setActiveBeatIdx(Math.floor(t / beatDur));
        if (playMode === 'yt' && ytReadyRef.current && !ytSyncedRef.current) {
          ytSyncedRef.current = true;
          const off = (song as any).youtubeOffset ?? 0;
          ytPlayerRef.current?.seekTo(off + t, true);
          ytPlayerRef.current?.playVideo();
        }
        if (t >= totalDur) {
          isPlayingRef.current = false; setIsPlaying(false);
          stopMetronome(); ytPlayerRef.current?.pauseVideo?.();
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, speed, playMode, totalDur, beatDur]);

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
  }, [step, playMode]);

  const togglePlay = useCallback(() => {
    if (step !== 'playing') return;
    if (isPlayingRef.current) {
      isPlayingRef.current = false; setIsPlaying(false); stopMetronome();
      ytSyncedRef.current = false; ytPlayerRef.current?.pauseVideo?.();
    } else {
      isPlayingRef.current = true; setIsPlaying(true);
      if (playMode === 'metro') startMetronome(currentTimeRef.current);
      else { ytSyncedRef.current = false; }
    }
  }, [step, playMode, speed]);

  const seekTo = useCallback((t: number) => {
    currentTimeRef.current = t; setCurrentTime(t);
    if (playMode === 'yt' && ytReadyRef.current) {
      const off = (song as any).youtubeOffset ?? 0;
      ytPlayerRef.current?.seekTo(off + t, true);
      ytSyncedRef.current = true;
    }
  }, [playMode, song]);

  const startPlaying = (mode: PlayMode) => {
    setPlayMode(mode); setStep('playing');
    setCurrentTime(0); currentTimeRef.current = 0;
    setIsPlaying(true); isPlayingRef.current = true;
    ytSyncedRef.current = false;
    if (mode === 'metro') setTimeout(() => startMetronome(0), 50);
  };

  const hasYT = !!(song as any).youtubeUrl;
  const nowX = containerW * 0.3;
  const beatNowX = beatContainerW * 0.3;
  const scrollOff = currentTime * PPS;
  const trackW = totalDur * PPS + containerW;
  const pct = totalDur > 0 ? currentTime / totalDur * 100 : 0;

  // ── Header shared ──
  const HeaderBar = ({ children }: { children: React.ReactNode }) => (
    <div style={{ background:'#123524', height:50, display:'flex', alignItems:'center', padding:'0 18px', gap:12, flexShrink:0, boxShadow:'0 2px 6px rgba(0,0,0,0.2)' }}>
      <div style={{ width:26,height:26,background:'#D89B22',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,color:'#fff',flexShrink:0 }}>C#</div>
      {children}
    </div>
  );

  return (
    <div className="player-overlay">
      <div className={`player-panel ${fullscreen ? 'player-panel--fullscreen' : ''}`}>

        {/* ══ STEP: PICK SONG ══ */}
        {step === 'pick-song' && (<>
          <HeaderBar>
            <span style={{ flex:1, textAlign:'center', fontSize:14, fontWeight:700, color:'#fff' }}>Player — Thầy Văn Anh Guitar</span>
            {extraActions}
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:7, color:'rgba(255,255,255,0.6)', fontSize:13, padding:'5px 10px', cursor:'pointer' }}>✕</button>
          </HeaderBar>
          <div style={{ flex:1, background:'#1C2E22', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, padding:'40px 24px', position:'relative', overflow:'hidden' }}>
            {/* Demo mờ */}
            <div style={{ position:'absolute', inset:0, pointerEvents:'none', padding:'40px', overflow:'hidden' }}>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', opacity:0.08 }}>
                {(song.chords||[]).slice(0,20).map((c,i)=>(
                  <div key={i} style={{ padding:'8px 12px', borderRadius:8, background:'rgba(201,151,0,0.3)', color:'#C99700', fontFamily:'monospace', fontWeight:700, fontSize:14 }}>{c.name}</div>
                ))}
              </div>
              <div style={{ marginTop:20, display:'flex', flexWrap:'wrap', gap:8, opacity:0.9 }}>
                {(song.lyrics||[]).slice(0,12).map((l,i)=>(
                  <span key={i} style={{ fontSize:22, color:'#8DC470', fontWeight:700 }}>{l.text}</span>
                ))}
              </div>
            </div>
            <div style={{ position:'relative', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
              <div style={{ fontSize:15, color:'rgba(255,255,255,0.45)', letterSpacing:0.3 }}>Chọn bài để bắt đầu luyện tập</div>
              <button onClick={() => setShowSongList(true)} style={{ background:'#D89B22', border:'none', borderRadius:16, color:'#fff', fontSize:18, fontWeight:700, padding:'18px 52px', cursor:'pointer', boxShadow:'0 4px 24px rgba(216,155,34,0.45)', letterSpacing:0.5 }}>
                📚 Chọn bài
              </button>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.25)' }}>Hoặc chọn từ danh sách bài có sẵn</div>
            </div>
          </div>
        </>)}

        {/* ══ STEP: PICK MODE ══ */}
        {step === 'pick-mode' && (<>
          <HeaderBar>
            <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:14, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{song.title}</span>
              <span className="player-meta-chip">{song.tempo} BPM</span>
              <span className="player-meta-chip">{song.timeSignature}/4</span>
            </div>
            <button onClick={() => setShowSongList(true)} style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:7, color:'rgba(255,255,255,0.7)', fontSize:12, padding:'5px 12px', cursor:'pointer', whiteSpace:'nowrap' }}>Đổi bài</button>
            {extraActions}
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, color:'rgba(255,255,255,0.4)', fontSize:13, padding:'5px 9px', cursor:'pointer' }}>✕</button>
          </HeaderBar>
          <div style={{ flex:1, background:'#F5F1E8', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 24px', gap:24 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'#9BA89C' }}>Chọn chế độ luyện tập</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, width:'100%', maxWidth:560 }}>
              {/* Metro card */}
              <div onClick={() => setPlayMode('metro')} style={{ background:'#FBF8F2', border:playMode==='metro'?'2px solid #1B4332':'1px solid #E5DED2', borderRadius:14, padding:'22px 18px', cursor:'pointer', position:'relative', transition:'all 0.15s', boxShadow:playMode==='metro'?'0 0 0 3px rgba(27,67,50,0.1)':'none' }}>
                {playMode==='metro' && <div style={{ position:'absolute', top:10, right:10, background:'#1B4332', color:'#fff', fontSize:9, padding:'3px 9px', borderRadius:20 }}>Mặc định ✓</div>}
                <div style={{ width:46, height:46, background:'#1B4332', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, marginBottom:12 }}>🎵</div>
                <div style={{ fontSize:15, fontWeight:700, color:'#1F2933', marginBottom:6 }}>Máy đập nhịp</div>
                <div style={{ fontSize:12, color:'#5F6B62', lineHeight:1.6 }}>Luyện với metronome. Tự kiểm soát tốc độ, tập trung vào kỹ thuật.</div>
              </div>
              {/* YouTube card */}
              <div onClick={() => { if (hasYT) setPlayMode('yt'); }} style={{ background:'#FBF8F2', border:playMode==='yt'?'2px solid #D89B22':'1px solid #E5DED2', borderRadius:14, padding:'22px 18px', cursor:hasYT?'pointer':'not-allowed', position:'relative', transition:'all 0.15s', opacity:!hasYT?0.6:1, boxShadow:playMode==='yt'?'0 0 0 3px rgba(216,155,34,0.15)':'none' }}>
                {playMode==='yt' && <div style={{ position:'absolute', top:10, right:10, background:'#D89B22', color:'#fff', fontSize:9, padding:'3px 9px', borderRadius:20 }}>✓</div>}
                <div style={{ width:46, height:46, background:'#D89B22', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, marginBottom:12 }}>▶</div>
                <div style={{ fontSize:15, fontWeight:700, color:'#1F2933', marginBottom:6 }}>Theo video YouTube</div>
                <div style={{ fontSize:12, color:'#5F6B62', lineHeight:1.6 }}>{hasYT ? 'Chơi theo nhạc thật. Đã có YouTube sync.' : 'Chơi theo nhạc thật. Cần sync timing trước.'}</div>
                {!hasYT && <div style={{ marginTop:8, fontSize:11, color:'#92722A', background:'#FDF5E0', borderRadius:6, padding:'5px 10px' }}>⚠ Vào YouTube Sync để đồng bộ</div>}
              </div>
            </div>
            <div style={{ display:'flex', gap:10, width:'100%', maxWidth:560 }}>
              <button onClick={() => startPlaying(playMode)} disabled={playMode==='yt'&&!hasYT}
                style={{ flex:1, background:playMode==='yt'?'#D89B22':'#1B4332', border:'none', borderRadius:12, color:'#fff', fontSize:15, fontWeight:700, padding:'15px', cursor:'pointer', opacity:playMode==='yt'&&!hasYT?0.45:1, boxShadow:playMode==='metro'?'0 3px 12px rgba(27,67,50,0.35)':'0 3px 12px rgba(216,155,34,0.35)' }}>
                {playMode==='metro' ? '▶ Bắt đầu luyện tập' : '▶ Phát theo YouTube'}
              </button>
              <button onClick={() => { window.location.href = '/tap'; }} style={{ background:'transparent', border:'1px solid #D4C9B8', borderRadius:12, color:'#5F6B62', fontSize:14, padding:'15px 20px', cursor:'pointer', whiteSpace:'nowrap' }}>
                🥁 Tap nhịp
              </button>
            </div>
          </div>
        </>)}

        {/* ══ STEP: PLAYING ══ */}
        {step === 'playing' && (<>
          {/* Compact header with controls */}
          <div style={{ background:'#14532D', height:52, display:'flex', alignItems:'center', padding:'0 14px', gap:8, flexShrink:0, borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width:24,height:24,background:'#D89B22',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:11,color:'#fff',flexShrink:0 }}>C#</div>
            {/* Song */}
            <span style={{ fontSize:13, fontWeight:700, color:'#F4F1E8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160, flex:'0 1 160px' }}>{song.title}</span>
            <span className="player-meta-chip" style={{ flexShrink:0 }}>{song.tempo}</span>
            {/* Play controls */}
            <button onClick={() => seekTo(Math.max(0, currentTimeRef.current - 5))} style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:5, color:'rgba(255,255,255,0.7)', fontSize:11, padding:'4px 7px', cursor:'pointer', flexShrink:0 }}>◀5s</button>
            <button onClick={togglePlay} style={{ width:34,height:34,borderRadius:'50%',background:isPlaying?'rgba(255,255,255,0.15)':'#A7D88A',border:'none',color:isPlaying?'#fff':'#14532D',fontSize:15,cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center' }}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button onClick={() => seekTo(Math.min(totalDur, currentTimeRef.current + 5))} style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:5, color:'rgba(255,255,255,0.7)', fontSize:11, padding:'4px 7px', cursor:'pointer', flexShrink:0 }}>5s▶</button>
            {/* Progress */}
            <div style={{ flex:1, position:'relative', height:4, background:'rgba(255,255,255,0.15)', borderRadius:2, cursor:'pointer', minWidth:40 }}
              onClick={e => { const r = e.currentTarget.getBoundingClientRect(); seekTo((e.clientX-r.left)/r.width*totalDur); }}>
              <div style={{ height:'100%', width:`${pct}%`, background:'#A7D88A', borderRadius:2, transition:'width 0.05s linear' }}/>
            </div>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.45)', fontFamily:'monospace', flexShrink:0, whiteSpace:'nowrap' }}>{fmtTime(currentTime)}/{fmtTime(totalDur)}</span>
            {/* Speed */}
            <div style={{ display:'flex', border:'1px solid rgba(255,255,255,0.12)', borderRadius:5, overflow:'hidden', flexShrink:0 }}>
              {[0.75,1,1.25].map(s => (
                <button key={s} onClick={() => setSpeed(s)} style={{ background:speed===s?'rgba(255,255,255,0.18)':'transparent', border:'none', color:speed===s?'#fff':'rgba(255,255,255,0.45)', fontSize:10, padding:'3px 7px', cursor:'pointer', fontFamily:'monospace' }}>
                  {s===0.75?'75%':s===1?'100%':'125%'}
                </button>
              ))}
            </div>
            {/* Metro mute */}
            {playMode === 'metro' && (
              <button onClick={() => setMuteMetronome(v=>!v)} style={{ background:muteMetronome?'rgba(255,80,80,0.2)':'rgba(255,255,255,0.08)', border:'none', borderRadius:5, color:muteMetronome?'#ff8080':'rgba(255,255,255,0.55)', fontSize:12, padding:'4px 7px', cursor:'pointer', flexShrink:0 }}>🎵</button>
            )}
            {/* Nav */}
            <button onClick={() => { setStep('pick-mode'); setIsPlaying(false); isPlayingRef.current=false; stopMetronome(); ytPlayerRef.current?.pauseVideo?.(); }} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, color:'rgba(255,255,255,0.55)', fontSize:10, padding:'4px 8px', cursor:'pointer', flexShrink:0, whiteSpace:'nowrap' }}>Đổi</button>
            {extraActions}
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:5, color:'rgba(255,255,255,0.4)', fontSize:13, padding:'4px 7px', cursor:'pointer', flexShrink:0 }}>✕</button>
          </div>

          {/* Beat row */}
          <div className="now-arrow-wrap"><div className="now-arrow" style={{ left:'30%' }}/></div>
          <div className="player-scroll-area player-scroll-area--beat" ref={beatScrollRef}>
            <div className="scroll-now-line scroll-now-line--beat" style={{ left:beatNowX }}/>
            <div className="player-scroll-track" style={{ width:totalDur*PPS+beatContainerW, transform:`translateX(${-scrollOff}px)` }}>
              {Array.from({length:song.totalBars*song.timeSignature},(_,i) => {
                const bib = i % song.timeSignature;
                const bt = i*beatDur, nb=(i+1)*beatDur;
                const w=(nb-bt)*PPS;
                const xBeat=beatNowX+bt*PPS;
                return(
                  <div key={i} className={`tl-beat-cell${bib===0?' tl-beat-cell--bar1':''}${activeBeatIdx===i?' tl-beat-cell--active':''}${activeBeatIdx>i?' tl-beat-cell--past':''}`}
                    style={{ left:xBeat, width:w-2, transform:'translateX(-50%)' }}>
                    {bib===0 && <span className="tl-bar-num">M{Math.floor(i/song.timeSignature)+1}</span>}
                    <span className="tl-beat-num">{bib+1}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lyric + YT split */}
          <div style={{ display:'flex', flex:1, overflow:'hidden', minHeight:0 }}>
            <div className="player-scroll-area player-scroll-area--lyric" ref={scrollRef} style={{ flex:1 }}>
              <div className="scroll-now-line" style={{ left:'30%' }}/>
              <div className="player-scroll-track" style={{ width:trackW, transform:`translateX(${-scrollOff}px)` }}>
                {(()=>{
                  const sc=[...(song.chords??[])].sort((a,b)=>a.time-b.time);
                  return sc.map((c,ci)=>{
                    const cx=nowX+c.time*PPS;
                    const nct=ci+1<sc.length?sc[ci+1].time:c.time+barDur*4;
                    const active=currentTimeRef.current>=c.time&&currentTimeRef.current<nct;
                    return(<div key={c.id} className="scroll-lyric-group" style={{left:cx}}><div className={`tl-chord${active?' active':''}`}>{c.name}</div></div>);
                  });
                })()}
                {(song.lyrics??[]).map((l,i)=>{
                  const lx=nowX+l.time*PPS;
                  const nt=(song.lyrics??[])[i+1]?song.lyrics[i+1].time:l.time+beatDur*2;
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
            {/* YouTube panel */}
            {playMode==='yt' && hasYT && (
              <div style={{ width:'34%', flexShrink:0, background:'#0A0E1A', borderLeft:'1px solid #1E2533', display:'flex', flexDirection:'column' }}>
                <div style={{ padding:'5px 10px', background:'#0D1117', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                  <span style={{ fontSize:9, color:'#6B7280', flex:1 }}>▶ YT · offset {((song as any).youtubeOffset??0).toFixed(1)}s</span>
                  {!ytReady && <span style={{ fontSize:9, color:'#4B5563' }}>Đang kết nối...</span>}
                  {ytReady && <button style={{ fontSize:9, padding:'2px 6px', borderRadius:3, border:'1px solid #374151', background:'none', color:'#9CA3AF', cursor:'pointer' }}
                    onClick={() => { const o=(song as any).youtubeOffset??0; ytPlayerRef.current?.seekTo(o+currentTimeRef.current,true); }}>Sync</button>}
                </div>
                <div id="yt-player-frame" style={{ flex:1, minHeight:0 }}/>
              </div>
            )}
          </div>

          {/* Recording */}
          <div style={{ padding:'9px 16px', background:'#F0E8D8', borderTop:'1px solid #D8C8A8', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#8A7A5A' }}>Ghi lại buổi tập</span>
              <span style={{ fontSize:9, background:'#E8DFD0', color:'#8A7A5A', padding:'2px 7px', borderRadius:20 }}>🔒 Lớp Hành Trình</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
              {[['🎙','Ghi âm','Thu buổi chơi'],['📹','Quay video','Quay lại để xem'],['📤','Nộp bài','Gửi thầy chấm']].map(([ic,tt,sub])=>(
                <button key={tt} disabled style={{ background:'#FAF7F0', border:'1px solid #C8B898', borderRadius:8, padding:'7px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'not-allowed', opacity:0.55 }}>
                  <span style={{fontSize:15}}>{ic}</span>
                  <span style={{fontSize:10,color:'#5A4A30',fontWeight:500}}>{tt}</span>
                  <span style={{fontSize:9,color:'#8A7A5A'}}>{sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="player-hint">Space = Play/Pause · ← → = ±5s · Esc = Đóng</div>
        </>)}

      </div>

      {showSongList && (
        <SongList
          onSelect={(s: RhythmSong) => {
            if (onImportSong) onImportSong(s);
            setShowSongList(false);
            setStep('pick-mode');
            setIsPlaying(false); isPlayingRef.current = false;
            setCurrentTime(0); currentTimeRef.current = 0;
          }}
          onClose={() => setShowSongList(false)}
          isTeacher={false}
        />
      )}
    </div>
  );
}
