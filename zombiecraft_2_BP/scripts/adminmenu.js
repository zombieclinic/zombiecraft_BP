import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";

export class AdminMenu {
  onUse(arg) {
    const player = arg.source;
    mainMenu(player);
  }
}

function mainMenu(player) {
  const spawnCoords   = world.getDynamicProperty("worldspawn")     ?? "not set";
  const spawnProtect  = world.getDynamicProperty("spawnprotection")?? "none";
  const baseRadius    = world.getDynamicProperty("baseRadius")     ?? "none";
  const baseDistance  = world.getDynamicProperty("baseDistance")   ?? "none";
  const xyDistance    = world.getDynamicProperty("xyDistance")     ?? "none";
  const maxBaseClaim = world.getDynamicProperty("maxBaseClaims")  ?? "none";

  const statusLines = [
    `Spawn:             ${spawnCoords}`,
    `Protection:        ${spawnProtect}`,
    `Base Radius:       ${baseRadius}`,
    `Base Distance:     ${baseDistance}`,
    `X/Z Distance:      ${xyDistance}`,
    `Base counts       ${maxBaseClaim}`
  ];

  new ActionFormData()
    .title("Admin Menu")
    .body(statusLines.join("\n"))
    .button("Set Spawn")
    .button("Make Admin")
    .button("Manage Admins")
    .button("Set Spawn Protection")
    .button("Set Base Radius")
    .button("Set Base Distance")
    .button("Set X/Z Distance")
    .button("Set Base Count")
    .button("Economy")
    .button("Command Prompt")
    .button("Exit")
    .show(player)
    .then(res => {
      if (res.canceled) return;             // close UI
      switch (res.selection) {
        case 0: return setSpawnMenu(player);
        case 1: return makeAdminMenu(player);
        case 2: return manageAdminsMenu(player);
        case 3: return setSpawnProtection(player);
        case 4: return setBaseRadius(player);
        case 5: return baseDistanceSpawn(player);
        case 6: return setXYDistanceSpawn(player);
        case 7: return setBaseCount(player);
        case 8: return Economy(player);
        case 9: return commandPrompt(player);
        case 10: return;                     // Exit
      }
    })
    .catch(console.error);
}

function setSpawnMenu(player) {
  const { x, y, z } = player.location;
  const coords      = `${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)}`;

  new MessageFormData()
    .title("Set Spawn")
    .body(`Your current coordinates are:\n${coords}\n\nSet this as world spawn?`)
    .button1("Yes")
    .button2("No")
    .show(player)
    .then(confirm => {
      if (confirm.selection === 0) {
        world.setDynamicProperty("worldspawn", coords);
        player.runCommand(`setworldspawn ${coords}`);
      }
      mainMenu(player);
    });
}

function makeAdminMenu(player) {
  const players = world.getPlayers();
  const form    = new ActionFormData().title("Make Admin");

  players.forEach(p => form.button(p.name));
  form.button("Type in Player Name");

  form.show(player).then(result => {
    if (result.canceled) return mainMenu(player);

    if (result.selection === players.length) {
      new ModalFormData()
        .title("Manual Admin Entry")
        .textField("Player Name", "")
        .show(player)
        .then(input => {
          if (!input.canceled) {
            const name = input.formValues[0]?.trim();
            if (name) world.setDynamicProperty(`admin_${name}`, true);
          }
          mainMenu(player);
        });
    } else {
      const sel = players[result.selection];
      new MessageFormData()
        .title("Confirm Admin")
        .body(`Make ${sel.name} an admin?`)
        .button1("Yes")
        .button2("No")
        .show(player)
        .then(confirm => {
          if (confirm.selection === 0) {
            world.setDynamicProperty(`admin_${sel.name}`, true);
          }
          mainMenu(player);
        });
    }
  });
}

function manageAdminsMenu(player) {
  const admins = world.getDynamicPropertyIds()
    .filter(id => id.startsWith("admin_"));

  if (admins.length === 0) {
    new MessageFormData()
      .title("Manage Admins")
      .body("No admins set.")
      .button1("OK")
      .show(player)
      .then(() => mainMenu(player));
    return;
  }

  const form = new ActionFormData().title("Remove Admin");
  admins.forEach(id => form.button(id.replace("admin_", "")));
  form.button("Back");

  form.show(player).then(res => {
    if (res.canceled || res.selection === admins.length) return mainMenu(player);
    const name = admins[res.selection].replace("admin_", "");
    new MessageFormData()
      .title("Confirm Removal")
      .body(`Remove admin: ${name}?`)
      .button1("Yes")
      .button2("No")
      .show(player)
      .then(c => {
        if (c.selection === 0) {
          world.setDynamicProperty(`admin_${name}`, undefined);
        }
        mainMenu(player);
      });
  });
}

