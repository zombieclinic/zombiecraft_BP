
import { world } from "@minecraft/server";

const GOAL  = 50;   
const RANGE = 100;  

export class AlligatorEgg {
  onTick(ev) {
    try {
      const roll = 1 + Math.floor(Math.random() * RANGE);
      if (roll !== GOAL) return;

      const block = ev.block;
      const pos = { x: block.location.x + 0.5, y: block.location.y + 0.2, z: block.location.z + 0.5 };
      const dim = block.dimension ?? world.getDimension("overworld");

      const gator = dim.spawnEntity("zombie:alligator", pos);
      try { gator?.triggerEvent("minecraft:entity_born"); } catch {}

      block.setType("minecraft:air");
    } catch {}
  }
}
