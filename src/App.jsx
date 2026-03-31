import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, Settings, X, Plus, Trash2,
  Volume2, VolumeX, Check, Wind, Waves, CloudRain,
  TreePine, Mountain, Moon, Music2, BellOff
} from "lucide-react";

/* ─── Fonts ──────────────────────────────────────────────────────────────── */
const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:opsz,wght@9..40,200;9..40,300;9..40,400&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html,body,#root{height:100%;width:100%;overflow:hidden}
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}
    input[type=range]{-webkit-appearance:none;appearance:none;height:3px;border-radius:2px;outline:none;cursor:pointer}
    input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,0.85);cursor:pointer}
    ::-webkit-scrollbar{width:4px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:2px}
  `}</style>
);

/* ─── Constants ──────────────────────────────────────────────────────────── */
const ENVIRONMENTS = [
  {
    id:"dark", label:"Minimal Dark", Icon:Moon,
    bg:null,
    overlay:"linear-gradient(135deg,#07070f 0%,#0e0e1a 100%)",
  },
  {
    id:"forest", label:"Forest", Icon:TreePine,
    bg:"https://picsum.photos/id/15/1600/900",
    overlay:"linear-gradient(to bottom,rgba(0,10,5,0.45) 0%,rgba(0,20,10,0.62) 100%)",
  },
  {
    id:"beach", label:"Beach", Icon:Waves,
    bg:"https://picsum.photos/id/199/1600/900",
    overlay:"linear-gradient(to bottom,rgba(0,10,5,0.45) 0%,rgba(0,20,10,0.62) 100%)",
  },
  {
    id:"cow", label:"Highland cow", Icon:TreePine,
    bg:"https://picsum.photos/id/200/1600/900",
    overlay:"linear-gradient(to bottom,rgba(0,10,5,0.45) 0%,rgba(0,20,10,0.62) 100%)",
  },
  {
    id:"lake", label:"Lake", Icon:Waves,
    bg:"https://picsum.photos/id/1011/1600/900",
    overlay:"linear-gradient(to bottom,rgba(0,15,35,0.48) 0%,rgba(0,8,25,0.65) 100%)",
  },
  {
    id:"cafe", label:"Cafe", Icon:Music2,
    bg:"https://picsum.photos/id/1060/1600/900",
    overlay:"linear-gradient(to bottom,rgba(8,8,20,0.52) 0%,rgba(5,5,15,0.68) 100%)",
  },
  {
    id:"mountain", label:"Mountain", Icon:Mountain,
    bg:"https://picsum.photos/id/29/1600/900",
    overlay:"linear-gradient(to bottom,rgba(0,0,0,0.38) 0%,rgba(8,12,28,0.6) 100%)",
  },
];

const PRESET_PATTERNS = [
  { id:"box",   name:"Box Breathing",  inhale:4, holdIn:4, exhale:4, holdOut:4 },
  { id:"478",   name:"4-7-8 Relax",    inhale:4, holdIn:7, exhale:8, holdOut:0 },
  { id:"equal", name:"Equal Breath",   inhale:5, holdIn:0, exhale:5, holdOut:0 },
  { id:"calm",  name:"Calm Down",      inhale:4, holdIn:2, exhale:6, holdOut:0 },
];

const PHASE_ORDER = ["inhale","holdIn","exhale","holdOut"];
const PHASE_LABEL = { inhale:"Inhale", holdIn:"Hold", exhale:"Exhale", holdOut:"Hold" };
const PHASE_FREQ  = { inhale:440, holdIn:330, exhale:220, holdOut:330 };

const AMBIENT_SOUNDS = [
  { id:"ocean",  label:"Ocean Waves", Icon:Waves     },
  { id:"rain",   label:"Rain",        Icon:CloudRain },
  { id:"forest", label:"Forest",      Icon:TreePine  },
  { id:"wind",   label:"Wind",        Icon:Wind      },
];

/* ─── LocalStorage ───────────────────────────────────────────────────────── */
const ls = {
  get:(k,d)=>{ try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch{return d} },
  set:(k,v)=>{ try{localStorage.setItem(k,JSON.stringify(v))}catch{} },
};

/* ─── Audio Engine ───────────────────────────────────────────────────────── */
let _actx = null;
function getCtx() {
  if (!_actx || _actx.state === "closed") _actx = new (window.AudioContext || window.webkitAudioContext)();
  if (_actx.state === "suspended") _actx.resume();
  return _actx;
}

function playTone(freq) {
  try {
    const ctx=getCtx(), osc=ctx.createOscillator(), gain=ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type="sine"; osc.frequency.value=freq;
    gain.gain.setValueAtTime(0,ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1,ctx.currentTime+0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+1.1);
    osc.start(); osc.stop(ctx.currentTime+1.2);
  } catch{}
}

// ── Ambient generators (Web Audio API, no external files) ─────────────────
function makeOceanNoise(ctx) {
  const master = ctx.createGain(); master.gain.value=0; master.connect(ctx.destination);
  const bufSize=ctx.sampleRate*3;
  [0.14,0.22,0.38].forEach((rate,li)=>{
    const buf=ctx.createBuffer(1,bufSize,ctx.sampleRate);
    const d=buf.getChannelData(0); for(let i=0;i<bufSize;i++) d[i]=Math.random()*2-1;
    const src=ctx.createBufferSource(); src.buffer=buf; src.loop=true; src.playbackRate.value=rate;
    const bp=ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=250+li*180; bp.Q.value=0.7;
    const g=ctx.createGain(); g.gain.value=0.3-li*0.05;
    const lfo=ctx.createOscillator(); lfo.frequency.value=0.08+li*0.06;
    const lg=ctx.createGain(); lg.gain.value=0.25;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(); lfo.start();
  });
  return master;
}

function makeRainNoise(ctx) {
  const master=ctx.createGain(); master.gain.value=0; master.connect(ctx.destination);
  const bufSize=ctx.sampleRate*2;
  const buf=ctx.createBuffer(1,bufSize,ctx.sampleRate);
  const d=buf.getChannelData(0); for(let i=0;i<bufSize;i++) d[i]=Math.random()*2-1;
  const src=ctx.createBufferSource(); src.buffer=buf; src.loop=true;
  const hp=ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=2200;
  const lp=ctx.createBiquadFilter(); lp.type="lowpass";  lp.frequency.value=7500;
  const g=ctx.createGain(); g.gain.value=0.85;
  src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(master);
  src.start();
  return master;
}

function makeForestNoise(ctx) {
  const master=ctx.createGain(); master.gain.value=0; master.connect(ctx.destination);
  const bufSize=ctx.sampleRate*4;

  // Crickets layer
  const buf=ctx.createBuffer(1,bufSize,ctx.sampleRate);
  const d=buf.getChannelData(0); for(let i=0;i<bufSize;i++) d[i]=Math.random()*2-1;
  const src=ctx.createBufferSource(); src.buffer=buf; src.loop=true;
  const bp=ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=3500; bp.Q.value=4;
  const g=ctx.createGain(); g.gain.value=0.15;
  src.connect(bp); bp.connect(g); g.connect(master); src.start();

  // Low wind rumble
  const buf2=ctx.createBuffer(1,bufSize,ctx.sampleRate);
  const d2=buf2.getChannelData(0); for(let i=0;i<bufSize;i++) d2[i]=Math.random()*2-1;
  const src2=ctx.createBufferSource(); src2.buffer=buf2; src.loop=true; src2.playbackRate.value=0.25;
  const lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=160;
  const g2=ctx.createGain(); g2.gain.value=0.5;
  const lfo=ctx.createOscillator(); lfo.frequency.value=0.07;
  const lg=ctx.createGain(); lg.gain.value=0.18;
  lfo.connect(lg); lg.connect(g2.gain);
  src2.connect(lp); lp.connect(g2); g2.connect(master); src2.start(); lfo.start();

  return master;
}

function makeWindNoise(ctx) {
  const master=ctx.createGain(); master.gain.value=0; master.connect(ctx.destination);
  const bufSize=ctx.sampleRate*3;
  const buf=ctx.createBuffer(1,bufSize,ctx.sampleRate);
  const d=buf.getChannelData(0); for(let i=0;i<bufSize;i++) d[i]=Math.random()*2-1;
  const src=ctx.createBufferSource(); src.buffer=buf; src.loop=true; src.playbackRate.value=0.45;
  const bp=ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=550; bp.Q.value=1.1;
  const lfo=ctx.createOscillator(); lfo.frequency.value=0.1;
  const lg=ctx.createGain(); lg.gain.value=0.28;
  const g=ctx.createGain(); g.gain.value=0.55;
  lfo.connect(lg); lg.connect(g.gain);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(); lfo.start();
  return master;
}

const MAKERS = { ocean:makeOceanNoise, rain:makeRainNoise, forest:makeForestNoise, wind:makeWindNoise };

/* ─── useAmbient hook ────────────────────────────────────────────────────── */
function useAmbient() {
  const mastersRef = useRef({});

  const start = useCallback((id, vol=0.5) => {
    try {
      const ctx=getCtx();
      if (!mastersRef.current[id]) mastersRef.current[id]=MAKERS[id](ctx);
      const m=mastersRef.current[id];
      m.gain.cancelScheduledValues(ctx.currentTime);
      m.gain.setValueAtTime(m.gain.value,ctx.currentTime);
      m.gain.linearRampToValueAtTime(vol,ctx.currentTime+1.8);
    } catch{}
  },[]);

  const stop = useCallback((id) => {
    try {
      const ctx=getCtx(), m=mastersRef.current[id]; if(!m)return;
      m.gain.cancelScheduledValues(ctx.currentTime);
      m.gain.setValueAtTime(m.gain.value,ctx.currentTime);
      m.gain.linearRampToValueAtTime(0,ctx.currentTime+1.8);
    } catch{}
  },[]);

  const setVol = useCallback((id, vol) => {
    try {
      const ctx=getCtx(), m=mastersRef.current[id]; if(!m)return;
      m.gain.cancelScheduledValues(ctx.currentTime);
      m.gain.setValueAtTime(m.gain.value,ctx.currentTime);
      m.gain.linearRampToValueAtTime(vol,ctx.currentTime+0.12);
    } catch{}
  },[]);

  return { start, stop, setVol };
}

/* ─── UI Components ──────────────────────────────────────────────────────── */
function ProgressRing({ progress, size=290, stroke=1.8 }) {
  const r=( size-stroke)/2, circ=2*Math.PI*r;
  return (
    <svg width={size} height={size} style={{position:"absolute",top:0,left:0,transform:"rotate(-90deg)",pointerEvents:"none"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={stroke}
        strokeDasharray={`${circ*progress} ${circ}`} strokeLinecap="round"
        style={{transition:"stroke-dasharray 0.08s linear"}}/>
    </svg>
  );
}

function Glass({ children, style }) {
  return (
    <div style={{
      background:"rgba(255,255,255,0.055)",
      backdropFilter:"blur(28px) saturate(150%)",
      WebkitBackdropFilter:"blur(28px) saturate(150%)",
      border:"1px solid rgba(255,255,255,0.11)",
      borderRadius:18,...style,
    }}>{children}</div>
  );
}

function Toggle({ on, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      width:40,height:22,borderRadius:11,border:"none",cursor:"pointer",flexShrink:0,
      background:on?"rgba(255,255,255,0.5)":"rgba(255,255,255,0.12)",
      position:"relative",transition:"background 0.25s",
    }}>
      <div style={{
        width:16,height:16,borderRadius:"50%",background:"#fff",
        position:"absolute",top:3,left:on?21:3,
        transition:"left 0.22s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)",
      }}/>
    </button>
  );
}

/* ── Settings Panel ─────────────────────────────────────────────────────── */
function SettingsPanel({ onClose, envId, setEnvId, patterns, setPatterns,
  activePatternId, setActivePatternId, soundOn, setSoundOn,
  ambientState, onAmbientToggle, onAmbientVolume }) {

  const [tab,setTab]=useState("env");
  const [draft,setDraft]=useState({name:"",inhale:4,holdIn:0,exhale:4,holdOut:0});

  function savePattern() {
    if (!draft.name.trim()) return;
    const np={...draft,id:Date.now().toString(),inhale:+draft.inhale,holdIn:+draft.holdIn,exhale:+draft.exhale,holdOut:+draft.holdOut};
    const next=[...patterns,np]; setPatterns(next); ls.set("stillness_custom_patterns",next);
    setDraft({name:"",inhale:4,holdIn:0,exhale:4,holdOut:0});
  }
  function deletePattern(id) {
    const next=patterns.filter(p=>p.id!==id); setPatterns(next); ls.set("stillness_custom_patterns",next);
    if(activePatternId===id) setActivePatternId(PRESET_PATTERNS[0].id);
  }

  const TABS=[{id:"env",label:"Environments"},{id:"patterns",label:"Patterns"},{id:"sound",label:"Sound"}];

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-end",
              justifyContent:"center",background:"rgba(0,0,0,0.45)",backdropFilter:"blur(6px)"}}
      onClick={onClose}>
      <motion.div initial={{y:100,opacity:0}} animate={{y:0,opacity:1}} exit={{y:100,opacity:0}}
        transition={{type:"spring",stiffness:280,damping:32}}
        onClick={e=>e.stopPropagation()}
        style={{width:"100%",maxWidth:520,padding:"0 14px 28px"}}>
        <Glass style={{padding:"26px 26px 22px",maxHeight:"82vh",display:"flex",flexDirection:"column"}}>

          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexShrink:0}}>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:21,fontWeight:300,color:"#fff",letterSpacing:"0.05em"}}>Settings</span>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.45)",lineHeight:0}}><X size={18}/></button>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",gap:20,marginBottom:22,borderBottom:"1px solid rgba(255,255,255,0.07)",flexShrink:0}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:300,letterSpacing:"0.07em",
                background:"none",border:"none",cursor:"pointer",
                color:tab===t.id?"#fff":"rgba(255,255,255,0.38)",
                paddingBottom:10,borderBottom:tab===t.id?"1px solid rgba(255,255,255,0.55)":"1px solid transparent",
                transition:"all 0.2s",
              }}>{t.label}</button>
            ))}
          </div>

          <div style={{overflowY:"auto",flex:1}}>

            {/* ── ENV ── */}
            {tab==="env" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                {ENVIRONMENTS.map(e=>{
                  const {Icon}=e;
                  return (
                    <button key={e.id} onClick={()=>{setEnvId(e.id);ls.set("stillness_env",e.id);}}
                      style={{
                        position:"relative",height:72,borderRadius:13,overflow:"hidden",cursor:"pointer",
                        border:envId===e.id?"1.5px solid rgba(255,255,255,0.55)":"1.5px solid rgba(255,255,255,0.1)",
                        background:e.bg?`url(${e.bg}) center/cover`:"#090910",transition:"border 0.2s",
                      }}>
                      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.4)"}}/>
                      <div style={{position:"relative",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:5}}>
                        <Icon size={15} color="rgba(255,255,255,0.8)" strokeWidth={1.4}/>
                        <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:300,color:"#fff",letterSpacing:"0.07em"}}>{e.label}</span>
                      </div>
                      {envId===e.id && <Check size={12} style={{position:"absolute",top:7,right:7,color:"#fff"}}/>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── PATTERNS ── */}
            {tab==="patterns" && (
              <div>
                <div style={{marginBottom:18}}>
                  {[...PRESET_PATTERNS,...patterns].map(p=>(
                    <div key={p.id} onClick={()=>setActivePatternId(p.id)} style={{
                      display:"flex",alignItems:"center",justifyContent:"space-between",
                      padding:"10px 14px",borderRadius:11,marginBottom:6,cursor:"pointer",
                      background:activePatternId===p.id?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.04)",
                      border:activePatternId===p.id?"1px solid rgba(255,255,255,0.2)":"1px solid transparent",
                      transition:"all 0.15s",
                    }}>
                      <div>
                        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#fff",fontWeight:300}}>{p.name}</div>
                        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:2}}>
                          {p.inhale} · {p.holdIn} · {p.exhale} · {p.holdOut}
                        </div>
                      </div>
                      {!PRESET_PATTERNS.find(pr=>pr.id===p.id) && (
                        <button onClick={ev=>{ev.stopPropagation();deletePattern(p.id);}}
                          style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,80,80,0.55)",lineHeight:0}}>
                          <Trash2 size={14}/>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:16}}>
                  <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12}}>
                    Create Pattern
                  </p>
                  <input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Pattern name"
                    style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
                      borderRadius:9,padding:"8px 12px",color:"#fff",fontFamily:"'DM Sans',sans-serif",
                      fontSize:13,fontWeight:300,marginBottom:10,outline:"none"}}/>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:12}}>
                    {[["inhale","Inhale"],["holdIn","Hold In"],["exhale","Exhale"],["holdOut","Hold Out"]].map(([k,lbl])=>(
                      <div key={k}>
                        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.3)",marginBottom:5,letterSpacing:"0.08em",textTransform:"uppercase"}}>{lbl}</div>
                        <input type="number" min={0} max={20} value={draft[k]} onChange={e=>setDraft({...draft,[k]:e.target.value})}
                          style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
                            borderRadius:8,padding:"7px 8px",color:"#fff",fontFamily:"'DM Sans',sans-serif",
                            fontSize:14,textAlign:"center",outline:"none"}}/>
                      </div>
                    ))}
                  </div>
                  <button onClick={savePattern} style={{
                    width:"100%",padding:"9px",borderRadius:10,
                    background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",
                    color:"rgba(255,255,255,0.8)",fontFamily:"'DM Sans',sans-serif",fontSize:12,
                    fontWeight:300,cursor:"pointer",display:"flex",alignItems:"center",
                    justifyContent:"center",gap:6,letterSpacing:"0.07em",
                  }}>
                    <Plus size={13}/> Save Pattern
                  </button>
                </div>
              </div>
            )}

            {/* ── SOUND ── */}
            {tab==="sound" && (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {/* Phase tones */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"13px 15px",borderRadius:12,
                  background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:11}}>
                    <Music2 size={15} color="rgba(255,255,255,0.5)" strokeWidth={1.4}/>
                    <div>
                      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#fff",fontWeight:300}}>Phase Tones</div>
                      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:1}}>Sine-wave cue on phase change</div>
                    </div>
                  </div>
                  <Toggle on={soundOn} onToggle={()=>{const n=!soundOn;setSoundOn(n);ls.set("stillness_sound",n);}}/>
                </div>

                <div style={{height:1,background:"rgba(255,255,255,0.07)",margin:"4px 0"}}/>
                <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:2}}>
                  Ambient Soundscapes
                </p>

                {AMBIENT_SOUNDS.map(({id,label,Icon:Ico})=>{
                  const s=ambientState[id]||{on:false,vol:0.4};
                  return (
                    <div key={id} style={{
                      padding:"13px 15px",borderRadius:12,transition:"all 0.2s",
                      background:s.on?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.04)",
                      border:s.on?"1px solid rgba(255,255,255,0.15)":"1px solid rgba(255,255,255,0.07)",
                    }}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:s.on?10:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <Ico size={14} color="rgba(255,255,255,0.55)" strokeWidth={1.4}/>
                          <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,
                            color:s.on?"#fff":"rgba(255,255,255,0.5)",fontWeight:300}}>{label}</span>
                        </div>
                        <Toggle on={s.on} onToggle={()=>onAmbientToggle(id)}/>
                      </div>
                      <AnimatePresence>
                        {s.on && (
                          <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}}
                            exit={{opacity:0,height:0}} transition={{duration:0.2}}
                            style={{display:"flex",alignItems:"center",gap:10,overflow:"hidden"}}>
                            <VolumeX size={11} color="rgba(255,255,255,0.3)" strokeWidth={1.5}/>
                            <input type="range" min={0} max={1} step={0.01} value={s.vol}
                              onChange={e=>onAmbientVolume(id,+e.target.value)}
                              style={{flex:1,background:`linear-gradient(to right,rgba(255,255,255,0.5) ${s.vol*100}%,rgba(255,255,255,0.12) ${s.vol*100}%)`}}/>
                            <Volume2 size={11} color="rgba(255,255,255,0.5)" strokeWidth={1.5}/>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Glass>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main App ───────────────────────────────────────────────────────────── */
export default function Stillness() {
  const [envId,          setEnvId]          = useState(()=>ls.get("stillness_env","dark"));
  const [soundOn,        setSoundOn]        = useState(()=>ls.get("stillness_sound",true));
  const [customPatterns, setCustomPatterns] = useState(()=>ls.get("stillness_custom_patterns",[]));
  const [activePatId,    setActivePatId]    = useState(()=>ls.get("stillness_pattern","box"));
  const [ambientState,   setAmbientState]   = useState(()=>
    ls.get("stillness_ambient",{
      ocean:{on:false,vol:0.38},rain:{on:false,vol:0.38},
      forest:{on:false,vol:0.38},wind:{on:false,vol:0.38},
    })
  );

  const [running,      setRunning]      = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [phase,        setPhase]        = useState("inhale");
  const [elapsed,      setElapsed]      = useState(0);
  const [cycle,        setCycle]        = useState(0);

  const timerRef = useRef(null);
  const ambient  = useAmbient();

  const allPatterns = [...PRESET_PATTERNS,...customPatterns];
  const pattern     = allPatterns.find(p=>p.id===activePatId)||PRESET_PATTERNS[0];
  const env         = ENVIRONMENTS.find(e=>e.id===envId)||ENVIRONMENTS[0];
  const phaseDur    = pattern[phase]||0;

  useEffect(()=>{ls.set("stillness_pattern",activePatId);},[activePatId]);

  // Sync ambient on state change
  useEffect(()=>{
    Object.entries(ambientState).forEach(([id,s])=>{
      if(s.on) ambient.start(id,s.vol);
      else     ambient.stop(id);
    });
  },[ambientState]); // eslint-disable-line

  function handleAmbientToggle(id) {
    const cur=ambientState[id]||{on:false,vol:0.38};
    const next={...ambientState,[id]:{...cur,on:!cur.on}};
    setAmbientState(next); ls.set("stillness_ambient",next);
  }
  function handleAmbientVolume(id,vol) {
    const cur=ambientState[id]||{on:true,vol};
    const next={...ambientState,[id]:{...cur,vol}};
    setAmbientState(next); ls.set("stillness_ambient",next);
    ambient.setVol(id,vol);
  }

  // Breathing timer
  const advancePhase=useCallback((curPhase,curPat,snd)=>{
    const idx=PHASE_ORDER.indexOf(curPhase);
    let next=curPhase;
    for(let i=1;i<=4;i++){
      const c=PHASE_ORDER[(idx+i)%4];
      if(curPat[c]>0){next=c;break;}
    }
    if(snd) playTone(PHASE_FREQ[next]);
    setPhase(next); setElapsed(0);
    if(next==="inhale") setCycle(c=>c+1);
  },[]);

  useEffect(()=>{
    if(!running){clearInterval(timerRef.current);return;}
    if(phaseDur===0){advancePhase(phase,pattern,soundOn);return;}
    timerRef.current=setInterval(()=>{
      setElapsed(e=>{
        if(e+0.05>=phaseDur){advancePhase(phase,pattern,soundOn);return 0;}
        return e+0.05;
      });
    },50);
    return()=>clearInterval(timerRef.current);
  },[running,phase,phaseDur,pattern,soundOn,advancePhase]);

  function toggle(){
    if(!running){setPhase("inhale");setElapsed(0);setCycle(0);if(soundOn)playTone(PHASE_FREQ["inhale"]);}
    setRunning(r=>!r);
  }

  // Circle geometry
  const RING=290, MIN_R=86, MAX_R=122;
  const prog=phaseDur>0?Math.min(elapsed/phaseDur,1):0;
  let cR=MIN_R;
  if(running){
    if(phase==="inhale")  cR=MIN_R+(MAX_R-MIN_R)*prog;
    else if(phase==="holdIn")  cR=MAX_R;
    else if(phase==="exhale")  cR=MAX_R-(MAX_R-MIN_R)*prog;
    else cR=MIN_R;
  }

  const anyAmbient=Object.values(ambientState).some(s=>s.on);

  return (
    <>
      <FontLoader/>
      <div style={{position:"fixed",inset:0,overflow:"hidden",background:env.bg?"#06060a":undefined}}>

        {/* Background image */}
        {env.bg && (
          <img key={env.id} src={env.bg} referrerPolicy="no-referrer" alt=""
            style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
        )}

        {/* Overlay */}
        <div style={{position:"absolute",inset:0,background:env.overlay}}/>

        {/* Dark-mode orbs */}
        {env.id==="dark" && <>
          <motion.div animate={{opacity:[0.7,1,0.7],scale:[1,1.08,1]}} transition={{duration:9,repeat:Infinity,ease:"easeInOut"}}
            style={{position:"absolute",top:"-15%",left:"12%",width:600,height:600,borderRadius:"50%",
              background:"radial-gradient(circle,rgba(100,115,215,0.1) 0%,transparent 70%)",pointerEvents:"none"}}/>
          <motion.div animate={{opacity:[0.6,0.9,0.6],scale:[1,1.06,1]}} transition={{duration:12,repeat:Infinity,ease:"easeInOut",delay:2.5}}
            style={{position:"absolute",bottom:"-18%",right:"6%",width:680,height:680,borderRadius:"50%",
              background:"radial-gradient(circle,rgba(65,155,180,0.09) 0%,transparent 70%)",pointerEvents:"none"}}/>
        </>}

        {/* ── Header ── */}
        <div style={{position:"relative",zIndex:10,display:"flex",justifyContent:"space-between",
          alignItems:"center",padding:"26px 28px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <Wind size={14} color="rgba(255,255,255,0.5)" strokeWidth={1.5}/>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19,fontWeight:300,
              color:"rgba(255,255,255,0.8)",letterSpacing:"0.13em"}}>stillness</span>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <AnimatePresence>
              {anyAmbient && (
                <motion.div initial={{opacity:0,scale:0.85}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.85}}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,
                    background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.11)"}}>
                  <motion.div animate={{scale:[1,1.5,1]}} transition={{duration:2,repeat:Infinity}}
                    style={{width:5,height:5,borderRadius:"50%",background:"rgba(255,255,255,0.55)"}}/>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:"0.08em"}}>ambient</span>
                </motion.div>
              )}
            </AnimatePresence>
            <button onClick={()=>{const n=!soundOn;setSoundOn(n);ls.set("stillness_sound",n);}}
              style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.38)",lineHeight:0,padding:4}}>
              {soundOn ? <Volume2 size={16} strokeWidth={1.5}/> : <BellOff size={16} strokeWidth={1.5}/>}
            </button>
            <button onClick={()=>setSettingsOpen(true)}
              style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.38)",lineHeight:0,padding:4}}>
              <Settings size={16} strokeWidth={1.5}/>
            </button>
          </div>
        </div>

        {/* ── Stage ── */}
        <div style={{position:"relative",zIndex:10,display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",height:"100%",paddingBottom:64}}>

          {/* Cycle */}
          <motion.div animate={{opacity:running&&cycle>0?0.35:0}} transition={{duration:1}}
            style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,letterSpacing:"0.24em",
              color:"#fff",marginBottom:42,textTransform:"uppercase"}}>
            Cycle {cycle}
          </motion.div>

          {/* Circle */}
          <div style={{position:"relative",width:RING,height:RING,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <ProgressRing progress={running?prog:0} size={RING}/>

            {/* Glow */}
            <motion.div
              animate={{width:cR*2+72,height:cR*2+72,opacity:running?0.42:0.12}}
              transition={{duration:phaseDur>0?phaseDur:0.8,ease:"easeInOut"}}
              style={{position:"absolute",borderRadius:"50%",
                background:"radial-gradient(circle,rgba(195,210,255,0.14) 0%,transparent 68%)",
                filter:"blur(20px)",pointerEvents:"none"}}/>

            {/* Orb */}
            <motion.div
              animate={{width:cR*2,height:cR*2}}
              transition={{duration:phaseDur>0?phaseDur:0.05,ease:"easeInOut"}}
              style={{
                borderRadius:"50%",
                background:"rgba(255,255,255,0.063)",
                backdropFilter:"blur(22px) saturate(138%)",
                WebkitBackdropFilter:"blur(22px) saturate(138%)",
                border:"1px solid rgba(255,255,255,0.17)",
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:"0 8px 48px rgba(0,0,0,0.22),inset 0 1px 0 rgba(255,255,255,0.13)",
              }}>
              <AnimatePresence mode="wait">
                <motion.div key={`${phase}-${running}`}
                  initial={{opacity:0,y:5}} animate={{opacity:1,y:0}}
                  exit={{opacity:0,y:-5}} transition={{duration:0.36}}
                  style={{textAlign:"center",userSelect:"none"}}>
                  {running ? <>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",
                      fontSize:23,fontWeight:300,color:"rgba(255,255,255,0.88)",letterSpacing:"0.1em"}}>
                      {PHASE_LABEL[phase]}
                    </div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,
                      color:"rgba(255,255,255,0.28)",marginTop:5,letterSpacing:"0.08em"}}>
                      {Math.max(0,Math.ceil(phaseDur-elapsed))}s
                    </div>
                  </> : (
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",
                      fontSize:16,fontWeight:300,color:"rgba(255,255,255,0.26)",letterSpacing:"0.18em"}}>
                      breathe
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Play/Pause */}
          <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={toggle}
            style={{marginTop:42,width:50,height:50,borderRadius:"50%",cursor:"pointer",
              background:"rgba(255,255,255,0.09)",backdropFilter:"blur(14px)",
              border:"1px solid rgba(255,255,255,0.17)",color:"#fff",
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:"0 4px 28px rgba(0,0,0,0.18)"}}>
            {running ? <Pause size={16} strokeWidth={1.8}/> : <Play size={16} strokeWidth={1.8} style={{marginLeft:2}}/>}
          </motion.button>

          {/* Pattern chips */}
          <div style={{marginTop:26,display:"flex",gap:7,flexWrap:"wrap",justifyContent:"center",maxWidth:430,padding:"0 18px"}}>
            {allPatterns.map(p=>(
              <motion.button key={p.id} whileHover={{scale:1.03}} whileTap={{scale:0.97}}
                onClick={()=>{setActivePatId(p.id);if(running){setPhase("inhale");setElapsed(0);}}}
                style={{
                  padding:"5px 13px",borderRadius:20,cursor:"pointer",transition:"all 0.2s",
                  background:activePatId===p.id?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.05)",
                  border:activePatId===p.id?"1px solid rgba(255,255,255,0.3)":"1px solid rgba(255,255,255,0.08)",
                  color:activePatId===p.id?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.36)",
                  fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:300,
                  letterSpacing:"0.06em",whiteSpace:"nowrap",
                }}>
                {p.name}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Settings */}
        <AnimatePresence>
          {settingsOpen && (
            <SettingsPanel
              onClose={()=>setSettingsOpen(false)}
              envId={envId} setEnvId={setEnvId}
              patterns={customPatterns} setPatterns={setCustomPatterns}
              activePatternId={activePatId} setActivePatternId={setActivePatId}
              soundOn={soundOn} setSoundOn={setSoundOn}
              ambientState={ambientState}
              onAmbientToggle={handleAmbientToggle}
              onAmbientVolume={handleAmbientVolume}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
