import { world} from "@minecraft/server";


export class RedwoodGrowthComponent {
    static tryGrowBlock(block /** @type Block */) {
        const perm = block.permutation;
        const age = perm.getState("starter:crop_age");
        if (age === undefined || typeof age !== "number") {
            return;
        }
        if (age === 5) {
            RedwoodGrowthComponent.growRedwoodTree(block.location.x, block.location.y, block.location.z);
            return; // already at max age
        }
        block.setPermutation(perm.withState("starter:crop_age", age + 1));
    }

    static growRedwoodTree(x, y, z) {
        // Define size variants for trunk height and canopy size
        const minTrunkHeight = 10;  // Minimum trunk height
        const maxTrunkHeight = 30;  // Maximum trunk height
        const trunkHeight = minTrunkHeight + Math.floor(Math.random() * (maxTrunkHeight - minTrunkHeight + 1));

        const minLeafRadius = 2;  // Minimum leaf radius
        const maxLeafRadius = 6;  // Maximum leaf radius
        const leafRadius = minLeafRadius + Math.floor(Math.random() * (maxLeafRadius - minLeafRadius + 1));

        const leafDensity = Math.floor(trunkHeight / 2); // Canopy extends down to midway down the trunk

        const dimension = world.getDimension("overworld");

        // Grow the trunk up to the height needed to accommodate the canopy
        const trunkTopY = y + trunkHeight - leafDensity - 1; // Adjusted trunk height

        for (let i = 0; i <= trunkTopY - y; i++) {
            const block = dimension.getBlock({ x: x, y: y + i, z: z });
            if (block) {
                block.setType("zombie:redwood");
            }
        }

        // Create the leaf canopy, outer layer only, wider at the bottom
        const leafTopY = trunkTopY + leafDensity;

        for (let dy = 0; dy <= leafDensity; dy++) {
            const currentRadius = leafRadius - dy * (leafRadius / (leafDensity + 1)); // Narrower as you go up
            const outerRadius = Math.ceil(currentRadius);

            for (let dx = -outerRadius; dx <= outerRadius; dx++) {
                for (let dz = -outerRadius; dz <= outerRadius; dz++) {
                    const distance = Math.sqrt(dx * dx + dz * dz); // Distance from center in horizontal plane

                    const leafX = x + dx;
                    const leafY = trunkTopY + dy; // Start from the top of the trunk and move upwards
                    const leafZ = z + dz;

                    const block = dimension.getBlock({ x: leafX, y: leafY, z: leafZ });

                    if (block) {
                        // Place leaves only on the outermost layer and ensure trunk remains solid
                        if (distance >= currentRadius - 1 && distance <= currentRadius) {
                            if (block.typeId === "minecraft:air") { // Check only for "minecraft:air"
                                block.setType("zombie:redwood_leaves");
                            }
                        } else if (dx === 0 && dz === 0) {
                            // Ensure trunk blocks are placed in the center
                            block.setType("zombie:redwood");
                        }
                    }
                }
            }
        }
    }



    static tryFertilize(block /** @type Block */, player /** @type Player */) {
        // Access the player's inventory using the "minecraft:inventory" component
        const inventory = player.getComponent("minecraft:inventory");
        if (!inventory) {
            return false;
        }
        const selectedItem = inventory.container?.getItem(player.selectedSlotIndex);
        if (selectedItem && selectedItem.typeId === "minecraft:bone_meal") {
            RedwoodGrowthComponent.tryGrowBlock(block);

            // Trigger the particle effect
            const pos = block.location;
            player.runCommand(`particle minecraft:crop_growth_emitter ${pos.x} ${pos.y} ${pos.z}`);

            if (selectedItem.amount > 1) {
                selectedItem.amount--;
                inventory.container?.setItem(player.selectedSlotIndex, selectedItem);
            } else {
                // Remove the item from the inventory if the amount is 1
                inventory.container?.setItem(player.selectedSlotIndex, undefined);
            }

            return true;
        }
        return false;
    }

    onRandomTick(arg /** @type BlockComponentRandomTickEvent */) {
        RedwoodGrowthComponent.tryGrowBlock(arg.block);
    }

    onPlayerInteract(arg /** @type BlockComponentPlayerInteractEvent */) {
        if (!arg.player) {
            return;
        }
        RedwoodGrowthComponent.tryFertilize(arg.block, arg.player);
    }
}



export function demonTree(x, y, z) {
    const dimension = world.getDimension("overworld");
    // pick one of the two log types for the whole tree
    const LOG = Math.random() < 0.5
      ? "zombie:demon_log"
      : "zombie:demon_fire_log";

    // 1) Trunk
    const minH = 8, maxH = 20;
    const height = minH + Math.floor(Math.random() * (maxH - minH + 1));
    for (let i = 0; i < height; i++) {
        const b = dimension.getBlock({ x, y: y + i, z });
        if (b) b.setType(LOG);
    }

    // 2) Branches with mid‑splits
    const dirs = [
      { dx:  1, dz:  0 }, { dx: -1, dz:  0 },
      { dx:  0, dz:  1 }, { dx:  0, dz: -1 },
      { dx:  1, dz:  1 }, { dx: -1, dz:  1 },
      { dx:  1, dz: -1 }, { dx: -1, dz: -1 },
    ];
    const branchCount = 3 + Math.floor(Math.random() * 2); // 3–4 arms

    for (let b = 0; b < branchCount; b++) {
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        const baseY = y + Math.floor(height * (0.75 + Math.random() * 0.2));
        const len   = 4 + Math.floor(Math.random() * 3); // 4–6 long
        let bx = x, by = baseY, bz = z;

        for (let step = 0; step < len; step++) {
            bx += dir.dx;
            bz += dir.dz;
            // slight vertical wiggle
            if (Math.random() < 0.3) by++;
            else if (Math.random() < 0.2) by--;
            const blk = dimension.getBlock({ x: bx, y: by, z: bz });
            if (blk) blk.setType(LOG);

            // halfway: 70% chance to spit off a small sub‑branch
            if (step === Math.floor(len / 2) && Math.random() < 0.7) {
                const subDir = dirs[Math.floor(Math.random() * dirs.length)];
                let sx = bx, sy = by, sz = bz;
                const subLen = 2 + Math.floor(Math.random() * 2);
                for (let ss = 0; ss < subLen; ss++) {
                    sx += subDir.dx;
                    sz += subDir.dz;
                    if (Math.random() < 0.5) sy++;
                    const subBlk = dimension.getBlock({ x: sx, y: sy, z: sz });
                    if (subBlk) subBlk.setType(LOG);
                }
            }
        }
    }
}