import {BlockPermutation, EquipmentSlot, Player, GameMode, ItemComponentTypes} from "@minecraft/server"

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
                dimension.runCommand(
                    `setblock ${block.location.x} ${block.location.y} ${block.location.z} air`
                );
                dimension.runCommand(
                    `setblock ${block.location.x} ${block.location.y} ${block.location.z} ${newBlockType}`
                );
            }
        };
    }
}



const OPEN_STATE_KEYS = [
  "zombie:is_open",
  "zombie:open"
];

function findOpenKey(perm) {
  for (const k of OPEN_STATE_KEYS) {
    try {
      const v = perm.getState(k);
      if (v !== undefined) return k;
    } catch {}
  }
  return null;
}

function flipValue(v) {
  // Booleans
  if (typeof v === "boolean") return !v;
  // Numeric 0/1
  if (typeof v === "number")  return v ? 0 : 1;
  // String enums some packs use
  if (typeof v === "string") {
    if (v === "true" || v === "false") return v === "true" ? "false" : "true";
    if (v === "open" || v === "closed") return v === "open" ? "closed" : "open";
  }
  return undefined; // unknown format → no-op
}

export class OpenableComponent {
  onPlayerInteract({ block }) {
    if (!block) return;

    const perm = block.permutation;
    const key  = findOpenKey(perm);
    if (!key) return;

    const cur  = perm.getState(key);
    const next = flipValue(cur);
    if (next === undefined) return;

    block.setPermutation(perm.withState(key, next));
  }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// fence_connect_strict.js
// Bedrock custom fence connector (zombie:* fences only).
// - Connects to: vanilla/custom fences; vanilla/custom gates (perpendicular rule); true full cubes
// - Ignores: slabs, stairs, snow layers, carpets, doors, trapdoors, panes/bars, walls, foliage, thin covers
// - Runs from a ticking component; only writes permutation if states actually change.

const DIRS = {
  north: { dx:  0, dz: -1 },
  south: { dx:  0, dz:  1 },
  west:  { dx: -1, dz:  0 },
  east:  { dx:  1, dz:  0 },
};

/* ---------------- ID helpers ---------------- */
const starts = (id,p)=>!!id && id.startsWith(p);
const ends   = (id,s)=>!!id && id.endsWith(s);

const isFenceId     = id => ends(id, "_fence");
const isFenceGateId = id => ends(id, "_fence_gate");

const isVanillaFence     = id => starts(id, "minecraft:") && isFenceId(id);
const isVanillaFenceGate = id => starts(id, "minecraft:") && isFenceGateId(id);
const isCustomFence      = id => starts(id, "zombie:")    && isFenceId(id);
const isCustomFenceGate  = id => starts(id, "zombie:")    && isFenceGateId(id);

// Only update OUR fence blocks (not gates)
function isOurFenceBlock(id) { return isCustomFence(id); }

/* ------------- full-cube detection ------------- */
// Optional override on blocks that should/shouldn't be considered full cubes.
function explicitFullCubeFlag(nb) {
  try {
    const v = nb.permutation.getState("zombie:connect_full_block");
    if (v !== undefined) return !!v;
  } catch {}
  return undefined;
}

function isPartialByStates(nb) {
  const p = nb.permutation;

  // Slabs: only "double" is full cube
  try {
    const vh = p.getState("minecraft:vertical_half"); // "top"|"bottom"|"double"
    if (vh !== undefined) return vh !== "double";
  } catch {}

  // Stairs: any stair is partial
  try {
    const ud = p.getState("minecraft:upside_down_bit");
    if (ud !== undefined) return true;
  } catch {}

  // Snow layers / layered blocks
  try {
    const layers = p.getState("minecraft:layers") ?? p.getState("minecraft:height");
    if (layers !== undefined) return true;
  } catch {}

  return false;
}

function isFullCubeByName(id) {
  if (!id || id === "minecraft:air") return false;

  // clear partial/thin blocks
  if (/_slab$|_stairs$|_door$|_trapdoor$|_carpet$|_button$|_lever$|_pressure_plate$|_scaffolding$|_ladder$|_vine$|_torch$|_campfire$|_wall$|_pane$|_fence(?:_gate)?$|_sign$|_banner$/i.test(id)) return false;

  // foliage / thin covers
  if (/leaves|leaf|fallen|flower|grass|tall_grass|fern|mushroom|bamboo|kelp|sugar_cane|lily_pad/i.test(id)) return false;

  return true;
}

function connectsLikeFullCube(nb) {
  if (!nb) return false;
  const override = explicitFullCubeFlag(nb);
  if (override !== undefined) return override;
  if (isPartialByStates(nb))   return false;
  return isFullCubeByName(nb.typeId);
}

/* ------------- gate orientation ------------- */
// Try both props; different packs expose different ones
function gateFacing(nb) {
  const p = nb.permutation;
  try {
    const s = p.getState("minecraft:cardinal_direction");
    if (s) return s; // "north"|"south"|"east"|"west"
  } catch {}
  try {
    const d = p.getState("minecraft:direction"); // 0..3 -> S,W,N,E
    if (d !== undefined) return ["south","west","north","east"][d & 3];
  } catch {}
  return undefined;
}

// Fences connect to the SIDES of a gate (perpendicular to its facing)
function connectsToGateFrom(dir, nb) {
  const f = gateFacing(nb);
  if (!f) return true; // if unknown, be permissive
  if (f === "east" || f === "west") {
    return dir === "north" || dir === "south";
  }
  if (f === "north" || f === "south") {
    return dir === "east" || dir === "west";
  }
  return true;
}

/* ------------- decide connection for a direction ------------- */
function shouldConnectDir(dimension, loc, dir) {
  const { dx, dz } = DIRS[dir];
  const nb = dimension.getBlock({ x: loc.x + dx, y: loc.y, z: loc.z + dz });
  if (!nb) return false;

  const id = nb.typeId;

  // fence ↔ fence
  if (isVanillaFence(id) || isCustomFence(id)) return true;

  // fence ↔ gate (perpendicular rule)
  if (isVanillaFenceGate(id) || isCustomFenceGate(id)) {
    return connectsToGateFrom(dir, nb);
  }

  // Otherwise only connect to true full cubes
  return connectsLikeFullCube(nb);
}

/* ------------- apply states if changed ------------- */
function applyFenceStatesIfChanged(block, mask) {
  let perm = block.permutation;
  let changed = false;

  // optional one-shot transform flag
  try {
    const onPlaced = perm.getState("zombie:on_placed");
    if (onPlaced === false) {
      perm = perm.withState("zombie:on_placed", true);
      changed = true;
    }
  } catch {}

  for (const k of Object.keys(DIRS)) {
    const cur = perm.getState(`zombie:${k}`);
    if (cur !== mask[k]) {
      perm = perm.withState(`zombie:${k}`, mask[k]);
      changed = true;
    }
  }

  if (changed) block.setPermutation(perm);
  return changed;
}

/* ------------- public update helpers ------------- */
function updateFence(dimension, loc) {
  const b = dimension.getBlock(loc);
  if (!b || !isOurFenceBlock(b.typeId)) return false;

  const mask = {
    north: shouldConnectDir(dimension, loc, "north"),
    south: shouldConnectDir(dimension, loc, "south"),
    west:  shouldConnectDir(dimension, loc, "west"),
    east:  shouldConnectDir(dimension, loc, "east"),
  };
  return applyFenceStatesIfChanged(b, mask);
}

function updateNeighbors(dimension, x, y, z) {
  for (const { dx, dz } of Object.values(DIRS)) {
    updateFence(dimension, { x: x + dx, y, z: z + dz });
  }
}

/* ------------- component (tick every 20) ------------- */
export class FenceConnectComponent {
  onTick(event) {
    const { block, dimension } = event;
    if (!block || !dimension) return;
    const { x, y, z } = block.location;
    if (updateFence(dimension, { x, y, z })) {
      // only nudge neighbors when something actually changed
      updateNeighbors(dimension, x, y, z);
    }
  }