function commandPrompt(player) {
  new ModalFormData()
    .title("Admin Command")
    .textField("Enter command (no '/'):","")
    .show(player)
    .then(res => {
      if (!res.canceled) player.runCommand(res.formValues[0]?.trim());
      mainMenu(player);
    });
}

function setSpawnProtection(player) {
  new ModalFormData()
    .title("Spawn Protection Radius")
    .textField("Blocks:","32")
    .show(player)
    .then(res => {
      if (res.canceled) return mainMenu(player);
      const r = parseInt(res.formValues[0],10);
      if (isNaN(r)||r<=0) player.sendMessage("§cInvalid radius.");
      else {
        world.setDynamicProperty("spawnprotection", r);
        player.sendMessage(`§aSpawn protection set to ${r}.`);
      }
      mainMenu(player);
    });
}

function setBaseRadius(player) {
  new ModalFormData()
    .title("Base Radius")
    .textField("Blocks:","32")
    .show(player)
    .then(res => {
      if (res.canceled) return mainMenu(player);
      const r = parseInt(res.formValues[0],10);
      if (isNaN(r)||r<=0) player.sendMessage("§cInvalid radius.");
      else {
        world.setDynamicProperty("baseRadius", r);
        player.sendMessage(`§aBase radius set to ${r}.`);
      }
      mainMenu(player);
    });
}

function baseDistanceSpawn(player) {
  new ModalFormData()
    .title("Distance from Spawn")
    .textField("Blocks:","250")
    .show(player)
    .then(res => {
      if (res.canceled) return mainMenu(player);
      const d = parseInt(res.formValues[0],10);
      if (isNaN(d)||d<=0) player.sendMessage("§cInvalid distance.");
      else {
        world.setDynamicProperty("baseDistance", d);
        player.sendMessage(`§aBase distance set to ${d}.`);
      }
      mainMenu(player);
    });
}

function setXYDistanceSpawn(player) {
  new ModalFormData()
    .title("X/Z Distance from Spawn")
    .textField("Blocks:","250")
    .show(player)
    .then(res => {
      if (res.canceled) return mainMenu(player);
      const d = parseInt(res.formValues[0],10);
      if (isNaN(d)||d<=0) player.sendMessage("§cInvalid distance.");
      else {
        world.setDynamicProperty("xyDistance", d);
        player.sendMessage(`§aX/Z distance set to ${d}.`);
      }
      mainMenu(player);
    })
    .catch(err => {
      console.error(err);
      mainMenu(player);
    });
}

// —— Economy & Display —— //

function Economy(player) {
  const name      = world.getDynamicProperty("economy_currencyName") ?? "Coins";
  const bonus     = world.getDynamicProperty("economy_startBonus")    ?? 0;
  const costA     = world.getDynamicProperty("economy_tpSpawnCost")   ?? 0;
  const costB     = world.getDynamicProperty("economy_tpBaseCost")    ?? 0;
  const costF     = world.getDynamicProperty("economy_tpFriendsCost") ?? 0;
  const disp      = world.getDynamicProperty("economy_displayType")   ?? "belowname";
  const order     = world.getDynamicProperty("economy_listOrder")     ?? "ascending";

  new ActionFormData()
    .title("💰 Economy Settings")
    .body(
      `Name:           ${name}\n` +
      `Start Bonus:    ${bonus}\n` +
      `TP → Spawn:     ${costA}\n` +
      `TP → Base:      ${costB}\n` +
      `TP → Friend:    ${costF}\n` +
      `Display:        ${disp}` +
      (disp === "list" ? `\nList Order:     ${order}` : "")
    )
    .button("Pick Name")
    .button("Set Start Bonus")
    .button("Cost TP to Spawn")
    .button("Cost TP to Base")
    .button("Cost TP to Friends")
    .button("Set Display")
    .button("Back")
    .show(player)
    .then(res => {
      if (res.canceled) return (player);
      switch (res.selection) {
        case 0: return pickName(player);
        case 1: return setStartBonus(player);
        case 2: return setTpSpawnCost(player);
        case 3: return setTpBaseCost(player);
        case 4: return setTpFriendsCost(player);
        case 5: return setDisplay(player);
        case 6: return mainMenu(player);
      }
    })
    .catch(console.error);
}

