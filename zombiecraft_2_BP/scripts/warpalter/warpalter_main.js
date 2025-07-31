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

  // ─── 1a: If it's _someone else's_ base → just show that and exit ───
  if (nearbyOwner && nearbyOwner.owner !== player.name) {
    return new MessageFormData()
      .title("Nearby Base")
      .body(`§cThis area is within ${scanRad} blocks of ${nearbyOwner.owner}’s base.`)
      .button1("Exit")
      .show(player);
  }

  // ─── 1b: If it's _your_ base → show your normal UI ───
  if (nearbyOwner && nearbyOwner.owner === player.name) {
    return showOwnBaseUI(player);
  }

  // ─── 2) Not in any base → check spawn rules ───
  if (typeof spawnProp === "string" && typeof xyDist === "number" && typeof baseDist === "number") {
    const [sx,, sz] = spawnProp.split(" ").map(Number);
    const dx = Math.abs(loc.x - sx);
    const dz = Math.abs(loc.z - sz);

    if (dx <= xyDist && dz <= xyDist) {
      return new MessageFormData()
        .title("Too Close to Spawn")
        .body(
          `§cYou must be > ${xyDist} blocks from spawn on X or Z.\n` +
          `You’re at dx=${Math.floor(dx)}, dz=${Math.floor(dz)}.`
        )
        .button1("Exit")
        .show(player);
    }
    if (dx <= baseDist && dz <= baseDist) {
      return new MessageFormData()
        .title("Too Close to Spawn")
        .body(
          `§cYou must be > ${baseDist} blocks from spawn on X or Z.\n` +
          `You’re at dx=${Math.floor(dx)}, dz=${Math.floor(dz)}.`
        )
        .button1("Exit")
        .show(player);
    }
  }

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

      // need at least (radius + radius + cushion) between centers
      const requiredSeparation = baseRad * 2 + cushion;
      if (d < requiredSeparation) {
        const needMove = Math.ceil(requiredSeparation - d);
        const owner    = key.replace("base_", "");
        return new MessageFormData()
          .title("Too Close to Base")
          .body(
            `§cToo close to ${owner}’s base.\n` +
            `You’re ${Math.floor(d)} blocks apart; need ≥ ${requiredSeparation}.\n` +
            `Move at least ${needMove} more blocks to claim here.`
          )
          .button1("Exit")
          .show(player);
      }
    }
  }

  // ─── 4) All clear! → offer to set your base here ───
  return new ActionFormData()
    .title("Place New Base?")
    .body(`Coords: ${coords}\n\nThis spot is clear to claim.`)
    .button("Yes, set base here")
    .button("Cancel")
    .show(player)
    .then(res => {
      if (!res.canceled && res.selection === 0) {
        world.setDynamicProperty(`base_${player.name}`, `${dim}|${coords}`);
        player.sendMessage(`§aBase claimed at ${coords} in ${dim}.`);
      }
    });
}

// helper to show your own management UI from before
function showOwnBaseUI(player) {
  const baseKey  = `base_${player.name}`;
  const matesKey = `base_${player.name}_mates`;
  const baseLoc  = world.getDynamicProperty(baseKey) || "";
  const matesRaw = world.getDynamicProperty(matesKey) || "";
  const mates    = matesRaw.split("|").filter(Boolean);

  // If no base set, bail out
  if (!baseLoc.includes("|")) {
    player.sendMessage("§cYou have not claimed a base yet.");
    return;
  }

  // Split out dimension + coords
  const [dimName, coords] = baseLoc.split("|");
  const matesText = mates.length
    ? `§aBase Mates: §f${mates.join(", ")}`
    : "§7No base mates added.";

  // Build a friendly greeting + your center‐of‐base line
  const body = [
    `§aHello ${player.name}!`,
    `§aThe center of your base is at:`,
    `§f${coords} in ${dimName}`,
    ``,
    matesText
  ].join("\n");

  new ActionFormData()
    .title("Base Management")
    .body(body)
    .button("Set Base Coords")
    .button("Add Base Mates")
    .button("Manage Base Mates")
    .button("Remove Base")
    .button("Exit")
    .show(player)
    .then(res => {
      if (res.canceled) return;
      switch (res.selection) {
        case 0: confirmBaseCoords(player);    break;
        case 1: manageBaseMateAdding(player); break;
        case 2: manageBaseMatesList(player);  break;
        case 3: confirmRemoveBase(player);    break;
        case 4: return;
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

      // ─────── Fetch spawn & thresholds ───────
      const spawnProp = world.getDynamicProperty("worldspawn");
      if (!spawnProp) {
        player.sendMessage("§cAdmins must set a world spawn first.");
        return baseManagement(player);
      }
      const [spawnX,, spawnZ] = spawnProp.split(" ").map(Number);

      const xyDistance   = world.getDynamicProperty("xyDistance");
      const baseDistance = world.getDynamicProperty("baseDistance");
      if (![xyDistance, baseDistance].every(n => typeof n === "number" && n > 0)) {
        player.sendMessage("§cAdmins must set both XY‑Distance and Base‑Distance first.");
        return baseManagement(player);
      }

      const dx = Math.abs(loc.x - spawnX);
      const dz = Math.abs(loc.z - spawnZ);

      // ─────── XY‑axis check ───────
      if (dx <= xyDistance && dz <= xyDistance) {
        player.sendMessage(
          `§cBase must be > ${xyDistance} blocks from spawn at (${spawnX}, ${spawnZ}) ` +
          `on either X or Z (you’re at dx=${dx}, dz=${dz}).`
        );
        return baseManagement(player);
      }

      // ─────── Base‑distance check ───────
      if (dx <= baseDistance && dz <= baseDistance) {
        player.sendMessage(
          `§cBase must be > ${baseDistance} blocks from spawn at (${spawnX}, ${spawnZ}) ` +
          `on either X or Z (you’re at dx=${dx}, dz=${dz}).`
        );
        return baseManagement(player);
      }

      // ─────── Proximity to other bases ───────
      const baseRadius = world.getDynamicProperty("baseRadius");
      if (typeof baseRadius !== 'number' || baseRadius <= 0) {
        player.sendMessage("§cAdmins must set a valid base radius first.");
        return baseManagement(player);
      }

      const allBases = world
        .getDynamicPropertyIds()
        .filter(id => id.startsWith("base_") && !id.includes("_mates"));

      for (const prop of allBases) {
        if (prop === baseKey) continue;
        const val = world.getDynamicProperty(prop);
        if (typeof val !== 'string') continue;

        const [otherDim, coords] = val.includes("|") ? val.split("|") : ["minecraft:overworld", val];
        const [bx,, bz] = coords.split(" ").map(Number);
        const dist = Math.hypot(loc.x - bx, loc.z - bz);
        if (dist < baseRadius) {
          const owner = prop.replace("base_", "");
          player.sendMessage(
            `§cToo close to ${owner}'s base. Must be ≥ ${baseRadius} blocks apart (you’re at ${Math.floor(dist)}).`
          );
          return baseManagement(player);
        }
      }

      // ─────── Final saving logic ───────
      const coords = `${Math.floor(loc.x)} ${Math.floor(loc.y)} ${Math.floor(loc.z)}`;
      const newBaseData = `${dimName}|${coords}`;
      const oldBaseData = world.getDynamicProperty(baseKey);

      if (typeof oldBaseData === "string") {
        new MessageFormData()
          .title("Move Existing Base?")
          .body(
            `You already have a base at:\n${oldBaseData}\n\n` +
            `Move it here to:\n${newBaseData}?`
          )
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
