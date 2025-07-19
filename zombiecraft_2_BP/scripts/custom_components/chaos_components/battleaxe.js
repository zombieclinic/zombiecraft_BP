import { system } from "@minecraft/server";
import { Rage } from "./rage";

// ── Config ─────────────────────────────────────────────
const HITS_PER_CHARGE      = 3;
const MAX_CHARGES          = 10;

const BASE_RANGE           = 4;
const RANGE_PER_CHARGE     = 1;

const BASE_DAMAGE          = 7;
const DAMAGE_PER_CHARGE    = 1;

const BASE_KNOCKBACK       = 0.8;
const KNOCKBACK_PER_CHARGE = 0.2;

// Penalty attack when no charges:
const PENALTY_DAMAGE    = 5;
const PENALTY_KNOCKBACK = 1;

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
      x: (dx / len) * knockbackStrength,
      y: 0.3,
      z: (dz / len) * knockbackStrength,
    };

    try { if (typeof t.clearVelocity === "function") t.clearVelocity(); } catch {}
    try { if (typeof t.applyImpulse  === "function") t.applyImpulse(impulse); } catch {}
  }
}

//////////////////////// Axe Charge Builder ////////////////////////
export class TppAxeSwing {
  onHitEntity(event) {
    const player    = event.attackingEntity;
    const hadEffect = event.hadEffect;
    if (!player || !hadEffect) return;

    const pid  = player.id;
    let hits   = (rawHits.get(pid) || 0) + 1;

    if (hits >= HITS_PER_CHARGE) {
      hits -= HITS_PER_CHARGE;
      const current   = charges.get(pid) || 0;
      const newCharge = Math.min(current + 1, MAX_CHARGES);
      charges.set(pid, newCharge);
      player.runCommand(`say Charged ${newCharge}`);
    }

    rawHits.set(pid, hits);
  }
}

//////////////////////// Alt Slash (Axe Slash) //////////////////////
export class Alt_swing {
  onUse(event) {
    const player = event.source;
    const pid    = player.id;

    // read combo charges
    const c = charges.get(pid) || 0;

    // read ability-level bonus
    const altLevel = player.getProperty("zombie:alt_ability_level") || 0;
    const extraDmg = altLevel * 0.5;

    player.playAnimation("animation.tpp_axe_swing");

    if (c <= 0) {
      applyAxeDamage(player, PENALTY_DAMAGE + extraDmg, PENALTY_KNOCKBACK, BASE_RANGE);
      player.runCommand(
        `say No charges! Delivered penalty +${extraDmg.toFixed(1)} bonus!`
      );
    } else {
      const range     = BASE_RANGE + c * RANGE_PER_CHARGE;
      const totalDmg  = (BASE_DAMAGE + c * DAMAGE_PER_CHARGE) + extraDmg;
      const knockback = BASE_KNOCKBACK + c * KNOCKBACK_PER_CHARGE;

      applyAxeDamage(player, totalDmg, knockback, range);
      player.dimension.runCommand(
        `title @s actionbar "Unleashed ${c} charge${c !== 1 ? 's' : ''} +${extraDmg.toFixed(1)} bonus!"`
      );
    }

    // reset combo charges
    charges.set(pid, 0);
  }
}

//////////////////////// Jump Attack ///////////////////////////////
export class JumpAttack {
  onUse(event) {
    const player = event.source;
    const lvl    = player.getProperty("zombie:alt_jump_ability_level") || 0;

    if (lvl < 1) {
      player.sendMessage("§cYou haven’t learned Jump Attack yet!");
      return;
    }

    const extra  = lvl * 0.5;
    const damage = Math.floor(20 + extra);

    player.sendMessage(`§bJump Attack (Lv.${lvl}) deals ${damage} damage!`);

    player.runCommand("tag @s add _rageTemp");
    player.runCommand("playanimation @s animation.demon_sword.jump_attack");
    player.runCommand(
      `execute at @s facing ^ ^ ^1 run damage @e[tag=!_rageTemp,r=2] ${damage} entity_attack entity @s`
    );
    player.runCommand("tag @s remove _rageTemp");
  }
}

//////////////////////// Controller ////////////////////////////////
export class BerserkerAxeController {
  onUse(event) {
    const player = event.source;

    // — Up-front XP requirement & consume —
    const xpComp = player.getComponent("minecraft:experience");
    if (!xpComp || xpComp.currentLevel < 1) {
      player.sendMessage("§cNot enough XP to use any Berserker ability!");
      return;
    }
    player.runCommand("xp -1L @s");

    // Sneak → Rage
    if (player.isSneaking) {
      const lvl = player.getProperty("zombie:sneak_ability_level") || 0;
      if (lvl < 1) {
        player.sendMessage("§cYour Rage skill is too low! Reach Lv.1 to use Rage.");
        return;
      }
      new Rage().onUse(event);
      return;
    }

    // Jump → JumpAttack
    if (player.isJumping) {
      const lvl = player.getProperty("zombie:alt_jump_ability_level") || 0;
      if (lvl < 1) {
        player.sendMessage("§cYour Jump Attack skill is too low! Reach Lv.1 to use Jump Attack.");
        return;
      }
      new JumpAttack().onUse(event);
      return;
    }

    // Normal → Slash
    const lvl = player.getProperty("zombie:alt_ability_level") || 0;
    if (lvl < 1) {
      player.sendMessage("§cYour Axe Slash skill is too low! Reach Lv.1 to use Slash.");
      return;
    }
    new Alt_swing().onUse(event);
  }
}
