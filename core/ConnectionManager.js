const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
// Using dynamic import for chalk (ES module)
let chalk;
(async () => {
  chalk = (await import('chalk')).default;
})();

const FarmManager = require('../modules/FarmManager');
const CacheManager = require('./CacheManager');
const fs = require('fs');

// Global message history for duplicate filtering across all bots
const globalMessageHistory = [];
const globalMessageHistorySize = 50; // Store last 50 messages

// Helper function to check if a message is a duplicate in the global history
function isGlobalDuplicateMessage(message) {
  return globalMessageHistory.includes(message);
}

// Helper function to add a message to the global history
function addToGlobalMessageHistory(message) {
  if (!globalMessageHistory.includes(message)) {
    globalMessageHistory.push(message);
    // Keep the history at a reasonable size
    if (globalMessageHistory.length > globalMessageHistorySize) {
      globalMessageHistory.shift(); // Remove oldest message
    }
  }
}

class ConnectionManager {
  constructor(options) {
    this.cacheManager = new CacheManager();
    this.bot = null;
    this.options = {
      host: options.host || process.env.SERVER_ADDRESS,
      port: process.env.PORT,
      version: process.env.VERSION,
      ...options, // Spread operator to merge provided options
    };
    this.farmManagers = options.farms ? options.farms.map(farm => new FarmManager(null, [farm])) : [];    
    // Message history for duplicate filtering
    this.messageHistory = [];
    this.messageHistorySize = 20; // Store last 20 messages

    // Load config for command handling
    try {
      const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
      this.whitelist = config.whitelist || [];
      this.commandPassword = process.env.COMMAND_PASSWORD;
    } catch (error) {
      console.error('Error loading config for command handling:', error);
      this.whitelist = [];
      this.commandPassword = process.env.COMMAND_PASSWORD;
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

      const chatMsg = `Chat message from ${username}: ${message}`;
      if (!this.isDuplicateMessage(chatMsg)) {
        this.logMessage('chat', chatMsg);
      }
    });

    this.bot.on('whisper', (username, message) => {
      const whisperMsg = `Received whisper from ${username}: ${message}`;
      if (!this.isDuplicateMessage(whisperMsg)) {
        this.logMessage('whisper', whisperMsg);
      }

      // Check if the message starts with "abu"
      if (message.startsWith('abu')) {
        this.handleWhisperCommand(username, message.substring(3).trim());
      }
    });

    this.bot.on('login', () => {
      this.logMessage('system', 'Bot logged in!');
      // Send the login command
      this.bot.chat(`/login ${this.options.password}`);
      // Store bot connection details in the cache
      this.cacheManager.addBot({
        username: this.options.username,
        serverAddress: this.options.host,
        authMethod: this.options.authMethod || 'mojang'
      });
    });

    this.bot.on('spawn', async () => {
      this.logMessage('system', 'Bot spawned');

      // Login check for arjunmpanarchy.in
      if (this.options.host === 'arjunmpanarchy.in') {
        const initialPosition = this.bot.entity.position.clone();
        this.logMessage('system', 'Performing login check on arjunmpanarchy.in...');

        // Move 2 blocks forward
        this.bot.setControlState('forward', true);
        await new Promise(resolve => setTimeout(resolve, 2000));
        this.bot.setControlState('forward', false);

        // Wait 3 seconds and check position
        await new Promise(resolve => setTimeout(resolve, 3000));
        const currentPosition = this.bot.entity.position;

        if (initialPosition.distanceTo(currentPosition) < 0.5) {
          this.logMessage('system', 'Login check failed. Re-attempting login...');
          this.bot.chat(`/login ${this.options.password}`);
        } else {
          this.logMessage('system', 'Login check passed.');
        }
      }

      // Assign duties to the bot for each selected farm
      this.farmManagers.forEach(farmManager => {
        farmManager.assignDuties(this.bot);
      });

      // If bot is in lobby, go to the portal
      if (this.isInLobby()) {
        this.logMessage('system', 'Navigating to anarchy portal...');
        this.walkToCoordinates(-71, 38, -5); // Example portal coordinates
      }
      // Log bot's position
      this.logPosition();
    });

    this.bot.on('message', (message) => {
      const msg = message.toString();

      // Don't log empty messages
      if (msg.trim() !== '') {
        const systemMsg = `System Message: ${msg}`;
        if (!this.isDuplicateMessage(systemMsg)) {
          this.logMessage('system', systemMsg);
        }
      }

      // check for private messages
      if (message.extra && Array.isArray(message.extra)) {
        for (const part of message.extra) {
          if (part.hoverEvent && part.hoverEvent.action === 'show_text' && part.hoverEvent.contents && part.hoverEvent.contents.text) {
            const hoverText = part.hoverEvent.contents.text;
            if (hoverText.includes("From") || hoverText.includes("To")) {
              const whisperMsg = `Whisper: ${msg}`;
              if (!this.isDuplicateMessage(whisperMsg)) {
                this.logMessage('whisper', whisperMsg);
              }
            }
          }
        }
      }
    });

