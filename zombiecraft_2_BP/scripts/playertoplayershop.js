import { world, Player, ItemStack, EnchantmentType } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";

const SHOP_PROP = "blockShops";

// ─── Roman numerals helper ────────────────────────────────────────
function toRoman(num) {
  const map = ["I","II","III","IV","V","VI","VII","VIII","IX","X"];
  return map[num - 1] || num.toString();
}

// ─── Load & save shops ────────────────────────────────────────────
function getShops() {
  return JSON.parse(world.getDynamicProperty(SHOP_PROP) || "{}");
}
function saveShops(shops) {
  world.setDynamicProperty(SHOP_PROP, JSON.stringify(shops));
}

// ─── Unique key per block location/dimension ──────────────────────
function getKey(block) {
  const { x, y, z } = block.location;
  return `${block.dimension.id}|${x},${y},${z}`;
}

// ─── Give block item back and remove block ────────────────────────
function reclaimBlock(block, player) {
  // give the block as an item back to the player
  const blockItem = new ItemStack(block.typeId, 1);
  player.getComponent("inventory").container.addItem(blockItem);
  // remove the block from the world
  const { x, y, z } = block.location;
  block.dimension.runCommand(`setblock ${x} ${y} ${z} air`);
}

// ─── Entry point ─────────────────────────────────────────────────
export class BlockShop {
  onPlayerInteract({ player, block }) {
    if (!(player instanceof Player)) return;
    shopMenu(player, block);
  }
}

// ─── Main menu ───────────────────────────────────────────────────
async function shopMenu(player, block) {
  const key   = getKey(block);
  const shops = getShops();

  // no shop exists yet
  if (!shops[key]) {
    const res = await new MessageFormData()
      .title("Set Up Shop")
      .body("No shop here. Create one?")
      .button1("Yes")
      .button2("No")
      .show(player);

    if (res.selection === 0) {
      // create it, initialize profit
      shops[key] = { owner: player.name, name: null, items: [], profit: 0 };
      saveShops(shops);
      await new MessageFormData()
        .title("Created")
        .body("You own this shop.")
        .button1("OK")
        .show(player);
      return storeMenu(player, block);

    } else {
      // cancel → reclaim the block
      reclaimBlock(block, player);
      return;
    }
  }

  // existing shop → owner vs. customer
  const shop = shops[key];
  if (shop.owner === player.name) {
    return storeMenu(player, block);
  } else {
    return customerMenu(player, block);
  }
}

// ─── Owner menu ──────────────────────────────────────────────────
async function storeMenu(player, block) {
  const shop = getShops()[getKey(block)];
  const form = new ActionFormData().title(shop.name || "Store");
  ["Name Store","Add Inventory","View Inventory","Close Shop","Exit"]
    .forEach(lbl => form.button(lbl));
  const res = await form.show(player);
  if (res.canceled) return;
  if (res.selection === 0) return nameStore(player, block);
  if (res.selection === 1) return addInventory(player, block);
  if (res.selection === 2) return viewInventory(player, block);
  if (res.selection === 3) return closeShop(player, block);
}

// ─── Set store name ───────────────────────────────────────────────
async function nameStore(player, block) {
  const shops = getShops();
  const shop  = shops[getKey(block)];
  const res   = await new ModalFormData()
    .title("Store Name")
    .textField("Enter name:", shop.name || "")
    .show(player);
  if (res.canceled) return storeMenu(player, block);
  shop.name = res.formValues[0].trim() || null;
  saveShops(shops);
  return storeMenu(player, block);
}

