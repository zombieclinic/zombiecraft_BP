
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
        target.runCommand(`tp @s ${nx} ${y.toFixed(2)} ${nz}`);
      },

      // 5) Sky-launch: teleport 30 blocks up
      target => {
        const { x, y, z } = target.location;
        target.runCommand(
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


