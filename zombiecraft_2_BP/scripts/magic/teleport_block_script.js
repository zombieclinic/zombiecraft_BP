import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";

export class TeleportBlock {
  onStepOn(event) {
    const player = event.entity;
    if (player.typeId !== "minecraft:player") return;

    const block = event.block;
    const dim = event.dimension;
    const key = getBlockKey(block, dim);

    // Check if block is registered
    const owner = world.getDynamicProperty(key);

    if (!owner) {
      showRegisterMenu(player, key, block, dim);
    } else if (owner === player.name) {
      // Owner menu
      showOwnerMenu(player);
    } else {
      // Not owner - check base mates
      showGuestMenu(player, owner);
    }
  }
}

// --- Helper functions ---

function getBlockKey(block, dimension) {
  const { x, y, z } = block.location;
  return `tpblock|${dimension.id}|${x},${y},${z}`;
}

// --- Register Menu ---

function showRegisterMenu(player, key, block, dim) {
  // Find if the player already owns a teleport block anywhere
  let previousKey = null;
  for (const k of world.getDynamicPropertyIds()) {
    if (k.startsWith("tpblock|") && world.getDynamicProperty(k) === player.name) {
      previousKey = k;
      break;
    }
  }

  if (previousKey && previousKey !== key) {
    // Already owns a block somewhere else
    new MessageFormData()
      .title("Move Teleporter?")
      .body(
        "You already have a teleport block registered.\n\n" +
        "Are you sure you want to move your teleporter to this location?\n" +
        "(Your old teleporter will be unregistered.)"
      )
      .button1("Yes, move it here")
      .button2("No, cancel")
      .show(player)
      .then(res => {
        if (res.canceled || res.selection !== 0) return;
        // Remove old registration
        world.setDynamicProperty(previousKey, undefined);
        // Register new one
        world.setDynamicProperty(key, player.name);
        player.sendMessage("§aTeleporter moved!");
        showOwnerMenu(player);
      });
  } else {
    // No previous block, normal flow
    new ActionFormData()
      .title("Register Teleport Block")
      .body("Register this block as your base teleport?")
      .button("Yes")
      .button("No")
      .show(player)
      .then(res => {
        if (res.canceled || res.selection !== 0) return;
        world.setDynamicProperty(key, player.name);
        player.sendMessage("§aTeleport block registered! You are the owner.");
        showOwnerMenu(player);
      });
  }
}

// --- Owner Menu ---

function showOwnerMenu(player) {
  new ActionFormData()
    .title("Teleport Block (Owner)")
    .body("Choose an action:")
    .button("TP to Base")
    .button("Type in Coords")
    .button("Random TP")
    .button("Exit")
    .show(player)
    .then(res => {
      if (res.canceled || res.selection === 3) return;
      switch (res.selection) {
        case 0: // TP to Base
          confirmTeleportToOwnBase(player);
          break;
        case 1: // Type in coords
          promptCoords(player);
          break;
        case 2: // Random TP
          randomTeleport(player);
          break;
      }
    });
}

// Confirm Teleport to Base
function confirmTeleportToOwnBase(player) {
  const baseKey = `base_${player.name}`;
  const baseData = world.getDynamicProperty(baseKey);

  if (!baseData || typeof baseData !== "string") {
    player.sendMessage("§cYou have not claimed a base yet.");
    return;
  }
  const [dimensionId, coords] = baseData.split("|");
  const [x, y, z] = coords.split(" ").map(Number);

  new MessageFormData()
    .title("Teleport to Base")
    .body(`Teleport to your base at:\n§f${x} ${y} ${z} in ${dimensionId}?`)
    .button1("Yes")
    .button2("No")
    .show(player)
    .then(res => {
      if (res.selection !== 0) return;
      player.teleport({ x, y, z }, { dimension: world.getDimension(dimensionId) });
      player.sendMessage("§aTeleported to your base!");
    });
}

// Guest Menu (non-owner)
function showGuestMenu(player, ownerName) {
  const matesKey = `base_${ownerName}_mates`;
  const matesRaw = world.getDynamicProperty(matesKey) || "";
  const mates = matesRaw.split("|").map(x => x.trim()).filter(Boolean);

  if (mates.includes(player.name)) {
    // Allow guest to TP to owner's base
    confirmTeleportToOwnerBase(player, ownerName);
  } else {
    // Not allowed
    new ActionFormData()
      .title("Teleport Block")
      .body(`§cYou do not have permission to use this teleport.\nContact owner: §e${ownerName}`)
      .button("Exit")
      .show(player);
  }
}

// Confirm Guest Teleport to Owner's Base
function confirmTeleportToOwnerBase(player, ownerName) {
  const baseKey = `base_${ownerName}`;
  const baseData = world.getDynamicProperty(baseKey);

  if (!baseData || typeof baseData !== "string") {
    player.sendMessage(`§c${ownerName} does not have a registered base.`);
    return;
  }
  const [dimensionId, coords] = baseData.split("|");
  const [x, y, z] = coords.split(" ").map(Number);

  new MessageFormData()
    .title(`Teleport to ${ownerName}'s Base`)
    .body(`Teleport to §e${ownerName}§r's base at:\n§f${x} ${y} ${z} in ${dimensionId}?`)
    .button1("Yes")
    .button2("No")
    .show(player)
    .then(res => {
      if (res.selection !== 0) return;
      player.teleport({ x, y, z }, { dimension: world.getDimension(dimensionId) });
      player.sendMessage(`§aTeleported to ${ownerName}'s base!`);
    });
}

// --- Type in Coordinates ---

function promptCoords(player) {
  new ModalFormData()
    .title("Enter Coordinates")
    .textField("x y z", "")
    .show(player)
    .then(res => {
      if (res.canceled) return;
      const [x, y, z] = res.formValues[0].split(" ").map(Number);
      if ([x, y, z].some(n => isNaN(n))) {
        player.sendMessage("Invalid format—use: x y z");
      } else {
        player.teleport({ x, y, z });
        player.sendMessage(`§aTeleported to ${x} ${y} ${z}`);
      }
    });
}

// --- Random Teleport ---

function randomTeleport(player) {
  const rx = Math.floor(Math.random() * 10000) - 5000;
  const rz = Math.floor(Math.random() * 10000) - 5000;
  const y = 200;
  player.teleport({ x: rx, y, z: rz });
  player.addEffect("minecraft:slow_falling", 40 * 20, { showParticles: false }); // 40 seconds
  player.sendMessage(`§aRandomly teleported to ${rx} ${y} ${rz}`);
}
