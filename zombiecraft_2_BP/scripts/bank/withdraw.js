// scripts/bank/withdraw.js
import { world, ItemStack } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

const DIAMOND_ID = "minecraft:diamond";
const SCORE_NAME = "Money";
const STACK_MAX = 64; // diamonds

export async function bankWithdraw(player) {
  try {
    ensureObjective(SCORE_NAME);
    const balance = getScore(player, SCORE_NAME);

    if ((balance ?? 0) <= 0) {
      tell(player, "§cYour balance is 0.");
      return;
    }

    const form = new ModalFormData()
      .title("§1Zombie§4Bank §7— §dWithdraw")
      .textField(
        `Your current §e${SCORE_NAME}§r: §a${balance}\nHow many diamonds to §dWITHDRAW§r?`,
        "number (e.g., 7)",
        ""
      );

    const res = await form.show(player);
    if (res.canceled) return;

    const raw = `${res.formValues?.[0] ?? ""}`.trim();
    const wanted = parseInt(raw, 10);

    if (!Number.isFinite(wanted) || wanted <= 0) {
      tell(player, "§cEnter a positive whole number.");
      return;
    }

    const amount = Math.min(wanted, balance);

    // Check inventory space BEFORE subtracting from scoreboard
    const room = diamondFreeSpace(player);
    if (room < amount) {
      tell(player, `§cNot enough inventory space. You can fit §b${room}§r diamonds right now.`);
      return;
    }

    // Subtract from scoreboard
    player.runCommandAsync(`scoreboard players remove @s ${SCORE_NAME} ${amount}`).catch(() => {});

    // Add items
    if (!addItems(player, DIAMOND_ID, amount)) {
      // rollback score if add failed (very unlikely after our space check)
      player.runCommandAsync(`scoreboard players add @s ${SCORE_NAME} ${amount}`).catch(() => {});
      tell(player, "§cCould not add diamonds. Try freeing inventory space.");
      return;
    }

    player.runCommandAsync(`playsound random.levelup @s`).catch(() => {});
    tell(player, `§aWithdrew §b${amount}§r diamonds.`);
  } catch (e) {
    console.warn("bankWithdraw error:", e);
    tell(player, "§cSomething went wrong with your withdrawal.");
  }
}

/* ---------- helpers ---------- */

function tell(player, msg) {
  try { player.sendMessage(msg); } catch {}
}

function ensureObjective(name) {
  try {
    const obj = world.scoreboard.getObjective(name);
    if (!obj) world.scoreboard.addObjective(name, name);
  } catch {
    try { world.getDimension("overworld").runCommand(`scoreboard objectives add ${name} dummy`); } catch {}
  }
}

function getScore(player, name) {
  try {
    const obj = world.scoreboard.getObjective(name);
    if (!obj) return 0;
    const id = player.scoreboardIdentity;
    if (!id) return 0;
    const s = obj.getScore(id);
    return typeof s === "number" ? s : 0;
  } catch { return 0; }
}

function diamondFreeSpace(player) {
  const inv = player?.getComponent("minecraft:inventory")?.container;
  if (!inv) return 0;

  let space = 0;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (!it) {
      space += STACK_MAX;               // empty slot can hold a full stack
    } else if (it.typeId === DIAMOND_ID && it.amount < STACK_MAX) {
      space += (STACK_MAX - it.amount); // top up partial stacks
    }
  }
  return space;
}

function addItems(player, typeId, amount) {
  const inv = player?.getComponent("minecraft:inventory")?.container;
  if (!inv) return false;
  let left = amount;

  // 1) Fill partial stacks first
  for (let i = 0; i < inv.size && left > 0; i++) {
    const it = inv.getItem(i);
    if (!it || it.typeId !== typeId || it.amount >= STACK_MAX) continue;
    const add = Math.min(STACK_MAX - it.amount, left);
    it.amount += add;
    left -= add;
    inv.setItem(i, it);
  }

  // 2) Use empty slots
  for (let i = 0; i < inv.size && left > 0; i++) {
    const it = inv.getItem(i);
    if (it) continue;
    const add = Math.min(STACK_MAX, left);
    const stack = new ItemStack(typeId, add);
    inv.setItem(i, stack);
    left -= add;
  }

  return left === 0;
}