function pickName(player) {
  const current = world.getDynamicProperty("economy_currencyName") ?? "";
  new ModalFormData()
    .title("Pick Currency Name")
    .textField("Use § codes:", current)
    .show(player)
    .then(res => {
      if (res.canceled) return Economy(player);
      const name = res.formValues[0]?.trim();
      if (!name) player.sendMessage("§cName required.");
      else {
        world.setDynamicProperty("economy_currencyName", name);
        player.sendMessage(`§aCurrency name set to: ${name}`);
        const ov = world.getDimension("overworld");
        ov.runCommand(`scoreboard objectives add Money dummy`);
        ov.runCommand(`scoreboard objectives remove Display`);
        ov.runCommand(`scoreboard objectives add Display dummy "${name}"`);
      }
      Economy(player);
    })
    .catch(console.error);
}

function setStartBonus(player) {
  new ModalFormData()
    .title("Set Start Bonus")
    .textField("Number:", "100")
    .show(player)
    .then(res => {
      if (res.canceled) return Economy(player);
      const v = parseInt(res.formValues[0],10);
      if (isNaN(v)||v<0) player.sendMessage("§cInvalid value.");
      else {
        world.setDynamicProperty("economy_startBonus", v);
        player.sendMessage(`§aStart bonus set to ${v}.`);
      }
      Economy(player);
    });
}

function setTpSpawnCost(player) {
  new ModalFormData()
    .title("Cost: TP to Spawn")
    .textField("Number:", "10")
    .show(player)
    .then(res => {
      if (res.canceled) return Economy(player);
      const v = parseInt(res.formValues[0],10);
      if (isNaN(v)||v<0) player.sendMessage("§cInvalid cost.");
      else {
        world.setDynamicProperty("economy_tpSpawnCost", v);
        player.sendMessage(`§aTP‑Spawn cost set to ${v}.`);
      }
      Economy(player);
    });
}

function setTpBaseCost(player) {
  new ModalFormData()
    .title("Cost: TP to Base")
    .textField("Number:", "15")
    .show(player)
    .then(res => {
      if (res.canceled) return Economy(player);
      const v = parseInt(res.formValues[0],10);
      if (isNaN(v)||v<0) player.sendMessage("§cInvalid cost.");
      else {
        world.setDynamicProperty("economy_tpBaseCost", v);
        player.sendMessage(`§aTP‑Base cost set to ${v}.`);
      }
      Economy(player);
    });
}

function setTpFriendsCost(player) {
  new ModalFormData()
    .title("Cost: TP to Friends")
    .textField("Number:", "5")
    .show(player)
    .then(res => {
      if (res.canceled) return Economy(player);
      const v = parseInt(res.formValues[0],10);
      if (isNaN(v)||v<0) player.sendMessage("§cInvalid cost.");
      else {
        world.setDynamicProperty("economy_tpFriendsCost", v);
        player.sendMessage(`§aTP‑Friends cost set to ${v}.`);
      }
      Economy(player);
    });
}

function setDisplay(player) {
  new ActionFormData()
    .title("Display Position")
    .button("Below Name")
    .button("List")
    .button("Sidebar")
    .button("Back")
    .show(player)
    .then(res => {
      if (res.canceled || res.selection === 3) return Economy(player);
      const t = ["belowname", "list", "sidebar"][res.selection];
      world.setDynamicProperty("economy_displayType", t);
      player.sendMessage(`§aDisplay set to: ${t}`);
      return t === "list" ? setListOrder(player) : Economy(player);
    })
    .catch(console.error);
}

function setListOrder(player) {
  new ActionFormData()
    .title("List Order")
    .button("Ascending")
    .button("Descending")
    .button("Back")
    .show(player)
    .then(res => {
      if (res.canceled || res.selection === 2) return Economy(player);
      const o = res.selection === 0 ? "ascending" : "descending";
      world.setDynamicProperty("economy_listOrder", o);
      player.sendMessage(`§aList order: ${o}`);
      Economy(player);
    })
    .catch(console.error);
}


function setBaseCount(player) {
  new ModalFormData()
    .title("Max Base Claims")
    .textField("How many bases may a player claim?", "e.g., 3")
    .show(player)
    .then(response => {
      if (response.canceled) return mainMenu(player);

      const input = response.formValues?.[0]?.trim();
      const count = parseInt(input, 10);

      if (isNaN(count) || count < 1) {
        player.sendMessage("§cPlease enter a valid number (1 or higher).");
        return mainMenu(player);
      }

      // Save to dynamic properties
      world.setDynamicProperty("maxBaseClaims", count);
      player.sendMessage(`§aPlayers may now claim up to ${count} bases.`);

      mainMenu(player);
    })
    .catch(err => {
      console.error("setBaseCount error:", err);
      mainMenu(player);
    });
}