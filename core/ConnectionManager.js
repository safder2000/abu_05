const mineflayer = require("mineflayer");
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
// Using dynamic import for chalk (ES module)
let chalk;
(async () => {
  try {
    chalk = (await import("chalk")).default;
  } catch (error) {
    console.error("Error importing chalk:", error);
    // Fallback chalk implementation if import fails
    chalk = {
      blue: (text) => text,
      green: (text) => text,
      magenta: (text) => text,
      yellow: (text) => text,
      red: (text) => text,
    };
    chalk.red.bold = (text) => text;
  }
})();

const FarmManager = require("../modules/FarmManager");
const CacheManager = require("./CacheManager");
const botRegistry = require("../utils/BotRegistry");
const discordWebhook = require("../utils/DiscordWebhook");
const secureConfig = require("../utils/SecureConfig");
const fs = require("fs");

// Centralized message management system
class MessageManager {
  constructor() {
    this.messageHistory = {};
    this.messageExpirationTime = 5000; // Messages expire after 5 seconds
    this.cleanupInterval = setInterval(() => this.cleanupOldMessages(), 10000);
  }

  // Extract the core content of a message, removing bot prefixes and standardizing format
  extractMessageContent(message) {
    // Remove bot prefix if present
    let content = message;
    if (content.includes("] ")) {
      content = content.split("] ")[1];
    }

    // Further normalize chat messages
    if (content.startsWith("Chat message from ")) {
      const parts = content.split(": ");
      if (parts.length >= 2) {
        // Just keep the username and actual message
        content = parts.slice(1).join(": ");
      }
    }

    // Normalize system messages
    if (content.startsWith("System Message: ")) {
      content = content.substring("System Message: ".length);
    }

    return content.trim();
  }

  // Check if a message is a duplicate
  isDuplicate(message, botUsername) {
    const content = this.extractMessageContent(message);
    const key = content.toLowerCase();

    // Skip very short messages or messages that are just numbers
    if (content.length < 3 || /^\d+$/.test(content)) {
      return false;
    }

    // Check if this message exists in our history
    if (this.messageHistory[key]) {
      // If this bot already sent this message, it's not a duplicate for this bot
      if (this.messageHistory[key].bots.includes(botUsername)) {
        return false;
      }

      // If the message was seen recently, it's a duplicate
      const now = Date.now();
      if (
        now - this.messageHistory[key].timestamp < this.messageExpirationTime
      ) {
        // Add this bot to the list of bots that have seen this message
        this.messageHistory[key].bots.push(botUsername);
        return true;
      }

      // Message exists but is old, update it
      this.messageHistory[key] = {
        timestamp: now,
        bots: [botUsername],
      };
      return false;
    }

    // New message, add to history
    this.messageHistory[key] = {
      timestamp: Date.now(),
      bots: [botUsername],
    };
    return false;
  }

  // Clean up old messages to prevent memory leaks
  cleanupOldMessages() {
    const now = Date.now();
    for (const key in this.messageHistory) {
      if (
        now - this.messageHistory[key].timestamp >
          this.messageExpirationTime * 2
      ) {
        delete this.messageHistory[key];
      }
    }
  }
}

// Create a single global instance of the message manager
const globalMessageManager = new MessageManager();

class ConnectionManager {
  constructor(options) {
    this.cacheManager = new CacheManager();
    this.bot = null;
    this.options = {
      host: options.host || secureConfig.get("serverAddress"),
      port: secureConfig.get("serverPort", "25565"),
      version: secureConfig.get("gameVersion", "1.20.1"),
      ...options, // Spread operator to merge provided options
    };
    this.farmManagers = options.farms
      ? options.farms.map((farm) => new FarmManager(null, [farm]))
      : [];
    // Message history for duplicate filtering
    this.messageHistory = [];
    this.messageHistorySize = 20; // Store last 20 messages

    // Health monitoring
    this.healthWarningThreshold = 5;
    this.lastHealthWarning = 0;
    this.healthWarningCooldown = 10000; // 10 seconds between health warnings

    // Player proximity monitoring
    this.playerProximityThreshold = 10; // Distance in blocks
    this.playerProximityCheckInterval = null;
    this.lastPlayerWarnings = {}; // Track last warning time for each player
    this.playerWarningCooldown = 30000; // 30 seconds between warnings for the same player

    // Load config for command handling
    try {
      const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
      this.whitelist = config.whitelist || [];
      this.commandPassword = process.env.COMMAND_PASSWORD;
    } catch (error) {
      console.error("Error loading config for command handling:", error);
      this.whitelist = [];
      this.commandPassword = process.env.COMMAND_PASSWORD;
    }

    this.loadExternalWhitelist();
  }

