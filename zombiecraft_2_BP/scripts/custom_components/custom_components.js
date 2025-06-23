
import {EntityComponentTypes,ItemStack, EquipmentSlot, Player, GameMode, ItemComponentTypes, system, world, BlockPermutation} from "@minecraft/server";

export class BrownbearChanceEffect {
    constructor() { }

    async onHitEntity(arg) {
        const { attackingEntity } = arg;

        // Attempt to get the Equippable component
        const equippable = attackingEntity.getComponent(EntityComponentTypes.Equippable);
        let setcheckbear = 0;

        // Check if the Equippable component is available
        if (!equippable) return;

        // Helper function to check specific equipment slot for a specific item
        async function hasEquippedItem(itemName, slot) {
            const item = equippable.getEquipment(slot);
            return item && item.typeId === itemName;
        }

        // Check each armor slot using hasEquippedItem
        if (await hasEquippedItem("zombie:brown_netherite_bear_helmet", EquipmentSlot.Head)) setcheckbear++;
        if (await hasEquippedItem("zombie:brown_netherite_bear_chestplate", EquipmentSlot.Chest)) setcheckbear++;
        if (await hasEquippedItem("zombie:brown_netherite_bear_leggings", EquipmentSlot.Legs)) setcheckbear++;
        if (await hasEquippedItem("zombie:brown_netherite_bear_boots", EquipmentSlot.Feet)) setcheckbear++;
        if (await hasEquippedItem("zombie:brown_bear_helmet", EquipmentSlot.Head)) setcheckbear++;
        if (await hasEquippedItem("zombie:brown_bear_chestplate", EquipmentSlot.Chest)) setcheckbear++;
        if (await hasEquippedItem("zombie:brown_bear_leggings", EquipmentSlot.Legs)) setcheckbear++;
        if (await hasEquippedItem("zombie:brown_bear_boots", EquipmentSlot.Feet)) setcheckbear++;

        if (await hasEquippedItem("zombie:black_netherite_bear_helmet", EquipmentSlot.Head)) setcheckbear++;
        if (await hasEquippedItem("zombie:black_netherite_bear_chestplate", EquipmentSlot.Chest)) setcheckbear++;
        if (await hasEquippedItem("zombie:black_netherite_bear_leggings", EquipmentSlot.Legs)) setcheckbear++;
        if (await hasEquippedItem("zombie:black_netherite_bear_boots", EquipmentSlot.Feet)) setcheckbear++;
        if (await hasEquippedItem("zombie:black_bear_helmet", EquipmentSlot.Head)) setcheckbear++;
        if (await hasEquippedItem("zombie:black_bear_chestplate", EquipmentSlot.Chest)) setcheckbear++;
        if (await hasEquippedItem("zombie:black_bear_leggings", EquipmentSlot.Legs)) setcheckbear++;
        if (await hasEquippedItem("zombie:black_bear_boots", EquipmentSlot.Feet)) setcheckbear++;

        // Check the main hand slot for claws
        const inventory = attackingEntity.getComponent("minecraft:inventory");
        if (inventory) {
            const itemInHand = inventory.container.getItem(attackingEntity.selectedSlotIndex);
            if (itemInHand && itemInHand.typeId === "zombie:brown_bear_claws") {
                setcheckbear++;
            }
        }

        // Calculate the chance based on the number of items detected
        let chance = 0;
        switch (setcheckbear) {
            case 1:
                chance = 0.01;  // 5% chance
                break;
            case 2:
                chance = 0.3;   // 10% chance
                break;
            case 3:
                chance = 0.1;  // 15% chance
                break;
            case 4:
                chance = 0.12;   // 20% chance
                break;
            case 5:
                chance = 0.15;  // 25% chance
                break;
            default:
                chance = 0;
                break;
        }

        // Apply the effect based on the calculated chance
        if (Math.random() < chance) {
            attackingEntity.addEffect("minecraft:strength", 40, {
                amplifier: setcheckbear - 1,
                showParticles: false
            });
        }
    }
}


export class OnHitDamage {
    onHitEntity(event) {
        const { attackingEntity } = event;

        if (!(attackingEntity instanceof Player)) return;

        // Check if the player is in survival mode
        if (!attackingEntity.matches({ gameMode: GameMode['survival'] })) return;

        const inventory = attackingEntity.getComponent("minecraft:inventory");
        const itemInHand = inventory.container.getItem(attackingEntity.selectedSlotIndex);

        if (!itemInHand) return;

        // Apply durability logic for attacking
        adjustItemDamage(attackingEntity, itemInHand, Math.floor(Math.random() * 5) + 1);
    }
    
