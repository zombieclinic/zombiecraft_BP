import { world, ItemStack } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";

export class Mailbox {
  onPlayerInteract(event) {
    const { player, block, dimension } = event;
    const key = getMailboxKey(block, dimension);
    const itemsKey = `${key}|items`;
    const owner = world.getDynamicProperty(key);

    if (!owner) {
      handleMailboxRegistration(player, key);
      return;
    }

    if (owner === player.name) {
      // Owner retrieving items
      const stored = world.getDynamicProperty(itemsKey);
      const items = stored ? JSON.parse(stored) : [];
      if (!items.length) {
        player.sendMessage("§eYour mailbox is empty.");
        return;
      }
      deliverMailboxItems(player, items, itemsKey);
    } else {
      // Guest sending item: Get item from main hand (selected slot)
      const inv = player.getComponent("inventory").container;
      const selected = inv.selectedSlot ?? player.selectedSlot ?? 0;
      const heldItem = inv.getItem(selected);

      if (!heldItem) {
        player.sendMessage("§cHold the item you want to mail in your hand and interact with the mailbox.");
        return;
      }

      const stored = world.getDynamicProperty(itemsKey);
      const items = stored ? JSON.parse(stored) : [];

      if (items.length >= 27) {
        player.sendMessage("§cThis mailbox is full.");
        return;
      }

      // Store item with full NBT
      const itemJson = heldItem.toJson();
      items.push(itemJson);
      world.setDynamicProperty(itemsKey, JSON.stringify(items));

      // Remove the item from sender's hand
      inv.setItem(selected, undefined);

      player.sendMessage("§aItem sent to mailbox.");
    }
  }
}

// --- ALL Helper Functions Are OUTSIDE the class ---

function getMailboxKey(block, dim) {
  const { x, y, z } = block.location;
  return `mailbox|${dim.id}|${x},${y},${z}`;
}

function handleMailboxRegistration(player, newKey) {
  let oldKey = null;
  for (const k of world.getDynamicPropertyIds()) {
    if (k.startsWith("mailbox|") && world.getDynamicProperty(k) === player.name) {
      oldKey = k;
      break;
    }
  }

  if (oldKey && oldKey !== newKey) {
    new MessageFormData()
      .title("Move Mailbox?")
      .body(
        "You already have a mailbox registered elsewhere.\n\n" +
        "Are you sure you want to move your mailbox here?\n" +
        "(Your old mailbox and stored mail will be lost.)"
      )
      .button1("Yes, move here")
      .button2("No, cancel")
      .show(player)
      .then(res => {
        if (res.canceled || res.selection !== 0) return;
        removeAllPlayerMailboxes(player.name);
        world.setDynamicProperty(newKey, player.name);
        player.sendMessage("§aMailbox moved and registered here.");
      });
  } else {
    new ActionFormData()
      .title("Register Mailbox")
      .body("Do you want to register this mailbox?\nYou'll receive items here.")
      .button("Yes")
      .button("No")
      .show(player)
      .then(res => {
        if (res.selection !== 0) return;
        world.setDynamicProperty(newKey, player.name);
        player.sendMessage("§aMailbox registered successfully.");
      });
  }
}

function removeAllPlayerMailboxes(playerName) {
  for (const k of world.getDynamicPropertyIds()) {
    if (k.startsWith("mailbox|") && world.getDynamicProperty(k) === playerName) {
      world.setDynamicProperty(k, undefined);
      const itemsKey = `${k}|items`;
      world.setDynamicProperty(itemsKey, undefined);
    }
  }
}

function deliverMailboxItems(player, items, itemsKey) {
  const inv = player.getComponent("inventory").container;
  let delivered = 0;

  for (const itemData of items) {
    if (inv.emptySlotsCount <= 0) break;
    try {
      const item = ItemStack.fromJson(itemData);
      inv.addItem(item);
      delivered++;
    } catch (err) {
      console.warn("Invalid item JSON:", itemData);
    }
  }

  if (delivered === 0) {
    player.sendMessage("§cNo room in inventory. Make space first.");
    return;
  }

  items.splice(0, delivered);
  if (items.length === 0) {
    world.setDynamicProperty(itemsKey, undefined);
  } else {
    world.setDynamicProperty(itemsKey, JSON.stringify(items));
  }

  player.sendMessage(`§aYou retrieved ${delivered} item(s) from your mailbox.`);
}
