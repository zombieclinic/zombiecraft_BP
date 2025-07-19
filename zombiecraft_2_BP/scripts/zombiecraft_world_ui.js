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
        CustomOres} from "./custom_components/custom_components";
import { BowHold, chaosCrossbowExplosion} from "./custom_components/chaos_components/crossbow";
import {TheSight} from "./custom_components/chaos_components/sight";
import {Firefly2, FireflyFlicker,} from "./fireflys";
import {RedwoodGrowthComponent} from "./custom_components/plants/custom_trees";
import {Atlantis, OpenableComponent, FencePlaceComponent, ZombieDoor, ZombieSlab, PaintBrush, Painting} from "./blocks";
import { CropGrowthComponent } from "./custom_components/plants/grow";
import {  BlockShop } from "./playertoplayershop";
import { WarpAtlas } from "./warpalter/warpalter";
import { securityCheck } from "./warpalter/security";
import {ChaosBookComponent} from "./magic/chaos";
import { SwordHit, BerserkerAttackController} from "./custom_components/chaos_components/chaos_sword";
import {CustomFishingRod} from "./custom_components/chaos_components/fishingpool"
import { ChaosXp} from "./custom_components/chaos_components/xp"
import {TppAxeSwing, BerserkerAxeController} from "./custom_components/chaos_components/battleaxe"
import {arrowEffect} from "./custom_components/chaos_components/chaos_arrow"
import {DemonGrass,TestDemon} from "./custom_components/chaos_components/generation"

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
  ["zombie:ores",                 CustomOres]
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
  ["zombie:worldmenu",           TestDemon],
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
  ["zombie:paintings",            Painting]
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

const checkIntervalTicks = 100;
system.runInterval(() => {
    securityCheck();
}, checkIntervalTicks);






