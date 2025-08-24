import { world, Player, ItemStack, EnchantmentType } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";

const SHOP_PROP = "blockShops";

// ─── Roman numerals helper ────────────────────────────────────────
function toRoman(num) {
  const map = ["I","II","III","IV","V","VI","VII","VIII","IX","X"];
  return map[num - 1] || num.toString();
}

// ─── Load & save shops ───────────────────────────────────────────
function getShops() {
  const raw = world.getDynamicProperty(SHOP_PROP) || "{}";
  const shops = JSON.parse(raw);
  // backfill missing stats / fields
  for (const key in shops) {
    const shop = shops[key];
    shop.profit = shop.profit || 0;
    shop.totalItemsSold = shop.totalItemsSold || 0;
    shop.totalRevenue   = shop.totalRevenue   || 0;
    shop.items.forEach(it => {
      it.sold = it.sold || 0;
      it.packSize = it.packSize || 1;  // NEW: default pack size
    });
  }
  return shops;
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
  const blockItem = new ItemStack(block.typeId, 1);
  player.getComponent("minecraft:inventory").container.addItem(blockItem);
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
      // initialize new shop with stats
      shops[key] = {
        owner:         player.name,
        name:          null,
        items:         [],
        profit:        0,
        totalItemsSold: 0,
        totalRevenue:   0
      };
      saveShops(shops);
      await new MessageFormData()
        .title("Created")
        .body("You own this shop.")
        .button1("OK")
        .show(player);
      return storeMenu(player, block);
    } else {
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

  const form = new ActionFormData()
    .title(shop.name || "Store")
    .body(
      `Balance:    $${shop.profit}\n` +
      `Sold Items: ${shop.totalItemsSold}\n` +
      `Revenue:    $${shop.totalRevenue}`
    );

  [
    "Name Store",
    "Add Inventory",
    "View Inventory",
    "Close Shop",
    "Claim Balance",
    "Exit"
  ].forEach(lbl => form.button(lbl));

  const res = await form.show(player);
  if (res.canceled) return;

  switch (res.selection) {
    case 0: return nameStore(player, block);
    case 1: return addInventory(player, block);
    case 2: return viewInventory(player, block);
    case 3: return closeShop(player, block);
    case 4: return claimBalance(player, block);
    case 5: return; // Exit
  }
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
  const inv   = player.getComponent("minecraft:inventory").container;
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
    .textField(`Have ${chosen.amount}. How many?`, "0")
    .show(player);
  if (qtyRes.canceled) return storeMenu(player, block);
  const qty = Math.min(chosen.amount, parseInt(qtyRes.formValues[0]) || 0);
  if (qty <= 0) return storeMenu(player, block);

  // NEW: price + pack size in a single "Price" modal (like your screenshot)
  const priceRes = await new ModalFormData()
    .title("Price")
    .textField("Price (per pack):", "0")
    .textField("Pack size (how many items per purchase):", "1")
    .show(player);
  if (priceRes.canceled) return storeMenu(player, block);

  const price = Math.max(0, parseFloat(priceRes.formValues[0]) || 0);
  const packSize = Math.max(1, parseInt(priceRes.formValues[1]) || 1);
  if (price <= 0 || packSize <= 0) return storeMenu(player, block);

  const shops = getShops();
  shops[getKey(block)].items.push({
    typeId:       chosen.typeId,
    count:        qty,
    price,                    // price per pack
    packSize,                 // NEW
    enchanted:    !!enchCopy.length,
    name:         chosen.nameTag,
    lore:         chosen.getLore(),
    enchantments: enchCopy,
    sold:         0
  });

  const remain = chosen.amount - qty;
  if (remain > 0) inv.setItem(slot, new ItemStack(chosen.typeId, remain));
  else            inv.setItem(slot, undefined);
  saveShops(shops);

  await new MessageFormData()
    .title("Added")
    .body(`${qty}× ${chosen.nameTag||chosen.typeId.split(":").pop()} @ $${price} for ${packSize}` + enchText)
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
    form.button(`${it.count}× ${name} - $${it.price} for ${it.packSize}${suffix}`);
  });
  form.button("Back").button("Exit");

  const res = await form.show(player);
  if (res.canceled) return;
  if (res.selection === items.length)     return storeMenu(player, block);
  if (res.selection === items.length + 1) return;

  // detail submenu
  const it = items[res.selection];
  let bodyStr = "";
  if (it.enchantments?.length) {
    bodyStr += "Enchantments:\n" + it.enchantments.map(e => {
      const raw = e.id.split(":").pop().replace(/_/g, " ");
      return raw.charAt(0).toUpperCase() + raw.slice(1) + " " + toRoman(e.level);
    }).join("\n");
  }
  if (it.lore?.length) {
    bodyStr += (bodyStr ? "\n\n" : "") + "Lore:\n" + it.lore.join("\n");
  }
  bodyStr += `\n\nSold: ${it.sold}`;

  const sub = new ActionFormData()
    .title(it.name||it.typeId.split(":").pop())
    .body(bodyStr || "No extra data");
  ["Edit Price","Remove Qty","Back","Exit"].forEach(lbl => sub.button(lbl));
  const subRes = await sub.show(player);
  if (subRes.canceled||subRes.selection===2) return;
  if (subRes.selection===3) return;

  if (subRes.selection===0) {
    // edit price + pack size
    const pr = await new ModalFormData()
      .title("Edit Price")
      .textField("Price (per pack):", it.price.toString())
      .textField("Pack size:", (it.packSize||1).toString())
      .show(player);
    if (!pr.canceled) {
      const newPrice = parseFloat(pr.formValues[0]);
      const newPack  = parseInt(pr.formValues[1]);
      if (!isNaN(newPrice) && newPrice > 0) it.price = newPrice;
      if (!isNaN(newPack) && newPack > 0)   it.packSize = newPack;
      saveShops(shops);
    }
    return viewInventory(player, block);
  }
  if (subRes.selection===1) {
    // remove qty...
    const rq = await new ModalFormData()
      .title("Remove Qty")
      .textField(`Have ${it.count}. Remove?`, "0")
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
        player.getComponent("minecraft:inventory").container.addItem(ret);

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
      player.getComponent("minecraft:inventory").container.addItem(ret);
    }

    delete shops[key];
    saveShops(shops);
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

