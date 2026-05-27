import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from './supabase';
import { SongList } from './SongList';
import type { RhythmSong } from './types';

interface LyricEvent { id: string; time: number; text: string }
interface ChordEvent { id: string; time: number; name: string }
interface TimingJSON {
  title: string; artist?: string; tone?: string; tempo?: number;
  timeSignature?: number; totalBars?: number; duration?: number;
  lyrics: LyricEvent[]; chords: ChordEvent[];
}

function extractVideoId(url: string): string | null {
  const ps = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of ps) { const m = url.match(p); if (m) return m[1]; }
  return null;
}
function buildEmbedUrl(id: string) {
  return `https://www.youtube.com/embed/${id}?${new URLSearchParams({enablejsapi:'1',controls:'1',rel:'0',modestbranding:'1'})}`;
}
function fmt(s: number) { return `${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,'0')}`; }
function fmtShort(s: number) { return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`; }
function post(iframe: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  iframe?.contentWindow?.postMessage(JSON.stringify({event:'command',func,args}),'*');
}

const C = {
  pageBg:'#F5F1E8', surface:'#FFFFFF', surface2:'#F0E7D8', goldSoft:'#F3E3B5',
  header:'#123524', green:'#1B4332', greenSoft:'#2D5A45', greenTint:'#EEF5F0',
  wood:'#8A5A32', woodLight:'#B07A45', gold:'#C6A15B', goldStrong:'#D89B22',
  text:'#1F2933', textSub:'#5F6B62', textDim:'#9BA89C',
  border:'#E5DED2', borderMid:'#D4C9B8', red:'#B83A2F', teal:'#1B7A6E',
};

function SectionHeader({ n, title }: { n: string; title: string }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
      <span style={{width:20,height:20,borderRadius:'50%',background:C.green,color:'#fff',fontSize:9,fontWeight:700,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>{n}</span>
      <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:C.textSub}}>{title}</span>
    </div>
  );
}

const card: React.CSSProperties = {background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'24px 28px',boxShadow:'0 1px 4px rgba(31,41,51,0.06)',marginBottom:16};
const inp: React.CSSProperties = {background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:'9px 13px',fontSize:13,color:C.text,fontFamily:'inherit',outline:'none'};
const btnSolid = (bg: string, fg = '#fff'): React.CSSProperties => ({background:bg,border:'none',borderRadius:8,color:fg,fontSize:13,fontWeight:600,padding:'10px 20px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:7,transition:'opacity 0.15s'});
const btnOutline: React.CSSProperties = {background:'transparent',border:`1px solid ${C.borderMid}`,borderRadius:8,color:C.textSub,fontSize:12,fontWeight:500,padding:'7px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:5};
const tagStyle: React.CSSProperties = {background:C.surface2,border:`1px solid ${C.border}`,borderRadius:5,padding:'3px 10px',fontSize:11,color:C.textSub};

const MOCK: TimingJSON = {
  title:'Demo Song',tempo:80,duration:60,
  lyrics:[{id:'l1',time:0,text:'Thành'},{id:'l2',time:0.5,text:'phố'},{id:'l3',time:1,text:'nào'},{id:'l4',time:2,text:'đó'}],
  chords:[{id:'c1',time:0,name:'Am'},{id:'c2',time:2,name:'C'},{id:'c3',time:4,name:'G'}],
};

function Waveform({ width, dur, jt }: { width: number; dur: number; jt: number }) {
  const bars = Math.floor(width / 3);
  const pct = dur > 0 ? jt / dur : 0;
  return (
    <div style={{display:'flex',alignItems:'center',gap:1,height:36,overflow:'hidden'}}>
      {Array.from({length:bars},(_,i) => {
        const h = 6 + Math.abs(Math.sin(i*0.4+Math.cos(i*0.15)*2)*14) + Math.abs(Math.sin(i*1.3)*5);
        return <div key={i} style={{width:2,flexShrink:0,borderRadius:1,height:`${Math.min(36,Math.max(4,h))}px`,background:i/bars<pct?C.gold:C.border,opacity:i/bars<pct?0.85:0.55}}/>;
      })}
    </div>
  );
}

export default function YouTubeSyncPage() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoId, setVideoId]       = useState<string|null>(null);
  const [urlError, setUrlError]     = useState('');
  const [jsonData, setJsonData]     = useState<TimingJSON|null>(null);
  const [jsonFileName, setJsonFileName] = useState('');
  const [jsonParseError, setJsonParseError] = useState('');
  const [jt, setJt]                 = useState(0);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [ytTime, setYtTime]         = useState(0);
  const [exportOk, setExportOk]     = useState(false);
  const [barNum, setBarNum]         = useState(1);
  const [barResult, setBarResult]   = useState<{bar:number;yt:number;bt:number}|null>(null);
  const [tapBpm, setTapBpm]         = useState<number|null>(null);
  const [tapCount, setTapCount]     = useState(0);
  const [tapScale, setTapScale]     = useState<number|null>(null);

  // Song selector
  const [showSongList, setShowSongList] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState<string|null>(null);
  const [userRole, setUserRole]     = useState<string|null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle');

  const iframeRef    = useRef<HTMLIFrameElement|null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval>|null>(null);
  const isPlayRef    = useRef(false);
  const offsetRef    = useRef(0);
  const durRef       = useRef(60);
  const ytRef        = useRef(0);
  const activeBarRef = useRef<HTMLButtonElement|null>(null);
  const tapTimesRef  = useRef<number[]>([]);
  const tapTORef     = useRef<ReturnType<typeof setTimeout>|null>(null);
  const timelineRef  = useRef<HTMLDivElement|null>(null);

  const getDur = (d: TimingJSON) => {
    const all = [...d.lyrics.map(l=>l.time),...d.chords.map(c=>c.time)];
    return all.length>0 ? Math.max(...all)+5 : 60;
  };
  useEffect(()=>{if(jsonData) durRef.current=jsonData.duration??getDur(jsonData);},[jsonData]);

  // Fetch user role
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(!session?.user) return;
      supabase.from('app_users').select('role').eq('id',session.user.id).single()
        .then(({data})=>{if(data?.role) setUserRole(data.role);});
    });
  },[]);

  const startTimer = useCallback((from: number) => {
    if(timerRef.current) clearInterval(timerRef.current);
    const t0 = performance.now();
    timerRef.current = setInterval(()=>{
      const cur = from+(performance.now()-t0)/1000;
      if(cur>=durRef.current){
        setJt(durRef.current);setIsPlaying(false);isPlayRef.current=false;
        post(iframeRef.current,'pauseVideo');
        clearInterval(timerRef.current!);timerRef.current=null;return;
      }
      setJt(cur);
    },50);
  },[]);

  const stopTimer = useCallback(()=>{
    if(timerRef.current){clearInterval(timerRef.current);timerRef.current=null;}
  },[]);

  // Khi chọn bài từ SongList
  const onSelectSong = useCallback((song: RhythmSong) => {
    const sd = song as unknown as Record<string, unknown>;
    setJsonData({
      title: song.title,
      artist: song.artist,
      tone: song.tone,
      tempo: song.tempo,
      timeSignature: song.timeSignature,
      totalBars: song.totalBars,
      duration: sd.duration as number|undefined,
      lyrics: song.lyrics as LyricEvent[],
      chords: song.chords as ChordEvent[],
    });
    setSelectedTitle(song.title);
    setJsonFileName(song.title + '.json');
    setShowSongList(false);
    setJt(0); stopTimer(); setIsPlaying(false); isPlayRef.current=false;

    // Tự load video + offset nếu đã lưu sẵn
    const savedUrl = sd.youtubeUrl as string|undefined;
    const savedOffset = (sd.youtubeOffset ?? sd.youtube_offset) as number|undefined;
    if (savedOffset != null) offsetRef.current = savedOffset;
    if (savedUrl) {
      const id = extractVideoId(savedUrl);
      if (id) {
        setYoutubeUrl(savedUrl);
        setVideoId(id);
        setPlayerReady(false);
        setTimeout(()=>iframeRef.current?.contentWindow?.postMessage(JSON.stringify({event:'listening'}),'*'),1500);
      }
    }
  },[]);  // stopTimer is stable, no deps needed

  const startTimer = useCallback((from: number) => {
    if(timerRef.current) clearInterval(timerRef.current);
    const t0 = performance.now();
    timerRef.current = setInterval(()=>{
      const cur = from+(performance.now()-t0)/1000;
      if(cur>=durRef.current){
        setJt(durRef.current);setIsPlaying(false);isPlayRef.current=false;
        post(iframeRef.current,'pauseVideo');
        clearInterval(timerRef.current!);timerRef.current=null;return;
      }
      setJt(cur);
    },50);
  },[]);

  const stopTimer = useCallback(()=>{
    if(timerRef.current){clearInterval(timerRef.current);timerRef.current=null;}
  },[]);

  useEffect(()=>{
    const h=(ev:MessageEvent)=>{
      if(!ev.origin.includes('youtube')) return;
      let d:Record<string,unknown>;
      try{d=typeof ev.data==='string'?JSON.parse(ev.data):ev.data;}catch{return;}
      if(d.event==='onReady') setPlayerReady(true);
      if(d.event==='infoDelivery'){
        const info=d.info as Record<string,unknown>;
        if(typeof info?.currentTime==='number'){ytRef.current=info.currentTime;setYtTime(info.currentTime);}
      }
    };
    window.addEventListener('message',h);
    return()=>window.removeEventListener('message',h);
  },[]);

  useEffect(()=>{
    const el=timelineRef.current;if(!el||!isPlaying) return;
    const PPS=Math.max(12,1000/durRef.current);
    el.scrollLeft=Math.max(0,jt*PPS-el.clientWidth/2);
  },[jt,isPlaying]);

  useEffect(()=>{
    if(!activeBarRef.current||!isPlaying) return;
    const el=activeBarRef.current;
    el.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});
    el.classList.remove('ba');void el.offsetWidth;el.classList.add('ba');
  },[isPlaying,Math.floor(jt*2)]);

  const barGrid = useMemo(()=>{
    if(!jsonData?.tempo) return null;
    const bpb=jsonData.timeSignature??4,spb=60/jsonData.tempo;
    const dur=jsonData.duration??getDur(jsonData);
    const total=jsonData.totalBars??Math.ceil(dur/(bpb*spb));
    const tol=spb*0.5;
    return Array.from({length:total},(_,i)=>{
      const idx=i+1,t1=i*bpb*spb;
      return{idx,t1,lyric:jsonData.lyrics.find(l=>Math.abs(l.time-t1)<=tol)??null};
    });
  },[jsonData]);

  const loadVideo=()=>{
    setUrlError('');
    const id=extractVideoId(youtubeUrl.trim());
    if(!id){setUrlError('URL không hợp lệ');return;}
    setVideoId(id);setPlayerReady(false);setIsPlaying(false);
    isPlayRef.current=false;setJt(0);ytRef.current=0;stopTimer();
  };

  const uploadJson=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file) return;
    setJsonParseError('');
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const d=JSON.parse(ev.target?.result as string);
        setJsonData(d);setJsonFileName(file.name);setSelectedTitle(null);
      }catch{setJsonParseError('File JSON không hợp lệ');}
    };
    r.readAsText(file);e.target.value='';
  };

  const play=()=>{
    if(!playerReady||!jsonData) return;
    post(iframeRef.current,'seekTo',[jt+offsetRef.current,true]);
    post(iframeRef.current,'playVideo');
    setIsPlaying(true);isPlayRef.current=true;startTimer(jt);
  };
  const pause=()=>{post(iframeRef.current,'pauseVideo');setIsPlaying(false);isPlayRef.current=false;stopTimer();};
  const seekTo=(v:number)=>{setJt(v);post(iframeRef.current,'seekTo',[v+offsetRef.current,true]);if(isPlayRef.current) startTimer(v);};

  const getBarT=useCallback((n:number)=>{
    if(!jsonData?.tempo) return null;
    return(n-1)*(jsonData.timeSignature??4)*(60/jsonData.tempo);
  },[jsonData]);

  const markBar=useCallback(()=>{
    if(!playerReady) return;
    const yt=ytRef.current,bt=getBarT(barNum);
    if(bt===null) return;
    offsetRef.current=Math.round((yt-bt)*1000)/1000;
    setBarResult({bar:barNum,yt,bt});
  },[playerReady,barNum,getBarT]);

  const tap=useCallback(()=>{
    const now=performance.now();
    if(tapTimesRef.current.length>0&&now-tapTimesRef.current.at(-1)!>3000) tapTimesRef.current=[];
    tapTimesRef.current.push(now);
    setTapCount(tapTimesRef.current.length);
    if(tapTimesRef.current.length>=2){
      const avg=tapTimesRef.current.slice(1).map((v,i)=>v-tapTimesRef.current[i]).reduce((a,b)=>a+b,0)/(tapTimesRef.current.length-1);
      const bpm=Math.round(60000/avg);setTapBpm(bpm);
      if(jsonData?.tempo) setTapScale(Math.round((jsonData.tempo/bpm)*10000)/10000);
    }
    if(tapTORef.current) clearTimeout(tapTORef.current);
    tapTORef.current=setTimeout(()=>{tapTimesRef.current=[];setTapCount(0);setTapBpm(null);setTapScale(null);},3000);
  },[jsonData]);

  const applyScale=()=>{
    if(!jsonData||tapScale===null||tapBpm===null) return;
    const r=tapScale;
    setJsonData({...jsonData,tempo:tapBpm,
      lyrics:jsonData.lyrics.map(l=>({...l,time:+(l.time*r).toFixed(4)})),
      chords:jsonData.chords.map(c=>({...c,time:+(c.time*r).toFixed(4)})),
      duration:jsonData.duration?+(jsonData.duration*r).toFixed(4):undefined,
    });
    setJt(p=>+(p*r).toFixed(4));
    tapTimesRef.current=[];setTapCount(0);setTapBpm(null);setTapScale(null);
  };

  const exportJson=()=>{
    if(!jsonData) return;
    const url=URL.createObjectURL(new Blob([JSON.stringify({...jsonData},null,2)],{type:'application/json'}));
    Object.assign(document.createElement('a'),{href:url,download:`${jsonFileName.replace('.json','')||'timing'}_synced.json`}).click();
    URL.revokeObjectURL(url);
    setExportOk(true);setTimeout(()=>setExportOk(false),2500);
  };

  const saveToSystem=async()=>{
    if(!jsonData||!selectedTitle) return;
    const ok=window.confirm(`Ghi đè "${jsonData.title}" lên hệ thống?\n\nDữ liệu cũ sẽ bị thay thế.`);
    if(!ok) return;
    setSaveStatus('saving');
    // Tìm bài theo title để lấy id
    const{data:rows}=await supabase.from('timming_songs').select('id,song_data').eq('title',selectedTitle).single();
    if(!rows){setSaveStatus('error');setTimeout(()=>setSaveStatus('idle'),3000);return;}
    const sd={...(rows.song_data as Record<string,unknown>??{}),
      title:jsonData.title,artist:jsonData.artist,tone:jsonData.tone,
      tempo:jsonData.tempo,timeSignature:jsonData.timeSignature,
      totalBars:jsonData.totalBars,duration:jsonData.duration,
      lyrics:jsonData.lyrics,chords:jsonData.chords,
      youtubeUrl: youtubeUrl||undefined,
      youtubeOffset: offsetRef.current||undefined,
    };
    const{error}=await supabase.from('timming_songs').update({
      title:jsonData.title,artist:jsonData.artist??null,
      tone:jsonData.tone??null,tempo:jsonData.tempo??null,
      time_signature:jsonData.timeSignature??null,
      song_data:sd,youtube_offset:offsetRef.current,
    }).eq('id',rows.id);
    if(error){setSaveStatus('error');setTimeout(()=>setSaveStatus('idle'),3000);}
    else{setSaveStatus('saved');setTimeout(()=>setSaveStatus('idle'),4000);}
  };

  const isTeacher=userRole==='teacher'||userRole==='admin';
  const dur=jsonData?(jsonData.duration??getDur(jsonData)):60;
  const pct=dur>0?jt/dur*100:0;
  const activeChord=jsonData?.chords.filter(c=>c.time<=jt).at(-1);
  const curLyric=jsonData?.lyrics.filter(l=>l.time<=jt).at(-1);
  const liveWords=jsonData?.lyrics.filter(l=>l.time<=jt&&l.time>jt-3)??[];
  const PPS=Math.max(12,1000/Math.max(dur,1));
  const tlW=Math.ceil(dur*PPS);
  const tickEvery=dur<=120?10:30;
  const ticks=Array.from({length:Math.floor(dur/tickEvery)+1},(_,i)=>i*tickEvery);
  const curBarInfo=useMemo(()=>{
    if(!barGrid||!jsonData?.tempo) return null;
    const idx=barGrid.findIndex(b=>b.idx===barGrid.length?jt>=b.t1:jt>=b.t1&&jt<barGrid[b.idx].t1);
    if(idx<0) return null;
    const spb=60/jsonData.tempo;
    return{bar:barGrid[idx].idx,beat:Math.min(Math.floor((jt-barGrid[idx].t1)/spb)+1,jsonData.timeSignature??4)};
  },[barGrid,jt,jsonData]);

  return (
    <div style={{minHeight:'100vh',background:C.pageBg,color:C.text,fontFamily:"'Inter','Segoe UI',sans-serif"}}>

      {/* YT iframe — off-screen nhưng đủ kích thước để API hoạt động */}
      {videoId&&(
        <div style={{position:'fixed',left:'-9999px',top:0,width:320,height:180,pointerEvents:'none'}}>
          <iframe ref={iframeRef} src={buildEmbedUrl(videoId)} width="320" height="180"
            allow="accelerometer; autoplay" title="yt"
            onLoad={()=>setTimeout(()=>iframeRef.current?.contentWindow?.postMessage(JSON.stringify({event:'listening'}),'*'),1000)}/>
        </div>
      )}

      {/* SongList modal */}
      {showSongList&&(
        <SongList
          onSelect={onSelectSong}
          onClose={()=>setShowSongList(false)}
          isTeacher={isTeacher}
        />
      )}

      {/* Header */}
      <header style={{background:C.header,height:52,display:'flex',alignItems:'center',padding:'0 28px',gap:16,boxShadow:'0 2px 8px rgba(0,0,0,0.2)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:28,height:28,background:C.goldStrong,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12,color:'#fff'}}>C#</div>
          <div style={{width:1,height:20,background:'rgba(255,255,255,0.12)'}}/>
          <span style={{fontSize:12,color:'rgba(255,255,255,0.65)'}}>Thầy Văn Anh</span>
        </div>
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:12}}>
          <span style={{fontSize:14,fontWeight:700,color:'#fff'}}>YouTube Sync</span>
          <span style={{fontSize:11,color:'rgba(255,255,255,0.4)',background:'rgba(255,255,255,0.08)',borderRadius:4,padding:'2px 10px'}}>Căn chỉnh timing</span>
          {playerReady&&<span style={{fontSize:10,color:'rgba(255,255,255,0.5)',display:'flex',alignItems:'center',gap:5}}><span style={{width:5,height:5,borderRadius:'50%',background:'#4CAF50',display:'inline-block',animation:'pulse 1s ease-in-out infinite'}}/>Video đã kết nối</span>}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>{window.location.href='/editor';}} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.14)',borderRadius:7,color:'rgba(255,255,255,0.75)',fontSize:12,padding:'5px 12px',cursor:'pointer'}}>← Editor</button>
          <button onClick={()=>{window.location.href='/player';}} style={{background:C.goldStrong,border:'none',borderRadius:7,color:'#fff',fontSize:12,fontWeight:600,padding:'5px 14px',cursor:'pointer'}}>Player →</button>
        </div>
      </header>

      <div style={{maxWidth:1100,margin:'0 auto',padding:'28px 24px 80px'}}>

        {/* ① Chọn bài */}
        <div style={card}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <SectionHeader n="①" title="Chọn bài hát"/>
            <span style={{flex:1}}/>
            {selectedTitle?(
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:13,fontWeight:700,color:C.green}}>♪ {selectedTitle}</span>
                <button onClick={()=>{setSelectedTitle(null);setJsonData(null);setJsonFileName('');offsetRef.current=0;}}
                  style={{...btnOutline,color:C.red,borderColor:C.red+'55',fontSize:12}}>✕ Đổi bài</button>
              </div>
            ):(
              <button onClick={()=>setShowSongList(true)}
                style={{...btnSolid(C.green),padding:'9px 22px',boxShadow:`0 2px 8px ${C.green}44`}}>
                📚 Chọn bài từ hệ thống
              </button>
            )}
          </div>

          {/* URL + JSON upload */}
          <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap',marginTop:selectedTitle?8:0}}>
            <div style={{flex:2,minWidth:280,display:'flex',flexDirection:'column',gap:6}}>
              <label style={{fontSize:10,fontWeight:600,color:C.textDim,letterSpacing:'0.08em',textTransform:'uppercase'}}>YouTube URL</label>
              <div style={{display:'flex',gap:6}}>
                <input style={{...inp,flex:1}} value={youtubeUrl}
                  onChange={e=>{setYoutubeUrl(e.target.value);setUrlError('');}}
                  onKeyDown={e=>e.key==='Enter'&&loadVideo()}
                  placeholder="https://www.youtube.com/watch?v=..."/>
                {!playerReady&&(
                  <button style={{...btnSolid(C.green),padding:'9px 18px',flexShrink:0}} onClick={loadVideo}>Load</button>
                )}
                {playerReady&&(
                  <div style={{display:'flex',alignItems:'center',gap:6,padding:'0 12px',background:C.greenTint,borderRadius:8,border:`1px solid ${C.green}22`,flexShrink:0}}>
                    <span style={{width:7,height:7,borderRadius:'50%',background:C.green,display:'inline-block',animation:'pulse 1s ease-in-out infinite'}}/>
                    <span style={{fontSize:12,color:C.green,fontWeight:600}}>Sẵn sàng</span>
                  </div>
                )}
              </div>
              {urlError&&<div style={{fontSize:11,color:C.red}}>⚠ {urlError}</div>}
            </div>
            {!selectedTitle&&(
              <div style={{flex:1,minWidth:180,display:'flex',flexDirection:'column',gap:6}}>
                <label style={{fontSize:10,fontWeight:600,color:C.textDim,letterSpacing:'0.08em',textTransform:'uppercase'}}>Hoặc upload JSON</label>
                <label style={{cursor:'pointer'}}>
                  <div style={{...inp,display:'flex',alignItems:'center',gap:8,color:jsonFileName?C.text:C.textDim,cursor:'pointer'}}>
                    <span>📄</span>
                    <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{jsonFileName||'Upload timing JSON...'}</span>
                    {jsonFileName&&<span onClick={e=>{e.preventDefault();setJsonData(null);setJsonFileName('');}} style={{cursor:'pointer',color:C.textDim}}>×</span>}
                  </div>
                  <input type="file" accept=".json" onChange={uploadJson} style={{display:'none'}}/>
                </label>
                {jsonParseError&&<div style={{fontSize:11,color:C.red}}>⚠ {jsonParseError}</div>}
              </div>
            )}
            {jsonData?.tempo&&(
              <div style={{display:'flex',alignItems:'center',gap:6,paddingBottom:1}}>
                <div style={{...inp,fontFamily:'monospace',fontSize:18,fontWeight:700,color:C.green,width:64,textAlign:'center',padding:'8px'}}>{jsonData.tempo}</div>
                <span style={{fontSize:11,color:C.textDim}}>BPM</span>
              </div>
            )}
          </div>
        </div>

        {/* ② Preview */}
        {jsonData&&(
          <div style={card}>
            <SectionHeader n="②" title="Preview – Lyrics & Chords"/>
            <div style={{display:'grid',gridTemplateColumns:'55% 45%',gap:24}}>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:C.textDim,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:10}}>Lyrics Preview</div>
                {barGrid?(
                  <div style={{overflowY:'auto',maxHeight:200}}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(52px,1fr))',gap:4}}>
                      {barGrid.map(({idx,t1,lyric})=>{
                        const isAct=jt>=t1&&(idx===barGrid.length||jt<barGrid[idx].t1);
                        const isPast=jt>=t1&&!isAct;
                        return(
                          <button key={idx} ref={isAct?activeBarRef:null} onClick={()=>seekTo(t1)} style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'7px 4px',borderRadius:8,cursor:'pointer',border:isAct?`1.5px solid ${C.goldStrong}`:`1px solid ${C.border}`,background:isAct?C.goldSoft:isPast?'rgba(0,0,0,0.02)':C.pageBg,color:isAct?C.text:isPast?C.borderMid:C.textSub,fontWeight:isAct?700:400,transform:isAct?'scale(1.06)':'scale(1)',boxShadow:isAct?`0 0 0 3px ${C.goldStrong}18`:'none',transition:'all 0.12s'}}>
                            <span style={{fontSize:12,lineHeight:1.3,textAlign:'center',wordBreak:'break-all'}}>{lyric?lyric.text:<span style={{opacity:0.2}}>—</span>}</span>
                            <span style={{fontSize:9,marginTop:2,color:isAct?C.goldStrong:C.borderMid,fontFamily:'monospace'}}>{idx}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ):(
                  <div style={{display:'flex',flexWrap:'wrap',gap:5,maxHeight:180,overflowY:'auto'}}>
                    {jsonData.lyrics.map(l=>{
                      const isAct=curLyric?.id===l.id;
                      return<button key={l.id} onClick={()=>seekTo(l.time)} style={{border:isAct?`1.5px solid ${C.goldStrong}`:`1px solid ${C.border}`,borderRadius:7,padding:'4px 10px',cursor:'pointer',fontSize:12,fontWeight:isAct?600:400,background:isAct?C.goldSoft:C.pageBg,color:isAct?C.text:C.textSub,transition:'all 0.1s'}}>{l.text}</button>;
                    })}
                  </div>
                )}
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:C.textDim,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:10}}>Chord Preview</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(80px,1fr))',gap:5,maxHeight:200,overflowY:'auto'}}>
                  {jsonData.chords.map(c=>{
                    const isAct=activeChord?.id===c.id;
                    const isPast=activeChord&&jsonData.chords.indexOf(c)<jsonData.chords.indexOf(activeChord);
                    return<button key={c.id} onClick={()=>seekTo(c.time)} style={{borderRadius:8,padding:'7px 8px',cursor:'pointer',border:isAct?`1.5px solid ${C.goldStrong}`:`1px solid ${C.border}`,background:isAct?C.goldSoft:isPast?'rgba(0,0,0,0.02)':C.pageBg,color:isAct?C.text:isPast?C.borderMid:C.textSub,display:'flex',flexDirection:'column',alignItems:'flex-start',gap:2,transition:'all 0.12s'}}>
                      <span style={{fontFamily:'monospace',fontSize:15,fontWeight:700}}>{c.name}</span>
                      <span style={{fontSize:9,color:C.textDim,fontFamily:'monospace'}}>{fmtShort(c.time)}</span>
                    </button>;
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ③ Đang hát */}
        {jsonData&&(
          <div style={{...card,background:'linear-gradient(135deg,#FDF6E3 0%,#FBF3E0 50%,#FFF8EC 100%)',border:`1px solid ${C.goldSoft}`,position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',inset:0,opacity:0.04,backgroundImage:'radial-gradient(circle at 20% 50%,#C6A15B 0%,transparent 60%),radial-gradient(circle at 80% 50%,#1B4332 0%,transparent 60%)',pointerEvents:'none'}}/>
            <div style={{position:'relative',display:'grid',gridTemplateColumns:'auto 1fr auto',gap:24,alignItems:'center',minHeight:90}}>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <div style={{display:'flex',alignItems:'center',gap:7}}>
                  <div style={{display:'flex',gap:2}}>{[3,5,4,6,3,5].map((h,i)=><div key={i} style={{width:3,borderRadius:2,background:C.gold,opacity:isPlaying?1:0.3,height:h}}/>)}</div>
                  <span style={{fontSize:11,fontWeight:600,color:C.wood}}>{isPlaying?'Đang phát':'Tạm dừng'}</span>
                </div>
                {curBarInfo&&<span style={{fontSize:11,color:C.textSub}}>Phách {curBarInfo.beat} / Nhịp {curBarInfo.bar}</span>}
                <SectionHeader n="③" title="Đang hát (Live)"/>
              </div>
              <div style={{textAlign:'center',padding:'8px 0'}}>
                <div style={{fontSize:liveWords.length>4?28:36,fontWeight:700,color:C.text,letterSpacing:3,lineHeight:1.2,minHeight:50,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s'}}>
                  {liveWords.length>0?liveWords.map(l=>l.text).join(' ')+'...':<span style={{color:C.borderMid,fontWeight:300,fontSize:22}}>— tải JSON để xem lyrics —</span>}
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                <span style={{fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:C.textSub}}>Hợp âm hiện tại</span>
                <div style={{width:72,height:72,borderRadius:10,border:`2px solid ${activeChord?C.goldStrong:C.border}`,background:activeChord?C.goldSoft:C.surface,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:32,fontWeight:800,fontFamily:'monospace',color:activeChord?C.green:C.borderMid}}>{activeChord?.name??'—'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ④ Timeline */}
        <div style={card}>
          <SectionHeader n="④" title="Timeline — Dòng chảy hợp âm"/>
          <div ref={timelineRef} style={{overflowX:'auto',position:'relative',cursor:'pointer',marginBottom:12}}
            onClick={e=>{const rect=(e.currentTarget as HTMLDivElement).getBoundingClientRect();const sl=(e.currentTarget as HTMLDivElement).scrollLeft;seekTo(Math.max(0,Math.min(dur,(e.clientX-rect.left+sl)/PPS)));}}>
            <div style={{position:'relative',width:tlW,height:100}}>
              {ticks.map(t=>(
                <div key={t} style={{position:'absolute',left:t*PPS,top:0,display:'flex',flexDirection:'column',alignItems:'flex-start',pointerEvents:'none'}}>
                  <span style={{fontSize:9,color:C.textDim,fontFamily:'monospace',whiteSpace:'nowrap'}}>{fmtShort(t)}</span>
                  <div style={{width:1,height:6,background:C.borderMid}}/>
                </div>
              ))}
              {jsonData?.chords.map(c=>{
                const isAct=activeChord?.id===c.id;
                return<div key={c.id} style={{position:'absolute',left:c.time*PPS,top:14,transform:'translateX(-50%)',padding:'3px 8px',borderRadius:5,background:isAct?C.goldStrong:C.surface2,border:`1px solid ${isAct?C.goldStrong:C.border}`,color:isAct?'#fff':C.textSub,fontSize:11,fontWeight:isAct?700:500,fontFamily:'monospace',whiteSpace:'nowrap',pointerEvents:'none',boxShadow:isAct?`0 2px 8px ${C.goldStrong}44`:'none'}}>{c.name}</div>;
              })}
              <div style={{position:'absolute',left:0,top:44,width:'100%',pointerEvents:'none'}}><Waveform width={tlW} dur={dur} jt={jt}/></div>
              <div style={{position:'absolute',left:jt*PPS,top:0,bottom:0,width:2,background:C.green,borderRadius:1,pointerEvents:'none',boxShadow:`0 0 6px ${C.green}66`}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:C.green,position:'absolute',top:0,left:'50%',transform:'translateX(-50%)'}}/>
              </div>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontFamily:'monospace',fontSize:13,fontWeight:600,color:C.green,minWidth:72}}>{fmt(jt)}</span>
            <div style={{flex:1,position:'relative',height:6,background:C.surface2,borderRadius:3,border:`1px solid ${C.border}`,overflow:'visible',cursor:'pointer'}}>
              <div style={{height:'100%',width:`${pct}%`,background:C.green,borderRadius:3,transition:'width 0.05s linear'}}/>
              <div style={{position:'absolute',top:'50%',left:`${pct}%`,transform:'translate(-50%,-50%)',width:14,height:14,borderRadius:'50%',background:C.green,border:`2px solid ${C.surface}`,boxShadow:`0 0 0 2px ${C.green}`,pointerEvents:'none',transition:'left 0.05s linear'}}/>
              <input type="range" min={0} max={dur} step={0.1} value={jt} onChange={e=>seekTo(parseFloat(e.target.value))} style={{position:'absolute',inset:'-4px 0',width:'100%',opacity:0,cursor:'pointer'}}/>
            </div>
            <span style={{fontFamily:'monospace',fontSize:12,color:C.textDim,minWidth:72,textAlign:'right'}}>{fmt(dur)}</span>
          </div>
        </div>

        {/* ⑤ Sync */}
        <div style={card}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0}}>
            {/* Tap Tempo */}
            <div style={{paddingRight:24,borderRight:`1px solid ${C.border}`}}>
              <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:2}}>TAP TEMPO</div>
              <div style={{fontSize:11,color:C.textSub,marginBottom:14}}>Nhập hoặc tap để đo BPM thực tế</div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                <input type="number" min={20} max={300} step={0.5} placeholder="Nhập BPM..." value={tapBpm??''}
                  onChange={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)&&v>0){setTapBpm(Math.round(v));if(jsonData?.tempo)setTapScale(Math.round((jsonData.tempo/v)*10000)/10000);}else{setTapBpm(null);setTapScale(null);}}}
                  style={{...inp,flex:1,fontFamily:'monospace',fontSize:18,fontWeight:700,color:C.wood,textAlign:'center'}}/>
                <span style={{fontSize:12,color:C.textDim,flexShrink:0}}>BPM</span>
              </div>
              <div style={{display:'flex',gap:10,marginBottom:12}}>
                <button onPointerDown={tap} style={{flex:1,border:`2px dashed ${tapCount>0?C.wood:C.border}`,borderRadius:10,background:tapCount>0?'#FAF0E4':C.pageBg,cursor:'pointer',padding:'12px 0',display:'flex',flexDirection:'column',alignItems:'center',gap:3,userSelect:'none',transition:'all 0.1s'}}>
                  <span style={{fontSize:18}}>🥁</span>
                  <span style={{fontSize:10,color:tapCount>0?C.wood:C.textSub,fontWeight:600}}>{tapCount>0?`${tapCount} taps`:'TAP'}</span>
                </button>
                <div style={{flex:1,background:C.pageBg,border:`1px solid ${C.border}`,borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1,padding:'8px'}}>
                  <div style={{fontSize:26,fontWeight:700,fontFamily:'monospace',color:tapBpm?C.wood:C.border,lineHeight:1}}>{tapBpm??'--'}</div>
                  <div style={{fontSize:9,color:C.textDim,letterSpacing:'0.06em'}}>BPM detected</div>
                  {jsonData?.tempo&&<div style={{fontSize:9,color:C.textDim}}>JSON: <span style={{fontFamily:'monospace',color:C.text}}>{jsonData.tempo}</span></div>}
                </div>
              </div>
              {tapBpm&&jsonData?.tempo&&tapScale!==null&&(
                <div style={{background:C.pageBg,borderRadius:7,padding:'8px 12px',marginBottom:10,fontSize:11,fontFamily:'monospace',display:'flex',gap:16}}>
                  <div><span style={{color:C.textDim,fontSize:10}}>Scale ratio</span><br/><span style={{color:C.green,fontWeight:700,fontSize:14}}>×{tapScale.toFixed(4)}</span></div>
                  <div style={{width:1,background:C.border}}/>
                  <div><span style={{color:C.textDim,fontSize:10}}>Sai lệch</span><br/><span style={{color:C.goldStrong,fontWeight:600,fontSize:14}}>{tapBpm>jsonData.tempo?'+':''}{((tapBpm/jsonData.tempo-1)*100).toFixed(1)}%</span></div>
                </div>
              )}
              <div style={{display:'flex',gap:6}}>
                <button onClick={applyScale} disabled={!tapScale||!jsonData?.tempo} style={{...btnSolid(C.wood),flex:1,padding:'9px',opacity:(!tapScale||!jsonData?.tempo)?0.4:1}}>Apply Scale to JSON</button>
                <button onClick={()=>{tapTimesRef.current=[];setTapCount(0);setTapBpm(null);setTapScale(null);}} disabled={tapCount===0} style={{...btnOutline,opacity:tapCount===0?0.4:1}}>↺</button>
              </div>
            </div>

            {/* Mark Beat */}
            <div style={{paddingLeft:24}}>
              <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:2}}>ĐÁNH DẤU PHÁCH</div>
              <div style={{fontSize:11,color:C.textSub,marginBottom:14}}>Tạm dừng video tại phách 1, chọn nhịp → Mark</div>
              {!jsonData?.tempo?(
                <div style={{fontSize:11,color:'#92722A',background:'#FDF5E0',border:'1px solid #EED88A',borderRadius:7,padding:'8px 10px'}}>⚠ Cần JSON có <code>tempo</code></div>
              ):(
                <>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                    <button style={{...btnOutline,padding:'5px 14px',fontSize:18}} onClick={()=>setBarNum(b=>Math.max(1,b-1))}>−</button>
                    <div style={{flex:1,textAlign:'center'}}>
                      <span style={{fontSize:32,fontWeight:700,fontFamily:'monospace',color:C.green}}>{barNum}</span>
                      <span style={{fontSize:11,color:C.textDim,marginLeft:6}}>/ {jsonData.timeSignature??4}</span>
                    </div>
                    <button style={{...btnOutline,padding:'5px 14px',fontSize:18}} onClick={()=>setBarNum(b=>b+1)}>+</button>
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:10}}>
                    {[1,2,3,4,5,8,9,13,17].map(n=>(
                      <button key={n} onClick={()=>setBarNum(n)} style={{...btnOutline,padding:'3px 9px',fontSize:11,fontFamily:'monospace',color:barNum===n?C.green:C.textDim,borderColor:barNum===n?C.green:C.border,background:barNum===n?C.greenTint:'transparent'}}>{n}</button>
                    ))}
                  </div>
                  <div style={{fontSize:10,color:C.textDim,fontFamily:'monospace',textAlign:'right',marginBottom:10}}>beat 1 = {getBarT(barNum)?.toFixed(3)}s</div>
                  <button onPointerDown={markBar} disabled={!playerReady} style={{...btnSolid(C.teal),width:'100%',padding:'13px',fontSize:14,opacity:playerReady?1:0.45,userSelect:'none'}}>
                    ♩ Đánh dấu (Mark)
                  </button>
                  {barResult&&(
                    <div style={{marginTop:10,background:C.pageBg,borderRadius:7,padding:'8px 12px',fontSize:11,fontFamily:'monospace',display:'flex',gap:16,alignItems:'center'}}>
                      <div><span style={{color:C.textDim,fontSize:10}}>Nhịp</span><br/><span style={{color:C.text,fontWeight:700}}>#{barResult.bar}</span></div>
                      <div style={{width:1,background:C.border,alignSelf:'stretch'}}/>
                      <div><span style={{color:C.textDim,fontSize:10}}>YT mark</span><br/><span style={{color:C.red,fontWeight:600}}>{barResult.yt.toFixed(2)}s</span></div>
                      <div style={{width:1,background:C.border,alignSelf:'stretch'}}/>
                      <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:5}}>
                        <span style={{fontSize:16,color:C.goldStrong}}>✓</span>
                        <span style={{color:C.goldStrong,fontWeight:600,fontSize:11}}>Đã sync</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ⑥ Export */}
        <div style={{...card,padding:'20px 28px'}}>
          <SectionHeader n="⑥" title="Export"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{fontSize:11,fontWeight:600,color:C.textSub}}>Xuất file</div>
              <button onClick={exportJson} disabled={!jsonData} style={{...btnSolid(exportOk?'#2A6B3A':C.goldStrong),padding:'13px',fontSize:14,fontWeight:700,opacity:!jsonData?0.45:1,boxShadow:jsonData&&!exportOk?`0 3px 14px ${C.goldStrong}44`:'none'}}>
                {exportOk?'✓ Đã xuất!':'⬇ Export JSON'}
              </button>
              <p style={{fontSize:11,color:C.textSub,margin:0,lineHeight:1.6}}>Tải file JSON về máy.</p>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{fontSize:11,fontWeight:600,color:C.textSub}}>
                Lưu lên hệ thống
                {isTeacher&&<span style={{marginLeft:6,fontSize:10,color:C.green,background:C.greenTint,borderRadius:4,padding:'1px 7px'}}>Giáo viên</span>}
              </div>
              {isTeacher?(
                <>
                  <button onClick={saveToSystem} disabled={!jsonData||!selectedTitle||saveStatus==='saving'}
                    style={{...btnSolid(saveStatus==='saved'?'#2A6B3A':saveStatus==='error'?C.red:'#8A5A32'),padding:'13px',fontSize:14,fontWeight:700,opacity:(!jsonData||!selectedTitle)?0.45:1,boxShadow:(jsonData&&selectedTitle&&saveStatus==='idle')?`0 3px 14px rgba(138,90,50,0.35)`:'none'}}>
                    {saveStatus==='saving'?'⏳ Đang lưu...':saveStatus==='saved'?'✓ Đã lưu!':saveStatus==='error'?'✗ Lỗi':'☁ Ghi đè lên hệ thống'}
                  </button>
                  <p style={{fontSize:11,color:C.textSub,margin:0,lineHeight:1.6}}>
                    {!selectedTitle?'⚠ Chọn bài từ hệ thống ở bước ① trước.':`Ghi đè "${selectedTitle}" — có xác nhận.`}
                  </p>
                </>
              ):(
                <>
                  <button disabled style={{...btnSolid('#9BA89C'),padding:'13px',fontSize:14,opacity:0.5,cursor:'not-allowed'}}>🔒 Chỉ dành cho giáo viên</button>
                  <p style={{fontSize:11,color:C.textSub,margin:0,lineHeight:1.6}}>
                    {!userRole?'Vui lòng đăng nhập.':'Tính năng này chỉ dành cho giáo viên.'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

      </div>{/* end body */}

      {/* ── Sticky Play Bar ── */}
      {jsonData&&(
        <div style={{
          position:'fixed',bottom:0,left:0,right:0,zIndex:100,
          background:C.header,
          borderTop:`1px solid rgba(255,255,255,0.08)`,
          boxShadow:'0 -4px 20px rgba(0,0,0,0.2)',
          padding:'0 24px',
          height:60,
          display:'flex',alignItems:'center',gap:16,
        }}>
          {/* Play/Pause button */}
          <button onClick={isPlaying?pause:play} disabled={!playerReady}
            style={{
              width:40,height:40,borderRadius:'50%',border:'none',
              background:isPlaying?'rgba(255,255,255,0.15)':C.goldStrong,
              color:'#fff',fontSize:18,cursor:'pointer',flexShrink:0,
              display:'flex',alignItems:'center',justifyContent:'center',
              opacity:!playerReady?0.4:1,
              boxShadow:isPlaying?'none':`0 2px 10px ${C.goldStrong}88`,
              transition:'all 0.15s',
            }}>
            {isPlaying?'⏸':'▶'}
          </button>

          {/* Song title + status */}
          <div style={{display:'flex',flexDirection:'column',gap:2,flexShrink:0,minWidth:0,maxWidth:200}}>
            <span style={{fontSize:13,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {selectedTitle||jsonData.title}
            </span>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.45)'}}>
              {!playerReady?'Đang kết nối...':isPlaying?'Đang phát':'Tạm dừng'}
            </span>
          </div>

          {/* Time */}
          <span style={{fontFamily:'monospace',fontSize:13,fontWeight:600,color:C.goldStrong,flexShrink:0}}>
            {fmt(jt)}
          </span>

          {/* Progress bar */}
          <div style={{flex:1,position:'relative',height:4,background:'rgba(255,255,255,0.12)',borderRadius:2,cursor:'pointer'}}>
            <div style={{height:'100%',width:`${pct}%`,background:C.goldStrong,borderRadius:2,transition:'width 0.05s linear'}}/>
            <div style={{position:'absolute',top:'50%',left:`${pct}%`,transform:'translate(-50%,-50%)',width:12,height:12,borderRadius:'50%',background:C.goldStrong,border:'2px solid #fff',pointerEvents:'none',transition:'left 0.05s linear'}}/>
            <input type="range" min={0} max={dur} step={0.1} value={jt}
              onChange={e=>seekTo(parseFloat(e.target.value))}
              style={{position:'absolute',inset:'-8px 0',width:'100%',opacity:0,cursor:'pointer'}}/>
          </div>

          {/* Total time */}
          <span style={{fontFamily:'monospace',fontSize:12,color:'rgba(255,255,255,0.4)',flexShrink:0}}>
            {fmt(dur)}
          </span>

          {/* Seek -5s */}
          <button onClick={()=>seekTo(Math.max(0,jt-5))}
            style={{...btnOutline,border:'1px solid rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.6)',fontSize:11,padding:'5px 10px',flexShrink:0}}>
            ↩ 5s
          </button>

          {/* playerReady indicator */}
          {playerReady&&(
            <div style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'#4CAF50',display:'inline-block',animation:'pulse 1s ease-in-out infinite'}}/>
              <span style={{fontSize:10,color:'rgba(255,255,255,0.45)'}}>YT {fmtShort(ytTime)}</span>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes ba{0%,100%{box-shadow:none}40%{box-shadow:0 0 14px rgba(198,161,91,0.55)}}
        .ba{animation:ba 0.35s ease-out}
        button:active:not(:disabled){transform:scale(0.97);opacity:0.85}
      `}</style>
    </div>
  );
}
