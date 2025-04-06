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

1. Create a `.env` file in the root directory with the following content:
   ```
   SERVER_ADDRESS=your_minecraft_server_address
   PORT=25565
   VERSION=1.20.1
   COMMAND_PASSWORD=your_command_password
   WEBHOOK_URL=your_discord_webhook_url
   ```

2. Edit the `config.json` file to configure your farms and bots.

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
