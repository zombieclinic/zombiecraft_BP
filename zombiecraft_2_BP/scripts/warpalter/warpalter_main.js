// warpalter_main.js
import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";

/*──────────────────────────── Warp component ────────────────────────────*/
export class WarpMenu {
  onPlayerInteract(arg) {
    const player = arg.player;
    openWarpMain(player);
  }
}

/*──────────────────────────── Money helpers ─────────────────────────────*/
const MONEY_OBJ = "Money";

function getObjective(name) {
  let o = world.scoreboard.getObjective(name);
  if (!o) o = world.scoreboard.addObjective(name, name);
  return o;
}
function getMoney(player) {
  try {
    const o = getObjective(MONEY_OBJ);
    const id = player.scoreboardIdentity;
    const s = o.getScore(id);
    return typeof s === "number" ? s : 0;
  } catch { return 0; }
}
function setMoney(player, value) {
  try {
    const o = getObjective(MONEY_OBJ);
    o.setScore(player.scoreboardIdentity, Math.max(0, value|0));
    return true;
  } catch { return false; }
}
/** charge the player; returns true if paid (or free), false if insufficient */
function charge(player, amount, label = "teleport") {
  const cost = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  if (cost <= 0) return true; // free
  const bal = getMoney(player);
  if (bal < cost) {
    player.sendMessage(`§cNot enough §4Z§2Coins. Need §e${cost}§c, you have §e${bal}§c.`);
    return false;
  }
  setMoney(player, bal - cost);
  player.sendMessage(`§aPaid §e${cost}§a §4Z§2Coins for ${label}. New balance: §e${bal - cost}§a.`);
  return true;
}
function numDP(key, def = 0) {
  const v = world.getDynamicProperty(key);
  if (typeof v === "number") return v;
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : def;
}

/*──────────────────────────── Warp Main Menu ────────────────────────────*/
function openWarpMain(player) {
  const tpRequest = world.getDynamicProperty(`tpRequest_${player.name}`);
  const hasRequest = typeof tpRequest === "string";

  const bodyText = hasRequest
    ? `§eYou have a pending TP request from §f${tpRequest}`
    : `§7No pending teleport requests.`;

  new ActionFormData()
    .title("Warp Menu")
    .body(bodyText)
    .button("TP to Spawn")     // 0
    .button("TP to Base")      // 1
    .button("TP to Player")    // 2
    .button("Player Requests") // 3
    .button("Base Management") // 4
    .button("Exit")            // 5
    .show(player)
    .then(result => {
      if (result.canceled) return;
      switch (result.selection) {
        case 0: return confirmSpawnTeleport(player);
        case 1: return tpToOwnBase(player);
        case 2: return tpToPlayerMenu(player);
        case 3: return handlePlayerRequests(player);
        case 4: return baseManagement(player);
        case 5: return;
      }
    });
}

/*────────────────────────── Teleport: Spawn (charge) ───────────────────*/
export function confirmSpawnTeleport(player) {
  const cost = numDP("economy_tpSpawnCost", 0);

  new MessageFormData()
    .title("Teleport to Spawn")
    .body(`Confirm teleporting to spawn?\n§7Cost: §e${cost} §4Z§2Coins`)
    .button1("Yes")
    .button2("No")
    .show(player)
    .then(confirm => {
      if (confirm.selection !== 0) return;

      let raw = world.getDynamicProperty("worldspawn");
      if (typeof raw !== "string") {
        player.sendMessage("§cSpawn not set.");
        return;
      }

      // Inline parse: JSON OR "dim|x y z" OR "x y z"
      let x, y, z;
      let s = raw.trim();
      if (s.startsWith("{")) {
        try {
          const o = JSON.parse(s);
          x = Number(o?.x); y = Number(o?.y); z = Number(o?.z);
        } catch { /* fall through */ }
      }
      if (![x, y, z].every(Number.isFinite)) {
        if (s.includes("|")) s = s.split("|", 2)[1].trim();
        const parts = s.split(/\s+/);
        x = Number(parts[0]); y = Number(parts[1]); z = Number(parts[2]);
      }
      if (![x, y, z].every(Number.isFinite)) {
        player.sendMessage("§cSpawn not set.");
        return;
      }

      if (!charge(player, cost, "TP to Spawn")) return;
      const overworld = world.getDimension("minecraft:overworld");
      player.teleport({ x, y, z }, { dimension: overworld });
    });
}

