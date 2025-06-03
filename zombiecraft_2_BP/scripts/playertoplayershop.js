import {
    world,
    Player,
    ItemStack,
    ItemComponentTypes,
    EnchantmentType
  } from "@minecraft/server";
  import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
  
  const SEP = "¦";
  
  /** helper to split "owner¦storeId¦x¦y¦z" */
  function parseStoreEntry(displayName) {
    const parts = displayName.split(SEP);
    if (parts.length !== 5) return null;
    return {
      owner:   parts[0],
      storeId: parts[1],
      x:       Number(parts[2]),
      y:       Number(parts[3]),
      z:       Number(parts[4]),
    };
  }
  
  /** === BLOCK COMPONENT === */
  export class BlockShop {
    onPlayerInteract({ player, block }) {
      if (!(player instanceof Player)) return;
  
      const { x, y, z } = block.location;
      const dimId = block.dimension.id;
      const storeOwnerObj =
        world.scoreboard.getObjective("storeowner") ||
        world.scoreboard.addObjective("storeowner", "Store Owner");
  
      // find a store at these coords
      const match = storeOwnerObj.getParticipants().find(p => {
        const e = parseStoreEntry(p.displayName);
        return e && e.x === x && e.y === y && e.z === z;
      });
  
      if (!match) {
        // no store here → offer creation / move
        new ActionFormData()
          .title("Empty Shop Block")
          .body("No store set up here.")
          .button("Create Store")
          .button("Move Block")
          .button("Cancel")
          .show(player)
          .then(res => {
            if (res.canceled) return;
            if (res.selection === 0) {
              startPlayerStore(player, x, y, z, dimId);
            } else if (res.selection === 1) {
              moveBlock(player, x, y, z, dimId);
            }
          });
      } else {
        // store exists → open it
        const e = parseStoreEntry(match.displayName);
        if (!e) return;
        openStoreMenu(player, e);
      }
    }
  }
  
  /** Create a new store at coords (x,y,z) */
  function startPlayerStore(player, x, y, z, dimId) {
    const storeOwnerObj =
      world.scoreboard.getObjective("storeowner") ||
      world.scoreboard.addObjective("storeowner", "Store Owner");
  
    new ModalFormData()
      .title("Name Your Store")
      .textField("Enter a name:", "My Shop")
      .show(player)
      .then(res => {
        if (res.canceled || !res.formValues?.[0].trim()) {
          player.sendMessage("Store creation cancelled.");
          return;
        }
        const raw = res.formValues[0].trim();
        const storeId = raw
          .replace(/\s+/g, "_")
          .replace(/§/g, "¤")
          .replace(/&/g, "¦")
          .toLowerCase();
  
        // record in storeowner: "player¦storeId¦x¦y¦z"
        const entryKey = `${player.name}${SEP}${storeId}${SEP}${x}${SEP}${y}${SEP}${z}`;
        storeOwnerObj.setScore(entryKey, 1);
  
        // create per-store scoreboard
        const board = world.scoreboard.addObjective(
          `${player.name.toLowerCase()}_store_${storeId}`,
          raw
        );
        board.setScore("zcoins", 0);
  
        player.sendMessage(`Store '${raw}' created at [${x}, ${y}, ${z}]`);
      })
      .catch(err => {
        console.error("Store form error:", err);
        player.sendMessage("Error creating store.");
      });
  }
  
  /** Offer to pick up the block when empty */
  function moveBlock(player, x, y, z, dimId) {
    new ActionFormData()
      .title("Move Block")
      .body("This will break the block so you can pick it up. Confirm?")
      .button("Confirm")
      .button("Cancel")
      .show(player)
      .then(res => {
        if (res.canceled || res.selection !== 0) return;
        const dim = world.getDimension(dimId);
        // 'destroy' flag causes the block to drop itself as an item
        dim.runCommand(`setblock ${x} ${y} ${z} air destroy`);
        player.sendMessage("Block broken—pick up the dropped item!");
      });
  }
  
  
  /** Opens the add/view/manage menu for any store */
  function openStoreMenu(player, entry) {
    const { owner, storeId, x, y, z } = entry;
    const prettyName = storeId.replace(/_/g, " ");
    const objectiveId = `${owner.toLowerCase()}_store_${storeId}`;
    handleSelectedStore(
      player,
      { owner, storeId, x, y, z, id: objectiveId, name: prettyName },
      () => {}
    );
  }
  
  /** === ENCHANT HELPERS === */
  function GetEnchants(item) {
    if (!item) return [];
    const comp = item.getComponent(ItemComponentTypes.Enchantable);
    const list = comp?.getEnchantments?.();
    if (!comp || !list) return [];
    return list.map(e => ({ type: e.type.id, level: e.level }));
  }
  
  /** === CORE STORE UI LOGIC === */
  function handleSelectedStore(player, selectedStore, backCallback) {
    backCallback = backCallback || (() => {});
    const { owner, storeId, x, y, z, id, name } = selectedStore;
    const board = world.scoreboard.getObjective(id);
    if (!board) {
      player.sendMessage("Store not found.");
      return backCallback();
    }
  
    const isOwner = player.name.toLowerCase() === owner.toLowerCase();
  
    const form = new ActionFormData()
      .title(`Store: ${name}`)
      .body("Items available:");
    if (isOwner) {
      form.button("Add to Store");    // 0
      form.button("Claim Earnings");  // 1
      form.button("Close Shop");      // 2
      form.button("Back");            // 3
    } else {
      form.button("Back");            // 0
    }
  
    // gather items
    const items = [];
    board.getParticipants().forEach(p => {
      if (p.displayName === "zcoins") return;
      const parts = p.displayName.split("|");
      if (parts.length < 3) return;
      const [identifier, qtyStr, priceStr, enchStr] = parts;
      const quantity = parseInt(qtyStr, 10);
      const price    = parseInt(priceStr, 10);
      if (isNaN(quantity) || isNaN(price)) return;
  
      const enchantments = enchStr
        ? enchStr.split(";").map(pair => {
            const [type, lvl] = pair.split(":");
            return { type, level: parseInt(lvl, 10) };
          })
        : [];
  
      items.push({ id: p.displayName, identifier, name: identifier.replace(/^(minecraft:|zombie:)/,""), quantity, price, enchantments });
    });
  
    // add a button per item
    items.forEach(it => {
      const enchanted = it.enchantments.length ? "§bEnchanted " : "";
      form.button(
        `${it.quantity}x ${it.name}\n${enchanted}§2Cost: ${it.price}`,
        "textures/ui/MCoin"
      );
    });
  
    form.show(player).then(res => {
      if (res.canceled) return;
      const sel = res.selection;
      if (isOwner) {
        if (sel === 0) return addToStore(player, selectedStore);
        if (sel === 1) return claimZCoins(player, selectedStore);
        if (sel === 2) return closeShop(player, selectedStore);
        if (sel === 3) return backCallback();
        const idx = sel - 4;
        const chosen = items[idx];
        if (chosen) manageStoreItem(player, selectedStore, chosen);
      } else {
        if (sel === 0) return backCallback();
        const chosen = items[sel - 1];
        if (chosen) purchaseStoreItem(player, selectedStore, chosen, backCallback);
      }
    }).catch(err => {
      console.error("Store menu error:", err);
      backCallback();
    });
  }
  
  /** === OWNER: CLOSE SHOP === */
  function closeShop(player, { owner, storeId, x, y, z, id }) {
    new ActionFormData()
      .title("Close Shop")
      .body("This will delete all items in the store. Proceed?")
      .button("Confirm")
      .button("Cancel")
      .show(player)
      .then(res => {
        if (res.canceled || res.selection !== 0) return;
  
        // 0) grab the store scoreboard
        const storeBoard = world.scoreboard.getObjective(id);
  
        // 1) transfer any leftover ZCoins to the player
        if (storeBoard) {
          let bank = storeBoard.getScore("zcoins");
          if (bank === undefined) bank = 0;
          if (bank > 0) {
            const moneyObj = world.scoreboard.getObjective("Money");
            const current = moneyObj.getScore(player) || 0;
            moneyObj.setScore(player, current + bank);
            player.sendMessage(`Transferred ${bank} ZCoins into your account.`);
          }
        }
  
        // 2) remove per-store scoreboard
        world.scoreboard.removeObjective(id);
  
        // 3) remove entry in storeowner
        const storeOwnerObj = world.scoreboard.getObjective("storeowner");
        const entryKey = `${owner}${SEP}${storeId}${SEP}${x}${SEP}${y}${SEP}${z}`;
        storeOwnerObj.removeParticipant(entryKey);
  
        player.sendMessage("Shop closed. You can now recreate it or move the block.");
      });
  }
  
  
  /** === OWNER ACTIONS === */
  function addToStore(player, selectedStore) {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) {
      player.sendMessage("Inventory not found.");
      return handleSelectedStore(player, selectedStore);
    }
  
    // collect non-empty slots
    const items = [];
    for (let i = 0; i < inv.size; i++) {
      const it = inv.getItem(i);
      if (it) items.push({ slot: i, item: it });
    }
    if (!items.length) {
      player.sendMessage("Your inventory is empty.");
      return handleSelectedStore(player, selectedStore);
    }
  
    // build selection UI, marking enchanted items
    const form = new ActionFormData()
      .title("Select an Item to Add")
      .body("Pick from your inventory:");
    items.forEach(({ item }) => {
      const name = item.typeId.replace(/^(minecraft:|zombie:)/, "");
      const enchants = GetEnchants(item);
      const prefix = enchants.length ? "§bEnchanted " : "";
      form.button(`${item.amount}x ${prefix}${name}`);
    });
  
    form.show(player).then(res => {
      if (res.canceled) return;
      const entry = items[res.selection];
      if (!entry) {
        player.sendMessage("Invalid slot.");
        return handleSelectedStore(player, selectedStore);
      }
  
      const stack    = entry.item;
      const enchants = GetEnchants(stack);
      const enchText = enchants.length
        ? enchants.map(e => `${e.type} ${e.level}`).join("\n")
        : "None";
  
      // 1) Quantity prompt with enchant list
      new ModalFormData()
        .title(`Quantity for ${stack.typeId}`)
        .textField(`Enchantments:\n${enchText},\nAmount:`, "0")
        .show(player)
        .then(qRes => {
          if (qRes.canceled) return handleSelectedStore(player, selectedStore);
          const qty = parseInt(qRes.formValues[0], 10);
          if (isNaN(qty) || qty <= 0 || qty > stack.amount) {
            player.sendMessage("Invalid quantity.");
            return handleSelectedStore(player, selectedStore);
          }
  
          // 2) Price prompt, also showing enchants
          new ModalFormData()
            .title(`Price for ${stack.typeId}`)
            .textField(`Enchantments:\n${enchText},\nEach costs`, "0" )
            .show(player)
            .then(pRes => {
              if (pRes.canceled) return handleSelectedStore(player, selectedStore);
              const price = parseInt(pRes.formValues[0], 10);
              if (isNaN(price) || price < 0) {
                player.sendMessage("Invalid price.");
                return handleSelectedStore(player, selectedStore);
              }
  
              const board = world.scoreboard.getObjective(selectedStore.id);
              if (!board) {
                player.sendMessage("Store not found.");
                return handleSelectedStore(player, selectedStore);
              }
  
              // record item with enchant string
              const enchString = enchants.map(e => `${e.type}:${e.level}`).join(";");
              const key = `${stack.typeId}|${qty}|${price}|${enchString}`;
              board.setScore(key, 0);
  
              // remove items from inventory
              const slotItem = inv.getItem(entry.slot);
              if (slotItem) {
                if (slotItem.amount > qty) {
                  slotItem.amount -= qty;
                  inv.setItem(entry.slot, slotItem);
                } else {
                  inv.setItem(entry.slot, null);
                }
              }
  
              player.sendMessage(
                `Added ${qty}× ${stack.typeId.replace(/^(minecraft:|zombie:)/,"")} for ${price} each.`
              );
              handleSelectedStore(player, selectedStore);
            });
        });
    });
  }
  
  
  
  function manageStoreItem(player, selectedStore, selectedItem) {
    new ActionFormData()
      .title(`Manage: ${selectedItem.name}`)
      .body(
        `Qty: ${selectedItem.quantity}\n` +
          `Price: ${selectedItem.price}\n` +
          `Enchants: ${selectedItem.enchantments.map(e => `${e.type} ${e.level}`).join(", ") || "None"}`
      )
      .button("Edit Price")
      .button("Remove Item")
      .button("Back")
      .show(player)
      .then(res => {
        if (res.canceled) return;
        if (res.selection === 0) {
          editStoreItemPrice(player, selectedStore, selectedItem);
        } else if (res.selection === 1) {
          removeStoreItem(player, selectedStore, selectedItem);
        } else {
          handleSelectedStore(player, selectedStore);
        }
      });
  }
  
  function editStoreItemPrice(player, selectedStore, selectedItem) {
    new ModalFormData()
      .title(`New price for ${selectedItem.name}`)
      .textField("Enter price:", `${selectedItem.price}`)
      .show(player)
      .then(res => {
        if (res.canceled) return manageStoreItem(player, selectedStore, selectedItem);
        const newPrice = parseInt(res.formValues[0], 10);
        if (isNaN(newPrice) || newPrice < 0) {
          player.sendMessage("Invalid price.");
          return editStoreItemPrice(player, selectedStore, selectedItem);
        }
        const board = world.scoreboard.getObjective(selectedStore.id);
        if (!board) return player.sendMessage("Store missing.");
  
        board.removeParticipant(selectedItem.id);
        const enchString = selectedItem.enchantments
          .map(e => `${e.type}:${e.level}`)
          .join(";");
        const newKey = `${selectedItem.identifier}|${selectedItem.quantity}|${newPrice}|${enchString}`;
        board.setScore(newKey, 0);
  
        player.sendMessage(`Price updated to ${newPrice}.`);
        handleSelectedStore(player, selectedStore);
      });
  }
  
  function removeStoreItem(player, selectedStore, selectedItem) {
    const board = world.scoreboard.getObjective(selectedStore.id);
    if (!board) return player.sendMessage("Store missing.");
  
    board.removeParticipant(selectedItem.id);
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) {
      player.sendMessage("Inventory missing.");
      return;
    }
  
    const parts = selectedItem.id.split("|");
    const qty = parseInt(parts[1], 10);
    const itemToReturn = new ItemStack(parts[0], qty);
    if (parts[3]) {
      const enchComp = itemToReturn.getComponent("minecraft:enchantable");
      parts[3].split(";").forEach(e => {
        const [t, l] = e.split(":");
        enchComp?.addEnchantment({
          type: new EnchantmentType(t),
          level: parseInt(l, 10),
        });
      });
    }
  
    const slot = inv.addItem(itemToReturn);
    if (slot === -1) {
      player.sendMessage("Inventory full—could not return item.");
    } else {
      player.sendMessage(`Returned ${qty}× ${parts[0]}.`);
    }
  
    handleSelectedStore(player, selectedStore);
  }
  
  /** === CUSTOMER ACTION === */
  function purchaseStoreItem(player, selectedStore, selectedItem, backCallback) {
    const board = world.scoreboard.getObjective(selectedStore.id);
    if (!board) {
      player.sendMessage("Error: store missing.");
      return;
    }
  
    new ModalFormData()
      .title(`Buy ${selectedItem.name}`)
      .textField(
        `How many? (${selectedItem.quantity} in stock @ ${selectedItem.price})`,
        "0"
      )
      .show(player)
      .then(res => {
        if (res.canceled) return backCallback();
        const qty = parseInt(res.formValues[0], 10);
        if (isNaN(qty) || qty <= 0 || qty > selectedItem.quantity) {
          player.sendMessage("Invalid quantity.");
          return backCallback();
        }
  
        // money transfer & zcoins
        const moneyObj  = world.scoreboard.getObjective("Money");
        const playerBal = moneyObj.getScore(player) || 0;
        const totalCost = qty * selectedItem.price;
        if (playerBal < totalCost) {
          player.sendMessage("Not enough ZCoins.");
          return backCallback();
        }
        moneyObj.setScore(player, playerBal - totalCost);
        const bank = board.getScore("zcoins") || 0;
        board.setScore("zcoins", bank + totalCost);
  
        // === STOCK UPDATE ===
        board.removeParticipant(selectedItem.id);
        const newStock = selectedItem.quantity - qty;
        if (newStock > 0) {
          const enchString = selectedItem.enchantments
            .map(e => `${e.type}:${e.level}`)
            .join(";");
          const newKey = `${selectedItem.identifier}|${newStock}|${selectedItem.price}|${enchString}`;
          board.setScore(newKey, 0);
        }
  
        // === GIVE THE ITEM ===
        try {
          const stack    = new ItemStack(selectedItem.identifier, qty);
          const enchComp = stack.getComponent("minecraft:enchantable");
          if (enchComp && selectedItem.enchantments.length) {
            selectedItem.enchantments.forEach(({ type, level }) =>
              enchComp.addEnchantment({ type: new EnchantmentType(type), level })
            );
          }
          const inv       = player.getComponent("minecraft:inventory")?.container;
          const slotIndex = inv.addItem(stack);
          if (slotIndex === -1) {
            player.sendMessage("Inventory full—could not deliver items.");
          } else {
            player.sendMessage(`You bought ${qty}× ${selectedItem.name}.`);
          }
        } catch (err) {
          console.error("Error giving item:", err);
          player.sendMessage(`Error giving item: ${err.message}`);
        }
  
        handleSelectedStore(player, selectedStore, backCallback);
      })
      .catch(err => {
        console.error("Purchase form error:", err);
        player.sendMessage("Unexpected error during purchase.");
        backCallback();
      });
  }
  
  /** === OWNER: claim earnings === */
  function claimZCoins(player, selectedStore) {
    const board = world.scoreboard.getObjective(selectedStore.id);
    if (!board) return player.sendMessage("Store missing.");
  
    let bank = board.getScore("zcoins");
    if (!bank) {
      board.setScore("zcoins", 0);
      bank = 0;
    }
    if (bank === 0) {
      player.sendMessage("No ZCoins to claim.");
      return;
    }
  
    const moneyObj  = world.scoreboard.getObjective("Money");
    const playerBal = moneyObj.getScore(player) || 0;
    moneyObj.setScore(player, playerBal + bank);
    board.setScore("zcoins", 0);
  
    player.sendMessage(`You claimed ${bank} ZCoins.`);
  }
  