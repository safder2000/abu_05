# Abu Bot

A Minecraft bot manager for automating farm tasks.

## Features

- Automated farm management with multiple bots
- Selective chat logging (only first bot logs chat)
- Health monitoring with alerts for low health
- Security alerts for non-whitelisted players
- Discord webhook integration for important events
- Auto-update system

## Installation

1. Make sure you have [Node.js](https://nodejs.org/) installed
2. Make sure you have [Git](https://git-scm.com/) installed
3. Clone this repository:
   ```
   git clone https://github.com/safder2000/abu_05.git
   ```
4. Navigate to the project directory:
   ```
   cd abu_05
   ```
5. Install dependencies:
   ```
   npm install
   ```

## Configuration

1. **First-time Setup Wizard**:
   - When you run the bot for the first time, a setup wizard will guide you through the configuration process
   - You'll be asked to enter your Minecraft server address, port, version, and other settings
   - Sensitive information like passwords and webhook URLs are stored securely

2. **Manual Configuration**:
   - Edit the `config.json` file to configure your farms and bots
   - Sensitive configuration is stored in `secure_config.json` (this file should not be shared)

3. **Security Features**:
   - Sensitive information is encrypted using machine-specific keys
   - Discord webhook URLs and command passwords are protected from casual inspection

## Usage

### Using Batch Files (Windows)

1. **Run the bot**:
   - Double-click `run.bat`
   - This will check for updates and start the bot

2. **Update the bot**:
   - Double-click `update.bat`
   - This will pull the latest changes from the repository

### Using Command Line

1. **Run the bot**:
   ```
   node index.js
   ```

2. **Update the bot**:
   ```
   git pull origin main
   npm install
   ```

## Bot Commands

Bots respond to whisper commands that start with "abu":

- `abu tpme` - Teleport the bot to you
- `abu tphere` - Teleport you to the bot
- `abu follow me [distance]` - Make the bot follow you
- `abu say [message]` - Make the bot say something in chat

## Security Features

- Whitelist system for authorized users
- Alerts for non-whitelisted players approaching bots
- Health monitoring with critical alerts
- Discord notifications for important events

## Troubleshooting

If you encounter any issues:

1. Check the console for error messages
2. Make sure your Minecraft server is running
3. Verify your `.env` configuration
4. Try running `update.bat` to get the latest version

## License

ISC
