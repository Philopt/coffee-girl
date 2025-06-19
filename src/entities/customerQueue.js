import { debugLog } from '../debug.js';
import { dur, scaleForY } from '../ui.js';
import {
  MENU,
  SPAWN_DELAY,
  SPAWN_VARIANCE,
  QUEUE_SPACING,
  ORDER_X,
  ORDER_Y,
  QUEUE_X,
  QUEUE_OFFSET,
  QUEUE_Y,
  WANDER_TOP,
  WANDER_BOTTOM,
  maxWanderers as customersMaxWanderers,
  queueLimit as customersQueueLimit
} from '../customers.js';
import { GameState } from '../state.js';
import { CustomerState } from '../constants.js';

import { showDialog, Assets } from '../main.js';
import { startWander, loopsForState } from './wanderers.js';
import { DOG_TYPES, updateDog, scaleDog } from './dog.js';
import { setDepthFromBottom } from '../ui/helpers.js';


// Slow down queue movement to match wander speed change
const CUSTOMER_SPEED = 560 / 12;
// Customers should walk to the queue faster than they wander around.
// Previously LURE_SPEED was slower (0.6x) which made walking up feel sluggish
// and caused customers to lag behind their wander speed.
const LURE_SPEED = CUSTOMER_SPEED * 1.5;
const EDGE_TURN_BUFFER = 40;
// Trigger arrival when two customer sprites get this close while walking
const EARLY_COLLIDE_DIST = 32;
const HEART_EMOJIS = {
  [CustomerState.NORMAL]: null,
  [CustomerState.BROKEN]: '💔',
  [CustomerState.MENDING]: '❤️‍🩹',
  [CustomerState.GROWING]: '💗',
  [CustomerState.SPARKLING]: '💖',
  [CustomerState.ARROW]: '💘'
};

export function maxWanderers() {
  return customersMaxWanderers();
}

export function queueLimit() {
  return customersQueueLimit(GameState.love);
}

export function lureNextWanderer(scene, specific) {
  if (typeof debugLog === 'function') {
    debugLog('lureNextWanderer', GameState.queue.length, GameState.wanderers.length, GameState.activeCustomer);
  }

  // clear stale tween references that were stopped externally
  GameState.queue.forEach(c => {
    if (c.walkTween && !c.walkTween.isPlaying) {
      c.walkTween = null;
    }
  });

  if (GameState.wanderers.length && GameState.queue.length < queueLimit()) {
    if (GameState.queue.some((c, i) => i > 0 && c.walkTween && c.walkTween.isPlaying)) {
      if (typeof debugLog === 'function') {
        debugLog('lureNextWanderer abort: walkTween active');
      }

      if (scene && scene.time && scene.time.delayedCall) {
        scene.time.delayedCall(250, () => lureNextWanderer(scene, specific), [], scene);

      }
      return;
    }

    let c;
    if (specific) {
      const idx = GameState.wanderers.indexOf(specific);
      if (idx === -1) return;
      c = GameState.wanderers.splice(idx, 1)[0];
    } else {
      let closestIdx = 0;
      let minDist = Number.MAX_VALUE;
      for (let i = 0; i < GameState.wanderers.length; i++) {
        const d = Math.abs(GameState.wanderers[i].sprite.x - ORDER_X);
        if (d < minDist) {
          closestIdx = i;
          minDist = d;
        }
      }
      c = GameState.wanderers.splice(closestIdx, 1)[0];
    }
    if (c.walkTween) {
      c.walkTween.stop();
      c.walkTween.remove();
      c.walkTween = null;
    }
    if (c.pauseEvent) { c.pauseEvent.remove(); c.pauseEvent = null; }
    const idx = GameState.queue.length;
    c.atOrder = false;
    c.arrived = false;
    c.arrivalTime = 0;
    GameState.queue.push(c);

    // Dogs no longer wait in the queue. They stay near their owner until
    // the owner reaches the counter.

    if (typeof debugLog === 'function') debugLog('customer lured to queue');
    GameState.activeCustomer = GameState.queue[0];
    const targetX = ORDER_X;
    const targetY = ORDER_Y;
    setDepthFromBottom(c.sprite, 5);
    const dir = c.dir || (c.sprite.x < targetX ? 1 : -1);
    c.walkTween = curvedApproach(scene, c.sprite, dir, targetX, targetY, () => {
      c.walkTween = null;
      registerArrival(scene, c);
    }, LURE_SPEED, c);
    if (typeof checkQueueSpacing === 'function') checkQueueSpacing(scene);
  }
}

