import { ORDER_X, ORDER_Y } from '../customers.js';
import { GameState } from '../state.js';
import { dur, scaleForY } from '../ui.js';
import { scatterSparrows } from '../sparrow.js';

export const DOG_MIN_Y = ORDER_Y + 20;
export const DOG_SPEED = 120; // base movement speed for the dog
export const DOG_FAST_DISTANCE = 160; // accelerate when farther than this from owner
export const DOG_TYPES = [
  // scale represents relative size compared to a customer sprite
  // all dogs are smaller; the largest is now the old "service" size
  { type: 'standard', emoji: '🐶', tint: 0xff3333, scale: 0.4 },
  { type: 'poodle',   emoji: '🐩', tint: 0x33ff99, scale: 0.37 },
  { type: 'guide',    emoji: '🦮', tint: 0x3366ff, scale: 0.34 },
  { type: 'service',  emoji: '🐕‍🦺', tint: 0xffff33, scale: 0.31 }
];

export function scaleDog(d) {
  if (!d) return;
  const factor = d.scaleFactor || 0.6;
  const s = scaleForY(d.y) * factor;
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
  const birds = (GameState.sparrows || []).filter(b => b && b.sprite);
  if (dog.currentTween) {
    dog.currentTween.stop();
    dog.currentTween = null;
  }
  if (type !== 'service' && !dog.excited) {
    const seen = birds.find(b => Phaser.Math.Distance.Between(dog.x, dog.y, b.sprite.x, b.sprite.y) < 80);
    if (seen) {
      dog.excited = true;
      const s = seen.sprite;
      const bark = this.add.sprite(dog.x, dog.y - 20, 'dog1', 3)
        .setOrigin(0.5)
        .setDepth(dog.depth + 1)
        .setScale(Math.abs(dog.scaleX), Math.abs(dog.scaleY));
      this.tweens.add({
        targets: bark,
        y: '-=20',
        alpha: 0,
        duration: dur(600),
        onComplete: () => bark.destroy()
      });
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
        const s = scaleForY(dog.y) * (dog.scaleFactor || 0.6);
        dog.setScale(s * (dog.dir || 1), s);
      });
      tl.setCallback('onComplete', () => { dog.excited = false; dog.currentTween = null; dog.setFrame(1); });
      dog.currentTween = tl;
      if (dog.anims && dog.play) {
        dog.play('dog_walk');
      }
      tl.play();
      scatterSparrows(this);
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

  if(owner === GameState.activeCustomer &&
     Phaser.Math.Distance.Between(dog.x, dog.y, ORDER_X, ORDER_Y) < 60 &&
     !dog.hasBarked){
    const nearby = birds.find(b => Phaser.Math.Distance.Between(dog.x, dog.y, b.sprite.x, b.sprite.y) < 80);
    if(nearby){
      dog.hasBarked = true;
      const bark = this.add.sprite(dog.x, dog.y - 20, 'dog1', 3)
        .setOrigin(0.5)
        .setDepth(dog.depth + 1)
        .setScale(Math.abs(dog.scaleX), Math.abs(dog.scaleY));
      this.tweens.add({
        targets: bark,
        y: '-=20',
        alpha: 0,
        duration: dur(600),
        onComplete: () => bark.destroy()
      });
      scatterSparrows(this);
    }
  }

  if (targetY < DOG_MIN_Y) targetY = DOG_MIN_Y;
  const distance = Phaser.Math.Distance.Between(dog.x, dog.y, targetX, targetY);
  const speed = dogDist > DOG_FAST_DISTANCE ? DOG_SPEED * 1.5 : DOG_SPEED;
  const duration = dur(Math.max(200, (distance / speed) * 1000));
  if (Math.abs(targetX - dog.x) > 3) {
    dog.dir = targetX > dog.x ? 1 : -1;
  }
  if (dog.anims && dog.play) {
    dog.play('dog_walk');
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
      const s = scaleForY(t.y) * (t.scaleFactor || 0.6);
      t.setScale(s * (t.dir || 1), s);
      const bottomY = t.y + t.displayHeight * (1 - t.originY);
      t.setDepth(3 + bottomY * 0.006);
    },
    onComplete: () => {
      dog.currentTween = null;
      dog.setFrame(1);
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
  if (dog.anims && dog.play) {
    dog.play('dog_walk');
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
      const s = scaleForY(t.y) * (t.scaleFactor || 0.6);
      t.setScale(s * (t.dir || 1), s);
      const bottomY = t.y + t.displayHeight * (1 - t.originY);
      t.setDepth(3 + bottomY * 0.006);
    },
    onComplete: () => {
      if (dog.heartEmoji) {
        dog.heartEmoji.destroy();
        dog.heartEmoji = null;
      }
      dog.destroy();
    }
  });
}

export function cleanupDogs(scene){
  const gs = scene.gameState || GameState;
  if(gs.activeCustomer && gs.activeCustomer.dog){
    const dog = gs.activeCustomer.dog;
    if(dog.followEvent) dog.followEvent.remove(false);
    const dir = dog.x < ORDER_X ? -1 : 1;
    const targetX = dir===1 ? 520 : -40;
    sendDogOffscreen.call(scene, dog, targetX, dog.y);
    gs.activeCustomer.dog = null;
  }
  [gs.queue, gs.wanderers].forEach(arr => {
    if(Array.isArray(arr)){
      arr.forEach(c => {
        if(c.dog){
          const dog = c.dog;
          if(dog.followEvent) dog.followEvent.remove(false);
          const dir = dog.x < ORDER_X ? -1 : 1;
          const targetX = dir===1 ? 520 : -40;
          sendDogOffscreen.call(scene, dog, targetX, dog.y);
          c.dog = null;
        }
      });
    }
  });
}
