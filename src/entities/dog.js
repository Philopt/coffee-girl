import { ORDER_X, ORDER_Y } from '../customers.js';
import { GameState } from '../state.js';
import { CustomerState } from '../constants.js';
import { dur, scaleForY } from '../ui.js';
import { setDepthFromBottom } from '../ui/helpers.js';
import { scatterSparrows } from '../sparrow.js';

export const DOG_MIN_Y = ORDER_Y + 20;
export const DOG_SPEED = 120; // base movement speed for the dog
export const DOG_FAST_DISTANCE = 160; // accelerate when farther than this from owner
export const DOG_ROAM_RADIUS = 120; // how far a dog can wander from its owner
export const DOG_COUNTER_RADIUS = 40; // distance to maintain when owner is ordering
export const DOG_PAUSE_DISTANCE = 30; // distance from owner to pause following
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
  setDepthFromBottom(d, 5);
}

export function animateDogGrowth(scene, dog, cb) {
  if (!scene || !dog) { if(cb) cb(); return; }
  // apply any pending scale changes now that the power-up has started
  const finalFactor = dog.pendingScaleFactor || dog.scaleFactor || 0.6;
  dog.scaleFactor = finalFactor;
  dog.pendingScaleFactor = null;
  const dir = dog.dir || 1;
  const baseX = scaleForY(dog.y) * finalFactor * dir;
  const baseY = scaleForY(dog.y) * finalFactor;
  const tl = scene.tweens.createTimeline();
  const growX = baseX * 1.2;
  const growY = baseY * 1.2;
  // show an up arrow while the dog grows
  const arrow = scene.add.text(dog.x, dog.y - dog.displayHeight,
                              '⬆️', {font:'24px sans-serif'})
    .setOrigin(0.5)
    .setDepth(dog.depth + 1)
    .setScale(scaleForY(dog.y))
    .setShadow(0,0,'#000',4);
  const updateArrow = () => {
    arrow.setPosition(dog.x, dog.y - dog.displayHeight)
         .setScale(scaleForY(dog.y))
         .setDepth(dog.depth + 1);
  };
  for (let i = 0; i < 3; i++) {
    tl.add({
      targets: dog,
      scaleX: growX,
      scaleY: growY,
      duration: dur(120),
      yoyo: true,
      onUpdate: () => { setDepthFromBottom(dog, 5); updateArrow(); }
    });
  }
  tl.add({
    targets: dog,
    scaleX: growX,
    scaleY: growY,
    duration: dur(120),
    onUpdate: () => { setDepthFromBottom(dog, 5); updateArrow(); }
  });
  tl.setCallback('onComplete', () => {
    dog.setScale(baseX, baseY);
    setDepthFromBottom(dog, 5);
    arrow.destroy();
    if(cb) cb();
  });
  tl.play();
}

export function animateDogPowerUp(scene, dog, cb){
  if(!scene || !dog){ if(cb) cb(); return; }
  dog.hideHeart = true;
  if(dog.heartEmoji && dog.heartEmoji.scene){
    dog.heartEmoji.setVisible(false);
  }

  const sparkle = scene.add.text(dog.x, dog.y - dog.displayHeight * 0.5,
                                 '✨', {font:'24px sans-serif'})
    .setOrigin(0.5)
    .setDepth(dog.depth + 1)
    .setScale(scaleForY(dog.y))
    .setShadow(0,0,'#000',4);
  scene.tweens.add({
    targets: sparkle,
    y: '-=10',
    alpha: 0,
    duration: dur(100),
    yoyo: true,
    repeat: 4,
    onUpdate: () => {
      sparkle.setPosition(dog.x, dog.y - dog.displayHeight * 0.5)
             .setDepth(dog.depth + 1)
             .setScale(scaleForY(dog.y));
    },
    onComplete: () => sparkle.destroy()
  });

  const tl = scene.tweens.createTimeline();
  const originalTint = dog.tintTopLeft || 0xffffff;
  const colors = [0xffff66, 0xff66ff, 0x66ffff, 0xffffff];
  for(let j=0;j<2;j++){
    colors.forEach(color => {
      tl.add({
        targets: dog,
        alpha: 0,
        duration: dur(60),
        onStart: () => dog.setTint(color)
      });
      tl.add({ targets: dog, alpha: 1, duration: dur(60) });
    });
  }
  tl.setCallback('onComplete', () => {
    dog.setTint(originalTint);
    animateDogGrowth(scene, dog, () => {
      dog.hideHeart = false;
      if(dog.heartEmoji && dog.heartEmoji.scene){
        dog.heartEmoji.setVisible(true);
      }
      if(cb) cb();
    });
  });
  tl.play();
}

