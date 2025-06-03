import {BlockPermutation, ItemStack,EquipmentSlot, system} from "@minecraft/server"

export class Atlantis {
    constructor() {
        this.onPlayerInteract = (event) => {
            const { block, dimension } = event;

            if (!block) return; // Ensure there's a block being interacted with

            const blockType = block.typeId;

            // Define mappings between solid and transparent blocks
            const blockMappings = {
                "zombie:atlantis_solid_black": "zombie:atlantis_transparent_black",
                "zombie:atlantis_transparent_black": "zombie:atlantis_solid_black",
                "zombie:atlantis_solid_blue": "zombie:atlantis_transparent_blue",
                "zombie:atlantis_transparent_blue": "zombie:atlantis_solid_blue",
                "zombie:atlantis_solid_brown": "zombie:atlantis_transparent_brown",
                "zombie:atlantis_transparent_brown": "zombie:atlantis_solid_brown",
                "zombie:atlantis_solid_cyan": "zombie:atlantis_transparent_cyan",
                "zombie:atlantis_transparent_cyan": "zombie:atlantis_solid_cyan",
                "zombie:atlantis_solid_green": "zombie:atlantis_transparent_green",
                "zombie:atlantis_transparent_green": "zombie:atlantis_solid_green",
                "zombie:atlantis_solid_magenta": "zombie:atlantis_transparent_magenta",
                "zombie:atlantis_transparent_magenta": "zombie:atlantis_solid_magenta",
                "zombie:atlantis_solid_orange": "zombie:atlantis_transparent_orange",
                "zombie:atlantis_transparent_orange": "zombie:atlantis_solid_orange",
                "zombie:atlantis_solid_pink": "zombie:atlantis_transparent_pink",
                "zombie:atlantis_transparent_pink": "zombie:atlantis_solid_pink",
                "zombie:atlantis_solid_purple": "zombie:atlantis_transparent_purple",
                "zombie:atlantis_transparent_purple": "zombie:atlantis_solid_purple",
                "zombie:atlantis_solid_red": "zombie:atlantis_transparent_red",
                "zombie:atlantis_transparent_red": "zombie:atlantis_solid_red",
                "zombie:atlantis_solid_white": "zombie:atlantis_transparent_white",
                "zombie:atlantis_transparent_white": "zombie:atlantis_solid_white",
                "zombie:atlantis_solid_yellow": "zombie:atlantis_transparent_yellow",
                "zombie:atlantis_transparent_yellow": "zombie:atlantis_solid_yellow"
            };

            // Check if the block type exists in the mapping
            if (blockType in blockMappings) {
                const newBlockType = blockMappings[blockType];
                dimension.runCommandAsync(
                    `setblock ${block.location.x} ${block.location.y} ${block.location.z} air`
                );
                dimension.runCommandAsync(
                    `setblock ${block.location.x} ${block.location.y} ${block.location.z} ${newBlockType}`
                );
            }
        };
    }
}



export const OPENABLE = {
  "zombie:demon_trapdoor": {
    stateName: "zombie:is_open",
    sounds: { open: "open.wooden_trapdoor", close: "close.wooden_trapdoor" }
  },
  "zombie:demon_gate": {
    stateName: "zombie:is_open",
    sounds: { open: "open.fence_gate",     close: "close.fence_gate"     }
  },
  // …more entries
};

export class OpenableComponent {
  onPlayerInteract({ block, dimension }) {
    const config = OPENABLE[block.typeId];
    if (!config) return;

    const wasOpen = block.permutation.getState(config.stateName);
    const nowOpen = !wasOpen;
    block.setPermutation(
      block.permutation.withState(config.stateName, nowOpen)
    );

    const soundId = nowOpen ? config.sounds.open : config.sounds.close;
    dimension.playSound(soundId, block.center());
  }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const DIRS = {
  north: { dx:  0, dz: -1 },
  south: { dx:  0, dz:  1 },
  west:  { dx: -1, dz:  0 },
  east:  { dx:  1, dz:  0 },
};

// Helper: Is this a vanilla fence or gate?
function isVanillaFence(typeId) {
  return (
    (typeId.startsWith("minecraft:") && typeId.endsWith("_fence")) ||
    (typeId.startsWith("minecraft:") && typeId.endsWith("_fence_gate"))
  );
}

// Helper: Is this a custom (zombie) fence or gate?
function isCustomFence(typeId) {
  return (
    (typeId.startsWith("zombie:") && typeId.endsWith("_fence")) ||
    (typeId.startsWith("zombie:") && typeId.endsWith("_fence_gate"))
  );
}

// Helper: Is this a solid block? (useful for fence connections)
function isSolidBlock(nb) {
  if (!nb) return false;
  if (nb.typeId === "minecraft:air") return false;
  // If block has collision box state, treat as solid
  try {
    const collision = nb.permutation.getState("minecraft:collision_box");
    if (collision !== undefined) return true;
  } catch (e) {}
  return true;
}

// Should this fence connect to the neighbor block?
function shouldConnect(nb) {
  if (!nb) return false;
  if (isCustomFence(nb.typeId)) return true;
  if (isVanillaFence(nb.typeId)) return true;
  if (isSolidBlock(nb)) return true;
  return false;
}

// Update a single fence at the given location
function updateFence(dimension, loc) {
  const b = dimension.getBlock(loc);
  if (!b || !isCustomFence(b.typeId)) return;

  let perm = b.permutation.withState("zombie:on_placed", true);

  for (const [state, { dx, dz }] of Object.entries(DIRS)) {
    const nb = dimension.getBlock({ x: loc.x + dx, y: loc.y, z: loc.z + dz });
    perm = perm.withState(`zombie:${state}`, shouldConnect(nb));
  }

  b.setPermutation(perm);
}

// Update all nearby fences (in 3x3 area)
function updateNearbyFences(x, y, z, dimension) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const loc = { x: x + dx, y: y, z: z + dz };
      const block = dimension.getBlock(loc);
      if (!block) continue;
      if (isCustomFence(block.typeId)) {
        updateFence(dimension, loc);
      }
    }
  }
}


