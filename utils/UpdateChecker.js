const { execSync } = require("child_process");
const discordWebhook = require("./DiscordWebhook");

class UpdateChecker {
  constructor() {
    this.repoUrl = "https://github.com/safder2000/abu_05.git";
    this.checkInterval = 3600000; // Check every hour (in milliseconds)
    this.intervalId = null;
    this.isGitRepo = this.checkIsGitRepo();
  }

  /**
   * Check if the current directory is a git repository
   * @returns {boolean}
   */
  checkIsGitRepo() {
    try {
      execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if git is installed
   * @returns {boolean}
   */
  isGitInstalled() {
    try {
      execSync("git --version", { stdio: "ignore" });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start periodic update checks
   */
  startPeriodicChecks() {
    if (!this.isGitInstalled() || !this.isGitRepo) {
      console.log(
        "Update checker disabled: Git not installed or not a Git repository",
      );
      return;
    }

    // Do an initial check
    this.checkForUpdates();

    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.checkForUpdates();
    }, this.checkInterval);

    console.log(`Update checker started`);
  }

  /**
   * Stop periodic update checks
   */
  stopPeriodicChecks() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("Update checker stopped");
    }
  }

  /**
   * Check for updates
   * @returns {boolean} True if updates are available
   */
  checkForUpdates() {
    if (!this.isGitInstalled() || !this.isGitRepo) {
      return false;
    }

    try {
      // Fetch the latest changes without merging
      execSync("git fetch origin", { stdio: "ignore" });

      // Get the current branch
      const branch = execSync("git rev-parse --abbrev-ref HEAD").toString()
        .trim();

      // Get the number of commits behind
      const behindCount = parseInt(
        execSync(`git rev-list --count HEAD..origin/${branch}`).toString()
          .trim(),
      );

      if (behindCount > 0) {
        const message =
          `Updates available: ${behindCount} new commit(s). Run update.bat to update.`;
        console.log("\x1b[33m%s\x1b[0m", message); // Yellow text

        // Send to Discord
        discordWebhook.send(message, "Update Available", "FFFF00");

        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking for updates:", error.message);
      return false;
    }
  }
}

// Create a singleton instance
const updateChecker = new UpdateChecker();

module.exports = updateChecker;
