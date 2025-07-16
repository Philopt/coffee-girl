import { BirdState } from './constants.js';
import { GameState } from './state.js';

// Base maximum number of sparrows at love level 0
export const MAX_SPARROWS = 5;

// Return the sparrow cap for the given love value (0-100)
export function maxSparrows(love) {
  const lv = Phaser.Math.Clamp(love || 0, 0, 100);
  return Math.round(MAX_SPARROWS + (lv / 100) * 15);
}

// Compute delay before the next sparrow spawns. Higher love means shorter waits.
export function sparrowSpawnDelay(love) {
  const lv = Phaser.Math.Clamp(love || 0, 0, 100) / 100;
  const min = Phaser.Math.Linear(5000, 1000, lv);
  const max = Phaser.Math.Linear(10000, 4000, lv);
  return Phaser.Math.Between(min, max);
}

function randomTarget(scene){
  const { width } = scene.scale;
  const truck = GameState.truck;
  const moving = truck && scene.tweens && scene.tweens.isTweening && scene.tweens.isTweening(truck);
  if (truck && !moving && truck.getTopCenter) {
    const top = truck.getTopCenter();
    const y = top.y + 25 * truck.scaleY;
    const left = truck.x - truck.displayWidth / 2 + 40 * truck.scaleX;
    const right = truck.x + truck.displayWidth / 2 - 33 * truck.scaleX;
    return new Phaser.Math.Vector2(
      Phaser.Math.Between(left, right),
      y
    );
  }
  // offscreen above
  return new Phaser.Math.Vector2(
    Phaser.Math.Between(-40, width + 40),
    -40
  );
}

