// chaos.js — Chaos Book System with Upgrade System and Class XP Investment
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { world, system } from "@minecraft/server";

export class ChaosBookComponent {
  onUse(event) {
    const { source: player } = event;
    player.setProperty("zombie:item_state", 1);

    const playerClass = player.getProperty("zombie:class");
    if (playerClass === "chaos") {
      showChaosBook(player);
    } else {
      temptToJoinChaos(player);
    }
  }
}

function openChaosStats(player) {
  const essence    = Math.floor(player.getProperty("zombie:essence") ?? 0);
  const vAttack    = player.getProperty("zombie:v_attack")       ?? 0;
  const altVAttack = player.getProperty("zombie:alt_v_attack")   ?? 0;
  const sight      = player.getProperty("zombie:sight_level")    ?? 0;

  // Use sneak_ability_level for Berserker's Rage, else alt_ability_level
  const subclass    = player.getProperty("zombie:subclass");
  const isBerserker = subclass === "berserker";
  const rageKey     = isBerserker ? "zombie:sneak_ability_level" : "zombie:alt_ability_level";
  const rage        = player.getProperty(rageKey) ?? 1;

  new ModalFormData()
    .title(`§0Available Chaos XP: §6${essence}`)
    .textField(
      `§cSight Skill [Lv. ${sight}${sight < 10 ? "" : " - Max"}]\n` +
      `§7Reveals mob health and type on hit.`,
      "0"
    )
    .textField(
      `§cRage Skill [Lv. ${rage}${rage < 20 ? "" : " - Max"}]\n` +
      `§7Grants strength temporarily.`,
      "0"
    )
    .textField(
      `§cSword Skill [Lv. ${vAttack}${vAttack < 20 ? "" : " - Max"}]\n` +
      `§7Boosts Sword damage.`,
      "0"
    )
    .textField(
      `§cAxe Skill [Lv. ${altVAttack}${altVAttack < 20 ? "" : " - Max"}]\n` +
      `§7Boosts Axe damage.`,
      "0"
    )
    .submitButton("Submit Upgrades")
    .show(player)
    .then(response => {
      if (response.canceled) {
        player.setProperty("zombie:item_state", 0);
        return;
      }

      const entries = response.formValues.map(v => {
        const t = v.trim();
        const n = parseInt(t, 10);
        return t === "" || isNaN(n) ? 0 : n;
      });

      if (entries.some(n => n < 0)) {
        player.sendMessage("§cInvalid XP input.");
        return;
      }

      const totalSpent = entries.reduce((sum, v) => sum + v, 0);
      if (totalSpent > essence) {
        player.sendMessage("§cNot enough Chaos XP.");
        return;
      }

      // Apply changes
      player.setProperty("zombie:essence", essence - totalSpent);
      player.setProperty("zombie:sight_level",     Math.min(sight      + entries[0], 10));
      player.setProperty(rageKey,                  Math.min(rage       + entries[1], 20));
      player.setProperty("zombie:v_attack",        Math.min(vAttack    + entries[2], 20));
      player.setProperty("zombie:alt_v_attack",    Math.min(altVAttack + entries[3], 20));

      system.runTimeout(() => showStatConfirmation(player), 1);
    });
}

function showStatConfirmation(player) {
  const essence    = Math.floor(player.getProperty("zombie:essence") ?? 0);
  const vAttack    = player.getProperty("zombie:v_attack")       ?? 0;
  const altVAttack = player.getProperty("zombie:alt_v_attack")   ?? 0;
  const sight      = player.getProperty("zombie:sight_level")    ?? 0;

  const subclass    = player.getProperty("zombie:subclass");
  const isBerserker = subclass === "berserker";
  const rageKey     = isBerserker ? "zombie:sneak_ability_level" : "zombie:alt_ability_level";
  const rage        = player.getProperty(rageKey) ?? 1;

  const body = `
§7Your new stats are:

§cSight Skill§7: ${sight}
§cRage Skill§7: ${rage}
§cSword Skill§7: ${vAttack}
§cAxe Skill§7: ${altVAttack}
§eRemaining Chaos XP§7: ${essence}
  `.trim();

  new ActionFormData()
    .title("§aUpgrade Summary")
    .body(body)
    .button("↩ Back to Stats")
    .button("❌ Exit Book")
    .show(player)
    .then(response => {
      if (response.selection === 0) {
        openChaosStats(player);
      } else {
        player.setProperty("zombie:item_state", 0);
      }
    });
}

