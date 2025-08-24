
import {
  world,
  system,
  EquipmentSlot,
  EntityComponentTypes,
  EntityDamageCause,
  Player,
} from "@minecraft/server";

// ---- IDs ----
const TICKING_GRASS   = "zombie:infected_alive_grass";
const INERT_GRASS     = "zombie:infected_grass_block";
const INFECTED_BLOCK  = "zombie:infected_block";
const INFECTED_LOG    = "zombie:infected_tree_log";
const INFECTED_LEAVES = "zombie:infected_leaves";
const INFECTED_MUSH   = "zombie:infected_mushroom";

// ---- Tunables (balance these if you need even less CPU) ----
const JOB_BUDGET_PER_TICK = 96;   // total work per tick across all jobs

// How far a tree job can roam from its seed log:
const MAX_TREE_RADIUS_XZ = 10;    // horizontal reach (±10) ~ 21×21 canopy
const MAX_TREE_UP        = 48;    // how far the job may climb above seed
const MAX_TREE_DOWN      = 12;    // how far below the seed it may step
const MAX_NODES_PER_JOB  = 4500;  // hard stop so merged canopies don't run forever

// Vertical probing around a ticking grass block to find a trunk:
const MAX_SCAN_UP        = 48;    // lets us see the top of tall jungles
const MAX_SCAN_DOWN      = 4;

const MUSHROOM_CHANCE    = 0.06;

// Faces (tree worker)
const FACES = [
  {dx: 1, dy: 0, dz: 0}, {dx: -1, dy: 0, dz: 0},
  {dx: 0, dy: 1, dz: 0}, {dx: 0, dy: -1, dz: 0},
  {dx: 0, dy: 0, dz: 1}, {dx: 0, dy: 0, dz: -1},
];

// 26-neighborhood for spread/demotion (faces first -> diagonals)
const NEAR_OFFSETS = (() => {
  const arr = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dy && !dz) continue;
        const w = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
        arr.push({ dx, dy, dz, w });
      }
  arr.sort((a, b) => a.w - b.w);
  return arr;
})();

/* =============== TREE JOB WORKER =============== */
let WORKER_STARTED = false;
const JOBS = [];
const JOB_KEYS_INFLIGHT = new Set();

function startWorkerOnce() {
  if (WORKER_STARTED) return;
  WORKER_STARTED = true;
  system.runInterval(() => {
    let budget = JOB_BUDGET_PER_TICK;
    for (let i = 0; i < JOBS.length && budget > 0; i++) {
      const job = JOBS[i];
      budget -= processJob(job, budget);
      if (job.queue.length === 0) {
        JOB_KEYS_INFLIGHT.delete(job.key);
        JOBS.splice(i, 1);
        i--;
      }
    }
  }, 1);
}

function startJob(dimId, sx, sy, sz) {
  const key = `${dimId}|${sx},${sy},${sz}`;
  if (JOB_KEYS_INFLIGHT.has(key)) return;
  JOB_KEYS_INFLIGHT.add(key);
  JOBS.push({
    key, dimId, sx, sy, sz,
    queue: [{ x: sx, y: sy, z: sz }],
    seen: new Set(),
    nodes: 0,
  });
}

function processJob(job, budget) {
  let steps = 0;
  const dim = world.getDimension(job.dimId);
  if (!dim) return budget;

  while (steps < budget && job.queue.length) {
    if (job.nodes > MAX_NODES_PER_JOB) { // safety valve
      job.queue.length = 0;
      break;
    }

    const n = job.queue.pop();
    const k = `${n.x},${n.y},${n.z}`;
    if (job.seen.has(k)) continue;
    job.seen.add(k);
    job.nodes++;

    // anisotropic bounds (wide X/Z, much taller Y)
    const dx = Math.abs(n.x - job.sx);
    const dz = Math.abs(n.z - job.sz);
    const dy = n.y - job.sy;
    if (dx > MAX_TREE_RADIUS_XZ || dz > MAX_TREE_RADIUS_XZ) continue;
    if (dy > MAX_TREE_UP || -dy > MAX_TREE_DOWN) continue;

    const b = dim.getBlock(n);
    if (!b) continue;

    const id = b.typeId;

    if (isLogLike(id)) {
      if (id !== INFECTED_LOG) safeSetType(b, INFECTED_LOG);
      for (const f of FACES) job.queue.push({ x: n.x + f.dx, y: n.y + f.dy, z: n.z + f.dz });

      // pull adjacent leaves into queue early so we convert crowns fully
      for (const f of FACES) {
        const nb = dim.getBlock({ x: n.x + f.dx, y: n.y + f.dy, z: n.z + f.dz });
        if (nb && isLeaf(nb.typeId)) job.queue.push({ x: n.x + f.dx, y: n.y + f.dy, z: n.z + f.dz });
      }
      steps++;
      continue;
    }

    if (isLeaf(id)) {
      if (id !== INFECTED_LEAVES) safeSetType(b, INFECTED_LEAVES);
      for (const f of FACES) job.queue.push({ x: n.x + f.dx, y: n.y + f.dy, z: n.z + f.dz });
      steps++;
    }
  }
  return steps;
}

