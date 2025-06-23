import {system} from "@minecraft/server";

//////////////////// Rage ////////////////////////

export class Rage {
  onUse(event) {
    const player = event.source;
    const lvl    = player.getProperty("zombie:sneak_ability_level") ?? 0;

    if (lvl <= 0) {
      player.sendMessage("§cYou haven’t learned Rage yet!");
      return;
    }


    if (activeRagers.has(player.id)) {
      player.sendMessage("§7Rage is already active!");
      return;
    }
    activeRagers.add(player.id);

 
    player.runCommand("playsound rage @s");
    player.runCommand("inputpermission set @s lateral_movement disabled");


    const loopId = system.runInterval(() => {
      player.runCommand("execute at @s run particle zombie:choas_rage ~ ~1 ~");
      player.runCommand("tag @s add _rageTemp");
      player.runCommand("damage @e[r=6,tag=!_rageTemp] 1 entity_attack entity @s");
      player.runCommand("tag @s remove _rageTemp");
    }, 5);

    system.runTimeout(() => {
      system.clearRun(loopId);
      player.runCommand("inputpermission set @s lateral_movement enabled");
      player.runCommand("playsound random.explode @s");
      player.runCommand("execute at @s run particle zombie:rage_2 ~ ~1 ~");

   
      const KSTR = 3.0, VBOOST = 0.8;
      for (const tgt of player.dimension.getEntities({
        location: player.location,
        maxDistance: 3
      })) {
        if (tgt !== player && typeof tgt.applyKnockback === "function") {
          const dx = tgt.location.x - player.location.x;
          const dz = tgt.location.z - player.location.z;
          const d  = Math.max(1, Math.hypot(dx, dz));
          const horiz = { x: (dx / d) * KSTR, z: (dz / d) * KSTR };
          tgt.applyKnockback(horiz, VBOOST);
        }
      }

    
      const buffs = Math.min(lvl * 2, 40) * 20;
      const strA  = Math.min(Math.floor(lvl / 10), 2);
      const spdA  = lvl >= 20 ? 1 : 0;
      player.addEffect("strength", buffs, { amplifier: strA, showParticles: false });
      player.addEffect("speed",    buffs, { amplifier: spdA, showParticles: false });

   
      player.setProperty("zombie:summon_timer", Math.min(lvl, 20));
      system.runTimeout(() => {
        player.setProperty("zombie:summon_timer", 0);
        activeRagers.delete(player.id);
      }, buffs);

 
      try {
        player.runCommand("xp -1L @s");
      } catch {
        const hp = player.getComponent("minecraft:health");
        if (hp && hp.currentValue > 1) {
          const loss = Math.max(1, Math.floor((hp.defaultValue ?? 20) * 0.3));
          system.run(() => player.applyDamage(loss));
        }
      }
    }, 60); 
  }
}

const activeRagers = new Set();


