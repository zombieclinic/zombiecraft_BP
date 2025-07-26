import { world } from "@minecraft/server";

export function worldsettings() {
  const overworld = world.getDimension("overworld");

  // Get spawn protection radius and spawn location
  const radius = world.getDynamicProperty("spawnprotection");
  const spawnCoords = world.getDynamicProperty("worldspawn");

  if (typeof radius !== "number" || radius <= 0 || typeof spawnCoords !== "string") {
    console.warn("Spawn protection radius or location not set properly.");
    return;
  }

  // Parse the spawn location string: "x y z" -> { x, y, z }
  const [x, y, z] = spawnCoords.split(" ").map(Number);

  if ([x, y, z].some(n => isNaN(n))) {
    console.warn("Invalid spawn coordinate format.");
    return;
  }

  // Grab monster mobs within radius of the saved spawn point
  const monsters = overworld.getEntities({
    families: ["monster"],
    location: { x, y, z },
    maxDistance: radius
  });

  // Despawn them cleanly
  for (const mob of monsters) {
    mob.remove();
  }
}