/*────────────────────────── Teleport: Own Base (charge) ─────────────────*/
function tpToOwnBase(player) {
  const baseKey = `base_${player.name}`;
  const val = world.getDynamicProperty(baseKey);
  if (typeof val !== "string" || !val.includes("|")) {
    player.sendMessage("§cYou don’t have a base set.");
    return;
  }

  const cost = numDP("economy_tpBaseCost", 0);
  new MessageFormData()
    .title("Teleport to Your Base")
    .body(`Teleport to your base?\n§7Cost: §e${cost} §4Z§2Coins`)
    .button1("Yes")
    .button2("No")
    .show(player)
    .then(res => {
      if (res.selection !== 0) return;
      if (!charge(player, cost, "TP to Base")) return;

      const [dim, coords] = val.split("|");
      const [x, y, z] = coords.split(" ").map(Number);
      const destDim = world.getDimension(dim) ?? player.dimension;
      player.teleport({ x, y, z }, { dimension: destDim });
    });
}

/*────────────────────── Teleport: Request to Player ─────────────────────*/
function tpToPlayerMenu(player) {
  const players = [...world.getPlayers()].filter(p => p.name !== player.name);
  const cost = numDP("economy_tpFriendsCost", 0);

  const form = new ActionFormData()
    .title("TP to Player")
    .body(`§7Select a player to request a teleport.\n§7Cost on accept: §e${cost} §4Z§2Coins`);

  players.forEach(p => form.button(p.name));
  form.show(player).then(result => {
    if (result.canceled) return;
    const target = players[result.selection];
    if (target) {
      target.sendMessage(`§e${player.name} wants to teleport to you. Open Warp → Player Requests to accept.`);
      world.setDynamicProperty(`tpRequest_${target.name}`, player.name);
      player.sendMessage(`§aRequest sent to ${target.name}. §7(You will be charged §e${cost}§7 if they accept.)`);
    }
  });
}

/*──────────────────── Receiver: Handle Player Requests ───────────────────*/
function handlePlayerRequests(player) {
  const requesterName = world.getDynamicProperty(`tpRequest_${player.name}`);
  if (!requesterName) {
    player.sendMessage("§cNo teleport requests.");
    return;
  }

  const cost = numDP("economy_tpFriendsCost", 0);

  new MessageFormData()
    .title("Teleport Request")
    .body(`${requesterName} wants to TP to you.\n§7Cost (paid by requester on accept): §e${cost} §4Z§2Coins`)
    .button1("Accept")
    .button2("Decline")
    .show(player)
    .then(confirm => {
      // clear pending either way
      world.setDynamicProperty(`tpRequest_${player.name}`, undefined);

      if (confirm.selection !== 0) {
        player.sendMessage(`§cRequest from ${requesterName} declined.`);
        const req = world.getPlayers().find(p => p.name === requesterName);
        if (req) req.sendMessage(`§cYour TP request to ${player.name} was declined.`);
        return;
      }

      const requestingPlayer = world.getPlayers().find(p => p.name === requesterName);
      if (!requestingPlayer) {
        player.sendMessage("§cRequester is no longer online.");
        return;
      }

      // charge requester now
      if (!charge(requestingPlayer, cost, `TP to ${player.name}`)) {
        player.sendMessage(`§c${requesterName} couldn’t afford the teleport.`);
        requestingPlayer.sendMessage("§cTeleport cancelled — insufficient funds.");
        return;
      }

      requestingPlayer.teleport(player.location, { dimension: player.dimension });
      player.sendMessage(`§a${requesterName} teleported to you.`);
      requestingPlayer.sendMessage(`§aTeleported to §f${player.name}§a.`);
    });
}

