import {Player, system,} from "@minecraft/server";

/////////////////XP/////////////////////////////////////

const GROUP_ONE = new Set([
  "minecraft:allay","minecraft:armadillo","minecraft:axolotl","minecraft:bat",
  "minecraft:bee","minecraft:cat","minecraft:chicken","minecraft:cod",
  "minecraft:cow","minecraft:donkey","minecraft:fox","minecraft:glow_squid",
  "minecraft:horse","minecraft:mooshroom","minecraft:mule","minecraft:ocelot",
  "minecraft:parrot","minecraft:pig","minecraft:pufferfish","minecraft:rabbit",
  "minecraft:salmon","minecraft:sheep","minecraft:snow_golem","minecraft:squid",
  "minecraft:strider","minecraft:tadpole","minecraft:trader_llama",
  "minecraft:tropical_fish","minecraft:turtle","minecraft:villager",
  "minecraft:wandering_trader"
]);
const GROUP_TWO = new Set([
  "minecraft:villager_v2","minecraft:wandering_trader"
]);

export class ChaosXp {
  onHitEntity(event) {
    const attacker = event.attackingEntity;
    const target   = event.hitEntity;
    if (!(attacker instanceof Player)) return;

    const id = target.typeId;
    const inGroupOne = GROUP_ONE.has(id);
    const inGroupTwo = GROUP_TWO.has(id);

    // Set the correct chances
    let chance = 0.0;
    if (inGroupOne) chance = 0.008; 
    else if (inGroupTwo) chance = 0.99; 

    // Chance gate
    if (Math.random() > chance) return;

    // Award Chaos XP (Essence)
    system.runTimeout(() => {
      const oldVal = attacker.getProperty("zombie:essence") ?? 0;
      const newVal = Math.min(oldVal + 1, 200);
      attacker.setProperty("zombie:essence", newVal);

      attacker.sendMessage(`§g☠§4 Blood for the Blood God §c${Math.floor(newVal)}§r Chaos XP`);
      attacker.playSound("Demon_talk"); // Replace with "Demon_talk" if your sound is working
    }, 0);
  }
}