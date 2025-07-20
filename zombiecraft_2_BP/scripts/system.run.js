import { world } from "@minecraft/server";

export async function worldsettings() {
  const overworld = world.getDimension("overworld");

  // Grab every monster‐family mob within 1 000 blocks of (0,71,0)
  const monsters = overworld.getEntities({
    families: ["monster"],
    location: { x: 0, y: 71, z: 0 },
    maxDistance: 1000
  });

  // Despawn them all—mob.remove() never drops loot
  for (const mob of monsters) {
    mob.remove();
  }
}