import {EntityComponentTypes, Player, system} from "@minecraft/server";

//////////////////////////thesight/////////////



export class TheSight {
  onHitEntity(event) {
    const attacker = event.attackingEntity;
    const target = event.hitEntity;
    if (!(attacker instanceof Player)) return;

    const sightLevel = attacker.getProperty("zombie:sight_level") ?? 0;
    if (sightLevel <= 0) return;

    const hpComp = target.getComponent(EntityComponentTypes.Health);
    if (!hpComp || !Reflect.has(target, "nameTag")) return;

    const lines = [];

    // Mob name (Level 1+)
    const rawName = target.typeId.split(":").pop();
    const prettyName = rawName
      .split("_")
      .map(w => w[0].toUpperCase() + w.slice(1))
      .join(" ");
    lines.push(`§e${prettyName}`);

    // Heart bar (Level 3+ for hearts, but always show here)
    const currHp = Math.ceil(hpComp.currentValue);
    const maxHp = Math.ceil(hpComp.defaultValue ?? 20);
    let hearts = "";
    for (let i = 0; i < maxHp / 2; i++) {
      hearts += (i < currHp / 2) ? "§c" : "§0❤";
    }
    lines.push(hearts);

    const finalTag = lines.join("\n");

    const existing = target.nameTag;
    if (!existing || existing.startsWith("§e")) {
      try {
        target.nameTag = finalTag;
      } catch {}

      const durationTicks = Math.min(Math.max(sightLevel, 1), 10) * 20;
      system.runTimeout(() => {
        try {
          if (target.nameTag === finalTag) {
            target.nameTag = "";
          }
        } catch {}
      }, durationTicks);
    }
  }
}





