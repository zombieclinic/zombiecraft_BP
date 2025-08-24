import { world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

const DIAMOND_ID = "minecraft:diamond";
const SCORE_NAME = "Money";

export async function bankDeposit(player) {
  try {
    const diamonds = countItem(player, DIAMOND_ID);
    if (diamonds <= 0) return say(player, "§cYou don’t have any diamonds to deposit.");

    const form = new ModalFormData().title("§1Zombie§4Bank §7— §bDeposit");
    addTextField(
      form,
      `You have §b${diamonds}§r diamonds.\nHow many would you like to §aDEPOSIT§r?`,
      "number (e.g., 7)",
      ""
    );
    const res = await form.show(player);
    if (res.canceled) return;

    const wanted = parseInt(String(res.formValues?.[0] ?? "").trim(), 10);
    if (!Number.isFinite(wanted) || wanted <= 0) return say(player, "§cEnter a positive whole number.");

    const amount = Math.min(wanted, diamonds);

    if (!removeItems(player, DIAMOND_ID, amount)) {
      return say(player, "§cCould not remove diamonds (inventory changed). Try again.");
    }

    const newScore = addToScore(player, SCORE_NAME, amount);
    if (newScore == null) return say(player, "§cScoreboard error. Deposit rolled back.");

    ding(player);
    say(player, `§aDeposited §b${amount}§r diamonds → §e§4Z§2Coins§r = §a${newScore}§r.`);
  } catch (e) {
    console.warn("bankDeposit error:", e);
    say(player, "§cSomething went wrong with your deposit.");
  }
}

/* ---------- helpers ---------- */

function addTextField(form, label, placeholder, defVal) {
  try { form.textField(label, placeholder ?? "", { defaultValue: defVal ?? "" }); return; } catch {}
  try { form.textField(label, placeholder ?? "", defVal ?? ""); return; } catch {}
  form.textField(label);
}

function say(p, msg) { try { p.sendMessage(msg); } catch {} }

function getObjective(name) {
  let obj = world.scoreboard.getObjective(name);
  if (!obj) obj = world.scoreboard.addObjective(name, name);
  return obj;
}

function addToScore(player, objectiveName, delta) {
  try {
    const obj = getObjective(objectiveName);
    const id = player.scoreboardIdentity;
    const cur = obj.getScore(id) ?? 0;
    const next = cur + delta;
    obj.setScore(id, next);
    return next;
  } catch (e) {
    console.warn("addToScore failed:", e);
    return null;
  }
}

function countItem(player, typeId) {
  const inv = player?.getComponent("minecraft:inventory")?.container;
  if (!inv) return 0;
  let total = 0;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it && it.typeId === typeId) total += it.amount;
  }
  return total;
}

function removeItems(player, typeId, amount) {
  const inv = player?.getComponent("minecraft:inventory")?.container;
  if (!inv) return false;
  let left = amount;
  for (let i = 0; i < inv.size && left > 0; i++) {
    const it = inv.getItem(i);
    if (!it || it.typeId !== typeId) continue;
    const take = Math.min(left, it.amount);
    it.amount -= take;
    left -= take;
    if (it.amount <= 0) inv.setItem(i, undefined);
    else inv.setItem(i, it);
  }
  return left === 0;
}

function ding(player) {
  try { player.runCommand?.(`playsound random.levelup @s`); } catch {}
  try {
    const d = player.dimension, { x, y, z } = player.location ?? {};
    d?.runCommand?.(`playsound random.levelup ${x ?? 0} ${y ?? 0} ${z ?? 0}`);
  } catch {}
}
