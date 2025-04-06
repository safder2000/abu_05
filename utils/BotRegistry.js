/**
 * A registry to track all connected bots and their states
 */
class BotRegistry {
  constructor() {
    this.bots = new Map();
    this.firstBot = null;
    this.totalBots = 0;
  }

  /**
   * Register a bot with the registry
   * @param {string} username - The bot's username
   * @param {Object} data - Additional data about the bot
   * @returns {boolean} - Whether this is the first bot
   */
  registerBot(username, data = {}) {
    const isFirstBot = this.totalBots === 0;
    
    this.bots.set(username, {
      ...data,
      isFirstBot,
      registeredAt: Date.now()
    });
    
    if (isFirstBot) {
      this.firstBot = username;
      console.log(`[Registry] ${username} registered as the first bot`);
    }
    
    this.totalBots++;
    return isFirstBot;
  }

  /**
   * Check if a bot is the first registered bot
   * @param {string} username - The bot's username
   * @returns {boolean}
   */
  isFirstBot(username) {
    return this.firstBot === username;
  }

  /**
   * Update a bot's data
   * @param {string} username - The bot's username
   * @param {Object} data - Data to update
   */
  updateBot(username, data) {
    if (this.bots.has(username)) {
      const botData = this.bots.get(username);
      this.bots.set(username, { ...botData, ...data });
    }
  }

  /**
   * Remove a bot from the registry
   * @param {string} username - The bot's username
   */
  removeBot(username) {
    if (this.bots.has(username)) {
      const wasFirstBot = this.isFirstBot(username);
      this.bots.delete(username);
      this.totalBots--;
      
      // If the first bot disconnected, assign a new first bot
      if (wasFirstBot && this.totalBots > 0) {
        // Get the oldest bot as the new first bot
        let oldestBot = null;
        let oldestTime = Infinity;
        
        for (const [botName, data] of this.bots.entries()) {
          if (data.registeredAt < oldestTime) {
            oldestTime = data.registeredAt;
            oldestBot = botName;
          }
        }
        
        if (oldestBot) {
          this.firstBot = oldestBot;
          const botData = this.bots.get(oldestBot);
          this.bots.set(oldestBot, { ...botData, isFirstBot: true });
          console.log(`[Registry] ${oldestBot} is now the first bot`);
        }
      } else if (this.totalBots === 0) {
        this.firstBot = null;
      }
    }
  }

  /**
   * Get all registered bots
   * @returns {Map}
   */
  getAllBots() {
    return this.bots;
  }

  /**
   * Get the total number of registered bots
   * @returns {number}
   */
  getBotCount() {
    return this.totalBots;
  }
}

// Create a singleton instance
const botRegistry = new BotRegistry();

module.exports = botRegistry;
