import { world, system } from "@minecraft/server";
import { ModalFormData, ActionFormData, MessageFormData } from "@minecraft/server-ui";

export class AdminMenu {
 
    onUse(arg) {
     const player = arg.source
    mainMenu(player);
  }
}

  function mainMenu(player) {
    const form = new ActionFormData()
        .title("Admin Menu")
        .button("Set Spawn")
        .button("Make Admin")
        .button("Manage Admins")
        .button("Set Spawn Protection")
        .button("Command Prompt")
        .button("Exit");

    form.show(player).then(result => {
        if (result.canceled) return;

        switch (result.selection) {
            case 0:
                setSpawnMenu(player);
                break;
            case 1:
                makeAdminMenu(player);
                break;
            case 2:
                manageAdminsMenu(player);
                break;
            case 3:
                setSpawnProtection(player);
                break;
            case 4:
              commandPrompt(player);
                break;
            case 5:
                return
            default:
                return;
        }
    }).catch(err => {
        console.error("MainMenu form error:", err);
    });
}



  function setSpawnMenu(player) {
  const { x, y, z } = player.location;
  const coords = `${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)}`;

  new MessageFormData()
    .title("Set Spawn")
    .body(`Your current coordinates are: ${coords}\n\nDo you want to set this as world spawn?`)
    .button1("Yes")
    .button2("No")
    .show(player)
    .then((confirm) => {
      if (confirm.selection === 0) {
        world.setDynamicProperty("worldspawn", coords);
        player.runCommand(`setworldspawn ${coords}`);
      }

      // Return to the main menu afterward
      mainMenu(player);
    });
}

 function makeAdminMenu(player) {
  const players = world.getPlayers();
  const form = new ActionFormData().title("Make Admin");

  players.forEach(p => form.button(p.name));
  form.button("Type in Player Name");

  form.show(player).then((result) => {
    if (result.canceled) return mainMenu(player);

    if (result.selection === players.length) {
      // Manual name entry
      new ModalFormData()
        .title("Manual Admin Entry")
        .textField("Player Name", "Enter player name:")
        .show(player)
        .then(inputResult => {
          if (!inputResult.canceled) {
            const name = inputResult.formValues[0]?.trim();
            if (name) world.setDynamicProperty(`admin_${name}`, true);
            mainMenu(player);
          }
        });
    } else {
      const selected = players[result.selection];
      if (!selected) return mainMenu(player); // Extra safety

      new MessageFormData()
        .title("Confirm Admin")
        .body(`Make ${selected.name} an admin?`)
        .button1("Yes")
        .button2("No")
        .show(player)
        .then(confirm => {
          if (confirm.selection === 0) {
            world.setDynamicProperty(`admin_${selected.name}`, true);
          }
          mainMenu(player);
        });
    }
  });
}


 function manageAdminsMenu(player) {
  const admins = world.getDynamicPropertyIds().filter(id => id.startsWith("admin_"));

  if (admins.length === 0) {
    new MessageFormData()
      .title("Manage Admins")
      .body("No admins set.")
      .button1("OK")
      .show(player)
      .then(() => mainMenu(player));
    return;
  }

  const form = new ActionFormData().title("Manage Admins");
  admins.forEach(adminId => form.button(adminId.replace("admin_", "")));

  form.show(player).then(result => {
    if (result.canceled) return mainMenu(player);

    const selectedAdminId = admins[result.selection];
    if (!selectedAdminId) return mainMenu(player); // extra safety

    const adminName = selectedAdminId.replace("admin_", "");

    new MessageFormData()
      .title("Remove Admin")
      .body(`Remove admin privileges from ${adminName}?`)
      .button1("Yes")
      .button2("No")
      .show(player)
      .then(confirm => {
        if (confirm.selection === 0) {
          world.setDynamicProperty(`admin_${adminName}`, undefined);
        }
        mainMenu(player);
      });
  });
}


function commandPrompt(player) {
  new ModalFormData()
    .title("Admin Command")
    .textField("Enter command (without '/')", "")
    .show(player)
    .then(response => {
      if (response.canceled) return mainMenu(player);

      const cmd = response.formValues?.[0]?.trim();
      if (cmd) player.runCommand(cmd);

      mainMenu(player);
    });
}

 function setSpawnProtection(player) {
  new ModalFormData()
    .title("Spawn Protection Radius")
    .textField("Enter protection radius (blocks):", "e.g., 32")
    .show(player)
    .then(response => {
      if (response.canceled) return mainMenu(player);

      const radiusInput = response.formValues?.[0]?.trim();
      const radius = parseInt(radiusInput);

      if (isNaN(radius) || radius <= 0) {
        player.sendMessage("§cInvalid radius.");
        return mainMenu(player);
      }

      world.setDynamicProperty("spawnprotection", radius);
      player.sendMessage(`§aSpawn protection radius set to: ${radius}`);
      mainMenu(player);
    });
}
