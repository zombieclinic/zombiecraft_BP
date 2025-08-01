import { world, ItemStack, EnchantmentType } from "@minecraft/server";
import { MessageFormData }                  from "@minecraft/server-ui";

export class Mailbox {
  onPlayerInteract(event) {
    const { player, block, dimension } = event;
    const key      = getMailboxKey(block, dimension);
    const itemsKey = `${key}|items`;
    const owner    = world.getDynamicProperty(key);

    // 1) No owner? Prompt registration
    if (!owner) {
      promptRegisterMailbox(player, key);
      return;
    }

    // 2) Owner collecting mail
    if (owner === player.name) {
      const stored = world.getDynamicProperty(itemsKey);
      const mail   = stored ? JSON.parse(stored) : [];
      if (mail.length === 0) {
        player.sendMessage("§eYour mailbox is empty.");
      } else {
        deliverMailboxItems(player, mail, itemsKey);
      }
      return;
    }

    // 3) Guest mailing an item
    const invComp = player.getComponent("minecraft:inventory");
    if (!invComp) return;

    // **THIS** is the reliable “hot-bar slot index”
    const slot = typeof player.selectedSlotIndex === "number"
               ? player.selectedSlotIndex
               : 0;

    const inv     = invComp.container;
    const held    = inv.getItem(slot);
    if (!held) {
      player.sendMessage("§cHold an item in your hotbar and interact to mail it.");
      return;
    }

    const stored = world.getDynamicProperty(itemsKey);
    const mail   = stored ? JSON.parse(stored) : [];
    if (mail.length >= 27) {
      player.sendMessage("§cThis mailbox is full.");
      return;
    }

    // Extract NBT: nameTag, lore, enchantments
    const enchArr = (held.getComponent("minecraft:enchantable")?.getEnchantments() || [])
      .map(e => ({ id: e.type.id, level: e.level }));

    mail.push({
      typeId:       held.typeId,
      amount:       held.amount,
      nameTag:      held.nameTag,
      lore:         held.getLore(),
      enchantments: enchArr
    });

    world.setDynamicProperty(itemsKey, JSON.stringify(mail));

    // Remove one from that slot
    const newCount = held.amount - 1;
    if (newCount > 0) {
      inv.setItem(slot, new ItemStack(held.typeId, newCount));
    } else {
      inv.setItem(slot, undefined);
    }

    player.sendMessage("§aItem mailed successfully!");
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function getMailboxKey(block, dimension) {
  const { x, y, z } = block.location;
  return `mailbox|${dimension.id}|${x},${y},${z}`;
}

function promptRegisterMailbox(player, key) {
  // Find any existing mailbox belonging to this player
  let existing = null;
  for (const k of world.getDynamicPropertyIds()) {
    if (k.startsWith("mailbox|") && world.getDynamicProperty(k) === player.name) {
      existing = k;
      break;
    }
  }

  const isMove = Boolean(existing);
  const form = new MessageFormData()
    .title(isMove ? "Move Mailbox?" : "Register Mailbox")
    .body(
      isMove
        ? "You already have a mailbox registered. Move it here? Your old mail will be lost."
        : "Do you want to register this mailbox to receive mail here?"
    )
    .button1("Yes")
    .button2("No");

  form.show(player).then(res => {
    if (res.canceled || res.selection !== 0) return;

    // If moving, clear old data
    if (existing) {
      world.setDynamicProperty(existing, undefined);
      world.setDynamicProperty(`${existing}|items`, undefined);
    }

    // Register new mailbox
    world.setDynamicProperty(key, player.name);
    player.sendMessage(`§aMailbox registered for ${player.name}`);
  });
}

function deliverMailboxItems(player, mail, itemsKey) {
  const inv = player.getComponent("minecraft:inventory").container;
  let delivered = 0;

  for (const data of mail) {
    if (inv.emptySlotsCount <= 0) break;

    // Rebuild the stack with all NBT
    const stack = new ItemStack(data.typeId, data.amount);
    if (data.nameTag) stack.nameTag = data.nameTag;
    if (data.lore)    stack.setLore(data.lore);

    const cmp = stack.getComponent("minecraft:enchantable");
    for (const e of data.enchantments || []) {
      cmp.addEnchantment({
        type:  new EnchantmentType(e.id.split(":").pop()),
        level: e.level
      });
    }

    inv.addItem(stack);
    delivered++;
  }

  if (delivered === 0) {
    player.sendMessage("§cNo free space. Clear inventory and try again.");
    return;
  }

  // Remove delivered mail from storage
  mail.splice(0, delivered);
  if (mail.length === 0) {
    world.setDynamicProperty(itemsKey, undefined);
  } else {
    world.setDynamicProperty(itemsKey, JSON.stringify(mail));
  }

  player.sendMessage(`§aYou retrieved ${delivered} item(s).`);
}
