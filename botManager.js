const readline = require('readline');
const ConnectionManager = require('./core/ConnectionManager');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promise wrapper for readline question
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function spawnBots(config) {
  try {
    const numBotsInput = await question('Enter the number of bots to spawn (0 or "all" for all farms): ');
    let numBots = parseInt(numBotsInput);

    if (numBotsInput.toLowerCase() === 'all' || numBots === 0) {
      numBots = 0; // Use 0 to indicate "all farms"
    } else if (isNaN(numBots) || numBots < 0) {
      console.error('Invalid number of bots.');
      return;
    }

    const botDetails = [];
    for (let i = 0; i < numBots; i++) {
      console.log(`\n=== Bot ${i + 1} Configuration ===`);
      const username = await question('Enter bot username: ');
      const password = await question('Enter bot password: ');
      botDetails.push({ username, password });
    }

    let farms = [];
    if (numBots === 0) {
      // Read the config.json file to get the list of farms
      const config = JSON.parse(require('fs').readFileSync('./config.json', 'utf8'));
      farms = config.farms;
    }

    console.log('\n=== Starting Bots ===');
    for (const botDetail of botDetails) {
      console.log(`\nStarting bot ${botDetail.username}...`);

      const connectionManager = new ConnectionManager({
        host: process.env.SERVER_ADDRESS,
        port: process.env.PORT,
        version: process.env.VERSION,
        username: botDetail.username,
        password: botDetail.password,
        farms: farms // Pass the list of farms
      });

      // Connect the bot
      connectionManager.connect();

      // Wait for 5 seconds before starting the next bot to prevent server overload
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

module.exports = { spawnBots };
