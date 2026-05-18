import { useState, useRef, useEffect, useCallback } from "react";

// ─── GW 10th EDITION DEPLOYMENT DATA ─────────────────────────────────────────
// All measurements in inches. Table sizes:
//   Incursion:   44" × 30"
//   Strike Force: 44" × 60"  
//   Onslaught:   44" × 90"
// Deployment zones and objectives defined as % of table dimensions.

const MISSION_SIZES = {
  incursion:    { name:"Incursion",    w:44, h:30, label:'44"×30"' },
  strikeforce:  { name:"Strike Force", w:44, h:60, label:'44"×60"' },
  onslaught:    { name:"Onslaught",    w:44, h:90, label:'44"×90"' },
};

// Deployment zones as fractions of the board (x, y, width, height)
// Player 1 always deploys from bottom, Player 2 from top
const DEPLOYMENTS = {
  // ── Incursion deployments ──
  inc_search_and_destroy: {
    name:"Search & Destroy",
    sizes:["incursion"],
    zones:[
      { label:"Player 1", x:0,     y:0.5,  w:1,    h:0.5,  color:"rgba(59,130,246,0.22)",  border:"rgba(59,130,246,0.7)"  },
      { label:"Player 2", x:0,     y:0,    w:1,    h:0.5,  color:"rgba(239,68,68,0.22)",   border:"rgba(239,68,68,0.7)"   },
    ],
    objectives:[
      { x:0.5, y:0.5, label:"A", primary:true },
      { x:0.25, y:0.25, label:"B" }, { x:0.75, y:0.25, label:"C" },
      { x:0.25, y:0.75, label:"D" }, { x:0.75, y:0.75, label:"E" },
    ],
  },
  inc_dawn_of_war: {
    name:"Dawn of War",
    sizes:["incursion"],
    zones:[
      { label:"Player 1", x:0,     y:0.6,  w:1,    h:0.4,  color:"rgba(59,130,246,0.22)",  border:"rgba(59,130,246,0.7)"  },
      { label:"Player 2", x:0,     y:0,    w:1,    h:0.4,  color:"rgba(239,68,68,0.22)",   border:"rgba(239,68,68,0.7)"   },
    ],
    objectives:[
      { x:0.5, y:0.5, label:"A", primary:true },
      { x:0.2, y:0.2, label:"B" }, { x:0.8, y:0.2, label:"C" },
      { x:0.2, y:0.8, label:"D" }, { x:0.8, y:0.8, label:"E" },
    ],
  },
  inc_sweeping_engagement: {
    name:"Sweeping Engagement",
    sizes:["incursion"],
    zones:[
      { label:"Player 1", x:0,    y:0.55, w:0.5,  h:0.45, color:"rgba(59,130,246,0.22)",  border:"rgba(59,130,246,0.7)"  },
      { label:"Player 1", x:0.5,  y:0,    w:0.5,  h:0.45, color:"rgba(59,130,246,0.22)",  border:"rgba(59,130,246,0.7)"  },
      { label:"Player 2", x:0.5,  y:0.55, w:0.5,  h:0.45, color:"rgba(239,68,68,0.22)",   border:"rgba(239,68,68,0.7)"   },
      { label:"Player 2", x:0,    y:0,    w:0.5,  h:0.45, color:"rgba(239,68,68,0.22)",   border:"rgba(239,68,68,0.7)"   },
    ],
    objectives:[
      { x:0.5, y:0.5, label:"A", primary:true },
      { x:0.15, y:0.15, label:"B" }, { x:0.85, y:0.15, label:"C" },
      { x:0.15, y:0.85, label:"D" }, { x:0.85, y:0.85, label:"E" },
    ],
  },
  // ── Strike Force deployments ──
  sf_search_and_destroy: {
    name:"Search & Destroy",
    sizes:["strikeforce"],
    zones:[
      { label:"Player 1", x:0, y:0.58, w:1, h:0.42, color:"rgba(59,130,246,0.22)", border:"rgba(59,130,246,0.7)" },
      { label:"Player 2", x:0, y:0,    w:1, h:0.42, color:"rgba(239,68,68,0.22)",  border:"rgba(239,68,68,0.7)"  },
    ],
    objectives:[
      { x:0.5,  y:0.5,  label:"A", primary:true },
      { x:0.2,  y:0.25, label:"B" }, { x:0.8, y:0.25, label:"C" },
      { x:0.2,  y:0.75, label:"D" }, { x:0.8, y:0.75, label:"E" },
      { x:0.5,  y:0.15, label:"F" }, { x:0.5, y:0.85, label:"G" },
    ],
  },
  sf_dawn_of_war: {
    name:"Dawn of War",
    sizes:["strikeforce"],
    zones:[
      { label:"Player 1", x:0, y:0.62, w:1, h:0.38, color:"rgba(59,130,246,0.22)", border:"rgba(59,130,246,0.7)" },
      { label:"Player 2", x:0, y:0,    w:1, h:0.38, color:"rgba(239,68,68,0.22)",  border:"rgba(239,68,68,0.7)"  },
    ],
    objectives:[
      { x:0.5,  y:0.5,  label:"A", primary:true },
      { x:0.17, y:0.5,  label:"B" }, { x:0.83, y:0.5,  label:"C" },
      { x:0.5,  y:0.2,  label:"D" }, { x:0.5,  y:0.8,  label:"E" },
      { x:0.3,  y:0.3,  label:"F" }, { x:0.7,  y:0.7,  label:"G" },
    ],
  },
  sf_sweeping_engagement: {
    name:"Sweeping Engagement",
    sizes:["strikeforce"],
    zones:[
      { label:"Player 1", x:0,   y:0.58, w:0.5, h:0.42, color:"rgba(59,130,246,0.22)", border:"rgba(59,130,246,0.7)" },
      { label:"Player 1", x:0.5, y:0,    w:0.5, h:0.42, color:"rgba(59,130,246,0.22)", border:"rgba(59,130,246,0.7)" },
      { label:"Player 2", x:0.5, y:0.58, w:0.5, h:0.42, color:"rgba(239,68,68,0.22)",  border:"rgba(239,68,68,0.7)"  },
      { label:"Player 2", x:0,   y:0,    w:0.5, h:0.42, color:"rgba(239,68,68,0.22)",  border:"rgba(239,68,68,0.7)"  },
    ],
    objectives:[
      { x:0.5, y:0.5, label:"A", primary:true },
      { x:0.2, y:0.2, label:"B" }, { x:0.8, y:0.2, label:"C" },
      { x:0.2, y:0.8, label:"D" }, { x:0.8, y:0.8, label:"E" },
      { x:0.5, y:0.3, label:"F" }, { x:0.5, y:0.7, label:"G" },
    ],
  },
  // ── Onslaught deployments ──
  on_search_and_destroy: {
    name:"Search & Destroy",
    sizes:["onslaught"],
    zones:[
      { label:"Player 1", x:0, y:0.6, w:1, h:0.4, color:"rgba(59,130,246,0.22)", border:"rgba(59,130,246,0.7)" },
      { label:"Player 2", x:0, y:0,   w:1, h:0.4, color:"rgba(239,68,68,0.22)",  border:"rgba(239,68,68,0.7)"  },
    ],
    objectives:[
      { x:0.5,  y:0.5,  label:"A", primary:true },
      { x:0.17, y:0.22, label:"B" }, { x:0.83, y:0.22, label:"C" },
      { x:0.17, y:0.78, label:"D" }, { x:0.83, y:0.78, label:"E" },
      { x:0.5,  y:0.17, label:"F" }, { x:0.5,  y:0.83, label:"G" },
      { x:0.33, y:0.5,  label:"H" }, { x:0.67, y:0.5,  label:"I" },
    ],
  },
};

