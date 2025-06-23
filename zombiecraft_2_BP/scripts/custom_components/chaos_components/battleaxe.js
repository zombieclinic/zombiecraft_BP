

////////////////////////axe_swing///////////////////

// ── Config ─────────────────────────────────────────────
const HITS_PER_CHARGE      = 3;
const MAX_CHARGES          = 10;

const BASE_RANGE           = 4;
const RANGE_PER_CHARGE     = 1;   // +1 block per charge

const BASE_DAMAGE          = 7;
const DAMAGE_PER_CHARGE    = 1;   // +1 damage per charge

const BASE_KNOCKBACK       = 0.8;
const KNOCKBACK_PER_CHARGE = 0.2; // +0.2 impulse per charge

// Penalty attack when no charges:
const PENALTY_DAMAGE       = 5;   // “level 5” attack
const PENALTY_KNOCKBACK    = 1;   // moderate knockback
const PENALTY_SELF_DAMAGE  = 6;   // 3 hearts = 6 HP

// ── State ──────────────────────────────────────────────
const rawHits = new Map();   // Map<playerId, number>
const charges = new Map();   // Map<playerId, number>

/**
 * AOE damage & knockback helper.
 */
function applyAxeDamage(player, damageAmount, knockbackStrength, range) {
  const pid = player.id;
  const targets = player.dimension
    .getEntities({ location: player.location, maxDistance: range })
    .filter(e => e.id !== pid);

  for (const t of targets) {
    let loc;
    try { loc = t.location; if (!loc) throw 0; } catch { continue; }
    try { t.applyDamage(damageAmount); } catch { continue; }

    const dx = loc.x - player.location.x;
    const dz = loc.z - player.location.z;
    const len = Math.hypot(dx, dz) || 1;
    const impulse = {
      x: (dx/len) * knockbackStrength,
      y: 0.3,
      z: (dz/len) * knockbackStrength,
    };

    try { if (typeof t.clearVelocity === "function") t.clearVelocity(); } catch {}
    try { if (typeof t.applyImpulse  === "function") t.applyImpulse(impulse); } catch {}
  }
}
///////////////////////////////axe_swing///////////////////
export class TppAxeSwing {
  /**
   * Build charges on every direct hit.
   */
  onHitEntity(event) {
    const player    = event.attackingEntity;
    const target    = event.hitEntity;
    const hadEffect = event.hadEffect;
    if (!player || !target || !hadEffect) return;

    const pid = player.id;
    let hits = (rawHits.get(pid) || 0) + 1;

    if (hits >= HITS_PER_CHARGE) {
      hits -= HITS_PER_CHARGE;
      const newCharge = Math.min((charges.get(pid) || 0) + 1, MAX_CHARGES);
      charges.set(pid, newCharge);

      // Chat feedback so you see it
      player.runCommand(`say  Charged ${newCharge}`);
    }

    rawHits.set(pid, hits);
  }

  /**
   * Consume charges on use, or penalty if zero.
   */
  onUse(event) {
    const player = event.source;
    const pid    = player.id;
    const c      = charges.get(pid) || 0;

    // always play swing animation
    player.playAnimation("animation.tpp_axe_swing");

    if (c <= 0) {
      // No charges: penalty
      player.applyDamage(PENALTY_SELF_DAMAGE);
      applyAxeDamage(player, PENALTY_DAMAGE, PENALTY_KNOCKBACK, BASE_RANGE);
      player.runCommand(`say  No charges! Took 3 hearts, unleashed level 5 attack!`);
    } else {
      // Consume charges: empowered AOE
      const range     = BASE_RANGE + c * RANGE_PER_CHARGE;
      const damage    = BASE_DAMAGE + c * DAMAGE_PER_CHARGE;
      const knockback = BASE_KNOCKBACK + c * KNOCKBACK_PER_CHARGE;
      applyAxeDamage(player, damage, knockback, range);

      // Feedback
      player.dimension
        .runCommand(`title @s actionbar "Unleashed ${c} charge${c!==1?'s':''}!"`)
    }

    // reset for next combo
    charges.set(pid, 0);
    rawHits.set(pid, 0);
  }
}
