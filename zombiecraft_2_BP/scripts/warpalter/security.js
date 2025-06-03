import { world } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { manageWarpAlter } from "./managedatlas.js";

const SEP = "¦";

/**
 * Toggles and displays base security state for a warp atlas.
 * @param {import("@minecraft/server").Player} player
 * @param {any} entryObj  The scoreboard participant object for this warp
 * @param {string} coords  The coordinates string for context
 */
export function baseSecurity(player, entryObj, coords) {
  const atlasObj     = world.scoreboard.getObjective("warpatlas");
  const currentScore = atlasObj.getScore(entryObj);

  // Security is ON for scores 3 or 4
  const isSecOn     = currentScore >= 3;
  const statusText  = isSecOn ? "ON" : "OFF";
  const toggleLabel = isSecOn ? "Security: On" : "Security: Off";

  new ActionFormData()
    .title("Base Security")
    .body(`Security is currently §l${statusText}`)
    .button(toggleLabel)
    .button("↩ Back")
    .button("§l§cExit")
    .show(player)
    .then(res => {
      if (res.canceled) {
        return manageWarpAlter(player, coords);
      }
      // Toggle security
      if (res.selection === 0) {
        let newScore;
        if (!isSecOn) {
          // Turning on: use 3 for unlocked (0->3), 4 for locked (1->4)
          newScore = (currentScore % 2 === 1 ? 4 : 3);
        } else {
          // Turning off: use 0 for unlocked (3->0), 1 for locked (4->1)
          newScore = (currentScore % 2 === 1 ? 1 : 0);
        }
        atlasObj.setScore(entryObj.displayName, newScore);
        // Refresh menu
        return baseSecurity(player, entryObj, coords);
      }
      // Back to manage menu
      if (res.selection === 1) {
        return manageWarpAlter(player, coords);
      }
      // Exit: do nothing
    });
}




/**
 * Security check: warns & catapults unauthorized players high above until
 * they’re at least 20 blocks outside the base radius, then gives Slow Falling.
 */
export function securityCheck() {
  const atlasObj = world.scoreboard.getObjective("warpatlas");
  const adminObj = world.scoreboard.getObjective("admin");
  if (!atlasObj || !adminObj) return;

  // ensure "security" fake‑player exists with default radius = 500
  if (
    !adminObj
      .getParticipants()
      .some(id => id.displayName === "security")
  ) {
    adminObj.setScore("security", 500);
  }

  const radius = adminObj.getScore("security") ?? 0;
  if (radius <= 0) return;

  const online = world.getPlayers();
  for (const entry of atlasObj.getParticipants()) {
    const parts = entry.displayName.split(SEP);
    if (parts[0] !== "private") continue;
    if (atlasObj.getScore(entry) < 3) continue;

    const [wx, wy, wz] = parts[1].split(",").map(Number);
    const baseOwner    = parts[2];
    const allowed      = parts.slice(3);

    for (const p of online) {
      if (allowed.includes(p.name)) continue;
      const loc  = p.location;
      const dist = Math.hypot(loc.x - wx, loc.y - wy, loc.z - wz);
      if (dist > radius) continue;

      // compute how many more blocks they need
      const distRounded   = Math.floor(dist);
      const blocksNeeded  = Math.ceil(radius - dist);
      const coordsDisplay = `${wx}, ${wy}, ${wz}`;

      // 1) warning with coords & blocks-needed
      p.runCommandAsync(
        `tellraw @s {"rawtext":[{"text":"§cYou are too close to ${baseOwner}'s base at [${coordsDisplay}]. You are only ~${distRounded} blocks away, but must be ≥${radius}. Move at least ${blocksNeeded} more blocks away!"}]}`
      );

      // 2) direction vector
      const dx = (loc.x - wx) / dist;
      const dz = (loc.z - wz) / dist;

      // 3) find first loaded spot ≥ radius+20 away
      let escapeDist = radius + 20;
      let targetX, targetZ;
      const dim = world.getDimension(p.dimension.id);

      while (true) {
        targetX = wx + dx * escapeDist;
        targetZ = wz + dz * escapeDist;
        const testBlock = dim.getBlock({
          x: Math.floor(targetX),
          y: wy,
          z: Math.floor(targetZ)
        });
        if (testBlock) break;
        escapeDist += 20;
        if (escapeDist > radius + 200) break;
      }

      // 4) launch up + slow falling
      const highY = wy + 150;
      p.runCommandAsync(
        `tp @s ${Math.floor(targetX)} ${highY} ${Math.floor(targetZ)}`
      );
      p.addEffect("minecraft:slow_falling", 1200, {
        amplifier: 0,
        showParticles: false
      });
    }
  }
}