  onPlayerDestroy(event) {
    const { block, dimension } = event;
    if (!block || !dimension) return;
    const { x, y, z } = block.location;
    updateNeighbors(dimension, x, y, z);
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



export class PaintBrush {
  onUseOn(event) {
    const { block, source: player } = event;
    if (!(player instanceof Player)) return;
    if (block.typeId !== "zombie:painting_easel") return;

    // Uncomment if you only want this in Survival
    // if (!player.matches({ gameMode: GameMode.survival })) return;

    // Consume ONE zombie:canvus from inventory
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return;

    let consumed = false;
    for (let i = 0; i < inv.size; i++) {
      const stack = inv.getItem(i);
      if (stack?.typeId === "zombie:canvus") {
        if (stack.amount > 1) {
          stack.amount -= 1;
          inv.setItem(i, stack);
        } else {
          inv.setItem(i); // clear slot
        }
        consumed = true;
        break;
      }
    }

    if (!consumed) {
      player.sendMessage("§cYou need a canvas to use the easel.");
      return;
    }

    // Swap the easel state + sound
    const states = block.permutation.getAllStates();
    block.setPermutation(BlockPermutation.resolve("zombie:painting_easel_canvus", states));

    const { x, y, z } = block.location;
    block.dimension.runCommand(`playsound dig.wood @a ${x} ${y} ${z}`);
  }
}




export class Painting {
  onUseOn(event) {
    const { block, source: player } = event;

    // only on canvas easel in survival
    if (
      !(player instanceof Player) ||
      !player.matches({ gameMode: GameMode.survival }) ||
      block.typeId !== "zombie:painting_easel_canvus"
    )
      return;

    const inv = player.getComponent("minecraft:inventory").container;
    const slot = player.selectedSlotIndex;
    const brush = inv.getItem(slot);
    if (
      !brush ||
      brush.typeId !== "zombie:paint_brush" ||
      !brush.hasComponent(ItemComponentTypes.Durability)
    )
      return;

    // --- DURABILITY HANDLING ---
    const newBrush = brush.clone();
    const dur = newBrush.getComponent(ItemComponentTypes.Durability);
    const amount = Math.floor(Math.random() * 10) + 1; // 1–10
    const wouldBe = dur.damage + amount;
    const { x, y, z } = block.location;

    if (wouldBe >= dur.maxDurability) {
      // play break sound, then remove
      player.dimension.runCommand(
        `playsound random.break @a ${x} ${y} ${z}`
      );
      inv.setItem(slot, undefined);
    } else {
      dur.damage = wouldBe;
      inv.setItem(slot, newBrush);
    }

    // --- EASEL, LOOT, PARTICLES & SOUND as before ---
    const states = block.permutation.getAllStates();
    const normalPerm = BlockPermutation.resolve(
      "zombie:painting_easel",
      states
    );
    block.setPermutation(normalPerm);

    player.dimension.runCommand(
      `loot spawn ${x + 0.5} ${y + 2} ${z + 0.5} loot "paintings/wood_paint_brush"`
    );

    const dir = states["minecraft:cardinal_direction"];
    const particle = dir === "north" || dir === "south"
      ? "zombie:rainbow"
      : "zombie:rainbow2";
    player.dimension.runCommand(
      `particle ${particle} ${x + 0.5} ${y} ${z + 0.5}`
    );

    player.dimension.runCommand(`playsound painting @a ${x} ${y} ${z}`);
  }
}