// GW official terrain pieces — footprint as fraction of Incursion board
const TERRAIN_SETS = [
  {
    name:"No Terrain",
    pieces:[],
  },
  {
    name:"Ruins (Standard)",
    pieces:[
      { type:"ruin",  x:0.12, y:0.25, w:0.14, h:0.2  },
      { type:"ruin",  x:0.72, y:0.25, w:0.14, h:0.2  },
      { type:"ruin",  x:0.12, y:0.58, w:0.14, h:0.2  },
      { type:"ruin",  x:0.72, y:0.58, w:0.14, h:0.2  },
      { type:"ruin",  x:0.38, y:0.4,  w:0.22, h:0.18 },
    ],
  },
  {
    name:"Ruins + Obstacles",
    pieces:[
      { type:"ruin",     x:0.1,  y:0.22, w:0.15, h:0.2 },
      { type:"ruin",     x:0.73, y:0.22, w:0.15, h:0.2 },
      { type:"ruin",     x:0.1,  y:0.6,  w:0.15, h:0.2 },
      { type:"ruin",     x:0.73, y:0.6,  w:0.15, h:0.2 },
      { type:"obstacle", x:0.35, y:0.38, w:0.12, h:0.08 },
      { type:"obstacle", x:0.52, y:0.52, w:0.12, h:0.08 },
      { type:"ruin",     x:0.38, y:0.42, w:0.22, h:0.16 },
    ],
  },
  {
    name:"Area Terrain",
    pieces:[
      { type:"area", x:0.05, y:0.15, w:0.2,  h:0.25 },
      { type:"area", x:0.72, y:0.15, w:0.2,  h:0.25 },
      { type:"area", x:0.05, y:0.62, w:0.2,  h:0.25 },
      { type:"area", x:0.72, y:0.62, w:0.2,  h:0.25 },
      { type:"ruin", x:0.36, y:0.38, w:0.26, h:0.22 },
    ],
  },
];