// ─── Add inventory ────────────────────────────────────────────────
async function addInventory(player, block) {
  const inv   = player.getComponent("inventory").container;
  const slots = [];
  const form  = new ActionFormData().title("Select Item to Sell");

  for (let i = 0; i < inv.size; i++) {
    const item = inv.getItem(i);
    if (!item) continue;
    const enchList = item.getComponent("minecraft:enchantable")?.getEnchantments() || [];
    const name     = item.nameTag?.length
                     ? item.nameTag
                     : item.typeId.split(":").pop();
    const suffix   = enchList.length ? "\n§9Enchanted" : "";
    slots.push(i);
    form.button(`${item.amount}× ${name}${suffix}`);
  }

  if (!slots.length) {
    await new MessageFormData()
      .title("Empty")
      .body("No items to add.")
      .button1("OK")
      .show(player);
    return storeMenu(player, block);
  }

  const res = await form.show(player);
  if (res.canceled) return storeMenu(player, block);

  const slot     = slots[res.selection];
  const chosen   = inv.getItem(slot);
  const enchCopy = (chosen.getComponent("minecraft:enchantable")?.getEnchantments() || [])
                   .map(e => ({ id: e.type.id, level: e.level }));

  let enchText = "";
  if (enchCopy.length) {
    enchText = "\n" + enchCopy
      .map(e => {
        const raw = e.id.split(":").pop().replace(/_/g, " ");
        const cap = raw.charAt(0).toUpperCase() + raw.slice(1);
        return `${cap} ${toRoman(e.level)}`;
      })
      .join("\n");
  }

  const qtyRes = await new ModalFormData()
    .title("Quantity")
    .textField(`Have ${chosen.amount}. How many?`, "1")
    .show(player);
  if (qtyRes.canceled) return storeMenu(player, block);
  const qty = Math.min(chosen.amount, parseInt(qtyRes.formValues[0]) || 0);
  if (qty <= 0) return storeMenu(player, block);

  const priceRes = await new ModalFormData()
    .title("Price")
    .textField("Price each?","1")
    .show(player);
  if (priceRes.canceled) return storeMenu(player, block);
  const price = parseFloat(priceRes.formValues[0]) || 0;
  if (price <= 0) return storeMenu(player, block);

  const shops = getShops();
  shops[getKey(block)].items.push({
    typeId:       chosen.typeId,
    count:        qty,
    price,
    enchanted:    !!enchCopy.length,
    name:         chosen.nameTag,
    lore:         chosen.getLore(),
    enchantments: enchCopy
  });

  const remain = chosen.amount - qty;
  if (remain > 0) inv.setItem(slot, new ItemStack(chosen.typeId, remain));
  else            inv.setItem(slot, undefined);
  saveShops(shops);

  await new MessageFormData()
    .title("Added")
    .body(`${qty}× ${chosen.nameTag||chosen.typeId.split(":").pop()} @ $${price}` + enchText)
    .button1("OK")
    .show(player);

  return storeMenu(player, block);
}

// ─── View & manage inventory (owner) ─────────────────────────────
async function viewInventory(player, block) {
  const key   = getKey(block);
  const shops = getShops();
  const items = shops[key]?.items || [];

  if (!items.length) {
    await new MessageFormData()
      .title("Empty")
      .body("No items.")
      .button1("OK")
      .show(player);
    return storeMenu(player, block);
  }

  const form = new ActionFormData().title("Inventory");
  items.forEach(it => {
    const name   = it.name || it.typeId.split(":").pop();
    const suffix = it.enchanted ? "\n§9Enchanted" : "";
    form.button(`${it.count}× ${name} - $${it.price}${suffix}`);
  });
  form.button("Back").button("Exit");

  const res = await form.show(player);
  if (res.canceled) return;
  if (res.selection === items.length)     return storeMenu(player, block);
  if (res.selection === items.length + 1) return;

  // detail submenu
  const it      = items[res.selection];
  let bodyStr   = "";
  if (it.enchantments?.length) {
    bodyStr += "Enchantments:\n" + it.enchantments.map(e => {
      const raw = e.id.split(":").pop().replace(/_/g, " ");
      return raw.charAt(0).toUpperCase() + raw.slice(1) + " " + toRoman(e.level);
    }).join("\n");
  }
  if (it.lore?.length) {
    bodyStr += (bodyStr ? "\n\n" : "") + "Lore:\n" + it.lore.join("\n");
  }

  const sub = new ActionFormData()
    .title(it.name||it.typeId.split(":").pop())
    .body(bodyStr || "No extra data");
  ["Edit Price","Remove Qty","Back","Exit"].forEach(lbl => sub.button(lbl));
  const subRes = await sub.show(player);
  if (subRes.canceled||subRes.selection===3) return;
  if (subRes.selection===0) {
    // edit price...
    const pr = await new ModalFormData()
      .title("New Price")
      .textField("Price:", it.price.toString())
      .show(player);
    if (!pr.canceled) {
      it.price = parseFloat(pr.formValues[0]) || it.price;
      saveShops(shops);
    }
    return viewInventory(player, block);
  }
  if (subRes.selection===1) {
    // remove qty...
    const rq = await new ModalFormData()
      .title("Remove Qty")
      .textField(`Have ${it.count}. Remove?`, "1")
      .show(player);
    if (!rq.canceled) {
      const rem = Math.min(it.count, parseInt(rq.formValues[0]) || 0);
      if (rem > 0) {
        const ret = new ItemStack(it.typeId, rem);
        if (it.name) ret.nameTag = it.name;
        if (it.lore) ret.setLore(it.lore);
        const cmp = ret.getComponent("minecraft:enchantable");
        for (const e of it.enchantments || []) {
          cmp.addEnchantment({
            type: new EnchantmentType(e.id.split(":").pop()),
            level: e.level
          });
        }
        player.getComponent("inventory").container.addItem(ret);

        it.count -= rem;
        if (it.count <= 0) shops[key].items.splice(res.selection, 1);
        saveShops(shops);
      }
    }
    return viewInventory(player, block);
  }
}