    onUse(event) {
        const player    = event.source;
        const itemStack = event.itemStack;
        if (!(player instanceof Player)) return;
        if (!player.matches({ gameMode: GameMode.survival })) return;
        if (!itemStack.hasComponent("minecraft:durability")) return;
    
        // Unbreaking check
        let unbreakingLevel = 0;
        const enchComp = itemStack.getComponent(ItemComponentTypes.Enchantable);
        if (enchComp) {
          const ench = enchComp
            .getEnchantments()
            .find(e => e.type.id === "unbreaking");
          if (ench) unbreakingLevel = ench.level;
        }
    
        const damageChance = 1 / (unbreakingLevel + 1);
        if (Math.random() <= damageChance) {
          const damageToAdd = Math.floor(Math.random() * 5) + 1;
          adjustItemDamage(player, itemStack, damageToAdd);
        }
      }

    onMineBlock(event) {
        const { source: player, itemStack, block } = event;

        // Ensure the entity mining the block is a player and the itemStack exists
        if (!(player instanceof Player) || !itemStack || !block) return;

        // Check if the item has durability
        if (!itemStack.hasComponent("minecraft:durability")) return;

        const durability = itemStack.getComponent("minecraft:durability");
        let unbreakingLevel = 0;

        // Check for Enchantable component
        const enchantable = itemStack.getComponent(ItemComponentTypes.Enchantable);
        if (enchantable) {
            const enchantments = enchantable.getEnchantments();
            const unbreakingEnchantment = enchantments.find(enchantment => enchantment.type.id === "unbreaking");

            // Get Unbreaking level (0 if not present)
            if (unbreakingEnchantment) {
                unbreakingLevel = unbreakingEnchantment.level;
            }
        }

        // Calculate chance to apply durability damage based on Unbreaking level
        const damageChance = 1 / (unbreakingLevel + 1); // Higher Unbreaking level means lower chance of damage

        // Apply durability damage with a random chance
        if (Math.random() <= damageChance) {
            // Apply durability damage
            adjustItemDamage(player, itemStack, Math.floor(Math.random() * 5) + 1);
        }
    }
}

function adjustItemDamage(player, itemStack, damageToAdd) {
    const durabilityComp = itemStack.getComponent('minecraft:durability');
    if (!durabilityComp) return;

    const playerEquip = player.getComponent('equippable');

    if (durabilityComp.damage === durabilityComp.maxDurability && playerEquip) {
        playerEquip.setEquipment(EquipmentSlot.Mainhand, undefined);

        // Play break sound effect when tool is broken
        player.playSound('random.break', {
            pitch: 0.9,
            volume: 1.0
        });
    } else {
        durabilityComp.damage = Math.min(
            durabilityComp.damage + damageToAdd,
            durabilityComp.maxDurability
        );

        if (durabilityComp.damage === durabilityComp.maxDurability) {
            playerEquip?.setEquipment(EquipmentSlot.Mainhand, undefined);

            // Play break sound effect when tool is broken
            player.playSound('random.break', {
                pitch: 0.9,
                volume: 1.0
            });
        } else {
            playerEquip?.setEquipment(EquipmentSlot.Mainhand, itemStack);
        }
    }
}


export class Openbox {
  constructor() {
    this.onPlayerInteract = this.onPlayerInteract.bind(this);

    // Block to effect mappings
    this.blockEffects = {
      // New choas chest block
      "zombie:choas_chest": {
        particle: "zombie:choas_cross",
        sound: "zombie.walker.scream",
      },

      // Original present blocks with santa particle and present sound
      "zombie:lucky_present": {
        particle: "zombie:santa_particle",
        sound: "present",
      },
      "zombie:blue_present": {
        particle: "zombie:santa_particle",
        sound: "present",
      },
      "zombie:green_present": {
        particle: "zombie:santa_particle",
        sound: "present",
      },
      "zombie:pink_present": {
        particle: "zombie:santa_particle",
        sound: "present",
      },
      "zombie:purple_present": {
        particle: "zombie:santa_particle",
        sound: "present",
      },
      "zombie:red_present": {
        particle: "zombie:santa_particle",
        sound: "present",
      },
    };
  }

