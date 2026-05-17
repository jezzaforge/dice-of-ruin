import { useState, useRef, useEffect, useCallback } from "react";

// ─── JSZIP ────────────────────────────────────────────────────────────────────
function loadJSZip() {
  return new Promise((resolve, reject) => {
    if (window.JSZip) { resolve(window.JSZip); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = () => resolve(window.JSZip); s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ─── THEMES ───────────────────────────────────────────────────────────────────
const THEMES = {
  blood:     { name:"Blood Gothic", bg:"#090909", panel:"#0d0d0f", border:"#1e1e1e", accent:"#c0392b", accentText:"#ff6b6b", text:"#ffffff", textDim:"#999999", textFaint:"#444444", headerBg:"rgba(0,0,0,0.85)", glow:"rgba(192,57,43,0.3)" },
  steel:     { name:"Steel Forge",  bg:"#111418", panel:"#181c22", border:"#2a3040", accent:"#5588cc", accentText:"#88bbff", text:"#ffffff", textDim:"#8899aa", textFaint:"#334455", headerBg:"rgba(10,14,20,0.9)",  glow:"rgba(60,100,180,0.3)" },
  parchment: { name:"Parchment",    bg:"#f0ede6", panel:"#faf8f4", border:"#d5cfc5", accent:"#8b1a1a", accentText:"#6b0e0e", text:"#1a1a1a", textDim:"#666666", textFaint:"#aaaaaa", headerBg:"rgba(240,237,230,0.95)", glow:"rgba(139,26,26,0.15)" },
  void:      { name:"Void Blue",    bg:"#05080f", panel:"#080c18", border:"#101828", accent:"#1a5fc0", accentText:"#60a0ff", text:"#ffffff", textDim:"#5577aa", textFaint:"#1e2e44", headerBg:"rgba(4,6,14,0.92)",   glow:"rgba(26,95,192,0.35)" },
};

const WCOLORS = [
  { bg:"#7b1c1c", border:"#e74c3c", glow:"rgba(231,76,60,0.4)",   label:"#ff6b6b" },
  { bg:"#1a4a7a", border:"#4fa3e0", glow:"rgba(79,163,224,0.4)",  label:"#7ec8ff" },
  { bg:"#4a2370", border:"#b07fe8", glow:"rgba(176,127,232,0.4)", label:"#d4a8ff" },
  { bg:"#1a5c38", border:"#3ecf78", glow:"rgba(62,207,120,0.4)",  label:"#5dffaa" },
  { bg:"#7a4d10", border:"#f0a030", glow:"rgba(240,160,48,0.4)",  label:"#ffc055" },
  { bg:"#5c1a3a", border:"#f060b0", glow:"rgba(240,96,176,0.4)",  label:"#ff90d0" },
];

// ─── KEYWORD PARSER ───────────────────────────────────────────────────────────
function parseKeywords(kwStr) {
  const kw = (kwStr||"").toLowerCase();
  const r = {
    torrent: kw.includes("torrent"), lethalHits: kw.includes("lethal hits"),
    devastatingWounds: kw.includes("devastating wounds"), lance: kw.includes("lance"),
    blast: kw.includes("blast"), twinLinked: kw.includes("twin-linked")||kw.includes("twin linked"),
    rapidFire:0, sustainedHits:0, melta:0, anti:null, antiValue:0,
  };
  const rf=kw.match(/rapid fire (\d+)/i); if(rf) r.rapidFire=parseInt(rf[1]);
  const sh=kw.match(/sustained hits (\d+)/i); if(sh) r.sustainedHits=parseInt(sh[1]);
  const me=kw.match(/melta (\d+)/i); if(me) r.melta=parseInt(me[1]);
  const an=kw.match(/anti-(\w+) (\d+)\+/i); if(an){r.anti=an[1];r.antiValue=parseInt(an[2]);}
  return r;
}

// ─── PARSER ───────────────────────────────────────────────────────────────────
function parseRosz(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText,"text/xml");
  const qAll = (el,sel) => [...el.querySelectorAll(sel)];
  const charVal = (p,n) => { for(const c of qAll(p,"characteristic")) if(c.getAttribute("name")===n) return c.textContent.trim(); return null; };
  const parseAtk = v => { if(!v) return {fixed:1,dice:0,count:0,bonus:0}; v=v.trim(); const m=v.match(/^(\d*)D(\d+)(?:\+(\d+))?$/i); return m?{fixed:0,dice:parseInt(m[2])||6,count:parseInt(m[1])||1,bonus:parseInt(m[3])||0}:{fixed:parseInt(v)||1,dice:0,count:0,bonus:0}; };
  const parseSkill = v => { if(!v||v==="N/A") return 4; const m=v.match(/(\d+)\+/); return m?parseInt(m[1]):4; };
  const parseSave  = v => { if(!v) return 7; const m=v.match(/(\d+)\+/); return m?parseInt(m[1]):7; };

  function extractWeapons(el, typeName) {
    return qAll(el,"profile").filter(p=>p.getAttribute("typeName")===typeName).map(p=>{
      const isMelee=typeName==="Melee Weapons", kwRaw=charVal(p,"Keywords")||"";
      return { id:p.getAttribute("id")||Math.random().toString(36),
        name:(p.getAttribute("name")||"Unknown").replace(/^➤\s*/,""),
        isMelee, attacks:parseAtk(charVal(p,"A")), skill:parseSkill(charVal(p,isMelee?"WS":"BS")),
        strength:parseInt(charVal(p,"S"))||4, ap:parseInt(charVal(p,"AP"))||0,
        damage:charVal(p,"D")||"1", keywords:kwRaw, kw:parseKeywords(kwRaw) };
    });
  }

  function extractStats(el) {
    for(const p of qAll(el,"profile"))
      if(p.getAttribute("typeName")==="Unit")
        return {move:charVal(p,"M"),toughness:parseInt(charVal(p,"T"))||4,save:parseSave(charVal(p,"SV")),wounds:parseInt(charVal(p,"W"))||1,leadership:charVal(p,"LD")};
    return null;
  }

  // Collect weapons from a selection AND its upgrade children
  function collectWeapons(sel) {
    const ranged=extractWeapons(sel,"Ranged Weapons"), melee=extractWeapons(sel,"Melee Weapons");
    for(const c of qAll(sel,"selections > selection")) {
      ranged.push(...extractWeapons(c,"Ranged Weapons")); melee.push(...extractWeapons(c,"Melee Weapons"));
    }
    return {ranged,melee};
  }

  const units=[]; const force=doc.querySelector("force"); if(!force) return units;

  for(const sel of qAll(force,"selections > selection")) {
    const type=sel.getAttribute("type"), uName=sel.getAttribute("name");
    const unitStats = extractStats(sel); // unit-level stats (fallback for child models)

    if(type==="unit") {
      const models=[];
      for(const c of qAll(sel,"selections > selection")) {
        if(c.getAttribute("type")!=="model") continue;
        const count=parseInt(c.getAttribute("number")||"1");
        const stats=extractStats(c)||unitStats;
        if(!stats) continue;
        const {ranged,melee}=collectWeapons(c);
        const mName=c.getAttribute("name")||uName;
        for(let i=0;i<count;i++) models.push({
          instanceId:`${c.getAttribute("id")||mName}-${i}`,
          name:mName, stats, ranged, melee, alive:true, active:true, fired:false,
        });
      }
      // Fallback: unit has no model children — treat as single model
      if(models.length===0 && unitStats) {
        const {ranged,melee}=collectWeapons(sel);
        const count=parseInt(sel.getAttribute("number")||"1");
        for(let i=0;i<count;i++) models.push({
          instanceId:`${sel.getAttribute("id")||uName}-${i}`,
          name:uName, stats:unitStats, ranged, melee, alive:true, active:true, fired:false,
        });
      }
      if(models.length>0) units.push({id:sel.getAttribute("id")||uName, name:uName, models});

    } else if(type==="model") {
      if(!unitStats) continue;
      const {ranged,melee}=collectWeapons(sel);
      const count=parseInt(sel.getAttribute("number")||"1");
      const models=[];
      for(let i=0;i<count;i++) models.push({
        instanceId:`${sel.getAttribute("id")||uName}-${i}`,
        name:uName, stats:unitStats, ranged, melee, alive:true, active:true, fired:false,
      });
      units.push({id:sel.getAttribute("id")||uName, name:uName, models});
    }
  }
  return units;
}

// ─── DICE ENGINE ──────────────────────────────────────────────────────────────
const rollD6=()=>Math.floor(Math.random()*6)+1;
function rollN(sides,count=1){let t=0;for(let i=0;i<count;i++)t+=Math.floor(Math.random()*sides)+1;return t;}
function rollAttacks(a){if(a.dice>0){let t=a.bonus;for(let i=0;i<(a.count||1);i++)t+=Math.floor(Math.random()*a.dice)+1;return t;}return a.fixed;}
function rollDmg(s){const m=s?.match(/^(\d*)D(\d+)(?:\+(\d+))?$/i);if(m){let t=parseInt(m[3])||0;for(let i=0;i<(parseInt(m[1])||1);i++)t+=Math.floor(Math.random()*(parseInt(m[2])||6))+1;return t;}return parseInt(s)||1;}

function performRoll({weapon,numActiveModels,toughness,armorSave,invulnEnabled,invulnSave,halfRange,lanceActive,blastEnemyCount,hitMod,woundMod,targetKeywords,rerollOnesHit,rerollOnesWound,leaderBuffs}){
  const kw=weapon.kw, lb=leaderBuffs||{};
  const hasLethal=kw.lethalHits||lb.lethalHits;
  const hasDev=kw.devastatingWounds||lb.devastatingWounds;
  const hasSust=kw.sustainedHits>0||lb.sustainedHits;
  const sustVal=lb.sustainedHits?(lb.sustainedHitsVal||1):kw.sustainedHits;
  const hasRerollHits=lb.rerollHits;
  const hasRerollWounds=kw.twinLinked||lb.rerollWounds;

  let baseAttacks=rollAttacks(weapon.attacks);
  if(kw.rapidFire>0&&halfRange) baseAttacks+=kw.rapidFire;
  if(kw.blast) baseAttacks+=Math.floor(((blastEnemyCount||5)-1)/5);
  const numAttacks=baseAttacks*numActiveModels;

  const hitTarget=Math.min(6,Math.max(2,weapon.skill-hitMod));
  const s=weapon.strength,t=toughness;
  const baseWT=s>=t*2?2:s>t?3:s===t?4:s*2<=t?6:5;
  const woundTarget=Math.min(6,Math.max(2,(kw.lance&&lanceActive?baseWT-1:baseWT)-woundMod));

  const ap=Math.abs(weapon.ap);
  const modArmor=Math.min(7,armorSave+ap);
  const effSave=invulnEnabled?Math.min(modArmor,invulnSave):modArmor;
  const saveIsInvuln=invulnEnabled&&invulnSave<modArmor;

  const hitRolls=[],woundRolls=[],saveRolls=[],damageDealt=[],rerolledHits=[],rerolledWounds=[];
  const antiMatch=kw.anti&&targetKeywords&&targetKeywords.toLowerCase().includes(kw.anti.toLowerCase());

  for(let i=0;i<numAttacks;i++){
    let roll=kw.torrent?6:rollD6();
    if(!kw.torrent&&rerollOnesHit&&roll===1){rerolledHits.push(roll);roll=rollD6();}
    if(!kw.torrent&&hasRerollHits&&roll<hitTarget){rerolledHits.push(roll);roll=rollD6();}
    hitRolls.push(roll);
    let hits=(kw.torrent||roll>=hitTarget)?1:0;
    if(roll===6&&hasSust) hits+=sustVal;

    for(let h=0;h<hits;h++){
      let wRoll=rollD6();
      if(rerollOnesWound&&wRoll===1){rerolledWounds.push(wRoll);wRoll=rollD6();}
      if(hasRerollWounds&&wRoll<woundTarget){rerolledWounds.push(wRoll);wRoll=rollD6();}
      woundRolls.push(wRoll);
      const autoWound=hasLethal&&wRoll===6;
      const devWound=hasDev&&wRoll===6;
      const antiCrit=antiMatch&&wRoll>=kw.antiValue;
      const normalWound=wRoll>=woundTarget;
      if(autoWound||devWound||antiCrit||normalWound){
        if(devWound||(antiCrit&&!normalWound)){
          damageDealt.push(rollDmg(weapon.damage));
        } else {
          const sRoll=rollD6(); saveRolls.push(sRoll);
          if(sRoll<effSave){let dmg=rollDmg(weapon.damage);if(kw.melta>0&&halfRange)dmg+=rollN(6,kw.melta);damageDealt.push(dmg);}
        }
      }
    }
  }
  return{hitRolls,woundRolls,saveRolls,damageDealt,rerolledHits,rerolledWounds,numAttacks,hitTarget,woundTarget,effSave,modArmor,saveIsInvuln,baseAttacks};
}

// ─── TIME AGO ─────────────────────────────────────────────────────────────────
function timeAgo(ts){const s=Math.floor((Date.now()-ts)/1000);if(s<5)return"just now";if(s<60)return`${s}s ago`;if(s<3600)return`${Math.floor(s/60)}m ago`;return`${Math.floor(s/3600)}h ago`;}

// ─── STORAGE ──────────────────────────────────────────────────────────────────
function loadStorage(key,def){try{const v=localStorage.getItem(key);return v?JSON.parse(v):def;}catch{return def;}}
function saveStorage(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch{}}

// ─── FACES ────────────────────────────────────────────────────────────────────
const FACES=["","⚀","⚁","⚂","⚃","⚄","⚅"];

// ─── MINI DIE ─────────────────────────────────────────────────────────────────
function MiniDie({value,success,saveMode,size=26,animate=false}){
  const[show,setShow]=useState(!animate);
  useEffect(()=>{if(animate){const t=setTimeout(()=>setShow(true),Math.random()*300+50);return()=>clearTimeout(t);}},[animate]);
  const bg=saveMode?(success?"rgba(92,184,92,0.2)":"rgba(231,76,60,0.2)"):(success?"rgba(255,255,255,0.13)":"rgba(255,255,255,0.02)");
  const border=saveMode?(success?"#5cb85c88":"#e74c3c88"):(success?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.07)");
  const color=saveMode?(success?"#5cb85c":"#e74c3c"):(success?"#ffffff":"#333333");
  return<div style={{width:size,height:size,borderRadius:Math.round(size*0.19),flexShrink:0,background:bg,border:`1px solid ${border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.round(size*0.58),color,fontFamily:"serif",opacity:show?1:0,transform:show?"scale(1)":"scale(0.5)",transition:"opacity 0.2s,transform 0.2s"}}>{show?(FACES[value]||value):""}</div>;
}

// ─── FREE DICE ROLLER ─────────────────────────────────────────────────────────
function FreeDiceRoller({T,open,onClose}){
  const[rolls,setRolls]=useState(null);
  const[rolling,setRolling]=useState(false);
  const[cn,setCn]=useState(2);
  const[cs,setCs]=useState(6);
  function doRoll(n,s){setRolling(true);setRolls(null);setTimeout(()=>{const r=[];for(let i=0;i<n;i++)r.push(Math.floor(Math.random()*s)+1);setRolls({dice:r,sides:s});setRolling(false);},250);}
  if(!open)return null;
  const total=rolls?rolls.dice.reduce((a,b)=>a+b,0):0;
  return(
    <div style={{position:"fixed",bottom:80,right:16,zIndex:200,width:300,background:T.panel,border:`1px solid ${T.border}`,borderRadius:14,boxShadow:`0 8px 40px rgba(0,0,0,0.6)`,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 13px",borderBottom:`1px solid ${T.border}`}}>
        <span style={{fontFamily:"'Cinzel',serif",color:T.text,fontSize:12,letterSpacing:2}}>FREE ROLLER</span>
        <button onClick={onClose} style={{background:"transparent",border:"none",color:T.textDim,fontSize:17,cursor:"pointer"}}>✕</button>
      </div>
      <div style={{padding:"9px 12px",borderBottom:`1px solid ${T.border}`}}>
        <div style={{fontSize:8,color:T.textDim,letterSpacing:2,textTransform:"uppercase",fontFamily:"'Cinzel',serif",marginBottom:7}}>Quick Roll</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
          {[{n:1,s:6,l:"1D6"},{n:2,s:6,l:"2D6"},{n:3,s:6,l:"3D6"},{n:5,s:6,l:"5D6"},{n:10,s:6,l:"10D6"},{n:1,s:3,l:"1D3"},{n:2,s:3,l:"2D3"},{n:3,s:3,l:"3D3"}].map(({n,s,l})=>(
            <button key={l} onClick={()=>doRoll(n,s)} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.text,borderRadius:5,padding:"4px 9px",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:10}}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{padding:"9px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:7}}>
        <span style={{fontSize:8,color:T.textDim,letterSpacing:2,textTransform:"uppercase",fontFamily:"'Cinzel',serif",flexShrink:0}}>Custom</span>
        <input type="number" min="1" max="99" value={cn} onChange={e=>setCn(Math.max(1,Math.min(99,+e.target.value)))} style={{width:40,background:T.bg,border:`1px solid ${T.border}`,color:T.text,borderRadius:4,padding:"3px 5px",fontFamily:"'Cinzel',serif",fontSize:11,textAlign:"center"}}/>
        <span style={{color:T.textDim,fontSize:12}}>D</span>
        <input type="number" min="2" max="100" value={cs} onChange={e=>setCs(Math.max(2,Math.min(100,+e.target.value)))} style={{width:40,background:T.bg,border:`1px solid ${T.border}`,color:T.text,borderRadius:4,padding:"3px 5px",fontFamily:"'Cinzel',serif",fontSize:11,textAlign:"center"}}/>
        <button onClick={()=>doRoll(cn,cs)} style={{background:T.accent,border:"none",color:"#fff",borderRadius:5,padding:"4px 9px",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:10,flex:1}}>Roll</button>
      </div>
      <div style={{padding:"11px 13px",minHeight:72}}>
        {rolling&&<div style={{color:T.textDim,textAlign:"center",fontFamily:"'Cinzel',serif",fontSize:11,marginTop:8}}>Rolling...</div>}
        {!rolling&&rolls&&(<>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>{rolls.dice.map((v,i)=><MiniDie key={i} value={v} success={true} size={32} animate={true}/>)}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
            <span style={{fontSize:9,color:T.textDim,letterSpacing:2,textTransform:"uppercase",fontFamily:"'Cinzel',serif"}}>{rolls.dice.length}D{rolls.sides}</span>
            <span style={{fontFamily:"'Cinzel',serif",fontSize:20,color:T.accentText,fontWeight:900}}>{total}</span>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ─── RESULT CARD ──────────────────────────────────────────────────────────────
function RollResult({result,weaponName,color,T}){
  const[open,setOpen]=useState(false);
  const{hitRolls,woundRolls,saveRolls,damageDealt,rerolledHits,rerolledWounds,numAttacks,hitTarget,woundTarget,effSave,saveIsInvuln}=result;
  const hits=woundRolls.length,missedHits=numAttacks-hits;
  const woundsMade=saveRolls.length+damageDealt.length,failedWounds=hits-woundsMade;
  const savedCount=saveRolls.filter(r=>r>=effSave).length,unsaved=damageDealt.length;
  const totalDmg=damageDealt.reduce((a,b)=>a+b,0);
  const Step=({label,main,sub,accent})=>(
    <div style={{textAlign:"center",flex:1,minWidth:0}}>
      <div style={{fontSize:8,color:T.textDim,textTransform:"uppercase",letterSpacing:1.5,fontFamily:"'Cinzel',serif",marginBottom:2,whiteSpace:"nowrap",overflow:"hidden"}}>{label}</div>
      <div style={{fontSize:19,fontFamily:"'Cinzel',serif",fontWeight:700,color:accent||T.text,lineHeight:1}}>{main}</div>
      {sub!==undefined&&<div style={{fontSize:9,color:T.textFaint,marginTop:1}}>{sub}</div>}
    </div>
  );
  const Arr=()=><div style={{color:T.textFaint,fontSize:14,flexShrink:0,alignSelf:"center",paddingBottom:12}}>›</div>;
  return(
    <div style={{background:T.panel,border:`1px solid ${color.border}33`,borderLeft:`3px solid ${color.border}`,borderRadius:10,marginBottom:9,boxShadow:`0 2px 14px ${color.glow}`,overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",borderBottom:`1px solid ${T.border}`}}>
        <span style={{fontFamily:"'Cinzel',serif",color:color.label,fontSize:12,fontWeight:700}}>{weaponName}</span>
        <span style={{fontFamily:"'Cinzel',serif",fontSize:18,color:totalDmg>0?T.text:T.textFaint,fontWeight:900}}>{totalDmg}<span style={{fontSize:10,color:T.textDim,fontWeight:400,marginLeft:3}}>dmg</span></span>
      </div>
      <div style={{display:"flex",alignItems:"stretch",padding:"10px 11px 6px",gap:3}}>
        <Step label="Atk" main={numAttacks} sub=" "/><Arr/>
        <Step label={`Hit ${hitTarget}+`} main={hits} sub={`${missedHits}✗`} accent={color.label}/><Arr/>
        <Step label={`Wnd ${woundTarget}+`} main={woundsMade} sub={`${failedWounds}✗`}/><Arr/>
        <Step label={saveIsInvuln?`Inv ${effSave}+`:`Sv ${effSave}+`} main={savedCount} sub={`${unsaved}✗`} accent={savedCount>0?"#5cb85c":undefined}/><Arr/>
        <Step label="Dmg" main={totalDmg} sub=" " accent={totalDmg>0?"#ff6b6b":T.textFaint}/>
      </div>
      <div onClick={()=>setOpen(o=>!o)} style={{padding:"3px 12px 7px",cursor:"pointer"}}>
        <span style={{fontSize:9,color:T.textFaint,letterSpacing:2,textTransform:"uppercase",fontFamily:"'Cinzel',serif"}}>{open?"▲ hide":"▼ dice"}</span>
      </div>
      {open&&(
        <div style={{padding:"10px 12px 12px",borderTop:`1px solid ${T.border}`,display:"flex",flexDirection:"column",gap:11}}>
          <DS label={`Hit rolls — ${hitTarget}+`} note={`${hits}/${numAttacks}${rerolledHits.length>0?" · "+rerolledHits.length+" rerolled":""}`} T={T}>{hitRolls.map((v,i)=><MiniDie key={i} value={v} success={v>=hitTarget}/>)}</DS>
          {woundRolls.length>0&&<DS label={`Wound rolls — ${woundTarget}+`} note={`${woundsMade}/${woundRolls.length}${rerolledWounds.length>0?" · "+rerolledWounds.length+" rerolled":""}`} T={T}>{woundRolls.map((v,i)=><MiniDie key={i} value={v} success={v>=woundTarget}/>)}</DS>}
          {saveRolls.length>0&&<DS label={`${saveIsInvuln?"Invuln":"Armour"} saves — ${effSave}+`} note={`${savedCount} saved`} legend={<><span style={{color:"#5cb85c"}}>■</span> saved &nbsp;<span style={{color:"#e74c3c"}}>■</span> failed</>} T={T}>{saveRolls.map((v,i)=><MiniDie key={i} value={v} success={v>=effSave} saveMode/>)}</DS>}
          {damageDealt.length>0&&<DS label="Damage per unsaved wound" note={`${totalDmg} total`} T={T}>{damageDealt.map((d,i)=><div key={i} style={{background:"#160606",border:"1px solid #c0392b44",borderRadius:5,padding:"2px 8px",fontFamily:"'Cinzel',serif",fontSize:14,color:"#e74c3c"}}>{d}</div>)}</DS>}
        </div>
      )}
    </div>
  );
}
function DS({label,note,legend,children,T}){
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:9,color:T.textDim,textTransform:"uppercase",letterSpacing:2,fontFamily:"'Cinzel',serif"}}>{label}</span>
        <span style={{fontSize:9,color:T.textDim}}>{note}</span>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:3}}>{children}</div>
      {legend&&<div style={{fontSize:10,color:T.textDim,marginTop:4}}>{legend}</div>}
    </div>
  );
}

// ─── WEAPON ROW ───────────────────────────────────────────────────────────────
function WeaponRow({weapon,color,selected,onToggle,T,halfRange,onHalfRange,lanceActive,onLance,blastCount,onBlastCount}){
  const kw=weapon.kw,a=weapon.attacks;
  const aStr=a.dice>0?`${a.count>1?a.count:""}D${a.dice}${a.bonus?"+"+a.bonus:""}`:String(a.fixed);
  const hasCtx=kw.rapidFire>0||kw.melta>0||kw.lance||kw.blast||kw.anti||kw.twinLinked;
  return(
    <div style={{marginBottom:5}}>
      <div onClick={onToggle} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:7,background:selected?`${color.bg}66`:"transparent",border:`1px solid ${selected?color.border:T.border}`,cursor:"pointer",transition:"all 0.12s",boxShadow:selected?`0 0 10px ${color.glow}`:"none"}}>
        <div style={{width:9,height:9,borderRadius:2,flexShrink:0,background:selected?color.border:T.border,border:`1px solid ${color.border}55`}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11,color:selected?color.label:T.text,fontFamily:"'Cinzel',serif"}}>{weapon.name}</div>
          <div style={{fontSize:9,color:T.textDim,marginTop:1}}>A:{aStr} · {weapon.isMelee?"WS":"BS"}:{weapon.skill}+ · S:{weapon.strength} · AP:{weapon.ap} · D:{weapon.damage}</div>
          {weapon.keywords&&weapon.keywords!=="-"&&(
            <div style={{display:"flex",flexWrap:"wrap",gap:2,marginTop:2}}>
              {weapon.keywords.split(",").map(k=>k.trim()).filter(Boolean).map((k,i)=>(
                <span key={i} style={{fontSize:8,color:T.textDim,background:T.bg,border:`1px solid ${T.border}`,borderRadius:3,padding:"1px 4px"}}>{k}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      {selected&&hasCtx&&(
        <div style={{marginLeft:10,marginTop:3,padding:"7px 9px",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,display:"flex",flexWrap:"wrap",gap:7,alignItems:"center"}}>
          {(kw.rapidFire>0||kw.melta>0)&&<Toggle label={`Half range?${kw.rapidFire>0?` +${kw.rapidFire}A`:""}${kw.melta>0?` +${kw.melta}D`:""}`} active={halfRange} onToggle={onHalfRange} T={T} color="#f0a030"/>}
          {kw.lance&&<Toggle label="Charged? (Lance +1 to wound)" active={lanceActive} onToggle={onLance} T={T} color="#b07fe8"/>}
          {kw.blast&&(
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:9,color:T.textDim,fontFamily:"'Cinzel',serif"}}>Blast — enemy:</span>
              <SmallStepper value={blastCount||5} min={1} max={30} onChange={onBlastCount} T={T}/>
              <span style={{fontSize:8,color:T.textFaint}}>(+{Math.floor(((blastCount||5)-1)/5)}A)</span>
            </div>
          )}
          {kw.twinLinked&&<span style={{fontSize:9,color:"#7ec8ff",background:"rgba(126,200,255,0.08)",border:"1px solid rgba(126,200,255,0.2)",borderRadius:3,padding:"2px 6px",fontFamily:"'Cinzel',serif"}}>Twin-Linked</span>}
          {kw.anti&&<span style={{fontSize:9,color:"#5dffaa",background:"rgba(93,255,170,0.08)",border:"1px solid rgba(93,255,170,0.2)",borderRadius:3,padding:"2px 6px",fontFamily:"'Cinzel',serif"}}>Anti-{kw.anti.toUpperCase()} {kw.antiValue}+</span>}
        </div>
      )}
    </div>
  );
}

// ─── MODEL MANAGER ────────────────────────────────────────────────────────────
function ModelManager({unit,onUpdate,T,onClose}){
  const models=unit.models;
  const toggleAlive=idx=>onUpdate(models.map((m,i)=>i===idx?{...m,alive:!m.alive,active:false,fired:false}:m));
  const toggleActive=idx=>onUpdate(models.map((m,i)=>i===idx&&m.alive?{...m,active:!m.active}:m));
  const alive=models.filter(m=>m.alive).length;
  const active=models.filter(m=>m.alive&&m.active).length;
  return(
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"flex-end",pointerEvents:"none"}}>
      <div style={{width:340,height:"100%",background:T.panel,borderLeft:`1px solid ${T.border}`,boxShadow:"-4px 0 24px rgba(0,0,0,0.6)",pointerEvents:"all",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",borderBottom:`1px solid ${T.border}`}}>
          <div>
            <div style={{fontFamily:"'Cinzel',serif",color:T.text,fontSize:12}}>{unit.name}</div>
            <div style={{fontSize:9,color:T.textDim,marginTop:2}}>{alive} alive · {active} shooting</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:T.textDim,fontSize:17,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:9}}>
          {models.map((m,i)=>{
            const sc=!m.alive?T.textFaint:!m.active?"#f0a030":"#5cb85c";
            const sl=!m.alive?"Dead":!m.active?"Can't shoot":"Shooting";
            const allWeapons=[...m.ranged,...m.melee];
            return(
              <div key={m.instanceId||i} style={{padding:"8px 10px",marginBottom:5,borderRadius:7,background:!m.alive?T.bg+"44":"transparent",border:`1px solid ${!m.alive?T.border:m.active?"#5cb85c22":"#f0a03022"}`,opacity:m.alive?1:0.55}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:allWeapons.length?4:0}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:sc,flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:m.alive?T.text:T.textFaint,fontFamily:"'Cinzel',serif"}}>{m.name} #{i+1}</div>
                    <div style={{fontSize:9,color:sc}}>{sl}</div>
                  </div>
                  {m.alive&&<button onClick={()=>toggleActive(i)} style={{background:m.active?"rgba(240,160,48,0.15)":"rgba(92,184,92,0.15)",border:`1px solid ${m.active?"#f0a03055":"#5cb85c55"}`,color:m.active?"#f0a030":"#5cb85c",borderRadius:4,padding:"2px 7px",cursor:"pointer",fontSize:9,fontFamily:"'Cinzel',serif"}}>{m.active?"Grey out":"Activate"}</button>}
                  <button onClick={()=>toggleAlive(i)} style={{background:m.alive?"rgba(231,76,60,0.12)":"rgba(92,184,92,0.12)",border:`1px solid ${m.alive?"#e74c3c44":"#5cb85c44"}`,color:m.alive?"#e74c3c":"#5cb85c",borderRadius:4,padding:"2px 7px",cursor:"pointer",fontSize:9,fontFamily:"'Cinzel',serif"}}>{m.alive?"Kill":"Revive"}</button>
                </div>
                {/* Weapon list per model */}
                {allWeapons.length>0&&(
                  <div style={{paddingLeft:14,display:"flex",flexWrap:"wrap",gap:3}}>
                    {allWeapons.map((w,j)=>(
                      <span key={j} style={{fontSize:8,color:m.alive&&m.active?T.textDim:T.textFaint,background:T.bg,border:`1px solid ${T.border}`,borderRadius:3,padding:"1px 5px",textDecoration:!m.alive?"line-through":"none"}}>{w.name}</span>
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
function HistoryPanel({history,setHistory,T,onClose}){
  const[,tick]=useState(0);
  useEffect(()=>{const id=setInterval(()=>tick(n=>n+1),5000);return()=>clearInterval(id);},[]);
  return(
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"flex-end",pointerEvents:"none"}}>
      <div style={{width:360,height:"100%",background:T.panel,borderLeft:`1px solid ${T.border}`,boxShadow:"-4px 0 24px rgba(0,0,0,0.5)",pointerEvents:"all",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",borderBottom:`1px solid ${T.border}`}}>
          <span style={{fontFamily:"'Cinzel',serif",color:T.text,fontSize:12,letterSpacing:2}}>ROLL HISTORY</span>
          <div style={{display:"flex",gap:8}}>
            {history.length>0&&<button onClick={()=>setHistory([])} style={{background:"rgba(231,76,60,0.15)",border:"1px solid #e74c3c44",color:"#e74c3c",borderRadius:5,padding:"3px 8px",cursor:"pointer",fontSize:9,fontFamily:"'Cinzel',serif"}}>Clear</button>}
            <button onClick={onClose} style={{background:"transparent",border:"none",color:T.textDim,fontSize:17,cursor:"pointer"}}>✕</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:11}}>
          {history.length===0
            ?<div style={{color:T.textFaint,fontFamily:"'Cinzel',serif",textAlign:"center",marginTop:40,fontSize:11}}>No rolls yet</div>
            :[...history].reverse().map((entry,i)=>{
              const total=entry.results.reduce((a,r)=>a+r.result.damageDealt.reduce((x,y)=>x+y,0),0);
              return(
                <div key={i} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 11px",marginBottom:7}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <span style={{fontFamily:"'Cinzel',serif",color:T.text,fontSize:11,fontWeight:700}}>{entry.unitName}</span>
                    <span style={{fontSize:9,color:T.textDim}}>{timeAgo(entry.ts)}</span>
                  </div>
                  <div style={{fontSize:9,color:T.textDim,marginBottom:5}}>{entry.phase} · T{entry.targetT} SV{entry.targetSave}+{entry.invulnEnabled?` / inv${entry.invulnSave}+`:""}</div>
                  {entry.results.map((r,j)=>{
                    const dmg=r.result.damageDealt.reduce((a,b)=>a+b,0);
                    return<div key={j} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:10,color:r.color.label,fontFamily:"'Cinzel',serif"}}>{r.weapon.name}</span><span style={{fontSize:10,color:T.text}}>{r.result.numAttacks}A→{r.result.woundRolls.length}H→<span style={{color:"#ff6b6b",fontWeight:700}}>{dmg}dmg</span></span></div>;
                  })}
                  <div style={{textAlign:"right",marginTop:4}}><span style={{fontFamily:"'Cinzel',serif",fontSize:13,color:"#ff6b6b",fontWeight:900}}>{total}<span style={{fontSize:9,color:T.textDim,fontWeight:400,marginLeft:3}}>dmg</span></span></div>
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}

// ─── STATISTICS PANEL ────────────────────────────────────────────────────────
function StatisticsPanel({stats,setStats,T,onClose}){
  const[view,setView]=useState("simple"); // simple | detailed
  const[showEndGame,setShowEndGame]=useState(false);
  const[opponent,setOpponent]=useState("");

  // Compute per-unit aggregates across all games
  const unitKeys=Object.keys(stats.units||{});
  const allGames=(stats.games||[]);

  // MVP = unit with highest total damage
  let mvpUnit="",mvpDmg=0;
  unitKeys.forEach(k=>{const u=stats.units[k];if(u.totalDamage>mvpDmg){mvpDmg=u.totalDamage;mvpUnit=k;}});

  function endGame(){
    if(!opponent.trim()) return;
    const date=new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
    const newGame={date,opponent:opponent.trim(),units:{...stats.units}};
    const newStats={...stats,games:[...(stats.games||[]),newGame],units:{}};
    setStats(newStats);saveStorage("dor_stats",newStats);
    setShowEndGame(false);setOpponent("");
  }

  function clearStats(){
    const empty={units:{},games:[]};setStats(empty);saveStorage("dor_stats",empty);
  }

  // Simple bar chart using div widths
  const maxDmg=unitKeys.reduce((m,k)=>Math.max(m,stats.units[k]?.totalDamage||0),1);

  return(
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"flex-end",pointerEvents:"none"}}>
      <div style={{width:400,height:"100%",background:T.panel,borderLeft:`1px solid ${T.border}`,boxShadow:"-4px 0 24px rgba(0,0,0,0.6)",pointerEvents:"all",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",borderBottom:`1px solid ${T.border}`}}>
          <span style={{fontFamily:"'Cinzel',serif",color:T.text,fontSize:12,letterSpacing:2}}>STATISTICS</span>
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            <button onClick={()=>setShowEndGame(true)} style={{background:T.accent+"33",border:`1px solid ${T.accent}`,color:T.accentText,borderRadius:5,padding:"3px 8px",cursor:"pointer",fontSize:9,fontFamily:"'Cinzel',serif"}}>Game Concluded</button>
            <button onClick={onClose} style={{background:"transparent",border:"none",color:T.textDim,fontSize:17,cursor:"pointer"}}>✕</button>
          </div>
        </div>

        {/* End game modal */}
        {showEndGame&&(
          <div style={{padding:"12px 14px",background:T.bg,borderBottom:`1px solid ${T.border}`}}>
            <div style={{fontSize:10,color:T.text,marginBottom:6,fontFamily:"'Cinzel',serif"}}>Who did you play against?</div>
            <input value={opponent} onChange={e=>setOpponent(e.target.value)} placeholder="Opponent name"
              style={{width:"100%",background:T.panel,border:`1px solid ${T.border}`,borderRadius:5,padding:"5px 8px",color:T.text,fontFamily:"'Cinzel',serif",fontSize:11,marginBottom:8}}
              onKeyDown={e=>e.key==="Enter"&&endGame()} autoFocus/>
            <div style={{display:"flex",gap:7}}>
              <button onClick={endGame} style={{flex:1,background:T.accent,border:"none",color:"#fff",borderRadius:5,padding:"6px",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:11}}>Save Game</button>
              <button onClick={()=>setShowEndGame(false)} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textDim,borderRadius:5,padding:"6px 10px",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:11}}>Cancel</button>
            </div>
          </div>
        )}

        {/* View toggle */}
        <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.border}`}}>
          {["simple","detailed"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"8px",background:view===v?T.accent+"22":"transparent",border:"none",borderBottom:view===v?`2px solid ${T.accent}`:"2px solid transparent",color:view===v?T.accentText:T.textDim,fontFamily:"'Cinzel',serif",fontSize:10,textTransform:"uppercase",letterSpacing:2,cursor:"pointer"}}>{v}</button>
          ))}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:13}}>
          {unitKeys.length===0&&allGames.length===0&&(
            <div style={{color:T.textFaint,fontFamily:"'Cinzel',serif",textAlign:"center",marginTop:40,fontSize:11}}>No data yet — roll some dice!</div>
          )}

          {/* MVP Banner */}
          {mvpUnit&&(
            <div style={{background:`linear-gradient(135deg,${T.accent}22,${T.accent}11)`,border:`1px solid ${T.accent}44`,borderRadius:8,padding:"10px 12px",marginBottom:12}}>
              <div style={{fontSize:8,color:T.accent,letterSpacing:3,textTransform:"uppercase",fontFamily:"'Cinzel',serif",marginBottom:3}}>⚔ Current MVP</div>
              <div style={{fontFamily:"'Cinzel',serif",color:T.text,fontSize:14,fontWeight:700}}>{mvpUnit}</div>
              <div style={{fontSize:11,color:T.accentText}}>{mvpDmg} total damage dealt</div>
            </div>
          )}

          {/* Current session stats */}
          {unitKeys.length>0&&(<>
            <div style={{fontSize:9,color:T.textDim,letterSpacing:3,textTransform:"uppercase",fontFamily:"'Cinzel',serif",marginBottom:8}}>Current Session</div>
            {unitKeys.map(k=>{
              const u=stats.units[k];
              const barW=Math.round((u.totalDamage/maxDmg)*100);
              return(
                <div key={k} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 11px",marginBottom:7}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
                    <span style={{fontFamily:"'Cinzel',serif",color:T.text,fontSize:11,fontWeight:700}}>{k}</span>
                    <span style={{fontFamily:"'Cinzel',serif",fontSize:14,color:"#ff6b6b",fontWeight:900}}>{u.totalDamage} dmg</span>
                  </div>
                  {/* Damage bar */}
                  <div style={{height:4,background:T.border,borderRadius:2,marginBottom:6,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${barW}%`,background:T.accent,borderRadius:2,transition:"width 0.3s"}}/>
                  </div>
                  {view==="simple"&&(
                    <div style={{display:"flex",gap:12}}>
                      {[["Activations",u.activations],["Attacks",u.totalAttacks],["Hits",u.totalHits],["Wounds",u.totalWounds]].map(([l,v])=>(
                        <div key={l} style={{textAlign:"center"}}>
                          <div style={{fontSize:8,color:T.textDim}}>{l}</div>
                          <div style={{fontFamily:"'Cinzel',serif",fontSize:13,color:T.text}}>{v||0}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {view==="detailed"&&(<>
                    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:6}}>
                      {[["Activations",u.activations],["Attacks",u.totalAttacks],["Hits",u.totalHits],["Wounds",u.totalWounds],["Unsaved",u.totalUnsaved],["Damage",u.totalDamage]].map(([l,v])=>(
                        <div key={l} style={{textAlign:"center",minWidth:44}}>
                          <div style={{fontSize:8,color:T.textDim}}>{l}</div>
                          <div style={{fontFamily:"'Cinzel',serif",fontSize:12,color:T.text}}>{v||0}</div>
                        </div>
                      ))}
                    </div>
                    {/* Per-weapon breakdown */}
                    {u.weapons&&Object.entries(u.weapons).map(([wn,wd])=>(
                      <div key={wn} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",borderBottom:`1px solid ${T.border}`}}>
                        <span style={{fontSize:9,color:T.textDim,fontFamily:"'Cinzel',serif"}}>{wn}</span>
                        <span style={{fontSize:9,color:T.text}}>{wd.attacks}A · {wd.hits}H · <span style={{color:"#ff6b6b"}}>{wd.damage}dmg</span></span>
                      </div>
                    ))}
                    {u.bestRoll!==undefined&&<div style={{fontSize:9,color:T.textDim,marginTop:4}}>Best roll: <span style={{color:T.accentText}}>{u.bestRoll} dmg</span> · Avg: <span style={{color:T.accentText}}>{u.activations?Math.round(u.totalDamage/u.activations):0} dmg/activation</span></div>}
                  </>)}
                </div>
              );
            })}
          </>)}

          {/* Past games */}
          {allGames.length>0&&(<>
            <div style={{fontSize:9,color:T.textDim,letterSpacing:3,textTransform:"uppercase",fontFamily:"'Cinzel',serif",margin:"12px 0 8px"}}>Past Games</div>
            {[...allGames].reverse().map((g,i)=>{
              const gKeys=Object.keys(g.units||{});
              const gMvp=gKeys.reduce((best,k)=>(!best||g.units[k].totalDamage>g.units[best].totalDamage)?k:best,"");
              const gTotalDmg=gKeys.reduce((s,k)=>s+(g.units[k].totalDamage||0),0);
              return(
                <div key={i} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 11px",marginBottom:7}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div><span style={{fontFamily:"'Cinzel',serif",color:T.text,fontSize:11,fontWeight:700}}>vs {g.opponent}</span></div>
                    <span style={{fontSize:9,color:T.textDim}}>{g.date}</span>
                  </div>
                  <div style={{fontSize:10,color:T.textDim}}>Total damage: <span style={{color:"#ff6b6b",fontWeight:700}}>{gTotalDmg}</span></div>
                  {gMvp&&<div style={{fontSize:9,color:T.accentText}}>⚔ MVP: {gMvp} ({g.units[gMvp]?.totalDamage} dmg)</div>}
                </div>
              );
            })}
            <button onClick={clearStats} style={{width:"100%",padding:7,marginTop:4,background:"rgba(231,76,60,0.1)",border:"1px solid #e74c3c44",color:"#e74c3c",fontFamily:"'Cinzel',serif",fontSize:10,cursor:"pointer",borderRadius:5,letterSpacing:1}}>Clear All Statistics</button>
          </>)}
        </div>
      </div>
    </div>
  );
}

// ─── MENU PANEL ───────────────────────────────────────────────────────────────
function MenuPanel({T,theme,setTheme,rosters,setRosters,onClose}){
  const[renaming,setRenaming]=useState(null);const[nameVal,setNameVal]=useState("");
  return(
    <div style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:12,padding:20,width:330,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 8px 40px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontFamily:"'Cinzel',serif",color:T.text,fontSize:13,letterSpacing:2}}>MENU</span>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:T.textDim,fontSize:17,cursor:"pointer"}}>✕</button>
        </div>
        <SLabel T={T}>Theme</SLabel>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:18}}>
          {Object.entries(THEMES).map(([key,th])=>(
            <button key={key} onClick={()=>setTheme(key)} style={{padding:"9px 7px",borderRadius:7,cursor:"pointer",textAlign:"center",border:`2px solid ${theme===key?th.accent:T.border}`,background:th.bg,color:th.text,fontFamily:"'Cinzel',serif",fontSize:10,boxShadow:theme===key?`0 0 10px ${th.glow}`:"none"}}>
              <div style={{width:18,height:3,background:th.accent,borderRadius:2,margin:"0 auto 5px"}}/>{th.name}
            </button>
          ))}
        </div>
        <SLabel T={T}>Account</SLabel>
        <button style={{width:"100%",padding:8,border:`1px solid ${T.border}`,borderRadius:6,background:"transparent",color:T.textDim,fontFamily:"'Cinzel',serif",fontSize:11,cursor:"not-allowed",opacity:0.45,marginBottom:16}}>Sign In — Coming Soon</button>
        {rosters.length>0&&(<>
          <SLabel T={T}>Rename Rosters</SLabel>
          {rosters.map((r,i)=>(
            <div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
              {renaming===i
                ?<><input value={nameVal} onChange={e=>setNameVal(e.target.value)} autoFocus style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,borderRadius:4,padding:"3px 7px",color:T.text,fontFamily:"'Cinzel',serif",fontSize:11}} onKeyDown={e=>{if(e.key==="Enter"){setRosters(rs=>rs.map((x,j)=>j===i?{...x,name:nameVal}:x));setRenaming(null);}}}/>
                   <button onClick={()=>{setRosters(rs=>rs.map((x,j)=>j===i?{...x,name:nameVal}:x));setRenaming(null);}} style={{background:T.accent,border:"none",color:"#fff",borderRadius:4,padding:"3px 7px",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:10}}>✓</button></>
                :<><span style={{flex:1,color:T.text,fontFamily:"'Cinzel',serif",fontSize:11}}>{r.name}</span>
                   <button onClick={()=>{setRenaming(i);setNameVal(r.name);}} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textDim,borderRadius:4,padding:"2px 7px",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:10}}>rename</button></>
              }
            </div>
          ))}
        </>)}
      </div>
    </div>
  );
}

// ─── SMALL HELPERS ────────────────────────────────────────────────────────────
function SLabel({children,T}){return<div style={{fontSize:8,color:T.textDim,letterSpacing:3,textTransform:"uppercase",fontFamily:"'Cinzel',serif",marginBottom:7}}>{children}</div>;}
function Card({children,T,style={}}){return<div style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:8,padding:10,marginBottom:10,...style}}>{children}</div>;}
function Btn({onClick,children,T,style={}}){return<button onClick={onClick} style={{background:T.panel,border:`1px solid ${T.border}`,color:T.text,borderRadius:5,width:26,height:26,cursor:"pointer",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,...style}}>{children}</button>;}
function Stat({label,value,T}){return<div style={{textAlign:"center",minWidth:30}}><div style={{fontSize:7,color:T.textDim,letterSpacing:2,textTransform:"uppercase",fontFamily:"'Cinzel',serif"}}>{label}</div><div style={{fontSize:14,color:T.text,fontFamily:"'Cinzel',serif"}}>{value}</div></div>;}
function HBtn({label,count,onClick,T}){return<button onClick={onClick} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textDim,padding:"4px 9px",borderRadius:5,cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:9,display:"flex",alignItems:"center",gap:4}}>{label}{count>0&&<span style={{background:T.accent,color:"#fff",borderRadius:9,padding:"1px 4px",fontSize:7}}>{count}</span>}</button>;}
function Toggle({label,active,onToggle,T,color="#ffffff"}){return<div onClick={onToggle} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",userSelect:"none"}}><div style={{width:15,height:15,borderRadius:3,flexShrink:0,background:active?color:"transparent",border:`2px solid ${active?color:T.textDim}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{active&&<span style={{color:"#000",fontSize:9,lineHeight:1,fontWeight:700}}>✓</span>}</div><span style={{fontSize:9,color:active?color:T.textDim}}>{label}</span></div>;}
function SmallStepper({value,min,max,onChange,T}){return<div style={{display:"flex",alignItems:"center",gap:3}}><button onClick={()=>onChange(Math.max(min,value-1))} style={{width:18,height:18,background:T.panel,border:`1px solid ${T.border}`,color:T.text,borderRadius:3,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button><span style={{fontFamily:"'Cinzel',serif",fontSize:12,color:T.text,minWidth:20,textAlign:"center"}}>{value}</span><button onClick={()=>onChange(Math.min(max,value+1))} style={{width:18,height:18,background:T.panel,border:`1px solid ${T.border}`,color:T.text,borderRadius:3,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button></div>;}
function LeaderBuff({label,field,lb,setLb,T}){const active=!!lb[field];return<div onClick={()=>setLb(prev=>({...prev,[field]:!prev[field]}))} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",userSelect:"none"}}><div style={{width:15,height:15,borderRadius:3,flexShrink:0,background:active?T.accent:"transparent",border:`2px solid ${active?T.accent:T.textDim}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{active&&<span style={{color:"#fff",fontSize:9,lineHeight:1}}>✓</span>}</div><span style={{fontSize:10,color:active?T.accentText:T.textDim}}>{label}</span></div>;}

// ─── LONG PRESS ───────────────────────────────────────────────────────────────
function useLongPress(cb,ms=600){
  const timer=useRef(null);
  const start=useCallback((e)=>{e.preventDefault();timer.current=setTimeout(cb,ms);},[cb,ms]);
  const stop=useCallback(()=>{if(timer.current)clearTimeout(timer.current);},[]);
  return{onMouseDown:start,onMouseUp:stop,onMouseLeave:stop,onTouchStart:start,onTouchEnd:stop};
}

// Unit row extracted so useLongPress isn't called inside .map()
function UnitRow({u,isSelected,fired,T,onSelect,onLongPress}){
  const lp=useLongPress(onLongPress,600);
  return(
    <div onClick={onSelect} {...lp} style={{padding:"7px 10px",cursor:"pointer",userSelect:"none",background:isSelected?T.accent+"22":"transparent",borderLeft:`3px solid ${isSelected?T.accent:"transparent"}`,transition:"all 0.1s",display:"flex",alignItems:"center",gap:6}}>
      {/* Fired checkmark */}
      <div onClick={e=>{e.stopPropagation();}} style={{width:14,height:14,borderRadius:3,flexShrink:0,background:fired?T.accent+"44":"transparent",border:`1.5px solid ${fired?T.accent:T.textFaint}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
        {fired&&<span style={{color:T.accentText,fontSize:9,lineHeight:1}}>✓</span>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:10,color:isSelected?T.accentText:T.text,fontFamily:"'Cinzel',serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}</div>
        <div style={{fontSize:8,color:T.textDim,marginTop:1}}>{u.models.length}m · T{u.models[0]?.stats?.toughness} SV{u.models[0]?.stats?.save}+</div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const[themeKey,setThemeKey]=useState(()=>loadStorage("dor_theme","blood"));
  const T=THEMES[themeKey];
  useEffect(()=>saveStorage("dor_theme",themeKey),[themeKey]);

  const[units,setUnits]=useState([]);
  const[rosters,setRosters]=useState([]);
  const[activeRoster,setActiveRoster]=useState(null);
  const[selectedUnit,setSelectedUnit]=useState(null);
  const[firedUnits,setFiredUnits]=useState(new Set()); // unit ids that have fired this turn

  const[selectedWeapons,setSelectedWeapons]=useState({});
  const[halfRangeMap,setHalfRangeMap]=useState({});
  const[lanceMap,setLanceMap]=useState({});
  const[blastCountMap,setBlastCountMap]=useState({});

  const[results,setResults]=useState([]);
  const[rolling,setRolling]=useState(false);
  const[targetT,setTargetT]=useState(4);
  const[targetSave,setTargetSave]=useState(4);
  const[targetKeywords,setTargetKeywords]=useState("");
  const[invulnEnabled,setInvulnEnabled]=useState(false);
  const[invulnSave,setInvulnSave]=useState(5);
  const[hitMod,setHitMod]=useState(0);
  const[woundMod,setWoundMod]=useState(0);
  const[rerollOnesHit,setRerollOnesHit]=useState(false);
  const[rerollOnesWound,setRerollOnesWound]=useState(false);
  const[phase,setPhase]=useState("shooting");
  const[leader,setLeader]=useState(null);
  const[leaderBuffs,setLeaderBuffs]=useState({lethalHits:false,devastatingWounds:false,sustainedHits:false,sustainedHitsVal:1,rerollHits:false,rerollWounds:false});

  const[history,setHistory]=useState([]);
  const[stats,setStats]=useState(()=>loadStorage("dor_stats",{units:{},games:[]}));

  const[showHistory,setShowHistory]=useState(false);
  const[showStats,setShowStats]=useState(false);
  const[showMenu,setShowMenu]=useState(false);
  const[showModelMgr,setShowModelMgr]=useState(false);
  const[showDice,setShowDice]=useState(false);
  const[error,setError]=useState(null);
  const fileRef=useRef();

  async function handleFile(e){
    const file=e.target.files[0]; if(!file) return; setError(null);
    try{
      let text;
      if(file.name.endsWith(".rosz")){const JSZip=await loadJSZip();const zip=await JSZip.loadAsync(file);const ros=Object.values(zip.files).find(f=>f.name.endsWith(".ros"));if(!ros)throw new Error("No .ros inside .rosz");text=await ros.async("text");}
      else text=await file.text();
      const parsed=parseRosz(text);
      if(!parsed.length){setError("No units found — check this is a valid BattleScribe roster.");return;}
      const rName=file.name.replace(/\.(rosz?|ros)$/i,"");
      setRosters(rs=>[...rs.filter(r=>r.name!==rName),{name:rName,units:parsed}]);
      setUnits(parsed);setActiveRoster(rName);
      setSelectedUnit(null);setSelectedWeapons({});setResults([]);setLeader(null);setFiredUnits(new Set());
    }catch(err){setError("Parse error: "+err.message);}
  }

  function selectUnit(u){
    setSelectedUnit({...u,models:u.models.map(m=>({...m,alive:true,active:true,fired:false}))});
    setSelectedWeapons({});setResults([]);setLeader(null);
    setHalfRangeMap({});setLanceMap({});setBlastCountMap({});
    setLeaderBuffs({lethalHits:false,devastatingWounds:false,sustainedHits:false,sustainedHitsVal:1,rerollHits:false,rerollWounds:false});
  }

  function updateModels(newModels){setSelectedUnit(u=>({...u,models:newModels}));}

  // Compute unique weapons across active+alive models only
  const unit=selectedUnit;
  const aliveModels=unit?unit.models.filter(m=>m.alive):[];
  const activeModels=unit?unit.models.filter(m=>m.alive&&m.active):[];
  const totalAlive=aliveModels.length;

  // Gather weapons — only from ALIVE models (greyed out models still contribute if active)
  // For deduplication, track weapon id → how many active models carry it
  function getWeaponCounts(){
    const map={};// weaponId → {weapon, count}
    const srcModels=leader?[...activeModels,...leader.models.filter(m=>m.alive!==false&&m.active!==false)]:activeModels;
    for(const m of srcModels){
      const ws=phase==="shooting"?m.ranged:m.melee;
      for(const w of ws){
        if(map[w.id]) map[w.id].count++;
        else map[w.id]={weapon:w,count:1};
      }
    }
    return Object.values(map);
  }
  const weaponCounts=unit?getWeaponCounts():[];

  function rollAll(){
    if(!unit||rolling) return;
    if(!activeModels.length) return;
    const toRoll=weaponCounts.filter(({weapon:w})=>selectedWeapons[w.id]!==undefined);
    if(!toRoll.length) return;
    setRolling(true);
    setTimeout(()=>{
      const newResults=toRoll.map(({weapon:w,count})=>({
        weapon:w, color:WCOLORS[selectedWeapons[w.id]%WCOLORS.length],
        result:performRoll({weapon:w,numActiveModels:count,toughness:targetT,armorSave:targetSave,invulnEnabled,invulnSave,halfRange:!!halfRangeMap[w.id],lanceActive:!!lanceMap[w.id],blastEnemyCount:blastCountMap[w.id]||5,hitMod,woundMod,targetKeywords,rerollOnesHit,rerollOnesWound,leaderBuffs}),
      }));
      setResults(newResults);

      // Mark unit as fired
      if(unit) setFiredUnits(s=>new Set([...s,unit.id]));

      // Record history
      setHistory(h=>[...h.slice(-29),{unitName:unit.name,phase,targetT,targetSave,invulnEnabled,invulnSave,results:newResults,ts:Date.now()}]);

      // Update statistics
      const totalDmg=newResults.reduce((a,r)=>a+r.result.damageDealt.reduce((x,y)=>x+y,0),0);
      const totalAtk=newResults.reduce((a,r)=>a+r.result.numAttacks,0);
      const totalHit=newResults.reduce((a,r)=>a+r.result.woundRolls.length,0);
      const totalWnd=newResults.reduce((a,r)=>a+r.result.saveRolls.length+r.result.damageDealt.length,0);
      const totalUns=newResults.reduce((a,r)=>a+r.result.damageDealt.length,0);
      setStats(prev=>{
        const uKey=unit.name;
        const existing=prev.units[uKey]||{activations:0,totalAttacks:0,totalHits:0,totalWounds:0,totalUnsaved:0,totalDamage:0,bestRoll:0,weapons:{}};
        const weapons={...existing.weapons};
        newResults.forEach(r=>{
          const wn=r.weapon.name;
          const wd=weapons[wn]||{attacks:0,hits:0,wounds:0,damage:0};
          weapons[wn]={attacks:wd.attacks+r.result.numAttacks,hits:wd.hits+r.result.woundRolls.length,wounds:wd.wounds+r.result.saveRolls.length+r.result.damageDealt.length,damage:wd.damage+r.result.damageDealt.reduce((a,b)=>a+b,0)};
        });
        const newU={...existing,activations:existing.activations+1,totalAttacks:existing.totalAttacks+totalAtk,totalHits:existing.totalHits+totalHit,totalWounds:existing.totalWounds+totalWnd,totalUnsaved:existing.totalUnsaved+totalUns,totalDamage:existing.totalDamage+totalDmg,bestRoll:Math.max(existing.bestRoll||0,totalDmg),weapons};
        const newStats={...prev,units:{...prev.units,[uKey]:newU}};
        saveStorage("dor_stats",newStats); return newStats;
      });
      setRolling(false);
    },350);
  }

  const totalDmg=results.reduce((a,r)=>a+r.result.damageDealt.reduce((x,y)=>x+y,0),0);
  const armorOverridden=invulnEnabled&&invulnSave<targetSave;

  function newTurn(){
    // Reset fired tracker, re-activate greyed models
    setFiredUnits(new Set());
    if(unit) setSelectedUnit(u=>({...u,models:u.models.map(m=>({...m,active:m.alive?true:false}))}));
  }

  return(
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"Georgia,serif",display:"flex",flexDirection:"column"}}>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,background:`radial-gradient(ellipse at 15% 10%,${T.glow} 0%,transparent 55%),radial-gradient(ellipse at 85% 90%,${T.glow} 0%,transparent 55%)`}}/>

      {/* HEADER */}
      <header style={{position:"relative",zIndex:2,borderBottom:`1px solid ${T.border}`,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",background:T.headerBg,backdropFilter:"blur(6px)",flexWrap:"wrap",gap:6}}>
        <div>
          <div style={{fontFamily:"'Cinzel Decorative','Cinzel',serif",fontSize:14,color:T.accent,letterSpacing:3}}>⚔ DICE OF RUIN</div>
          <div style={{fontSize:7,color:T.textDim,letterSpacing:3,textTransform:"uppercase"}}>Warhammer 40,000</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          {activeRoster&&<span style={{fontSize:9,color:T.textDim,fontFamily:"'Cinzel',serif"}}>{activeRoster}</span>}
          {units.length>0&&<button onClick={newTurn} style={{background:T.accent+"22",border:`1px solid ${T.accent}44`,color:T.accentText,padding:"4px 9px",borderRadius:5,cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:9}}>New Turn</button>}
          <HBtn label="📜" count={history.length} onClick={()=>{setShowHistory(true);setShowStats(false);setShowMenu(false);}} T={T}/>
          <HBtn label="📊" count={0} onClick={()=>{setShowStats(true);setShowHistory(false);setShowMenu(false);}} T={T}/>
          <HBtn label="☰" onClick={()=>{setShowMenu(true);setShowHistory(false);setShowStats(false);}} T={T}/>
          <button onClick={()=>fileRef.current.click()} style={{background:T.accent,border:"none",color:"#fff",padding:"4px 11px",borderRadius:5,cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:10}}>Load</button>
          <input ref={fileRef} type="file" accept=".rosz,.ros" style={{display:"none"}} onChange={handleFile}/>
        </div>
      </header>

      {error&&<div style={{background:"#140404",borderBottom:"1px solid #4a1010",padding:"5px 14px",color:"#c0392b",fontSize:11,zIndex:2}}>{error}</div>}

      {/* OVERLAYS */}
      {showHistory&&<HistoryPanel history={history} setHistory={setHistory} T={T} onClose={()=>setShowHistory(false)}/>}
      {showStats&&<StatisticsPanel stats={stats} setStats={setStats} T={T} onClose={()=>setShowStats(false)}/>}
      {showMenu&&<MenuPanel T={T} theme={themeKey} setTheme={setThemeKey} rosters={rosters} setRosters={setRosters} onClose={()=>setShowMenu(false)}/>}
      {showModelMgr&&unit&&<ModelManager unit={unit} onUpdate={updateModels} T={T} onClose={()=>setShowModelMgr(false)}/>}
      <FreeDiceRoller T={T} open={showDice} onClose={()=>setShowDice(false)}/>

      {!units.length?(
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:1,gap:13,padding:20}}>
          <div style={{fontSize:48}}>⚔</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:17,color:T.text,letterSpacing:2,textAlign:"center"}}>Load a BattleScribe Roster</div>
          <div style={{fontSize:11,color:T.textDim,maxWidth:280,textAlign:"center"}}>Upload your .rosz or .ros file to begin.</div>
          <button onClick={()=>fileRef.current.click()} style={{background:T.accent,border:"none",color:"#fff",padding:"9px 22px",borderRadius:7,fontSize:12,fontFamily:"'Cinzel',serif",cursor:"pointer",letterSpacing:2,boxShadow:`0 0 16px ${T.glow}`}}>LOAD ROSTER</button>
        </div>
      ):(
        <div className="main-layout" style={{display:"flex",flex:1,zIndex:1,overflow:"hidden"}}>

          {/* LEFT — unit list */}
          <div className="col-units" style={{width:190,flexShrink:0,borderRight:`1px solid ${T.border}`,overflowY:"auto",background:T.panel+"bb"}}>
            <div style={{padding:"9px 10px 5px",fontSize:7,color:T.textDim,letterSpacing:3,textTransform:"uppercase",fontFamily:"'Cinzel',serif"}}>Your Forces</div>
            {units.map(u=>(
              <UnitRow key={u.id} u={u} isSelected={selectedUnit?.id===u.id} fired={firedUnits.has(u.id)} T={T}
                onSelect={()=>{ setFiredUnits(s=>{const n=new Set(s); if(n.has(u.id))n.delete(u.id);else n.add(u.id); return n;}); /* toggle fired on checkmark click is handled inside */ selectUnit(u); }}
                onLongPress={()=>{selectUnit(u);setShowModelMgr(true);}}/>
            ))}
            {units.length>0&&<div style={{padding:"6px 10px",borderTop:`1px solid ${T.border}`,marginTop:4}}>
              <button onClick={()=>setFiredUnits(new Set())} style={{width:"100%",padding:"4px",background:"transparent",border:`1px solid ${T.border}`,color:T.textDim,borderRadius:4,cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:8,letterSpacing:1}}>Reset ✓ markers</button>
            </div>}
          </div>

          {/* MIDDLE — controls */}
          <div className="col-controls" style={{width:340,flexShrink:0,overflowY:"auto",padding:13,borderRight:`1px solid ${T.border}`}}>
            {!unit?(
              <div style={{color:T.textFaint,fontFamily:"'Cinzel',serif",marginTop:60,textAlign:"center",fontSize:11}}>Select a unit · hold to manage models</div>
            ):(<>
              {/* Unit header */}
              <div style={{marginBottom:11,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontFamily:"'Cinzel',serif",fontSize:13,color:T.text,marginBottom:5}}>{unit.name}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {unit.models[0]?.stats&&<><Stat label="M" value={unit.models[0].stats.move} T={T}/><Stat label="T" value={unit.models[0].stats.toughness} T={T}/><Stat label="SV" value={unit.models[0].stats.save+"+"} T={T}/><Stat label="W" value={unit.models[0].stats.wounds} T={T}/><Stat label="LD" value={unit.models[0].stats.leadership} T={T}/></>}
                  </div>
                </div>
                <button onClick={()=>setShowModelMgr(true)} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textDim,borderRadius:5,padding:"4px 8px",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:9,flexShrink:0,marginLeft:6}}>⚙ Models</button>
              </div>

              {/* Squad status */}
              <Card T={T} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",gap:10}}>
                    <div style={{textAlign:"center"}}><div style={{fontSize:7,color:T.textDim}}>Alive</div><div style={{fontFamily:"'Cinzel',serif",fontSize:16,color:T.text}}>{totalAlive}</div></div>
                    <div style={{textAlign:"center"}}><div style={{fontSize:7,color:T.textDim}}>Shooting</div><div style={{fontFamily:"'Cinzel',serif",fontSize:16,color:"#5cb85c"}}>{activeModels.length}</div></div>
                    <div style={{textAlign:"center"}}><div style={{fontSize:7,color:T.textDim}}>Dead</div><div style={{fontFamily:"'Cinzel',serif",fontSize:16,color:T.textFaint}}>{unit.models.length-totalAlive}</div></div>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:2,maxWidth:90,justifyContent:"flex-end"}}>
                    {unit.models.map((m,i)=><div key={i} style={{width:9,height:9,borderRadius:"50%",background:!m.alive?T.textFaint:!m.active?"#f0a030":"#5cb85c"}}/>)}
                  </div>
                </div>
              </Card>

              {/* Leader */}
              <Card T={T}>
                <SLabel T={T}>Attached Leader</SLabel>
                <select value={leader?.id||""} onChange={e=>{setLeader(units.find(u=>u.id===e.target.value)||null);setLeaderBuffs({lethalHits:false,devastatingWounds:false,sustainedHits:false,sustainedHitsVal:1,rerollHits:false,rerollWounds:false});}} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.text,padding:"4px 8px",borderRadius:5,width:"100%",fontFamily:"'Cinzel',serif",fontSize:10}}>
                  <option value="">— None —</option>
                  {units.filter(u=>u!==unit).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Card>

              {/* Leader buffs */}
              {leader&&(
                <Card T={T}>
                  <SLabel T={T}>Leader buffs — {leader.name}</SLabel>
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    <LeaderBuff label="Lethal Hits" field="lethalHits" lb={leaderBuffs} setLb={setLeaderBuffs} T={T}/>
                    <LeaderBuff label="Devastating Wounds" field="devastatingWounds" lb={leaderBuffs} setLb={setLeaderBuffs} T={T}/>
                    <LeaderBuff label="Re-roll all hit rolls" field="rerollHits" lb={leaderBuffs} setLb={setLeaderBuffs} T={T}/>
                    <LeaderBuff label="Re-roll all wound rolls" field="rerollWounds" lb={leaderBuffs} setLb={setLeaderBuffs} T={T}/>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <LeaderBuff label="Sustained Hits" field="sustainedHits" lb={leaderBuffs} setLb={setLeaderBuffs} T={T}/>
                      {leaderBuffs.sustainedHits&&<><SmallStepper value={leaderBuffs.sustainedHitsVal||1} min={1} max={6} onChange={v=>setLeaderBuffs(lb=>({...lb,sustainedHitsVal:v}))} T={T}/><span style={{fontSize:8,color:T.textDim}}>hits</span></>}
                    </div>
                  </div>
                </Card>
              )}

              {/* Phase */}
              <div style={{display:"flex",gap:6,marginBottom:10}}>
                {["shooting","melee"].map(p=>(
                  <button key={p} onClick={()=>{setPhase(p);setSelectedWeapons({});setResults([]);}} style={{flex:1,padding:6,borderRadius:5,cursor:"pointer",border:`1px solid ${phase===p?T.accent:T.border}`,background:phase===p?T.accent+"22":"transparent",color:phase===p?T.accentText:T.textDim,fontFamily:"'Cinzel',serif",fontSize:9,textTransform:"uppercase",letterSpacing:2}}>{p==="shooting"?"⊙ Shooting":"⚔ Melee"}</button>
                ))}
              </div>

              {/* Weapons */}
              <div style={{marginBottom:10}}>
                <SLabel T={T}>{phase==="shooting"?"Ranged":"Melee"} Weapons</SLabel>
                {weaponCounts.length===0
                  ?<div style={{color:T.textFaint,fontSize:10}}>No {phase} weapons on active models.</div>
                  :weaponCounts.map(({weapon:w,count},i)=>(
                    <WeaponRow key={w.id} weapon={w} color={WCOLORS[i%WCOLORS.length]} T={T}
                      selected={selectedWeapons[w.id]!==undefined}
                      onToggle={()=>setSelectedWeapons(prev=>{const n={...prev};if(n[w.id]!==undefined)delete n[w.id];else n[w.id]=i%WCOLORS.length;return n;})}
                      halfRange={!!halfRangeMap[w.id]} onHalfRange={()=>setHalfRangeMap(m=>({...m,[w.id]:!m[w.id]}))}
                      lanceActive={!!lanceMap[w.id]} onLance={()=>setLanceMap(m=>({...m,[w.id]:!m[w.id]}))}
                      blastCount={blastCountMap[w.id]||5} onBlastCount={v=>setBlastCountMap(m=>({...m,[w.id]:v}))}/>
                  ))
                }
                {weaponCounts.some(({count})=>count>1)&&(
                  <div style={{fontSize:8,color:T.textFaint,marginTop:3,padding:"3px 6px",background:T.bg,borderRadius:4}}>Numbers reflect active models carrying each weapon</div>
                )}
              </div>

              {/* Target card */}
              <Card T={T}>
                <SLabel T={T}>Target</SLabel>
                <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:9,color:T.text,marginBottom:4}}>Toughness</div>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <Btn onClick={()=>setTargetT(t=>Math.max(1,t-1))} T={T}>−</Btn>
                      <span style={{fontFamily:"'Cinzel',serif",fontSize:18,color:T.text,minWidth:24,textAlign:"center"}}>{targetT}</span>
                      <Btn onClick={()=>setTargetT(t=>Math.min(14,t+1))} T={T}>+</Btn>
                    </div>
                  </div>
                  <div style={{opacity:armorOverridden?0.4:1,transition:"opacity 0.2s"}}>
                    <div style={{fontSize:9,color:T.text,marginBottom:4}}>Armour Save{armorOverridden&&<span style={{fontSize:8,color:T.textDim,marginLeft:4}}>(overridden)</span>}</div>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <Btn onClick={()=>setTargetSave(s=>Math.max(2,s-1))} T={T}>−</Btn>
                      <span style={{fontFamily:"'Cinzel',serif",fontSize:18,color:T.text,minWidth:30,textAlign:"center"}}>{targetSave}+</span>
                      <Btn onClick={()=>setTargetSave(s=>Math.min(7,s+1))} T={T}>+</Btn>
                    </div>
                  </div>
                </div>
                {/* Invuln */}
                <div style={{borderTop:`1px solid ${T.border}`,paddingTop:9,marginBottom:9}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:invulnEnabled?7:0}}>
                    <div onClick={()=>setInvulnEnabled(v=>!v)} style={{width:15,height:15,borderRadius:3,flexShrink:0,cursor:"pointer",background:invulnEnabled?T.accent:"transparent",border:`2px solid ${invulnEnabled?T.accent:T.textDim}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{invulnEnabled&&<span style={{color:"#fff",fontSize:10,lineHeight:1}}>✓</span>}</div>
                    <span style={{fontSize:11,color:T.text,cursor:"pointer"}} onClick={()=>setInvulnEnabled(v=>!v)}>Invulnerable Save</span>
                  </div>
                  {invulnEnabled&&<div style={{display:"flex",alignItems:"center",gap:7,paddingLeft:22}}>
                    <Btn onClick={()=>setInvulnSave(s=>Math.max(2,s-1))} T={T}>−</Btn>
                    <span style={{fontFamily:"'Cinzel',serif",fontSize:18,color:T.accentText,minWidth:30,textAlign:"center"}}>{invulnSave}+</span>
                    <Btn onClick={()=>setInvulnSave(s=>Math.min(6,s+1))} T={T}>+</Btn>
                    <span style={{fontSize:8,color:T.textDim}}>ignores AP</span>
                  </div>}
                </div>
                {/* Target keywords */}
                <div style={{borderTop:`1px solid ${T.border}`,paddingTop:9,marginBottom:9}}>
                  <div style={{fontSize:9,color:T.textDim,marginBottom:4}}>Target keywords <span style={{fontSize:8,color:T.textFaint}}>(for Anti-X)</span></div>
                  <input value={targetKeywords} onChange={e=>setTargetKeywords(e.target.value)} placeholder="e.g. MONSTER, VEHICLE" style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:4,padding:"4px 7px",color:T.text,fontFamily:"'Cinzel',serif",fontSize:10}}/>
                </div>
                {/* Modifiers */}
                <div style={{borderTop:`1px solid ${T.border}`,paddingTop:9}}>
                  {[{label:"Hit modifier",mod:hitMod,setMod:setHitMod},{label:"Wound modifier",mod:woundMod,setMod:setWoundMod}].map(({label,mod,setMod})=>(
                    <div key={label} style={{marginBottom:8}}>
                      <div style={{fontSize:9,color:T.text,marginBottom:4}}>{label}</div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                        {[-2,-1,0,1,2].map(v=>(
                          <button key={v} onClick={()=>setMod(v)} style={{padding:"3px 8px",borderRadius:4,cursor:"pointer",border:`1px solid ${mod===v?T.accent:T.border}`,background:mod===v?T.accent+"33":"transparent",color:mod===v?T.accentText:T.textDim,fontFamily:"'Cinzel',serif",fontSize:10}}>{v>0?"+"+v:v}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {/* Reroll 1s — separate for hits and wounds */}
                  <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:3}}>
                    <Toggle label="Re-roll 1s to hit" active={rerollOnesHit} onToggle={()=>setRerollOnesHit(v=>!v)} T={T} color={T.accent}/>
                    <Toggle label="Re-roll 1s to wound" active={rerollOnesWound} onToggle={()=>setRerollOnesWound(v=>!v)} T={T} color={T.accent}/>
                  </div>
                </div>
              </Card>

              {/* Roll */}
              <button onClick={rollAll} disabled={rolling||Object.keys(selectedWeapons).length===0||activeModels.length===0} style={{width:"100%",padding:12,background:rolling?"#111":`linear-gradient(135deg,${T.accent}99,${T.accent})`,border:"none",borderRadius:7,color:"#fff",fontFamily:"'Cinzel',serif",fontSize:12,letterSpacing:3,cursor:rolling?"not-allowed":"pointer",boxShadow:rolling?"none":`0 0 14px ${T.glow}`,textTransform:"uppercase",transition:"all 0.2s"}}>
                {rolling?"Rolling...":`⚄ Roll — ${activeModels.length} model${activeModels.length!==1?"s":""}`}
              </button>
            </>)}
          </div>

          {/* RIGHT — results */}
          <div className="col-results" style={{flex:1,overflowY:"auto",padding:14}}>
            {results.length===0
              ?<div style={{color:T.textFaint,fontFamily:"'Cinzel',serif",textAlign:"center",marginTop:80,fontSize:10,letterSpacing:3}}>SELECT WEAPONS AND ROLL</div>
              :(<>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
                  <span style={{fontSize:7,color:T.textDim,letterSpacing:3,textTransform:"uppercase",fontFamily:"'Cinzel',serif"}}>Results</span>
                  <span style={{fontFamily:"'Cinzel',serif",fontSize:20,color:totalDmg>0?"#ff6b6b":T.textFaint,fontWeight:900}}>{totalDmg}<span style={{fontSize:10,color:T.textDim,fontWeight:400,marginLeft:3}}>total damage</span></span>
                </div>
                {results.map((r,i)=><RollResult key={i} result={r.result} weaponName={r.weapon.name} color={r.color} T={T}/>)}
                <button onClick={rollAll} style={{width:"100%",padding:7,marginTop:3,background:"transparent",border:`1px solid ${T.border}`,color:T.textDim,fontFamily:"'Cinzel',serif",fontSize:9,cursor:"pointer",borderRadius:5,letterSpacing:2}}>↺ REROLL</button>
              </>)
            }
          </div>
        </div>
      )}

      {/* FLOATING DICE BUTTON */}
      <button onClick={()=>setShowDice(v=>!v)} style={{position:"fixed",bottom:18,right:18,zIndex:150,width:50,height:50,borderRadius:"50%",background:showDice?T.accent:`linear-gradient(135deg,${T.accent}99,${T.accent})`,border:"none",color:"#fff",fontSize:22,cursor:"pointer",boxShadow:`0 4px 18px ${T.glow}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>⚄</button>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=Cinzel:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#333;border-radius:2px;}
        select option{background:#111;}
        button:focus{outline:none;}
        @media(max-width:900px){.col-units{width:160px !important;}.col-controls{width:300px !important;}}
        @media(max-width:640px){
          .main-layout{flex-direction:column !important;overflow-y:auto !important;overflow-x:hidden !important;}
          .col-units{width:100% !important;border-right:none !important;border-bottom:1px solid #222;max-height:160px;overflow-y:auto;display:flex;flex-direction:row;flex-wrap:nowrap;overflow-x:auto;}
          .col-units > div:first-child{display:none;}
          .col-controls{width:100% !important;border-right:none !important;border-bottom:1px solid #222;}
          .col-results{width:100% !important;min-height:280px;}
        }
      `}</style>
    </div>
  );
}