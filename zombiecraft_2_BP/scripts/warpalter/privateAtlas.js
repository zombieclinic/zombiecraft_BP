import { world, system} from "@minecraft/server";
import { ActionFormData, MessageFormData} from "@minecraft/server-ui";
import { playerTpMenu } from "./warpalter";
import { confirmTeleport } from "./teleport";
import {tpPublicAtlas} from "./publicatlas"


const SEP = "¦";
const teleportRequests = {};
const lastCoords = new Map();

export function tpPrivateAtlas(player, coords) {
  const obj = world.scoreboard.getObjective("warpatlas");
  if (!obj) return playerTpMenu(player);

  // 1) grab only the private entries the player is allowed to use
  const privates = obj.getParticipants().filter(entry => {
    const parts = entry.displayName.split(SEP);
    if (parts[0] !== "private") return false;

    const [, coords, nick, friendsCsv, owner] = parts;
    // build an array of allowed names: friends + owner
    const allowed = friendsCsv
      .split(",")
      .map(n => n.trim())
      .filter(n => n.length);
    allowed.push(owner);

    return allowed.includes(player.name);
  });

  // 2) none? tell them and go back
  if (privates.length === 0) {
    player.runCommandAsync(
      `tellraw @s {"rawtext":[{"text":"§cNo private warps available."}]}`
    );
    return playerTpMenu(player);
  }

  // 3) build a {coords,label} list
  const warpList = privates.map(entry => {
    const [, coords, nick] = entry.displayName.split(SEP);
    return { coords, label: nick === "NA" ? coords : nick };
  });

  // 4) show the menu
  const form = new ActionFormData()
    .title("Your Private Warps")
    .body("Select a warp to teleport:");

  warpList.forEach(w => form.button(w.label));
  form.button("↩ Back").button("§l§cExit");

  form.show(player).then(res => {
    if (res.canceled) return;
    if (res.selection < warpList.length) {
      const { coords, label } = warpList[res.selection];
      confirmTeleport(player, coords, label);
    } else if (res.selection === warpList.length) {
      playerTpMenu(player, coords);
    }
    // else Exit
  });
}


/**
 * Confirmation dialog that now checks for 10 mana, deducts it,
 * displays the remaining amount in blue, then kicks off the warp.
 */
function confirmTeleport(player, coords, label) {
    new MessageFormData()
      .title("Confirm Teleport")
      .body(`Teleport to ${label}? §9Cost: 10 Mana`)
      .button1("Yes")
      .button2("Back")
      .show(player)
      .then(choice => {
        if (choice.selection === 0) {
          // 1) Grab the mana objective
          const manaObj = world.scoreboard.getObjective("mana");
          if (!manaObj) {
            return player.runCommandAsync(
              `tellraw @s {"rawtext":[{"text":"§cError: 'mana' scoreboard not found."}]}`
            );
          }
  
          // 2) Check current mana
          const current = manaObj.getScore(player);
          if (current < 10) {
            // Not enough mana
            player.runCommandAsync(
              `tellraw @s {"rawtext":[{"text":"§cNot enough mana! Come back with more."}]}`
            );
            return;
          }
  
          // 3) Deduct 10 mana and show remaining
          const remaining = current - 10;
          manaObj.setScore(player, remaining);
          player.runCommandAsync(
            `tellraw @s {"rawtext":[{"text":"§9Mana: ${remaining}"}]}`
          );
  
          // 4) Proceed with your warp sequence
          handleWarpSequence(player, coords);
        } else {
          // Back to the previous menu
          tpPublicAtlas(player);
        }
      });
  }
  
  function handleWarpSequence(player, coords) {
    const [tx, ty, tz] = coords.split(",").map(Number);
    const dimension    = world.getDimension(player.dimension.id);
  
    // 1) find a safe ground spot within 2 blocks of the player
    const p = player.location;
    const spawnPos = findGroundPosition(
      dimension,
      Math.floor(p.x),
      Math.floor(p.y),
      Math.floor(p.z),
      2
    );
    if (!spawnPos) {
      player.runCommandAsync(
        `tellraw @s {"rawtext":[{"text":"§cNo safe spot found near you."}]}`
      );
      return;
    }
  
    // 2) summon + tag + variant_1
    const warpalter = dimension.spawnEntity("zombie:warpalter", spawnPos);
    warpalter.addTag("warp_seq");
    warpalter.triggerEvent("variant_1");
  
    // 3) wait for the player to walk into it
    let arrived = false;
    system.runInterval(() => {
      if (arrived) return;
      const w = warpalter.location;
      const d = Math.hypot(
        player.location.x - w.x,
        player.location.y - w.y,
        player.location.z - w.z
      );
      if (d <= 1.2) {
        arrived = true;
        // fire variant_2
        warpalter.triggerEvent("variant_2");
  
        // 4) after 2 s (40 ticks), teleport & variant_3
        system.runTimeout(() => {
          const tpArgs = `${tx} ${ty} ${tz}`;
          player.runCommandAsync(`tp @s ${tpArgs}`);
          // teleport the warpalter by tag
          dimension.runCommandAsync(`tp @e[tag=warp_seq] ${tpArgs}`);
          warpalter.triggerEvent("variant_3");
  
          // 5) after another 2 s, despawn + cleanup
          system.runTimeout(() => {
            warpalter.triggerEvent("despawn");
            dimension.runCommandAsync(`tag @e[tag=warp_seq] remove warp_seq`);
          }, 60);
        }, 40);
      }
    }, 10);
  }
  
  
  
  /**
   * Scans in a square radius for the first non‑air block,
   * returns the position one block above it.
   */
  function findGroundPosition(dimension, cx, cy, cz, radius) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let y = cy + radius; y >= 0; y--) {
          const pos = { x: cx + dx, y: y, z: cz + dz };
          const block = dimension.getBlock(pos);
          if (block.typeId !== "minecraft:air") {
            // found ground → return the space above it
            return { x: pos.x, y: pos.y + 1, z: pos.z };
          }
        }
      }
    }
    return null;
  }