// Your custom component as a class:
export class FencePlaceComponent {
  onPlace(event) {
    const { block, dimension } = event;

    const { x, y, z } = block.location;
    updateFence(dimension, { x, y, z });
    for (const { dx, dz } of Object.values(DIRS)) {
      updateFence(dimension, { x: x + dx, y, z: z + dz });
    }
  }

  onPlayerDestroy(event) {
    const { player, block, dimension, destroyedBlockPermutation } = event;
    
    const { x, y, z } = block.location;
 
      updateNearbyFences(x, y, z, dimension);
    ;
  }
}

/////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////




// Map of bottom-half IDs to their corresponding top-half IDs
const DOOR_PAIRS = {
  "zombie:demon_door_bottom": "zombie:demon_top",
  // add more pairs here as needed:
  // "namespace:my_second_door_bottom": "namespace:my_second_door_top",
};

// Helper to find door info for a given block type
function getDoorInfo(typeId) {
  for (const [bottomId, topId] of Object.entries(DOOR_PAIRS)) {
    if (typeId === bottomId) return { bottomId, topId, isTop: false };
    if (typeId === topId)    return { bottomId, topId, isTop: true  };
  }
  return null;
}

export class ZombieDoor {
  onPlace({ block, dimension }) {
    const info = getDoorInfo(block.typeId);
    // only handle bottom placement
    if (!info || info.isTop) return;

    const dir    = block.permutation.getState("minecraft:cardinal_direction");
    const isOpen = block.permutation.getState("zombie:is_open");
    const { x, y, z } = block.location;

    const topPerm = BlockPermutation
      .resolve(info.topId)
      .withState("minecraft:cardinal_direction", dir)
      .withState("zombie:is_open",               isOpen);

    dimension.setBlockPermutation({ x, y: y + 1, z }, topPerm);
  }

  onPlayerInteract({ block, dimension }) {
    const info = getDoorInfo(block.typeId);
    if (!info) return;

    const { x, y, z } = block.location;
    // determine bottom location
    const bottomLoc = info.isTop
      ? { x, y: y - 1, z }
      : { x, y,     z };

    // flip bottom half
    const bottom   = dimension.getBlock(bottomLoc);
    const currOpen = bottom.permutation.getState("zombie:is_open");
    const nextOpen = !currOpen;
    const newBottomPerm = bottom.permutation.withState("zombie:is_open", nextOpen);
    dimension.setBlockPermutation(bottomLoc, newBottomPerm);

    // flip top half only if it's our custom door-top
    const topLoc = { x: bottomLoc.x, y: bottomLoc.y + 1, z: bottomLoc.z };
    const top    = dimension.getBlock(topLoc);
    if (top.typeId === info.topId) {
      const newTopPerm = top.permutation.withState("zombie:is_open", nextOpen);
      dimension.setBlockPermutation(topLoc, newTopPerm);
    }

    // play door sound
    const soundId = nextOpen ? "open.wooden_door" : "close.wooden_door";
    dimension.playSound(soundId, block.location);
  }

  onPlayerDestroy({ block, dimension }) {
    const info = getDoorInfo(block.typeId);
    if (!info) return;

    const otherY = block.location.y + (info.isTop ? -1 : 1);
    const { x, z } = block.location;
    // remove the other half
    dimension.runCommandAsync(`setblock ${x} ${otherY} ${z} air destroy`);
  }
}



////////////////////////////////////SLABS/////////////////////////////////////////////////////

const doubleSlabMap = {
  "zombie:demon_plank_slab": {
    block: "zombie:demon_planks",
    sound: "dig.wood" // Use a suitable vanilla sound or your own custom sound event!
  },
  "zombie:demon_stone_slab": {
    block: "zombie:demon_stone",
    sound: "dig.stone"
  },
  "zombie:demon_steel_slab": {
    block: "zombie:demon_steel",
    sound: "dig.stone"
  }
  // Add more slab types here...
};

export class ZombieSlab {
  onPlayerInteract(event) {
    const { block, player } = event;
    if (!block || !player) return;

    const entry = doubleSlabMap[block.typeId];
    if (!entry) return;

    const item = player
      .getComponent("equippable")
      ?.getEquipment(EquipmentSlot.Mainhand);

    if (!item || item.typeId !== block.typeId) return;

    const { x, y, z } = block.location;
    const dimension = block.dimension;

    // Remove the slab and set the full block
    dimension.runCommandAsync(`setblock ${x} ${y} ${z} air`)
      .then(() => dimension.runCommandAsync(`setblock ${x} ${y} ${z} ${entry.block}`))
      .then(() => {
        // Play the place sound at the block location
        dimension.playSound(entry.sound, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
      });
  }
}
