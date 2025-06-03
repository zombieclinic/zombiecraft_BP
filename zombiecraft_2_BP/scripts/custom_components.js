import {EntityComponentTypes,ItemStack, EquipmentSlot, Player, GameMode, ItemComponentTypes, system, world, BlockPermutation} from "@minecraft/server";
import {demonTree} from "./plants/custom_trees"

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
            await player.runCommandAsync(`playsound present @a[r=20]`);
          } else {
            await player.runCommandAsync(`playsound ${effects.sound} @a[r=20]`);
          }
        } catch (error) {
          console.error(`Error playing sound: ${error}`);
        }
      }

      this.scheduleBlockReplacement(dimension, blockPos);
    }
  }

  fireParticleEffect(dimension, location, particleName) {
    dimension.runCommandAsync(
      `particle ${particleName} ${location.x} ${location.y} ${location.z}`
    );
  }


    scheduleBlockReplacement(dimension, blockPos) {
        // Wait for 60 ticks (3 seconds)
        system.runTimeout(() => {
            try {
                // Replace the block with air
                dimension.runCommandAsync(`setblock ${blockPos.x} ${blockPos.y} ${blockPos.z} air destroy`);
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
        player.runCommandAsync(
          `scoreboard objectives add ${objectiveId} dummy Mana`
        );
        obj = world.scoreboard.getObjective(objectiveId);
      }
  
      // ── 2) read current mana ────────────────────────────────────────
      const currentMana = obj.getScore(player);
  
      // ── 3) bail out if <10 with red text (no animation/effects) ────
      if (currentMana < 10) {
        player.runCommandAsync(
          `tellraw ${playerName} {"rawtext":[{"text":"§cNot enough mana!"}]}`
        );
        return;
      }
  
      // ── 4) deduct 10 mana & compute new total ───────────────────────
      const newMana = currentMana - 10;
      // you can use “remove” or “set”; here we’ll set to be exact:
      player.runCommandAsync(
        `scoreboard players set ${playerName} ${objectiveId} ${newMana}`
      );
  
      // ── 5) show the new total in blue §9 ────────────────────────────
      player.runCommandAsync(
        `tellraw ${playerName} {"rawtext":[{"text":"§9Your mana: ${newMana}"}]}`
      );
  
      // ── 6) now do your ability ──────────────────────────────────────
      player.playAnimation("animation.santasword_swing_melee.tpp_swing_melee");
      player.runCommandAsync("tag @s add dual");
      player.runCommandAsync(
        "damage @e[r=3,tag=!dual] 15 entity_attack entity @s"
      );
      player.runCommandAsync("effect @e[r=3,tag=!dual] slowness 2 5");
      player.runCommandAsync("playsound game.player.attack.nodamage @s");
      system.runTimeout(() => {
        player.runCommandAsync("tag @s remove dual");
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
        player.runCommandAsync(
            `execute as @s at @s run particle zombie:tporb ~ ~-1 ~`
        );
        player.runCommandAsync(
            `execute as @s at @s run particle zombie:tporbmagic ~ ~-0.9 ~`
        );

        // Play sound effect
        player.runCommandAsync(
            `execute as @s at @s run playsound magictp @s ~ ~ ~ 1 1 1`
        );

        // Wait 5 seconds using system.runTimeout (100 ticks = 5 seconds)
        system.runTimeout(async () => {
            // Teleport the player
            await player.runCommandAsync(
                `execute as @s in ${dimension} run tp @s ${x} ${y} ${z}`
            );
            player.runCommandAsync(
                `execute as @s at @s run playsound magictpend @s ~ ~ ~ 1 1 1`
            );

            // Play particle effect at new location
            player.runCommandAsync(
                `execute as @s at @s run particle zombie:tporb ~ ~-2 ~`
            );
            player.runCommandAsync(
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



////////////////////////////////////////////////////////////////////////////////////



export class DemonGrass {
  constructor() {
    this.onTick = this.onTick.bind(this);
  }

  onTick(event) {
    const { block, dimension } = event;
    const { x, y, z } = block.location;

    // only run on our custom grass
    if (block.typeId !== "zombie:demon_grass") return;

    // helper predicates
    const isNaturalLog = id =>
      id?.endsWith("_log") &&
      !["zombie:demon_log", "zombie:demon_fire_log"].includes(id);
    const isLeaf = id => id?.endsWith("_leaves");
    const isLitter = id => id === "minecraft:leaf_litter";

    // 1) Ignite fires when wood is nearby
    let didIgnite = false;
    for (let fx = -1; fx <= 1; fx++) {
      for (let fz = -1; fz <= 1; fz++) {
        const colX = x + fx, colZ = z + fz;
        let scanY = y + 1, sawWood = false;

        while (true) {
          const nb = dimension.getBlock({ x: colX, y: scanY, z: colZ });
          if (!nb) break;
          if (isNaturalLog(nb.typeId) || isLeaf(nb.typeId) || isLitter(nb.typeId)) {
            sawWood = true;
            scanY++;
            continue;
          }
          break;
        }

        if (sawWood) {
          const spot = dimension.getBlock({ x: colX, y: scanY, z: colZ });
          if (spot && (spot.typeId === "minecraft:air" || isLeaf(spot.typeId) || isLitter(spot.typeId))) {
            dimension.runCommandAsync(`setblock ${colX} ${scanY} ${colZ} minecraft:fire`);
          }
          didIgnite = true;

          // create leaf-litter debris around
          const debris = [
            { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
            { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
            { dx: 1, dz: 1 }, { dx: -1, dz: 1 },
            { dx: 1, dz: -1 }, { dx: -1, dz: -1 }
          ];
          for (const { dx, dz } of debris) {
            const below = dimension.getBlock({ x: colX + dx, y, z: colZ + dz });
            if (below && below.typeId === "zombie:demon_grass_no_tick") {
              dimension.runCommandAsync(
                `setblock ${colX + dx} ${y} ${colZ + dz} minecraft:leaf_litter`
              );
            }
          }
        }
      }
    }

    // spread & transform chances
    const TREE_CHANCE = 0.01;
    const CORRUPT_CHANCE = 0.2;
    const TRAPSTONE_CHANCE = 0.05;
    const LAVA_CHANCE = 0.02;
    const MAGMA_CHANCE = 0.02;

    const DIRT_TO_DEMON_STONE_CHANCE = 0.25;  // dirt → demon stone vs demon dirt
    const STONE_INFECT_CHANCE = 1.0;         // always infect stone
    const ORE_INSTEAD_OF_STONE = 0.5;        // 50% demon_steel_ore vs demon_stone

    // build neighbor offsets
    const offsets = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          offsets.push({ dx, dy, dz });
        }
      }
    }

    let didSpread = false;
    for (const { dx, dy, dz } of offsets) {
      const tx = x + dx, ty = y + dy, tz = z + dz;
      const tgt = dimension.getBlock({ x: tx, y: ty, z: tz });
      if (!tgt) continue;

      let grew = false;

      // DIRT: 25% → demon_stone, 75% → demon_dirt
      if (tgt.typeId === "minecraft:dirt") {
        if (Math.random() < DIRT_TO_DEMON_STONE_CHANCE) {
          tgt.setType("zombie:demon_stone");
        } else {
          tgt.setType("zombie:demon_dirt");
        }
        didSpread = true;
      }
      // GRASS_BLOCK → demon_grass
      else if (tgt.typeId === "minecraft:grass_block") {
        tgt.setType("zombie:demon_grass");
        grew = didSpread = true;
      }
      // demon_dirt + air above → demon_grass
      else if (tgt.typeId === "zombie:demon_dirt") {
        const above2 = dimension.getBlock({ x: tx, y: ty + 1, z: tz });
        if (above2?.typeId === "minecraft:air") {
          tgt.setType("zombie:demon_grass");
          grew = didSpread = true;
        }
      }
      // STONE: split between demon_stone and demon_steel_ore
      else if (tgt.typeId === "minecraft:stone") {
        if (Math.random() < STONE_INFECT_CHANCE) {
          const newType = (Math.random() < ORE_INSTEAD_OF_STONE)
            ? "zombie:demon_steel_ore"
            : "zombie:demon_stone";
          tgt.setType(newType);
          didSpread = true;
        }
      }

      if (grew) {
        if (Math.random() < TREE_CHANCE) demonTree(tx, ty + 1, tz);
        if (Math.random() < CORRUPT_CHANCE) {
          const top = dimension.getBlock({ x: tx, y: ty + 1, z: tz });
          if (top?.typeId === "minecraft:air") {
            top.setType("zombie:corrupted_grass");
            top.setPermutation(top.permutation.withState("zombie:crop_age", 5));
          }
        }
        if (Math.random() < TRAPSTONE_CHANCE) {
          dimension.runCommandAsync(`setblock ${tx} ${ty} ${tz} zombie:hellfire_trapstone`);
        }
        if (Math.random() < LAVA_CHANCE) {
          dimension.runCommandAsync(`setblock ${tx} ${ty} ${tz} minecraft:lava`);
        }
        if (Math.random() < MAGMA_CHANCE) {
          dimension.runCommandAsync(`setblock ${tx} ${ty} ${tz} minecraft:magma`);
        }
      }

      if (didSpread) break;
    }

    // if nothing happened, turn off ticking
    const stillHasTarget = offsets.some(({ dx, dy, dz }) => {
      const nb2 = dimension.getBlock({ x: x + dx, y: y + dy, z: z + dz });
      return nb2 && (
        nb2.typeId === "minecraft:stone" ||
        nb2.typeId === "minecraft:dirt" ||
        nb2.typeId === "minecraft:grass_block"
      );
    });

    if (!didSpread && !didIgnite && !stillHasTarget) {
      block.setType("zombie:demon_grass_no_tick");
    }
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

/////////////////demon_tower/////////////////////////////////
export class TestDemon{
    onUse(arg) {
      const player      = arg.source;
     spawnCastle(player)
}
}


// fortress_generator.js


/**
 * Entry point: spawns an entire fortress complex around the player, all at once.
 */
export function spawnCastle(player) {
  const dim = player.dimension;
  const { x: px, y: py, z: pz } = player.location;
  const ox = Math.floor(px);
  const oy = Math.floor(py);
  const oz = Math.floor(pz);

  // Configuration
  const wallRadius    = 40;
  const wallThickness = 2;
  const wallHeight    = 15;
  const centralRadius = 12;
  const towerRadius   = centralRadius + 3;
  const towerHeight   = 25;
  const floorRadius   = wallRadius + 2; // floor extends past walls

  // Block palettes with weights
  const floorMix = [
    "zombie:demon_dirt",
    "zombie:demon_dirt",
    "zombie:demon_stone",
    "zombie:demon_stone",
    "zombie:hellfire_trapstone",
    "zombie:demon_plank_slab",
    "zombie:demon_plank_slab"
  ];
  const wallBlocks = [
    "zombie:demon_stone_brick",
    "zombie:demon_stone_brick",
    "zombie:demon_planks",
    "zombie:demon_planks"
  ];
  const plankBlocks = [
    "zombie:demon_planks",
    "zombie:demon_planks"
  ];

  // 1) Main floor
  for (let x = -floorRadius; x <= floorRadius; x++) {
    for (let z = -floorRadius; z <= floorRadius; z++) {
      if (x*x + z*z <= floorRadius * floorRadius) {
        const pick = floorMix[Math.floor(Math.random() * floorMix.length)];
        dim.getBlock({ x: ox + x, y: oy, z: oz + z })?.setType(pick);
      }
    }
  }
  // Hidden chiseled steel (always one)
  {
    const phi = Math.random() * Math.PI * 2;
    const rHidden = floorRadius * Math.sqrt(Math.random());
    const hx = ox + Math.round(Math.cos(phi) * rHidden);
    const hz = oz + Math.round(Math.sin(phi) * rHidden);
    dim.getBlock({ x: hx, y: oy, z: hz })?.setType("zombie:demon_steel_chiseled");
  }

  // 2) Perimeter double walls
  for (let t = 0; t < wallThickness; t++) {
    const r = wallRadius + t;
    for (let angle = 0; angle < Math.PI * 2; angle += 0.01) {
      const xOut = Math.round(Math.cos(angle) * r);
      const zOut = Math.round(Math.sin(angle) * r);
      for (let y = 0; y < wallHeight; y++) {
        const pick = wallBlocks[Math.floor(Math.random() * wallBlocks.length)];
        dim.getBlock({ x: ox + xOut, y: oy + y, z: oz + zOut })?.setType(pick);
      }
    }
  }

  // 3) Peripheral towers on wall
  const towerCount = 6;
  const spacing   = Math.PI * 2 / towerCount;
  for (let i = 0; i < towerCount; i++) {
    const ang = i * spacing;
    const tx  = ox + Math.round(Math.cos(ang) * wallRadius);
    const tz  = oz + Math.round(Math.sin(ang) * wallRadius);
    buildTower(dim, tx, oy, tz, 6, towerHeight, wallBlocks, plankBlocks);
  }

  // 4) Central spire (cylinder)
  buildTower(dim, ox, oy, oz, towerRadius, towerHeight * 2, wallBlocks, plankBlocks);

  // 5) Inner pyramid with altar inside (preserved)
  buildPyramid(dim, ox, oy, oz, centralRadius, wallBlocks);
  dim.getBlock({ x: ox, y: oy + 1, z: oz })?.setType("zombie:demon_alter");

  player.sendMessage("☠ A grand demon fortress has been spawned!");
}

/**
 * Builds a cylindrical tower: hollow interior, mixed walls, and plank roof.
 */
function buildTower(dim, ox, oy, oz, radius, height, wallBlocks, plankBlocks) {
  // Hollow interior
  for (let x = -radius + 1; x <= radius - 1; x++) {
    for (let z = -radius + 1; z <= radius - 1; z++) {
      if (x*x + z*z <= (radius - 1)*(radius - 1)) {
        for (let y = oy + 1; y < oy + height; y++) {
          dim.getBlock({ x: ox + x, y, z: oz + z })?.setType("air");
        }
      }
    }
  }
  // Walls: mix stone bricks and planks
  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      const d2 = x*x + z*z;
      if (d2 <= radius*radius && d2 >= (radius - 1)*(radius - 1)) {
        for (let y = oy; y < oy + height; y++) {
          const mix = ["zombie:demon_stone_brick", "zombie:demon_planks"];
          const type = mix[Math.floor(Math.random() * mix.length)];
          dim.getBlock({ x: ox + x, y, z: oz + z })?.setType(type);
        }
      }
    }
  }
  // Roof (planks)
  for (let i = 0; i < radius; i++) {
    const r = radius - i;
    const y = oy + height + i;
    for (let x = -r; x <= r; x++) {
      for (let z = -r; z <= r; z++) {
        if (x*x + z*z <= r*r) {
          const type = plankBlocks[Math.floor(Math.random() * plankBlocks.length)];
          dim.getBlock({ x: ox + x, y, z: oz + z })?.setType(type);
        }
      }
    }
  }
}

/**
 * Builds a replica pyramid shell at ground level.
 */
function buildPyramid(dim, ox, oy, oz, baseRadius, wallBlocks) {
  for (let yOff = 0; yOff < baseRadius; yOff++) {
    const r = baseRadius - yOff;
    const y = oy + yOff;
    const inner = r - 1;
    for (let x = -r; x <= r; x++) {
      for (let z = -r; z <= r; z++) {
        const d2 = x*x + z*z;
        if (d2 <= r*r && d2 >= inner*inner) {
          const pick = wallBlocks[Math.floor(Math.random() * wallBlocks.length)];
          dim.getBlock({ x: ox + x, y, z: oz + z })?.setType(pick);
        }
      }
    }
  }
}


//////////////////////////////////arrowEffect///////////////////


export function arrowEffect(arrow) {
  if (!arrow?.dimension) return;
  const dim    = arrow.dimension;
  const origin = arrow.location;

  // grab everything (except the arrow itself) within 2 blocks
  const hits = dim
    .getEntities({ location: origin, maxDistance: 2 })
    .filter(e => e.id !== arrow.id);

  // constants
  const RANDOM_RADIUS = 10;
  const ONE_SHOT_CHANCE = 0.01;  // 1% insta-kill

  for (const t of hits) {
    // 1% insta-kill
    if (Math.random() < ONE_SHOT_CHANCE) {
      t.applyDamage(1000, null);
      continue;
    }

    const effects = [
      // 1) Heavy slowness for 5 s
      target => target.addEffect(
        "minecraft:slowness", 100,
        { amplifier: 10, showParticles: true }
      ),

      // 2) Levitation for 5 s
      target => target.addEffect(
        "minecraft:levitation", 100,
        { amplifier: 1, showParticles: true }
      ),

      // 3) Minor instant damage
      target => target.applyDamage(5, null),

      // 4) Random horizontal teleport within ±RANDOM_RADIUS blocks
      target => {
        const { x, y, z } = target.location;
        const dx = (Math.random() * 2 * RANDOM_RADIUS) - RANDOM_RADIUS;
        const dz = (Math.random() * 2 * RANDOM_RADIUS) - RANDOM_RADIUS;
        const nx = Math.floor(x + dx);
        const nz = Math.floor(z + dz);
        target.runCommandAsync(`tp @s ${nx} ${y.toFixed(2)} ${nz}`);
      },

      // 5) Sky-launch: teleport 30 blocks up
      target => {
        const { x, y, z } = target.location;
        target.runCommandAsync(
          `tp @s ${x.toFixed(2)} ${(y + 30).toFixed(2)} ${z.toFixed(2)}`
        );
      },

      // 6) Freeze: extra-strong slowness + heavy mining fatigue for 10 s
      target => {
        target.addEffect(
          "minecraft:slowness",      200,
          { amplifier: 20, showParticles: true }
        );
        target.addEffect(
          "minecraft:mining_fatigue",200,
          { amplifier: 5, showParticles: true }
        );
      },
    ];

    // pick and run one at random
    effects[Math.floor(Math.random() * effects.length)](t);
  }
}


////////////////////////axe_swing///////////////////

// ── Config ─────────────────────────────────────────────
const HITS_PER_CHARGE      = 3;
const MAX_CHARGES          = 10;

const BASE_RANGE           = 4;
const RANGE_PER_CHARGE     = 1;   // +1 block per charge

const BASE_DAMAGE          = 7;
const DAMAGE_PER_CHARGE    = 1;   // +1 damage per charge

const BASE_KNOCKBACK       = 0.8;
const KNOCKBACK_PER_CHARGE = 0.2; // +0.2 impulse per charge

// Penalty attack when no charges:
const PENALTY_DAMAGE       = 5;   // “level 5” attack
const PENALTY_KNOCKBACK    = 1;   // moderate knockback
const PENALTY_SELF_DAMAGE  = 6;   // 3 hearts = 6 HP

// ── State ──────────────────────────────────────────────
const rawHits = new Map();   // Map<playerId, number>
const charges = new Map();   // Map<playerId, number>

/**
 * AOE damage & knockback helper.
 */
function applyAxeDamage(player, damageAmount, knockbackStrength, range) {
  const pid = player.id;
  const targets = player.dimension
    .getEntities({ location: player.location, maxDistance: range })
    .filter(e => e.id !== pid);

  for (const t of targets) {
    let loc;
    try { loc = t.location; if (!loc) throw 0; } catch { continue; }
    try { t.applyDamage(damageAmount); } catch { continue; }

    const dx = loc.x - player.location.x;
    const dz = loc.z - player.location.z;
    const len = Math.hypot(dx, dz) || 1;
    const impulse = {
      x: (dx/len) * knockbackStrength,
      y: 0.3,
      z: (dz/len) * knockbackStrength,
    };

    try { if (typeof t.clearVelocity === "function") t.clearVelocity(); } catch {}
    try { if (typeof t.applyImpulse  === "function") t.applyImpulse(impulse); } catch {}
  }
}

export class TppAxeSwing {
  /**
   * Build charges on every direct hit.
   */
  onHitEntity(event) {
    const player    = event.attackingEntity;
    const target    = event.hitEntity;
    const hadEffect = event.hadEffect;
    if (!player || !target || !hadEffect) return;

    const pid = player.id;
    let hits = (rawHits.get(pid) || 0) + 1;

    if (hits >= HITS_PER_CHARGE) {
      hits -= HITS_PER_CHARGE;
      const newCharge = Math.min((charges.get(pid) || 0) + 1, MAX_CHARGES);
      charges.set(pid, newCharge);

      // Chat feedback so you see it
      player.runCommandAsync(`say  Charged ${newCharge}`);
    }

    rawHits.set(pid, hits);
  }

  /**
   * Consume charges on use, or penalty if zero.
   */
  onUse(event) {
    const player = event.source;
    const pid    = player.id;
    const c      = charges.get(pid) || 0;

    // always play swing animation
    player.playAnimation("animation.tpp_axe_swing");

    if (c <= 0) {
      // No charges: penalty
      player.applyDamage(PENALTY_SELF_DAMAGE);
      applyAxeDamage(player, PENALTY_DAMAGE, PENALTY_KNOCKBACK, BASE_RANGE);
      player.runCommandAsync(`say  No charges! Took 3 hearts, unleashed level 5 attack!`);
    } else {
      // Consume charges: empowered AOE
      const range     = BASE_RANGE + c * RANGE_PER_CHARGE;
      const damage    = BASE_DAMAGE + c * DAMAGE_PER_CHARGE;
      const knockback = BASE_KNOCKBACK + c * KNOCKBACK_PER_CHARGE;
      applyAxeDamage(player, damage, knockback, range);

      // Feedback
      player.dimension
        .runCommandAsync(`title @s actionbar "Unleashed ${c} charge${c!==1?'s':''}!"`)
        .catch(() => {});
    }

    // reset for next combo
    charges.set(pid, 0);
    rawHits.set(pid, 0);
  }
}

/////////////////bow/////////////


export class BowHold {
   onUse(event) {
    const player = event.source;
    const pid    = player.id;
    const c      = charges.get(pid) || 0;

    // always play swing animation
    player.playAnimation("animation.bow.tpp_fire_start");
   }}



///////////////crossbow///////////////////////////
/*
 * @param {Entity} arrow - The chaos arrow entity that triggered the explosion.
 */
export function chaosCrossbowExplosion(arrow) {
  if (!arrow?.dimension) return;

  const dim = arrow.dimension;
  const origin = arrow.location;

  const EXPLOSION_RADIUS = 10;

  // 1. Spawn particle at explosion center
  dim.runCommandAsync(`particle zombie:choas_particle22 ${origin.x} ${origin.y} ${origin.z}`);

  // 2. Play explosion sound
  dim.runCommandAsync(`playsound zombie.bfc.explode @a ${origin.x} ${origin.y} ${origin.z} 1 1 64`);

  // 3. Kill all entities (except the arrow) in radius
  const targets = dim
    .getEntities({ location: origin, maxDistance: EXPLOSION_RADIUS })
    .filter(e => e.id !== arrow.id);

  for (const entity of targets) {
    entity.applyDamage(1000, null); // Instant death
  }
}

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
          if (hook.isValid()) {
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