export function moveQueueForward() {
  if (typeof debugLog === 'function') {
    debugLog('moveQueueForward', GameState.queue.length, GameState.wanderers.length, GameState.activeCustomer);
  }
  const scene = this;
  let willShow = false;
  GameState.queue.forEach((cust, idx) => {
    const tx = idx === 0 ? ORDER_X : QUEUE_X - QUEUE_SPACING * (idx - 1);
    const ty = idx === 0 ? ORDER_Y : QUEUE_Y - QUEUE_OFFSET * (idx - 1);
    if (cust.sprite.y !== ty || cust.sprite.x !== tx) {
      const dir = cust.dir || (cust.sprite.x < tx ? 1 : -1);
      cust.walkTween = curvedApproach(scene, cust.sprite, dir, tx, ty, () => {
        cust.walkTween = null;
        if (idx === 0) {
          if (typeof debugLog === 'function') debugLog('customer reached order position');
          if (typeof debugLog === 'function') {
            debugLog('curvedApproach complete: calling showDialog');
          }
          showDialog.call(scene);
        }
      }, idx === 0 ? CUSTOMER_SPEED : LURE_SPEED, cust);
      if (idx === 0) willShow = true;
    }
  });
  GameState.activeCustomer = GameState.queue[0] || null;
  if (GameState.activeCustomer) {
    if (!willShow && GameState.activeCustomer.sprite.y === ORDER_Y && GameState.activeCustomer.sprite.x === ORDER_X) {
      if (typeof debugLog === 'function') debugLog('customer reached order position');
      showDialog.call(scene);
    }
  }
  if (GameState.girlReady && GameState.queue.length < queueLimit()) {
    lureNextWanderer(scene);
  }
  if (typeof checkQueueSpacing === 'function') checkQueueSpacing(scene);
}

export function checkQueueSpacing(scene) {
  GameState.queue.forEach((cust, idx) => {
    const tx = idx === 0 ? ORDER_X : QUEUE_X - QUEUE_SPACING * (idx - 1);
    const ty = idx === 0 ? ORDER_Y : QUEUE_Y - QUEUE_OFFSET * (idx - 1);
    const dist = Phaser.Math.Distance.Between(cust.sprite.x, cust.sprite.y, tx, ty);
    if (dist > 2) {
      if (cust.walkTween) {
        if (cust.walkTween.isPlaying) {
          // Already moving toward the correct spot. Don't reset the tween,
          // otherwise lureNextWanderer will keep aborting and the queue will
          // never fill beyond two customers.
          return;
        }
        cust.walkTween.stop();
        cust.walkTween.remove();
        cust.walkTween = null;
      }
      const dir = cust.dir || (cust.sprite.x < tx ? 1 : -1);
      const tween = curvedApproach(
        scene,
        cust.sprite,
        dir,
        tx,
        ty,
        () => {
          if (idx === 0) {
            if (typeof debugLog === 'function') {
              debugLog('checkQueueSpacing complete: calling showDialog');
            }
            showDialog.call(scene);
          }
        },
        idx === 0 ? CUSTOMER_SPEED : LURE_SPEED,
        cust
      );
      // Track the tween so future spacing checks don't interrupt it while
      // the customer is already moving. Previously only the front customer
      // stored its tween, which allowed new lures to trigger while others were
      // still walking, causing jitter and occasional teleporting.
      cust.walkTween = tween;
    }
  });
}

function registerArrival(scene, cust) {
  cust.arrived = true;
  cust.arrivalTime = scene.time ? scene.time.now : Date.now();
  if (cust.dogCustomer) {
    cust.dogCustomer.arrived = true;
    cust.dogCustomer.arrivalTime = cust.arrivalTime;
  }
  GameState.queue.sort((a, b) => {
    if (a.arrived && b.arrived) return a.arrivalTime - b.arrivalTime;
    if (a.arrived) return -1;
    if (b.arrived) return 1;
    return 0;
  });
  moveQueueForward.call(scene);
}

