import { world, system } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { playerTpMenu } from "./warpalter.js";

const SEP = "¦";

export function tpPublicAtlas(player, coords) {
  const obj = world.scoreboard.getObjective("warpatlas");
  if (!obj) return playerTpMenu(player, coords);
  const publics = obj.getParticipants().filter(e => e.displayName.split(SEP)[0] === "public");
  if (publics.length === 0) {
    player.runCommandAsync(`tellraw @s {"rawtext":[{"text":"§cNo public warps set."}]}`);
    return playerTpMenu(player, coords);
  }
  const form = new ActionFormData().title("Public Warp Points").body("Select a warp to teleport:");
  const warpList = publics.map(e => {
    const [, c, nick] = e.displayName.split(SEP);
    return { coords: c, label: nick === "NA" ? c : nick };
  });
  warpList.forEach(w => form.button(w.label));
  form.button("↩ Back").button("§l§cExit");
  form.show(player).then(res => {
    if (res.canceled) return;
    if (res.selection < warpList.length) {
      const { coords: tc, label } = warpList[res.selection];
      confirmTeleport(player, tc, label);
    } else playerTpMenu(player, coords);
  });
}

export function confirmTeleport(player, coords, label) {
    new MessageFormData()
      .title("Confirm Teleport")
      .body(`Teleport to ${label}? §9Cost: 10 Mana`)
      .button1("Yes").button2("Back")
      .show(player).then(c => {
        if (c.selection !== 0) return tpPublicAtlas(player, coords);
        const manaObj = world.scoreboard.getObjective("mana");
        const cur = manaObj.getScore(player);
        if (cur < 10) return player.runCommandAsync(
          `tellraw @s {"rawtext":[{"text":"§cNot enough mana!"}]}`);
        manaObj.setScore(player, cur-10);
        player.runCommandAsync(`tellraw @s {"rawtext":[{"text":"§9Mana: ${cur-10}"}]}`);
        handleWarpSequence(player, coords);
      });
  }
  
  function handleWarpSequence(player, coords) {
    const [tx, ty, tz] = coords.split(",").map(Number);
    const dim = world.getDimension(player.dimension.id);
    const p = player.location;
    const spawnPos = findGroundPosition(dim, Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), 2);
    if (!spawnPos) return player.runCommandAsync(
      `tellraw @s {"rawtext":[{"text":"§cNo safe spot found near you."}]}`);
    const warpalter = dim.spawnEntity("zombie:warpalter", spawnPos);
    warpalter.addTag("warp_seq");
    warpalter.triggerEvent("variant_1");
    let arrived = false;
    system.runInterval(() => {
      if (arrived) return;
      const w = warpalter.location;
      if (Math.hypot(player.location.x - w.x, player.location.y - w.y, player.location.z - w.z) <= 1.2) {
        arrived = true;
        warpalter.triggerEvent("variant_2");
        system.runTimeout(() => {
          player.runCommandAsync(`tp @s ${tx} ${ty} ${tz}`);
          dim.runCommandAsync(`tp @e[tag=warp_seq] ${tx} ${ty} ${tz}`);
          warpalter.triggerEvent("variant_3");
          system.runTimeout(() => {
            warpalter.triggerEvent("despawn");
            dim.runCommandAsync(`tag @e[tag=warp_seq] remove warp_seq`);
          }, 40);
        }, 40);
      }
    }, 10);
  }
  
  function findGroundPosition(dimension, cx, cy, cz, radius) {
    for (let dx=-radius; dx<=radius; dx++) for (let dz=-radius; dz<=radius; dz++) for (let y=cy+radius; y>=0; y--) {
      const pos={x:cx+dx,y,z:cz+dz}; const block=dimension.getBlock(pos);
      if (block.typeId!="minecraft:air") return {x:pos.x,y:pos.y+1,z:pos.z};
    }
    return null;
  }