/*──────────────────────────── Base management UI ─────────────────────────*/
function baseManagement(player) {
  const loc       = player.location;
  const dim       = player.dimension.id;
  const coords    = `${Math.floor(loc.x)} ${Math.floor(loc.y)} ${Math.floor(loc.z)}`;
  const scanRad   = 500;
  const spawnProp = world.getDynamicProperty("worldspawn");
  const xyDist    = world.getDynamicProperty("xyDistance");
  const baseDist  = world.getDynamicProperty("baseDistance");
  const baseRad   = world.getDynamicProperty("baseRadius");
  const xyCushion = world.getDynamicProperty("xyCushion");
  const xyMin     = (typeof xyDist === "number" ? xyDist : 0) + (typeof xyCushion === "number" ? xyCushion : 0);

  // 1) any base nearby?
  let nearbyOwner = null;
  for (const key of world.getDynamicPropertyIds()) {
    if (!key.startsWith("base_") || key.endsWith("_mates")) continue;
    const data = world.getDynamicProperty(key);
    if (typeof data !== "string") continue;
    const [bDim, bCoords] = data.split("|");
    if (bDim !== dim) continue;
    const [bx,, bz] = bCoords.split(" ").map(Number);
    const d = Math.hypot(loc.x - bx, loc.z - bz);
    if (d <= scanRad) { nearbyOwner = { owner: key.replace("base_", ""), dist: d }; break; }
  }

  if (nearbyOwner && nearbyOwner.owner !== player.name) {
    return new MessageFormData()
      .title("Nearby Base")
      .body(`§cThis area is within ${scanRad} blocks of ${nearbyOwner.owner}’s base.`)
      .button1("Exit")
      .show(player);
  }
  if (nearbyOwner && nearbyOwner.owner === player.name) {
    return showOwnBaseUI(player);
  }

  // 2) dist rules
  if (xyMin > 0) {
    const dx0 = Math.abs(loc.x);
    const dz0 = Math.abs(loc.z);
    if (dx0 < xyMin || dz0 < xyMin) {
      return new MessageFormData()
        .title("Too Close to X/Z Origin")
        .body(
          `§cYou must be >= ${xyMin} from 0 on X and Z (+/-).` +
          (typeof xyDist === "number"
            ? `\n§7(= X/Z Distance ${xyDist} + Cushion ${typeof xyCushion === "number" ? xyCushion : 0})`
            : "") +
          `\n§fYou’re |ΔX|=${Math.floor(dx0)}, |ΔZ|=${Math.floor(dz0)}.`
        )
        .button1("Exit")
        .show(player);
    }
  }

  if (typeof baseDist === "number" && baseDist > 0 && typeof spawnProp === "string") {
    const [sx,, sz] = spawnProp.split(" ").map(Number);
    const dx = Math.abs(loc.x - sx);
    const dz = Math.abs(loc.z - sz);
    if (dx < baseDist && dz < baseDist) {
      return new MessageFormData()
        .title("Too Close to Spawn")
        .body(`§cYou must be >= ${baseDist} from spawn on X or Z (+/-).\n§7(Spawn: ${sx}, ${sz})\n§fYou’re |X|=${Math.floor(dx)}, |Z|=${Math.floor(dz)}.`)
        .button1("Exit")
        .show(player);
    }
  }

  // 3) base-to-base separation (no overlap)
  const cushion = 50;
  if (typeof baseRad === "number") {
    for (const key of world.getDynamicPropertyIds()) {
      if (!key.startsWith("base_") || key.endsWith("_mates") || key === `base_${player.name}`) continue;
      const data = world.getDynamicProperty(key);
      if (typeof data !== "string") continue;
      const [bDim, bCoords] = data.split("|");
      if (bDim !== dim) continue;

      const [bx,, bz] = bCoords.split(" ").map(Number);
      const d = Math.hypot(loc.x - bx, loc.z - bz);
      const requiredSeparation = baseRad * 2 + cushion;
      if (d < requiredSeparation) {
        const needMove = Math.ceil(requiredSeparation - d);
        const owner    = key.replace("base_", "");
        return new MessageFormData()
          .title("Too Close to Base")
          .body(
            `§cToo close to ${owner}’s base.\n` +
            `You’re ${Math.floor(d)} blocks apart; need >= ${requiredSeparation}.\n` +
            `Move at least ${needMove} more blocks to claim here.`
          )
          .button1("Exit")
          .show(player);
      }
    }
  }

  // 4) clear to claim
  return new ActionFormData()
    .title("Place New Base?")
    .body(`Coords: ${coords}\n\nThis spot is clear to claim.`)
    .button("Yes, set base here")
    .button("Cancel")
    .show(player)
    .then(res => {
      if (!res.canceled && res.selection === 0) return confirmBaseCoords(player);
    });
}

