import { system, world } from "@minecraft/server";

export class DayDream {
  onConsume(event) {
    const { source: player } = event;

    // Set game rule so only 1 player is needed to sleep
    world.getDimension("overworld").runCommand("gamerule playersSleepingPercentage 1");
    player.sendMessage("§eThe world feels sleepy... One player can now rest.");

    // After 60 seconds (1200 ticks), reset the gamerule
    system.runTimeout(() => {
      world.getDimension("overworld").runCommand("gamerule playersSleepingPercentage 100");
      player.sendMessage("§7Sleep requirement restored. All must now rest again.");
    }, 1200);
  }
}
