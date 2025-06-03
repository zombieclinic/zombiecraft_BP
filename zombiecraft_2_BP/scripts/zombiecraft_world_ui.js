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
        CustomFishingRod
        } from "./custom_components";
import {Firefly2, Fireflys, FireflyFlicker,} from "./fireflys";
import {RedwoodGrowthComponent} from "./plants/custom_trees";
import {Atlantis, OpenableComponent, FencePlaceComponent, ZombieDoor, ZombieSlab,} from "./blocks";
import { CropGrowthComponent } from "./plants/grow";
import {  BlockShop } from "./playertoplayershop";
import { WarpAtlas } from "./warpalter/warpalter";
import { securityCheck } from "./warpalter/security";

world.beforeEvents.worldInitialize.subscribe((initEvent) => {
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:redwood_saplin", new RedwoodGrowthComponent());
    initEvent.itemComponentRegistry.registerCustomComponent("zombie:bearcheck", new BrownbearChanceEffect)
    initEvent.itemComponentRegistry.registerCustomComponent("zombie:onhitdamage", new OnHitDamage)
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:firefly", new Fireflys());
    initEvent.itemComponentRegistry.registerCustomComponent("zombie:firefly_flicker", new FireflyFlicker());
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:open2", new Open2());
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:open", new Openbox());
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:christmas_light", new Lights());
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:christmas_light_colors", new ColorLights());
    initEvent.itemComponentRegistry.registerCustomComponent("zombie:santasword", new SantaSword);
    initEvent.itemComponentRegistry.registerCustomComponent("zombie:cookie", new Christmas_Cookie);
    initEvent.itemComponentRegistry.registerCustomComponent("zombie:rottenfood", new RawFood());
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:atlantis", new Atlantis());
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:crop_grow", new CropGrowthComponent());
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:shopblock", new  BlockShop());
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:warpalter", new  WarpAtlas());
    initEvent.itemComponentRegistry.registerCustomComponent("zombie:candycane", new Candycane);
    initEvent.itemComponentRegistry.registerCustomComponent("zombie:tporb", new TpOrb);
    initEvent.itemComponentRegistry.registerCustomComponent("zombie:tppAxeSwing", new TppAxeSwing);
    initEvent.itemComponentRegistry.registerCustomComponent("zombie:worldmenu", new TestDemon);
    initEvent.itemComponentRegistry.registerCustomComponent("zombie:fishing_rod", new CustomFishingRod);
    initEvent.itemComponentRegistry.registerCustomComponent("zombie:crablegs", new Crablegs);
    initEvent.itemComponentRegistry.registerCustomComponent("zombie:BowHold", new BowHold);
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:corruptedDamage", new CorruptedDamage);
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:demonGrass", new DemonGrass);
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:strippedlog", new LogStripper);
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:is_open", new OpenableComponent);
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:fence_place", new FencePlaceComponent);
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:door", new ZombieDoor);
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:slab", new ZombieSlab);
    initEvent.blockComponentRegistry.registerCustomComponent("zombie:ores", new CustomOres);
});

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  // if you only ever care about events with a sourceEntity:
  if (!sourceEntity) return;

  switch (id) {
    case "zombie:firefly2":
      new Firefly2(sourceEntity);
      break;
    case "zombie:arroweffect":
      arrowEffect(sourceEntity);
      break;
    case "zombie:crossbow":
      chaosCrossbowExplosion(sourceEntity);
    default:
     
      break;
  }
});

const checkIntervalTicks = 100;
system.runInterval(() => {
    securityCheck();
}, checkIntervalTicks);
