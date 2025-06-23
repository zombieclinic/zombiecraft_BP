import {ItemStack,Player,system,} from "@minecraft/server";

/////////////////////////customfishingrod//////////////
export class CustomFishingRod {
  onUse(event) {
    const player = event.source;
    const item   = event.itemStack;
    if (!(player instanceof Player) || !item) return;

    const inv = player.getComponent("minecraft:inventory");
    if (!inv) return;

    const slotIndex = player.selectedSlotIndex;

    // If normal rod → swap & fire hook
    if (item.typeId === "zombie:choas_fishing_rod") {
      const castedRod = new ItemStack("zombie:choas_fishing_rod_casted", 1);
      inv.container.setItem(slotIndex, castedRod);

      // Pick random distance 3–7
      const minDist = 3, maxDist = 7;
      const distance = minDist + Math.random() * (maxDist - minDist);

      // Compute look‐vector
      let lookVec = null;
      if (typeof player.getViewDirection === "function") {
        lookVec = player.getViewDirection();
      } else {
        const rot = player.rotation;
        if (rot && typeof rot.x === "number" && typeof rot.y === "number") {
          const pitch = (rot.x * Math.PI) / 180;
          const yaw   = (rot.y * Math.PI) / 180;
          lookVec = {
            x: -Math.sin(yaw) * Math.cos(pitch),
            y: -Math.sin(pitch),
            z:  Math.cos(yaw) * Math.cos(pitch),
          };
        }
      }
      if (!lookVec) {
        console.warn("CustomFishingRod: No look direction.");
        return;
      }

      // Spawn position at eye level + 1.5 blocks forward
      const eyePos = {
        x: player.location.x,
        y: player.location.y + 1.62,
        z: player.location.z,
      };
      const spawnPos = {
        x: eyePos.x + lookVec.x * 1.5,
        y: eyePos.y + lookVec.y * 1.5,
        z: eyePos.z + lookVec.z * 1.5,
      };

      // Spawn & assign velocity
      const dim = player.dimension;
      const hook = dim.spawnEntity("zombie:fishing_hook", spawnPos);
      if (!hook) return;

      const moveComp = hook.getComponent("minecraft:movement");
      if (moveComp) {
        const speed = 1.2; // blocks/tick
        moveComp.velocity = {
          x: lookVec.x * speed,
          y: lookVec.y * speed,
          z: lookVec.z * speed
        };

        // Kill the hook after ticks = distance/speed
        const ticksToLive = Math.ceil(distance / speed);
        system.runTimeout(() => {
          if (hook.isValid) {
            hook.triggerEvent("despawn");
          }
        }, ticksToLive);
      }
    }

    // If casted rod → swap back
    else if (item.typeId === "zombie:choas_fishing_rod_casted") {
      const normalRod = new ItemStack("zombie:choas_fishing_rod", 1);
      inv.container.setItem(slotIndex, normalRod);
    }
  }
}

