import { useState, useEffect, useRef, useCallback } from 'react';
import type { RhythmSong } from './types';
import './PlayerView.css';
import { SongList } from './SongList';

function fmtTime(t: number) {
  const s = Math.max(0, t);
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}

type YtMode = 'focus' | 'mini' | 'full';

// ── Design tokens — Dark Studio ──
const D = {
  bg:          '#0D0F14',
  bgSurface:   '#141720',
  bgCard:      '#1C2030',
  bgCardHover: '#222638',
  bgBeat:      '#0A0C10',
  border:      'rgba(255,255,255,0.06)',
  borderMid:   'rgba(255,255,255,0.10)',
  accent:      '#6C63FF',
  accentGlow:  'rgba(108,99,255,0.25)',
  accentLight: '#8B84FF',
  gold:        '#F59E0B',
  goldGlow:    'rgba(245,158,11,0.3)',
  green:       '#22C55E',
  text1:       '#F1F5F9',
  text2:       '#94A3B8',
  text3:       '#475569',
  danger:      '#EF4444',
};

// ── Locked feature card ──
function LockedCard({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  const [flash, setFlash] = useState(false);
  return (
    <button onClick={() => { setFlash(true); setTimeout(() => setFlash(false), 1400); }}
      style={{ background: D.bgCard, border: `1px solid ${flash ? D.accent+'44' : D.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.2s', fontFamily: 'inherit' }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: D.text1 }}>{title}</div>
        <div style={{ fontSize: 11, color: D.text3, marginTop: 1 }}>{sub}</div>
      </div>
      <div style={{ fontSize: 12, flexShrink: 0, color: flash ? D.accent : D.text3, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 4 }}>
        🔒{flash && <span style={{ fontSize: 10, fontWeight: 600, color: D.accent }}>Hành Trình</span>}
      </div>
    </button>
  );
}

export function PlayerView({ song, onClose, onImportSong, extraActions }: {
  song: RhythmSong; onClose: () => void;
  onImportSong?: (song: RhythmSong) => void;
  extraActions?: React.ReactNode;
  onUpdateTitle?: (title: string) => void;
}) {
  const [playMode, setPlayMode]   = useState<'metro'|'yt'>('metro');
  const [ytMode, setYtMode]       = useState<YtMode>('focus');
  const [ytHovered, setYtHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed]         = useState(1);
  const [muteMetronome, setMuteMetronome] = useState(false);
  const [showSongList, setShowSongList]   = useState(false);
  const [ytReady, setYtReady]     = useState(false);
  const [activeBeatIdx, setActiveBeatIdx] = useState(-1);
  const [containerW, setContainerW]       = useState(900);
  const [beatContainerW, setBeatContainerW] = useState(900);
  const [ytOffsetAdj, setYtOffsetAdj] = useState(0);
  const [zoom, setZoom]           = useState(1);

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
  const PPS      = 120 * zoom;
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
    const base = (song as any).youtubeOffset ?? (song as any).sync?.youtubeOffsetSeconds ?? (song as any).youtubeOffsetSeconds ?? 0;
    return base + ytOffsetAdj;
  }, [song, ytOffsetAdj]);

  function scheduleClick(t: number, beat1: boolean) {
    try {
      if (!audioCtxRef.current || muteRef.current) return;
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = beat1 ? 1000 : 500;
      g.gain.setValueAtTime(0.4, t);
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

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName==='INPUT' || t.tagName==='TEXTAREA') return;
      if (e.key==='Escape') onClose();
      if (e.key===' ') { e.preventDefault(); togglePlay(); }
      if (e.key==='ArrowLeft')  seekTo(Math.max(0, currentTimeRef.current-5));
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

  return (
    <div style={{ display:'flex', height:'100vh', background:D.bg, fontFamily:'"DM Sans", system-ui, sans-serif', color:D.text1, overflow:'hidden' }}>

      <style>{`
        .pv-btn { transition: all 0.15s; font-family: inherit; }
        .pv-btn:hover { background: ${D.bgCardHover} !important; border-color: ${D.borderMid} !important; }
        .pv-mode-btn:hover { background: ${D.bgCard} !important; }
        input[type=range].pv-seek { -webkit-appearance:none; appearance:none; width:100%; height:4px; border-radius:2px; background:${D.border}; cursor:pointer; outline:none; }
        input[type=range].pv-seek::-webkit-slider-thumb { -webkit-appearance:none; width:12px; height:12px; border-radius:50%; background:${D.accent}; cursor:pointer; box-shadow:0 0 8px ${D.accentGlow}; }
        input[type=range].pv-seek::-webkit-slider-runnable-track { height:4px; border-radius:2px; }
      `}</style>

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* ══ MERGED NAV + CONTROL BAR ══ */}
        {/* Row 1: Song info + seek + close */}
        <div style={{ background:D.bgSurface, borderBottom:`1px solid ${D.border}`, padding:'0 16px', height:52, display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          {/* Logo */}
          <div style={{ width:30, height:30, borderRadius:8, background:`linear-gradient(135deg,${D.accent},${D.accentLight})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0, boxShadow:`0 2px 8px ${D.accentGlow}` }}>🎸</div>

          {/* Transport */}
          <button className="pv-btn" onClick={() => seekTo(0)}
            style={{ width:30, height:30, borderRadius:7, border:`1px solid ${D.border}`, background:'none', color:D.text3, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
            title="Về đầu">⏮</button>
          <button onClick={togglePlay}
            style={{ width:38, height:38, borderRadius:'50%', border:'none', background: isPlaying ? D.bgCard : `linear-gradient(135deg,${D.accent},${D.accentLight})`, color: isPlaying ? D.accentLight : '#fff', fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.2s', boxShadow: isPlaying ? 'none' : `0 4px 14px ${D.accentGlow}` }}>
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Song chip */}
          <button onClick={() => setShowSongList(true)} className="pv-btn"
            style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 10px', borderRadius:8, border:`1px solid ${D.borderMid}`, background:D.bgCard, cursor:'pointer', flexShrink:0, minWidth:0, maxWidth:240 }}>
            <span style={{ fontSize:13 }}>🎵</span>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:D.text1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{song.title || 'Chọn bài'}</div>
              {song.tempo > 0 && <div style={{ fontSize:9, color:D.text3, fontFamily:'"DM Mono",monospace' }}>{song.tempo} BPM · {song.timeSignature}/4</div>}
            </div>
            <span style={{ color:D.text3, fontSize:10, flexShrink:0 }}>▾</span>
          </button>

          {/* Seek bar — fat, easy to hit */}
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, fontFamily:'"DM Mono",monospace', color:D.text3, flexShrink:0, minWidth:36 }}>{fmtTime(currentTime)}</span>
            <div style={{ flex:1, position:'relative', height:20, cursor:'pointer', display:'flex', alignItems:'center' }}
              onClick={e => { const r=e.currentTarget.getBoundingClientRect(); seekTo((e.clientX-r.left)/r.width*totalDur); }}>
              <div style={{ position:'absolute', inset:'0 0', display:'flex', alignItems:'center' }}>
                <div style={{ width:'100%', height:6, background:D.bgCard, borderRadius:3, overflow:'hidden', border:`1px solid ${D.border}` }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg,${D.accent},${D.accentLight})`, borderRadius:3, transition:'width 0.05s linear', boxShadow:`0 0 10px ${D.accentGlow}` }} />
                </div>
              </div>
              {/* Thumb */}
              <div style={{ position:'absolute', left:`${pct}%`, transform:'translateX(-50%)', width:14, height:14, borderRadius:'50%', background:D.accent, boxShadow:`0 0 8px ${D.accentGlow}`, border:`2px solid ${D.accentLight}`, pointerEvents:'none', transition:'left 0.05s linear' }} />
            </div>
            <span style={{ fontSize:11, fontFamily:'"DM Mono",monospace', color:D.text3, flexShrink:0, minWidth:36, textAlign:'right' }}>{fmtTime(totalDur)}</span>
          </div>

          {/* Close */}
          <button onClick={onClose} className="pv-btn"
            style={{ width:30, height:30, borderRadius:7, border:`1px solid ${D.border}`, background:'none', color:D.text3, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
        </div>

        {/* Row 2: Options bar */}
        <div style={{ background:D.bgSurface, borderBottom:`1px solid ${D.border}`, padding:'0 16px', height:44, display:'flex', alignItems:'center', gap:8, flexShrink:0, overflowX:'auto' }}>
          {/* Mode tabs */}
          <div style={{ display:'flex', background:D.bgCard, border:`1px solid ${D.border}`, borderRadius:8, padding:2, gap:2, flexShrink:0 }}>
            {([['metro','🎵','Máy đập nhịp'],['yt','▶','YouTube']] as [string,string,string][]).map(([mode,icon,label]) => (
              <button key={mode} className="pv-mode-btn"
                onClick={() => { setPlayMode(mode as 'metro'|'yt'); if(mode==='yt'&&ytMode==='focus') setYtMode('mini'); }}
                disabled={mode==='yt'&&!hasYT}
                style={{ padding:'4px 10px', borderRadius:6, border:'none', cursor: mode==='yt'&&!hasYT?'not-allowed':'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600, transition:'all 0.15s', display:'flex', alignItems:'center', gap:4, opacity: mode==='yt'&&!hasYT?0.35:1,
                  background: playMode===mode ? D.bgSurface : 'transparent',
                  color: playMode===mode ? D.accentLight : D.text3,
                  boxShadow: playMode===mode ? `0 1px 4px rgba(0,0,0,0.3)` : 'none',
                }}>
                <span>{icon}</span><span>{label}</span>
              </button>
            ))}
          </div>

          {playMode==='yt' && hasYT && (
            <div style={{ display:'flex', background:D.bgCard, border:`1px solid ${D.border}`, borderRadius:8, padding:2, gap:2, flexShrink:0 }}>
              {([['focus','Ẩn'],['mini','Mini'],['full','To']] as [YtMode,string][]).map(([m,lbl]) => (
                <button key={m} className="pv-mode-btn" onClick={() => setYtMode(m)}
                  style={{ padding:'3px 8px', borderRadius:6, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:600, transition:'all 0.15s',
                    background: ytMode===m ? D.bgSurface : 'transparent',
                    color: ytMode===m ? D.text1 : D.text3 }}>{lbl}</button>
              ))}
            </div>
          )}

          <div style={{ flex:1 }} />

          {/* Speed */}
          <div style={{ display:'flex', background:D.bgCard, border:`1px solid ${D.border}`, borderRadius:8, padding:2, gap:2, flexShrink:0 }}>
            {[0.75,1,1.25].map(s => (
              <button key={s} className="pv-mode-btn" onClick={() => setSpeed(s)}
                style={{ padding:'3px 9px', borderRadius:6, border:'none', cursor:'pointer', fontFamily:'"DM Mono",monospace', fontSize:11, fontWeight:600, transition:'all 0.15s',
                  background: speed===s ? D.accent : 'transparent', color: speed===s ? '#fff' : D.text3 }}>
                {s===1?'1×':s+'×'}
              </button>
            ))}
          </div>

          {/* Metro mute */}
          {playMode==='metro' && (
            <button className="pv-btn" onClick={() => setMuteMetronome(v=>!v)}
              style={{ height:30, padding:'0 10px', borderRadius:7, border:`1px solid ${muteMetronome?D.accent+'44':D.border}`, background: muteMetronome?`${D.accent}22`:'none', color: muteMetronome?D.accentLight:D.text3, cursor:'pointer', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:4, flexShrink:0, fontFamily:'inherit' }}>
              {muteMetronome?'🔇':'🔊'} Metro
            </button>
          )}

          {/* Zoom */}
          <div style={{ display:'flex', alignItems:'center', background:D.bgCard, border:`1px solid ${D.border}`, borderRadius:8, overflow:'hidden', flexShrink:0 }}>
            <button className="pv-btn" onClick={() => setZoom(z => Math.max(0.5,+(z-0.25).toFixed(2)))}
              style={{ width:26, height:30, border:'none', background:'none', color:D.text2, cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
            <span style={{ fontSize:10, fontFamily:'"DM Mono",monospace', color:D.text3, padding:'0 4px', minWidth:30, textAlign:'center' }}>{Math.round(zoom*100)}%</span>
            <button className="pv-btn" onClick={() => setZoom(z => Math.min(3,+(z+0.25).toFixed(2)))}
              style={{ width:26, height:30, border:'none', background:'none', color:D.text2, cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
          </div>

          {/* Tap link */}
          <button className="pv-btn" onClick={() => { window.location.href='/tap'; }}
            style={{ height:30, padding:'0 10px', borderRadius:7, border:`1px solid ${D.border}`, background:'none', color:D.text3, cursor:'pointer', fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:4, flexShrink:0, fontFamily:'inherit' }}>
            🥁 Tap
          </button>
        </div>

        {/* ══ PRACTICE AREA ══ */}
        <div style={{ flex:1, padding:'12px 16px 0', overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div style={{ flex:1, borderRadius:16, overflow:'hidden', border:`1px solid ${D.border}`, display:'flex', flexDirection:'column', position:'relative', background:D.bg }}>

            {/* Beat row */}
            <div className="now-arrow-wrap"><div className="now-arrow" style={{ left: beatNowX }} /></div>
            <div className="player-scroll-area player-scroll-area--beat" ref={beatScrollRef}>
              <div className="scroll-now-line scroll-now-line--beat" style={{ left: beatNowX }} />
              <div className="player-scroll-track" style={{ width: totalDur*PPS+beatContainerW, transform:`translateX(${-scrollOff}px)` }}>
                {Array.from({ length: song.totalBars*song.timeSignature }, (_, i) => {
                  const bib = i % song.timeSignature, bt = i*beatDur, nb = (i+1)*beatDur;
                  const w = (nb-bt)*PPS, xBeat = beatNowX + bt*PPS;
                  return (
                    <div key={i} className={`tl-beat-cell${bib===0?' tl-beat-cell--bar1':''}${activeBeatIdx===i?' tl-beat-cell--active':''}${activeBeatIdx>i?' tl-beat-cell--past':''}`}
                      style={{ left:xBeat, width:w-2, transform:'translateX(-50%)' }}>
                      {bib===0 && <span className="tl-bar-num">M{Math.floor(i/song.timeSignature)+1}</span>}
                      <span className="tl-beat-num">{bib+1}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lyric + chord row */}
            <div className="player-scroll-area player-scroll-area--lyric" ref={scrollRef} style={{ flex:1 }}>
              <div className="scroll-now-line" style={{ left:'30%' }} />
              <div className="player-scroll-track" style={{ width:trackW, transform:`translateX(${-scrollOff}px)` }}>
                {/* Chords */}
                {[...(song.chords??[])].sort((a,b)=>a.time-b.time).map((c,ci) => {
                  const cx = nowX + c.time*PPS;
                  const sc = song.chords ?? [];
                  const nct = ci+1<sc.length ? sc[ci+1].time : c.time+barDur*4;
                  const active = currentTimeRef.current>=c.time && currentTimeRef.current<nct;
                  return (
                    <div key={c.id} style={{ left:cx, position:'absolute', top:0, height:'100%' }}>
                      <div style={{
                        position:'absolute', top:16,
                        color: D.gold,
                        fontSize: 24,
                        fontWeight: 700,
                        letterSpacing: '-0.01em',
                        opacity: active ? 1 : 0.4,
                        filter: active ? `drop-shadow(0 0 8px ${D.goldGlow})` : 'none',
                        transition: 'opacity 0.12s, filter 0.12s',
                        whiteSpace: 'nowrap',
                        transform: 'translateX(-50%)',
                        pointerEvents: 'none',
                        fontFamily: '"Helvetica Neue", Arial, sans-serif',
                      }}>
                        {c.name}
                      </div>
                    </div>
                  );
                })}
                {/* Lyrics */}
                {(song.lyrics??[]).map((l,i) => {
                  const lx = nowX + l.time*PPS;
                  const nt = (song.lyrics??[])[i+1] ? song.lyrics[i+1].time : l.time+beatDur*2;
                  const active = currentTimeRef.current>=l.time && currentTimeRef.current<nt;
                  const past   = currentTimeRef.current>=nt;
                  const onBeat = Math.abs(l.time/beatDur-Math.round(l.time/beatDur))<0.05;
                  return (
                    <div key={l.id} style={{ left:lx, position:'absolute', top:56, transform:'translateX(-50%)', pointerEvents:'none', whiteSpace:'nowrap' }}>
                      <div className={`tl-lyric${active?' active':''}`}
                        style={{ color: active ? '#FFFFFF' : past ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)', fontSize: 23, fontWeight: active ? 600 : 400, letterSpacing: '0em', fontStyle: 'normal', fontFamily: '"Helvetica Neue", Arial, sans-serif', transition: 'color 0.12s' }}>
                        {l.text}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="now-arrow--up" style={{ left:'30%', position:'absolute', bottom:12, transform:'translateX(-50%)', zIndex:20 }} />
            </div>

            {/* YouTube overlay */}
            {playMode==='yt' && hasYT && ytMode!=='focus' && (
              <div onMouseEnter={() => setYtHovered(true)} onMouseLeave={() => setYtHovered(false)}
                style={{ position:'absolute', right:12, bottom:12,
                  ...(ytMode==='mini' ? { width:280, aspectRatio:'16/9' } : { width:'min(45vw,480px)', aspectRatio:'16/9' }),
                  borderRadius:10, overflow:'hidden', zIndex:15,
                  opacity: ytHovered ? 1 : isPlaying ? 0.5 : 1, transition:'opacity 0.3s',
                  boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
                  border:`1px solid ${D.border}`,
                }}>
                <div style={{ position:'absolute',top:0,left:0,right:0,zIndex:2,background:'rgba(0,0,0,0.6)',padding:'4px 8px',display:'flex',alignItems:'center',gap:6 }}>
                  <span style={{ fontSize:9,color:D.text3,flex:1,fontFamily:'"DM Mono",monospace' }}>YT · offset {getYtOffset().toFixed(1)}s{!ytReady?' · connecting...':''}</span>
                  <button onClick={() => setYtMode(ytMode==='mini'?'full':'mini')} style={{ background:'none',border:'none',color:D.text3,fontSize:10,cursor:'pointer' }}>{ytMode==='mini'?'⛶':'▣'}</button>
                  <button onClick={() => setYtMode('focus')} style={{ background:'none',border:'none',color:D.text3,fontSize:12,cursor:'pointer' }}>✕</button>
                </div>
                <div id="yt-player-frame" style={{ width:'100%',height:'100%' }} />
              </div>
            )}
          </div>
        </div>

        {/* ══ BOTTOM STRIP — locked features ══ */}
        <div style={{ padding:'8px 16px', background:D.bgSurface, borderTop:`1px solid ${D.border}`, flexShrink:0, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:D.text3, fontWeight:600, marginRight:4 }}>Sắp ra mắt:</span>
          {[['🎙','Ghi âm'],['📹','Quay video'],['📤','Nộp bài']].map(([icon,label]) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:7, border:`1px solid ${D.border}`, background:D.bgCard, opacity:0.55 }}>
              <span style={{ fontSize:14 }}>{icon}</span>
              <span style={{ fontSize:12, color:D.text2, fontWeight:500 }}>{label}</span>
              <span style={{ fontSize:10 }}>🔒</span>
            </div>
          ))}
        </div>

        {/* Keyboard hint */}
        <div style={{ padding:'5px 20px 7px', background:D.bgSurface, borderTop:`1px solid ${D.border}`, fontSize:10, color:D.text3, letterSpacing:'0.05em', display:'flex', gap:16 }}>
          <span>SPACE = Play/Pause</span>
          <span>·</span><span>← → = ±5s</span>
          <span>·</span><span>ESC = Đóng</span>
        </div>
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
