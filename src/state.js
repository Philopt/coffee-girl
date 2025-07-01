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
