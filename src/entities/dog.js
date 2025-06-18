import { ORDER_Y } from '../customers.js';
import { GameState } from '../state.js';
import { dur, scaleForY } from '../ui.js';

export const DOG_MIN_Y = ORDER_Y + 20;
export const DOG_SPEED = 120; // base movement speed for the dog
export const DOG_FAST_DISTANCE = 160; // accelerate when farther than this from owner
export const DOG_TYPES = [
  { type: 'standard', emoji: '🐶' },
  { type: 'poodle', emoji: '🐩' },
  { type: 'guide', emoji: '🦮' },
  { type: 'service', emoji: '🐕‍🦺' }
];

export function scaleDog(d) {
  if (!d) return;
  const s = scaleForY(d.y) * 0.5;
  const dir = d.dir || 1;
  d.setScale(s * dir, s);
  const bottomY = d.y + d.displayHeight * (1 - d.originY);
  d.setDepth(3 + bottomY * 0.006);
}

// Keep the dog positioned near its owner and react to other customers.
export function updateDog(owner) {
  const dog = owner && owner.dog;
  if (!dog || !owner.sprite) return;
  const ms = owner.sprite;
  const dogDist = Phaser.Math.Distance.Between(dog.x, dog.y, ms.x, ms.y);
  let radius = 80;
  let near = 60;
  let targetX = ms.x, targetY = ms.y;
  const type = dog.dogType || 'standard';
  if (type === 'service') {
    radius = 50;
    near = 30;
  }
  if (type === 'guide') {
    const dir = owner.dir || 1;
    targetX = ms.x + dir * 40;
  }

  const others = [...GameState.queue, ...GameState.wanderers].filter(c => c !== owner && c.sprite);
  if (dog.currentTween) {
    dog.currentTween.stop();
    dog.currentTween = null;
  }
  if (type !== 'service' && !dog.excited) {
    const seen = others.find(o => Phaser.Math.Distance.Between(dog.x, dog.y, o.sprite.x, o.sprite.y) < 80);
    if (seen) {
      dog.excited = true;
      const s = seen.sprite;
      const tl = this.tweens.createTimeline();
      tl.add({ targets: dog, y: '-=15', duration: dur(100), yoyo: true, repeat: 1 });
      tl.add({ targets: dog, x: s.x, y: s.y, duration: dur(300) });
      tl.add({ targets: dog, x: '-=12', duration: dur(120), yoyo: true, repeat: 1 });
      tl.add({ targets: dog, x: '+=24', duration: dur(120), yoyo: true, repeat: 1 });
      tl.add({ targets: dog, x: ms.x, y: ms.y, duration: dur(400) });
      tl.setCallback('onUpdate', () => {
        if (dog.prevX === undefined) dog.prevX = dog.x;
        const dx = dog.x - dog.prevX;
        if (Math.abs(dx) > 3) {
          dog.dir = dx > 0 ? 1 : -1;
        }
        dog.prevX = dog.x;
        const s = scaleForY(dog.y) * 0.5;
        dog.setScale(s * (dog.dir || 1), s);
      });
      tl.setCallback('onComplete', () => { dog.excited = false; dog.currentTween = null; });
      dog.currentTween = tl;
      tl.play();
      return;
    }
  }
  if (dogDist <= radius) {
    for (const o of others) {
      const d = Phaser.Math.Distance.Between(dog.x, dog.y, o.sprite.x, o.sprite.y);
      if (d < near) {
        const ang = Phaser.Math.Angle.Between(o.sprite.x, o.sprite.y, dog.x, dog.y);
        targetX = dog.x + Math.cos(ang) * (near - d);
        targetY = dog.y + Math.sin(ang) * (near - d);
        dog.restUntil = this.time.now + Phaser.Math.Between(5000, 10000);
        break;
      }
    }
    if (targetX === ms.x && targetY === ms.y) {
      const side = Phaser.Math.Between(0, 1) ? 1 : -1;
      const offsetX = side * Phaser.Math.Between(20, 30);
      const offsetY = Phaser.Math.Between(10, 20);
      targetX = ms.x + offsetX;
      targetY = ms.y + offsetY;
      dog.restUntil = this.time.now + Phaser.Math.Between(5000, 10000);
    }
  } else {
    dog.restUntil = 0;
  }
  if (targetY < DOG_MIN_Y) targetY = DOG_MIN_Y;
  const distance = Phaser.Math.Distance.Between(dog.x, dog.y, targetX, targetY);
  const speed = dogDist > DOG_FAST_DISTANCE ? DOG_SPEED * 1.5 : DOG_SPEED;
  const duration = dur(Math.max(200, (distance / speed) * 1000));
  if (Math.abs(targetX - dog.x) > 3) {
    dog.dir = targetX > dog.x ? 1 : -1;
  }
  dog.currentTween = this.tweens.add({
    targets: dog,
    x: targetX,
    y: targetY,
    duration,
    onUpdate: (tw, t) => {
      if (t.prevX === undefined) t.prevX = t.x;
      const dx = t.x - t.prevX;
      if (Math.abs(dx) > 3) {
        t.dir = dx > 0 ? 1 : -1;
      }
      t.prevX = t.x;
      const s = scaleForY(t.y) * 0.5;
      t.setScale(s * (t.dir || 1), s);
      const bottomY = t.y + t.displayHeight * (1 - t.originY);
      t.setDepth(3 + bottomY * 0.006);
    },
    onComplete: () => {
      dog.currentTween = null;
    }
  });
}

export function sendDogOffscreen(dog, x, y) {
  if (!dog) return;
  if (dog.followEvent) dog.followEvent.remove(false);
  const dist = Phaser.Math.Distance.Between(dog.x, dog.y, x, y);
  if (Math.abs(x - dog.x) > 3) {
    dog.dir = x > dog.x ? 1 : -1;
  }
  this.tweens.add({
    targets: dog,
    x,
    y,
    duration: dur((dist / DOG_SPEED) * 1000),
    onUpdate: (tw, t) => {
      if (t.prevX === undefined) t.prevX = t.x;
      const dx = t.x - t.prevX;
      if (Math.abs(dx) > 3) {
        t.dir = dx > 0 ? 1 : -1;
      }
      t.prevX = t.x;
      const s = scaleForY(t.y) * 0.5;
      t.setScale(s * (t.dir || 1), s);
      const bottomY = t.y + t.displayHeight * (1 - t.originY);
      t.setDepth(3 + bottomY * 0.006);
    },
    onComplete: () => dog.destroy()
  });
}

export function cleanupDogs(scene){
  const gs = scene.gameState || GameState;
  if(gs.activeCustomer && gs.activeCustomer.dog){
    if(gs.activeCustomer.dog.followEvent) gs.activeCustomer.dog.followEvent.remove(false);
    gs.activeCustomer.dog.destroy();
    gs.activeCustomer.dog = null;
  }
  [gs.queue, gs.wanderers].forEach(arr => {
    if(Array.isArray(arr)){
      arr.forEach(c => {
        if(c.dog){
          if(c.dog.followEvent) c.dog.followEvent.remove(false);
          c.dog.destroy();
          c.dog = null;
        }
      });
    }
  });
}
