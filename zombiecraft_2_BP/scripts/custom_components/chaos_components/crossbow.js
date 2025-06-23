

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
  dim.runCommand(`particle zombie:choas_particle22 ${origin.x} ${origin.y} ${origin.z}`);

  // 2. Play explosion sound
  dim.runCommand(`playsound zombie.bfc.explode @a ${origin.x} ${origin.y} ${origin.z} 1 1 64`);

  // 3. Kill all entities (except the arrow) in radius
  const targets = dim
    .getEntities({ location: origin, maxDistance: EXPLOSION_RADIUS })
    .filter(e => e.id !== arrow.id);

  for (const entity of targets) {
    entity.applyDamage(1000, null); // Instant death
  }
}