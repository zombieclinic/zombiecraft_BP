import { world, ItemStack, EnchantmentType } from "@minecraft/server";
import { MessageFormData } from "@minecraft/server-ui";

/** Config */
const MAX_MAIL_SLOTS  = 27; // how many entries a mailbox can hold
const SEND_PER_CLICK  = 1;  // send exactly one item per interaction

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

    // reliable hotbar slot index
    const slot = typeof player.selectedSlotIndex === "number" ? player.selectedSlotIndex : 0;
    const inv  = invComp.container;
    const held = inv.getItem(slot);
    if (!held) {
      player.sendMessage("§cHold an item in your hotbar and interact to mail it.");
      return;
    }

    // load existing mail
    const stored = world.getDynamicProperty(itemsKey);
    const mail   = stored ? JSON.parse(stored) : [];
    if (mail.length >= MAX_MAIL_SLOTS) {
      player.sendMessage("§cThis mailbox is full.");
      return;
    }

    // capture metadata BEFORE mutating the stack
    const entry = serializeStack(held, SEND_PER_CLICK);
    mail.push(entry);
    world.setDynamicProperty(itemsKey, JSON.stringify(mail));

    // remove exactly what we stored
    const newCount = held.amount - SEND_PER_CLICK;
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

/** Build a serializable snapshot of a stack (for exactly qty items) */
function serializeStack(stack, qty) {
  const enchArr =
    (stack.getComponent("minecraft:enchantable")?.getEnchantments() || [])
      .map(e => ({ id: e.type.id, level: e.level }));

  return {
    typeId:       stack.typeId,
    amount:       qty,
    nameTag:      stack.nameTag,
    lore:         stack.getLore(),
    enchantments: enchArr
  };
}

/** Rebuild an ItemStack from serialized data */
function rebuildStack(data) {
  const out = new ItemStack(data.typeId, Math.max(1, data.amount | 0));
  if (data.nameTag) out.nameTag = data.nameTag;
  if (data.lore)    out.setLore(data.lore);

  const cmp = out.getComponent("minecraft:enchantable");
  if (cmp && data.enchantments?.length) {
    for (const e of data.enchantments) {
      try {
        // accept either "minecraft:sharpness" or "sharpness"
        const shortId = (e.id?.includes(":")) ? e.id.split(":").pop() : e.id;
        cmp.addEnchantment({ type: new EnchantmentType(shortId), level: e.level });
      } catch {
        // skip incompatible enchantments
      }
    }
  }
  return out;
}

/** Deliver mail: tries to merge; only keeps leftovers in storage */
function deliverMailboxItems(player, mail, itemsKey) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return;

  let deliveredEntries = 0;
  const remaining = [];

  for (const data of mail) {
    const stack     = rebuildStack(data);
    const leftover  = inv.addItem(stack); // returns leftover ItemStack if not fully added

    if (!leftover) {
      // fully delivered
      deliveredEntries++;
    } else {
      // none or partial delivered (with SEND_PER_CLICK=1, this means none)
      remaining.push({
        ...data,
        amount: leftover.amount ?? data.amount
      });
    }
  }

  if (remaining.length === 0) {
    world.setDynamicProperty(itemsKey, undefined);
  } else {
    world.setDynamicProperty(itemsKey, JSON.stringify(remaining));
  }

  if (deliveredEntries === 0) {
    player.sendMessage("§cNo space. Clear inventory and try again.");
  } else {
    const pending = remaining.length;
    player.sendMessage(
      `§aYou retrieved ${deliveredEntries} item${deliveredEntries === 1 ? "" : "s"}.` +
      (pending ? ` §e(${pending} more waiting.)` : "")
    );
  }
}
