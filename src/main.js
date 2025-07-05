import { debugLog, DEBUG } from './debug.js';
import { dur, scaleForY, articleFor, flashMoney, BUTTON_Y, DIALOG_Y, setSpeedMultiplier } from "./ui.js";
import { ORDER_X, ORDER_Y, WANDER_TOP, WANDER_BOTTOM, WALK_OFF_BASE, MAX_M, MAX_L, FIRED_THRESHOLD, queueLimit, RESPAWN_COOLDOWN } from "./customers.js";
import { lureNextWanderer, moveQueueForward, scheduleNextSpawn, spawnCustomer, startDogWaitTimer } from './entities/customerQueue.js';
import { baseConfig } from "./scene.js";
import { GameState, floatingEmojis, addFloatingEmoji, removeFloatingEmoji, saveAchievements } from "./state.js";
import { setActiveCustomer, updateMoney } from './stateHelpers.js';
import { CustomerState } from './constants.js';

import { scheduleSparrowSpawn, updateSparrows, cleanupSparrows, scatterSparrows } from './sparrow.js';
import { DOG_TYPES, DOG_MIN_Y, DOG_COUNTER_RADIUS, sendDogOffscreen, scaleDog, cleanupDogs, updateDog, dogTruckRuckus, dogRefuseJumpBark, dogBarkAt, animateDogPowerUp, barkProps, PUP_CUP_TINT } from './entities/dog.js';
import { startWander } from './entities/wanderers.js';

import { flashBorder, flashFill, blinkButton, applyRandomSkew, setDepthFromBottom, createGrayscaleTexture, createGlowTexture, createHpBar } from './ui/helpers.js';

import { keys, requiredAssets, preload as preloadAssets, receipt, emojiFor } from './assets.js';
import { playOpening, showStartScreen, playIntro } from './intro.js';
import DesaturatePipeline from './desaturatePipeline.js';

export let Assets, Scene, Customers, config;
export let showStartScreenFn, handleActionFn, spawnCustomerFn, scheduleNextSpawnFn, showDialogFn, animateLoveChangeFn, blinkButtonFn;
// Minimum duration when a customer dashes to the table
const DART_MIN_DURATION = 300;
// Maximum speed (pixels per second) when dashing to the table
const DART_MAX_SPEED = (560 / 6) * 3;
// Offset for the drink emoji when the customer holds it
// Raise it slightly so it appears near their hands instead of their feet
// Also determines where the drink lands when tossed to a customer
// Lowered by 10px so the drink doesn't land on top of their head
const DRINK_HOLD_OFFSET = { x: 0, y: -10 };

// Cloud display positions
// When money reaches $200 the dollar cloud sits at the top value.
// Hearts use a similar scale based on the MAX_L constant.
const MONEY_TOP_Y = 5;
const MONEY_BOTTOM_Y = 35;
const LOVE_TOP_Y = 5;
const LOVE_BOTTOM_Y = 35;
const HEART_EMOJIS = {
  [CustomerState.NORMAL]: null,
  [CustomerState.BROKEN]: '💔',
  [CustomerState.MENDING]: '❤️‍🩹',
  [CustomerState.GROWING]: '💗',
  [CustomerState.SPARKLING]: '💖',
  [CustomerState.ARROW]: '💘'
};

// Reactions when a customer receives a drink
const HAPPY_FACE_EMOJIS = ['🙂','😊','😃','😄','😆'];
const LOVE_FACE_EMOJIS = ['😍','🥰','😘','😻','🤩'];

// A single neutral face used when no love is gained
const NEUTRAL_FACE_EMOJIS = ['🙂'];


const UPSET_EMOJIS = ['😠','🤬','😡','😤','😭','😢','😱','😖','😫'];

