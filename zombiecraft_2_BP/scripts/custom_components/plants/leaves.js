// custom_components/leaves_self_destruct_near_log.js
// 0 = init, 1 = off, 2 = watch
import { BlockPermutation } from "@minecraft/server";

const BLOCK_ID   = "zombie:redwood_leaves";
const STATE_NAME = "zombie:leaves_state";
const S_INIT = 0, S_OFF = 1, S_WATCH = 2;

const LOG_MATCH = /_log$/;   // any block id ending with "_log"
const SEARCH_R  = 6;         // radius to look for any log when detached

function setState(block, v) {
  block.setPermutation(BlockPermutation.resolve(BLOCK_ID, { [STATE_NAME]: v }));
}

function isLogBlock(b) {
  const id = b?.typeId;
  return !!id && LOG_MATCH.test(id);
}

function hasAdjacentLog(block) {
  const dim = block.dimension;
  const { x, y, z } = block.location;
  const nbr = [
    { x: x + 1, y, z }, { x: x - 1, y, z },
    { x, y: y + 1, z }, { x, y: y - 1, z },
    { x, y, z: z + 1 }, { x, y, z: z - 1 }
  ];
  for (const p of nbr) {
    const nb = dim.getBlock(p);
    if (nb && isLogBlock(nb)) return true;
  }
  return false;
}

function findLogInRadius(dim, origin, r = SEARCH_R) {
  const r2 = r * r;
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx*dx + dy*dy + dz*dz > r2) continue;
        const b = dim.getBlock({ x: origin.x + dx, y: origin.y + dy, z: origin.z + dz });
        if (b && isLogBlock(b)) return true;
      }
    }
  }
  return false;
}

function setNeighborsToWatch(block) {
  const dim = block.dimension;
  const { x, y, z } = block.location;
  const nbr = [
    { x: x + 1, y, z }, { x: x - 1, y, z },
    { x, y: y + 1, z }, { x, y: y - 1, z },
    { x, y, z: z + 1 }, { x, y, z: z - 1 }
  ];
  for (const p of nbr) {
    const nb = dim.getBlock(p);
    if (!nb || nb.typeId !== BLOCK_ID) continue;
    const s = nb.permutation.getState(STATE_NAME);
    if (s !== S_WATCH) {
      nb.setPermutation(BlockPermutation.resolve(BLOCK_ID, { [STATE_NAME]: S_WATCH }));
    }
  }
}

export class LeavesSelfDestructNearLog {
  static id = "zombie:leaves"; // matches your block component key in JSON

  onPlace(ev) {
    const b = ev?.block;
    if (!b || b.typeId !== BLOCK_ID) return;

    const s = b.permutation.getState(STATE_NAME);
    if (s !== S_INIT) return;

    if (hasAdjacentLog(b)) setState(b, S_WATCH);
    else setState(b, S_OFF);
  }

  onTick(ev) {
    const b = ev?.block;
    if (!b || b.typeId !== BLOCK_ID) return;

    const state = b.permutation.getState(STATE_NAME);

    if (state === S_INIT) {
      if (hasAdjacentLog(b)) setState(b, S_WATCH);
      else setState(b, S_OFF);
      return;
    }

    if (state !== S_WATCH) return;

    if (hasAdjacentLog(b)) return;

    const dim = b.dimension;
    const { x, y, z } = b.location;

    // If a log exists somewhere within SEARCH_R, go idle to avoid repeated scans.
    if (findLogInRadius(dim, { x, y, z }, SEARCH_R)) {
      setState(b, S_OFF);
      return;
    }

    // No logs nearby: fan out watch to neighbors, then remove self (drop loot)
    setNeighborsToWatch(b);
    dim.runCommand(`setblock ${x} ${y} ${z} air destroy`);
  }

  onPlayerDestroy(_ev) {}
}
