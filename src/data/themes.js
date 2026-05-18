// ─── THEMES ───────────────────────────────────────────────────────────────────
// Design rules:
//   text      = primary readable text — always high contrast vs panel
//   textDim   = secondary labels — readable, not competing with primary
//   textFaint = disabled/empty — visible but clearly de-emphasised
//   accent    = identity colour — saturated, punchy
//   accentText= accent-coloured text on dark bg — must be legible
//   border    = panel edges — visible, not harsh
//
// Personality tokens:
//   radius  = corner rounding (0=brutal, 4=neutral, 12=soft, 20=very soft)
//   overlay = CSS texture (none / scanlines / noise)

export const THEMES = {

  // ── BLOOD BOIL ── Near-black with vivid arterial red. Sharp edges.
  blood: {
    name:"Blood Boil",
    bg:"#0a0608",     panel:"#160c10",     border:"#3a1520",
    accent:"#d42010", accentText:"#ff6050",
    text:"#ffffff",   textDim:"#ddbbbb",   textFaint:"#664444",
    headerBg:"rgba(6,3,5,0.96)",
    glow:"rgba(212,32,16,0.45)",
    diceSuccessBg:"rgba(212,32,16,0.22)",   diceSuccessBorder:"rgba(255,80,60,0.7)",   diceSuccessColor:"#ff8070",
    radius:8, overlay:"none",
  },

  // ── IRON BULWARK ── Cold slate. Industrial blue-grey. Hard 2px radius.
  steel: {
    name:"Iron Bulwark",
    bg:"#0c1018",     panel:"#161e2c",     border:"#283850",
    accent:"#4488cc", accentText:"#88ccff",
    text:"#e8f0ff",   textDim:"#8aaad0",   textFaint:"#304060",
    headerBg:"rgba(8,12,20,0.97)",
    glow:"rgba(68,136,204,0.4)",
    diceSuccessBg:"rgba(68,136,204,0.22)",  diceSuccessBorder:"rgba(136,204,255,0.65)", diceSuccessColor:"#aaddff",
    radius:2, overlay:"none",
  },

  // ── OLD CODEX ── Aged parchment. Warm sepia. Rough 0px radius.
  codex: {
    name:"Old Codex",
    bg:"#e8dfc8",     panel:"#f2e8d2",     border:"#c0a878",
    accent:"#7a2c08", accentText:"#5a1800",
    text:"#1c1008",   textDim:"#5c3c20",   textFaint:"#a08858",
    headerBg:"rgba(220,208,188,0.98)",
    glow:"rgba(122,44,8,0.3)",
    diceSuccessBg:"rgba(122,44,8,0.18)",    diceSuccessBorder:"rgba(122,44,8,0.7)",    diceSuccessColor:"#4a1400",
    radius:0, overlay:"noise",
  },

  // ── DEEP VOID ── Pure space black. Electric sapphire. Large 12px radius.
  void: {
    name:"Deep Void",
    bg:"#030508",     panel:"#060c18",     border:"#0c1e38",
    accent:"#1870d0", accentText:"#60aaff",
    text:"#d0e8ff",   textDim:"#6090c0",   textFaint:"#102040",
    headerBg:"rgba(2,4,8,0.99)",
    glow:"rgba(24,112,208,0.5)",
    diceSuccessBg:"rgba(24,112,208,0.2)",   diceSuccessBorder:"rgba(96,170,255,0.7)",  diceSuccessColor:"#80c0ff",
    radius:12, overlay:"none",
  },

  // ── DECAY ── Sickly rot green. Organic corruption. Heavy noise.
  decay: {
    name:"Decay",
    bg:"#060a04",     panel:"#0c1408",     border:"#1c2e10",
    accent:"#3c8018", accentText:"#80cc44",
    text:"#d8f0b0",   textDim:"#70a040",   textFaint:"#1c3010",
    headerBg:"rgba(4,7,2,0.97)",
    glow:"rgba(60,128,24,0.45)",
    diceSuccessBg:"rgba(60,128,24,0.24)",   diceSuccessBorder:"rgba(128,204,68,0.7)",  diceSuccessColor:"#a0e050",
    radius:3, overlay:"noise",
  },

  // ── THE GILDED ── Black velvet with gold leaf. Ornate. Imperial.
  gilded: {
    name:"The Gilded",
    bg:"#0c0900",     panel:"#181200",     border:"#342800",
    accent:"#c89400", accentText:"#ffd840",
    text:"#fff8d8",   textDim:"#c0a040",   textFaint:"#403000",
    headerBg:"rgba(8,6,0,0.98)",
    glow:"rgba(200,148,0,0.5)",
    diceSuccessBg:"rgba(200,148,0,0.24)",   diceSuccessBorder:"rgba(255,216,64,0.75)", diceSuccessColor:"#ffe050",
    radius:4, overlay:"none",
  },

  // ── WAAAGH!!! ── Brutal green. Zero radius. Heavy noise. No pretense.
  orky: {
    name:"WAAAGH!!!",
    bg:"#080b04",     panel:"#101808",     border:"#283c10",
    accent:"#5aaa08", accentText:"#b8f020",
    text:"#e8ffc8",   textDim:"#80c030",   textFaint:"#243010",
    headerBg:"rgba(4,6,2,0.99)",
    glow:"rgba(90,170,8,0.55)",
    diceSuccessBg:"rgba(90,170,8,0.26)",    diceSuccessBorder:"rgba(184,240,32,0.75)", diceSuccessColor:"#c8f828",
    radius:0, overlay:"noise",
  },

  // ── EXCESS ── Deep violet-black. Lurid magenta. 20px rounded. Silky.
  excess: {
    name:"Excess",
    bg:"#0a0610",     panel:"#140a1e",     border:"#2c1040",
    accent:"#d030a8", accentText:"#ff70e8",
    text:"#fce8ff",   textDim:"#c060d0",   textFaint:"#340c48",
    headerBg:"rgba(7,4,12,0.98)",
    glow:"rgba(208,48,168,0.55)",
    diceSuccessBg:"rgba(208,48,168,0.24)",  diceSuccessBorder:"rgba(255,112,232,0.72)", diceSuccessColor:"#ff88f8",
    radius:20, overlay:"none",
  },

  // ── NEON PUNK ── Pure black. Toxic cyan. 0px radius. Heavy scanlines.
  neonpunk: {
    name:"Neon Punk",
    bg:"#010103",     panel:"#030609",     border:"#06121e",
    accent:"#00ccb4", accentText:"#00ffea",
    text:"#c8fff8",   textDim:"#30a090",   textFaint:"#061818",
    headerBg:"rgba(1,1,3,1)",
    glow:"rgba(0,204,180,0.65)",
    diceSuccessBg:"rgba(0,204,180,0.2)",    diceSuccessBorder:"rgba(0,255,234,0.8)",   diceSuccessColor:"#00ffe8",
    radius:0, overlay:"scanlines",
  },

  // ── THE TRENCH ── Filthy brown-black. Dried mud and rust. Noise.
  trench: {
    name:"The Trench",
    bg:"#0e0a06",     panel:"#181208",     border:"#382410",
    accent:"#907030", accentText:"#d0a850",
    text:"#e8d8a8",   textDim:"#a07840",   textFaint:"#3c2410",
    headerBg:"rgba(10,7,4,0.98)",
    glow:"rgba(144,112,48,0.5)",
    diceSuccessBg:"rgba(144,112,48,0.26)",  diceSuccessBorder:"rgba(208,168,80,0.72)", diceSuccessColor:"#dab858",
    radius:1, overlay:"noise",
  },

  // ── DUNES OF MARS ── Rusty ochre. Ancient dust. Orange heat.
  dunes: {
    name:"Dunes of Mars",
    bg:"#160a02",     panel:"#221008",     border:"#442010",
    accent:"#d06020", accentText:"#f09050",
    text:"#f8d8a8",   textDim:"#c08050",   textFaint:"#3c1808",
    headerBg:"rgba(12,6,1,0.98)",
    glow:"rgba(208,96,32,0.5)",
    diceSuccessBg:"rgba(208,96,32,0.24)",   diceSuccessBorder:"rgba(240,144,80,0.72)", diceSuccessColor:"#f0a868",
    radius:2, overlay:"noise",
  },

  // ── FENRIR ── Ice white. Arctic blue. Dark text for max contrast.
  fenrir: {
    name:"Fenrir",
    bg:"#eaf4fc",     panel:"#f4faff",     border:"#b0cce4",
    accent:"#1460a0", accentText:"#0a4880",
    text:"#080e1c",   textDim:"#2c5070",   textFaint:"#88aac4",
    headerBg:"rgba(225,244,252,0.98)",
    glow:"rgba(20,96,160,0.3)",
    diceSuccessBg:"rgba(20,96,160,0.15)",   diceSuccessBorder:"rgba(20,96,160,0.65)",  diceSuccessColor:"#0a4880",
    radius:8, overlay:"none",
  },

  // ── HIGH CONTRAST ── Pure black. White text. Yellow accent. Accessibility.
  highcontrast: {
    name:"High Contrast",
    bg:"#000000",     panel:"#111111",     border:"#555555",
    accent:"#ffdd00", accentText:"#ffee55",
    text:"#ffffff",   textDim:"#eeeeee",   textFaint:"#888888",
    headerBg:"rgba(0,0,0,1)",
    glow:"rgba(255,221,0,0.5)",
    diceSuccessBg:"rgba(255,221,0,0.25)",   diceSuccessBorder:"rgba(255,238,68,0.9)",  diceSuccessColor:"#ffee55",
    radius:4, overlay:"none",
  },
};

export const THEME_GROUPS = {
  "Dark":    ["blood","steel","void","trench","dunes","neonpunk"],
  "Nature":  ["decay","orky"],
  "Light":   ["codex","fenrir","highcontrast"],
  "Special": ["gilded","excess"],
};

export const DEFAULT_THEME = "blood";