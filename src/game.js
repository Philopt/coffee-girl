import { GameState, loadAchievements, loadVolume, loadPlayerName } from './state.js';
import * as CustomerQueue from './entities/customerQueue.js';
import * as Dog from './entities/dog.js';
import { setupGame, showStartScreen, handleAction, spawnCustomer, scheduleNextSpawn, showDialog, animateLoveChange, blinkButton } from './main.js';

// Initialize the Phaser game scene using main.js logic
export function startGame() {
  // Touch imported modules so linter treats them as used
  void GameState;
  void CustomerQueue;
  void Dog;
  loadAchievements();
  loadVolume();
  loadPlayerName();
  setupGame();
}

// Start the game immediately when loaded in a browser
if (typeof window !== 'undefined') {
  window.GameState = GameState;
  startGame();
}

// Re-export key helpers so other modules can delegate to main.js
export { showStartScreen, handleAction, spawnCustomer, scheduleNextSpawn, showDialog, animateLoveChange, blinkButton };