function curvedApproach(scene, sprite, dir, targetX, targetY, onComplete, speed = CUSTOMER_SPEED, cust) {
  const startX = sprite.x;
  const startY = sprite.y;
  const dx = Math.abs(targetX - startX);
  const offset = Math.min(20, dx * 0.5) * dir;
  const curve = new Phaser.Curves.CubicBezier(
    new Phaser.Math.Vector2(startX, startY),
    new Phaser.Math.Vector2(startX + offset, startY),
    new Phaser.Math.Vector2(targetX - offset, targetY),
    new Phaser.Math.Vector2(targetX, targetY)
  );
  const dist = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
  const duration = dur((dist / speed) * 1000);
  const follower = { t: 0, vec: new Phaser.Math.Vector2() };
  let tween;
  const checkCollision = () => {
    if (!cust || cust.arrived) return false;
    for (const other of GameState.queue) {
      if (other === cust || !other.sprite) continue;
      const d = Phaser.Math.Distance.Between(sprite.x, sprite.y, other.sprite.x, other.sprite.y);
      if (d < EARLY_COLLIDE_DIST) {
        if (tween) tween.stop();
        cust.walkTween = null;
        registerArrival(scene, cust);
        return true;
      }
    }
    return false;
  };
  tween = scene.tweens.add({
    targets: follower,
    t: 1,
    duration,
    ease: 'Linear',
    onUpdate: () => {
      curve.getPoint(follower.t, follower.vec);
      sprite.setPosition(follower.vec.x, follower.vec.y);
      sprite.setScale(scaleForY(sprite.y));
      checkCollision();
    },
    onComplete: () => {
      sprite.setPosition(targetX, targetY);
      sprite.setScale(scaleForY(targetY));
      if (onComplete) onComplete();
    }
  });
  return tween;
}

export function scheduleNextSpawn(scene) {
  if (GameState.falconActive) return;
  if (GameState.spawnTimer) {
    GameState.spawnTimer.remove(false);
  }
  const needed = queueLimit() - (GameState.queue.length + GameState.wanderers.length);
  let delay;
  if (needed > 0) {
    delay = 500;
  } else {
    delay = SPAWN_DELAY + Phaser.Math.Between(0, SPAWN_VARIANCE);
  }
  GameState.spawnTimer = scene.time.delayedCall(delay, spawnCustomer, [], scene);
}

