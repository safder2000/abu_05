class FarmManager {
  constructor(config, selectedFarms) {
    this.config = config;
    this.selectedFarms = selectedFarms;
  }

  assignDuties(bot) {
    for (const selectedFarm of this.selectedFarms) {
      if (!selectedFarm || !selectedFarm.duties[bot.username]) {
        console.log(`No duties assigned for ${bot.username} on ${selectedFarm ? selectedFarm.name : 'any farm'}.`);
        continue;
      }

      const duties = selectedFarm.duties[bot.username];
      console.log(`Assigning duties to ${bot.username} on farm ${selectedFarm.name}: ${duties.join(', ')}`);
      this.performDuties(bot, duties, selectedFarm.name); // Pass farm name
    }
  }

  performDuties(bot, duties, farmName) { // Receive farm name
    duties.forEach(duty => {
      switch (duty) {
        case 'jump':
          this.jump(bot);
          break;
        case 'hitPiglin':
          this.hitPiglin(bot, farmName); // Pass farm name
          break;
        default:
          console.log(`Unknown duty: ${duty}`);
      }
    });
  }

  jump(bot) {
    console.log(`[${bot.username}] Starting jump duty`);
    setInterval(() => {
      bot.setControlState('jump', true);
      setTimeout(() => {
        bot.setControlState('jump', false);
      }, 100);
    }, Math.random() * 2000 + 2000); // Random interval between 2 and 4 seconds
  }

  hitPiglin(bot, farmName) { // Receive farm name
    console.log(`[${bot.username}] Starting hitPiglin duty`);
    setInterval(() => {
      const piglin = bot.nearestEntity(entity => entity.name === 'zombified_piglin');
      if (piglin) {
        bot.attack(piglin);
        console.log(`[${bot.username}] Attacking piglin`);
      } else if (farmName === "Gold Farm") { // Only turn if it's the Gold Farm
        bot.look(bot.entity.yaw + Math.PI / 2, 0); // Turn 90 degrees right
        console.log(`[${bot.username}] No zombie piglins found, turning right`);
      }
    }, 2000);
  }
}

module.exports = FarmManager;
