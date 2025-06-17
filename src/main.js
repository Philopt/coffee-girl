import { debugLog, DEBUG } from './debug.js';
import { dur, scaleForY, articleFor, flashMoney, START_PHONE_W, START_PHONE_H, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_Y, DIALOG_Y } from "./ui.js";
import { MENU, SPAWN_DELAY, SPAWN_VARIANCE, QUEUE_SPACING, ORDER_X, ORDER_Y, QUEUE_X, QUEUE_OFFSET, QUEUE_Y, WANDER_TOP, WANDER_BOTTOM, WALK_OFF_BASE, MAX_M, MAX_L, calcLoveLevel, maxWanderers as customersMaxWanderers, queueLimit as customersQueueLimit } from "./customers.js";
import { baseConfig } from "./scene.js";
import { GameState, floatingEmojis, addFloatingEmoji, removeFloatingEmoji } from "./state.js";
export let Assets, Scene, Customers, config;
export let showStartScreenFn, handleActionFn, spawnCustomerFn, scheduleNextSpawnFn, showDialogFn, animateLoveChangeFn, blinkButtonFn;
const DOG_MIN_Y = ORDER_Y + 20;
const DOG_SPEED = 120; // base movement speed for the dog
const DOG_FAST_DISTANCE = 160; // accelerate when farther than this from owner
const DOG_TYPES = [
  {type:'standard', emoji:'🐶'},
  {type:'poodle', emoji:'🐩'},
  {type:'guide', emoji:'🦮'},
  {type:'service', emoji:'🐕‍🦺'}
];
const CUSTOMER_SPEED = 560 / 6; // pixels per second for wanderers
const LURE_SPEED = CUSTOMER_SPEED * 0.6; // slower approach when lured
// Minimum duration when a customer dashes to the table
const DART_MIN_DURATION = 300;
// Maximum speed (pixels per second) when dashing to the table
const DART_MAX_SPEED = CUSTOMER_SPEED * 3;
// Offset for the drink emoji when the customer holds it
// Raise it slightly so it appears near their hands instead of their feet
const DRINK_HOLD_OFFSET = { x: 0, y: -20 };
const HEART_EMOJIS = {
  normal: null,
  broken: '💔',
  mending: '❤️‍🩹',
  growing: '💗',
  sparkling: '💖',
  arrow: '💘'
};
export function setupGame(){
  if (typeof debugLog === 'function') debugLog('main.js loaded');
  let initCalled = false;
  function init(){
    if (typeof debugLog === 'function') debugLog('init() executing');
    initCalled = true;
    new Phaser.Game(config);
  }
  // full drink menu with prices


  // state is managed in GameState

  const keys=[];
  const requiredAssets=['bg','truck','girl','lady_falcon','falcon_end','revolt_end'];
  const genzSprites=[
    'new_kid_0_0','new_kid_0_1','new_kid_0_2','new_kid_0_4','new_kid_0_5',
    'new_kid_1_0','new_kid_1_1','new_kid_1_2','new_kid_1_3','new_kid_1_4','new_kid_1_5',
    'new_kid_2_0','new_kid_2_1','new_kid_2_2','new_kid_2_3','new_kid_2_4','new_kid_2_5',
    'new_kid_3_0','new_kid_3_1','new_kid_3_2','new_kid_3_3','new_kid_3_4','new_kid_3_5',
    'new_kid_4_0','new_kid_4_1','new_kid_4_2','new_kid_4_3','new_kid_4_4','new_kid_4_5'
  ];


  const supers={
    '0':'\u2070','1':'\u00b9','2':'\u00b2','3':'\u00b3','4':'\u2074',
    '5':'\u2075','6':'\u2076','7':'\u2077','8':'\u2078','9':'\u2079'
  };
  function receipt(value){
    const [d,c]=value.toFixed(2).split(".");
    const cents=c.split("").map(ch=>supers[ch]||ch).join("");
    return `$${d}${cents}`;
  }

  function emojiFor(name){
    const n=name.toLowerCase();
    if(n.includes('tea')) return '🍵';
    if(n.includes('chocolate')) return '🍫';
    if(n.includes('latte')||n.includes('mocha')||n.includes('espresso')) return '☕';
    return '☕';
  }



  function flashBorder(rect, scene, color=0x00ff00){
    if(!rect || !rect.setStrokeStyle) return;
    const original=rect.strokeColor||0x000000;
    let on=false;
    const flashes=4;
    scene.time.addEvent({
      repeat:flashes,
      delay:dur(60),
      callback:()=>{
        rect.setStrokeStyle(2, on?color:original);
        on=!on;
      }
    });
    scene.time.delayedCall(dur(60)*(flashes+1)+dur(10),()=>{
      rect.setStrokeStyle(2, original);
    },[],scene);
  }

  function flashFill(rect, scene, color=0x00ff00){
    if(!rect || !rect.setFillStyle) return;
    const original=rect.fillColor||0xffffff;
    let on=false;
    const flashes=4;
    scene.time.addEvent({
      repeat:flashes,
      delay:dur(60),
      callback:()=>{
        rect.setFillStyle(on?color:original,1);
        on=!on;
      }
    });
    scene.time.delayedCall(dur(60)*(flashes+1)+dur(10),()=>{
      rect.setFillStyle(original,1);
    },[],scene);
  }


  function animateStatChange(obj, scene, delta, isLove=false){
    if(delta===0) return;
    const up = delta>0;
    const color = up ? '#0f0' : '#f00';
    const by = up ? -8 : 8;
    const originalY = obj.y;
    const moveDur = isLove && !up ? 160 : 120;
    scene.tweens.add({targets:obj, y:originalY+by, duration:dur(moveDur), yoyo:true});
    let on=true;
    const flashes = isLove && !up ? 4 : 2;
    const flashDelay = isLove && !up ? 120 : 80;
    scene.time.addEvent({
      repeat:flashes,
      delay:dur(flashDelay),
      callback:()=>{
        obj.setColor(on?color:'#fff');
        if(isLove && !up){
          obj.setText((on?'💔':'❤️')+' '+GameState.love);
        }
        on=!on;
      }
    });
    scene.time.delayedCall(dur(flashDelay)*(flashes+1)+dur(10),()=>{
      obj.setColor('#fff');
      if(isLove && !up){
        obj.setText('❤️ '+GameState.love);
        // removed wobble animation for the love counter
      }
    },[],scene);
  }

  function cleanupFloatingEmojis(){
    floatingEmojis.slice().forEach(e=>{
      if(e && e.destroy) e.destroy();
      if (typeof removeFloatingEmoji === 'function') {
        removeFloatingEmoji(e);
      } else if (GameState && typeof GameState.removeFloatingEmoji === 'function') {
        GameState.removeFloatingEmoji(e);
      } else {
        const i = floatingEmojis.indexOf(e);
        if(i !== -1) floatingEmojis.splice(i,1);
      }
    });
  }

  function hideOverlayTexts(){
    if(reportLine1) reportLine1.setVisible(false);
    if(reportLine2) reportLine2.setVisible(false);
    if(reportLine3) reportLine3.setVisible(false);
    if(tipText) tipText.setVisible(false);
    if(paidStamp) paidStamp.setVisible(false);
    if(lossStamp) lossStamp.setVisible(false);
  }

  function blinkButton(btn, onComplete, inputObj){
    // Temporarily disable input while the button blinks. The optional
    // inputObj parameter allows specifying a separate interactive
    // object (e.g. an invisible zone) to disable during the blink
    // without destroying its hit area.

    const target = inputObj || btn;
    if (target.input) {
      target.input.enabled = false;
    }
    this.tweens.add({
      targets: btn,
      alpha: 0,
      yoyo: true,
      duration: dur(80),
      repeat: 1,
      onComplete: () => {
        if (target.input) {
          target.input.enabled = true;
        }
        if (onComplete) onComplete();
      }
    });
  }

  function applyRandomSkew(obj){
    if(!obj) return;
    obj.skewX = Phaser.Math.FloatBetween(-0.03, 0.03);
    obj.skewY = Phaser.Math.FloatBetween(-0.03, 0.03);
  }

  function fadeInButtons(canAfford){
    const buttons = [];
    if (canAfford) buttons.push(btnSell);
    buttons.push(btnGive, btnRef);
    buttons.forEach(b => {
      b.setAlpha(0).setVisible(true);
      if (b.input) b.input.enabled = false;
    });
    this.tweens.add({
      targets: buttons,
      alpha: 1,
      duration: dur(150),
      onComplete: () => {
        if (canAfford && btnSell.input) btnSell.input.enabled = true;
        if (btnGive.input) btnGive.input.enabled = true;
        if (btnRef.input) btnRef.input.enabled = true;
      }
    });
  }




  let moneyText, loveText, queueLevelText;
  let dialogBg, dialogText, dialogCoins,
      dialogPriceLabel, dialogPriceValue, dialogPriceBox,
      dialogDrinkEmoji, dialogPriceContainer,
      btnSell, btnGive, btnRef;
  let reportLine1, reportLine2, reportLine3, tipText;
  let paidStamp, lossStamp;
  let truck, girl;
  let sideCText;
  let sideCAlpha=0;
  let sideCFadeTween=null;
  let endOverlay=null;
  let startOverlay=null;
  let startButton=null;
  let phoneContainer=null;
  let startMsgTimers=[];
  let startMsgBubbles=[];
  // hearts or anger symbols currently animating

  function maxWanderers(){
    return customersMaxWanderers(GameState.love);
  }

  function queueLimit(){
    return customersQueueLimit(GameState.love);
  }


  function lureNextWanderer(scene, specific){
    if (typeof debugLog === 'function') {
      debugLog('lureNextWanderer', GameState.queue.length, GameState.wanderers.length, GameState.activeCustomer);
    }

    if(GameState.wanderers.length && GameState.queue.length < queueLimit()){
      if(GameState.queue.some(c=>c.walkTween)){
        if (typeof debugLog === 'function') {
          debugLog('lureNextWanderer abort: walkTween active');
        }
        return;
      }

      let c;
      if(specific){
        const idx = GameState.wanderers.indexOf(specific);
        if(idx===-1) return;
        c = GameState.wanderers.splice(idx,1)[0];
      }else{
        let closestIdx=0;
        let minDist=Number.MAX_VALUE;
        for(let i=0;i<GameState.wanderers.length;i++){
          const d=Math.abs(GameState.wanderers[i].sprite.x-ORDER_X);
          if(d<minDist){ closestIdx=i; minDist=d; }
        }
        c=GameState.wanderers.splice(closestIdx,1)[0];
      }
      if(c.walkTween){
        c.walkTween.stop();
        c.walkTween.remove();
        c.walkTween=null;
      }
      const idx=GameState.queue.length;
      c.atOrder=false;
      GameState.queue.push(c);
      if (typeof debugLog === 'function') debugLog('customer lured to queue');
      GameState.activeCustomer=GameState.queue[0];
      const targetX = idx===0 ? ORDER_X : QUEUE_X - QUEUE_SPACING*(idx-1);
      const targetY = idx===0 ? ORDER_Y : QUEUE_Y - QUEUE_OFFSET*(idx-1);
      const bottomY = c.sprite.y + c.sprite.displayHeight * (1 - c.sprite.originY);
      c.sprite.setDepth(5 + bottomY*0.006);
      const dir = c.dir || (c.sprite.x < targetX ? 1 : -1);
      c.walkTween = curvedApproach(scene, c.sprite, dir, targetX, targetY, () => {
        if (idx===0 && typeof debugLog === 'function') debugLog('customer reached order position');
        c.walkTween = null;
        if(idx===0){
          if (typeof debugLog === 'function') {
            debugLog('curvedApproach complete: calling showDialog');
          }
          showDialog.call(scene);
        }
      }, LURE_SPEED);
      if(typeof checkQueueSpacing==='function') checkQueueSpacing(scene);
    }
  }

  function moveQueueForward(){
    if (typeof debugLog === 'function') {
      debugLog('moveQueueForward', GameState.queue.length, GameState.wanderers.length, GameState.activeCustomer);
    }
    const scene=this;
    let willShow=false;
    GameState.queue.forEach((cust, idx)=>{
      const tx = idx===0 ? ORDER_X : QUEUE_X - QUEUE_SPACING*(idx-1);
      const ty = idx===0 ? ORDER_Y : QUEUE_Y - QUEUE_OFFSET*(idx-1);
      if(cust.sprite.y!==ty || cust.sprite.x!==tx){
        const dir = cust.dir || (cust.sprite.x < tx ? 1 : -1);
        cust.walkTween = curvedApproach(scene, cust.sprite, dir, tx, ty, () => {
          cust.walkTween = null;
          if(idx===0){
            if (typeof debugLog === 'function') debugLog('customer reached order position');
            if (typeof debugLog === 'function') {
              debugLog('curvedApproach complete: calling showDialog');
            }
            showDialog.call(scene);
          }
        });
        if(idx===0) willShow=true;
      }
    });
    GameState.activeCustomer=GameState.queue[0]||null;
    if(GameState.activeCustomer){
      if(!willShow && GameState.activeCustomer.sprite.y===ORDER_Y && GameState.activeCustomer.sprite.x===ORDER_X){
        if (typeof debugLog === 'function') debugLog('customer reached order position');
        showDialog.call(scene);
      }
    }
    if(GameState.girlReady && GameState.queue.length < queueLimit()){
        lureNextWanderer(scene);
    }
    if(typeof checkQueueSpacing==='function') checkQueueSpacing(scene);
  }

  function checkQueueSpacing(scene){
    GameState.queue.forEach((cust, idx)=>{
      const tx = idx===0 ? ORDER_X : QUEUE_X - QUEUE_SPACING*(idx-1);
      const ty = idx===0 ? ORDER_Y : QUEUE_Y - QUEUE_OFFSET*(idx-1);
      const dist = Phaser.Math.Distance.Between(cust.sprite.x,cust.sprite.y,tx,ty);
      if(dist > 2){
        if(cust.walkTween){
          cust.walkTween.stop();
          cust.walkTween.remove();
          cust.walkTween=null;
        }
        const dir = cust.dir || (cust.sprite.x < tx ? 1 : -1);
        const tween = curvedApproach(
          scene,
          cust.sprite,
          dir,
          tx,
          ty,
          () => {
            if (idx === 0) {
              if (typeof debugLog === 'function') {
                debugLog('checkQueueSpacing complete: calling showDialog');
              }
              showDialog.call(scene);
            }
          },
          idx === 0 ? CUSTOMER_SPEED : LURE_SPEED
        );
        if (idx === 0) {
          cust.walkTween = tween;
        }
      }
    });
  }

  function curvedApproach(scene, sprite, dir, targetX, targetY, onComplete, speed=CUSTOMER_SPEED){
    const startX = sprite.x;
    const startY = sprite.y;
    const offset = 40 * dir;
    const curve = new Phaser.Curves.CubicBezier(
      new Phaser.Math.Vector2(startX, startY),
      new Phaser.Math.Vector2(startX + offset, startY),
      new Phaser.Math.Vector2(targetX - offset, targetY),
      new Phaser.Math.Vector2(targetX, targetY)
    );
    const dist = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
    const duration = dur((dist / speed) * 1000);
    const follower = { t: 0, vec: new Phaser.Math.Vector2() };
    return scene.tweens.add({
      targets: follower,
      t: 1,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        curve.getPoint(follower.t, follower.vec);
        sprite.setPosition(follower.vec.x, follower.vec.y);
        sprite.setScale(scaleForY(sprite.y));
      },
      onComplete: () => {
        sprite.setPosition(targetX, targetY);
        sprite.setScale(scaleForY(targetY));
        if(onComplete) onComplete();
      }
    });
  }

  function enforceCustomerScaling(){
    const setDepth = (sprite, base=5)=>{
      if(!sprite) return;
      const bottomY = sprite.y + sprite.displayHeight * (1 - sprite.originY);
      sprite.setDepth(base + bottomY*0.006);
    };
    const scaleDog = d => {
      if(!d) return;
      const s = scaleForY(d.y)*0.5;
      const dir = d.dir || 1;
      d.setScale(s*dir, s);
      setDepth(d,3);
    };
    const updateHeart = c => {
      if(!c.sprite) return;
      const state = c.memory && c.memory.state || 'normal';
      if(state !== 'normal'){
        if(!c.heartEmoji){
          c.heartEmoji = c.sprite.scene.add.text(c.sprite.x, c.sprite.y, HEART_EMOJIS[state] || '', {font:'24px sans-serif'})
            .setOrigin(0.5);
        }
        const y = c.sprite.y + c.sprite.displayHeight * 0.25;
        const scale = scaleForY(c.sprite.y)*0.6;
        c.heartEmoji.setText(HEART_EMOJIS[state] || '').setPosition(c.sprite.x, y).setScale(scale);
        c.heartEmoji.setDepth(c.sprite.depth+1);
      }else if(c.heartEmoji){
        c.heartEmoji.destroy();
        c.heartEmoji = null;
      }
    };
    GameState.queue.forEach(c=>{
      if(c.sprite){ c.sprite.setScale(scaleForY(c.sprite.y)); setDepth(c.sprite,5); }
      if(c.dog) scaleDog(c.dog);
      updateHeart(c);
    });
    GameState.wanderers.forEach(c=>{
      if(c.sprite){ c.sprite.setScale(scaleForY(c.sprite.y)); setDepth(c.sprite,5); }
      if(c.dog) scaleDog(c.dog);
      updateHeart(c);
    });
  }

  function updateDrinkEmojiPosition(){
    if(dialogDrinkEmoji && dialogDrinkEmoji.attachedTo){
      const cust = dialogDrinkEmoji.attachedTo;
      if(cust.active){
        dialogDrinkEmoji.setPosition(cust.x + DRINK_HOLD_OFFSET.x,
                                    cust.y + DRINK_HOLD_OFFSET.y);
      }else{
        dialogDrinkEmoji.setVisible(false);
        dialogDrinkEmoji.attachedTo = null;
      }
    }
  }


  function updateDog(owner){
    const dog = owner && owner.dog;
    if(!dog || !owner.sprite) return;
    const ms = owner.sprite;
    const dogDist = Phaser.Math.Distance.Between(dog.x,dog.y,ms.x,ms.y);
    let radius = 80;
    let near = 60;
    let targetX = ms.x, targetY = ms.y;
    const type = dog.dogType || 'standard';
    if(type==='service'){
      radius = 50;
      near = 30;
    }
    if(type==='guide'){
      const dir=owner.dir||1;
      targetX = ms.x + dir*40;
    }

    const others=[...GameState.queue,...GameState.wanderers].filter(c=>c!==owner&&c.sprite);
    // Stop any existing movement tweens so new motions start from the dog's
    // current position. This prevents teleport-like jumps when multiple tweens
    // overlap.
    if(dog.currentTween){
      dog.currentTween.stop();
      dog.currentTween=null;
    }
    if(type!=='service' && !dog.excited){
      const seen=others.find(o=>Phaser.Math.Distance.Between(dog.x,dog.y,o.sprite.x,o.sprite.y)<80);
      if(seen){
        dog.excited=true;
        const s=seen.sprite;
        const tl=this.tweens.createTimeline();
        tl.add({targets:dog,y:'-=15',duration:dur(100),yoyo:true,repeat:1});
        tl.add({targets:dog,x:s.x,y:s.y,duration:dur(300)});
        tl.add({targets:dog,x:'-=12',duration:dur(120),yoyo:true,repeat:1});
        tl.add({targets:dog,x:'+=24',duration:dur(120),yoyo:true,repeat:1});
        tl.add({targets:dog,x:ms.x,y:ms.y,duration:dur(400)});
        tl.setCallback('onUpdate',()=>{
          if(dog.prevX===undefined) dog.prevX=dog.x;
          const dx=dog.x-dog.prevX;
          if(Math.abs(dx)>3){
            dog.dir=dx>0?1:-1;
          }
          dog.prevX=dog.x;
          const s=scaleForY(dog.y)*0.5;
          dog.setScale(s*(dog.dir||1), s);
        });
        tl.setCallback('onComplete',()=>{dog.excited=false; dog.currentTween=null;});
        dog.currentTween=tl;
        tl.play();
        return;
      }

    }
    if(dogDist <= radius){
      for(const o of others){
        const d=Phaser.Math.Distance.Between(dog.x,dog.y,o.sprite.x,o.sprite.y);
        if(d<near){
          const ang=Phaser.Math.Angle.Between(o.sprite.x,o.sprite.y,dog.x,dog.y);
          targetX=dog.x+Math.cos(ang)*(near-d);
          targetY=dog.y+Math.sin(ang)*(near-d);
          dog.restUntil=this.time.now+Phaser.Math.Between(5000,10000);
          break;
        }
      }
      if(targetX===ms.x && targetY===ms.y){
        const side=Phaser.Math.Between(0,1)?1:-1;
        const offsetX=side*Phaser.Math.Between(20,30);
        const offsetY=Phaser.Math.Between(10,20);
        targetX=ms.x+offsetX;
        targetY=ms.y+offsetY;
        dog.restUntil=this.time.now+Phaser.Math.Between(5000,10000);
      }
    } else {
      dog.restUntil=0;
    }
    if(targetY < DOG_MIN_Y) targetY = DOG_MIN_Y;
    const distance = Phaser.Math.Distance.Between(dog.x,dog.y,targetX,targetY);
    const speed = dogDist>DOG_FAST_DISTANCE?DOG_SPEED*1.5:DOG_SPEED;
    const duration = dur(Math.max(200,(distance/speed)*1000));
    if(Math.abs(targetX-dog.x) > 3){
      dog.dir = targetX > dog.x ? 1 : -1;
    }
    dog.currentTween=this.tweens.add({targets:dog,x:targetX,y:targetY,duration,
      onUpdate:(tw,t)=>{
        if(t.prevX===undefined) t.prevX=t.x;
        const dx=t.x - t.prevX;
        if(Math.abs(dx) > 3){
          t.dir = dx>0?1:-1;
        }
        t.prevX=t.x;
        const s=scaleForY(t.y)*0.5;
        t.setScale(s*(t.dir||1), s);
        const bottomY = t.y + t.displayHeight * (1 - t.originY);
        t.setDepth(3 + bottomY*0.006);
      },
      onComplete:()=>{dog.currentTween=null;}});
  }

  function sendDogOffscreen(dog, x, y){
    if(!dog) return;
    if(dog.followEvent) dog.followEvent.remove(false);
    const dist = Phaser.Math.Distance.Between(dog.x, dog.y, x, y);
    if(Math.abs(x-dog.x) > 3){
      dog.dir = x>dog.x?1:-1;
    }
    this.tweens.add({targets:dog,x,y,duration:dur((dist/DOG_SPEED)*1000),
      onUpdate:(tw,t)=>{
        if(t.prevX===undefined) t.prevX=t.x;
        const dx=t.x - t.prevX;
        if(Math.abs(dx)>3){
          t.dir=dx>0?1:-1;
        }
        t.prevX=t.x;
        const s=scaleForY(t.y)*0.5;
        t.setScale(s*(t.dir||1), s);
        const bottomY = t.y + t.displayHeight * (1 - t.originY);
        t.setDepth(3 + bottomY*0.006);
      },
      onComplete:()=>dog.destroy()});
  }

  function updateLevelDisplay(){
    const newLevel=calcLoveLevel(GameState.love);
    if(queueLevelText){
      queueLevelText.setText('Lv. '+newLevel);
      queueLevelText.setVisible(newLevel>=2);
      if(newLevel!==GameState.loveLevel && newLevel>=2){
        const sp=queueLevelText.scene.add.text(queueLevelText.x,queueLevelText.y,'✨',
            {font:'18px sans-serif',fill:'#000'})
          .setOrigin(0.5).setDepth(queueLevelText.depth+1);
        queueLevelText.scene.tweens.add({targets:sp,y:queueLevelText.y-20,alpha:0,
            duration:dur(600),onComplete:()=>sp.destroy()});
      }
    }
    GameState.loveLevel=newLevel;
      if(GameState.girlReady && queueLevelText && queueLevelText.scene){
        lureNextWanderer(queueLevelText.scene);
      }
  }

  function scheduleNextSpawn(scene){
    if(GameState.falconActive) return;
    if (GameState.spawnTimer) {
      GameState.spawnTimer.remove(false);
    }
    const needed = queueLimit() - (GameState.queue.length + GameState.wanderers.length);
    let delay;
    if(needed > 0){
      delay = 500;
    }else{
      delay = SPAWN_DELAY + Phaser.Math.Between(0, SPAWN_VARIANCE);
    }
    // use real-time delay to ensure customers never spawn too quickly,
    // regardless of game speed adjustments
    GameState.spawnTimer = scene.time.delayedCall(delay, spawnCustomer, [], scene);
  }

  function showSideC(){
    if(sideCText) return;
    const y=this.scale.height*0.15;
    const x=this.scale.width*0.67;
    sideCText=this.add.text(x,y,'Side C',
        {font:'bold 64px serif',fill:'#002a8a'})
      .setOrigin(0.5)
      .setDepth(4)
      .setAlpha(0);
  }

  function updateSideC(){
    if(GameState.servedCount<6) return;
    showSideC.call(this);
    const target=Math.min(1,(GameState.servedCount-5)*0.1);
    if(target<=sideCAlpha) return;
    if(sideCFadeTween){ sideCFadeTween.stop(); }
    let duration=2000;
    if(target>0.5) duration=1000;
    sideCFadeTween=this.tweens.add({targets:sideCText,alpha:target,duration:duration});
    sideCAlpha=target;
    if(sideCAlpha>=1){
      sideCFadeTween=this.tweens.add({targets:sideCText,alpha:0,duration:20000,
        onComplete:()=>{ sideCText.destroy(); sideCText=null; sideCFadeTween=null; sideCAlpha=0; }});
    }
  }


  function showStartScreen(scene){
    scene = scene || this;
    if (typeof debugLog === 'function') debugLog('showStartScreen called');
    // clean up any remnants from a previous start screen
    if(startButton){ startButton.destroy(); startButton = null; }
    if(typeof phoneContainer !== 'undefined' && phoneContainer){
      phoneContainer.destroy();
      phoneContainer = null;
    }
    if(startOverlay){ startOverlay.destroy(); startOverlay = null; }
    // reset any pending timers or bubbles from a previous session
    startMsgTimers.forEach(t => t.remove(false));
    startMsgTimers = [];
    startMsgBubbles.forEach(b => b.destroy());
    startMsgBubbles = [];
    // Increase opacity of the start screen overlay for a darker background
    startOverlay = scene.add.rectangle(240,320,480,640,0x000000,0.75)
      .setDepth(14);

    const phoneW = (typeof START_PHONE_W === 'number') ? START_PHONE_W : 260;
    const phoneH = (typeof START_PHONE_H === 'number') ? START_PHONE_H : 500;
    const caseG = scene.add.graphics();
    caseG.fillStyle(0x5c3b2a,1);
    caseG.fillRoundedRect(-phoneW/2-10,-phoneH/2-10,phoneW+20,phoneH+20,40);
    const blackG = scene.add.graphics();
    blackG.fillStyle(0x000000,1);
    blackG.fillRoundedRect(-phoneW/2,-phoneH/2,phoneW,phoneH,30);
    const whiteG = scene.add.graphics();
    whiteG.fillStyle(0xffffff,1);
    whiteG.fillRoundedRect(-phoneW/2+6,-phoneH/2+6,phoneW-12,phoneH-12,24);
    const homeH = 100;
    const homeG = scene.add.graphics();
    homeG.fillStyle(0xf0f0f0,1);
    homeG.fillRoundedRect(-phoneW/2+12,phoneH/2-homeH-12,phoneW-24,homeH,20);

    const btnLabel = scene.add.text(0,0,'Clock In',{
        font:'32px sans-serif',fill:'#fff'})
      .setOrigin(0.5);
    const bw = btnLabel.width + 60;
    const bh = btnLabel.height + 20;
    const btnBg = scene.add.graphics();
    btnBg.fillStyle(0x007bff,1);
    btnBg.fillRoundedRect(-bw/2,-bh/2,bw,bh,15);
    const offsetY = phoneH/2 - homeH/2 - 12;
    // position the phone closer to the center of the screen
    const containerY = 320;
    phoneContainer = scene.add.container(240,containerY,[caseG,blackG,whiteG,homeG])
      .setDepth(15);

    startButton = scene.add.container(0,offsetY,[btnBg,btnLabel])
      .setSize(bw,bh)
      .setInteractive({ useHandCursor: true });

    const startZone = scene.add.zone(0,0,bw,bh).setOrigin(0.5);
    startZone.setInteractive({ useHandCursor:true });
    startButton.add(startZone);

    phoneContainer.add(startButton);

    // track where to place the first start message
    let startMsgY = -phoneH/2 + 20;

    const addStartMessage=(text)=>{
      if(!phoneContainer) return;
      const pad = 10;
      const wrapWidth = phoneW - 60;
      const txt = scene.add.text(0,0,text,{font:'20px sans-serif',fill:'#fff',wordWrap:{width:wrapWidth}})
        .setOrigin(0,0.5);
      const bw = txt.width + pad*2;
      const bh = txt.height + pad*2;
      const bg = scene.add.graphics();
      bg.fillStyle(0x8bd48b,1);
      bg.fillRoundedRect(-bw/2,-bh/2,bw,bh,10);
      txt.setPosition(-bw/2 + pad, 0);
      const xPos = -phoneW/2 + bw/2 + 20;
      const yPos = startMsgY + bh/2;
      const bubble = scene.add.container(xPos,yPos,[bg,txt]).setDepth(16).setAlpha(0);
      phoneContainer.add(bubble);
      startMsgBubbles.push(bubble);
      startMsgY += bh + 10;
      scene.tweens.add({targets:bubble,alpha:1,duration:300,ease:'Cubic.easeOut'});
    };

      if(scene.time && scene.time.delayedCall){
        const msgOptions=[
          ['u coming in? 🤔', 'where u at??', 'mornin ☀️'],
          ['better not still be in bed 😜', 'yo coffee girl ☕', 'stop ghostin me'],
          ['late night? 🥱💃', 'phone dead again? 🔋', 'omg wait till u hear about this guy 😏'],
          ['u good?', 'hope everythin\'s chill', '…sry 😬']
        ];
        let delay=0;
        for(const opts of msgOptions){
          delay += Phaser.Math.Between(5000,15000);
          const msg = Phaser.Utils.Array.GetRandom(opts);
          startMsgTimers.push(scene.time.delayedCall(delay,()=>addStartMessage(msg),[],scene));
        }
      }
      startZone.on('pointerdown',()=>{
        if (typeof debugLog === 'function') debugLog('start button clicked');
        startMsgTimers.forEach(t=>t.remove(false));
        startMsgTimers=[];
        startMsgBubbles=[];
        const tl=scene.tweens.createTimeline({callbackScope:scene,onComplete:()=>{
          if(startButton) startButton.destroy();
          if(startOverlay){startOverlay.destroy(); startOverlay=null;}
          phoneContainer.destroy(); phoneContainer=null;
          playIntro.call(scene);
        }});
        tl.add({targets:phoneContainer,y:-320,duration:600,ease:'Sine.easeIn'});
        tl.add({targets:startOverlay,alpha:0,duration:600},0);
        tl.play();
      });
  }

  function playIntro(scene){
    if(!truck || !girl) {
      if (DEBUG) console.warn('playIntro skipped: missing truck or girl');
      return;
    }
    if (typeof debugLog === 'function') debugLog('playIntro starting');
    scene = scene || this;
    if(!truck || !girl) return;
    GameState.girlReady = false;
    if(typeof debugLog==='function') debugLog('customers start spawning');
    scheduleNextSpawn(scene);
    const width = (scene.scale && scene.scale.width) ? scene.scale.width : 480;
    const offscreenX = width + 100;
    truck.setPosition(offscreenX,245).setScale(0.462);
    girl.setPosition(offscreenX,260).setVisible(false);
    // engine vibration while the truck is driving
    const vibrateAmp = { value: 2 * (truck.scaleX / 0.924) };
    const vibrateTween = (scene.tweens && scene.tweens.addCounter) ? scene.tweens.addCounter({
      from: 0,
      to: Math.PI * 2,
      duration: dur(100),
      repeat: -1,
      onUpdate: t => {
        const y = 245 + Math.sin(t.getValue()) * vibrateAmp.value;
        if (truck.setY) {
          truck.setY(y);
        } else {
          truck.y = y;
        }
      }
    }) : { stop: ()=>{} };
    if (scene.tweens && scene.tweens.add) {
      scene.tweens.add({
        targets: vibrateAmp,
        value: 0,
        duration: dur(600),
        delay: dur(900),
        ease: 'Sine.easeOut'
      });
    }

    // emit smoke puffs as the truck drives in
    let smokeDelay = 100; // start with a short delay for heavy exhaust
    let smokeEvent = { remove: ()=>{} };
    if (scene.time && scene.time.addEvent) {
      smokeEvent = scene.time.addEvent({
        delay: dur(smokeDelay),
        loop: true,
        callback: () => {
          const puff = scene.add.text(truck.x + 60, truck.y + 20, '💨', { font: '20px sans-serif', fill: '#fff' })
            .setDepth(1);
          if (scene.tweens && scene.tweens.add) {
            scene.tweens.add({
              targets: puff,
              x: puff.x + 30,
              y: puff.y - 10,
              alpha: 0,
              duration: dur(800),
              onComplete: () => puff.destroy()
            });
          } else {
            puff.destroy();
          }
          smokeDelay += 125; // space out puffs more quickly over time
          smokeEvent.delay = dur(smokeDelay);
        }
      });
      // end the exhaust a bit before the truck stops
      scene.time.delayedCall(dur(1300), () => smokeEvent.remove(), [], scene);
    }

    const intro=scene.tweens.createTimeline({callbackScope:scene});
    const hopOut=()=>{
      const startX=truck.x;
      const startY=260;
      const endX=200;
      const endY=292;
      const curve=new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(startX,startY),
        new Phaser.Math.Vector2(startX-20,startY-60),
        new Phaser.Math.Vector2(endX,endY)
      );
      const follower={t:0,vec:new Phaser.Math.Vector2()};
      scene.tweens.add({
        targets:follower,
        t:1,
        duration:dur(700),
        ease:'Sine.easeInOut',
        onStart:()=>girl.setVisible(true),
        onUpdate:()=>{
          curve.getPoint(follower.t,follower.vec);
          girl.setPosition(follower.vec.x,follower.vec.y);
        },
        onComplete:()=>{
          girl.setPosition(endX,endY);
          if(typeof debugLog==='function') debugLog('intro finished');
          GameState.girlReady = true;
          lureNextWanderer(scene);
        }
      });
    };
    intro.add({
      targets:truck,
      x:240,
      scale:0.924,
      duration:dur(1500),
      ease:'Sine.easeOut',
      onComplete:()=>{
        smokeEvent.remove();
        vibrateTween.stop();
        if(truck.setY){
          truck.setY(245);
        }else{
          truck.y=245;
        }
        pauseWanderersForTruck(scene);
        hopOut();
      }
    });
    intro.play();
  }

  function preload(){
    const loader=this.load;
    loader.on('loaderror', file=>{
      if (DEBUG) console.error('Asset failed to load:', file.key || file.src);
    });
    loader.image('bg','assets/bg.png');
    loader.image('truck','assets/truck.png');
    loader.image('girl','assets/coffeegirl.png');
    loader.spritesheet('lady_falcon','assets/lady_falcon.png',{frameWidth:64,frameHeight:64});
    loader.image('falcon_end','assets/ladyfalconend.png');
    loader.image('revolt_end','assets/revolt.png');
    for(const k of genzSprites){
      keys.push(k);
      requiredAssets.push(k);
      loader.image(k,`assets/genz/${k}.png`);
    }
  }

  function create(){
    this.assets = Assets;
    this.customers = Customers;
    const missing=requiredAssets.filter(key=>!this.textures.exists(key));
    if(missing.length){
      const msg='Missing assets: '+missing.join(', ');
      if (DEBUG) console.error(msg);
      this.add.text(240,320,msg,{font:'16px sans-serif',fill:'#f00',align:'center',wordWrap:{width:460}})
        .setOrigin(0.5).setDepth(30);
      const retry=this.add.text(240,360,'Retry Loading',{font:'20px sans-serif',fill:'#00f'})
        .setOrigin(0.5).setDepth(30);
      const retryZone=this.add.zone(240,360,retry.width,retry.height).setOrigin(0.5);
      retryZone.setInteractive({ useHandCursor:true });
      retryZone.on('pointerdown',()=>window.location.reload());
      return;
    }
    // background
    let bg=this.add.image(0,0,'bg').setOrigin(0).setDepth(0);
    bg.setDisplaySize(this.scale.width,this.scale.height);

    // HUD
    moneyText=this.add.text(20,20,'🪙 '+receipt(GameState.money),{font:'26px sans-serif',fill:'#fff'}).setDepth(1);
    loveText=this.add.text(20,50,'❤️ '+GameState.love,{font:'26px sans-serif',fill:'#fff'}).setDepth(1);
    // Display level indicator on the left side of the order table so it doesn't
    // overlap the price ticket.
    queueLevelText=this.add.text(156,316,'Lv. '+GameState.loveLevel,{font:'16px sans-serif',fill:'#000'})
      .setOrigin(0.5).setDepth(1);
    updateLevelDisplay();
    // truck & girl
    const startX=this.scale.width+100;
    truck=this.add.image(startX,245,'truck').setScale(0.462).setDepth(2);

    girl=this.add.image(startX,260,'girl').setScale(0.5).setDepth(3).setVisible(false);

    // create lady falcon animation
    this.anims.create({
      key:'falcon_fly',
      frames:this.anims.generateFrameNumbers('lady_falcon',{start:0,end:1}),
      frameRate:6,
      repeat:-1
    });

    // dialog
    dialogBg=this.add.graphics()
      .setVisible(false)
      .setDepth(10);
    dialogBg.x=240;
    dialogBg.y=DIALOG_Y; // raise bubble slightly
    dialogBg.width=360; // starting size, adjusted later
    dialogBg.height=120;

    dialogPriceBox=this.add.rectangle(0,0,120,80,0xffeeb5)
      .setStrokeStyle(2,0x000)
      .setOrigin(0.5);

    dialogPriceLabel=this.add.text(0,-15,'',{font:'14px sans-serif',fill:'#000',align:'center'})
      .setOrigin(0.5);
    dialogPriceValue=this.add.text(0,15,'',{font:'32px sans-serif',fill:'#000'})
      .setOrigin(0.5);
    dialogDrinkEmoji=this.add.text(-30,-20,'',{font:'24px sans-serif'})
      .setOrigin(0.5);

    dialogPriceContainer=this.add.container(0,0,[dialogPriceBox, dialogDrinkEmoji, dialogPriceLabel, dialogPriceValue])
      .setDepth(11)
      .setVisible(false);

    dialogText=this.add.text(240,410,'',{font:'20px sans-serif',fill:'#000',align:'center'})
                     .setOrigin(0,0.5).setVisible(false).setDepth(11);
    dialogCoins=this.add.text(240,440,'',{font:'20px sans-serif',fill:'#000'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);

    // price label/value are part of dialogPriceContainer and should not
    // also be drawn inside the main dialog. Remove the duplicate texts that
    // caused the total cost to appear in the dialog bubble.


    // helper to create a rounded rectangle button with consistent sizing
    const createButton=(x,label,iconChar,iconSize,color,handler)=>{
      const width=BUTTON_WIDTH, height=BUTTON_HEIGHT, radius=8;
      const g=this.add.graphics();
      // Graphics objects do not support setShadow. Draw a simple shadow
      // manually by rendering a darker rect slightly offset behind the button.
      g.fillStyle(0x000000,0.3);
      g.fillRoundedRect(-width/2+2,-height/2+2,width,height,radius);

      g.fillStyle(color,1);
      g.fillRoundedRect(-width/2,-height/2,width,height,radius);
      let t=this.add.text(-width/2+10,0,label,{font:'20px sans-serif',fill:'#fff'})
        .setOrigin(0,0.5);
      let icon=this.add.text(width/2-10,0,iconChar,{font:`${iconSize}px sans-serif`,fill:'#fff'})
        .setOrigin(1,0.5);
      let children=[g,t,icon];
      if(label==='REFUSE'){
        t.setFontSize(18);
        icon.setX(width/2-4);
        children=[g,icon,t];
      }
      // position the button slightly lower so it peeks out of the dialog box
      const c=this.add.container(x,BUTTON_Y,children)
        .setSize(width,height)
        .setDepth(12)
        .setVisible(false);

      const zone=this.add.zone(0,0,width,height).setOrigin(0.5);
      zone.setInteractive({ useHandCursor:true });
      zone.on('pointerdown',()=>blinkButton.call(this,c,handler,zone));
      c.add(zone);
      return c;
    };

    // buttons evenly spaced

    btnSell=createButton(80,'SELL','💵',32,0x006400,()=>handleAction.call(this,'sell'));
    // The "Give" button should stand out from the sell/refuse buttons. Use a
    // softer pastel pink so it is noticeable without being overwhelming.
    btnGive=createButton(240,'GIVE','💝',28,0xffb6c1,()=>handleAction.call(this,'give'));
    btnRef=createButton(400,'REFUSE','✋',32,0x800000,()=>handleAction.call(this,'refuse'));


    // sliding report texts
    reportLine1=this.add.text(480,moneyText.y,'',{font:'16px sans-serif',fill:'#fff'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);
    reportLine2=this.add.text(480,moneyText.y+20,'',{font:'16px sans-serif',fill:'#fff'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);
    reportLine3=this.add.text(480,loveText.y,'',{font:'16px sans-serif',fill:'#fff'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);
    tipText=this.add.text(0,0,'',{font:'bold 24px sans-serif',fill:'#0a0',stroke:'#0a0',strokeThickness:2})
      .setOrigin(0.5)
      .setDepth(12)
      .setVisible(false)
      .setAlpha(1);
    paidStamp=this.add.text(0,0,'PAID',{
        font:'bold 32px sans-serif',
        fill:'#0a0',
        stroke:'#0a0',
        strokeThickness:2
      })
      .setOrigin(0.5)
      .setDepth(12)
      .setVisible(false)
      .setAlpha(1);
    lossStamp=this.add.text(0,0,'LOSS',{
        font:'bold 32px sans-serif',
        fill:'#a00',
        stroke:'#a00',
        strokeThickness:2
      })
      .setOrigin(0.5)
      .setDepth(12)
      .setVisible(false)
      .setAlpha(1);

    // wait for player to start the shift
    showStartScreen.call(this);

    // ensure customer sprites match vertical scale and keep drink emoji attached
    this.events.on('update', () => {
      enforceCustomerScaling();
      updateDrinkEmojiPosition();
    });
  }

  function spawnCustomer(){
    if (typeof debugLog === 'function') {
      debugLog('spawnCustomer', GameState.queue.length, GameState.wanderers.length, GameState.activeCustomer);
    }
    if(GameState.gameOver) return;
    const createOrder=()=>{
      const coins=Phaser.Math.Between(0,20);
      const item=Phaser.Utils.Array.GetRandom(MENU);
      const qty=1; // single drink for every customer
      return {coins, req:item.name, price:item.price, qty};
    };

    const c={ orders:[] };
    const k=Phaser.Utils.Array.GetRandom(keys);
    c.spriteKey = k;
    const memory = GameState.customerMemory[k] || { state: 'normal' };
    GameState.customerMemory[k] = memory;
    c.memory = memory;
    const order=createOrder();

    if(GameState.wanderers.length>=maxWanderers()){
      scheduleNextSpawn(this);
      return;
    }
    const dir=Phaser.Math.Between(0,1)?1:-1;
    const startX=dir===1?-40:520;
    const targetX=dir===1?520:-40;
    c.dir = dir;
    const startY=Phaser.Math.Between(WANDER_TOP,WANDER_BOTTOM);
    const distScale=scaleForY(startY);
    c.orders.push(order);
    c.atOrder=false;
    c.sprite=this.add.sprite(startX,startY,k).setScale(distScale);
    const bottomYStart = startY + c.sprite.displayHeight * (1 - c.sprite.originY);
    c.sprite.setDepth(5 + bottomYStart*0.006);
    if(c.memory.state !== 'normal'){
      c.heartEmoji = this.add.text(0,0,HEART_EMOJIS[c.memory.state]||'',{font:'24px sans-serif'})
        .setOrigin(0.5);
    }

    // occasionally spawn a dog to accompany the wanderer
    if(Phaser.Math.Between(0,4)===0){
      const side=Phaser.Math.Between(0,1)?1:-1;
      const offsetX=side*Phaser.Math.Between(20,30);
      const offsetY=Phaser.Math.Between(10,20);
      const dogType=Phaser.Utils.Array.GetRandom(DOG_TYPES);
      const dog=this.add.text(startX+offsetX,startY+offsetY,dogType.emoji,{font:'32px sans-serif'})
        .setOrigin(0.5)
        .setScale(distScale*0.5)
        .setDepth(3);
      dog.dir=1;
      dog.prevX=dog.x;
      dog.dogType=dogType.type;
      c.dog=dog;

      dog.followEvent=this.time.addEvent({
        delay:dur(Phaser.Math.Between(800,1200)),
        loop:true,
        callback:()=>{updateDog.call(this,c);}
      });
    }
    const amp = Phaser.Math.Between(15, 30);
    const freq = Phaser.Math.FloatBetween(1.5, 4.5);
    const walkDuration = Phaser.Math.Between(5000, 7000);
    c.walkData = {startX, startY, targetX, amp, freq, duration: walkDuration};
    c.walkTween = this.tweens.add({targets:c.sprite,x:targetX,duration:dur(walkDuration),onUpdate:(tw,t)=>{
        const p=tw.progress;
        t.y=startY+Math.sin(p*Math.PI*freq)*amp;
        t.setScale(scaleForY(t.y));
      },onComplete:()=>{
        const idx=GameState.wanderers.indexOf(c);
        if(idx>=0) GameState.wanderers.splice(idx,1);
        const ex=c.sprite.x, ey=c.sprite.y;
        if(c.dog){
          sendDogOffscreen.call(this,c.dog,ex,ey);
          c.dog=null;
        }
        if(c.heartEmoji){ c.heartEmoji.destroy(); c.heartEmoji = null; }
        c.sprite.destroy();

      }});

    GameState.wanderers.push(c);
    if(GameState.girlReady && GameState.queue.length < queueLimit()){
      lureNextWanderer(this);
    }
    scheduleNextSpawn(this);
    if(this.time && this.time.delayedCall){
      this.time.delayedCall(1000, ()=>{
        if(GameState.girlReady && GameState.queue.length < queueLimit() && GameState.wanderers.includes(c)){
          lureNextWanderer(this);
        }else if(!GameState.girlReady){
          // wait again if intro not done
          this.time.delayedCall(1000, () => {
            if(GameState.girlReady && GameState.queue.length < queueLimit() && GameState.wanderers.includes(c)){
              lureNextWanderer(this);
            }
          }, [], this);
        }
      }, [], this);
    }

  }

  function resumeWanderer(scene, c){
    if(!c || !c.sprite || !c.walkData) return;
    const {targetX,startX,startY,amp,freq,duration} = c.walkData;
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
      onComplete:()=>{
        const idx=GameState.wanderers.indexOf(c);
        if(idx>=0) GameState.wanderers.splice(idx,1);
        const ex=c.sprite.x, ey=c.sprite.y;
        if(c.dog){
          sendDogOffscreen.call(scene,c.dog,ex,ey);
          c.dog=null;
        }
        if(c.heartEmoji){ c.heartEmoji.destroy(); c.heartEmoji = null; }
        c.sprite.destroy();

      }
    });
  }

  function pauseWanderersForTruck(scene){
    const threshold = 60;
    GameState.wanderers.slice().forEach(c => {
      if(!c.sprite) return;
      if(Math.abs(c.sprite.x - truck.x) < threshold){
        if(c.walkTween){
          c.walkTween.stop();
          c.walkTween.remove();
          c.walkTween=null;
        }
        scene.tweens.add({targets:c.sprite,y:'-=20',duration:dur(150),yoyo:true});
        scene.time.delayedCall(dur(1000),()=>{
          if(GameState.girlReady && GameState.queue.length < queueLimit() && GameState.wanderers.includes(c)){
            lureNextWanderer(scene, c);
          }else{
            resumeWanderer(scene, c);
          }
        },[],scene);
      }
    });
  }

  function drawDialogBubble(targetX, targetY, fillColor=0xffffff){
    if(!dialogBg) return;
    const w=dialogBg.width, h=dialogBg.height;
    dialogBg.clear();
    dialogBg.fillStyle(fillColor,1);
    dialogBg.lineStyle(2,0x000,1);
    dialogBg.fillRoundedRect(-w/2,-h/2,w,h,24); // rounder corners
    dialogBg.strokeRoundedRect(-w/2,-h/2,w,h,24);
    if (targetX !== undefined && targetY !== undefined) {
      const tx = targetX - dialogBg.x;
      const ty = targetY - dialogBg.y;
      const bx1 = -10;
      const bx2 = 10;
      const by = -h / 2;
      const tipX = tx * 0.5;
      const tipY = by + (ty - by) * 0.5;
      dialogBg.fillTriangle(bx1, by + 1, bx2, by + 1, tipX, tipY);
      dialogBg.beginPath();
      dialogBg.moveTo(tipX, tipY);
      dialogBg.lineTo(bx1, by + 1);
      dialogBg.moveTo(tipX, tipY);
      dialogBg.lineTo(bx2, by + 1);
      dialogBg.strokePath();
    }
  }

  function resetPriceBox(){
    if(!dialogPriceBox) return;
    if(dialogPriceBox.setFillStyle){
      dialogPriceBox.setFillStyle(0xffeeb5,1);
    } else if(dialogPriceBox.fillStyle){
      dialogPriceBox.fillStyle(0xffeeb5,1);
    }
    if(dialogPriceBox.setStrokeStyle){
      dialogPriceBox.setStrokeStyle(2,0x000000);
    }
    dialogPriceBox.fillAlpha = 1;
  }

  function showDialog(){
    if (typeof debugLog === 'function') {
      debugLog('showDialog start', GameState.queue.length, GameState.wanderers.length, GameState.activeCustomer);
    }
    const missingElems = [];
    if (!dialogBg) missingElems.push('dialogBg');
    if (!dialogText) missingElems.push('dialogText');
    if (!dialogCoins) missingElems.push('dialogCoins');
    if (!dialogPriceLabel) missingElems.push('dialogPriceLabel');
    if (!dialogPriceValue) missingElems.push('dialogPriceValue');
    if (!btnSell) missingElems.push('btnSell');
    if (!btnGive) missingElems.push('btnGive');
    if (!btnRef) missingElems.push('btnRef');
    if (missingElems.length){
      if (typeof debugLog === 'function') {
        debugLog('showDialog early exit, missing:', missingElems.join(', '));
      }
      if (DEBUG) {
        console.warn(`showDialog skipped: missing ${missingElems.join(', ')}`);
      }
      return;
    }
    if(dialogPriceBox) dialogPriceBox.fillAlpha = 1;
    // reset the dialog position in case previous animations moved it
    dialogBg.y = typeof DIALOG_Y === 'number' ? DIALOG_Y : 430;
    dialogBg.setAlpha(1);
    dialogText.setAlpha(1);
    dialogCoins.setAlpha(1);
    GameState.activeCustomer=GameState.queue[0]||null;
    if(!GameState.activeCustomer) return;
    const c=GameState.activeCustomer;
    if(!c.atOrder && (c.sprite.y!==ORDER_Y || c.sprite.x!==ORDER_X)){
      c.atOrder=true;
      const dist = Phaser.Math.Distance.Between(c.sprite.x, c.sprite.y, ORDER_X, ORDER_Y);
      const duration = dur(Math.max(DART_MIN_DURATION, (dist / DART_MAX_SPEED) * 1000));
      this.tweens.add({
        targets: c.sprite,
        x: ORDER_X,
        y: ORDER_Y,
        scale: scaleForY(ORDER_Y),
        duration,
        onComplete: ()=>{ showDialog.call(this); }
      });
      return;
    }
    const itemStr=c.orders.map(o=>{
      return o.qty>1 ? `${o.qty} ${o.req}` : o.req;
    }).join(' and ');
    const wantLine=(c.orders.length===1 && c.orders[0].qty===1)
      ? `I want ${articleFor(c.orders[0].req)} ${c.orders[0].req}`
      : `I want ${itemStr}`;


    dialogText
      .setOrigin(0.5)
      .setStyle({fontSize:'24px'})
      .setText(wantLine)
      .setVisible(true);

    const totalCost=c.orders.reduce((s,o)=>s+o.price*o.qty,0);
    const canAfford = c.orders[0].coins >= totalCost;
    let coinLine;
    if (canAfford) {
      coinLine = `I have $${c.orders[0].coins}`;
    } else if (c.orders[0].coins === 0) {
      const options = ['...but I have nothing', "...I'm poor", "I don't have money"];
      coinLine = Phaser.Utils.Array.GetRandom(options);
    } else {
      coinLine = `...but I only have $${c.orders[0].coins}`;
    }
    dialogCoins
      .setOrigin(0.5)
      .setStyle({fontSize:'24px'})
      .setText(coinLine)
      .setVisible(true);

    const maxW=Math.max(dialogText.width, dialogCoins.width);
    const hMargin = 20;
    const vMargin = 15;
    const lineGap = 10;
    dialogBg.width = Math.max(maxW + hMargin * 2, 160);
    dialogBg.height = dialogText.height + dialogCoins.height + lineGap + vMargin * 2;

    const bubbleTop=dialogBg.y - dialogBg.height/2;
    const textY=bubbleTop + vMargin + dialogText.height/2;
    dialogText.setPosition(dialogBg.x, textY);
    dialogCoins.setPosition(
      dialogBg.x,
      textY + dialogText.height/2 + lineGap + dialogCoins.height/2
    );

    dialogBg.setScale(0).setVisible(true);
    dialogText.setScale(0);
    dialogCoins.setScale(0);
    // use a static bubble color to avoid expensive image analysis
    let bubbleColor = 0xffffff;
    drawDialogBubble(c.sprite.x, c.sprite.y, bubbleColor);

    const priceTargetXDefault = dialogBg.x + dialogBg.width/2 - 40;
    const priceTargetY = dialogBg.y - dialogBg.height;
    const ticketW = dialogPriceBox.width;
    const ticketOffset = ticketW/2 + 10;
    const girlRight = (typeof girl !== 'undefined' && girl) ?
      girl.x + girl.displayWidth/2 : dialogBg.x;
    const minX = girlRight + ticketOffset;
    const priceTargetX = Math.max(priceTargetXDefault, minX);
    const startX = (typeof girl !== 'undefined' && girl) ? girl.x : dialogBg.x;
    const startY = (typeof girl !== 'undefined' && girl) ? girl.y - 20 : dialogBg.y;
    dialogPriceContainer
      .setPosition(startX, startY)
      .setScale(0.2)
      .setVisible(false);
    if (dialogDrinkEmoji.parentContainer !== dialogPriceContainer) {
      dialogPriceContainer.add(dialogDrinkEmoji);
    }
    dialogDrinkEmoji.attachedTo = null;
    resetPriceBox();
    dialogPriceContainer.alpha = 1;
    dialogPriceLabel
      .setStyle({fontSize:'14px'})
      .setText('Total Cost')
      .setOrigin(1,0)
      .setPosition(dialogPriceBox.width/2-5, -dialogPriceBox.height/2+5);
    dialogPriceValue
      .setStyle({fontSize:'32px'})
      .setText(`$${totalCost.toFixed(2)}`)
      .setColor('#000')
      .setOrigin(0.5)
      .setPosition(0, 15)
      .setScale(1)
      .setAlpha(1);
    dialogDrinkEmoji
      .setText(emojiFor(c.orders[0].req))
      .setPosition(-dialogPriceBox.width/2+23,-dialogPriceBox.height/2+23)
      .setScale(1.2)
      .setVisible(true);

    this.tweens.add({
      targets:[dialogBg, dialogText, dialogCoins],
      scale:1,
      ease:'Back.easeOut',
      duration:dur(300),
      onComplete:()=>{
        const showPrice=()=>{
          dialogPriceContainer.setVisible(true);
          this.tweens.add({
            targets:dialogPriceContainer,
            x:priceTargetX,
            y:priceTargetY,
            scale:1,
            duration:dur(300),
            ease:'Sine.easeOut',
            onComplete:()=>{
              if (typeof fadeInButtons === 'function') {
                fadeInButtons.call(this, canAfford);
              } else {
                if (canAfford) {
                  btnSell.setVisible(true);
                  if (btnSell.input) btnSell.input.enabled = true;
                } else {
                  btnSell.setVisible(false);
                  if (btnSell.input) btnSell.input.enabled = false;
                }
                btnGive.setVisible(true);
                if (btnGive.input) btnGive.input.enabled = true;
                if (btnRef.input) btnRef.input.enabled = true;
              }
            }
          });
        };
        if(this.time && this.time.delayedCall){
          this.time.delayedCall(dur(250), showPrice, [], this);
        }else{
          showPrice();
        }
      }
    });

    tipText.setVisible(false);
    if (typeof debugLog === 'function') debugLog('showDialog end');
  }

  function clearDialog(keepPrice=false){
    if(!keepPrice){
      dialogBg.setVisible(false);
      dialogText.setVisible(false);
      dialogCoins.setVisible(false);
      dialogPriceContainer.setVisible(false);
      dialogPriceValue.setColor('#000');
    }else{
      dialogBg.setVisible(true);
      dialogText.setVisible(false);
      dialogCoins.setVisible(false);
      dialogPriceContainer.setVisible(true);
    }
    const flinging = this.tweens && this.tweens.isTweening && this.tweens.isTweening(dialogDrinkEmoji);
    if (!flinging && !dialogDrinkEmoji.attachedTo &&
        dialogDrinkEmoji.parentContainer !== dialogPriceContainer) {
      dialogPriceContainer.add(dialogDrinkEmoji);
    }
    // Keep the drink emoji visible when the price ticket remains on screen
    if(!keepPrice){
      dialogDrinkEmoji.setVisible(false);
    }else{
      dialogDrinkEmoji.setVisible(true);
    }
    resetPriceBox();
    btnSell.setVisible(false);
    if (btnSell.input) btnSell.input.enabled = false;
    btnGive.setVisible(false);
    if (btnGive.input) btnGive.input.enabled = false;
    btnRef.setVisible(false);
    if (btnRef.input) btnRef.input.enabled = false;
    tipText.setVisible(false);

  }

  function handleAction(type){
    const current=GameState.activeCustomer;
    if ((type==='sell' || type==='give') && dialogDrinkEmoji && dialogPriceContainer && dialogPriceContainer.visible) {
      dialogDrinkEmoji.clearTint();
    }
    if(current){
      const bubbleObjs=[];
      if(typeof dialogBg!=='undefined') bubbleObjs.push(dialogBg);
      if(typeof dialogText!=='undefined') bubbleObjs.push(dialogText);
      if(typeof dialogCoins!=='undefined') bubbleObjs.push(dialogCoins);
      const ticket = typeof dialogPriceContainer!=='undefined' ? dialogPriceContainer : null;
      if(this.tweens && (bubbleObjs.length || ticket)){
        if(type==='refuse'){
          if(dialogBg.setTint) dialogBg.setTint(0xff0000);
          if(dialogText.setColor) dialogText.setColor('#f00');
          if(dialogCoins.setColor) dialogCoins.setColor('#f00');
          if(ticket){
            this.tweens.add({targets:ticket, x:520, alpha:0,
                            duration:dur(300), ease:'Cubic.easeIn'});
          }
          // Move each dialog element downward together rather than
          // converging on a single absolute Y position.
          this.tweens.add({targets:bubbleObjs, y:'+=80', scale:1.5, alpha:0,
                          duration:dur(300), ease:'Cubic.easeIn', onComplete:()=>{
            if(dialogBg.clearTint) dialogBg.clearTint();
            if(dialogText.setColor) dialogText.setColor('#000');
            if(dialogCoins.setColor) dialogCoins.setColor('#000');
            clearDialog.call(this, false);
          }});
        } else {
          // Only animate the dialog bubble away. Leave the price ticket
          // visible so it can fly over to the score area.
          this.tweens.add({targets:bubbleObjs, y:current.sprite.y, scale:0, duration:dur(200), onComplete:()=>{
            clearDialog.call(this, true);
          }});
        }
      } else {
        clearDialog.call(this, type!=='refuse');
      }
    } else {
      clearDialog.call(this, type!=='refuse');
    }
    if(!current) return;
    const orderCount=current.orders.length;
    const totalCost=current.orders.reduce((s,o)=>s+o.price*o.qty,0);

    let mD=0, lD=0, tip=0;
    if(type==='sell'){
      lD=Phaser.Math.Between(0,2)*orderCount;
      tip=+(totalCost*0.15*lD).toFixed(2);
      const coins=current.orders[0].coins;
      const maxTip=Math.max(0, coins-totalCost);
      if(tip>maxTip) tip=+maxTip.toFixed(2);
      mD=totalCost+tip;
    } else if(type==='give'){
      lD=Phaser.Math.Between(2,4)*orderCount;
      mD=-totalCost;
    } else {
      lD=-Phaser.Math.Between(1,3)*orderCount;
    }

    const memory = current.memory || {state:'normal'};
    const baseL = lD;
    switch(memory.state){
      case 'broken':
        lD = Math.max(baseL - 1, 0);
        if(type==='sell') memory.state = 'mending';
        if(type==='give') memory.state = 'normal';
        break;
      case 'mending':
        if(type==='sell') memory.state = 'normal';
        break;
      case 'growing':
        lD = Math.max(baseL,1) + 1;
        if(type==='give') memory.state = 'sparkling';
        break;
      case 'sparkling':
        lD = Math.max(baseL,2) + 2;
        if(type==='give') memory.state = 'arrow';
        break;
      case 'arrow':
        lD = baseL + 3;
        if(type==='give') GameState.heartWin = HEART_EMOJIS.arrow;
        break;
      default:
        if(type==='give') memory.state = 'growing';
    }
    if(type==='refuse'){
      memory.state = 'broken';
    }
    if(current.heartEmoji){ current.heartEmoji.destroy(); current.heartEmoji=null; }
    if(memory.state !== 'normal' && current.sprite){
      current.heartEmoji = current.sprite.scene.add.text(0,0,HEART_EMOJIS[memory.state]||'',{font:'24px sans-serif'}).setOrigin(0.5);
    }

    const tipPct=type==='sell'?lD*15:0;
    const customer=current.sprite;
    GameState.activeCustomer=null;

    const finish=()=>{
      const exit=()=>{
        if(dialogDrinkEmoji && dialogDrinkEmoji.attachedTo === current.sprite){
          dialogDrinkEmoji.attachedTo = null;
          dialogDrinkEmoji.setVisible(false);
        }
        if(current.dog){
          if(typeof current.exitX==='number' && typeof current.exitY==='number'){
            sendDogOffscreen.call(this,current.dog,current.exitX,current.exitY);
          } else {
            if(current.dog.followEvent) current.dog.followEvent.remove(false);
            current.dog.destroy();
          }
        }
        if(current.heartEmoji){ current.heartEmoji.destroy(); current.heartEmoji = null; }
        current.sprite.destroy();
        if(GameState.money<=0){
          showFalconAttack.call(this,()=>{
            showEnd.call(this,'Game Over\nYou lost all the money.\nLady Falcon reclaims the coffee truck.');
          });
          return;
        }
        if(GameState.love<=0){
          showCustomerRevolt.call(this,()=>{
            showEnd.call(this,'Game Over\nThe Customers Revolt!\n(and they stole your truck)');
          });
          return;
        }
        if(GameState.money>=MAX_M){showEnd.call(this,'Congrats! 💰');return;}
        if(GameState.love>=MAX_L){showEnd.call(this,'Victory! ❤️');return;}
        if(GameState.heartWin){
          showEnd.call(this,'And you lived happily ever after.', GameState.heartWin);
          GameState.heartWin = null;
          return;
        }
        scheduleNextSpawn(this);
        GameState.servedCount++;
        updateSideC.call(this);
      };

      const sprite=current.sprite;
      const bottomY = sprite.y + sprite.displayHeight * (1 - sprite.originY);
      sprite.setDepth(5 + bottomY*0.006);

      // Shift queue forward as soon as customer starts to walk away
      GameState.queue.shift();
      moveQueueForward.call(this);

      if(type==='refuse'){
        const dir = sprite.x < girl.x ? -1 : 1;
        const startX = sprite.x;
        const targetY = 700;
        const distanceX = Phaser.Math.Between(80, 160) * dir;
        const amp = Phaser.Math.Between(10, 25);
        const freq = Phaser.Math.Between(2, 4);
        current.exitX = startX + distanceX;
        current.exitY = targetY;
        this.tweens.add({
          targets: sprite,
          y: targetY,
          duration: dur(WALK_OFF_BASE*1.2),
          callbackScope: this,
          onUpdate: (tw, t) => {
            const p = tw.progress;
            t.x = startX + p * distanceX + Math.sin(p * Math.PI * freq) * amp;
            t.setScale(scaleForY(t.y));
            if(current.heartEmoji){
              const hy = t.y + t.displayHeight * 0.25;
              const hs = scaleForY(t.y) * 0.6;
              current.heartEmoji.setPosition(t.x, hy).setScale(hs).setDepth(t.depth+1);
            }
          },
          onComplete: exit
        });
      }else{
        const dir = Phaser.Math.Between(0,1)?1:-1;
        const startX=sprite.x;
        const targetY=700;
        const distanceX=Phaser.Math.Between(80,160)*dir;
        const amp=Phaser.Math.Between(10,25);
        const freq=Phaser.Math.Between(2,4);
        current.exitX = startX + distanceX;
        current.exitY = targetY;
        this.tweens.add({targets:sprite,y:targetY,duration:dur(6000),callbackScope:this,
          onUpdate:(tw,t)=>{const p=tw.progress; t.x=startX+p*distanceX+Math.sin(p*Math.PI*freq)*amp; t.setScale(scaleForY(t.y));
            if(current.heartEmoji){
              const hy = t.y + t.displayHeight * 0.25;
              const hs = scaleForY(t.y) * 0.6;
              current.heartEmoji.setPosition(t.x, hy).setScale(hs).setDepth(t.depth+1);
            }
          },
          onComplete:exit});
      }
    };

    // animated report using timelines
    const midX=240, midY=120;

    let pending=(type!=='refuse'?1:0)+(lD!==0?1:0);
    const done=()=>{ if(--pending<=0) finish(); };

    if(type==='sell'){
      const ticket=dialogPriceContainer;
      const t=dialogPriceValue;
      const destX=moneyText.x+moneyText.width-15;
      const destY=moneyText.y+10;
      t.setVisible(true);
      // start below the stamp so the stamp appears on top first
      t.setDepth(paidStamp.depth-1);
      const baseLeft = t.x - t.displayWidth/2;
      t.setText(receipt(totalCost));
      t.setPosition(baseLeft + t.displayWidth/2, t.y);
      const ticketH = dialogPriceBox.height;
      const centerX = ticket.x;
      let stampY = ticket.y;
      if (tip > 0) {
        stampY -= ticketH * 0.2;
      }
      paidStamp
        .setText('PAID')
        .setScale(1.4 + Phaser.Math.FloatBetween(-0.1, 0.1))
        .setPosition(centerX + Phaser.Math.Between(-3,3), stampY + Phaser.Math.Between(-3,3))
        .setAngle(Phaser.Math.Between(-10,10))
        .setVisible(true);
      applyRandomSkew(paidStamp);
      // raise the price above the stamp after the stamp lands
      this.time.delayedCall(dur(300), () => {
        t.setDepth(paidStamp.depth + 1);
      }, [], this);
      t.setPosition(t.x, 15);

      const flashPrice=()=>{
        const oy=t.y;
        this.tweens.add({targets:t,y:oy-30,duration:dur(100),yoyo:true});
      };
      flashPrice();

      let delay=dur(300);
      if(tip>0){
        this.time.delayedCall(delay,()=>{
          const ticketH = dialogPriceBox.height;
          const tipX = ticket.x;
          const tipY = ticket.y + ticketH * 0.2;
          const oldLeft = t.x - t.displayWidth/2;
          tipText
            .setText('TIP')
            .setScale(1.3 + Phaser.Math.FloatBetween(-0.1, 0.1))
            .setPosition(tipX + Phaser.Math.Between(-3,3), tipY + Phaser.Math.Between(-3,3))
            .setAngle(Phaser.Math.Between(-15,15))
            .setVisible(true);
          applyRandomSkew(tipText);
          t.setText(receipt(totalCost + tip));
          t.setPosition(oldLeft + t.displayWidth/2, t.y);
          flashPrice();
        },[],this);
        delay+=dur(300);
      } else {
        tipText.setVisible(false);
      }
      delay+=dur(1000);
      this.time.delayedCall(delay,()=>{
        paidStamp.setVisible(false);
        tipText.setVisible(false);
        const tl=this.tweens.createTimeline({callbackScope:this,onComplete:()=>{
            clearDialog.call(this);
            ticket.setVisible(false);
            GameState.money=+(GameState.money+mD).toFixed(2);
            moneyText.setText('🪙 '+receipt(GameState.money));
            animateStatChange(moneyText, this, mD);
            done();
        }});
        tl.add({targets:ticket,x:destX,y:destY,scale:0,duration:dur(400),
          onStart:()=>{

            flashBorder(dialogPriceBox,this,0x00ff00);
            flashFill(dialogPriceBox,this,0x00ff00);
            if(this.tweens){

              this.tweens.add({targets:dialogPriceBox,fillAlpha:0,duration:dur(400)});
            }

            if(dialogDrinkEmoji){
              dialogDrinkEmoji.clearTint();
            }

          }});
        tl.play();
      },[],this);
    } else if(type==='give'){
      const ticket=dialogPriceContainer;
      const t=dialogPriceValue;
      const destX=moneyText.x+moneyText.width-15;
      const destY=moneyText.y+10;
      t.setVisible(true)
        // start below the stamp so the stamp animation appears on top
        .setDepth(lossStamp.depth-1);
      const stampX=ticket.x + Phaser.Math.Between(-5,5);
      const stampY=ticket.y + Phaser.Math.Between(-5,5);
      lossStamp
        .setText('LOSS')
        .setScale(1.4 + Phaser.Math.FloatBetween(-0.1, 0.1))
        .setPosition(stampX, stampY)
        .setAngle(Phaser.Math.Between(-10,10))
        .setVisible(true);
      applyRandomSkew(lossStamp);
      // raise the price above the stamp after the stamp lands
      this.time.delayedCall(dur(300), () => {
        t.setDepth(lossStamp.depth + 1);
      }, [], this);
      t.setPosition(t.x, 15);
      this.time.delayedCall(dur(1000),()=>{
        lossStamp.setVisible(false);
        dialogBg.setVisible(false);
        dialogText.setVisible(false);
        if(this.tweens){
          this.tweens.add({targets:ticket,x:'+=6',duration:dur(60),yoyo:true,repeat:2});
        }
        const tl=this.tweens.createTimeline({callbackScope:this,onComplete:()=>{
            clearDialog.call(this);
            ticket.setVisible(false);
            GameState.money=+(GameState.money+mD).toFixed(2);
            moneyText.setText('🪙 '+receipt(GameState.money));
            animateStatChange(moneyText, this, mD);
            done();
        }});
        if (typeof dialogPriceBox !== 'undefined' && dialogPriceBox) {
          flashBorder(dialogPriceBox,this,0xff0000);
          flashFill(dialogPriceBox,this,0xff0000);
        }
        tl.add({targets:ticket,x:destX,y:destY,scale:0,duration:dur(400),
          onStart:()=>{
            if(this.tweens && typeof dialogPriceBox !== 'undefined' && dialogPriceBox){
              this.tweens.add({targets:dialogPriceBox,fillAlpha:0,duration:dur(400)});
            }

            if(dialogDrinkEmoji){
              dialogDrinkEmoji.clearTint();
            }

          }});
        tl.play();
      },[],this);
    } else if(type!=='refuse'){
      const showTip=tip>0;
      const startRX = (typeof girl !== 'undefined' && girl) ? girl.x : customer.x;
      const startRY = (typeof girl !== 'undefined' && girl) ? girl.y : customer.y;
      reportLine1.setStyle({fill:'#fff'})
        .setText(`$${totalCost.toFixed(2)}`)
        .setPosition(startRX, startRY)
        .setScale(1)
        .setVisible(true);
      if(showTip){
        reportLine2.setText(`${receipt(tip)} ${tipPct}% TIP`)
          .setStyle({fontSize:'16px',fill:'#fff'})
          .setScale(1)
          .setPosition(startRX,startRY+24).setVisible(true);
      }else{
        reportLine2.setVisible(false);
      }
      reportLine3.setVisible(false).alpha=1;

      const destX=moneyText.x+moneyText.width-15;
      const destY=moneyText.y+10;
      const moving=[reportLine1];
      const tl=this.tweens.createTimeline({callbackScope:this,onComplete:()=>{
          reportLine1.setVisible(false).alpha=1;
          reportLine2.setVisible(false).alpha=1;
          reportLine3.setVisible(false).alpha=1;
          GameState.money=+(GameState.money+mD).toFixed(2);
          moneyText.setText('🪙 '+receipt(GameState.money));
          animateStatChange(moneyText, this, mD);
          done();
      }});
      tl.add({targets:reportLine1,x:midX,y:midY,duration:dur(300),onComplete:()=>{
            const word='PAID';
            const color='#8f8';
            reportLine1.setColor(color);
            if(showTip){
              reportLine2.setColor(color);
            }
            reportLine3.setText(word)
              .setStyle({fontSize:'20px'})
              .setColor(color)
              .setPosition(midX,midY)
              .setOrigin(0.5)
              .setAlpha(1)
              .setVisible(true);
            this.tweens.add({targets:reportLine3,alpha:0,duration:dur(600)});
        }});
      if(showTip){
        tl.add({targets:reportLine2,x:midX,y:midY+24,duration:dur(300)},0);
        moving.push(reportLine2);
      }

      flashMoney(reportLine1,this);
      if(showTip) flashMoney(reportLine2,this);

      tl.add({targets:moving,duration:dur(2000)});
      const endDelay = showTip ? 0 : dur(300);
      tl.add({targets:moving,x:destX,y:destY,scale:0,alpha:0,duration:dur(400),delay:endDelay});

      tl.play();
    }

    if(lD!==0){
      animateLoveChange.call(this,lD,customer,done);
    }
    if(pending===0) finish();
  }

  function animateLoveChange(delta, customer, cb){
    const count=Math.abs(delta);
    const emoji=delta>0?'❤️':'😠';

    if(delta<0){
      this.tweens.add({targets:customer,y:customer.y-20,duration:dur(150),yoyo:true});
    }

    const baseX=customer.x - 20*(count-1)/2;
    const baseY=customer.y + 40;

    const hearts=[];
    for(let i=0;i<count;i++){
      const h=this.add.text(customer.x,customer.y,emoji,{font:'24px sans-serif',fill:'#fff'})
        .setOrigin(0.5).setDepth(11);
      hearts.push(h);
      if (typeof addFloatingEmoji === 'function') {
        addFloatingEmoji(h);
      } else if (GameState && typeof GameState.addFloatingEmoji === 'function') {
        GameState.addFloatingEmoji(h);
      } else if (Array.isArray(floatingEmojis)) {
        floatingEmojis.push(h);
      }
      const targetX=baseX+i*20;
      // sparkle or anger flash
      if(delta>0){
        const sp=this.add.text(customer.x,customer.y,'✨',{font:'18px sans-serif',fill:'#fff'})
          .setOrigin(0.5).setDepth(10);
        this.tweens.add({targets:sp,scale:1.5,alpha:0,duration:dur(300),onComplete:()=>sp.destroy()});
      }else{
        const ang=this.add.text(customer.x,customer.y,'💢',{font:'20px sans-serif',fill:'#f00'})
          .setOrigin(0.5).setDepth(12);
        this.tweens.add({targets:ang,alpha:0,duration:dur(300),onComplete:()=>ang.destroy()});
      }
      this.tweens.add({targets:h,x:targetX,y:baseY,duration:dur(400),ease:'Cubic.easeOut'});
    }
    const destX = () => loveText.x + loveText.width + 6;
    const destY = () => loveText.y + loveText.height;

    const popOne=(idx)=>{
      if(idx>=hearts.length){
        if(cb) cb();
        return;
      }
      const h=hearts[idx];
      const tl=this.tweens.createTimeline({callbackScope:this});
      tl.add({
        targets:h,
        x:destX(),
        y:destY(),
        scaleX:0,
        scaleY:1.2,
        duration:dur(125),
        onComplete:()=>{
          GameState.love += delta>0?1:-1;
          loveText.setText('❤️ '+GameState.love);
          updateLevelDisplay();
          animateStatChange(loveText, this, delta>0?1:-1, true);
        }
      });
      tl.add({targets:h,scaleX:1,alpha:0,duration:dur(125),onComplete:()=>{
            if (typeof removeFloatingEmoji === 'function') {
              removeFloatingEmoji(h);
            } else if (GameState && typeof GameState.removeFloatingEmoji === 'function') {
              GameState.removeFloatingEmoji(h);
            } else if (Array.isArray(floatingEmojis)) {
              const i = floatingEmojis.indexOf(h);
              if (i !== -1) floatingEmojis.splice(i, 1);
            }
            h.destroy();
            popOne(idx+1);
        }});
      tl.play();
    };
    this.time.delayedCall(dur(400),()=>popOne(0),[],this);
  }

  function showFalconAttack(cb){
    if (GameState.falconActive) return;
    const scene=this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    hideOverlayTexts();
    clearDialog.call(scene);
    GameState.falconActive = true;
    GameState.gameOver = true;
    if (GameState.spawnTimer) { GameState.spawnTimer.remove(false); GameState.spawnTimer = null; }

    function panicCustomers(){
      const fleeing=[...GameState.queue, ...GameState.wanderers];
      if(GameState.activeCustomer && !fleeing.includes(GameState.activeCustomer)){
        fleeing.push(GameState.activeCustomer);
      }
      // include any stray customer sprites whose tweens were killed
      const known=new Set(fleeing.map(c=>c.sprite));
      scene.children.list.forEach(child=>{
        if(child.texture && keys.includes(child.texture.key) && !known.has(child)){
          fleeing.push({sprite:child});
          known.add(child);
        }
      });
      // remove any loose dogs not associated with a customer
      scene.children.list.forEach(child=>{
        if(child instanceof Phaser.GameObjects.Text &&
           DOG_TYPES.some(d=>d.emoji===child.text) &&
           !fleeing.some(c=>c.dog===child)){
          child.destroy();
        }
      });

      fleeing.forEach(c=>{
        if(c.walkTween){ c.walkTween.stop(); c.walkTween=null; }
        const dir=c.sprite.x<ORDER_X? -1:1;
        const targetX=dir===1?520:-40;
        const tl=scene.tweens.createTimeline();
        for(let i=0;i<3;i++){
          tl.add({targets:c.sprite,
                  x:Phaser.Math.Between(40,440),
                  y:Phaser.Math.Between(WANDER_TOP,WANDER_BOTTOM),
                  duration:dur(Phaser.Math.Between(200,400)),
                  ease:'Sine.easeInOut'});
        }
        tl.add({targets:c.sprite,
                x:targetX,
                duration:dur(WALK_OFF_BASE/1.5),
                onComplete:()=>{
                  const ex=c.sprite.x, ey=c.sprite.y;
                  if(c.dog){
                    sendDogOffscreen.call(scene,c.dog,ex,ey);
                    c.dog=null;
                  }
                  if(c.heartEmoji){ c.heartEmoji.destroy(); c.heartEmoji=null; }
                  c.sprite.destroy();
                }});
        tl.play();
      });
      // keep references so restartGame can properly clean up any remaining
      // sprites even if the tweens are interrupted
      // queue.length=0; wanderers.length=0; activeCustomer=null;
    }

    // send everyone scattering immediately in case a new spawn sneaks in
    panicCustomers();

    const falcon=scene.add.sprite(-40,-40,'lady_falcon',0)
      .setScale(1.4,1.68)
      .setDepth(20);
    falcon.anims.play('falcon_fly');
    const targetX=girl.x;
    const targetY=girl.y-40;
    scene.tweens.add({
      targets:falcon,
      x:targetX,
      y:targetY,
      duration:dur(900),
      ease:'Cubic.easeIn',
      onComplete:()=>{
        panicCustomers();
        blinkAngry(scene);
        const tl=scene.tweens.createTimeline({callbackScope:scene,onComplete:()=>{
            falcon.destroy();
            if(cb) cb();
        }});
        for(let i=0;i<5;i++){
          tl.add({targets:falcon,y:targetY+10,duration:dur(80),yoyo:true});
          tl.add({targets:girl,y:girl.y+5,duration:dur(80),yoyo:true,
                   onStart:()=>{ girl.setTint(0xff0000); sprinkleBursts(scene); },
                   onYoyo:()=>{ girl.setTint(0xff0000); sprinkleBursts(scene); },
                   onComplete:()=>girl.clearTint()},'<');
          const debris=createDebrisEmoji(scene, falcon.x, falcon.y);
          tl.add({targets:debris,
                  x:debris.x+Phaser.Math.Between(-60,60),
                  y:debris.y+Phaser.Math.Between(-50,10),
                  angle:Phaser.Math.Between(-180,180),
                  alpha:0,
                  duration:dur(400),
                  onComplete:()=>debris.destroy()},'<');
          scene.time.delayedCall(dur(450),()=>debris.destroy(),[],scene);
        }
        tl.play();
      }
    });

    function blinkAngry(s){
      s.tweens.add({targets:girl,duration:dur(100),repeat:2,yoyo:true,
        onStart:()=>girl.setTint(0xff0000),
        onYoyo:()=>girl.setTint(0xff0000),
        onRepeat:()=>girl.clearTint(),
        onComplete:()=>girl.clearTint()});
    }

    function sprinkleBursts(s){
      for(let b=0;b<3;b++){
        const bx=girl.x+Phaser.Math.Between(-20,20);
        const by=girl.y+Phaser.Math.Between(-40,0);
        const burst=s.add.text(bx,by,'💢',{font:'24px sans-serif',fill:'#f00'})
          .setOrigin(0.5).setDepth(21);
        s.tweens.add({targets:burst,scale:1.5,alpha:0,duration:dur(200),onComplete:()=>burst.destroy()});
      }
    }

    function createDebrisEmoji(s, x, y){
      const chars=['✨','💥','🪶'];
      const ch=chars[Phaser.Math.Between(0,chars.length-1)];
      return s.add.text(x,y,ch,{font:'24px sans-serif',fill:'#555'})
        .setOrigin(0.5).setDepth(21);
    }
  }

  function showCustomerRevolt(cb){
    const scene=this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    hideOverlayTexts();
    clearDialog.call(scene);
    if (GameState.spawnTimer) { GameState.spawnTimer.remove(false); GameState.spawnTimer = null; }
    const attackers=[];
    const gatherStartY = Math.max(WANDER_TOP, girl.y + 60);
    const gather=(arr)=>{
      arr.forEach(c=>{
        if(c.walkTween){ c.walkTween.stop(); c.walkTween=null; }
        if(c.dog){
          if(c.dog.followEvent) c.dog.followEvent.remove(false);
          c.dog.destroy();
          c.dog=null;
        }
        if(c.sprite){
          c.sprite.setDepth(20); // keep attackers above the girl
          if(c.sprite.y < gatherStartY){
            c.sprite.setPosition(c.sprite.x, gatherStartY);
            c.sprite.setScale(scaleForY(gatherStartY));
          }
          attackers.push(c.sprite);
        }
      });
    };
    gather(GameState.queue);
    gather(GameState.wanderers);
    if(GameState.activeCustomer){
      gather([GameState.activeCustomer]);
    }



    const loops=new Map();
    let hits=0;
    let finished=false;

    function blinkGirl(){
      scene.tweens.add({targets:girl,duration:dur(60),repeat:2,yoyo:true,x:'+=4',
        onStart:()=>girl.setTint(0xff0000),
        onYoyo:()=>girl.setTint(0xff0000),
        onRepeat:()=>girl.clearTint(),
        onComplete:()=>girl.clearTint()});
    }

      function sendDriver(driver){
        loops.forEach((ev,a)=>{
          if(ev) ev.remove(false);
          if(a!==driver){
            const dir = a.x < girl.x ? -1 : 1;
            const targetX = dir===1 ? 520 : -40;
            scene.tweens.add({
              targets:a,
              x:targetX,
              duration:dur(WALK_OFF_BASE/1.5),
              onComplete:()=>a.destroy()
            });
          }
        });
        scene.tweens.add({targets:driver,x:truck.x-40,y:truck.y,duration:dur(300),onComplete:()=>driver.destroy()});
        scene.tweens.add({targets:truck,x:-200,duration:dur(800),delay:dur(300),onComplete:()=>{if(cb) cb();}});
      }

    function attack(a){
      if(finished) return;
      scene.tweens.add({
        targets:a,
        x:girl.x+Phaser.Math.Between(-5,5),
        y:girl.y+Phaser.Math.Between(-5,5),
        scale:scaleForY(girl.y),
        duration:dur(80),
        yoyo:true,
        onComplete:()=>{
          if(finished) return;
          hits++;
          blinkGirl();
          if(hits>=10){
            finished=true;
            sendDriver(a);
          } else {
            loops.set(a, scene.time.delayedCall(dur(Phaser.Math.Between(200,400)),()=>attack(a),[],scene));
          }
        }
      });
    }

    attackers.forEach(a=>{
      const tx = Phaser.Math.Between(girl.x - 30, girl.x + 30);
      const ty = Math.max(gatherStartY, girl.y + 20);
      scene.tweens.add({
        targets:a,
        x:tx,
        y:ty,
        scale:scaleForY(ty),
        duration:dur(400),
        onComplete:()=>{
          loops.set(a, scene.time.delayedCall(dur(Phaser.Math.Between(100,300)),()=>attack(a),[],scene));
        }
      });
    });
  }

  function showEnd(msg, bigEmoji){
    const scene=this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    hideOverlayTexts();
    if (GameState.spawnTimer) { GameState.spawnTimer.remove(false); GameState.spawnTimer=null; }
    clearDialog.call(scene);
    if(endOverlay){ endOverlay.destroy(); }
    endOverlay=this.add.rectangle(240,320,480,640,0x000000).setDepth(19);
    let bgY=360;
    let img=null;
    if(/lady falcon reclaims the coffee truck/i.test(msg)){
      img=this.add.image(240,200,'falcon_end').setScale(1.2).setDepth(20);
      bgY=480;
    } else if(/customer.*revolt/i.test(msg)){
      img=this.add.image(240,200,'revolt_end').setScale(1.2).setDepth(20);
      bgY=480;
    }
    const bg=this.add.rectangle(240,bgY,480,240,0xffffff).setStrokeStyle(2,0x000).setDepth(20);
    if(bigEmoji){
      this.add.text(240,bgY-80,bigEmoji,{font:'72px sans-serif'}).setOrigin(0.5).setDepth(21);
    }
    const lines=msg.split('\n');
    let offset=bgY-40;
    let titleText=null;
    let startIdx=0;
    if(lines[0].toLowerCase().startsWith('game over')){
      titleText=this.add.text(240,offset,lines[0].toUpperCase(),{
        font:'48px sans-serif',fill:'#f00',stroke:'#000',strokeThickness:4
      }).setOrigin(0.5).setDepth(21);
      startIdx=1;
      offset+=60;
    }
    const txt=this.add.text(240,offset,lines.slice(startIdx).join('\n'),{font:'24px sans-serif',fill:'#000',align:'center',wordWrap:{width:440}})
      .setOrigin(0.5).setDepth(21);
    const btn=this.add.text(240,bgY+80,'Try Again',{font:'20px sans-serif',fill:'#fff',backgroundColor:'#006400',padding:{x:14,y:8}})
      .setOrigin(0.5).setDepth(22);
    const againZone=this.add.zone(240,bgY+80,btn.width,btn.height).setOrigin(0.5);
    againZone.setInteractive({ useHandCursor:true });
    againZone.on('pointerdown',()=>{
        bg.destroy(); txt.destroy(); btn.destroy(); if(titleText) titleText.destroy(); if(img) img.destroy();
        if(endOverlay){ endOverlay.destroy(); endOverlay=null; }
        restartGame.call(this);
      });
    GameState.gameOver=true;
  }

  function restartGame(){
    const scene=this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    if (GameState.spawnTimer) {
      GameState.spawnTimer.remove(false);
      GameState.spawnTimer = null;
    }
    GameState.falconActive = false;
    clearDialog.call(scene);
    dialogDrinkEmoji.attachedTo = null;
    if(endOverlay){ endOverlay.destroy(); endOverlay=null; }
    if(sideCText){ sideCText.destroy(); sideCText=null; }
    reportLine1.setVisible(false);
    reportLine2.setVisible(false);
    reportLine3.setVisible(false);
    tipText.setVisible(false);
    paidStamp.setVisible(false);
    lossStamp.setVisible(false);
    // reset truck and girl to their initial off-screen positions
    if (truck && girl) {
      const startX = scene.scale.width + 100;
      truck.setPosition(startX, 245);
      girl.setPosition(startX, 260).setVisible(false);
    }
    GameState.money=10.00; GameState.love=10;
    moneyText.setText('🪙 '+receipt(GameState.money));
    loveText.setText('❤️ '+GameState.love);
    updateLevelDisplay();
    if(GameState.activeCustomer){
      if(GameState.activeCustomer.dog){
        if(GameState.activeCustomer.dog.followEvent) GameState.activeCustomer.dog.followEvent.remove(false);
        GameState.activeCustomer.dog.destroy();
      }
      if(GameState.activeCustomer.heartEmoji){ GameState.activeCustomer.heartEmoji.destroy(); GameState.activeCustomer.heartEmoji=null; }
      GameState.activeCustomer.sprite.destroy();
    }
    GameState.activeCustomer=null;
    Phaser.Actions.Call(GameState.queue,c=>{ if(c.dog){ if(c.dog.followEvent) c.dog.followEvent.remove(false); c.dog.destroy(); } if(c.heartEmoji){ c.heartEmoji.destroy(); c.heartEmoji=null; } c.sprite.destroy(); });
    GameState.queue=[];
    Phaser.Actions.Call(GameState.wanderers,c=>{ if(c.dog){ if(c.dog.followEvent) c.dog.followEvent.remove(false); c.dog.destroy(); } if(c.heartEmoji){ c.heartEmoji.destroy(); c.heartEmoji=null; } c.sprite.destroy(); });
    GameState.wanderers=[];
    Object.keys(GameState.customerMemory).forEach(k=>{ delete GameState.customerMemory[k]; });
    GameState.heartWin = null;
    GameState.servedCount=0;
    sideCAlpha=0;
    sideCFadeTween=null;
    GameState.gameOver=false;
    showStartScreen.call(this);
  }

   Assets = { keys, requiredAssets, preload };
   Scene = { create, showStartScreen, playIntro };
   Customers = { spawnCustomer, lureNextWanderer, moveQueueForward, scheduleNextSpawn,
                      showDialog, clearDialog, handleAction, showFalconAttack,
                      showCustomerRevolt, restartGame };

   config={ ...baseConfig, scene:{ preload: Assets.preload, create: Scene.create } };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('load', init);
    setTimeout(() => {
      if (!initCalled) {
        if (DEBUG) console.error('init() did not execute');
        new Phaser.Game({
          type: Phaser.AUTO,
          parent: 'game-container',
          width: 480,
          height: 640,
          scene: {
            create: function(){
              this.add.text(240, 320,
                'Failed to start game. Check console for errors.',
                {font:'20px sans-serif', fill:'#f00', align:'center', wordWrap:{width:460}})
                .setOrigin(0.5);
            }
          }
        });
      }
    }, 3000);
  }
  showStartScreenFn = showStartScreen;
  handleActionFn = handleAction;
  spawnCustomerFn = spawnCustomer;
  scheduleNextSpawnFn = scheduleNextSpawn;
  showDialogFn = showDialog;
  animateLoveChangeFn = animateLoveChange;
  blinkButtonFn = blinkButton;
}

if (typeof window !== 'undefined') {
  setupGame();
}

export { showStartScreenFn as showStartScreen, handleActionFn as handleAction, spawnCustomerFn as spawnCustomer, scheduleNextSpawnFn as scheduleNextSpawn, showDialogFn as showDialog, animateLoveChangeFn as animateLoveChange, blinkButtonFn as blinkButton };
