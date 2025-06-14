import { world, system } from "@minecraft/server";
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
        DemonGrass,
        CustomOres,
        TestDemon,
        arrowEffect,
        TppAxeSwing,
        BowHold,
        chaosCrossbowExplosion,
        CustomFishingRod,
        DemonSword
        } from "./custom_components";
import {Firefly2, FireflyFlicker,} from "./fireflys";
import {RedwoodGrowthComponent} from "./plants/custom_trees";
import {Atlantis, OpenableComponent, FencePlaceComponent, ZombieDoor, ZombieSlab,} from "./blocks";
import { CropGrowthComponent } from "./plants/grow";
import {  BlockShop } from "./playertoplayershop";
import { WarpAtlas } from "./warpalter/warpalter";
import { securityCheck } from "./warpalter/security";
import {ChaosBookComponent} from "./magic/chaos"

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
  ["zombie:warpalter",            WarpAtlas],
  ["zombie:corruptedDamage",      CorruptedDamage],
  ["zombie:demonGrass",           DemonGrass],
  ["zombie:strippedlog",          LogStripper],
  ["zombie:is_open",              OpenableComponent],
  ["zombie:fence_place",          FencePlaceComponent],
  ["zombie:door",                 ZombieDoor],
  ["zombie:slab",                 ZombieSlab],
  ["zombie:ores",                 CustomOres],
];

const ITEM_COMPONENTS = [
  ["zombie:bearcheck",      BrownbearChanceEffect],
  ["zombie:onhitdamage",    OnHitDamage],
  ["zombie:firefly_flicker", FireflyFlicker],
  ["zombie:santasword",     SantaSword],
  ["zombie:cookie",         Christmas_Cookie],
  ["zombie:rottenfood",     RawFood],
  ["zombie:candycane",      Candycane],
  ["zombie:tporb",          TpOrb],
  ["zombie:tppAxeSwing",    TppAxeSwing],
  ["zombie:worldmenu",      TestDemon],
  ["zombie:fishing_rod",    CustomFishingRod],
  ["zombie:crablegs",       Crablegs],
  ["zombie:BowHold",        BowHold],
  ["zombie:chaos_book",     ChaosBookComponent],
  ["zombie:chaosSword",     DemonSword]
];

// ——— register them in one go ———
world.beforeEvents.worldInitialize.subscribe(({ blockComponentRegistry, itemComponentRegistry }) => {
  BLOCK_COMPONENTS.forEach(([id, Comp]) =>
    blockComponentRegistry.registerCustomComponent(id, new Comp())
  );
  ITEM_COMPONENTS.forEach(([id, Comp]) =>
    itemComponentRegistry.registerCustomComponent(id, new Comp())
  );
});

// ——— map your script-event IDs to handlers ———
const SCRIPT_EVENT_HANDLERS = {
  "zombie:firefly2":      source => new Firefly2(source),
  "zombie:arroweffect":   source => arrowEffect(source),
  "zombie:crossbow":      source => chaosCrossbowExplosion(source),
};

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  if (!sourceEntity) return;
  const handler = SCRIPT_EVENT_HANDLERS[id];
  if (handler) handler(sourceEntity);
});

const checkIntervalTicks = 100;
system.runInterval(() => {
    securityCheck();
}, checkIntervalTicks);