// ─── Close shop & return all items (owner) ───────────────────────
async function closeShop(player, block) {
  const shops = getShops();
  const key   = getKey(block);
  const shop  = shops[key];

  const cf = await new MessageFormData()
    .title("Close Shop")
    .body("Return items and close?")
    .button1("Yes")
    .button2("No")
    .show(player);

  if (cf.selection === 0) {
    for (const it of shop.items) {
      const ret = new ItemStack(it.typeId, it.count);
      if (it.name) ret.nameTag = it.name;
      if (it.lore) ret.setLore(it.lore);
      const cmp = ret.getComponent("minecraft:enchantable");
      for (const e of it.enchantments || []) {
        cmp.addEnchantment({
          type: new EnchantmentType(e.id.split(":").pop()),
          level: e.level
        });
      }
      player.getComponent("inventory").container.addItem(ret);
    }

    delete shops[key];
    saveShops(shops);

    // reclaim the block to the player
    reclaimBlock(block, player);

    await new MessageFormData()
      .title("Closed")
      .body("Shop closed.")
      .button1("OK")
      .show(player);
  } else {
    return storeMenu(player, block);
  }
}

// ─── Customer menu ───────────────────────────────────────────────
async function customerMenu(player, block) {
  const key   = getKey(block);
  const shops = getShops();
  const shop  = shops[key];
  const items = shop.items || [];

  // list items + Exit
  const form = new ActionFormData().title(shop.name || "Store");
  items.forEach(it => {
    const name   = it.name || it.typeId.split(":").pop();
    const suffix = it.enchanted ? "\n§9Enchanted" : "";
    form.button(`${it.count}× ${name} - $${it.price}${suffix}`);
  });
  form.button("Exit");
  const res = await form.show(player);
  if (res.canceled || res.selection === items.length) return;

  return customerDetail(player, block, res.selection);
}

// ─── Customer detail & buy flow ─────────────────────────────────
async function customerDetail(player, block, idx) {
  const key   = getKey(block);
  const shops = getShops();
  const it    = shops[key].items[idx];

  // build detail body
  let body = `Price: $${it.price}\nQty: ${it.count}`;
  if (it.enchantments?.length) {
    body += "\n\nEnchantments:\n" + it.enchantments.map(e => {
      const raw = e.id.split(":").pop().replace(/_/g, " ");
      const cap = raw[0].toUpperCase() + raw.slice(1);
      return `${cap} ${toRoman(e.level)}`;
    }).join("\n");
  }
  if (it.lore?.length) {
    body += "\n\nLore:\n" + it.lore.join("\n");
  }

  const form = new ActionFormData()
    .title(it.name||it.typeId.split(":").pop())
    .body(body);
  form.button("Buy").button("Back");
  const res = await form.show(player);
  if (res.canceled || res.selection === 1) return customerMenu(player, block);

  // Buy → ask quantity
  const qtyRes = await new ModalFormData()
    .title("Purchase Quantity")
    .textField(`Have ${it.count}. How many to buy?`, "1")
    .show(player);
  if (qtyRes.canceled) return customerDetail(player, block, idx);
  const qty = Math.min(it.count, parseInt(qtyRes.formValues[0]) || 0);
  if (qty <= 0) return customerDetail(player, block, idx);

  const total = qty * it.price;
  // confirm cost
  const cf = await new MessageFormData()
    .title("Confirm Purchase")
    .body(`Buy ${qty}× ${it.name||it.typeId.split(":").pop()} for $${total}?`)
    .button1("Yes")
    .button2("No")
    .show(player);
  if (cf.selection !== 0) return customerDetail(player, block, idx);

  // check funds
  const hasFunds = block.dimension.runCommand(
    `scoreboard players test "${player.name}" Money ${total}`
  );
  if (!hasFunds) {
    await new MessageFormData()
      .title("Insufficient Funds")
      .body(`You need $${total} but have less.`)
      .button1("OK")
      .show(player);
    return customerMenu(player, block);
  }

  // check inventory space
  const inv = player.getComponent("inventory").container;
  let empty = 0;
  for (let i = 0; i < inv.size; i++) {
    if (!inv.getItem(i)) empty++;
  }
  if (empty === 0) {
    await new MessageFormData()
      .title("No Inventory Space")
      .body("Please free up at least one slot.")
      .button1("OK")
      .show(player);
    return customerMenu(player, block);
  }

  // execute purchase
  // subtract money
  block.dimension.runCommand(
    `scoreboard players remove "${player.name}" Money ${total}`
  );
  // add profit
  shops[key].profit = (shops[key].profit || 0) + total;
  // give items
  const ret = new ItemStack(it.typeId, qty);
  if (it.name) ret.nameTag = it.name;
  if (it.lore) ret.setLore(it.lore);
  const cmp = ret.getComponent("minecraft:enchantable");
  for (const e of it.enchantments || []) {
    cmp.addEnchantment({
      type: new EnchantmentType(e.id.split(":").pop()),
      level: e.level
    });
  }
  inv.addItem(ret);

  // deduct stock
  it.count -= qty;
  if (it.count <= 0) shops[key].items.splice(idx, 1);
  saveShops(shops);

  await new MessageFormData()
    .title("Purchase Successful")
    .body(`You bought ${qty}× ${it.name||it.typeId.split(":").pop()} for $${total}.`)
    .button1("OK")
    .show(player);

  return customerMenu(player, block);
}