  async onPlayerInteract(event) {
    const player = event.player;
    const block = event.block;
    const dimension = event.dimension;

    if (!block || !dimension) return;

    const blockPos = block.location;
    const currentBlock = dimension.getBlock(blockPos);
    if (!currentBlock) return;

    const currentPermutation = currentBlock.permutation;
    if (!currentPermutation) return;

    const currentBlockState = currentPermutation.getState("zombie:open");
    const newBlockState = currentBlockState === 1 ? 0 : 1;

    const newPermutation = currentPermutation.withState("zombie:open", newBlockState);
    currentBlock.setPermutation(newPermutation);

    if (newBlockState === 1) {
      const blockId = currentBlock.typeId;
      const effects = this.blockEffects[blockId] || {};

      // Fire particle effect if available
      if (effects.particle) {
        this.fireParticleEffect(dimension, blockPos, effects.particle);
      }

      // Play sound if available
      if (effects.sound) {
        try {
          // Special case for present sound (named "present") to run the specific command string
          if (effects.sound === "present") {
            await player.runCommand(`playsound present @a[r=20]`);
          } else {
            await player.runCommand(`playsound ${effects.sound} @a[r=20]`);
          }
        } catch (error) {
          console.error(`Error playing sound: ${error}`);
        }
      }

      this.scheduleBlockReplacement(dimension, blockPos);
    }
  }

  fireParticleEffect(dimension, location, particleName) {
    dimension.runCommand(
      `particle ${particleName} ${location.x} ${location.y} ${location.z}`
    );
  }


    scheduleBlockReplacement(dimension, blockPos) {
        // Wait for 60 ticks (3 seconds)
        system.runTimeout(() => {
            try {
                // Replace the block with air
                dimension.runCommand(`setblock ${blockPos.x} ${blockPos.y} ${blockPos.z} air destroy`);
            } catch (error) {
                console.error(`Error during block replacement: ${error}`);
            }
        }, 60); // 60 ticks delay
    }
}





export class Lights {
    onTick(event) {
        const { block, dimension } = event;

        // Ensure block and dimension are valid
        if (!block || !dimension) return;

        // Get the current block at the specified position
        const blockPos = block.location;
        const currentBlock = dimension.getBlock(blockPos);

        // Validate the block
        if (!currentBlock || currentBlock.typeId === "minecraft:air") return;

        const currentPermutation = currentBlock.permutation;
        const currentState = currentPermutation.getState("zombie:light");

        // Validate that the block has the "zombie:light" state
        if (currentState === undefined) return;

        // Toggle the state between 0 and 1
        const newState = currentState === 0 ? 1 : 0;

        // Update the block state
        currentBlock.setPermutation(
            currentPermutation.withState("zombie:light", newState)
        );

        console.log(
            `Block at (${blockPos.x}, ${blockPos.y}, ${blockPos.z}) toggled from ${currentState} to ${newState}`
        );
    }
}


export class ColorLights {
    onTick(event) {
        const { block, dimension } = event;

        // Ensure block and dimension are valid
        if (!block || !dimension) return;

        // Get the current block at the specified position
        const blockPos = block.location;
        const currentBlock = dimension.getBlock(blockPos);

        // Validate the block
        if (!currentBlock || currentBlock.typeId === "minecraft:air") return;

        const currentPermutation = currentBlock.permutation;
        const currentState = currentPermutation.getState("zombie:light");

        // Validate that the block has the "zombie:light" state
        if (currentState === undefined) return;

        // Cycle through states from 0 to 8
        const newState = (currentState + 1) % 9; // Increment state, reset to 0 after 8

        // Update the block state
        currentBlock.setPermutation(
            currentPermutation.withState("zombie:light", newState)
        );

        console.log(
            `Block at (${blockPos.x}, ${blockPos.y}, ${blockPos.z}) cycled from ${currentState} to ${newState}`
        );
    }
}