/* ================== SPREADER COMPONENT ================== */

export class InfectedGrass {
  constructor() {
    this.onTick = this.onTick.bind(this);
    startWorkerOnce();
  }

  onTick(event) {
    const { block, dimension } = event;
    if (block.typeId !== TICKING_GRASS) return;

    const { x, y, z } = block.location;
    const dimId = dimension.id;

    // 1) Find a VANILLA log (up a lot, down a little) and start one job
    let startedTree = false;

    // up (3×3 shafts around the source)
    outerUp:
    for (let fx = -1; fx <= 1; fx++) {
      for (let fz = -1; fz <= 1; fz++) {
        for (let off = 1; off <= MAX_SCAN_UP; off++) {
          const yy = y + off;
          const b  = dimension.getBlock({ x: x + fx, y: yy, z: z + fz });
          if (!b) break;
          const id = b.typeId;
          if (isVanillaLogLike(id)) { startJob(dimId, x + fx, yy, z + fz); startedTree = true; break outerUp; }
          if (id !== "minecraft:air" && !isLeaf(id)) break; // hit solid, stop this column
        }
      }
    }

    // down (short probe for buried trunks/roots)
    if (!startedTree) {
      outerDown:
      for (let fx = -1; fx <= 1; fx++) {
        for (let fz = -1; fz <= 1; fz++) {
          for (let off = 1; off <= MAX_SCAN_DOWN; off++) {
            const yy = y - off;
            const b  = dimension.getBlock({ x: x + fx, y: yy, z: z + fz });
            if (!b) break;
            const id = b.typeId;
            if (isVanillaLogLike(id)) { startJob(dimId, x + fx, yy, z + fz); startedTree = true; break outerDown; }
            if (id !== "minecraft:air" && !isLeaf(id)) break;
          }
        }
      }
    }

    // 2) Do at most ONE neighbor conversion (faces first, then diagonals)
    let didSpread = false;
    for (const o of NEAR_OFFSETS) {
      const tx = x + o.dx, ty = y + o.dy, tz = z + o.dz;
      const tgt = dimension.getBlock({ x: tx, y: ty, z: tz });
      if (!tgt) continue;

      const id = tgt.typeId;

      if (id === "minecraft:grass_block") {
        safeSetType(tgt, TICKING_GRASS);
        maybePlaceMushroom(dimension, tx, ty + 1, tz);
        didSpread = true; break;
      }

      if (isDirtLike(id)) {
        safeSetType(tgt, INFECTED_BLOCK);
        maybePlaceMushroom(dimension, tx, ty + 1, tz);
        didSpread = true; break;
      }

      if (!startedTree && (isVanillaLogLike(id) || isVanillaLeaf(id))) {
        startJob(dimId, tx, ty, tz);
        didSpread = true; break;
      }
    }

    // 3) Demote if NO spread targets exist in the 26-neighborhood
    if (!didSpread && !startedTree && !hasSpreadTargetsNearby(dimension, x, y, z)) {
      if (block.typeId !== INERT_GRASS) safeSetType(block, INERT_GRASS);
    }
  }
}

/* ================== Utils ================== */

function safeSetType(block, id) {
  try { block.setType(id); } catch (_) {}
}

// Worker uses broader checks (so it can walk through infected nodes too)
function isLogLike(id) {
  if (!id) return false;
  if (id.endsWith("_log") || id.endsWith("_wood") || id.endsWith("_stem")) return true;
  if (!id.startsWith("minecraft:stripped_")) return false;
  return id.endsWith("_log") || id.endsWith("_wood") || id.endsWith("_stem");
}
function isLeaf(id) { return !!id && id.endsWith("_leaves"); }