// Keep the dog positioned near its owner and react to other customers.
export function updateDog(owner) {
  const dog = owner && owner.dog;
  if (!dog || !owner.sprite) return;
  const ms = owner.sprite;
  const dogDist = Phaser.Math.Distance.Between(dog.x, dog.y, ms.x, ms.y);
  let radius = DOG_ROAM_RADIUS;
  let near = 60;
  let targetX = ms.x, targetY = ms.y;
  const type = dog.dogType || 'standard';
  const mood = dog.dogCustomer && dog.dogCustomer.memory
    ? dog.dogCustomer.memory.state
    : CustomerState.NORMAL;
  const atCounter = ms.x === ORDER_X && ms.y === ORDER_Y;
  const ordering = owner === GameState.activeCustomer && atCounter;
  if (ordering && dogDist <= DOG_PAUSE_DISTANCE) {
    if (dog.currentTween) {
      dog.currentTween.stop();
      dog.currentTween = null;
    }
    if (dog.followEvent) {
      dog.followEvent.remove(false);
      dog.followEvent = null;
    }
    dog.setFrame(1);
    return;
  }
  if (atCounter) radius = DOG_COUNTER_RADIUS;
  if (type === 'service') {
    near = 30;
  }
  if (type === 'guide') {
    const dir = owner.dir || 1;
    targetX = ms.x + dir * 40;
  }
  if (mood === CustomerState.BROKEN) {
    const truck = GameState.truck;
    if (truck) {
      const distTruck = Phaser.Math.Distance.Between(dog.x, dog.y, truck.x, truck.y);
      if (distTruck < 120) {
        const ang = Phaser.Math.Angle.Between(truck.x, truck.y, dog.x, dog.y);
        targetX = dog.x + Math.cos(ang) * 40;
        targetY = dog.y + Math.sin(ang) * 40;
      }
    }
  }

  const others = [...GameState.queue, ...GameState.wanderers].filter(c => c !== owner && c.sprite);
  const birds = (GameState.sparrows || []).filter(b => b && b.sprite);
  if (dog.currentTween) {
    dog.currentTween.stop();
    dog.currentTween = null;
  }
  if (type !== 'service' && !dog.excited && !ordering) {
    const otherDogs = others.filter(o => o.isDog);
    const seenDog = otherDogs.find(o => Phaser.Math.Distance.Between(dog.x, dog.y, o.sprite.x, o.sprite.y) < 80);
    const seenBird = birds.find(b => Phaser.Math.Distance.Between(dog.x, dog.y, b.sprite.x, b.sprite.y) < 80);
    const seen = seenDog || seenBird;
    const barkProb = {
      [CustomerState.BROKEN]: 1,
      [CustomerState.MENDING]: 0.8,
      [CustomerState.NORMAL]: 0.6,
      [CustomerState.GROWING]: 0.4,
      [CustomerState.SPARKLING]: 0.3,
      [CustomerState.ARROW]: 0.1
    };
    const chance = barkProb[mood] ?? 0.6;
    if (seen && Math.random() < chance) {
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
      if (dog.heartEmoji && dog.heartEmoji.scene && dog.heartEmoji.active) {
        const hy = dog.y + dog.displayHeight * 0.30;
        const hs = scaleForY(dog.y) * 0.8;
        dog.heartEmoji
          .setPosition(dog.x, hy)
          .setScale(hs)
          .setDepth(dog.depth)
          .setShadow(0, 0, '#000', 4);
        }
      });
      tl.setCallback('onComplete', () => { dog.excited = false; dog.currentTween = null; dog.setFrame(1); });
      dog.currentTween = tl;
      if (dog.anims && dog.play) {
        dog.play('dog_walk');
      }
      tl.play();
      if (seenBird) scatterSparrows(this);
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
        dog.restUntil = this.time.now + Phaser.Math.Between(2000, 4000);
        break;
      }
    }
    if (targetX === ms.x && targetY === ms.y) {
      const side = Phaser.Math.Between(0, 1) ? 1 : -1;
      const offsetX = side * Phaser.Math.Between(20, 30);
      const offsetY = Phaser.Math.Between(10, 20);
      targetX = ms.x + offsetX;
      targetY = ms.y + offsetY;
      dog.restUntil = this.time.now + Phaser.Math.Between(2000, 4000);
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
      setDepthFromBottom(t, 5);
      if (dog.heartEmoji && dog.heartEmoji.scene && dog.heartEmoji.active) {
        const hy = t.y + t.displayHeight * 0.30;
        const hs = scaleForY(t.y) * 0.8;
        dog.heartEmoji
          .setPosition(t.x, hy)
          .setScale(hs)
          .setDepth(t.depth)
          .setShadow(0, 0, '#000', 4);
      }
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
  // ensure any previous tweens don't fight with the exit tween
  this.tweens.killTweensOf(dog);
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
      setDepthFromBottom(t, 5);
      if (dog.heartEmoji && dog.heartEmoji.scene && dog.heartEmoji.active) {
        const hy = t.y + t.displayHeight * 0.30;
        const hs = scaleForY(t.y) * 0.8;
        dog.heartEmoji
          .setPosition(t.x, hy)
          .setScale(hs)
          .setDepth(t.depth)
          .setShadow(0, 0, '#000', 4);
      }
    },
    onComplete: () => {
      if (dog.heartEmoji && dog.heartEmoji.scene && dog.heartEmoji.active) {
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

export function dogTruckRuckus(scene, dog){
  if(!scene || !dog) return;
  if(dog.followEvent){
    dog.followEvent.remove(false);
    dog.followEvent = null;
  }
  if(dog.currentTween){
    dog.currentTween.stop();
    dog.currentTween = null;
  }
  scene.tweens.killTweensOf(dog);
  const truck = GameState.truck;
  if(!truck) return;
  const tl = scene.tweens.createTimeline();
  const left = truck.x - truck.displayWidth/2 + 20 * truck.scaleX;
  const right = truck.x + truck.displayWidth/2 - 20 * truck.scaleX;
  const top = truck.y - truck.displayHeight/2;
  const bottom = truck.y + truck.displayHeight/2 - 10;
  tl.add({ targets: dog, x: left, y: bottom, duration: dur(300) });
  tl.add({ targets: dog, x: right, y: bottom, duration: dur(400) });
  tl.add({ targets: dog, x: truck.x, y: top, duration: dur(250) });
  tl.add({ targets: dog, x: dog.x, y: dog.y, duration: dur(300) });
  const owner = dog.dogCustomer && dog.dogCustomer.owner;
  tl.setCallback('onComplete', () => {
    scatterSparrows(scene);
    if(owner && scene.time){
      dog.followEvent = scene.time.addEvent({
        delay: dur(Phaser.Math.Between(800, 1200)),
        loop: true,
        callback: () => { if(typeof updateDog==='function') updateDog.call(scene, owner); }
      });
    }
  });
  if (dog.anims && dog.play) { dog.play('dog_walk'); }
  tl.play();
}

export function dogRefuseJumpBark(dog, scatter=true){
  const scene = this;
  if(!scene || !dog) return null;
  if(dog.currentTween){
    dog.currentTween.stop();
    dog.currentTween = null;
  }
  const bark = scene.add.sprite(dog.x, dog.y - 20, 'dog1', 3)
    .setOrigin(0.5)
    .setDepth(dog.depth + 1)
    .setScale(Math.abs(dog.scaleX), Math.abs(dog.scaleY));
  if (dog.anims && dog.play) {
    dog.play('dog_bark');
  }
  scene.tweens.add({
    targets: dog,
    y: '-=20',
    duration: dur(150),
    yoyo: true,
    onUpdate: (tw, t) => {
      const s = scaleForY(t.y) * (t.scaleFactor || 0.6);
      t.setScale(s * (t.dir || 1), s);
      setDepthFromBottom(t, 5);
    },
    onComplete: () => { dog.setFrame(1); }
  });
  if(scatter) scatterSparrows(scene);
  return bark;
}
