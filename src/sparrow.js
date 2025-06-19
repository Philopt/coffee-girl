import { BirdState } from './constants.js';
import { GameState } from './state.js';

// Limit the number of birds onscreen to avoid performance issues
export const MAX_SPARROWS = 5;

function randomTarget(scene){
  const { width } = scene.scale;
  const options = [
    // ground near the middle
    new Phaser.Math.Vector2(
      Phaser.Math.Between(180,300),
      Phaser.Math.Between(260,300)
    ),
    // top of the truck
    (() => {
      const truck = GameState.truck;
      if (truck && truck.getTopCenter) {
        const top = truck.getTopCenter();
        const y = top.y + 25 * truck.scaleY;
        const left = truck.x - truck.displayWidth / 2 + 40 * truck.scaleX;
        const right = truck.x + truck.displayWidth / 2 - 25 * truck.scaleX;
        return new Phaser.Math.Vector2(
          Phaser.Math.Between(left, right),
          y
        );
      }
      return new Phaser.Math.Vector2(
        Phaser.Math.Between(220, 260),
        217
      );
    })(),
    // offscreen above
    new Phaser.Math.Vector2(
      Phaser.Math.Between(-40,width+40),
      -40
    )
  ];
  return Phaser.Utils.Array.GetRandom(options);
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
    this.state = BirdState.FLY;
    this.velocity = new Phaser.Math.Vector2();
    this.target = new Phaser.Math.Vector2();
    this.curve = null;
    this.followVec = new Phaser.Math.Vector2();
    this.timer = 0;
    this.scared = false;
    this.threatTimer = 0;

    const truck = GameState.truck;
    if (truck && truck.getTopCenter) {
      const top = truck.getTopCenter();
      const y = top.y + 25 * truck.scaleY;
      const left = truck.x - truck.displayWidth / 2 + 40 * truck.scaleX;
      const right = truck.x + truck.displayWidth / 2 - 25 * truck.scaleX;
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
  }

  update(dt){
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
      this.curve.getPoint(eased, this.followVec);
      this.sprite.setPosition(this.followVec.x, this.followVec.y);
    }
  }

  fleeUpdate(dt){
    this.timer += dt;
    this.sprite.x += this.velocity.x * dt * 1.5;
    this.sprite.y += this.velocity.y * dt * 1.5;
  }

  landUpdate(dt){
    const dx = this.target.x - this.sprite.x;
    const dy = this.target.y - this.sprite.y;
    this.sprite.x += dx * 4 * dt;
    this.sprite.y += dy * 4 * dt;
    if(Math.abs(dx) + Math.abs(dy) < 1){
      this.sprite.x = this.target.x;
      this.sprite.y = this.target.y;
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
        if(truck && truck.getTopCenter){
          const top = truck.getTopCenter();
          const roofY = top.y + 25 * truck.scaleY;
          if(Math.abs(this.sprite.y - roofY) < 3){
            const left = truck.x - truck.displayWidth / 2 + 40 * truck.scaleX;
            const right = truck.x + truck.displayWidth / 2 - 25 * truck.scaleX;
            targetX = Phaser.Math.Clamp(targetX, left, right);
          }
        }
        this.target.set(targetX, this.sprite.y);
        this.timer = Phaser.Math.FloatBetween(1,2);
      }else{
        this.timer = Phaser.Math.FloatBetween(1,3);
        if(Math.random() < 0.5) this.sprite.anims.play('sparrow_peck', true);
      }
    }
  }

  wanderUpdate(dt){
    const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, this.target.x, this.target.y);
    const step = 20 * dt;
    this.sprite.x += Math.cos(angle)*step;
    this.sprite.y += Math.sin(angle)*step;
    const truck = GameState.truck;
    if(truck && truck.getTopCenter){
      const top = truck.getTopCenter();
      const roofY = top.y + 25 * truck.scaleY;
      if(Math.abs(this.sprite.y - roofY) < 5){
        const left = truck.x - truck.displayWidth / 2 + 40 * truck.scaleX;
        const right = truck.x + truck.displayWidth / 2 - 25 * truck.scaleX;
        this.sprite.x = Phaser.Math.Clamp(this.sprite.x, left, right);
      }
    }
    this.timer -= dt;
    if(Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.target.x, this.target.y) < 2 || this.timer <= 0){
      this.state = BirdState.IDLE_GROUND;
      this.timer = Phaser.Math.FloatBetween(1,3);
    }
  }

  flee(vec){
    this.velocity.copy(vec.normalize().scale(60));
    this.sprite.anims.play('sparrow_fly');
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
  const birds = scene.gameState.sparrows;
  if (Array.isArray(birds) && birds.length >= MAX_SPARROWS) {
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
  const delay = Phaser.Math.Between(5000,10000);
  gs.sparrowSpawnEvent = scene.time.delayedCall(delay, () => {
    if ((gs.sparrows || []).length < MAX_SPARROWS) {
      spawnSparrow(scene);
    }
    scheduleSparrowSpawn(scene);
  }, [], scene);
}

export function updateSparrows(scene, delta){
  const dt = delta/1000;
  const birds = scene.gameState.sparrows;
  if(!Array.isArray(birds)) return;
  for(const bird of birds){
    bird.update(dt);
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
