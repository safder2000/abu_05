const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

const FarmManager = require('../modules/FarmManager');
const CacheManager = require('./CacheManager');
const fs = require('fs');

class ConnectionManager {
  constructor(options) {
    this.cacheManager = new CacheManager();
    this.bot = null;
    this.options = {
      host: options.host || 'mallulifesteal.fun',
      port: 25565,
      version: '1.20.1',
      ...options, // Spread operator to merge provided options
    };
    this.farmManagers = options.farms ? options.farms.map(farm => new FarmManager(null, [farm])) : [];

    // Load config for command handling
    try {
      const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
      this.whitelist = config.whitelist || [];
      this.commandPassword = config.commandPassword || 'poocha';
    } catch (error) {
      console.error('Error loading config for command handling:', error);
      this.whitelist = [];
      this.commandPassword = 'poocha';
    }

    this.loadExternalWhitelist();
  }

  loadExternalWhitelist() {
    try {
      const { execSync } = require('child_process');
      execSync('git pull', { cwd: 'external_configs' }); // Pull the latest changes
      const data = fs.readFileSync('./external_configs/whitelist', 'utf8');
      this.externalWhitelist = data.trim().split('\n').filter(line => line.trim() !== ''); // Split by newline and remove empty lines
      console.log('External whitelist loaded:', this.externalWhitelist);
    } catch (error) {
      console.error('Error loading external whitelist:', error);
      this.externalWhitelist = []; // Use an empty whitelist on error
    }
  }

