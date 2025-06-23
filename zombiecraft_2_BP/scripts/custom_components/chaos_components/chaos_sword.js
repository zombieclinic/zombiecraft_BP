import {system} from "@minecraft/server";
import {Rage} from "./rage"


////////////////////sword////////////////



export class BerserkerAttackController {
  onUse(event) {
    const player = event.source;

 
    if (player.isSneaking) {
      new Rage().onUse(event);
      return;
    }

    // 2) Jump + use → JumpAttack
    if (player.isJumping) {
      new JumpAttack().onUse(event);
      return;
    }

    // 3) Normal use → SwingAttack
    new SwingAttack().onUse(event);
      return;
  }
}

//////////////////// JumpAttack ////////////////////

export class JumpAttack {
  onUse(event) {
    const player = event.source;
    const lvl    = player.getProperty("zombie:jump_ability_level") ?? 0;

    if (lvl <= 0) {
      player.sendMessage("§cYou haven’t learned Jump Attack yet!");
      return;
    }

    // calculate damage: base 20 + 0.5 per skill point
    const dmgExtra = lvl * 0.5;
    const damage   = Math.floor(20 + dmgExtra);

    player.sendMessage(`§bJump Attack (Lv.${lvl}) deals ${damage} damage!`);
    player.runCommand(`tag @s add _rageTemp`);
    player.runCommand(`playanimation @s animation.demon_sword.jump_attack`);
    player.runCommand(
      `execute at @s facing ^ ^ ^1 run damage @e[tag=!_rageTemp,r=2] ${damage} entity_attack entity @s`
    );
    player.runCommand(
      `execute at @s facing ^ ^ ^1 run effect @e[tag=!_rageTemp,r=4] minecraft:poison 5 0`
    );
    player.runCommand(`tag @s remove _rageTemp`);

    // cost: 1 XP or 1 heart on fail
    try {
      player.runCommand("xp -1L @s");
    } catch {
      const hp = player.getComponent("minecraft:health");
      if (hp && hp.currentValue > 1) {
        player.applyDamage(1);
      }
    }
  }
}

//////////////////// SwingAttack ////////////////////

export class SwingAttack {
  onUse(event) {
    const player = event.source;
    const lvl    = player.getProperty("zombie:ability_level") ?? 0;

    if (lvl <= 0) {
      player.sendMessage("§cYou haven’t learned Sword Slash yet!");
      return;
    }

    // calculate damage: base 5 + 0.5 per skill point
    const dmgExtra = lvl * 0.5;
    const damage   = Math.floor(5 + dmgExtra);

    player.sendMessage(`§bSword Slash (Lv.${lvl}) deals ${damage} damage!`);
    player.runCommand(`tag @s add _rageTemp`);
    player.runCommand(`playanimation @s animation.sword_tpp_swing`);

    // 1) damage
    player.runCommand(
      `execute at @s facing ^ ^ ^1 run damage @e[tag=!_rageTemp,r=4] ${damage} entity_attack entity @s`
    );

    // 2) poison for 5 seconds (effect duration is in seconds)
    player.runCommand(
      `execute at @s facing ^ ^ ^1 run effect @e[tag=!_rageTemp,r=4] minecraft:poison 5 0`
    );

    player.runCommand(`tag @s remove _rageTemp`);

    // cost: 1 XP or 1 heart on fail
    try {
      player.runCommand("xp -1L @s");
    } catch {
      const hp = player.getComponent("minecraft:health");
      if (hp && hp.currentValue > 1) {
        player.applyDamage(1);
      }
    }
  }
}


export class SwordHit {
  onHitEntity(event) {
    const { source: attacker, target, customComponentParameters } = event;

    if (!attacker || !target || !target.isValid) return;

    const vLevel = attacker.getProperty("zombie:v_attack") ?? 0;
    const bonusDamage = vLevel * 1.0;

    const hp = target.getComponent("minecraft:health");
    if (!hp) return;

    system.run(() => {
      try {
        if (!target.isValid) return;

        // —— Apply Manual Damage —— 
        const newHealth = Math.max(hp.currentValue - bonusDamage, 0);
        hp.setCurrentValue(newHealth);

        // —— Knockback Scaling ——
        let knockbackStrength = 0;
        if (vLevel >= 20) knockbackStrength = 1.0;
        else if (vLevel >= 15) knockbackStrength = 0.7;
        else if (vLevel >= 10) knockbackStrength = 0.5;
        else if (vLevel >= 5) knockbackStrength = 0.3;

        if (knockbackStrength > 0) {
          const posA = attacker.location;
          const posT = target.location;

          let dx = posT.x - posA.x;
          let dz = posT.z - posA.z;
          const dist = Math.hypot(dx, dz);

          if (dist === 0) return;
          dx /= dist;
          dz /= dist;

          target.applyKnockback(dx, dz, knockbackStrength, 0.1);
        }

      } catch (e) {
        console.warn("⚠️ SwordHit error:", e);
      }
    });
  }
}