  loadExternalWhitelist() {
    try {
      const { execSync } = require("child_process");
      execSync("git pull", { cwd: "external_configs" }); // Pull the latest changes
      const data = fs.readFileSync("./external_configs/whitelist", "utf8");
      this.externalWhitelist = data.trim().split("\n").filter((line) =>
        line.trim() !== ""
      ); // Split by newline and remove empty lines
      console.log("External whitelist loaded:", this.externalWhitelist);
    } catch (error) {
      console.error("Error loading external whitelist:", error);
      this.externalWhitelist = []; // Use an empty whitelist on error
    }
  }

  connect() {
    const cachedBotData = this.cacheManager.getBot(this.options.username);

    if (cachedBotData) {
      console.log(
        `[${this.options.username}] Found bot data in cache:`,
        cachedBotData,
      );
      // Restore bot options from cache
      this.options = {
        ...this.options,
        host: cachedBotData.serverAddress,
        authMethod: cachedBotData.authMethod || "mojang",
      };
    }

    console.log(
      `Attempting to connect with username: ${this.options.username}...`,
    );
    this.bot = mineflayer.createBot(this.options);
    this.bot.loadPlugin(pathfinder);

    // Register this bot with the registry
    this.isFirstBot = botRegistry.registerBot(this.options.username, {
      host: this.options.host,
      farmDuty: this.options.farms && this.options.farms.length > 0,
    });

    // Send bot connection status to Discord
    discordWebhook.sendBotStatus(this.options.username, "Connected to server");

    this.bot.on("chat", (username, message) => {
      if (username === this.bot.username) return; // Ignore own messages

      const chatMsg = `Chat message from ${username}: ${message}`;

      // Only the first bot logs chat messages to reduce duplication
      if (this.isFirstBot) {
        this.logMessage("chat", chatMsg);
      }

      // Always log if the message contains the bot's username or is a command
      if (
        message.includes(this.bot.username) || message.startsWith("!") ||
        message.startsWith("/")
      ) {
        this.logMessage("chat", chatMsg);
      }
    });

    this.bot.on("whisper", (username, message) => {
      const whisperMsg = `Received whisper from ${username}: ${message}`;
      this.logMessage("whisper", whisperMsg);

      // Check if the message starts with "abu"
      if (message.startsWith("abu")) {
        this.handleWhisperCommand(username, message.substring(3).trim());
      }
    });

    this.bot.on("login", () => {
      this.logMessage("system", "Bot logged in!");
      // Send the login command
      this.bot.chat(`/login ${this.options.password}`);
      // Store bot connection details in the cache
      this.cacheManager.addBot({
        username: this.options.username,
        serverAddress: this.options.host,
        authMethod: this.options.authMethod || "mojang",
      });
    });

    this.bot.on("spawn", async () => {
      this.logMessage("system", "Bot spawned");
      discordWebhook.sendBotStatus(this.options.username, "Spawned in world");

      // Login check for arjunmpanarchy.in
      if (this.options.host === "arjunmpanarchy.in") {
        const initialPosition = this.bot.entity.position.clone();
        this.logMessage(
          "system",
          "Performing login check on arjunmpanarchy.in...",
        );

        // Move 2 blocks forward
        this.bot.setControlState("forward", true);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        this.bot.setControlState("forward", false);

        // Wait 3 seconds and check position
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const currentPosition = this.bot.entity.position;

        if (initialPosition.distanceTo(currentPosition) < 0.5) {
          this.logMessage(
            "system",
            "Login check failed. Re-attempting login...",
          );
          this.bot.chat(`/login ${this.options.password}`);
        } else {
          this.logMessage("system", "Login check passed.");
        }
      }

      // Assign duties to the bot for each selected farm
      this.farmManagers.forEach((farmManager) => {
        farmManager.assignDuties(this.bot);
      });

      // If bot is in lobby, go to the portal
      if (this.isInLobby()) {
        this.logMessage("system", "Navigating to anarchy portal...");
        this.walkToCoordinates(-71, 38, -5); // Example portal coordinates
      }
      // Log bot's position
      this.logPosition();

      // Start health monitoring
      this.startHealthMonitoring();

      // Start player proximity monitoring
      this.startPlayerProximityMonitoring();
    });

    this.bot.on("message", (message) => {
      const msg = message.toString();

      // Don't log empty messages
      if (msg.trim() !== "") {
        const systemMsg = `System Message: ${msg}`;
        this.logMessage("system", systemMsg);
      }

      // check for private messages
      if (message.extra && Array.isArray(message.extra)) {
        for (const part of message.extra) {
          if (
            part.hoverEvent && part.hoverEvent.action === "show_text" &&
            part.hoverEvent.contents && part.hoverEvent.contents.text
          ) {
            const hoverText = part.hoverEvent.contents.text;
            if (hoverText.includes("From") || hoverText.includes("To")) {
              const whisperMsg = `Whisper: ${msg}`;
              this.logMessage("whisper", whisperMsg);
            }
          }
        }
      }
    });

    this.bot.on("end", (reason) => {
      this.logMessage("error", `Bot disconnected: ${reason}`);
      discordWebhook.sendBotStatus(
        this.options.username,
        `Disconnected: ${reason}`,
      );

      // Update bot state in cache to 'stopped' and clear farm assignment
      this.cacheManager.updateBot(this.options.username, {
        state: "stopped",
        farm: null,
      });

      // Remove from bot registry
      botRegistry.removeBot(this.options.username);

      // Stop monitoring intervals
      this.stopHealthMonitoring();
      this.stopPlayerProximityMonitoring();

      // Implement reconnection logic
      this.logMessage("system", "Attempting to reconnect in 10 seconds...");
      setTimeout(() => {
        this.logMessage("system", "Reconnecting now...");
        this.connect();
      }, 10000); // Wait 10 seconds before reconnecting
    });

    this.bot.on("error", (err) => {
      this.logMessage("error", `Bot error: ${err}`);

      // Handle specific network errors
      if (
        err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT" ||
        err.code === "ENOTFOUND"
      ) {
        this.logMessage(
          "error",
          `Network error: ${err.code}. Attempting to reconnect in 30 seconds...`,
        );
        setTimeout(() => {
          this.logMessage("system", "Reconnecting after network error...");
          this.connect();
        }, 30000); // Wait 30 seconds before reconnecting after a network error
      }
    });

    this.logMessage("system", "connect() finished");
  }

