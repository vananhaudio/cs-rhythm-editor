import { useState, useEffect, useRef, useCallback } from 'react';
import type { RhythmSong } from './types';
import './PlayerView.css';
import { SongList } from './SongList';

// ── Helpers ──
function fmtTime(t: number) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function calibKey(title: string, filename: string) {
  return `csre-calib::${title}::${filename}`;
}

interface Calib { offset: number; tempoScale: number; }

const PADDING_SECS = 4; // 4 giây trắng trước mp3

// ── Waveform + 2 markers + zoom ──
function WaveformSync({ audioBuffer, duration, calib, onCalibChange, currentTime, song }: {
  audioBuffer: AudioBuffer | null;
  duration: number;
  calib: Calib | null;
  onCalibChange: (c: Calib) => void;
  currentTime: number;
  song: RhythmSong;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beatDur = 60 / song.tempo;
  const barDur = beatDur * song.timeSignature;
  const totalDur = duration + PADDING_SECS;

  // markers[i] = mp3 time của phách 1 nhịp (i+1), tính từ đầu file (không có padding)
  // Hiển thị trên canvas: time + PADDING_SECS
  const [markers, setMarkers] = useState<number[]>(() => {
    if (calib) {
      const m0 = calib.offset; // phách 1 nhịp 1 trong mp3 time
      const measuredBarDur = barDur * calib.tempoScale;
      return [m0, m0 + measuredBarDur, m0 + 2 * measuredBarDur];
    }
    // Mặc định: nhịp 1 ở 1s trước nhạc, nhịp 2-3 dàn theo tempo JSON
    const m0 = -PADDING_SECS + 1;
    return [m0, m0 + barDur, m0 + 2 * barDur];
  });

  const [zoom, setZoom] = useState(Math.min(totalDur, 20));
  const [viewStart, setViewStart] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(800);
  const dragging = useRef<number | null>(null);

  const viewEnd = Math.min(viewStart + zoom, totalDur);
  const viewDur = viewEnd - viewStart;

  // canvas time → mp3 time (canvas 0 = mp3 -PADDING_SECS)
  const canvasToMp3 = (canvasTime: number) => canvasTime - PADDING_SECS;
  const mp3ToCanvas = (mp3Time: number) => mp3Time + PADDING_SECS;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(entries => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) { canvas.width = w; setCanvasWidth(w); }
    });
    ro.observe(canvas);
    if (canvas.clientWidth > 0) { canvas.width = canvas.clientWidth; setCanvasWidth(canvas.clientWidth); }
    return () => ro.disconnect();
  }, []);

  // Vẽ waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasWidth < 10) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvasWidth; const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0F1117';
    ctx.fillRect(0, 0, W, H);

    // Vùng padding trắng (4s đầu)
    const paddingEndX = ((PADDING_SECS - viewStart) / viewDur) * W;
    if (paddingEndX > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(0, 0, Math.min(paddingEndX, W), H);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(Math.min(paddingEndX, W), 0);
      ctx.lineTo(Math.min(paddingEndX, W), H);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Waveform (chỉ vẽ phần mp3 thật)
    if (audioBuffer) {
      const sampleRate = audioBuffer.sampleRate;
      const data = audioBuffer.getChannelData(0);
      ctx.beginPath();
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x++) {
        const canvasT = viewStart + (x / W) * viewDur;
        if (canvasT < PADDING_SECS) continue;
        const mp3T = canvasT - PADDING_SECS;
        const sampleIdx = Math.floor(mp3T * sampleRate);
        const step = Math.max(1, Math.floor((viewDur / W) * sampleRate));
        let max = 0;
        for (let j = 0; j < step; j++) {
          const v = Math.abs(data[sampleIdx + j] || 0);
          if (v > max) max = v;
        }
        const h = max * H * 0.85;
        ctx.moveTo(x + 0.5, H/2 - h/2);
        ctx.lineTo(x + 0.5, H/2 + h/2);
      }
      ctx.stroke();
    }

    // Đường giữa
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();

    // Playhead
    const playCanvasTime = mp3ToCanvas(currentTime);
    if (playCanvasTime >= viewStart && playCanvasTime <= viewEnd) {
      const px = ((playCanvasTime - viewStart) / viewDur) * W;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.setLineDash([3,3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px,0); ctx.lineTo(px,H); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Markers
    const colors = ['#F59E0B', '#F97316', '#10B981', '#60A5FA', '#A78BFA', '#F472B6', '#34D399'];
    markers.forEach((m, i) => {
      const canvasT = mp3ToCanvas(m);
      if (canvasT < viewStart || canvasT > viewEnd) return;
      const px = Math.round(((canvasT - viewStart) / viewDur) * W);
      const color = colors[i % colors.length];
      ctx.strokeStyle = color; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(px,0); ctx.lineTo(px,H); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(px-7,0); ctx.lineTo(px+7,0); ctx.lineTo(px,10); ctx.closePath(); ctx.fill();
      const label = `M${i+1}`;
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(px+4, 12, 22, 16);
      ctx.fillStyle = color;
      ctx.fillText(label, px+6, 24);
    });

  }, [audioBuffer, markers, viewStart, viewEnd, viewDur, currentTime, canvasWidth]);

  const timeFromX = (clientX: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return viewStart + frac * viewDur; // canvas time
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const canvasT = timeFromX(e.clientX);
    const mp3T = canvasToMp3(canvasT);
    // Tìm marker gần nhất
    let closest = 0;
    let minDist = Infinity;
    markers.forEach((m, i) => {
      const d = Math.abs(mp3T - m);
      if (d < minDist) { minDist = d; closest = i; }
    });
    dragging.current = closest;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragging.current === null) return;
    const canvasT = timeFromX(e.clientX);
    const mp3T = canvasToMp3(Math.max(0, Math.min(totalDur, canvasT)));
    const idx = dragging.current;
    setMarkers(prev => {
      const next = [...prev];
      next[idx] = mp3T;
      // Tính barDur thực từ marker 0 và 1
      if (next.length >= 2) {
        const measuredBarDur = next[1] - next[0];
        if (measuredBarDur > 0.1) {
          // Tự động dàn các marker sau marker bị kéo
          for (let j = idx + 1; j < next.length; j++) {
            next[j] = next[0] + j * measuredBarDur;
          }
        }
      }
      return next;
    });
  };

  const handlePointerUp = () => {
    if (dragging.current === null) return;
    dragging.current = null;
    applyCalib();
  };

  const applyCalib = () => {
    if (markers.length < 2) return;
    const m0 = markers[0]; // mp3 time của phách 1 nhịp 1
    // Dùng M1+M3 nếu có (trung bình 2 nhịp = chính xác hơn)
    // Dùng M1+M2 nếu chỉ có 2 marker
    const measuredBarDur = markers.length >= 3
      ? (markers[2] - markers[0]) / 2
      : markers[1] - markers[0];
    if (measuredBarDur < 0.1) return;
    const tempoScale = measuredBarDur / barDur;
    const offset = m0;
    onCalibChange({ offset, tempoScale });
  };

  const addMarker = () => {
    setMarkers(prev => {
      if (prev.length >= 3) return prev; // Tối đa 3 marker
      const measuredBarDur = prev.length >= 2 ? prev[1] - prev[0] : barDur;
      const next = [...prev, prev[0] + prev.length * measuredBarDur];
      return next;
    });
  };

  const measuredBpm = markers.length >= 2 && (markers[1] - markers[0]) > 0.1
    ? (60 / (markers[1] - markers[0])) * song.timeSignature
    : null;

  const zoomLevels = [totalDur, totalDur/2, 20, 10, 5, 2];
  const zoomLabels = ['Toàn bài', '1/2', '20s', '10s', '5s', '2s'];

  return (
    <div className="waveform-wrap">
      <div className="waveform-header">
        <span className="waveform-title">🎛 Căn nhịp</span>
        <div className="waveform-zoom-group">
          {zoomLevels.map((z, i) => (
            <button key={z} className={`waveform-zoom-btn ${zoom === z ? 'active' : ''}`}
              onClick={() => { setZoom(z); setViewStart(Math.max(0, Math.min(viewStart, totalDur - z))); }}>
              {zoomLabels[i]}
            </button>
          ))}
        </div>
        {measuredBpm && (
          <span className="waveform-bpm">
            <strong>{measuredBpm.toFixed(1)} BPM thực</strong>
          </span>
        )}

      </div>

      {zoom < totalDur && (
        <div className="waveform-pan">
          <span style={{ fontSize: 10, color: '#4B5563' }}>◀</span>
          <input type="range" min={0} max={Math.max(0, totalDur - zoom)} step={0.01}
            value={viewStart} onChange={e => setViewStart(parseFloat(e.target.value))}
            className="waveform-pan-slider" />
          <span style={{ fontSize: 10, color: '#4B5563' }}>▶</span>
          <span className="waveform-pan-time">{fmtTime(viewStart)} — {fmtTime(viewEnd)}</span>
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <canvas ref={canvasRef} className="waveform-canvas" height={90}
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={e => {
            e.preventDefault();
            const delta = (e.deltaY / 300) * zoom;
            setViewStart(prev => Math.max(0, Math.min(prev + delta, totalDur - zoom)));
          }} />
      </div>

      <div className="waveform-legend">
        <span style={{ color: '#F59E0B' }}>M1 = Phách 1 Nhịp 1</span>
        <span style={{ color: '#F97316' }}>M2 = Phách 1 Nhịp 2 (tính barDur)</span>
        <span style={{ color: '#10B981' }}>M3 = Phách 1 Nhịp 3 (tăng độ chính xác)</span>
        <span style={{ color: '#6B7280' }}>Kéo M1 để set điểm bắt đầu · M2 tính barDur · M3 tinh chỉnh</span>
      </div>
    </div>
  );
}

// ── Main PlayerView ──
export function PlayerView({ song, onClose, onUpdateTitle, onImportSong, extraActions }: { song: RhythmSong; onClose: () => void; onUpdateTitle?: (title: string) => void; onImportSong?: (song: RhythmSong) => void; extraActions?: React.ReactNode }) {

  const [isPlaying, setIsPlaying] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(song.title || '');
  const [currentTime, setCurrentTime] = useState(0);
  const [mp3FileName, setMp3FileName] = useState<string | null>(null);
  const [mp3Duration, setMp3Duration] = useState(0);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [calib, setCalib] = useState<Calib | null>(null);
  const [muteMetronome, setMuteMetronome] = useState(false);
  const muteMetronomeRef = useRef(false);
  const [showSongList, setShowSongList] = useState(false);
  const [showYoutube, setShowYoutube] = useState(false);
  const [playMode, setPlayMode] = useState<'metro'|'yt'>('metro');
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const ytSyncRef = useRef(false);
  const calibRef = useRef<Calib | null>(null);

  // Sync playMode → showYoutube
  useEffect(() => { setShowYoutube(playMode === 'yt'); }, [playMode]);
  const [showSync, setShowSync] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [speed, setSpeed] = useState(1);

  const mp3Ref = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);
  const [activeBeatIdx, setActiveBeatIdx] = useState(-1);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastBeatRef = useRef<number>(-1);

  // ── Metronome scheduler (dùng AudioContext time, không phụ thuộc RAF) ──
  const scheduleAheadTime = 0.05; // schedule trước 50ms
  const clickOffset = 0.016; // delay click 1 frame (16ms) để khớp visual RAF
  const nextBeatTimeRef = useRef<number>(0);
  const schedulerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxStartRef = useRef<number>(0); // audioCtx.currentTime khi startSongRef=0
  const songStartTimeRef = useRef<number>(0); // song time khi bắt đầu play

  useEffect(() => { muteMetronomeRef.current = muteMetronome; }, [muteMetronome]);

  function scheduleClick(audioTime: number, isBeat1: boolean) {
    try {
      if (!audioCtxRef.current || muteMetronomeRef.current) return;
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = isBeat1 ? 880 : 440;
      gain.gain.setValueAtTime(0.5, audioTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioTime + (isBeat1 ? 0.08 : 0.06));
      osc.start(audioTime);
      osc.stop(audioTime + 0.1);
    } catch { /* ignore */ }
  }

  function startMetronomeScheduler(startSongTime: number) {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    songStartTimeRef.current = startSongTime;
    audioCtxStartRef.current = ctx.currentTime;

    // nextBeatTimeRef = audioCtx time của phách tiếp theo
    const beatDurScaled = beatDur / speed;
    const beatsElapsed = Math.floor(startSongTime / beatDur);
    const timeToNextBeat = (beatsElapsed + 1) * beatDur - startSongTime;
    nextBeatTimeRef.current = ctx.currentTime + timeToNextBeat / speed;
    let nextBeatIdx = beatsElapsed + 1;

    if (schedulerTimerRef.current) clearInterval(schedulerTimerRef.current);
    schedulerTimerRef.current = setInterval(() => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      while (nextBeatTimeRef.current < ctx.currentTime + scheduleAheadTime) {
        const beatInBar = nextBeatIdx % song.timeSignature;
        scheduleClick(nextBeatTimeRef.current + clickOffset, beatInBar === 0);
        nextBeatTimeRef.current += beatDurScaled;
        nextBeatIdx++;
      }
    }, 25); // check mỗi 25ms
  }

  function stopMetronomeScheduler() {
    if (schedulerTimerRef.current) {
      clearInterval(schedulerTimerRef.current);
      schedulerTimerRef.current = null;
    }
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const beatScrollRef = useRef<HTMLDivElement>(null);
  const [beatContainerW, setBeatContainerW] = useState(900);
  const mp3InputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const startWallRef = useRef(0);
  const startSongRef = useRef(0);

  const beatDur = 60 / song.tempo;
  const barDur = beatDur * song.timeSignature;
  const totalDuration = song.totalBars * barDur;
  const displayDuration = mp3Duration > 0 ? mp3Duration : totalDuration;

  // PX_PER_SEC cho scroll
  const PX_PER_SEC = 120;
const LS_SONG_KEY = 'csre-player-song';
const LS_MP3_OFFSET_KEY = (title: string, filename: string) => `csre-calib::${title}::${filename}`;

function lsSaveSong(song: RhythmSong) {
  try { localStorage.setItem(LS_SONG_KEY, JSON.stringify(song)); } catch { /* ignore */ }
}
function lsLoadSong(): RhythmSong | null {
  try {
    const raw = localStorage.getItem(LS_SONG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

  // effTime: json time → mp3 time (để vẽ đúng vị trí trên timeline)
  const effTime = useCallback((t: number) => {
    if (!calib) return t;
    return t * calib.tempoScale + calib.offset;
  }, [calib]);

  // ── YouTube helpers ──
  const getYoutubeId = (url: string) => {
    const m = url.match(/(?:youtu\.be\/|v=|\/embed\/)([\w-]{11})/)
    return m ? m[1] : null
  }

  const ytSeek = (songTime: number) => {
    const offset = (song as any).youtubeOffset ?? 0
    if (ytPlayerRef.current && ytReadyRef.current) {
      ytPlayerRef.current.seekTo(offset + songTime, true)
    }
  }

  const ytPlay = () => {
    if (ytPlayerRef.current && ytReadyRef.current) ytPlayerRef.current.playVideo()
  }

  const ytPause = () => {
    if (ytPlayerRef.current && ytReadyRef.current) ytPlayerRef.current.pauseVideo()
  }

  const effectivePps = calib ? PX_PER_SEC / calib.tempoScale : PX_PER_SEC;
  const [containerW, setContainerW] = useState(900);
  useEffect(() => {
    if (!scrollRef.current) return;
    const ro = new ResizeObserver(entries => {
      setContainerW(entries[0].contentRect.width);
    });
    ro.observe(scrollRef.current);
    if (scrollRef.current.clientWidth > 0) setContainerW(scrollRef.current.clientWidth);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!beatScrollRef.current) return;
    const ro = new ResizeObserver(entries => {
      setBeatContainerW(entries[0].contentRect.width);
    });
    ro.observe(beatScrollRef.current);
    if (beatScrollRef.current.clientWidth > 0) setBeatContainerW(beatScrollRef.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  const nowLineX = containerW * 0.3;
  const beatNowLineX = nowLineX; // dùng cùng nowLineX để beat và lyric thẳng hàng
  const trackWidth = displayDuration * effectivePps + containerW;
  // scrollOffset: currentTime là mp3 time (hoặc wall clock khi không có mp3)
  // Tất cả event được vẽ tại: nowLineX + effTime(jsonTime) * effectivePps
  // effTime(jsonTime) = jsonTime * tempoScale + offset → ra mp3 time
  // effectivePps = PX_PER_SEC / tempoScale
  // → event px = nowLineX + mp3Time * PX_PER_SEC
  // now-line ở nowLineX → cần track dịch: currentMp3Time * PX_PER_SEC
  // Khi không có calib: effTime(t)=t, effectivePps=PX_PER_SEC → scrollOffset = currentTime * PX_PER_SEC
  const scrollOffset = currentTime * effectivePps;

  // ── Load calib từ localStorage ──
  useEffect(() => {
    if (!mp3FileName || !song.title) { setCalib(null); return; }
    const key = LS_MP3_OFFSET_KEY(song.title, mp3FileName);
    try {
      const raw = localStorage.getItem(key);
      if (raw) setCalib(JSON.parse(raw));
      else setCalib(null);
    } catch { setCalib(null); }
  }, [mp3FileName, song.title]);

  useEffect(() => { calibRef.current = calib; }, [calib]);

  // ── Init YouTube IFrame API ──
  useEffect(() => {
    if (!showYoutube || !(song as any).youtubeUrl) return
    const ytId = getYoutubeId((song as any).youtubeUrl)
    if (!ytId) return

    const initPlayer = () => {
      if (ytPlayerRef.current) { ytPlayerRef.current.destroy(); ytPlayerRef.current = null }
      ytReadyRef.current = false
      ytPlayerRef.current = new (window as any).YT.Player('yt-player-frame', {
        videoId: ytId,
        playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => {
            ytReadyRef.current = true
            const offset = (song as any).youtubeOffset ?? 0
            ytPlayerRef.current.seekTo(offset, true)
            ytPlayerRef.current.pauseVideo()
          }
        }
      })
    }

    if ((window as any).YT && (window as any).YT.Player) {
      initPlayer()
    } else {
      if (!document.getElementById('yt-api-script')) {
        const tag = document.createElement('script')
        tag.id = 'yt-api-script'
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
      }
      ;(window as any).onYouTubeIframeAPIReady = initPlayer
    }

    return () => {
      if (ytPlayerRef.current) { ytPlayerRef.current.destroy(); ytPlayerRef.current = null }
      ytReadyRef.current = false
    }
  }, [showYoutube, (song as any).youtubeUrl, (song as any).youtubeOffset])

  const saveCalib = (c: Calib) => {
    if (!mp3FileName || !song.title) return; // Cần có tên bài mới lưu calib
    try { localStorage.setItem(LS_MP3_OFFSET_KEY(song.title, mp3FileName), JSON.stringify(c)); } catch { /* ignore */ }
  };

  // ── RAF loop ──
  const tick = useCallback(() => {
    let t: number;
    if (mp3Ref.current) {
      t = mp3Ref.current.currentTime;
    } else if (audioCtxRef.current) {
      // Dùng AudioContext clock — đồng bộ với scheduler
      t = songStartTimeRef.current + (audioCtxRef.current.currentTime - audioCtxStartRef.current) * speed;
      if (t >= totalDuration) { t = t % totalDuration; songStartTimeRef.current = t; audioCtxStartRef.current = audioCtxRef.current.currentTime; }
    } else {
      t = startSongRef.current + (performance.now() - startWallRef.current) / 1000 * speed;
      if (t >= totalDuration) { t = t % totalDuration; startWallRef.current = performance.now(); startSongRef.current = t; }
    }
    currentTimeRef.current = t;
    setCurrentTime(t);
    // Khi có calib: beat i hiển thị tại mp3 time = i*beatDur*tempoScale + offset
    // → beat active khi t >= i*beatDur*tempoScale + offset
    // → i = (t - offset) / (beatDur * tempoScale)
    const calibOffset = calibRef.current?.offset ?? 0;
    const calibScale = calibRef.current?.tempoScale ?? 1;
    const newBeatIdx = Math.floor((t - calibOffset) / (beatDur * calibScale));
    setActiveBeatIdx(newBeatIdx);
    rafRef.current = requestAnimationFrame(tick);
  }, [speed, totalDuration, song.tempo, song.timeSignature]);

  useEffect(() => {
    if (isPlaying) {
      startWallRef.current = performance.now();
      startSongRef.current = currentTime;
      if (mp3Ref.current) {
        mp3Ref.current.currentTime = currentTime;
        mp3Ref.current.playbackRate = speed;
        mp3Ref.current.volume = volume;
        mp3Ref.current.play();
      }
      startMetronomeScheduler(currentTime);
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
      stopMetronomeScheduler();
      mp3Ref.current?.pause();
    }
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, speed]);

  useEffect(() => {
    if (mp3Ref.current) { mp3Ref.current.volume = volume; mp3Ref.current.playbackRate = speed; }
  }, [volume, speed]);

  const seekTo = useCallback((t: number) => {
    const c = Math.max(0, Math.min(t, displayDuration));
    setCurrentTime(c);
    startSongRef.current = c;
    startWallRef.current = performance.now();
    if (mp3Ref.current) mp3Ref.current.currentTime = c;
  }, [displayDuration]);

  // ── Load mp3 ──
  const handleMp3Load = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsPlaying(false);
    const url = URL.createObjectURL(file);
    if (mp3Ref.current) { mp3Ref.current.pause(); URL.revokeObjectURL(mp3Ref.current.src); }
    const audio = new Audio(url);
    audio.volume = volume;
    audio.addEventListener('loadedmetadata', () => setMp3Duration(audio.duration));
    mp3Ref.current = audio;
    setMp3FileName(file.name);
    setCurrentTime(0);

    // Decode cho waveform
    const arrBuf = await file.arrayBuffer();
    const audioCtx = new AudioContext();
    const decoded = await audioCtx.decodeAudioData(arrBuf);
    setAudioBuffer(decoded);
    e.target.value = '';
  };

  // ── Progress bar ──
  const handleProgressPtr = (e: React.PointerEvent<HTMLDivElement>, isDown: boolean) => {
    if (isDown) { e.currentTarget.setPointerCapture(e.pointerId); setIsSeeking(true); }
    if (!isSeeking && !isDown) return;
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return;
    seekTo(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * displayDuration);
  };

  const progressFrac = displayDuration > 0 ? Math.min(1, currentTime / displayDuration) : 0;

  // ── Keyboard ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); setIsPlaying(p => !p); }
      if (e.code === 'ArrowLeft') { e.preventDefault(); seekTo(currentTime - 5); }
      if (e.code === 'ArrowRight') { e.preventDefault(); seekTo(currentTime + 5); }
      if (e.code === 'Escape') { if (fullscreen) setFullscreen(false); else onClose(); }
      if (e.code === 'KeyF') setFullscreen(f => !f);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentTime, seekTo, onClose]);

  // Sync YouTube khi play/pause/seek
  useEffect(() => {
    if (!showYoutube || !ytReadyRef.current) return
    if (isPlaying) {
      ytSeek(currentTime)
      ytPlay()
    } else {
      ytPause()
    }
  }, [isPlaying])

  const handleCalibChange = (c: Calib) => {
    setCalib(c);
    saveCalib(c);
  };

  const speeds = [0.5, 0.75, 1, 1.25];
  const hasMp3 = !!mp3FileName;

  return (
    <div className="player-overlay">
      <div className={`player-panel ${fullscreen ? "player-panel--fullscreen" : ""}`}>

        {/* Header */}
        <div className="player-header">
          <div className="player-song-info">
            {editingTitle ? (
              <input
                className="player-title-input"
                value={localTitle}
                onChange={e => setLocalTitle(e.target.value)}
                onBlur={() => { setEditingTitle(false); onUpdateTitle?.(localTitle); }}
                onKeyDown={e => { if (e.key === 'Enter') { setEditingTitle(false); onUpdateTitle?.(localTitle); } }}
                autoFocus
              />
            ) : (
              <span className="player-title" onClick={() => setEditingTitle(true)} title="Click để đổi tên">
                {localTitle || song.artist || 'Nhập tên bài...'}
              </span>
            )}
            {song.artist && <span className="player-artist">— {song.artist}</span>}
            <span className="player-meta-chip">{song.tone}</span>
            <span className="player-meta-chip">{song.tempo} BPM</span>
            <span className="player-meta-chip">{song.timeSignature}/4</span>
          </div>
          <div className="player-header-actions">
            <button
              className={`btn ${muteMetronome ? "" : "primary"}`}
              onClick={() => setMuteMetronome(m => !m)}
              title={muteMetronome ? "Bật metronome" : "Tắt metronome"}
            >
              {muteMetronome ? "🔇" : "🥁"}
            </button>
            <input ref={mp3InputRef} type="file" accept="audio/*,video/mp4,audio/mp4,audio/x-m4a,.mp4,.m4a,.mp3,.wav,.aac" style={{ display: 'none' }} onChange={handleMp3Load} />
            <button className="btn" onClick={() => mp3InputRef.current?.click()}>
              🎵 {mp3FileName ? mp3FileName.slice(0, 18) + (mp3FileName.length > 18 ? '…' : '') : 'Tải MP3'}
            </button>
            {hasMp3 && (
              <button
                className={`btn ${showSync ? 'primary' : ''}`}
                onClick={() => setShowSync(s => !s)}
              >
                🎛 {showSync ? 'Ẩn căn nhịp' : 'Căn nhịp'}
                {calib && !showSync && <span className="calib-ok-dot">✓</span>}
              </button>
            )}
            {calib && (
              <span className="calib-info-badge">
                Offset {calib.offset.toFixed(2)}s
              </span>
            )}
            {(song as any).youtubeUrl && (
              <button
                className={`btn ${showYoutube ? 'primary' : ''}`}
                onClick={() => setShowYoutube(v => !v)}
                title="Xem/ẩn video YouTube"
              >
                ▶ {showYoutube ? 'Ẩn YouTube' : 'YouTube'}
              </button>
            )}
            <button
              className={`btn ${fullscreen ? 'primary' : ''}`}
              onClick={() => setFullscreen(f => !f)}
              title="Fullscreen (F)"
            >
              {fullscreen ? '⛶ Thoát' : '⛶ Chiếu'}
            </button>
            <button className="btn" onClick={onClose} title="Đóng (Esc)">✕ Đóng</button>
            <button className="btn" onClick={() => setShowSongList(true)} title="Danh sách bài">
              🎵 Chọn bài
            </button>
            {/* Import bài hát */}
            <label className="btn" style={{ cursor: 'pointer' }} title="Mở file bài hát">
              📂 Bài hát
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => {
                  try {
                    const s = JSON.parse(ev.target?.result as string)
                    if (onImportSong) onImportSong(s)
                  } catch {}
                }
                reader.readAsText(file)
              }} />
            </label>
            {extraActions}
          {/* ── Mode selector ── */}
          <div style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 0 0' }}>
            <button
              onClick={() => setPlayMode('metro')}
              style={{
                flex:1, display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
                borderRadius:10, cursor:'pointer',
                border: playMode==='metro' ? '1.5px solid #1B4332' : '1px solid rgba(255,255,255,0.12)',
                background: playMode==='metro' ? '#1B4332' : 'rgba(255,255,255,0.06)',
                color: playMode==='metro' ? '#fff' : 'rgba(255,255,255,0.6)',
                transition:'all 0.15s',
              }}>
              🎵
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:12, fontWeight:600 }}>Máy đập nhịp</div>
                <div style={{ fontSize:10, opacity:0.7 }}>Mặc định</div>
              </div>
              {playMode==='metro' && <span style={{ marginLeft:'auto', fontSize:10, background:'rgba(255,255,255,0.2)', padding:'2px 8px', borderRadius:20 }}>✓</span>}
            </button>
            <button
              onClick={() => setPlayMode('yt')}
              style={{
                flex:1, display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
                borderRadius:10, cursor:'pointer',
                border: playMode==='yt' ? '1.5px solid #D89B22' : '1px solid rgba(255,255,255,0.12)',
                background: playMode==='yt' ? 'rgba(216,155,34,0.2)' : 'rgba(255,255,255,0.06)',
                color: playMode==='yt' ? '#F5C842' : 'rgba(255,255,255,0.6)',
                transition:'all 0.15s',
              }}>
              ▶
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:12, fontWeight:600 }}>Theo YouTube</div>
                <div style={{ fontSize:10, opacity:0.7 }}>Nhạc thật</div>
              </div>
              {playMode==='yt' && <span style={{ marginLeft:'auto', fontSize:10, background:'rgba(216,155,34,0.3)', padding:'2px 8px', borderRadius:20 }}>✓</span>}
            </button>
          </div>
          {playMode==='yt' && !(song as any).youtubeUrl && (
            <div style={{ margin:'6px 0 0', background:'rgba(237,184,52,0.1)', border:'1px solid rgba(237,184,52,0.3)', borderRadius:8, padding:'7px 12px', fontSize:11, color:'#F5C842', display:'flex', alignItems:'center', gap:6 }}>
              ⚠ Bài này chưa có YouTube sync — vào trang <strong>Sync</strong> để đồng bộ trước.
            </div>
          )}
          </div>
        </div>

        {/* Waveform sync — ẩn/hiện */}
        {showSync && hasMp3 && (
          <WaveformSync
            audioBuffer={audioBuffer}
            duration={mp3Duration || totalDuration}
            calib={calib}
            onCalibChange={handleCalibChange}
            currentTime={currentTime}
            song={song}
          />
        )}

        {/* Playback controls */}
        <div className="player-controls">
          <div className="player-transport">
            <button className="pb-btn" onClick={() => { seekTo(0); setIsPlaying(false); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="19,20 9,12 19,4" /><line x1="5" y1="4" x2="5" y2="20" />
              </svg>
            </button>
            <button className="pb-btn" onClick={() => seekTo(currentTime - 5)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="11,17 6,12 11,7" /><polyline points="18,17 13,12 18,7" />
              </svg>
              <span className="pb-btn-label">5s</span>
            </button>
            <button className="pb-btn pb-btn--play" onClick={() => setIsPlaying(p => !p)}>
              {isPlaying
                ? <svg viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                : <svg viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
              }
            </button>
            <button className="pb-btn" onClick={() => seekTo(currentTime + 5)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13,17 18,12 13,7" /><polyline points="6,17 11,12 6,7" />
              </svg>
              <span className="pb-btn-label">5s</span>
            </button>
          </div>

          <div className="player-progress-group">
            <span className="pb-time">{fmtTime(currentTime)}</span>
            <div
              className="pb-progress-bar"
              ref={progressRef}
              onPointerDown={e => handleProgressPtr(e, true)}
              onPointerMove={e => handleProgressPtr(e, false)}
              onPointerUp={() => setIsSeeking(false)}
            >
              <div className="pb-progress-fill" style={{ width: `${progressFrac * 100}%` }} />
              <div className="pb-progress-thumb" style={{ left: `${progressFrac * 100}%` }} />
            </div>
            <span className="pb-time">{fmtTime(displayDuration)}</span>
          </div>

          <div className="player-right-controls">
            {hasMp3 && (
              <div className="pb-volume">
                <span style={{ fontSize: 12 }}>🔈</span>
                <input type="range" className="pb-vol-slider" min={0} max={1} step={0.01}
                  value={volume} onChange={e => setVolume(parseFloat(e.target.value))} />
                <span style={{ fontSize: 12 }}>🔊</span>
              </div>
            )}
            <div className="pb-speeds">
              {speeds.map(s => (
                <button key={s} className={`pb-speed-btn ${speed === s ? 'active' : ''}`}
                  onClick={() => { const wp = isPlaying; setIsPlaying(false); setSpeed(s); if (wp) setTimeout(() => setIsPlaying(true), 30); }}>
                  {s === 1 ? '100%' : s === 0.5 ? '50%' : s === 0.75 ? '75%' : '125%'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Spacer đẩy nội dung xuống 25vh */}
        <div className="player-scroll-spacer" />

        {/* Mũi tên chỉ vị trí hiện tại */}
        <div className="now-arrow-wrap">
          <div className="now-arrow" style={{ left: "30%" }} />
        </div>

        {/* ── BEAT SCROLL AREA (hàng trên — nhịp + phách) ── */}
        <div className="player-scroll-area player-scroll-area--beat" ref={beatScrollRef}>
          <div className="scroll-now-line scroll-now-line--beat" style={{ left: beatNowLineX }} />
          <div
            className="player-scroll-track"
            style={{ width: displayDuration * effectivePps + beatContainerW, transform: `translateX(${-scrollOffset}px)` }}
          >
            {/* Mỗi phách = 1 ô */}
            {Array.from({ length: song.totalBars * song.timeSignature }, (_, i) => {
              const beatInBar = i % song.timeSignature;
              const mp3BeatTime = effTime(i * beatDur);
              const mp3NextBeat = effTime((i + 1) * beatDur);
              const w = (mp3NextBeat - mp3BeatTime) * effectivePps;
              // tâm số phách = đúng vị trí thời điểm phách
              const xBeat = beatNowLineX + mp3BeatTime * effectivePps;
              const isCurrentBeat = activeBeatIdx === i;
              const isPast = activeBeatIdx > i;
              const isBar1 = beatInBar === 0;
              const barNum = Math.floor(i / song.timeSignature) + 1;

              return (
                <div
                  key={`beat-${i}`}
                  className={`tl-beat-cell
                    ${isBar1 ? 'tl-beat-cell--bar1' : ''}
                    ${isCurrentBeat ? 'tl-beat-cell--active' : ''}
                    ${isPast ? 'tl-beat-cell--past' : ''}
                  `}
                  style={{ left: xBeat, width: w - 2, transform: 'translateX(-50%)' }}
                >
                  {isBar1 && <span className="tl-bar-num">M{barNum}</span>}
                  <span className="tl-beat-num">{beatInBar + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* ── LYRIC SCROLL AREA (hàng dưới — lời + chord) ── */}
        <div className="player-scroll-area player-scroll-area--lyric" ref={scrollRef}>
          <div className="scroll-now-line" style={{ left: "30%" }} />
          <div
            className="player-scroll-track"
            style={{ width: trackWidth, transform: `translateX(${-scrollOffset}px)` }}
          >
            {/* Chord — vẽ độc lập tại đúng vị trí time của chord */}
            {(() => {
              const sortedChords = [...(song.chords ?? [])].sort((a, b) => a.time - b.time);
              return sortedChords.map((c, ci) => {
              const cx = nowLineX + effTime(c.time) * effectivePps;
              const nextChordTime = ci + 1 < sortedChords.length
                ? effTime(sortedChords[ci + 1].time)
                : effTime(c.time) + barDur * 4;
              const chordActive = currentTimeRef.current >= effTime(c.time) &&
                currentTimeRef.current < nextChordTime;
              return (
                <div key={c.id} className="scroll-lyric-group" style={{ left: cx }}>
                  <div className={`tl-chord ${chordActive ? 'active' : ''}`}>
                    {c.name}
                  </div>
                </div>
              );
              });
            })()}

            {/* Lyric — vẽ độc lập tại đúng vị trí time của lyric */}
            {(song.lyrics ?? []).map((l, i) => {
              const lx = nowLineX + effTime(l.time) * effectivePps;
              const nextTime = (song.lyrics ?? [])[i + 1]
                ? effTime(song.lyrics[i + 1].time)
                : effTime(l.time) + beatDur * 2;
              const isActive = currentTimeRef.current >= effTime(l.time) && currentTimeRef.current < nextTime;
              const beatIndex = l.time / beatDur;
              const isOnBeat = Math.abs(beatIndex - Math.round(beatIndex)) < 0.05;
              return (
                <div key={l.id} className="tl-lyric-wrap" style={{ left: lx, position: 'absolute', top: '35%', transform: 'translateX(-50%)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                  <div className={`tl-lyric ${isActive ? 'active' : ''} ${isOnBeat ? '' : 'tl-lyric--offbeat'}`} style={{ color: isActive ? '#10B981' : '#E2E8F0', fontSize: isActive ? '22px' : '20px', fontWeight: isActive ? 800 : 700 }}>
                    {l.text}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Mũi tên ▲ sát chân lời */}
          <div className="now-arrow--up" style={{ left: '30%', position: 'absolute', top: 'calc(50% + 18px)', transform: 'translateX(-50%)', zIndex: 20 }} />
        </div>

      {/* YouTube player */}
      {showYoutube && (song as any).youtubeUrl && (
        <div style={{ padding:'8px 16px', background:'#0A0E1A', borderTop:'1px solid #1E2533' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ fontSize:11, color:'#6B7280' }}>
              ▶ YouTube · Offset: {((song as any).youtubeOffset ?? 0).toFixed(1)}s
            </span>
            <button
              style={{ fontSize:10, padding:'2px 8px', borderRadius:4, border:'1px solid #374151', background:'none', color:'#9CA3AF', cursor:'pointer' }}
              onClick={() => ytSeek(currentTime)}
            >Sync ngay</button>
          </div>
          <div id="yt-player-frame" style={{ width:'100%', aspectRatio:'16/9', maxHeight:240, borderRadius:8, overflow:'hidden' }} />
        </div>
      )}

        {/* Hint */}

        {/* ── Ghi lại buổi tập ── */}
        <div style={{ padding:'12px 16px 4px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <span style={{ fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.3)' }}>Ghi lại buổi tập</span>
            <span style={{ fontSize:9, background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.4)', padding:'2px 8px', borderRadius:20, display:'flex', alignItems:'center', gap:4 }}>
              🔒 Lớp Hành Trình
            </span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {[['🎙', 'Ghi âm', 'Thu buổi chơi'], ['📹', 'Quay video', 'Quay lại để xem'], ['📤', 'Nộp bài', 'Gửi thầy chấm']].map(([icon, title, sub]) => (
              <button key={title} disabled style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'10px 8px', display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'not-allowed', opacity:0.5 }}>
                <span style={{ fontSize:18 }}>{icon}</span>
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:500 }}>{title}</span>
                <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)' }}>{sub}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)', textAlign:'center', padding:'8px 0 4px' }}>Mở khoá khi hoàn thành Lớp Hành Trình</div>
        </div>
        <div className="player-hint">
          {!hasMp3
            ? 'Tải MP3 để phát nhạc thật · Space = Play/Pause · ← → = ±5s · Esc = Đóng'
            : calib
              ? `${mp3FileName} · Đã căn · Space = Play/Pause · ← → = ±5s`
              : `${mp3FileName} · Nhấn "Căn nhịp" để đồng bộ lời với nhạc`
          }
        </div>
      {showSongList && (
        <SongList
          onSelect={(s: RhythmSong) => { if (onImportSong) onImportSong(s); }}
          onClose={() => setShowSongList(false)}
        />
      )}
      </div>
    </div>
  );
}