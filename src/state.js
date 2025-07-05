/**
 * Global state container used across the game.
 *
 * @property {number} money - Current amount of money the player has.
 * @property {number} love - Overall love score.
 * @property {Array<Object>} queue - Customers waiting to order. The first
 * element is the customer currently at the front of the line.
 * @property {?Object} activeCustomer - Customer being served at the counter.
 * This is removed once the customer leaves the counter.
 * @property {Array<Object>} wanderers - Customers wandering the scene who are
 * not yet in the queue.
 * @property {Array<Object>} sparrows - Active sparrow entities on screen.
 * @property {?Phaser.Time.TimerEvent} spawnTimer - Timer for scheduling the
 * next wanderer spawn.
 * @property {?Phaser.Time.TimerEvent} lureRetry - Timer used when retrying to
 * lure a wanderer into the queue.
 * @property {?Phaser.Time.TimerEvent} sparrowSpawnEvent - Scheduled event for
 * spawning the next sparrow.
 * @property {?Phaser.Time.TimerEvent} dogBarkEvent - Scheduled event for the
 * next dog bark sound.
 * @property {boolean} falconActive - True while a falcon attack sequence is
 * running. Used to pause regular customer behaviour.
 * @property {boolean} gameOver - Set once a win or lose condition is reached.
 * @property {number} loveLevel - Current unlocked love level.
 * @property {number} servedCount - Total number of customers served.
 * @property {boolean} saleInProgress - True while a purchase dialog is
 * displayed and player interaction is locked.
 * @property {boolean} dialogActive - True while any order dialog is visible.
 * Prevents overlapping dialogs when the queue shifts during animations.
 * @property {boolean} orderInProgress - True from the moment a customer heads
 * to the counter until they leave so only one customer can order at a time.
 * @property {?Object} heartWin - Reference to the special ending trigger
 * object when active.
 * @property {boolean} girlReady - Indicates when the main character sprite is
 * ready for interaction.
 * @property {?Object} truck - Game object representing the coffee truck.
 * @property {?Object} falcon - Game object for the falcon enemy.
 * @property {?Object} girl - Player character game object.
 * @property {number} girlHP - Current hit points for the girl during falcon
 * attacks.
 * @property {number} falconHP - Current hit points for the falcon during
 * battles.
 * @property {boolean} falconStunned - True while the falcon is temporarily
 * stunned.
 * @property {Array<string>} badges - Earned achievement badges.
 * @property {Object<string, number>} badgeCounts - Count of how many times each
 * badge has been earned.
 * @property {?Phaser.GameObjects.Image} carryPortrait - Portrait temporarily
 * carried above the player's head.
 * @property {?string} lastEndKey - Tracks the last ending shown so it is not
 * repeated.
 * @property {?Phaser.GameObjects.Container} phoneContainer - Container for the
 * in‑game phone UI.
 * @property {Array<Phaser.Time.TimerEvent>} activeBarks - Timers for currently
 * playing dog bark sounds.
 * @property {Array<Object>} activeBursts - References to active particle
 * effects such as coffee bursts.
 * @property {?Phaser.GameObjects.Container} victoryOverlay - Overlay displayed
 * when the player wins the falcon encounter.
 * @property {boolean} falconDefeated - True once the falcon boss has been
 * beaten.
 * @property {boolean} slotsRevealed - Whether the phone achievement slots have
 * been shown.
 * @property {boolean} startScreenSeen - Whether the start screen has been
 * displayed already.
 * @property {boolean} achievementsRevealed - Tracks if the achievements screen
 * has been opened at least once.
 */
export const GameState = {
  money: 10.00,
  love: 3,
  queue: [],
  activeCustomer: null,
  wanderers: [],
  sparrows: [],
  spawnTimer: null,
  lureRetry: null,
  sparrowSpawnEvent: null,
  dogBarkEvent: null,
  falconActive: false,
  gameOver: false,
  loveLevel: 1,
  servedCount: 0,
  saleInProgress: false,
  // True while an order dialog is visible. Used to avoid overlapping dialogs
  // when the queue shifts during animations.
  dialogActive: false,
  // True from the moment a customer heads to the counter until they exit
  // so only one customer can approach the order spot at a time.
  orderInProgress: false,
  heartWin: null,
  girlReady: false,
  truck: null,
  falcon: null,
  girl: null
  ,girlHP: 10
  ,falconHP: 10
  ,falconStunned: false
  ,badges: []
  ,badgeCounts: {}
  ,carryPortrait: null
  ,lastEndKey: null
  ,phoneContainer: null
  ,activeBarks: []
  ,activeBursts: []
  ,victoryOverlay: null
  ,falconDefeated: false
  ,slotsRevealed: false
  ,startScreenSeen: false
  ,achievementsRevealed: false
};

export const floatingEmojis = [];

export const customerMemory = {};
GameState.customerMemory = customerMemory;

export function addFloatingEmoji(emoji) {
  if (emoji) floatingEmojis.push(emoji);
}

export function removeFloatingEmoji(emoji) {
  const idx = floatingEmojis.indexOf(emoji);
  if (idx !== -1) floatingEmojis.splice(idx, 1);
}

export function loadAchievements() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem('coffeeGirlAchievements');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.badges)) GameState.badges = data.badges.slice();
    if (data.badgeCounts && typeof data.badgeCounts === 'object') {
      GameState.badgeCounts = { ...data.badgeCounts };
    }
  } catch {
    // ignore malformed storage
  }
}

export function saveAchievements() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const data = { badges: GameState.badges, badgeCounts: GameState.badgeCounts };
    window.localStorage.setItem('coffeeGirlAchievements', JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

export function resetAchievements() {
  GameState.badges = [];
  GameState.badgeCounts = {};
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem('coffeeGirlAchievements');
    } catch {
      // ignore quota errors
    }
  }
}