const TERRAIN_COLORS = {
  ruin:     { bg:"rgba(120,80,40,0.35)",  border:"rgba(180,130,70,0.8)",  label:"Ruin"     },
  obstacle: { bg:"rgba(80,80,80,0.35)",   border:"rgba(160,160,160,0.8)", label:"Obstacle" },
  area:     { bg:"rgba(40,100,40,0.3)",   border:"rgba(80,160,80,0.7)",   label:"Area"     },
};

// ─── BOARD RENDERER ───────────────────────────────────────────────────────────
function BoardOverlay({ deployment, terrainSet, boardW, boardH, T }) {
  if (!deployment) return null;
  const dep = DEPLOYMENTS[deployment];
  if (!dep) return null;

  return (
    <svg width={boardW} height={boardH} style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
      {/* Deployment zones */}
      {dep.zones.map((z,i) => (
        <rect key={i}
          x={z.x*boardW} y={z.y*boardH}
          width={z.w*boardW} height={z.h*boardH}
          fill={z.color} stroke={z.border} strokeWidth={2}
          strokeDasharray={z.label.includes("1") ? "none" : "8,4"}
        />
      ))}

      {/* Zone labels */}
      {dep.zones.map((z,i) => (
        <text key={"l"+i}
          x={(z.x + z.w/2)*boardW}
          y={(z.y + z.h/2)*boardH}
          textAnchor="middle" dominantBaseline="middle"
          fill={z.border} fontSize={Math.max(10, boardW/30)}
          fontFamily="'Cinzel', serif" fontWeight="700" opacity="0.85"
        >{z.label}</text>
      ))}

      {/* Terrain */}
      {terrainSet && TERRAIN_SETS.find(t=>t.name===terrainSet)?.pieces.map((p,i) => {
        const tc = TERRAIN_COLORS[p.type] || TERRAIN_COLORS.ruin;
        return (
          <g key={"t"+i}>
            <rect x={p.x*boardW} y={p.y*boardH} width={p.w*boardW} height={p.h*boardH}
              fill={tc.bg} stroke={tc.border} strokeWidth={1.5} rx={3}/>
            <text x={(p.x+p.w/2)*boardW} y={(p.y+p.h/2)*boardH}
              textAnchor="middle" dominantBaseline="middle"
              fill={tc.border} fontSize={Math.max(7, boardW/50)}
              fontFamily="'Cinzel', serif" opacity="0.9">{tc.label}</text>
          </g>
        );
      })}

      {/* Objectives */}
      {dep.objectives.map((obj,i) => {
        const r = obj.primary ? Math.max(14, boardW/28) : Math.max(11, boardW/36);
        const fill = obj.primary ? "rgba(255,200,0,0.85)" : "rgba(255,255,255,0.8)";
        const stroke = obj.primary ? "#f0c000" : "#ccc";
        return (
          <g key={"o"+i}>
            <circle cx={obj.x*boardW} cy={obj.y*boardH} r={r} fill={fill} stroke={stroke} strokeWidth={2}/>
            <text x={obj.x*boardW} y={obj.y*boardH}
              textAnchor="middle" dominantBaseline="middle"
              fill="#000" fontSize={Math.max(9, boardW/40)}
              fontFamily="'Cinzel', serif" fontWeight="700">{obj.label}</text>
          </g>
        );
      })}

      {/* No terrain label */}
      {(!terrainSet || terrainSet === "No Terrain") && dep.objectives.length === 0 && (
        <text x={boardW/2} y={boardH/2} textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.3)" fontSize={boardW/20} fontFamily="'Cinzel',serif">
          Select Deployment
        </text>
      )}
    </svg>
  );
}

