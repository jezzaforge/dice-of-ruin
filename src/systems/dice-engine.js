// ─── DICE ENGINE ─────────────────────────────────────────────────────────────
// Pure functions, no React. This is the module that will become Rust/WASM.

export const rollD6  = () => Math.floor(Math.random() * 6) + 1;
export const rollD3  = () => Math.floor(Math.random() * 3) + 1;
export function rollN(sides, count = 1) {
  let t = 0; for (let i = 0; i < count; i++) t += Math.floor(Math.random() * sides) + 1; return t;
}
export function rollAttacks(a) {
  if (a.dice > 0) { let t = a.bonus; for (let i = 0; i < (a.count || 1); i++) t += Math.floor(Math.random() * a.dice) + 1; return t; }
  return a.fixed;
}
export function rollDmg(s) {
  const m = s?.match(/^(\d*)D(\d+)(?:\+(\d+))?$/i);
  if (m) { let t = parseInt(m[3]) || 0; for (let i = 0; i < (parseInt(m[1]) || 1); i++) t += Math.floor(Math.random() * (parseInt(m[2]) || 6)) + 1; return t; }
  return parseInt(s) || 1;
}

export function performRoll({
  weapon, numActiveModels, toughness, armorSave,
  invulnEnabled, invulnSave, halfRange, lanceActive,
  blastEnemyCount, hitMod, woundMod, targetKeywords,
  rerollOnesHit, rerollOnesWound, leaderBuffs,
}) {
  const kw = weapon.kw;
  const lb = leaderBuffs || {};

  // Merge weapon keywords with leader buffs
  const hasLethal       = kw.lethalHits       || lb.lethalHits;
  const hasDev          = kw.devastatingWounds || lb.devastatingWounds;
  const hasSust         = kw.sustainedHits > 0 || lb.sustainedHits;
  const sustVal         = lb.sustainedHits ? (lb.sustainedHitsVal || 1) : kw.sustainedHits;
  const hasRerollHits   = !!lb.rerollHits;
  const hasRerollWounds = kw.twinLinked || !!lb.rerollWounds;

  // ── Attacks ──
  let baseAttacks = rollAttacks(weapon.attacks);
  if (kw.rapidFire > 0 && halfRange) baseAttacks += kw.rapidFire;
  if (kw.blast) baseAttacks += Math.floor((blastEnemyCount || 0) / 5);
  const numAttacks = baseAttacks * numActiveModels;

  // ── Hit threshold ──
  const hitTarget = Math.min(6, Math.max(2, weapon.skill - hitMod));

  // ── Wound threshold ──
  const s = weapon.strength, t = toughness;
  const baseWT    = s >= t * 2 ? 2 : s > t ? 3 : s === t ? 4 : s * 2 <= t ? 6 : 5;
  const woundTarget = Math.min(6, Math.max(2, (kw.lance && lanceActive ? baseWT - 1 : baseWT) - woundMod));

  // ── Save — invuln ignores AP, pick whichever is better for the defender ──
  const ap = Math.abs(weapon.ap);
  const modArmor = Math.min(7, armorSave + ap);
  const effSave  = invulnEnabled ? Math.min(modArmor, invulnSave) : modArmor;
  const saveIsInvuln = invulnEnabled && invulnSave < modArmor;
  const saveNote = invulnEnabled && invulnSave < modArmor
    ? `Using invuln ${invulnSave}+ (AP makes armour ${modArmor}+)`
    : invulnEnabled
    ? `Using armour ${modArmor}+ (better than invuln ${invulnSave}+)`
    : null;

  const hitRolls=[], woundRolls=[], saveRolls=[], damageDealt=[], rerolledHits=[], rerolledWounds=[];
  const antiMatch = kw.anti && targetKeywords && targetKeywords.toLowerCase().includes(kw.anti.toLowerCase());

  for (let i = 0; i < numAttacks; i++) {
    let roll = kw.torrent ? 6 : rollD6();
    // One reroll per hit die — rerollOnes has priority over leader reroll
    if (!kw.torrent) {
      if      (rerollOnesHit && roll === 1)          { rerolledHits.push(roll); roll = rollD6(); }
      else if (hasRerollHits && roll < hitTarget)    { rerolledHits.push(roll); roll = rollD6(); }
    }
    hitRolls.push(roll);
    let hits = (kw.torrent || roll >= hitTarget) ? 1 : 0;
    if (roll === 6 && hasSust) hits += sustVal;

    for (let h = 0; h < hits; h++) {
      let wRoll = rollD6();
      // One reroll per wound die
      if      (rerollOnesWound && wRoll === 1)         { rerolledWounds.push(wRoll); wRoll = rollD6(); }
      else if (hasRerollWounds && wRoll < woundTarget) { rerolledWounds.push(wRoll); wRoll = rollD6(); }
      woundRolls.push(wRoll);

      const autoWound   = hasLethal && wRoll === 6;
      const devWound    = hasDev    && wRoll === 6;
      const antiCrit    = antiMatch && wRoll >= kw.antiValue;
      const normalWound = wRoll >= woundTarget;

      if (autoWound || devWound || antiCrit || normalWound) {
        if (devWound || (antiCrit && !normalWound)) {
          damageDealt.push(rollDmg(weapon.damage)); // bypasses saves
        } else {
          const sRoll = rollD6(); saveRolls.push(sRoll);
          if (sRoll < effSave) {
            let dmg = rollDmg(weapon.damage);
            if (kw.melta > 0 && halfRange) dmg += rollN(6, kw.melta);
            damageDealt.push(dmg);
          }
        }
      }
    }
  }

  return {
    hitRolls, woundRolls, saveRolls, damageDealt,
    rerolledHits, rerolledWounds,
    numAttacks, hitTarget, woundTarget, effSave, modArmor,
    saveIsInvuln, saveNote, baseAttacks,
  };
}

// ── Reroll wounds only (re-runs full wound→save→damage chain) ──
export function rerollWoundsOnly(prevResult, weapon) {
  const { woundTarget, effSave } = prevResult;
  const kw = weapon.kw;
  const newWR = prevResult.woundRolls.map(() => rollD6());
  const newSR = [], newDmg = [];
  newWR.forEach(wRoll => {
    const devWound = kw.devastatingWounds && wRoll === 6;
    const normalWound = wRoll >= woundTarget;
    if (devWound || normalWound) {
      if (devWound) { newDmg.push(rollDmg(weapon.damage)); }
      else { const sRoll = rollD6(); newSR.push(sRoll); if (sRoll < effSave) newDmg.push(rollDmg(weapon.damage)); }
    }
  });
  return { ...prevResult, woundRolls: newWR, saveRolls: newSR, damageDealt: newDmg };
}

// ── Reroll saves only ──
export function rerollSavesOnly(prevResult, weapon) {
  const { effSave } = prevResult;
  const newSR = prevResult.saveRolls.map(() => rollD6());
  const newDmg = newSR.filter(s => s < effSave).map(() => rollDmg(weapon.damage));
  return { ...prevResult, saveRolls: newSR, damageDealt: newDmg };
}