function createBasicScene() {
  return {
    add: {
      sprite() {
        return {
          setScale() { return this; },
          setDepth() { return this; },
          setAngle() { return this; },
          setOrigin() { return this; },
          destroy() {}
        };
      },
      text() {
        return {
          setOrigin() { return this; },
          setShadow() { return this; },
          setDepth() { return this; },
          setScale() { return this; },
          destroy() {}
        };
      }
    },
    tweens: { add(cfg) { if (cfg.onComplete) cfg.onComplete(); return { progress: 0 }; } },
    time: {
      addEvent() { return { remove() {} }; },
      delayedCall() { return { remove() {} }; }
    }
  };
}

function createSpawnContext(overrides = {}) {
  return {
    Phaser: {
      Math: {
        Between: (min, max) => (min === 0 && max === 4 ? 1 : min),
        Vector2: class {
          constructor(x, y) { this.x = x; this.y = y; }
          length() { return Math.hypot(this.x, this.y); }
          normalize() { const len = this.length() || 1; this.x /= len; this.y /= len; return this; }
        }
      },
      Utils: { Array: { GetRandom: a => a[0] } }
    },
    debugLog: () => {},
    DEBUG: false,
    DOG_TYPES: [{ type: 'standard', emoji: '🐶' }],
    wanderers: [],
    queue: [],
    queueLimit: () => 2,
    customersQueueLimit: () => 2,
    gameOver: false,
    maxWanderers: () => 5,
    customersMaxWanderers: () => 5,
    scheduleNextSpawn: () => {},
    lureNextWanderer: () => {},
    sendDogOffscreen: () => {},
    Assets: { keys: ['c1'] },
    keys: ['c1'],
    customerMemory: {},
    CustomerState: { NORMAL: 0, BROKEN: 1, MENDING: 2, GROWING: 3, SPARKLING: 4, ARROW: 5 },
    MENU: [{ name: 'Coffee', price: 5 }],
    WANDER_TOP: 0,
    WANDER_BOTTOM: 10,
    loopsForState: () => 1,
    EDGE_TURN_BUFFER: 40,
    scaleForY: () => 1,
    dur: v => v,
    floatingEmojis: [],
    setDepthFromBottom: () => {},
    HEART_EMOJIS: { 0: '' },
    ORDER_X: 230,
    ORDER_Y: 315,
    WAIT_DISTANCE: 25,
    WAIT_SPACING: 30,
    CUSTOMER_SCALE: 0.8,
    DOG_DEFAULT_SCALE: 0.48,
    SPAWN_DELAY: 2000,
    SPAWN_VARIANCE: 1500,
    RESPAWN_COOLDOWN: 8000,
    ...overrides
  };
}

module.exports = { createBasicScene, createSpawnContext };