  handleWhisperCommand(username, message) {
    // Strip the prefix from the username
    const strippedUsername = username.replace(/^.*?\s+([^ ]+)$/, "$1");

    const args = message.split(" ");
    const command = args.shift().toLowerCase();
    const password = args[args.length - 1]; // Get the password from the end of the command
    const isWhitelisted = this.whitelist.includes(strippedUsername) ||
      this.externalWhitelist.includes(strippedUsername);
    const hasCorrectPassword = password === secureConfig.get("commandPassword");

    // Check if the bot is on farm duty and if teleport is allowed
    const currentFarm = this.options.farms &&
      this.options.farms.find((farm) => farm.bots.includes(this.bot.username));
    const isOnFarmDuty = !!currentFarm;
    const isTeleportAllowed = currentFarm
      ? currentFarm.allowTeleport !== false
      : true;

    // Only deny teleport commands if the bot is on farm duty AND teleport is not allowed
    if (
      isOnFarmDuty && !isTeleportAllowed &&
      (command === "tpme" || command === "tphere" || command === "follow me" ||
        command === "tpa")
    ) {
      this.bot.whisper(username, "I'm on this farm duty, can't comply");
      return;
    }

    // Security check - only allow whitelisted users or those with the correct password
    if (!isWhitelisted && !hasCorrectPassword) {
      this.logMessage(
        "security",
        `Unauthorized command attempt from ${username}`,
      );
      // Inform the user that they are not authorized
      this.bot.whisper(username, "You are not authorized to control this bot.");

      // Send security alert to Discord
      discordWebhook.send(
        `Unauthorized command attempt from ${username}`,
        "Security Alert",
        "FF0000",
      );

      return;
    }

    this.logMessage(
      "command",
      `Received command "${command}" from ${username}`,
    );

    let lastWhisperUsername = username; // Store the username of the last whisper

    const chat = (msg) => {
      if (msg.startsWith("/") || lastWhisperUsername === username) {
        this.bot.chat(msg);
        lastWhisperUsername = null; // Reset after sending the message
      } else {
        this.logMessage("system", `Blocked message to chat: ${msg}`);
      }
    };

    switch (command) {
      case "say":
        let sayMessage;
        if (!isWhitelisted) {
          args.pop(); // Remove the password
          sayMessage = args.join(" ");
        } else {
          sayMessage = args.join(" ");
        }
        if (!isWhitelisted) {
          sayMessage = sayMessage.slice(0, -this.commandPassword.length).trim();
        }
        if (sayMessage.startsWith("/") || lastWhisperUsername === username) {
          chat(sayMessage);
          lastWhisperUsername = null; // Reset after sending the message
        } else {
          this.logMessage("system", `Blocked message to chat: ${sayMessage}`);
        }
        break;
      case "tpme":
        if (isWhitelisted) {
          chat(`/tpahere ${strippedUsername}`);
        } else if (hasCorrectPassword) {
          chat(`/tpahere ${strippedUsername}`);
        }
        break;
      case "tphere":
        if (isWhitelisted) {
          chat(`/tpa ${strippedUsername}`);
        } else if (hasCorrectPassword) {
          chat(`/tpa ${strippedUsername}`);
        }
        break;
      case "follow me":
        const followDistance = parseFloat(args[0]);
        if (isNaN(followDistance)) {
          this.bot.chat("Invalid follow distance. Please provide a number.");
          break;
        }

        const target = this.bot.players[username]?.entity;
        if (!target) {
          this.bot.chat("I can't see you");
          break;
        }

        if (!this.bot.pathfinder) {
          this.bot.chat("Pathfinder is not loaded!");
          break;
        }

        const { x, y, z } = target.position;
        const goal = new goals.GoalNear(x, y, z, followDistance);
        try {
          this.bot.pathfinder.setGoal(goal);
        } catch (err) {
          console.error(
            `[${this.options.username}] Error setting goal: ${err}`,
          );
          this.bot.chat("Error setting follow goal.");
        }
        break;
      default:
        console.log(`[${this.options.username}] Unknown command: ${command}`);
        break;
    }
  }