function showChaosBook(player) {
  const playerClass = player.getProperty("zombie:class");
  const subclass    = player.getProperty("zombie:subclass");
  const chaosXp     = player.getProperty("zombie:essence");

  const lore = `
§6Liber Chaotica§r
§7Class: §c${playerClass}§r
§7Subclass: §c${subclass}§r
§7Chaos XP: §6${chaosXp}§r

§c"Power is the currency of kings, and only the ruthless may claim its throne."§f
This unholy grimoire murmurs promises of dominion through blood and fear.
  `.trim();

  new ActionFormData()
    .title("Liber Chaotica")
    .body(lore)
    .button("Stats / Upgrades")
    .button("Switch Class")
    .button("Remove Class")
    .button("Exit")
    .show(player)
    .then(response => {
      if (response.selection === undefined || response.selection === 3) {
        player.setProperty("zombie:item_state", 0);
        return;
      }
      switch (response.selection) {
        case 0: openChaosStats(player); break;
        case 1: chooseChaosSubclass(player); break;
        case 2:
          // Reset class & stats
          player.setProperty("zombie:class", "none");
          player.setProperty("zombie:subclass", "none");
          [
            "essence",
            "v_attack",
            "alt_v_attack",
            "alt_ability_level",
            "sneak_ability_level",
            "jump_ability_level",
            "mana_ability_level",
            "sight_level",
            "summon_timer"
          ].forEach(key => player.setProperty(`zombie:${key}`, 0));
          player.setProperty("zombie:item_state", 0);
          player.sendMessage("§7All Chaos stats have been reset to 0 for testing.");
          break;
      }
    });
}

function temptToJoinChaos(player) {
  const temptText = `
§4The Liber Chaotica whispers to you...§r
§cPower awaits those bold enough to abandon their gods or code.
§eJoin the ranks of Chaos, and let your enemies fall before your might.
  `.trim();

  new ActionFormData()
    .title("Temptation of Chaos")
    .body(temptText)
    .button("Embrace Chaos")
    .button("Remain Loyal")
    .show(player)
    .then(response => {
      if (response.selection === 0) {
        savePlayerOldStats(player);
        player.setProperty("zombie:class", "chaos");
        chooseChaosSubclass(player);
      } else {
        player.sendMessage("§7You resist the lure… for now.");
        player.setProperty("zombie:item_state", 0);
      }
    });
}

function savePlayerOldStats(player) {
  const stats = [
    player.name,
    player.getProperty("zombie:class"),
    player.getProperty("zombie:subclass"),
    player.getProperty("zombie:essence"),
    player.getProperty("zombie:v_attack"),
    player.getProperty("zombie:alt_v_attack"),
    player.getProperty("zombie:alt_ability_level"),
    player.getProperty("zombie:sneak_ability_level"),
    player.getProperty("zombie:jump_ability_level"),
    player.getProperty("zombie:mana_ability_level"),
    player.getProperty("zombie:sight_level"),
    player.getProperty("zombie:summon_timer")
  ];
  const key = `${player.name}_stats`;
  world.scoreboard.getObjective("player_stats")?.setScore(key, 0);
}

function chooseChaosSubclass(player) {
  new ActionFormData()
    .title("§cChoose Your Chaos Path")
    .body(`§cSelect your subclass:

§4Berserker§f: Raw rage, excels with Sword/Axe/Hammer.
§5Necromancer§f: Raise the dead using a Scythe.
§6Chaos Mage§f: Wield forbidden magic with a Staff or Keyblade.
§8Juggernaut§f: Tank with Shield and Hammer.
§7Doom Assassin§f: Stealth kills with bow.
§2Cultist§f: Grows chaos biome, tool-based.
§cBlood Reaver§f: Spear/fishing rod bleed specialist.`)
    .button("Berserker")
    .button("Necromancer")
    .button("Chaos Mage")
    .button("Juggernaut")
    .button("Doom Assassin")
    .button("Cultist")
    .button("Blood Reaver")
    .show(player)
    .then(response => {
      if (response.selection === undefined) return;
      const subclasses = [
        "berserker","necromancer","chaos_mage",
        "juggernaut","doom_assassin","cultist","blood_reaver"
      ];
      confirmChaosSubclass(player, subclasses[response.selection]);
    });
}

function confirmChaosSubclass(player, subclass) {
  new ActionFormData()
    .title("§cConfirm Subclass")
    .body(`Are you sure you want to become a §4${subclass.replace("_"," ")}§r?\nThis cannot be undone.`)
    .button("Yes, embrace it")
    .button("Go back")
    .show(player)
    .then(response => {
      if (response.selection === 0) {
        player.setProperty("zombie:subclass", subclass);
        showChaosBook(player);
      } else {
        chooseChaosSubclass(player);
      }
    });
}
