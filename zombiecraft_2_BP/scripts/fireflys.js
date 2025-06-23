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
  




export class Firefly2 {
    // Duration in ticks (20 ticks = 1 second)
    lightOnDuration = 48; // 2.4 seconds
    lightOffDuration = 50; // 2.5 seconds

    sourceEntity;

    // Private fields to manage the firefly's internal state.
    // The '#' syntax is standard modern JavaScript.
    #isLightOn = false;
    #timeoutId;

    constructor(sourceEntity) {
        this.sourceEntity = sourceEntity;
        this.startLightCycle();
    }

    _triggerLightEvent(isLightOn) {
        // If the entity is removed or becomes invalid, stop the cycle.
        if (!this.sourceEntity || !this.sourceEntity.isValid) {
            this.stopLightCycle();
            return;
        }
        try {
            // These event names MUST match the events in your entity's behavior .json file.
            const eventToTrigger = isLightOn ? "firefly_on" : "firefly_off";
            this.sourceEntity.triggerEvent(eventToTrigger);
        } catch (error) {
            console.error(`Error triggering event on entity: ${error}`);
        }
    }

    startLightCycle() {
        // Toggle the light state for the next cycle.
        this.#isLightOn = !this.#isLightOn;
        this._triggerLightEvent(this.#isLightOn);

        // Determine the delay until the next state change.
        const nextDelay = this.#isLightOn ? this.lightOnDuration : this.lightOffDuration;

        // Schedule the next run.
        this.#timeoutId = system.runTimeout(() => {
            this.startLightCycle();
        }, nextDelay);
    }

    stopLightCycle() {
        if (this.#timeoutId !== undefined) {
            system.clearRun(this.#timeoutId);
            this.#timeoutId = undefined;
        }
    }
} 
