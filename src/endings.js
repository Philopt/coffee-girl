// Ending and restart helpers extracted from main.js
import { GameState } from './state.js';
import { scheduleSparrowSpawn } from './sparrow.js';
import { showStartScreen } from './intro.js';
import { updateMoneyDisplay, updateCloudStatus, cleanupFloatingEmojis } from './hud.js';
import { cleanupDogs } from './entities/dog.js';
import { cleanupSparrows } from './sparrow.js';

export function restartGame(overlay){
  const scene=this;
  scene.tweens.killAll();
  scene.time.removeAllEvents();
  cleanupFloatingEmojis();
  if(scene.cleanupHeartEmojis) scene.cleanupHeartEmojis(scene);
  if(scene.cleanupBarks) scene.cleanupBarks();
  if(scene.cleanupBursts) scene.cleanupBursts();
  if(scene.cleanupSparkles) scene.cleanupSparkles(scene);
  cleanupSparrows(scene);
  if (GameState.spawnTimer) { GameState.spawnTimer.remove(false); GameState.spawnTimer = null; }
  if (GameState.dogBarkEvent) { GameState.dogBarkEvent.remove(false); GameState.dogBarkEvent = null; }
  GameState.falconActive = false;
  if(scene.clearDialog) scene.clearDialog();
  if(scene.dialogDrinkEmoji) scene.dialogDrinkEmoji.attachedTo = null;
  if(scene.endOverlay){ scene.endOverlay.destroy(); scene.endOverlay=null; }
  if(scene.sideCText){ scene.sideCText.destroy(); scene.sideCText=null; }
  if(scene.reportLine1) scene.reportLine1.setVisible(false);
  if(scene.reportLine2) scene.reportLine2.setVisible(false);
  if(scene.reportLine3) scene.reportLine3.setVisible(false);
  if(scene.tipText) scene.tipText.setVisible(false);
  if(scene.paidStamp) scene.paidStamp.setVisible(false);
  if(scene.lossStamp) scene.lossStamp.setVisible(false);
  if (scene.truck && scene.girl) {
    const startX = scene.scale.width + 100;
    scene.truck.setPosition(startX, 245);
    scene.girl.setPosition(startX, 245).setVisible(false).setAlpha(1);
    if (scene.girl.clearTint) scene.girl.clearTint();
  }
  GameState.money=10.00; GameState.love=3;
  updateMoneyDisplay(scene);
  scene.loveText.setText(String(GameState.love));
  scene.moneyText.setColor('#fff');
  scene.loveText.setColor('#fff');
  if (scene.cloudDollar && scene.cloudDollar.clearTint) scene.cloudDollar.clearTint();
  if (scene.cloudHeart && scene.cloudHeart.clearTint) scene.cloudHeart.clearTint();
  if(scene.updateLevelDisplay) scene.updateLevelDisplay();
  updateCloudStatus(scene);
  if(GameState.activeCustomer){
    if(GameState.activeCustomer.heartEmoji){ GameState.activeCustomer.heartEmoji.destroy(); GameState.activeCustomer.heartEmoji=null; }
    GameState.activeCustomer.sprite.destroy();
  }
  GameState.activeCustomer=null;
  cleanupDogs(scene);
  GameState.queue.forEach(c => { if(c.sprite) c.sprite.destroy(); });
  GameState.wanderers.forEach(c => { if(c.sprite) c.sprite.destroy(); });
  GameState.queue=[];
  GameState.wanderers=[];
  GameState.customerMemory = {};
  GameState.heartWin = null;
  GameState.servedCount=0;
  GameState.saleInProgress = false;
  scene.sideCAlpha=0;
  scene.sideCFadeTween=null;
  GameState.gameOver=false;
  showStartScreen.call(scene);
  scheduleSparrowSpawn(scene);
  if(overlay){
    scene.time.delayedCall(50,()=>{ scene.tweens.add({targets:overlay,alpha:0,duration:400,onComplete:()=>overlay.destroy()}); },[],scene);
  }
}
export function showEnd(scene, message){
  const rect = scene.add.rectangle(240,320,480,640,0x000000).setDepth(19);
  const lines = String(message).split('\n');
  const text = scene.add.text(240,320, lines.join('\n'), {font:'28px sans-serif',fill:'#fff',align:'center',wordWrap:{width:440}})
    .setOrigin(0.5)
    .setDepth(20);
  const btn = scene.add.text(240,550,'Try Again',{font:'20px sans-serif',fill:'#fff',backgroundColor:'#006400',padding:{x:14,y:8}})
    .setOrigin(0.5)
    .setDepth(21)
    .setInteractive({ useHandCursor:true });
  btn.on('pointerdown',()=>{ restartGame.call(scene, rect); });
  GameState.gameOver = true;
  scene.endOverlay = rect;
  return rect;
}