// VANILLA-only checks for deciding if we can still spread
function isVanillaLogLike(id) {
  return !!id && id.startsWith("minecraft:") &&
    (id.endsWith("_log") || id.endsWith("_wood") || id.endsWith("_stem") ||
     (id.startsWith("minecraft:stripped_") && (id.endsWith("_log") || id.endsWith("_wood") || id.endsWith("_stem"))));
}
function isVanillaLeaf(id) {
  return !!id && id.startsWith("minecraft:") && id.endsWith("_leaves");
}

// dirt-likes (vanilla)
function isDirtLike(id) {
  switch (id) {
    case "minecraft:dirt":
    case "minecraft:coarse_dirt":
    case "minecraft:podzol":
    case "minecraft:rooted_dirt":
    case "minecraft:farmland":
    case "minecraft:mud":
    case "minecraft:dirt_path":
      return true;
    default: return false;
  }
}

// true if a block is a convertible target (vanilla grass/dirt/logs/leaves)
function isSpreadTarget(id) {
  return id === "minecraft:grass_block" || isDirtLike(id) || isVanillaLogLike(id) || isVanillaLeaf(id);
}

function hasSpreadTargetsNearby(dimension, x, y, z) {
  for (const o of NEAR_OFFSETS) {
    const b = dimension.getBlock({ x: x + o.dx, y: y + o.dy, z: z + o.dz });
    if (!b) continue;
    if (isSpreadTarget(b.typeId)) return true;
  }
  return false;
}

function maybePlaceMushroom(dimension, x, y, z) {
  const above = dimension.getBlock({ x, y, z });
  if (above && above.typeId === "minecraft:air" && Math.random() < MUSHROOM_CHANCE) {
    safeSetType(above, INFECTED_MUSH);
  }
}


export class infectedAttack {
  constructor() {}

  onHitEntity(arg) {
    const attacker = arg.attackingEntity;
    const target   = arg.hitEntity;
    if (!attacker || !target) return;

    // --- count infected gear pieces (+claws in main hand) ---
    const equippable = attacker.getComponent(EntityComponentTypes.Equippable);
    if (!equippable) return;

    let setInfected = 0;

    const hasEquippedItem = (itemName, slot) => {
      const item = equippable.getEquipment(slot);
      return !!item && item.typeId === itemName;
    };

    if (hasEquippedItem("zombie:infected_helmet",     EquipmentSlot.Head))  setInfected++;
    if (hasEquippedItem("zombie:infected_chestplate", EquipmentSlot.Chest)) setInfected++;
    if (hasEquippedItem("zombie:infected_leggings",   EquipmentSlot.Legs))  setInfected++;
    if (hasEquippedItem("zombie:infected_boots",      EquipmentSlot.Feet))  setInfected++;

    // main hand claws (only reliable on players)
    if (attacker instanceof Player) {
      const inv = attacker.getComponent("minecraft:inventory");
      if (inv) {
        const it = inv.container.getItem(attacker.selectedSlotIndex);
        if (it && it.typeId === "zombie:brown_bear_claws") setInfected++;
      }
    }

    // --- chance table (5/10/15/20/25 %) ---
    let chance = 0;
    switch (setInfected) {
      case 1: chance = 0.05; break;
      case 2: chance = 0.10; break;
      case 3: chance = 0.15; break;
      case 4: chance = 0.20; break;
      case 5: chance = 0.25; break;
      default: chance = 0;   break;
    }
    if (chance <= 0 || Math.random() >= chance) return;

    // --- apply 1 dmg/sec for 5s (anti-stack with a tag) ---
    const TAG = "infected_bleed";
    if (target.hasTag(TAG)) return;           // don't stack
    target.addTag(TAG);

    const SECONDS = 5;
    const TPS = 20;

    for (let i = 0; i < SECONDS; i++) {
      system.runTimeout(() => {
        if (!target.isValid()) return;
        try {
          // New signature
          target.applyDamage(1, { cause: EntityDamageCause.magic, damagingEntity: attacker });
        } catch {
          // Old signature fallback (amount only)
          try { target.applyDamage(1); } catch {}
        }
      }, i * TPS);
    }

    // remove anti-stack tag after it finishes
    system.runTimeout(() => {
      if (target.isValid()) target.removeTag(TAG);
    }, SECONDS * TPS + 1);
  }
}