export class SantaSword {
    onUse(arg) {
      const player      = arg.source;
      const playerName  = player.name;
      const objectiveId = "mana";
  
      // ── 1) ensure the objective exists ───────────────────────────────
      let obj = world.scoreboard.getObjective(objectiveId);
      if (!obj) {
        // create it if missing
        player.runCommand(
          `scoreboard objectives add ${objectiveId} dummy Mana`
        );
        obj = world.scoreboard.getObjective(objectiveId);
      }
  
      // ── 2) read current mana ────────────────────────────────────────
      const currentMana = obj.getScore(player);
  
      // ── 3) bail out if <10 with red text (no animation/effects) ────
      if (currentMana < 10) {
        player.runCommand(
          `tellraw ${playerName} {"rawtext":[{"text":"§cNot enough mana!"}]}`
        );
        return;
      }
  
      // ── 4) deduct 10 mana & compute new total ───────────────────────
      const newMana = currentMana - 10;
      // you can use “remove” or “set”; here we’ll set to be exact:
      player.runCommand(
        `scoreboard players set ${playerName} ${objectiveId} ${newMana}`
      );
  
      // ── 5) show the new total in blue §9 ────────────────────────────
      player.runCommand(
        `tellraw ${playerName} {"rawtext":[{"text":"§9Your mana: ${newMana}"}]}`
      );
  
      // ── 6) now do your ability ──────────────────────────────────────
      player.playAnimation("animation.santasword_swing_melee.tpp_swing_melee");
      player.runCommand("tag @s add dual");
      player.runCommand(
        "damage @e[r=3,tag=!dual] 15 entity_attack entity @s"
      );
      player.runCommand("effect @e[r=3,tag=!dual] slowness 2 5");
      player.runCommand("playsound game.player.attack.nodamage @s");
      system.runTimeout(() => {
        player.runCommand("tag @s remove dual");
      }, 1);
    }
  }


export class Open2 {
    constructor() {
        // Bind methods to ensure the correct `this` context
        this.onPlayerInteract = this.onPlayerInteract.bind(this);
    }

    onPlayerInteract(event) {
        const player = event.player;
        const block = event.block;
        const dimension = event.dimension;

        if (!block || !dimension) return; // Ensure block and dimension exist

        const blockPos = block.location; // Get block position
        const currentBlock = dimension.getBlock(blockPos);

        if (!currentBlock) return; // Ensure the block exists in the dimension

        // Get the current permutation of the block
        const currentPermutation = currentBlock.permutation;

        if (!currentPermutation) return; // Ensure the block has a permutation

        // Get the current state of the "zombie:open" property
        const currentBlockState = currentPermutation.getState("zombie:open");

        // Toggle the block state between 0 and 1
        const newBlockState = currentBlockState === 1 ? 0 : 1;

        // Create a new permutation with the updated state
        const newPermutation = currentPermutation.withState("zombie:open", newBlockState);

        // Apply the new permutation to the block
        currentBlock.setPermutation(newPermutation);



    }
}


export class Christmas_Cookie {
    onConsume(arg) {
        const player = arg.source;

        // List of possible effects
        const effects = [
            "minecraft:absorption",
            "minecraft:fire_resistance",
            "minecraft:haste",
            "minecraft:health_boost",
            "minecraft:invisibility",
            "minecraft:jump_boost",
            "minecraft:night_vision",
            "minecraft:regeneration",
            "minecraft:resistance",
            "minecraft:saturation",
            "minecraft:strength",
            "minecraft:water_breathing"
        ];

        // Randomly select an effect
        const randomEffect = effects[Math.floor(Math.random() * effects.length)];

        // Apply the randomly chosen effect
        player.addEffect(randomEffect, 500, {
            amplifier: 0,
            showParticles: true
        });
    }
}

export class Candycane {
    onConsume(arg) {
        const player = arg.source;

        player.addEffect("minecraft:speed", 300, {
            amplifier: 0,
            showParticles: true
        })

    }

}

export class RawFood {
    onConsume(event) {
        const player = event.source;

        if (Math.random() <= 0.5) {
            // Apply nausea effect for 60 ticks (3 seconds), amplifier 0 (Level I)
            player.addEffect("minecraft:nausea", 60, {
                amplifier: 0,
                showParticles: true
            });

            // Apply hunger effect for 600 ticks (30 seconds), amplifier 0 (Level I)
            player.addEffect("minecraft:hunger", 600, {
                amplifier: 0,
                showParticles: false
            });

            player.addEffect("minecraft:poison", 120, {
                amplifier: 0,
                showParticles: true
            });
        }


    }
}



