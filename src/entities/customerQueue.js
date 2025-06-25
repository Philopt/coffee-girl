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

function sparkleQueueSpot(scene){
  if(!scene) return;
  const idx = GameState.queue.length;
  const x = QUEUE_X - QUEUE_SPACING * idx;
  const y = QUEUE_Y - QUEUE_OFFSET * idx;
  const sp=scene.add.text(x,y,'✨',{font:'18px sans-serif',fill:'#fff'})
    .setOrigin(0.5).setDepth(20);
  scene.tweens.add({targets:sp,alpha:0,yoyo:true,repeat:1,duration:dur(300),onComplete:()=>sp.destroy()});
}


// Slow down queue movement to match wander speed change
const CUSTOMER_SPEED = 560 / 12;
// Customers should walk to the queue faster than they wander around.
// Previously LURE_SPEED was slower (0.6x) which made walking up feel sluggish
// and caused customers to lag behind their wander speed.
const LURE_SPEED = CUSTOMER_SPEED * 1.5;
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
  return customersMaxWanderers();
}

export function queueLimit() {
  return customersQueueLimit(GameState.love);
}

function customerQueueThreshold(cust){
  const base = queueLimit();
  const state = (cust && cust.memory && cust.memory.state) || CustomerState.NORMAL;
  switch(state){
    case CustomerState.BROKEN:
      // Will only join if there's effectively no line
      return 1;
    case CustomerState.GROWING:
      return base + 1;
    case CustomerState.SPARKLING:
      return base + 2;
    case CustomerState.ARROW:
      return base + 3;
    default:
      return base;
  }
}

export function lureNextWanderer(scene, specific) {
  if (typeof debugLog === 'function') {
    debugLog('lureNextWanderer', GameState.queue.length, GameState.wanderers.length, GameState.activeCustomer);
  }

  if (GameState.lureRetry) {
    GameState.lureRetry.remove(false);
    GameState.lureRetry = null;
  }

  // clear stale tween references that were stopped externally
  GameState.queue.forEach(c => {
    if (c.walkTween && !c.walkTween.isPlaying) {
      c.walkTween = null;
    }
  });

  // Defer luring new wanderers while a customer is switching places with
  // their dog. This prevents the queue from rechecking and pulling the dog
  // into line accidentally.
  if (GameState.queue.some(q => q.waitingForDog ||
      (q.isDog && q.owner && q.owner.waitingForDog))) {
    if (typeof debugLog === 'function') {
      debugLog('lureNextWanderer abort: dog switching');
    }
    if (scene && scene.time && scene.time.delayedCall && !GameState.lureRetry) {
      GameState.lureRetry = scene.time.delayedCall(250, () => {
        GameState.lureRetry = null;
        lureNextWanderer(scene, specific);
      }, [], scene);
    }
    return;
  }

  if (GameState.wanderers.length) {
    let c = null;
    let wandererIdx = -1;
    if (specific) {
      wandererIdx = GameState.wanderers.indexOf(specific);
      if (wandererIdx !== -1 && GameState.queue.length < customerQueueThreshold(GameState.wanderers[wandererIdx])) {
        c = GameState.wanderers.splice(wandererIdx, 1)[0];
      } else if (wandererIdx !== -1) {
        return;
      }
    } else {
      let closestIdx = -1;
      let minDist = Number.MAX_VALUE;
      for (let i = 0; i < GameState.wanderers.length; i++) {
        const w = GameState.wanderers[i];
        if (GameState.queue.length >= customerQueueThreshold(w)) continue;
        const d = Math.abs(w.sprite.x - ORDER_X);
        if (d < minDist) { closestIdx = i; minDist = d; }
      }
      if (closestIdx !== -1) c = GameState.wanderers.splice(closestIdx, 1)[0];
    }

    if (!c) return;
    sparkleQueueSpot(scene);
    if (GameState.queue.some((cust, i) => i > 0 && cust.walkTween && cust.walkTween.isPlaying)) {
      if (typeof debugLog === 'function') {
        debugLog('lureNextWanderer abort: walkTween active');
      }

      if (scene && scene.time && scene.time.delayedCall && !GameState.lureRetry) {
        GameState.lureRetry = scene.time.delayedCall(250, () => {
          GameState.lureRetry = null;
          lureNextWanderer(scene, specific);
        }, [], scene);

      }
      return;
    }

    const queueIdx = GameState.queue.length;
    if (c.walkTween) {
      c.walkTween.stop();
      c.walkTween.remove();
      c.walkTween = null;
    }
    if (c.pauseEvent) { c.pauseEvent.remove(); c.pauseEvent = null; }
    c.atOrder = false;
    c.arrived = false;
    c.arrivalTime = 0;
    GameState.queue.push(c);

    // Dogs no longer wait in the queue. They stay near their owner until
    // the owner reaches the counter.

    if (typeof debugLog === 'function') debugLog('customer lured to queue');
    GameState.activeCustomer = GameState.queue[0];
    let targetX;
    let targetY;
    if (queueIdx === 0 && !GameState.orderInProgress && !GameState.saleInProgress) {
      // When the queue is empty, walk straight to the counter instead of
      // stopping at the front of the line first.
      targetX = ORDER_X;
      targetY = ORDER_Y;
      GameState.orderInProgress = true;
      c.atOrder = true;
    } else {
      // Everyone lines up at the front of the queue first.
      targetX = QUEUE_X - QUEUE_SPACING * queueIdx;
      targetY = QUEUE_Y - QUEUE_OFFSET * queueIdx;
    }
    setDepthFromBottom(c.sprite, 5);
    const dir = c.dir || (c.sprite.x < targetX ? 1 : -1);
    const speed = queueIdx === 0 ? LURE_SPEED : LURE_SPEED * 0.75;
    c.walkTween = approachTarget(scene, c.sprite, dir, targetX, targetY, () => {
      c.walkTween = null;
      registerArrival(scene, c);
    }, speed, c);
  }
}

