import { useState, useRef, useEffect } from "react";
import { THEMES, DEFAULT_THEME } from "./data/themes.js";
import { DEFAULT_SETTINGS, FONT_MAP, WCOLORS, ANTI_KW } from "./data/settings.js";
import TableMode from "./components/TableMode.jsx";
import { performRoll, rerollWoundsOnly, rerollSavesOnly, rollD6, rollDmg } from "./systems/dice-engine.js";
import { parseFile } from "./systems/parser.js";
import { playDiceSound, playFreeDiceSound, unlockAudio } from "./systems/sound.js";
import { usePersistedState, loadStorage, saveStorage } from "./hooks/useStorage.js";

// ─── SMALL UTILS ─────────────────────────────────────────────────────────────
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now"; if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`; return `${Math.floor(s / 3600)}h ago`;
}
const FACES = ["","⚀","⚁","⚂","⚃","⚄","⚅"];

// ─── SVG ICONS ───────────────────────────────────────────────────────────────
function Ico({ d, size=18, stroke, fill="none", viewBox="0 0 24 24" }) {
  return <svg width={size} height={size} viewBox={viewBox} fill={fill} stroke={stroke||"currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{__html:d}}/>;
}
const ICO = {
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  stats:   '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>',
  menu:    '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/>',
  swords:  '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 2-2"/><path d="m17 13 2-2"/><path d="m9 5-6 6"/><path d="m5 9-2 2"/><path d="M21 3v3L9.5 17.5"/><path d="m15 5 6 6"/>',
  dice:    '<rect x="2" y="2" width="20" height="20" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><circle cx="15.5" cy="8.5" r="1.5"/><circle cx="8.5" cy="15.5" r="1.5"/><circle cx="15.5" cy="15.5" r="1.5"/>',
  pencil:  '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  close:   '<path d="M18 6 6 18M6 6l12 12"/>',
  check:   '<path d="M20 6 9 17l-5-5"/>',
  table:   '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  camera:  '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/>',
};

// ─── MINI DIE ─────────────────────────────────────────────────────────────────
function MiniDie({ value, success, saveMode, size=26, animate=false, T }) {
  const [show, setShow] = useState(!animate);
  useEffect(() => { if (animate) { const t = setTimeout(() => setShow(true), Math.random()*300+50); return () => clearTimeout(t); }}, [animate]);
  const succBg     = T?.diceSuccessBg     || "rgba(255,255,255,0.13)";
  const succBorder = T?.diceSuccessBorder || "rgba(255,255,255,0.4)";
  const succColor  = T?.diceSuccessColor  || "#ffffff";
  const bg     = saveMode ? (success ? "rgba(92,184,92,0.2)"  : "rgba(231,76,60,0.2)")  : (success ? succBg    : "rgba(0,0,0,0.08)");
  const border = saveMode ? (success ? "#5cb85c88"            : "#e74c3c88")             : (success ? succBorder: "rgba(128,128,128,0.2)");
  const color  = saveMode ? (success ? "#5cb85c"              : "#e74c3c")               : (success ? succColor : T?.textFaint || "#555");
  return (
    <div style={{ width:size, height:size, borderRadius:Math.round(size*0.19), flexShrink:0, background:bg, border:`1px solid ${border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:Math.round(size*0.58), color, fontFamily:"serif", opacity:show?1:0, transform:show?"scale(1)":"scale(0.4)", transition:"opacity 0.2s, transform 0.2s" }}>
      {show ? (FACES[value] || value) : ""}
    </div>
  );
}

// ─── HELPER COMPONENTS ───────────────────────────────────────────────────────
function Card({ children, T, style={} }) {
  return <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:T.radius??8, padding:12, marginBottom:10, ...style }}>{children}</div>;
}
function SLabel({ children, T }) {
  return <div style={{ fontSize:9, color:T.textDim, letterSpacing:3, textTransform:"uppercase", fontFamily:"var(--app-font)", marginBottom:8 }}>{children}</div>;
}
function Btn({ onClick, children, T, style={} }) {
  return <button onClick={onClick} style={{ background:T.panel, border:`1px solid ${T.border}`, color:T.text, borderRadius:T.radius??5, width:28, height:28, cursor:"pointer", fontSize:17, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, ...style }}>{children}</button>;
}
function IconBtn({ icon, count=0, onClick, T, active=false, title="" }) {
  return (
    <button title={title} onClick={onClick} style={{ background:active?T.accent+"22":"transparent", border:`1px solid ${active?T.accent:T.border}`, color:active?T.accentText:T.textDim, padding:"6px 8px", borderRadius:T.radius??5, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:4, position:"relative", transition:"all 0.15s" }}>
      <Ico d={icon} size={16} stroke={active?T.accentText:T.textDim}/>
      {count > 0 && <span style={{ position:"absolute", top:-4, right:-4, background:T.accent, color:"#fff", borderRadius:"50%", width:15, height:15, fontSize:8, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>{count > 9 ? "9+" : count}</span>}
    </button>
  );
}
function Toggle({ label, active, onToggle, T, color }) {
  const c = color || T.accent;
  return (
    <div onClick={onToggle} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", userSelect:"none" }}>
      <div style={{ width:15, height:15, borderRadius:3, flexShrink:0, background:active?c:"transparent", border:`2px solid ${active?c:T.textDim}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
        {active && <Ico d={ICO.check} size={10} stroke={T.bg}/>}
      </div>
      <span style={{ fontSize:10, color:active?c:T.textDim }}>{label}</span>
    </div>
  );
}
function SettingToggle({ label, sublabel, value, onChange, T }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12, color:T.text }}>{label}</div>
        {sublabel && <div style={{ fontSize:9, color:T.textDim, marginTop:2 }}>{sublabel}</div>}
      </div>
      <div onClick={() => onChange(!value)} style={{ width:38, height:22, borderRadius:11, background:value?T.accent:T.border, cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
        <div style={{ position:"absolute", top:3, left:value?19:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.35)" }}/>
      </div>
    </div>
  );
}
function SmallStepper({ value, min, max, onChange, T }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
      <button onClick={() => onChange(Math.max(min, value - 1))} style={{ width:20, height:20, background:T.panel, border:`1px solid ${T.border}`, color:T.text, borderRadius:3, cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
      <span style={{ fontFamily:"var(--app-font)", fontSize:13, color:T.text, minWidth:22, textAlign:"center" }}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} style={{ width:20, height:20, background:T.panel, border:`1px solid ${T.border}`, color:T.text, borderRadius:3, cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
    </div>
  );
}
function ConfirmDialog({ message, detail, confirmLabel="Yes", onConfirm, onCancel, T }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:500, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:T.radius??8, padding:24, maxWidth:320, width:"100%", boxShadow:"0 8px 40px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize:15, color:T.text, fontFamily:"var(--app-font)", marginBottom:8, fontWeight:600 }}>{message}</div>
        {detail && <div style={{ fontSize:11, color:T.textDim, marginBottom:18, lineHeight:1.5 }}>{detail}</div>}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onConfirm} style={{ flex:1, padding:9, background:"rgba(231,76,60,0.2)", border:"1px solid #e74c3c66", color:"#e74c3c", borderRadius:T.radius??5, cursor:"pointer", fontFamily:"var(--app-font)", fontSize:12 }}>{confirmLabel}</button>
          <button onClick={onCancel} style={{ flex:1, padding:9, background:"transparent", border:`1px solid ${T.border}`, color:T.textDim, borderRadius:T.radius??5, cursor:"pointer", fontFamily:"var(--app-font)", fontSize:12 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── LOAD ROSTER DIALOG ──────────────────────────────────────────────────────
function LoadRosterDialog({ T, onLoad, onClose }) {
  const [mode, setMode] = useState(null); // "file" | "text" | "url"
  const [textVal, setTextVal] = useState("");
  const [urlVal, setUrlVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    setLoading(true); setErr(null);
    try { const units = await parseFile(file); onLoad(units, file.name.replace(/\.(rosz?|ros|json|txt)$/i,"")); }
    catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function handleText() {
    if (!textVal.trim()) return;
    setLoading(true); setErr(null);
    try {
      // Try XML first, then JSON
      let units;
      if (textVal.trim().startsWith("<")) {
        const { parseFile: pf } = await import("./systems/parser.js");
        const blob = new Blob([textVal], { type:"text/plain" }); blob.name = "roster.ros";
        units = await pf(Object.assign(blob, {name:"roster.ros"}));
      } else if (textVal.trim().startsWith("{")) {
        const blob = new Blob([textVal], { type:"application/json" });
        units = await parseFile(Object.assign(blob, {name:"roster.json"}));
      } else {
        const blob = new Blob([textVal], { type:"text/plain" });
        units = await parseFile(Object.assign(blob, {name:"roster.txt"}));
      }
      onLoad(units, "Pasted Roster");
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function handleUrl() {
    if (!urlVal.trim()) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(urlVal.trim());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const ext = urlVal.split(".").pop().toLowerCase().split("?")[0];
      const units = await parseFile(Object.assign(blob, {name:`roster.${ext||"ros"}`}));
      onLoad(units, urlVal.split("/").pop() || "Roster");
    } catch(e) { setErr("Could not fetch: " + e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:T.radius??10, padding:22, width:"100%", maxWidth:380, boxShadow:"0 8px 40px rgba(0,0,0,0.6)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div style={{ fontFamily:"var(--app-font)", color:T.text, fontSize:15, fontWeight:600 }}>Load Army Roster</div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:T.textDim, cursor:"pointer", display:"flex" }}><Ico d={ICO.close} size={18}/></button>
        </div>

        {!mode && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {/* File upload */}
            <button onClick={() => fileRef.current.click()} style={{ padding:14, background:T.accent+"18", border:`1px solid ${T.accent}55`, borderRadius:T.radius??7, cursor:"pointer", textAlign:"left", color:T.text }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:3, fontFamily:"var(--app-font)" }}>📁 Upload File</div>
              <div style={{ fontSize:10, color:T.textDim }}>Supports .rosz, .ros, .json — drag from Files app</div>
              <div style={{ fontSize:10, color:T.textFaint, marginTop:2 }}>iOS: rename your file to .txt first if needed</div>
            </button>
            <input ref={fileRef} type="file" accept=".rosz,.ros,.json,.txt" style={{ display:"none" }} onChange={handleFile}/>

            {/* Paste text */}
            <button onClick={() => setMode("text")} style={{ padding:14, background:"transparent", border:`1px solid ${T.border}`, borderRadius:T.radius??7, cursor:"pointer", textAlign:"left", color:T.text }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:3, fontFamily:"var(--app-font)" }}>📋 Paste Roster</div>
              <div style={{ fontSize:10, color:T.textDim }}>Paste raw XML, JSON, or plain text list</div>
            </button>

            {/* URL */}
            <button onClick={() => setMode("url")} style={{ padding:14, background:"transparent", border:`1px solid ${T.border}`, borderRadius:T.radius??7, cursor:"pointer", textAlign:"left", color:T.text }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:3, fontFamily:"var(--app-font)" }}>🔗 URL / Link</div>
              <div style={{ fontSize:10, color:T.textDim }}>Paste a direct link to a hosted roster file</div>
            </button>
          </div>
        )}

        {mode === "text" && (
          <div>
            <textarea value={textVal} onChange={e=>setTextVal(e.target.value)} placeholder="Paste your roster XML, JSON, or text list here..." style={{ width:"100%", height:160, background:T.bg, border:`1px solid ${T.border}`, borderRadius:4, padding:8, color:T.text, fontSize:11, fontFamily:"monospace", resize:"vertical", marginBottom:10 }}/>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={handleText} disabled={loading} style={{ flex:1, padding:9, background:T.accent, border:"none", color:"#fff", borderRadius:T.radius??5, cursor:"pointer", fontFamily:"var(--app-font)", fontSize:12 }}>{loading?"Parsing...":"Parse Roster"}</button>
              <button onClick={() => setMode(null)} style={{ padding:9, background:"transparent", border:`1px solid ${T.border}`, color:T.textDim, borderRadius:T.radius??5, cursor:"pointer" }}>Back</button>
            </div>
          </div>
        )}

        {mode === "url" && (
          <div>
            <input value={urlVal} onChange={e=>setUrlVal(e.target.value)} placeholder="https://..." style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`, borderRadius:4, padding:"8px 10px", color:T.text, fontSize:11, marginBottom:10 }}/>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={handleUrl} disabled={loading} style={{ flex:1, padding:9, background:T.accent, border:"none", color:"#fff", borderRadius:T.radius??5, cursor:"pointer", fontFamily:"var(--app-font)", fontSize:12 }}>{loading?"Fetching...":"Load from URL"}</button>
              <button onClick={() => setMode(null)} style={{ padding:9, background:"transparent", border:`1px solid ${T.border}`, color:T.textDim, borderRadius:T.radius??5, cursor:"pointer" }}>Back</button>
            </div>
          </div>
        )}

        {err && <div style={{ marginTop:10, padding:"7px 10px", background:"rgba(231,76,60,0.15)", border:"1px solid #e74c3c44", borderRadius:4, color:"#e74c3c", fontSize:11 }}>{err}</div>}
        {loading && <div style={{ marginTop:10, fontSize:11, color:T.textDim, textAlign:"center" }}>Processing roster...</div>}
      </div>
    </div>
  );
}

// ─── WEAPON ROW ──────────────────────────────────────────────────────────────
function WeaponRow({ weapon, color, selected, onToggle, T, halfRange, onHalfRange, lanceActive, onLance, blastCount, onBlastCount, showKeywordBadges }) {
  const kw = weapon.kw, a = weapon.attacks;
  const aStr = a.dice > 0 ? `${a.count > 1 ? a.count : ""}D${a.dice}${a.bonus ? "+" + a.bonus : ""}` : String(a.fixed);
  const hasCtx = kw.rapidFire > 0 || kw.melta > 0 || kw.lance || kw.blast || kw.anti || kw.twinLinked;
  return (
    <div style={{ marginBottom:6 }}>
      <div onClick={onToggle} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:T.radius??7, background:selected?`${color.bg}66`:"transparent", border:`1px solid ${selected?color.border:T.border}`, cursor:"pointer", transition:"all 0.12s", boxShadow:selected?`0 0 10px ${color.glow}`:"none" }}>
        <div style={{ width:9, height:9, borderRadius:2, flexShrink:0, background:selected?color.border:T.border, border:`1px solid ${color.border}55` }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, color:selected?color.label:T.text, fontFamily:"var(--app-font)", fontWeight:600 }}>{weapon.name}</div>
          <div style={{ fontSize:10, color:T.textDim, marginTop:1 }}>A:{aStr} · {weapon.isMelee?"WS":"BS"}:{weapon.skill}+ · S:{weapon.strength} · AP:{weapon.ap} · D:{weapon.damage}</div>
          {weapon.keywords && weapon.keywords !== "-" && showKeywordBadges && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:2, marginTop:3 }}>
              {weapon.keywords.split(",").map(k=>k.trim()).filter(Boolean).map((k,i) => (
                <span key={i} style={{ fontSize:8, color:T.textDim, background:T.bg, border:`1px solid ${T.border}`, borderRadius:3, padding:"1px 4px" }}>{k}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      {selected && hasCtx && (
        <div style={{ marginLeft:10, marginTop:3, padding:"7px 9px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:T.radius??5, display:"flex", flexWrap:"wrap", gap:8, alignItems:"center" }}>
          {(kw.rapidFire > 0 || kw.melta > 0) && <Toggle label={`Half range?${kw.rapidFire>0?` +${kw.rapidFire}A`:""}${kw.melta>0?` +${kw.melta}D`:""}`} active={halfRange} onToggle={onHalfRange} T={T} color="#f0a030"/>}
          {kw.lance && <Toggle label="Charged? (Lance +1 to wound)" active={lanceActive} onToggle={onLance} T={T} color="#b07fe8"/>}
          {kw.blast && (
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ fontSize:9, color:T.textDim }}>Blast — enemy:</span>
              <SmallStepper value={blastCount||0} min={0} max={30} onChange={onBlastCount} T={T}/>
              <span style={{ fontSize:8, color:T.textFaint }}>(+{Math.floor((blastCount||0)/5)}A)</span>
            </div>
          )}
          {kw.twinLinked && <span style={{ fontSize:9, color:"#7ec8ff", background:"rgba(126,200,255,0.1)", border:"1px solid rgba(126,200,255,0.25)", borderRadius:3, padding:"2px 6px" }}>Twin-Linked</span>}
          {kw.anti && <span style={{ fontSize:9, color:"#5dffaa", background:"rgba(93,255,170,0.08)", border:"1px solid rgba(93,255,170,0.25)", borderRadius:3, padding:"2px 6px" }}>Anti-{kw.anti.toUpperCase()} {kw.antiValue}+</span>}
        </div>
      )}
    </div>
  );
}

// ─── ROLL RESULT CARD ─────────────────────────────────────────────────────────
function RollResult({ result, weaponName, color, T, alwaysExpand }) {
  const [open, setOpen] = useState(alwaysExpand || false);
  const { hitRolls, woundRolls, saveRolls, damageDealt, rerolledHits, rerolledWounds, numAttacks, hitTarget, woundTarget, effSave, saveIsInvuln, saveNote } = result;
  const hits = woundRolls.length, missedHits = numAttacks - hits;
  const woundsMade = saveRolls.length + damageDealt.length, failedWounds = hits - woundsMade;
  const savedCount = saveRolls.filter(r => r >= effSave).length, unsaved = damageDealt.length;
  const totalDmg = damageDealt.reduce((a,b) => a+b, 0);

  function Step({ label, main, sub, accent }) {
    return (
      <div style={{ textAlign:"center", flex:1, minWidth:0 }}>
        <div style={{ fontSize:8, color:T.textDim, textTransform:"uppercase", letterSpacing:1.5, fontFamily:"var(--app-font)", marginBottom:2, whiteSpace:"nowrap", overflow:"hidden" }}>{label}</div>
        <div style={{ fontSize:20, fontFamily:"var(--app-font)", fontWeight:700, color:accent||T.text, lineHeight:1 }}>{main}</div>
        {sub !== undefined && <div style={{ fontSize:9, color:T.textFaint, marginTop:1 }}>{sub}</div>}
      </div>
    );
  }
  const Arr = () => <div style={{ color:T.textFaint, fontSize:14, flexShrink:0, alignSelf:"center", paddingBottom:12 }}>›</div>;

  return (
    <div style={{ background:T.panel, border:`1px solid ${color.border}33`, borderLeft:`3px solid ${color.border}`, borderRadius:T.radius??10, marginBottom:9, boxShadow:`0 2px 14px ${color.glow}`, overflow:"hidden" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 12px", borderBottom:`1px solid ${T.border}` }}>
        <span style={{ fontFamily:"var(--app-font)", color:color.label, fontSize:12, fontWeight:700 }}>{weaponName}</span>
        <span style={{ fontFamily:"var(--app-font)", fontSize:18, color:totalDmg>0?T.text:T.textFaint, fontWeight:900 }}>{totalDmg}<span style={{ fontSize:10, color:T.textDim, fontWeight:400, marginLeft:3 }}>dmg</span></span>
      </div>
      <div style={{ display:"flex", alignItems:"stretch", padding:"10px 11px 6px", gap:3 }}>
        <Step label="Atk"  main={numAttacks}  sub=" "/><Arr/>
        <Step label={`Hit ${hitTarget}+`} main={hits}  sub={`${missedHits}✗`} accent={color.label}/><Arr/>
        <Step label={`Wnd ${woundTarget}+`} main={woundsMade} sub={`${failedWounds}✗`}/><Arr/>
        <Step label={saveIsInvuln?`Inv ${effSave}+`:`Sv ${effSave}+`} main={savedCount} sub={`${unsaved}✗`} accent={savedCount>0?"#5cb85c":undefined}/><Arr/>
        <Step label="Dmg" main={totalDmg} sub=" " accent={totalDmg>0?"#ff6b6b":T.textFaint}/>
      </div>
      {saveNote && <div style={{ padding:"0 12px 6px", fontSize:9, color:T.textDim }}>{saveNote}</div>}
      <div onClick={() => setOpen(o=>!o)} style={{ padding:"3px 12px 7px", cursor:"pointer" }}>
        <span style={{ fontSize:9, color:T.textFaint, letterSpacing:2, textTransform:"uppercase", fontFamily:"var(--app-font)" }}>{open?"▲ hide":"▼ dice"}</span>
      </div>
      {open && (
        <div style={{ padding:"10px 12px 12px", borderTop:`1px solid ${T.border}`, display:"flex", flexDirection:"column", gap:11 }}>
          <DS label={`Hit rolls — ${hitTarget}+`} note={`${hits}/${numAttacks}${rerolledHits.length?" · "+rerolledHits.length+" rerolled":""}`} T={T}>
            {hitRolls.map((v,i) => <MiniDie key={i} value={v} success={v>=hitTarget} T={T}/>)}
          </DS>
          {woundRolls.length > 0 && <DS label={`Wound rolls — ${woundTarget}+`} note={`${woundsMade}/${woundRolls.length}${rerolledWounds.length?" · "+rerolledWounds.length+" rerolled":""}`} T={T}>
            {woundRolls.map((v,i) => <MiniDie key={i} value={v} success={v>=woundTarget} T={T}/>)}
          </DS>}
          {saveRolls.length > 0 && <DS label={`${saveIsInvuln?"Invuln":"Armour"} saves — ${effSave}+`} note={`${savedCount} saved`} legend={<><span style={{color:"#5cb85c"}}>■</span> saved &nbsp;<span style={{color:"#e74c3c"}}>■</span> failed</>} T={T}>
            {saveRolls.map((v,i) => <MiniDie key={i} value={v} success={v>=effSave} saveMode T={T}/>)}
          </DS>}
          {damageDealt.length > 0 && <DS label="Damage per unsaved wound" note={`${totalDmg} total`} T={T}>
            {damageDealt.map((d,i) => <div key={i} style={{ background:"#160606", border:"1px solid #c0392b44", borderRadius:5, padding:"2px 8px", fontFamily:"var(--app-font)", fontSize:14, color:"#e74c3c" }}>{d}</div>)}
          </DS>}
        </div>
      )}
    </div>
  );
}
function DS({ label, note, legend, children, T }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:9, color:T.textDim, textTransform:"uppercase", letterSpacing:2, fontFamily:"var(--app-font)" }}>{label}</span>
        <span style={{ fontSize:9, color:T.textDim }}>{note}</span>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>{children}</div>
      {legend && <div style={{ fontSize:10, color:T.textDim, marginTop:4 }}>{legend}</div>}
    </div>
  );
}

// ─── FREE DICE ROLLER ─────────────────────────────────────────────────────────
function FreeDiceRoller({ T, open, onClose, soundEnabled }) {
  const [rolls, setRolls] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [cn, setCn] = useState(2);
  const [cs, setCs] = useState(6);
  function doRoll(n, s) {
    setRolling(true); setRolls(null);
    if (soundEnabled) playFreeDiceSound(n);
    setTimeout(() => { const r = []; for (let i=0;i<n;i++) r.push(Math.floor(Math.random()*s)+1); setRolls({dice:r,sides:s}); setRolling(false); }, 250);
  }
  if (!open) return null;
  const total = rolls ? rolls.dice.reduce((a,b)=>a+b,0) : 0;
  return (
    <div style={{ position:"fixed", bottom:80, right:18, zIndex:200, width:300, background:T.panel, border:`1px solid ${T.border}`, borderRadius:T.radius??12, boxShadow:"0 8px 40px rgba(0,0,0,0.65)", overflow:"hidden" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 13px", borderBottom:`1px solid ${T.border}` }}>
        <span style={{ fontFamily:"var(--app-font)", color:T.text, fontSize:12, fontWeight:600, letterSpacing:2, textTransform:"uppercase" }}>Free Roll</span>
        <button onClick={onClose} style={{ background:"transparent", border:"none", color:T.textDim, cursor:"pointer", display:"flex" }}><Ico d={ICO.close} size={16}/></button>
      </div>
      <div style={{ padding:"9px 12px", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ fontSize:8, color:T.textDim, letterSpacing:2, textTransform:"uppercase", marginBottom:7 }}>Quick Roll</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          {[{n:1,s:6,l:"D6"},{n:2,s:6,l:"2D6"},{n:3,s:6,l:"3D6"},{n:5,s:6,l:"5D6"},{n:10,s:6,l:"10D6"},{n:1,s:3,l:"D3"},{n:2,s:3,l:"2D3"}].map(({n,s,l}) => (
            <button key={l} onClick={() => doRoll(n,s)} style={{ background:T.bg, border:`1px solid ${T.border}`, color:T.text, borderRadius:T.radius??4, padding:"5px 9px", cursor:"pointer", fontFamily:"var(--app-font)", fontSize:10, transition:"all 0.1s" }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ padding:"9px 12px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:7 }}>
        <input type="number" min="1" max="99" value={cn} onChange={e=>setCn(Math.max(1,Math.min(99,+e.target.value)))} style={{ width:40, background:T.bg, border:`1px solid ${T.border}`, color:T.text, borderRadius:3, padding:"3px 5px", textAlign:"center", fontSize:11 }}/>
        <span style={{ color:T.textDim, fontSize:13, fontFamily:"var(--app-font)" }}>D</span>
        <input type="number" min="2" max="100" value={cs} onChange={e=>setCs(Math.max(2,Math.min(100,+e.target.value)))} style={{ width:40, background:T.bg, border:`1px solid ${T.border}`, color:T.text, borderRadius:3, padding:"3px 5px", textAlign:"center", fontSize:11 }}/>
        <button onClick={() => doRoll(cn,cs)} style={{ background:T.accent, border:"none", color:"#fff", borderRadius:T.radius??4, padding:"5px 9px", cursor:"pointer", fontFamily:"var(--app-font)", fontSize:10, flex:1 }}>Roll</button>
      </div>
      <div style={{ padding:"11px 13px", minHeight:72 }}>
        {rolling && <div style={{ color:T.textDim, textAlign:"center", fontSize:11, marginTop:8 }}>Rolling...</div>}
        {!rolling && rolls && (<>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>{rolls.dice.map((v,i) => <MiniDie key={i} value={v} success={true} size={32} animate={true} T={T}/>)}</div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
            <span style={{ fontSize:9, color:T.textDim, textTransform:"uppercase", letterSpacing:2 }}>{rolls.dice.length}D{rolls.sides}</span>
            <span style={{ fontFamily:"var(--app-font)", fontSize:20, color:T.accentText, fontWeight:900 }}>{total}</span>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ─── MODEL MANAGER ────────────────────────────────────────────────────────────
function ModelManager({ unit, onUpdate, T, onClose }) {
  const models = unit.models;
  const alive = models.filter(m=>m.alive).length;
  const active = models.filter(m=>m.alive&&m.active).length;
  function toggleAlive(idx)  { onUpdate(models.map((m,i) => i===idx ? {...m,alive:!m.alive,active:false} : m)); }
  function toggleActive(idx) { onUpdate(models.map((m,i) => i===idx&&m.alive ? {...m,active:!m.active} : m)); }
  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"flex-end", justifyContent:"flex-end", pointerEvents:"none" }}>
      <div style={{ width:340, height:"100%", background:T.panel, borderLeft:`1px solid ${T.border}`, boxShadow:"-4px 0 24px rgba(0,0,0,0.6)", pointerEvents:"all", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 14px", borderBottom:`1px solid ${T.border}` }}>
          <div>
            <div style={{ fontFamily:"var(--app-font)", color:T.text, fontSize:13, fontWeight:600 }}>{unit.name}</div>
            <div style={{ fontSize:10, color:T.textDim, marginTop:2 }}>{alive} alive · {active} eligible to shoot</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:T.textDim, cursor:"pointer", display:"flex" }}><Ico d={ICO.close} size={18}/></button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:9 }}>
          {models.map((m,i) => {
            const sc = !m.alive ? T.textFaint : !m.active ? "#f0a030" : "#5cb85c";
            const sl = !m.alive ? "Dead" : !m.active ? "Ineligible" : "Eligible";
            return (
              <div key={m.instanceId||i} style={{ padding:"8px 10px", marginBottom:5, borderRadius:T.radius??6, background:!m.alive?T.bg+"44":"transparent", border:`1px solid ${!m.alive?T.border:m.active?"#5cb85c22":"#f0a03022"}`, opacity:m.alive?1:0.55 }}>
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:[...m.ranged,...m.melee].length?4:0 }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", background:sc, flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:m.alive?T.text:T.textFaint, fontFamily:"var(--app-font)", fontWeight:600 }}>{m.name} #{i+1}</div>
                    <div style={{ fontSize:9, color:sc }}>{sl}</div>
                  </div>
                  {m.alive && <button onClick={() => toggleActive(i)} style={{ background:m.active?"rgba(240,160,48,0.15)":"rgba(92,184,92,0.15)", border:`1px solid ${m.active?"#f0a03055":"#5cb85c55"}`, color:m.active?"#f0a030":"#5cb85c", borderRadius:4, padding:"2px 7px", cursor:"pointer", fontSize:9 }}>{m.active?"Ineligible":"Eligible"}</button>}
                  <button onClick={() => toggleAlive(i)} style={{ background:m.alive?"rgba(231,76,60,0.12)":"rgba(92,184,92,0.12)", border:`1px solid ${m.alive?"#e74c3c44":"#5cb85c44"}`, color:m.alive?"#e74c3c":"#5cb85c", borderRadius:4, padding:"2px 7px", cursor:"pointer", fontSize:9 }}>{m.alive?"Kill":"Revive"}</button>
                </div>
                {[...m.ranged,...m.melee].length > 0 && (
                  <div style={{ paddingLeft:14, display:"flex", flexWrap:"wrap", gap:3 }}>
                    {[...m.ranged,...m.melee].map((w,j) => (
                      <span key={j} style={{ fontSize:8, color:m.alive&&m.active?T.textDim:T.textFaint, background:T.bg, border:`1px solid ${T.border}`, borderRadius:3, padding:"1px 5px", textDecoration:!m.alive?"line-through":"none" }}>{w.name}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── HISTORY PANEL ────────────────────────────────────────────────────────────
function HistoryPanel({ history, onClear, T, onClose }) {
  const [, tick] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => { const id = setInterval(() => tick(n=>n+1), 5000); return () => clearInterval(id); }, []);
  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"flex-end", justifyContent:"flex-end", pointerEvents:"none" }}>
      <div style={{ width:360, height:"100%", background:T.panel, borderLeft:`1px solid ${T.border}`, boxShadow:"-4px 0 24px rgba(0,0,0,0.5)", pointerEvents:"all", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 14px", borderBottom:`1px solid ${T.border}` }}>
          <span style={{ fontFamily:"var(--app-font)", color:T.text, fontSize:13, fontWeight:600, letterSpacing:2, textTransform:"uppercase" }}>Roll History</span>
          <div style={{ display:"flex", gap:8 }}>
            {history.length > 0 && <button onClick={() => setConfirmClear(true)} style={{ background:"rgba(231,76,60,0.15)", border:"1px solid #e74c3c44", color:"#e74c3c", borderRadius:4, padding:"3px 8px", cursor:"pointer", fontSize:9 }}>Clear</button>}
            <button onClick={onClose} style={{ background:"transparent", border:"none", color:T.textDim, cursor:"pointer", display:"flex" }}><Ico d={ICO.close} size={18}/></button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:11 }}>
          {history.length === 0
            ? <div style={{ color:T.textFaint, textAlign:"center", marginTop:40, fontSize:11 }}>No rolls yet</div>
            : [...history].reverse().map((entry,i) => {
                const tot = entry.results.reduce((a,r) => a + r.result.damageDealt.reduce((x,y)=>x+y,0), 0);
                return (
                  <div key={i} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:T.radius??6, padding:"9px 11px", marginBottom:7 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontFamily:"var(--app-font)", color:T.text, fontSize:11, fontWeight:700 }}>{entry.unitName}</span>
                      <span style={{ fontSize:9, color:T.textDim }}>{timeAgo(entry.ts)}</span>
                    </div>
                    <div style={{ fontSize:9, color:T.textDim, marginBottom:5 }}>{entry.phase} · T{entry.targetT} SV{entry.targetSave}+{entry.invulnEnabled?` / inv${entry.invulnSave}+`:""}</div>
                    {entry.results.map((r,j) => {
                      const d = r.result.damageDealt.reduce((a,b)=>a+b,0);
                      return <div key={j} style={{ display:"flex", justifyContent:"space-between", padding:"2px 0", borderBottom:`1px solid ${T.border}` }}><span style={{ fontSize:10, color:r.color.label, fontFamily:"var(--app-font)" }}>{r.weapon.name}</span><span style={{ fontSize:10, color:T.text }}>{r.result.numAttacks}A→{r.result.woundRolls.length}H→<span style={{ color:"#ff6b6b", fontWeight:700 }}>{d}dmg</span></span></div>;
                    })}
                    <div style={{ textAlign:"right", marginTop:4 }}><span style={{ fontFamily:"var(--app-font)", fontSize:13, color:"#ff6b6b", fontWeight:900 }}>{tot}<span style={{ fontSize:9, color:T.textDim, marginLeft:3 }}>dmg</span></span></div>
                  </div>
                );
              })
          }
        </div>
      </div>
      {confirmClear && <ConfirmDialog message="Clear roll history?" detail="All recorded rolls will be deleted. This cannot be undone." confirmLabel="Clear History" onConfirm={() => { onClear(); setConfirmClear(false); }} onCancel={() => setConfirmClear(false)} T={T}/>}
    </div>
  );
}

// ─── STATISTICS PANEL ────────────────────────────────────────────────────────
function StatisticsPanel({ stats, setStats, T, onClose }) {
  const [view, setView] = useState("simple");
  const [showEndGame, setShowEndGame] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const unitKeys = Object.keys(stats.units || {});
  const allGames = stats.games || [];
  let mvpUnit = "", mvpDmg = 0;
  unitKeys.forEach(k => { const u = stats.units[k]; if (u.totalDamage > mvpDmg) { mvpDmg = u.totalDamage; mvpUnit = k; }});
  const maxDmg = unitKeys.reduce((m,k) => Math.max(m, stats.units[k]?.totalDamage||0), 1);

  function endGame() {
    if (!opponent.trim()) return;
    const date = new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
    const ng = { date, opponent:opponent.trim(), units:{...stats.units} };
    const ns = { ...stats, games:[...(stats.games||[]),ng], units:{} };
    setStats(ns); saveStorage("dor_stats",ns); setShowEndGame(false); setOpponent("");
  }
  function clearStats() { const e = {units:{},games:[]}; setStats(e); saveStorage("dor_stats",e); }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"flex-end", justifyContent:"flex-end", pointerEvents:"none" }}>
      <div style={{ width:400, height:"100%", background:T.panel, borderLeft:`1px solid ${T.border}`, boxShadow:"-4px 0 24px rgba(0,0,0,0.6)", pointerEvents:"all", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 14px", borderBottom:`1px solid ${T.border}` }}>
          <span style={{ fontFamily:"var(--app-font)", color:T.text, fontSize:13, fontWeight:600, letterSpacing:2, textTransform:"uppercase" }}>Statistics</span>
          <div style={{ display:"flex", gap:7, alignItems:"center" }}>
            <button onClick={() => setShowEndGame(true)} style={{ background:T.accent+"22", border:`1px solid ${T.accent}55`, color:T.accentText, borderRadius:T.radius??4, padding:"4px 9px", cursor:"pointer", fontSize:10 }}>Game Concluded</button>
            <button onClick={onClose} style={{ background:"transparent", border:"none", color:T.textDim, cursor:"pointer", display:"flex" }}><Ico d={ICO.close} size={18}/></button>
          </div>
        </div>
        {showEndGame && (
          <div style={{ padding:"12px 14px", background:T.bg, borderBottom:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11, color:T.text, marginBottom:6 }}>Who did you play against?</div>
            <input value={opponent} onChange={e=>setOpponent(e.target.value)} placeholder="Opponent name" autoFocus
              style={{ width:"100%", background:T.panel, border:`1px solid ${T.border}`, borderRadius:4, padding:"6px 8px", color:T.text, fontSize:11, marginBottom:8 }}
              onKeyDown={e => e.key==="Enter" && endGame()}/>
            <div style={{ display:"flex", gap:7 }}>
              <button onClick={endGame} style={{ flex:1, padding:8, background:T.accent, border:"none", color:"#fff", borderRadius:T.radius??4, cursor:"pointer", fontSize:11 }}>Save Game</button>
              <button onClick={() => setShowEndGame(false)} style={{ padding:"8px 12px", background:"transparent", border:`1px solid ${T.border}`, color:T.textDim, borderRadius:T.radius??4, cursor:"pointer", fontSize:11 }}>Cancel</button>
            </div>
          </div>
        )}
        <div style={{ display:"flex", borderBottom:`1px solid ${T.border}` }}>
          {["simple","detailed"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ flex:1, padding:8, background:view===v?T.accent+"22":"transparent", border:"none", borderBottom:view===v?`2px solid ${T.accent}`:"2px solid transparent", color:view===v?T.accentText:T.textDim, fontFamily:"var(--app-font)", fontSize:10, textTransform:"uppercase", letterSpacing:2, cursor:"pointer" }}>{v}</button>
          ))}
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:13 }}>
          {unitKeys.length === 0 && allGames.length === 0 && <div style={{ color:T.textFaint, textAlign:"center", marginTop:40, fontSize:11 }}>No data yet — roll some dice!</div>}

          {/* MVP Banner */}
          {mvpUnit && (
            <div style={{ background:`linear-gradient(135deg, ${T.accent}33, ${T.accent}11)`, border:`2px solid ${T.accent}66`, borderRadius:T.radius??10, padding:"14px 16px", marginBottom:14, position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:-10, right:-10, fontSize:60, opacity:0.06 }}>⚔</div>
              <div style={{ fontSize:9, color:T.accent, letterSpacing:4, textTransform:"uppercase", fontFamily:"var(--app-font)", marginBottom:4 }}>⚔ MVP — Most Damage This Session</div>
              <div style={{ fontFamily:"var(--app-font)", color:T.text, fontSize:18, fontWeight:700, marginBottom:2 }}>{mvpUnit.split("|").pop()}</div>
              {mvpUnit.includes("|") && <div style={{ fontSize:9, color:T.textDim }}>{mvpUnit.split("|")[0]}</div>}
              <div style={{ fontSize:28, fontFamily:"var(--app-font)", color:T.accentText, fontWeight:900, marginTop:4 }}>{mvpDmg}<span style={{ fontSize:13, fontWeight:400, marginLeft:4 }}>damage dealt</span></div>
            </div>
          )}

          {unitKeys.length > 0 && <>
            <SLabel T={T}>Current Session</SLabel>
            {unitKeys.map(k => {
              const u = stats.units[k];
              const bw = Math.round((u.totalDamage/maxDmg)*100);
              const displayName = k.includes("|") ? k.split("|").pop() : k;
              const rosterName  = k.includes("|") ? k.split("|")[0]  : null;
              return (
                <div key={k} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:T.radius??6, padding:"9px 11px", marginBottom:7 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
                    <div>
                      <span style={{ fontFamily:"var(--app-font)", color:T.text, fontSize:12, fontWeight:700 }}>{displayName}</span>
                      {rosterName && <div style={{ fontSize:8, color:T.textFaint }}>{rosterName}</div>}
                    </div>
                    <span style={{ fontFamily:"var(--app-font)", fontSize:15, color:"#ff6b6b", fontWeight:900 }}>{u.totalDamage} dmg</span>
                  </div>
                  <div style={{ height:4, background:T.border, borderRadius:2, marginBottom:6, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${bw}%`, background:T.accent, borderRadius:2, transition:"width 0.3s" }}/>
                  </div>
                  {view === "simple" && (
                    <div style={{ display:"flex", gap:12 }}>
                      {[["Acts",u.activations],["Atk",u.totalAttacks],["Hits",u.totalHits],["Wnd",u.totalWounds],["Dmg",u.totalDamage]].map(([l,v]) => (
                        <div key={l} style={{ textAlign:"center" }}><div style={{ fontSize:8, color:T.textDim }}>{l}</div><div style={{ fontFamily:"var(--app-font)", fontSize:13, color:T.text }}>{v||0}</div></div>
                      ))}
                    </div>
                  )}
                  {view === "detailed" && <>
                    <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:6 }}>
                      {[["Acts",u.activations],["Atk",u.totalAttacks],["Hits",u.totalHits],["Wounds",u.totalWounds],["Unsaved",u.totalUnsaved],["Dmg",u.totalDamage]].map(([l,v]) => (
                        <div key={l} style={{ textAlign:"center", minWidth:44 }}><div style={{ fontSize:8, color:T.textDim }}>{l}</div><div style={{ fontFamily:"var(--app-font)", fontSize:12, color:T.text }}>{v||0}</div></div>
                      ))}
                    </div>
                    {u.weapons && Object.entries(u.weapons).map(([wn,wd]) => (
                      <div key={wn} style={{ display:"flex", justifyContent:"space-between", padding:"2px 0", borderBottom:`1px solid ${T.border}` }}>
                        <span style={{ fontSize:9, color:T.textDim }}>{wn}</span>
                        <span style={{ fontSize:9, color:T.text }}>{wd.attacks}A · {wd.hits}H · <span style={{ color:"#ff6b6b" }}>{wd.damage}dmg</span></span>
                      </div>
                    ))}
                    {u.bestRoll !== undefined && <div style={{ fontSize:9, color:T.textDim, marginTop:4 }}>Best: <span style={{ color:T.accentText }}>{u.bestRoll} dmg</span> · Avg: <span style={{ color:T.accentText }}>{u.activations?Math.round(u.totalDamage/u.activations):0} dmg/activation</span></div>}
                  </>}
                </div>
              );
            })}
          </>}

          {allGames.length > 0 && <>
            <SLabel T={T}>Past Games</SLabel>
            {[...allGames].reverse().map((g,i) => {
              const gKeys = Object.keys(g.units||{});
              const gMvp  = gKeys.reduce((best,k) => (!best || g.units[k].totalDamage > g.units[best].totalDamage) ? k : best, "");
              const gTot  = gKeys.reduce((s,k) => s + (g.units[k].totalDamage||0), 0);
              return (
                <div key={i} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:T.radius??6, padding:"9px 11px", marginBottom:7 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <span style={{ fontFamily:"var(--app-font)", color:T.text, fontSize:12, fontWeight:700 }}>vs {g.opponent}</span>
                    <span style={{ fontSize:9, color:T.textDim }}>{g.date}</span>
                  </div>
                  <div style={{ fontSize:10, color:T.textDim }}>Total damage: <span style={{ color:"#ff6b6b", fontWeight:700 }}>{gTot}</span></div>
                  {gMvp && <div style={{ fontSize:9, color:T.accentText }}>⚔ MVP: {gMvp.split("|").pop()} ({g.units[gMvp]?.totalDamage} dmg)</div>}
                </div>
              );
            })}
            <button onClick={() => setConfirmClear(true)} style={{ width:"100%", padding:7, marginTop:4, background:"rgba(231,76,60,0.1)", border:"1px solid #e74c3c44", color:"#e74c3c", cursor:"pointer", borderRadius:T.radius??4, fontSize:10 }}>Clear All Statistics</button>
          </>}
        </div>
      </div>
      {confirmClear && <ConfirmDialog message="Clear all statistics?" detail="All session data and past game records will be permanently deleted." confirmLabel="Clear Statistics" onConfirm={() => { clearStats(); setConfirmClear(false); }} onCancel={() => setConfirmClear(false)} T={T}/>}
    </div>
  );
}

