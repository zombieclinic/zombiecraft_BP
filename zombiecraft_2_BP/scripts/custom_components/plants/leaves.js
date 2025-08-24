// custom_components/leaves_self_destruct_near_log.js
export class LeavesSelfDestructNearLog {
  static id = "zombie:leaves_self_destruct_near_log";

  onTick(ev) {
    const block = ev?.block;
    if (!block) return;

    const dim = block.dimension;
    const { x, y, z } = block.location;

    const r = 2;
    const r2 = r * r;

    // look for ANY block ending with "_log" within a sphere of radius 7
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue; // skip self
          if (dx * dx + dy * dy + dz * dz > r2) continue; // sphere

          const nb = dim.getBlock({ x: x + dx, y: y + dy, z: z + dz });
          if (!nb) continue;

          const id = nb.typeId;
          if (id && id.endsWith("_log")) {
            // safe: a log is nearby
            return;
          }
        }
      }
    }

    // no log found: destroy this leaves block (drop loot)
    dim.runCommand(`setblock ${x} ${y} ${z} air destroy`);
  }
}
