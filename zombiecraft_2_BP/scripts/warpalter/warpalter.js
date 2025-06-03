import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { tpPublicAtlas }      from "./publicatlas.js";
import { tpPrivateAtlas }     from "./privateAtlas.js";
import { playerToPlayerMenu } from "./player2player.js";
import { manageWarpAlter }    from "./managedatlas.js";

const SEP = "¦";
const lastCoords = new Map();

// Defaults
const DEFAULT_SPAWN_LIMIT   = 1000;
const DEFAULT_PRIVATE_DIST  = 500;
const DEFAULT_SPAWN_COORDS  = [0, 64, 0];

export class WarpAtlas {
  onPlayerInteract(event) {
    const { player, block } = event;
    const coords = `${block.x},${block.y},${block.z}`;
    lastCoords.set(player.name, coords);

    const obj = world.scoreboard.getObjective("warpatlas");
    const hasWarp = obj
      ? obj.getParticipants().some(e => e.displayName.split(SEP)[1] === coords)
      : false;

    if (hasWarp) {
      playerTpMenu(player, coords);
    } else {
      warpstart(player, coords);
    }
  }
}

function warpstart(player, coords) {
  const adminObj = world.scoreboard.getObjective("admin");
  if (!adminObj) {
    player.runCommandAsync(
      `tellraw @s {"rawtext":[{"text":"§cError: 'admin' objective missing. Run '/scoreboard objectives add admin dummy'"}]}`
    );
    return;
  }

  // ─── Auto‑initialize admin entries ─────────────────────────────
  const adminNames = adminObj.getParticipants().map(e => e.displayName.split(SEP)[0]);

  if (!adminNames.includes("spawndistance")) {
    adminObj.setScore("spawndistance", DEFAULT_SPAWN_LIMIT);
  }
  if (!adminNames.includes("privatedistance")) {
    adminObj.setScore("privatedistance", DEFAULT_PRIVATE_DIST);
  }
  if (!adminNames.includes("spawn")) {
    const coordStr = DEFAULT_SPAWN_COORDS.join(",");
    adminObj.setScore(`spawn${SEP}${coordStr}`, 0);
  }

  // ─── Show Public vs Private form ───────────────────────────────
  new ActionFormData()
    .title("Set Warp Point")
    .body(
      "§lPublic§r – anyone can teleport here.\n" +
      "§lPrivate§r – only you (and your friends).\n\n" +
      "Cost: §9100 Mana"
    )
    .button("Public Warp")
    .button("Private Warp")
    .show(player)
    .then(resp => {
      if (resp.canceled) return;
      const isPublic = resp.selection === 0;

      if (!isPublic) {
        // ─── 1) spawnLimit ───────────────────────────────────────
        const sdEntry = adminObj.getParticipants()
          .find(e => e.displayName.split(SEP)[0] === "spawndistance");
        const spawnLimit = sdEntry
          ? adminObj.getScore(sdEntry)
          : DEFAULT_SPAWN_LIMIT;

        // ─── 2) spawnCoords ──────────────────────────────────────
        const spEntry = adminObj.getParticipants()
          .find(e => e.displayName.split(SEP)[0] === "spawn");
        let [sx, sy, sz] = DEFAULT_SPAWN_COORDS;
        if (spEntry) {
          const parts = spEntry.displayName.split(SEP);
          if (parts.length >= 2 && parts[1]) {
            const nums = parts[1].split(",").map(Number);
            if (nums.length === 3) [sx, sy, sz] = nums;
          }
        }

        // 3) ***INVERTED*** spawn‑radius check
        const [wx, wy, wz] = coords.split(",").map(Number);
        const dSpawn = Math.hypot(wx - sx, wy - sy, wz - sz);
        if (dSpawn < spawnLimit) {
          return player.runCommandAsync(
            `tellraw @s {"rawtext":[{"text":"§cPrivate warps must be at least ${spawnLimit} blocks from spawn (${sx},${sy},${sz})."}]}`
          );
        }

        // ─── 4) minDist between privates ─────────────────────────
        const pdEntry = adminObj.getParticipants()
          .find(e => e.displayName.split(SEP)[0] === "privatedistance");
        const minDist = pdEntry
          ? adminObj.getScore(pdEntry)
          : DEFAULT_PRIVATE_DIST;

        // ─── 5) enforce spacing ─────────────────────────────────
        const atlasObj = world.scoreboard.getObjective("warpatlas");
        const privCoords = atlasObj.getParticipants()
          .filter(e => e.displayName.split(SEP)[0] === "private")
          .map(e => e.displayName.split(SEP)[1]);

        for (const pcoords of privCoords) {
          const [px, py, pz] = pcoords.split(",").map(Number);
          if (Math.hypot(wx - px, wy - py, wz - pz) < minDist) {
            return player.runCommandAsync(
              `tellraw @s {"rawtext":[{"text":"§cToo close to another private warp (within ${minDist} blocks)."}]}`
            );
          }
        }
      }

      // ─── passed all checks → nickname & save ───────────────────
      promptForNickname(player, coords, isPublic);
    });
}

function promptForNickname(player, coords, isPublic) {
  new ModalFormData()
    .title("Warp Nickname")
    .textField("Enter a nickname (or leave blank)", "")
    .show(player)
    .then(nameRes => {
      if (nameRes.canceled) return;
      const nick = nameRes.formValues[0].trim() || coords;

      const atlasObj = world.scoreboard.getObjective("warpatlas");
      const taken = atlasObj.getParticipants()
        .some(e => e.displayName.split(SEP)[2] === nick);
      if (taken) {
        return new MessageFormData()
          .title("Name Taken")
          .body("That nickname is already picked.")
          .button1("OK")
          .show(player)
          .then(() => promptForNickname(player, coords, isPublic));
      }

      const tag   = isPublic ? "public" : "private";
      const parts = isPublic
        ? [tag, coords, nick]
        : [tag, coords, nick, player.name];
      atlasObj.setScore(parts.join(SEP), 1);

      player.runCommandAsync(
        `tellraw @s {"rawtext":[{"text":"§aWarp '${nick}' saved at ${coords}"}]}`
      );
    });
}

export function playerTpMenu(player, coordsArg) {
  const coords = coordsArg ?? lastCoords.get(player.name);
  if (!coords) {
    return player.runCommandAsync(
      `tellraw @s {"rawtext":[{"text":"§cError: no warp context available."}]}`
    );
  }
  const obj = world.scoreboard.getObjective("warpatlas");
  const entryObj = obj.getParticipants()
    .find(e => e.displayName.split(SEP)[1] === coords);
  if (!entryObj) {
    return player.runCommandAsync(
      `tellraw @s {"rawtext":[{"text":"§cError: warp not found."}]}`
    );
  }
  const [tag, , nick] = entryObj.displayName.split(SEP);
  const manaObj = world.scoreboard.getObjective("mana");
  const currentMana = manaObj?.getScore(player) ?? 0;

  new ActionFormData()
    .title(`Warp: ${nick} [${tag}]`)
    .body(`Your Mana: §9${currentMana}`)
    .button("Teleport to Public Atlas")
    .button("Teleport to Private Atlas")
    .button("Teleport to Player")
    .button("Manage WarpAtlas")
    .show(player)
    .then(res => {
      if (res.canceled) return;
      switch (res.selection) {
        case 0: tpPublicAtlas(player, coords);      break;
        case 1: tpPrivateAtlas(player, coords);     break;
        case 2: playerToPlayerMenu(player, coords); break;
        case 3: manageWarpAlter(player, coords);    break;
      }
    });
}

