import { world} from "@minecraft/server";


export class RedwoodGrowthComponent {
    static tryGrowBlock(block /** @type Block */) {
        const perm = block.permutation;
        const age = perm.getState("zombie:crop_age");
        if (age === undefined || typeof age !== "number") {
            return;
        }
        if (age === 5) {
            RedwoodGrowthComponent.growRedwoodTree(block.location.x, block.location.y, block.location.z);
            return; // already at max age
        }
        block.setPermutation(perm.withState("zombie:crop_age", age + 1));
    }

static growRedwoodTree(x, y, z) {
  const dim = world.getDimension("overworld");
  const LOG = "zombie:redwood_log";
  const LEAVES = "zombie:redwood_leaves";

  const trunkHeight = 38 + Math.floor(Math.random() * 12); // 28–39
  const baseX = x - 1, baseZ = z - 1;

  // 4×4 trunk
  for (let yy = 0; yy < trunkHeight; yy++) {
    for (let tx = 0; tx < 4; tx++) {
      for (let tz = 0; tz < 4; tz++) {
        dim.getBlock({ x: baseX + tx, y: y + yy, z: baseZ + tz })?.setType(LOG);
      }
    }
  }
  const trunkTopY = y + trunkHeight - 1;

  // Top canopy dome
  const capBaseR = 10 + Math.floor(Math.random() * 3); // 6–8
  const capH = 5 + Math.floor(Math.random() * 2);     // 4–5
  placeLeafDisc(x, trunkTopY - 1, z, Math.max(2, capBaseR - 1), false);
  for (let h = 0; h < capH; h++) {
    const r = capBaseR - Math.floor((capBaseR - 1) * (h / capH));
    placeLeafDisc(x, trunkTopY + h, z, r, false);
  }

  // Whorled branches (unchanged)
  const dirs = [
    { dx:  1, dz:  0 }, { dx: -1, dz:  0 }, { dx: 0, dz:  1 }, { dx: 0, dz: -1 },
    { dx:  1, dz:  1 }, { dx: -1, dz:  1 }, { dx: 1, dz: -1 }, { dx: -1, dz: -1 },
  ];
  const whorls = 2 + Math.floor(Math.random() * 2);
  const crownBaseY = trunkTopY - 4;
  for (let w = 0; w < whorls; w++) {
    const levelY = crownBaseY - w * 4 - Math.floor(Math.random() * 2);
    for (const d of dirs) {
      const len = 4 + Math.floor(Math.random() * 4);
      let bx = x, by = levelY, bz = z;
      for (let t = 0; t < len; t++) {
        bx += d.dx; bz += d.dz;
        if (t % 2 === 0 && Math.random() < 0.7) by++;
        dim.getBlock({ x: bx, y: by, z: bz })?.setType(LOG);
      }
      placeLeafBall(bx, by, bz, 2 + (Math.random() < 0.35 ? 1 : 0));
      placeLeafBall(bx, by - 1, bz, 1);
    }
  }

  // --- FIX: spire wrapped with leaves + collar so no exposed logs ---
  const spireH = 3 + Math.floor(Math.random() * 3); // 3–5
  for (let i = 0; i < spireH; i++) {
    const sy = trunkTopY + capH + i;
    dim.getBlock({ x, y: sy, z })?.setType(LOG);
    const r = Math.max(1, 2 - Math.floor(i / 2));
    // was skipCore=true — change to false so leaves hug the spire/log
    placeLeafDisc(x, sy, z, r, false);
  }
  // collar right under the spire base to fully cap the top
  placeLeafDisc(x, trunkTopY + capH - 1, z, 3, false);
  placeLeafDisc(x, trunkTopY + capH,     z, 2, false);

  // soft tip
  placeLeafBall(x, trunkTopY + capH + spireH, z, 1);

  // helpers
  function placeLeafBall(cx, cy, cz, r) {
    const r2 = r * r;
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx * dx + dy * dy + dz * dz > r2) continue;
          // keep leaves from replacing trunk core
          if (Math.abs(cx + dx - x) <= 2 && Math.abs(cz + dz - z) <= 2 && cy + dy >= y) continue;
          const b = dim.getBlock({ x: cx + dx, y: cy + dy, z: cz + dz });
          if (b && b.typeId === "minecraft:air") b.setType(LEAVES);
        }
      }
    }
  }

  function placeLeafDisc(cx, cy, cz, r, skipCore) {
    const r2 = r * r;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dz * dz > r2) continue;
        if (skipCore && Math.abs(cx + dx - x) <= 2 && Math.abs(cz + dz - z) <= 2) continue;
        const b = dim.getBlock({ x: cx + dx, y: cy, z: cz + dz });
        if (b && b.typeId === "minecraft:air") b.setType(LEAVES);
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