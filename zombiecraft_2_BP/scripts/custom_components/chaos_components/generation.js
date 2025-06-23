import {demonTree} from "../plants/custom_trees"

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




////////////////////////////////////////////////////////////////////////////////////



export class DemonGrass {
  constructor() {
    this.onTick = this.onTick.bind(this);
  }

  onTick(event) {
    const { block, dimension } = event;
    const { x, y, z } = block.location;

    // kill any dropped items on top of this block to prevent lag
    dimension.runCommand(
      `kill @e[type=item, x=${x}, y=${y}, z=${z}, dx=1, dy=2, dz=1]`
    );

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
            dimension.runCommand(`setblock ${colX} ${scanY} ${colZ} minecraft:fire`);
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
              dimension.runCommand(
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

    const DIRT_TO_DEMON_STONE_CHANCE = 0.25;
    const STONE_INFECT_CHANCE = 1.0;
    const ORE_INSTEAD_OF_STONE = 0.5;

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

      if (tgt.typeId === "minecraft:dirt") {
        if (Math.random() < DIRT_TO_DEMON_STONE_CHANCE) {
          tgt.setType("zombie:demon_stone");
        } else {
          tgt.setType("zombie:demon_dirt");
        }
        didSpread = true;
      } 
      else if (tgt.typeId === "minecraft:grass_block") {
        tgt.setType("zombie:demon_grass");
        grew = didSpread = true;
      } 
      else if (tgt.typeId === "zombie:demon_dirt") {
        const above2 = dimension.getBlock({ x: tx, y: ty + 1, z: tz });
        if (above2?.typeId === "minecraft:air") {
          tgt.setType("zombie:demon_grass");
          grew = didSpread = true;
        }
      } 
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
          dimension.runCommand(`setblock ${tx} ${ty} ${tz} zombie:hellfire_trapstone`);
        }
        if (Math.random() < LAVA_CHANCE) {
          dimension.runCommand(`setblock ${tx} ${ty} ${tz} minecraft:lava`);
        }
        if (Math.random() < MAGMA_CHANCE) {
          dimension.runCommand(`setblock ${tx} ${ty} ${tz} minecraft:magma`);
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

