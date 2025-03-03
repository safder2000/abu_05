class CacheManager {
  constructor(cacheFile = 'cache.json') {
    this.cacheFile = cacheFile;
    this.cache = this.loadCache();
  }

  loadCache() {
    try {
      const fs = require('fs');
      const data = fs.readFileSync(this.cacheFile, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      // If the file doesn't exist or there's an error parsing it, return an empty cache
      return { bots: [], farms: [] };
    }
  }

  saveCache() {
    const fs = require('fs');
    const data = JSON.stringify(this.cache, null, 2);
    fs.writeFileSync(this.cacheFile, data, 'utf8');
  }

  getBot(username) {
    return this.cache.bots.find(bot => bot.username === username);
  }

  addBot(botData) {
    this.cache.bots.push(botData);
    this.saveCache();
  }

  updateBot(username, updateData) {
    const bot = this.getBot(username);
    if (bot) {
      Object.assign(bot, updateData);
      this.saveCache();
    }
  }

  removeBot(username) {
    this.cache.bots = this.cache.bots.filter(bot => bot.username !== username);
    this.saveCache();
  }

  getFarm(id) {
    return this.cache.farms.find(farm => farm.id === id);
  }

  addFarm(farmData) {
    this.cache.farms.push(farmData);
    this.saveCache();
  }

  updateFarm(id, updateData) {
    const farm = this.getFarm(id);
    if (farm) {
      Object.assign(farm, updateData);
      this.saveCache();
    }
  }

  removeFarm(id) {
    this.cache.farms = this.cache.farms.filter(farm => farm.id !== id);
    this.saveCache();
  }
}

module.exports = CacheManager;
