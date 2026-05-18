export const FONT_MAP = {
  cinzel:    { label:"Cinzel",          css:"'Cinzel', serif",         imp:"Cinzel:wght@400;600;700" },
  uncial:    { label:"Uncial Antiqua",  css:"'Uncial Antiqua', serif", imp:"Uncial+Antiqua" },
  almendra:  { label:"Almendra",        css:"'Almendra', serif",       imp:"Almendra:wght@400;700" },
  exo:       { label:"Exo 2",           css:"'Exo 2', sans-serif",     imp:"Exo+2:wght@300;400;700" },
  rajdhani:  { label:"Rajdhani",        css:"'Rajdhani', sans-serif",  imp:"Rajdhani:wght@400;600;700" },
  roboto:    { label:"Roboto",          css:"'Roboto', sans-serif",    imp:"Roboto:wght@300;400;700" },
};

export const DEFAULT_SETTINGS = {
  // Display
  compactMode:       false,
  alwaysExpandDice:  false,
  showKeywordBadges: true,
  typeface:          "cinzel",
  // Roll defaults
  defaultToughness:  4,
  defaultSave:       4,
  defaultPhase:      "shooting",
  // Tracking
  autoMarkFired:     true,
  autoResetFired:    true,
  trackStats:        true,
  diceSound:         false,
};

export const WCOLORS = [
  { bg:"#7b1c1c", border:"#e74c3c", glow:"rgba(231,76,60,0.4)",   label:"#ff6b6b" },
  { bg:"#1a4a7a", border:"#4fa3e0", glow:"rgba(79,163,224,0.4)",  label:"#7ec8ff" },
  { bg:"#4a2370", border:"#b07fe8", glow:"rgba(176,127,232,0.4)", label:"#d4a8ff" },
  { bg:"#1a5c38", border:"#3ecf78", glow:"rgba(62,207,120,0.4)",  label:"#5dffaa" },
  { bg:"#7a4d10", border:"#f0a030", glow:"rgba(240,160,48,0.4)",  label:"#ffc055" },
  { bg:"#5c1a3a", border:"#f060b0", glow:"rgba(240,96,176,0.4)",  label:"#ff90d0" },
];

export const ANTI_KW = [
  "INFANTRY","VEHICLE","MONSTER","MOUNTED","BEAST","SWARM","FORTIFICATION",
  "CHARACTER","FLY","PSYKER","TITANIC",
  "TYRANID","DAEMON","CHAOS","IMPERIUM","NECRON","ORK","TAU","ELDAR","AELDARI","DRUKHARI","SPACE MARINE",
];