/*──────────────────────── base helpers / UIs (unchanged) ───────────────*/
function confirmBaseCoords(player) {
  new MessageFormData()
    .title("Set Base Coords")
    .body("Confirm setting your base location here?")
    .button1("Yes")
    .button2("No")
    .show(player)
    .then(confirm => {
      if (confirm.selection !== 0) return baseManagement(player);

      const loc     = player.location;
      const dimName = player.dimension.id;
      const baseKey = `base_${player.name}`;

      const spawnProp = world.getDynamicProperty("worldspawn");
      if (!spawnProp) {
        player.sendMessage("§cAdmins must set a world spawn first.");
        return baseManagement(player);
      }
      const [spawnX,, spawnZ] = spawnProp.split(" ").map(Number);

      const xyDistance   = world.getDynamicProperty("xyDistance");
      const xyCushion    = world.getDynamicProperty("xyCushion");
      const xyMin        = (typeof xyDistance === "number" ? xyDistance : 0) + (typeof xyCushion === "number" ? xyCushion : 0);
      const baseDistance = world.getDynamicProperty("baseDistance");

      if (xyMin > 0) {
        const dx0 = Math.abs(loc.x);
        const dz0 = Math.abs(loc.z);
        if (dx0 < xyMin || dz0 < xyMin) {
          player.sendMessage(
            `§cBase must be >= ${xyMin} from 0 on X and Z (+/-). ` +
            (typeof xyDistance === "number" ? `(dist ${xyDistance} + cushion ${typeof xyCushion === "number" ? xyCushion : 0}) ` : "") +
            `You’re |ΔX|=${Math.floor(dx0)}, |ΔZ|=${Math.floor(dz0)}.`
          );
          return baseManagement(player);
        }
      }

      if (typeof baseDistance === "number" && baseDistance > 0) {
        const dx = Math.abs(loc.x - spawnX);
        const dz = Math.abs(loc.z - spawnZ);
        if (dx < baseDistance && dz < baseDistance) {
          player.sendMessage(
            `§cBase must be >= ${baseDistance} from spawn on X or Z (+/-). ` +
            `Spawn: (${spawnX}, ${spawnZ}); you’re |ΔX|=${Math.floor(dx)}, |ΔZ|=${Math.floor(dz)}.`
          );
          return baseManagement(player);
        }
      }

      const baseRadius = world.getDynamicProperty("baseRadius");
      if (typeof baseRadius !== "number" || baseRadius <= 0) {
        player.sendMessage("§cAdmins must set a valid base radius first.");
        return baseManagement(player);
      }

      const allBases = world
        .getDynamicPropertyIds()
        .filter(id => id.startsWith("base_") && !id.includes("_mates"));

      for (const prop of allBases) {
        if (prop === baseKey) continue;
        const val = world.getDynamicProperty(prop);
        if (typeof val !== "string") continue;

        const [otherDim, coords] = val.includes("|") ? val.split("|") : ["minecraft:overworld", val];
        const [bx,, bz] = coords.split(" ").map(Number);
        const dist = Math.hypot(loc.x - bx, loc.z - bz);
        if (dist < baseRadius) {
          const owner = prop.replace("base_", "");
          player.sendMessage(`§cToo close to ${owner}'s base. Must be >= ${baseRadius} blocks apart (you’re at ${Math.floor(dist)}).`);
          return baseManagement(player);
        }
      }

      const coords = `${Math.floor(loc.x)} ${Math.floor(loc.y)} ${Math.floor(loc.z)}`;
      const newBaseData = `${dimName}|${coords}`;
      const oldBaseData = world.getDynamicProperty(baseKey);

      if (typeof oldBaseData === "string") {
        new MessageFormData()
          .title("Move Existing Base?")
          .body(`You already have a base at:\n${oldBaseData}\n\nMove it here to:\n${newBaseData}?`)
          .button1("Yes")
          .button2("No")
          .show(player)
          .then(moveConfirm => {
            if (moveConfirm.selection === 0) {
              world.setDynamicProperty(baseKey, newBaseData);
              player.sendMessage(`§aBase moved to: ${coords} in ${dimName}`);
            }
            baseManagement(player);
          })
          .catch(err => { console.error("moveBase confirm error:", err); baseManagement(player); });
      } else {
        world.setDynamicProperty(baseKey, newBaseData);
        player.sendMessage(`§aBase saved in ${dimName} at ${coords}`);
        baseManagement(player);
      }
    })
    .catch(err => { console.error("confirmBaseCoords error:", err); player.sendMessage("§cAn error occurred. Try again."); baseManagement(player); });
}

function manageBaseMateAdding(player) {
  const players = [...world.getPlayers()].filter(p => p.name !== player.name);
  const form    = new ActionFormData().title("Add Base Mate");

  players.forEach(p => form.button(p.name));
  form.button("Everyone");
  form.button("Type Name Manually");

  form.show(player).then(result => {
    if (result.canceled) return;
    const idx = result.selection;

    if (idx < players.length) {
      addBaseMate(player, players[idx].name);
    } else if (idx === players.length) {
      addBaseMate(player, "everyone");
    } else {
      new ModalFormData()
        .title("Manual Entry")
        .textField("Enter player's name:", "")
        .show(player)
        .then(input => {
          if (!input.canceled) addBaseMate(player, (input.formValues[0] ?? "").trim());
        });
    }
  });
}