// ─── SETTINGS PANEL (inside Menu) ────────────────────────────────────────────
function SettingsPanel({ T, theme, setTheme, settings, setSetting, rosters, setRosters }) {
  const [section, setSection] = useState(null); // null | "theme" | "typeface" | "display" | "defaults" | "tracking"

  function Section({ id, label, children }) {
    const open = section === id;
    return (
      <div style={{ marginBottom:6 }}>
        <div onClick={() => setSection(open ? null : id)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 12px", background:open?T.accent+"18":T.bg, border:`1px solid ${open?T.accent+"44":T.border}`, borderRadius:T.radius??6, cursor:"pointer", transition:"all 0.15s" }}>
          <span style={{ fontSize:12, color:open?T.accentText:T.text, fontFamily:"var(--app-font)", fontWeight:600 }}>{label}</span>
          <span style={{ color:T.textDim, fontSize:12 }}>{open?"▲":"▼"}</span>
        </div>
        {open && <div style={{ padding:"12px 10px", background:T.panel, border:`1px solid ${T.border}`, borderTop:"none", borderRadius:`0 0 ${T.radius??6}px ${T.radius??6}px`, marginTop:-1 }}>{children}</div>}
      </div>
    );
  }

  return (
    <div>
      <Section id="theme" label="Theme">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
          {Object.entries(THEMES).map(([key,th]) => (
            <button key={key} onClick={() => setTheme(key)} style={{ padding:"8px 4px", borderRadius:th.radius??6, cursor:"pointer", textAlign:"center", border:`2px solid ${theme===key?th.accent:T.border}`, background:th.bg, color:th.text, fontFamily:"'Cinzel',serif", fontSize:9, boxShadow:theme===key?`0 0 10px ${th.glow}`:"none", transition:"all 0.15s" }}>
              <div style={{ width:16, height:3, background:th.accent, borderRadius:2, margin:"0 auto 4px" }}/>
              {th.name}
            </button>
          ))}
        </div>
      </Section>

      <Section id="typeface" label="Typeface">
        <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:12 }}>
          {Object.entries(FONT_MAP).map(([key,fm]) => (
            <button key={key} onClick={() => setSetting("typeface",key)} style={{ padding:"8px 10px", borderRadius:T.radius??4, cursor:"pointer", textAlign:"left", border:`1px solid ${settings.typeface===key?T.accent:T.border}`, background:settings.typeface===key?T.accent+"22":"transparent", color:settings.typeface===key?T.accentText:T.text, fontFamily:fm.css, fontSize:13 }}>{fm.label}</button>
          ))}
        </div>
      </Section>

      <Section id="display" label="Display">
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <SettingToggle label="Compact mode"        sublabel="Tighter spacing for small screens" value={settings.compactMode}       onChange={v=>setSetting("compactMode",v)}       T={T}/>
          <SettingToggle label="Always expand dice"  sublabel="Skip the ▼ tap to see dice"        value={settings.alwaysExpandDice}  onChange={v=>setSetting("alwaysExpandDice",v)}  T={T}/>
          <SettingToggle label="Show keyword badges" sublabel="Tags on weapon rows"                value={settings.showKeywordBadges} onChange={v=>setSetting("showKeywordBadges",v)} T={T}/>
        </div>
      </Section>

      <Section id="defaults" label="Roll Defaults">
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div><div style={{ fontSize:11, color:T.text }}>Default Toughness</div></div>
            <SmallStepper value={settings.defaultToughness} min={1} max={14} onChange={v=>setSetting("defaultToughness",v)} T={T}/>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div><div style={{ fontSize:11, color:T.text }}>Default Armour Save</div></div>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <SmallStepper value={settings.defaultSave} min={0} max={7} onChange={v=>setSetting("defaultSave",v)} T={T}/>
              <span style={{ fontSize:10, color:T.textDim }}>+</span>
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:11, color:T.text }}>Default Phase</div>
            <div style={{ display:"flex", gap:5 }}>
              {["shooting","melee"].map(p => (
                <button key={p} onClick={() => setSetting("defaultPhase",p)} style={{ padding:"3px 9px", borderRadius:T.radius??4, cursor:"pointer", border:`1px solid ${settings.defaultPhase===p?T.accent:T.border}`, background:settings.defaultPhase===p?T.accent+"33":"transparent", color:settings.defaultPhase===p?T.accentText:T.textDim, fontSize:10 }}>{p==="shooting"?"⊙":"⚔"}</button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section id="tracking" label="Tracking">
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <SettingToggle label="Auto-mark fired"        sublabel="Tick ✓ after rolling for a unit"            value={settings.autoMarkFired}  onChange={v=>setSetting("autoMarkFired",v)}  T={T}/>
          <SettingToggle label="Auto-reset on New Turn" sublabel="Clear fired markers each turn"               value={settings.autoResetFired} onChange={v=>setSetting("autoResetFired",v)} T={T}/>
          <SettingToggle label="Track statistics"       sublabel="Your data never leaves this device"         value={settings.trackStats}     onChange={v=>setSetting("trackStats",v)}     T={T}/>
          <SettingToggle label="Dice roll sound"        sublabel="Audio cue when rolling — off by default"    value={settings.diceSound}      onChange={v=>setSetting("diceSound",v)}      T={T}/>
        </div>
      </Section>
    </div>
  );
}

// ─── MENU PANEL ──────────────────────────────────────────────────────────────
function MenuPanel({ T, theme, setTheme, settings, setSetting, rosters, setRosters, onClose }) {
  const [renaming, setRenaming] = useState(null);
  const [nameVal, setNameVal] = useState("");
  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:T.radius??12, padding:18, width:"100%", maxWidth:360, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 8px 40px rgba(0,0,0,0.7)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <span style={{ fontFamily:"var(--app-font)", color:T.text, fontSize:15, fontWeight:700, letterSpacing:2 }}>MENU</span>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:T.textDim, cursor:"pointer", display:"flex" }}><Ico d={ICO.close} size={18}/></button>
        </div>

        <SettingsPanel T={T} theme={theme} setTheme={setTheme} settings={settings} setSetting={setSetting} rosters={rosters} setRosters={setRosters}/>

        <div style={{ height:1, background:T.border, margin:"14px 0" }}/>
        <SLabel T={T}>Account</SLabel>
        <button style={{ width:"100%", padding:8, border:`1px solid ${T.border}`, borderRadius:T.radius??5, background:"transparent", color:T.textDim, fontFamily:"var(--app-font)", fontSize:11, cursor:"not-allowed", opacity:0.45, marginBottom:10 }}>Sign In — Coming Soon</button>
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          <a href="https://ko-fi.com" target="_blank" rel="noreferrer" style={{ flex:1, padding:"8px 0", background:"rgba(255,94,91,0.12)", border:"1px solid rgba(255,94,91,0.4)", color:"#ff6b6b", borderRadius:T.radius??5, cursor:"pointer", fontSize:11, textDecoration:"none", textAlign:"center", fontFamily:"var(--app-font)" }}>☕ Ko-fi</a>
          <a href="mailto:bugs@diceofrain.gg?subject=Bug+Report" style={{ flex:1, padding:"8px 0", background:T.bg, border:`1px solid ${T.border}`, color:T.textDim, borderRadius:T.radius??5, cursor:"pointer", fontSize:11, textDecoration:"none", textAlign:"center", fontFamily:"var(--app-font)" }}>🐛 Bug Report</a>
        </div>

        {rosters.length > 0 && <>
          <SLabel T={T}>Rename Rosters</SLabel>
          {rosters.map((r,i) => (
            <div key={i} style={{ display:"flex", gap:6, alignItems:"center", marginBottom:7 }}>
              {renaming === i
                ? <><input value={nameVal} onChange={e=>setNameVal(e.target.value)} autoFocus style={{ flex:1, background:T.bg, border:`1px solid ${T.border}`, borderRadius:3, padding:"4px 7px", color:T.text, fontSize:11 }} onKeyDown={e=>{if(e.key==="Enter"){setRosters(rs=>rs.map((x,j)=>j===i?{...x,name:nameVal}:x));setRenaming(null);}}}/>
                  <button onClick={()=>{setRosters(rs=>rs.map((x,j)=>j===i?{...x,name:nameVal}:x));setRenaming(null);}} style={{ background:T.accent, border:"none", color:"#fff", borderRadius:3, padding:"3px 7px", cursor:"pointer", fontSize:10 }}>✓</button></>
                : <><span style={{ flex:1, color:T.text, fontSize:11 }}>{r.name}</span>
                  <button onClick={()=>{setRenaming(i);setNameVal(r.name);}} style={{ background:"transparent", border:`1px solid ${T.border}`, color:T.textDim, borderRadius:3, padding:"2px 7px", cursor:"pointer", fontSize:10 }}>rename</button></>
              }
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}

// ─── UNIT ROW ─────────────────────────────────────────────────────────────────
function UnitRow({ u, isSelected, fired, T, onSelect, onLongPress, onFiredToggle, isDragging, dragHandlers, onTouchMoveReorder, onTouchDropReorder, label, unitNum }) {
  const pressTimer = useRef(null);
  const didLong    = useRef(false);
  const [grabbed, setGrabbed] = useState(false);

  function startPress() {
    didLong.current = false;
    pressTimer.current = setTimeout(() => {
      setGrabbed(true);
      setTimeout(() => { didLong.current = true; onLongPress(); setGrabbed(false); }, 300);
    }, 400);
  }
  function endPress() { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } setGrabbed(false); }
  function handleClick() { if (!didLong.current) onSelect(); }

  const displayName = label || u.name;

  return (
    <div
      onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
      onClick={handleClick}
      onTouchStart={() => { didLong.current=false; pressTimer.current=setTimeout(()=>{ didLong.current=true; onLongPress(); if(navigator.vibrate)navigator.vibrate(40); },700); }}
      onTouchMove={e => { if(onTouchMoveReorder){ e.preventDefault(); onTouchMoveReorder(e.touches[0].clientX,e.touches[0].clientY); }}}
      onTouchEnd={() => { endPress(); if(onTouchDropReorder) onTouchDropReorder(); }}
      {...dragHandlers}
      style={{ padding:"8px 10px", userSelect:"none",
        background: isDragging?T.accent+"33" : grabbed?T.accent+"1a" : isSelected?T.accent+"22" : "transparent",
        borderLeft: `3px solid ${isDragging?T.accent:grabbed?T.accent+"88":isSelected?T.accent:"transparent"}`,
        boxShadow: grabbed?`0 4px 16px rgba(0,0,0,0.5),0 0 0 1px ${T.accent}44`:isDragging?`0 6px 20px rgba(0,0,0,0.6)`:"none",
        transform: grabbed?"scale(1.02) translateX(4px)":isDragging?"scale(1.03)":"scale(1)",
        transition: "background 0.1s,border 0.1s,transform 0.15s,box-shadow 0.15s",
        cursor: isDragging?"grabbing":grabbed?"grab":"pointer",
        display:"flex", alignItems:"flex-start", gap:6,
        borderBottom:`1px solid ${T.border}22`, position:"relative", zIndex:grabbed||isDragging?10:"auto",
      }}
    >
      {/* Fired marker */}
      <div onClick={e=>{e.stopPropagation();onFiredToggle();}} style={{ width:14, height:14, borderRadius:3, flexShrink:0, marginTop:2, background:fired?T.accent+"44":"transparent", border:`1.5px solid ${fired?T.accent:T.textFaint}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
        {fired && <Ico d={ICO.check} size={9} stroke={T.accentText}/>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11, fontWeight:600, color:isSelected?T.accentText:T.text, fontFamily:"var(--app-font)", lineHeight:1.3, wordBreak:"break-word", display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" }}>
          {displayName}
          {unitNum && <span style={{ fontSize:8, color:T.textDim, background:T.border+"88", borderRadius:3, padding:"0 4px", fontFamily:"monospace", fontWeight:400 }}>#{unitNum}</span>}
        </div>
        <div style={{ fontSize:8, color:T.textDim, marginTop:2 }}>{u.models.length}m · T{u.models[0]?.stats?.toughness} SV{u.models[0]?.stats?.save}+</div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [appMode, setAppMode]         = useState("roller"); // "roller" | "table"
  // ── Persisted state ──
  const [themeKey, setThemeKey]   = usePersistedState("dor_theme", DEFAULT_THEME);
  const [settings, setSettingsRaw] = usePersistedState("dor_settings", DEFAULT_SETTINGS);
  const [stats, setStatsRaw]      = usePersistedState("dor_stats", {units:{},games:[]});
  const [unitLabels, setUnitLabels] = usePersistedState("dor_unit_labels", {});

  const T = THEMES[themeKey] || THEMES[DEFAULT_THEME];
  function setSetting(key, val) { setSettingsRaw(prev => ({...prev, [key]:val})); }
  function setStats(s) { setStatsRaw(s); }

  // ── Font loading ──
  useEffect(() => {
    const fm = FONT_MAP[settings.typeface || "cinzel"];
    if (!fm?.imp) return;
    const id = "dor-font-" + (settings.typeface || "cinzel");
    if (document.getElementById(id)) return;
    const link = document.createElement("link"); link.id = id; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=" + fm.imp + "&display=swap";
    document.head.appendChild(link);
  }, [settings.typeface]);

  // Apply font as CSS variable
  useEffect(() => {
    const fm = FONT_MAP[settings.typeface || "cinzel"];
    document.documentElement.style.setProperty("--app-font", fm?.css || "'Cinzel', serif");
  }, [settings.typeface]);

  // ── Session state ──
  const [units, setUnits]             = useState([]);
  const [rosters, setRosters]         = useState([]);
  const [activeRoster, setActiveRoster] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [firedUnits, setFiredUnits]   = useState(new Set());
  const [selectedWeapons, setSelectedWeapons] = useState({});
  const [halfRangeMap, setHalfRangeMap]   = useState({});
  const [lanceMap, setLanceMap]           = useState({});
  const [blastCountMap, setBlastCountMap] = useState({});
  const [results, setResults]         = useState([]);
  const [rolling, setRolling]         = useState(false);
  const [targetT, setTargetT]         = useState(() => loadStorage("dor_settings",DEFAULT_SETTINGS).defaultToughness);
  const [targetSave, setTargetSave]   = useState(() => loadStorage("dor_settings",DEFAULT_SETTINGS).defaultSave);
  const [targetKeywords, setTargetKeywords] = useState("");
  const [invulnEnabled, setInvulnEnabled] = useState(false);
  const [invulnSave, setInvulnSave]   = useState(5);
  const [hitMod, setHitMod]           = useState(0);
  const [woundMod, setWoundMod]       = useState(0);
  const [rerollOnesHit, setRerollOnesHit]     = useState(false);
  const [rerollOnesWound, setRerollOnesWound] = useState(false);
  const [phase, setPhase]             = useState(() => loadStorage("dor_settings",DEFAULT_SETTINGS).defaultPhase);
  const [leader, setLeader]           = useState(null);
  const [leaderBuffs, setLeaderBuffs] = useState({ lethalHits:false,devastatingWounds:false,sustainedHits:false,sustainedHitsVal:1,rerollHits:false,rerollWounds:false });
  const [history, setHistory]         = useState([]);
  const [renamingUnitId, setRenamingUnitId] = useState(null);
  const [renameVal, setRenameVal]     = useState("");
  const [dragIdx, setDragIdx]         = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // ── UI panels ──
  const [showUnitSidebar, setShowUnitSidebar] = useState(false);
  const [showHistory, setShowHistory]   = useState(false);
  const [showStats, setShowStats]       = useState(false);
  const [showMenu, setShowMenu]         = useState(false);
  const [showModelMgr, setShowModelMgr] = useState(false);
  const [showDice, setShowDice]         = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [error, setError]               = useState(null);

  // Unlock audio on first interaction
  useEffect(() => { const h = () => unlockAudio(); document.addEventListener("touchstart", h, {once:true}); document.addEventListener("click", h, {once:true}); return () => { document.removeEventListener("touchstart",h); document.removeEventListener("click",h); }; }, []);

  // ── Drag ──
  function unitDragHandlers(i) {
    return {
      draggable:true, "data-unit-index":i,
      onDragStart: e => { e.dataTransfer.effectAllowed="move"; setDragIdx(i); },
      onDragOver:  e => { e.preventDefault(); setDragOverIdx(i); },
      onDrop:      e => { e.preventDefault(); if(dragIdx===null||dragIdx===i){setDragIdx(null);setDragOverIdx(null);return;} const nx=[...units]; const[mv]=nx.splice(dragIdx,1); nx.splice(i,0,mv); setUnits(nx); setDragIdx(null); setDragOverIdx(null); },
      onDragEnd:   () => { setDragIdx(null); setDragOverIdx(null); },
    };
  }
  function touchMoveReorder(cx,cy) { const el=document.elementFromPoint(cx,cy); const row=el?.closest("[data-unit-index]"); if(row){const idx=parseInt(row.getAttribute("data-unit-index"));if(!isNaN(idx))setDragOverIdx(idx);}}
  function touchDropReorder() { if(dragIdx!==null&&dragOverIdx!==null&&dragIdx!==dragOverIdx){const nx=[...units];const[mv]=nx.splice(dragIdx,1);nx.splice(dragOverIdx,0,mv);setUnits(nx);}setDragIdx(null);setDragOverIdx(null);}

  // ── Load ──
  function handleLoad(parsedUnits, rosterName) {
    setRosters(rs => [...rs.filter(r=>r.name!==rosterName), {name:rosterName, units:parsedUnits}]);
    setUnits(parsedUnits); setActiveRoster(rosterName);
    setSelectedUnit(null); setSelectedWeapons({}); setResults([]); setLeader(null); setFiredUnits(new Set());
    setShowLoadDialog(false); setError(null);
  }

  function selectUnit(u) {
    setSelectedUnit({...u, models:u.models.map(m=>({...m,alive:true,active:true}))});
    setSelectedWeapons({}); setResults([]); setLeader(null);
    setHalfRangeMap({}); setLanceMap({}); setBlastCountMap({});
    setLeaderBuffs({lethalHits:false,devastatingWounds:false,sustainedHits:false,sustainedHitsVal:1,rerollHits:false,rerollWounds:false});
    if (window.innerWidth <= 640) setShowUnitSidebar(false);
  }
  function updateModels(newModels) { setSelectedUnit(u => ({...u, models:newModels})); }
  function toggleFired(uid) { setFiredUnits(s => { const ns=new Set(s); if(ns.has(uid))ns.delete(uid); else ns.add(uid); return ns; }); }
  function toggleWeapon(wid,ci) { setSelectedWeapons(prev => { const nw={...prev}; if(nw[wid]!==undefined)delete nw[wid]; else nw[wid]=ci; return nw; }); }

  // ── Computed ──
  const unit = selectedUnit;
  const aliveModels  = unit ? unit.models.filter(m=>m.alive) : [];
  const activeModels = unit ? unit.models.filter(m=>m.alive&&m.active) : [];
  const totalAlive   = aliveModels.length;

  function getWeaponCounts() {
    const map = {};
    const src = leader ? [...activeModels,...leader.models.filter(m=>m.alive!==false&&m.active!==false)] : activeModels;
    for (const m of src) {
      const ws = phase === "shooting" ? m.ranged : m.melee;
      for (const w of ws) { if(map[w.id]) map[w.id].count++; else map[w.id]={weapon:w,count:1}; }
    }
    return Object.values(map);
  }
  const weaponCounts = unit ? getWeaponCounts() : [];

  const antiWeaponsInUnit = weaponCounts.filter(({weapon:w}) => w.kw.anti);
  const antiFromRoster    = antiWeaponsInUnit.map(({weapon:w}) => w.kw.anti.toUpperCase());
  const allAntiKw         = [...new Set([...antiFromRoster,...ANTI_KW])];
  const showAntiDropdown  = antiWeaponsInUnit.length > 0;

  const unitNumMap = {};
  units.forEach(u => {
    const same = units.filter(x => x.name === u.name);
    if (same.length > 1) unitNumMap[u.id] = same.findIndex(x => x.id === u.id) + 1;
  });

  const totalDmg = results.reduce((a,r) => a + r.result.damageDealt.reduce((x,y)=>x+y,0), 0);
  const armorOverridden = invulnEnabled && invulnSave < targetSave;
  const currentFont = FONT_MAP[settings.typeface || "cinzel"]?.css || "'Cinzel', serif";

  // ── Roll ──
  function rollAll() {
    if (!unit || rolling) return;
    if (!activeModels.length) return;
    const toRoll = weaponCounts.filter(({weapon:w}) => selectedWeapons[w.id] !== undefined);
    if (!toRoll.length) return;
    if (settings.diceSound) playDiceSound(toRoll.reduce((a,{count}) => a + count, 0));
    setRolling(true);
    setTimeout(() => {
      const newResults = toRoll.map(({weapon:w,count}) => ({
        weapon:w, color:WCOLORS[selectedWeapons[w.id]%WCOLORS.length],
        result:performRoll({weapon:w,numActiveModels:count,toughness:targetT,armorSave:targetSave,invulnEnabled,invulnSave,halfRange:!!halfRangeMap[w.id],lanceActive:!!lanceMap[w.id],blastEnemyCount:blastCountMap[w.id]??0,hitMod,woundMod,targetKeywords,rerollOnesHit,rerollOnesWound,leaderBuffs}),
      }));
      setResults(newResults);
      if (unit && settings.autoMarkFired) setFiredUnits(s => new Set([...s, unit.id]));
      setHistory(h => [...h.slice(-29), {unitName:unit.name, phase, targetT, targetSave, invulnEnabled, invulnSave, results:newResults, ts:Date.now()}]);
      if (settings.trackStats) {
        const tDmg=newResults.reduce((a,r)=>a+r.result.damageDealt.reduce((x,y)=>x+y,0),0);
        const tAtk=newResults.reduce((a,r)=>a+r.result.numAttacks,0);
        const tHit=newResults.reduce((a,r)=>a+r.result.woundRolls.length,0);
        const tWnd=newResults.reduce((a,r)=>a+r.result.saveRolls.length+r.result.damageDealt.length,0);
        const tUns=newResults.reduce((a,r)=>a+r.result.damageDealt.length,0);
        setStats(prev => {
          const uk = (activeRoster?activeRoster+" | ":"") + unit.name;
          const ex = prev.units[uk] || {activations:0,totalAttacks:0,totalHits:0,totalWounds:0,totalUnsaved:0,totalDamage:0,bestRoll:0,weapons:{}};
          const wp = {...ex.weapons};
          newResults.forEach(r => { const wn=r.weapon.name; const wd=wp[wn]||{attacks:0,hits:0,wounds:0,damage:0}; wp[wn]={attacks:wd.attacks+r.result.numAttacks,hits:wd.hits+r.result.woundRolls.length,wounds:wd.wounds+r.result.saveRolls.length+r.result.damageDealt.length,damage:wd.damage+r.result.damageDealt.reduce((a,b)=>a+b,0)}; });
          const nu = {...ex,activations:ex.activations+1,totalAttacks:ex.totalAttacks+tAtk,totalHits:ex.totalHits+tHit,totalWounds:ex.totalWounds+tWnd,totalUnsaved:ex.totalUnsaved+tUns,totalDamage:ex.totalDamage+tDmg,bestRoll:Math.max(ex.bestRoll||0,tDmg),weapons:wp};
          const ns = {...prev, units:{...prev.units,[uk]:nu}};
          saveStorage("dor_stats",ns); return ns;
        });
      }
      setRolling(false);
    }, 350);
  }

  function doRerollWounds() { setResults(prev => prev.map(r => ({...r, result:rerollWoundsOnly(r.result, r.weapon)}))); }
  function doRerollSaves()  { setResults(prev => prev.map(r => ({...r, result:rerollSavesOnly(r.result, r.weapon)}))); }
  function newTurn() {
    if (settings.autoResetFired) setFiredUnits(new Set());
    if (unit) setSelectedUnit(u => ({...u, models:u.models.map(m=>({...m,active:m.alive?true:false}))}));
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  const overlayClass = T.overlay === "scanlines" ? "theme-scanlines" : T.overlay === "noise" ? "theme-noise" : "";

  return (
    <div className={overlayClass} style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:currentFont, display:"flex", flexDirection:"column" }}>
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, background:`radial-gradient(ellipse at 15% 10%,${T.glow} 0%,transparent 50%),radial-gradient(ellipse at 85% 90%,${T.glow} 0%,transparent 50%)` }}/>

      {/* ── HEADER ── */}
      <header style={{ position:"relative", zIndex:2, borderBottom:`1px solid ${T.border}`, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", background:T.headerBg, backdropFilter:"blur(8px)", flexWrap:"wrap", gap:6 }}>
        <div>
          <div style={{ fontFamily:"'Cinzel Decorative','Cinzel',serif", fontSize:16, color:T.accent, letterSpacing:3, fontWeight:700 }}>⚔ DICE OF RUIN</div>
          <div style={{ fontSize:7, color:T.textDim, letterSpacing:3, textTransform:"uppercase" }}>Tabletop Dice Roller</div>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
          {activeRoster && <span style={{ fontSize:9, color:T.textDim }}>{activeRoster}</span>}
          {units.length > 0 && <button onClick={newTurn} className="forces-hide" style={{ background:T.accent+"22", border:`1px solid ${T.accent}44`, color:T.accentText, padding:"4px 9px", borderRadius:T.radius??4, cursor:"pointer", fontSize:9 }}>New Turn</button>}
          <IconBtn icon={ICO.history} count={history.length} onClick={()=>{setShowHistory(v=>!v);setShowStats(false);setShowMenu(false);}} T={T} active={showHistory} title="Roll History"/>
          <IconBtn icon={ICO.stats}   count={0}              onClick={()=>{setShowStats(v=>!v);setShowHistory(false);setShowMenu(false);}}   T={T} active={showStats}   title="Statistics"/>
          <IconBtn icon={ICO.menu}    count={0}              onClick={()=>{setShowMenu(v=>!v);setShowHistory(false);setShowStats(false);}}    T={T} active={showMenu}    title="Menu"/>
          <button onClick={()=>setAppMode(m=>m==="table"?"roller":"table")} style={{ background:appMode==="table"?T.accent+"33":"transparent", border:`1px solid ${appMode==="table"?T.accent:T.border}`, color:appMode==="table"?T.accentText:T.textDim, padding:"5px 10px", borderRadius:T.radius??4, cursor:"pointer", fontFamily:"var(--app-font)", fontSize:10 }}>🗺 Table</button>
          <button onClick={()=>setShowLoadDialog(true)} style={{ background:T.accent, border:"none", color:"#fff", padding:"5px 12px", borderRadius:T.radius??4, cursor:"pointer", fontFamily:"var(--app-font)", fontSize:10, fontWeight:600 }}>Load</button>
        </div>
      </header>

      {error && <div style={{ background:"#140404", borderBottom:"1px solid #4a1010", padding:"5px 14px", color:"#c0392b", fontSize:11, zIndex:2 }}>{error}</div>}

      {/* ── TABLE MODE ── */}
      {appMode === "table" && (
        <TableMode T={T} onBack={()=>setAppMode("roller")} onSaveLayout={layout=>{
          // Save layout name to current game stats
          saveStorage("dor_last_layout", layout);
        }}/>
      )}
      {appMode !== "table" && <>

      {/* ── OVERLAYS ── */}
      {showLoadDialog && <LoadRosterDialog T={T} onLoad={handleLoad} onClose={()=>setShowLoadDialog(false)}/>}
      {showHistory  && <HistoryPanel history={history} onClear={()=>setHistory([])} T={T} onClose={()=>setShowHistory(false)}/>}
      {showStats    && <StatisticsPanel stats={stats} setStats={setStats} T={T} onClose={()=>setShowStats(false)}/>}
      {showMenu     && <MenuPanel T={T} theme={themeKey} setTheme={setThemeKey} settings={settings} setSetting={setSetting} rosters={rosters} setRosters={setRosters} onClose={()=>setShowMenu(false)}/>}
      {showModelMgr && unit && <ModelManager unit={unit} onUpdate={updateModels} T={T} onClose={()=>setShowModelMgr(false)}/>}
      <FreeDiceRoller T={T} open={showDice} onClose={()=>setShowDice(false)} soundEnabled={settings.diceSound}/>

      {!units.length ? (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", zIndex:1, gap:16, padding:20 }}>
          <div style={{ fontSize:52, filter:"drop-shadow(0 0 20px "+T.glow+")" }}>⚔</div>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:20, color:T.text, letterSpacing:2, textAlign:"center" }}>DICE OF RUIN</div>
          <div style={{ fontSize:12, color:T.textDim, maxWidth:300, textAlign:"center", lineHeight:1.6 }}>Load your army roster to begin rolling. Supports .rosz, .ros, .json and pasted text.</div>
          <button onClick={()=>setShowLoadDialog(true)} style={{ background:T.accent, border:"none", color:"#fff", padding:"12px 28px", borderRadius:T.radius??7, fontSize:14, fontFamily:"var(--app-font)", cursor:"pointer", letterSpacing:2, boxShadow:`0 0 20px ${T.glow}`, fontWeight:600 }}>LOAD ROSTER</button>
        </div>
      ) : (
        <div className={`main-layout${settings.compactMode?" compact-mode":""}`} style={{ display:"flex", flex:1, zIndex:1, overflow:"hidden" }}>

          {/* ── LEFT — Forces sidebar tab + panel ── */}
          {showUnitSidebar && <div className="sidebar-overlay" onClick={()=>setShowUnitSidebar(false)}/>}

          {/* Forces tab button — always visible on left edge on mobile */}
          <button onClick={()=>setShowUnitSidebar(v=>!v)} className="forces-tab" style={{ position:"fixed", left:showUnitSidebar?256:0, top:"50%", transform:"translateY(-50%)", zIndex:51, background:T.accent, border:"none", borderRadius:"0 6px 6px 0", padding:"12px 6px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4, boxShadow:`2px 0 12px ${T.glow}`, transition:"left 0.25s" }}>
            <Ico d={ICO.swords} size={16} stroke="#fff"/>
            <span style={{ fontSize:7, color:"#fff", fontFamily:"var(--app-font)", textTransform:"uppercase", letterSpacing:1, writingMode:"vertical-rl" }}>Forces</span>
          </button>

          <div className={`col-units${showUnitSidebar?" sidebar-open":""}`} style={{ width:190, flexShrink:0, borderRight:`1px solid ${T.border}`, overflowY:"auto", background:T.panel+"ee" }}>
            <div style={{ padding:"9px 10px 5px", fontSize:7, color:T.textDim, letterSpacing:3, textTransform:"uppercase", fontFamily:"var(--app-font)" }}>
              Your Forces <span style={{ opacity:0.4, fontSize:6 }}>· hold to reorder</span>
            </div>
            {units.map((u,i) => (
              <div key={u.id}>
                {dragOverIdx===i && dragIdx!==i && <div style={{ height:2, background:T.accent, margin:"0 10px", borderRadius:1, boxShadow:`0 0 6px ${T.glow}` }}/>}
                <UnitRow u={u} isSelected={selectedUnit?.id===u.id} fired={firedUnits.has(u.id)} T={T}
                  isDragging={dragIdx===i} label={unitLabels[u.id]} unitNum={unitNumMap[u.id]}
                  onSelect={()=>selectUnit(u)} onLongPress={()=>{selectUnit(u);setShowModelMgr(true);}}
                  onFiredToggle={()=>toggleFired(u.id)} dragHandlers={unitDragHandlers(i)}
                  onTouchMoveReorder={touchMoveReorder} onTouchDropReorder={touchDropReorder}/>
              </div>
            ))}
            {units.length > 0 && (
              <div style={{ padding:"6px 10px", borderTop:`1px solid ${T.border}`, marginTop:4 }}>
                <button onClick={newTurn} style={{ width:"100%", padding:4, background:"transparent", border:`1px solid ${T.border}`, color:T.textDim, borderRadius:T.radius??3, cursor:"pointer", fontSize:8 }}>New Turn</button>
              </div>
            )}
          </div>

          {/* ── MIDDLE — Controls ── */}
          <div className="col-controls" style={{ width:340, flexShrink:0, overflowY:"auto", padding:13, borderRight:`1px solid ${T.border}` }}>
            {!unit ? (
              <div style={{ color:T.textFaint, marginTop:60, textAlign:"center", fontSize:12 }}>Select a unit · hold to manage models</div>
            ) : (<>

              {/* Unit header */}
              <div style={{ marginBottom:11 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    {renamingUnitId === unit.id ? (
                      <div style={{ display:"flex", gap:5 }}>
                        <input value={renameVal} onChange={e=>setRenameVal(e.target.value)} autoFocus
                          style={{ flex:1, background:T.bg, border:`1px solid ${T.accent}`, borderRadius:4, padding:"4px 7px", color:T.text, fontSize:12 }}
                          onKeyDown={e=>{ if(e.key==="Enter"){setUnitLabels(prev=>({...prev,[unit.id]:renameVal}));setRenamingUnitId(null);} if(e.key==="Escape"){setRenamingUnitId(null);} }}
                          onBlur={e=>{ if(renameVal.trim()) setUnitLabels(prev=>({...prev,[unit.id]:renameVal.trim()})); setRenamingUnitId(null); }}
                          onClick={e=>e.stopPropagation()}/>
                        <button onClick={()=>{setUnitLabels(prev=>({...prev,[unit.id]:renameVal}));setRenamingUnitId(null);}} style={{ background:T.accent, border:"none", color:"#fff", borderRadius:3, padding:"4px 8px", cursor:"pointer" }}><Ico d={ICO.check} size={12} stroke="#fff"/></button>
                      </div>
                    ) : (
                      <div style={{ fontFamily:"var(--app-font)", fontSize:14, color:T.text, fontWeight:700 }}>{unitLabels[unit.id]||unit.name}</div>
                    )}
                  </div>
                  <div style={{ display:"flex", gap:5, flexShrink:0, marginLeft:8 }}>
                    <button onClick={()=>{setRenamingUnitId(unit.id);setRenameVal(unitLabels[unit.id]||unit.name);}} style={{ background:T.bg, border:`1px solid ${T.border}`, color:T.textDim, borderRadius:T.radius??4, padding:"4px 7px", cursor:"pointer", display:"flex", alignItems:"center" }} title="Rename"><Ico d={ICO.pencil} size={13}/></button>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {unit.models[0]?.stats && <>
                    {[["M",unit.models[0].stats.move],["T",unit.models[0].stats.toughness],["SV",unit.models[0].stats.save+"+"],["W",unit.models[0].stats.wounds],["LD",unit.models[0].stats.leadership]].map(([l,v]) => (
                      <div key={l} style={{ textAlign:"center", minWidth:28 }}>
                        <div style={{ fontSize:7, color:T.textDim, letterSpacing:2, textTransform:"uppercase" }}>{l}</div>
                        <div style={{ fontSize:14, color:T.text, fontFamily:"var(--app-font)", fontWeight:600 }}>{v}</div>
                      </div>
                    ))}
                  </>}
                </div>
              </div>

              {/* Squad status + models button in one card */}
              <Card T={T} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", gap:12 }}>
                    {[["Alive",totalAlive,T.text],["Shooting",activeModels.length,"#5cb85c"],["Dead",unit.models.length-totalAlive,T.textFaint]].map(([l,v,c]) => (
                      <div key={l} style={{ textAlign:"center" }}>
                        <div style={{ fontSize:7, color:T.textDim }}>{l}</div>
                        <div style={{ fontFamily:"var(--app-font)", fontSize:16, color:c, fontWeight:700 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:2, maxWidth:80, justifyContent:"flex-end" }}>
                      {unit.models.map((m,i) => <div key={i} style={{ width:9, height:9, borderRadius:"50%", background:!m.alive?T.textFaint:!m.active?"#f0a030":"#5cb85c" }}/>)}
                    </div>
                    <button onClick={()=>setShowModelMgr(true)} style={{ background:T.bg, border:`1px solid ${T.border}`, color:T.textDim, borderRadius:T.radius??4, padding:"4px 8px", cursor:"pointer", fontSize:9 }}>⚙ Models</button>
                  </div>
                </div>
              </Card>

              {/* Leader */}
              <Card T={T}>
                <SLabel T={T}>Attached Leader</SLabel>
                <select value={leader?.id||""} onChange={e=>{setLeader(units.find(u=>u.id===e.target.value)||null);setLeaderBuffs({lethalHits:false,devastatingWounds:false,sustainedHits:false,sustainedHitsVal:1,rerollHits:false,rerollWounds:false});}} style={{ background:T.bg, border:`1px solid ${T.border}`, color:T.text, padding:"5px 8px", borderRadius:T.radius??4, width:"100%", fontSize:11 }}>
                  <option value="">— None —</option>
                  {units.filter(u=>u!==unit).map(u=><option key={u.id} value={u.id}>{unitLabels[u.id]||u.name}</option>)}
                </select>
              </Card>

              {/* Leader buffs */}
              {leader && (
                <Card T={T}>
                  <SLabel T={T}>Leader buffs — {unitLabels[leader.id]||leader.name}</SLabel>
                  <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                    {[["Lethal Hits","lethalHits"],["Devastating Wounds","devastatingWounds"],["Re-roll hit rolls","rerollHits"],["Re-roll wound rolls","rerollWounds"]].map(([label,field]) => (
                      <Toggle key={field} label={label} active={!!leaderBuffs[field]} onToggle={()=>setLeaderBuffs(prev=>({...prev,[field]:!prev[field]}))} T={T} color={T.accent}/>
                    ))}
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <Toggle label="Sustained Hits" active={!!leaderBuffs.sustainedHits} onToggle={()=>setLeaderBuffs(prev=>({...prev,sustainedHits:!prev.sustainedHits}))} T={T} color={T.accent}/>
                      {leaderBuffs.sustainedHits && <><SmallStepper value={leaderBuffs.sustainedHitsVal||1} min={1} max={6} onChange={v=>setLeaderBuffs(lb=>({...lb,sustainedHitsVal:v}))} T={T}/><span style={{ fontSize:8, color:T.textDim }}>hits</span></>}
                    </div>
                  </div>
                </Card>
              )}

              {/* Phase */}
              <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                {["shooting","melee"].map(p => (
                  <button key={p} onClick={()=>{setPhase(p);setSelectedWeapons({});setResults([]);}} style={{ flex:1, padding:7, borderRadius:T.radius??5, cursor:"pointer", border:`1px solid ${phase===p?T.accent:T.border}`, background:phase===p?T.accent+"22":"transparent", color:phase===p?T.accentText:T.textDim, fontFamily:"var(--app-font)", fontSize:10, textTransform:"uppercase", letterSpacing:2, fontWeight:600 }}>
                    {p==="shooting"?"⊙ Shooting":"⚔ Melee"}
                  </button>
                ))}
              </div>

              {/* Weapons */}
              <div style={{ marginBottom:10 }}>
                <SLabel T={T}>{phase==="shooting"?"Ranged":"Melee"} Weapons</SLabel>
                {weaponCounts.length === 0
                  ? <div style={{ color:T.textFaint, fontSize:11 }}>No {phase} weapons on active models.</div>
                  : weaponCounts.map(({weapon:w, count},i) => (
                      <WeaponRow key={w.id} weapon={w} color={WCOLORS[i%WCOLORS.length]} T={T}
                        selected={selectedWeapons[w.id]!==undefined}
                        onToggle={()=>toggleWeapon(w.id,i%WCOLORS.length)}
                        halfRange={!!halfRangeMap[w.id]} onHalfRange={()=>setHalfRangeMap(m=>({...m,[w.id]:!m[w.id]}))}
                        lanceActive={!!lanceMap[w.id]}   onLance={()=>setLanceMap(m=>({...m,[w.id]:!m[w.id]}))}
                        blastCount={blastCountMap[w.id]??0} onBlastCount={v=>setBlastCountMap(m=>({...m,[w.id]:v}))}
                        showKeywordBadges={settings.showKeywordBadges}/>
                    ))
                }
              </div>

              {/* Target card */}
              <Card T={T}>
                <SLabel T={T}>Target</SLabel>
                <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:10, color:T.text, marginBottom:5, fontWeight:600 }}>Toughness</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <Btn onClick={()=>setTargetT(t=>Math.max(1,t-1))} T={T}>−</Btn>
                      <span style={{ fontFamily:"var(--app-font)", fontSize:20, color:T.text, minWidth:26, textAlign:"center", fontWeight:700 }}>{targetT}</span>
                      <Btn onClick={()=>setTargetT(t=>Math.min(14,t+1))} T={T}>+</Btn>
                    </div>
                  </div>
                  <div style={{ opacity:armorOverridden?0.45:1, transition:"opacity 0.2s" }}>
                    <div style={{ fontSize:10, color:T.text, marginBottom:5, fontWeight:600 }}>Armour Save{armorOverridden&&<span style={{ fontSize:8, color:T.textDim, marginLeft:4 }}>(overridden)</span>}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <Btn onClick={()=>setTargetSave(s=>Math.max(0,s-1))} T={T}>−</Btn>
                      <span style={{ fontFamily:"var(--app-font)", fontSize:20, color:T.text, minWidth:32, textAlign:"center", fontWeight:700 }}>{targetSave}+</span>
                      <Btn onClick={()=>setTargetSave(s=>Math.min(7,s+1))} T={T}>+</Btn>
                    </div>
                  </div>
                </div>

                {/* Invuln */}
                <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:9, marginBottom:9 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:invulnEnabled?7:0 }}>
                    <div onClick={()=>setInvulnEnabled(v=>!v)} style={{ width:16, height:16, borderRadius:3, flexShrink:0, cursor:"pointer", background:invulnEnabled?T.accent:"transparent", border:`2px solid ${invulnEnabled?T.accent:T.textDim}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {invulnEnabled && <Ico d={ICO.check} size={10} stroke="#fff"/>}
                    </div>
                    <span style={{ fontSize:12, color:T.text, cursor:"pointer", fontWeight:600 }} onClick={()=>setInvulnEnabled(v=>!v)}>Invulnerable Save</span>
                  </div>
                  {invulnEnabled && (
                    <div style={{ display:"flex", alignItems:"center", gap:7, paddingLeft:23 }}>
                      <Btn onClick={()=>setInvulnSave(s=>Math.max(2,s-1))} T={T}>−</Btn>
                      <span style={{ fontFamily:"var(--app-font)", fontSize:20, color:T.accentText, minWidth:32, textAlign:"center", fontWeight:700 }}>{invulnSave}+</span>
                      <Btn onClick={()=>setInvulnSave(s=>Math.min(6,s+1))} T={T}>+</Btn>
                      <span style={{ fontSize:9, color:T.textDim }}>ignores AP</span>
                    </div>
                  )}
                </div>

                {/* Anti dropdown */}
                {showAntiDropdown && (
                  <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:9, marginBottom:9 }}>
                    <div style={{ fontSize:10, color:T.text, marginBottom:5, fontWeight:600 }}>Anti-X target keyword</div>
                    <select value={targetKeywords} onChange={e=>setTargetKeywords(e.target.value)} style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`, color:T.text, padding:"5px 7px", borderRadius:T.radius??4, fontSize:11 }}>
                      <option value="">— Select target type —</option>
                      {allAntiKw.map(k=><option key={k} value={k.toLowerCase()}>{k}</option>)}
                    </select>
                  </div>
                )}

                {/* Modifiers */}
                <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:9 }}>
                  {[{label:"Hit modifier",mod:hitMod,setMod:setHitMod},{label:"Wound modifier",mod:woundMod,setMod:setWoundMod}].map(({label,mod,setMod}) => (
                    <div key={label} style={{ marginBottom:8 }}>
                      <div style={{ fontSize:10, color:T.text, marginBottom:4, fontWeight:600 }}>{label}</div>
                      <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                        {[-2,-1,0,1,2].map(v => (
                          <button key={v} onClick={()=>setMod(v)} style={{ padding:"4px 10px", borderRadius:T.radius??4, cursor:"pointer", border:`1px solid ${mod===v?T.accent:T.border}`, background:mod===v?T.accent+"33":"transparent", color:mod===v?T.accentText:T.textDim, fontSize:11, fontWeight:mod===v?700:400 }}>{v>0?"+"+v:v}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginTop:4 }}>
                    <Toggle label="Re-roll 1s to hit"   active={rerollOnesHit}   onToggle={()=>setRerollOnesHit(v=>!v)}   T={T} color={T.accent}/>
                    <Toggle label="Re-roll 1s to wound" active={rerollOnesWound} onToggle={()=>setRerollOnesWound(v=>!v)} T={T} color={T.accent}/>
                  </div>
                </div>
              </Card>

              {/* Roll button */}
              <button onClick={rollAll} disabled={rolling||Object.keys(selectedWeapons).length===0||activeModels.length===0} style={{ width:"100%", padding:"15px 0", background:rolling?T.border:`linear-gradient(135deg,${T.accent}dd,${T.accent})`, border:rolling?`1px solid ${T.border}`:`2px solid ${T.accentText}33`, borderRadius:T.radius??9, color:"#fff", fontFamily:"'Cinzel Decorative','Cinzel',serif", fontSize:15, letterSpacing:4, cursor:rolling?"not-allowed":"pointer", boxShadow:rolling?"none":`0 0 28px ${T.glow},0 4px 16px rgba(0,0,0,0.4)`, textTransform:"uppercase", transition:"all 0.2s", opacity:(Object.keys(selectedWeapons).length===0||activeModels.length===0)?0.35:1, fontWeight:700 }}>
                {rolling ? "Rolling..." : `⚄ Roll — ${activeModels.length} model${activeModels.length!==1?"s":""}`}
              </button>
            </>)}
          </div>

          {/* ── RIGHT — Results ── */}
          <div className="col-results" style={{ flex:1, overflowY:"auto", padding:14 }}>
            {results.length === 0
              ? <div style={{ color:T.textFaint, textAlign:"center", marginTop:80, fontSize:11, letterSpacing:3, textTransform:"uppercase" }}>Select weapons and roll</div>
              : (<>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:10 }}>
                    <span style={{ fontSize:8, color:T.textDim, letterSpacing:3, textTransform:"uppercase" }}>Results</span>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:1 }}>
                      <span style={{ fontSize:10, color:T.textDim }}>{results.reduce((a,r)=>a+r.result.numAttacks,0)} atk · {results.reduce((a,r)=>a+r.result.damageDealt.length,0)} unsaved</span>
                      <span style={{ fontFamily:"var(--app-font)", fontSize:22, color:totalDmg>0?"#ff6b6b":T.textFaint, fontWeight:900 }}>{totalDmg}<span style={{ fontSize:11, color:T.textDim, fontWeight:400, marginLeft:3 }}>damage</span></span>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
                    <button onClick={rollAll}         style={{ flex:1, padding:"6px 8px", background:"transparent", border:`1px solid ${T.border}`, color:T.textDim, fontSize:9, cursor:"pointer", borderRadius:T.radius??4 }}>↺ Reroll All</button>
                    <button onClick={doRerollWounds}  style={{ flex:1, padding:"6px 8px", background:"transparent", border:`1px solid ${T.border}`, color:T.textDim, fontSize:9, cursor:"pointer", borderRadius:T.radius??4 }}>↺ Wounds</button>
                    <button onClick={doRerollSaves}   style={{ flex:1, padding:"6px 8px", background:"transparent", border:`1px solid ${T.border}`, color:T.textDim, fontSize:9, cursor:"pointer", borderRadius:T.radius??4 }}>↺ Saves</button>
                  </div>
                  {results.map((r,i) => <RollResult key={i} result={r.result} weaponName={r.weapon.name} color={r.color} T={T} alwaysExpand={settings.alwaysExpandDice}/>)}
                </>)
            }
          </div>
        </div>
      )}

      </> /* end appMode !== table */}

      {/* Forces tab is always rendered on mobile but hidden on desktop */}
      {/* Floating dice button */}
      <button onClick={()=>setShowDice(v=>!v)} style={{ position:"fixed", bottom:18, right:18, zIndex:150, width:52, height:52, borderRadius:"50%", background:showDice?T.accent:`linear-gradient(135deg,${T.accent}bb,${T.accent})`, border:`2px solid ${T.accentText}33`, color:"#fff", fontSize:22, cursor:"pointer", boxShadow:`0 4px 20px ${T.glow}`, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s" }}>
        <Ico d={ICO.dice} size={22} stroke="#fff"/>
      </button>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=Cinzel:wght@400;600;700&display=swap');
        :root { --app-font: 'Cinzel', serif; }
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; font-family:var(--app-font); font-weight:500; }
        html, body { font-size:16px; background:#000; min-height:100%; }
        #root { min-height:100vh; }
        input, select, textarea, button { font-family:var(--app-font); }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:#333; border-radius:2px; }
        select option { background:#111; }
        button:focus { outline:none; }
        .theme-scanlines::after { content:""; position:fixed; inset:0; pointer-events:none; background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px); z-index:999; }
        .theme-noise::after { content:""; position:fixed; inset:0; pointer-events:none; opacity:0.04; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); z-index:999; }
        .sidebar-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:49; }
        /* Desktop: forces tab always hidden */
        .forces-tab { display:none !important; }
        @media(min-width:1200px){ html { font-size:17px; } }
        @media(max-width:900px) { .col-units { width:170px !important; } .col-controls { width:290px !important; } }
        @media(max-width:640px) {
          .forces-tab { display:flex !important; }
          .forces-hide { display:none !important; }
          .main-layout { flex-direction:column !important; overflow-y:auto !important; overflow-x:hidden !important; }
          .col-units { display:none !important; }
          .col-units.sidebar-open { display:flex !important; flex-direction:column !important; position:fixed !important; left:0 !important; top:0 !important; height:100% !important; width:270px !important; z-index:50 !important; max-height:none !important; box-shadow:4px 0 24px rgba(0,0,0,0.8) !important; }
          .col-controls { width:100% !important; border-right:none !important; border-bottom:1px solid #333; max-width:100vw; }
          .col-results { width:100% !important; min-height:200px; padding:10px !important; }
        }
        .compact-mode .col-controls { padding:7px !important; }
        .compact-mode .col-results { padding:7px !important; }
      `}</style>
    </div>
  );
}