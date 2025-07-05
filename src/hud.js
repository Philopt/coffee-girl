// HUD related helper functions extracted from main.js
import { dur } from './ui.js';
import { GameState, floatingEmojis, removeFloatingEmoji } from './state.js';
import { receipt } from './assets.js';

// Cloud positions mirror values in main.js
export const MONEY_TOP_Y = 5;
export const MONEY_BOTTOM_Y = 35;
export const LOVE_TOP_Y = 5;
export const LOVE_BOTTOM_Y = 35;

let cloudHeartTween=null, cloudDollarTween=null;

export function animateStatChange(obj, scene, delta, isLove=false){
  if(delta===0) return;
  const up = delta>0;
  const color = up ? '#0f0' : '#f00';
  const by = up ? -8 : 8;
  const originalY = obj.y;
  const moveDur = isLove && !up ? 160 : 120;
  scene.tweens.add({targets:obj, y:originalY+by, duration:dur(moveDur), yoyo:true});

  const cloud = isLove ? scene.cloudHeart : scene.cloudDollar;
  if(cloud){
    const cOrigY = cloud.y;
    scene.tweens.add({targets:cloud, y:cOrigY+by, duration:dur(moveDur), yoyo:true});
  }
  let on=true;
  const flashes = isLove && !up ? 4 : 2;
  const flashDelay = isLove && !up ? 120 : 80;
  scene.time.addEvent({
    repeat:flashes,
    delay:dur(flashDelay),
    callback:()=>{
      obj.setColor(on?color:'#fff');
      if(isLove && !up){
        obj.setText(String(GameState.love));
      }
      on=!on;
    }
  });
  if(cloud){
    const tint = up ? 0x00ff00 : 0xff0000;
    let cOn=true;
    scene.time.addEvent({
      repeat:flashes,
      delay:dur(flashDelay),
      callback:()=>{ if(cOn) cloud.setTintFill(tint); else cloud.clearTint(); cOn=!cOn; }
    });
    scene.time.delayedCall(dur(flashDelay)*(flashes+1)+dur(10),()=>{ cloud.clearTint(); },[],scene);
  }
  scene.time.delayedCall(dur(flashDelay)*(flashes+1)+dur(10),()=>{
    obj.setColor('#fff');
    if(isLove && !up){ obj.setText(String(GameState.love)); }
  },[],scene);
  scene.time.delayedCall(dur(moveDur)*2,()=>{ updateCloudStatus(scene); },[],scene);
}

function frameForStat(val){
  if(val<=0) return 4;
  if(val===1) return 3;
  if(val===2) return 2;
  if(val===3) return 1;
  return 0;
}

export function updateCloudStatus(scene){
  if(!scene) return;
  if(scene.cloudHeart) scene.cloudHeart.x = scene.cloudHeartBaseX;
  if(scene.cloudDollar) scene.cloudDollar.x = scene.cloudDollarBaseX;
  updateCloudPositions(scene);
  if(scene.cloudHeart && scene.cloudHeart.setFrame){
    scene.cloudHeart.setFrame(frameForStat(GameState.love));
  }
  if(scene.cloudDollar && scene.cloudDollar.setFrame){
    scene.cloudDollar.setFrame(frameForStat(Math.floor(GameState.money)));
  }
  const amps=[1,3,5,7,10];
  const durs=[6000,5000,4000,3000,2000];
  const loveIdx=frameForStat(GameState.love);
  const moneyIdx=frameForStat(Math.floor(GameState.money));
  const makeTween=(existing,targets,amp,durTime)=>{
    if(existing){ if(existing.remove) existing.remove(); else if(existing.stop) existing.stop(); }
    if(!scene.tweens) return null;
    return scene.tweens.add({targets, x:`+=${amp}`, duration:dur(durTime), yoyo:true, repeat:-1, ease:'Sine.easeInOut'});
  };
  cloudHeartTween=makeTween(cloudHeartTween,[scene.cloudHeart,scene.loveText],amps[loveIdx],durs[loveIdx]);
  cloudDollarTween=makeTween(cloudDollarTween,[scene.cloudDollar,scene.moneyText,scene.moneyDollar],amps[moneyIdx],durs[moneyIdx]);
}

export function updateCloudPositions(scene){
  const {cloudDollar, cloudHeart, moneyText, moneyDollar} = scene;
  if(cloudDollar){
    const ratio=Math.min(scene.MAX_M||100,Math.max(0,GameState.money))/(scene.MAX_M||100);
    const newY=MONEY_BOTTOM_Y-(MONEY_BOTTOM_Y-MONEY_TOP_Y)*ratio;
    cloudDollar.y=newY;
    const centerX = cloudDollar.x + cloudDollar.displayWidth/2;
    const centerY = newY + cloudDollar.displayHeight/2;
    moneyText.setPosition(centerX, centerY);
    if(moneyDollar){
      moneyDollar.setPosition(centerX - moneyText.displayWidth/2 - moneyDollar.displayWidth/2, centerY);
    }
  }
  if(cloudHeart){
    const ratio=Math.min(scene.MAX_L||100,Math.max(0,GameState.love))/(scene.MAX_L||100);
    const newY=LOVE_BOTTOM_Y-(LOVE_BOTTOM_Y-LOVE_TOP_Y)*ratio;
    cloudHeart.y=newY;
    scene.loveText.setPosition(cloudHeart.x - cloudHeart.displayWidth/2, newY + cloudHeart.displayHeight/2);
  }
}

export function updateMoneyDisplay(scene){
  const {moneyText, moneyDollar} = scene;
  if(!moneyText || !moneyDollar) return;
  const val = receipt(GameState.money);
  moneyDollar.setText(val.charAt(0));
  moneyText.setText(val.slice(1));
  updateCloudPositions(scene);
}

export function countPrice(text, scene, from, to, baseLeft, baseY=15){
  if(!text || !scene) return;
  const duration = dur(400);
  if(scene.tweens && scene.tweens.addCounter){
    scene.tweens.addCounter({
      from,
      to,
      duration,
      onUpdate:tween=>{
        text.setText(receipt(tween.getValue()));
        text.setPosition(baseLeft + text.displayWidth/2, baseY);
      },
      onComplete:()=>{
        text.setText(receipt(to));
        text.setPosition(baseLeft + text.displayWidth/2, baseY);
      }
    });
  } else {
    text.setText(receipt(to));
    text.setPosition(baseLeft + text.displayWidth/2, baseY);
  }
}

export function cleanupFloatingEmojis(){
  floatingEmojis.slice().forEach(e=>{
    if(e && e.destroy) e.destroy();
    if (typeof removeFloatingEmoji === 'function') {
      removeFloatingEmoji(e);
    } else {
      const i = floatingEmojis.indexOf(e);
      if(i !== -1) floatingEmojis.splice(i,1);
    }
  });
}
