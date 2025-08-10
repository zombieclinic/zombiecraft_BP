import { world, system,ItemTypes, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { mainMenu } from "./settings";


/**
 * AdminMenu: call on item use or command to open the root menu
 */
export class AdminMenu {
  onUse(arg) {
    const player = arg.source;
    if (!player) return;
    adminMenu(player);
  }
}

/* ----------------------------- Root: Admin Menu ---------------------------- */
export function adminMenu(admin) {
  new ActionFormData()
    .title("§lAdmin Menu")
    .body("What do you want to do?")
    .button("⚙️ Settings")       // 0
    .button("👤 Player Info")     // 1
    .button("❌ Close")           // 2
    .show(admin)
    .then((res) => {
      if (res.canceled) return;
      switch (res.selection) {
        case 0:
          try { mainMenu(admin); } catch (e) { sendErr(admin, e, "Opening Settings"); }
          break;
        case 1:
          playerInfoMenu(admin);
          break;
        default:
          break;
      }
    });
}

/* ----------------------------- Player Info Hub ----------------------------- */
function playerInfoMenu(admin) {
  new ActionFormData()
    .title("👤 Player Info")
    .body("Choose an option")
    .button("🟢 View Online Players") // 0
    .button("⬅️ Back")                 // 1
    .show(admin)
    .then((res) => {
      if (res.canceled) return;
      switch (res.selection) {
        case 0:
          listOnlinePlayers(admin);
          break;
        default:
          adminMenu(admin);
          break;
      }
    });
}

/* ---------------------------- List Online Players --------------------------- */
function listOnlinePlayers(admin) {
  const players = [...world.getAllPlayers()];
  const form = new ActionFormData()
    .title("🟢 Online Players")
    .body(players.length ? "Select a player" : "No one is online.");

  players.forEach((p) => {
    const gm = safeGameMode(p);
    form.button(`${p.name}\n§7${gm}`);
  });
  form.button("⬅️ Back");

  form.show(admin).then((res) => {
    if (res.canceled) return;
    const idx = res.selection;
    if (idx === players.length || players.length === 0) {
      return playerInfoMenu(admin);
    }
    const target = players[idx];
    if (!target || target.isValid === false) {
      return info(admin, "That player is no longer online.");
    }
    playerActionsMenu(admin, target);
  });
}

/* ------------------------- Actions for a Selected Player -------------------- */
function playerActionsMenu(admin, target) {
  new ActionFormData()
    .title(`👤 ${target.name}`)
    .body(`Mode: §7${safeGameMode(target)}`)
    .button("🎒 View Inventory")      // 0
    .button("✨ View Ender Chest")    // 1
    .button("🧭 Teleport to Player")  // 2 (NEW)
    .button("⬅️ Back")                // 3
    .show(admin)
    .then((res) => {
      if (res.canceled) return;
      switch (res.selection) {
        case 0:
          showInventory(admin, target, 0);
          break;
        case 1:
           viewEnderChestMenu(admin, target);
          break;
        case 2:
          confirmTeleportToPlayer(admin, target);
          break;
        default:
          listOnlinePlayers(admin);
          break;
      }
    });
}

/* ---------------------------- Player Inventory UI --------------------------- */
/**
 * Displays the target's inventory items (main container). Paginates if needed.
 */
function showInventory(admin, target, page = 0) {
  try {
    const invComp = target.getComponent("minecraft:inventory");
    if (!invComp?.container) {
      return info(admin, "Could not access player inventory.");
    }
    const container = invComp.container;
    const size = container.size;

    // Build a list of occupied slots for clean listing
    const occupied = [];
    for (let i = 0; i < size; i++) {
      const it = container.getItem(i);
      if (it) occupied.push({ slot: i, item: it });
    }

    if (!occupied.length) {
      return new ActionFormData()
        .title(`🎒 ${target.name} — Inventory`)
        .body("No items found.")
        .button("⬅️ Back")
        .show(admin)
        .then(() => playerActionsMenu(admin, target));
    }

    // Basic pagination
    const perPage = 20;
    const pages = Math.max(1, Math.ceil(occupied.length / perPage));
    const clampedPage = Math.min(Math.max(page, 0), pages - 1);
    const start = clampedPage * perPage;
    const pageItems = occupied.slice(start, start + perPage);

    const form = new ActionFormData()
      .title(`🎒 ${target.name} — Inventory`)
      .body(`Items ${start + 1}-${start + pageItems.length} of ${occupied.length} (Page ${clampedPage + 1}/${pages})`);

    pageItems.forEach(({ slot, item }) => {
      form.button(formatItemLine(slot, item));
    });

    if (pages > 1) {
      form.button("⬅️ Prev Page");
      form.button("➡️ Next Page");
    }
    form.button("⬅️ Back");

    form.show(admin).then((res) => {
      if (res.canceled) return;

      const selection = res.selection;
      const listCount = pageItems.length;
      const hasPaging = pages > 1;
      const backIndex = listCount + (hasPaging ? 2 : 0);

      if (hasPaging && selection === listCount) {
        // Prev
        return showInventory(admin, target, Math.max(0, clampedPage - 1));
      }
      if (hasPaging && selection === listCount + 1) {
        // Next
        return showInventory(admin, target, Math.min(pages - 1, clampedPage + 1));
      }
      if (selection === backIndex) {
        return playerActionsMenu(admin, target);
      }

      // Clicked an item -> open next tick to avoid UI overlap
      const chosen = pageItems[selection];
      if (!chosen) return;
      system.runTimeout(() => manageItemMenu(admin, target, chosen.slot), 1);
    });
  } catch (e) {
    sendErr(admin, e, "Reading inventory");
  }
}

function formatItemLine(slot, item) {
  const id = item.typeId ?? "unknown";
  const amt = item.amount ?? 1;
  return `Slot ${slot}: ${prettyId(id)} ×${amt}`;
}

/* -------------------------- Take / Remove Item Menu ------------------------- */
function manageItemMenu(admin, target, slot) {
  try {
    const targetInv = target.getComponent("minecraft:inventory")?.container;
    if (!targetInv) return info(admin, "Target inventory not available.");

    const item = targetInv.getItem(slot);
    if (!item) return info(admin, "That slot is now empty.");

    const details = formatItemDetails(item);

    new ActionFormData()
      .title(`🎒 ${target.name} — Slot ${slot}`)
      .body(details)
      .button("📥 Take Item")
      .button("🗑️ Remove Item")
      .button("⬅️ Back")
      .show(admin)
      .then((res) => {
        if (res.canceled) return;
        switch (res.selection) {
          case 0:
            takeItem(admin, target, slot);
            break;
          case 1:
            confirmRemoveItem(admin, target, slot);
            break;
          default:
            // Go back to inventory next tick (prevents overlap)
            system.runTimeout(() => showInventory(admin, target, 0), 1);
            break;
        }
      });
  } catch (e) {
    sendErr(admin, e, "Opening item actions");
  }
}

function confirmRemoveItem(admin, target, slot) {
  new MessageFormData()
    .title("Confirm Remove")
    .body(`Remove item from §f${target.name}§r slot ${slot}? This cannot be undone.`)
    .button1("Remove") // right
    .button2("Cancel") // left
    .show(admin)
    .then((res) => {
      if (res.canceled) return;
      if (res.selection === 1) return; // Cancel
      removeItem(admin, target, slot);
    });
}

function takeItem(admin, target, slot) {
  try {
    const adminInv = admin.getComponent("minecraft:inventory")?.container;
    const targetInv = target.getComponent("minecraft:inventory")?.container;
    if (!adminInv || !targetInv) return info(admin, "Inventory access failed.");

    const item = targetInv.getItem(slot);
    if (!item) return info(admin, "That item is no longer there.");

    // Try adding to admin
    const copy = item.clone();
    const leftover = tryAddItem(adminInv, copy);
    if (leftover) {
      return info(admin, "Your inventory is full. Clear a slot and try again.");
    }

    // Remove from target
    targetInv.setItem(slot); // undefined clears
    info(admin, `Took ${prettyId(item.typeId)} ×${item.amount} from ${target.name}.`);

    // Reopen list next tick to prevent overlap
    system.runTimeout(() => showInventory(admin, target, 0), 1);
  } catch (e) {
    sendErr(admin, e, "Taking item");
  }
}

function removeItem(admin, target, slot) {
  try {
    const targetInv = target.getComponent("minecraft:inventory")?.container;
    if (!targetInv) return info(admin, "Inventory access failed.");
    const item = targetInv.getItem(slot);
    if (!item) return info(admin, "That item is already gone.");
    targetInv.setItem(slot);
    info(admin, `Removed ${prettyId(item.typeId)} ×${item.amount} from ${target.name}.`);

    // Reopen list next tick to prevent overlap
    system.runTimeout(() => showInventory(admin, target, 0), 1);
  } catch (e) {
    sendErr(admin, e, "Removing item");
  }
}

/* ---------------------------- Teleport Handling ----------------------------- */
function confirmTeleportToPlayer(admin, target) {
  new MessageFormData()
    .title("Teleport?")
    .body(`Teleport to §f${target.name}§r now?`)
    .button1("Yes, teleport") // right
    .button2("Cancel")        // left
    .show(admin)
    .then((res) => {
      if (res.canceled) return;
      if (res.selection === 1) return; // Cancel
      // Do the actual TP on the next tick to avoid UI overlap
      system.runTimeout(() => teleportToPlayer(admin, target), 1);
    });
}

function teleportToPlayer(admin, target) {
  try {
    if (!target?.isValid) return info(admin, "That player is no longer online.");
    const loc = target.location;
    const dim = target.dimension;
    const dest = { x: Math.floor(loc.x) + 0.5, y: Math.max(1, Math.floor(loc.y) + 0.1), z: Math.floor(loc.z) + 0.5 };
    admin.teleport(dest, { dimension: dim });
    info(admin, `Teleported to ${target.name}.`);
  } catch (e) {
    sendErr(admin, e, "Teleporting to player");
  }
}

/* ---------------------------- Ender Chest Handling -------------------------- */
function explainEnderChestLimit(admin, target) {
  // Bedrock scripting cannot read another player's vanilla Ender Chest.
  new ActionFormData()
    .title("Ender Chest")
    .body(
      [
        "Reading another player's §lvanilla§r Ender Chest is not exposed in the Bedrock API.",
        "",
        "Two workable options:",
        "1) Use a custom 'Ender Vault' system (your own block/container) that mirrors Ender Chest behavior and stores items in dynamic properties.",
        "2) Temporarily require the player to dump their Ender Chest into a review chest (command-gated), then manage via the same UI.",
      ].join("\n")
    )
    .button("OK")
    .button("⬅️ Back")
    .show(admin)
    .then((res) => {
      if (res.canceled || res.selection === 0) return;
      playerActionsMenu(admin, target);
    });
}

/* -------------------------------- Utilities -------------------------------- */
function prettyId(id = "") {
  return id.replace(/^minecraft:/, "");
}

function safeGameMode(p) {
  try {
    const gm = p.getGameMode?.();
    if (!gm) return "unknown";
    switch (gm) {
      case "survival": return "Survival";
      case "creative": return "Creative";
      case "adventure": return "Adventure";
      case "spectator": return "Spectator";
      default: return String(gm);
    }
  } catch {
    return "unknown";
  }
}

function formatItemDetails(item) {
  const lines = [];
  try {
    lines.push(`§f${prettyId(item.typeId)} ×${item.amount}`);
    // Durability
    try {
      const dur = item.getComponent?.("minecraft:durability");
      if (dur) lines.push(`Durability: ${dur.damage}/${dur.maxDurability}`);
    } catch {}
    // Enchantments
    try {
      const ench = item.getComponent?.("minecraft:enchantments");
      const list = ench?.enchantments;
      if (list && typeof list[Symbol.iterator] === "function") {
        const parts = [];
        for (const e of list) {
          if (!e?.type) continue;
          parts.push(`${prettyId(e.type.id)} ${e.level}`);
        }
        if (parts.length) lines.push(`Enchantments: ${parts.join(", ")}`);
      }
    } catch {}
    // Lore
    try {
      const lore = item.getLore?.();
      if (lore && lore.length) lines.push(`Lore: ${lore.join(" | ")}`);
    } catch {}
  } catch {}
  return lines.join("\n");
}

/**
 * Tries to add an item fully to a container. Returns true if leftover exists (i.e., didn’t fit).
 */
function tryAddItem(container, itemStack) {
  try {
    const leftover = container.addItem(itemStack);
    return !!leftover;
  } catch {
    return true;
  }
}

function info(player, msg) {
  new MessageFormData().title("Info").body(String(msg)).button1("OK").button2(" ").show(player);
}

function sendErr(player, error, context = "") {
  const body = [
    `§c${context || "Error"}`,
    "",
    String(error?.message ?? error),
  ].join("\n");
  new MessageFormData().title("Error").body(body).button1("OK").button2(" ").show(player);
}


function viewEnderChestMenu(admin, target, page = 0) {
  scanEnderChest(target).then((items) => {
    // items: [{slot, id, quantity}]
    if (!items.length) {
      new ActionFormData()
        .title(`✨ ${target.name} — Ender Chest`)
        .body("No items found.")
        .button("⬅️ Back")
        .show(admin)
        .then(() => playerActionsMenu(admin, target));
      return;
    }

    const perPage = 20;
    const pages = Math.max(1, Math.ceil(items.length / perPage));
    const p = Math.min(Math.max(page, 0), pages - 1);
    const start = p * perPage;
    const pageItems = items.slice(start, start + perPage);

    const form = new ActionFormData()
      .title(`✨ ${target.name} — Ender Chest`)
      .body(`Items ${start + 1}-${start + pageItems.length} of ${items.length} (Page ${p + 1}/${pages})`);

    for (const it of pageItems) {
      form.button(`Slot ${it.slot}: ${prettyId(it.id)} ×${it.quantity}`);
    }
    if (pages > 1) { form.button("⬅️ Prev"); form.button("➡️ Next"); }
    form.button("⬅️ Back");

    form.show(admin).then((res) => {
      if (res.canceled) return;
      const listCount = pageItems.length;
      const hasPaging = pages > 1;
      const backIndex = listCount + (hasPaging ? 2 : 0);

      if (hasPaging && res.selection === listCount)      return viewEnderChestMenu(admin, target, Math.max(0, p - 1));
      if (hasPaging && res.selection === listCount + 1)  return viewEnderChestMenu(admin, target, Math.min(pages - 1, p + 1));
      if (res.selection === backIndex)                   return playerActionsMenu(admin, target);

      // clicked an item (you can add actions here if you want)
    });
  }).catch(e => sendErr(admin, e, "Reading ender chest"));
}

/**
 * Slow but reliable scan of the target's vanilla Ender Chest.
 * WARNING: This uses commands; Mojang does not expose Ender Chest to the API.
 */
function scanEnderChest(target) {
  const out = [];
  const all = ItemTypes.getAll(); // array of ItemType
  return new Promise((resolve) => {
    system.runJob((function* () {
      for (let slot = 0; slot < 27; slot++) {
        // Quick empty check (prefer the newer syntax, fallback to old):
        let empty = false;
        try {
          // Newer Bedrock: "item replace"
          empty = target.runCommand(`item replace entity @s slot.enderchest ${slot} keep air`).successCount === 1;
        } catch {
          try {
            // Older: "replaceitem"
            empty = target.runCommand(`replaceitem entity @s slot.enderchest ${slot} keep air`).successCount === 1;
          } catch {
            empty = false; // if both fail, assume not empty and continue scanning
          }
        }
        if (empty) { yield; continue; }

        // Find which item id is in that slot
        let foundId = null;
        for (const t of all) {
          try {
            const ok = target.runCommand(
              `testfor @s[hasitem={location=slot.enderchest,slot=${slot},item=${t.id},quantity=1..}]`
            ).successCount;
            if (ok) { foundId = t.id; break; }
          } catch { /* ignore */ }
          // spread the cost
          if ((out.length + slot) % 5 === 0) yield;
        }
        if (!foundId) { yield; continue; }

        // Find quantity by guessing
        let min = 1, max = new ItemStack(foundId).maxAmount, qty = 1;
        while (min <= max) {
          const mid = (min + max) >> 1;
          let ge = 0, le = 0;
          try { ge = target.runCommand(`testfor @s[hasitem={location=slot.enderchest,slot=${slot},item=${foundId},quantity=${mid}..}]`).successCount; } catch {}
          try { le = target.runCommand(`testfor @s[hasitem={location=slot.enderchest,slot=${slot},item=${foundId},quantity=..${mid}}]`).successCount; } catch {}
          if (ge && le) { qty = mid; break; }
          if (ge) { min = mid + 1; } else { max = mid - 1; }
          yield;
        }
        out.push({ slot, id: foundId, quantity: qty });
        yield;
      }
      resolve(out);
    })());
  });
}
