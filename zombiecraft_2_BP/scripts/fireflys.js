import { world, system } from "@minecraft/server";


//////////////////////////flicker///////////////////////////
export class FireflyFlicker {
    onUse(event) {
      const { itemStack, source: player } = event;
      if (!player?.isValid() || !itemStack) return;
  
      // Determine light level from jar type
      let lightLevel;
      switch (itemStack.typeId) {
        case 'zombie:firefly_jar_1': lightLevel = 7; break;
        case 'zombie:firefly_jar_2': lightLevel = 9; break;
        case 'zombie:firefly_jar_3': lightLevel = 11; break;
        case 'zombie:firefly_jar_4': lightLevel = 13; break;
        case 'zombie:firefly_jar_5': lightLevel = 15; break;
        default: return;
      }
  
      const durationInTicks = 40; // 2 seconds
      const overworld = world.getDimension('overworld');
  
      // X/Z are floored; Y is ceiled so we always target the block *above*
      const pos = {
        x: Math.floor(player.location.x),
        y: Math.ceil(player.location.y),
        z: Math.floor(player.location.z)
      };
  
      // Only place if there's air, and only clear if it's our light
      const placeLight = () => {
        overworld.runCommandAsync(
          `execute if block ${pos.x} ${pos.y} ${pos.z} air ` +
          `run setblock ${pos.x} ${pos.y} ${pos.z} light_block_${lightLevel}`
        );
      };
      const clearLight = () => {
        overworld.runCommandAsync(
          `execute if block ${pos.x} ${pos.y} ${pos.z} light_block_${lightLevel} ` +
          `run setblock ${pos.x} ${pos.y} ${pos.z} air`
        );
      };
  
      // Initial placement
      placeLight();
  
      // Track movement
      const intervalId = system.runInterval(() => {
        if (!player.isValid()) {
          system.clearRun(intervalId);
          clearLight();
          return;
        }
        const newX = Math.floor(player.location.x);
        const newY = Math.ceil(player.location.y);
        const newZ = Math.floor(player.location.z);
        if (newX !== pos.x || newY !== pos.y || newZ !== pos.z) {
          clearLight();
          pos.x = newX; pos.y = newY; pos.z = newZ;
          placeLight();
        }
      }, 1);
  
      // Cleanup after duration
      system.runTimeout(() => {
        system.clearRun(intervalId);
        clearLight();
      }, durationInTicks);
    }
  }
  





// Firefly2 class for managing a light cycle on an entity
export class Firefly2 {
    lightOnDuration = 48;
    lightOffDuration = 50;
    sourceEntity;

    constructor(sourceEntity) {
        this.sourceEntity = sourceEntity;
        this.triggerLightEvent(false);
        this.startLightCycle();
    }

    triggerLightEvent(isLightOn) {
        if (this.sourceEntity && this.sourceEntity.isValid()) {
            try {
                this.sourceEntity.triggerEvent(isLightOn ? "varent_0" : "varent_1");
            } catch (error) {
                console.error(`Error triggering ${isLightOn ? "varent_0" : "varent_1"} on entity:`, error);
            }
        }
    }

    startLightCycle() {
        if (!this.sourceEntity || !this.sourceEntity.isValid()) {
            return;
        }

        this.triggerLightEvent(true);
        system.runTimeout(() => {
            if (this.sourceEntity && this.sourceEntity.isValid()) {
                this.triggerLightEvent(false);
                system.runTimeout(() => this.startLightCycle(), this.lightOffDuration);
            }
        }, this.lightOnDuration);
    }
}
