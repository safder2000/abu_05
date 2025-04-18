const CacheManager = require("../core/CacheManager");

class FarmManager {
  constructor(config, selectedFarms) {
    this.cacheManager = new CacheManager();
    this.config = config;
    this.selectedFarms = selectedFarms;
  }

  assignDuties(bot) {
    for (const selectedFarm of this.selectedFarms) {
      if (!selectedFarm || !selectedFarm.duties[bot.username]) {
        console.log(
          `No duties assigned for ${bot.username} on ${
            selectedFarm ? selectedFarm.name : "any farm"
          }.`,
        );
        continue;
      }

      // Update cache with farm assignment
      this.cacheManager.updateBot(bot.username, { farm: selectedFarm.name });

      const duties = selectedFarm.duties[bot.username];
      console.log(
        `Assigning duties to ${bot.username} on farm ${selectedFarm.name}: ${
          duties.join(", ")
        }`,
      );
      this.performDuties(bot, duties, selectedFarm.name); // Pass farm name
    }
  }

  performDuties(bot, duties, farmName) { // Receive farm name
    duties.forEach((duty) => {
      switch (duty) {
        case "jump":
          this.jump(bot);
          break;
        case "hitPiglin":
          this.hitPiglin(bot, farmName);
          break;
        case "hitWitherSkeleton":
          this.hitWitherSkeleton(bot);
          break;
        case "hitGhast":
          this.hitGhast(bot);
          break;
        case "raidfarm":
          this.raidFarmKilling(bot);
          break;
        case "drinkOminousPotion":
          this.drinkOminousPotion(bot);
          break;
        default:
          console.log(`Unknown duty: ${duty}`);
      }
    });
  }

  hitGhast(bot) {
    console.log(`[${bot.username}] Starting hitGhast duty`);
    setInterval(() => {
      const ghast = bot.nearestEntity((entity) => entity.name === "ghast");
      if (ghast) {
        // Check for best weapon (assuming sword is best)
        const sword = bot.inventory.items().find((item) =>
          item.name.includes("netherite_sword") ||
          item.name.includes("diamond_sword")
        );

        if (sword) {
          bot.equip(sword, "hand");
          bot.attack(ghast);
          // Only log attack messages very rarely to reduce spam
          if (Math.random() < 0.01) { // 1% chance to log
            console.log(`[${bot.username}] Attacking ghast with ${sword.name}`);
          }
        } else {
          console.log(`[${bot.username}] No Netherite or Diamond sword found`);
        }
      }
    }, 2000);
  }

  jump(bot) {
    console.log(`[${bot.username}] Starting jump duty`);
    setInterval(() => {
      bot.setControlState("jump", true);
      setTimeout(() => {
        bot.setControlState("jump", false);
      }, 1000);
    }, Math.random() * 2000 + 2000); // Random interval between 2 and 4 seconds
  }

  hitWitherSkeleton(bot) {
    console.log(`[${bot.username}] Starting hitWitherSkeleton duty`);
    setInterval(() => {
      const witherSkeleton = bot.nearestEntity((entity) =>
        entity.name === "wither_skeleton"
      );
      if (witherSkeleton) {
        // Check for Netherite or Diamond sword
        const sword = bot.inventory.items().find((item) =>
          item.name.includes("netherite_sword") ||
          item.name.includes("diamond_sword")
        );

        if (sword) {
          bot.equip(sword, "hand"); // Equip the sword
          bot.attack(witherSkeleton);
          // Only log attack messages very rarely to reduce spam
          if (Math.random() < 0.01) { // 1% chance to log
            console.log(
              `[${bot.username}] Attacking wither skeleton with ${sword.name}`,
            );
          }
        } else {
          console.log(`[${bot.username}] No Netherite or Diamond sword found`);
        }
      }
    }, 2000);
  }

  hitPiglin(bot, farmName) { // Receive farm name
    console.log(`[${bot.username}] Starting hitPiglin duty`);
    setInterval(() => {
      const piglin = bot.nearestEntity((entity) =>
        entity.name === "zombified_piglin"
      );
      if (piglin) {
        bot.attack(piglin);
        // Only log attack messages very rarely to reduce spam
        if (Math.random() < 0.01) { // 1% chance to log
          console.log(`[${bot.username}] Attacking piglin`);
        }
      } else if (farmName === "Gold Farm") { // Only turn if it's the Gold Farm
        bot.look(bot.entity.yaw + Math.PI / 2, 0); // Turn 90 degrees right
        console.log(`[${bot.username}] No zombie piglins found, turning right`);
      }
    }, 2000);
  }
  raidFarmKilling(bot) {
    console.log(`[${bot.username}] Starting raid farm duty`);
    // Using setInterval without storing the reference since we don't need to clear it
    setInterval(() => {
      // Check for best weapon (assuming sword is best)
      const sword = bot.inventory.items().find((item) =>
        item.name.includes("netherite_sword") ||
        item.name.includes("diamond_sword")
      );

      if (sword) {
        bot.equip(sword, "hand");
      } else {
        console.log(`[${bot.username}] No Netherite or Diamond sword found`);
      }

      const raidEntities = Object.values(bot.entities).filter((entity) => {
        const distance = bot.entity.position.distanceTo(entity.position);
        return (distance <= 16) &&
          (entity.name === "pillager" || entity.name === "vindicator" ||
            entity.name === "evoker" || entity.name === "witch" ||
            entity.name === "ravager");
      });

      raidEntities.forEach((entity) => {
        bot.attack(entity);
        // Only log attack messages very rarely to reduce spam
        if (Math.random() < 0.01) { // 1% chance to log
          console.log(`[${bot.username}] Attacking ${entity.name}`);
        }
      });
    }, 5000); // Reduced interval for faster attacking
  }

  drinkOminousPotion(bot) {
    console.log(`[${bot.username}] Starting drinkOminousPotion duty`);
    setInterval(() => {
      const ominousPotion = bot.inventory.items().find((item) => {
        if (
          item && item.nbt && item.nbt.value &&
          item.nbt.value["VB|Protocol1_20_5To1_20_3"] &&
          item.nbt.value["VB|Protocol1_20_5To1_20_3"].value &&
          item.nbt.value["VB|Protocol1_20_5To1_20_3"].value["VV|custom_data"] &&
          item.nbt.value["VB|Protocol1_20_5To1_20_3"].value["VV|custom_data"]
              .value === 1
        ) {
          return item;
        }
        return null;
      });

      if (ominousPotion) {
        bot.equip(ominousPotion, "hand")
          .then(() => bot.activateItem())
          .then(() => {
            console.log(`[${bot.username}] Drank ominous potion`);
          })
          .catch((err) => {
            console.error(
              `[${bot.username}] Error drinking ominous potion: ${err}`,
            );
          });
      } else {
        console.log(`[${bot.username}] No ominous potion found in inventory`);
      }
    }, 130000);
  }
}

module.exports = FarmManager;
