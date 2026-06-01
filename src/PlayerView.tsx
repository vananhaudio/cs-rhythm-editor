import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 1024)
  useEffect(() => {
    const h = () => setM(window.innerWidth < 1024)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return m
}
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
  const isMobile = useIsMobile()
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
  const audioStartRef = useRef<{audioT: number; songT: number} | null>(null);
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

  // accent: 0=phách 1 (mạnh nhất), 1=phách phụ mạnh (6/8 phách 4), 2=nhẹ
  function scheduleClick(t: number, accent: 0|1|2) {
    try {
      if (!audioCtxRef.current || muteRef.current) return;
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = accent === 0 ? 1100 : accent === 1 ? 700 : 440;
      const vol = accent === 0 ? 0.5 : accent === 1 ? 0.32 : 0.22;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (accent === 0 ? 0.09 : 0.06));
      osc.start(t); osc.stop(t + 0.12);
    } catch {}
  }
  function getAccent(beatInBar: number, timeSig: number): 0|1|2 {
    if (beatInBar === 0) return 0;
    if (timeSig === 6 && beatInBar === 3) return 1;
    if (timeSig === 9 && (beatInBar === 3 || beatInBar === 6)) return 1;
    if (timeSig === 12 && (beatInBar === 3 || beatInBar === 6 || beatInBar === 9)) return 1;
    return 2;
  }
  function startMetronome(from: number) {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const bd = beatDur / speedRef.current;
    const beats = Math.floor(from / beatDur);
    const timeIntoCurrentBeat = from - beats * beatDur;
    // Nếu đang đứng ở đầu beat (< 30ms) → phát beat đó ngay
    const atBeatStart = timeIntoCurrentBeat < 0.03;
    nextBeatRef.current = atBeatStart
      ? ctx.currentTime + 0.02
      : ctx.currentTime + (beatDur - timeIntoCurrentBeat) / speedRef.current;
    audioStartRef.current = { audioT: ctx.currentTime, songT: from };
    let idx = atBeatStart ? beats : beats + 1;
    stopMetronome();
    schedulerRef.current = setInterval(() => {
      const c = audioCtxRef.current; if (!c) return;
      while (nextBeatRef.current < c.currentTime + 0.05) {
        const beatInBar = idx % song.timeSignature;
        scheduleClick(nextBeatRef.current + 0.016, getAccent(beatInBar, song.timeSignature));
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
        let t: number;
        if (playMode === 'yt' && ytReadyRef.current && ytPlayerRef.current) {
          // YouTube mode: lấy thẳng từ ytPlayer để không bao giờ drift
          const ytT = ytPlayerRef.current.getCurrentTime?.() ?? 0;
          t = Math.max(0, ytT - getYtOffset());
        } else if (audioCtxRef.current && audioStartRef.current) {
          // Metro mode: sync theo AudioContext
          const anchor = audioStartRef.current;
          t = anchor.songT + (audioCtxRef.current.currentTime - anchor.audioT) * speedRef.current;
        } else {
          t = songT + (performance.now()-wall)/1000*speedRef.current;
        }
        t = Math.min(t, totalDur);
        currentTimeRef.current = t; setCurrentTime(t);
        setActiveBeatIdx(Math.floor(t / beatDur));
        if (t >= totalDur) {
          isPlayingRef.current = false; setIsPlaying(false);
          audioStartRef.current = null;
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
      audioStartRef.current = null;
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
  const chordMap  = useMemo(() => {
    const m: Record<number,string> = {}
    ;(song.chords??[]).forEach(c => { m[Math.round(c.time/beatDur)] = c.name })
    return m
  }, [song.chords, beatDur])
  const beatNowX  = beatContainerW * 0.3;
  const scrollOff = currentTime * PPS;
  const trackW    = totalDur * PPS + containerW;

  // ── Chunk logic cho 2-track đứng yên ──
  // Số beats vừa hiển thị trên 1 track
  // Làm tròn xuống bội số của timeSignature (4/4→4,8,12; 3/4→3,6,9...)
  const rawBeats = Math.max(song.timeSignature, Math.floor((containerW - 240) / (PPS * beatDur)))
  const beatsPerTrack = Math.floor(rawBeats / song.timeSignature) * song.timeSignature
  // Dùng currentTime để tính chunk — đảm bảo re-render ngay khi đổi chunk
  const currentChunk   = Math.floor((currentTime / beatDur) / Math.max(1, beatsPerTrack))
  // Track 1 = chunk chẵn hiện tại hoặc chunk chẵn tiếp theo (khi track 2 đang active)
  // Track 2 = chunk lẻ tiếp theo
  const activeTrackNum = currentChunk % 2 === 0 ? 1 : 2
  const t1Chunk = activeTrackNum === 1 ? currentChunk : currentChunk + 1
  const t2Chunk = activeTrackNum === 2 ? currentChunk : currentChunk + 1
  // Cả 2 track đứng yên — chữ đầu chunk bắt đầu từ mép trái + 20px
  // Chữ đầu chunk nằm tại 20px từ mép trái
  // vị trí thực = nowX + chunkStart*PPS - scrollOff = 20
  // => scrollOff = nowX + chunkStart*PPS - 20
  const t1ScrollOff  = nowX + t1Chunk * beatsPerTrack * beatDur * PPS - 120
  const t2ScrollOff  = nowX + t2Chunk * beatsPerTrack * beatDur * PPS - 120
  const pct       = totalDur > 0 ? currentTime/totalDur*100 : 0;

  // Mobile: dùng MobilePlayerView layout
  if (isMobile) {
    return (
      <MobileLayout
        song={song} onClose={onClose} onImportSong={onImportSong}
        isPlaying={isPlaying} currentTime={currentTime}
        togglePlay={togglePlay} seekTo={seekTo}
        speed={speed} setSpeed={setSpeed}
        muteMetronome={muteMetronome} setMuteMetronome={setMuteMetronome}
        activeBeatIdx={activeBeatIdx}
        totalDur={totalDur}
        currentTimeRef={currentTimeRef}
      />
    )
  }

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
              {song.tempo > 0 && <div style={{ fontSize:9, color:D.text3, fontFamily:'"DM Mono",monospace' }}>{song.tempo} BPM · {song.timeSignature}/4 · {fmtTime(totalDur)}</div>}
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

        {/* ══ PRACTICE AREA — 2 track đứng yên ══ */}
        <div style={{ flex:1, padding:'0 12px', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'flex-start', gap:0 }}>
          {([
            { tScrollOff: t1ScrollOff, isActive: activeTrackNum === 1 },
            { tScrollOff: t2ScrollOff, isActive: activeTrackNum === 2 },
          ] as const).map(({ tScrollOff, isActive }, ti) => (
            <div key={ti} ref={isActive ? scrollRef : undefined} style={{
              height: 110, flexShrink:0, overflow:'hidden',
              borderTop: `1px solid ${D.border}`,
              borderBottom: ti === 1 ? `1px solid ${D.border}` : 'none',
              display:'flex', flexDirection:'column', position:'relative',
              background: isActive ? '#141720' : D.bg,
              opacity: isActive ? 1 : 0.45,
              transition: 'opacity 0.3s, background 0.3s',
            }}>
              {/* Track content — y hệt gốc, chỉ dùng tScrollOff thay scrollOff */}
              <div style={{ flex:1, position:'relative', overflow:'hidden', background:D.bg }}>
                <div style={{ position:'absolute', top:0, left:0, height:'100%', width:trackW, transform:`translateX(${-tScrollOff}px)`, willChange:'transform' }}>
                  {/* Beat + Chord row */}
                  {(() => {
                    const chordAtBeat: Record<number, string> = {}
                    ;(song.chords ?? []).forEach(c => {
                      const beatIdx = Math.round(c.time / beatDur)
                      chordAtBeat[beatIdx] = c.name
                    })
                    // Chỉ render beats trong chunk này
                    const tChunk = ti === 0 ? t1Chunk : t2Chunk
                    const beatStart = tChunk * beatsPerTrack
                    const beatEnd   = Math.min(beatStart + beatsPerTrack, song.totalBars * song.timeSignature)
                    return Array.from({ length: beatEnd - beatStart }, (_, bi) => {
                      const i = beatStart + bi
                      const bib = i % song.timeSignature
                      const bt = i * beatDur
                      const cellX = nowX + bt * PPS
                      const isActiveB = activeBeatIdx === i && isActive
                      const chord = chordAtBeat[i]
                      const isBar1 = bib === 0
                      return (
                        <div key={'b'+ti+i} style={{ position:'absolute', left:cellX, top:'50%', height:31, width:PPS*beatDur, transform:'translate(-50%, -100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderLeft: isBar1 ? `1px solid rgba(108,99,255,0.18)` : `1px solid rgba(255,255,255,0.03)` }}>
                          {isBar1 && (
                            <span style={{ position:'absolute', top:2, left:3, fontSize:7, fontFamily:'"DM Mono",monospace', color:'rgba(108,99,255,0.45)', fontWeight:500 }}>
                              M{Math.floor(i/song.timeSignature)+1}
                            </span>
                          )}
                          {chord ? (
                            <span style={{ fontSize:18, fontWeight:700, fontFamily:'"Helvetica Neue",Arial,sans-serif', lineHeight:1,
                              color: isActiveB ? D.gold : 'rgba(245,158,11,0.55)',
                              textShadow: isActiveB ? `0 0 10px ${D.goldGlow}` : 'none',
                              transition:'color 0.06s',
                            }}>{chord}</span>
                          ) : (
                            <span style={{ fontSize:13, fontFamily:'"DM Mono",monospace', lineHeight:1,
                              fontWeight: isActiveB ? 800 : 400,
                              color: isActiveB ? (isBar1 ? '#fff' : D.accentLight) : (isBar1 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.13)'),
                              textShadow: isActiveB ? (isBar1 ? `0 0 10px #fff,0 0 20px ${D.accent}` : `0 0 8px ${D.accent}`) : 'none',
                              transition:'color 0.06s',
                            }}>{bib+1}</span>
                          )}
                        </div>
                      )
                    })
                  })()}
                  {/* Divider */}
                  <div style={{ position:'absolute', top:52, left:0, right:0, height:1, background:D.border }} />
                  {/* Lyrics */}
                  {(song.lyrics??[]).filter(l => {
                    const tChunk2    = ti === 0 ? t1Chunk : t2Chunk
                    const chunkStart = tChunk2 * beatsPerTrack * beatDur
                    const chunkEnd   = chunkStart + beatsPerTrack * beatDur
                    // Từ thuộc track này nếu time nằm trong beat range của track
                    return l.time >= chunkStart && l.time < chunkEnd
                  }).map((l,i,arr) => {
                    const lx = nowX + l.time*PPS;
                    const nt = arr[i+1] ? arr[i+1].time : l.time+beatDur*2;
                    const active = isActive && currentTime>=l.time && currentTime<nt;
                    const past   = isActive && currentTime>=nt;
                    return (
                      <div key={l.id+ti} style={{ left:lx, position:'absolute', top:`calc(31px + 50%)`, transform:'translate(-50%, -50%)', pointerEvents:'none', whiteSpace:'nowrap' }}>
                        <span style={{
                          fontSize:22, fontWeight: 400,
                          fontFamily:'"Helvetica Neue",Arial,sans-serif',
                          // Karaoke gradient: quét teal từ trái sang phải
                          ...(active ? (() => {
                            const pct = Math.min(100, Math.max(0, (currentTime - l.time) / Math.max(0.05, nt - l.time) * 100))
                            return {
                              backgroundImage: `linear-gradient(to right, #2DD4BF ${pct}%, rgba(255,255,255,1) ${pct}%)`,
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              backgroundClip: 'text',
                            }
                          })() : {
                            color: past ? 'rgba(45,212,191,0.7)' : 'rgba(255,255,255,1)',
                          }),
                        }}>{l.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* YouTube overlay — mini/full */}
        {playMode==='yt' && hasYT && ytMode!=='focus' && (
          <div onMouseEnter={() => setYtHovered(true)} onMouseLeave={() => setYtHovered(false)}
            style={{ position:'absolute', right:12, bottom:60,
              ...(ytMode==='mini' ? { width:240, aspectRatio:'16/9' } : { width:'min(40vw,420px)', aspectRatio:'16/9' }),
              borderRadius:10, overflow:'hidden', zIndex:15,
              opacity: ytHovered ? 1 : isPlaying ? 0.4 : 1, transition:'opacity 0.3s',
              boxShadow:'0 8px 32px rgba(0,0,0,0.6)', border:`1px solid ${D.border}`,
            }}>
            <div style={{ position:'absolute',top:0,left:0,right:0,zIndex:2,background:'rgba(0,0,0,0.6)',padding:'3px 8px',display:'flex',alignItems:'center',gap:6 }}>
              <span style={{ fontSize:9,color:D.text3,flex:1,fontFamily:'"DM Mono",monospace' }}>YT · offset {getYtOffset().toFixed(1)}s{!ytReady?' · connecting...':''}</span>
              <button onClick={() => setYtMode(ytMode==='mini'?'full':'mini')} style={{ background:'none',border:'none',color:D.text3,fontSize:10,cursor:'pointer' }}>{ytMode==='mini'?'⛶':'▣'}</button>
              <button onClick={() => setYtMode('focus')} style={{ background:'none',border:'none',color:D.text3,fontSize:12,cursor:'pointer' }}>✕</button>
            </div>
            <div id="yt-player-frame" style={{ width:'100%',height:'100%' }} />
          </div>
        )}

        {/* Placeholder để YouTube API mount khi focus mode */}
        {playMode==='yt' && hasYT && ytMode==='focus' && (
          <div id="yt-player-frame" style={{ display:'none' }} />
        )}

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

// ── Mobile Layout Component ──────────────────────────────────────────────────
function MobileLayout({ song, onClose, onImportSong, isPlaying, currentTime, togglePlay, seekTo, speed, setSpeed, muteMetronome, setMuteMetronome, activeBeatIdx, totalDur, currentTimeRef }: {
  song: any; onClose: () => void; onImportSong?: (s: RhythmSong) => void; isPlaying: boolean; currentTime: number
  togglePlay: () => void; seekTo: (t: number) => void
  speed: number; setSpeed: (s: number) => void
  muteMetronome: boolean; setMuteMetronome: (v: boolean | ((p: boolean) => boolean)) => void
  activeBeatIdx: number; totalDur: number
  currentTimeRef: React.RefObject<number | null>
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [mW, setMW] = React.useState(window.innerWidth)
  const [mH, setMH] = React.useState(window.innerHeight)
  React.useEffect(() => {
    const ro = new ResizeObserver(e => { setMW(e[0].contentRect.width); setMH(e[0].contentRect.height) })
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const beatDur = 60 / song.tempo
  const barDur  = beatDur * song.timeSignature
  // PPS: 1 ô nhịp vừa đúng màn hình (trừ 40px padding)
  // Trừ 2*cellW để có padding 1 ô mỗi bên, chữ đầu/cuối không bị cắt
  const PPS = (mW - 40) / ((song.timeSignature + 1) * beatDur)
  const cellWMobile = PPS * beatDur
  const nowX = cellWMobile / 2  // phách 1 cách lề trái nửa ô
  const trackW = totalDur * PPS + mW

  // Mobile: 1 ô nhịp = đúng timeSignature beats (4/4 = 4, 3/4 = 3)
  const beatsPerTrack = song.timeSignature
  const totalChunks = Math.ceil((song.totalBars * song.timeSignature) / beatsPerTrack)
  const chunkDur = beatsPerTrack * beatDur
  const TRACK_H = 100

  // Chunk đang phát
  const currentChunk = Math.floor(currentTime / chunkDur)
  const timeInChunk = currentTime - currentChunk * chunkDur
  const chunkDone = timeInChunk >= chunkDur - beatDur  // còn 1 phách cuối

  // translateY: đứng yên trong câu, cuộn trong 1 phách cuối giữa 2 câu
  // Khi còn 1 phách cuối → cuộn từ chunkIndex*H đến (chunkIndex+1)*H
  const scrollProgress = chunkDone
    ? (timeInChunk - (chunkDur - beatDur)) / beatDur  // 0→1 trong 1 phách
    : 0
  const translateY = -((currentChunk + scrollProgress) * TRACK_H)

  // Ref để RAF set transform trực tiếp, không qua React
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    let raf: number
    const tick = () => {
      if (scrollContainerRef.current) {
        const t = currentTimeRef.current ?? 0
        const chunk = Math.floor(t / chunkDur)
        const tInChunk = t - chunk * chunkDur
        const done = tInChunk >= chunkDur - beatDur
        const prog = done ? (tInChunk - (chunkDur - beatDur)) / beatDur : 0
        const y = -((chunk + Math.min(prog, 1)) * TRACK_H)
        scrollContainerRef.current.style.transform = `translateY(${y}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [chunkDur, beatDur, TRACK_H])

  const chordMap = React.useMemo(() => {
    const m: Record<number,string> = {}
    ;(song.chords??[]).forEach((c: any) => { m[Math.round(c.time/beatDur)] = c.name })
    return m
  }, [song.chords, beatDur])

  const [showSongList, setShowSongList] = React.useState(false)
  const [showControls, setShowControls] = React.useState(true)
  const isPlayingRef2 = React.useRef(isPlaying)
  React.useEffect(() => { isPlayingRef2.current = isPlaying }, [isPlaying])

  const toggleControls = React.useCallback(() => {
    setShowControls(v => !v)
  }, [])

  // Khi bắt đầu phát → tự ẩn; khi dừng → hiện lại
  // Không auto-hide theo isPlaying nữa — người dùng tự toggle
  const fmtT = (t: number) => `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`
  const pct = totalDur > 0 ? currentTime/totalDur*100 : 0

  const renderTrack = (_tScrollOff: number, isActive: boolean, ci: number) => {
    const tChunk = ci
    const beatStart = tChunk * beatsPerTrack
    const beatEnd = Math.min(beatStart + beatsPerTrack, song.totalBars * song.timeSignature)
    const chunkStart = beatStart * beatDur
    const chunkEnd = beatEnd * beatDur
    const TRACK_H = 100

    // tScrollOff: đẩy cả track sao cho đầu chunk về vị trí nowX — y hệt desktop
    const tScrollOff = chunkStart * PPS

    const chordAtBeat: Record<number, string> = {}
    ;(song.chords ?? []).forEach((c: any) => { chordAtBeat[Math.round(c.time / beatDur)] = c.name })

    return (
      <div key={ci} style={{ height:TRACK_H, flexShrink:0, borderTop:`1px solid rgba(255,255,255,0.06)`, background: isActive ? '#141720' : '#0D0F14', opacity: isActive ? 1 : 0.65, transition:'opacity 0.3s', position:'relative', overflow:'hidden' }}>
        {/* Container dịch ngang — y hệt desktop, bên trong chỉ dùng nowX + time*PPS */}
        <div style={{ position:'absolute', top:0, left:0, height:'100%', width:trackW, transform:`translateX(${-tScrollOff}px)` }}>
          {/* Beat + Chord row */}
          {Array.from({ length: beatEnd - beatStart }, (_, bi) => {
            const i = beatStart + bi
            const bib = i % song.timeSignature
            const isBar1 = bib === 0
            const isActiveB = activeBeatIdx === i && isActive
            const chord = chordAtBeat[i]
            const cellX = nowX + i * beatDur * PPS
            return (
              <div key={'b'+i} style={{ position:'absolute', left:cellX, top:0, height:24, width:PPS*beatDur, transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderLeft: isBar1 ? `2px solid rgba(108,99,255,0.3)` : `1px solid rgba(255,255,255,0.05)` }}>
                {isBar1 && <span style={{ position:'absolute', top:2, left:3, fontSize:7, fontFamily:'"DM Mono",monospace', color:'rgba(108,99,255,0.5)' }}>M{Math.floor(i/song.timeSignature)+1}</span>}
                {chord ? (
                  <span style={{ fontSize:14, fontWeight:700, fontFamily:'"Helvetica Neue",Arial', color: isActiveB ? '#F59E0B' : 'rgba(245,158,11,0.6)', transition:'color 0.06s' }}>{chord}</span>
                ) : (
                  <span style={{ fontSize:12, fontFamily:'"DM Mono",monospace', fontWeight: isActiveB ? 800 : 400, color: isActiveB ? (isBar1 ? '#fff' : '#8B84FF') : (isBar1 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.6)'), transition:'color 0.06s' }}>{bib+1}</span>
                )}
              </div>
            )
          })}
          {/* Lyrics — filter theo chunk, left = nowX + l.time*PPS (y hệt desktop) */}
          {(song.lyrics??[]).filter((l: any) => l.time >= chunkStart && l.time < chunkEnd).map((l: any, i: number, arr: any[]) => {
            const lx = nowX + l.time * PPS
            const nt = arr[i+1] ? arr[i+1].time : l.time + beatDur*2
            const active = isActive && currentTime >= l.time && currentTime < nt
            const past   = isActive && currentTime >= nt
            return (
              <div key={l.id} style={{ position:'absolute', left:lx, top:'calc(24px + 18px)', transform:'translateX(-50%)', pointerEvents:'none', whiteSpace:'nowrap' }}>
                <span style={{ fontSize:15, fontWeight:400, fontFamily:'"Helvetica Neue",Arial',
                  ...(active ? (() => {
                    const pct = Math.min(100, Math.max(0, (currentTime - l.time) / Math.max(0.05, nt - l.time) * 100))
                    return { backgroundImage:`linear-gradient(to right,#2DD4BF ${pct}%,rgba(255,255,255,1) ${pct}%)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }
                  })() : { color: past ? 'rgba(45,212,191,0.7)' : 'rgba(255,255,255,1)' })
                }}>{l.text}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const isPortrait = mW < mH * 0.9

  return (
    <div ref={containerRef} onClick={toggleControls} style={{ position:'fixed', inset:0, background:'#0D0F14', display:'flex', flexDirection:'column', zIndex:300, fontFamily:'"DM Sans",system-ui,sans-serif', color:'#F1F5F9', overflowY:'hidden' }}>
      {isPortrait && (
        <div style={{ position:'absolute', inset:0, background:'rgba(13,15,20,0.96)', zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
          <div style={{ fontSize:48 }}>📱</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#F1F5F9', textAlign:'center' }}>Xoay ngang để chơi nhạc</div>
          <div style={{ fontSize:13, color:'#475569', textAlign:'center', maxWidth:260, lineHeight:1.5 }}>Player tối ưu cho màn hình ngang</div>
          <button onClick={onClose} style={{ marginTop:8, padding:'8px 20px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.06)', color:'#94A3B8', cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>← Quay lại</button>
        </div>
      )}
      {/* Header + Seek — ẩn khi đang phát */}
      <div style={{ overflow:'hidden', maxHeight: showControls ? 200 : 0, opacity: showControls ? 1 : 0, transition:'max-height 0.3s ease, opacity 0.25s ease', flexShrink:0 }}>
      <div style={{ background:'#141720', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 12px', height:52, display:'flex', alignItems:'center', gap:8 }}>
        <button onClick={onClose} style={{ width:36,height:36,borderRadius:8,border:'1px solid rgba(255,255,255,0.08)',background:'none',color:'#94A3B8',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>←</button>
        <button onClick={() => setShowSongList(true)} style={{ flex:1,minWidth:0,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'6px 10px',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:8 }}>
          <span style={{ fontSize:14 }}>🎵</span>
          <div style={{ minWidth:0,flex:1 }}>
            <div style={{ fontSize:13,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#F1F5F9' }}>{song.title||'Chọn bài'}</div>
            <div style={{ fontSize:10,color:'#475569',fontFamily:'"DM Mono",monospace' }}>{song.tempo} BPM · {song.timeSignature}/4 · {fmtT(totalDur)}</div>
          </div>
          <span style={{ color:'#475569',fontSize:12,flexShrink:0 }}>▾</span>
        </button>
        <button onClick={() => setMuteMetronome(v=>!v)} style={{ width:36,height:36,borderRadius:8,border:`1px solid ${muteMetronome?'rgba(108,99,255,0.4)':'rgba(255,255,255,0.08)'}`,background:muteMetronome?'rgba(108,99,255,0.15)':'none',color:muteMetronome?'#8B84FF':'#94A3B8',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>{muteMetronome?'🔇':'🔊'}</button>
      </div>

      {/* Seek */}
      <div style={{ background:'#141720', padding:'6px 14px 8px', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        <span style={{ fontSize:10,fontFamily:'"DM Mono",monospace',color:'#475569',minWidth:32 }}>{fmtT(currentTime)}</span>
        <div style={{ flex:1,position:'relative',height:20,cursor:'pointer',display:'flex',alignItems:'center' }}
          onClick={e => { const r=e.currentTarget.getBoundingClientRect(); seekTo((e.clientX-r.left)/r.width*totalDur) }}>
          <div style={{ width:'100%',height:3,background:'rgba(255,255,255,0.06)',borderRadius:2 }}>
            <div style={{ height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,#6C63FF,#8B84FF)',borderRadius:2,transition:'width 0.1s linear' }} />
          </div>
          <div style={{ position:'absolute',left:`${pct}%`,transform:'translateX(-50%)',width:12,height:12,borderRadius:'50%',background:'#6C63FF',border:'2px solid #8B84FF',pointerEvents:'none' }} />
        </div>
        <span style={{ fontSize:10,fontFamily:'"DM Mono",monospace',color:'#475569',minWidth:32,textAlign:'right' }}>{fmtT(totalDur)}</span>
      </div>

      </div>{/* end header+seek wrapper */}

      {/* Nút play/pause nhỏ góc trái — hiện khi controls ẩn */}


      {/* Virtual scroll — RAF drives transform, no React re-render */}
      <div style={{ flex:1, overflow:'hidden', position:'relative', background:'#0D0F14' }}>
        <div ref={scrollContainerRef} style={{
          position:'absolute', left:0, right:0,
          top: showControls ? 0 : 16,
          willChange: 'transform',
        }}>
          {Array.from({ length: totalChunks }, (_, ci) => {
            const isActive = ci === currentChunk
            const scrollOff = nowX + ci * beatsPerTrack * beatDur * PPS - 20
            return renderTrack(scrollOff, isActive, ci)
          })}
        </div>
      </div>

      {/* Controls — nút play/pause + back ở góc phải dưới */}
      <div style={{ height:72, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'flex-end', padding:'0 20px', gap:12, background:'#0D0F14' }}>
        {/* Khi dừng: hiện nút ⏮ + speed pills */}
        {!isPlaying && (
          <>
            <div style={{ display:'flex', gap:6, marginRight:'auto' }}>
              {[0.75,1,1.25].map(s => (
                <button key={s} onClick={e => { e.stopPropagation(); setSpeed(s) }}
                  style={{ padding:'5px 14px',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'"DM Mono",monospace',fontSize:12,fontWeight:600,
                    background: speed===s ? '#6C63FF' : 'rgba(255,255,255,0.08)',
                    color: speed===s ? '#fff' : '#475569',
                  }}>{s===1?'1×':s+'×'}</button>
              ))}
            </div>
            <button onClick={e => { e.stopPropagation(); seekTo(0) }}
              style={{ width:44,height:44,borderRadius:12,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)',color:'#94A3B8',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center' }}>⏮</button>
          </>
        )}
        {/* Nút play/pause luôn hiện góc phải */}
        <button onClick={e => { e.stopPropagation(); togglePlay() }}
          style={{ width: isPlaying ? 44 : 56, height: isPlaying ? 44 : 56, borderRadius:'50%', border:'none', cursor:'pointer', fontSize: isPlaying ? 18 : 22, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s',
            background: isPlaying ? 'rgba(108,99,255,0.25)' : '#6C63FF',
            color: isPlaying ? '#8B84FF' : '#fff',
            boxShadow: isPlaying ? 'none' : '0 4px 16px rgba(108,99,255,0.4)',
          }}>{isPlaying ? '⏸' : '▶'}</button>
      </div>

    {showSongList && (
        <SongList
          onSelect={(s: RhythmSong) => { if (onImportSong) onImportSong(s); setShowSongList(false); }}
          onClose={() => setShowSongList(false)}
          isTeacher={false}
        />
      )}
    </div>
  )
}