  disconnect() {
    if (this.bot) {
      this.logMessage("system", "Disconnecting bot...");
      this.bot.quit();
    }
  }

  // Helper method to log messages with color coding
  logMessage(type, message) {
    const prefix = `[${this.options.username}]`;
    const fullMessage = `${prefix} ${message}`;

    // Use the global message manager to check for duplicates
    // Skip logging if it's a duplicate message from another bot
    if (globalMessageManager.isDuplicate(message, this.options.username)) {
      return;
    }

    // Use try-catch to handle potential chalk issues
    try {
      switch (type) {
        case "system":
          console.log(chalk ? chalk.blue(fullMessage) : fullMessage);
          break;
        case "chat":
          console.log(chalk ? chalk.green(fullMessage) : fullMessage);
          break;
        case "whisper":
          console.log(chalk ? chalk.magenta(fullMessage) : fullMessage);
          break;
        case "command":
          console.log(chalk ? chalk.yellow(fullMessage) : fullMessage);
          break;
        case "error":
          console.log(chalk ? chalk.red(fullMessage) : fullMessage);
          break;
        case "security":
          console.log(
            chalk && chalk.red ? chalk.red.bold(fullMessage) : fullMessage,
          );
          break;
        default:
          console.log(fullMessage);
      }
    } catch (error) {
      // Fallback to plain console.log if chalk fails
      console.log(fullMessage);
    }

    // Add to local message history for bot-specific duplicate filtering
    this.addToMessageHistory(message);
  }

