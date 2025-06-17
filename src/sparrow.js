import { BirdState } from './constants.js';

function randomTarget(scene){
  const { width } = scene.scale;
  const options = [
    // ground near the middle
    new Phaser.Math.Vector2(
      Phaser.Math.Between(180,300),
      Phaser.Math.Between(260,300)
    ),
    // top of the truck (approx y=217)
    new Phaser.Math.Vector2(
      Phaser.Math.Between(220,260),
      217
    ),
    // offscreen above
    new Phaser.Math.Vector2(
      Phaser.Math.Between(-40,width+40),
      -40
    )
  ];
  return Phaser.Utils.Array.GetRandom(options);
}

export function spawnSparrow(scene){
  const startX = Phaser.Math.Between(-20, 520);
  const startY = Phaser.Math.Between(120, 180);
  const sprite = scene.add.sprite(startX, startY, 'sparrow', 0)
    .setDepth(4)
    .setScale(0.5);
  const bird = {
    sprite,
    state: BirdState.FLY,
    velocity: new Phaser.Math.Vector2(),
    target: new Phaser.Math.Vector2(),
    timer: 0,
    scared: false,
    threatTimer: 0,
  };
  bird.target.copy(randomTarget(scene));
  bird.velocity.set(bird.target.x - startX, bird.target.y - startY).normalize().scale(60);
  sprite.anims.play('sparrow_fly');
  scene.gameState.sparrows.push(bird);
}

export function scheduleSparrowSpawn(scene){
  const delay = Phaser.Math.Between(5000,10000);
  scene.time.delayedCall(delay, () => {
    spawnSparrow(scene);
    scheduleSparrowSpawn(scene);
  }, [], scene);
}

export function updateSparrows(scene, delta){
  const dt = delta/1000;
  const birds = scene.gameState.sparrows;
  if(!Array.isArray(birds)) return;
  for(const bird of birds){
    bird.threatTimer -= dt;
    if(bird.threatTimer <= 0){
      checkThreats(scene, bird);
      bird.threatTimer = 0.3;
    }
    switch(bird.state){
      case BirdState.FLY:
        flyUpdate(bird, dt);
        if(bird.timer > 2.5){
          bird.state = BirdState.LAND;
          bird.timer = 0;
        }
        break;
      case BirdState.LAND:
        landUpdate(bird, dt);
        break;
      case BirdState.IDLE_GROUND:
        idleUpdate(bird, dt);
        break;
      case BirdState.WANDER_GROUND:
        wanderUpdate(bird, dt);
        break;
      case BirdState.FLEE:
        fleeUpdate(bird, dt);
        if(bird.timer > 2){
          bird.target.copy(randomTarget(scene));
          bird.velocity.set(
            bird.target.x - bird.sprite.x,
            bird.target.y - bird.sprite.y
          ).normalize().scale(60);
          bird.state = BirdState.FLY;
          bird.timer = 0;
        }
        break;
      case BirdState.PERCH:
        // stay still
        break;
      case BirdState.ALERT:
        bird.timer -= dt;
        if(bird.timer <= 0){
          bird.state = BirdState.FLY;
          bird.timer = 0;
        }
        break;
    }
  }
}

function flyUpdate(bird, dt){
  bird.timer += dt;
  bird.sprite.x += bird.velocity.x * dt;
  bird.sprite.y += bird.velocity.y * dt;
}

function fleeUpdate(bird, dt){
  bird.timer += dt;
  bird.sprite.x += bird.velocity.x * dt * 1.5;
  bird.sprite.y += bird.velocity.y * dt * 1.5;
}

function landUpdate(bird, dt){
  const dx = bird.target.x - bird.sprite.x;
  const dy = bird.target.y - bird.sprite.y;
  bird.sprite.x += dx * 4 * dt;
  bird.sprite.y += dy * 4 * dt;
  if(Math.abs(dx) + Math.abs(dy) < 1){
    bird.sprite.x = bird.target.x;
    bird.sprite.y = bird.target.y;
    bird.sprite.anims.play('sparrow_ground');
    bird.state = BirdState.IDLE_GROUND;
    bird.timer = Phaser.Math.FloatBetween(1,3);
  }
}

function idleUpdate(bird, dt){
  bird.timer -= dt;
  if(bird.timer <= 0){
    if(Math.random() < 0.3){
      bird.state = BirdState.WANDER_GROUND;
      bird.target.set(bird.sprite.x + Phaser.Math.Between(-30,30), bird.sprite.y);
      bird.timer = Phaser.Math.FloatBetween(1,2);
    }else{
      bird.timer = Phaser.Math.FloatBetween(1,3);
      if(Math.random() < 0.5) bird.sprite.anims.play('sparrow_peck', true);
    }
  }
}

function wanderUpdate(bird, dt){
  const angle = Phaser.Math.Angle.Between(bird.sprite.x, bird.sprite.y, bird.target.x, bird.target.y);
  const step = 20 * dt;
  bird.sprite.x += Math.cos(angle)*step;
  bird.sprite.y += Math.sin(angle)*step;
  bird.timer -= dt;
  if(Phaser.Math.Distance.Between(bird.sprite.x, bird.sprite.y, bird.target.x, bird.target.y) < 2 || bird.timer <= 0){
    bird.state = BirdState.IDLE_GROUND;
    bird.timer = Phaser.Math.FloatBetween(1,3);
  }
}

function flee(scene, bird, vec){
  bird.velocity.copy(vec.normalize().scale(60));
  bird.sprite.anims.play('sparrow_fly');
  bird.state = BirdState.FLEE;
  bird.timer = 0;
}

function checkThreats(scene, bird){
  if(bird.state === BirdState.FLY || bird.state === BirdState.FLEE) return;
  const actors = [scene.gameState.activeCustomer, ...scene.gameState.queue, ...scene.gameState.wanderers];
  for(const c of actors){
    if(!c || !c.sprite) continue;
    if(Phaser.Math.Distance.Between(bird.sprite.x, bird.sprite.y, c.sprite.x, c.sprite.y) < 50){
      flee(scene, bird, new Phaser.Math.Vector2(bird.sprite.x - c.sprite.x, bird.sprite.y - c.sprite.y));
      return;
    }
    if(c.dog && Phaser.Math.Distance.Between(bird.sprite.x, bird.sprite.y, c.dog.x, c.dog.y) < 60){
      flee(scene, bird, new Phaser.Math.Vector2(bird.sprite.x - c.dog.x, bird.sprite.y - c.dog.y));
      return;
    }
  }
  const truck = scene.gameState && scene.gameState.truck;
  if(truck && scene.tweens && scene.tweens.isTweening && scene.tweens.isTweening(truck)){
    if(Phaser.Math.Distance.Between(bird.sprite.x, bird.sprite.y, truck.x, truck.y) < 80){
      flee(scene, bird, new Phaser.Math.Vector2(bird.sprite.x - truck.x, bird.sprite.y - truck.y));
      return;
    }
  }
}
