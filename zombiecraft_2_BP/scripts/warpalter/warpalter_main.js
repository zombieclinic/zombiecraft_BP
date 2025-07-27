import { world, system } from '@minecraft/server';
import { ActionFormData, ModalFormData, MessageFormData } from '@minecraft/server-ui';

export class WarpMenu {
  onPlayerInteract(arg) {
    const player = arg.player
    warpMenu(player);
  }
}

// Main Warp Menu
function warpMenu(player) {
  new ActionFormData()
    .title("Warp Menu")
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
        case 4: return
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

// Base Management Menu
function baseManagement(player) {
  new ActionFormData()
    .title("Base Management")
    .button("Set Base Coords")
    .button("Add Base Mates")
    .button("Manage Base Mates")
    .button("Exit")
    .show(player)
    .then(result => {
      if (result.canceled) return;
      switch (result.selection) {
        case 0:
          confirmBaseCoords(player);
          break;
        case 1:
          manageBaseMateAdding(player);
          break;
        case 2:
          manageBaseMatesList(player);
          break;
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
      if (confirm.selection !== 0) return mainMenu(player);

      const loc = player.location;

      // ─────── Fetch spawn & thresholds ───────
      const spawnProp = world.getDynamicProperty("worldspawn");
      if (!spawnProp) {
        player.sendMessage("§cAdmins must set a world spawn first.");
        return mainMenu(player);
      }
      const [spawnX,, spawnZ] = spawnProp.split(" ").map(Number);

      const xyDistance   = world.getDynamicProperty("xyDistance");
      const baseDistance = world.getDynamicProperty("baseDistance");
      if (![xyDistance, baseDistance].every(n => typeof n === "number" && n > 0)) {
        player.sendMessage("§cAdmins must set both XY‑Distance and Base‑Distance first.");
        return mainMenu(player);
      }

      const dx = Math.abs(loc.x - spawnX);
      const dz = Math.abs(loc.z - spawnZ);

      // ─────── XY‑axis check ───────
      if (dx <= xyDistance && dz <= xyDistance) {
        player.sendMessage(
          `§cBase must be > ${xyDistance} blocks from spawn at (${spawnX}, ${spawnZ}) ` +
          `on either X or Z (you’re at dx=${dx}, dz=${dz}).`
        );
        return mainMenu(player);
      }

      // ─────── Base‑distance check ───────
      if (dx <= baseDistance && dz <= baseDistance) {
        player.sendMessage(
          `§cBase must be > ${baseDistance} blocks from spawn at (${spawnX}, ${spawnZ}) ` +
          `on either X or Z (you’re at dx=${dx}, dz=${dz}).`
        );
        return mainMenu(player);
      }

      // ─────── Proximity to other bases ───────
      const baseRadius = world.getDynamicProperty("baseRadius");
      if (typeof baseRadius !== 'number' || baseRadius <= 0) {
        player.sendMessage("§cAdmins must set a valid base radius first.");
        return mainMenu(player);
      }
      const allBases = world
        .getDynamicPropertyIds()
        .filter(id => id.startsWith("base_") && !id.includes("_mates"));

      for (const prop of allBases) {
        if (prop === `base_${player.name}`) continue;
        const coords = world.getDynamicProperty(prop);
        if (typeof coords !== 'string') continue;
        const [bx,, bz] = coords.split(" ").map(Number);
        const dist = Math.hypot(loc.x - bx, loc.z - bz);
        if (dist < baseRadius) {
          const owner = prop.replace("base_", "");
          player.sendMessage(
            `§cToo close to ${owner}'s base. Must be ≥ ${baseRadius} blocks apart (you’re at ${Math.floor(dist)}).`
          );
          return mainMenu(player);
        }
      }

      // ─────── Ready to save ───────
      const newCoords = `${Math.floor(loc.x)} ${Math.floor(loc.y)} ${Math.floor(loc.z)}`;
      const baseKey   = `base_${player.name}`;
      const oldCoords = world.getDynamicProperty(baseKey);

      if (typeof oldCoords === "string") {
        // They already have a base → ask to move it
        new MessageFormData()
          .title("Move Existing Base?")
          .body(
            `You already have a base at:\n${oldCoords}\n\n` +
            `Move it here to:\n${newCoords}?`
          )
          .button1("Yes")
          .button2("No")
          .show(player)
          .then(moveConfirm => {
            if (moveConfirm.selection === 0) {
              // Overwrite the old coords, mates list remains untouched
              world.setDynamicProperty(baseKey, newCoords);
              player.sendMessage(`§aBase moved to: ${newCoords}`);
            }
            mainMenu(player);
          })
          .catch(err => {
            console.error("moveBase confirm error:", err);
            mainMenu(player);
          });
      } else {
        // No existing base → create new
        world.setDynamicProperty(baseKey, newCoords);
        player.sendMessage("§aBase coordinates saved.");
        mainMenu(player);
      }
    })
    .catch(err => {
      console.error("confirmBaseCoords error:", err);
      player.sendMessage("§cAn error occurred. Try again.");
      mainMenu(player);
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