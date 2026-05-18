import { useState, useRef, useEffect } from "react";

// ─── GW PARIAH NEXUS TERRAIN PIECES ──────────────────────────────────────────
// All positions are fractions of a 44"×30" (Incursion) reference board.
// Larger boards scale proportionally. L-shapes drawn as SVG polygons.
// Measurements sourced from GW Chapter Approved 2025-26 Tournament Companion.
//
// Piece types:
//   large_L   = Large ruin L-shape (~10"×10" footprint)
//   small_L   = Small ruin L-shape (~6"×6" footprint)
//   wall      = Short wall/barricade (~4"×1")
//   barricade = Small barricade (~3"×3")

// Draw an L-shape as an SVG polygon.
// dir: "TL"|"TR"|"BL"|"BR" — which corner the L opens toward
// x,y = top-left of bounding box (0-1 fractions), w,h = bounding box fractions
// legW, legH = leg width/height as fraction of bounding box
function lPoints(x, y, w, h, dir, legFrac=0.45, bW, bH) {
  // Returns absolute SVG points string
  const ax = x*bW, ay = y*bH, aw = w*bW, ah = h*bH;
  const lw = aw*legFrac, lh = ah*legFrac;
  switch(dir) {
    case "TL": // L opens top-left — solid bottom-right corner
      return `${ax},${ay} ${ax+aw},${ay} ${ax+aw},${ay+lh} ${ax+lw},${ay+lh} ${ax+lw},${ay+ah} ${ax},${ay+ah}`;
    case "TR": // solid bottom-left
      return `${ax},${ay} ${ax+aw},${ay} ${ax+aw},${ay+ah} ${ax+aw-lw},${ay+ah} ${ax+aw-lw},${ay+lh} ${ax},${ay+lh}`;
    case "BL": // solid top-right
      return `${ax},${ay} ${ax+aw},${ay} ${ax+aw},${ay+ah-lh} ${ax+lw},${ay+ah-lh} ${ax+lw},${ay+ah} ${ax},${ay+ah}`;
    case "BR": // solid top-left — opens bottom-right
      return `${ax+aw-lw},${ay} ${ax+aw},${ay} ${ax+aw},${ay+ah} ${ax},${ay+ah} ${ax},${ay+ah-lh} ${ax+aw-lw},${ay+ah-lh}`;
    default:
      return `${ax},${ay} ${ax+aw},${ay} ${ax+aw},${ay+ah} ${ax},${ay+ah}`;
  }
}

// ─── MISSION SIZES ────────────────────────────────────────────────────────────
const MISSIONS = {
  incursion:   { name:"Incursion",    w:44, h:30, label:'44"×30"' },
  strikeforce: { name:"Strike Force", w:44, h:60, label:'44"×60"' },
  onslaught:   { name:"Onslaught",    w:44, h:90, label:'44"×90"' },
};

