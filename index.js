const fs = require("fs");
const readline = require("readline");
const ConnectionManager = require("./core/ConnectionManager");
const CacheManager = require("./core/CacheManager");
const { spawnBots, setReadlineInterface } = require("./botManager");
const updateChecker = require("./utils/UpdateChecker");
require("dotenv").config();

// Display version information
const packageJson = require("./package.json");
console.log(`Abu Bot v${packageJson.version}`);

// Check for updates
if (updateChecker.isGitInstalled() && updateChecker.checkIsGitRepo()) {
  console.log("Checking for updates...");
  const hasUpdates = updateChecker.checkForUpdates();
  if (!hasUpdates) {
    console.log("You have the latest version.");
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Share the readline interface with botManager
setReadlineInterface(rl);

const cacheManager = new CacheManager();

// Promise wrapper for readline question
const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

async function startBots() {
  try {
    // Start periodic update checks
    updateChecker.startPeriodicChecks();

    // Read existing config
    let config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

    // Reconnect bots from cache
    console.log("\n=== Reconnecting Bots from Cache ===");
    console.log(""); // Add an empty line
    const cachedBots = cacheManager.cache.bots;
    for (const botData of cachedBots) {
      if (botData.state === "running") {
        console.log(`Reconnecting bot ${botData.username}...`);
        const connectionManager = new ConnectionManager({
          host: botData.serverAddress,
          port: process.env.PORT,
          version: process.env.VERSION,
          username: botData.username,
          authMethod: botData.authMethod,
          farms: botData.farm
            ? [config.farms.find((farm) => farm.name === botData.farm)]
            : [], // Find farm object by name
        });
        connectionManager.connect();
        // Wait for 5 seconds before starting the next bot to prevent server overload
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    // Main Menu
    console.log("\n=== Main Menu ===");
    console.log(""); // Add an empty line
    console.log("1. Operate Farms (mallulifesteal.fun)");
    console.log("2. Spawn Bots");
    const option = await question("Choose an option (1 or 2): ");

    if (option === "1") {
      // Farm Selection
      console.log("\n=== Farm Selection ===");
      if (!config.farms || config.farms.length === 0) {
        console.log("No farms configured. Please add farms to config.json.");
        rl.close();
        return;
      }

      // Display farm options
      console.log("Available Farms:");
      config.farms.forEach((farm, index) => {
        console.log(`${index + 1}. ${farm.name}`);
      });

      const farmIndicesStr = await question(
        "Enter the numbers of the farms to operate (comma or space-separated, e.g., 1,2 or 1 2): ",
      );

      // Support both comma-separated and space-separated input
      // First check if the input contains commas
      let farmIndices = [];
      if (farmIndicesStr.trim() === "") {
        console.log("No farms selected. Exiting...");
        rl.close();
        return;
      } else if (farmIndicesStr.includes(",")) {
        // Process as comma-separated
        farmIndices = farmIndicesStr.split(",")
          .map((s) => s.trim())
          .filter((s) => s !== "")
          .map((s) => parseInt(s) - 1);
      } else {
        // Process as space-separated
        farmIndices = farmIndicesStr.split(/\s+/)
          .filter((s) => s.trim() !== "")
          .map((s) => parseInt(s) - 1);
      }

      // Check if we have any valid farm indices
      if (farmIndices.length === 0) {
        console.log("No valid farm numbers provided. Exiting...");
        rl.close();
        return;
      }

      const selectedFarms = [];
      for (const farmIndex of farmIndices) {
        if (
          isNaN(farmIndex) || farmIndex < 0 || farmIndex >= config.farms.length
        ) {
          console.error("Invalid farm selection.");
          rl.close();
          return;
        }
        selectedFarms.push(config.farms[farmIndex]);
      }

      console.log(
        `Selected Farms: ${selectedFarms.map((farm) => farm.name).join(", ")}`,
      );

      // Start bots for the selected farms
      console.log("\n=== Starting Bots ===");
      for (const selectedFarm of selectedFarms) {
        for (const botUsername of selectedFarm.bots) {
          const account = config.accounts.find((acc) =>
            acc.username === botUsername
          );
          if (!account) {
            console.error(`Account not found for bot: ${botUsername}`);
            continue;
          }

          console.log(
            `\nStarting bot ${botUsername} for farm ${selectedFarm.name}...`,
          );

          const connectionManager = new ConnectionManager({
            host: config.serverAddress,
            port: config.port,
            version: config.version,
            username: account.username,
            password: account.password,
            farms: selectedFarms, // Pass the selected farms to the connection manager
          });

          // Connect the bot
          connectionManager.connect();

          // Wait for 5 seconds before starting the next bot to prevent server overload
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    } else if (option === "2") {
      await spawnBots(config);
    } else {
      console.log("Invalid option.");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Stop update checker
    updateChecker.stopPeriodicChecks();
    rl.close();
  }
}

// Helper function to clear the console
function clearConsole() {
  console.clear();
}

// Start the program
clearConsole();
console.log("=== Minecraft Bot Manager ===");
startBots();
