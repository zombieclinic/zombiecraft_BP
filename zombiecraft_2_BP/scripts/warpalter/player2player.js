import { world, system } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { playerTpMenu } from "./warpalter";



const SEP = "¦";
const teleportRequests = {};
const lastCoords = new Map();

export function playerToPlayerMenu(player, coords) {
    new ActionFormData()
      .title("Player→Player TP")
      .body("What would you like to do?")
      .button("Request to Teleport to Player")
      .button("Teleport Requests")
      .button("↩ Back")
      .button("§l§cExit")
      .show(player)
      .then(res => {
        if (res.canceled) return;
        switch (res.selection) {
          case 0: requestToTeleportMenu(player); break;
          case 1: viewTeleportRequests(player);  break;
          case 2: playerTpMenu(player, coords);         break; // back to main
          default: /* exit */                    break;
        }
      });
  }
  
  /**
   * Step 1: pick an online player to request.
   */
  function requestToTeleportMenu(player, coords) {
    const others = world.getPlayers().filter(p => p.name !== player.name);
    if (others.length === 0) {
      player.runCommandAsync(
        `tellraw @s {"rawtext":[{"text":"§cNo other players online."}]}`
      );
      return playerToPlayerMenu(player);
    }
  
    const form = new ActionFormData()
      .title("Who to request?")
      .body("Select a player:")
      .button("↩ Back");
  
    // insert buttons for each name
    others.forEach(p => form.button(p.name));
    form.button("§l§cExit");
  
    form.show(player).then(res => {
      if (res.canceled) return;
      const idx = res.selection - 1;
      if (idx === -1) {
        return playerToPlayerMenu(player, coords);
      } else if (idx < others.length) {
        const target = others[idx];
        // confirm cost
        new MessageFormData()
          .title("Confirm Request")
          .body(`Request teleport to ${target.name}?\n§9Cost: 10 Mana`)
          .button1("Yes")
          .button2("Back")
          .show(player)
          .then(choice => {
            if (choice.selection === 0) {
              // check mana
              const manaObj = world.scoreboard.getObjective("mana");
              const current = manaObj?.getScore(player) || 0;
              if (current < 10) {
                return player.runCommandAsync(
                  `tellraw @s {"rawtext":[{"text":"§cNot enough mana!"}]}`
                );
              }
              // deduct and show remaining
              const remaining = current - 10;
              manaObj.setScore(player, remaining);
              player.runCommandAsync(
                `tellraw @s {"rawtext":[{"text":"§9Mana: ${remaining}"}]}`
              );
              // record request
              teleportRequests[target.name] ??= [];
              teleportRequests[target.name].push(player.name);
              // notify the target
              target.runCommandAsync(
                `tellraw @s {"rawtext":[{"text":"§a${player.name} has requested to teleport to you."}]}`
              );
            } else {
              requestToTeleportMenu(player);
            }
          });
      }
    });
  }
  
  /**
   * Step 2: view & accept incoming requests.
   */
  function viewTeleportRequests(player, coords) {
    const queue = teleportRequests[player.name] || [];
    if (queue.length === 0) {
      player.runCommandAsync(
        `tellraw @s {"rawtext":[{"text":"§cNo teleport requests."}]}`
      );
      return playerToPlayerMenu(player);
    }
  
    const form = new ActionFormData()
      .title("Teleport Requests")
      .body("Who do you accept?")
      .button("↩ Back");
  
    queue.forEach(reqName => form.button(reqName));
    form.button("§l§cExit");
  
    form.show(player).then(res => {
      if (res.canceled) return;
      const idx = res.selection - 1;
      if (idx === -1) {
        return playerToPlayerMenu(player, coords);
      } else if (idx < queue.length) {
        const requesterName = queue[idx];
        new MessageFormData()
          .title("Confirm Accept")
          .body(`Allow ${requesterName} to teleport to you?`)
          .button1("Yes")
          .button2("Back")
          .show(player)
          .then(choice => {
            if (choice.selection === 0) {
              const requester = world.getPlayers().find(p => p.name === requesterName);
              if (!requester) {
                player.runCommandAsync(
                  `tellraw @s {"rawtext":[{"text":"§c${requesterName} is offline."}]}`
                );
                return viewTeleportRequests(player);
              }
              // charge their mana now
              const manaObj = world.scoreboard.getObjective("mana");
              const current = manaObj?.getScore(requester) || 0;
              if (current < 10) {
                return player.runCommandAsync(
                  `tellraw @s {"rawtext":[{"text":"§c${requesterName} lacks mana."}]}`
                );
              }
              const remaining = current - 10;
              manaObj.setScore(requester, remaining);
              requester.runCommandAsync(
                `tellraw @s {"rawtext":[{"text":"§9Mana: ${remaining}"}]}`
              );
              // run the P2P warp sequence:
              // spawn near requester, then teleport both to this player
              const targetCoords = 
                `${Math.floor(player.location.x)},` +
                `${Math.floor(player.location.y)},` +
                `${Math.floor(player.location.z)}`;
              handleP2PSequence(requester, targetCoords);
  
              // remove the fulfilled request
              queue.splice(idx, 1);
            } else {
              viewTeleportRequests(player);
            }
          });
      }
    });
  }
  
  /**
   * Very similar to handleWarpSequence, but:
   *  • spawn near the request–player,
   *  • final TP goes to the accepting player
   */
  function handleP2PSequence(requester, coords) {
    const [tx, ty, tz] = coords.split(",").map(Number);
    const dimension    = world.getDimension(requester.dimension.id);
  
    // spawn near requester
    const p = requester.location;
    const spawnPos = findGroundPosition(
      dimension,
      Math.floor(p.x),
      Math.floor(p.y),
      Math.floor(p.z),
      2
    );
    if (!spawnPos) {
      return requester.runCommandAsync(
        `tellraw @s {"rawtext":[{"text":"§cNo safe spot found."}]}`
      );
    }
  
    const warpalter = dimension.spawnEntity("zombie:warpalter", spawnPos);
    warpalter.triggerEvent("variant_1");
  
    // wait for requester to walk in
    let arrived = false;
    system.runInterval(() => {
      if (arrived) return;
      const w = warpalter.location;
      const d = Math.hypot(
        requester.location.x - w.x,
        requester.location.y - w.y,
        requester.location.z - w.z
      );
      if (d <= 1.2) {
        arrived = true;
        warpalter.triggerEvent("variant_2");
        // after 2s, teleport both to the acceptor
        system.runTimeout(() => {
          requester.runCommandAsync(`tp @s ${tx} ${ty} ${tz}`);
          warpalter.runCommandAsync(`tp @s ${tx} ${ty} ${tz}`);
          warpalter.triggerEvent("variant_3");
          // after 2 more seconds, despawn
          system.runTimeout(() => warpalter.triggerEvent("despawn"), 40);
        }, 40);
      }
    }, 10);
  }