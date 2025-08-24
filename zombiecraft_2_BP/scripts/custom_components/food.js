import { Effect, system, world } from "@minecraft/server";

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



export class Joint {
  onConsume(event) {
    const player = event.source;
    if (!player) return;

    // 30s of levitation
    player.addEffect("minecraft:levitation", 100, { amplifier: 0, showParticles: true });
    player.addEffect("minecraft:slow_falling", 200, { amplifier: 0, showParticles: true });
    // After 30s, give 30s of slow falling (30s = 600 ticks)
   
  }
}