function nextMood(state){
  switch(state){
    case CustomerState.BROKEN: return CustomerState.MENDING;
    case CustomerState.MENDING: return CustomerState.NORMAL;
    case CustomerState.NORMAL: return CustomerState.GROWING;
    case CustomerState.GROWING: return CustomerState.SPARKLING;
    case CustomerState.SPARKLING: return CustomerState.ARROW;
    default: return state;
  }
}

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






  function animateStatChange(obj, scene, delta, isLove=false){
    if(delta===0) return;
    const up = delta>0;
    const color = up ? '#0f0' : '#f00';
    const by = up ? -8 : 8;
    const originalY = obj.y;
    const moveDur = isLove && !up ? 160 : 120;
    scene.tweens.add({targets:obj, y:originalY+by, duration:dur(moveDur), yoyo:true});

    const cloud = isLove ? cloudHeart : cloudDollar;
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
        callback:()=>{
          if(cOn) cloud.setTintFill(tint); else cloud.clearTint();
          cOn=!cOn;
        }
      });
      scene.time.delayedCall(dur(flashDelay)*(flashes+1)+dur(10),()=>{
        cloud.clearTint();
      },[],scene);
    }
    scene.time.delayedCall(dur(flashDelay)*(flashes+1)+dur(10),()=>{
      obj.setColor('#fff');
      if(isLove && !up){
        obj.setText(String(GameState.love));
        // removed wobble animation for the love counter
      }
    },[],scene);
    scene.time.delayedCall(dur(moveDur)*2,()=>{
      updateCloudStatus(scene);
    },[],scene);
  }

  function frameForStat(val){
    if(val<=0) return 4;
    if(val===1) return 3;
    if(val===2) return 2;
    if(val===3) return 1;
    return 0;
  }

  function updateCloudStatus(scene){
    if(!scene) return;
    if(cloudHeart) cloudHeart.x = cloudHeartBaseX;
    if(cloudDollar) cloudDollar.x = cloudDollarBaseX;
    updateCloudPositions();
    if(cloudHeart && cloudHeart.setFrame){
      cloudHeart.setFrame(frameForStat(GameState.love));
    }
    if(cloudDollar && cloudDollar.setFrame){
      cloudDollar.setFrame(frameForStat(Math.floor(GameState.money)));
    }
    const amps=[1,3,5,7,10];
    const durs=[6000,5000,4000,3000,2000];
    const loveIdx=frameForStat(GameState.love);
    const moneyIdx=frameForStat(Math.floor(GameState.money));
    const makeTween=(existing,targets,amp,dur)=>{
      if(existing){ if(existing.remove) existing.remove(); else if(existing.stop) existing.stop(); }
      if(!scene.tweens) return null;
      return scene.tweens.add({targets,x:`+=${amp}`,duration:dur,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    };
    cloudHeartTween=makeTween(cloudHeartTween,[cloudHeart,loveText],amps[loveIdx],durs[loveIdx]);
    cloudDollarTween=makeTween(cloudDollarTween,[cloudDollar,moneyText,moneyDollar],amps[moneyIdx],durs[moneyIdx]);
  }

  function updateCloudPositions(){
    if(cloudDollar){
      const ratio=Math.min(MAX_M,Math.max(0,GameState.money))/MAX_M;
      const newY=MONEY_BOTTOM_Y-(MONEY_BOTTOM_Y-MONEY_TOP_Y)*ratio;
      cloudDollar.y=newY;
      const centerX = cloudDollar.x + cloudDollar.displayWidth/2;
      const centerY = newY + cloudDollar.displayHeight/2;
      moneyText.setPosition(centerX, centerY);
      if(moneyDollar){
        moneyDollar.setPosition(
          centerX - moneyText.displayWidth/2 - moneyDollar.displayWidth/2,
          centerY
        );
      }
    }
    if(cloudHeart){
      const ratio=Math.min(MAX_L,Math.max(0,GameState.love))/MAX_L;
      const newY=LOVE_BOTTOM_Y-(LOVE_BOTTOM_Y-LOVE_TOP_Y)*ratio;
      cloudHeart.y=newY;
      loveText.setPosition(
        cloudHeart.x - cloudHeart.displayWidth/2,
        newY + cloudHeart.displayHeight/2
      );
    }
  }

  function updateMoneyDisplay(){
    if(!moneyText || !moneyDollar) return;
    const val = receipt(GameState.money);
    moneyDollar.setText(val.charAt(0));
    moneyText.setText(val.slice(1));
    updateCloudPositions();
  }

  function countPrice(text, scene, from, to, baseLeft, baseY=15){
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

  const HEART_EMOJI_LIST = Object.values(HEART_EMOJIS).filter(Boolean);

  function cleanupHeartEmojis(scene){
    const everyone = [];
    if(GameState.activeCustomer) everyone.push(GameState.activeCustomer);
    if(Array.isArray(GameState.queue)) everyone.push(...GameState.queue);
    if(Array.isArray(GameState.wanderers)) everyone.push(...GameState.wanderers);
    everyone.forEach(c=>{
      if(c && c.heartEmoji){
        c.heartEmoji.destroy();
        c.heartEmoji = null;
      }
      if(c && c.hideHeart){
        c.hideHeart = false;
      }
      if(c && c.dog && c.dog.hideHeart){
        c.dog.hideHeart = false;
      }
    });

    if(scene && scene.children){
      scene.children.list.slice().forEach(child=>{
        if(child instanceof Phaser.GameObjects.Text && HEART_EMOJI_LIST.includes(child.text)){
          child.destroy();
        }
      });
    }
  }

  function cleanupBarks(){
    GameState.activeBarks.slice().forEach(b=>{ if(b && b.destroy) b.destroy(); });
    GameState.activeBarks.length = 0;
  }

  function cleanupBursts(){
    GameState.activeBursts.slice().forEach(b=>{ if(b && b.destroy) b.destroy(); });
    GameState.activeBursts.length = 0;
  }

  function cleanupSparkles(scene){
    if(!scene || !scene.children) return;
    scene.children.list.slice().forEach(child=>{
      if(child instanceof Phaser.GameObjects.Text && child.text === '✨'){
        child.destroy();
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

  // Record an achievement immediately when an ending is shown
  function awardBadge(scene, key){
    if(!key) return;
    GameState.lastEndKey = key;
    if(!GameState.badges.includes(key)) GameState.badges.push(key);
    GameState.badgeCounts[key] = (GameState.badgeCounts[key] || 0) + 1;
    if (typeof saveAchievements === 'function') saveAchievements();
    const grayKey = `${key}_gray`;
    createGrayscaleTexture(scene, key, grayKey);
  }


  function fadeInButtons(canSell){
    const startY = BUTTON_Y + 50;
    if(!this.textures.exists('sell_gray')){
      createGrayscaleTexture(this, 'sell', 'sell_gray');
    }

    const SELL_X = 240;
    const WITH_SELL = {
      sell:{x:SELL_X, scale:1.15, depth:13, angle:180},
      give:{x:360, scale:1.0, depth:12, angle:20},
      ref:{x:120, scale:1.0, depth:12, angle:-20}
    };
    const WITHOUT_SELL = {
      give:{x:320, scale:1.0, depth:13, angle:20},
      ref:{x:160, scale:1.0, depth:13, angle:-20}
    };
    const FINAL = canSell ? WITH_SELL : WITHOUT_SELL;

    const buttonImage = btn => {
      if(!btn || !btn.list) return null;
      return btn.list.find(child => typeof child.setTexture === 'function');
    };

    const resetBtn = (btn, info)=>{
      if(!btn) return;
      buttonImage(btn);
      btn.setPosition(SELL_X, startY);

      if(btn.image){
        btn.image.setScale(info.scale);
        btn.setSize(btn.image.displayWidth, btn.image.displayHeight);

      }
      btn.setDepth(info.depth);
      btn.setAngle(info.angle || 0);
      btn.setAlpha(0).setVisible(true);
      if(btn.zone && btn.zone.input) btn.zone.input.enabled = false;
      if(btn.glow){
        if(btn.glowTween && btn.glowTween.remove) btn.glowTween.remove();
        btn.glowTween=null;
        btn.glow.setVisible(false);
      }
    };


    if(btnSell && btnSell.image){
      btnSell.image.setTexture('sell');
      btnSell.image.setAlpha(1);

    }

    if(canSell){
      resetBtn(btnSell, FINAL.sell);
    }else if(btnSell){
      btnSell.setVisible(false);
    }
    resetBtn(btnGive, FINAL.give);
    resetBtn(btnRef, FINAL.ref);

    const timeline = this.tweens.createTimeline();
    if(canSell){
      timeline.add({
        targets: btnSell,
        y: BUTTON_Y,
        angle: 0,
        alpha: 1,
        ease: 'Sine.easeOut',
        duration: dur(250)
      });
    }

    timeline.add({
      targets: btnGive,
      x: FINAL.give.x,
      y: BUTTON_Y,
      angle: 0,
      alpha: 1,
      ease: 'Sine.easeOut',
      duration: dur(200)
    });
    timeline.add({
      targets: btnRef,
      x: FINAL.ref.x,
      y: BUTTON_Y,
      angle: 0,
      alpha: 1,
      ease: 'Sine.easeOut',
      duration: dur(200),
      offset: '-=200'
    });

    timeline.setCallback('onComplete', () => {
      if(canSell && btnSell.zone && btnSell.zone.input) btnSell.zone.input.enabled = true;
      if(btnGive.zone && btnGive.zone.input) btnGive.zone.input.enabled = true;
      if(btnRef.zone && btnRef.zone.input) btnRef.zone.input.enabled = true;
      if(canSell && btnSell.glow){
        if(btnSell.glowTween && btnSell.glowTween.remove) btnSell.glowTween.remove();
        btnSell.glowTween=null;
        btnSell.glow.setVisible(false);
      }
      if(btnGive.glow){
        if(btnGive.glowTween && btnGive.glowTween.remove) btnGive.glowTween.remove();
        btnGive.glow.setVisible(true).setAlpha(0.1);
        btnGive.glowTween = this.tweens.add({
          targets: btnGive.glow,
          alpha: {from:0.1, to:0.05},
          duration: dur(800),
          yoyo: true,
          repeat: -1
        });
      }
    }, []);
    timeline.play();
  }



  function blowButtonsAway(except){
    const buttons=[btnSell,btnGive,btnRef].filter(b=>b&&b!==except);
    buttons.forEach(btn=>{
      if(btn.input) btn.input.enabled=false;
      if(this.tweens){
        this.tweens.add({
          targets:btn,
          y:btn.y+200,
          x:btn.x+Phaser.Math.Between(-40,40),
          angle:Phaser.Math.Between(-90,90),
          alpha:0,
          duration:dur(300),
          ease:'Cubic.easeIn',
          onComplete:()=>{btn.setVisible(false); btn.setAngle(0);}
        });
      }else{
        btn.setVisible(false);
        btn.setAngle(0);
      }
    });
  }

  function startSellGlowSparkle(){
    if(!btnSell || !btnSell.glow) return;
    const glow=btnSell.glow;
    if(btnSell.glowTween && btnSell.glowTween.remove){ btnSell.glowTween.remove(); btnSell.glowTween=null; }
    if(btnSell.sparkleTween && btnSell.sparkleTween.remove) btnSell.sparkleTween.remove();
    glow.setVisible(true).setAlpha(0.7).setScale(1).setPosition(0,0);
    btnSell.sparkleTween = this.tweens.add({
      targets: glow,
      alpha: {from:0.7, to:0.2},
      x: {from:-3, to:3},
      y: {from:-3, to:3},
      duration: dur(120),
      yoyo: true,
      repeat: -1
    });
  }

  function startGiveSparkle(){
    if(!btnGive) return;
    if(btnGive.glow){
      if(btnGive.glowTween && btnGive.glowTween.remove) btnGive.glowTween.remove();
      btnGive.glow.setVisible(true).setAlpha(0.6).setScale(1);
      btnGive.glowTween = this.tweens.add({
        targets: btnGive.glow,
        alpha: 0,
        scale: 2,
        duration: dur(150),
        ease: 'Cubic.easeOut',
        onComplete: () => btnGive.glow.setVisible(false).setScale(1)
      });
    }
    const count = 6;
    const radius = Math.max(btnGive.width, btnGive.height) / 2 + 4;
    for(let i=0;i<count;i++){
      const angle = Phaser.Math.FloatBetween(0, Math.PI*2);
      const sx = btnGive.x + radius * Math.cos(angle);
      const sy = btnGive.y + radius * Math.sin(angle);
      const sp = this.add.text(sx, sy, '✨', {font:'18px sans-serif',fill:'#fff'})
        .setOrigin(0.5)
        .setDepth(btnGive.depth+1);
      this.tweens.add({
        targets: sp,
        y: sy - 10,
        alpha: 0,
        duration: dur(150),
        onComplete: () => sp.destroy()
      });
    }
  }

  function growSellGlow(tipped){
    if(!btnSell || !btnSell.glow) return;
    const target=tipped?3:2;
    this.tweens.add({targets:btnSell.glow, scale: target, duration: dur(300)});
  }

  function stopSellGlowSparkle(cb){
    if(!btnSell || !btnSell.glow){
      if(cb) cb();
      return;
    }
    if(btnSell.sparkleTween && btnSell.sparkleTween.remove){
      btnSell.sparkleTween.remove();
      btnSell.sparkleTween=null;
    }
    const glow = btnSell.glow;
    const glowTween = this.tweens.add({
      targets: glow,
      scale: 0,
      alpha: 0,
      duration: dur(150),
      ease: 'Cubic.easeOut',
      onComplete: () => {
        glow.setVisible(false).setScale(1).setPosition(0,0);
      }
    });
    if(btnSell.image){
      btnSell.image.setTintFill(0xffd700);
      this.tweens.add({
        targets: btnSell.image,
        alpha: 0,
        duration: dur(150),
        onComplete: () => {
          btnSell.setVisible(false);
          btnSell.image.clearTint();
          btnSell.image.setAlpha(1);
        }
      });
    } else {
      this.tweens.add({
        targets: btnSell,
        alpha: 0,
        duration: dur(150),
        onComplete: () => { btnSell.setVisible(false); }
      });
    }
    if(cb){
      glowTween.setCallback('onComplete', () => cb(), []);
    }
  }




  let moneyText, moneyDollar, loveText, cloudHeart, cloudDollar, queueLevelText;
  let cloudHeartBaseX = 0, cloudDollarBaseX = 0;
  let dialogBg, dialogText, dialogCoins,
      dialogPriceLabel, dialogPriceValue, dialogPriceBox,
      dialogDrinkEmoji, dialogPriceContainer, dialogPriceTicket, dialogPriceShadow, dialogPupCup,
      ticketShadowMask,
      btnSell, btnGive, btnRef;
  let reportLine1, reportLine2, reportLine3, tipText;
  let paidStamp, lossStamp;
  let priceValueYOffset = 15;
  let truck, girl;
  let sideCText;
  let sideCAlpha=0;
  let sideCFadeTween=null;
  let cloudHeartTween=null, cloudDollarTween=null;
  let endOverlay=null;
  // hearts or anger symbols currently animating


  function enforceCustomerScaling(){
      const updateHeart = c => {
        if(!c.sprite || !c.sprite.scene) return;
        const state = (c.loveState !== undefined ? c.loveState :
                       c.memory && c.memory.state) || CustomerState.NORMAL;
        if(c.hideHeart){
          if(c.heartEmoji && c.heartEmoji.scene){
            c.heartEmoji.setVisible(false);
          }
          return;
        }
        if(!c.heartEmoji || !c.heartEmoji.scene || !c.heartEmoji.active){
          if (c.heartEmoji && c.heartEmoji.destroy) {
            c.heartEmoji.destroy();
          }
          c.heartEmoji = c.sprite.scene.add.text(c.sprite.x, c.sprite.y, '', {font:'28px sans-serif'})
            .setOrigin(0.5)
            .setShadow(0, 0, '#000', 4);
          if(c.isDog){
            c.sprite.heartEmoji = c.heartEmoji;
          }
        }
        if(c.heartEmoji && c.heartEmoji.scene && c.heartEmoji.active){
          const y = c.sprite.y + c.sprite.displayHeight * 0.30;
          const scale = scaleForY(c.sprite.y)*0.8;
          c.heartEmoji
            .setText(HEART_EMOJIS[state] || '')
            .setPosition(c.sprite.x, y)
            .setScale(scale)
            .setShadow(0, 0, '#000', 4)
            .setDepth(c.sprite.depth);
          if(c.isDog){
            c.sprite.heartEmoji = c.heartEmoji;
          }
        }
      };
    GameState.queue.forEach(c=>{
      if(c.sprite){ c.sprite.setScale(scaleForY(c.sprite.y)); setDepthFromBottom(c.sprite,5); }
      if(c.dog) scaleDog(c.dog);
      if(c.isDog) scaleDog(c.sprite);
      updateHeart(c);
      if(c.dogCustomer) updateHeart(c.dogCustomer);
    });
    GameState.wanderers.forEach(c=>{
      if(c.sprite){ c.sprite.setScale(scaleForY(c.sprite.y)); setDepthFromBottom(c.sprite,5); }
      if(c.dog) scaleDog(c.dog);
      if(c.isDog) scaleDog(c.sprite);
      updateHeart(c);
      if(c.dogCustomer) updateHeart(c.dogCustomer);
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



  function updateLevelDisplay(){
    const newLength = queueLimit(GameState.love);
    if(queueLevelText){
      if(newLength!==GameState.loveLevel && newLength>=2){
        const sp=queueLevelText.scene.add.text(queueLevelText.x,queueLevelText.y,'✨',
            {font:'18px sans-serif',fill:'#000'})
          .setOrigin(0.5).setDepth(queueLevelText.depth+1);
        queueLevelText.scene.tweens.add({targets:sp,y:queueLevelText.y-20,alpha:0,
            duration:dur(600),onComplete:()=>sp.destroy()});
      }
    }
    GameState.loveLevel=newLength;
      if(GameState.girlReady && queueLevelText && queueLevelText.scene){
        lureNextWanderer(queueLevelText.scene);
      }
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
    const progress=Math.min(1,(GameState.servedCount-5)*0.1);
    const target=Math.min(0.3, 0.3*progress);
    if(target<=sideCAlpha) return;
    if(sideCFadeTween){ sideCFadeTween.stop(); }
    let duration=4000;
    if(target>0.15) duration=3000;
    sideCFadeTween=this.tweens.add({targets:sideCText,alpha:target,duration:duration});
    sideCAlpha=target;
    if(sideCAlpha>=0.3){
      sideCFadeTween=this.tweens.add({targets:sideCText,alpha:0,duration:40000,
        onComplete:()=>{ sideCText.destroy(); sideCText=null; sideCFadeTween=null; sideCAlpha=0; }});
    }
  }

  function addSpeedControl(scene){
    const speeds=[1,2,5,10];
    let idx=0;
    const label=scene.add.text(scene.scale.width-10,10,'1x',{
      font:'16px sans-serif',fill:'#fff',backgroundColor:'#000'
    })
      .setOrigin(1,0)
      .setPadding(4)
      .setDepth(30)
      .setInteractive({useHandCursor:true});
    label.on('pointerdown',()=>{
      idx=(idx+1)%speeds.length;
      setSpeedMultiplier(speeds[idx]);
      label.setText(`${speeds[idx]}x`);
    });
  }




  function preload(){
    preloadAssets.call(this);
  }

  function create(){
    this.assets = Assets;
    this.customers = Customers;
    this.gameState = GameState;
    this.dur = dur;
    setSpeedMultiplier(1);
    if (DEBUG) addSpeedControl(this);
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

    // Register a simple desaturation post-processing pipeline if WebGL is available
    if (this.renderer && this.renderer.pipelines &&
        typeof this.renderer.pipelines.addPostPipeline === 'function') {
      this.renderer.pipelines.addPostPipeline('desaturate', DesaturatePipeline);
    }

    // background
    let bg=this.add.image(0,0,'bg').setOrigin(0).setDepth(0);
    bg.setDisplaySize(this.scale.width,this.scale.height);

    // HUD
    cloudDollar=this.add.sprite(0,35,'cloudDollar')
      .setOrigin(0,0)
      .setDepth(1)
      .setScale(2.4)
      // Use screen blend for lighter overlay
      .setBlendMode(Phaser.BlendModes.SCREEN)

      // start hidden; fade in later
      .setAlpha(0)
      .setPostPipeline('desaturate');

    const dollarPipeline = cloudDollar.getPostPipeline(DesaturatePipeline);
    if (dollarPipeline) dollarPipeline.amount = 0.5;

    cloudDollar.x = 160 - cloudDollar.displayWidth/2;
    cloudDollarBaseX = cloudDollar.x;
    const moneyStr = receipt(GameState.money);
    moneyDollar=this.add.text(0,0,moneyStr.charAt(0),{font:'26px Arial, sans-serif',fill:'#fff'})
      .setOrigin(0.5)
      .setDepth(2)
      .setBlendMode(Phaser.BlendModes.NEGATIVE)
      .setAlpha(0)
      .setScale(0.5);
    moneyText=this.add.text(0,0,moneyStr.slice(1),{font:'26px Arial, sans-serif',fill:'#fff'})
      .setOrigin(0.5)
      .setDepth(2)
      .setBlendMode(Phaser.BlendModes.NEGATIVE)
      .setAlpha(0);
    updateMoneyDisplay();
    cloudHeart=this.add.sprite(0,35,'cloudHeart')
      .setOrigin(1,0)
      .setDepth(1)
      .setScale(2.4)
      // Use screen blend for lighter overlay
      .setBlendMode(Phaser.BlendModes.SCREEN)

      // start hidden; fade in later
      .setAlpha(0)
      .setPostPipeline('desaturate');

    const heartPipeline = cloudHeart.getPostPipeline(DesaturatePipeline);
    if (heartPipeline) heartPipeline.amount = 0.5;

    cloudHeart.x = 320 + cloudHeart.displayWidth/2;
    cloudHeartBaseX = cloudHeart.x;
    loveText=this.add.text(0,0,GameState.love,{font:'26px Arial, sans-serif',fill:'#fff'})
      .setOrigin(0.5)
      .setDepth(2)
      .setBlendMode(Phaser.BlendModes.NEGATIVE)
      .setAlpha(0);
    loveText.setPosition(
      cloudHeart.x - cloudHeart.displayWidth/2,
      cloudHeart.y + cloudHeart.displayHeight/2
    );
    moneyText.setInteractive({ useHandCursor:true });
    if(moneyDollar) moneyDollar.setInteractive({ useHandCursor:true });
    loveText.setInteractive({ useHandCursor:true });
    const moneyClick=()=>{
      updateMoney(20);
      updateMoneyDisplay();
      animateStatChange(moneyText, this, 1);
      if(moneyDollar) animateStatChange(moneyDollar, this, 1);
    };
    moneyText.on('pointerdown', moneyClick);
    if(moneyDollar) moneyDollar.on('pointerdown', moneyClick);
    loveText.on('pointerdown',()=>{
      GameState.love += 10;
      loveText.setText(GameState.love);
      updateLevelDisplay();
      animateStatChange(loveText, this, 1, true);
    });

    // gentle cloud animations handled by updateCloudStatus
    updateCloudStatus(this);

    // fade in HUD elements over time
    const fadeDuration = dur(20000);
    this.tweens.add({targets:[cloudDollar,cloudHeart], alpha:0.6, duration:fadeDuration});
    this.tweens.add({targets:[moneyText,moneyDollar,loveText], alpha:1, duration:fadeDuration, delay:dur(5000)});

    // Indicator for available queue slots
    queueLevelText=this.add.text(156,316,'',{font:'16px sans-serif',fill:'#000'})
      .setOrigin(0.5).setDepth(1).setVisible(false);
    updateLevelDisplay();
    // truck & girl
    const startX=this.scale.width+100;
    truck=this.add.image(startX,245,'truck').setScale(0.462).setDepth(2);
    GameState.truck = truck;

    girl=this.add.image(startX,245,'girl').setScale(0.5).setDepth(3).setVisible(false);
    GameState.girl = girl;

    // create lady falcon animation
    this.anims.create({
      key:'falcon_fly',
      frames:this.anims.generateFrameNumbers('lady_falcon',{start:0,end:1}),
      frameRate:6,
      repeat:-1
    });
    this.anims.create({
      key:'sparrow_fly',
      frames:this.anims.generateFrameNumbers('sparrow',{start:1,end:2}),
      frameRate:8,
      repeat:-1
    });
    this.anims.create({
      key:'sparrow_ground',
      frames:this.anims.generateFrameNumbers('sparrow',{start:0,end:0}),
      frameRate:1,
      repeat:-1
    });

    // dog animations
    this.anims.create({
      key:'dog_walk',
      frames:this.anims.generateFrameNumbers('dog1',{start:0,end:1}),
      frameRate:4,
      repeat:-1
    });
    this.anims.create({ key:'dog_bark', frames:[{key:'dog1',frame:2}], frameRate:1 });


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
  dialogPriceTicket=this.add.image(0,0,'price_ticket')
    .setOrigin(0.5)
    .setScale(1.25)
    .setVisible(false);
  dialogPriceShadow=this.add.image(2,4,'price_ticket')
    .setOrigin(0.5)
    .setTint(0x000000)
    .setAlpha(0.7)
    // slightly larger shadow for more depth
    .setScale(1.3 * 1.10, 1.4 * 1.20)
    .setVisible(false);
  if(truck){
    // mask the shadow so it only darkens the truck
    ticketShadowMask=this.add.image(truck.x, truck.y, 'truck')
      .setVisible(false)
      .setScale(truck.scaleX * 1.10, truck.scaleY * 1.20);
    dialogPriceShadow.setMask(ticketShadowMask.createBitmapMask());
    // keep the mask aligned with the truck as it moves or scales
    this.events.on('update', () => {
      if (!ticketShadowMask || !truck) return;
      ticketShadowMask.setPosition(truck.x, truck.y);
      ticketShadowMask.setScale(truck.scaleX * 1.10, truck.scaleY * 1.20);
    });
  }
  createGrayscaleTexture(this, 'price_ticket', 'price_ticket_gray');
  dialogPupCup=this.add.image(0,0,'pupcup2')
    .setOrigin(0.5)
    .setScale(0.8)
    .setVisible(false);

    dialogPriceLabel=this.add.text(0,-15,'',{font:'14px sans-serif',fill:'#000',align:'center'})
      .setOrigin(0.5);
    dialogPriceValue=this.add.text(-5,20,'',{font:'40px sans-serif',fill:'#000'})
      .setOrigin(0.5);
    const baseEmoji = this.add.text(0,0,'',{font:'28px sans-serif'})
      .setOrigin(0.5)
      .setShadow(0, 0, '#000', 0);
    const extra1 = this.add.text(0,-18,'',{font:'16px sans-serif'})
      .setOrigin(0.5)
      .setShadow(0, 0, '#000', 0);
    const extra2 = this.add.text(0,-18,'',{font:'16px sans-serif'})
      .setOrigin(0.5)
      .setShadow(0, 0, '#000', 0);
    const extra3 = this.add.text(0,-18,'',{font:'16px sans-serif'})
      .setOrigin(0.5)
      .setShadow(0, 0, '#000', 0);
    // Add base first so extras render on top of the drink
    dialogDrinkEmoji=this.add.container(-30,-20,[baseEmoji, extra1, extra2, extra3]);
    dialogDrinkEmoji.base = baseEmoji;
    dialogDrinkEmoji.extras = [extra1, extra2, extra3];
    dialogDrinkEmoji.haloTweens = [];
    dialogDrinkEmoji.stopHalo = function(){
      this.haloTweens.forEach(t=>{ if(t && t.remove) t.remove(); else if(t && t.stop) t.stop(); });
      this.haloTweens = [];
    };
    dialogDrinkEmoji.startHalo = function(){
      this.stopHalo();
      const visibleExtras = this.extras.filter(e=>e.visible && e.text);
      if(!visibleExtras.length) return;
      // Radii of the halo effect. Smaller values keep the extras
      // closer together so they appear to almost touch. X and Y are
      // separate so the orbit can be slightly flattened vertically.
      const radiusX = 8;
      const radiusY = 4;
      visibleExtras.forEach((e,i)=>{
        const offset = i/visibleExtras.length * Math.PI*2;
        const tween=this.scene.tweens.addCounter({
          from:0,to:Math.PI*2,duration:4000,repeat:-1,
          onUpdate:t=>{
            const ang = t.getValue() + offset;
            const centerY = this.base.y - 6; // slightly lower center
            e.x = Math.cos(ang) * radiusX;
            e.y = centerY + Math.sin(ang) * radiusY;
          }
        });
        this.haloTweens.push(tween);
      });
    };
    dialogDrinkEmoji.setText = function(str){
      const parts = String(str||'').split('\n');
      const base = parts.pop() || '';
      const extras = parts.join(' ').trim().split(/\s+/).filter(Boolean).slice(0,3);
      this.base.setText(base);
      this.extras.forEach((e,i)=>{
        if(extras[i]){
          e.setText(extras[i]).setVisible(true);
        }else{
          e.setText('').setVisible(false);
        }
      });

      const count = extras.length;
      const baseY = count ? 4 : 0;
      this.base.setPosition(0, baseY).setScale(count ? 1.0 : 1.3);
      if(count===1){
        this.extras[0].setScale(0.5).setPosition(0, baseY-16);
      }else if(count===2){
        this.extras[0].setScale(0.4).setPosition(-4, baseY-15);
        this.extras[1].setScale(0.4).setPosition(4, baseY-15);
      }else if(count>=3){
        this.extras[0].setScale(0.35).setPosition(-6, baseY-15);
        this.extras[1].setScale(0.35).setPosition(6, baseY-15);
        this.extras[2].setScale(0.35).setPosition(0, baseY-25);
      }
      this.startHalo();
      return this;
    };
    dialogDrinkEmoji.setLineSpacing = ()=>dialogDrinkEmoji;
    dialogDrinkEmoji.clearTint = function(){
      if(this.base.clearTint) this.base.clearTint();
      this.extras.forEach(e=>{ if(e.clearTint) e.clearTint(); });
      return this;
    };

    dialogPriceContainer=this.add.container(0,0,[dialogPriceShadow, dialogPriceTicket, dialogPupCup, dialogPriceBox, dialogDrinkEmoji, dialogPriceLabel, dialogPriceValue])
      .setDepth(11)
      .setVisible(false);

    dialogText=this.add.text(240,410,'',{font:'20px sans-serif',fill:'#000',align:'center'})
                     .setOrigin(0,0.5).setVisible(false).setDepth(11);
    dialogCoins=this.add.text(240,440,'',{font:'20px sans-serif',fill:'#000'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);

    // price label/value are part of dialogPriceContainer and should not
    // also be drawn inside the main dialog. Remove the duplicate texts that
    // caused the total cost to appear in the dialog bubble.


    // helper to create a button using an image asset
    const createButton=(x,key,handler,scale=1,depth=12,glowColor=null)=>{
      const img=this.add.image(0,0,key)
        .setScale(scale)
        // reduce brightness slightly
        .setTint(0xdddddd);
      const shadow=this.add.image(3,3,key)
        .setScale(scale)
        .setTint(0x000000)
        .setAlpha(0.5);
      const width=img.displayWidth;
      const height=img.displayHeight;

      const c=this.add.container(x,BUTTON_Y)

        .setSize(width,height)
        .setDepth(depth)
        .setVisible(false);

      if(glowColor){
        const radius = Math.max(width,height)/2 + 8;
        const key = `glow_${glowColor.toString(16)}_${Math.round(radius)}`;
        createGlowTexture(this, glowColor, key, radius);
        const glow=this.add.image(0,0,key).setVisible(false);
        glow.setBlendMode(Phaser.BlendModes.ADD);
        c.glow=glow;
      }

      c.add(shadow);
      c.add(img);
      if(c.glow) c.add(c.glow); // place glow on top of image
      c.image = img; // store reference for easy access

      const zone=this.add.zone(0,0,width,height).setOrigin(0.5);
      zone.setInteractive({ useHandCursor:true });
      zone.on('pointerdown',()=>{
        blowButtonsAway.call(this,c);
        if(c===btnSell) startSellGlowSparkle.call(this);
        if(c===btnGive) startGiveSparkle.call(this);
        blinkButton.call(this,c,handler,zone);
      });
      c.add(zone);
      c.zone=zone;
      return c;
    };

    // buttons evenly spaced

    // Arrange buttons: Refuse on the left, Sell in the middle (largest), Give on the right
    btnRef=createButton(110,'refuse',()=>handleAction.call(this,'refuse'),1.0,12);
    btnSell=createButton(240,'sell',()=>handleAction.call(this,'sell'),1.15,13,0xffd700);
    btnGive=createButton(370,'give',()=>handleAction.call(this,'give'),1.0,12,0xff69b4);

    const triggerBtn = btn => {
      if (!btn || !btn.zone || (btn.zone.input && !btn.zone.input.enabled)) return;
      if (btn.zone.emit) btn.zone.emit('pointerdown');
    };
    this.input.keyboard.on('keydown-A', () => triggerBtn(btnRef));
    this.input.keyboard.on('keydown-S', () => triggerBtn(btnSell));
    this.input.keyboard.on('keydown-D', () => triggerBtn(btnGive));


    // sliding report texts
    reportLine1=this.add.text(480,moneyText.y,'',{font:'16px sans-serif',fill:'#fff'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);
    reportLine2=this.add.text(480,moneyText.y+20,'',{font:'16px sans-serif',fill:'#fff'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);
    reportLine3=this.add.text(480,loveText.y,'',{font:'16px sans-serif',fill:'#fff'})
      .setOrigin(0,0.5).setVisible(false).setDepth(11);
    tipText=this.add.text(0,0,'',{font:'bold 24px sans-serif',fill:'#fff',strokeThickness:0})
      .setOrigin(0.5)
      .setDepth(12)
      .setVisible(false)
      .setAlpha(1);
    paidStamp=this.add.text(0,0,'SOLD',{
        font:'bold 32px sans-serif',
        fill:'#fff',
        strokeThickness:0
      })
      .setOrigin(0.5)
      .setDepth(12)
      .setVisible(false)
      .setAlpha(1);
    lossStamp=this.add.text(0,0,'LOSS',{
        font:'bold 28px sans-serif',
        fill:'#ff0000',
        stroke:'#ff0000',
        strokeThickness:2
      })
      .setOrigin(0.5)
      .setDepth(12)
      .setVisible(false)
      .setAlpha(1);

    // play opening sequence before showing start screen
    playOpening.call(this);
    scheduleSparrowSpawn(this);

    // ensure customer sprites match vertical scale and keep drink emoji attached
    this.events.on('update', (_, dt) => {
      enforceCustomerScaling();
      updateDrinkEmojiPosition();
      updateSparrows(this, dt);
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
    if(dialogPriceTicket){
      if(dialogPriceTicket.clearTint) dialogPriceTicket.clearTint();
      if(dialogPriceTicket.setTexture && this.textures.exists('price_ticket')){
        dialogPriceTicket.setTexture('price_ticket');
      }
    }
    if(dialogDrinkEmoji && dialogDrinkEmoji.setAlpha){
      dialogDrinkEmoji.setAlpha(1);
    }
    if(dialogPriceContainer){
      dialogPriceContainer
        .setAngle(0)
        .setScale(1)
        .setAlpha(1);
    }
  }

  function showDialog(){
    if (GameState.falconActive) return;
    if (GameState.saleInProgress || GameState.dialogActive) {
      // Defer showing the next order until the current sale animation finishes
      // or while another dialog is already visible
      return;
    }
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
    // Reset ticket visuals in case previous animations modified them
    if (typeof resetPriceBox === 'function') {
      resetPriceBox.call(this);
    }
    // reset the dialog position in case previous animations moved it
    dialogBg.y = typeof DIALOG_Y === 'number' ? DIALOG_Y : 430;
    dialogBg.setAlpha(1);
    dialogText.setAlpha(1);
    dialogCoins.setAlpha(1);
    setActiveCustomer(GameState.queue[0]||null);
    if(!GameState.activeCustomer) return;
    const c=GameState.activeCustomer;
    if(c.isDog && c.owner && c.owner.dogWaitEvent){
      c.owner.dogWaitEvent.remove(false);
      c.owner.dogWaitEvent=null;
    }
    if(!c.isDog && c.dog && c.dog.followEvent){
      const dist = Phaser.Math.Distance.Between(c.dog.x, c.dog.y,
                                                c.sprite.x, c.sprite.y);
      if(dist <= DOG_COUNTER_RADIUS * 1.2){
        c.dog.followEvent.remove(false);
        c.dog.followEvent=null;
      }
    }
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
    let wantLine;
    if(c.isDog){
      const sounds=['woof woof!','bark bark!','arf arf!','ruff ruff!','awoo!','🐶🐶'];
      const sound=Phaser.Utils.Array.GetRandom(sounds);
      wantLine=sound;
    } else {
      const itemStr=c.orders.map(o=>{
        return o.qty>1 ? `${o.qty} ${o.req}` : o.req;
      }).join(' and ');
      wantLine=(c.orders.length===1 && c.orders[0].qty===1)
        ? `I want ${articleFor(c.orders[0].req)} ${c.orders[0].req}`
        : `I want ${itemStr}`;
    }


    dialogText
      .setOrigin(0.5)
      .setStyle({fontSize:'24px'})
      .setText(wantLine)
      .setVisible(true);

      const totalCost=c.isDog?0:c.orders.reduce((s,o)=>s+o.price*o.qty,0);
      const canAfford = c.isDog ? true : (c.orders[0].coins >= totalCost);
      const canSell = !c.isDog && canAfford;
    let coinLine='';
    if(!c.isDog){
      if (!canAfford) {
        const options = [
          "I forgot my wallet",
          "I'll pay you tomorrow",
          "My card got declined",
          "Can I Venmo you later?",
          "I'm good for it, promise"
        ];
        coinLine = Phaser.Utils.Array.GetRandom(options);
      }
    }
    dialogCoins
      .setOrigin(0.5)
      .setStyle({fontSize:'24px'})
      .setText(coinLine)
      .setVisible(!c.isDog && !!coinLine);

    const coinW = (!c.isDog && coinLine) ? dialogCoins.width : 0;
    const maxW = Math.max(dialogText.width, coinW);
    const hMargin = 20;
    const vMargin = 15;
    const lineGap = 10;
    dialogBg.width = Math.max(maxW + hMargin * 2, 160);
    dialogBg.height = dialogText.height + (coinLine ? dialogCoins.height + lineGap : 0) + vMargin * 2;

    const bubbleTop=dialogBg.y - dialogBg.height/2;
    const textY=bubbleTop + vMargin + dialogText.height/2;
    dialogText.setPosition(dialogBg.x, textY);
    if(!c.isDog && coinLine){
      dialogCoins.setPosition(
        dialogBg.x,
        textY + dialogText.height/2 + lineGap + dialogCoins.height/2
      );
    }

    dialogBg.setScale(0).setVisible(true);
    GameState.dialogActive = true;
    dialogText.setScale(0);
    if (coinLine) {
      dialogCoins.setScale(0);
    } else {
      dialogCoins.setScale(1);
    }
    // use a static bubble color to avoid expensive image analysis
    let bubbleColor = 0xffffff;
    drawDialogBubble(c.sprite.x, c.sprite.y, bubbleColor);


    const ticketW = c.isDog
      ? dialogPriceBox.width
      : (dialogPriceTicket ? dialogPriceTicket.displayWidth : dialogPriceBox.width);
    const ticketH = c.isDog
      ? dialogPriceBox.height
      : (dialogPriceTicket ? dialogPriceTicket.displayHeight : dialogPriceBox.height);
    const ticketOffset = ticketW / 2 + 10;

    const truckRef = (typeof truck !== 'undefined' && truck) ? truck : null;

    const startX = (typeof girl !== 'undefined' && girl) ? girl.x : dialogBg.x;
    const startY = (typeof girl !== 'undefined' && girl) ? girl.y - 30 : dialogBg.y - 10;
    const priceTargetX = startX;
    const priceTargetY = startY - ticketH * 0.5 + 10;
    const peekY = startY - ticketH * 0.5 + 12;
    dialogPriceContainer
      .setPosition(startX, startY)
      // start smaller so the ticket is hidden behind the truck
      .setScale(0.2)
      .setVisible(false);
    if (dialogDrinkEmoji.parentContainer !== dialogPriceContainer) {
      dialogPriceContainer.add(dialogDrinkEmoji);
    }
    dialogDrinkEmoji.attachedTo = null;
    dialogPriceContainer.alpha = 1;
    if(c.isDog){
      dialogPriceTicket.setVisible(false);
      dialogPriceShadow.setVisible(false);
      dialogPupCup.setTexture('pupcup2');
      dialogPupCup.setVisible(true);
      dialogPriceBox.setVisible(false);
      dialogPriceBox.width = dialogPupCup.displayWidth;
      dialogPriceBox.height = dialogPupCup.displayHeight;
      dialogPriceLabel.setVisible(false);
      dialogPriceValue.setVisible(false);
      dialogDrinkEmoji
        .setText('🍨')
        // Lower the dessert emoji slightly so it sits in the cup better
        .setPosition(0,-dialogPriceBox.height/4 + 14)
        .setScale(2)
        .setVisible(true);
      // Give the dessert emoji a dark, heavy shadow outline so it pops
      dialogDrinkEmoji.base
        .setShadow(0, 0, '#000', 8)
        .setStyle({stroke:'#000', strokeThickness:4});


    } else {
      dialogPupCup.setVisible(false);
      dialogPriceTicket.setVisible(true);
      dialogPriceShadow.setVisible(true);
      dialogPriceBox.setVisible(false); // hide outline from old ticket
      dialogPriceBox.width = dialogPriceTicket.displayWidth;
      dialogPriceBox.height = dialogPriceTicket.displayHeight;
      dialogPriceLabel.setVisible(false); // remove "Total Cost" text
      dialogPriceValue
        .setStyle({fontSize:'42px'})
        .setText(receipt(totalCost))
        .setColor('#006400')
        .setOrigin(0.5)
        .setScale(0.9)
        .setAlpha(1)
        .setVisible(true);
      priceValueYOffset = dialogPriceBox.height/2 - 34;
      const orderEmoji = emojiFor(c.orders[0].req);
      dialogPriceValue.setPosition(-5, priceValueYOffset + 5);
      dialogDrinkEmoji.setText(orderEmoji);
      dialogDrinkEmoji
        .setPosition(0,-dialogPriceBox.height/4 + 8) // slightly lower
        .setScale(2)
        .setVisible(true)
        .setDepth(paidStamp.depth + 1);
      dialogDrinkEmoji.base
        .setShadow(0, 0, '#000', 0)
        .setStyle({strokeThickness:0});
      dialogDrinkEmoji.extras.forEach(e=>e.setShadow(0, 0, '#000', 0));
    }

    this.tweens.add({
      targets:[dialogBg, dialogText, dialogCoins],
      scale:1,
      ease:'Back.easeOut',
      duration:dur(300),
      onComplete:()=>{
        const showPrice=()=>{
          dialogPriceContainer.setVisible(true);
          const frontDepth = dialogPriceContainer.depth;
          const behindDepth = truckRef && truckRef.depth ? truckRef.depth - 1 : frontDepth - 1;
          dialogPriceContainer.setDepth(behindDepth);
          const midY = truckRef ?
            truckRef.y - (truckRef.displayHeight||0)/2 - 40 :
            priceTargetY - 40;
          const tl = this.tweens.createTimeline();
          tl.add({
            targets: dialogPriceContainer,
            y: peekY,
            scale: 0.3,
            duration: dur(100),
            ease: 'Sine.easeOut'
          });
          tl.add({
            targets: dialogPriceContainer,
            x: priceTargetX,
            y: midY,
            scale: 0.5,
            duration: dur(250),
            ease: 'Sine.easeOut'
          });
          tl.add({
            targets: dialogPriceContainer,
            x: priceTargetX,
            y: priceTargetY,
            scale: 0.8,
            duration: dur(250),
            ease: 'Sine.easeOut',
            onStart: ()=> dialogPriceContainer.setDepth(frontDepth)
          });
          tl.setCallback('onComplete', () => {
            if (typeof fadeInButtons === 'function') {
              fadeInButtons.call(this, canSell);
            } else {
              if (canSell) {
                btnSell.setVisible(true);
                if (btnSell.zone && btnSell.zone.input) btnSell.zone.input.enabled = true;
              } else {
                btnSell.setVisible(false);
                if (btnSell.zone && btnSell.zone.input) btnSell.zone.input.enabled = false;
              }
              btnGive.setVisible(true);
              if (btnGive.zone && btnGive.zone.input) btnGive.zone.input.enabled = true;
              if (btnRef.zone && btnRef.zone.input) btnRef.zone.input.enabled = true;
            }
          });
          tl.play();
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

    function clearDialog(keepPrice=false, resetTicket=true){
    GameState.dialogActive = false;
    if(!keepPrice){
      dialogBg.setVisible(false);
      dialogText.setVisible(false);
      dialogCoins.setVisible(false);
      dialogPriceContainer.setVisible(false);
      dialogPriceValue.setColor('#006400').setStyle({fontStyle:'', strokeThickness:0});
      if(dialogDrinkEmoji && dialogDrinkEmoji.stopHalo) dialogDrinkEmoji.stopHalo();
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
    if (dialogPriceValue.parentContainer !== dialogPriceContainer) {
      dialogPriceContainer.add(dialogPriceValue);
    }
    // Keep the drink emoji visible when the price ticket remains on screen
    if(!keepPrice){
      dialogDrinkEmoji.setVisible(false);
    }else{
      dialogDrinkEmoji.setVisible(true);
    }
    if(resetTicket){
      resetPriceBox.call(this);
    }
    btnSell.setVisible(false);
    if (btnSell.zone && btnSell.zone.input) btnSell.zone.input.enabled = false;
    if(btnSell.glow){
      if(btnSell.glowTween && btnSell.glowTween.remove) btnSell.glowTween.remove();
      btnSell.glowTween=null;
      btnSell.glow.setVisible(false);
    }
    btnGive.setVisible(false);
    if (btnGive.zone && btnGive.zone.input) btnGive.zone.input.enabled = false;
    if(btnGive.glow){
      btnGive.glow.setVisible(false);
    }
    btnRef.setVisible(false);
    if (btnRef.zone && btnRef.zone.input) btnRef.zone.input.enabled = false;
    tipText.setVisible(false);

  }

  function flingTicketEmojiToCustomer(target, type, loveDelta, cb){
    if(!dialogDrinkEmoji || !dialogPriceContainer || !dialogPriceContainer.visible || !target) return;
    if(dialogDrinkEmoji.stopHalo) dialogDrinkEmoji.stopHalo();
    let worldX = dialogDrinkEmoji.x;
    let worldY = dialogDrinkEmoji.y;
    if(dialogDrinkEmoji.getWorldTransformMatrix){
      const m = dialogDrinkEmoji.getWorldTransformMatrix();
      worldX = m.tx;
      worldY = m.ty;
    }
    if(dialogDrinkEmoji.parentContainer){
      dialogPriceContainer.remove(dialogDrinkEmoji);
      this.add.existing(dialogDrinkEmoji);
    }
    dialogDrinkEmoji.setPosition(worldX, worldY);
    dialogDrinkEmoji.attachedTo = null;
    this.tweens.add({
      targets: dialogDrinkEmoji,
      x: target.x + DRINK_HOLD_OFFSET.x,
      y: target.y + DRINK_HOLD_OFFSET.y,
      scale: 0.5,
      duration: dur(300),
      ease: 'Cubic.easeIn',
      onComplete: () => {
        dialogDrinkEmoji.attachedTo = target;
        const react = () => {
          showDrinkReaction.call(this, target, type, dialogDrinkEmoji, loveDelta, cb);
        };
        if(target.isDog && type==='give'){
          // shrink the treat into the dog before the power up
          const tl = this.tweens.createTimeline();
          tl.add({ targets: dialogDrinkEmoji, scale: 0, duration: dur(150), ease:'Cubic.easeIn' });
          tl.add({ targets: dialogDrinkEmoji, alpha:0, duration: dur(80) });
          tl.setCallback('onComplete', () => {
            animateDogPowerUp(this, target, react, PUP_CUP_TINT);
          }, []);
          tl.play();
        } else if (this.time) {
          this.time.delayedCall(dur(100), react, [], this);
        } else {
          react();
        }
      }
    });
  }

  function showDrinkReaction(target, type, emojiObj, loveDelta, cb){
    if(!target){ if(cb) cb(); return; }
    let faces;
    let delay;
    if(type==='refuse'){
      faces = UPSET_EMOJIS;
      delay = 500;
    }else if(type==='give'){
      faces = LOVE_FACE_EMOJIS;
      delay = loveDelta ? 250 : 500;
    }else{
      faces = loveDelta ? HAPPY_FACE_EMOJIS : NEUTRAL_FACE_EMOJIS;
      delay = loveDelta ? 250 : 500;
    }
    const face = faces[Phaser.Math.Between(0, faces.length-1)];
    const rx = target.x + DRINK_HOLD_OFFSET.x;
    const ry = target.y + DRINK_HOLD_OFFSET.y;
    let emo = emojiObj;
    if(emo){
      if(emo.setText) emo.setText(face);
      if(emo.setPosition) emo.setPosition(rx, ry);
      // reset scaling from any previous drink animations
      emo.setScale(1);
      emo.setVisible(true).setAlpha(1).setScale(24/28);
      if(emo.base && emo.base.setScale) emo.base.setScale(1);
    }else{
      emo = this.add.text(rx, ry, face, {font:'24px sans-serif', fill:'#fff'})
        .setOrigin(0.5).setDepth(11);
    }

    this.time.delayedCall(dur(delay), () => {
      if(loveDelta){
        if(emojiObj) emojiObj.attachedTo = null;
        animateLoveChange.call(this, loveDelta, target, () => {
          if(emojiObj){
            emo.attachedTo = null;
            emo.setVisible(false);
            emo.setAlpha(1);
            emo.setScale(1);
          } else {
            emo.destroy();
          }
          if(cb) cb();
        }, emo.x, emo.y, emo);
      } else if(cb){
        if(emojiObj){
          emo.attachedTo = null;
          emo.setVisible(false);
          emo.setAlpha(1);
          emo.setScale(1);
        } else {
          emo.destroy();
        }
        cb();
      }
    }, [], this);
  }

  function handleAction(type){
    const current=GameState.activeCustomer;
    if (current) {
      GameState.saleInProgress = true;
    }
    if(!current){
      clearDialog.call(this, type!=='refuse');
      return;
    }
    if(type==='refuse' && current.dog){
      if(current.dog.followEvent) current.dog.followEvent.remove(false);
      current.dog.followEvent = null;
    }

    const totalCost=current.orders.reduce((s,o)=>s+o.price*o.qty,0);

    let mD=0, lD=0, tip=0;
    if(type==='sell'){
      mD=totalCost;
    } else if(type==='give'){
      mD=-totalCost;
    }

    const memory = current.memory || {state: CustomerState.NORMAL};
    const prevMood = memory.state;

    switch(memory.state){
      case CustomerState.BROKEN:
        if(type==='refuse') {
          lD = -3;
        } else if(type==='sell') {
          lD = 0;
          memory.state = CustomerState.MENDING;
        } else if(type==='give') {
          lD = 0;
          memory.state = CustomerState.NORMAL;
        }
        break;
      case CustomerState.MENDING:
        if(type==='refuse') {
          lD = -2;
          memory.state = CustomerState.BROKEN;
        } else if(type==='sell') {
          lD = 0;
          memory.state = CustomerState.NORMAL;
        } else if(type==='give') {
          lD = 1;
          memory.state = CustomerState.NORMAL;
        }
        break;
      case CustomerState.GROWING:
        if(type==='refuse') {
          lD = -2;
          memory.state = CustomerState.BROKEN;
        } else if(type==='sell') {
          lD = 1;
        } else if(type==='give') {
          lD = 2;
          memory.state = CustomerState.SPARKLING;
        }
        break;
      case CustomerState.SPARKLING:
        if(type==='refuse') {
          lD = -3;
          memory.state = CustomerState.BROKEN;
        } else if(type==='sell') {
          lD = 2;
        } else if(type==='give') {
          lD = 3;
          memory.state = CustomerState.ARROW;
        }
        break;
      case CustomerState.ARROW:
        if(type==='refuse') {
          lD = -5;
          memory.state = CustomerState.BROKEN;
        } else if(type==='sell') {
          lD = 3;
        } else if(type==='give') {
          lD = 5;
        }
        break;
      default: // NORMAL
        if(type==='refuse') {
          lD = -1;
          memory.state = CustomerState.BROKEN;
        } else if(type==='sell') {
          lD = 0;
        } else if(type==='give') {
          lD = 1;
          memory.state = CustomerState.GROWING;
        }
    }

    if(current.isDog){
      if(type==='give') {
        memory.state = nextMood(memory.state);
        const dogSprite = current.sprite;
        if(dogSprite){
          const base = dogSprite.baseScaleFactor || dogSprite.scaleFactor || 0.6;
          dogSprite.baseScaleFactor = base;
          const max = base * 2;
          // defer applying the new scale until after the power-up animation
          dogSprite.pendingScaleFactor = Math.min(dogSprite.scaleFactor * 1.5, max);
        }
      }
      if(type==='refuse') memory.state = CustomerState.BROKEN;
    }
    if(type==='refuse'){
      memory.state = CustomerState.BROKEN;
    }

    let barkCount = 0;
    if(type==='refuse' && current.isDog){
      if(prevMood === CustomerState.MENDING) barkCount = 2;
      else if(prevMood === CustomerState.BROKEN) barkCount = 3;
      else barkCount = 1;
      lD = -barkCount;
    }
    if (!current.sprite || !current.sprite.scene) {
      clearDialog.call(this, type!=='refuse');
      return;
    }
    if(!current.heartEmoji || !current.heartEmoji.scene || !current.heartEmoji.active){
      if(current.heartEmoji && current.heartEmoji.destroy){
        current.heartEmoji.destroy();
      }
      const scene = current.sprite.scene || this;
      current.heartEmoji = scene.add.text(current.sprite.x, current.sprite.y, '', { font: '28px sans-serif' })
        .setOrigin(0.5)
        .setShadow(0,0,'#000',4);
    }
    if(current.heartEmoji && current.heartEmoji.scene && current.heartEmoji.active){
      const hy = current.sprite.y + current.sprite.displayHeight * 0.30;
      const hs = scaleForY(current.sprite.y) * 0.8;
      current.heartEmoji
        .setText(HEART_EMOJIS[memory.state] || '')
        .setPosition(current.sprite.x, hy)
        .setScale(hs)
        .setDepth(current.sprite.depth)
        .setShadow(0,0,'#000',4);
    }

    // Track how many animations need to finish before resolving
    let pending = (type !== 'refuse' ? 1 : 0);
    if (lD !== 0) pending += 1;
    if (type === 'refuse' && lD !== 0) pending += 1;
    const done = () => { if (--pending <= 0) finish(); };

    if(type==='refuse'){
      if(current.isDog){
        animateBarkPenalty.call(this, current.sprite, barkCount, done);
      }else{
        showDrinkReaction.call(this, current.sprite, 'refuse', null, lD, done);
      }
    }

    if(type==='refuse' && current.dog && current.dog.dogCustomer &&
       current.dog.dogCustomer.memory.state === CustomerState.BROKEN){
      dogTruckRuckus.call(this, current.dog);
    }

    if(type==='give' && current && current.isDog && dialogPupCup){
      dialogPupCup.setTexture('pupcup');
    }
    if ((type==='sell' || type==='give') && dialogDrinkEmoji && dialogPriceContainer && dialogPriceContainer.visible) {
      dialogDrinkEmoji.clearTint();
      flingTicketEmojiToCustomer.call(this, current.sprite, type, lD, lD!==0?done:null);
    }
    if(current){
      const bubbleObjs=[];
      if(typeof dialogBg!=='undefined') bubbleObjs.push(dialogBg);
      if(typeof dialogText!=='undefined') bubbleObjs.push(dialogText);
      if(typeof dialogCoins!=='undefined') bubbleObjs.push(dialogCoins);
      const ticket = typeof dialogPriceContainer!=='undefined' ? dialogPriceContainer : null;
      if(this.tweens && (bubbleObjs.length || ticket)){
        if(type==='refuse'){
          if(dialogBg.setTint) dialogBg.setTintFill(0xff0000);
          if(dialogText.setColor) dialogText.setColor('#f00');
          if(dialogCoins.setColor) dialogCoins.setColor('#f00');
          if(ticket){
            this.tweens.add({targets:ticket, x:-40, alpha:0,
                            duration:dur(300), ease:'Cubic.easeIn'});
          }
          // Move each dialog element downward together rather than
          // converging on a single absolute Y position.
          if(btnRef){
            this.tweens.add({
              targets: btnRef,
              y: btnRef.y + 80,
              alpha: 0,
              duration: dur(300),
              ease: 'Cubic.easeIn'
            });
          }
          this.tweens.add({targets:bubbleObjs, y:'+=80', scale:1.5, alpha:0,
                          duration:dur(300), ease:'Cubic.easeIn', onComplete:()=>{
            if(dialogBg.clearTint) dialogBg.clearTint();
            if(dialogText.setColor) dialogText.setColor('#000');
            if(dialogCoins.setColor) dialogCoins.setColor('#000');
            clearDialog.call(this, false);
            done();
          }});
        } else {
          // Only animate the dialog bubble away. Leave the price ticket
          // visible so it can fly over to the score area.
          this.tweens.add({targets:bubbleObjs, y:current.sprite.y, scale:0, duration:dur(200), onComplete:()=>{
            clearDialog.call(this, true, type!=='give');
          }});
        }
      } else {
        clearDialog.call(this, type!=='refuse');
      }
    } else {
      clearDialog.call(this, type!=='refuse');
    }

    if(type==='sell'){
      let pct=0;
      switch(memory.state){
        case CustomerState.BROKEN:
        case CustomerState.MENDING:
          pct=0;
          break;
        case CustomerState.NORMAL:
          pct = Phaser.Math.Between(0,1)===0 ? 0.25 : 0;
          break;
        case CustomerState.GROWING:
          pct=0.25;
          break;
        case CustomerState.SPARKLING:
          pct=0.50;
          break;
        case CustomerState.ARROW:
          pct=1.00;
          break;
        default:
          pct=0;
      }

      const coins=current.orders[0].coins;
      const maxTip=Math.max(0, coins-totalCost);
      const desiredTip=totalCost*pct;
      tip=+Math.min(desiredTip, maxTip).toFixed(2);
      mD += tip;
      growSellGlow.call(this, tip>0);
    }

    const tipPct=type==='sell'? (totalCost>0? Math.round((tip/totalCost)*100):0):0;
    const customer=current.sprite;
    setActiveCustomer(null);

    const finish=()=>{
      GameState.saleInProgress = false;
      const exit=()=>{
        GameState.orderInProgress = false;
        current.exitHandler = null;
        if(dialogDrinkEmoji && dialogDrinkEmoji.attachedTo === current.sprite){
          dialogDrinkEmoji.attachedTo = null;
          dialogDrinkEmoji.setVisible(false);
        }
        if(current.isDog && current.owner && (current.owner.waitingForDog || current.owner.exitHandler)){
          const owner=current.owner;
          const dir = Phaser.Math.Between(0,1)?1:-1;
          const startX=owner.sprite.x;
          const targetY=700;
          const distanceX=Phaser.Math.Between(80,160)*dir;
          const amp=Phaser.Math.Between(10,25);
          const freq=Phaser.Math.Between(2,4);
          owner.exitX=startX+distanceX;
          owner.exitY=targetY;
          current.exitX=owner.exitX;
          current.exitY=owner.exitY;
          this.tweens.add({targets:owner.sprite,y:targetY,duration:dur(6000),callbackScope:this,
            onUpdate:(tw,t)=>{const p=tw.progress; t.x=startX+p*distanceX+Math.sin(p*Math.PI*freq)*amp; t.setScale(scaleForY(t.y));
              if(owner.heartEmoji && owner.heartEmoji.scene && owner.heartEmoji.active){
                const hy=t.y+t.displayHeight*0.30;
                const hs=scaleForY(t.y)*0.8;
                owner.heartEmoji
                  .setPosition(t.x, hy)
                  .setScale(hs)
                  .setDepth(t.depth)
                  .setShadow(0, 0, '#000', 4);
              }
            },
            onComplete:owner.exitHandler});
          sendDogOffscreen.call(this,current.sprite,owner.exitX,owner.exitY);
          owner.dog = null;
          return;
        } else if(current.dog){
          if(typeof current.exitX==='number' && typeof current.exitY==='number'){
            sendDogOffscreen.call(this,current.dog,current.exitX,current.exitY);
          } else {
            if(current.dog.followEvent) current.dog.followEvent.remove(false);
            current.dog.destroy();
          }
        }
        if(current.heartEmoji && current.heartEmoji.scene && current.heartEmoji.active){
          current.heartEmoji.destroy();
        }
        current.heartEmoji = null;
        const winSpriteKey = current.sprite.texture ? current.sprite.texture.key : current.spriteKey;
        const mem = current.memory;
        if (mem) {
          mem.cooldownUntil = (this.time ? this.time.now : Date.now()) + RESPAWN_COOLDOWN;
        }
        current.sprite.destroy();
        if(GameState.money<=0 && !GameState.falconDefeated){
          showFalconAttack.call(this,()=>{
            showFalconLoss.call(this);
          });
          return;
        }
        if(GameState.love<=0){
          showCustomerRevolt.call(this,()=>{
            showCustomerRevoltLoss.call(this);
          });
          return;
        }
        if(GameState.money>=FIRED_THRESHOLD){
          showHighMoneyLoss.call(this);
          return;
        }
        if(GameState.love>=MAX_L){showLoveVictory.call(this);return;}
        if(GameState.heartWin){
          showTrueLoveVictory.call(this, winSpriteKey);
          GameState.heartWin = null;
          return;
        }
        scheduleNextSpawn(this);
        GameState.servedCount++;
        updateSideC.call(this);
      };

      const sprite=current.sprite;
      setDepthFromBottom(sprite,5);

      // Remove the current customer from the queue
      GameState.queue.shift();

      if(current.dogCustomer && !current.isDog){
        const dogCust = current.dogCustomer;
        if(current.dog && current.dog.followEvent){
          current.dog.followEvent.remove(false);
          current.dog.followEvent = null;
        }
        if(current.dog && current.dog.currentTween){
          current.dog.currentTween.stop();
          current.dog.currentTween = null;
        }
        if(dogCust.walkTween){
          if(dogCust.walkTween.isPlaying && dogCust.walkTween.stop) dogCust.walkTween.stop();
          if(dogCust.walkTween.remove) dogCust.walkTween.remove();
          dogCust.walkTween = null;
        }
        if(dogCust.followEvent){ dogCust.followEvent.remove(false); dogCust.followEvent=null; }
        dogCust.atOrder = false;
        dogCust.arrived = true;
        dogCust.arrivalTime = this.time ? this.time.now : Date.now();
        GameState.queue.unshift(dogCust);
        const waitX = ORDER_X + 50;
        this.tweens.add({
          targets: sprite,
          x: waitX,
          duration: dur(300),
          onUpdate: (tw, t) => {
            if (current.heartEmoji && current.heartEmoji.scene && current.heartEmoji.active) {
              const hy = t.y + t.displayHeight * 0.30;
              const hs = scaleForY(t.y) * 0.8;
              current.heartEmoji
                .setPosition(t.x, hy)
                .setScale(hs)
                .setDepth(t.depth)
                .setShadow(0, 0, '#000', 4);
            }
          }
        });
        current.waitingForDog = true;
        startDogWaitTimer(this, current);
        current.exitHandler = exit;
        setActiveCustomer(dogCust);
        // Keep the order marked in progress until the dog finishes
        GameState.orderInProgress = true;
        showDialog.call(this);
        return;
      }

      moveQueueForward.call(this);

      if(current.dog && !current.dog.followEvent){
        current.dog.followEvent = this.time.addEvent({
          delay: dur(Phaser.Math.Between(800, 1200)),
          loop: true,
          callback: () => { if (typeof updateDog === 'function') updateDog.call(this, current); }
        });
      }

      if(current.isDog && current.owner && (current.owner.waitingForDog || current.owner.exitHandler)){
        const owner=current.owner;
        if (owner.dogWaitEvent) {
          owner.dogWaitEvent.remove(false);
          owner.dogWaitEvent = null;
        }
        owner.waitingForDog=false;
        const dir = Phaser.Math.Between(0,1)?1:-1;
        const startX=owner.sprite.x;
        const targetY=700;
        const distanceX=Phaser.Math.Between(80,160)*dir;
        const amp=Phaser.Math.Between(10,25);
        const freq=Phaser.Math.Between(2,4);
        owner.exitX=startX+distanceX;
        owner.exitY=targetY;
        current.exitX=owner.exitX;
        current.exitY=owner.exitY;
        this.tweens.add({targets:owner.sprite,y:targetY,duration:dur(6000),callbackScope:this,
          onUpdate:(tw,t)=>{const p=tw.progress; t.x=startX+p*distanceX+Math.sin(p*Math.PI*freq)*amp; t.setScale(scaleForY(t.y));
            if(owner.heartEmoji && owner.heartEmoji.scene && owner.heartEmoji.active){
              const hy=t.y+t.displayHeight*0.30;
              const hs=scaleForY(t.y)*0.8;
              owner.heartEmoji
                .setPosition(t.x, hy)
                .setScale(hs)
                .setDepth(t.depth)
                .setShadow(0, 0, '#000', 4);
            }
          },
          onComplete:owner.exitHandler});
        if(current.followEvent) current.followEvent.remove(false);
        current.followEvent = this.time.addEvent({
          delay: dur(Phaser.Math.Between(800, 1200)),
          loop: true,
          callback: () => { if (typeof updateDog === 'function') updateDog.call(this, owner); }
        });
        return;
      }

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
          duration: dur(3000),
          callbackScope: this,
          onUpdate: (tw, t) => {
            const p = tw.progress;
            t.x = startX + p * distanceX + Math.sin(p * Math.PI * freq) * amp;
            t.setScale(scaleForY(t.y) * (t.scaleFactor || 1));
            if(current.heartEmoji && current.heartEmoji.scene && current.heartEmoji.active){
              const hy = t.y + t.displayHeight * 0.30;
              const hs = scaleForY(t.y) * 0.8;
              current.heartEmoji
                .setPosition(t.x, hy)
                .setScale(hs)
                .setDepth(t.depth)
                .setShadow(0, 0, '#000', 4);
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
          onUpdate:(tw,t)=>{const p=tw.progress; t.x=startX+p*distanceX+Math.sin(p*Math.PI*freq)*amp; t.setScale(scaleForY(t.y) * (t.scaleFactor || 1));
            if(current.heartEmoji && current.heartEmoji.scene && current.heartEmoji.active){
              const hy = t.y + t.displayHeight * 0.30;
              const hs = scaleForY(t.y) * 0.8;
              current.heartEmoji
                .setPosition(t.x, hy)
                .setScale(hs)
                .setDepth(t.depth)
                .setShadow(0, 0, '#000', 4);
            }
          },
          onComplete:exit});
      }
    };

    // animated report using timelines
    const midX=240, midY=120;



    if(type==='sell'){
      const ticket=dialogPriceContainer;
      const t=dialogPriceValue;
      const destX=moneyText.x;
      const destY=moneyText.y;
      t.setVisible(true);
      // start below the stamp so the stamp appears on top first
      t.setDepth(paidStamp.depth-1);
      const baseLeft = t.x - t.displayWidth/2;
      t.setText(receipt(totalCost));
      t.setPosition(baseLeft + t.displayWidth/2, t.y);
      // Price border will blink; no additional flash needed
      const ticketH = dialogPriceBox.height;
      let centerX = ticket.x;
      let stampY = ticket.y;
      if (ticket.getWorldTransformMatrix) {
        const m = ticket.getWorldTransformMatrix();
        centerX = m.tx;
        stampY = m.ty;
      }
      stampY -= ticketH * 0.2;
      const randFloat = Phaser.Math.FloatBetween || ((a,b)=>Phaser.Math.Between(a*1000,b*1000)/1000);
      const skewFn = typeof applyRandomSkew === 'function' ? applyRandomSkew : ()=>{};
      const finalScale = 1.2 + randFloat(-0.05, 0.05);
      const targetX = centerX + Phaser.Math.Between(-3,3);
      const targetY = stampY + Phaser.Math.Between(-3,3);
      const targetAngle = Phaser.Math.Between(-10,10);
      let startX = t.x;
      let startY = t.y;
      if (t.getWorldTransformMatrix) {
        const m2 = t.getWorldTransformMatrix();
        startX = m2.tx;
        startY = m2.ty;
      }
      paidStamp
        .setText('SOLD')
        .setScale(finalScale * 0.5)
        .setPosition(startX, startY)
        .setAngle(0)
        .setVisible(true);
      this.tweens.add({
        targets: paidStamp,
        x: targetX,
        y: targetY,
        angle: targetAngle,
        scale: finalScale,
        duration: dur(200),
        ease: 'Cubic.easeOut',
        onComplete: () => { skewFn(paidStamp); }
      });
      // raise the price above the stamp after the stamp lands
      this.time.delayedCall(dur(300), () => {
        if (dialogPriceValue.parentContainer) {
          const m = dialogPriceValue.getWorldTransformMatrix();
          dialogPriceContainer.remove(dialogPriceValue);
          this.add.existing(dialogPriceValue);
          dialogPriceValue.setPosition(m.tx, m.ty);
        }
        t.setDepth(paidStamp.depth + 1);
        // Keep the price text green after the sale
        t.setColor('#006400');
        // Removed blinkPriceBorder; no need to flash the price text
      }, [], this);
      // Removed flashing movement of the price text

      let delay=dur(300);
      if(tip>0){
        this.time.delayedCall(delay,()=>{
          const oldLeft = t.x - t.displayWidth/2;
          const randFloat2 = Phaser.Math.FloatBetween || ((a,b)=>Phaser.Math.Between(a*1000,b*1000)/1000);
          tipText
            .setText('TIP')
            .setScale(1.3 + randFloat2(-0.1, 0.1))
            .setPosition(paidStamp.x, paidStamp.y)
            .setAngle(Phaser.Math.Between(-15,15))
            .setVisible(true)
            .setDepth(paidStamp.depth);
          skewFn(tipText);
          const blinkTween = this.tweens.add({
            targets: tipText,
            alpha: 0,
            duration: dur(80),
            yoyo: true,
            repeat: -1
          });
          this.tweens.add({
            targets: tipText,
            x: t.x,
            y: t.y,
            duration: dur(200),
            ease: 'Back.easeOut',
            onComplete: () => {
              blinkTween.stop();
              tipText.setAlpha(1);
              this.tweens.add({
                targets: tipText,
                x: paidStamp.x,
                y: paidStamp.y + tipText.displayHeight,
                angle: Phaser.Math.Between(-15,15),
                duration: dur(300),
                ease: 'Bounce.easeOut'
              });
            }
          });
          countPrice(t, this, totalCost, totalCost + tip, oldLeft, t.y);
          // Removed blinkPriceBorder; price text stays static
          // no scaling or flash animation for price text
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
            stopSellGlowSparkle.call(this, () => {
              clearDialog.call(this);
              ticket.setVisible(false);
              updateMoney(mD);
              updateMoneyDisplay();
              animateStatChange(moneyText, this, mD);
              if(moneyDollar) animateStatChange(moneyDollar, this, mD);
              done();
            });
          }});
        tl.add({
          targets: ticket,
          y: '-=60',
          angle: '-=10',
          duration: dur(80),
          ease: 'Cubic.easeOut',
          onStart: () => {
            if(!dialogPriceValue.parentContainer){
              ticket.add(dialogPriceValue);
              dialogPriceValue.setPosition(-5, priceValueYOffset + 5);
            }
            flashBorder(dialogPriceBox,this,0x00ff00);
            flashFill(dialogPriceBox,this,0x00ff00);
            if(this.tweens){
              this.tweens.add({targets:dialogPriceBox,fillAlpha:0,duration:dur(400)});
            }
            if(dialogDrinkEmoji){
              dialogDrinkEmoji.clearTint();
            }
          }
        });
        tl.add({
          targets: ticket,
          props: {
            x: { value: destX, ease: 'Sine.easeIn' },
            y: { value: destY, ease: 'Quad.easeIn' }
          },
          angle: '-=10',
          scale: 0,
          duration: dur(400)
        });
        tl.play();
      },[],this);
        } else if(type==='give'){
      const ticket=dialogPriceContainer;
      const t=dialogPriceValue;
      const destX=moneyText.x;
      const destY=moneyText.y;
      if(current.isDog){
        // Pup cup: keep the ticket visible briefly so the dessert emoji can fly
        // to the dog before the ticket fades away.
        this.time.delayedCall(dur(1000), () => {
          this.tweens.add({
            targets: ticket,
            alpha: 0,
            duration: dur(200),
            ease: 'Cubic.easeIn',
            onComplete: () => {
              clearDialog.call(this);
              ticket.setVisible(false);
              updateMoney(mD);
              updateMoneyDisplay();
              animateStatChange(moneyText, this, mD);
              if(moneyDollar) animateStatChange(moneyDollar, this, mD);
              done();
            }
          });
        }, [], this);
      } else {
        t.setVisible(true)
          // start below the stamp so the stamp animation appears on top
          .setDepth(lossStamp.depth-1)
          .setStyle({fontStyle:'bold', strokeThickness:0});
        const ticketH = dialogPriceBox.height;
        let centerX = ticket.x;
        let stampY = ticket.y;
        if (ticket.getWorldTransformMatrix) {
          const m = ticket.getWorldTransformMatrix();
          centerX = m.tx;
          stampY = m.ty;
        }
        stampY -= ticketH * 0.2;
        const stampX = centerX + Phaser.Math.Between(-5,5);
        const stampYFinal = stampY + Phaser.Math.Between(-3,3);
        const randFloat3 = Phaser.Math.FloatBetween || ((a,b)=>Phaser.Math.Between(a*1000,b*1000)/1000);
        const skewFn2 = typeof applyRandomSkew === 'function' ? applyRandomSkew :()=>{};
        lossStamp
          .setText('LOSS')
          .setScale(1.25 + randFloat3(-0.1, 0.1))
          .setPosition(stampX, stampYFinal)
          .setAngle(Phaser.Math.Between(-10,10))
          .setVisible(true);
        skewFn2(lossStamp);
        this.time.delayedCall(dur(500), () => {
          const flick = this.tweens.createTimeline();
          flick.add({ targets: lossStamp, alpha: 0.5, duration: dur(60), yoyo: true, repeat: 2 });
          flick.add({ targets: lossStamp, alpha: 0, duration: dur(300) });
          flick.setCallback('onComplete', () => {
            lossStamp.setVisible(false);
            lossStamp.setAlpha(1);
          });
          flick.play();
        }, [], this);
        // Ticket turns grayscale while the price flashes red
        if(dialogPriceTicket){
          if(dialogPriceTicket.setTexture && this.textures.exists('price_ticket_gray')){
            dialogPriceTicket.setTexture('price_ticket_gray');
          }
          if(dialogPriceTicket.setTint){
            dialogPriceTicket.setTint(0xffffff);
            this.tweens.addCounter({
              from:0,
              to:1,
              duration:dur(1000),
              onUpdate:t=>{
                const p=t.getValue();
                const g=Math.round(255*(1-p));
                dialogPriceTicket.setTint(Phaser.Display.Color.GetColor(255,g,g));
              }
            });
          }
        }
        if (dialogPriceValue && dialogPriceValue.setColor) {
          dialogPriceValue.setColor('#ff0000');
        }
        /*
         * Removed emoji repositioning tween that flew the item over to the
         * customer. The heart animation now appears consistently after giving
         * an item.
         *
         * Original implementation:
         * if (dialogDrinkEmoji) {
         *   if (dialogDrinkEmoji.parentContainer) {
         *     const m = dialogDrinkEmoji.getWorldTransformMatrix();
         *     dialogPriceContainer.remove(dialogDrinkEmoji);
         *     this.add.existing(dialogDrinkEmoji);
         *     dialogDrinkEmoji.setPosition(m.tx, m.ty);
         *   }
         *   dialogDrinkEmoji.setDepth(paidStamp.depth + 1);
         *   this.tweens.add({
         *     targets: dialogDrinkEmoji,
         *     x: customer.x + DRINK_HOLD_OFFSET.x,
         *     y: customer.y + DRINK_HOLD_OFFSET.y,
         *     duration: dur(400),
         *     ease: 'Cubic.easeOut',
         *     onComplete: () => { dialogDrinkEmoji.attachedTo = customer; }
         *   });
         * }
         */
        // raise the price above the stamp after the stamp lands
        this.time.delayedCall(dur(300), () => {
          t.setDepth(lossStamp.depth + 1);
        }, [], this);
        this.time.delayedCall(dur(1000),()=>{
          dialogBg.setVisible(false);
          dialogText.setVisible(false);
          if(this.tweens){
            this.tweens.add({targets:ticket,x:'+=6',duration:dur(60),yoyo:true,repeat:2});
          }
          const tl=this.tweens.createTimeline({callbackScope:this,onComplete:()=>{
              clearDialog.call(this);
              ticket.setVisible(false);
              updateMoney(mD);
              updateMoneyDisplay();
              animateStatChange(moneyText, this, mD);
              if(moneyDollar) animateStatChange(moneyDollar, this, mD);
              done();
          }});
          if (typeof dialogPriceBox !== 'undefined' && dialogPriceBox) {
            flashBorder(dialogPriceBox,this,0xff0000);
            flashFill(dialogPriceBox,this,0xff0000);
          }
          tl.add({
            targets: ticket,
            x: '-=60',
            angle: '-=30',
            alpha: 0.6,
            duration: dur(150),
            ease: 'Cubic.easeOut',
            onStart: () => {
              if(!dialogPriceValue.parentContainer){
                ticket.add(dialogPriceValue);
                dialogPriceValue.setPosition(-5, priceValueYOffset + 5);
              }
              if(this.tweens && typeof dialogPriceBox !== 'undefined' && dialogPriceBox){
                this.tweens.add({targets:dialogPriceBox,fillAlpha:0,duration:dur(400)});
              }
              if(dialogDrinkEmoji){
                dialogDrinkEmoji.clearTint();
              }
            }
          });
          tl.add({
            targets: ticket,
            props: {
              x: { value: destX, ease: 'Sine.easeIn' },
              y: { value: destY, ease: 'Bounce.easeOut' }
            },
            angle: '-=540',
            scale: 0,
            alpha: 0,
            duration: dur(700),
            onUpdate:(tw,t)=>{t.skewX=Math.sin(tw.progress*Math.PI*8)*0.05;},
            onStart: () => {
              if(dialogPriceTicket && dialogPriceTicket.setTint){
                dialogPriceTicket.setTint(0xffffff);
                this.tweens.addCounter({
                  from:0,
                  to:1,
                  duration: dur(700),
                  onUpdate:tween=>{
                    const p=tween.getValue();
                    const g=Math.round(255*(1-p));
                    dialogPriceTicket.setTint(Phaser.Display.Color.GetColor(255,g,g));
                  }
                });
              }
            }
          });
          tl.play();
        },[],this);
      }
} else if(type!=='refuse'){
      const showTip=tip>0;
      const startRX = (typeof girl !== 'undefined' && girl) ? girl.x : customer.x;
      const startRY = (typeof girl !== 'undefined' && girl) ? girl.y : customer.y;
      reportLine1.setStyle({fill:'#fff'})
        .setText(receipt(totalCost))
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

      const destX=moneyText.x;
      const destY=moneyText.y;
      const moving=[reportLine1];
      const tl=this.tweens.createTimeline({callbackScope:this,onComplete:()=>{
          reportLine1.setVisible(false).alpha=1;
          reportLine2.setVisible(false).alpha=1;
          reportLine3.setVisible(false).alpha=1;
          updateMoney(mD);
          updateMoneyDisplay();
          animateStatChange(moneyText, this, mD);
          if(moneyDollar) animateStatChange(moneyDollar, this, mD);
          done();
          
      }});
      tl.add({targets:reportLine1,x:midX,y:midY,duration:dur(300),onComplete:()=>{
            const word='SOLD';
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

    // Reaction happens after the order animation completes
    if(pending===0) finish();
  }

  function animateLoveChange(delta, customer, cb, startX=null, startY=null, emojiObj=null){
    const sprite = customer.sprite || customer;
    const count = Math.max(1, Math.abs(delta));
    const isPos = delta > 0;
    const delay = isPos ? 250 : 500;

    const sx = startX !== null ? startX : sprite.x;
    const sy = startY !== null ? startY : sprite.y;

    const destX = () => loveText.x;
    const destY = () => loveText.y;

    const showFace = () => isPos ? HAPPY_FACE_EMOJIS[Phaser.Math.Between(0, HAPPY_FACE_EMOJIS.length-1)]
                                : UPSET_EMOJIS[Phaser.Math.Between(0, UPSET_EMOJIS.length-1)];

    const popOne = (idx) => {
      if(idx >= count){ if(cb) cb(); return; }
      let h;
      if(idx===0 && emojiObj){
        h = emojiObj;
      } else {
        const face = showFace();
        h = this.add.text(sx, sy, face, {font:'24px sans-serif', fill:'#fff'})
          .setOrigin(0.5).setDepth(10);
      }
      this.time.delayedCall(dur(delay), () => {
        const tl = this.tweens.createTimeline({callbackScope:this});
        // spin the face into a heart (or keep the upset face)
        tl.add({
          targets:h,
          scaleX:0,
          duration:dur(80),
          onComplete:()=>{
            if(isPos){
              h.setText('❤️');
            }
          }
        });
        tl.add({targets:h, scaleX:1, duration:dur(80)});
        // fling the heart toward the love counter
        tl.add({
          targets:h,
          x:destX(),
          y:destY(),
          scaleX:0,
          scaleY:1.2,
          duration:dur(200),
          onComplete:()=>{
            GameState.love += isPos?1:-1;
            loveText.setText(String(GameState.love));
            updateLevelDisplay();
            animateStatChange(loveText, this, isPos?1:-1, true);
          }
        });
        tl.add({targets:h,scaleX:1,alpha:0,duration:dur(150),onComplete:()=>{
              if(!emojiObj || h!==emojiObj) h.destroy();
              if(idx < count-1){
                const n = this.add.text(sx, sy, NEUTRAL_FACE_EMOJIS[0], {font:'24px sans-serif', fill:'#fff'})
                  .setOrigin(0.5).setDepth(10);
                this.time.delayedCall(dur(80), () => { n.destroy(); popOne(idx+1); }, [], this);
              } else {
                popOne(idx+1);
              }
        }});
        tl.play();
      }, [], this);
    };

    popOne(0);
  }

  function animateBarkPenalty(dog, count, cb){
    const sprite = dog;
    if(!sprite || count<=0){ if(cb) cb(); return; }
    const destX = () => loveText.x;
    const destY = () => loveText.y;
    const doOne = (idx) => {
      if(idx >= count){ if(cb) cb(); return; }
      const bark = dogRefuseJumpBark.call(this, sprite, idx===0);
      if(!bark){ doOne(idx+1); return; }
      this.tweens.add({
        targets: bark,
        y: '-=20',
        duration: dur(100),
        yoyo: true
      });
      this.tweens.add({
        targets: bark,
        duration: dur(80),
        repeat: 2,
        yoyo: true,
        onStart: () => bark.setTintFill(0xff0000),
        onYoyo: () => bark.setTintFill(0xff0000),
        onRepeat: () => bark.clearTint(),
        onComplete: () => bark.clearTint()
      });
      this.time.delayedCall(dur(200), () => {
        this.tweens.add({
          targets: bark,
          x: destX(),
          y: destY(),
          scale: 0,
          alpha: 0,
          duration: dur(300),
          onComplete: () => {
            bark.destroy();
            GameState.love -= 1;
            loveText.setText(String(GameState.love));
            updateLevelDisplay();
            animateStatChange(loveText, this, -1, true);
            this.time.delayedCall(dur(80), () => doOne(idx+1), [], this);
          }
        });
      }, [], this);
    };
    scatterSparrows(this);
    doOne(0);
  }

  function startHpBlink(scene, sprite, getHp, maxHp){
    if(!scene || !sprite) return null;
    const cycle = 500;
    const minDur = 100; // ensure flashes are visible even at high HP
    return scene.time.addEvent({
      delay: dur(cycle),
      loop: true,
      callback: () => {
        const hp = typeof getHp === 'function' ? getHp() : maxHp;
        const frac = Phaser.Math.Clamp(1 - hp / maxHp, 0, 1);
        if(frac <= 0){
          sprite.clearTint();
          return;
        }
        const tintDur = dur(Math.max(minDur, cycle * frac));
        sprite.setTintFill(0xff0000);
        scene.time.delayedCall(tintDur, () => { if(sprite) sprite.clearTint(); }, [], scene);
      }
    });
  }

  function flashRed(scene, sprite, duration=250){
    if(!scene || !sprite) return;
    sprite.setTintFill(0xff0000);
    scene.time.delayedCall(dur(duration), ()=>{
      if(sprite && sprite.clearTint){
        if(sprite === GameState.falcon && GameState.falconStunned){
          sprite.setTint(0x3399ff);
        } else {
          sprite.clearTint();
        }
      }
    }, [], scene);
  }

  function showFalconAttack(cb){
    if (GameState.falconActive || GameState.falconDefeated) return;
    const scene=this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
    cleanupBarks();
    cleanupBursts();
    cleanupSparkles(scene);
    scatterSparrows(scene);
    if(scene.gameState.sparrowSpawnEvent){
      scene.gameState.sparrowSpawnEvent.remove(false);
      scene.gameState.sparrowSpawnEvent = null;
    }
    hideOverlayTexts();
    clearDialog.call(scene);
    GameState.falconActive = true;
    GameState.gameOver = true;
    GameState.girlHP = 10;
    GameState.falconHP = 10;
    if (GameState.dogBarkEvent) { GameState.dogBarkEvent.remove(false); }
    GameState.dogBarkEvent = null;
    if (GameState.spawnTimer) { GameState.spawnTimer.remove(false); GameState.spawnTimer = null; }
    const reinDogs=[];
    const reinHumans=[];
    const reinHumanEvents=[];
    const latchedDogs=[];
    const updateLatchedDogs=()=>{
      if(!falcon) return;
      if(!GameState.falconStunned && latchedDogs.length>0){
        [...latchedDogs].forEach(d=>dropLatchedDog(d));
      }
      latchedDogs.forEach(d=>{
        const wiggle = d.wiggleOffset || 0;
        d.setPosition(falcon.x + d.offsetX, falcon.y + d.offsetY + wiggle);
        const s=scaleForY(d.y)*0.5;
        d.setScale(s*(d.dir||1), s);
        d.setDepth(falcon.depth + 1);
        if(d.heartEmoji){
          d.heartEmoji.setPosition(d.x,d.y)
            .setScale(scaleForY(d.y)*0.8)
            .setDepth(d.depth + 1);
        }
      });
    };
    const updateHeart = s => {
      if(s && s.heartEmoji && s.heartEmoji.scene){
        const hy = s.y + (s.displayHeight || 0) * 0.30;
        s.heartEmoji
          .setPosition(s.x, hy)
          .setScale(scaleForY(s.y) * 0.8)
          .setDepth(s.depth);
      }
    };
   const updateReinforcementHearts = () => {
      reinHumans.forEach(updateHeart);
      reinDogs.forEach(updateHeart);
    };

    const groundLevel = () => Math.max(WANDER_TOP, girl.y + 60);
    const ensureOnGround = obj => {
      if(!obj || !obj.y) return;
      const isDog = obj.texture && obj.texture.key === 'dog1';
      const gY = isDog ? DOG_MIN_Y : groundLevel();
      if(obj.y < gY){
        obj.y = gY;
        if(isDog){
          scaleDog(obj);
        }else if(obj.setScale){
          obj.setScale(scaleForY(obj.y));
        }
      }
    };


        function panicCustomers(done){
      const fleeing=[...GameState.queue, ...GameState.wanderers];
      if(GameState.activeCustomer && !fleeing.includes(GameState.activeCustomer)){
        fleeing.push(GameState.activeCustomer);
      }
      const known=new Set(fleeing.map(c=>c.sprite));
      scene.children.list.forEach(child=>{
        if(child.texture && keys.includes(child.texture.key) && !known.has(child)){
          fleeing.push({sprite:child});
          known.add(child);
        }
      });
      scene.children.list.forEach(child=>{
        if(child instanceof Phaser.GameObjects.Text &&
           DOG_TYPES.some(d=>d.emoji===child.text) &&
           !fleeing.some(c=>c.dog===child)){
          const dir=child.x<ORDER_X?-1:1;
          const targetX=dir===1?520:-40;
          sendDogOffscreen.call(scene, child, targetX, child.y);
        }
      });

      let remaining=fleeing.length;
      if(remaining===0){ if(done) done(); return; }

      fleeing.forEach(c=>{
        const state=c.memory && c.memory.state || CustomerState.NORMAL;
        if(c.heartEmoji){ c.heartEmoji.destroy(); c.heartEmoji=null; }
        if(c.walkTween){
          if(c.walkTween.isPlaying && c.walkTween.stop) c.walkTween.stop();
          c.walkTween=null;
        }
        const dir=c.sprite.x<ORDER_X?-1:1;
        const targetX=dir===1?520:-40;

        const runOff=()=>scene.tweens.add({targets:c.sprite,x:targetX,duration:dur(WALK_OFF_BASE/1.2),onComplete:()=>{c.sprite.destroy();remaining--;if(remaining===0&&done)done();}});

        if(state===CustomerState.BROKEN){
          runOff();
          if(c.dog){
            if(c.dog.followEvent) c.dog.followEvent.remove(false);
            const ddir=c.dog.x<ORDER_X?-1:1;
            const dx=ddir===1?520:-40;
            sendDogOffscreen.call(scene,c.dog,dx,c.dog.y);
          }
          return;
        }

        if(state===CustomerState.NORMAL){
          const tl=scene.tweens.createTimeline();
          for(let i=0;i<5;i++){
            tl.add({targets:c.sprite,x:Phaser.Math.Between(40,440),y:Phaser.Math.Between(WANDER_TOP,WANDER_BOTTOM),duration:dur(Phaser.Math.Between(300,500)),ease:'Sine.easeInOut'});
          }
          tl.add({targets:c.sprite,x:targetX,duration:dur(WALK_OFF_BASE/1.2),onStart:()=>{if(c.dog){scene.tweens.killTweensOf(c.dog);if(c.dog.followEvent)c.dog.followEvent.remove(false);}},onComplete:()=>{c.sprite.destroy();remaining--;if(remaining===0&&done)done();}});
          tl.play();
          if(c.dog){
            const dog=c.dog;
            if(!dog) { return; }
            if(dog.followEvent) dog.followEvent.remove(false);
            const { scale, rise } = barkProps(dog);
            const bark=scene.add.sprite(dog.x,dog.y-20,'dog1',3).setOrigin(0.5).setDepth(dog.depth+1).setScale(Math.abs(dog.scaleX)*scale,Math.abs(dog.scaleY)*scale);
            scene.tweens.add({targets:bark,y:`-=${rise}`,alpha:0,duration:dur(600),onComplete:()=>bark.destroy()});
            const dTl=scene.tweens.createTimeline();
            for(let j=0;j<4;j++){
              const ang=Phaser.Math.FloatBetween(0,Math.PI*2);
              const r=Phaser.Math.Between(40,60);
              const dx=girl.x+Math.cos(ang)*r;
              const dy=girl.y+Math.sin(ang)*r;
              dTl.add({targets:dog,x:dx,y:dy,duration:dur(Phaser.Math.Between(300,450)),ease:'Sine.easeInOut'});
            }
            dTl.setCallback('onUpdate',()=>{
              if(dog.prevX===undefined) dog.prevX=dog.x;
              const dx=dog.x-dog.prevX;
              if(Math.abs(dx)>3){ dog.dir=dx>0?1:-1; }
              dog.prevX=dog.x;
              const s=scaleForY(dog.y)*0.5;
              dog.setScale(s*(dog.dir||1), s);
            }, []);
            dTl.setCallback('onComplete',()=>{ if(dog) dog.setFrame(1); }, []);
            if(dog && dog.anims && dog.play){ dog.play('dog_walk'); }
            dTl.play();
          }
          return;
        }

        if(state===CustomerState.GROWING || state===CustomerState.SPARKLING || state===CustomerState.ARROW){
          const sx = girl.x + Phaser.Math.Between(-60,60);
          const sy = girl.y + Phaser.Math.Between(30,50);
          c.sprite.loveState = state;
          reinHumans.push(c.sprite);
          scene.tweens.add({
            targets:c.sprite,
            x:sx,
            y:sy,
            scale:scaleForY(sy),
            duration:dur(500),
            onComplete:()=>{
              c.sprite.baseX = c.sprite.x;
              c.sprite.baseY = c.sprite.y;
              c.sprite.ready = true;
              c.sprite.active = true;
              startDefender(c.sprite);
              remaining--; if(remaining===0&&done)done();
            }
          });
          return;
        }

        runOff();
      });
    }
function dogsBarkAtFalcon(){
      const dogs=[];
      const gatherDog=c=>{ if(c && c.dog && !c.dog.dead) dogs.push(c.dog); };
      GameState.queue.forEach(gatherDog);
      GameState.wanderers.forEach(gatherDog);
      gatherDog(GameState.activeCustomer);
      reinDogs.forEach(d=>dogs.push(d));
      if(dogs.length===0) return;
        dogs.forEach(dog=>{
          if(dog.dead || dog.barkReady === false) return;
          const mood=dog.dogCustomer && dog.dogCustomer.memory ? dog.dogCustomer.memory.state : CustomerState.NORMAL;
        if(mood===CustomerState.BROKEN || mood===CustomerState.MENDING || mood===CustomerState.NORMAL){
          if(!dog.fled){
            if(dog.followEvent) dog.followEvent.remove(false);
            const dir=dog.x<ORDER_X?-1:1;
            const targetX=dir===1?520:-40;
            sendDogOffscreen.call(scene,dog,targetX,dog.y);
            dog.fled=true;
          }
          return;
        }
        if(dog.followEvent) dog.followEvent.remove(false);
        scene.tweens.killTweensOf(dog);
        ensureOnGround(dog);
        if(dog.setAngle) dog.setAngle(0);
        const dir = dog.x < falcon.x ? 1 : -1;
        const attackX = falcon.x - dir * 40;
        const attackY = Math.max(DOG_MIN_Y, falcon.y + 10);
        const dTl = scene.tweens.createTimeline();
        dTl.add({
          targets: dog,
          x: attackX,
          y: attackY,
          duration: dur(Phaser.Math.Between(300, 500)),
          ease: 'Sine.easeInOut'
        });
        dTl.setCallback('onUpdate',()=>{
          if(dog.prevX===undefined) dog.prevX=dog.x;
          const dx=dog.x-dog.prevX;
          if(Math.abs(dx)>3){ dog.dir=dx>0?1:-1; }
          dog.prevX=dog.x;
          const s=scaleForY(dog.y)*0.5;
          dog.setScale(s*(dog.dir||1), s);
        }, []);
        dTl.setCallback('onComplete',()=>{
          dog.setFrame(1);
          if(GameState.falconStunned &&
             (mood===CustomerState.ARROW || mood===CustomerState.SPARKLING)){
            const durMs = mood===CustomerState.ARROW ? 2000 : 1000;
            arrowDogAttack(dog, durMs);
          }else{
            const bark = dogBarkAt.call(scene, dog, falcon.x, falcon.y, true, () => {
              const idx = GameState.activeBarks.indexOf(bark);
              if(idx !== -1) GameState.activeBarks.splice(idx,1);
            });
            if(bark){
              GameState.activeBarks.push(bark);
            }
          }
        }, []);
        if(dog.anims && dog.play){ dog.play('dog_walk'); }
        dTl.play();
      });
    }


    // send everyone scattering immediately in case a new spawn sneaks in
      let finished=false;
      let falcon=null;
      let falconDeathStarted=false;
      let featherTrail=null;
    let firstAttack=true;
    let dogCheckActive=false;
    let attackTween=null;
      const endAttack=(force=false)=>{
        falconDeathStarted = false;
        if(finished && !force) return;
      finished=true;
      if(GameState.dogBarkEvent){
        GameState.dogBarkEvent.remove(false);
        GameState.dogBarkEvent = null;
      }
      latchedDogs.forEach(d=>{
        if(d.chewEvent) d.chewEvent.remove(false);
        if(d.wiggleTween) d.wiggleTween.stop();
        d.attacking=false;
      });
      latchedDogs.length=0;
      if(featherTrail){ featherTrail.remove(false); featherTrail=null; }
      cleanupDogs(scene);
      GameState.falconActive = false;
      reinHumanEvents.forEach(ev=>{ if(ev) ev.remove(false); });
      reinHumanEvents.length = 0;
      scene.events.off('update', updateReinforcementHearts);
      reinHumans.forEach(h=>{ if(h.heartEmoji) h.heartEmoji.destroy(); h.destroy(); });
      reinDogs.forEach(d=>{ if(d.heartEmoji) d.heartEmoji.destroy(); d.destroy(); });
      reinHumans.length = 0;
      reinDogs.length = 0;
      // clear any lingering blink timers
      if(falcon) falcon.clearTint();
      if(girl) girl.clearTint();
      if(falcon) falcon.destroy();
      GameState.falcon = null;
      cleanupBarks();
      cleanupBursts();
      scene.events.off('update', updateHpPos);
      scene.events.off('update', updateLatchedDogs);
      girlHpBar.destroy();
      falconHpBar.destroy();
      if(GameState.falconHP<=0){
        showFalconDefeat.call(scene);
      } else if(cb){
        cb();
      }
    };

    falcon=scene.add.sprite(-40,-40,'lady_falcon',0)
      .setScale(1.4,1.68)
      .setDepth(20);
    GameState.falcon = falcon;
    falcon.anims.play('falcon_fly');
    const girlHpBar = createHpBar(scene, 40, 6, 10);
    girlHpBar.setPosition(
      girl.x + 7,
      girl.y - (girl.displayHeight || 0) * 0.5 + 10
    );
    const falconHpBar = createHpBar(scene, 40, 6, 10);
    falconHpBar.setPosition(falcon.x, falcon.y - 30);
    const updateHpPos = () => {
      girlHpBar.setPosition(
        girl.x + 7,
        girl.y - (girl.displayHeight || 0) * 0.5 + 10
      );
      falconHpBar.setPosition(falcon.x, falcon.y - 30);
    };
    scene.events.on('update', updateHpPos);
    scene.events.on('update', updateLatchedDogs);
    const targetX=girl.x;
    const targetY=girl.y-40;
    dogsBarkAtFalcon();
      GameState.dogBarkEvent = scene.time.addEvent({
        delay: dur(800),
        loop: true,
        callback: dogsBarkAtFalcon,
        callbackScope: scene
      });
    panicCustomers();
    const ATTACK_FREQ = {
      [CustomerState.GROWING]: 1200,
      [CustomerState.SPARKLING]: 900,
      [CustomerState.ARROW]: 700
    };
    const ATTACK_RANGE = {
      [CustomerState.GROWING]: 0.55,
      [CustomerState.SPARKLING]: 0.715,
      [CustomerState.ARROW]: 0.85
    };
    function startDefender(h){
      const delay = ATTACK_FREQ[h.loveState] || 1200;
      const ev = scene.time.addEvent({
        delay: dur(delay),
        loop: true,
        callback: () => defenderAttack(h),
        callbackScope: scene
      });
      reinHumanEvents.push(ev);
      h.attackEvent = ev;
    }
   function defenderAttack(h){
      if(!falcon || finished || !h.active || h.attacking) return;
      h.attacking = true;
      const heightBoost = (h.loveState === CustomerState.GROWING ||
                           h.loveState === CustomerState.SPARKLING) ? 1.1 : 1;
      const factor = (ATTACK_RANGE[h.loveState] || 1.1) * 1.2 * heightBoost;
      const dx = falcon.x - h.baseX;
      const dy = falcon.y - h.baseY;
      const tx = h.baseX + dx * factor;
      const ty = h.baseY + dy * factor;
      const dir = Math.sign(dx) || 1;
      let hit = false;
      scene.tweens.add({
        targets:h,
        x:tx,
        y:ty,
        duration:dur(300),
        ease:'Sine.easeOut',
        onUpdate:()=>{
          if(!hit && Phaser.Math.Distance.Between(h.x,h.y,falcon.x,falcon.y)<30){
            hit=true;
            GameState.falconHP = Math.max(0, GameState.falconHP - 0.5);
            falconHpBar.setHp(GameState.falconHP);
            featherExplosion(scene, falcon.x, falcon.y, 8, 1.2);
            blinkFalcon();
            if(GameState.falconHP<=0){ falconDies(); }
          }
        },
        onComplete:()=>{
          if(hit){
            scene.tweens.add({
              targets:h,
              x:h.baseX,
              y:h.baseY,
              duration:dur(200),
              ease:'Sine.easeIn',
              onComplete:()=>{ h.attacking=false; }
            });
          } else {
            scene.tweens.add({
              targets:h,
              x:tx + dir*20,
              y:ty + 40,
              angle: dir>0 ? 90 : -90,
              duration:dur(250),
              ease:'Sine.easeIn',
              onComplete:()=>{
                const gY = Math.max(WANDER_TOP, girl.y + 60);
                scene.tweens.add({
                  targets:h,
                  y:gY,
                  scale:scaleForY(gY),
                  duration:dur(300),
                  ease:'Sine.easeIn',
                  onComplete:()=>{
                    ensureOnGround(h);
                    h.fallCount = (h.fallCount || 0) + 1;
                    const limit = h.loveState === CustomerState.GROWING ? 2 :
                                  h.loveState === CustomerState.SPARKLING ? 4 : Infinity;
                    if(h.fallCount >= limit){
                      h.active = false;
                      h.attacking = false;
                      h.loveState = CustomerState.BROKEN;
                      if(h.heartEmoji && h.heartEmoji.scene){
                        h.heartEmoji.setText(HEART_EMOJIS[CustomerState.BROKEN] || '');
                        h.heartEmoji.setPostPipeline('desaturate');
                        const epl = h.heartEmoji.getPostPipeline(DesaturatePipeline);
                        if(epl){
                          epl.amount = 0;
                          scene.tweens.add({targets:epl, amount:0.5, delay:dur(1000), duration:dur(300)});
                        }
                      }
                      if(h.scene){
                        h.setPostPipeline('desaturate');
                        const pl = h.getPostPipeline(DesaturatePipeline);
                        if(pl) pl.amount = 0.5;
                      }
                      return;
                    }
                    scene.time.delayedCall(dur(1000),()=>{
                      if(!h.active) return;
                      scene.tweens.add({
                        targets:h,
                        angle:0,
                        duration:dur(150),
                        onComplete:()=>{
                          const newX = Phaser.Math.Between(girl.x-80, girl.x+80);
                          const groundLevel = Math.max(WANDER_TOP, girl.y + 60);
                          const groundY = Math.max(h.baseY, groundLevel);
                          const maxY = Math.min(WANDER_BOTTOM, groundY + 20);
                          const newY = Phaser.Math.Between(groundY, maxY);
                          scene.tweens.add({
                            targets:h,
                            x:newX,
                            y:newY,
                            scale:scaleForY(newY),
                            duration:dur(300),
                            ease:'Sine.easeOut',
                            onComplete:()=>{
                              h.baseX = newX;
                              h.baseY = newY;
                              h.attacking=false;
                            }
                          });
                        }
                      });
                    },[],scene);
                  }
                });
              }
            });
          }
        }
      });
    }

    function dropLatchedDog(dog){
      if(!dog) return;
      const idx = latchedDogs.indexOf(dog);
      if(idx !== -1) latchedDogs.splice(idx,1);
      if(dog.chewEvent) { dog.chewEvent.remove(false); dog.chewEvent = null; }
      if(dog.wiggleTween) { dog.wiggleTween.stop(); dog.wiggleTween = null; }
      const dir = dog.dir || 1;
      scene.tweens.add({
        targets:dog,
        x:falcon.x + dir*20,
        y:falcon.y + 40,
        angle:dir>0?360:-360,
        duration:dur(250),
        ease:'Sine.easeIn',
        onComplete:()=>{
          scene.tweens.add({
            targets:dog,
            y:DOG_MIN_Y,
            angle:dir>0?720:-720,
            duration:dur(400),
            ease:'Sine.easeIn',
            onUpdate:()=>{ const s=scaleForY(dog.y)*0.5; dog.setScale(s*(dog.dir||1),s); },
            onComplete:()=>{
              scene.tweens.add({
                targets:dog,
                y:`-=20`,
                duration:dur(150),
                yoyo:true,
                ease:'Sine.easeOut',
                onComplete:()=>{
                  const tl=scene.tweens.createTimeline();
                  tl.add({targets:dog,angle:-15,duration:dur(80)});
                  tl.add({targets:dog,angle:15,duration:dur(80)});
                  tl.add({targets:dog,angle:-10,duration:dur(80)});
                  tl.add({targets:dog,angle:10,duration:dur(80)});
                  tl.add({targets:dog,angle:0,duration:dur(80),onComplete:()=>{ ensureOnGround(dog); dog.attacking=false; }});
                  tl.play();
                }
              });
            }
          });
        }
      });
    }

    function dogMissFall(dog, startX, startY, dir, done){
      scene.tweens.add({
        targets: dog,
        x: startX,
        y: startY,
        angle: dir>0?360:-360,
        duration: dur(250),
        ease: 'Sine.easeIn',
        onComplete: () => {
          scene.tweens.add({
            targets: dog,
            y: DOG_MIN_Y,
            angle: dir>0?720:-720,
            duration: dur(400),
            ease: 'Sine.easeIn',
            onUpdate: () => { const s = scaleForY(dog.y)*0.5; dog.setScale(s*(dog.dir||1), s); },
            onComplete: () => {
              scene.tweens.add({
                targets: dog,
                y: `-=20`,
                duration: dur(150),
                yoyo: true,
                ease: 'Sine.easeOut',
                onComplete: () => {
                  const tl = scene.tweens.createTimeline();
                  tl.add({targets:dog,angle:-15,duration:dur(80)});
                  tl.add({targets:dog,angle:15,duration:dur(80)});
                  tl.add({targets:dog,angle:-10,duration:dur(80)});
                  tl.add({targets:dog,angle:10,duration:dur(80)});
                  tl.add({targets:dog,angle:0,duration:dur(80),onComplete:()=>{ ensureOnGround(dog); if(done) done(); }});
                  tl.play();
                }
              });
            }
          });
        }
      });
    }

    function arrowDogAttack(dog, latchMs=2000){
      if(!falcon || finished || !dog || dog.attacking || dog.dead || dog.barkReady === false) return;
      dog.attacking=true;
      const dx=falcon.x-dog.x;
      const dy=falcon.y-dog.y;
      const tx=dog.x+dx*0.85*1.2;
      const ty=dog.y+dy*0.85*1.2;
      const dir=Math.sign(dx)||1;
      let hit=false;
      scene.tweens.add({
        targets:dog,
        x:tx,
        y:ty,
        duration:dur(300),
        ease:'Sine.easeOut',
        onUpdate:()=>{ if(!hit && Phaser.Math.Distance.Between(dog.x,dog.y,falcon.x,falcon.y)<30){ hit=true; } },
        onComplete:()=>{
          if(hit){
            GameState.falconHP = Math.max(0, GameState.falconHP - 0.5);
            falconHpBar.setHp(GameState.falconHP);
            featherExplosion(scene, falcon.x, falcon.y, 8, 1.2);
            blinkFalcon();
            if(GameState.falconHP<=0){ falconDies(); }
            dog.dir = dir;
            cleanupBarks();
            // Position so the dog's mouth aligns with the falcon center
            dog.offsetX = -dir * dog.displayWidth * 0.5;
            dog.offsetY = dog.displayHeight * 0.1;
            dog.wiggleOffset = 0;
            dog.setFrame(1);
            if(dog.anims && dog.anims.stop) dog.anims.stop();
            latchedDogs.push(dog);
            dog.chewEvent=scene.time.addEvent({
              delay:dur(100),
              loop:true,
              callback:()=>{
                GameState.falconHP=Math.max(0,GameState.falconHP-0.1);
                falconHpBar.setHp(GameState.falconHP);
                featherExplosion(scene,falcon.x,falcon.y,2,1);
                blinkFalcon();
                if(GameState.falconHP<=0){ falconDies(); }
              }
            });
            dog.wiggleTween=scene.tweens.add({targets:dog,wiggleOffset:6,duration:dur(120),yoyo:true,repeat:-1});
            scene.time.delayedCall(dur(latchMs), () => dropLatchedDog(dog), [], scene);
          }else{
            dogMissFall(dog, tx + dir*20, ty + 40, dir, () => {
              dog.attacking = false;
              if(GameState.falconStunned){
                arrowDogAttack(dog, latchMs);
              }else{
                dogsBarkAtFalcon();
              }
            });
          }
        }
      });
    }

    function falconAttackDog(dog, done){
      if(!falcon || finished || !dog) { if(done) done(); return; }
      if(dog.dead) { if(done) done(); return; }
      // Ensure the dog sprite is visible before running the attack logic
      if(dog.setAlpha) dog.setAlpha(1);
      if(dog.followEvent) { dog.followEvent.remove(false); dog.followEvent = null; }
      if(dog.currentTween) { dog.currentTween.stop(); dog.currentTween = null; }
      scene.tweens.killTweensOf(dog);
      if(dog.chewEvent) { dog.chewEvent.remove(false); dog.chewEvent = null; }
      if(dog.wiggleTween) { dog.wiggleTween.stop(); dog.wiggleTween = null; }
      // mark dead immediately so other logic stops interacting with this dog
      dog.dead = true;

      const lIdx = latchedDogs.indexOf(dog);
      if(lIdx !== -1) latchedDogs.splice(lIdx, 1);

      scene.tweens.add({
        targets: falcon,
        x: dog.x,
        y: dog.y - 20,
        duration: dur(300),
        ease: 'Cubic.easeIn',
        onComplete: () => {
          flashRed(scene, dog, 150);
          scene.time.delayedCall(dur(200), () => flashRed(scene, dog, 150), [], scene);
          scene.time.delayedCall(dur(400), () => flashRed(scene, dog, 150), [], scene);
          // update the dog's mood to broken and show a desaturated heart
          if(dog.dogCustomer && dog.dogCustomer.memory){
            dog.dogCustomer.memory.state = CustomerState.BROKEN;
          }
          if(!dog.heartEmoji || !dog.heartEmoji.scene){
            dog.heartEmoji = scene.add.text(dog.x, dog.y, HEART_EMOJIS[CustomerState.BROKEN], {font:'28px sans-serif'})
              .setOrigin(0.5)
              .setDepth(dog.depth + 1)
              .setShadow(0,0,'#000',4);
          }
          if(dog.heartEmoji && dog.heartEmoji.scene){
            dog.heartEmoji
              .setText(HEART_EMOJIS[CustomerState.BROKEN] || '')
              .setPostPipeline('desaturate');
            const epl = dog.heartEmoji.getPostPipeline(DesaturatePipeline);
            if(epl){
              epl.amount = 0;
              scene.tweens.add({targets:epl, amount:0.5, delay:dur(1000), duration:dur(300)});
            }
          }
          cleanupBarks();
          scene.tweens.add({
            targets: dog,
            angle: 180,
            duration: dur(300),
            onComplete: () => {
              if(dog.anims && dog.anims.stop) dog.anims.stop();
              else if(dog.anims && dog.anims.pause) dog.anims.pause();
              // leave the dog permanently gray when defeated
              dog.setTint(0x808080);
              if(dog.scene){
                dog.setPostPipeline('desaturate');
                const dpl = dog.getPostPipeline(DesaturatePipeline);
                if(dpl) dpl.amount = 0.5;
              }
              scene.tweens.add({
                targets: dog,
                y: DOG_MIN_Y,
                duration: dur(300),
                ease: 'Sine.easeIn',
                onUpdate: () => {
                  const s = scaleForY(dog.y) * (dog.scaleFactor || 0.5);
                  dog.setScale(s * (dog.dir || 1), s);
                  if(dog.heartEmoji){
                    dog.heartEmoji
                      .setPosition(dog.x, dog.y)
                      .setScale(scaleForY(dog.y) * 0.8)
                      .setDepth(dog.depth);
                  }
                },
                onComplete: () => {
                  ensureOnGround(dog);
                  dog.attacking = false;
                  dog.dead = true;
                  dog.setAngle(180);
                  const rIdx = reinDogs.indexOf(dog);
                  if(rIdx !== -1) reinDogs.splice(rIdx, 1);
                  if(done) done();
                }
              });
            }
          });
        }
      });
    }
    const spawnReinforcements = () => {
      const positive = [CustomerState.MENDING, CustomerState.GROWING, CustomerState.SPARKLING, CustomerState.ARROW];
      const present = new Set(GameState.queue.map(c=>c.spriteKey));
      GameState.wanderers.forEach(c=>{ if(c.spriteKey) present.add(c.spriteKey); });
      if(GameState.activeCustomer && GameState.activeCustomer.spriteKey) present.add(GameState.activeCustomer.spriteKey);
      const dogPresent = new Set();
      const gatherDog = c => {
        if(c && c.dog && c.dog.dogCustomer && c.dog.dogCustomer.memory){
          dogPresent.add(c.dog.dogCustomer.memory);
        }
      };
      GameState.queue.forEach(gatherDog);
      GameState.wanderers.forEach(gatherDog);
      gatherDog(GameState.activeCustomer);
      let delay = 0;
      Object.entries(GameState.customerMemory).forEach(([key, mem]) => {
        if(mem && positive.includes(mem.state) && !present.has(key)){
          scene.time.delayedCall(dur(delay),()=>{
            const sx = Phaser.Math.Between(40,440);
            const sy = scene.scale.height + 40;
            const h = scene.add.sprite(sx, sy, key)
              .setDepth(20)
              .setScale(scaleForY(sy));
            h.loveState = mem.state;
            reinHumans.push(h);
            h.heartEmoji = scene.add.text(sx, sy,
              HEART_EMOJIS[mem.state] || '', {font:'28px sans-serif'})
              .setOrigin(0.5)
              .setDepth(21)
              .setShadow(0,0,'#000',4);
            scene.tweens.add({
              targets:h,
              x:girl.x+Phaser.Math.Between(-60,60),
              y:girl.y+Phaser.Math.Between(30,50),
              scale:scaleForY(girl.y+40),
              duration:dur(800),
              onComplete:()=>{
                h.ready=true;
                h.baseX=h.x;
                h.baseY=h.y;
                startDefender(h);
              }
            });
          },[],scene);
          delay += 500;
        }
        if(mem && mem.dogMemory && mem.dogMemory.hasDog &&
           positive.includes(mem.dogMemory.state) && !dogPresent.has(mem.dogMemory)){
          scene.time.delayedCall(dur(delay),()=>{
            const dx=Phaser.Math.Between(40,440);
            const dy=scene.scale.height + 60;
            const dog=scene.add.sprite(dx,dy,'dog1',1)
              .setOrigin(0.5)
              .setDepth(20);
            dog.baseScaleFactor=0.4;
            dog.scaleFactor=0.4;
            dog.barkReady = false;
            scaleDog(dog);
            dog.dogCustomer={memory:mem.dogMemory};
            reinDogs.push(dog);
            dog.heartEmoji = scene.add.text(dx, dy,
              HEART_EMOJIS[mem.dogMemory.state] || '', {font:'28px sans-serif'})
              .setOrigin(0.5)
              .setDepth(21)
              .setShadow(0,0,'#000',4);
            scene.tweens.add({
              targets:dog,
              x:girl.x+Phaser.Math.Between(-80,80),
              y:girl.y+Phaser.Math.Between(40,60),
              duration:dur(800),
              onUpdate:()=>{const s=scaleForY(dog.y)*0.5;dog.setScale(s*(dog.dir||1),s);},
              onComplete:()=>{dog.barkReady = true;}
            });
          },[],scene);
          delay += 500;
        }
      });
    };
    spawnReinforcements();
    scene.events.on('update', updateReinforcementHearts);
    const attackOnce=()=>{
        if(finished) return;
        const activeHumans = reinHumans.filter(h => h.active).length;
        if(dogCheckActive && activeHumans === 0){
          const dogs = [];
          const gatherDog = c => { if(c && c.dog && !c.dog.dead) dogs.push(c.dog); };
          GameState.queue.forEach(gatherDog);
          GameState.wanderers.forEach(gatherDog);
          gatherDog(GameState.activeCustomer);
          reinDogs.forEach(d => dogs.push(d));
          if(dogs.length > 0){
            falconAttackDog(dogs[0], () => scene.time.delayedCall(dur(400), attackOnce, [], scene));
            return;
          }
        }
        const dir=Math.random()<0.5?-1:1;
        const angle=Phaser.Math.FloatBetween(Phaser.Math.DegToRad(55),Phaser.Math.DegToRad(80));
        const radius=Phaser.Math.Between(140,200);
        const startX=girl.x+dir*Math.cos(angle)*radius;
        const startY=girl.y-Math.sin(angle)*radius;
        const fromX=falcon.x;
        const fromY=falcon.y;
        // if(firstAttack) startTrail();
        scene.tweens.addCounter({from:0,to:1,duration:dur(250),ease:'Sine.easeInOut',
          onUpdate:tw=>{
            const p=tw.getValue();
            falcon.x=Phaser.Math.Linear(fromX,startX,p);
            falcon.y=Phaser.Math.Linear(fromY,startY,p)+Math.sin(p*Math.PI*4)*6;
          },
          onComplete:()=>{
          attackTween = scene.tweens.add({
            targets:falcon,
            x:targetX,
            y:targetY,
            duration:dur(350),
            ease:'Cubic.easeIn',
            onStart:()=>{/*if(firstAttack) startTrail();*/},
            onUpdate:()=>{
              GameState.activeBarks.forEach(b=>{
                if(Phaser.Math.Distance.Between(falcon.x,falcon.y,b.x,b.y)<30){
                  const idx=GameState.activeBarks.indexOf(b);
                  if(idx!==-1) GameState.activeBarks.splice(idx,1);
                  b.setTintFill(0xffffff);
                  scene.tweens.add({targets:b,alpha:0,duration:dur(100),onComplete:()=>b.destroy()});
                  if(attackTween){ attackTween.stop(); attackTween=null; }
                  GameState.falconHP = Math.max(0, GameState.falconHP - 0.1);
                  falconHpBar.setHp(GameState.falconHP);
                  featherExplosion(scene, falcon.x, falcon.y, 4, 1);
                  if(GameState.falconHP<=0){ falconDies(); return; }
                  const sd = b.stunDuration || 1000;
                  if(!GameState.falconStunned){
                    stunFalcon(sd, ()=>scene.time.delayedCall(0, attackOnce, [], scene));
                  }
                }
              });
            },
            onComplete:()=>{
            blinkAngry(scene);
            GameState.girlHP=Math.max(0,GameState.girlHP-1);
            girlHpBar.setHp(GameState.girlHP);
            coffeeExplosion(scene);
            const tl=scene.tweens.createTimeline({callbackScope:scene});
          tl.add({targets:falcon,y:targetY+10,duration:dur(80),yoyo:true});
          tl.add({targets:girl,y:girl.y+5,duration:dur(80),yoyo:true,
                   onStart:()=>sprinkleBursts(scene),
                   onYoyo:()=>sprinkleBursts(scene)},'<');
          // No more feathers during the attack
          tl.setCallback('onComplete', () => {
            // stopTrail();
            if(firstAttack){
              firstAttack=false;
              dogCheckActive=true;
            }
            if(GameState.girlHP<=0){
              finished = true;
              setSpeedMultiplier(0.25);
              bigCoffeeExplosion(scene);
              flashRed(scene, girl, 800);
              scene.tweens.add({targets:girl,alpha:0,duration:dur(800),yoyo:true});
              scene.time.delayedCall(2000, ()=>{
                setSpeedMultiplier(1);
                endAttack(true);
              }, [], scene);
            } else {
              attackOnce();
            }
          }, []);
          tl.play();
        }});
      }});
    };
    attackOnce();

    function blinkAngry(s){
      flashRed(s, girl, 250);
      if(GameState.girlHP<=0){ girl.setTintFill(0xff0000); }
    }

    function blinkFalcon(){
      flashRed(scene, falcon, 400);
      if(GameState.falconHP<=0){ falcon.setTintFill(0xff0000); }
    }

      function stunFalcon(duration=1000, done){
        if(!falcon) { if(done) done(); return; }
        if(falcon.stunTimer){ falcon.stunTimer.remove(false); falcon.stunTimer=null; }
        if(falcon.wobbleTween){ falcon.wobbleTween.stop(); falcon.wobbleTween=null; }
        GameState.falconStunned = true;
        falcon.setTint(0x3399ff);
        falcon.stunEnd = (scene.time ? scene.time.now : Date.now()) + duration;
        falcon.stunDone = done;
        scene.tweens.add({
          targets: falcon,
          x: girl.x,
          y: girl.y - 20,
          duration: dur(duration),
          ease: 'Sine.easeOut',
          onComplete: () => {
            shakeFalcon();
          }
        });
        falcon.wobbleTween = scene.tweens.add({targets:falcon,angle:5,duration:dur(200),yoyo:true,repeat:-1});
        const finish=()=>{
          if(falcon.wobbleTween){ falcon.wobbleTween.stop(); falcon.wobbleTween=null; }
          if (falcon && falcon.clearTint) falcon.clearTint();
          GameState.falconStunned = false;
          if(falcon.stunDone){ const cb=falcon.stunDone; falcon.stunDone=null; cb(); }
        };
        falcon.stunFinish = finish;
        falcon.stunTimer = scene.time.delayedCall(duration, finish, [], scene);
      }

      function shakeFalcon(){
        if(!falcon || !GameState.falconStunned || !falcon.stunTimer) return;
        const remaining = falcon.stunEnd - (scene.time ? scene.time.now : Date.now());
        if(remaining <= 0) return;
        falcon.stunTimer.remove(false);
        const newDur = remaining * 0.5;
        falcon.stunEnd = (scene.time ? scene.time.now : Date.now()) + newDur;
        const finish = falcon.stunFinish;
        falcon.stunTimer = scene.time.delayedCall(newDur, finish, [], scene);
        scene.tweens.add({targets:falcon,angle:0,duration:dur(150),yoyo:true});
      }

    function sprinkleBursts(s){
      for(let b=0;b<3;b++){
        const bx=girl.x+5+Phaser.Math.Between(-20,20);
        const by=girl.y+3+Phaser.Math.Between(-40,0);
        const line=s.add.rectangle(bx,by,Phaser.Math.Between(2,4),18,0xff0000)
          .setOrigin(0.5).setDepth(21)
          .setAngle(Phaser.Math.Between(-45,45));
        GameState.activeBursts.push(line);
        s.tweens.add({targets:line,alpha:0,scaleY:1.5,y:by-10,duration:dur(200),onComplete:()=>{ const i=GameState.activeBursts.indexOf(line); if(i!==-1) GameState.activeBursts.splice(i,1); line.destroy(); }});
      }
    }

    function coffeeExplosion(s, x, y){
        const startX = (typeof x === 'number') ? x
                      : girl.x + (girl.displayWidth || 0) * 0.1;
        const startY = (typeof y === 'number') ? y
                      : girl.y - (girl.displayHeight || 0) * 0.2;
      for(let i=0;i<5;i++){
        const ang = Phaser.Math.FloatBetween(-Math.PI/2, Math.PI/2);
        const dist = Phaser.Math.Between(10,40);
        const cup = s.add.image(startX,startY,'coffeecup2')
          .setOrigin(0.5)
          .setDepth(21)
          .setScale(0.36);
        GameState.activeBursts.push(cup);
        s.tweens.add({
          targets:cup,
          x:startX+Math.cos(ang)*dist,
          y:startY+Math.sin(ang)*dist,
          angle:Phaser.Math.Between(-180,180),
          alpha:0,
          duration:dur(800),
          ease:'Cubic.easeOut',
          onComplete:()=>{ const i=GameState.activeBursts.indexOf(cup); if(i!==-1) GameState.activeBursts.splice(i,1); cup.destroy(); }
        });
      }
    }

    function bigCoffeeExplosion(s){
      const startX = girl.x + (girl.displayWidth || 0) * 0.1;
      const startY = girl.y - (girl.displayHeight || 0) * 0.2;
      for(let i=0;i<12;i++){
        const ang = Phaser.Math.FloatBetween(-Math.PI/2, Math.PI/2);
        const dist = Phaser.Math.Between(20,80);
        const cup = s.add.image(startX,startY,'coffeecup2')
          .setOrigin(0.5)
          .setDepth(21)
          .setScale(0.5);
        GameState.activeBursts.push(cup);
        s.tweens.add({
          targets:cup,
          x:startX+Math.cos(ang)*dist,
          y:startY+Math.sin(ang)*dist,
          angle:Phaser.Math.Between(-180,180),
          alpha:0,
          duration:dur(500),
          ease:'Cubic.easeOut',
          onComplete:()=>{ const i=GameState.activeBursts.indexOf(cup); if(i!==-1) GameState.activeBursts.splice(i,1); cup.destroy(); }
        });
      }
    }

    function featherExplosion(s,x,y,count=6,scale=1){
      for(let i=0;i<count;i++){
        const ang = Phaser.Math.FloatBetween(0,Math.PI*2);
        const dist = Phaser.Math.Between(20,40)*scale;
        const line = s.add.rectangle(x,y,Phaser.Math.Between(2,3)*scale,Phaser.Math.Between(12,20)*scale,0xffffff)
          .setOrigin(0.5).setDepth(21)
          .setAngle(Phaser.Math.RadToDeg(ang));
        GameState.activeBursts.push(line);
        s.tweens.add({targets:line,x:x+Math.cos(ang)*dist,y:y+Math.sin(ang)*dist,alpha:0,duration:dur(300),onComplete:()=>{ const i=GameState.activeBursts.indexOf(line); if(i!==-1) GameState.activeBursts.splice(i,1); line.destroy(); }});
      }
    }

      function falconDies(){
        if(falconDeathStarted) return;
        falconDeathStarted = true;
        if(!falcon) return;
      setSpeedMultiplier(0.25);
      scene.tweens.killAll();
      scene.time.removeAllEvents();
      reinHumanEvents.forEach(ev=>{ if(ev) ev.remove(false); });
      reinHumanEvents.length = 0;
      scene.events.off('update', updateHpPos);
      scene.events.off('update', updateLatchedDogs);
      scene.events.off('update', updateReinforcementHearts);
      latchedDogs.forEach(d=>{
        if(d.chewEvent) d.chewEvent.remove(false);
        if(d.wiggleTween) d.wiggleTween.stop();
        d.attacking=false;
      });
      latchedDogs.length=0;
      falcon.setTintFill(0xff0000);
      scene.tweens.add({
        targets:falcon,
        angle:180,
        x: truck.x,
        y: truck.y,
        duration:dur(1500),
        ease:'Cubic.easeIn',
        onComplete:()=>{
          featherExplosion(scene,falcon.x,falcon.y,30,3);
          bigCoffeeExplosion(scene);
          // Blink red a few times on impact
          flashRed(scene, falcon, 150);
          scene.time.delayedCall(dur(200), () => flashRed(scene, falcon, 150), [], scene);
          scene.time.delayedCall(dur(400), () => flashRed(scene, falcon, 150), [], scene);
          // Shake the truck briefly
          scene.tweens.add({targets:truck,x:truck.x+8,duration:dur(80),yoyo:true,repeat:3});
          // White flash overlay
          GameState.victoryOverlay = scene.add.rectangle(240,320,480,640,0xffffff)
            .setDepth(30).setAlpha(0);
          scene.tweens.add({targets:GameState.victoryOverlay,alpha:1,duration:dur(600)});
          if(falcon && falcon.anims) falcon.anims.stop();
          scene.time.delayedCall(2000,()=>{
            setSpeedMultiplier(1);
            endAttack();
          });
        }
      });
    }


  }

  function showCustomerRevolt(cb){
    const scene=this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
    cleanupBarks();
    cleanupBursts();
    cleanupSparkles(scene);
    cleanupDogs(scene);
    cleanupSparrows(scene);
    hideOverlayTexts();
    clearDialog.call(scene);
    if (GameState.spawnTimer) { GameState.spawnTimer.remove(false); GameState.spawnTimer = null; }
    GameState.girlHP = 10;
    const girlHpBar = createHpBar(scene, 40, 6, 10);
    girlHpBar.setPosition(
      girl.x + 7,
      girl.y - (girl.displayHeight || 0) * 0.5 + 10
    );
    let girlBlinkEvent = startHpBlink(scene, girl, () => GameState.girlHP, 10);
    const updateHpPos = () => {
      girlHpBar.setPosition(
        girl.x + 7,
        girl.y - (girl.displayHeight || 0) * 0.5 + 10
      );
    };
    scene.events.on('update', updateHpPos);

    const attackers=[];
    const attackerDogs=[];
    const updateHeart = s => {
      if(s && s.heartEmoji && s.heartEmoji.scene){
        const hy = s.y + (s.displayHeight || 0) * 0.30;
        s.heartEmoji
          .setPosition(s.x, hy)
          .setScale(scaleForY(s.y) * 0.8)
          .setDepth(s.depth);
      }
    };
    const updateAttackerHearts = () => {
      attackers.forEach(updateHeart);
      attackerDogs.forEach(updateHeart);
    };
    const gatherStartY = Math.max(WANDER_TOP, girl.y + 60);
    const gather=(arr)=>{
      arr.forEach(c=>{
        if(!c.memory || c.memory.state !== CustomerState.BROKEN) {
          if(c.walkTween){
            if(c.walkTween.isPlaying && c.walkTween.stop) c.walkTween.stop();
            if(c.walkTween.remove) c.walkTween.remove();
            c.walkTween=null;
          }
          if(c.sprite){
            const dir = c.sprite.x < ORDER_X ? -1 : 1;
            const targetX = dir===1 ? 520 : -40;
            scene.tweens.add({
              targets:c.sprite,
              x:targetX,
              duration:dur(WALK_OFF_BASE/1.2),
              onComplete:()=>{ c.sprite.destroy(); }
            });
          }
          if(c.dog){
            if(c.dog.followEvent) c.dog.followEvent.remove(false);
            const ddir = c.dog.x < ORDER_X ? -1 : 1;
            const dx = ddir===1 ? 520 : -40;
            sendDogOffscreen.call(scene,c.dog,dx,c.dog.y);
          }
          return;
        }
        if(c.walkTween){
          if(c.walkTween.isPlaying && c.walkTween.stop) c.walkTween.stop();
          if(c.walkTween.remove) c.walkTween.remove();
          c.walkTween=null;
        }
        if(c.dog){
          if(c.dog.followEvent) c.dog.followEvent.remove(false);
          if(c.dog.currentTween){ c.dog.currentTween.stop(); c.dog.currentTween = null; }
          if(c.dog.chewEvent){ c.dog.chewEvent.remove(false); c.dog.chewEvent = null; }
          if(c.dog.wiggleTween){ c.dog.wiggleTween.stop(); c.dog.wiggleTween = null; }
          scene.tweens.killTweensOf(c.dog);
          c.dog.attacking = false;
          c.dog.setDepth(20);
          attackerDogs.push(c.dog);
          if(!c.dog.heartEmoji){
            c.dog.heartEmoji = scene.add.text(c.dog.x, c.dog.y, HEART_EMOJIS[CustomerState.BROKEN], {font:'28px sans-serif'})
              .setOrigin(0.5)
              .setDepth(21)
              .setShadow(0,0,'#000',4);
          }
        }
        if(c.sprite){
          c.sprite.setDepth(20); // keep attackers above the girl
          if(c.sprite.y < gatherStartY){
            c.sprite.setPosition(c.sprite.x, gatherStartY);
            c.sprite.setScale(scaleForY(gatherStartY));
          }
          attackers.push(c.sprite);
          if(!c.sprite.heartEmoji){
            c.sprite.heartEmoji = scene.add.text(c.sprite.x, c.sprite.y, HEART_EMOJIS[CustomerState.BROKEN], {font:'28px sans-serif'})
              .setOrigin(0.5)
              .setDepth(21)
              .setShadow(0,0,'#000',4);
          }
        }
      });
    };
    gather(GameState.queue);
    gather(GameState.wanderers);
    GameState.queue.length = 0;
    GameState.wanderers.length = 0;
    if(GameState.activeCustomer){
      gather([GameState.activeCustomer]);
    }

    const spawnReinforcements = () => {
      const present = new Set(attackers.map(a => a.texture && a.texture.key));
      Object.entries(GameState.customerMemory).forEach(([key, mem]) => {
        if (mem && mem.state === CustomerState.BROKEN && !present.has(key)) {
          const sx = Phaser.Math.Between(40, 440);
          const sy = scene.scale.height + 40;
          const s = scene.add.sprite(sx, sy, key)
            .setDepth(20)
            .setScale(scaleForY(sy));
          attackers.push(s);
          const heart = scene.add.text(sx, sy, HEART_EMOJIS[CustomerState.BROKEN], {font:'28px sans-serif'})
            .setOrigin(0.5)
            .setDepth(21)
            .setShadow(0,0,'#000',4);
          s.heartEmoji = heart;
        }
        if (mem && mem.dogMemory && mem.dogMemory.state === CustomerState.BROKEN && mem.dogMemory.hasDog) {
          const dx = Phaser.Math.Between(40, 440);
          const dy = scene.scale.height + 60;
          const dType = DOG_TYPES.find(d => d.type === mem.dogMemory.type) || { scale: 0.4, tint: 0xffffff };
          const dog = scene.add.sprite(dx, dy, 'dog1',1)
            .setOrigin(0.5)
            .setDepth(20);
          dog.baseScaleFactor = dType.scale || 0.4;
          dog.scaleFactor = dog.baseScaleFactor;
          scaleDog(dog);
          attackerDogs.push(dog);
          const h = scene.add.text(dx, dy, HEART_EMOJIS[CustomerState.BROKEN], {font:'28px sans-serif'})
            .setOrigin(0.5)
            .setDepth(21)
            .setShadow(0,0,'#000',4);
          dog.heartEmoji = h;
        }
      });
    };
    spawnReinforcements();
    scene.events.on('update', updateAttackerHearts);



    const loops=new Map();
    let finished=false;
    let firstAttacker=null;

    function blinkGirl(){
      flashRed(scene, girl);
      scene.tweens.add({targets:girl,duration:dur(60),repeat:2,yoyo:true,x:'+=4'});
    }

    function escalateIfNotEnoughDamage(){
      if(finished) return;
      if(GameState.girlHP>5){
        finished=true;
        const driver = firstAttacker || attackers[0];
        if(driver) sendDriver(driver);
      }
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
              onUpdate:()=>updateHeart(a),
              onComplete:()=>{ if(a.heartEmoji) a.heartEmoji.destroy(); a.destroy(); }
            });
          }
        });
        scene.tweens.add({targets:driver,x:truck.x-40,y:truck.y,duration:dur(300),onUpdate:()=>updateHeart(driver),onComplete:()=>{ if(driver.heartEmoji) driver.heartEmoji.destroy(); driver.destroy(); }});
        scene.tweens.add({targets:truck,x:-200,duration:dur(800),delay:dur(300),onComplete:()=>{if(cb) cb();}});
        attackerDogs.forEach(dog=>{
          const bark = dogRefuseJumpBark.call(scene,dog,false);
          if(bark){
            GameState.activeBarks.push(bark);
            scene.tweens.add({
              targets:bark,
              y:'-=20',
              alpha:0,
              duration:dur(600),
              onComplete:()=>{ const idx=GameState.activeBarks.indexOf(bark); if(idx!==-1) GameState.activeBarks.splice(idx,1); bark.destroy(); }
            });
          }
          sendDogOffscreen.call(scene,dog,-200,dog.y);
        });
        scene.events.off('update', updateHpPos);
        scene.events.off('update', updateAttackerHearts);
        if(girlBlinkEvent) girlBlinkEvent.remove(false);
        girlHpBar.destroy();
      }

    function attack(a){
      if(finished) return;
      if(Math.random() < 0.5){
        // Regular attack lunge
        scene.tweens.add({
          targets:a,
          x:girl.x+Phaser.Math.Between(-5,5),
          y:girl.y+Phaser.Math.Between(-5,5),
          scale:scaleForY(girl.y),
          duration:dur(80),
          yoyo:true,
          onComplete:()=>{
            if(finished) return;
            GameState.girlHP = Math.max(0, GameState.girlHP - 0.5);
            girlHpBar.setHp(GameState.girlHP);
            blinkGirl();
            if(GameState.girlHP<=5){
              finished=true;
              sendDriver(a);
            } else {
              loops.set(a, scene.time.delayedCall(dur(Phaser.Math.Between(400,600)),()=>attack(a),[],scene));
            }
          }
        });
      } else {
        // Reposition before the next attack
        const bigHop = Math.random() < 0.5;
        const radius = bigHop ? Phaser.Math.Between(50,80) : Phaser.Math.Between(10,30);
        const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const tx = girl.x + Math.cos(ang) * radius;
        const ty = Math.max(girl.y + Math.sin(ang) * radius, gatherStartY);
        const hopHeight = bigHop ? Phaser.Math.Between(20,30) : 0;
        const durMs = bigHop ? 300 : 200;
        scene.tweens.add({
          targets:a,
          x:tx,
          y:ty - hopHeight,
          duration:dur(durMs),
          yoyo: !!hopHeight,
          ease: hopHeight ? 'Sine.easeInOut' : 'Linear',
          onUpdate:()=>updateHeart(a),
          onComplete:()=>{
            loops.set(a, scene.time.delayedCall(dur(Phaser.Math.Between(400,600)),()=>attack(a),[],scene));
          }
        });
      }
    }

    let firstArrived = false;
    attackers.forEach((a,i)=>{
      const ang = (Math.PI * 2 * i) / attackers.length;
      const r = 40;
      const tx = girl.x + Math.cos(ang) * r;
      let ty = Math.max(girl.y + Math.sin(ang) * r, gatherStartY);
      const arrive = () => {
        if(!firstArrived){
          firstArrived = true;
          firstAttacker = a;
          scene.time.delayedCall(dur(1000), ()=>attack(a), [], scene);
          scene.time.delayedCall(dur(5000), escalateIfNotEnoughDamage, [], scene);
        } else {
          attack(a);
        }
      };
      scene.tweens.add({
        targets:a,
        x:tx,
        y:ty,
        scale:scaleForY(ty),
        duration:dur(800),
        onComplete:arrive
      });
    });

    attackerDogs.forEach((dog,i)=>{
      const ang = (Math.PI * 2 * (attackers.length + i)) / (attackers.length + attackerDogs.length);
      const r = 60;
      const tx = girl.x + Math.cos(ang) * r;
      const ty = Math.max(girl.y + Math.sin(ang) * r, gatherStartY);
      const harass = ()=>{
        if(finished) return;
        const ang2 = Phaser.Math.FloatBetween(0, Math.PI*2);
        const dx = girl.x + Math.cos(ang2)*r;
        let dy = Math.max(girl.y + Math.sin(ang2)*r, gatherStartY);
        scene.tweens.add({
          targets:dog,
          x:dx,
          y:dy,
          duration:dur(600),
          onUpdate:()=>{ const s=scaleForY(dog.y)*0.5; dog.setScale(s*(dog.dir||1),s); if(dog.heartEmoji) dog.heartEmoji.setPosition(dog.x,dog.y).setScale(scaleForY(dog.y)*0.8).setDepth(dog.depth); },
          onComplete:()=>{ 
            const bark=dogRefuseJumpBark.call(scene,dog,false);
            if(bark){
              GameState.activeBarks.push(bark);
              scene.tweens.add({
                targets:bark,
                y:'-=20',
                alpha:0,
                duration:dur(600),
                onComplete:()=>{ const idx=GameState.activeBarks.indexOf(bark); if(idx!==-1) GameState.activeBarks.splice(idx,1); bark.destroy(); }
              });
            }
            scene.time.delayedCall(dur(200), harass, [], scene);
          }
        });
      };
      scene.tweens.add({
        targets:dog,
        x:tx,
        y:ty,
        duration:dur(800),
        onUpdate:()=>{ const s=scaleForY(dog.y)*0.5; dog.setScale(s*(dog.dir||1), s); },
        onComplete:harass
      });
    });
  }

  function showTrueLoveVictory(spriteKey){
    const scene = this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
    cleanupBarks();
    cleanupBursts();
    cleanupSparkles(scene);
    cleanupDogs(scene);
    cleanupSparrows(scene);
    hideOverlayTexts();
    if (GameState.spawnTimer) {
      GameState.spawnTimer.remove(false);
      GameState.spawnTimer = null;
    }
    clearDialog.call(scene);
    if(endOverlay){ endOverlay.destroy(); }
    endOverlay = this.add.rectangle(240,320,480,640,0x000000).setDepth(19);
    const lover = this.add.sprite(240,260, spriteKey)
      .setOrigin(0.5,1)
      .setScale(1.5)
      .setDepth(20);
    const bigGirl = this.add.image(240,320,'girl')
      .setOrigin(0.5,1)
      .setScale(1.5)
      .setDepth(21);
    for(let i=0;i<12;i++){
      const hx = Phaser.Math.Between(220,260);
      const hy = Phaser.Math.Between(200,260);
      const h = this.add.text(hx,hy,'💖',{font:'24px sans-serif'})
        .setOrigin(0.5)
        .setDepth(22);
      addFloatingEmoji(h);
      this.tweens.add({targets:h,y:hy-80,alpha:0,duration:dur(Phaser.Math.Between(800,1200)),
        onComplete:()=>{ removeFloatingEmoji(h); h.destroy(); }});
    }
    const txt=this.add.text(240,480,'You found true love\nTHE END',
      {font:'28px sans-serif',fill:'#fff',align:'center',wordWrap:{width:440}})
      .setOrigin(0.5)
      .setDepth(21);
    const btn=this.add.text(240,560,'Try Again',{font:'20px sans-serif',fill:'#fff',backgroundColor:'#006400',padding:{x:14,y:8}})
      .setOrigin(0.5)
      .setDepth(22)
      .setInteractive({ useHandCursor:true });
    btn.on('pointerdown',()=>{
        lover.destroy();
        bigGirl.destroy();
        txt.destroy();
        btn.destroy();
        if(endOverlay){ endOverlay.destroy(); endOverlay=null; }
        restartGame.call(this);
      });
    GameState.gameOver=true;
  }

  function showLoveVictory(){
    const scene = this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
    cleanupBarks();
    cleanupBursts();
    cleanupSparkles(scene);
    cleanupDogs(scene);
    cleanupSparrows(scene);
    hideOverlayTexts();
    if (GameState.spawnTimer) {
      GameState.spawnTimer.remove(false);
      GameState.spawnTimer = null;
    }
    clearDialog.call(scene);
    if(endOverlay){ endOverlay.destroy(); }
    endOverlay = this.add.rectangle(240,320,480,640,0x000000).setDepth(19);

    const img = this.add.image(240,250,'muse_victory')
      .setScale(2.4)
      .setDepth(20)
      .setAlpha(0);
    this.tweens.add({targets:img,alpha:1,duration:dur(1200)});
    awardBadge(this, img.texture.key);

    const line1 = this.add.text(240,450,'YOU ARE THE MUSE',
      {font:'28px sans-serif',fill:'#fff'})
      .setOrigin(0.5)
      .setDepth(21)
      .setAlpha(0);
    this.tweens.add({targets:line1,alpha:1,duration:dur(1200),delay:dur(1700)});

    const line2 = this.add.text(240,490,'You are an inspiration!',
      {font:'20px sans-serif',fill:'#fff',align:'center',wordWrap:{width:440}})
      .setOrigin(0.5)
      .setDepth(21)
      .setAlpha(0);
    this.tweens.add({targets:line2,alpha:1,duration:dur(600),delay:dur(2400)});

    const btn = this.add.text(240,550,'Play Again?',{
      font:'20px sans-serif',
      fill:'#000',
      backgroundColor:'#ffffff',
      padding:{x:14,y:8}
    }).setOrigin(0.5).setDepth(22).setAlpha(0)
      .setInteractive({ useHandCursor:true });

    const showBtnDelay = dur(2400) + dur(600) + 1000;
    this.tweens.add({targets:btn,alpha:1,duration:dur(600),delay:showBtnDelay});
    btn.on('pointerdown',()=>{
        btn.disableInteractive();
        GameState.carryPortrait = img.setDepth(25);
        btn.setVisible(false);
        createGlowTexture(this,0xffffff,'screen_flash',256);
        const overlayG = this.add.image(btn.x,btn.y,'screen_flash').setDepth(23);
        overlayG.setDisplaySize(btn.width,btn.height);
        this.tweens.add({
          targets:overlayG,
          x:240,
          y:320,
          scaleX:Math.max(480/btn.width,640/btn.height)*2,
          scaleY:Math.max(480/btn.width,640/btn.height)*2,
          duration:300,
          ease:'Cubic.easeOut',
          onComplete:()=>{
            img.destroy();
            line1.destroy();
            line2.destroy();
            btn.destroy();
            if(endOverlay){ endOverlay.destroy(); endOverlay=null; }
            restartGame.call(this, overlayG);
          }
        });
      });
    GameState.gameOver=true;
  }

  function showHighMoneyLoss(){
    const scene = this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
    cleanupBarks();
    cleanupBursts();
    cleanupSparkles(scene);
    cleanupDogs(scene);
    cleanupSparrows(scene);
    hideOverlayTexts();
    if (GameState.spawnTimer) { GameState.spawnTimer.remove(false); GameState.spawnTimer = null; }
    clearDialog.call(scene);
    if(endOverlay){ endOverlay.destroy(); }
    endOverlay = this.add.rectangle(240,320,480,640,0x000000).setDepth(19);

    const titleGame = this.add.text(240,170,'GAME',{
      font:'80px sans-serif',fill:'#f00',stroke:'#000',strokeThickness:8
    }).setOrigin(0.5).setDepth(20).setAlpha(0);
    const titleOver = this.add.text(240,250,'OVER',{
      font:'80px sans-serif',fill:'#f00',stroke:'#000',strokeThickness:8
    }).setOrigin(0.5).setDepth(20).setAlpha(0);
    this.tweens.add({targets:[titleGame,titleOver],alpha:1,duration:dur(1200)});

    const img = this.add.image(240,250,'fired_end')
      .setScale(2.4)
      .setDepth(20)
      .setAlpha(0);
    this.tweens.add({targets:img,alpha:1,duration:dur(1200),delay:dur(1000)});
    awardBadge(this, img.texture.key);

    const line1 = this.add.text(240,450,'LADY FALCON WINS',
      {font:'28px sans-serif',fill:'#fff',align:'center',wordWrap:{width:440}})
      .setOrigin(0.5)
      .setDepth(21)
      .setAlpha(0);
    this.tweens.add({targets:line1,alpha:1,duration:dur(1200),delay:dur(1700)});

    const line2 = this.add.text(240,490,'(and then you are fired)',
      {font:'20px sans-serif',fill:'#fff',align:'center',wordWrap:{width:440}})
      .setOrigin(0.5)
      .setDepth(21)
      .setAlpha(0);
    this.tweens.add({targets:line2,alpha:1,duration:dur(600),delay:dur(2400)});

    const btn = this.add.text(240,550,'Try Again',{
      font:'20px sans-serif',
      fill:'#000',
      backgroundColor:'#ffffff',
      padding:{x:14,y:8}
    }).setOrigin(0.5).setDepth(22).setAlpha(0)
      .setInteractive({ useHandCursor:true });

    const showBtnDelay = dur(2400) + dur(600) + 1000;
    this.tweens.add({targets:btn,alpha:1,duration:dur(600),delay:showBtnDelay});
    btn.on('pointerdown',()=>{
        btn.disableInteractive();
        GameState.carryPortrait = img.setDepth(25);
        btn.setVisible(false);
        createGlowTexture(this,0xffffff,'screen_flash',256);
        const overlayG = this.add.image(btn.x,btn.y,'screen_flash').setDepth(23);
        overlayG.setDisplaySize(btn.width,btn.height);
        this.tweens.add({
          targets:overlayG,
          x:240,
          y:320,
          scaleX:Math.max(480/btn.width,640/btn.height)*2,
          scaleY:Math.max(480/btn.width,640/btn.height)*2,
          duration:300,
          ease:'Cubic.easeOut',
          onComplete:()=>{
            titleGame.destroy();
            titleOver.destroy();
            img.destroy();
            line1.destroy();
            line2.destroy();
            btn.destroy();
            if(endOverlay){ endOverlay.destroy(); endOverlay=null; }
            restartGame.call(this, overlayG);
          }
        });
      });
    GameState.gameOver=true;
  }

  function showFalconLoss(){
    const scene = this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
    cleanupBarks();
    cleanupBursts();
    cleanupSparkles(scene);
    cleanupDogs(scene);
    cleanupSparrows(scene);
    hideOverlayTexts();
    if (GameState.spawnTimer) { GameState.spawnTimer.remove(false); GameState.spawnTimer = null; }
    clearDialog.call(scene);
    if(endOverlay){ endOverlay.destroy(); }
    endOverlay = this.add.rectangle(240,320,480,640,0x000000).setDepth(19);

    const titleGame = this.add.text(240,170,'GAME',{
      font:'80px sans-serif',fill:'#f00',stroke:'#000',strokeThickness:8
    }).setOrigin(0.5).setDepth(20).setAlpha(0);
    const titleOver = this.add.text(240,250,'OVER',{
      font:'80px sans-serif',fill:'#f00',stroke:'#000',strokeThickness:8
    }).setOrigin(0.5).setDepth(20).setAlpha(0);
    this.tweens.add({targets:[titleGame,titleOver],alpha:1,duration:dur(1200)});

    const img = this.add.image(240,250,'falcon_end')
      .setScale(1.2)
      .setDepth(20)
      .setAlpha(0);
    this.tweens.add({targets:img,alpha:1,duration:dur(1200),delay:dur(1000)});
    awardBadge(this, img.texture.key);

    const line1 = this.add.text(240,450,'YOU LOST ALL THE MONEY',
      {font:'28px sans-serif',fill:'#fff'})
      .setOrigin(0.5)
      .setDepth(21)
      .setAlpha(0);
    this.tweens.add({targets:line1,alpha:1,duration:dur(1200),delay:dur(1700)});

    const line2 = this.add.text(240,490,'Lady Falcon reclaims her coffee truck',
      {font:'20px sans-serif',fill:'#fff',align:'center',wordWrap:{width:440}})
      .setOrigin(0.5)
      .setDepth(21)
      .setAlpha(0);
    this.tweens.add({targets:line2,alpha:1,duration:dur(600),delay:dur(2400)});

    const btn = this.add.text(240,550,'Try Again',{
      font:'20px sans-serif',
      fill:'#000',
      backgroundColor:'#ffffff',
      padding:{x:14,y:8}
    }).setOrigin(0.5).setDepth(22).setAlpha(0)
      .setInteractive({ useHandCursor:true });


    // Align the interactive zone with the button text
    // Removed outdated reference to btnZone/btnText which are no longer defined

    const showBtnDelay = dur(2400) + dur(600) + 1000;
    this.tweens.add({targets:btn,alpha:1,duration:dur(600),delay:showBtnDelay});
    btn.on('pointerdown',()=>{
        btn.disableInteractive();
        GameState.carryPortrait = img.setDepth(25);
        btn.setVisible(false);
        createGlowTexture(this,0xffffff,'screen_flash',256);
        const overlayG = this.add.image(btn.x,btn.y,'screen_flash').setDepth(23);
        overlayG.setDisplaySize(btn.width,btn.height);
        this.tweens.add({
          targets:overlayG,
          x:240,
          y:320,
          scaleX:Math.max(480/btn.width,640/btn.height)*2,
          scaleY:Math.max(480/btn.width,640/btn.height)*2,
          duration:300,
          ease:'Cubic.easeOut',
          onComplete:()=>{
            titleGame.destroy();
            titleOver.destroy();
            img.destroy();
            line1.destroy();
            line2.destroy();
            btn.destroy();
            if(endOverlay){ endOverlay.destroy(); endOverlay=null; }
            restartGame.call(this, overlayG);
          }
        });
      });
    GameState.gameOver=true;
  }

  function showFalconDefeat(){
    const scene = this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
    cleanupBarks();
    cleanupBursts();
    cleanupSparkles(scene);
    cleanupDogs(scene);
    cleanupSparrows(scene);
    hideOverlayTexts();
    if (GameState.spawnTimer) {
      GameState.spawnTimer.remove(false);
      GameState.spawnTimer = null;
    }
    clearDialog.call(scene);
    if(endOverlay){ endOverlay.destroy(); }
    endOverlay = this.add.rectangle(240,320,480,640,0x000000).setDepth(19);

    GameState.falconDefeated = true;

    const overlay = GameState.victoryOverlay;
    if(overlay){
      overlay.setDepth(20);
    }

    const fadeDur = dur(2400);

    const img = this.add.image(240,250,'falcon_victory')
      .setScale(2.4)
      .setDepth(21)
      .setAlpha(0);
    this.tweens.add({targets:img,alpha:1,duration:fadeDur});
    awardBadge(this, img.texture.key);

    const line1 = this.add.text(240,450,'LADY FALCON DEFEATED',
      {font:'28px sans-serif',fill:'#fff'})
      .setOrigin(0.5)
      .setDepth(22)
      .setAlpha(0);
    // Apply a yellow to gold gradient for emphasis
    const l1grad = line1.context.createLinearGradient(0,0,0,line1.height);
    l1grad.addColorStop(0,'#ffeb60');
    l1grad.addColorStop(1,'#d4a000');
    line1.setFill(l1grad);
    this.tweens.add({targets:line1,alpha:1,duration:fadeDur,delay:dur(2400)});

    const line2a = this.add.text(0,0,'Victory through ',
      {font:'20px sans-serif',fill:'#fff'});
    const line2Love = this.add.text(0,0,'Love and ',
      {font:'20px sans-serif',fill:'#ffb6c1'});
    const line2Kind = this.add.text(0,0,'Kindness',
      {font:'20px sans-serif',fill:'#add8e6'});

    const line2Width = line2a.width + line2Love.width + line2Kind.width;
    const line2StartX = 240 - line2Width/2;
    const line2Y = 490;
    line2a.setPosition(line2StartX,line2Y).setOrigin(0,0.5).setDepth(22).setAlpha(0);
    line2Love.setPosition(line2StartX + line2a.width,line2Y).setOrigin(0,0.5).setDepth(22).setAlpha(0);
    line2Kind.setPosition(line2StartX + line2a.width + line2Love.width,line2Y)
      .setOrigin(0,0.5).setDepth(22).setAlpha(0);

    const line2Delay = dur(2400) + fadeDur;
    this.tweens.add({targets:line2a,alpha:1,duration:dur(1200),delay:line2Delay});
    this.tweens.add({targets:line2Love,alpha:1,duration:dur(1200),delay:line2Delay + dur(1200)});
    this.tweens.add({targets:line2Kind,alpha:1,duration:dur(1200),delay:line2Delay + dur(2400)});

    const btn = this.add.text(240,550,'Play Again?',{
      font:'20px sans-serif',
      fill:'#000',
      backgroundColor:'#ffffff',
      padding:{x:14,y:8}
    }).setOrigin(0.5).setDepth(23).setAlpha(0)
      .setInteractive({ useHandCursor:true });

    const showBtnDelay = dur(5600);
    this.tweens.add({targets:btn,alpha:1,duration:dur(600),delay:showBtnDelay});

    btn.on('pointerdown',()=>{
        btn.disableInteractive();
        GameState.carryPortrait = img.setDepth(25);
        btn.setVisible(false);
        if(overlay){ this.tweens.add({targets:overlay,alpha:0,duration:dur(600)}); }
        createGlowTexture(this,0xffffff,'screen_flash',256);
        const overlayG = this.add.image(btn.x,btn.y,'screen_flash').setDepth(24);
        overlayG.setDisplaySize(btn.width,btn.height);
        this.tweens.add({
          targets:overlayG,
          x:240,
          y:320,
          scaleX:Math.max(480/btn.width,640/btn.height)*2,
          scaleY:Math.max(480/btn.width,640/btn.height)*2,
          duration:300,
          ease:'Cubic.easeOut',
          onComplete:()=>{
            img.destroy();
            line1.destroy();
            line2a.destroy();
            line2Love.destroy();
            line2Kind.destroy();
            btn.destroy();
            if(overlay) overlay.destroy();
            GameState.victoryOverlay = null;
            if(endOverlay){ endOverlay.destroy(); endOverlay=null; }
            restartGame.call(this, overlayG);
          }
        });
      });
    if(overlay){ this.tweens.add({targets:overlay,alpha:0,duration:fadeDur}); }
    GameState.gameOver=true;
  }

  function showCustomerRevoltLoss(){
    const scene = this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
    cleanupBarks();
    cleanupBursts();
    cleanupSparkles(scene);
    cleanupDogs(scene);
    cleanupSparrows(scene);
    hideOverlayTexts();
    if (GameState.spawnTimer) { GameState.spawnTimer.remove(false); GameState.spawnTimer = null; }
    clearDialog.call(scene);
    if(endOverlay){ endOverlay.destroy(); }
    endOverlay = this.add.rectangle(240,320,480,640,0x000000).setDepth(19);

    const titleGame = this.add.text(240,170,'GAME',{
      font:'80px sans-serif',fill:'#f00',stroke:'#000',strokeThickness:8
    }).setOrigin(0.5).setDepth(20).setAlpha(0);
    const titleOver = this.add.text(240,250,'OVER',{
      font:'80px sans-serif',fill:'#f00',stroke:'#000',strokeThickness:8
    }).setOrigin(0.5).setDepth(20).setAlpha(0);
    this.tweens.add({targets:[titleGame,titleOver],alpha:1,duration:dur(1200)});

    const img = this.add.image(240,250,'revolt_end')
      .setScale(1.2)
      .setDepth(20)
      .setAlpha(0);
    this.tweens.add({targets:img,alpha:1,duration:dur(1200),delay:dur(1000)});
    awardBadge(this, img.texture.key);

    const line1 = this.add.text(240,450,'THE CUSTOMERS REVOLT!',
      {font:'28px sans-serif',fill:'#fff'})
      .setOrigin(0.5)
      .setDepth(21)
      .setAlpha(0);
    this.tweens.add({targets:line1,alpha:1,duration:dur(1200),delay:dur(1700)});

    const line2 = this.add.text(240,490,'They stole your coffee truck!',
      {font:'20px sans-serif',fill:'#fff',align:'center',wordWrap:{width:440}})
      .setOrigin(0.5)
      .setDepth(21)
      .setAlpha(0);
    this.tweens.add({targets:line2,alpha:1,duration:dur(600),delay:dur(2400)});

    const btn = this.add.text(240,550,'Try Again',{
      font:'20px sans-serif',
      fill:'#000',
      backgroundColor:'#ffffff',
      padding:{x:14,y:8}
    }).setOrigin(0.5).setDepth(22).setAlpha(0)
      .setInteractive({ useHandCursor:true });


    // Align the interactive zone with the button text
    // Removed outdated reference to btnZone/btnText which are no longer defined

    const showBtnDelay = dur(2400) + dur(600) + 1000;
    this.tweens.add({targets:btn,alpha:1,duration:dur(600),delay:showBtnDelay});

    btn.on('pointerdown',()=>{
        btn.disableInteractive();
        GameState.carryPortrait = img.setDepth(25);
        btn.setVisible(false);
        createGlowTexture(this,0xffffff,'screen_flash',256);
        const overlayG = this.add.image(btn.x,btn.y,'screen_flash').setDepth(23);
        overlayG.setDisplaySize(btn.width,btn.height);
        this.tweens.add({
          targets:overlayG,
          x:240,
          y:320,
          scaleX:Math.max(480/btn.width,640/btn.height)*2,
          scaleY:Math.max(480/btn.width,640/btn.height)*2,
          duration:300,
          ease:'Cubic.easeOut',
          onComplete:()=>{
            titleGame.destroy();
            titleOver.destroy();
            img.destroy();
            line1.destroy();
            line2.destroy();
            btn.destroy();
            if(endOverlay){ endOverlay.destroy(); endOverlay=null; }
            restartGame.call(this, overlayG);
          }
        });
      });
    GameState.gameOver=true;
  }


  function restartGame(overlay){
    const scene=this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
    cleanupBarks();
    cleanupBursts();
    cleanupSparkles(scene);
    cleanupSparrows(scene);
    if (GameState.spawnTimer) {
      GameState.spawnTimer.remove(false);
      GameState.spawnTimer = null;
    }
    if (GameState.dogBarkEvent) {
      GameState.dogBarkEvent.remove(false);
      GameState.dogBarkEvent = null;
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
      girl.setPosition(startX, 245)
        .setVisible(false)
        .setAlpha(1);
      if (girl.clearTint) girl.clearTint();
    }
    GameState.money=10.00; GameState.love=3;
    updateMoneyDisplay();
    loveText.setText(String(GameState.love));
    moneyText.setColor('#fff');
    loveText.setColor('#fff');
    if (cloudDollar && cloudDollar.clearTint) cloudDollar.clearTint();
    if (cloudHeart && cloudHeart.clearTint) cloudHeart.clearTint();
    updateLevelDisplay();
    updateCloudStatus(scene);
    if(GameState.activeCustomer){
      if(GameState.activeCustomer.heartEmoji){ GameState.activeCustomer.heartEmoji.destroy(); GameState.activeCustomer.heartEmoji=null; }
      GameState.activeCustomer.sprite.destroy();
    }
    setActiveCustomer(null);
    cleanupDogs(scene);
    GameState.queue.forEach(c => {
      if(c.walkTween){ if(c.walkTween.isPlaying && c.walkTween.stop) c.walkTween.stop(); if(c.walkTween.remove) c.walkTween.remove(); c.walkTween=null; }
      if(c.heartEmoji){ c.heartEmoji.destroy(); c.heartEmoji=null; }
      if(c.dog){ if(c.dog.followEvent) c.dog.followEvent.remove(false); c.dog.destroy(); c.dog=null; }
      if(c.sprite) c.sprite.destroy();
    });
    GameState.wanderers.forEach(c => {
      if(c.walkTween){ if(c.walkTween.isPlaying && c.walkTween.stop) c.walkTween.stop(); if(c.walkTween.remove) c.walkTween.remove(); c.walkTween=null; }
      if(c.heartEmoji){ c.heartEmoji.destroy(); c.heartEmoji=null; }
      if(c.dog){ if(c.dog.followEvent) c.dog.followEvent.remove(false); c.dog.destroy(); c.dog=null; }
      if(c.sprite) c.sprite.destroy();
    });
    GameState.queue=[];
    GameState.wanderers=[];
    Object.keys(GameState.customerMemory).forEach(k=>{ delete GameState.customerMemory[k]; });
    GameState.heartWin = null;
    GameState.servedCount=0;
    GameState.saleInProgress = false;
    sideCAlpha=0;
    sideCFadeTween=null;
    GameState.gameOver=false;
    showStartScreen.call(this);
    scheduleSparrowSpawn(this);
    if(overlay){
      scene.time.delayedCall(50,()=>{
        scene.tweens.add({targets:overlay,alpha:0,duration:400,onComplete:()=>overlay.destroy()});
      },[],scene);
    }
  }

   Assets = { keys, requiredAssets, preload };
   Scene = { create, showStartScreen, playIntro };
   Customers = { spawnCustomer, lureNextWanderer, moveQueueForward, scheduleNextSpawn,
                      showDialog, clearDialog, handleAction, showFalconAttack,
                      showCustomerRevolt, showCustomerRevoltLoss, restartGame };

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
  // game.js calls setupGame() when loaded. Avoid running twice.
}

export { showStartScreenFn as showStartScreen, handleActionFn as handleAction, spawnCustomerFn as spawnCustomer, scheduleNextSpawnFn as scheduleNextSpawn, showDialogFn as showDialog, animateLoveChangeFn as animateLoveChange, blinkButtonFn as blinkButton, startWander };
