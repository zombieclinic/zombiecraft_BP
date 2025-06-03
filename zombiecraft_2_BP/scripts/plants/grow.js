import { EntityInventoryComponent } from "@minecraft/server";


export class CropGrowthComponent {
    static tryGrowBlock(block /** @type Block */) {
        const perm = block.permutation;
        const age = perm.getState("zombie:crop_age");
        if (age === undefined || typeof age !== "number") {
            return;
        }
        if (age === 5) {
            return; // already at max age
        }
        block.setPermutation(perm.withState("zombie:crop_age", age + 1));
    }

    static tryFertilize(block /** @type Block */, player /** @type Player */) {
        var _a, _b;
        const inventory = player.getComponent(EntityInventoryComponent.componentId);
        if (inventory === undefined) {
            return false;
        }
        const selectedItem = (_a = inventory.container) === null || _a === void 0 ? void 0 : _a.getItem(player.selectedSlotIndex);
        if (selectedItem && selectedItem.typeId === "minecraft:bone_meal") {
            CropGrowthComponent.tryGrowBlock(block);

            // Trigger the particle effect
            const pos = block.location;
            player.runCommand(`particle minecraft:crop_growth_emitter ${pos.x} ${pos.y} ${pos.z}`);

            if (selectedItem.amount > 1) {
                selectedItem.amount--;
                (_b = inventory.container) === null || _b === void 0 ? void 0 : _b.setItem(player.selectedSlotIndex, selectedItem);
            } else {
                // Remove the item from the inventory if the amount is 1
                (_b = inventory.container) === null || _b === void 0 ? void 0 : _b.setItem(player.selectedSlotIndex, undefined);
            }

            return true;
        }
        return false;
    }

    onRandomTick(arg /** @type BlockComponentRandomTickEvent */) {
        CropGrowthComponent.tryGrowBlock(arg.block);
    }

    onPlayerInteract(arg /** @type BlockComponentPlayerInteractEvent */) {
        if (arg.player === undefined) {
            return;
        }
        CropGrowthComponent.tryFertilize(arg.block, arg.player);
    }
}




