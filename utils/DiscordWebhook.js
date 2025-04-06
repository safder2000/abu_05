const axios = require("axios");
require("dotenv").config();

class DiscordWebhook {
  constructor() {
    this.webhookUrl = process.env.WEBHOOK_URL;
    this.cooldowns = new Map(); // Track message cooldowns to prevent spam
    this.cooldownTime = 30000; // 30 seconds cooldown for similar messages
  }

  /**
   * Send a message to Discord webhook
   * @param {string} content - The message content
   * @param {string} title - Optional title for the embed
   * @param {string} color - Hex color for the embed (without #)
   * @param {Array} fields - Optional fields for the embed
   * @returns {Promise}
   */
  async send(content, title = null, color = "7289DA", fields = []) {
    if (!this.webhookUrl) {
      console.log("Discord webhook URL not configured");
      return;
    }

    // Create a simple hash of the content to use as cooldown key
    const contentKey = content.substring(0, 50);

    // Check if this message is on cooldown
    if (this.cooldowns.has(contentKey)) {
      const timeLeft = this.cooldowns.get(contentKey) - Date.now();
      if (timeLeft > 0) {
        // Message is still on cooldown
        return;
      }
    }

    // Set cooldown for this message
    this.cooldowns.set(contentKey, Date.now() + this.cooldownTime);

    // Clean up old cooldowns
    this.cleanupCooldowns();

    try {
      const payload = {
        content: content.length > 2000
          ? content.substring(0, 1997) + "..."
          : content,
      };

      // Add embed if title is provided
      if (title) {
        payload.embeds = [
          {
            title: title,
            color: parseInt(color, 16),
            fields: fields,
            timestamp: new Date().toISOString(),
          },
        ];
      }

      await axios.post(this.webhookUrl, payload);
    } catch (error) {
      console.error("Error sending Discord webhook:", error.message);
    }
  }

  /**
   * Send a health warning to Discord
   * @param {string} botName - The bot's username
   * @param {number} health - Current health value
   */
  async sendHealthWarning(botName, health) {
    const title = `⚠️ Low Health Warning`;
    const content = `Bot ${botName} health is critically low: ${
      health.toFixed(1)
    }`;
    const color = "FF0000"; // Red
    await this.send(content, title, color);
  }

  /**
   * Send a player proximity alert to Discord
   * @param {string} botName - The bot's username
   * @param {string} playerName - The approaching player's name
   * @param {number} distance - Distance to the player
   */
  async sendPlayerProximityAlert(botName, playerName, distance) {
    const title = `👀 Non-whitelisted Player Detected`;
    const content =
      `Non-whitelisted player ${playerName} is near bot ${botName} (${
        distance.toFixed(1)
      } blocks away)`;
    const color = "FFA500"; // Orange
    await this.send(content, title, color);
  }

  /**
   * Send a bot status update to Discord
   * @param {string} botName - The bot's username
   * @param {string} status - The status message
   */
  async sendBotStatus(botName, status) {
    const title = `Bot Status Update`;
    const content = `Bot ${botName}: ${status}`;
    const color = "00FF00"; // Green
    await this.send(content, title, color);
  }

  /**
   * Clean up old cooldowns to prevent memory leaks
   */
  cleanupCooldowns() {
    const now = Date.now();
    for (const [key, value] of this.cooldowns.entries()) {
      if (value < now) {
        this.cooldowns.delete(key);
      }
    }
  }
}

// Create a singleton instance
const discordWebhook = new DiscordWebhook();

module.exports = discordWebhook;
