import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

export function elfmenu(player) {


    // Create the main menu
    const mainMenuForm = new ActionFormData()
        .title("§4Elf Zombie")
        .body("O no Zombie Santa is on his way select a mode")
        .button("easy", "textures/particles/christmas/gingerbread")
        .button("medium", "textures/particles/christmas/ortimate")
        .button("hard", "textures/particles/christmas/snow");

    mainMenuForm.show(player).then((response) => {
        if (response.canceled) return;



        switch (response.selection) {
            case 0: easy(player); break;
            case 1: medium(player); break;
            case 2: hard(player); break;
            default: break;
        }
    });
}








export function easy(player) {
    // Ensure the player exists and has a valid location
    if (!player || !player.location || !player.dimension) {
        console.error("Player or player location/dimension is undefined.");
        return;
    }

    const playerPos = player.location;
    const dimension = player.dimension;

    // Notify the player
    player.runCommand(
        `title @s title §4Defend Christmas!`
    );

    // Function to generate a random spawn position that's not too close to the player
    function getSafeSpawnPosition(playerPos) {
        const maxAttempts = 10; // Limit attempts to avoid infinite loops
        let attempt = 0;
        let spawnPos;

        do {
            spawnPos = {
                x: playerPos.x + Math.random() * 10 - 5,
                y: playerPos.y,
                z: playerPos.z + Math.random() * 10 - 5,
            };

            // Check if the spawn position is at least 2 blocks away from the player
            if (Math.abs(spawnPos.x - playerPos.x) >= 2 || Math.abs(spawnPos.z - playerPos.z) >= 2) {
                return spawnPos;
            }

            attempt++;
        } while (attempt < maxAttempts);

        // If no valid position is found, return a fallback position
        return {
            x: playerPos.x + 3,
            y: playerPos.y,
            z: playerPos.z + 3,
        };
    }

    // Summon 3 elves
    for (let i = 0; i < 3; i++) {
        const spawnPos = getSafeSpawnPosition(playerPos);
        dimension.spawnEntity("zombie:zombieelf", spawnPos);
    }

    // Summon 1 zombie Santa
    const santaSpawnPos = getSafeSpawnPosition(playerPos);
    dimension.spawnEntity("zombie:zombiesanta_easy", santaSpawnPos);
}




export function medium(player) {
    const playerPos = player.location;
    const dimension = player.dimension;

    // Notify the player
    player.runCommand(
        `title @s title §4Defend Christmas!`
    );

    // Function to generate a random spawn position that's not too close to the player
    function getSafeSpawnPosition(playerPos) {
        const maxAttempts = 10;
        let attempt = 0;
        let spawnPos;

        do {
            spawnPos = {
                x: playerPos.x + Math.random() * 10 - 5,
                y: playerPos.y,
                z: playerPos.z + Math.random() * 10 - 5,
            };

            // Check if the spawn position is at least 2 blocks away from the player
            if (Math.abs(spawnPos.x - playerPos.x) >= 2 || Math.abs(spawnPos.z - playerPos.z) >= 2) {
                return spawnPos;
            }

            attempt++;
        } while (attempt < maxAttempts);

        // If no valid position is found, return a fallback position
        return {
            x: playerPos.x + 3,
            y: playerPos.y,
            z: playerPos.z + 3,
        };
    }

    // Summon 3 elves
    for (let i = 0; i < 3; i++) {
        const spawnPos = getSafeSpawnPosition(playerPos);
        dimension.spawnEntity("zombie:zombieelf", spawnPos);
    }

    // Summon 1 zombie Santa with the medium tag
    const santaSpawnPos = getSafeSpawnPosition(playerPos);
    const summonCommand = `summon zombie:zombiesanta_easy ${santaSpawnPos.x} ${santaSpawnPos.y} ${santaSpawnPos.z} ~ ~ medium`;
    dimension.runCommand(summonCommand);
}