// ─── DEPLOYMENTS ─────────────────────────────────────────────────────────────
// zones: player deployment areas as fractions of board
// objectives: marker positions as fractions
const DEPLOYMENTS = {
  // ── INCURSION ──
  inc_sd: {
    name:"Search & Destroy", size:"incursion",
    zones:[
      { label:"Blue",x:0,y:0,w:1,h:0.45,fill:"rgba(59,130,246,0.18)",stroke:"rgba(100,160,255,0.7)" },
      { label:"Red", x:0,y:0.55,w:1,h:0.45,fill:"rgba(239,68,68,0.18)", stroke:"rgba(255,100,100,0.7)" },
    ],
    objectives:[
      { x:0.5,y:0.5,primary:true,label:"A" },
      { x:0.22,y:0.22,label:"B" },{ x:0.78,y:0.22,label:"C" },
      { x:0.22,y:0.78,label:"D" },{ x:0.78,y:0.78,label:"E" },
    ],
  },
  inc_dw: {
    name:"Dawn of War", size:"incursion",
    zones:[
      { label:"Blue",x:0,y:0,w:1,h:0.38,fill:"rgba(59,130,246,0.18)",stroke:"rgba(100,160,255,0.7)" },
      { label:"Red", x:0,y:0.62,w:1,h:0.38,fill:"rgba(239,68,68,0.18)",stroke:"rgba(255,100,100,0.7)" },
    ],
    objectives:[
      { x:0.5,y:0.5,primary:true,label:"A" },
      { x:0.18,y:0.18,label:"B" },{ x:0.82,y:0.18,label:"C" },
      { x:0.18,y:0.82,label:"D" },{ x:0.82,y:0.82,label:"E" },
    ],
  },
  inc_sw: {
    name:"Sweeping Engagement", size:"incursion",
    zones:[
      { label:"Blue",x:0,   y:0.55,w:0.5,h:0.45,fill:"rgba(59,130,246,0.18)",stroke:"rgba(100,160,255,0.7)" },
      { label:"Blue",x:0.5, y:0,   w:0.5,h:0.45,fill:"rgba(59,130,246,0.18)",stroke:"rgba(100,160,255,0.7)" },
      { label:"Red", x:0,   y:0,   w:0.5,h:0.45,fill:"rgba(239,68,68,0.18)", stroke:"rgba(255,100,100,0.7)" },
      { label:"Red", x:0.5, y:0.55,w:0.5,h:0.45,fill:"rgba(239,68,68,0.18)", stroke:"rgba(255,100,100,0.7)" },
    ],
    objectives:[
      { x:0.5,y:0.5,primary:true,label:"A" },
      { x:0.15,y:0.5,label:"B" },{ x:0.85,y:0.5,label:"C" },
      { x:0.5,y:0.18,label:"D" },{ x:0.5,y:0.82,label:"E" },
    ],
  },
  // ── STRIKE FORCE ──
  sf_sd: {
    name:"Search & Destroy", size:"strikeforce",
    zones:[
      { label:"Blue",x:0,y:0,w:1,h:0.38,fill:"rgba(59,130,246,0.18)",stroke:"rgba(100,160,255,0.7)" },
      { label:"Red", x:0,y:0.62,w:1,h:0.38,fill:"rgba(239,68,68,0.18)",stroke:"rgba(255,100,100,0.7)" },
    ],
    objectives:[
      { x:0.5,y:0.5,primary:true,label:"A" },
      { x:0.18,y:0.3,label:"B" },{ x:0.82,y:0.3,label:"C" },
      { x:0.18,y:0.7,label:"D" },{ x:0.82,y:0.7,label:"E" },
      { x:0.5,y:0.18,label:"F" },{ x:0.5,y:0.82,label:"G" },
    ],
  },
  sf_dw: {
    name:"Dawn of War", size:"strikeforce",
    zones:[
      { label:"Blue",x:0,y:0,w:1,h:0.32,fill:"rgba(59,130,246,0.18)",stroke:"rgba(100,160,255,0.7)" },
      { label:"Red", x:0,y:0.68,w:1,h:0.32,fill:"rgba(239,68,68,0.18)",stroke:"rgba(255,100,100,0.7)" },
    ],
    objectives:[
      { x:0.5,y:0.5,primary:true,label:"A" },
      { x:0.15,y:0.5,label:"B" },{ x:0.85,y:0.5,label:"C" },
      { x:0.5,y:0.22,label:"D" },{ x:0.5,y:0.78,label:"E" },
      { x:0.3,y:0.35,label:"F" },{ x:0.7,y:0.65,label:"G" },
    ],
  },
  sf_sw: {
    name:"Sweeping Engagement", size:"strikeforce",
    zones:[
      { label:"Blue",x:0,   y:0.62,w:0.5,h:0.38,fill:"rgba(59,130,246,0.18)",stroke:"rgba(100,160,255,0.7)" },
      { label:"Blue",x:0.5, y:0,   w:0.5,h:0.38,fill:"rgba(59,130,246,0.18)",stroke:"rgba(100,160,255,0.7)" },
      { label:"Red", x:0,   y:0,   w:0.5,h:0.38,fill:"rgba(239,68,68,0.18)", stroke:"rgba(255,100,100,0.7)" },
      { label:"Red", x:0.5, y:0.62,w:0.5,h:0.38,fill:"rgba(239,68,68,0.18)", stroke:"rgba(255,100,100,0.7)" },
    ],
    objectives:[
      { x:0.5,y:0.5,primary:true,label:"A" },
      { x:0.18,y:0.28,label:"B" },{ x:0.82,y:0.28,label:"C" },
      { x:0.18,y:0.72,label:"D" },{ x:0.82,y:0.72,label:"E" },
      { x:0.5,y:0.28,label:"F" },{ x:0.5,y:0.72,label:"G" },
    ],
  },
};

