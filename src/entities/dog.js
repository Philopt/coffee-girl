import { ORDER_X, ORDER_Y } from '../customers.js';
import { GameState } from '../state.js';
import { CustomerState } from '../constants.js';
import { dur, scaleForY } from '../ui.js';
import { setDepthFromBottom, createGlowTexture } from '../ui/helpers.js';
import { scatterSparrows } from '../sparrow.js';

export const DOG_MIN_Y = ORDER_Y + 20;
export const DOG_SPEED = 120; // base movement speed for the dog
export const DOG_FAST_DISTANCE = 160; // accelerate when farther than this from owner
export const DOG_ROAM_RADIUS = 120; // how far a dog can wander from its owner
export const DOG_COUNTER_RADIUS = 40; // distance to maintain when owner is ordering
export const DOG_PAUSE_DISTANCE = 30; // distance from owner to pause following
export const PUP_CUP_TINT = 0xffe066; // final tint after receiving a pup cup
export const DOG_TYPES = [
  // scale represents relative size compared to a customer sprite

  // all dogs are smaller and share the same look now
  { type: 'standard', emoji: '🐶', tint: 0x996633, scale: 0.4 }

];

export function barkLevel(dog){
  const mood = dog && dog.dogCustomer && dog.dogCustomer.memory
    ? dog.dogCustomer.memory.state
    : CustomerState.NORMAL;
  switch(mood){
    case CustomerState.GROWING: return 1;
    case CustomerState.SPARKLING: return 2;
    case CustomerState.ARROW: return 3;
    default: return 0;
  }
}

export function barkProps(dog){
  const level = barkLevel(dog);
  return {
    scale: 1 + level * 0.25,
    rise: 20 + level * 8
  };
}

export function barkCooldown(dog){
  const mood = dog && dog.dogCustomer && dog.dogCustomer.memory
    ? dog.dogCustomer.memory.state
    : CustomerState.NORMAL;
  switch(mood){
    case CustomerState.GROWING: return 1500;
    case CustomerState.SPARKLING: return 1100;
    case CustomerState.ARROW: return 600;
    default: return 800;
  }
}

export function barkStunDuration(dog){
  const mood = dog && dog.dogCustomer && dog.dogCustomer.memory
    ? dog.dogCustomer.memory.state
    : CustomerState.NORMAL;
  switch(mood){
    case CustomerState.GROWING: return 1000;
    case CustomerState.SPARKLING: return 2000;
    case CustomerState.ARROW: return 3000;
    default: return 0;
  }
}

export function scaleDog(d) {
  if (!d) return;
  const factor = d.scaleFactor || 0.6;
  const s = scaleForY(d.y) * factor;
  const dir = d.dir || 1;
  d.setScale(s * dir, s);
  setDepthFromBottom(d, 5);
  if(d.pupGlow){
    d.pupGlow.setPosition(d.x, d.y);
    const gs = Math.max(Math.abs(d.scaleX), Math.abs(d.scaleY)) * 1.5;
    d.pupGlow.setScale(gs);
    setDepthFromBottom(d.pupGlow, 4);
  }
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
      onUpdate: () => { setDepthFromBottom(dog, 100); updateArrow(); }
    });
  }
  tl.add({
    targets: dog,
    scaleX: growX,
    scaleY: growY,
    duration: dur(120),
    onUpdate: () => { setDepthFromBottom(dog, 100); updateArrow(); }
  });
  tl.setCallback('onComplete', () => {
    dog.setScale(baseX, baseY);
    setDepthFromBottom(dog, 5);
    arrow.destroy();
    if(cb) cb();
  }, []);
  tl.play();
}

