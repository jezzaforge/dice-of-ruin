// ─── ROSTER PARSER ───────────────────────────────────────────────────────────
// Supports: .rosz (zip+xml), .ros (xml), .json (BattleScribe JSON)
// Returns a unified array of unit objects regardless of input format.

function loadJSZip() {
  return new Promise((resolve, reject) => {
    if (window.JSZip) { resolve(window.JSZip); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = () => resolve(window.JSZip); s.onerror = reject;
    document.head.appendChild(s);
  });
}

export function parseKeywords(kwStr) {
  const kw = (kwStr || "").toLowerCase();
  const parsed = {
    torrent: kw.includes("torrent"), lethalHits: kw.includes("lethal hits"),
    devastatingWounds: kw.includes("devastating wounds"), lance: kw.includes("lance"),
    blast: kw.includes("blast"), twinLinked: kw.includes("twin-linked") || kw.includes("twin linked"),
    rapidFire: 0, sustainedHits: 0, melta: 0, anti: null, antiValue: 0,
  };
  const rf = kw.match(/rapid fire (\d+)/i); if (rf) parsed.rapidFire = parseInt(rf[1]);
  const sh = kw.match(/sustained hits (\d+)/i); if (sh) parsed.sustainedHits = parseInt(sh[1]);
  const me = kw.match(/melta (\d+)/i); if (me) parsed.melta = parseInt(me[1]);
  const an = kw.match(/anti-(\w+) (\d+)\+/i); if (an) { parsed.anti = an[1]; parsed.antiValue = parseInt(an[2]); }
  return parsed;
}

// Convert BattleScribe JSON → XML so we can reuse the XML parser
function jsonForceToXml(force) {
  function escape(s) { return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function selToXml(sel) {
    let inner = "";
    if (sel.profiles) {
      inner += "<profiles>";
      for (const p of sel.profiles) {
        inner += `<profile id="${escape(p.id||"")}" name="${escape(p.name||"")}" typeName="${escape(p.typeName||"")}"><characteristics>`;
        for (const ch of (p.characteristics || []))
          inner += `<characteristic name="${escape(ch.name||"")}">${escape(ch.$text||ch.value||"")}</characteristic>`;
        inner += "</characteristics></profile>";
      }
      inner += "</profiles>";
    }
    if (sel.selections?.length) {
      inner += "<selections>";
      for (const child of sel.selections) inner += selToXml(child);
      inner += "</selections>";
    }
    return `<selection id="${escape(sel.id||"")}" name="${escape(sel.name||"")}" type="${escape(sel.type||"")}" number="${sel.number||1}">${inner}</selection>`;
  }
  return `<?xml version="1.0"?><roster xmlns="http://www.battlescribe.net/schema/rosterSchema"><forces><force><selections>${(force.selections||[]).map(selToXml).join("")}</selections></force></forces></roster>`;
}

function parseXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const qAll = (el, sel) => [...el.querySelectorAll(sel)];
  const charVal = (p, n) => { for (const c of qAll(p, "characteristic")) if (c.getAttribute("name") === n) return c.textContent.trim(); return null; };
  const parseAtk = v => { if (!v) return { fixed:1,dice:0,count:0,bonus:0 }; v=v.trim(); const m=v.match(/^(\d*)D(\d+)(?:\+(\d+))?$/i); return m ? { fixed:0,dice:parseInt(m[2])||6,count:parseInt(m[1])||1,bonus:parseInt(m[3])||0 } : { fixed:parseInt(v)||1,dice:0,count:0,bonus:0 }; };
  const parseSkill = v => { if (!v || v === "N/A") return 4; const m = v.match(/(\d+)\+/); return m ? parseInt(m[1]) : 4; };
  const parseSave  = v => { if (!v) return 7; const m = v.match(/(\d+)\+/); return m ? parseInt(m[1]) : 7; };

  function extractWeapons(el, typeName) {
    return qAll(el, "profile").filter(p => p.getAttribute("typeName") === typeName).map(p => {
      const isMelee = typeName === "Melee Weapons";
      const kwRaw = charVal(p, "Keywords") || "";
      return {
        id: p.getAttribute("id") || Math.random().toString(36),
        name: (p.getAttribute("name") || "Unknown").replace(/^➤\s*/, ""),
        isMelee, attacks: parseAtk(charVal(p, "A")),
        skill: parseSkill(charVal(p, isMelee ? "WS" : "BS")),
        strength: parseInt(charVal(p, "S")) || 4,
        ap: parseInt(charVal(p, "AP")) || 0,
        damage: charVal(p, "D") || "1",
        keywords: kwRaw, kw: parseKeywords(kwRaw),
      };
    });
  }

  function extractStats(el) {
    for (const p of qAll(el, "profile"))
      if (p.getAttribute("typeName") === "Unit")
        return { move: charVal(p,"M"), toughness: parseInt(charVal(p,"T"))||4, save: parseSave(charVal(p,"SV")), wounds: parseInt(charVal(p,"W"))||1, leadership: charVal(p,"LD") };
    return null;
  }

  function collectWeapons(sel) {
    const ranged = extractWeapons(sel, "Ranged Weapons");
    const melee  = extractWeapons(sel, "Melee Weapons");
    for (const c of qAll(sel, "selections > selection")) {
      ranged.push(...extractWeapons(c, "Ranged Weapons"));
      melee.push(...extractWeapons(c, "Melee Weapons"));
    }
    // Deduplicate by id
    const dedup = arr => { const seen = new Set(); return arr.filter(w => { if (seen.has(w.id)) return false; seen.add(w.id); return true; }); };
    return { ranged: dedup(ranged), melee: dedup(melee) };
  }

  const units = [];
  const force = doc.querySelector("force");
  if (!force) return units;

  for (const sel of qAll(force, "selections > selection")) {
    const type = sel.getAttribute("type");
    const uName = sel.getAttribute("name");
    const unitStats = extractStats(sel);

    if (type === "unit") {
      const models = [];
      for (const c of qAll(sel, "selections > selection")) {
        if (c.getAttribute("type") !== "model") continue;
        const count = parseInt(c.getAttribute("number") || "1");
        const stats = extractStats(c) || unitStats;
        if (!stats) continue;
        const { ranged, melee } = collectWeapons(c);
        const mName = c.getAttribute("name") || uName;
        for (let i = 0; i < count; i++)
          models.push({ instanceId:`${c.getAttribute("id")||mName}-${i}`, name:mName, stats, ranged, melee, alive:true, active:true });
      }
      if (!models.length && unitStats) {
        const { ranged, melee } = collectWeapons(sel);
        const count = parseInt(sel.getAttribute("number") || "1");
        for (let i = 0; i < count; i++)
          models.push({ instanceId:`${sel.getAttribute("id")||uName}-${i}`, name:uName, stats:unitStats, ranged, melee, alive:true, active:true });
      }
      if (models.length) units.push({ id: sel.getAttribute("id") || uName, name: uName, models });

    } else if (type === "model" && unitStats) {
      const { ranged, melee } = collectWeapons(sel);
      const count = parseInt(sel.getAttribute("number") || "1");
      const models = [];
      for (let i = 0; i < count; i++)
        models.push({ instanceId:`${sel.getAttribute("id")||uName}-${i}`, name:uName, stats:unitStats, ranged, melee, alive:true, active:true });
      units.push({ id: sel.getAttribute("id") || uName, name: uName, models });
    }
  }
  return units;
}

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

export async function parseFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "rosz") {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(file);
    const ros = Object.values(zip.files).find(f => f.name.endsWith(".ros"));
    if (!ros) throw new Error("No .ros file found inside .rosz");
    const text = await ros.async("text");
    return parseXml(text);
  }

  if (ext === "ros") {
    return parseXml(await file.text());
  }

  if (ext === "json") {
    const json = JSON.parse(await file.text());
    const roster = json.roster || json;
    const forces = roster.forces || [];
    if (!forces.length) throw new Error("No forces found in JSON");
    return parseXml(jsonForceToXml(forces[0]));
  }

  if (ext === "txt") {
    // Plain text — try to extract unit names for a roster stub
    // Stats won't be available but we can create placeholder entries
    const text = await file.text();
    return parsePlainText(text);
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

// Plain text parser — extracts unit names from common export formats
function parsePlainText(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const units = [];
  const unitPattern = /^(?:Char\d+:|[-•*]|\d+x)\s*(.+?)(?:\s*\(\d+\s*pts?\))?$/i;
  for (const line of lines) {
    const m = line.match(unitPattern);
    if (m) {
      const name = m[1].replace(/^\d+x\s*/,"").trim();
      if (name && name.length > 2 && !name.startsWith("+")) {
        units.push({
          id: Math.random().toString(36),
          name,
          models: [{ instanceId: Math.random().toString(36), name, stats: { move:"6\"", toughness:4, save:3, wounds:2, leadership:"6+" }, ranged:[], melee:[], alive:true, active:true }],
          _noStats: true,
        });
      }
    }
  }
  return units;
}