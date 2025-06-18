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
import { updateDog } from './dog.js';


const CUSTOMER_SPEED = 560 / 6;
const LURE_SPEED = CUSTOMER_SPEED * 0.6;
const EDGE_TURN_BUFFER = 40;
const HEART_EMOJIS = {
  [CustomerState.NORMAL]: null,
  [CustomerState.BROKEN]: '💔',
  [CustomerState.MENDING]: '❤️‍🩹',
  [CustomerState.GROWING]: '💗',
  [CustomerState.SPARKLING]: '💖',
  [CustomerState.ARROW]: '💘'
};

export function maxWanderers() {
  return customersMaxWanderers(GameState.love);
}

export function queueLimit() {
  return customersQueueLimit(GameState.love);
}

export function lureNextWanderer(scene, specific) {
  if (typeof debugLog === 'function') {
    debugLog('lureNextWanderer', GameState.queue.length, GameState.wanderers.length, GameState.activeCustomer);
  }

  if (GameState.wanderers.length && GameState.queue.length < queueLimit()) {
    if (GameState.queue.some(c => c.walkTween)) {
      if (typeof debugLog === 'function') {
        debugLog('lureNextWanderer abort: walkTween active');
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
    const idx = GameState.queue.length;
    c.atOrder = false;
    GameState.queue.push(c);
    if (typeof debugLog === 'function') debugLog('customer lured to queue');
    GameState.activeCustomer = GameState.queue[0];
    const targetX = idx === 0 ? ORDER_X : QUEUE_X - QUEUE_SPACING * (idx - 1);
    const targetY = idx === 0 ? ORDER_Y : QUEUE_Y - QUEUE_OFFSET * (idx - 1);
    const bottomY = c.sprite.y + c.sprite.displayHeight * (1 - c.sprite.originY);
    c.sprite.setDepth(5 + bottomY * 0.006);
    const dir = c.dir || (c.sprite.x < targetX ? 1 : -1);
    c.walkTween = curvedApproach(scene, c.sprite, dir, targetX, targetY, () => {
      if (idx === 0 && typeof debugLog === 'function') debugLog('customer reached order position');
      c.walkTween = null;
      if (idx === 0) {
        if (typeof debugLog === 'function') {
          debugLog('curvedApproach complete: calling showDialog');
        }
        showDialog.call(scene);
      }
    }, LURE_SPEED);
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
      });
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
        idx === 0 ? CUSTOMER_SPEED : LURE_SPEED
      );
      if (idx === 0) {
        cust.walkTween = tween;
      }
    }
  });
}

function curvedApproach(scene, sprite, dir, targetX, targetY, onComplete, speed = CUSTOMER_SPEED) {
  const startX = sprite.x;
  const startY = sprite.y;
  const offset = 40 * dir;
  const curve = new Phaser.Curves.CubicBezier(
    new Phaser.Math.Vector2(startX, startY),
    new Phaser.Math.Vector2(startX + offset, startY),
    new Phaser.Math.Vector2(targetX - offset, targetY),
    new Phaser.Math.Vector2(targetX, targetY)
  );
  const dist = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
  const duration = dur((dist / speed) * 1000);
  const follower = { t: 0, vec: new Phaser.Math.Vector2() };
  return scene.tweens.add({
    targets: follower,
    t: 1,
    duration,
    ease: 'Linear',
    onUpdate: () => {
      curve.getPoint(follower.t, follower.vec);
      sprite.setPosition(follower.vec.x, follower.vec.y);
      sprite.setScale(scaleForY(sprite.y));
    },
    onComplete: () => {
      sprite.setPosition(targetX, targetY);
      sprite.setScale(scaleForY(targetY));
      if (onComplete) onComplete();
    }
  });
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

  const c = { orders: [] };
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
  const bottomYStart = startY + c.sprite.displayHeight * (1 - c.sprite.originY);
  c.sprite.setDepth(5 + bottomYStart * 0.006);
  if (c.memory.state !== CustomerState.NORMAL) {
    c.heartEmoji = this.add.text(0, 0, HEART_EMOJIS[c.memory.state] || '', { font: '28px sans-serif' })
      .setOrigin(0.5)
      .setShadow(0, 0, '#000', 4);
  }

  if (Phaser.Math.Between(0, 4) === 0) {
    const side = Phaser.Math.Between(0, 1) ? 1 : -1;
    const offsetX = side * Phaser.Math.Between(20, 30);
    const offsetY = Phaser.Math.Between(10, 20);
    const dogType = Phaser.Utils.Array.GetRandom(DOG_TYPES);
    const dog = this.add.text(startX + offsetX, startY + offsetY, dogType.emoji, { font: '32px sans-serif' })
      .setOrigin(0.5)
      .setScale(distScale * 0.5)
      .setDepth(3);
    dog.dir = 1;
    dog.prevX = dog.x;
    dog.dogType = dogType.type;
    c.dog = dog;

    dog.followEvent = this.time.addEvent({
      delay: dur(Phaser.Math.Between(800, 1200)),
      loop: true,
      callback: () => { if (typeof updateDog === 'function') updateDog.call(this, c); }
    });
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

