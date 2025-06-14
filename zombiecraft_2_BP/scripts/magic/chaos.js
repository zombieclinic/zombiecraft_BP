// Chaos Book System
// This module checks if the player is Chaos class. If not, it tempts them to join Chaos, saves their stats, and converts them.
// Once they join, it prompts for a subclass and finally opens the main Chaos book menu.

import { ActionFormData } from "@minecraft/server-ui";
import { world } from "@minecraft/server";

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

function temptToJoinChaos(player) {
  const temptText = `
§4The Liber Chaotica whispers to you…§r
§cPower awaits those bold enough to abandon their gods or code.
§eJoin the ranks of Chaos, and let your enemies fall before your might.§r
  `;

  const form = new ActionFormData()
    .title("Temptation of Chaos")
    .body(temptText.trim())
    .button("Embrace Chaos")
    .button("Remain Loyal");

  form.show(player).then((response) => {
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
    player.getProperty("zombie:class"),
    player.getProperty("zombie:subclass"),
    player.getProperty("zombie:alt_ability_level"),
    player.getProperty("zombie:sneak_ability_level"),
    player.getProperty("zombie:jump_ability_level"),
    player.getProperty("zombie:mana_ability_level"),
    player.getProperty("zombie:sight_level"),
    player.getProperty("zombie:summon_timer")
  ];
  const key = `${player.name}_stats`;
  const value = stats.join("¦");

  world.scoreboard.getObjective("player_stats")?.setScore(player.name, 0); // Optional: to initialize
  world.scoreboard.getObjective("player_stats")?.setScore(key, value);
}

function chooseChaosSubclass(player) {
  const form = new ActionFormData()
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
    .button("Blood Reaver");

  form.show(player).then((response) => {
    if (response.selection === undefined) return;

    const subclasses = [
      "berserker",
      "necromancer",
      "chaos_mage",
      "juggernaut",
      "doom_assassin",
      "cultist",
      "blood_reaver"
    ];

    const selectedSubclass = subclasses[response.selection];
    confirmChaosSubclass(player, selectedSubclass);
  });
}

function confirmChaosSubclass(player, subclass) {
  const confirmForm = new ActionFormData()
    .title("§cConfirm Subclass")
    .body(`Are you sure you want to become a §4${subclass.replace("_", " ")}§r?\nThis cannot be undone.`)
    .button("Yes, embrace it")
    .button("Go back");

  confirmForm.show(player).then((response) => {
    if (response.selection === 0) {
      player.setProperty("zombie:subclass", subclass);
      showChaosBook(player);
    } else {
      chooseChaosSubclass(player);
    }
  });
}

function showChaosBook(player) {
  const playerClass = player.getProperty("zombie:class");
  const subclass = player.getProperty("zombie:subclass");
  const chaosXp = player.getProperty("zombie:essence");

  const lore = `
§6Liber Chaotica§r
§7Class: §c${playerClass}§r
§7Subclass: §c${subclass}§r\n§7Chaos XP: §6${chaosXp}§r\n
§c"Power is the currency of kings, and only the ruthless may claim its throne."§f
This unholy grimoire murmurs promises of dominion through blood and fear.
§bEmbrace cruelty as your greatest weapon, sacrifice worlds, shatter alliances,
and let every conquest feed your insatiable ambition.
§eWith each soul you rend, your strength shall surge, until even gods tremble at your name.`;

  const form = new ActionFormData()
    .title("Liber Chaotica")
    .body(lore.trim())
    .button("Upgrades")
    .button("Active Skills")
    .button("Remove Class")
    .button("Exit");

  form.show(player).then((response) => {
    if (response.selection === undefined || response.selection === 3) {
      player.setProperty("zombie:item_state", 0);
      return;
    }

    switch (response.selection) {
      case 0:
        chaosUpgrades(player);
        break;
      case 1:
        player.sendMessage("Opening Active Skills…");
        break;
      case 2:
        player.setProperty("zombie:class", "none");
        player.setProperty("zombie:subclass", "none");
        player.sendMessage("§7Your class has been reset.");
        player.setProperty("zombie:item_state", 0);
        break;
    }
  });
}

function chaosUpgrades(player) {
  const form = new ActionFormData()
    .title("Chaos Upgrades")
    .body("§cFeature coming soon…")
    .button("Back");

  form.show(player).then(() => showChaosBook(player));
}
