export function spawnSparrow(scene){
  const startX = Phaser.Math.Between(-20, 520);
  const startY = Phaser.Math.Between(120, 180);
  const bird = scene.add.sprite(startX, startY, 'sparrow', 0)
    .setDepth(4)
    .setScale(0.5);
  bird.state = 'fly';
  bird.threatCheck = scene.time.addEvent({
    delay: 300,
    loop: true,
    callback: () => checkThreats(scene, bird)
  });
  const targetX = Phaser.Math.Between(200, 280);
  const targetY = Phaser.Math.Between(260, 300);
  bird.anims.play('sparrow_fly');
  scene.tweens.add({
    targets: bird,
    x: targetX,
    y: targetY,
    duration: 1000,
    onComplete: () => land(scene, bird)
  });
  scene.gameState.sparrows.push(bird);
}

function land(scene, bird){
  bird.state = 'ground';
  bird.anims.play('sparrow_ground');
  bird.wait = scene.time.delayedCall(Phaser.Math.Between(2000, 4000), () => {
    bird.anims.play('sparrow_peck');
    bird.state = 'peck';
  }, [], scene);
}

function flyAway(scene, bird){
  if(bird.wait) bird.wait.remove(false);
  bird.state = 'fly';
  bird.anims.play('sparrow_fly');
  const exitX = bird.x < 240 ? -40 : 520;
  scene.tweens.add({
    targets: bird,
    x: exitX,
    y: bird.y - 80,
    duration: 600,
    onComplete: () => {
      if(bird.threatCheck) bird.threatCheck.remove(false);
      const idx = scene.gameState.sparrows.indexOf(bird);
      if(idx !== -1) scene.gameState.sparrows.splice(idx,1);
      bird.destroy();
    }
  });
}

function checkThreats(scene, bird){
  if(bird.state === 'fly') return;
  const actors = [scene.gameState.activeCustomer, ...scene.gameState.queue, ...scene.gameState.wanderers];
  for(const c of actors){
    if(!c || !c.sprite) continue;
    if(Phaser.Math.Distance.Between(bird.x, bird.y, c.sprite.x, c.sprite.y) < 50){
      flyAway(scene, bird);
      return;
    }
    if(c.dog && Phaser.Math.Distance.Between(bird.x, bird.y, c.dog.x, c.dog.y) < 60){
      flyAway(scene, bird);
      return;
    }
  }
}

export function scheduleSparrowSpawn(scene){
  const delay = Phaser.Math.Between(5000, 10000);
  scene.time.delayedCall(delay, () => {
    spawnSparrow(scene);
    scheduleSparrowSpawn(scene);
  }, [], scene);
}
