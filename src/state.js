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
  ,heartCloud: null
  ,heartCloudBaseScale: 2.4
  ,girlHP: 10
  ,falconHP: 10
  ,falconStunned: false
  ,badges: []
  ,badgeCounts: {}
  ,lastEndKey: null
  ,phoneContainer: null
  ,activeBarks: []
  ,activeBursts: []
  ,victoryOverlay: null
  ,falconDefeated: false
  ,slotsRevealed: false
  ,startScreenSeen: false
  ,achievementsRevealed: false
  ,firedSeqStarted: false
  ,loveSeqStarted: false
  ,currentSong: null
  ,currentBadgeSong: null
  ,songInstance: null
  ,musicLoops: []
  ,drumLoop: null
  ,drumMeter: null

  ,zombieMode: false

  ,volume: 1
  ,userName: null
  ,nickname: null

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
    if (data.achievementsRevealed) GameState.achievementsRevealed = !!data.achievementsRevealed;
    if (data.slotsRevealed) GameState.slotsRevealed = !!data.slotsRevealed;
    if (typeof data.lastEndKey === 'string' || data.lastEndKey === null) {
      GameState.lastEndKey = data.lastEndKey;
    }
  } catch (err) {
    // ignore malformed storage
  }
}

export function saveAchievements() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const data = {
      badges: GameState.badges,
      badgeCounts: GameState.badgeCounts,
      achievementsRevealed: GameState.achievementsRevealed,
      slotsRevealed: GameState.slotsRevealed,
      lastEndKey: GameState.lastEndKey,
    };
    window.localStorage.setItem('coffeeGirlAchievements', JSON.stringify(data));
  } catch (err) {
    // ignore quota errors
  }
}

export function resetAchievements() {
  GameState.badges = [];
  GameState.badgeCounts = {};
  GameState.achievementsRevealed = false;
  GameState.slotsRevealed = false;
  GameState.lastEndKey = null;
  GameState.userName = null;
  GameState.nickname = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem('coffeeGirlAchievements');
    } catch (err) {
      // ignore quota errors
    }
  }
}

export function loadVolume() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const raw = window.localStorage.getItem('coffeeGirlVolume');
  const val = parseFloat(raw);
  if (!isNaN(val)) GameState.volume = Math.min(1, Math.max(0, val));
}

export function saveVolume() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem('coffeeGirlVolume', String(GameState.volume));
  } catch (err) {
    // ignore quota errors
  }
}