export class TpOrb {
    async onConsume(event) {
        const { source } = event;
        const player = source; // Fixed incorrect variable assignment

        const scoreboard = world.scoreboard.getObjective("setspawn");
        if (!scoreboard) {
            player.sendMessage("§cNo global spawn point found in the scoreboard.");
            return;
        }

        let spawnEntry = null;
        scoreboard.getParticipants().forEach((participant) => {
            if (participant.displayName.startsWith("global_spawn")) {
                spawnEntry = participant.displayName;
            }
        });

        if (!spawnEntry) {
            player.sendMessage(
                "§cNo valid global spawn point found! Use the Set Spawn function to define one."
            );
            return;
        }

        const match = spawnEntry.match(/^global_spawn_(\w+)_(-?\d+)_(-?\d+)_(-?\d+)$/);
        if (!match) {
            player.sendMessage(
                "§cGlobal spawn point format is invalid. Please reset the spawn."
            );
            return;
        }

        const [, dimension, x, y, z] = match;

        // Play particle effect at current location
        player.runCommand(
            `execute as @s at @s run particle zombie:tporb ~ ~-1 ~`
        );
        player.runCommand(
            `execute as @s at @s run particle zombie:tporbmagic ~ ~-0.9 ~`
        );

        // Play sound effect
        player.runCommand(
            `execute as @s at @s run playsound magictp @s ~ ~ ~ 1 1 1`
        );

        // Wait 5 seconds using system.runTimeout (100 ticks = 5 seconds)
        system.runTimeout(async () => {
            // Teleport the player
            await player.runCommand(
                `execute as @s in ${dimension} run tp @s ${x} ${y} ${z}`
            );
            player.runCommand(
                `execute as @s at @s run playsound magictpend @s ~ ~ ~ 1 1 1`
            );

            // Play particle effect at new location
            player.runCommand(
                `execute as @s at @s run particle zombie:tporb ~ ~-2 ~`
            );
            player.runCommand(
                `execute as @s at @s run particle zombie:tporbmagic ~ ~-0.9 ~`
            );

            // Send teleportation message
            player.sendMessage(
                `§aTeleported to the global spawn point: X=${x}, Y=${y}, Z=${z} in ${dimension}.`
            );
        }, 100); // 100 ticks = 5 seconds
    }
}

export class Crablegs {
    onConsume(arg) {
      const { source } = arg;
      // make sure it's a player
      if (!(source instanceof Player)) return;
  
      // duration is in ticks (20 ticks = 1 second), so 1200 ticks = 60 seconds
      const duration = 600;
  
      // Night Vision (no particles)
      source.addEffect("minecraft:night_vision", duration, {
        amplifier: 0,
        showParticles: false
      });
  
      // Dolphin's Grace (underwater swim boost; no particles)
      source.addEffect("minecraft:water_breathing", duration, {
        amplifier: 0,
        showParticles: false
      });
    }
  }


export class CorruptedDamage {
    onStepOn(event) {
        const { entity, block, dimension } = event;
        const { x, y, z } = block.location;

        // 1) place spike
        dimension.setBlockType(
            { x: x, y: y + 1, z: z },
            "zombie:hellfire_spike"
        );

        // grab the entity ID
        const id = entity?.typeId || "";

        //  ─── bail out for dropped items ───
        if (id === "minecraft:item") return;

        // 2) damage logic
        if (id === "minecraft:player") {
            entity.applyDamage?.(10, { cause: "thorns" });
            return;
        }
        if (id === "zombie:emberstalker" || id === "zombie:hell_brute") {
            return;
        }
        entity.applyDamage?.(1000, { cause: "thorns" });

        // 3) spawn a new demon
        const spawnMob = Math.random() < 0.5
            ? "zombie:emberstalker"
            : "zombie:hell_brute";
        dimension.spawnEntity(spawnMob, { x, y: y + 1, z });
    }

    onStepOff(event) {
        const { block, dimension } = event;
        const { x, y, z } = block.location;

        // remove spike
        dimension.setBlockType(
            { x: x, y: y + 1, z: z },
            "minecraft:air"
        );
    }
}




///////////////////////////////////////////////////////////////

export class LogStripper{
  onPlayerInteract(event) {
    strippedLog(event);
  }
}