function addBaseMate(player, mateName) {
  if (!mateName) return;
  const baseKey = `base_${player.name}_mates`;
  let raw       = world.getDynamicProperty(baseKey) || "";
  let list      = raw.split("|").filter(Boolean);

  const lower = mateName.toLowerCase();
  if (!list.some(m => m.toLowerCase() === lower)) {
    list.push(mateName);
    world.setDynamicProperty(baseKey, list.join("|"));
    player.sendMessage(`§a${mateName} added to your base mates.`);
  } else {
    player.sendMessage(`§e${mateName} is already in your base mates.`);
  }
}

function showOwnBaseUI(player) {
  const baseKey  = `base_${player.name}`;
  const matesKey = `base_${player.name}_mates`;

  const baseLoc  = world.getDynamicProperty(baseKey);
  const matesRaw = world.getDynamicProperty(matesKey) || "";
  const mates    = matesRaw.split("|").filter(Boolean);

  if (typeof baseLoc !== "string" || !baseLoc.includes("|")) {
    player.sendMessage("§cYou haven't claimed a base yet.");
    return;
  }

  const [dimName, coords] = baseLoc.split("|");
  const matesLine = mates.length ? `§aBase Mates: §f${mates.join(", ")}` : "§7No base mates added.";

  new ActionFormData()
    .title("Base Management")
    .body(
      `§aOwner: §f${player.name}\n` +
      `§aCenter: §f${coords}\n` +
      `§aDimension: §f${dimName}\n\n` +
      matesLine
    )
    .button("Set Base Coords Here")
    .button("Add Base Mates")
    .button("Manage Base Mates")
    .button("Remove Base")
    .button("Back")
    .show(player)
    .then(res => {
      if (res.canceled) return;
      switch (res.selection) {
        case 0: return confirmBaseCoords(player);
        case 1: return manageBaseMateAdding(player);
        case 2: return manageBaseMatesList(player);
        case 3: return confirmRemoveBase(player);
        case 4: return baseManagement(player);
      }
    })
    .catch(err => { console.error("showOwnBaseUI error:", err); player.sendMessage("§cCouldn't open base menu."); });
}

function manageBaseMatesList(player) {
  const baseKey = `base_${player.name}_mates`;
  const mates   = (world.getDynamicProperty(baseKey) || "")
                   .split("|")
                   .filter(Boolean);

  if (mates.length === 0) {
    player.sendMessage("§cYou have no base mates.");
    return baseManagement(player);
  }

  const form = new ActionFormData().title("Remove Base Mate");
  mates.forEach(name => form.button(name));
  form.button("Back");
  
  form.show(player).then(result => {
    if (result.canceled || result.selection === mates.length) return baseManagement(player);
    const mateToRemove = mates[result.selection];

    new MessageFormData()
      .title("Confirm Removal")
      .body(`Remove ${mateToRemove} from your base mates?`)
      .button1("Yes")
      .button2("No")
      .show(player)
      .then(confirm => {
        if (confirm.selection === 0) {
          const updated = mates.filter(m => m !== mateToRemove);
          world.setDynamicProperty(baseKey, updated.join("|"));
          player.sendMessage(`§a${mateToRemove} removed from your base mates.`);
        }
        baseManagement(player);
      })
      .catch(err => { console.error("manageBaseMates confirmation error:", err); baseManagement(player); });
  })
  .catch(err => { console.error("manageBaseMates form error:", err); baseManagement(player); });
}

function confirmRemoveBase(player) {
  const prefix = `base_${player.name}`;

  if (!world.getDynamicProperty(prefix)) {
    player.sendMessage("§cYou do not have a base set.");
    return;
  }

  new MessageFormData()
    .title("Confirm Base Removal")
    .body("§cThis will permanently delete your base and all its mates.\nAre you sure?")
    .button1("Yes, remove")
    .button2("Cancel")
    .show(player)
    .then(confirm => {
      if (confirm.selection !== 0) {
        player.sendMessage("§7Base removal cancelled.");
        return;
      }

      const allKeys = world.getDynamicPropertyIds();
      for (const key of allKeys) {
        if (key === prefix || key.startsWith(`${prefix}_mates`)) {
          world.setDynamicProperty(key, undefined);
        }
      }

      player.sendMessage("§aBase and all base mates removed.");
    })
    .catch(err => { console.error("Base removal error:", err); player.sendMessage("§cAn error occurred during base removal."); });
}