// ─── GW PARIAH NEXUS TERRAIN LAYOUTS ─────────────────────────────────────────
// Based on the 8 official GW layouts from the Pariah Nexus Tournament Companion.
// Pieces use L-shaped polygons matching the actual terrain footprints.
// Positions are fractions of a 44"×30" board.
//
// Each piece: { type, x, y, w, h, dir }
//   type: "large_l" | "small_l" | "wall" | "barricade"
//   dir:  "TL"|"TR"|"BL"|"BR" — which way the L opens
//   x,y,w,h: bounding box fractions of board
//   legFrac: fraction of bounding box that forms each leg (default 0.45)

const TERRAIN_LAYOUTS = [
  {
    name:"No Terrain",
    pieces:[],
  },
  {
    // Layout 1 — symmetric cross pattern, 4 large Ls in corners, central walls
    name:"Layout 1",
    pieces:[
      // Top-left quadrant — large L opening TR
      { type:"large_l", x:0.04,  y:0.05,  w:0.18, h:0.28, dir:"TR" },
      // Top-right — large L opening TL
      { type:"large_l", x:0.78,  y:0.05,  w:0.18, h:0.28, dir:"TL" },
      // Bottom-left — large L opening BR
      { type:"large_l", x:0.04,  y:0.67,  w:0.18, h:0.28, dir:"BR" },
      // Bottom-right — large L opening BL
      { type:"large_l", x:0.78,  y:0.67,  w:0.18, h:0.28, dir:"BL" },
      // Mid-left small L
      { type:"small_l", x:0.28,  y:0.32,  w:0.12, h:0.18, dir:"TR" },
      // Mid-right small L
      { type:"small_l", x:0.60,  y:0.32,  w:0.12, h:0.18, dir:"TL" },
      // Barricades flanking centre
      { type:"barricade", x:0.38, y:0.44,  w:0.08, h:0.07 },
      { type:"barricade", x:0.54, y:0.44,  w:0.08, h:0.07 },
    ],
  },
  {
    // Layout 2 — asymmetric, two U-shapes (pairs of mirrored Ls) mid-field
    name:"Layout 2",
    pieces:[
      // Top corners — small Ls
      { type:"small_l", x:0.05,  y:0.05,  w:0.13, h:0.20, dir:"TR" },
      { type:"small_l", x:0.82,  y:0.05,  w:0.13, h:0.20, dir:"TL" },
      { type:"small_l", x:0.05,  y:0.75,  w:0.13, h:0.20, dir:"BR" },
      { type:"small_l", x:0.82,  y:0.75,  w:0.13, h:0.20, dir:"BL" },
      // Mid U-shape left (two mirrored Ls)
      { type:"large_l", x:0.24,  y:0.25,  w:0.16, h:0.24, dir:"TR" },
      { type:"large_l", x:0.24,  y:0.50,  w:0.16, h:0.24, dir:"BR" },
      // Mid U-shape right
      { type:"large_l", x:0.60,  y:0.25,  w:0.16, h:0.24, dir:"TL" },
      { type:"large_l", x:0.60,  y:0.50,  w:0.16, h:0.24, dir:"BL" },
    ],
  },
  {
    // Layout 3 — diagonal Ls, good for angled sightlines
    name:"Layout 3",
    pieces:[
      { type:"large_l", x:0.03,  y:0.08,  w:0.18, h:0.26, dir:"TR" },
      { type:"large_l", x:0.79,  y:0.66,  w:0.18, h:0.26, dir:"BL" },
      { type:"small_l", x:0.30,  y:0.08,  w:0.13, h:0.20, dir:"BL" },
      { type:"small_l", x:0.57,  y:0.72,  w:0.13, h:0.20, dir:"TR" },
      { type:"large_l", x:0.79,  y:0.08,  w:0.18, h:0.26, dir:"TL" },
      { type:"large_l", x:0.03,  y:0.66,  w:0.18, h:0.26, dir:"BR" },
      { type:"barricade", x:0.44, y:0.44,  w:0.10, h:0.08 },
    ],
  },
  {
    // Layout 4 — central ruin cluster, good for close-quarters
    name:"Layout 4",
    pieces:[
      // Central cluster — large U
      { type:"large_l", x:0.36,  y:0.22,  w:0.16, h:0.22, dir:"TR" },
      { type:"large_l", x:0.48,  y:0.22,  w:0.16, h:0.22, dir:"TL" },
      { type:"large_l", x:0.36,  y:0.56,  w:0.16, h:0.22, dir:"BR" },
      { type:"large_l", x:0.48,  y:0.56,  w:0.16, h:0.22, dir:"BL" },
      // Corner small Ls
      { type:"small_l", x:0.04,  y:0.06,  w:0.14, h:0.20, dir:"TR" },
      { type:"small_l", x:0.82,  y:0.06,  w:0.14, h:0.20, dir:"TL" },
      { type:"small_l", x:0.04,  y:0.74,  w:0.14, h:0.20, dir:"BR" },
      { type:"small_l", x:0.82,  y:0.74,  w:0.14, h:0.20, dir:"BL" },
    ],
  },
];