export function moveQueueForward() {
  if (typeof debugLog === 'function') {
    debugLog('moveQueueForward', GameState.queue.length, GameState.wanderers.length, GameState.activeCustomer);
  }
  const scene = this;
  let willShow = false;

  // Safeguard against a stuck order flag if the prior customer vanished
  // or the lead customer is no longer moving toward the counter.
  if (GameState.orderInProgress && !GameState.saleInProgress) {
    const lead = GameState.queue[0];
    if (!lead || !GameState.queue.includes(GameState.activeCustomer)) {
      GameState.orderInProgress = false;
    } else if (lead.walkTween && !lead.walkTween.isPlaying &&
               (lead.sprite.x !== ORDER_X || lead.sprite.y !== ORDER_Y)) {
      GameState.orderInProgress = false;
    }
  }

  const busy = GameState.orderInProgress || GameState.saleInProgress;
  GameState.queue.forEach((cust, idx) => {
    let tx;
    let ty;
    if (idx === 0) {
      if (cust.atOrder || !busy) {
        if (!cust.atOrder) {
          GameState.orderInProgress = true;
          cust.atOrder = true; // mark as heading to the counter
        }
        tx = ORDER_X;
        ty = ORDER_Y;
      } else {
        tx = QUEUE_X;
        ty = QUEUE_Y;
      }
    } else {
      const spot = idx - (GameState.orderInProgress ? 1 : 0);
      tx = QUEUE_X - QUEUE_SPACING * Math.max(spot, 0);
      ty = QUEUE_Y - QUEUE_OFFSET * Math.max(spot, 0);
    }
    if (cust.sprite.y !== ty || cust.sprite.x !== tx) {
      const dir = cust.dir || (cust.sprite.x < tx ? 1 : -1);
      // Avoid restarting movement if the customer is already walking to
      // this position. Repeatedly resetting the tween prevented the front
      // customer from ever reaching the counter.
      if (cust.walkTween) {
        if (cust.walkTween.isPlaying) {
          return;
        }
        cust.walkTween.stop();
        cust.walkTween.remove();
        cust.walkTween = null;
      }
      cust.walkTween = approachTarget(scene, cust.sprite, dir, tx, ty, () => {
        cust.walkTween = null;
        if (idx === 0 && tx === ORDER_X && ty === ORDER_Y) {
          if (typeof debugLog === 'function') debugLog('customer reached order position');
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
  if (GameState.girlReady && GameState.queue.length < queueLimit() + 3) {
    lureNextWanderer(scene);
  }
}

export function checkQueueSpacing(scene) {
  // Avoid adjusting the line while a customer is waiting for their dog
  // to order. This keeps the dog from being pulled into the queue by a
  // recheck triggered by a new arrival.
  if (GameState.queue.some(c => c.waitingForDog ||
      (c.isDog && c.owner && c.owner.waitingForDog))) {
    if (typeof debugLog === 'function') {
      debugLog('checkQueueSpacing abort: waitingForDog');
    }
    return;
  }
  if (GameState.orderInProgress && !GameState.saleInProgress && (!GameState.activeCustomer || !GameState.queue.includes(GameState.activeCustomer))) {
    GameState.orderInProgress = false;
  }
  const busy = GameState.orderInProgress || GameState.saleInProgress;
  GameState.queue.forEach((cust, idx) => {
    let tx;
    let ty;
    if (idx === 0) {
      if (cust.atOrder || !busy) {
        if (!cust.atOrder && !busy) {
          GameState.orderInProgress = true;
          cust.atOrder = true; // begin approaching counter
        }
        tx = ORDER_X;
        ty = ORDER_Y;
      } else {
        tx = QUEUE_X;
        ty = QUEUE_Y;
      }
    } else {
      const spot = idx - (GameState.orderInProgress ? 1 : 0);
      tx = QUEUE_X - QUEUE_SPACING * Math.max(spot, 0);
      ty = QUEUE_Y - QUEUE_OFFSET * Math.max(spot, 0);
    }
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
      const tween = approachTarget(
        scene,
        cust.sprite,
        dir,
        tx,
        ty,
        () => {
          if (idx === 0 && tx === ORDER_X && ty === ORDER_Y) {
            if (typeof debugLog === 'function') {
              debugLog('checkQueueSpacing complete: calling showDialog');
            }
            showDialog.call(scene);
          }
        },
        idx === 0 ? CUSTOMER_SPEED : LURE_SPEED,
        cust,
        true
      );
      // Track the tween so future spacing checks don't interrupt it while
      // the customer is already moving. Previously only the front customer
      // stored its tween, which allowed new lures to trigger while others were
      // still walking, causing jitter and occasional teleporting.
      cust.walkTween = tween;
    }
  });
}

export function startDogWaitTimer(scene, owner) {
  if (!scene || !owner || !scene.time || !scene.time.addEvent) return;
  if (owner.dogWaitEvent) {
    owner.dogWaitEvent.remove(false);
    owner.dogWaitEvent = null;
  }
  owner.dogWaitEvent = scene.time.addEvent({
    delay: dur(4000),
    callback: () => {
      owner.dogWaitEvent = null;
      if (owner.waitingForDog) {
        owner.waitingForDog = false;
        if (typeof checkQueueSpacing === 'function') checkQueueSpacing(scene);
        if (owner.exitHandler) owner.exitHandler();
      }
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

function approachTarget(scene, sprite, dir, targetX, targetY, onComplete, speed = CUSTOMER_SPEED, cust, skipSpacingCheck = false) {
  const accel = speed * 2;
  let vx = 0;
  let vy = 0;
  const mover = { isPlaying: true };
  const update = () => {
    if (!mover.isPlaying) return;
    const dt = scene.game && scene.game.loop ? scene.game.loop.delta / 1000 : 0.016;
    const dx = targetX - sprite.x;
    const dy = targetY - sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) {
      finish();
      return;
    }
    const ang = Math.atan2(dy, dx);
    vx += Math.cos(ang) * accel * dt;
    vy += Math.sin(ang) * accel * dt;
    const vmag = Math.sqrt(vx * vx + vy * vy);
    if (vmag > speed) {
      vx = (vx / vmag) * speed;
      vy = (vy / vmag) * speed;
    }
    sprite.x += vx * dt;
    sprite.y += vy * dt;
    sprite.setScale(scaleForY(sprite.y));
  };
  const finish = () => {
    mover.isPlaying = false;
    sprite.setPosition(targetX, targetY);
    sprite.setScale(scaleForY(targetY));
    if (onComplete) onComplete();
    if (!skipSpacingCheck && typeof checkQueueSpacing === 'function') {
      checkQueueSpacing(scene);
    }
    if (timer) timer.remove(false);
  };
  const timer = scene.time.addEvent({ delay: 16, loop: true, callback: update });
  mover.stop = () => { mover.isPlaying = false; if (timer) timer.remove(false); };
  mover.remove = () => { if (timer) timer.remove(false); };
  return mover;
}

export function scheduleNextSpawn(scene) {
  if (GameState.falconActive) return;
  if (queueLimit() <= 0) {
    if (GameState.spawnTimer) {
      GameState.spawnTimer.remove(false);
      GameState.spawnTimer = null;
    }
    return;
  }
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
  c.heartEmoji = this.add.text(0, 0, HEART_EMOJIS[c.memory.state] || '', { font: '28px sans-serif' })
    .setOrigin(0.5)
    .setShadow(0, 0, '#000', 4);

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
    dog.baseScaleFactor = dogType.scale || 0.6;
    dog.scaleFactor = dog.baseScaleFactor;
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

    dogCust.heartEmoji = this.add.text(0, 0, HEART_EMOJIS[dogCust.memory.state] || '', { font: '28px sans-serif' })
      .setOrigin(0.5)
      .setShadow(0, 0, '#000', 4);
    dog.heartEmoji = dogCust.heartEmoji;
  }
  const insideX = dir === 1 ? 480 - EDGE_TURN_BUFFER : EDGE_TURN_BUFFER;
  const firstTarget = c.loopsRemaining > 0 ? insideX : exitX;
  startW(this, c, firstTarget, c.loopsRemaining === 0);

  GameState.wanderers.push(c);
  scheduleNextSpawn(this);
  // Wanderers should decide to approach the cart on their own rather than being
  // immediately pulled into line. The intro or queue logic will lure them when
  // they wander close enough.
}