export class Sparrow {
  constructor(scene){
    this.scene = scene;
    const { width } = scene.scale;
    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? -40 : width + 40;
    const startY = Phaser.Math.Between(120, 180);
    this.sprite = scene.add.sprite(startX, startY, 'sparrow', 0)
      .setDepth(4)
      .setScale(0.5);
    this.sprite.flipX = fromLeft;
    this.state = BirdState.FLY;
    this.velocity = new Phaser.Math.Vector2();
    this.target = new Phaser.Math.Vector2();
    this.curve = null;
    this.followVec = new Phaser.Math.Vector2();
    this.timer = 0;
    this.scared = false;
    this.threatTimer = 0;
    this.hopCooldown = 0;

    const truck = GameState.truck;
    const moving = truck && scene.tweens && scene.tweens.isTweening && scene.tweens.isTweening(truck);
    if (truck && !moving && truck.getTopCenter) {
      const top = truck.getTopCenter();
      const y = top.y + 25 * truck.scaleY;
      const left = truck.x - truck.displayWidth / 2 + 40 * truck.scaleX;
      const right = truck.x + truck.displayWidth / 2 - 33 * truck.scaleX;
      const x = Phaser.Math.Between(left, right);
      this.target.set(x, y);
    } else {
      this.target.copy(randomTarget(scene));
    }
    const controlX = Phaser.Math.Between(startX - 60, startX + 60);
    const controlY = startY - Phaser.Math.Between(30, 80);
    this.curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(startX, startY),
      new Phaser.Math.Vector2(controlX, controlY),
      new Phaser.Math.Vector2(this.target.x, this.target.y)
    );
    this.sprite.anims.play('sparrow_fly');
    this.setFacingToTarget();
  }

  setFacingToTarget(){
    if(this.sprite){
      this.sprite.flipX = this.target.x > this.sprite.x;
    }
  }

  update(dt){
    this.hopCooldown = Math.max(0, this.hopCooldown - dt);
    this.threatTimer -= dt;
    if(this.threatTimer <= 0){
      checkThreats(this.scene, this);
      this.threatTimer = 0.3;
    }
    switch(this.state){
      case BirdState.FLY:
        this.flyUpdate(dt);
        if(this.timer > 2.5){
          this.state = BirdState.LAND;
          this.timer = 0;
        }
        break;
      case BirdState.LAND:
        this.landUpdate(dt);
        break;
      case BirdState.IDLE_GROUND:
        this.idleUpdate(dt);
        break;
      case BirdState.WANDER_GROUND:
        this.wanderUpdate(dt);
        break;
      case BirdState.FLEE:
        this.fleeUpdate(dt);
        if(this.timer > 2){
          this.target.copy(randomTarget(this.scene));
          this.velocity.set(
            this.target.x - this.sprite.x,
            this.target.y - this.sprite.y
          ).normalize().scale(60);
          this.state = BirdState.FLY;
          this.timer = 0;
        }
        break;
      case BirdState.PERCH:
        // stay still
        break;
      case BirdState.ALERT:
        this.timer -= dt;
        if(this.timer <= 0){
          this.state = BirdState.FLY;
          this.timer = 0;
        }
        break;
    }
  }

  flyUpdate(dt){
    this.timer += dt;
    if(this.curve){
      const t = Phaser.Math.Clamp(this.timer / 2.5, 0, 1);
      const eased = Phaser.Math.Easing.Sine.Out(t);
      const prevX = this.sprite.x;
      this.curve.getPoint(eased, this.followVec);
      this.sprite.setPosition(this.followVec.x, this.followVec.y);
      const dx = this.sprite.x - prevX;
      if(Math.abs(dx) > 0.5){
        // face the direction of travel
        this.sprite.flipX = dx > 0;
      } else {
        // small movements fall back to target facing
        this.sprite.flipX = this.target.x > this.sprite.x;
      }
    } else {
      this.sprite.flipX = this.target.x > this.sprite.x;
    }
  }

  fleeUpdate(dt){
    this.timer += dt;
    this.sprite.x += this.velocity.x * dt * 1.5;
    this.sprite.y += this.velocity.y * dt * 1.5;
    this.sprite.flipX = this.velocity.x > 0;
  }

  landUpdate(dt){
    const dy = this.target.y - this.sprite.y;
    this.sprite.x = this.target.x;
    this.sprite.y += dy * 4 * dt;
    if(Math.abs(dy) < 1){
      this.sprite.setPosition(this.target.x, this.target.y);
      this.sprite.anims.play('sparrow_ground');
      this.state = BirdState.IDLE_GROUND;
      this.timer = Phaser.Math.FloatBetween(1,3);
    }
  }

  idleUpdate(dt){
    this.timer -= dt;
    if(this.timer <= 0){
      if(Math.random() < 0.3){
        this.state = BirdState.WANDER_GROUND;
        let targetX = this.sprite.x + Phaser.Math.Between(-30,30);
        const truck = GameState.truck;
        const moving = truck && this.scene.tweens && this.scene.tweens.isTweening && this.scene.tweens.isTweening(truck);
        if(truck && !moving && truck.getTopCenter){
          const top = truck.getTopCenter();
          const roofY = top.y + 25 * truck.scaleY;
          if(Math.abs(this.sprite.y - roofY) < 3){
            const left = truck.x - truck.displayWidth / 2 + 40 * truck.scaleX;
            const right = truck.x + truck.displayWidth / 2 - 33 * truck.scaleX;
            targetX = Phaser.Math.Clamp(targetX, left, right);
          }
        }
        this.target.set(targetX, this.sprite.y);
        this.setFacingToTarget();
        this.timer = Phaser.Math.FloatBetween(1,2);
      }else{
        this.timer = Phaser.Math.FloatBetween(1,3);
      }
    }
  }

  wanderUpdate(dt){
    this.setFacingToTarget();
    const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, this.target.x, this.target.y);
    const step = 20 * dt;
    this.sprite.x += Math.cos(angle)*step;
    this.sprite.y += Math.sin(angle)*step;
    const truck = GameState.truck;
    const moving = truck && this.scene.tweens && this.scene.tweens.isTweening && this.scene.tweens.isTweening(truck);
    if(truck && !moving && truck.getTopCenter){
      const top = truck.getTopCenter();
      const roofY = top.y + 25 * truck.scaleY;
      if(Math.abs(this.sprite.y - roofY) < 5){
        const left = truck.x - truck.displayWidth / 2 + 40 * truck.scaleX;
        const right = truck.x + truck.displayWidth / 2 - 33 * truck.scaleX;
        this.sprite.x = Phaser.Math.Clamp(this.sprite.x, left, right);
      }
    }
    this.timer -= dt;
    if(Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.target.x, this.target.y) < 2 || this.timer <= 0){
      this.state = BirdState.IDLE_GROUND;
      this.timer = Phaser.Math.FloatBetween(1,3);
    }
  }

  flyAway(target){
    const startX = this.sprite.x;
    const startY = this.sprite.y;
    const controlX = startX + Phaser.Math.Between(-60,60);
    const controlY = startY - Phaser.Math.Between(40,80);
    this.target.copy(target);
    this.curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(startX, startY),
      new Phaser.Math.Vector2(controlX, controlY),
      new Phaser.Math.Vector2(target.x, target.y)
    );
    this.sprite.anims.play('sparrow_fly');
    this.setFacingToTarget();
    this.state = BirdState.FLY;
    this.timer = 0;
  }

  flee(vec){
    this.velocity.copy(vec.normalize().scale(60));
    this.sprite.anims.play('sparrow_fly');
    this.sprite.flipX = this.velocity.x > 0;
    this.state = BirdState.FLEE;
    this.timer = 0;
  }

  destroy(){
    if(this.sprite && this.sprite.destroy){
      this.sprite.destroy();
    }
  }
}

