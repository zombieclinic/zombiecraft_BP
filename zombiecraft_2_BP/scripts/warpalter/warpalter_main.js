import { world, system } from '@minecraft/server';
import { ActionFormData, ModalFormData, MessageFormData } from '@minecraft/server-ui';

export class WarpMenu {
  onPlayerInteract(arg) {
    const player = arg.player
    mainMenu(player);
  }
}


function mainMenu(player) {
  const tpRequest = world.getDynamicProperty(`tpRequest_${player.name}`);
  const hasRequest = typeof tpRequest === "string";

  const bodyText = hasRequest
    ? `§eYou have a pending TP request from §f${tpRequest}`
    : `§7No pending teleport requests.`;

  new ActionFormData()
    .title("Warp Menu")
    .body(bodyText)
    .button("TP to Spawn")
    .button("TP to Player")
    .button("Player Requests")
    .button("Base Management")
    .button("Exit")
    .show(player)
    .then(result => {
      if (result.canceled) return;
      switch (result.selection) {
        case 0: return confirmSpawnTeleport(player);
        case 1: return tpToPlayerMenu(player);
        case 2: return handlePlayerRequests(player);
        case 3: return baseManagement(player);
        case 4: return;
      }
    });
}

// Confirm TP to Spawn
function confirmSpawnTeleport(player) {
  new MessageFormData()
    .title("Teleport to Spawn")
    .body("Confirm teleporting to spawn?")
    .button1("Yes")
    .button2("No")
    .show(player)
    .then(confirm => {
      if (confirm.selection === 0) {
        const spawnCoords = world.getDynamicProperty("worldspawn");
        if (!spawnCoords) {
          player.sendMessage("§cSpawn not set.");
          return;
        }
        const [x, y, z] = spawnCoords.split(" ").map(Number);
        player.teleport({ x, y, z });
      }
    });
}

// TP to Player Menu
function tpToPlayerMenu(player) {
  const players = [...world.getPlayers()].filter(p => p.name !== player.name);
  const form = new ActionFormData().title("TP to Player");
  players.forEach(p => form.button(p.name));
  form.show(player).then(result => {
    if (result.canceled) return;
    const target = players[result.selection];
    if (target) {
      target.sendMessage(`§e${player.name} wants to teleport to you. Type /warp to accept.`);
      world.setDynamicProperty(`tpRequest_${target.name}`, player.name);
      player.sendMessage(`§aRequest sent to ${target.name}.`);
    }
  });
}

// Handle Player Requests
function handlePlayerRequests(player) {
  const requester = world.getDynamicProperty(`tpRequest_${player.name}`);
  if (!requester) {
    player.sendMessage("§cNo teleport requests.");
    return;
  }
  new MessageFormData()
    .title("Teleport Request")
    .body(`${requester} wants to TP to you.`)
    .button1("Accept")
    .button2("Decline")
    .show(player)
    .then(confirm => {
      if (confirm.selection === 0) {
        const requestingPlayer = world.getPlayers().find(p => p.name === requester);
        if (requestingPlayer) requestingPlayer.teleport(player.location);
        player.sendMessage(`§a${requester} teleported.`);
      } else {
        player.sendMessage(`§cRequest from ${requester} declined.`);
      }
      world.setDynamicProperty(`tpRequest_${player.name}`, undefined);
    });
}

