const fs = require('fs');
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
    const serverAddress = await question('Enter server address (1 for mallulifesteal.fun, 2 for arjunmpanarchy.in): ');
    let host = config.serverAddress;
    if (serverAddress === '1') {
      host = 'mallulifesteal.fun';
    } else if (serverAddress === '2') {
      host = 'arjunmpanarchy.in';
    } else {
      console.error('Invalid server address.');
      return;
    }

    const numBots = parseInt(await question('Enter the number of bots to spawn: '));
    if (isNaN(numBots) || numBots <= 0) {
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

    console.log('\n=== Starting Bots ===');
    for (const botDetail of botDetails) {
      console.log(`\nStarting bot ${botDetail.username}...`);

      const connectionManager = new ConnectionManager({
        host: host,
        port: config.port,
        version: config.version,
        username: botDetail.username,
        password: botDetail.password,
        farms: [] // No farms selected
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


async function startBots() {
  try {
    // Read existing config
    let config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

    // Ask for server details
    //console.log('\n=== Server Configuration ===');
    //config.serverAddress = await question('Enter server address (press Enter for default: mallulifesteal.fun): ') || config.serverAddress;
    //config.port = parseInt(await question('Enter server port (press Enter for default: 25565): ')) || config.port;
    //config.version = await question('Enter Minecraft version (press Enter for default: 1.20.1): ') || config.version;

    // Main Menu
    console.log('\n=== Main Menu ===');
    console.log('1. Operate Farms (mallulifesteal.fun)');
    console.log('2. Spawn Bots');
    const option = await question('Choose an option (1 or 2): ');

    if (option === '1') {
          // Farm Selection
      console.log('\n=== Farm Selection ===');
      if (!config.farms || config.farms.length === 0) {
        console.log('No farms configured. Please add farms to config.json.');
        rl.close();
        return;
      }

      // Display farm options
      console.log('Available Farms:');
      config.farms.forEach((farm, index) => {
        console.log(`${index + 1}. ${farm.name}`);
      });

      const farmIndicesStr = await question('Enter the numbers of the farms to operate (comma-separated, e.g., 1,2): ');
      const farmIndices = farmIndicesStr.split(',').map(s => parseInt(s.trim()) - 1);

      const selectedFarms = [];
      for (const farmIndex of farmIndices) {
        if (isNaN(farmIndex) || farmIndex < 0 || farmIndex >= config.farms.length) {
          console.error('Invalid farm selection.');
          rl.close();
          return;
        }
        selectedFarms.push(config.farms[farmIndex]);
      }

      console.log(`Selected Farms: ${selectedFarms.map(farm => farm.name).join(', ')}`);

      // Start bots for the selected farms
      console.log('\n=== Starting Bots ===');
      for (const selectedFarm of selectedFarms) {
        for (const botUsername of selectedFarm.bots) {
          const account = config.accounts.find(acc => acc.username === botUsername);
          if (!account) {
            console.error(`Account not found for bot: ${botUsername}`);
            continue;
          }

          console.log(`\nStarting bot ${botUsername} for farm ${selectedFarm.name}...`);

          const connectionManager = new ConnectionManager({
            host: config.serverAddress,
            port: config.port,
            version: config.version,
            username: account.username,
            password: account.password,
            farms: selectedFarms // Pass the selected farms to the connection manager
          });

          // Connect the bot
          connectionManager.connect();

          // Wait for 5 seconds before starting the next bot to prevent server overload
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    } else if (option === '2') {
      await spawnBots(config);
    } else {
      console.log('Invalid option.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    rl.close();
  }
}

// Start the program
console.log('=== Minecraft Bot Manager ===');
startBots();
