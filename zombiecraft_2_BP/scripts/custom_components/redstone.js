
export class RedstoneComponent {
  onTick(event) {
    const block = event.block;
    const pos = block.location;
    const dim = block.dimension;

    const directions = [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 }
    ];

    let maxPowerLevel = 0;

    for (const direction of directions) {
      const neighborPos = {
        x: pos.x + direction.x,
        y: pos.y + direction.y,
        z: pos.z + direction.z
      };

      try {
        const neighborBlock = dim.getBlock(neighborPos);
        const currentPowerLevel = neighborBlock.getRedstonePower();

        if (currentPowerLevel && currentPowerLevel > maxPowerLevel) {
          maxPowerLevel = currentPowerLevel;
        }
      } catch (error) {}
    }

    try {
      if (!block || block.typeId === "minecraft:air") return;

      const isPowered = maxPowerLevel > 0;
      const newPermutation = block.permutation.withState("zombie:powered", isPowered ? 1 : 0);
      block.setPermutation(newPermutation);
    } catch (e) {}
  }
}