function baseManagement(player) {
  const loc       = player.location;
  const dim       = player.dimension.id;
  const coords    = `${Math.floor(loc.x)} ${Math.floor(loc.y)} ${Math.floor(loc.z)}`;
  const scanRad   = 500;                             // how far we scan for existing bases
  const spawnProp = world.getDynamicProperty("worldspawn");
  const xyDist    = world.getDynamicProperty("xyDistance");
  const baseDist  = world.getDynamicProperty("baseDistance");
  const baseRad   = world.getDynamicProperty("baseRadius");
  const xyCushion = world.getDynamicProperty("xyCushion"); // NEW (optional)
  const xyMin     = (typeof xyDist === "number" ? xyDist : 0) +
                    (typeof xyCushion === "number" ? xyCushion : 0);

  // ─── 1) Find any base within scanRad ───
  let nearbyOwner = null;
  for (const key of world.getDynamicPropertyIds()) {
    if (!key.startsWith("base_") || key.endsWith("_mates")) continue;
    const data = world.getDynamicProperty(key);
    if (typeof data !== "string") continue;
    const [bDim, bCoords] = data.split("|");
    if (bDim !== dim) continue;
    const [bx,, bz] = bCoords.split(" ").map(Number);
    const d = Math.hypot(loc.x - bx, loc.z - bz);
    if (d <= scanRad) {
      nearbyOwner = { owner: key.replace("base_", ""), dist: d };
      break;
    }
  }

  // 1a) someone else's base nearby
  if (nearbyOwner && nearbyOwner.owner !== player.name) {
    return new MessageFormData()
      .title("Nearby Base")
      .body(`§cThis area is within ${scanRad} blocks of ${nearbyOwner.owner}’s base.`)
      .button1("Exit")
      .show(player);
  }
  // 1b) your own base nearby
  if (nearbyOwner && nearbyOwner.owner === player.name) {
    return showOwnBaseUI(player);
  }

  // ─── 2) Distance rules ───

  // 2a) Origin guard (± from 0,0) using xyDistance + xyCushion → BOTH axes must clear
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

  // 2b) Spawn guard (± from world spawn) using baseDistance → EITHER axis may qualify
  if (typeof baseDist === "number" && baseDist > 0 && typeof spawnProp === "string") {
    const [sx,, sz] = spawnProp.split(" ").map(Number);
    const dx = Math.abs(loc.x - sx);
    const dz = Math.abs(loc.z - sz);
    // block only if BOTH axes are inside the limit
    if (dx < baseDist && dz < baseDist) {
      return new MessageFormData()
        .title("Too Close to Spawn")
        .body(
          `§cYou must be >= ${baseDist} from spawn on X or Z (+/-).` +
          `\n§7(Spawn: ${sx}, ${sz})` +
          `\n§fYou’re |ΔX|=${Math.floor(dx)}, |ΔZ|=${Math.floor(dz)}.`
        )
        .button1("Exit")
        .show(player);
    }
  }

  // ─── 3) Base-to-base separation (no overlap) ───
  const cushion = 50; // your current base-to-base buffer
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

  // ─── 4) All clear! → ask to place, then hand off to confirmBaseCoords ───
  return new ActionFormData()
    .title("Place New Base?")
    .body(`Coords: ${coords}\n\nThis spot is clear to claim.`)
    .button("Yes, set base here")
    .button("Cancel")
    .show(player)
    .then(res => {
      if (!res.canceled && res.selection === 0) {
        return confirmBaseCoords(player); // go through your confirm+save flow
      }
    });
}





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
      const xyCushion    = world.getDynamicProperty("xyCushion"); // NEW (optional)
      const xyMin        = (typeof xyDistance === "number" ? xyDistance : 0) +
                           (typeof xyCushion === "number" ? xyCushion : 0);
      const baseDistance = world.getDynamicProperty("baseDistance");

      // ─────── Origin guard (xyDistance + xyCushion) — BOTH axes must clear ───────
      if (xyMin > 0) {
        const dx0 = Math.abs(loc.x);
        const dz0 = Math.abs(loc.z);
        if (dx0 < xyMin || dz0 < xyMin) {
          player.sendMessage(
            `§cBase must be >= ${xyMin} from 0 on X and Z (+/-). ` +
            (typeof xyDistance === "number"
              ? `(dist ${xyDistance} + cushion ${typeof xyCushion === "number" ? xyCushion : 0}) `
              : "") +
            `You’re |ΔX|=${Math.floor(dx0)}, |ΔZ|=${Math.floor(dz0)}.`
          );
          return baseManagement(player);
        }
      }

      // ─────── Spawn guard (baseDistance) — EITHER axis may qualify ───────
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

      // ─────── Proximity to other bases ───────
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
          player.sendMessage(
            `§cToo close to ${owner}'s base. Must be >= ${baseRadius} blocks apart (you’re at ${Math.floor(dist)}).`
          );
          return baseManagement(player);
        }
      }

      // ─────── Save/move base ───────
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
          .catch(err => {
            console.error("moveBase confirm error:", err);
            baseManagement(player);
          });
      } else {
        world.setDynamicProperty(baseKey, newBaseData);
        player.sendMessage(`§aBase saved in ${dimName} at ${coords}`);
        baseManagement(player);
      }
    })
    .catch(err => {
      console.error("confirmBaseCoords error:", err);
      player.sendMessage("§cAn error occurred. Try again.");
      baseManagement(player);
    });
}


function manageBaseMateAdding(player) {
  const players = [...world.getPlayers()].filter(p => p.name !== player.name);
  const form    = new ActionFormData().title("Add Base Mate");

  players.forEach(p => form.button(p.name));
  form.button("Everyone");           // ← still pushes “Everyone” into the list
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
          if (!input.canceled) addBaseMate(player, input.formValues[0].trim());
        });
    }
  });
}



function addBaseMate(player, mateName) {
  const baseKey = `base_${player.name}_mates`;
  let raw       = world.getDynamicProperty(baseKey) || "";
  let list      = raw.split("|").filter(Boolean);

  // avoid duplicates (case‑insensitive)
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
    return; // nothing to manage
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
        case 4: return baseManagement(player); // back to the placement/check screen
      }
    })
    .catch(err => {
      console.error("showOwnBaseUI error:", err);
      player.sendMessage("§cCouldn't open base menu.");
    });
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
    if (result.canceled || result.selection === mates.length) {
      return baseManagement(player);
    }
    const mateToRemove = mates[result.selection];

    // Confirmation dialog
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
      .catch(err => {
        console.error("manageBaseMates confirmation error:", err);
        baseManagement(player);
      });
  })
  .catch(err => {
    console.error("manageBaseMates form error:", err);
    baseManagement(player);
  });
}

function confirmRemoveBase(player) {
  const prefix = `base_${player.name}`;

  // Check if they actually have a base:
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

      // Remove all dynamic properties whose key starts with base_<player>
      const allKeys = world.getDynamicPropertyIds();
      for (const key of allKeys) {
        if (key === prefix || key.startsWith(`${prefix}_mates`)) {
          world.setDynamicProperty(key, undefined);
        }
      }

      player.sendMessage("§aBase and all base mates removed.");
    })
    .catch(err => {
      console.error("Base removal error:", err);
      player.sendMessage("§cAn error occurred during base removal.");
    });
}