    this.bot.on('end', (reason) => {
      this.logMessage('error', `Bot disconnected: ${reason}`);

      // Update bot state in cache to 'stopped' and clear farm assignment
      this.cacheManager.updateBot(this.options.username, { state: 'stopped', farm: null });
      
      // Implement reconnection logic
      this.logMessage('system', 'Attempting to reconnect in 10 seconds...');
      setTimeout(() => {
        this.logMessage('system', 'Reconnecting now...');
        this.connect();
      }, 10000); // Wait 10 seconds before reconnecting
    });

    this.bot.on('error', (err) => {
      this.logMessage('error', `Bot error: ${err}`);
      
      // Handle specific network errors
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
        this.logMessage('error', `Network error: ${err.code}. Attempting to reconnect in 30 seconds...`);
        setTimeout(() => {
          this.logMessage('system', 'Reconnecting after network error...');
          this.connect();
        }, 30000); // Wait 30 seconds before reconnecting after a network error
      }
    });

    this.logMessage('system', 'connect() finished');
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
      this.logMessage('security', `Unauthorized command attempt from ${username}`);
      return;
    }

    this.logMessage('command', `Received command "${command}" from ${username}`);

    let lastWhisperUsername = username; // Store the username of the last whisper

    const chat = (msg) => {
      if (msg.startsWith('/') || lastWhisperUsername === username) {
        this.bot.chat(msg);
        lastWhisperUsername = null; // Reset after sending the message
      } else {
        this.logMessage('system', `Blocked message to chat: ${msg}`);
      }
    };

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
        if (sayMessage.startsWith('/') || lastWhisperUsername === username) {
          chat(sayMessage);
          lastWhisperUsername = null; // Reset after sending the message
        } else {
          this.logMessage('system', `Blocked message to chat: ${sayMessage}`);
        }
        break;
      case 'tpme':
        if (isWhitelisted) {
          chat(`/tpahere ${strippedUsername}`);
        } else if (hasCorrectPassword) {
          chat(`/tpahere ${strippedUsername}`);
        }
        break;
      case 'tphere':
        if (isWhitelisted) {
          chat(`/tpa ${strippedUsername}`);
        } else if (hasCorrectPassword) {
          chat(`/tpa ${strippedUsername}`);
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
          console.error(`[this.options.username] Error setting goal: ${err}`);
          this.bot.chat('Error setting follow goal.');
        }
        break;
      default:
        console.log(`[this.options.username] Unknown command: ${command}`);
        break;
    }
  }

  disconnect() {
    if (this.bot) {
      this.logMessage('system', 'Disconnecting bot...');
      this.bot.quit();
    }
  }
  
  // Helper method to log messages with color coding
  logMessage(type, message) {
    const prefix = `[this.options.username]`;
    const fullMessage = `[prefix} {message}`;
    
    // Check if this is a chat or system message that might be duplicated across bots
    if (type === 'chat' || type === 'system') {
      // For chat and system messages, check global history to avoid duplicates
      if (isGlobalDuplicateMessage(fullMessage)) {
        return; // Skip logging if it's a duplicate in the global history
      }
      // Add to global history
      addToGlobalMessageHistory(fullMessage);
    }
    
    switch (type) {
      case 'system':
        console.log(chalk.blue(fullMessage));
        break;
      case 'chat':
        console.log(chalk.green(fullMessage));
        break;
      case 'whisper':
        console.log(chalk.magenta(fullMessage));
        break;
      case 'command':
        console.log(chalk.yellow(fullMessage));
        break;
      case 'error':
        console.log(chalk.red(fullMessage));
        break;
      case 'security':
        console.log(chalk.red.bold(fullMessage));
        break;
      default:
        console.log(fullMessage);
    }
    
    // Add to local message history for bot-specific duplicate filtering
    this.addToMessageHistory(message);
  }
  
  // Check if a message is a duplicate in the bot's local history
  isDuplicateMessage(message) {
    // First check global history for chat and system messages
    const fullMessage = `[this.options.username] {message}`;
    if (message.startsWith('Chat message from') || message.startsWith('System Message:')) {
      return isGlobalDuplicateMessage(fullMessage);
    }
    // For other messages, check local history
    return this.messageHistory.includes(message);
  }
  
  // Add a message to the bot's local history
  addToMessageHistory(message) {
    if (!this.messageHistory.includes(message)) {
      this.messageHistory.push(message);
      // Keep the history at a reasonable size
      if (this.messageHistory.length > this.messageHistorySize) {
        this.messageHistory.shift(); // Remove oldest message
      }
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
    this.logMessage('system', `Position: ({x.toFixed(2)}, {y.toFixed(2)}, {z.toFixed(2)})`);
  }

  async walkToCoordinates(x, y, z) {
    this.logMessage('system', `Walking to: ({x}, {y}, {z})`);
    this.logPosition(); // Log position when movement starts
    const mcData = require('minecraft-data')(this.bot.version);
    const movements = new Movements(this.bot, mcData);
    this.bot.pathfinder.setMovements(movements);

    const goal = new goals.GoalBlock(x, y, z);

    // Monitor the movement
    try {
      await this.bot.pathfinder.goto(goal);
      this.logMessage('system', `Reached target coordinates: ({x}, {y}, {z})`);
    } catch (error) {
      this.logMessage('error', `Error during pathfinding: {error}`);
      this.bot.chat("I couldn't reach the destination.");
    }
  }
}

module.exports = ConnectionManager;
