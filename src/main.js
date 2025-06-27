import { debugLog, DEBUG } from './debug.js';
import { dur, scaleForY, articleFor, flashMoney, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_Y, DIALOG_Y } from "./ui.js";
import { ORDER_X, ORDER_Y, WANDER_TOP, WANDER_BOTTOM, WALK_OFF_BASE, MAX_M, MAX_L, calcLoveLevel, queueLimit, RESPAWN_COOLDOWN } from "./customers.js";
import { lureNextWanderer, moveQueueForward, scheduleNextSpawn, spawnCustomer, startDogWaitTimer, checkQueueSpacing } from './entities/customerQueue.js';
import { baseConfig } from "./scene.js";
import { GameState, floatingEmojis, addFloatingEmoji, removeFloatingEmoji } from "./state.js";
import { CustomerState } from './constants.js';

import { scheduleSparrowSpawn, updateSparrows, cleanupSparrows, scatterSparrows } from './sparrow.js';
import { DOG_TYPES, DOG_MIN_Y, DOG_COUNTER_RADIUS, sendDogOffscreen, scaleDog, cleanupDogs, updateDog, dogTruckRuckus, dogRefuseJumpBark, animateDogPowerUp } from './entities/dog.js';
import { startWander } from './entities/wanderers.js';

import { flashBorder, flashFill, blinkButton, applyRandomSkew, emphasizePrice, setDepthFromBottom, createGrayscaleTexture, createGlowTexture } from './ui/helpers.js';

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
    updateCloudStatus(scene);
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
    cloudDollarTween=makeTween(cloudDollarTween,[cloudDollar,moneyText],amps[moneyIdx],durs[moneyIdx]);
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
    });

    if(scene && scene.children){
      scene.children.list.slice().forEach(child=>{
        if(child instanceof Phaser.GameObjects.Text && HEART_EMOJI_LIST.includes(child.text)){
          child.destroy();
        }
      });
    }
  }




  function hideOverlayTexts(){
    if(reportLine1) reportLine1.setVisible(false);
    if(reportLine2) reportLine2.setVisible(false);
    if(reportLine3) reportLine3.setVisible(false);
    if(tipText) tipText.setVisible(false);
    if(paidStamp) paidStamp.setVisible(false);
    if(lossStamp) lossStamp.setVisible(false);
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
      const img = buttonImage(btn);
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
    });
    timeline.play();
  }

  function fadeOutOtherButtons(selected){
    const others=[btnSell,btnGive,btnRef].filter(b=>b&&b!==selected);
    others.forEach(btn=>{
      if(btn.input) btn.input.enabled=false;
      if(this.tweens){
        this.tweens.add({targets:btn,alpha:0,duration:dur(150),onComplete:()=>{btn.setVisible(false);}});
      }else{
        btn.setVisible(false);
      }
    });
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
    if(!btnSell || !btnSell.glow) return;
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
      glowTween.setCallback('onComplete', () => cb());
    }
  }




  let moneyText, loveText, cloudHeart, cloudDollar, queueLevelText;
  let dialogBg, dialogText, dialogCoins,
      dialogPriceLabel, dialogPriceValue, dialogPriceBox,
      dialogDrinkEmoji, dialogPriceContainer, dialogPriceTicket, dialogPupCup,
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
  let blendBtn, opacityIncreaseBtn, opacityDecreaseBtn, opacityLabel;
  // hearts or anger symbols currently animating


  function enforceCustomerScaling(){
      const updateHeart = c => {
        if(!c.sprite || !c.sprite.scene) return;
        const state = c.memory && c.memory.state || CustomerState.NORMAL;
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




  function preload(){
    preloadAssets.call(this);
  }

  function create(){
    this.assets = Assets;
    this.customers = Customers;
    this.gameState = GameState;
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
      // Use additive blend to remove dark areas
      .setBlendMode(Phaser.BlendModes.ADD)

      .setAlpha(0.5)
      .setPostPipeline('desaturate');

    const dollarPipeline = cloudDollar.getPostPipeline('desaturate');
    if (dollarPipeline) dollarPipeline.amount = 0.5;

    cloudDollar.x = 160 - cloudDollar.displayWidth/2;
    moneyText=this.add.text(0,0,receipt(GameState.money),{font:'26px sans-serif',fill:'#fff'})
      .setOrigin(0.5)
      .setDepth(2)
      .setBlendMode(Phaser.BlendModes.NEGATIVE)
      .setAlpha(1);
    moneyText.setPosition(
      cloudDollar.x + cloudDollar.displayWidth/2,
      cloudDollar.y + cloudDollar.displayHeight/2
    );
    cloudHeart=this.add.sprite(0,35,'cloudHeart')
      .setOrigin(1,0)
      .setDepth(1)
      .setScale(2.4)
      // Use additive blend to remove dark areas
      .setBlendMode(Phaser.BlendModes.ADD)

      .setAlpha(0.5)
      .setPostPipeline('desaturate');

    const heartPipeline = cloudHeart.getPostPipeline('desaturate');
    if (heartPipeline) heartPipeline.amount = 0.5;

    cloudHeart.x = 320 + cloudHeart.displayWidth/2;
    loveText=this.add.text(0,0,GameState.love,{font:'26px sans-serif',fill:'#fff'})
      .setOrigin(0.5)
      .setDepth(2)
      .setBlendMode(Phaser.BlendModes.NEGATIVE)
      .setAlpha(1);
    loveText.setPosition(
      cloudHeart.x - cloudHeart.displayWidth/2,
      cloudHeart.y + cloudHeart.displayHeight/2
    );
    moneyText.setInteractive({ useHandCursor:true });
    loveText.setInteractive({ useHandCursor:true });
    moneyText.on('pointerdown',()=>{
      GameState.money = +(GameState.money + 20).toFixed(2);
      moneyText.setText(receipt(GameState.money));
      animateStatChange(moneyText, this, 1);
    });
    loveText.on('pointerdown',()=>{
      GameState.love += 10;
      loveText.setText(GameState.love);
      updateLevelDisplay();
      animateStatChange(loveText, this, 1, true);
    });

    // gentle cloud animations handled by updateCloudStatus
    updateCloudStatus(this);

    const blendModeEntries = Object.entries(Phaser.BlendModes)
      .filter(([k,v]) => typeof v === 'number' && isNaN(Number(k)) && k.toUpperCase() === k)
      .sort((a,b) => a[1]-b[1]);
    let blendIndex = 0;
    const applyBlend = () => {
      const mode = blendModeEntries[blendIndex];
      cloudHeart.setBlendMode(mode[1]);
      cloudDollar.setBlendMode(mode[1]);
      blendBtn.setText(`Blend: ${mode[0]}`);
    };
    blendBtn = this.add.text(470, 8, '', {font:'12px sans-serif',fill:'#fff',backgroundColor:'#000',padding:{x:4,y:2}})
      .setOrigin(1,0)
      .setDepth(5)
      .setInteractive({ useHandCursor:true })
      .on('pointerdown',()=>{
        blendIndex = (blendIndex + 1) % blendModeEntries.length;
        applyBlend();
      });
    applyBlend();

    let opacity = cloudHeart.alpha;
    opacityLabel = this.add.text(470, 26, `Opacity: ${opacity.toFixed(2)}`,
      {font:'12px sans-serif',fill:'#fff'})
      .setOrigin(1,0)
      .setDepth(5);
    opacityIncreaseBtn = this.add.text(470, 42, 'Opacity +', {font:'12px sans-serif',fill:'#0f0',backgroundColor:'#000',padding:{x:4,y:2}})
      .setOrigin(1,0)
      .setDepth(5)
      .setInteractive({ useHandCursor:true })
      .on('pointerdown',()=>{
        opacity = Math.min(1, opacity + 0.1);
        cloudHeart.setAlpha(opacity);
        cloudDollar.setAlpha(opacity);
        opacityLabel.setText(`Opacity: ${opacity.toFixed(2)}`);
      });
    opacityDecreaseBtn = this.add.text(470, 58, 'Opacity -', {font:'12px sans-serif',fill:'#f00',backgroundColor:'#000',padding:{x:4,y:2}})
      .setOrigin(1,0)
      .setDepth(5)
      .setInteractive({ useHandCursor:true })
      .on('pointerdown',()=>{
        opacity = Math.max(0, opacity - 0.1);
        cloudHeart.setAlpha(opacity);
        cloudDollar.setAlpha(opacity);
        opacityLabel.setText(`Opacity: ${opacity.toFixed(2)}`);
      });
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

    dialogPriceContainer=this.add.container(0,0,[dialogPriceTicket, dialogPupCup, dialogPriceBox, dialogDrinkEmoji, dialogPriceLabel, dialogPriceValue])
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
  }

  function showDialog(){
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
    // reset the dialog position in case previous animations moved it
    dialogBg.y = typeof DIALOG_Y === 'number' ? DIALOG_Y : 430;
    dialogBg.setAlpha(1);
    dialogText.setAlpha(1);
    dialogCoins.setAlpha(1);
    GameState.activeCustomer=GameState.queue[0]||null;
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

    const girlRight = (typeof girl !== 'undefined' && girl)
      ? girl.x + girl.displayWidth / 2
      : dialogBg.x;
    const minX = girlRight + ticketOffset;

    let priceTargetX;
    let priceTargetY;
    if (truckRef) {
      const truckRight = truckRef.x + truckRef.displayWidth / 2;
      const truckTop = truckRef.y - truckRef.displayHeight / 2;
      priceTargetX = Math.max(truckRight + ticketOffset, minX) - 20;
      priceTargetY = truckTop + ticketH / 2 - 10;
    } else {
      const priceTargetXDefault = dialogBg.x + dialogBg.width/2 - 30; // nudge right
      priceTargetX = Math.max(priceTargetXDefault, minX) - 20;
      priceTargetY = dialogBg.y - dialogBg.height - 20 - (c.isDog ? 30 : 0) - 10;
    }

    const startX = (typeof girl !== 'undefined' && girl) ? girl.x : dialogBg.x;
    const startY = (typeof girl !== 'undefined' && girl) ? girl.y - 30 : dialogBg.y - 10;
    dialogPriceContainer
      .setPosition(startX, startY)
      .setScale(0.2)
      .setVisible(false);
    if (dialogDrinkEmoji.parentContainer !== dialogPriceContainer) {
      dialogPriceContainer.add(dialogDrinkEmoji);
    }
    dialogDrinkEmoji.attachedTo = null;
    dialogPriceContainer.alpha = 1;
    if(c.isDog){
      dialogPriceTicket.setVisible(false);
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
          this.tweens.add({
            targets:dialogPriceContainer,
            x:priceTargetX,
            y:priceTargetY,
            scale:1,
            duration:dur(300),
            ease:'Sine.easeOut',
            onComplete:()=>{
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
            animateDogPowerUp(this, target, react);
          });
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
            this.tweens.add({targets:ticket, x:520, alpha:0,
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
    GameState.activeCustomer=null;

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
        if(GameState.money<=0){
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
        if(GameState.money>=MAX_M){showEnd.call(this,'Congrats! 💰');return;}
        if(GameState.love>=MAX_L){showEnd.call(this,'Victory! ❤️');return;}
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
          dogCust.walkTween.stop();
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
        GameState.activeCustomer = dogCust;
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
      const destX=moneyText.x+moneyText.width-15;
      const destY=moneyText.y+10;
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
              GameState.money=+(GameState.money+mD).toFixed(2);
              moneyText.setText(receipt(GameState.money));
              animateStatChange(moneyText, this, mD);
              done();
            });
          }});
        tl.add({targets:ticket,x:destX,y:destY,scale:0,duration:dur(400),
          onStart:()=>{
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
          }});
        tl.play();
      },[],this);
        } else if(type==='give'){
      const ticket=dialogPriceContainer;
      const t=dialogPriceValue;
      const destX=moneyText.x+moneyText.width-15;
      const destY=moneyText.y+10;
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
              GameState.money = +(GameState.money + mD).toFixed(2);
              moneyText.setText(receipt(GameState.money));
              animateStatChange(moneyText, this, mD);
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
              moneyText.setText(receipt(GameState.money));
              animateStatChange(moneyText, this, mD);
              done();
          }});
          if (typeof dialogPriceBox !== 'undefined' && dialogPriceBox) {
            flashBorder(dialogPriceBox,this,0xff0000);
            flashFill(dialogPriceBox,this,0xff0000);
          }
          tl.add({targets:ticket,x:destX,y:destY,scale:0,duration:dur(400),
            onStart:()=>{
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

            }});
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

      const destX=moneyText.x+moneyText.width-15;
      const destY=moneyText.y+10;
      const moving=[reportLine1];
      const tl=this.tweens.createTimeline({callbackScope:this,onComplete:()=>{
          reportLine1.setVisible(false).alpha=1;
          reportLine2.setVisible(false).alpha=1;
          reportLine3.setVisible(false).alpha=1;
          GameState.money=+(GameState.money+mD).toFixed(2);
          moneyText.setText(receipt(GameState.money));
          animateStatChange(moneyText, this, mD);
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
      if(sprite && sprite.clearTint) sprite.clearTint();
    }, [], scene);
  }

  function showFalconAttack(cb){
    if (GameState.falconActive) return;
    const scene=this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
    // Keep dogs around so they can defend the girl
    cleanupSparrows(scene);
    hideOverlayTexts();
    clearDialog.call(scene);
    GameState.falconActive = true;
    GameState.gameOver = true;
    GameState.girlHP = 5;
    GameState.falconHP = 10;
    if (GameState.dogBarkEvent) { GameState.dogBarkEvent.remove(false); }
    GameState.dogBarkEvent = null;
    if (GameState.spawnTimer) { GameState.spawnTimer.remove(false); GameState.spawnTimer = null; }

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
        if(c.walkTween){ c.walkTween.stop(); c.walkTween=null; }
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
            const bark=scene.add.sprite(dog.x,dog.y-20,'dog1',3).setOrigin(0.5).setDepth(dog.depth+1).setScale(Math.abs(dog.scaleX),Math.abs(dog.scaleY));
            scene.tweens.add({targets:bark,y:'-=20',alpha:0,duration:dur(600),onComplete:()=>bark.destroy()});
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
            });
            dTl.setCallback('onComplete',()=>{ if(dog) dog.setFrame(1); });
            if(dog && dog.anims && dog.play){ dog.play('dog_walk'); }
            dTl.play();
          }
          return;
        }

        if(state===CustomerState.GROWING){
          const tl=scene.tweens.createTimeline();
          tl.add({targets:c.sprite,x:Phaser.Math.Between(40,440),y:Phaser.Math.Between(WANDER_TOP,WANDER_BOTTOM),duration:dur(400)});
          tl.add({targets:c.sprite,x:girl.x+Phaser.Math.Between(-60,60),y:girl.y+Phaser.Math.Between(-40,40),duration:dur(300)});
          tl.add({targets:c.sprite,duration:dur(300)});
          tl.add({targets:c.sprite,x:targetX,duration:dur(WALK_OFF_BASE/1.2),onComplete:()=>{c.sprite.destroy();remaining--;if(remaining===0&&done)done();}});
          tl.play();
          return;
        }

        if(state===CustomerState.SPARKLING||state===CustomerState.ARROW){
          const loops=state===CustomerState.ARROW?5:3;
          const persistent=state===CustomerState.ARROW;
          const attack=a=>{
            scene.tweens.add({targets:a,x:falcon.x+Phaser.Math.Between(-5,5),y:falcon.y+Phaser.Math.Between(-5,5),duration:dur(80),yoyo:true,onComplete:()=>{if(persistent){scene.time.delayedCall(dur(Phaser.Math.Between(200,400)),()=>attack(a),[],scene);} else if(--a.atkLoops>0){scene.time.delayedCall(dur(Phaser.Math.Between(200,400)),()=>attack(a),[],scene);} }});
          };
          c.sprite.atkLoops=loops;
          attack(c.sprite);
          if(!persistent){
            scene.time.delayedCall(dur(2000),runOff,[],scene);
          } else {
            remaining--; if(remaining===0&&done)done();
          }
          return;
        }

        runOff();
      });
    }