function strippedLog(event) {
  const { player, block, dimension } = event;

  const invComp = player.getComponent("minecraft:inventory");
  if (!invComp) return;

  const handItem = invComp.container.getItem(player.selectedSlotIndex);
  if (!handItem) return; 
  const validAxes = new Set([
    "minecraft:wooden_axe",
    "minecraft:stone_axe",
    "minecraft:iron_axe",
    "minecraft:golden_axe",
    "minecraft:diamond_axe",
    "minecraft:netherite_axe",
  ]);

  if (!validAxes.has(handItem.typeId)) return;


  const mapping = {
    "zombie:demon_log": "zombie:demon_log_stripped",
    "zombie:demon_fire_log": "zombie:demon_fire_log_stripped",
  };

  const stripped = mapping[block.typeId];
  if (!stripped) return;

 
  try {
    const targetBlock = dimension.getBlock(block.location);
    targetBlock.setType(stripped);
  } catch (err) {
   
  }
}
//////////////////////////////////////////////////////////
export class ZombieSlab {
  constructor() {
    // Bedrock will call this when the player interacts
    this.onPlayerInteract = this.onPlayerInteract.bind(this);
  }

  /**
   * Fired when a player right-clicks a block that has
   * `"minecraft:on_player_interact": { "component": "bumble:double_slab" }`
   */
  onPlayerInteract(event) {
    const { block, player, dimension } = event;

    // 1) only our mapped slabs
    const slabId = block.permutation.type.id;
    const fullId = doubleSlabMap[slabId];
    if (!fullId) return;

    // 2) only the bottom half (we’ll convert that one)
    if (block.permutation.getState("minecraft:vertical_half") !== "bottom") return;

    // 3) only if they’re holding the same slab in main hand
    const held = player
      .getComponent("equippable")
      .getEquipment("mainhand");
    if (!held || held.typeId !== slabId) return;

    // 4) do the swap
    const fullPerm = BlockPermutation.resolve(fullId);
    dimension.setBlock({
      location: block.location,
      block:    fullPerm,
    });

    // 5) consume one slab from their hand
    const inv  = player.getComponent("minecraft:inventory").container;
    const idx  = player.selectedSlotIndex;
    const amt  = held.amount - 1;
    if (amt > 0) {
      inv.setItem(idx, { typeId: slabId, amount: amt });
    } else {
      inv.setItem(idx, undefined);
    }
  }
}

///////////////////////////////////////


const ORE_TO_RAW = {
  "zombie:demon_steel_ore": "zombie:demon_steel_raw",
  "zombie:mithril_ore":     "zombie:mithril_raw",
  "zombie:copper_ore":      "zombie:copper_raw",
  // …add more mappings as needed
};

export class CustomOres {
  onPlayerDestroy(event) {
    const { dimension, player, destroyedBlockPermutation, block } = event;
    const oreId   = destroyedBlockPermutation.type.id;
    const rawType = ORE_TO_RAW[oreId];
    if (!rawType) return;             // not our custom ore
    if (!(player instanceof Player)) return;

    // require diamond or netherite pickaxe
    const held = player
      .getComponent("minecraft:equippable")
      .getEquipment(EquipmentSlot.Mainhand);
    if (!held) return;

    const toolId = held.typeId;
    if (
      toolId !== "minecraft:diamond_pickaxe" &&
      toolId !== "minecraft:netherite_pickaxe"
    ) return;                         // ignore other tools

    // check Silk Touch: if present, drop nothing
    const ench  = held.getComponent(ItemComponentTypes.Enchantable);
    const silk  = ench?.getEnchantments()
                     .find(e => e.type.id === "silk_touch")?.level || 0;
    if (silk > 0) {
      // Silk Touch: suppress all drops
      return;
    }

    // Fortune branch: drop raw ore with Fortune rolls
    const fortune = ench?.getEnchantments()
                         .find(e => e.type.id === "fortune")?.level || 0;
    let count = 1;
    for (let i = 0; i < fortune; i++) {
      if (Math.random() < 1 / (fortune + 1 - i)) count++;
    }

    // spawn raw ore
    const stack = new ItemStack(rawType, count);
    dimension.spawnItem(stack, block.location);

    // optional XP orbs
    const xp = Math.floor(Math.random() * 4);
    for (let i = 0; i < xp; i++) {
      dimension.spawnEntity("minecraft:xp_orb", block.location);
    }
  }
}

