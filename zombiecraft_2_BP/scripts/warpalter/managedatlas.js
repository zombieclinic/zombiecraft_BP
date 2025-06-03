import { world } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { playerTpMenu } from "./warpalter.js";
import { baseSecurity } from "./security.js";

const SEP = "¦";

/**
 * Manage menu for a warp atlas block.
 * States:
 * 0 = unlocked, security off
 * 1 = locked,   security off
 * 3 = unlocked, security on
 * 4 = locked,   security on
 */
export function manageWarpAlter(player, coords) {
    const atlasObj = world.scoreboard.getObjective("warpatlas");
    const entryObj = atlasObj.getParticipants()
      .find(e => e.displayName.split(SEP)[1] === coords);
    if (!entryObj) return;
  
    const parts = entryObj.displayName.split(SEP);
    const tag   = parts[0];
    const nick  = parts[2];
  
    // Admin check
    const adminObj = world.scoreboard.getObjective("admin");
    const isAdmin  = adminObj
      ? adminObj.getParticipants().some(e => e.displayName.split(SEP)[1] === player.name)
      : false;
  
    // Owner check for private
    if (tag === "private" && !isAdmin) {
      const owners = parts.slice(3);
      if (!owners.includes(player.name)) {
        return new MessageFormData()
          .title("Access Denied")
          .body("This is a private atlas. Only owners (or admins) can manage it.")
          .button1("OK")
          .show(player);
      }
    }
  
    // Read current state
    const score   = atlasObj.getScore(entryObj);
    const isSecOn = score >= 3;
    const isLocked = (score === 1 || score === 4);
  
    // Build buttons
    const buttons = [];
    if (!isLocked) buttons.push("Destroy Warp Atlas");
    if (tag === "private") {
      buttons.push("Basemates List");
      buttons.push("Base Security");
    }
    if (isAdmin) buttons.push(isLocked ? "Unlock Atlas" : "Lock Atlas");
    buttons.push("↩ Back", "§l§cExit");
  
    // Show form
    const manaObj     = world.scoreboard.getObjective("mana");
    const currentMana = manaObj?.getScore(player) ?? 0;
    const form = new ActionFormData()
      .title(`Manage Warp: ${nick}`)
      .body(
        `Type: ${tag}\n` +
        `Destroy Cost: §950 Mana\n` +
        `Your Mana: §9${currentMana}`
      );
    buttons.forEach(lbl => form.button(lbl));
  
    form.show(player).then(res => {
      if (res.canceled) return;
      let idx = res.selection;
  
      // 1) Destroy
      if (!isLocked) {
        if (idx === 0) return confirmDestroyForm(player, entryObj, coords);
        idx--;
      }
  
      // 2) Private options
      if (tag === "private") {
        if (idx === 0) return baseMatesMenu(player, entryObj, coords);
        if (idx === 1) return baseSecurity(player, entryObj, coords);
        idx -= 2;
      }
  
      // 3) Lock toggle (admin)
      if (isAdmin) {
        if (idx === 0) {
          let newScore;
          if (!isSecOn) {
            // security off: 0->1, 1->0
            newScore = isLocked ? 0 : 1;
          } else {
            // security on: 3->4, 4->3
            newScore = isLocked ? 3 : 4;
          }
          atlasObj.setScore(entryObj.displayName, newScore);
          return manageWarpAlter(player, coords);
        }
        idx--;
      }
  
      // 4) Back
      if (idx === 0) {
        return playerTpMenu(player, coords);
      }
      // 5) Exit: no action
    });
  }
  
  function confirmDestroyForm(player, entryObj, coords) {
    new MessageFormData()
      .title("Confirm Destroy")
      .body("This will cost 50 Mana and permanently remove this atlas. Proceed?")
      .button1("Yes")
      .button2("No")
      .show(player)
      .then(choice => {
        if (choice.selection !== 0) {
          return manageWarpAlter(player, coords);
        }
        const manaObj     = world.scoreboard.getObjective("mana");
        const currentMana = manaObj?.getScore(player) ?? 0;
        if (currentMana < 50) {
          return player.runCommandAsync(
            `tellraw @s {"rawtext":[{"text":"§cNot enough mana! (${currentMana}/50)"}]}`
          );
        }
        manaObj.setScore(player, currentMana - 50);
        player.runCommandAsync(
          `tellraw @s {"rawtext":[{"text":"§9Mana: ${currentMana - 50}"}]}`
        );
        const atlasObj = world.scoreboard.getObjective("warpatlas");
        atlasObj.removeParticipant(entryObj.displayName);
        const [x,y,z] = coords.split(",").map(Number);
        world.getDimension(player.dimension.id)
          .runCommandAsync(`setblock ${x} ${y} ${z} air`);
        player.runCommandAsync(
          `tellraw @s {"rawtext":[{"text":"§aWarp Atlas destroyed."}]}`
        );
      });
  }
  
  function baseMatesMenu(player, entryObj, coords) {
    new ActionFormData()
      .title("Basemates List")
      .body("How would you like to add/remove friends?")
      .button("Add by Typing")
      .button("Add from Online List")
      .button("Remove Friends")
      .button("↩ Back")
      .button("§l§cExit")
      .show(player)
      .then(res => {
        if (res.canceled) return manageWarpAlter(player, coords);
        switch (res.selection) {
          case 0: return addByTyping(player, entryObj, coords);
          case 1: return addByList(player, entryObj, coords);
          case 2: return removeFriendsMenu(player, entryObj, coords);
          case 3: return manageWarpAlter(player, coords);
          default: return;
        }
      });
  }