export function spawnCustomer() {
  if (typeof debugLog === 'function') {
    debugLog('spawnCustomer', GameState.queue.length, GameState.wanderers.length, GameState.activeCustomer);
  }
  if (GameState.gameOver) return;
  const createOrder = () => {
    const coins = Phaser.Math.Between(0, 20);
    const item = Phaser.Utils.Array.GetRandom(MENU);
    const qty = 1;
    return { coins, req: item.name, price: item.price, qty };
  };

  const c = { orders: [], pauseEvent: null };
  const used = new Set();
  if (GameState.activeCustomer && GameState.activeCustomer.spriteKey) {
    used.add(GameState.activeCustomer.spriteKey);
  }
  GameState.queue.forEach(cust => {
    if (cust.spriteKey) used.add(cust.spriteKey);
  });
  GameState.wanderers.forEach(cust => {
    if (cust.spriteKey) used.add(cust.spriteKey);
  });
  const spriteKeys = (this && this.assets && this.assets.keys) || (Assets && Assets.keys) || (typeof keys !== 'undefined' ? keys : []);
  let available = spriteKeys.filter(k => !used.has(k));
  if (available.length === 0) available = spriteKeys.slice();
  const k = Phaser.Utils.Array.GetRandom(available);
  c.spriteKey = k;

  const memory = GameState.customerMemory[k] || { state: CustomerState.NORMAL };
  GameState.customerMemory[k] = memory;
  if (!memory.dogMemory) {
    // Leave hasDog undefined so spawn logic can randomize on first encounter
    memory.dogMemory = { hasDog: undefined, type: null, state: CustomerState.NORMAL };
  }
  c.memory = memory;
  const order = createOrder();

  if (GameState.wanderers.length >= maxWanderers()) {
    scheduleNextSpawn(this);
    return;
  }
  const startW = typeof startWander === 'function' ? startWander : function(scene, cust, targetX, exitAfter) {
    const duration = (typeof dur === 'function') ? dur(1000) : 1000;
    cust.walkData = { startX: cust.sprite.x, startY: cust.sprite.y, targetX, amp: 0, freq: 0, duration, exitAfter };
    if (scene && scene.tweens && scene.tweens.add) {
      scene.tweens.add({ targets: cust.sprite, x: targetX, duration, onComplete: () => {
        if (exitAfter) {
          const idx = (GameState.wanderers || scene.wanderers || []).indexOf(cust);
          if (idx >= 0) (GameState.wanderers || scene.wanderers).splice(idx, 1);
          if (cust.sprite.destroy) cust.sprite.destroy();
        }
      }});
    }
  };

  const dir = Phaser.Math.Between(0, 1) ? 1 : -1;
  const startX = dir === 1 ? -40 : 520;
  const exitX = dir === 1 ? 520 : -40;
  c.dir = dir;
  c.loopsRemaining = loopsForState(c.memory.state);
  const startY = Phaser.Math.Between(WANDER_TOP, WANDER_BOTTOM);
  const distScale = scaleForY(startY);
  c.orders.push(order);
  c.atOrder = false;
  c.sprite = this.add.sprite(startX, startY, k).setScale(distScale);
  setDepthFromBottom(c.sprite, 5);
  if (c.memory.state !== CustomerState.NORMAL) {
    c.heartEmoji = this.add.text(0, 0, HEART_EMOJIS[c.memory.state] || '', { font: '28px sans-serif' })
      .setOrigin(0.5)
      .setShadow(0, 0, '#000', 4);
  }

  let spawnDog = memory.dogMemory.hasDog;
  if (spawnDog === undefined) {
    spawnDog = Phaser.Math.Between(0, 4) === 0;
    memory.dogMemory.hasDog = spawnDog;
    if (spawnDog) {
      const chosen = Phaser.Utils.Array.GetRandom(DOG_TYPES);
      memory.dogMemory.type = chosen.type;
      memory.dogMemory.state = CustomerState.NORMAL;
    }
  }

  if (spawnDog) {
    const side = Phaser.Math.Between(0, 1) ? 1 : -1;
    const offsetX = side * Phaser.Math.Between(20, 30);
    const offsetY = Phaser.Math.Between(10, 20);
    const dogType = DOG_TYPES.find(d => d.type === memory.dogMemory.type) || Phaser.Utils.Array.GetRandom(DOG_TYPES);
    const dog = this.add.sprite(startX + offsetX, startY + offsetY, 'dog1', 1)
      .setOrigin(0.5)
      .setTint(dogType.tint || 0xffffff);
    dog.scaleFactor = dogType.scale || 0.6;
    dog.dir = 1;
    dog.prevX = dog.x;
    dog.dogType = dogType.type;
    dog.hasBarked = false;
    scaleDog(dog);
    c.dog = dog;

    dog.followEvent = this.time.addEvent({
      delay: dur(Phaser.Math.Between(800, 1200)),
      loop: true,
      callback: () => { if (typeof updateDog === 'function') updateDog.call(this, c); }
    });

    const dogCust = {
      sprite: dog,
      spriteKey: 'dog1',
      orders: [{ coins: 0, req: 'PUP CUP', price: 0.00, qty: 1 }],
      dir: c.dir,
      memory: memory.dogMemory,
      atOrder: false,
      isDog: true,
      owner: c,
      walkTween: null,
      pauseEvent: null
    };
    dog.dogCustomer = dogCust;
    c.dogCustomer = dogCust;

    if (dogCust.memory.state !== CustomerState.NORMAL) {
      dogCust.heartEmoji = this.add.text(0, 0, HEART_EMOJIS[dogCust.memory.state] || '', { font: '28px sans-serif' })
        .setOrigin(0.5)
        .setShadow(0, 0, '#000', 4);
      dog.heartEmoji = dogCust.heartEmoji;
    }
  }
  const insideX = dir === 1 ? 480 - EDGE_TURN_BUFFER : EDGE_TURN_BUFFER;
  const firstTarget = c.loopsRemaining > 0 ? insideX : exitX;
  startW(this, c, firstTarget, c.loopsRemaining === 0);

  GameState.wanderers.push(c);
  if ((GameState.queue.length === 0 || GameState.girlReady) && GameState.queue.length < queueLimit()) {
    lureNextWanderer(this);
  }
  scheduleNextSpawn(this);
  if (this.time && this.time.delayedCall) {
    this.time.delayedCall(1000, () => {
      if (GameState.girlReady && GameState.queue.length < queueLimit() && GameState.wanderers.includes(c)) {
        lureNextWanderer(this);
      } else if (!GameState.girlReady) {
        this.time.delayedCall(1000, () => {
          if (GameState.girlReady && GameState.queue.length < queueLimit() && GameState.wanderers.includes(c)) {
            lureNextWanderer(this);
          }
        }, [], this);
      }
    }, [], this);
  }
}