export function animateDogPowerUp(scene, dog, cb, finalTint = null){
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
  const shiftHue = (color, amount) => {
    const rgb = Phaser.Display.Color.IntegerToRGB(color);
    const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    h = (h + amount) % 1;
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    let r2, g2, b2;
    if (s === 0) {
      r2 = g2 = b2 = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r2 = hue2rgb(p, q, h + 1/3);
      g2 = hue2rgb(p, q, h);
      b2 = hue2rgb(p, q, h - 1/3);
    }
    return (Math.round(r2 * 255) << 16) | (Math.round(g2 * 255) << 8) | Math.round(b2 * 255);
  };
  const colors = [0.02, 0.04, 0.06].map(a => shiftHue(originalTint, a));
  colors.push(originalTint);
  colors.forEach(color => {
    tl.add({
      targets: dog,
      duration: dur(60),
      onStart: () => dog.setTint(color)
    });
  });
  tl.setCallback('onComplete', () => {
    const tint = finalTint || originalTint;
    dog.setTint(tint);
    if(finalTint){
      dog.hasPupCup = true;
      const radius = Math.max(dog.displayWidth, dog.displayHeight)/2 + 10;
      const key = `pupcup_glow_${Math.round(radius)}`;
      createGlowTexture(scene, tint, key, radius);
      if(dog.pupGlow) dog.pupGlow.destroy();
      dog.pupGlow = scene.add.image(dog.x, dog.y, key)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
    dog.hideHeart = false;
    if(dog.heartEmoji && dog.heartEmoji.scene){
      dog.heartEmoji.setVisible(true);
    }
    scaleDog(dog);
    if(cb) cb();
  }, []);
  tl.play();
}

// Keep the dog positioned near its owner and react to other customers.
export function updateDog(owner) {
  const dog = owner && owner.dog;
  if (!dog || !owner.sprite || dog.dead) return;
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
      const { scale, rise } = barkProps(dog);
      const bark = this.add.sprite(dog.x, dog.y - 20, 'dog1', 3)
        .setOrigin(0.5)
        .setDepth(dog.depth + 1)
        .setScale(Math.abs(dog.scaleX) * scale, Math.abs(dog.scaleY) * scale);
      this.tweens.add({
        targets: bark,
        y: `-=${rise}`,
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
      }, []);
      tl.setCallback('onComplete', () => { dog.excited = false; dog.currentTween = null; dog.setFrame(1); }, []);
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
      const { scale, rise } = barkProps(dog);
      const bark = this.add.sprite(dog.x, dog.y - 20, 'dog1', 3)
        .setOrigin(0.5)
        .setDepth(dog.depth + 1)
        .setScale(Math.abs(dog.scaleX) * scale, Math.abs(dog.scaleY) * scale);
      this.tweens.add({
        targets: bark,
        y: `-=${rise}`,
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
      scaleDog(t);
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
  const targetY = Math.max(DOG_MIN_Y, y);
  const dist = Phaser.Math.Distance.Between(dog.x, dog.y, x, targetY);
  if (Math.abs(x - dog.x) > 3) {
    dog.dir = x > dog.x ? 1 : -1;
  }
  if (dog.anims && dog.play) {
    dog.play('dog_walk');
  }
  this.tweens.add({
    targets: dog,
    x,
    y: targetY,
    duration: dur((dist / DOG_SPEED) * 1000),
    onUpdate: (tw, t) => {
      if (t.prevX === undefined) t.prevX = t.x;
      const dx = t.x - t.prevX;
      if (Math.abs(dx) > 3) {
        t.dir = dx > 0 ? 1 : -1;
      }
      t.prevX = t.x;
      scaleDog(t);
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
      if(dog.pupGlow && dog.pupGlow.destroy){
        dog.pupGlow.destroy();
        dog.pupGlow = null;
      }
      dog.destroy();
    }
  });
}

export function cleanupDogs(scene){
  const gs = scene.gameState || GameState;
  if(gs.activeCustomer){
    if(gs.activeCustomer.isDog){
      const dog = gs.activeCustomer.sprite;
      if(dog){
        if(dog.followEvent) dog.followEvent.remove(false);
        const dir = dog.x < ORDER_X ? -1 : 1;
        const targetX = dir===1 ? 520 : -40;
        sendDogOffscreen.call(scene, dog, targetX, dog.y);
      }
      gs.activeCustomer = null;
    } else if(gs.activeCustomer.dog){
      const dog = gs.activeCustomer.dog;
      if(dog.followEvent) dog.followEvent.remove(false);
      const dir = dog.x < ORDER_X ? -1 : 1;
      const targetX = dir===1 ? 520 : -40;
      sendDogOffscreen.call(scene, dog, targetX, dog.y);
      gs.activeCustomer.dog = null;
    }
  }
  [gs.queue, gs.wanderers].forEach(arr => {
    if(Array.isArray(arr)){
      for(let i=arr.length-1;i>=0;i--){
        const c = arr[i];
        if(c.isDog){
          const dog = c.sprite;
          if(dog){
            if(dog.followEvent) dog.followEvent.remove(false);
            const dir = dog.x < ORDER_X ? -1 : 1;
            const targetX = dir===1 ? 520 : -40;
            sendDogOffscreen.call(scene, dog, targetX, dog.y);
          }
          arr.splice(i,1);
        }else if(c.dog){
          const dog = c.dog;
          if(dog.followEvent) dog.followEvent.remove(false);
          const dir = dog.x < ORDER_X ? -1 : 1;
          const targetX = dir===1 ? 520 : -40;
          sendDogOffscreen.call(scene, dog, targetX, dog.y);
          c.dog = null;
        }
      }
    }
  });

  if(scene && scene.children){
    const known = new Set();
    if(gs.activeCustomer && gs.activeCustomer.dog) known.add(gs.activeCustomer.dog);
    gs.queue.forEach(c=>{ if(c.dog) known.add(c.dog); });
    gs.wanderers.forEach(c=>{ if(c.dog) known.add(c.dog); });
    scene.children.list.slice().forEach(child=>{
      if(child.texture && child.texture.key==='dog1' && !known.has(child)){
        if(child.followEvent) child.followEvent.remove(false);
        const dir = child.x < ORDER_X ? -1 : 1;
        const targetX = dir===1 ? 520 : -40;
        sendDogOffscreen.call(scene, child, targetX, child.y);
      }
    });
    // Immediately destroy dogs lingering well beyond the screen edges
    scene.children.list.slice().forEach(child=>{
      if(child.texture && child.texture.key==='dog1'){
        const offX = child.x < -60 || child.x > 540;
        const offY = child.y > 660;
        if(offX || offY){
          if(child.followEvent) child.followEvent.remove(false);
          if(child.pupGlow) child.pupGlow.destroy();
          if(child.heartEmoji) child.heartEmoji.destroy();
          child.destroy();
        } else if(DEBUG && (!child.visible || child.alpha === 0 || child.x < 0 || child.x > 480)){
          console.log('stray dog', {x:child.x, y:child.y, visible:child.visible, alpha:child.alpha});
        }
      }
    });
  }
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
  }, []);
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
  const { scale, rise } = barkProps(dog);
  const bark = scene.add.sprite(dog.x, dog.y - 20, 'dog1', 3)
    .setOrigin(0.5)
    .setDepth(dog.depth + 1)
    .setScale(Math.abs(dog.scaleX) * scale, Math.abs(dog.scaleY) * scale);
  if (dog.anims && dog.play) {
    dog.play('dog_bark');
  }
  scene.tweens.add({
    targets: dog,
    y: `-=${rise}`,
    duration: dur(150),
    yoyo: true,
    onUpdate: (tw, t) => {
      scaleDog(t);
    },
    onComplete: () => { dog.setFrame(1); }
  });
  if(scatter) scatterSparrows(scene);
  return bark;
}

export function dogBarkAt(dog, targetX, targetY, scatter=true, cb){
  const scene = this;
  if(!scene || !dog) return null;
  if(dog.barkReady === false) return null;
  dog.barkReady = false;
  scene.time.delayedCall(dur(barkCooldown(dog)), () => { dog.barkReady = true; }, [], scene);
  const { scale } = barkProps(dog);
  const bark = scene.add.sprite(dog.x, dog.y - 20, 'dog1', 3)
    .setOrigin(0.5)
    .setDepth(dog.depth + 1)
    .setScale(Math.abs(dog.scaleX) * scale, Math.abs(dog.scaleY) * scale);
  bark.stunDuration = barkStunDuration(dog);
  if (dog.anims && dog.play) {
    dog.play('dog_bark');
  }
  scene.tweens.add({
    targets: bark,
    x: targetX,
    y: targetY,
    alpha: 0,
    duration: dur(400),
    onUpdate: () => setDepthFromBottom(bark, 5),
    onComplete: () => { bark.destroy(); if(cb) cb(); }
  });
  if(scatter) scatterSparrows(scene);
  return bark;
}