// Terrain colours
const T_COLORS = {
  large_l:   { fill:"rgba(100,70,30,0.4)",  stroke:"rgba(200,150,70,0.85)",  label:"Large Ruin"  },
  small_l:   { fill:"rgba(80,55,25,0.38)",  stroke:"rgba(180,130,60,0.8)",   label:"Small Ruin"  },
  wall:      { fill:"rgba(70,70,70,0.4)",   stroke:"rgba(160,160,160,0.8)",  label:"Wall"        },
  barricade: { fill:"rgba(60,80,60,0.4)",   stroke:"rgba(120,160,100,0.8)",  label:"Barricade"   },
};

// ─── SVG PIECE RENDERER ───────────────────────────────────────────────────────
function TerrainPiece({ piece, bW, bH }) {
  const tc = T_COLORS[piece.type] || T_COLORS.small_l;
  if (piece.type === "barricade" || piece.type === "wall") {
    // Simple rectangle
    return (
      <g>
        <rect x={piece.x*bW} y={piece.y*bH} width={piece.w*bW} height={piece.h*bH}
          fill={tc.fill} stroke={tc.stroke} strokeWidth={1.5} rx={2}/>
        <text x={(piece.x+piece.w/2)*bW} y={(piece.y+piece.h/2)*bH}
          textAnchor="middle" dominantBaseline="middle"
          fill={tc.stroke} fontSize={Math.max(6,bW/65)} fontFamily="'Cinzel',serif" opacity="0.9">
          {tc.label}
        </text>
      </g>
    );
  }
  // L-shape polygon
  const pts = lPoints(piece.x, piece.y, piece.w, piece.h, piece.dir, piece.legFrac||0.45, bW, bH);
  return (
    <g>
      <polygon points={pts} fill={tc.fill} stroke={tc.stroke} strokeWidth={1.5}/>
      <text x={(piece.x+piece.w/2)*bW} y={(piece.y+piece.h/2)*bH}
        textAnchor="middle" dominantBaseline="middle"
        fill={tc.stroke} fontSize={Math.max(6,bW/65)} fontFamily="'Cinzel',serif" opacity="0.9">
        {tc.label}
      </text>
    </g>
  );
}