export function spawnSparrow(scene, opts = {}){
  const gs = scene.gameState || GameState;
  const birds = gs.sparrows;
  const limit = maxSparrows(gs.love);
  if (Array.isArray(birds) && birds.length >= limit) {
    return null;
  }
  const bird = new Sparrow(scene);
  if (opts.ground) {
    bird.curve = null;
    bird.state = BirdState.IDLE_GROUND;
    bird.sprite.anims.play('sparrow_ground');
    bird.sprite.setPosition(
      Phaser.Math.Between(180, 300),
      Phaser.Math.Between(260, 300)
    );
    bird.sprite.flipX = Math.random() < 0.5;
    bird.timer = Phaser.Math.FloatBetween(1, 3);
  }
  birds.push(bird);
  return bird;
}

export function scheduleSparrowSpawn(scene){
  const gs = scene.gameState || GameState;
  if(gs.sparrowSpawnEvent){
    gs.sparrowSpawnEvent.remove(false);
  }
  const truck = gs.truck;
  if(truck && scene.tweens && scene.tweens.isTweening && scene.tweens.isTweening(truck)){
    gs.sparrowSpawnEvent = scene.time.delayedCall(200, () => scheduleSparrowSpawn(scene), [], scene);
    return;
  }
  const delay = sparrowSpawnDelay(gs.love);
  gs.sparrowSpawnEvent = scene.time.delayedCall(delay, () => {
    const limit = maxSparrows(gs.love);
    if ((gs.sparrows || []).length < limit) {
      spawnSparrow(scene);
    }
    scheduleSparrowSpawn(scene);
  }, [], scene);
}

function fadeOutBird(scene, bird, onComplete){
  if(!bird || !bird.sprite || bird.fading) return;
  bird.fading = true;
  if(bird.threatCheck && bird.threatCheck.remove){
    bird.threatCheck.remove(false);
    bird.threatCheck = null;
  }
  if(bird.timerEvent && bird.timerEvent.remove){
    bird.timerEvent.remove(false);
    bird.timerEvent = null;
  }
  const spr = bird.sprite;
  if(scene.tweens){
    scene.tweens.add({
      targets: spr,
      alpha: 0,
      scale: 0.1,
      duration: 800,
      onComplete: () => {
        if(bird.destroy) bird.destroy();
        const birds = scene.gameState.sparrows;
        const idx = birds.indexOf(bird);
        if(idx !== -1) birds.splice(idx,1);
        if(onComplete) onComplete();
      }
    });
  }else{
    if(bird.destroy) bird.destroy();
    const birds = scene.gameState.sparrows;
    const idx = birds.indexOf(bird);
    if(idx !== -1) birds.splice(idx,1);
    if(onComplete) onComplete();
  }
}

