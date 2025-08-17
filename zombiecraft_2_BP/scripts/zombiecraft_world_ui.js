import { world, system } from "@minecraft/server";
import {worldsettings} from "./system.run"
import {BrownbearChanceEffect,
        OnHitDamage,
        Openbox, 
        Open2, 
        Lights, 
        ColorLights, 
        SantaSword, 
        Christmas_Cookie, 
        RawFood, 
        Candycane, 
        TpOrb, 
        Crablegs, 
        CorruptedDamage, 
        LogStripper, 
        CustomOres} from "./custom_components/custom_components";
import { BowHold, chaosCrossbowExplosion} from "./custom_components/chaos_components/crossbow";
import {TheSight} from "./custom_components/chaos_components/sight";
import {Firefly2, FireflyFlicker,} from "./fireflys";
import {RedwoodGrowthComponent} from "./custom_components/plants/custom_trees";
import {Atlantis, OpenableComponent, FencePlaceComponent, ZombieDoor, ZombieSlab, PaintBrush, Painting} from "./blocks";
import { CropGrowthComponent } from "./custom_components/plants/grow";
import {  BlockShop } from "./playertoplayershop";
import {ChaosBookComponent} from "./magic/chaos";
import { SwordHit, BerserkerAttackController} from "./custom_components/chaos_components/chaos_sword";
import {CustomFishingRod} from "./custom_components/chaos_components/fishingpool"
import { ChaosXp} from "./custom_components/chaos_components/xp"
import {TppAxeSwing, BerserkerAxeController} from "./custom_components/chaos_components/battleaxe"
import {arrowEffect} from "./custom_components/chaos_components/chaos_arrow"
import {DemonGrass,TestDemon} from "./custom_components/chaos_components/generation"
import {AdminMenu} from "./admin_menu/adminmenu"
import {WarpMenu} from "./warpalter/warpalter_main"
import {TeleportBlock} from "./magic/teleport_block_script.js"
import {DayDream } from "./custom_components/food.js"
import {Mailbox} from "./magic/mailbox.js"
import {RedstoneComponent} from "./custom_components/redstone.js"
import {AlligatorEgg} from "./custom_components/alligator_egg.js"

// ——— define your component‐lists ———
const BLOCK_COMPONENTS = [
  ["zombie:redwood_saplin",       RedwoodGrowthComponent],
  ["zombie:open2",                Open2],
  ["zombie:open",                 Openbox],
  ["zombie:christmas_light",      Lights],
  ["zombie:christmas_light_colors", ColorLights],
  ["zombie:atlantis",             Atlantis],
  ["zombie:crop_grow",            CropGrowthComponent],
  ["zombie:shopblock",            BlockShop],
  ["zombie:corruptedDamage",      CorruptedDamage],
  ["zombie:demonGrass",           DemonGrass],
  ["zombie:strippedlog",          LogStripper],
  ["zombie:is_open",              OpenableComponent],
  ["zombie:fence_place",          FencePlaceComponent],
  ["zombie:door",                 ZombieDoor],
  ["zombie:slab",                 ZombieSlab],
  ["zombie:ores",                 CustomOres],
  ["zombie:warpstone",            WarpMenu],
  ["zombie:teleportblock",        TeleportBlock],
  ["zombie:mailbox",              Mailbox],
  ["zombie:redstone",             RedstoneComponent],
  ["zombie:alligator_egg",        AlligatorEgg]
];

const ITEM_COMPONENTS = [
  ["zombie:bearcheck",           BrownbearChanceEffect],
  ["zombie:onhitdamage",         OnHitDamage],
  ["zombie:firefly_flicker",     FireflyFlicker],
  ["zombie:santasword",          SantaSword],
  ["zombie:cookie",              Christmas_Cookie],
  ["zombie:rottenfood",          RawFood],
  ["zombie:candycane",           Candycane],
  ["zombie:tporb",               TpOrb],
  ["zombie:tppAxeSwing",         TppAxeSwing],
  ["zombie:fishing_rod",         CustomFishingRod],
  ["zombie:crablegs",            Crablegs],
  ["zombie:BowHold",             BowHold],
  ["zombie:chaos_book",          ChaosBookComponent],
  ["zombie:chaosxp",             ChaosXp],
  ["zombie:thesight",            TheSight],
  ["zombie:SwordHit",            SwordHit],
  ["zombie:sword",               BerserkerAttackController],
  ["zombie:axecontroller",       BerserkerAxeController],
  ["zombie:paintbrush",          PaintBrush],
  ["zombie:paintings",           Painting],
  ["zombie:adminmenu",           AdminMenu],
  ["zombie:daydream",            DayDream]
];

system.beforeEvents.startup.subscribe(({ blockComponentRegistry, itemComponentRegistry }) => {
  BLOCK_COMPONENTS.forEach(([id, Comp]) =>
    blockComponentRegistry.registerCustomComponent(id, new Comp())
  );
  ITEM_COMPONENTS.forEach(([id, Comp]) =>
    itemComponentRegistry.registerCustomComponent(id, new Comp())
  );
});

const SCRIPT_EVENT_HANDLERS = {
  "zombie:firefly2":    source => new Firefly2(source),
  "zombie:arroweffect": source => arrowEffect(source),
  "zombie:crossbow":    source => chaosCrossbowExplosion(source),
};

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  if (!sourceEntity) return;
  const handler = SCRIPT_EVENT_HANDLERS[id];
  if (handler) handler(sourceEntity);
});

// — Dynamic‐interval runner for worldsettings() —

// Running counter for ticks
let _tickCounter = 0;
// Only warn once if interval = 0
let _warnedNoInterval = false;

system.runInterval(() => {
  // Pull the current interval from dynamic properties
  const interval = world.getDynamicProperty("systemTickInterval") ?? 0;

  if (interval > 0) {
    // Reset the “no‐interval” warning
    _warnedNoInterval = false;

    // Increment and test
    _tickCounter++;
    if (_tickCounter >= interval) {
      _tickCounter = 0;
      worldsettings();
    }
  } else {
    // If it’s zero (or unset), warn once
    if (!_warnedNoInterval) {
      console.warn(
        "⚠️ systemTickInterval is 0 — " +
        "worldsettings() will not run. " +
        "Use Admin Menu → Set System Tick to configure."
      );
      _warnedNoInterval = true;
    }
  }
}, 1);