// ─── TABLE MODE ───────────────────────────────────────────────────────────────
export default function TableMode({ T, onBack, onSaveLayout }) {
  const [missionKey, setMissionKey]     = useState("strikeforce");
  const [depKey, setDepKey]             = useState(null);
  const [layoutIdx, setLayoutIdx]       = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady]   = useState(false);
  const [cameraError, setCameraError]   = useState(null);
  const [locked, setLocked]             = useState(false);
  const [screenshot, setScreenshot]     = useState(null);

  const videoRef   = useRef();
  const canvasRef  = useRef();
  const overlayRef = useRef();
  const streamRef  = useRef();
  const boardRef   = useRef();

  const [bW, setBW] = useState(600);
  const [bH, setBH] = useState(340);

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Responsive board size
  useEffect(() => {
    function resize() {
      if (!boardRef.current) return;
      const containerW = boardRef.current.getBoundingClientRect().width;
      const ms = MISSIONS[missionKey];
      const aspect = ms.w / ms.h;
      const w = Math.min(containerW, window.innerWidth - 48);
      const h = w / aspect;
      setBW(Math.round(w));
      setBH(Math.round(h));
    }
    resize();
    const ro = new ResizeObserver(resize);
    if (boardRef.current) ro.observe(boardRef.current);
    return () => ro.disconnect();
  }, [missionKey, boardRef.current]);

  // Reset deployment when mission changes
  useEffect(() => { setDepKey(null); setLocked(false); }, [missionKey]);

  // ── Camera ──
  async function startCamera() {
    setCameraError(null); setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:"environment", width:{ideal:1920}, height:{ideal:1080} },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      // Wait for next render then attach stream to video element
    } catch(e) {
      const msg = e.name === "NotAllowedError" ? "Camera permission denied — please allow camera access in your browser settings."
                : e.name === "NotFoundError"   ? "No rear camera found on this device."
                : "Camera error: " + e.message;
      setCameraError(msg);
    }
  }

  // Attach stream to video element after it mounts
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch(() => {});
        setCameraReady(true);
      };
    }
  }, [cameraActive]);

  function stopCamera() {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCameraActive(false); setCameraReady(false);
  }
  useEffect(() => () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); }, []);

  // ── Screenshot ──
  function takeScreenshot() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (cameraActive && videoRef.current && cameraReady) {
      canvas.width  = videoRef.current.videoWidth  || bW;
      canvas.height = videoRef.current.videoHeight || bH;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      canvas.width = bW; canvas.height = bH;
      ctx.fillStyle = "#141414";
      ctx.fillRect(0, 0, bW, bH);
    }
    if (overlayRef.current) {
      const svgStr = new XMLSerializer().serializeToString(overlayRef.current);
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); setScreenshot(canvas.toDataURL("image/jpeg", 0.92)); };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
    } else {
      setScreenshot(canvas.toDataURL("image/jpeg", 0.92));
    }
  }

  function downloadScreenshot() {
    if (!screenshot) return;
    const a = document.createElement("a"); a.href = screenshot; a.download = "dice-of-ruin-table.jpg"; a.click();
  }

  function lockLayout() {
    if (!depKey) return;
    setLocked(true);
    onSaveLayout?.({ missionSize:MISSIONS[missionKey].name, deployment:DEPLOYMENTS[depKey].name, terrain:TERRAIN_LAYOUTS[layoutIdx].name });
  }

  const dep = depKey ? DEPLOYMENTS[depKey] : null;
  const layout = TERRAIN_LAYOUTS[layoutIdx];
  const availDeps = Object.entries(DEPLOYMENTS).filter(([,d]) => d.size === missionKey);

  // Btn helper using theme
  const Tb = ({ children, active, onClick, style={} }) => (
    <button onClick={onClick} style={{ padding:"8px 10px", borderRadius:T.radius??5, cursor:"pointer", border:`1px solid ${active?T.accent:T.border}`, background:active?T.accent+"22":"transparent", color:active?T.accentText:T.text, fontFamily:"var(--app-font)", fontSize:11, textAlign:"left", width:"100%", ...style }}>
      {children}
    </button>
  );

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"var(--app-font)", display:"flex", flexDirection:"column" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", borderBottom:`1px solid ${T.border}`, background:T.headerBg, backdropFilter:"blur(6px)" }}>
        <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${T.border}`, color:T.textDim, borderRadius:T.radius??4, padding:"5px 10px", cursor:"pointer", fontSize:11 }}>← Back</button>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:15, color:T.accent, fontWeight:700, letterSpacing:2 }}>THE TABLE</div>
          <div style={{ fontSize:8, color:T.textDim, letterSpacing:3, textTransform:"uppercase" }}>GW 10th Edition · Matched Play</div>
        </div>
        {dep && !locked && (
          <button onClick={lockLayout} style={{ background:T.accent, border:"none", color:"#fff", borderRadius:T.radius??4, padding:"7px 16px", cursor:"pointer", fontFamily:"var(--app-font)", fontSize:11, fontWeight:700 }}>Lock In</button>
        )}
        {locked && <span style={{ fontSize:11, color:"#5cb85c", border:"1px solid #5cb85c55", borderRadius:4, padding:"6px 10px" }}>Saved</span>}
      </div>

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* ── Controls ── */}
        <div style={{ width:220, flexShrink:0, overflowY:"auto", padding:"12px 10px", borderRight:`1px solid ${T.border}`, background:T.panel+"cc", display:"flex", flexDirection:"column", gap:14 }}>

          {/* Mission size */}
          <div>
            <div style={{ fontSize:8, color:T.textDim, letterSpacing:3, textTransform:"uppercase", marginBottom:6 }}>Mission Size</div>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {Object.entries(MISSIONS).map(([key,ms]) => (
                <Tb key={key} active={missionKey===key} onClick={()=>setMissionKey(key)}>
                  <div style={{ fontWeight:600 }}>{ms.name}</div>
                  <div style={{ fontSize:9, color:missionKey===key?T.accentText:T.textDim }}>{ms.label}</div>
                </Tb>
              ))}
            </div>
          </div>

          {/* Deployment */}
          <div>
            <div style={{ fontSize:8, color:T.textDim, letterSpacing:3, textTransform:"uppercase", marginBottom:6 }}>Deployment</div>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {availDeps.map(([key,d]) => (
                <Tb key={key} active={depKey===key} onClick={()=>{setDepKey(key);setLocked(false);}}>{d.name}</Tb>
              ))}
            </div>
          </div>

          {/* Terrain layout */}
          <div>
            <div style={{ fontSize:8, color:T.textDim, letterSpacing:3, textTransform:"uppercase", marginBottom:6 }}>Terrain Layout</div>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {TERRAIN_LAYOUTS.map((tl,i) => (
                <Tb key={i} active={layoutIdx===i} onClick={()=>{setLayoutIdx(i);setLocked(false);}}>{tl.name}</Tb>
              ))}
            </div>
          </div>

          {/* Camera (mobile only) */}
          {isMobile && (
            <div>
              <div style={{ fontSize:8, color:T.textDim, letterSpacing:3, textTransform:"uppercase", marginBottom:6 }}>Camera</div>
              {!cameraActive
                ? <button onClick={startCamera} style={{ width:"100%", padding:8, background:T.accent+"22", border:`1px solid ${T.accent}55`, color:T.accentText, borderRadius:T.radius??4, cursor:"pointer", fontSize:11 }}>Activate Camera</button>
                : <button onClick={stopCamera}  style={{ width:"100%", padding:8, background:"rgba(231,76,60,0.15)", border:"1px solid #e74c3c55", color:"#e74c3c", borderRadius:T.radius??4, cursor:"pointer", fontSize:11 }}>Stop Camera</button>
              }
              {cameraError && <div style={{ fontSize:9, color:"#e74c3c", marginTop:6, padding:"5px 7px", background:"rgba(231,76,60,0.1)", borderRadius:3 }}>{cameraError}</div>}
              {cameraActive && !cameraReady && <div style={{ fontSize:9, color:T.textDim, marginTop:4 }}>Starting camera...</div>}
              {cameraReady && <div style={{ fontSize:9, color:"#5cb85c", marginTop:4 }}>Camera active — hold level above table</div>}
              <div style={{ fontSize:8, color:T.textFaint, marginTop:6, lineHeight:1.5 }}>Hold phone level above the table. The overlay scales to match your table size.</div>
            </div>
          )}
          {!isMobile && (
            <div style={{ padding:"9px 10px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:T.radius??4, fontSize:10, color:T.textDim, lineHeight:1.5 }}>
              Camera overlay available on mobile. Use this preview to plan your setup.
            </div>
          )}
        </div>

        {/* ── Board ── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:16, overflowY:"auto" }}>
          <div ref={boardRef} style={{ width:"100%", maxWidth:900 }}>

            {/* Board container */}
            <div style={{ position:"relative", width:bW, height:bH, margin:"0 auto", background:cameraActive&&cameraReady?"transparent":"#101010", borderRadius:T.radius??6, overflow:"hidden", border:`1px solid ${T.border}`, boxShadow:`0 4px 24px rgba(0,0,0,0.5)` }}>

              {/* Grid (desktop / no camera) */}
              {(!cameraActive || !cameraReady) && (
                <svg width={bW} height={bH} style={{ position:"absolute", inset:0 }}>
                  <defs>
                    <pattern id="tgrid" width={bW/MISSIONS[missionKey].w*6} height={bH/MISSIONS[missionKey].h*6} patternUnits="userSpaceOnUse">
                      <path d={`M ${bW/MISSIONS[missionKey].w*6} 0 L 0 0 0 ${bH/MISSIONS[missionKey].h*6}`} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#tgrid)"/>
                  {/* 6" interval labels */}
                  {[6,12,18,24,30,36,42].filter(v=>v<MISSIONS[missionKey].w).map(v=>(
                    <text key={v} x={v/MISSIONS[missionKey].w*bW} y={bH-3} textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize={8} fontFamily="'Cinzel',serif">{v}"</text>
                  ))}
                </svg>
              )}

              {/* Camera feed */}
              {cameraActive && (
                <video ref={videoRef} autoPlay playsInline muted webkit-playsinline="true"
                  style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
              )}

              {/* Overlay — deployment zones + terrain + objectives */}
              <svg ref={overlayRef} width={bW} height={bH} style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
                {dep && <>
                  {/* Deployment zones */}
                  {dep.zones.map((z,i)=>(
                    <rect key={i} x={z.x*bW} y={z.y*bH} width={z.w*bW} height={z.h*bH}
                      fill={z.fill} stroke={z.stroke} strokeWidth={2} strokeDasharray={z.label==="Red"?"8,5":"none"}/>
                  ))}
                  {/* Zone labels */}
                  {dep.zones.filter((z,i,arr)=>arr.findIndex(z2=>z2.label===z.label)===i).map((z,i)=>(
                    <text key={"zl"+i} x={(z.x+z.w/2)*bW} y={(z.y+z.h/2)*bH}
                      textAnchor="middle" dominantBaseline="middle"
                      fill={z.stroke} fontSize={Math.max(11,bW/36)} fontFamily="'Cinzel',serif" fontWeight="700" opacity="0.75">
                      {z.label}
                    </text>
                  ))}
                  {/* Terrain */}
                  {layout.pieces.map((p,i) => <TerrainPiece key={i} piece={p} bW={bW} bH={bH}/>)}
                  {/* Objectives */}
                  {dep.objectives.map((obj,i)=>{
                    const r = obj.primary ? Math.max(14,bW/28) : Math.max(10,bW/40);
                    return (
                      <g key={i}>
                        <circle cx={obj.x*bW} cy={obj.y*bH} r={r}
                          fill={obj.primary?"rgba(255,210,0,0.92)":"rgba(240,240,240,0.88)"}
                          stroke={obj.primary?"#f0c000":"#bbb"} strokeWidth={2}/>
                        <text x={obj.x*bW} y={obj.y*bH} textAnchor="middle" dominantBaseline="middle"
                          fill="#000" fontSize={Math.max(8,bW/48)} fontFamily="'Cinzel',serif" fontWeight="700">{obj.label}</text>
                      </g>
                    );
                  })}
                </>}
                {!dep && (
                  <text x={bW/2} y={bH/2} textAnchor="middle" dominantBaseline="middle"
                    fill="rgba(255,255,255,0.18)" fontSize={bW/22} fontFamily="'Cinzel',serif">
                    Select a deployment
                  </text>
                )}
              </svg>
            </div>

            {/* Info strip */}
            {dep && (
              <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap", justifyContent:"center" }}>
                {[
                  [MISSIONS[missionKey].name, "Mission"],
                  [dep.name, "Deployment"],
                  [layout.name, "Terrain"],
                  [dep.objectives.length+" markers", "Objectives"],
                ].map(([val,lbl])=>(
                  <div key={lbl} style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:T.radius??4, padding:"5px 10px", fontSize:10 }}>
                    <span style={{ color:T.textDim }}>{lbl}: </span>
                    <span style={{ color:T.text, fontWeight:600 }}>{val}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Screenshot row */}
            {dep && (
              <div style={{ display:"flex", gap:8, marginTop:10, justifyContent:"center" }}>
                <button onClick={takeScreenshot} style={{ padding:"8px 16px", background:T.panel, border:`1px solid ${T.border}`, color:T.textDim, borderRadius:T.radius??4, cursor:"pointer", fontSize:11 }}>
                  Capture Layout
                </button>
                {screenshot && (
                  <button onClick={downloadScreenshot} style={{ padding:"8px 16px", background:T.accent, border:"none", color:"#fff", borderRadius:T.radius??4, cursor:"pointer", fontSize:11, fontWeight:600 }}>
                    Save Image
                  </button>
                )}
              </div>
            )}

            {screenshot && (
              <div style={{ marginTop:10 }}>
                <img src={screenshot} alt="Table layout" style={{ width:"100%", borderRadius:T.radius??4, border:`1px solid ${T.border}` }}/>
                <div style={{ fontSize:9, color:T.textDim, textAlign:"center", marginTop:4 }}>Share this with your opponent to set up terrain</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display:"none" }}/>
    </div>
  );
}