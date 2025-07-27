import { world, system } from "@minecraft/server";




export function worldsettings() {
  const overworld = world.getDimension("overworld");

  // ─── 1) Spawn‑area cleanup ───
  const spawnRadius = world.getDynamicProperty("spawnprotection");
  const spawnProp   = world.getDynamicProperty("worldspawn");
  if (
    typeof spawnRadius !== "number" ||
    spawnRadius <= 0 ||
    typeof spawnProp !== "string"
  ) {
    console.warn("Spawn protection radius or spawn coords not set properly.");
  } else {
    const [sx, sy, sz] = spawnProp.split(" ").map(Number);
    if (![sx, sy, sz].every(n => !isNaN(n))) {
      console.warn("Invalid spawn coordinate format.");
    } else {
      const monsters = overworld.getEntities({
        families: ["monster"],
        location: { x: sx, y: sy, z: sz },
        maxDistance: spawnRadius
      });
      for (const mob of monsters) mob.remove();
    }
  }

  // ─── 2) Base‑security enforcement ───
  const baseRadius = world.getDynamicProperty("baseRadius");
  if (typeof baseRadius !== "number" || baseRadius <= 0) {
    console.warn("Base radius not set properly.");
    return;
  }

  const baseProps = world
    .getDynamicPropertyIds()
    .filter(id => id.startsWith("base_") && !id.includes("_mates"));

  for (const prop of baseProps) {
    const owner = prop.replace("base_", "");
    const raw   = world.getDynamicProperty(prop);
    if (typeof raw !== "string") continue;

    const [bx, by, bz] = raw.split(" ").map(Number);
    if (![bx, by, bz].every(n => !isNaN(n))) continue;

    const matesRaw        = world.getDynamicProperty(`${prop}_mates`) || "";
    const mates           = matesRaw.split("|").map(s => s.trim().toLowerCase());
    const everyoneAllowed = mates.includes("everyone");

    for (const p of world.getPlayers()) {
      if (p.name === owner)                    continue;
      if (everyoneAllowed)                     continue;
      if (mates.includes(p.name.toLowerCase())) continue;

      const dx   = p.location.x - bx;
      const dz   = p.location.z - bz;
      const dist = Math.hypot(dx, dz);

      if (dist < baseRadius) {
        let ux, uz;
        if (dist < 1) { ux = 1; uz = 0; }
        else         { ux = dx / dist; uz = dz / dist; }

        const safeDist = baseRadius + 50;
        const targetX  = bx + ux * safeDist;
        const targetZ  = bz + uz * safeDist;
        const targetY  = by + 200;

        p.teleport({ x: targetX, y: targetY, z: targetZ }, overworld);
        p.addEffect("minecraft:slow_falling", 600, {
          amplifier: 0,
          showParticles: true
        });
        p.sendMessage(
          `§cYou were too close to ${owner}'s base at (${bx}, ${by}, ${bz}).\n` +
          `You’ve been moved to (${Math.floor(targetX)}, ${targetY}, ${Math.floor(targetZ)}),\n` +
          `about 50 blocks outside the ${baseRadius}-block radius.`
        );
      }
    }
  }

  // ─── 3) Economy scoreboard refresh & start‑bonus (if economy settings exist) ───
  const econKeys = world
    .getDynamicPropertyIds()
    .filter(id => id.startsWith("economy_"));
  if (econKeys.length > 0) {
    // Remove old Display
    overworld.runCommand(`scoreboard objectives remove Display`);

    // Re-create Display with saved currency name
    const currencyName = world.getDynamicProperty("economy_currencyName") ?? "Coins";
    overworld.runCommand(
      `scoreboard objectives add Display dummy "${currencyName}"`
    );

    // Set display slot & order
    const displayType = world.getDynamicProperty("economy_displayType") ?? "belowname";
    const listOrder   = world.getDynamicProperty("economy_listOrder")   ?? "ascending";
    let setDisplayCmd = `scoreboard objectives setdisplay ${displayType} Display`;
    if (displayType === "list") setDisplayCmd += ` ${listOrder}`;
    overworld.runCommand(setDisplayCmd);

    // Copy Display into Money for all online players
    overworld.runCommand(
      `execute as @a run scoreboard players operation @s Display = @s Money`
    );

    // Give start bonus once
    const startBonus = world.getDynamicProperty("economy_startBonus") ?? 0;
    if (startBonus > 0) {
      // Only players without the 'start' tag
      overworld.runCommand(
        `scoreboard players add @a[tag=!start] Money ${startBonus}`
      );
      overworld.runCommand(
        `tag @a[tag=!start] add start`
      );
    }
  }
}