function dogsBarkAtFalcon(){
      const dogs=[];
      const gatherDog=c=>{ if(c && c.dog) dogs.push(c.dog); };
      GameState.queue.forEach(gatherDog);
      GameState.wanderers.forEach(gatherDog);
      gatherDog(GameState.activeCustomer);
      if(dogs.length===0) return;
        dogs.forEach(dog=>{
          const mood=dog.dogCustomer && dog.dogCustomer.memory ? dog.dogCustomer.memory.state : CustomerState.NORMAL;
        if(mood===CustomerState.BROKEN || mood===CustomerState.NORMAL){
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
        const bark=scene.add.sprite(dog.x,dog.y-20,'dog1',3)
          .setOrigin(0.5)
          .setDepth(dog.depth+1)
          .setScale(Math.abs(dog.scaleX), Math.abs(dog.scaleY));
        GameState.activeBarks.push(bark);
        scene.tweens.add({
          targets:bark,
          y:'-=20',
          alpha:0,
          duration:dur(600),
          onComplete:()=>{
            const idx=GameState.activeBarks.indexOf(bark);
            if(idx!==-1) GameState.activeBarks.splice(idx,1);
            bark.destroy();
          }
        });
          let loops=1;
          if(mood===CustomerState.GROWING) loops=1;
          if(mood===CustomerState.SPARKLING) loops=2;
          if(mood===CustomerState.ARROW) loops=3;
          const dTl=scene.tweens.createTimeline();
        for(let j=0;j<loops;j++){
          const ang=Phaser.Math.FloatBetween(0,Math.PI*2);
          const r=Phaser.Math.Between(30,50);
          const dx=falcon.x+Math.cos(ang)*r;
          let dy=falcon.y+Math.sin(ang)*r;
          if(dy < DOG_MIN_Y) dy = DOG_MIN_Y;
          dTl.add({targets:dog,x:dx,y:dy,duration:dur(Phaser.Math.Between(300,500)),ease:'Sine.easeInOut'});
        }
        dTl.setCallback('onUpdate',()=>{
          if(dog.prevX===undefined) dog.prevX=dog.x;
          const dx=dog.x-dog.prevX;
          if(Math.abs(dx)>3){ dog.dir=dx>0?1:-1; }
          dog.prevX=dog.x;
          const s=scaleForY(dog.y)*0.5;
          dog.setScale(s*(dog.dir||1), s);
        });
        dTl.setCallback('onComplete',()=>{
          dog.setFrame(1);
          const dmgPer= (dog.scaleFactor||dog.baseScaleFactor||0.6) > (dog.baseScaleFactor||0.6) ? 1.5 : 1;
          const total = loops * dmgPer;
          GameState.falconHP=Math.max(0,GameState.falconHP-total);
          falconHpText.setText(GameState.falconHP);
          // burstFeathers(scene, falcon.x, falcon.y, total);
          blinkFalcon();
          if(GameState.falconHP<=0){ endAttack(); }
        });
        if(dog.anims && dog.play){ dog.play('dog_walk'); }
        dTl.play();
      });
    }


    // send everyone scattering immediately in case a new spawn sneaks in
    let finished=false;
    let falcon=null;
    let featherTrail=null;
    let firstAttack=true;
    let attackTween=null;
    const startTrail = () => {
      if (featherTrail) {
        featherTrail.paused = false;
        return;
      }
      featherTrail = scene.time.addEvent({
        delay: dur(120),
        loop: true,
        // callback: () => burstFeathers(scene, falcon.x, falcon.y, 1)
      });
    };
    const stopTrail = () => {
      if (featherTrail) featherTrail.paused = true;
    };
    const endAttack=()=>{
      if(finished) return;
      finished=true;
      if(GameState.dogBarkEvent){
        GameState.dogBarkEvent.remove(false);
        GameState.dogBarkEvent = null;
      }
      if(featherTrail){ featherTrail.remove(false); featherTrail=null; }
      cleanupDogs(scene);
      GameState.falconActive = false;
      if(falconBlinkEvent){ falconBlinkEvent.remove(false); falconBlinkEvent=null; }
      if(girlBlinkEvent){ girlBlinkEvent.remove(false); girlBlinkEvent=null; }
      if(falcon) falcon.clearTint();
      if(girl) girl.clearTint();
      if(falcon) falcon.destroy();
      scene.events.off('update', updateHpPos);
      girlHpText.destroy();
      falconHpText.destroy();
      if(cb) cb();
    };

    falcon=scene.add.sprite(-40,-40,'lady_falcon',0)
      .setScale(1.4,1.68)
      .setDepth(20);
    falcon.anims.play('falcon_fly');
    const girlHpText = scene.add.text(girl.x, girl.y-60, GameState.girlHP,
      {font:'20px sans-serif',fill:'#fff'}).setOrigin(0.5).setDepth(21);
    const falconHpText = scene.add.text(falcon.x, falcon.y-60, GameState.falconHP,
      {font:'20px sans-serif',fill:'#fff'}).setOrigin(0.5).setDepth(21);
    let girlBlinkEvent = startHpBlink(scene, girl, () => GameState.girlHP, 5);
    let falconBlinkEvent = startHpBlink(scene, falcon, () => GameState.falconHP, 10);
    const updateHpPos = () => {
      girlHpText.setPosition(girl.x, girl.y-60);
      falconHpText.setPosition(falcon.x, falcon.y-60);
    };
    scene.events.on('update', updateHpPos);
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
      const attackOnce=()=>{
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
                if(Phaser.Math.Distance.Between(falcon.x,falcon.y,b.x,b.y)<20){
                  const idx=GameState.activeBarks.indexOf(b);
                  if(idx!==-1) GameState.activeBarks.splice(idx,1);
                  b.destroy();
                  if(attackTween){ attackTween.stop(); attackTween=null; }
                  scene.time.delayedCall(dur(300), attackOnce, [], scene);
                }
              });
            },
            onComplete:()=>{
            blinkAngry(scene);
            GameState.girlHP=Math.max(0,GameState.girlHP-1);
            girlHpText.setText(GameState.girlHP);
            const tl=scene.tweens.createTimeline({callbackScope:scene});
          tl.add({targets:falcon,y:targetY+10,duration:dur(80),yoyo:true});
          tl.add({targets:girl,y:girl.y+5,duration:dur(80),yoyo:true,
                   onStart:()=>sprinkleBursts(scene),
                   onYoyo:()=>sprinkleBursts(scene)},'<');
          // No more feathers during the attack
          tl.setCallback('onComplete', () => {
            // stopTrail();
            if(firstAttack) firstAttack=false;
            if(GameState.girlHP<=0){
              endAttack();
            } else {
              attackOnce();
            }
          });
          tl.play();
        }});
      }});
    };
    attackOnce();

    function blinkAngry(s){
      flashRed(s, girl);
    }

    function blinkFalcon(){
      flashRed(scene, falcon);
    }

    function sprinkleBursts(s){
      for(let b=0;b<3;b++){
        const bx=girl.x+Phaser.Math.Between(-20,20);
        const by=girl.y+Phaser.Math.Between(-40,0);
        const line=s.add.rectangle(bx,by,Phaser.Math.Between(2,4),18,0xff0000)
          .setOrigin(0.5).setDepth(21)
          .setAngle(Phaser.Math.Between(-45,45));
        s.tweens.add({targets:line,alpha:0,scaleY:1.5,y:by-10,duration:dur(200),onComplete:()=>line.destroy()});
      }
    }

    function burstFeathers(s, x, y, count=1){
      for(let i=0;i<count;i++){
        const debris=createDebrisEmoji(s, x, y);
        s.tweens.add({targets:debris,
                    x:debris.x+Phaser.Math.Between(-60,60),
                    y:debris.y+Phaser.Math.Between(-50,10),
                    angle:Phaser.Math.Between(-360,360),
                    alpha:0,
                    duration:dur(400),
                    onComplete:()=>debris.destroy()});
        s.time.delayedCall(dur(450),()=>debris.destroy(),[],s);
      }
    }

    function createDebrisEmoji(s, x, y){
      const ox=Phaser.Math.Between(-3,3);
      const oy=Phaser.Math.Between(-3,3);
      return s.add.text(x+ox,y+oy,'🪶',{font:'24px sans-serif',fill:'#5a381e'})
        .setOrigin(0.5).setDepth(21).setScale(0.5);
    }
  }

  function showCustomerRevolt(cb){
    const scene=this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
    hideOverlayTexts();
    clearDialog.call(scene);
    if (GameState.spawnTimer) { GameState.spawnTimer.remove(false); GameState.spawnTimer = null; }
    GameState.girlHP = 5;
    const girlHpText = scene.add.text(girl.x, girl.y - 60, GameState.girlHP.toFixed(1), {font:'20px sans-serif',fill:'#fff'}).setOrigin(0.5).setDepth(21);
    let girlBlinkEvent = startHpBlink(scene, girl, () => GameState.girlHP, 5);
    const updateHpPos = () => { girlHpText.setPosition(girl.x, girl.y-60); };
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
          if(c.walkTween){ c.walkTween.stop(); if(c.walkTween.remove) c.walkTween.remove(); c.walkTween=null; }
          if(c.sprite) c.sprite.destroy();
          if(c.dog){ if(c.dog.followEvent) c.dog.followEvent.remove(false); c.dog.destroy(); }
          return;
        }
        if(c.walkTween){ c.walkTween.stop(); if(c.walkTween.remove) c.walkTween.remove(); c.walkTween=null; }
        if(c.dog){
          if(c.dog.followEvent) c.dog.followEvent.remove(false);
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
          const dog = scene.add.sprite(dx, dy, 'dog1',1)
            .setOrigin(0.5)
            .setTint(0xffffff)
            .setDepth(20);
          dog.baseScaleFactor = 0.4;
          dog.scaleFactor = 0.4;
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

    function blinkGirl(){
      flashRed(scene, girl);
      scene.tweens.add({targets:girl,duration:dur(60),repeat:2,yoyo:true,x:'+=4'});
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
        scene.events.off('update', updateHpPos);
        scene.events.off('update', updateAttackerHearts);
        if(girlBlinkEvent) girlBlinkEvent.remove(false);
        girlHpText.destroy();
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
          GameState.girlHP = Math.max(0, GameState.girlHP - 0.5);
          girlHpText.setText(GameState.girlHP.toFixed(1));
          blinkGirl();
          if(GameState.girlHP<=0){
            finished=true;
            sendDriver(a);
          } else {
            loops.set(a, scene.time.delayedCall(dur(Phaser.Math.Between(400,600)),()=>attack(a),[],scene));
          }
        }
      });
    }

    let firstArrived = false;
    attackers.forEach((a,i)=>{
      const ang = (Math.PI * 2 * i) / attackers.length;
      const r = 40;
      const tx = girl.x + Math.cos(ang) * r;
      let ty = girl.y + Math.sin(ang) * r;
      if(ty < DOG_MIN_Y) ty = DOG_MIN_Y;
      const arrive = () => {
        if(!firstArrived){
          firstArrived = true;
          scene.time.delayedCall(dur(1000), ()=>attack(a), [], scene);
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
      const ty = girl.y + Math.sin(ang) * r;
      const harass = ()=>{
        if(finished) return;
        const ang2 = Phaser.Math.FloatBetween(0, Math.PI*2);
        const dx = girl.x + Math.cos(ang2)*r;
        let dy = girl.y + Math.sin(ang2)*r;
        if(dy < DOG_MIN_Y) dy = DOG_MIN_Y;
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

  function showFalconLoss(){
    const scene = this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
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

    const line1 = this.add.text(240,450,"You've lost all the money",
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
        const key = img ? img.texture.key : null;
        if(key){
          GameState.lastEndKey = key;
          if(!GameState.badges.includes(key)) GameState.badges.push(key);
          GameState.badgeCounts[key] = (GameState.badgeCounts[key] || 0) + 1;
          const grayKey = `${key}_gray`;
          createGrayscaleTexture(this,key,grayKey);
          GameState.carryPortrait = img.setDepth(25);
        }
        btn.setVisible(false);
        const flashTex = createGlowTexture(this,0xffffff,'screen_flash',256);
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

  function showCustomerRevoltLoss(){
    const scene = this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
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

    const line1 = this.add.text(240,450,'The customers revolt!',
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
        const key = img ? img.texture.key : null;
        if(key){
          GameState.lastEndKey = key;
          if(!GameState.badges.includes(key)) GameState.badges.push(key);
          GameState.badgeCounts[key] = (GameState.badgeCounts[key] || 0) + 1;
          const grayKey = `${key}_gray`;
          createGrayscaleTexture(this,key,grayKey);
          GameState.carryPortrait = img.setDepth(25);
        }
        btn.setVisible(false);
        const flashTex = createGlowTexture(this,0xffffff,'screen_flash',256);
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

  function showEnd(msg, bigEmoji, opts){
    const scene=this;
    const keepTweens = opts && opts.keepTweens;
    if(!keepTweens){
      scene.tweens.killAll();
      scene.time.removeAllEvents();
    }
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
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
    const btn=this.add.text(240,bgY+80,'Try Again',{font:'20px sans-serif',fill:'#000',backgroundColor:'#ffffff',padding:{x:14,y:8}})
      .setOrigin(0.5).setDepth(22)
      .setInteractive({ useHandCursor:true });
    btn.on('pointerdown',()=>{
        btn.disableInteractive();
        const key = img ? img.texture.key : null;
        if(key){
          GameState.lastEndKey = key;
          if(!GameState.badges.includes(key)) GameState.badges.push(key);
          GameState.badgeCounts[key] = (GameState.badgeCounts[key] || 0) + 1;
          const grayKey = `${key}_gray`;
          createGrayscaleTexture(this,key,grayKey);
          GameState.carryPortrait = img.setDepth(25);
        }
        const glowTex = createGlowTexture(this,0xffffff,'tryagain_glow');
        const glow = this.add.image(btn.x,btn.y,'tryagain_glow').setDepth(24).setAlpha(0.8).setScale(0.1);
        this.tweens.add({targets:glow,scale:3,alpha:0,duration:300,onComplete:()=>glow.destroy()});
        btn.setVisible(false);
        const flashTex = createGlowTexture(this,0xffffff,'screen_flash',256);
        const overlayG = this.add.image(btn.x,btn.y,'screen_flash').setDepth(23);
        overlayG.setDisplaySize(btn.width,btn.height);
        this.tweens.add({targets:overlayG,x:240,y:320,scaleX:Math.max(480/btn.width,640/btn.height)*2,scaleY:Math.max(480/btn.width,640/btn.height)*2,duration:300,ease:'Cubic.easeOut',onComplete:()=>{
          bg.destroy(); txt.destroy(); btn.destroy(); if(titleText) titleText.destroy();
          if(endOverlay){ endOverlay.destroy(); endOverlay=null; }
          restartGame.call(this, overlayG);
        }});
      });
    GameState.gameOver=true;
  }

  function restartGame(overlay){
    const scene=this;
    scene.tweens.killAll();
    scene.time.removeAllEvents();
    cleanupFloatingEmojis();
    cleanupHeartEmojis(scene);
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
      girl.setPosition(startX, 245).setVisible(false);
    }
    GameState.money=10.00; GameState.love=3;
    moneyText.setText(receipt(GameState.money));
    loveText.setText(String(GameState.love));
    updateLevelDisplay();
    updateCloudStatus(scene);
    if(GameState.activeCustomer){
      if(GameState.activeCustomer.heartEmoji){ GameState.activeCustomer.heartEmoji.destroy(); GameState.activeCustomer.heartEmoji=null; }
      GameState.activeCustomer.sprite.destroy();
    }
    GameState.activeCustomer=null;
    cleanupDogs(scene);
    GameState.queue.forEach(c => { if(c.walkTween){ c.walkTween.stop(); if(c.walkTween.remove) c.walkTween.remove(); c.walkTween=null; } });
    GameState.wanderers.forEach(c => { if(c.walkTween){ c.walkTween.stop(); if(c.walkTween.remove) c.walkTween.remove(); c.walkTween=null; } });
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