function addByTyping(player, entryObj, coords) {
  new ModalFormData()
    .title("Add Friend by Typing")
    .textField("Enter exact player name", "")
    .show(player)
    .then(res => {
      if (res.canceled) return baseMatesMenu(player, entryObj, coords);
      const name = res.formValues[0].trim();
      if (!name) return baseMatesMenu(player, entryObj, coords);

      const parts   = entryObj.displayName.split(SEP);
      const friends = parts.slice(3);
      if (friends.includes(name)) {
        player.runCommandAsync(
          `tellraw @s {"rawtext":[{"text":"§c${name} already added."}]}`
        );
        return;
      }

      const newStr = entryObj.displayName + SEP + name;
      if (newStr.length > 32767) {
        player.runCommandAsync(
          `tellraw @s {"rawtext":[{"text":"§cFriend list full."}]}`
        );
        return;
      }

      const atlasObj = world.scoreboard.getObjective("warpatlas");
      atlasObj.removeParticipant(entryObj.displayName);
      atlasObj.setScore(newStr, 1);

      player.runCommandAsync(
        `tellraw @s {"rawtext":[{"text":"§aAdded ${name}."}]}`
      );
    });
}

function addByList(player, entryObj, coords) {
  const parts   = entryObj.displayName.split(SEP);
  const friends = parts.slice(3);
  const online  = world.getPlayers().map(p => p.name)
                       .filter(n => n !== parts[3] && !friends.includes(n));
  if (!online.length) {
    player.runCommandAsync(
      `tellraw @s {"rawtext":[{"text":"§cNo one online"}]}`
    );
    return baseMatesMenu(player, entryObj, coords);
  }

  const form = new ActionFormData()
    .title("Add Friend from List")
    .body("Select a player to add:");
  online.forEach(n => form.button(n));
  form.button("↩ Back").button("§l§cExit");

  form.show(player).then(res => {
    if (res.canceled) return baseMatesMenu(player, entryObj, coords);
    const idx = res.selection;
    if (idx < online.length) {
      const name = online[idx];
      new MessageFormData()
        .title("Confirm Add")
        .body(`Add ${name}?`)
        .button1("Yes")
        .button2("No")
        .show(player)
        .then(c => c.selection === 0
          ? addByTyping(player, entryObj, coords, name)
          : addByList(player, entryObj, coords)
        );
    } else if (idx === online.length) {
      baseMatesMenu(player, entryObj, coords);
    }
  });
}

function removeFriendsMenu(player, entryObj, coords) {
  const parts   = entryObj.displayName.split(SEP);
  const friends = parts.slice(3);
  if (!friends.length) {
    player.runCommandAsync(
      `tellraw @s {"rawtext":[{"text":"§cNo friends to remove."}]}`
    );
    return baseMatesMenu(player, entryObj, coords);
  }

  const form = new ActionFormData()
    .title("Remove Friend")
    .body("Select a friend to remove:");
  friends.forEach(n => form.button(n));
  form.button("↩ Back").button("§l§cExit");

  form.show(player).then(res => {
    if (res.canceled) return baseMatesMenu(player, entryObj, coords);
    const idx = res.selection;
    if (idx < friends.length) {
      const name = friends[idx];
      new MessageFormData()
        .title("Confirm Remove")
        .body(`Remove ${name}?`)
        .button1("Yes")
        .button2("No")
        .show(player)
        .then(c => {
          if (c.selection === 0) {
            const newParts = parts.filter(p => p !== name);
            const newStr   = newParts.join(SEP);
            const atlasObj = world.scoreboard.getObjective("warpatlas");
            atlasObj.removeParticipant(entryObj.displayName);
            atlasObj.setScore(newStr, 1);
            player.runCommandAsync(
              `tellraw @s {"rawtext":[{"text":"§aRemoved ${name}."}]}`
            );
          } else {
            removeFriendsMenu(player, entryObj, coords);
          }
        });
    } else if (idx === friends.length) {
      baseMatesMenu(player, entryObj, coords);
    }
  });
}