// ─── TABLE MODE ───────────────────────────────────────────────────────────────
export default function TableMode({ T, onBack, onSaveLayout }) {
  const [size, setSize]           = useState("strikeforce");
  const [depKey, setDepKey]       = useState(null);
  const [terrainIdx, setTerrainIdx] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError]   = useState(null);
  const [locked, setLocked]       = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const videoRef  = useRef();
  const canvasRef = useRef();
  const streamRef = useRef();
  const overlayRef = useRef();
  const isMobile  = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Board display size — fills available space
  const [boardSize, setBoardSize] = useState({ w:600, h:400 });
  const boardRef = useRef();
  useEffect(() => {
    function resize() {
      if (!boardRef.current) return;
      const r = boardRef.current.getBoundingClientRect();
      const tableSize = MISSION_SIZES[size];
      const aspect = tableSize.w / tableSize.h;
      const w = Math.min(r.width, window.innerWidth - 32);
      const h = w / aspect;
      setBoardSize({ w, h });
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [size, boardRef.current]);

  // Filter deployments for current size
  const availableDeployments = Object.entries(DEPLOYMENTS).filter(([,d]) => d.sizes.includes(size));

  // Camera
  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // rear camera
          width: { ideal:1920 }, height: { ideal:1080 },
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch(e) {
      if (e.name === "NotAllowedError") setCameraError("Camera permission denied. Please allow camera access.");
      else if (e.name === "NotFoundError") setCameraError("No camera found on this device.");
      else setCameraError("Could not start camera: " + e.message);
    }
  }

  function stopCamera() {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCameraActive(false);
  }

  useEffect(() => { return () => { if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop()); }; }, []);

  // Screenshot — captures video + SVG overlay into a canvas
  function takeScreenshot() {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (cameraActive && videoRef.current) {
      canvas.width  = videoRef.current.videoWidth  || boardSize.w;
      canvas.height = videoRef.current.videoHeight || boardSize.h;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      canvas.width  = boardSize.w;
      canvas.height = boardSize.h;
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // Draw SVG overlay on top
    if (overlayRef.current) {
      const svgData = new XMLSerializer().serializeToString(overlayRef.current);
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setScreenshot(canvas.toDataURL("image/jpeg", 0.92));
      };
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    } else {
      setScreenshot(canvas.toDataURL("image/jpeg", 0.92));
    }
  }

  function downloadScreenshot() {
    if (!screenshot) return;
    const a = document.createElement("a");
    a.href = screenshot; a.download = "dice-of-ruin-table.jpg"; a.click();
  }

  function lockLayout() {
    if (!depKey) return;
    const dep = DEPLOYMENTS[depKey];
    const terrain = TERRAIN_SETS[terrainIdx];
    setLocked(true);
    onSaveLayout?.({
      size, deployment:dep.name, terrain:terrain.name,
      missionSize:MISSION_SIZES[size].name,
    });
  }

  const currentDep = depKey ? DEPLOYMENTS[depKey] : null;
  const currentTerrain = TERRAIN_SETS[terrainIdx];

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"var(--app-font)", display:"flex", flexDirection:"column" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderBottom:`1px solid ${T.border}`, background:T.headerBg, backdropFilter:"blur(6px)" }}>
        <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${T.border}`, color:T.textDim, borderRadius:T.radius??4, padding:"5px 10px", cursor:"pointer", fontSize:11 }}>← Back</button>
        <div>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:15, color:T.accent, fontWeight:700 }}>The Table</div>
          <div style={{ fontSize:8, color:T.textDim, letterSpacing:3, textTransform:"uppercase" }}>10th Edition · GW Matched Play</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          {currentDep && !locked && <button onClick={lockLayout} style={{ background:T.accent, border:"none", color:"#fff", borderRadius:T.radius??4, padding:"6px 14px", cursor:"pointer", fontFamily:"var(--app-font)", fontSize:11, fontWeight:600 }}>Lock In</button>}
          {locked && <span style={{ fontSize:11, color:"#5cb85c", border:"1px solid #5cb85c44", borderRadius:4, padding:"6px 10px" }}>✓ Layout Saved</span>}
        </div>
      </div>

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* ── LEFT: Controls ── */}
        <div style={{ width:240, flexShrink:0, overflowY:"auto", padding:14, borderRight:`1px solid ${T.border}`, background:T.panel+"bb" }}>

          {/* Mission size */}
          <div style={{ fontSize:9, color:T.textDim, letterSpacing:3, textTransform:"uppercase", marginBottom:8 }}>Mission Size</div>
          <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:14 }}>
            {Object.entries(MISSION_SIZES).map(([key,ms]) => (
              <button key={key} onClick={() => { setSize(key); setDepKey(null); setLocked(false); }} style={{ padding:"8px 10px", borderRadius:T.radius??5, cursor:"pointer", border:`1px solid ${size===key?T.accent:T.border}`, background:size===key?T.accent+"22":"transparent", color:size===key?T.accentText:T.text, fontFamily:"var(--app-font)", fontSize:11, textAlign:"left" }}>
                <div style={{ fontWeight:600 }}>{ms.name}</div>
                <div style={{ fontSize:9, color:T.textDim }}>{ms.label}</div>
              </button>
            ))}
          </div>

          {/* Deployment */}
          <div style={{ fontSize:9, color:T.textDim, letterSpacing:3, textTransform:"uppercase", marginBottom:8 }}>Deployment</div>
          <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:14 }}>
            {availableDeployments.map(([key,dep]) => (
              <button key={key} onClick={() => { setDepKey(key); setLocked(false); }} style={{ padding:"8px 10px", borderRadius:T.radius??5, cursor:"pointer", border:`1px solid ${depKey===key?T.accent:T.border}`, background:depKey===key?T.accent+"22":"transparent", color:depKey===key?T.accentText:T.text, fontFamily:"var(--app-font)", fontSize:11 }}>
                {dep.name}
              </button>
            ))}
          </div>

          {/* Terrain */}
          <div style={{ fontSize:9, color:T.textDim, letterSpacing:3, textTransform:"uppercase", marginBottom:8 }}>Terrain Layout</div>
          <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:14 }}>
            {TERRAIN_SETS.map((ts,i) => (
              <button key={i} onClick={() => { setTerrainIdx(i); setLocked(false); }} style={{ padding:"8px 10px", borderRadius:T.radius??5, cursor:"pointer", border:`1px solid ${terrainIdx===i?T.accent:T.border}`, background:terrainIdx===i?T.accent+"22":"transparent", color:terrainIdx===i?T.accentText:T.text, fontFamily:"var(--app-font)", fontSize:11 }}>
                {ts.name}
              </button>
            ))}
          </div>

          {/* Camera controls */}
          {isMobile && (
            <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:12 }}>
              <div style={{ fontSize:9, color:T.textDim, letterSpacing:3, textTransform:"uppercase", marginBottom:8 }}>Camera</div>
              {!cameraActive
                ? <button onClick={startCamera} style={{ width:"100%", padding:"8px", background:T.accent+"22", border:`1px solid ${T.accent}55`, color:T.accentText, borderRadius:T.radius??5, cursor:"pointer", fontSize:11, fontFamily:"var(--app-font)" }}>📷 Activate Camera</button>
                : <button onClick={stopCamera}  style={{ width:"100%", padding:"8px", background:"rgba(231,76,60,0.15)", border:"1px solid #e74c3c55", color:"#e74c3c", borderRadius:T.radius??5, cursor:"pointer", fontSize:11, fontFamily:"var(--app-font)" }}>Stop Camera</button>
              }
              {cameraError && <div style={{ fontSize:10, color:"#e74c3c", marginTop:6, padding:"5px 7px", background:"rgba(231,76,60,0.1)", borderRadius:3 }}>{cameraError}</div>}
              <div style={{ fontSize:9, color:T.textFaint, marginTop:6, lineHeight:1.4 }}>Hold your phone level above the table for best results.</div>
            </div>
          )}

          {!isMobile && (
            <div style={{ padding:"10px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:T.radius??5, fontSize:10, color:T.textDim, lineHeight:1.5 }}>
              📱 Camera overlay is available on mobile. On desktop, use the board preview to plan your setup.
            </div>
          )}
        </div>

        {/* ── RIGHT: Board view ── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:16, overflow:"auto" }}>

          {/* Board container */}
          <div ref={boardRef} style={{ width:"100%", maxWidth:800, position:"relative" }}>
            <div style={{ position:"relative", width:boardSize.w, height:boardSize.h, margin:"0 auto", background:cameraActive?"transparent":"#1a1a1a", borderRadius:T.radius??6, overflow:"hidden", border:`1px solid ${T.border}` }}>

              {/* Camera video feed */}
              {cameraActive && (
                <video ref={videoRef} autoPlay playsInline muted style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}/>
              )}

              {/* Desktop: crosshatch table grid */}
              {!cameraActive && (
                <svg width={boardSize.w} height={boardSize.h} style={{ position:"absolute", inset:0 }}>
                  <defs>
                    <pattern id="grid" width={boardSize.w/22} height={boardSize.h/15} patternUnits="userSpaceOnUse">
                      <path d={`M ${boardSize.w/22} 0 L 0 0 0 ${boardSize.h/15}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)"/>
                  {/* Inch markers */}
                  {Array.from({length:Math.floor(MISSION_SIZES[size].w)}, (_,i) => i+1).filter(i=>i%6===0).map(i => (
                    <text key={i} x={i/MISSION_SIZES[size].w*boardSize.w} y={boardSize.h-4} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={9} fontFamily="'Cinzel',serif">{i}"</text>
                  ))}
                </svg>
              )}

              {/* Deployment + terrain overlay */}
              <svg ref={overlayRef} width={boardSize.w} height={boardSize.h} style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
                {currentDep && <>
                  {currentDep.zones.map((z,i) => (
                    <rect key={i} x={z.x*boardSize.w} y={z.y*boardSize.h} width={z.w*boardSize.w} height={z.h*boardSize.h} fill={z.color} stroke={z.border} strokeWidth={2} strokeDasharray={i%2===0?"none":"8,4"}/>
                  ))}
                  {currentDep.zones.map((z,i) => (
                    <text key={"zl"+i} x={(z.x+z.w/2)*boardSize.w} y={(z.y+z.h/2)*boardSize.h} textAnchor="middle" dominantBaseline="middle" fill={z.border} fontSize={Math.max(10,boardSize.w/30)} fontFamily="'Cinzel',serif" fontWeight="700" opacity="0.8">{z.label}</text>
                  ))}
                  {currentTerrain.pieces.map((p,i) => {
                    const tc = TERRAIN_COLORS[p.type]||TERRAIN_COLORS.ruin;
                    return (
                      <g key={"tp"+i}>
                        <rect x={p.x*boardSize.w} y={p.y*boardSize.h} width={p.w*boardSize.w} height={p.h*boardSize.h} fill={tc.bg} stroke={tc.border} strokeWidth={1.5} rx={3}/>
                        <text x={(p.x+p.w/2)*boardSize.w} y={(p.y+p.h/2)*boardSize.h} textAnchor="middle" dominantBaseline="middle" fill={tc.border} fontSize={Math.max(7,boardSize.w/55)} fontFamily="'Cinzel',serif" opacity="0.85">{tc.label}</text>
                      </g>
                    );
                  })}
                  {currentDep.objectives.map((obj,i) => {
                    const r=obj.primary?Math.max(14,boardSize.w/28):Math.max(11,boardSize.w/38);
                    return (
                      <g key={"obj"+i}>
                        <circle cx={obj.x*boardSize.w} cy={obj.y*boardSize.h} r={r} fill={obj.primary?"rgba(255,200,0,0.9)":"rgba(255,255,255,0.85)"} stroke={obj.primary?"#f0c000":"#ccc"} strokeWidth={2}/>
                        <text x={obj.x*boardSize.w} y={obj.y*boardSize.h} textAnchor="middle" dominantBaseline="middle" fill="#000" fontSize={Math.max(9,boardSize.w/42)} fontFamily="'Cinzel',serif" fontWeight="700">{obj.label}</text>
                      </g>
                    );
                  })}
                </>}
                {!currentDep && <text x={boardSize.w/2} y={boardSize.h/2} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.2)" fontSize={boardSize.w/20} fontFamily="'Cinzel',serif">Select a deployment →</text>}
              </svg>
            </div>
          </div>

          {/* Info bar */}
          {currentDep && (
            <div style={{ marginTop:12, width:"100%", maxWidth:800, display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center" }}>
              <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:T.radius??5, padding:"6px 12px", fontSize:11, color:T.text }}>
                <span style={{ color:T.textDim }}>Mission: </span>{MISSION_SIZES[size].name}
              </div>
              <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:T.radius??5, padding:"6px 12px", fontSize:11, color:T.text }}>
                <span style={{ color:T.textDim }}>Deployment: </span>{currentDep.name}
              </div>
              <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:T.radius??5, padding:"6px 12px", fontSize:11, color:T.text }}>
                <span style={{ color:T.textDim }}>Terrain: </span>{currentTerrain.name}
              </div>
              <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:T.radius??5, padding:"6px 12px", fontSize:11, color:T.text }}>
                <span style={{ color:T.textDim }}>Objectives: </span>{currentDep.objectives.length}
              </div>
            </div>
          )}

          {/* Screenshot controls */}
          {currentDep && (
            <div style={{ marginTop:10, display:"flex", gap:8 }}>
              <button onClick={takeScreenshot} style={{ padding:"8px 16px", background:T.accent+"22", border:`1px solid ${T.accent}55`, color:T.accentText, borderRadius:T.radius??5, cursor:"pointer", fontSize:11, fontFamily:"var(--app-font)" }}>
                📸 Screenshot
              </button>
              {screenshot && (
                <button onClick={downloadScreenshot} style={{ padding:"8px 16px", background:T.accent, border:"none", color:"#fff", borderRadius:T.radius??5, cursor:"pointer", fontSize:11, fontFamily:"var(--app-font)", fontWeight:600 }}>
                  ⬇ Save Image
                </button>
              )}
            </div>
          )}

          {/* Screenshot preview */}
          {screenshot && (
            <div style={{ marginTop:12, width:"100%", maxWidth:800 }}>
              <img src={screenshot} alt="Table layout" style={{ width:"100%", borderRadius:T.radius??6, border:`1px solid ${T.border}` }}/>
              <div style={{ fontSize:10, color:T.textDim, textAlign:"center", marginTop:4 }}>Share this image with your opponent to set up terrain</div>
            </div>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display:"none" }}/>
    </div>
  );
}