  // Check if a message is a duplicate in the bot's local history
  isDuplicateMessage(message) {
    // Use the global message manager for all message types
    return globalMessageManager.isDuplicate(message, this.options.username);
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
    this.logMessage(
      "system",
      `Position: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`,
    );
  }

  async walkToCoordinates(x, y, z) {
    this.logMessage("system", `Walking to: (${x}, ${y}, ${z})`);
    this.logPosition(); // Log position when movement starts
    const mcData = require("minecraft-data")(this.bot.version);
    const movements = new Movements(this.bot, mcData);
    this.bot.pathfinder.setMovements(movements);

    const goal = new goals.GoalBlock(x, y, z);

    // Monitor the movement
    try {
      await this.bot.pathfinder.goto(goal);
      this.logMessage(
        "system",
        `Reached target coordinates: (${x}, ${y}, ${z})`,
      );
    } catch (error) {
      this.logMessage("error", `Error during pathfinding: ${error}`);
      this.bot.chat("I couldn't reach the destination.");
    }
  }

  /**
   * Start monitoring the bot's health
   */
  startHealthMonitoring() {
    if (!this.bot) return;

    // Listen for health updates
    this.bot.on("health", () => {
      this.checkHealth();
    });

    // Initial health check
    this.checkHealth();
  }

  /**
   * Check the bot's health and warn if it's low
   */
  checkHealth() {
    if (!this.bot || !this.bot.health) return;

    const now = Date.now();
    if (this.bot.health <= this.healthWarningThreshold) {
      // Only send warning if we haven't sent one recently
      if (now - this.lastHealthWarning > this.healthWarningCooldown) {
        this.lastHealthWarning = now;

        // Log with red color for emphasis
        const healthMsg = `CRITICAL LOW HEALTH: ${this.bot.health.toFixed(1)}`;
        this.logMessage("error", healthMsg);

        // Send to Discord
        discordWebhook.sendHealthWarning(
          this.options.username,
          this.bot.health,
        );
      }
    }
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.bot) {
      this.bot.removeAllListeners("health");
    }
  }

  /**
   * Start monitoring for nearby non-whitelisted players
   */
  startPlayerProximityMonitoring() {
    if (this.playerProximityCheckInterval) {
      clearInterval(this.playerProximityCheckInterval);
    }

    this.playerProximityCheckInterval = setInterval(() => {
      this.checkNearbyPlayers();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Check for nearby non-whitelisted players
   */
  checkNearbyPlayers() {
    if (!this.bot || !this.bot.players || !this.bot.entity) return;

    const now = Date.now();
    const botPosition = this.bot.entity.position;

    // Get all players
    for (const [username, player] of Object.entries(this.bot.players)) {
      // Skip if it's the bot itself or if the player has no entity (not loaded)
      if (username === this.bot.username || !player.entity) continue;

      // Check if player is in whitelist
      const isWhitelisted = this.whitelist.includes(username) ||
        this.externalWhitelist.includes(username);

      if (!isWhitelisted) {
        // Calculate distance
        const distance = botPosition.distanceTo(player.entity.position);

        // Check if player is within threshold distance
        if (distance <= this.playerProximityThreshold) {
          // Check if we've warned about this player recently
          if (
            !this.lastPlayerWarnings[username] ||
            now - this.lastPlayerWarnings[username] > this.playerWarningCooldown
          ) {
            this.lastPlayerWarnings[username] = now;

            // Log warning
            const warningMsg =
              `⚠️ NON-WHITELISTED PLAYER NEARBY: ${username} (${
                distance.toFixed(1)
              } blocks away)`;
            this.logMessage("security", warningMsg);

            // Send to Discord
            discordWebhook.sendPlayerProximityAlert(
              this.options.username,
              username,
              distance,
            );
          }
        }
      }
    }
  }

  /**
   * Stop player proximity monitoring
   */
  stopPlayerProximityMonitoring() {
    if (this.playerProximityCheckInterval) {
      clearInterval(this.playerProximityCheckInterval);
      this.playerProximityCheckInterval = null;
    }
  }
}

module.exports = ConnectionManager;
