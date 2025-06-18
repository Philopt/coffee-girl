export const GameState = {
  money: 10.00,
  love: 10,
  queue: [],
  activeCustomer: null,
  wanderers: [],
  sparrows: [],
  spawnTimer: null,
  sparrowSpawnEvent: null,
  falconActive: false,
  gameOver: false,
  loveLevel: 1,
  servedCount: 0,
  heartWin: null,
  girlReady: false,
  truck: null,
  girl: null
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
