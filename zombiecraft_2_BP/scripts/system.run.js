
import { world,  GameMode } from "@minecraft/server";


export function worldsettings() {
  const overworld = world.getDimension("overworld");

  // ─── 0) Creative restricted to admins (plus zombieclinic) ───
for (const p of world.getAllPlayers()) {
  try {
    // robust check for creative across API variants
    let gm;
    try { gm = p.getGameMode?.(); } catch {}
    const gmStr = String(gm ?? "").toLowerCase();
    const isCreative = gmStr === "creative" || gm === GameMode?.creative;

    if (!isCreative) continue;

    const isAdmin = world.getDynamicProperty(`admin_${p.name}`) === true;
    const isOwner = p.name.toLowerCase() === "zombieclinic"; // your allowlist test
    if (isAdmin || isOwner) continue;

    let ok = false;

    // 1) Native API if available
    if (typeof p.setGameMode === "function" && GameMode) {
      try { p.setGameMode(GameMode.survival); ok = true; } catch {}
    }

    // 2) Command as the player
    if (!ok) {
      try {
        const r = p.runCommand("gamemode s @s");
        ok = !!(r && r.successCount);
      } catch {}
    }

    // 3) Server-level fallback
    if (!ok) {
      try {
        const safeName = p.name.replace(/"/g, '\\"');
        const r2 = overworld.runCommand(`gamemode s "${safeName}"`);
        ok = !!(r2 && r2.successCount);
      } catch {}
    }

    if (ok) {
      try { p.sendMessage("§cCreative is restricted to admins. You were set to Survival."); } catch {}
    }
  } catch {}
}

  // ─── 1) Spawn‑area cleanup ───
  const spawnRadius = world.getDynamicProperty("spawnprotection");
  const spawnProp   = world.getDynamicProperty("worldspawn");
  if (typeof spawnRadius === "number" && spawnRadius > 0 && typeof spawnProp === "string") {
    const [sx, sy, sz] = spawnProp.split(" ").map(Number);
    const monsters = overworld.getEntities({
      families: ["monster"],
      location: { x: sx, y: sy, z: sz },
      maxDistance: spawnRadius
    });
    for (const m of monsters) m.remove();
  }

  // ─── 2) Base‑security across dimensions ───
  const baseRadius = world.getDynamicProperty("baseRadius");
  if (typeof baseRadius === "number" && baseRadius > 0) {
    const baseKeys = world
      .getDynamicPropertyIds()
      .filter(id => id.startsWith("base_") && !id.includes("_mates"));

    for (const key of baseKeys) {
      const raw = world.getDynamicProperty(key);
      if (typeof raw !== "string" || !raw.includes("|")) continue;


      const [dimName, coordStr] = raw.split("|");
      const [bx, by, bz] = coordStr.split(" ").map(Number);
      if ([bx, by, bz].some(n => isNaN(n))) continue;

      const dim = world.getDimension(dimName);
      if (!dim) continue;  // invalid dimension

      const matesRaw = world.getDynamicProperty(`${key}_mates`) || "";
      const mates    = matesRaw.split("|").map(s => s.toLowerCase().trim());
      const everyone = mates.includes("everyone");

      for (const p of dim.getPlayers()) {
        const isAdmin = world.getDynamicProperty(`admin_${p.name}`) === true;
        const isOwner = p.name === key.replace("base_", "");
        const isMate  = mates.includes(p.name.toLowerCase());
        if (isAdmin || isOwner || everyone || isMate) continue;

        const dx   = p.location.x - bx;
        const dz   = p.location.z - bz;
        const dist = Math.hypot(dx, dz);
        if (dist < baseRadius) {
          // push them just outside the boundary
          const ux    = dist < 1 ? 1 : dx / dist;
          const uz    = dist < 1 ? 0 : dz / dist;
          const safeD = baseRadius + 50;
          const tx    = bx + ux * safeD;
          const tz    = bz + uz * safeD;

          // clamp Y so we don't teleport above build height
          const safeY = Math.min(by + 200, 200);

          // use the TeleportOptions signature
          p.teleport({
            x: tx,
            y: safeY,
            z: tz,
            dimension: dim
          });

          p.addEffect("minecraft:slow_falling", 600, {
            amplifier: 0,
            showParticles: true
          });
          p.sendMessage(
            `§cToo close to base at ${dimName} (${bx},${by},${bz}).\n` +
            `Moved to (${Math.floor(tx)},${safeY},${Math.floor(tz)}).`
          );
        }
      }
    }
  }

  // ─── 3) Economy scoreboard refresh & start‑bonus ───
  const econKeys = world
    .getDynamicPropertyIds()
    .filter(id => id.startsWith("economy_"));
  if (econKeys.length > 0) {
    overworld.runCommand(`scoreboard objectives remove Display`);
    const currencyName = world.getDynamicProperty("economy_currencyName") ?? "Coins";
    overworld.runCommand(`scoreboard objectives add Display dummy "${currencyName}"`);
    const displayType = world.getDynamicProperty("economy_displayType") ?? "belowname";
    const listOrder   = world.getDynamicProperty("economy_listOrder")   ?? "ascending";
    let cmd = `scoreboard objectives setdisplay ${displayType} Display`;
    if (displayType === "list") cmd += ` ${listOrder}`;
    overworld.runCommand(cmd);
    overworld.runCommand(`execute as @a run scoreboard players operation @s Display = @s Money`);
    const bonus = world.getDynamicProperty("economy_startBonus") ?? 0;
    if (bonus > 0) {
      overworld.runCommand(`scoreboard players add @a[tag=!start] Money ${bonus}`);
      overworld.runCommand(`tag @a[tag=!start] add start`);
    }
  }
}