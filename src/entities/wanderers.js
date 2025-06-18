import { GameState } from '../state.js';
import { dur, scaleForY } from '../ui.js';
import { sendDogOffscreen } from './dog.js';

const EDGE_TURN_BUFFER = 40;

export function loopsForState(state){
  switch(state){
    case 'growing': return 1;
    case 'sparkling':
    case 'arrow':
      return 2;
    default: return 0;
  }
}

export function removeWanderer(scene, c){
  const idx = GameState.wanderers.indexOf(c);
  if(idx >= 0) GameState.wanderers.splice(idx,1);
  const ex = c.sprite.x, ey = c.sprite.y;
  if(c.dog){
    sendDogOffscreen.call(scene,c.dog,ex,ey);
    c.dog = null;
  }
  if(c.heartEmoji){ c.heartEmoji.destroy(); c.heartEmoji = null; }
  c.sprite.destroy();
}

export function handleWanderComplete(scene, c){
  if(c.loopsRemaining > 0){
    c.loopsRemaining--;
    c.dir *= -1;
    const inside = c.dir === 1 ? 480-EDGE_TURN_BUFFER : EDGE_TURN_BUFFER;
    const exitX = c.dir === 1 ? 520 : -40;
    const target = c.loopsRemaining > 0 ? inside : exitX;
    startWander(scene,c,target,c.loopsRemaining===0);
  }else{
    removeWanderer(scene,c);
  }
}

export function startWander(scene, c, targetX, exitAfter){
  if(c.walkTween){ c.walkTween.stop(); c.walkTween.remove(); c.walkTween=null; }
  const startX=c.sprite.x;
  const startY=c.sprite.y;
  const amp = Phaser.Math.Between(15,30);
  const freq = Phaser.Math.FloatBetween ? Phaser.Math.FloatBetween(1.5,4.5) : Phaser.Math.Between(15,45)/10;
  const walkDuration = Phaser.Math.Between(5000,7000);
  c.walkData={startX,startY,targetX,amp,freq,duration:walkDuration,exitAfter};
  c.walkTween = scene.tweens.add({targets:c.sprite,x:targetX,duration:dur(walkDuration),
    onUpdate:(tw,t)=>{
      const p=tw.progress;
      t.y=startY+Math.sin(p*Math.PI*freq)*amp;
      t.setScale(scaleForY(t.y));
    },
    onComplete:()=>{ exitAfter ? removeWanderer(scene,c) : handleWanderComplete(scene,c); }
  });
}

export function resumeWanderer(scene, c){
  if(!c || !c.sprite || !c.walkData) return;
  const {targetX,startX,startY,amp,freq,duration,exitAfter} = c.walkData;
  const totalDist = Math.abs(targetX - startX);
  const remaining = Math.abs(targetX - c.sprite.x);
  const walkDuration = totalDist>0 ? duration * (remaining/totalDist) : duration;
  c.walkTween = scene.tweens.add({
    targets:c.sprite,
    x:targetX,
    duration:dur(walkDuration),
    onUpdate:(tw,t)=>{
      const p=tw.progress;
      t.y=startY+Math.sin(p*Math.PI*freq)*amp;
      t.setScale(scaleForY(t.y));
    },
    onComplete:()=>{ exitAfter ? removeWanderer(scene,c) : handleWanderComplete(scene,c); }
  });
}
