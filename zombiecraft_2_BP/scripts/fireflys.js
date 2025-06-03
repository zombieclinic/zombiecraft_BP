import { world, system } from "@minecraft/server";


export class Fireflys {
    tickCounter = 0;
    lightStateCounter = 0;
    isLightOn = true;

    onTick = (event) => {
        const { block, dimension } = event;

        // Get block location and current permutation
        const blockPos = block.location;
        const currentBlock = dimension.getBlock(blockPos);
        const currentPermutation = currentBlock.permutation;

        // Toggle zombie:firefly_block state (block animation toggle)
        const currentBlockState = currentPermutation.getState("zombie:firefly_block");
        const newBlockState = currentBlockState === 2 ? 0 : currentBlockState + 1;
        currentBlock.setPermutation(
            currentPermutation.withState("zombie:firefly_block", newBlockState)
        );

        // Handle zombie:firefly_light state (light flicker and particles)
        const currentLightState = currentPermutation.getState("zombie:firefly_light");

        // Start light on if in state 0
        if (currentLightState === 0) {
            currentBlock.setPermutation(
                currentPermutation.withState("zombie:firefly_light", 1)
            );
        }

        // 5% chance to flicker light off for 1 tick
        if (Math.random() < 0.05 && currentLightState === 1) {
            currentBlock.setPermutation(
                currentPermutation.withState("zombie:firefly_light", 0)
            );

            system.runTimeout(() => {
                currentBlock.setPermutation(
                    currentPermutation.withState("zombie:firefly_light", 2)
                );
            }, 1);
        }

        // Particle spawn logic using tick counter
        this.tickCounter++;
        if (this.tickCounter >= 20 && currentLightState === 1) { // Adjust tick count for frequency
            this.spawnParticle(dimension, currentPermutation, blockPos);
            this.tickCounter = 0; // Reset counter
        }
    }

    spawnParticle(dimension, currentPermutation, blockPos) {
        const blockFace = currentPermutation.getState("minecraft:block_face");
        const particleType = "yyfool:jarred_firefly";
        let particlePos = { x: blockPos.x + 0.5, y: blockPos.y + 0.5, z: blockPos.z + 0.5 };

        switch (blockFace) {
            case "down": particlePos.y += 0.5; break;
            case "up": particlePos.y -= 0.3; break;
            case "north": particlePos.z += 0.35; break;
            case "south": particlePos.z -= 0.35; break;
            case "west": particlePos.x += 0.35; break;
            case "east": particlePos.x -= 0.35; break;
        }

        dimension.spawnParticle(particleType, particlePos);
    }
}

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
