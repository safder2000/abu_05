const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

class SecureConfig {
  constructor() {
    this.configPath = path.join(process.cwd(), 'secure_config.json');
    this.config = this.loadConfig();
    this.encryptionKey = this._generateKey();
  }

  /**
   * Load the secure configuration
   * @returns {Object} The configuration object
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading secure configuration:', error.message);
    }
    return {};
  }

  /**
   * Save the secure configuration
   */
  saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving secure configuration:', error.message);
    }
  }

  /**
   * Get a configuration value
   * @param {string} key - The configuration key
   * @param {*} defaultValue - Default value if key doesn't exist
   * @returns {*} The configuration value
   */
  get(key, defaultValue = null) {
    if (key in this.config) {
      // If the value is encrypted, decrypt it
      if (typeof this.config[key] === 'string' && this.config[key].startsWith('enc:')) {
        try {
          return this._decrypt(this.config[key].substring(4));
        } catch (error) {
          console.error(`Error decrypting ${key}:`, error.message);
          return defaultValue;
        }
      }
      return this.config[key];
    }
    return defaultValue;
  }

  /**
   * Set a configuration value
   * @param {string} key - The configuration key
   * @param {*} value - The configuration value
   * @param {boolean} encrypt - Whether to encrypt the value
   */
  set(key, value, encrypt = false) {
    if (encrypt && typeof value === 'string') {
      this.config[key] = 'enc:' + this._encrypt(value);
    } else {
      this.config[key] = value;
    }
    this.saveConfig();
  }

  /**
   * Check if the configuration has a key
   * @param {string} key - The configuration key
   * @returns {boolean} True if the key exists
   */
  has(key) {
    return key in this.config;
  }

  /**
   * Remove a configuration value
   * @param {string} key - The configuration key
   */
  remove(key) {
    if (key in this.config) {
      delete this.config[key];
      this.saveConfig();
    }
  }

  /**
   * Run the setup wizard for first-time configuration
   * @returns {Promise<void>}
   */
  async runSetupWizard() {
    console.log('\n=== Abu Bot Setup Wizard ===\n');
    console.log('This wizard will help you set up the bot configuration.');
    console.log('Press Ctrl+C at any time to cancel.\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    try {
      // Server configuration
      if (!this.has('serverAddress')) {
        const serverAddress = await question('Enter Minecraft server address: ');
        this.set('serverAddress', serverAddress);
      }

      if (!this.has('serverPort')) {
        const serverPort = await question('Enter server port (default: 25565): ');
        this.set('serverPort', serverPort || '25565');
      }

      if (!this.has('gameVersion')) {
        const gameVersion = await question('Enter Minecraft version (default: 1.20.1): ');
        this.set('gameVersion', gameVersion || '1.20.1');
      }

      // Command password
      if (!this.has('commandPassword')) {
        const commandPassword = await question('Enter command password for bot control: ');
        this.set('commandPassword', commandPassword, true);
      }

      // Discord webhook
      if (!this.has('notificationEndpoint')) {
        console.log('\nDiscord webhook setup (for notifications):');
        const useWebhook = (await question('Do you want to set up Discord notifications? (y/n): ')).toLowerCase() === 'y';
        
        if (useWebhook) {
          const webhookUrl = await question('Enter Discord webhook URL: ');
          // Store the webhook URL with encryption
          this.set('notificationEndpoint', webhookUrl, true);
          this.set('notificationsEnabled', true);
        } else {
          this.set('notificationsEnabled', false);
        }
      }

      console.log('\nConfiguration saved successfully!');
      console.log('You can edit these settings later in the secure_config.json file.');
      console.log('Note: Sensitive information is encrypted in the configuration file.\n');

    } catch (error) {
      console.error('Error during setup:', error.message);
    } finally {
      rl.close();
    }
  }

  /**
   * Generate an encryption key based on machine-specific information
   * @returns {Buffer} The encryption key
   * @private
   */
  _generateKey() {
    // Use a combination of machine-specific information to generate a key
    // This is not perfect security, but makes it harder for casual inspection
    const os = require('os');
    const machineSeed = os.hostname() + os.userInfo().username + os.platform() + os.arch();
    
    // Create a deterministic key from the machine seed
    return crypto.createHash('sha256').update(machineSeed).digest();
  }

  /**
   * Encrypt a string
   * @param {string} text - The text to encrypt
   * @returns {string} The encrypted text (base64)
   * @private
   */
  _encrypt(text) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
      let encrypted = cipher.update(text, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error.message);
      return text; // Return original text if encryption fails
    }
  }

  /**
   * Decrypt a string
   * @param {string} encryptedText - The encrypted text (base64)
   * @returns {string} The decrypted text
   * @private
   */
  _decrypt(encryptedText) {
    try {
      const parts = encryptedText.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error.message);
      return encryptedText; // Return encrypted text if decryption fails
    }
  }
}

// Create a singleton instance
const secureConfig = new SecureConfig();

module.exports = secureConfig;