export function hard(player) {
    const playerPos = player.location;
    const dimension = player.dimension;

    // Notify the player
    player.runCommand(
        `title @s title §4Defend Christmas!`
    );

    // Function to generate a random spawn position at least 2 blocks away from the player
    function getSafeSpawnPosition(playerPos) {
        const maxAttempts = 10;
        let attempt = 0;
        let spawnPos;

        do {
            spawnPos = {
                x: playerPos.x + Math.random() * 10 - 5,
                y: playerPos.y,
                z: playerPos.z + Math.random() * 10 - 5,
            };

            if (Math.abs(spawnPos.x - playerPos.x) >= 2 || Math.abs(spawnPos.z - playerPos.z) >= 2) {
                return spawnPos;
            }

            attempt++;
        } while (attempt < maxAttempts);

        return {
            x: playerPos.x + 3,
            y: playerPos.y,
            z: playerPos.z + 3,
        };
    }

    // Summon 3 elves
    for (let i = 0; i < 3; i++) {
        const spawnPos = getSafeSpawnPosition(playerPos);
        dimension.spawnEntity("zombie:zombieelf", spawnPos);
    }

    // Summon 1 zombie Santa with the hard tag
    const santaSpawnPos = getSafeSpawnPosition(playerPos);
    dimension.runCommand(
        `summon zombie:zombiesanta_easy ${santaSpawnPos.x} ${santaSpawnPos.y} ${santaSpawnPos.z} ~ ~ hard`
    );
}



export class Christmas_Guide_Book {
    onUse(event) {
        const { source: player } = event;
        guide_Book(player);
    }
}

function guide_Book(player) {
    // Create the main menu
    const christmas_form = new ActionFormData()
        .title("§4§lElf Zombie")
        .body("§6§oWelcome to ZombieCraft Christmas Addon!")
        .button("§2§lHow the Addon Works", "textures/particles/christmas/santa")
        .button("§c§lContact", "textures/particles/christmas/ribbion_cookie");

    christmas_form.show(player).then((response) => {
        if (response.canceled) return;

        switch (response.selection) {
            case 0: howTheAddonWorks(player); break;
            case 1: contact(player); break;
            default: break;
        }
    });
}

function howTheAddonWorks(player) {
    const howItWorksForm = new ActionFormData()
        .title("§2§lHow the Addon Works")
        .body(`
§6Welcome to §cZombieCraft Christmas!

§eIn this addon, you'll find Zombie Elves spawning in the following locations:
§b- Biomes where Polar Bears spawn.
§b- Snowy Slopes.

§a§lHow to Play:
§r§e- Interact with a Zombie Elf using the Use button to select a difficulty for Zombie Santa: Easy, Medium, or Hard.
§e- Medium and Hard modes drop rare presents when you defeat enemies.

§6§lPresents:
§r§e- §aGreen, §9Blue, §cRed, §5Purple, and §dPink presents.
§d- §oPink is the rarest and is only available in Hard mode.§r
§5- Purple presents (Medium mode) give a chance for Santa's armor.
§d- Pink presents (Hard mode) guarantee a piece of Santa's armor or the Zombie Santa Sword.
§6- Lucky presents may grant any item in the game.

§c§lChristmas Blocks & Items:
§r§e- Presents may contain themed blocks like gingerbread, Christmas lights, or Christmas cookies.
§e- Christmas cookies provide random effects by chance.

§6§lCandy Canes & Candy Cane Dust:
§r§e- Candy Cane seeds can be planted on §bSnow §eor §bMagic Snow.
§e- Candy Canes come in three types: §aGreen-White, §dPink-White, §9Blue-White.
§e- Combine all three types to create §6Candy Cane Dust§e, which is used to repair Santa's Suit armor.

§6§lSanta Suit Armor:
§r§e- Protects against §cfireticking§e, §bfreezing§e, and §7lightning damage§e.
§e- Prevents suffocation if you fly into walls.
§e- Repairable using §6Candy Cane Dust§e.

§aGood luck and enjoy spreading holiday cheer!
        `)
        .button("§cBack");

    howItWorksForm.show(player).then((response) => {
        if (response.canceled) return;

        // Go back to the main menu when "Back" is pressed
        if (response.selection === 0) {
            guide_Book(player);
        }
    });
}


function contact(player) {
    const contactForm = new ActionFormData()
        .title("§6§lContact Info")
        .body(`
§e**Creator:** §cZombieClinic
§e**Discord:** §bhttps://discord.gg/kqWASbvfDG
        `)
        .button("§cBack");

    contactForm.show(player).then((response) => {
        if (response.canceled) return;

        // Go back to the main menu when "Back" is pressed
        if (response.selection === 0) {
            guide_Book(player);
        }
    });
}