// ─── Claim Balance (owner) ────────────────────────────────────────
async function claimBalance(player, block) {
  const shops = getShops();
  const key   = getKey(block);
  const shop  = shops[key];
  const amount = shop.profit || 0;

  if (amount <= 0) {
    await new MessageFormData()
      .title("Nothing to Claim")
      .body("Your shop balance is $0.")
      .button1("OK")
      .show(player);
    return storeMenu(player, block);
  }

  // give scoreboard money
  block.dimension.runCommand(
    `scoreboard players add "${player.name}" Money ${amount}`
  );
  shop.profit = 0;
  saveShops(shops);

  await new MessageFormData()
    .title("Claimed")
    .body(`You claimed $${amount}.`)
    .button1("OK")
    .show(player);

  return storeMenu(player, block);
}

// ─── View Stats (owner) ───────────────────────────────────────────
async function viewStats(player, block) {
  const shop = getShops()[getKey(block)];
  const body = `Total Items Sold: ${shop.totalItemsSold}` +
               `\nTotal Revenue: $${shop.totalRevenue}`;

  const res = await new ActionFormData()
    .title("Stats")
    .body(body)
    .button("Back")
    .button("Exit")
    .show(player);

  if (res.canceled || res.selection === 1) return;
  return storeMenu(player, block);
}

// ─── Customer menu ───────────────────────────────────────────────
async function customerMenu(player, block) {
  const key   = getKey(block);
  const shops = getShops();
  const shop  = shops[key];
  const items = shop.items || [];

  const form = new ActionFormData().title(shop.name || "Store");
  items.forEach(it => {
    const name   = it.name || it.typeId.split(":").pop();
    const suffix = it.enchanted ? "\n§9Enchanted" : "";
    form.button(`${it.count}× ${name} - $${it.price} for ${it.packSize}${suffix}`);
  });
  form.button("Exit");
  const res = await form.show(player);
  if (res.canceled || res.selection === items.length) return;

  return customerDetail(player, block, res.selection);
}

// ─── Customer detail & buy flow (bundle packs) ───────────────────
async function customerDetail(player, block, idx) {
  const key   = getKey(block);
  const shops = getShops();
  const it    = shops[key].items[idx];

  const pack = it.packSize || 1;
  const packsAvailable = Math.floor(it.count / pack);

  // build detail body
  let body = `Price: $${it.price} for ${pack}\n` +
             `In stock: ${it.count} items (~${packsAvailable} packs)`;
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

  if (packsAvailable <= 0) {
    await new MessageFormData()
      .title("Out of Packs")
      .body("Not enough stock to make a full pack.")
      .button1("OK")
      .show(player);
    return customerMenu(player, block);
  }

  // Ask packs (not items)
  const qtyRes = await new ModalFormData()
    .title("Purchase Packs")
    .textField(`Packs available: ${packsAvailable}. How many packs?`, "1")
    .show(player);
  if (qtyRes.canceled) return customerDetail(player, block, idx);

  const packs = Math.min(packsAvailable, parseInt(qtyRes.formValues[0]) || 0);
  if (packs <= 0) return customerDetail(player, block, idx);

  const itemsToGive = packs * pack;
  const total = packs * it.price;

  // confirm cost
  const cf = await new MessageFormData()
    .title("Confirm Purchase")
    .body(`Buy ${packs} pack(s) (${itemsToGive} items) for $${total}?`)
    .button1("Yes")
    .button2("No")
    .show(player);
  if (cf.selection !== 0) return customerDetail(player, block, idx);

  // check funds via scoreboard test
  let hasFunds = false;
  try {
    block.dimension.runCommand(
      `scoreboard players test "${player.name}" Money ${total}`
    );
    hasFunds = true;
  } catch (_) { hasFunds = false; }

  if (!hasFunds) {
    await new MessageFormData()
      .title("Insufficient Funds")
      .body(`You need $${total} but have less.`)
      .button1("OK")
      .show(player);
    return customerMenu(player, block);
  }

  // quick space check (at least 1 free slot)
  const inv = player.getComponent("minecraft:inventory").container;
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

  // charge & update stats
  block.dimension.runCommand(
    `scoreboard players remove "${player.name}" Money ${total}`
  );

  shops[key].profit         = (shops[key].profit         || 0) + total;
  shops[key].totalRevenue   = (shops[key].totalRevenue   || 0) + total;
  shops[key].totalItemsSold = (shops[key].totalItemsSold || 0) + itemsToGive;
  it.sold                   = (it.sold                   || 0) + itemsToGive;

  // give items (split into stacks if needed)
  let remaining = itemsToGive;
  while (remaining > 0) {
    const give = Math.min(remaining, 64);
    const ret = new ItemStack(it.typeId, give);
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
    remaining -= give;
  }

  // deduct stock
  it.count -= itemsToGive;
  if (it.count <= 0) shops[key].items.splice(idx, 1);
  saveShops(shops);

  await new MessageFormData()
    .title("Purchase Successful")
    .body(`You bought ${packs} pack(s) (${itemsToGive} items) for $${total}.`)
    .button1("OK")
    .show(player);

  return customerMenu(player, block);
}