export function updateSparrows(scene, delta){
  const dt = delta/1000;
  const birds = scene.gameState.sparrows;
  if(!Array.isArray(birds)) return;
  for(const bird of birds.slice()){
    bird.update(dt);
    if(!bird.sprite) continue;
    const y = bird.sprite.y;
    if(y < -80 || y > scene.scale.height + 80){
      fadeOutBird(scene, bird);
    }
  }
  // encourage birds to avoid overlapping without pushing each other
  for(let i=0;i<birds.length;i++){
    const b1 = birds[i];
    if(!b1.sprite) continue;
    for(let j=i+1;j<birds.length;j++){
      const b2 = birds[j];
      if(!b2.sprite) continue;
      const dx = b2.sprite.x - b1.sprite.x;
      const dy = b2.sprite.y - b1.sprite.y;
      const distX = Math.abs(dx);
      const min = 12;
      if(distX > 0 && distX < min && Math.abs(dy) < min){
        if(b1.hopCooldown <= 0 && b2.hopCooldown <= 0){
          const dir = Math.sign(dx) || 1;
          const hop = 10;
          const hopBird = (bird, sign) => {
            if(!bird || !bird.sprite) return;
            if(bird.state === BirdState.FLY || bird.state === BirdState.FLEE || bird.state === BirdState.LAND) return;
            if(Math.random() < 0.5){
              bird.state = BirdState.WANDER_GROUND;
              bird.target.set(
                bird.sprite.x + hop * sign,
                bird.sprite.y
              );
              bird.timer = Phaser.Math.FloatBetween(0.5, 1);
              bird.setFacingToTarget();
            }
          };
          hopBird(b1, -dir);
          hopBird(b2, dir);
          b1.hopCooldown = b2.hopCooldown = 1.5;
        }
      }
    }
  }
}

export function cleanupSparrows(scene){
  const birds = scene.gameState.sparrows;
  if(!Array.isArray(birds)) return;
  birds.slice().forEach(b => {
    if(b.threatCheck) b.threatCheck.remove(false);
    if(b.destroy) b.destroy();
  });
  birds.length = 0;
  if(scene.gameState.sparrowSpawnEvent){
    scene.gameState.sparrowSpawnEvent.remove(false);
    scene.gameState.sparrowSpawnEvent = null;
  }
}

export function scatterSparrows(scene){
  const birds = scene.gameState.sparrows;
  if(!Array.isArray(birds)) return;
  const { width } = scene.scale;
  const gs = scene.gameState || GameState;
  // duplicate list so we can remove birds while iterating
  birds.slice().forEach((bird, idx) => {
    if(!bird || !bird.sprite) return;
    const target = new Phaser.Math.Vector2(
      Phaser.Math.Between(-40, width + 40),
      -40
    );
    bird.flyAway(target);
    fadeOutBird(scene, bird, () => {
      const baseDelay = Phaser.Math.Between(2000, 4000);
      const spawnDelay = baseDelay + idx * Phaser.Math.Between(1000,2000);
      scene.time.delayedCall(spawnDelay, () => {
        if(birds.length < maxSparrows(gs.love)) {
          spawnSparrow(scene);
        }
      }, [], scene);
    });
  });
}


function checkThreats(scene, bird){
  if(bird.state === BirdState.FLY || bird.state === BirdState.FLEE) return;
  const actors = [scene.gameState.activeCustomer, ...scene.gameState.queue, ...scene.gameState.wanderers];
  for(const c of actors){
    if(!c || !c.sprite) continue;
    if(Phaser.Math.Distance.Between(bird.sprite.x, bird.sprite.y, c.sprite.x, c.sprite.y) < 50){
      bird.flee(new Phaser.Math.Vector2(bird.sprite.x - c.sprite.x, bird.sprite.y - c.sprite.y));
      return;
    }
    if(c.dog && Phaser.Math.Distance.Between(bird.sprite.x, bird.sprite.y, c.dog.x, c.dog.y) < 60){
      bird.flee(new Phaser.Math.Vector2(bird.sprite.x - c.dog.x, bird.sprite.y - c.dog.y));
      return;
    }
  }
  const truck = scene.gameState && scene.gameState.truck;
  if(truck && scene.tweens && scene.tweens.isTweening && scene.tweens.isTweening(truck)){
    if(Phaser.Math.Distance.Between(bird.sprite.x, bird.sprite.y, truck.x, truck.y) < 80){
      bird.flee(new Phaser.Math.Vector2(bird.sprite.x - truck.x, bird.sprite.y - truck.y));
      return;
    }
  }
}