  connect() {
    const cachedBotData = this.cacheManager.getBot(this.options.username);

    if (cachedBotData) {
      console.log(`[${this.options.username}] Found bot data in cache:`, cachedBotData);
      // Restore bot options from cache
      this.options = {
        ...this.options,
        host: cachedBotData.serverAddress,
        authMethod: cachedBotData.authMethod || 'mojang'
      };
    }

    console.log(`Attempting to connect with username: ${this.options.username}...`);
    this.bot = mineflayer.createBot(this.options);
    this.bot.loadPlugin(pathfinder);

    this.bot.on('chat', (username, message) => {
      if (username === this.bot.username) return; // Ignore own messages

      if (this.whitelist.includes(username) && message.startsWith('abu')) {
        this.handleWhisperCommand(username, message.substring(3).trim());
      } else if (message.startsWith('!')) {
        const [command, ...args] = message.substring(1).split(' ');
        console.log(`[${this.options.username}] Received command from ${username}: ${command}, Args: ${args.join(' ')}`);

        switch (command) {
          case 'help':
            this.bot.chat('Available commands: !help, !pos');
            break;
          case 'pos':
            const { x, y, z } = this.bot.entity.position;
            this.bot.chat(`My position is: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
            break;
          default:
            this.bot.chat(`Unknown command: ${command}`);
        }
      } else {
        console.log(`[${this.options.username}] Chat message from ${username}: ${message}`);
      }
    });

    this.bot.on('whisper', (username, message) => {
      console.log(`[${this.options.username}] Received whisper from ${username}: ${message}`);

      // Check if the message starts with "abu"
      if (message.startsWith('abu')) {
        this.handleWhisperCommand(username, message.substring(3).trim());
      }
    });

    this.bot.on('login', () => {
      console.log(`[${this.options.username}] Bot logged in!`);
      // Store bot connection details in the cache
      this.cacheManager.addBot({
        username: this.options.username,
        serverAddress: this.options.host,
        authMethod: this.options.authMethod || 'mojang', // Assuming default auth is mojang
        state: 'running',
        farm: null // Initially not assigned to any farm
      });
    });

    this.bot.on('spawn', async () => {
      console.log(`[${this.options.username}] Bot spawned`);

      // Login check for arjunmpanarchy.in
      if (this.options.host === 'arjunmpanarchy.in') {
        const initialPosition = this.bot.entity.position.clone();
        console.log(`[${this.options.username}] Performing login check on arjunmpanarchy.in...`);

        // Move 2 blocks forward
        this.bot.setControlState('forward', true);
        await new Promise(resolve => setTimeout(resolve, 2000));
        this.bot.setControlState('forward', false);

        // Wait 3 seconds and check position
        await new Promise(resolve => setTimeout(resolve, 3000));
        const currentPosition = this.bot.entity.position;

        if (initialPosition.distanceTo(currentPosition) < 0.5) {
          console.log(`[${this.options.username}] Login check failed. Re-attempting login...`);
          this.bot.chat(`/login ${this.options.password}`);
        } else {
          console.log(`[${this.options.username}] Login check passed.`);
        }
      }

      // Assign duties to the bot for each selected farm
      this.farmManagers.forEach(farmManager => {
        farmManager.assignDuties(this.bot);
      });

      // If bot is in lobby, go to the portal
      if (this.isInLobby()) {
        console.log(`[${this.options.username}] Navigating to anarchy portal...`);
        this.walkToCoordinates(-71, 38, -5); // Example portal coordinates
      }
      // Log bot's position
      this.logPosition();
    });

    this.bot.on('message', (message) => {
      const msg = message.toString();

      // Don't log empty messages
      if (msg.trim() !== '') {
        console.log(`[${this.options.username}] System Message:`, msg);
      }

      // check for private messages
      if (message.extra && Array.isArray(message.extra)) {
        for (const part of message.extra) {
          if (part.hoverEvent && part.hoverEvent.action === 'show_text' && part.hoverEvent.contents && part.hoverEvent.contents.text) {
            const hoverText = part.hoverEvent.contents.text;
            if (hoverText.includes("From") || hoverText.includes("To")) {
              console.log(`[${this.options.username}] Whisper:`, msg);
            }
          }
        }
      }

      if (msg.includes('login')) {
        this.bot.chat(`/login ${this.options.password}`);
      } else if (msg.includes('register')) {
        this.bot.chat(`/register ${this.options.password} ${this.options.password}`);
      }
    });

    this.bot.on('end', (reason) => {
      console.log(`[${this.options.username}] Bot disconnected:`, reason);

      // Update bot state in cache to 'stopped' and clear farm assignment
      this.cacheManager.updateBot(this.options.username, { state: 'stopped', farm: null });
      
      // Implement reconnection logic
      console.log(`[${this.options.username}] Attempting to reconnect in 10 seconds...`);
      setTimeout(() => {
        console.log(`[${this.options.username}] Reconnecting now...`);
        this.connect();
      }, 10000); // Wait 10 seconds before reconnecting
    });

    this.bot.on('error', (err) => {
      console.error(`[${this.options.username}] Bot error:`, err);
      
      // Handle specific network errors
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
        console.error(`[${this.options.username}] Network error: ${err.code}. Attempting to reconnect in 30 seconds...`);
        setTimeout(() => {
          console.log(`[${this.options.username}] Reconnecting after network error...`);
          this.connect();
        }, 30000); // Wait 30 seconds before reconnecting after a network error
      }
    });

    console.log(`[${this.options.username}] connect() finished`);
  }

 handleWhisperCommand(username, message) {
    // Strip the prefix from the username
    const strippedUsername = username.replace(/^.*?\s+([^ ]+)$/, '$1');

    const args = message.split(' ');
    const command = args.shift().toLowerCase();
    const password = args[args.length - 1]; // Get the password from the end of the command
    const isWhitelisted = this.whitelist.includes(strippedUsername) || this.externalWhitelist.includes(strippedUsername);
    const hasCorrectPassword = password === this.commandPassword;

     // Check if the bot is on farm duty
    const isOnFarmDuty = this.options.farms && this.options.farms.some(farm => farm.bots.includes(this.bot.username));

    if (isOnFarmDuty && (command === 'tpme' || command === 'tphere' || command === 'follow me' || command === 'tpa')) {
      this.bot.whisper(username, "I'm on this farm duty, can't comply");
      return;
    }

    // Security check
    if (!isWhitelisted && !hasCorrectPassword) {
      console.log(`[${this.options.username}] Unauthorized command attempt from ${username}`);
      return;
    }

    console.log(`[${this.options.username}] Received command "${command}" from ${username}`);

    switch (command) {
      case 'say':
        let sayMessage;
        if (!isWhitelisted) {
          args.pop(); // Remove the password
          sayMessage = args.join(' ');
        } else {
          sayMessage = args.join(' ');
        }
        if (!isWhitelisted) {
          sayMessage = sayMessage.slice(0, -this.commandPassword.length).trim();
        }
        this.bot.chat(sayMessage);
        break;
      case 'tpme':
        if (isWhitelisted) {
          this.bot.chat(`/tpahere ${strippedUsername}`);
        } else if (hasCorrectPassword) {
          this.bot.chat(`/tpahere ${strippedUsername}`);
        }
        break;
      case 'tphere':
        if (isWhitelisted) {
          this.bot.chat(`/tpa ${strippedUsername}`);
        } else if (hasCorrectPassword) {
          this.bot.chat(`/tpa ${strippedUsername}`);
        }
        break;
      case 'follow me':
        const followDistance = parseFloat(args[0]);
        if (isNaN(followDistance)) {
          this.bot.chat('Invalid follow distance. Please provide a number.');
          break;
        }

        const target = this.bot.getEntity(username);
        if (!target) {
          this.bot.chat('I can\'t see you');
          break;
        }

        if (!this.bot.pathfinder) {
          this.bot.chat('Pathfinder is not loaded!');
          break;
        }

        const { x, y, z } = target.position;
        const goal = new goals.GoalNear(x, y, z, followDistance);
        try {
          this.bot.pathfinder.setGoal(goal);
        } catch (err) {
          console.error(`[${this.options.username}] Error setting goal: ${err}`);
          this.bot.chat('Error setting follow goal.');
        }
        break;
      default:
        console.log(`[${this.options.username}] Unknown command: ${command}`);
        break;
    }
  }

  disconnect() {
    if (this.bot) {
      console.log(`[${this.options.username}] Disconnecting bot...`);
      this.bot.quit();
    }
  }

  // Function to determine if the bot is in the lobby
  isInLobby() {
    // Implement your logic here, e.g., checking coordinates or messages
    // This example assumes checking a known lobby position
    const { x, y, z } = this.bot.entity.position;
    return (x === -71 && y === 38 && z === -5); // Example lobby check
  }

  // Log the bot's position
  logPosition() {
    const { x, y, z } = this.bot.entity.position;
    console.log(`[${this.options.username}] Position: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
  }

  async walkToCoordinates(x, y, z) {
    console.log(`[${this.options.username}] Walking to: (${x}, ${y}, ${z})`);
    this.logPosition(); // Log position when movement starts
    const mcData = require('minecraft-data')(this.bot.version);
    const movements = new Movements(this.bot, mcData);
    this.bot.pathfinder.setMovements(movements);

    const goal = new goals.GoalBlock(x, y, z);

    // Monitor the movement
    try {
      await this.bot.pathfinder.goto(goal);
      console.log(`[${this.options.username}] Reached target coordinates: (${x}, ${y}, ${z})`);
    } catch (error) {
      console.error(`[${this.options.username}] Error during pathfinding:`, error);
      this.bot.chat("I couldn't reach the destination.");
    }
  }
}

module.exports = ConnectionManager;
